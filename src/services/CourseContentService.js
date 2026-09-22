import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "../lib/database";

import { auth, db } from "../lib/backend";

/* ============================================================
   COLLECTIONS
   ============================================================ */

const COURSES_COLLECTION = "courses";
const MODULES_COLLECTION = "modules";
const LESSONS_COLLECTION = "lessons";

/* ============================================================
   AUTH
   ============================================================ */

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user;
}

/* ============================================================
   COURSE OWNER CHECK
   ============================================================ */

async function requireCourseOwner(courseId) {
  const user = requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const courseRef = doc(
    db,
    COURSES_COLLECTION,
    courseId
  );

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

  if (course.status === "pending") {
    throw new Error(
      "This course is waiting for admin approval and cannot be edited."
    );
  }

  if (course.status === "archived") {
    throw new Error(
      "Archived courses cannot be edited."
    );
  }

  return {
    user,
    course,
    courseRef,
  };
}

/* ============================================================
   MODULE REFERENCE
   ============================================================ */

function getModulesCollection(courseId) {
  return collection(
    db,
    COURSES_COLLECTION,
    courseId,
    MODULES_COLLECTION
  );
}

function getModuleReference(courseId, moduleId) {
  return doc(
    db,
    COURSES_COLLECTION,
    courseId,
    MODULES_COLLECTION,
    moduleId
  );
}

function getLessonsCollection(courseId, moduleId) {
  return collection(
    db,
    COURSES_COLLECTION,
    courseId,
    MODULES_COLLECTION,
    moduleId,
    LESSONS_COLLECTION
  );
}

function getLessonReference(
  courseId,
  moduleId,
  lessonId
) {
  return doc(
    db,
    COURSES_COLLECTION,
    courseId,
    MODULES_COLLECTION,
    moduleId,
    LESSONS_COLLECTION,
    lessonId
  );
}

/* ============================================================
   GET MODULES
   ============================================================ */

export async function getCourseModules(courseId) {
  await requireCourseOwner(courseId);

  const modulesQuery = query(
    getModulesCollection(courseId),
    orderBy("order", "asc")
  );

  const snapshot = await getDocs(modulesQuery);

  return snapshot.docs.map((moduleDoc) => ({
    id: moduleDoc.id,
    ...moduleDoc.data(),
  }));
}

/* ============================================================
   GET LESSONS
   ============================================================ */

export async function getModuleLessons(
  courseId,
  moduleId
) {
  await requireCourseOwner(courseId);

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  const lessonsQuery = query(
    getLessonsCollection(courseId, moduleId),
    orderBy("order", "asc")
  );

  const snapshot = await getDocs(lessonsQuery);

  return snapshot.docs.map((lessonDoc) => ({
    id: lessonDoc.id,
    ...lessonDoc.data(),
  }));
}

/* ============================================================
   GET COMPLETE COURSE CONTENT
   ============================================================ */

export async function getCourseContent(courseId) {
  await requireCourseOwner(courseId);

  const modules = await getCourseModules(courseId);

  const modulesWithLessons = await Promise.all(
    modules.map(async (module) => {
      const lessons = await getModuleLessons(
        courseId,
        module.id
      );

      return {
        ...module,
        lessons,
      };
    })
  );

  return modulesWithLessons;
}

/* ============================================================
   CREATE MODULE
   ============================================================ */

