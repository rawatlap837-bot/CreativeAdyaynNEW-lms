import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "../lib/database";

import { auth, db } from "../lib/backend";

/* ============================================================
   COLLECTIONS
============================================================ */

export const COMMUNICATION_COLLECTIONS = {
  ANNOUNCEMENTS: "announcements",
  DISCUSSIONS: "discussions",
  NOTIFICATIONS: "notifications",
};

/* ============================================================
   CONSTANTS
============================================================ */

export const ANNOUNCEMENT_AUDIENCE = {
  GLOBAL: "global",
  TEACHERS: "teachers",
  COURSE: "course",
};

export const ANNOUNCEMENT_STATUS = {
  DRAFT: "draft",
  PUBLISHED: "published",
};

export const DISCUSSION_STATUS = {
  OPEN: "open",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

export const NOTIFICATION_TYPES = {
  ANNOUNCEMENT: "announcement",
  DISCUSSION: "discussion",
  DISCUSSION_REPLY: "discussion_reply",
  LESSON: "lesson",
  ASSIGNMENT: "assignment",
  PAYMENT: "payment",
  SYSTEM: "system",
};

/* ============================================================
   BASIC HELPERS
============================================================ */

/**
 * Require logged-in Supabase user.
 */
function requireAuthUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user;
}

/**
 * Convert Supabase database document into normal object.
 */
function documentToObject(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/**
 * Convert Supabase database Timestamp / Date / number
 * into milliseconds.
 */
function getTimestampValue(value) {
  if (!value) {
    return 0;
  }

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "number") {
    return value;
  }

  return 0;
}

/**
 * Sort newest first.
 *
 * Client-side sorting intentionally avoids
 * Supabase database composite index requirements.
 */
function sortNewestFirst(items = []) {
  return [...items].sort(
    (a, b) =>
      getTimestampValue(b.createdAt) -
      getTimestampValue(a.createdAt)
  );
}

/**
 * Remove duplicate documents.
 */
function removeDuplicates(items = []) {
  const map = new Map();

  for (const item of items) {
    if (item?.id) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values());
}

/**
 * Safely trim a string.
 */
function cleanString(value) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

/* ============================================================
   AUTH / ROLE
============================================================ */

/**
 * Get current user's role.
 *
 * Priority:
 * 1. Supabase custom claims
 * 2. users/{uid}.role
 */
async function getCurrentUserRole() {
  const user = requireAuthUser();

  /* ----------------------------------------------------------
     CUSTOM CLAIMS
  ---------------------------------------------------------- */

  try {
    const tokenResult =
      await user.getIdTokenResult();

    const claims =
      tokenResult?.claims || {};

    if (
      claims.admin === true ||
      claims.role === "admin"
    ) {
      return "admin";
    }

    if (
      claims.teacher === true ||
      claims.role === "teacher" ||
      claims.role === "instructor"
    ) {
      return "teacher";
    }

    if (
      claims.student === true ||
      claims.role === "student"
    ) {
      return "student";
    }
  } catch (error) {
    console.warn(
      "Could not read Supabase custom claims.",
      error
    );
  }

  /* ----------------------------------------------------------
     Supabase database USER DOCUMENT
  ---------------------------------------------------------- */

  try {
    const userSnapshot = await getDoc(
      doc(db, "users", user.uid)
    );

    if (!userSnapshot.exists()) {
      return null;
    }

    const role =
      userSnapshot.data()?.role;

    if (role === "admin") {
      return "admin";
    }

    if (
      role === "teacher" ||
      role === "instructor"
    ) {
      return "teacher";
    }

    if (role === "student") {
      return "student";
    }
  } catch (error) {
    console.warn(
      "Could not read user role from Supabase database.",
      error
    );
  }

  return null;
}

/**
 * Require admin.
 */
async function requireAdmin() {
  const role =
    await getCurrentUserRole();

  if (role !== "admin") {
    throw new Error(
      "Only administrators can perform this action."
    );
  }

  return requireAuthUser();
}

/**
 * Require teacher.
 */
async function requireTeacher() {
  const role =
    await getCurrentUserRole();

  if (role !== "teacher") {
    throw new Error(
      "Only teachers can perform this action."
    );
  }

  return requireAuthUser();
}

/* ============================================================
   COURSE HELPERS
============================================================ */

/**
 * Get course.
 */
async function getCourse(courseId) {
  if (!courseId) {
    return null;
  }

  const snapshot = await getDoc(
    doc(db, "courses", courseId)
  );

  if (!snapshot.exists()) {
    return null;
  }

  return documentToObject(snapshot);
}

/**
 * Check whether user owns course.
 */
async function isCourseOwner(
  courseId,
  userId
) {
  if (!courseId || !userId) {
    return false;
  }

  const course =
    await getCourse(courseId);

  if (!course) {
    return false;
  }

  return (
    course.instructorId === userId
  );
}

/**
 * Get active course IDs for current student.
 *
 * Enrollment structure:
 *
 * enrollments/{uid}_{courseId}
 *
 * with:
 * uid
 * courseId
 * status: "active"
 */
async function getMyActiveCourseIds() {
  const user =
    requireAuthUser();

  const enrollmentsRef =
    collection(
      db,
      "enrollments"
    );

  const q = query(
    enrollmentsRef,

    where(
      "uid",
      "==",
      user.uid
    ),

    where(
      "status",
      "==",
      "active"
    )
  );

  const snapshot =
    await getDocs(q);

  return [
    ...new Set(
      snapshot.docs
        .map(
          (item) =>
            item.data()?.courseId
        )
        .filter(Boolean)
    ),
  ];
}

