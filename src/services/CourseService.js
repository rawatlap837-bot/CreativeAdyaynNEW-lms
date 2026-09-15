import { useEffect, useRef, useState } from "react";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import {
  deleteObject,
  ref,
} from "firebase/storage";

import {
  auth,
  db,
  storage,
} from "../firebase/Firebase";

import { uploadImage } from "../lib/Cloudinary";

/* ============================================================
   COLLECTION
============================================================ */

export const COURSES_COLLECTION = "courses";

/* ============================================================
   COURSE STATUS
============================================================ */

export const COURSE_STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  PUBLISHED: "published",
  REJECTED: "rejected",
  ARCHIVED: "archived",
};

/* ============================================================
   COURSE TYPES
============================================================ */

export const COURSE_TYPES = {
  SHORT: "short",
  LONG: "long",
};

/* ============================================================
   HELPERS
============================================================ */

export function slugify(title = "") {
  return title
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function courseFromDoc(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function sortCourses(a, b) {
  const orderA =
    typeof a.order === "number" ? a.order : 999999;

  const orderB =
    typeof b.order === "number" ? b.order : 999999;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return (a.title || "").localeCompare(b.title || "");
}

function requireAuthUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be logged in to perform this action."
    );
  }

  return user;
}

/*
  Turns raw Firebase errors into something safe to show
  in the UI, without leaking internal error codes/messages
  to end users. Permission errors are the most common case
  when a listener is attached for a user/role that the
  Firestore rules don't allow to read that data.
*/
function friendlyFirestoreError(error, fallbackMessage) {
  if (error?.code === "permission-denied") {
    return "You don't have permission to view this data.";
  }

  if (error?.code === "unavailable") {
    return "Connection issue — please check your internet and try again.";
  }

  return error?.message || fallbackMessage;
}

/* ============================================================
   VERIFY COURSE OWNER
============================================================ */

async function requireCourseOwner(courseId) {
  const user = requireAuthUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const courseRef = doc(db, COURSES_COLLECTION, courseId);

  const courseSnapshot = await getDoc(courseRef);

  if (!courseSnapshot.exists()) {
    throw new Error("Course not found.");
  }

  const course = courseSnapshot.data();

  if (course.instructorId !== user.uid) {
    throw new Error(
      "You do not have permission to manage this course."
    );
  }

  return {
    user,
    courseRef,
    course,
  };
}

/* ============================================================
   CATEGORY GROUPING
============================================================ */

export function groupByCategory(courses = []) {
  const categories = [];
  const coursesByCategory = {};

  for (const course of courses) {
    const category = course.category?.trim() || "Uncategorized";

    if (!coursesByCategory[category]) {
      coursesByCategory[category] = [];
      categories.push(category);
    }

    coursesByCategory[category].push(course);
  }

  return {
    categories,
    coursesByCategory,
  };
}

/* ============================================================
   TEACHER — GET MY COURSES (one-off fetch)
============================================================ */

export async function getMyCourses(
  teacherId = auth.currentUser?.uid
) {
  if (!teacherId) {
    throw new Error("Teacher ID is required.");
  }

  requireAuthUser();

  const q = query(
    collection(db, COURSES_COLLECTION),
    where("instructorId", "==", teacherId)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(courseFromDoc).sort(sortCourses);
}

/* ============================================================
   TEACHER — LIVE COURSES (realtime)

   IMPORTANT: pass `enabled: false` for any session that is
   not actually an instructor session (e.g. a student viewing
   their own dashboard). Firing this listener for a user whose
   Firestore rules don't grant them instructor-level reads will
   always resolve to a permission-denied error — that is a
   rules/role mismatch, not something this hook can work around,
   so the caller should simply not attach the listener at all.
============================================================ */

export function useMyCourses(
  teacherId = auth.currentUser?.uid,
  { enabled = true } = {}
) {
  const [state, setState] = useState({
    courses: [],
    loading: true,
    error: null,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setState({
        courses: [],
        loading: false,
        error: null,
      });

      return;
    }

    if (!teacherId) {
      setState({
        courses: [],
        loading: false,
        error: "Teacher is not logged in.",
      });

      return;
    }

    setState({
      courses: [],
      loading: true,
      error: null,
    });

    const q = query(
      collection(db, COURSES_COLLECTION),
      where("instructorId", "==", teacherId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMountedRef.current) return;

        const courses = snapshot.docs
          .map(courseFromDoc)
          .sort(sortCourses);

        setState({
          courses,
          loading: false,
          error: null,
        });
      },
      (error) => {
        if (!isMountedRef.current) return;

        console.error("Teacher courses listener error:", error);

        setState({
          courses: [],
          loading: false,
          error: friendlyFirestoreError(
            error,
            "Unable to load teacher courses."
          ),
        });
      }
    );

    return () => unsubscribe();
  }, [teacherId, enabled]);

  return state;
}

