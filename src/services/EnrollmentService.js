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
} from "firebase/firestore";

import { auth, db } from "../firebase/Firebase";

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

export async function enrollStudent({
  courseId,
  paymentStatus = "free",
  paymentId = "",
}) {
  const user = requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const enrollmentId = getEnrollmentId(
    user.uid,
    courseId
  );

  const enrollmentRef = doc(
    db,
    ENROLLMENTS_COLLECTION,
    enrollmentId
  );

  /*
    Check if already enrolled.
  */

  const existingSnapshot =
    await getDoc(enrollmentRef);

  if (existingSnapshot.exists()) {
    return {
      id: existingSnapshot.id,
      ...existingSnapshot.data(),
    };
  }

  const isFree = paymentStatus === "free";
  const isPaid = paymentStatus === "paid";

  if (!isFree && !isPaid) {
    throw new Error("Invalid payment status.");
  }

  if (isPaid && !paymentId) {
    throw new Error("Payment ID is required for a paid enrollment.");
  }

  /*
    Firebase-only flow:
    Razorpay Checkout has returned a payment ID before this function
    is called, so both free and paid enrollments are unlocked here.

    Important: this is intentionally client-side and therefore cannot
    verify a Razorpay signature. Add server-side verification before
    using this as the final production payment flow.
  */

  const enrollment = {
    uid: user.uid,
    studentId: user.uid,

    courseId,

    status: "active",

    paymentStatus: isFree ? "free" : "paid",

    paymentId: paymentId || "",

    progress: 0,

    completedLessons: [],

    lastLessonId: "",

    enrolledAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    lastAccessedAt: serverTimestamp(),
  };

  await setDoc(
    enrollmentRef,
    enrollment
  );

  return {
    id: enrollmentId,
    ...enrollment,
  };
}

/* =========================================================
   MARK LESSON COMPLETE
========================================================= */

export async function markLessonComplete(
  enrollmentId,
  lessonId,
  totalLessons
) {
  const user = requireUser();

  if (!enrollmentId) {
    throw new Error(
      "Enrollment ID is required."
    );
  }

  if (!lessonId) {
    throw new Error(
      "Lesson ID is required."
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

  /*
    Security check
  */

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

  const completedLessons =
    Array.isArray(
      enrollment.completedLessons
    )
      ? [...enrollment.completedLessons]
      : [];

  /*
    Don't add the same lesson twice.
  */

  if (
    !completedLessons.includes(lessonId)
  ) {
    completedLessons.push(lessonId);
  }

  const total =
    Math.max(
      Number(totalLessons) || 0,
      1
    );

  const progress = Math.min(
    100,
    Math.round(
      (completedLessons.length /
        total) *
        100
    )
  );

  await updateDoc(
    enrollmentRef,
    {
      completedLessons,
      progress,
      lastLessonId: lessonId,
      lastAccessedAt:
        serverTimestamp(),
      updatedAt:
        serverTimestamp(),
    }
  );

  return {
    progress,
    completedLessons,
  };
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