/**
 * Get all courses owned by current teacher.
 */
async function getMyTeacherCourses() {
  const user =
    await requireTeacher();

  const coursesRef =
    collection(
      db,
      "courses"
    );

  const q = query(
    coursesRef,

    where(
      "instructorId",
      "==",
      user.uid
    )
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.map(
    documentToObject
  );
}

/* ============================================================
   ANNOUNCEMENT PERMISSIONS
============================================================ */

/**
 * Check whether current user can manage
 * a specific announcement.
 *
 * ADMIN:
 * - Everything
 *
 * TEACHER:
 * - Own course announcement
 * - Own announcement only
 */
async function canManageAnnouncement(
  announcement
) {
  const user =
    requireAuthUser();

  const role =
    await getCurrentUserRole();

  /* ADMIN */

  if (role === "admin") {
    return true;
  }

  /* TEACHER */

  if (role !== "teacher") {
    return false;
  }

  if (
    announcement?.audienceType !==
    ANNOUNCEMENT_AUDIENCE.COURSE
  ) {
    return false;
  }

  if (
    announcement?.authorId !==
    user.uid
  ) {
    return false;
  }

  return isCourseOwner(
    announcement.courseId,
    user.uid
  );
}

/* ============================================================
   ANNOUNCEMENTS
============================================================ */

/**
 * ADMIN
 *
 * Get all announcements.
 *
 * Includes:
 * - drafts
 * - published
 * - global
 * - course announcements
 */
export async function getAnnouncements({
  limitCount = 100,
} = {}) {
  await requireAdmin();

  const announcementsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS
    );

  const q = query(
    announcementsRef,
    limit(limitCount)
  );

  const snapshot =
    await getDocs(q);

  return sortNewestFirst(
    snapshot.docs.map(
      documentToObject
    )
  );
}

/* ============================================================
   GLOBAL ANNOUNCEMENTS
============================================================ */

/**
 * Get published global announcements.
 *
 * ACCESS:
 *
 * ADMIN
 * TEACHER
 * STUDENT
 *
 * This is the important change:
 *
 * TEACHERS ARE NOW ALLOWED TO READ
 * PUBLISHED GLOBAL ANNOUNCEMENTS.
 */
export async function getGlobalAnnouncements({
  limitCount = 50,
} = {}) {
  requireAuthUser();

  const role =
    await getCurrentUserRole();

  if (
    role !== "student" &&
    role !== "teacher" &&
    role !== "admin"
  ) {
    return [];
  }

  const announcementsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS
    );

  /*
   * IMPORTANT:
   *
   * status == published
   * audienceType == global
   *
   * These conditions must match the
   * Supabase database security rules.
   */
  const q = query(
    announcementsRef,

    where(
      "audienceType",
      "==",
      ANNOUNCEMENT_AUDIENCE.GLOBAL
    ),

    where(
      "status",
      "==",
      ANNOUNCEMENT_STATUS.PUBLISHED
    ),

    limit(limitCount)
  );

  const snapshot =
    await getDocs(q);

  return sortNewestFirst(
    snapshot.docs.map(
      documentToObject
    )
  );
}

/* ============================================================
   COURSE ANNOUNCEMENTS
============================================================ */

/**
 * Get published announcements for one course.
 *
 * Access is ultimately controlled by Supabase database rules.
 *
 * Student:
 * - must be enrolled
 *
 * Teacher:
 * - must own course
 *
 * Admin:
 * - allowed
 */
export async function getCourseAnnouncements(
  courseId,
  {
    limitCount = 50,
  } = {}
) {
  requireAuthUser();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const announcementsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS
    );

  const q = query(
    announcementsRef,

    where(
      "courseId",
      "==",
      courseId
    ),

    where(
      "audienceType",
      "==",
      ANNOUNCEMENT_AUDIENCE.COURSE
    ),

    where(
      "status",
      "==",
      ANNOUNCEMENT_STATUS.PUBLISHED
    ),

    limit(limitCount)
  );

  const snapshot =
    await getDocs(q);

  return sortNewestFirst(
    snapshot.docs.map(
      documentToObject
    )
  );
}

/* ============================================================
   STUDENT ACCESSIBLE ANNOUNCEMENTS
============================================================ */

/**
 * Get announcements accessible to current student.
 *
 * Returns:
 *
 * 1. Published global announcements
 * 2. Published announcements for active courses
 */
