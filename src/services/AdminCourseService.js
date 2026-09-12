// src/services/adminCourseService.js

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";

import {
  deleteObject,
  listAll,
  ref,
} from "firebase/storage";

import { auth, db, storage } from "../firebase/Firebase";


// ============================================================
// CONSTANTS
// ============================================================

const COURSES_COLLECTION = "courses";


// ============================================================
// ADMIN AUTH CHECK
// ============================================================

function requireAuthenticatedAdmin() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user;
}


// ============================================================
// HELPERS
// ============================================================

function courseFromDoc(courseDoc) {
  return {
    id: courseDoc.id,
    ...courseDoc.data(),
  };
}


function sortCourses(a, b) {
  const orderA =
    typeof a.order === "number"
      ? a.order
      : 999999;

  const orderB =
    typeof b.order === "number"
      ? b.order
      : 999999;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return (a.title || "").localeCompare(
    b.title || ""
  );
}


// ============================================================
// GET ALL COURSES
// ============================================================

/**
 * Gets every course in the LMS.
 *
 * Admin can see:
 *
 * draft
 * pending
 * published
 * rejected
 * archived
 */
export async function getAllCourses() {
  requireAuthenticatedAdmin();

  const snapshot = await getDocs(
    collection(db, COURSES_COLLECTION)
  );

  return snapshot.docs
    .map(courseFromDoc)
    .sort(sortCourses);
}


// ============================================================
// GET PENDING COURSES
// ============================================================

/**
 * Gets courses waiting for admin approval.
 */
export async function getPendingCourses() {
  requireAuthenticatedAdmin();

  const coursesQuery = query(
    collection(db, COURSES_COLLECTION),
    where("status", "==", "pending")
  );

  const snapshot = await getDocs(
    coursesQuery
  );

  return snapshot.docs
    .map(courseFromDoc)
    .sort(sortCourses);
}


// ============================================================
// LIVE ADMIN COURSE LIST
// ============================================================

/**
 * Real-time listener for the Admin Course table.
 *
 * Whenever a teacher creates, edits, submits,
 * or an admin approves/rejects a course,
 * the Admin panel updates automatically.
 */
export function subscribeToAllCourses(
  callback,
  onError
) {
  const user = auth.currentUser;

  if (!user) {
    const error = new Error(
      "You must be logged in."
    );

    if (onError) {
      onError(error);
    }

    return () => {};
  }

  const coursesQuery = query(
    collection(db, COURSES_COLLECTION)
  );

  return onSnapshot(
    coursesQuery,

    (snapshot) => {
      const courses = snapshot.docs
        .map(courseFromDoc)
        .sort(sortCourses);

      callback(courses);
    },

    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}


// ============================================================
// APPROVE COURSE
// ============================================================

/**
 * Admin approves a pending course.
 *
 * pending
 *    ↓
 * published
 */
export async function approveCourse(
  courseId
) {
  requireAuthenticatedAdmin();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const snapshot = await getDoc(
    courseRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Course not found."
    );
  }

  const course = snapshot.data();

  if (course.status !== "pending") {
    throw new Error(
      "Only pending courses can be approved."
    );
  }

  await updateDoc(courseRef, {
    status: "published",

    publishedAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),

    rejectionReason: null,
  });

  return {
    id: courseId,
    status: "published",
  };
}


// ============================================================
// REJECT COURSE
// ============================================================

/**
 * Admin rejects a course.
 *
 * pending
 *    ↓
 * rejected
 *
 * A rejection reason is saved so the teacher
 * can see what needs to be fixed.
 */
export async function rejectCourse(
  courseId,
  reason = ""
) {
  requireAuthenticatedAdmin();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const cleanReason =
    reason.trim();

  if (!cleanReason) {
    throw new Error(
      "Please provide a rejection reason."
    );
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const snapshot = await getDoc(
    courseRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Course not found."
    );
  }

  const course = snapshot.data();

  if (course.status !== "pending") {
    throw new Error(
      "Only pending courses can be rejected."
    );
  }

  await updateDoc(courseRef, {
    status: "rejected",

    rejectionReason:
      cleanReason,

    updatedAt:
      serverTimestamp(),
  });

  return {
    id: courseId,
    status: "rejected",
    rejectionReason: cleanReason,
  };
}


// ============================================================
// ADMIN UNPUBLISH
// ============================================================