/* ============================================================
   GET COURSE BY ID
============================================================ */

export async function getCourseById(courseId) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const courseRef = doc(db, COURSES_COLLECTION, courseId);

  const snapshot = await getDoc(courseRef);

  if (!snapshot.exists()) {
    return null;
  }

  return courseFromDoc(snapshot);
}

/* ============================================================
   CREATE COURSE

  IMPORTANT:

  Teacher creates:

      draft
        ↓
      teacher adds content
        ↓
      submit for approval
        ↓
      pending
        ↓
      admin approves
        ↓
      published
============================================================ */

export async function createCourse(courseData = {}) {
  const user = requireAuthUser();

  /* ----------------------------------------------------------
     VALIDATION
  ---------------------------------------------------------- */

  const title = courseData.title?.trim();

  if (!title) {
    throw new Error("Course title is required.");
  }

  if (
    courseData.type !== COURSE_TYPES.SHORT &&
    courseData.type !== COURSE_TYPES.LONG
  ) {
    throw new Error("Course type must be short or long.");
  }

  /* ----------------------------------------------------------
     CREATE NEW FIRESTORE DOCUMENT
  ---------------------------------------------------------- */

  const courseRef = doc(collection(db, COURSES_COLLECTION));

  /* ----------------------------------------------------------
     COURSE DATA
  ---------------------------------------------------------- */

  const course = {
    /* BASIC INFORMATION */

    title,

    slug: courseData.slug?.trim() || slugify(title),

    description: courseData.description?.trim() || "",

    shortDescription: courseData.shortDescription?.trim() || "",

    category: courseData.category?.trim() || "",

    level: courseData.level?.trim() || "",

    duration: courseData.duration?.trim() || "",

    /* COURSE TYPE */

    type: courseData.type,

    /* OWNER */

    instructorId: user.uid,

    instructorName:
      courseData.instructorName?.trim() || user.displayName || "",

    /* MEDIA
       thumbnailPath holds a Cloudinary publicId (see
       uploadCourseThumbnail below), NOT a Firebase Storage
       path. bannerPath / previewVideoPath are still Firebase
       Storage paths until those are migrated too. */

    thumbnailUrl: courseData.thumbnailUrl || "",

    thumbnailPath: courseData.thumbnailPath || "",

    bannerUrl: courseData.bannerUrl || "",

    bannerPath: courseData.bannerPath || "",

    previewVideoUrl: courseData.previewVideoUrl || "",

    previewVideoPath: courseData.previewVideoPath || "",

    /* PRICING */

    price: Number(courseData.price) || 0,

    discountPrice: Number(courseData.discountPrice) || 0,

    currency: courseData.currency || "INR",

    /* STATUS */

    status: COURSE_STATUS.DRAFT,

    /* ADMIN CONTROLLED */

    featured: false,

    order: 0,

    /* TIMESTAMPS */

    createdAt: serverTimestamp(),

    updatedAt: serverTimestamp(),

    publishedAt: null,

    /* REJECTION */

    rejectionReason: "",

    /* COUNTERS */

    studentCount: 0,

    enrollmentCount: 0,
  };

  await setDoc(courseRef, course);

  return getCourseById(courseRef.id);
}

/* ============================================================
   UPDATE COURSE
============================================================ */