export async function getAccessibleAnnouncements(
  courseIds = [],
  {
    limitCount = 100,
  } = {}
) {
  requireAuthUser();

  const role =
    await getCurrentUserRole();

  /*
   * This function is intended for students.
   */
  if (role !== "student") {
    return [];
  }

  /* ----------------------------------------------------------
     GLOBAL
  ---------------------------------------------------------- */

  let globalAnnouncements = [];

  try {
    globalAnnouncements =
      await getGlobalAnnouncements({
        limitCount,
      });
  } catch (error) {
    console.error(
      "Failed to load global announcements:",
      error
    );
  }

  /* ----------------------------------------------------------
     COURSE IDS
  ---------------------------------------------------------- */

  let validCourseIds = [
    ...new Set(
      Array.isArray(courseIds)
        ? courseIds.filter(Boolean)
        : []
    ),
  ];

  if (
    validCourseIds.length === 0
  ) {
    try {
      validCourseIds =
        await getMyActiveCourseIds();
    } catch (error) {
      console.error(
        "Failed to load active courses:",
        error
      );
    }
  }

  /* ----------------------------------------------------------
     COURSE ANNOUNCEMENTS
  ---------------------------------------------------------- */

  const courseResults = [];

  for (
    const courseId of validCourseIds
  ) {
    try {
      const announcements =
        await getCourseAnnouncements(
          courseId,
          {
            limitCount,
          }
        );

      courseResults.push(
        ...announcements
      );
    } catch (error) {
      console.warn(
        `Could not load announcements for course ${courseId}:`,
        error
      );
    }
  }

  /* ----------------------------------------------------------
     COMBINE
  ---------------------------------------------------------- */

  return sortNewestFirst(
    removeDuplicates([
      ...globalAnnouncements,
      ...courseResults,
    ])
  ).slice(
    0,
    limitCount
  );
}

/* ============================================================
   TEACHER ANNOUNCEMENTS
============================================================ */

/**
 * Get announcements visible to teacher.
 *
 * Teacher receives:
 *
 * 1. Published global announcements
 * 2. Published announcements for their own courses
 *
 * This is what the teacher dashboard should use.
 */
export async function getMyTeacherAnnouncements({
  limitCount = 100,
} = {}) {
  const user =
    await requireTeacher();

  const results = [];

  /* ----------------------------------------------------------
     GLOBAL ANNOUNCEMENTS
  ---------------------------------------------------------- */

  try {
    const globalAnnouncements =
      await getGlobalAnnouncements({
        limitCount,
      });

    results.push(
      ...globalAnnouncements.map(
        (announcement) => ({
          ...announcement,
          courseTitle:
            announcement.courseId
              ? announcement.courseTitle ||
              "Course"
              : null,
        })
      )
    );
  } catch (error) {
    console.error(
      "Failed to load teacher global announcements:",
      error
    );
  }

  // Organization messages intended for teachers only. These stay separate
  // from global notices so student feeds do not include them.
  try {
    const teacherAnnouncements = await getTeacherOnlyAnnouncements({
      limitCount,
    });
    results.push(...teacherAnnouncements);
  } catch (error) {
    console.error("Failed to load teacher-only announcements:", error);
  }

  /* ----------------------------------------------------------
     TEACHER COURSES
  ---------------------------------------------------------- */

  let teacherCourses = [];

  try {
    teacherCourses =
      await getMyTeacherCourses();
  } catch (error) {
    console.error(
      "Failed to load teacher courses:",
      error
    );

    return sortNewestFirst(
      removeDuplicates(results)
    ).slice(
      0,
      limitCount
    );
  }

  /* ----------------------------------------------------------
     COURSE ANNOUNCEMENTS
  ---------------------------------------------------------- */

  for (
    const course of teacherCourses
  ) {
    if (!course?.id) {
      continue;
    }

    /*
     * Archived courses are not shown
     * in the active teacher communication feed.
     */
    if (
      course.status ===
      "archived"
    ) {
      continue;
    }

    try {
      const announcements =
        await getCourseAnnouncements(
          course.id,
          {
            limitCount,
          }
        );

      results.push(
        ...announcements.map(
          (announcement) => ({
            ...announcement,

            courseTitle:
              announcement.courseTitle ||
              course.title ||
              course.name ||
              "Course",
          })
        )
      );
    } catch (error) {
      console.warn(
        `Could not load announcements for course ${course.id}:`,
        error
      );
    }
  }

  return sortNewestFirst(
    removeDuplicates(results)
  ).slice(
    0,
    limitCount
  );
}

/** Get published announcements intended only for teacher accounts. */
export async function getTeacherOnlyAnnouncements({
  limitCount = 50,
} = {}) {
  await requireTeacher();

  const snapshot = await getDocs(
    query(
      collection(db, COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS),
      where("audienceType", "==", ANNOUNCEMENT_AUDIENCE.TEACHERS),
      where("status", "==", ANNOUNCEMENT_STATUS.PUBLISHED),
      limit(limitCount)
    )
  );

  return sortNewestFirst(snapshot.docs.map(documentToObject));
}

/* ============================================================
   TEACHER CREATED ANNOUNCEMENTS
============================================================ */

/**
 * Get announcements created by current teacher.
 *
 * IMPORTANT:
 *
 * We query through courses owned by the teacher
 * instead of:
 *
 * where("authorId", "==", uid)
 *
 * because Supabase database security rules validate
 * teacher access through course ownership.
 *
 * This function intentionally includes drafts
 * because teachers need to manage their own drafts.
 */
export async function getMyCreatedAnnouncements({
  limitCount = 100,
} = {}) {
  const user =
    await requireTeacher();

  const teacherCourses =
    await getMyTeacherCourses();

  const results = [];

  const announcementsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS
    );

  for (
    const course of teacherCourses
  ) {
    if (!course?.id) {
      continue;
    }

    /*
     * Teacher-owned course.
     *
     * No status filter here because the teacher
     * may need to manage drafts.
     */
    const q = query(
      announcementsRef,

      where(
        "courseId",
        "==",
        course.id
      ),

      where(
        "audienceType",
        "==",
        ANNOUNCEMENT_AUDIENCE.COURSE
      ),

      limit(limitCount)
    );

    try {
      const snapshot =
        await getDocs(q);

      const announcements =
        snapshot.docs
          .map(
            documentToObject
          )
          .filter(
            (announcement) =>
              announcement.authorId ===
              user.uid
          );

      results.push(
        ...announcements.map(
          (announcement) => ({
            ...announcement,

            courseTitle:
              course.title ||
              course.name ||
              "Course",
          })
        )
      );
    } catch (error) {
      console.warn(
        `Could not load teacher announcements for course ${course.id}:`,
        error
      );
    }
  }

  return sortNewestFirst(
    removeDuplicates(results)
  ).slice(
    0,
    limitCount
  );
}