/**
 * Emergency admin action.
 *
 * published
 *    ↓
 * archived
 *
 * This immediately removes the course
 * from the public LMS.
 */
export async function adminUnpublishCourse(
  courseId
) {
  requireAuthenticatedAdmin();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const snapshot = await getDoc(
    courseRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Course not found."
    );
  }

  await updateDoc(courseRef, {
    status: "archived",

    updatedAt:
      serverTimestamp(),
  });

  return {
    id: courseId,
    status: "archived",
  };
}


// ============================================================
// ADMIN RESTORE / REPUBLISH
// ============================================================

/**
 * Allows an admin to move an archived course
 * back into the approval process.
 *
 * archived
 *    ↓
 * pending
 *
 * This is useful when an admin wants a previously
 * archived course to go through approval again.
 */
export async function sendArchivedCourseForApproval(
  courseId
) {
  requireAuthenticatedAdmin();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const snapshot = await getDoc(
    courseRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Course not found."
    );
  }

  await updateDoc(courseRef, {
    status: "pending",

    updatedAt:
      serverTimestamp(),

    rejectionReason: null,
  });

  return {
    id: courseId,
    status: "pending",
  };
}


// ============================================================
// FEATURED COURSE
// ============================================================

/**
 * Admin controls whether a course appears
 * in the featured/homepage area.
 */
export async function setFeatured(
  courseId,
  featured
) {
  requireAuthenticatedAdmin();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const snapshot = await getDoc(
    courseRef
  );

  if (!snapshot.exists()) {
    throw new Error(
      "Course not found."
    );
  }

  await updateDoc(courseRef, {
    featured:
      Boolean(featured),

    updatedAt:
      serverTimestamp(),
  });

  return {
    id: courseId,
    featured: Boolean(featured),
  };
}


// ============================================================
// COURSE HOMEPAGE ORDER
// ============================================================

/**
 * Admin controls the homepage order.
 *
 * Example:
 *
 * [
 *   "courseA",
 *   "courseB",
 *   "courseC"
 * ]
 *
 * becomes:
 *
 * courseA → order 0
 * courseB → order 1
 * courseC → order 2
 */
export async function reorderFeaturedCourses(
  courseIds = []
) {
  requireAuthenticatedAdmin();

  if (!Array.isArray(courseIds)) {
    throw new Error(
      "courseIds must be an array."
    );
  }

  if (courseIds.length === 0) {
    return true;
  }

  let batch = writeBatch(db);
  let operations = 0;

  for (
    let index = 0;
    index < courseIds.length;
    index++
  ) {
    const courseId =
      courseIds[index];

    if (!courseId) {
      continue;
    }

    const courseRef = doc(
      db,
      COURSES_COLLECTION,
      courseId
    );

    batch.update(courseRef, {
      order: index,
      updatedAt:
        serverTimestamp(),
    });

    operations++;

    /**
     * Keep a safe margin below Firestore's
     * batch operation limit.
     */
    if (operations >= 450) {
      await batch.commit();

      batch = writeBatch(db);
      operations = 0;
    }
  }

  if (operations > 0) {
    await batch.commit();
  }

  return true;
}


// ============================================================
// SET COURSE ORDER
// ============================================================

/**
 * Simple version for moving one course
 * to a specific position.
 */
export async function setCourseOrder(
  courseId,
  order
) {
  requireAuthenticatedAdmin();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  if (!Number.isFinite(Number(order))) {
    throw new Error(
      "Order must be a number."
    );
  }

  await updateDoc(
    doc(
      db,
      COURSES_COLLECTION,
      courseId
    ),
    {
      order: Number(order),
      updatedAt:
        serverTimestamp(),
    }
  );

  return true;
}


// ============================================================
// ADMIN DELETE COURSE
// ============================================================

/**
 * Emergency course deletion.
 *
 * This removes:
 *
 * 1. Lessons
 * 2. Modules
 * 3. Course document
 * 4. Course Storage files
 *
 * Unlike teacher deleteCourse(),
 * this function does NOT check instructorId.
 *
 * Admin can delete any course.
 */
