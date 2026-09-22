import { collection, query, where, onSnapshot } from "../lib/database";
import { auth, db } from "../lib/backend";
import { onAuthStateChanged } from "../lib/auth";
import { useEffect, useState } from "react";
import { fromRow } from "../lib/records";
import { deleteObject, ref } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { uploadImage } from "../lib/Media";

/* ============================================================
   TABLE
============================================================ */

export const COURSES_TABLE = "lms_courses";
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

function sortCourses(a, b) {
  const orderA = typeof a.course_order === "number" ? a.course_order : 999999;
  const orderB = typeof b.course_order === "number" ? b.course_order : 999999;

  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return (a.title || "").localeCompare(b.title || "");
}

async function requireAuthUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("You must be logged in to perform this action.");
  }

  return user;
}

/*
  Turns raw Postgres/PostgREST errors into something safe to show
  in the UI, without leaking internal error codes/messages to end
  users. "42501" / RLS-denied is the most common case when a query
  runs for a user/role that a policy doesn't allow to read that row.
*/
function friendlyDbError(error, fallbackMessage) {
  if (!error) return fallbackMessage;
  if (error.code === "42501" || /row-level security/i.test(error.message || "")) {
    return "You don't have permission to view this data.";
  }
  if (error.message?.toLowerCase().includes("network")) {
    return "Connection issue — please check your internet and try again.";
  }
  return error.message || fallbackMessage;
}

/* ============================================================
   VERIFY COURSE OWNER
============================================================ */

async function requireCourseOwner(courseId) {
  const user = await requireAuthUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const { data: course, error } = await supabase
    .from(COURSES_TABLE)
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (error || !course) {
    throw new Error("Course not found.");
  }

  if (course.instructor_id !== user.id) {
    throw new Error("You do not have permission to manage this course.");
  }

  return { user, course };
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

  return { categories, coursesByCategory };
}

/* ============================================================
   TEACHER — GET MY COURSES (one-off fetch)
============================================================ */

export async function getMyCourses(teacherId) {
  const user = await requireAuthUser();
  const id = teacherId || user.id;

  const { data, error } = await supabase
    .from(COURSES_TABLE)
    .select("*")
    .eq("instructor_id", id);

  if (error) throw new Error(friendlyDbError(error, "Unable to load your courses."));

  return (data || []).map((row) => fromRow("courses", row)).sort(sortCourses);
}

/* ============================================================
   TEACHER — LIVE COURSES (realtime)

   IMPORTANT: pass `enabled: false` for any session that is not
   actually an instructor session (e.g. a student viewing their
   own dashboard). Firing this for a user whose RLS policy
   doesn't grant them instructor-level reads will just come back
   empty — that's a role mismatch, not something this hook works
   around, so the caller should simply not attach it at all.

   Requires the `courses` table to be added to the "supabase_realtime"
   publication (Database -> Replication in the Supabase dashboard) —
   it's off by default for new tables.
============================================================ */

export function useMyCourses(teacherIdParam, { enabled = true } = {}) {
  const [state, setState] = useState({ courses: [], loading: true, error: null });
  const [currentId, setCurrentId] = useState(auth.currentUser?.uid);
  useEffect(() => onAuthStateChanged(auth, (user) => setCurrentId(user?.uid)), []);
  const teacherId = teacherIdParam || currentId;
  useEffect(() => {
    if (!enabled || !teacherId) {
      setState({ courses: [], loading: false, error: null });
      return;
    }
    setState({ courses: [], loading: true, error: null });
    return onSnapshot(query(collection(db, "courses"), where("instructorId", "==", teacherId)),
      (snapshot) => setState({ courses: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort(sortCourses), loading: false, error: null }),
      (error) => setState({ courses: [], loading: false, error: friendlyDbError(error, "Unable to load your courses.") }));
  }, [teacherId, enabled]);
  return state;
}

export async function getCourseById(courseId) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const { data, error } = await supabase
    .from(COURSES_TABLE)
    .select("*")
    .eq("id", courseId)
    .maybeSingle();

  if (error) throw new Error(friendlyDbError(error, "Unable to load course."));

  return fromRow("courses", data);
}

/* ============================================================
   CREATE COURSE

  IMPORTANT:

  Teacher creates:
      draft → teacher adds content → teacher publishes directly →
      published

  No admin approval step. Teachers own their courses end-to-end;
  admins do not gate the draft → published transition. See
  publishCourse() below, and the corresponding Supabase RLS UPDATE
  policy on lms_courses which must allow the owning instructor to
  set status = 'published' (not just 'draft').
============================================================ */