/* ============================================================
   TEACHER ACTIVITY NOTIFICATIONS
============================================================ */

/**
 * Build a notification feed from activity in the teacher's courses.
 * These are derived from the source collections, so no duplicate
 * notification documents are needed.
 */
export async function getTeacherActivityNotifications({
  limitCount = 50,
} = {}) {
  const teacherCourses = await getMyTeacherCourses();
  const announcements = await getMyTeacherAnnouncements({
    limitCount,
  });

  const activities = [
    ...teacherCourses.map((course) => ({
      id: `course-${course.id}`,
      type: "course",
      title: "Course updated",
      message: course.title || course.name || "Your course was updated.",
      courseId: course.id,
      actionUrl: `/teacher/courses/${course.id}`,
      createdAt: course.updatedAt || course.createdAt,
    })),
    ...announcements.map((announcement) => ({
      id: `announcement-${announcement.id}`,
      type: "announcement",
      title: `Admin announcement: ${announcement.title || "New announcement"}`,
      message: announcement.body || announcement.message || "Announcement updated.",
      courseId: announcement.courseId || null,
      actionUrl: "/teacher/announcements",
      createdAt: announcement.updatedAt || announcement.createdAt,
    })),
  ];

  const courseActivities = await Promise.all(
    teacherCourses.map(async (course) => {
      if (!course?.id) return [];

      const [assignmentSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(
          query(
            collection(db, "assignments"),
            where("courseId", "==", course.id)
          )
        ),
        getDocs(
          query(
            collection(db, "attendanceSessions"),
            where("courseId", "==", course.id)
          )
        ),
      ]);

      return [
        ...assignmentSnapshot.docs.map((assignmentDoc) => {
          const assignment = assignmentDoc.data();

          return {
            id: `assignment-${assignmentDoc.id}`,
            type: "assignment",
            title: assignment.title || "Assignment updated",
            message: `Assignment in ${course.title || "your course"}`,
            courseId: course.id,
            actionUrl: `/teacher/courses/${course.id}/assignments`,
            createdAt: assignment.updatedAt || assignment.createdAt,
          };
        }),
        ...attendanceSnapshot.docs.map((sessionDoc) => {
          const session = sessionDoc.data();

          return {
            id: `attendance-${sessionDoc.id}`,
            type: "attendance",
            title: session.title || "Attendance session",
            message: `Attendance activity in ${course.title || "your course"}`,
            courseId: course.id,
            actionUrl: "/teacher/attendance",
            createdAt: session.updatedAt || session.createdAt,
          };
        }),
      ];
    })
  );

  return sortNewestFirst(
    removeDuplicates([
      ...activities,
      ...courseActivities.flat(),
    ])
  ).slice(0, limitCount);
}

/* ============================================================
   CREATE ANNOUNCEMENT
============================================================ */

/**
 * ADMIN:
 *
 * - Global
 * - Course
 *
 * TEACHER:
 *
 * - Course only
 * - Own course only
 * - Published course only
 */