export async function updateCourse(courseId, courseData = {}) {
  const { courseRef, course: existingCourse } =
    await requireCourseOwner(courseId);

  /* ----------------------------------------------------------
     LOCK PENDING
  ---------------------------------------------------------- */

  if (existingCourse.status === COURSE_STATUS.PENDING) {
    throw new Error(
      "This course is waiting for admin approval and cannot be edited right now."
    );
  }

  /* ----------------------------------------------------------
     LOCK ARCHIVED
  ---------------------------------------------------------- */

  if (existingCourse.status === COURSE_STATUS.ARCHIVED) {
    throw new Error("Archived courses cannot be edited.");
  }

  const updates = {};

  /* ----------------------------------------------------------
     TITLE
  ---------------------------------------------------------- */

  if (courseData.title !== undefined) {
    const title = courseData.title.trim();

    if (!title) {
      throw new Error("Course title cannot be empty.");
    }

    updates.title = title;

    updates.slug = courseData.slug?.trim() || slugify(title);
  }

  /* ----------------------------------------------------------
     BASIC EDITABLE FIELDS
  ---------------------------------------------------------- */

  const editableFields = [
    "description",
    "shortDescription",
    "category",
    "level",
    "duration",
    "thumbnailUrl",
    "thumbnailPath",
    "bannerUrl",
    "bannerPath",
    "previewVideoUrl",
    "previewVideoPath",
    "currency",
  ];

  for (const field of editableFields) {
    if (courseData[field] !== undefined) {
      updates[field] = courseData[field];
    }
  }

  /* ----------------------------------------------------------
     PRICING
  ---------------------------------------------------------- */

  if (courseData.price !== undefined) {
    updates.price = Number(courseData.price) || 0;
  }

  if (courseData.discountPrice !== undefined) {
    updates.discountPrice = Number(courseData.discountPrice) || 0;
  }

  /* ----------------------------------------------------------
     COURSE TYPE
  ---------------------------------------------------------- */

  if (courseData.type !== undefined) {
    if (
      courseData.type !== COURSE_TYPES.SHORT &&
      courseData.type !== COURSE_TYPES.LONG
    ) {
      throw new Error("Invalid course type.");
    }

    updates.type = courseData.type;
  }

  /* ----------------------------------------------------------
     NEVER ALLOW TEACHER TO MODIFY ADMIN FIELDS
  ---------------------------------------------------------- */

  delete updates.instructorId;
  delete updates.featured;
  delete updates.order;
  delete updates.publishedAt;
  delete updates.createdAt;
  delete updates.status;

  /* ----------------------------------------------------------
     MAJOR CHANGE DETECTION
  ---------------------------------------------------------- */

  const titleChanged =
    courseData.title !== undefined &&
    courseData.title.trim() !== existingCourse.title;

  const priceChanged =
    courseData.price !== undefined &&
    Number(courseData.price) !== Number(existingCourse.price || 0);

  const discountChanged =
    courseData.discountPrice !== undefined &&
    Number(courseData.discountPrice) !==
    Number(existingCourse.discountPrice || 0);

  const typeChanged =
    courseData.type !== undefined &&
    courseData.type !== existingCourse.type;

  const majorChange =
    titleChanged || priceChanged || discountChanged || typeChanged;

  /* ----------------------------------------------------------
     PUBLISHED → PENDING
  ---------------------------------------------------------- */

  if (existingCourse.status === COURSE_STATUS.PUBLISHED && majorChange) {
    updates.status = COURSE_STATUS.PENDING;

    updates.publishedAt = null;

    updates.rejectionReason = "";
  }

  /* ----------------------------------------------------------
     REJECTED → DRAFT
  ---------------------------------------------------------- */

  if (existingCourse.status === COURSE_STATUS.REJECTED) {
    updates.status = COURSE_STATUS.DRAFT;

    updates.rejectionReason = "";
  }

  /* ----------------------------------------------------------
     UPDATED TIMESTAMP
  ---------------------------------------------------------- */

  updates.updatedAt = serverTimestamp();

  await updateDoc(courseRef, updates);

  return getCourseById(courseId);
}

/* ============================================================
   DELETE COURSE
============================================================ */

