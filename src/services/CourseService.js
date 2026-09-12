import { useEffect, useState } from "react";

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
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import {
  auth,
  db,
  storage,
} from "../firebase/Firebase";

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

function requireAuthUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be logged in to perform this action."
    );
  }

  return user;
}

/* ============================================================
   VERIFY COURSE OWNER
============================================================ */

async function requireCourseOwner(courseId) {
  const user = requireAuthUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const courseSnapshot =
    await getDoc(courseRef);

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
    const category =
      course.category?.trim() ||
      "Uncategorized";

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
   TEACHER — GET MY COURSES
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
    where(
      "instructorId",
      "==",
      teacherId
    )
  );

  const snapshot = await getDocs(q);

  return snapshot.docs
    .map(courseFromDoc)
    .sort(sortCourses);
}

/* ============================================================
   TEACHER — LIVE COURSES
============================================================ */

export function useMyCourses(
  teacherId = auth.currentUser?.uid
) {
  const [state, setState] = useState({
    courses: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
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
      where(
        "instructorId",
        "==",
        teacherId
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
        console.error(
          "Teacher courses listener error:",
          error
        );

        setState({
          courses: [],
          loading: false,
          error:
            error?.message ||
            "Unable to load teacher courses.",
        });
      }
    );

    return () => unsubscribe();
  }, [teacherId]);

  return state;
}

/* ============================================================
   GET COURSE BY ID
============================================================ */

export async function getCourseById(courseId) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

  const snapshot =
    await getDoc(courseRef);

  if (!snapshot.exists()) {
    return null;
  }

  return courseFromDoc(snapshot);
}

/* ============================================================
   CREATE COURSE
============================================================ */

/*
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
*/

export async function createCourse(
  courseData = {}
) {
  const user = requireAuthUser();

  /* ----------------------------------------------------------
     VALIDATION
  ---------------------------------------------------------- */

  const title =
    courseData.title?.trim();

  if (!title) {
    throw new Error(
      "Course title is required."
    );
  }

  if (
    courseData.type !==
      COURSE_TYPES.SHORT &&
    courseData.type !==
      COURSE_TYPES.LONG
  ) {
    throw new Error(
      "Course type must be short or long."
    );
  }

  /* ----------------------------------------------------------
     CREATE NEW FIRESTORE DOCUMENT
  ---------------------------------------------------------- */

  const courseRef = doc(
    collection(
      db,
      COURSES_COLLECTION
    )
  );

  /* ----------------------------------------------------------
     COURSE DATA
  ---------------------------------------------------------- */

  const course = {
    /* BASIC INFORMATION */

    title,

    slug:
      courseData.slug?.trim() ||
      slugify(title),

    description:
      courseData.description?.trim() ||
      "",

    shortDescription:
      courseData.shortDescription?.trim() ||
      "",

    category:
      courseData.category?.trim() ||
      "",

    level:
      courseData.level?.trim() ||
      "",

    duration:
      courseData.duration?.trim() ||
      "",

    /* COURSE TYPE */

    type: courseData.type,

    /* OWNER */

    instructorId: user.uid,

    instructorName:
      courseData.instructorName?.trim() ||
      user.displayName ||
      "",

    /* MEDIA */

    thumbnailUrl:
      courseData.thumbnailUrl ||
      "",

    thumbnailPath:
      courseData.thumbnailPath ||
      "",

    bannerUrl:
      courseData.bannerUrl ||
      "",

    bannerPath:
      courseData.bannerPath ||
      "",

    previewVideoUrl:
      courseData.previewVideoUrl ||
      "",

    previewVideoPath:
      courseData.previewVideoPath ||
      "",

    /* PRICING */

    price:
      Number(courseData.price) || 0,

    discountPrice:
      Number(
        courseData.discountPrice
      ) || 0,

    currency:
      courseData.currency ||
      "INR",

    /* STATUS */

    status:
      COURSE_STATUS.DRAFT,

    /* ADMIN CONTROLLED */

    featured: false,

    order: 0,

    /* TIMESTAMPS */

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),

    publishedAt: null,

    /* REJECTION */

    rejectionReason: "",

    /* COUNTERS */

    studentCount: 0,

    enrollmentCount: 0,
  };

  /* ----------------------------------------------------------
     THIS IS THE IMPORTANT FIX
  ---------------------------------------------------------- */

  await setDoc(
    courseRef,
    course
  );

  /* ----------------------------------------------------------
     RETURN CREATED COURSE
  ---------------------------------------------------------- */

  return getCourseById(
    courseRef.id
  );
}

