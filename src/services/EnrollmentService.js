import { supabase } from "../lib/supabase";
import { fromRow } from "../lib/records";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "../lib/database";

import { auth, db } from "../lib/backend";

/* =========================================================
   COLLECTION
========================================================= */

const ENROLLMENTS_COLLECTION = "enrollments";

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

/* =========================================================
   GET MY ENROLLMENTS
========================================================= */

export async function getMyEnrollments() {
  const user = requireUser();

  const enrollmentsRef = collection(
    db,
    ENROLLMENTS_COLLECTION
  );

  /*
    IMPORTANT:

    We only use ONE where() condition.

    There is intentionally NO orderBy().
    This avoids requiring a composite Firestore index.
  */

  const enrollmentsQuery = query(
    enrollmentsRef,
    where("uid", "==", user.uid)
  );

  const snapshot = await getDocs(enrollmentsQuery);

  const enrollments = snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));

  /*
    Sort on the client instead of using Firestore orderBy().
  */

  enrollments.sort((a, b) => {
    const aTime =
      a.enrolledAt?.toMillis?.() || 0;

    const bTime =
      b.enrolledAt?.toMillis?.() || 0;

    return bTime - aTime;
  });

  return enrollments;
}

/* =========================================================
   GET SINGLE ENROLLMENT
========================================================= */

export async function getEnrollment(
  uid,
  courseId
) {
  const user = requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const studentId = uid || user.uid;

  /*
    A student can only access their own enrollment.
  */

  if (studentId !== user.uid) {
    throw new Error(
      "You are not allowed to access this enrollment."
    );
  }

  const enrollmentId = getEnrollmentId(
    studentId,
    courseId
  );

  const enrollmentRef = doc(
    db,
    ENROLLMENTS_COLLECTION,
    enrollmentId
  );

  const snapshot = await getDoc(enrollmentRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/* =========================================================
   ENROLL STUDENT
========================================================= */

export async function enrollStudent({ courseId, paymentStatus = "free" }) {
  requireUser();
  if (!courseId) throw new Error("Course ID is required.");
  if (paymentStatus !== "free") throw new Error("Paid enrollment must be verified by the payment server.");
  const { data, error } = await supabase.rpc("lms_enroll_free", { course: courseId });
  if (error) throw error;
  return fromRow("enrollments", data);
}

/* =========================================================
   MARK LESSON COMPLETE
========================================================= */

export async function markLessonComplete(enrollmentId, lessonId) {
  requireUser();
  const { data, error } = await supabase.rpc("lms_complete_lesson", { enrollment: enrollmentId, lesson: lessonId });
  if (error) throw error;
  return fromRow("enrollments", data);
}

/* =========================================================
   UPDATE LAST ACCESSED LESSON
========================================================= */

export async function updateLastLesson(
  enrollmentId,
  lessonId
) {
  const user = requireUser();

  if (!enrollmentId) {
    throw new Error(
      "Enrollment ID is required."
    );
  }

  const enrollmentRef = doc(
    db,
    ENROLLMENTS_COLLECTION,
    enrollmentId
  );

  const snapshot =
    await getDoc(enrollmentRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Enrollment not found."
    );
  }

  const enrollment =
    snapshot.data();

  if (enrollment.uid !== user.uid) {
    throw new Error(
      "You cannot update this enrollment."
    );
  }

  if (enrollment.status !== "active") {
    throw new Error(
      "Your enrollment is not active."
    );
  }

  await updateDoc(
    enrollmentRef,
    {
      lastLessonId:
        lessonId || "",
      lastAccessedAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    }
  );
}

/* =========================================================
   GET ENROLLMENT BY ID
========================================================= */

export async function getEnrollmentById(
  enrollmentId
) {
  const user = requireUser();

  if (!enrollmentId) {
    throw new Error(
      "Enrollment ID is required."
    );
  }

  const enrollmentRef = doc(
    db,
    ENROLLMENTS_COLLECTION,
    enrollmentId
  );

  const snapshot =
    await getDoc(enrollmentRef);

  if (!snapshot.exists()) {
    return null;
  }

  const enrollment =
    snapshot.data();

  if (enrollment.uid !== user.uid) {
    throw new Error(
      "You cannot access this enrollment."
    );
  }

  return {
    id: snapshot.id,
    ...enrollment,
  };
}