export async function createModule(
  courseId,
  moduleData = {}
) {
  await requireCourseOwner(courseId);

  const title = moduleData.title?.trim();

  if (!title) {
    throw new Error("Module title is required.");
  }

  const modules = await getCourseModules(courseId);

  const nextOrder = modules.length;

  const moduleRef = doc(
    getModulesCollection(courseId)
  );

  const module = {
    title,
    description:
      moduleData.description?.trim() || "",
    order:
      typeof moduleData.order === "number"
        ? moduleData.order
        : nextOrder,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(moduleRef, module);

  return {
    id: moduleRef.id,
    ...module,
  };
}

/* ============================================================
   UPDATE MODULE
   ============================================================ */

export async function updateModule(
  courseId,
  moduleId,
  moduleData = {}
) {
  await requireCourseOwner(courseId);

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  const updates = {};

  if (moduleData.title !== undefined) {
    const title = moduleData.title.trim();

    if (!title) {
      throw new Error("Module title cannot be empty.");
    }

    updates.title = title;
  }

  if (moduleData.description !== undefined) {
    updates.description =
      moduleData.description.trim();
  }

  if (moduleData.order !== undefined) {
    updates.order = Number(moduleData.order);
  }

  updates.updatedAt = serverTimestamp();

  await updateDoc(
    getModuleReference(courseId, moduleId),
    updates
  );

  return {
    id: moduleId,
    ...updates,
  };
}

/* ============================================================
   DELETE MODULE
   ============================================================ */

export async function deleteModule(
  courseId,
  moduleId
) {
  await requireCourseOwner(courseId);

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  /*
   * Delete lessons first.
   */

  const lessonsSnapshot = await getDocs(
    getLessonsCollection(courseId, moduleId)
  );

  for (const lessonDoc of lessonsSnapshot.docs) {
    await deleteDoc(lessonDoc.ref);
  }

  /*
   * Delete module.
   */

  await deleteDoc(
    getModuleReference(courseId, moduleId)
  );

  /*
   * Re-number remaining modules.
   */

  const remainingModules =
    await getCourseModules(courseId);

  await Promise.all(
    remainingModules.map((module, index) =>
      updateDoc(
        getModuleReference(
          courseId,
          module.id
        ),
        {
          order: index,
          updatedAt: serverTimestamp(),
        }
      )
    )
  );

  return true;
}

/* ============================================================
   REORDER MODULES
   ============================================================ */

export async function reorderModules(
  courseId,
  moduleIds = []
) {
  await requireCourseOwner(courseId);

  if (!Array.isArray(moduleIds)) {
    throw new Error("Module IDs must be an array.");
  }

  await Promise.all(
    moduleIds.map((moduleId, index) =>
      updateDoc(
        getModuleReference(
          courseId,
          moduleId
        ),
        {
          order: index,
          updatedAt: serverTimestamp(),
        }
      )
    )
  );

  return getCourseModules(courseId);
}

/* ============================================================
   CREATE LESSON
   ============================================================ */

export async function createLesson(
  courseId,
  moduleId,
  lessonData = {}
) {
  await requireCourseOwner(courseId);

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  const title = lessonData.title?.trim();

  if (!title) {
    throw new Error("Lesson title is required.");
  }

  /*
   * Make sure the module exists.
   */

  const moduleSnapshot = await getDoc(
    getModuleReference(
      courseId,
      moduleId
    )
  );

  if (!moduleSnapshot.exists()) {
    throw new Error("Module not found.");
  }

  const lessons =
    await getModuleLessons(
      courseId,
      moduleId
    );

  const nextOrder = lessons.length;

  const lessonRef = doc(
    getLessonsCollection(
      courseId,
      moduleId
    )
  );

  const lesson = {
    title,

    description:
      lessonData.description?.trim() || "",

    type:
      lessonData.type || "video",

    videoUrl:
      lessonData.videoUrl || "",

    videoPath:
      lessonData.videoPath || "",

    thumbnailUrl:
      lessonData.thumbnailUrl || "",

    thumbnailPath:
      lessonData.thumbnailPath || "",

    resourceUrl:
      lessonData.resourceUrl || "",

    resourcePath:
      lessonData.resourcePath || "",

    duration:
      lessonData.duration || "",

    order:
      typeof lessonData.order === "number"
        ? lessonData.order
        : nextOrder,

    published:
      lessonData.published === true,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(lessonRef, lesson);

  return {
    id: lessonRef.id,
    ...lesson,
  };
}

/* ============================================================
   UPDATE LESSON
   ============================================================ */

export async function updateLesson(
  courseId,
  moduleId,
  lessonId,
  lessonData = {}
) {
  await requireCourseOwner(courseId);

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  if (!lessonId) {
    throw new Error("Lesson ID is required.");
  }

  const updates = {};

  const editableFields = [
    "title",
    "description",
    "type",
    "videoUrl",
    "videoPath",
    "thumbnailUrl",
    "thumbnailPath",
    "resourceUrl",
    "resourcePath",
    "duration",
    "published",
  ];

  for (const field of editableFields) {
    if (lessonData[field] !== undefined) {
      updates[field] = lessonData[field];
    }
  }

  if (lessonData.title !== undefined) {
    const title = lessonData.title.trim();

    if (!title) {
      throw new Error(
        "Lesson title cannot be empty."
      );
    }

    updates.title = title;
  }

  if (lessonData.order !== undefined) {
    updates.order = Number(lessonData.order);
  }

  updates.updatedAt = serverTimestamp();

  await updateDoc(
    getLessonReference(
      courseId,
      moduleId,
      lessonId
    ),
    updates
  );

  return {
    id: lessonId,
    ...updates,
  };
}

/* ============================================================
   DELETE LESSON
   ============================================================ */

export async function deleteLesson(
  courseId,
  moduleId,
  lessonId
) {
  await requireCourseOwner(courseId);

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  if (!lessonId) {
    throw new Error("Lesson ID is required.");
  }

  await deleteDoc(
    getLessonReference(
      courseId,
      moduleId,
      lessonId
    )
  );

  /*
   * Re-number remaining lessons.
   */

  const remainingLessons =
    await getModuleLessons(
      courseId,
      moduleId
    );

  await Promise.all(
    remainingLessons.map((lesson, index) =>
      updateDoc(
        getLessonReference(
          courseId,
          moduleId,
          lesson.id
        ),
        {
          order: index,
          updatedAt: serverTimestamp(),
        }
      )
    )
  );

  return true;
}

/* ============================================================
   REORDER LESSONS
   ============================================================ */

export async function reorderLessons(
  courseId,
  moduleId,
  lessonIds = []
) {
  await requireCourseOwner(courseId);

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  if (!Array.isArray(lessonIds)) {
    throw new Error("Lesson IDs must be an array.");
  }

  await Promise.all(
    lessonIds.map((lessonId, index) =>
      updateDoc(
        getLessonReference(
          courseId,
          moduleId,
          lessonId
        ),
        {
          order: index,
          updatedAt: serverTimestamp(),
        }
      )
    )
  );

  return getModuleLessons(
    courseId,
    moduleId
  );
}

/* ============================================================
   PUBLISH / UNPUBLISH LESSON
   ============================================================ */

export async function setLessonPublished(
  courseId,
  moduleId,
  lessonId,
  published
) {
  await requireCourseOwner(courseId);

  if (!lessonId) {
    throw new Error("Lesson ID is required.");
  }

  await updateDoc(
    getLessonReference(
      courseId,
      moduleId,
      lessonId
    ),
    {
      published: Boolean(published),
      updatedAt: serverTimestamp(),
    }
  );

  return true;
}

/* ============================================================
   LIVE LISTENERS

   These subscribe to Supabase database in real time and return an
   unsubscribe function (the standard onSnapshot pattern), rather
   than a one-time Promise like the getX functions above. Because
   onSnapshot must attach synchronously, these do NOT call
   requireCourseOwner first — ownership/visibility must instead be
   enforced by Supabase database security rules for the "courses",
   "modules", and "lessons" collections.
   ============================================================ */

// Subscribes to the current instructor's own courses in real time.
export function listenToCourses(callback) {
  const user = requireUser();

  const coursesQuery = query(
    collection(db, COURSES_COLLECTION)
  );

  return onSnapshot(coursesQuery, (snapshot) => {
    const courses = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((course) => course.instructorId === user.uid);

    callback(courses);
  });
}

// Subscribes to a course's modules in real time, ordered by `order`.
export function listenToModules(courseId, callback) {
  const modulesQuery = query(
    getModulesCollection(courseId),
    orderBy("order", "asc")
  );

  return onSnapshot(modulesQuery, (snapshot) => {
    const modules = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    callback(modules);
  });
}

// Subscribes to a module's lessons in real time, ordered by `order`.
export function listenToLessons(courseId, moduleId, callback) {
  const lessonsQuery = query(
    getLessonsCollection(courseId, moduleId),
    orderBy("order", "asc")
  );

  return onSnapshot(lessonsQuery, (snapshot) => {
    const lessons = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    callback(lessons);
  });
}

/* ============================================================
   NAME ALIASES

   Lessons.jsx imports addModule/addLesson; the underlying
   implementations are createModule/createLesson defined above.
   ============================================================ */

export const addModule = createModule;
export const addLesson = createLesson;