export async function createAnnouncement({
  title,
  body,
  message,
  audienceType,
  audience,
  courseId = null,
  pinned = false,
  status =
  ANNOUNCEMENT_STATUS.PUBLISHED,
}) {
  const user =
    requireAuthUser();

  const finalTitle =
    cleanString(title);

  const finalBody =
    cleanString(body) ||
    cleanString(message);

  const finalAudience =
    audienceType ||
    audience ||
    ANNOUNCEMENT_AUDIENCE.GLOBAL;

  /* ----------------------------------------------------------
     VALIDATION
  ---------------------------------------------------------- */

  if (!finalTitle) {
    throw new Error(
      "Announcement title is required."
    );
  }

  if (!finalBody) {
    throw new Error(
      "Announcement body is required."
    );
  }

  if (
    finalAudience !== ANNOUNCEMENT_AUDIENCE.GLOBAL &&
    finalAudience !== ANNOUNCEMENT_AUDIENCE.TEACHERS &&
    finalAudience !== ANNOUNCEMENT_AUDIENCE.COURSE
  ) {
    throw new Error(
      "Invalid announcement audience."
    );
  }

  if (
    finalAudience ===
    ANNOUNCEMENT_AUDIENCE.COURSE &&
    !courseId
  ) {
    throw new Error(
      "Course ID is required for course announcements."
    );
  }

  if (
    status !==
    ANNOUNCEMENT_STATUS.DRAFT &&
    status !==
    ANNOUNCEMENT_STATUS.PUBLISHED
  ) {
    throw new Error(
      "Invalid announcement status."
    );
  }

  /* ----------------------------------------------------------
     ROLE
  ---------------------------------------------------------- */

  const role =
    await getCurrentUserRole();

  if (!role) {
    throw new Error(
      "Unable to determine your account role."
    );
  }

  /* ----------------------------------------------------------
     GLOBAL
  ---------------------------------------------------------- */

  if (
    finalAudience === ANNOUNCEMENT_AUDIENCE.GLOBAL ||
    finalAudience === ANNOUNCEMENT_AUDIENCE.TEACHERS
  ) {
    if (role !== "admin") {
      throw new Error(
        "Only administrators can create organization-wide announcements."
      );
    }
  }

  /* ----------------------------------------------------------
     COURSE
  ---------------------------------------------------------- */

  if (
    finalAudience ===
    ANNOUNCEMENT_AUDIENCE.COURSE
  ) {
    const course =
      await getCourse(courseId);

    if (!course) {
      throw new Error(
        "Selected course does not exist."
      );
    }

    /* TEACHER */

    if (role === "teacher") {
      if (
        course.instructorId !==
        user.uid
      ) {
        throw new Error(
          "You can only create announcements for your own courses."
        );
      }

      if (
        course.status !==
        "published"
      ) {
        throw new Error(
          "Announcements can only be created for published courses."
        );
      }
    }
  }

  /* ----------------------------------------------------------
     CREATE
  ---------------------------------------------------------- */

  const announcementRef =
    doc(
      collection(
        db,
        COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS
      )
    );

  const announcement = {
    title:
      finalTitle,

    body:
      finalBody,

    audienceType:
      finalAudience,

    courseId:
      finalAudience ===
        ANNOUNCEMENT_AUDIENCE.COURSE
        ? courseId
        : null,

    authorId:
      user.uid,

    authorName:
      user.displayName ||
      user.email ||
      (role === "teacher"
        ? "Teacher"
        : "LMS Admin"),

    authorRole:
      role,

    status,

    pinned:
      Boolean(pinned),

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await setDoc(
    announcementRef,
    announcement
  );

  return {
    id:
      announcementRef.id,

    ...announcement,
  };
}

/* ============================================================
   UPDATE ANNOUNCEMENT
============================================================ */

export async function updateAnnouncement(
  announcementId,
  updates = {}
) {
  requireAuthUser();

  if (!announcementId) {
    throw new Error(
      "Announcement ID is required."
    );
  }

  const announcementRef =
    doc(
      db,
      COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS,
      announcementId
    );

  const snapshot =
    await getDoc(
      announcementRef
    );

  if (!snapshot.exists()) {
    throw new Error(
      "Announcement not found."
    );
  }

  const existing =
    documentToObject(
      snapshot
    );

  const allowed =
    await canManageAnnouncement(
      existing
    );

  if (!allowed) {
    throw new Error(
      "You do not have permission to edit this announcement."
    );
  }

  const cleanUpdates = {};

  /* TITLE */

  if (
    updates.title !== undefined
  ) {
    const title =
      cleanString(
        updates.title
      );

    if (!title) {
      throw new Error(
        "Announcement title cannot be empty."
      );
    }

    cleanUpdates.title =
      title;
  }

  /* BODY */

  if (
    updates.body !== undefined ||
    updates.message !== undefined
  ) {
    const nextBody =
      cleanString(
        updates.body
      ) ||
      cleanString(
        updates.message
      );

    if (!nextBody) {
      throw new Error(
        "Announcement body cannot be empty."
      );
    }

    cleanUpdates.body =
      nextBody;
  }

  /* STATUS */

  /* AUDIENCE — admins may change an announcement's audience while editing. */
  if (updates.audienceType !== undefined) {
    const nextAudience = updates.audienceType;
    const role = await getCurrentUserRole();

    if (
      nextAudience !== ANNOUNCEMENT_AUDIENCE.GLOBAL &&
      nextAudience !== ANNOUNCEMENT_AUDIENCE.TEACHERS &&
      nextAudience !== ANNOUNCEMENT_AUDIENCE.COURSE
    ) {
      throw new Error("Invalid announcement audience.");
    }

    if (role !== "admin" && nextAudience !== ANNOUNCEMENT_AUDIENCE.COURSE) {
      throw new Error("Teachers can only send announcements to their course students.");
    }

    if (nextAudience === ANNOUNCEMENT_AUDIENCE.COURSE) {
      const nextCourseId = updates.courseId || existing.courseId;
      if (!nextCourseId) throw new Error("Course ID is required for course announcements.");
      cleanUpdates.courseId = nextCourseId;
    } else {
      cleanUpdates.courseId = null;
    }

    cleanUpdates.audienceType = nextAudience;
  }

  if (
    updates.status !== undefined
  ) {
    if (
      updates.status !==
      ANNOUNCEMENT_STATUS.DRAFT &&
      updates.status !==
      ANNOUNCEMENT_STATUS.PUBLISHED
    ) {
      throw new Error(
        "Invalid announcement status."
      );
    }

    cleanUpdates.status =
      updates.status;
  }

  /* PIN */

  if (
    updates.pinned !== undefined
  ) {
    cleanUpdates.pinned =
      Boolean(
        updates.pinned
      );
  }

  cleanUpdates.updatedAt =
    serverTimestamp();

  await updateDoc(
    announcementRef,
    cleanUpdates
  );

  const updatedSnapshot =
    await getDoc(
      announcementRef
    );

  if (
    !updatedSnapshot.exists()
  ) {
    return null;
  }

  return documentToObject(
    updatedSnapshot
  );
}

/* ============================================================
   DELETE ANNOUNCEMENT
============================================================ */

export async function deleteAnnouncement(
  announcementId
) {
  requireAuthUser();

  if (!announcementId) {
    throw new Error(
      "Announcement ID is required."
    );
  }

  const announcementRef =
    doc(
      db,
      COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS,
      announcementId
    );

  const snapshot =
    await getDoc(
      announcementRef
    );

  if (!snapshot.exists()) {
    throw new Error(
      "Announcement not found."
    );
  }

  const announcement =
    documentToObject(
      snapshot
    );

  const allowed =
    await canManageAnnouncement(
      announcement
    );

  if (!allowed) {
    throw new Error(
      "You do not have permission to delete this announcement."
    );
  }

  await deleteDoc(
    announcementRef
  );

  return true;
}

/* ============================================================
   TOGGLE ANNOUNCEMENT PIN
============================================================ */

export async function toggleAnnouncementPin(
  announcementId,
  pinned
) {
  requireAuthUser();

  if (!announcementId) {
    throw new Error(
      "Announcement ID is required."
    );
  }

  const announcementRef =
    doc(
      db,
      COMMUNICATION_COLLECTIONS.ANNOUNCEMENTS,
      announcementId
    );

  const snapshot =
    await getDoc(
      announcementRef
    );

  if (!snapshot.exists()) {
    throw new Error(
      "Announcement not found."
    );
  }

  const announcement =
    documentToObject(
      snapshot
    );

  const allowed =
    await canManageAnnouncement(
      announcement
    );

  if (!allowed) {
    throw new Error(
      "You do not have permission to modify this announcement."
    );
  }

  await updateDoc(
    announcementRef,
    {
      pinned:
        Boolean(pinned),

      updatedAt:
        serverTimestamp(),
    }
  );

  return true;
}

/* ============================================================
   DISCUSSIONS
============================================================ */

/**
 * Get discussions for course.
 */
export async function getCourseDiscussions(
  courseId,
  {
    limitCount = 100,
  } = {}
) {
  requireAuthUser();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const discussionsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.DISCUSSIONS
    );

  const q = query(
    discussionsRef,

    where(
      "courseId",
      "==",
      courseId
    ),

    limit(limitCount)
  );

  const snapshot =
    await getDocs(q);

  return sortNewestFirst(
    snapshot.docs.map(
      documentToObject
    )
  );
}