export async function createCourse(courseData = {}) {
  const user = await requireAuthUser();

  const title = courseData.title?.trim();
  if (!title) {
    throw new Error("Course title is required.");
  }

  if (courseData.type !== COURSE_TYPES.SHORT && courseData.type !== COURSE_TYPES.LONG) {
    throw new Error("Course type must be short or long.");
  }

  const course = {
    id: crypto.randomUUID(),
    title,
    slug: courseData.slug?.trim() || slugify(title),
    description: courseData.description?.trim() || "",
    short_description: courseData.shortDescription?.trim() || "",
    category: courseData.category?.trim() || "",
    level: courseData.level?.trim() || "",
    duration: courseData.duration?.trim() || "",
    type: courseData.type,
    instructor_id: user.id,
    instructor_name: courseData.instructorName?.trim() || user.user_metadata?.name || "",
    thumbnail_url: courseData.thumbnailUrl || "",
    thumbnail_path: courseData.thumbnailPath || "",
    banner_url: courseData.bannerUrl || "",
    banner_path: courseData.bannerPath || "",
    preview_video_url: courseData.previewVideoUrl || "",
    preview_video_path: courseData.previewVideoPath || "",
    price: Number(courseData.price) || 0,
    discount_price: Number(courseData.discountPrice) || 0,
    currency: courseData.currency || "INR",
    status: COURSE_STATUS.DRAFT,
    featured: false,
    course_order: 0,
    published_at: null,
    rejection_reason: "",
    student_count: 0,
    enrollment_count: 0,
  };

  const { error } = await supabase
    .from(COURSES_TABLE)
    .insert(course);

  // The SELECT policy checks ownership by querying the course table. During
  // INSERT RETURNING its stable helper cannot see the newly inserted draft.
  // Save without RETURNING; subsequent requests can read the committed row.
  if (error) throw new Error(error.code === "42501"
    ? "Your account does not have permission to create courses. Please contact the institute administrator."
    : friendlyDbError(error, "Unable to create course."));

  return fromRow("courses", course);
}

/* ============================================================
   UPDATE COURSE
============================================================ */

export async function updateCourse(courseId, courseData = {}) {
  const { course: existingCourse } = await requireCourseOwner(courseId);

  if (existingCourse.status === COURSE_STATUS.ARCHIVED) {
    throw new Error("Archived courses cannot be edited.");
  }

  const updates = {};

  if (courseData.title !== undefined) {
    const title = courseData.title.trim();
    if (!title) throw new Error("Course title cannot be empty.");
    updates.title = title;
    updates.slug = courseData.slug?.trim() || slugify(title);
  }

  // camelCase form field -> snake_case column name
  const editableFieldMap = {
    description: "description",
    shortDescription: "short_description",
    category: "category",
    level: "level",
    duration: "duration",
    thumbnailUrl: "thumbnail_url",
    thumbnailPath: "thumbnail_path",
    bannerUrl: "banner_url",
    bannerPath: "banner_path",
    previewVideoUrl: "preview_video_url",
    previewVideoPath: "preview_video_path",
    currency: "currency",
  };

  for (const [field, column] of Object.entries(editableFieldMap)) {
    if (courseData[field] !== undefined) {
      updates[column] = courseData[field];
    }
  }

  if (courseData.price !== undefined) {
    updates.price = Number(courseData.price) || 0;
  }
  if (courseData.discountPrice !== undefined) {
    updates.discount_price = Number(courseData.discountPrice) || 0;
  }

  if (courseData.type !== undefined) {
    if (courseData.type !== COURSE_TYPES.SHORT && courseData.type !== COURSE_TYPES.LONG) {
      throw new Error("Invalid course type.");
    }
    updates.type = courseData.type;
  }

  // Never allow a teacher to modify admin-controlled fields directly —
  // RLS already blocks it server-side, this is just a client-side guard
  // so a bug here fails loudly instead of silently trying and getting
  // rejected.
  delete updates.instructor_id;
  delete updates.featured;
  delete updates.course_order;
  delete updates.published_at;
  delete updates.created_at;
  delete updates.status;

  if (existingCourse.status === COURSE_STATUS.REJECTED) {
    updates.status = COURSE_STATUS.DRAFT;
    updates.rejection_reason = "";
  }

  updates.updated_at = new Date().toISOString();

  const { error } = await supabase.from(COURSES_TABLE).update(updates).eq("id", courseId);

  if (error) throw new Error(friendlyDbError(error, "Unable to update course."));

  return getCourseById(courseId);
}

/* ============================================================
   DELETE COURSE

   Modules, lessons, enrollments, payments, assignments, and
   certificates tied to this course all cascade-delete
   automatically via the "on delete cascade" foreign keys in the
   schema — Postgres handles that in one transaction, so there's
   no manual walk-the-subcollections step here like Supabase database
   needed. We only need to clean up Storage files manually.
============================================================ */