/* ============================================================
   UPDATE COURSE
============================================================ */

export async function updateCourse(
  courseId,
  courseData = {}
) {
  const {
    courseRef,
    course: existingCourse,
  } = await requireCourseOwner(
    courseId
  );

  /* ----------------------------------------------------------
     LOCK PENDING
  ---------------------------------------------------------- */

  if (
    existingCourse.status ===
    COURSE_STATUS.PENDING
  ) {
    throw new Error(
      "This course is waiting for admin approval and cannot be edited right now."
    );
  }

  /* ----------------------------------------------------------
     LOCK ARCHIVED
  ---------------------------------------------------------- */

  if (
    existingCourse.status ===
    COURSE_STATUS.ARCHIVED
  ) {
    throw new Error(
      "Archived courses cannot be edited."
    );
  }

  const updates = {};

  /* ----------------------------------------------------------
     TITLE
  ---------------------------------------------------------- */

  if (
    courseData.title !==
    undefined
  ) {
    const title =
      courseData.title.trim();

    if (!title) {
      throw new Error(
        "Course title cannot be empty."
      );
    }

    updates.title = title;

    updates.slug =
      courseData.slug?.trim() ||
      slugify(title);
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

  for (
    const field of editableFields
  ) {
    if (
      courseData[field] !==
      undefined
    ) {
      updates[field] =
        courseData[field];
    }
  }

  /* ----------------------------------------------------------
     PRICING
  ---------------------------------------------------------- */

  if (
    courseData.price !==
    undefined
  ) {
    updates.price =
      Number(courseData.price) || 0;
  }

  if (
    courseData.discountPrice !==
    undefined
  ) {
    updates.discountPrice =
      Number(
        courseData.discountPrice
      ) || 0;
  }

  /* ----------------------------------------------------------
     COURSE TYPE
  ---------------------------------------------------------- */

  if (
    courseData.type !==
    undefined
  ) {
    if (
      courseData.type !==
        COURSE_TYPES.SHORT &&
      courseData.type !==
        COURSE_TYPES.LONG
    ) {
      throw new Error(
        "Invalid course type."
      );
    }

    updates.type =
      courseData.type;
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
    courseData.title !==
      undefined &&
    courseData.title.trim() !==
      existingCourse.title;

  const priceChanged =
    courseData.price !==
      undefined &&
    Number(courseData.price) !==
      Number(
        existingCourse.price || 0
      );

  const discountChanged =
    courseData.discountPrice !==
      undefined &&
    Number(
      courseData.discountPrice
    ) !==
      Number(
        existingCourse.discountPrice ||
          0
      );

  const typeChanged =
    courseData.type !==
      undefined &&
    courseData.type !==
      existingCourse.type;

  const majorChange =
    titleChanged ||
    priceChanged ||
    discountChanged ||
    typeChanged;

  /* ----------------------------------------------------------
     PUBLISHED → PENDING
  ---------------------------------------------------------- */

  if (
    existingCourse.status ===
      COURSE_STATUS.PUBLISHED &&
    majorChange
  ) {
    updates.status =
      COURSE_STATUS.PENDING;

    updates.publishedAt = null;

    updates.rejectionReason = "";
  }

  /* ----------------------------------------------------------
     REJECTED → DRAFT
  ---------------------------------------------------------- */

  if (
    existingCourse.status ===
    COURSE_STATUS.REJECTED
  ) {
    updates.status =
      COURSE_STATUS.DRAFT;

    updates.rejectionReason = "";
  }

  /* ----------------------------------------------------------
     UPDATED TIMESTAMP
  ---------------------------------------------------------- */

  updates.updatedAt =
    serverTimestamp();

  /* ----------------------------------------------------------
     IMPORTANT FIX
  ---------------------------------------------------------- */

  await updateDoc(
    courseRef,
    updates
  );

  return getCourseById(
    courseId
  );
}

/* ============================================================
   DELETE COURSE
============================================================ */

export async function deleteCourse(
  courseId
) {
  const {
    courseRef,
    course,
  } = await requireCourseOwner(
    courseId
  );

  /* ----------------------------------------------------------
     DELETE DIRECT STORAGE FILES
  ---------------------------------------------------------- */

  const directStoragePaths = [
    course.thumbnailPath,
    course.bannerPath,
    course.previewVideoPath,
  ].filter(Boolean);

  for (
    const path of directStoragePaths
  ) {
    await safeDeleteStorageFile(
      path
    );
  }

  /* ----------------------------------------------------------
     GET MODULES
  ---------------------------------------------------------- */

  const modulesRef =
    collection(
      db,
      COURSES_COLLECTION,
      courseId,
      "modules"
    );

  const modulesSnapshot =
    await getDocs(modulesRef);

  /* ----------------------------------------------------------
     DELETE MODULES + LESSONS
  ---------------------------------------------------------- */

  for (
    const moduleSnapshot of
      modulesSnapshot.docs
  ) {
    const moduleId =
      moduleSnapshot.id;

    const lessonsRef =
      collection(
        db,
        COURSES_COLLECTION,
        courseId,
        "modules",
        moduleId,
        "lessons"
      );

    const lessonsSnapshot =
      await getDocs(
        lessonsRef
      );

    if (
      !lessonsSnapshot.empty
    ) {
      const batch =
        writeBatch(db);

      for (
        const lessonSnapshot of
          lessonsSnapshot.docs
      ) {
        const lesson =
          lessonSnapshot.data();

        if (
          lesson.videoPath
        ) {
          await safeDeleteStorageFile(
            lesson.videoPath
          );
        }

        if (
          lesson.resourcePath
        ) {
          await safeDeleteStorageFile(
            lesson.resourcePath
          );
        }

        batch.delete(
          lessonSnapshot.ref
        );
      }

      await batch.commit();
    }

    await deleteDoc(
      moduleSnapshot.ref
    );
  }

  /* ----------------------------------------------------------
     DELETE COURSE
  ---------------------------------------------------------- */

  await deleteDoc(
    courseRef
  );

  return true;
}

/* ============================================================
   SUBMIT FOR APPROVAL
============================================================ */

export async function submitForApproval(
  courseId
) {
  const {
    courseRef,
    course,
  } = await requireCourseOwner(
    courseId
  );

  if (
    course.status ===
    COURSE_STATUS.PENDING
  ) {
    throw new Error(
      "This course is already waiting for approval."
    );
  }

  if (
    course.status ===
    COURSE_STATUS.PUBLISHED
  ) {
    throw new Error(
      "This course is already published."
    );
  }

  if (
    course.status ===
    COURSE_STATUS.ARCHIVED
  ) {
    throw new Error(
      "Archived courses cannot be submitted."
    );
  }

  if (!course.title?.trim()) {
    throw new Error(
      "Course title is required."
    );
  }

  if (!course.type) {
    throw new Error(
      "Course type is required."
    );
  }

  await updateDoc(
    courseRef,
    {
      status:
        COURSE_STATUS.PENDING,

      rejectionReason: "",

      updatedAt:
        serverTimestamp(),
    }
  );

  return getCourseById(
    courseId
  );
}

/* ============================================================
   UNPUBLISH
============================================================ */

export async function unpublishCourse(
  courseId
) {
  const {
    courseRef,
    course,
  } = await requireCourseOwner(
    courseId
  );

  if (
    course.status !==
    COURSE_STATUS.PUBLISHED
  ) {
    throw new Error(
      "Only published courses can be unpublished."
    );
  }

  await updateDoc(
    courseRef,
    {
      status:
        COURSE_STATUS.DRAFT,

      publishedAt: null,

      updatedAt:
        serverTimestamp(),
    }
  );

  return getCourseById(
    courseId
  );
}

/* ============================================================
   PUBLIC — PUBLISHED COURSES
============================================================ */

export function usePublishedCourses(
  type
) {
  const [state, setState] =
    useState({
      courses: [],
      loading: true,
      error: null,
    });

  useEffect(() => {
    if (!type) {
      setState({
        courses: [],
        loading: false,
        error:
          "Course type is required.",
      });

      return;
    }

    setState(
      (previous) => ({
        ...previous,
        loading: true,
        error: null,
      })
    );

    const q = query(
      collection(
        db,
        COURSES_COLLECTION
      ),
      where(
        "type",
        "==",
        type
      ),
      where(
        "status",
        "==",
        COURSE_STATUS.PUBLISHED
      )
    );

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          const courses =
            snapshot.docs
              .map(courseFromDoc)
              .sort(sortCourses);

          setState({
            courses,
            loading: false,
            error: null,
          });
        },
        (error) => {
          console.error(
            "Published courses error:",
            error
          );

          setState({
            courses: [],
            loading: false,
            error:
              error?.message ||
              "Unable to load courses.",
          });
        }
      );

    return () =>
      unsubscribe();
  }, [type]);

  return state;
}