/**
 * Get one discussion.
 */
export async function getDiscussion(
  discussionId
) {
  requireAuthUser();

  if (!discussionId) {
    throw new Error(
      "Discussion ID is required."
    );
  }

  const snapshot =
    await getDoc(
      doc(
        db,
        COMMUNICATION_COLLECTIONS.DISCUSSIONS,
        discussionId
      )
    );

  if (!snapshot.exists()) {
    return null;
  }

  return documentToObject(
    snapshot
  );
}

/**
 * Create discussion.
 */
export async function createDiscussion({
  courseId,
  lessonId = null,
  title,
  body,
}) {
  const user =
    requireAuthUser();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  const finalTitle =
    cleanString(title);

  const finalBody =
    cleanString(body);

  if (!finalTitle) {
    throw new Error(
      "Discussion title is required."
    );
  }

  if (!finalBody) {
    throw new Error(
      "Discussion body is required."
    );
  }

  const discussionRef =
    doc(
      collection(
        db,
        COMMUNICATION_COLLECTIONS.DISCUSSIONS
      )
    );

  const discussion = {
    courseId,

    lessonId,

    title:
      finalTitle,

    body:
      finalBody,

    authorId:
      user.uid,

    authorName:
      user.displayName ||
      user.email ||
      "LMS User",

    status:
      DISCUSSION_STATUS.OPEN,

    replyCount:
      0,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await setDoc(
    discussionRef,
    discussion
  );

  return {
    id:
      discussionRef.id,

    ...discussion,
  };
}

/**
 * Update discussion.
 */
export async function updateDiscussion(
  discussionId,
  updates = {}
) {
  requireAuthUser();

  if (!discussionId) {
    throw new Error(
      "Discussion ID is required."
    );
  }

  const cleanUpdates = {};

  if (
    updates.title !== undefined
  ) {
    const title =
      cleanString(
        updates.title
      );

    if (!title) {
      throw new Error(
        "Discussion title cannot be empty."
      );
    }

    cleanUpdates.title =
      title;
  }

  if (
    updates.body !== undefined
  ) {
    const body =
      cleanString(
        updates.body
      );

    if (!body) {
      throw new Error(
        "Discussion body cannot be empty."
      );
    }

    cleanUpdates.body =
      body;
  }

  if (
    updates.status !== undefined
  ) {
    if (
      !Object.values(
        DISCUSSION_STATUS
      ).includes(
        updates.status
      )
    ) {
      throw new Error(
        "Invalid discussion status."
      );
    }

    cleanUpdates.status =
      updates.status;
  }

  cleanUpdates.updatedAt =
    serverTimestamp();

  await updateDoc(
    doc(
      db,
      COMMUNICATION_COLLECTIONS.DISCUSSIONS,
      discussionId
    ),
    cleanUpdates
  );

  return getDiscussion(
    discussionId
  );
}

/**
 * Delete discussion.
 */
export async function deleteDiscussion(
  discussionId
) {
  requireAuthUser();

  if (!discussionId) {
    throw new Error(
      "Discussion ID is required."
    );
  }

  await deleteDoc(
    doc(
      db,
      COMMUNICATION_COLLECTIONS.DISCUSSIONS,
      discussionId
    )
  );

  return true;
}

/**
 * Resolve discussion.
 */
export async function resolveDiscussion(
  discussionId
) {
  requireAuthUser();

  if (!discussionId) {
    throw new Error(
      "Discussion ID is required."
    );
  }

  await updateDoc(
    doc(
      db,
      COMMUNICATION_COLLECTIONS.DISCUSSIONS,
      discussionId
    ),
    {
      status:
        DISCUSSION_STATUS.RESOLVED,

      updatedAt:
        serverTimestamp(),
    }
  );

  return true;
}

/* ============================================================
   DISCUSSION REPLIES
============================================================ */

/**
 * Get replies.
 */
export async function getDiscussionReplies(
  discussionId,
  {
    limitCount = 100,
  } = {}
) {
  requireAuthUser();

  if (!discussionId) {
    throw new Error(
      "Discussion ID is required."
    );
  }

  const repliesRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.DISCUSSIONS,
      discussionId,
      "replies"
    );

  const q = query(
    repliesRef,
    limit(limitCount)
  );

  const snapshot =
    await getDocs(q);

  return sortNewestFirst(
    snapshot.docs.map(
      documentToObject
    )
  );
}