export async function deleteCourse(courseId) {
  const { course } = await requireCourseOwner(courseId);

  const directStoragePaths = [course.thumbnail_path, course.banner_path, course.preview_video_path].filter(Boolean);

  for (const path of directStoragePaths) {
    await safeDeleteStorageFile(path);
  }

  // Also clean up any lesson video/resource files before the cascade
  // delete removes the rows (paths would otherwise be unrecoverable).
  const { data: lessons } = await supabase
    .from("lms_lessons")
    .select("video_path, resource_path")
    .eq("course_id", courseId);

  for (const lesson of lessons || []) {
    if (lesson.video_path) await safeDeleteStorageFile(lesson.video_path);
    if (lesson.resource_path) await safeDeleteStorageFile(lesson.resource_path);
  }

  const { error } = await supabase.from(COURSES_TABLE).delete().eq("id", courseId);

  if (error) throw new Error(friendlyDbError(error, "Unable to delete course."));

  return true;
}

/* ============================================================
   PUBLISH COURSE

   Teacher-facing action. Teachers publish their own courses
   directly — no admin approval step. Requires the Supabase RLS
   UPDATE policy on lms_courses to allow the course owner to set
   status to "published" (not just "draft"/"pending").
============================================================ */

export async function publishCourse(courseId) {
  const { course } = await requireCourseOwner(courseId);

  if (course.status === COURSE_STATUS.PUBLISHED) {
    throw new Error("This course is already published.");
  }
  if (course.status === COURSE_STATUS.ARCHIVED) {
    throw new Error("Archived courses cannot be published.");
  }
  if (!course.title?.trim()) {
    throw new Error("Course title is required.");
  }
  if (!course.type) {
    throw new Error("Course type is required.");
  }

  const { error } = await supabase
    .from(COURSES_TABLE)
    .update({ status: COURSE_STATUS.PUBLISHED, published_at: new Date().toISOString(), rejection_reason: "", updated_at: new Date().toISOString() })
    .eq("id", courseId);

  if (error) throw new Error(friendlyDbError(error, "Unable to publish course."));

  return getCourseById(courseId);
}

/* ============================================================
   UNPUBLISH
============================================================ */

export async function unpublishCourse(courseId) {
  const { course } = await requireCourseOwner(courseId);

  if (course.status !== COURSE_STATUS.PUBLISHED) {
    throw new Error("Only published courses can be unpublished.");
  }

  const { error } = await supabase
    .from(COURSES_TABLE)
    .update({ status: COURSE_STATUS.DRAFT, published_at: null, updated_at: new Date().toISOString() })
    .eq("id", courseId);

  if (error) throw new Error(friendlyDbError(error, "Unable to unpublish course."));

  return getCourseById(courseId);
}

/* ============================================================
   PUBLIC — PUBLISHED COURSES (realtime)

   Requires the `courses` table added to the "supabase_realtime"
   publication in Database -> Replication.
============================================================ */

export function usePublishedCourses(type) {
  const [state, setState] = useState({ courses: [], loading: true, error: null });
  useEffect(() => {
    setState({ courses: [], loading: true, error: null });
    return onSnapshot(query(collection(db, "courses"), where("type", "==", type), where("status", "==", COURSE_STATUS.PUBLISHED)),
      (snapshot) => setState({ courses: snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).sort(sortCourses), loading: false, error: null }),
      (error) => setState({ courses: [], loading: false, error: friendlyDbError(error, "Unable to load courses.") }));
  }, [type]);
  return state;
}

export function usePublishedCoursesByCategory(type) {
  const { courses, loading, error } = usePublishedCourses(type);
  const { categories, coursesByCategory } = groupByCategory(courses);
  return { categories, coursesByCategory, courses, loading, error };
}

/* ============================================================
   PUBLIC — COURSE DETAIL
============================================================ */

export async function getPublishedCourseByIdOrSlug(idOrSlug) {
  if (!idOrSlug) {
    return null;
  }

  // Try as a UUID first
  const { data: byId } = await supabase
    .from(COURSES_TABLE)
    .select("*")
    .eq("id", idOrSlug)
    .maybeSingle();

  if (byId) {
    return byId.status === COURSE_STATUS.PUBLISHED ? fromRow("courses", byId) : null;
  }

  // Fall back to slug
  const { data: bySlug } = await supabase
    .from(COURSES_TABLE)
    .select("*")
    .eq("slug", idOrSlug)
    .eq("status", COURSE_STATUS.PUBLISHED)
    .maybeSingle();

  return fromRow("courses", bySlug);
}

// Thumbnails are uploaded to the public Supabase image bucket.

export async function uploadCourseThumbnail(courseId, file, onProgress) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  await requireAuthUser();

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

  return { url: result.url, path: result.publicId };
}

// Remove the previous thumbnail after replacement.

export async function deleteCourseThumbnail(path) {
  if (path) await deleteObject(ref(null, path));
}

// Private and public storage paths are routed to their bucket.

async function safeDeleteStorageFile(path) {
  if (!path) return;
  await deleteObject(ref(null, path));
}