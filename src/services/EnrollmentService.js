import { supabase } from "../lib/supabase";
import { fromRow } from "../lib/records";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "../lib/database";

import { auth, db } from "../lib/backend";

/* =========================================================
   CONSTANTS
========================================================= */

const ENROLLMENTS_COLLECTION = "enrollments";

// The database also clamps this. Keeping it here avoids wasted requests.
const MAX_WATCH_CHUNK_SECONDS = 15;

/* =========================================================
   HELPERS
========================================================= */

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user;
}

function getEnrollmentId(uid, courseId) {
  return `${uid}_${courseId}`;
}

/**
 * Loads an enrollment document and makes sure it belongs to the
 * logged-in student. Optionally requires the enrollment to be active.
 */
async function getOwnedEnrollment(
  enrollmentId,
  { requireActive = false } = {}
) {
  const user = requireUser();

  if (!enrollmentId) {
    throw new Error("Enrollment ID is required.");
  }

  const enrollmentRef = doc(db, ENROLLMENTS_COLLECTION, enrollmentId);
  const snapshot = await getDoc(enrollmentRef);

  if (!snapshot.exists()) {
    return { ref: enrollmentRef, snapshot, data: null };
  }

  const data = snapshot.data();

  if (data.uid !== user.uid) {
    throw new Error("You cannot access this enrollment.");
  }

  if (requireActive && data.status !== "active") {
    throw new Error("Your enrollment is not active.");
  }

  return { ref: enrollmentRef, snapshot, data };
}

/* =========================================================
   GET MY ENROLLMENTS
========================================================= */

export async function getMyEnrollments() {
  const user = requireUser();

  const enrollmentsRef = collection(db, ENROLLMENTS_COLLECTION);

  // One where() and no orderBy() on purpose: no composite index needed.
  const enrollmentsQuery = query(
    enrollmentsRef,
    where("uid", "==", user.uid)
  );

  const snapshot = await getDocs(enrollmentsQuery);

  const enrollments = snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));

  // Newest first, sorted on the client.
  enrollments.sort((a, b) => {
    const aTime = a.enrolledAt?.toMillis?.() || 0;
    const bTime = b.enrolledAt?.toMillis?.() || 0;
    return bTime - aTime;
  });

  return enrollments;
}

/* =========================================================
   GET SINGLE ENROLLMENT (by student + course)
========================================================= */

export async function getEnrollment(uid, courseId) {
  const user = requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const studentId = uid || user.uid;

  // A student can only access their own enrollment.
  if (studentId !== user.uid) {
    throw new Error("You are not allowed to access this enrollment.");
  }

  return getEnrollmentById(getEnrollmentId(studentId, courseId));
}

/* =========================================================
   GET ENROLLMENT BY ID
========================================================= */

export async function getEnrollmentById(enrollmentId) {
  const { snapshot, data } = await getOwnedEnrollment(enrollmentId);

  if (!data) {
    return null;
  }

  return {
    id: snapshot.id,
    ...data,
  };
}

/* =========================================================
   ENROLL STUDENT
========================================================= */

export async function enrollStudent({ courseId, paymentStatus = "free" }) {
  requireUser();

  if (!courseId) throw new Error("Course ID is required.");

  if (paymentStatus !== "free") {
    throw new Error("Paid enrollment must be verified by the payment server.");
  }

  const { data, error } = await supabase.rpc("lms_enroll_free", {
    course: courseId,
  });

  if (error) throw error;

  return fromRow("enrollments", data);
}

/* =========================================================
   MARK LESSON COMPLETE
   The server rejects video lessons whose video has not ended
   (checked inline inside lms_complete_lesson — see
   supabase/migrations/202609230005_lesson_watch_progress.sql).
========================================================= */

export async function markLessonComplete(enrollmentId, lessonId) {
  requireUser();

  if (!enrollmentId || !lessonId) {
    throw new Error("Enrollment ID and lesson ID are required.");
  }

  const { data, error } = await supabase.rpc("lms_complete_lesson", {
    enrollment: enrollmentId,
    lesson: lessonId,
  });

  if (error) throw error;

  return fromRow("enrollments", data);
}

/* =========================================================
   UPDATE LAST ACCESSED LESSON
========================================================= */

export async function updateLastLesson(enrollmentId, lessonId) {
  const { ref } = await getOwnedEnrollment(enrollmentId, {
    requireActive: true,
  });

  await updateDoc(ref, {
    lastLessonId: lessonId || "",
    lastAccessedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/* =========================================================
   LESSON WATCH PROGRESS

   Both functions below call the lms_record_lesson_watch /
   lms_get_lesson_watch_progress RPCs (not the table directly —
   there is intentionally no client-writable/readable policy on
   lms_lesson_watch_progress itself, only on what these two
   security-definer functions allow). Parameter names here MUST
   match the SQL function signatures exactly:

     lms_record_lesson_watch(enrollment text, lesson text,
                              watched_seconds integer, video_ended boolean)
     lms_get_lesson_watch_progress(enrollment text)

   If you change one side, change the other in the same edit —
   a silent name mismatch here shows up as a 404 PGRST202 error
   at runtime, not a build-time error.
========================================================= */

/**
 * Returns every saved watch row for this enrollment:
 * [{ lessonId, watchedSeconds, videoEnded }]
 */
export async function getLessonWatchProgress(enrollmentId) {
  requireUser();

  if (!enrollmentId) {
    throw new Error("Enrollment ID is required.");
  }

  const { data, error } = await supabase.rpc(
    "lms_get_lesson_watch_progress",
    { enrollment: enrollmentId }
  );

  if (error) throw error;

  return (data || []).map((row) => fromRow("lesson_watch_progress", row));
}

/**
 * Adds watched seconds for a lesson and/or flags the video as ended.
 * Returns { watchedSeconds, videoEnded } for that lesson.
 */
export async function recordLessonWatch(
  enrollmentId,
  lessonId,
  seconds = 0,
  videoEnded = false
) {
  requireUser();

  if (!enrollmentId || !lessonId) {
    throw new Error("Enrollment ID and lesson ID are required.");
  }

  const safeSeconds = Math.min(
    MAX_WATCH_CHUNK_SECONDS,
    Math.max(0, Math.floor(Number(seconds) || 0))
  );

  const { data, error } = await supabase.rpc("lms_record_lesson_watch", {
    enrollment: enrollmentId,
    lesson: lessonId,
    watched_seconds: safeSeconds,
    video_ended: Boolean(videoEnded),
  });

  if (error) throw error;

  return fromRow("lesson_watch_progress", data);
}