/**
 * Create reply.
 */
export async function createDiscussionReply(
  discussionId,
  body
) {
  const user =
    requireAuthUser();

  if (!discussionId) {
    throw new Error(
      "Discussion ID is required."
    );
  }

  const finalBody =
    cleanString(body);

  if (!finalBody) {
    throw new Error(
      "Reply cannot be empty."
    );
  }

  const replyRef =
    doc(
      collection(
        db,
        COMMUNICATION_COLLECTIONS.DISCUSSIONS,
        discussionId,
        "replies"
      )
    );

  const reply = {
    authorId:
      user.uid,

    authorName:
      user.displayName ||
      user.email ||
      "LMS User",

    body:
      finalBody,

    createdAt:
      serverTimestamp(),

    updatedAt:
      serverTimestamp(),
  };

  await setDoc(
    replyRef,
    reply
  );

  return {
    id:
      replyRef.id,

    ...reply,
  };
}

/**
 * Delete reply.
 */
export async function deleteDiscussionReply(
  discussionId,
  replyId
) {
  requireAuthUser();

  if (
    !discussionId ||
    !replyId
  ) {
    throw new Error(
      "Discussion ID and reply ID are required."
    );
  }

  await deleteDoc(
    doc(
      db,
      COMMUNICATION_COLLECTIONS.DISCUSSIONS,
      discussionId,
      "replies",
      replyId
    )
  );

  return true;
}

/* ============================================================
   NOTIFICATIONS
============================================================ */

/**
 * Get current user's notifications.
 *
 * Canonical field:
 *
 * recipientId
 */
export async function getMyNotifications({
  limitCount = 100,
} = {}) {
  const user =
    requireAuthUser();

  const notificationsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.NOTIFICATIONS
    );

  const q = query(
    notificationsRef,

    where(
      "recipientId",
      "==",
      user.uid
    ),

    limit(limitCount)
  );

  const snapshot =
    await getDocs(q);

  return sortNewestFirst(
    snapshot.docs.map(
      documentToObject
    )
  );
}

/**
 * Build the admin activity feed without Cloud Functions.
 * This reads source collections directly, so it works on the Spark plan.
 */
export async function getAdminActivityNotifications({
  limitCount = 100,
} = {}) {
  await requireAdmin();

  const [users, enrollments, payments, courses, announcements] =
    await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(collection(db, "enrollments")),
      getDocs(collection(db, "payments")),
      getDocs(collection(db, "courses")),
      getDocs(collection(db, "announcements")),
    ]);

  const activities = [];
  const addActivity = (id, type, title, message, link, data = {}) => {
    const createdAt =
      data.createdAt || data.updatedAt || data.date || null;

    if (!createdAt) return;

    activities.push({
      id,
      type,
      title,
      message,
      link,
      courseId: data.courseId || null,
      createdAt,
      read: false,
    });
  };

  users.docs.forEach((item) => {
    const user = item.data();
    if (user.role === "admin") return;

    addActivity(
      `user-${item.id}`,
      "system",
      "New user joined",
      `${user.name || user.fullName || user.email || "A user"} joined as ${user.role || "student"}.`,
      "/admin/students",
      user
    );
  });

  enrollments.docs.forEach((item) => {
    const enrollment = item.data();
    addActivity(
      `enrollment-${item.id}`,
      "enrollment",
      "New enrollment",
      `A student enrolled in ${enrollment.courseName || "a course"}.`,
      "/admin/students",
      enrollment
    );
  });

  payments.docs.forEach((item) => {
    const payment = item.data();
    const isRefund = ["refunded", "refund_completed"].includes(payment.status);
    const isPaid = payment.status === "paid" || payment.status === "captured";

    if (!isRefund && !isPaid) return;

    addActivity(
      `payment-${item.id}`,
      isRefund ? "refund" : "payment",
      isRefund ? "Refund processed" : "Payment received",
      isRefund
        ? `A refund was processed for ${payment.courseName || "a course"}.`
        : `Payment received for ${payment.courseName || "a course"}.`,
      "/admin/payments",
      payment
    );
  });

  courses.docs.forEach((item) => {
    const course = item.data();
    addActivity(
      `course-${item.id}`,
      course.status === "published" ? "course_published" : "course_updated",
      course.status === "published" ? "Course published" : "Course updated",
      course.title || course.name || "A course was updated.",
      "/admin/courses",
      { ...course, courseId: item.id }
    );
  });

  announcements.docs.forEach((item) => {
    const announcement = item.data();
    const expired = announcement.status === "expired";
    if (announcement.status !== "published" && !expired) return;

    addActivity(
      `announcement-${item.id}`,
      expired ? "announcement_expired" : "announcement",
      expired ? "Announcement expired" : "New announcement",
      announcement.title || "An announcement was published.",
      "/admin/announcements",
      announcement
    );
  });

  return activities
    .sort(
      (a, b) =>
        getTimestampValue(b.createdAt) -
        getTimestampValue(a.createdAt)
    )
    .slice(0, limitCount);
}