export async function adminDeleteCourse(
  courseId
) {
  requireAuthenticatedAdmin();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const courseSnapshot =
    await getDoc(courseRef);

  if (!courseSnapshot.exists()) {
    throw new Error(
      "Course not found."
    );
  }


  // ----------------------------------------------------------
  // Find all modules
  // ----------------------------------------------------------

  const modulesSnapshot =
    await getDocs(
      collection(
        db,
        COURSES_COLLECTION,
        courseId,
        "modules"
      )
    );


  // ----------------------------------------------------------
  // Delete modules + lessons
  // ----------------------------------------------------------

  let batch = writeBatch(db);
  let operations = 0;

  for (
    const moduleDoc of modulesSnapshot.docs
  ) {
    const lessonsSnapshot =
      await getDocs(
        collection(
          db,
          COURSES_COLLECTION,
          courseId,
          "modules",
          moduleDoc.id,
          "lessons"
        )
      );

    for (
      const lessonDoc of lessonsSnapshot.docs
    ) {
      batch.delete(
        lessonDoc.ref
      );

      operations++;

      if (operations >= 450) {
        await batch.commit();

        batch = writeBatch(db);
        operations = 0;
      }
    }

    batch.delete(
      moduleDoc.ref
    );

    operations++;

    if (operations >= 450) {
      await batch.commit();

      batch = writeBatch(db);
      operations = 0;
    }
  }


  // ----------------------------------------------------------
  // Delete course
  // ----------------------------------------------------------

  batch.delete(courseRef);
  operations++;


  if (operations > 0) {
    await batch.commit();
  }


  // ----------------------------------------------------------
  // Delete Storage files
  // ----------------------------------------------------------

  await deleteCourseStorage(
    courseId
  );


  return true;
}


// ============================================================
// DELETE COURSE STORAGE
// ============================================================

/**
 * Removes everything under:
 *
 * courses/{courseId}/
 *
 * and:
 *
 * courseThumbnails/{courseId}/
 */
export async function deleteCourseStorage(
  courseId
) {
  if (!courseId) return;

  const paths = [
    `courses/${courseId}`,
    `courseThumbnails/${courseId}`,
  ];

  for (const path of paths) {
    try {
      const folderRef =
        ref(storage, path);

      await deleteStorageFolder(
        folderRef
      );
    } catch {
      // Storage cleanup is best effort.
    }
  }
}


// ============================================================
// RECURSIVE STORAGE DELETE
// ============================================================

async function deleteStorageFolder(
  folderRef
) {
  try {
    const result =
      await listAll(folderRef);


    // Delete files
    await Promise.all(
      result.items.map(
        (itemRef) =>
          deleteObject(
            itemRef
          ).catch(() => null)
      )
    );


    // Delete nested folders
    for (
      const childFolder
      of result.prefixes
    ) {
      await deleteStorageFolder(
        childFolder
      );
    }
  } catch {
    // Ignore missing files/folders.
  }
}


// ============================================================
// ADMIN — GET COURSE COUNTS
// ============================================================

/**
 * Calculates Admin dashboard statistics
 * from the courses collection.
 *
 * Returns:
 *
 * total
 * short
 * long
 * published
 * pending
 * draft
 * rejected
 * archived
 * featured
 */
export async function getCourseStats() {
  requireAuthenticatedAdmin();

  const snapshot =
    await getDocs(
      collection(
        db,
        COURSES_COLLECTION
      )
    );

  const stats = {
    total: 0,
    short: 0,
    long: 0,
    published: 0,
    pending: 0,
    draft: 0,
    rejected: 0,
    archived: 0,
    featured: 0,
  };

  snapshot.docs.forEach(
    (courseDoc) => {
      const course =
        courseDoc.data();

      stats.total++;

      if (
        course.type === "short"
      ) {
        stats.short++;
      }

      if (
        course.type === "long"
      ) {
        stats.long++;
      }

      if (
        stats[
          course.status
        ] !== undefined
      ) {
        stats[
          course.status
        ]++;
      }

      if (
        course.featured === true
      ) {
        stats.featured++;
      }
    }
  );

  return stats;
}


// ============================================================
// FIND COURSES BY INSTRUCTOR
// ============================================================

/**
 * Useful for Admin → Teacher profile
 * or "courses by instructor" filtering.
 */
export async function getCoursesByInstructor(
  instructorId
) {
  requireAuthenticatedAdmin();

  if (!instructorId) {
    throw new Error(
      "Instructor ID is required."
    );
  }

  const coursesQuery =
    query(
      collection(
        db,
        COURSES_COLLECTION
      ),
      where(
        "instructorId",
        "==",
        instructorId
      )
    );

  const snapshot =
    await getDocs(
      coursesQuery
    );

  return snapshot.docs
    .map(courseFromDoc)
    .sort(sortCourses);
}