export async function deleteCourse(courseId) {
  const { courseRef, course } = await requireCourseOwner(courseId);

  /* ----------------------------------------------------------
     DELETE DIRECT STORAGE FILES

     NOTE: thumbnailPath is NOT included here. It's a Cloudinary
     publicId now, not a Firebase Storage path, and it gets
     cleaned up server-side by the onCourseDeleted Cloud Function
     (functions/cloudinaryCleanup.js) once this document is
     deleted below — that function has the API secret this
     client can't safely hold. bannerPath / previewVideoPath are
     still Firebase Storage and are cleaned up here directly.
  ---------------------------------------------------------- */

  const directStoragePaths = [
    course.bannerPath,
    course.previewVideoPath,
  ].filter(Boolean);

  for (const path of directStoragePaths) {
    await safeDeleteStorageFile(path);
  }

  /* ----------------------------------------------------------
     GET MODULES
  ---------------------------------------------------------- */

  const modulesRef = collection(
    db,
    COURSES_COLLECTION,
    courseId,
    "modules"
  );

  const modulesSnapshot = await getDocs(modulesRef);

  /* ----------------------------------------------------------
     DELETE MODULES + LESSONS
  ---------------------------------------------------------- */

  for (const moduleSnapshot of modulesSnapshot.docs) {
    const moduleId = moduleSnapshot.id;

    const lessonsRef = collection(
      db,
      COURSES_COLLECTION,
      courseId,
      "modules",
      moduleId,
      "lessons"
    );

    const lessonsSnapshot = await getDocs(lessonsRef);

    if (!lessonsSnapshot.empty) {
      const batch = writeBatch(db);

      for (const lessonSnapshot of lessonsSnapshot.docs) {
        const lesson = lessonSnapshot.data();

        if (lesson.videoPath) {
          await safeDeleteStorageFile(lesson.videoPath);
        }

        if (lesson.resourcePath) {
          await safeDeleteStorageFile(lesson.resourcePath);
        }

        batch.delete(lessonSnapshot.ref);
      }

      await batch.commit();
    }

    await deleteDoc(moduleSnapshot.ref);
  }

  /* ----------------------------------------------------------
     DELETE COURSE

     This triggers the onCourseDeleted Cloud Function, which
     removes the Cloudinary thumbnail using thumbnailPath.
  ---------------------------------------------------------- */

  await deleteDoc(courseRef);

  return true;
}

/* ============================================================
   SUBMIT FOR APPROVAL
============================================================ */

export async function submitForApproval(courseId) {
  const { courseRef, course } = await requireCourseOwner(courseId);

  if (course.status === COURSE_STATUS.PENDING) {
    throw new Error("This course is already waiting for approval.");
  }

  if (course.status === COURSE_STATUS.PUBLISHED) {
    throw new Error("This course is already published.");
  }

  if (course.status === COURSE_STATUS.ARCHIVED) {
    throw new Error("Archived courses cannot be submitted.");
  }

  if (!course.title?.trim()) {
    throw new Error("Course title is required.");
  }

  if (!course.type) {
    throw new Error("Course type is required.");
  }

  await updateDoc(courseRef, {
    status: COURSE_STATUS.PENDING,
    rejectionReason: "",
    updatedAt: serverTimestamp(),
  });

  return getCourseById(courseId);
}

/* ============================================================
   UNPUBLISH
============================================================ */

export async function unpublishCourse(courseId) {
  const { courseRef, course } = await requireCourseOwner(courseId);

  if (course.status !== COURSE_STATUS.PUBLISHED) {
    throw new Error("Only published courses can be unpublished.");
  }

  await updateDoc(courseRef, {
    status: COURSE_STATUS.DRAFT,
    publishedAt: null,
    updatedAt: serverTimestamp(),
  });

  return getCourseById(courseId);
}

/* ============================================================
   PUBLIC — PUBLISHED COURSES (realtime)
============================================================ */