/**
 * Get unread notification count.
 */
export async function getUnreadNotificationCount() {
  const user =
    requireAuthUser();

  const notificationsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.NOTIFICATIONS
    );

  const q = query(
    notificationsRef,

    where(
      "recipientId",
      "==",
      user.uid
    ),

    limit(100)
  );

  const snapshot =
    await getDocs(q);

  return snapshot.docs.filter(
    (notification) =>
      notification.data()?.read ===
      false
  ).length;
}

/**
 * Mark one notification as read.
 */
export async function markNotificationRead(
  notificationId
) {
  requireAuthUser();

  if (!notificationId) {
    throw new Error(
      "Notification ID is required."
    );
  }

  await updateDoc(
    doc(
      db,
      COMMUNICATION_COLLECTIONS.NOTIFICATIONS,
      notificationId
    ),
    {
      read:
        true,

      readAt:
        serverTimestamp(),
    }
  );

  return true;
}

/**
 * Mark all notifications as read.
 */
export async function markAllNotificationsRead() {
  const user =
    requireAuthUser();

  const notificationsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.NOTIFICATIONS
    );

  const q = query(
    notificationsRef,

    where(
      "recipientId",
      "==",
      user.uid
    ),

    limit(100)
  );

  const snapshot =
    await getDocs(q);

  const unread =
    snapshot.docs.filter(
      (notification) =>
        notification.data()?.read ===
        false
    );

  if (
    unread.length === 0
  ) {
    return 0;
  }

  let updated = 0;

  for (
    const notification of unread
  ) {
    await updateDoc(
      notification.ref,
      {
        read:
          true,

        readAt:
          serverTimestamp(),
      }
    );

    updated += 1;
  }

  return updated;
}

/**
 * Delete notification.
 */
export async function deleteNotification(
  notificationId
) {
  requireAuthUser();

  if (!notificationId) {
    throw new Error(
      "Notification ID is required."
    );
  }

  await deleteDoc(
    doc(
      db,
      COMMUNICATION_COLLECTIONS.NOTIFICATIONS,
      notificationId
    )
  );

  return true;
}

/* ============================================================
   CREATE NOTIFICATION
============================================================ */

/**
 * Create notification.
 *
 * Current security architecture:
 *
 * Admin / Cloud Functions create notifications.
 *
 * Students and teachers do not directly create
 * notifications.
 */
export async function createNotification({
  recipientId,
  type =
  NOTIFICATION_TYPES.SYSTEM,
  title,
  message,
  link = "",
  courseId = null,
  actorId = null,
}) {
  await requireAdmin();

  if (!recipientId) {
    throw new Error(
      "Recipient ID is required."
    );
  }

  const finalTitle =
    cleanString(title);

  const finalMessage =
    cleanString(message);

  if (!finalTitle) {
    throw new Error(
      "Notification title is required."
    );
  }

  if (!finalMessage) {
    throw new Error(
      "Notification message is required."
    );
  }

  const notificationRef =
    doc(
      collection(
        db,
        COMMUNICATION_COLLECTIONS.NOTIFICATIONS
      )
    );

  const notification = {
    recipientId,

    type,

    title:
      finalTitle,

    message:
      finalMessage,

    link:
      link || "",

    courseId:
      courseId || null,

    actorId:
      actorId || null,

    read:
      false,

    createdAt:
      serverTimestamp(),
  };

  await setDoc(
    notificationRef,
    notification
  );

  return {
    id:
      notificationRef.id,

    ...notification,
  };
}

/* ============================================================
   REAL-TIME NOTIFICATIONS
============================================================ */

/**
 * Subscribe to current user's notifications.
 *
 * No orderBy().
 *
 * Client-side sorting avoids composite indexes.
 */
export function subscribeToMyNotifications(
  callback,
  onError
) {
  const user =
    requireAuthUser();

  if (
    typeof callback !==
    "function"
  ) {
    throw new Error(
      "Notification callback is required."
    );
  }

  const notificationsRef =
    collection(
      db,
      COMMUNICATION_COLLECTIONS.NOTIFICATIONS
    );

  const q = query(
    notificationsRef,

    where(
      "recipientId",
      "==",
      user.uid
    ),

    limit(100)
  );

  return onSnapshot(
    q,

    (snapshot) => {
      const notifications =
        sortNewestFirst(
          snapshot.docs.map(
            documentToObject
          )
        );

      callback(
        notifications
      );
    },

    (error) => {
      console.error(
        "Notification listener error:",
        error
      );

      if (
        typeof onError ===
        "function"
      ) {
        onError(error);
      }
    }
  );
}