/* ============================================================
   PUBLIC — CATEGORY COURSES
============================================================ */

export function usePublishedCoursesByCategory(
  type
) {
  const {
    courses,
    loading,
    error,
  } = usePublishedCourses(type);

  const {
    categories,
    coursesByCategory,
  } =
    groupByCategory(courses);

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

export async function getPublishedCourseByIdOrSlug(
  idOrSlug
) {
  if (!idOrSlug) {
    return null;
  }

  /* ----------------------------------------------------------
     TRY DOCUMENT ID
  ---------------------------------------------------------- */

  const directRef = doc(
    db,
    COURSES_COLLECTION,
    idOrSlug
  );

  const directSnapshot =
    await getDoc(directRef);

  if (
    directSnapshot.exists()
  ) {
    const course =
      directSnapshot.data();

    if (
      course.status ===
      COURSE_STATUS.PUBLISHED
    ) {
      return courseFromDoc(
        directSnapshot
      );
    }

    return null;
  }

  /* ----------------------------------------------------------
     TRY SLUG
  ---------------------------------------------------------- */

  const q = query(
    collection(
      db,
      COURSES_COLLECTION
    ),
    where(
      "slug",
      "==",
      idOrSlug
    ),
    where(
      "status",
      "==",
      COURSE_STATUS.PUBLISHED
    )
  );

  const snapshot =
    await getDocs(q);

  if (
    snapshot.empty
  ) {
    return null;
  }

  return courseFromDoc(
    snapshot.docs[0]
  );
}

/* ============================================================
   THUMBNAIL UPLOAD
============================================================ */

export function uploadCourseThumbnail(
  courseId,
  file,
  onProgress
) {
  if (!courseId) {
    return Promise.reject(
      new Error(
        "Course ID is required."
      )
    );
  }

  if (!file) {
    return Promise.reject(
      new Error(
        "Thumbnail file is required."
      )
    );
  }

  if (
    !file.type?.startsWith(
      "image/"
    )
  ) {
    return Promise.reject(
      new Error(
        "Please upload a valid image file."
      )
    );
  }

  const MAX_SIZE =
    5 * 1024 * 1024;

  if (
    file.size > MAX_SIZE
  ) {
    return Promise.reject(
      new Error(
        "Thumbnail must be smaller than 5MB."
      )
    );
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() ||
    "jpg";

  const storagePath =
    `courseThumbnails/${courseId}/thumbnail-${Date.now()}.${extension}`;

  const storageRef =
    ref(
      storage,
      storagePath
    );

  return new Promise(
    (resolve, reject) => {
      const uploadTask =
        uploadBytesResumable(
          storageRef,
          file,
          {
            contentType:
              file.type,
          }
        );

      uploadTask.on(
        "state_changed",

        (snapshot) => {
          const progress =
            Math.round(
              (snapshot.bytesTransferred /
                snapshot.totalBytes) *
                100
            );

          if (
            typeof onProgress ===
            "function"
          ) {
            onProgress(progress);
          }
        },

        (error) => {
          console.error(
            "Thumbnail upload error:",
            error
          );

          reject(error);
        },

        async () => {
          try {
            const url =
              await getDownloadURL(
                uploadTask.snapshot.ref
              );

            resolve({
              url,
              path: storagePath,
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    }
  );
}

/* ============================================================
   DELETE THUMBNAIL
============================================================ */

export async function deleteCourseThumbnail(
  path
) {
  if (!path) {
    return;
  }

  await safeDeleteStorageFile(
    path
  );
}

/* ============================================================
   SAFE STORAGE DELETE
============================================================ */

async function safeDeleteStorageFile(
  path
) {
  if (!path) {
    return;
  }

  try {
    const storageRef =
      ref(storage, path);

    await deleteObject(
      storageRef
    );
  } catch (error) {
    /*
      File may already be deleted.
      Do not stop course deletion.
    */

    if (
      error?.code !==
      "storage/object-not-found"
    ) {
      console.warn(
        "Storage cleanup failed:",
        path,
        error
      );
    }
  }
}