export function usePublishedCourses(type) {
  const [state, setState] = useState({
    courses: [],
    loading: true,
    error: null,
  });

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!type) {
      setState({
        courses: [],
        loading: false,
        error: "Course type is required.",
      });

      return;
    }

    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    const q = query(
      collection(db, COURSES_COLLECTION),
      where("type", "==", type),
      where("status", "==", COURSE_STATUS.PUBLISHED)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMountedRef.current) return;

        const courses = snapshot.docs
          .map(courseFromDoc)
          .sort(sortCourses);

        setState({
          courses,
          loading: false,
          error: null,
        });
      },
      (error) => {
        if (!isMountedRef.current) return;

        console.error("Published courses error:", error);

        setState({
          courses: [],
          loading: false,
          error: friendlyFirestoreError(
            error,
            "Unable to load courses."
          ),
        });
      }
    );

    return () => unsubscribe();
  }, [type]);

  return state;
}

/* ============================================================
   PUBLIC — CATEGORY COURSES
============================================================ */

export function usePublishedCoursesByCategory(type) {
  const { courses, loading, error } = usePublishedCourses(type);

  const { categories, coursesByCategory } = groupByCategory(courses);

  return {
    categories,
    coursesByCategory,
    courses,
    loading,
    error,
  };
}

/* ============================================================
   PUBLIC — COURSE DETAIL
============================================================ */

export async function getPublishedCourseByIdOrSlug(idOrSlug) {
  if (!idOrSlug) {
    return null;
  }

  /* ----------------------------------------------------------
     TRY DOCUMENT ID
  ---------------------------------------------------------- */

  const directRef = doc(db, COURSES_COLLECTION, idOrSlug);

  const directSnapshot = await getDoc(directRef);

  if (directSnapshot.exists()) {
    const course = directSnapshot.data();

    if (course.status === COURSE_STATUS.PUBLISHED) {
      return courseFromDoc(directSnapshot);
    }

    return null;
  }

  /* ----------------------------------------------------------
     TRY SLUG
  ---------------------------------------------------------- */

  const q = query(
    collection(db, COURSES_COLLECTION),
    where("slug", "==", idOrSlug),
    where("status", "==", COURSE_STATUS.PUBLISHED)
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  return courseFromDoc(snapshot.docs[0]);
}

/* ============================================================
   THUMBNAIL UPLOAD (Cloudinary)

   Signature is unchanged from the old Firebase Storage version,
   so CreateCourse.jsx and EditCourse.jsx don't need any edits:

     const uploaded = await uploadCourseThumbnail(courseId, file, onProgress);
     // uploaded.url  -> course.thumbnailUrl
     // uploaded.path -> course.thumbnailPath (Cloudinary publicId)
============================================================ */

export async function uploadCourseThumbnail(courseId, file, onProgress) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  requireAuthUser();

  // validateImage() inside uploadImage() also checks type/size, but
  // failing fast here avoids a network round trip for an obviously
  // bad file.
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Please upload a valid image file.");
  }

  const MAX_SIZE = 5 * 1024 * 1024;

  if (file.size > MAX_SIZE) {
    throw new Error("Thumbnail must be smaller than 5MB.");
  }

  const result = await uploadImage(file, {
    folder: `lms/courses/${courseId}`,
    onProgress,
  });

  return {
    url: result.url,
    path: result.publicId,
  };
}

/* ============================================================
   DELETE THUMBNAIL

   Kept as a no-op-safe client stub. Cloudinary deletion needs
   the API secret, which must never live in this bundle — actual
   deletion happens in the onCourseDeleted / onCourseImageReplaced
   Cloud Functions (functions/cloudinaryCleanup.js), triggered
   automatically whenever thumbnailPath changes or the course
   document is deleted. There is deliberately nothing to call here.
============================================================ */

export async function deleteCourseThumbnail() {
  return;
}

/* ============================================================
   SAFE STORAGE DELETE (Firebase Storage only — banners, preview
   videos, lesson videos/resources. NOT used for thumbnails.)
============================================================ */

async function safeDeleteStorageFile(path) {
  if (!path) {
    return;
  }

  try {
    const storageRef = ref(storage, path);

    await deleteObject(storageRef);
  } catch (error) {
    /*
      File may already be deleted.
      Do not stop course deletion.
    */

    if (error?.code !== "storage/object-not-found") {
      console.warn("Storage cleanup failed:", path, error);
    }
  }
}