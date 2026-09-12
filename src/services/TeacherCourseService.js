// src/services/teacherCourseService.js
//
// Teacher-facing course CRUD — every function here is scoped to "courses
// this teacher owns" (spec Section 17). This is the ONLY place course
// content gets created or edited; the Admin panel never writes course
// content directly (see adminCourseService.js — it only flips `status`,
// `featured`, and `order`, all enforced server-side by firestore.rules).
//
// Reuses the exact field schema Admin/Courses.jsx already writes
// (type, title, slug, category, description, duration, tags, instructor,
// icon, price, lessons, plus type-specific fields: images/features/mode/
// link for "long", image/popular for "short") so existing courses and
// existing consumers (ShortCourses.jsx, Livecourses.jsx, CourseDetails.jsx)
// don't need to change shape — only the ownership/approval layer is new.

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { auth, db } from "../firebase/Firebase";
import {
  COURSES_COLLECTION,
  COURSE_STATUS,
  deleteCourseThumbnail,
  slugify,
  uploadCourseThumbnail,
} from "./CourseService";
import { iconForCategory } from "../lib/CoursesMeta";

const DEFAULT_INSTRUCTOR = "Creative Adhyayan Faculty";
const DEFAULT_PRICE = "Contact us";

function coursesCol() {
  return collection(db, COURSES_COLLECTION);
}

function requireUser() {
  const user = auth.currentUser;
  if (!user) throw new Error("You must be signed in as a teacher to do that.");
  return user;
}

/** Splits a textarea's lines into a clean array, dropping blanks. */
function splitLines(str = "") {
  return str.split("\n").map((s) => s.trim()).filter(Boolean);
}

/** Splits a comma-separated field (e.g. tags) into a clean array. */
function splitCommas(str = "") {
  return str.split(",").map((s) => s.trim()).filter(Boolean);
}

/* ------------------------------------------------------------------ */
/*  Read — scoped to the signed-in teacher's own courses               */
/* ------------------------------------------------------------------ */

/**
 * Live-subscribes to every course owned by `teacherId` — draft, pending,
 * published, rejected, and archived alike, since this is the teacher's
 * own "My Courses" view and they need to see everything they own,
 * regardless of where it is in the approval pipeline.
 */
export function useMyCourses(teacherId) {
  const [state, setState] = useState({ courses: [], loading: true, error: null });

  useEffect(() => {
    if (!teacherId) {
      setState({ courses: [], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    const q = query(coursesCol(), where("instructorId", "==", teacherId));

    const unsub = onSnapshot(
      q,
      (snap) => {
        if (cancelled) return;
        const rows = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.updatedAt?.toMillis?.() ?? 0) - (a.updatedAt?.toMillis?.() ?? 0));
        setState({ courses: rows, loading: false, error: null });
      },
      (err) => {
        if (cancelled) return;
        setState({ courses: [], loading: false, error: err.message });
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [teacherId]);

  return state;
}

/** One-off fetch, e.g. loading a single course into the edit form. */
export async function getCourseById(courseId) {
  const snap = await getDoc(doc(db, COURSES_COLLECTION, courseId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/* ------------------------------------------------------------------ */
/*  Write — every mutation checks ownership client-side too, even      */
/*  though firestore.rules is the real enforcement layer, so a teacher */
/*  gets a clear error message instead of an opaque permission-denied. */
/* ------------------------------------------------------------------ */

/**
 * Creates a new course owned by the signed-in teacher. Always starts as
 * `draft` — the teacher can keep editing privately until they call
 * submitForApproval(). `instructorId` is set here from the authenticated
 * user, never taken from the form (spec Section 5: "auto-fills as the
 * logged-in teacher, not manually assignable by teacher").
 *
 * Returns the new course's id.
 */
export async function createCourse(form) {
  const user = requireUser();

  const base = {
    type: form.type,
    title: form.title,
    slug: slugify(form.title),
    category: form.category || "",
    description: form.description || "",
    shortDescription: form.shortDescription || "",
    duration: form.duration || "",
    level: form.level || "",
    tags: splitCommas(form.tagsInput || ""),
    instructor: form.instructor || user.displayName || DEFAULT_INSTRUCTOR,
    instructorId: user.uid,
    icon: form.icon || iconForCategory(form.category),
    price: form.price || DEFAULT_PRICE,
    discountPrice: form.discountPrice || "",
    currency: form.currency || "INR",
    lessons: form.lessons ? Number(form.lessons) : 0,
    students: 0,
    status: COURSE_STATUS.DRAFT,
    featured: false,
    order: 999999,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const payload =
    form.type === "long"
      ? {
          ...base,
          mode: form.mode || "",
          link: form.link || "",
          startDate: form.startDate || "",
          endDate: form.endDate || "",
          images: splitLines(form.imagesInput || ""),
          features: splitLines(form.featuresInput || ""),
          color: form.color || "#5227FF",
        }
      : {
          ...base,
          image: form.image || "",
          color: form.color || "#6D3FC0",
          popular: !!form.popular,
        };

  const created = await addDoc(coursesCol(), payload);

  // Thumbnail upload needs a doc id first (Storage path is
  // courseThumbnails/{courseId}/…), same two-step pattern the existing
  // Admin form already uses.
  if (form.thumbnailFile) {
    const { url, path } = await uploadCourseThumbnail(created.id, form.thumbnailFile);
    const imageField = form.type === "long" ? { images: [url] } : { image: url };
    await updateDoc(doc(db, COURSES_COLLECTION, created.id), {
      ...imageField,
      thumbnailUrl: url,
      thumbnailPath: path,
    });
  }

  return created.id;
}

/**
 * Updates a course the teacher owns. Refuses client-side if the course
 * isn't theirs (firestore.rules would reject it anyway, but this fails
 * fast with a real error message). Cannot be used to change `status`,
 * `featured`, or `order` — use submitForApproval()/unpublishCourse() for
 * status, and understand featured/order are admin-only (this will be
 * silently stripped by the rules even if included, so it's dropped here
 * too to avoid a confusing partial-success).
 */
export async function updateCourse(courseId, form) {
  const user = requireUser();
  const existing = await getCourseById(courseId);
  if (!existing) throw new Error("Course not found.");
  if (existing.instructorId !== user.uid) {
    throw new Error("You can only edit your own courses.");
  }

  const base = {
    title: form.title,
    slug: slugify(form.title),
    category: form.category || "",
    description: form.description || "",
    shortDescription: form.shortDescription || "",
    duration: form.duration || "",
    level: form.level || "",
    tags: splitCommas(form.tagsInput || ""),
    instructor: form.instructor || existing.instructor,
    icon: form.icon || iconForCategory(form.category),
    price: form.price || DEFAULT_PRICE,
    discountPrice: form.discountPrice || "",
    currency: form.currency || existing.currency || "INR",
    lessons: form.lessons ? Number(form.lessons) : existing.lessons,
    updatedAt: serverTimestamp(),
  };

  const payload =
    existing.type === "long"
      ? {
          ...base,
          mode: form.mode || "",
          link: form.link || "",
          startDate: form.startDate || "",
          endDate: form.endDate || "",
          images: form.imagesInput !== undefined ? splitLines(form.imagesInput) : existing.images,
          features: form.featuresInput !== undefined ? splitLines(form.featuresInput) : existing.features,
          color: form.color || existing.color,
        }
      : {
          ...base,
          image: form.image !== undefined ? form.image : existing.image,
          color: form.color || existing.color,
          popular: !!form.popular,
        };

  if (form.thumbnailFile) {
    const { url, path } = await uploadCourseThumbnail(courseId, form.thumbnailFile);
    if (existing.thumbnailPath && existing.thumbnailPath !== path) {
      deleteCourseThumbnail(existing.thumbnailPath);
    }
    if (existing.type === "long") {
      payload.images = [url, ...(payload.images || []).filter((i) => i !== url)];
    } else {
      payload.image = url;
    }
    payload.thumbnailUrl = url;
    payload.thumbnailPath = path;
  }

  await updateDoc(doc(db, COURSES_COLLECTION, courseId), payload);
}

/**
 * Deletes a course the teacher owns, plus its thumbnail. Module/lesson
 * subcollection + video cleanup is handled by the content-manager
 * service (next file) since that's where those docs are created —
 * calling that cleanup here would duplicate storage-path knowledge in
 * two places.
 */
export async function deleteCourse(courseId) {
  const user = requireUser();
  const existing = await getCourseById(courseId);
  if (!existing) return;
  if (existing.instructorId !== user.uid) {
    throw new Error("You can only delete your own courses.");
  }
  await deleteDoc(doc(db, COURSES_COLLECTION, courseId));
  if (existing.thumbnailPath) deleteCourseThumbnail(existing.thumbnailPath);
}

/**
 * Moves a draft (or a rejected course being re-submitted after edits)
 * into `pending` — locking it from further silent edits and putting it
 * in front of an admin (spec Section 7). Teachers can still technically
 * call updateCourse() while pending since ownership doesn't change, but
 * the Teacher Dashboard UI should treat a pending course as read-only
 * and surface "Withdraw" (→ unpublishCourse, back to draft) instead of
 * an edit form — that's a UI-layer decision, not a rules one.
 */
export async function submitForApproval(courseId) {
  const user = requireUser();
  const existing = await getCourseById(courseId);
  if (!existing) throw new Error("Course not found.");
  if (existing.instructorId !== user.uid) {
    throw new Error("You can only submit your own courses.");
  }
  await updateDoc(doc(db, COURSES_COLLECTION, courseId), {
    status: COURSE_STATUS.PENDING,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Teacher-initiated unpublish — pulls their own live course back to
 * draft (spec Section 13: "Teacher can unpublish their own course").
 * Distinct from adminCourseService's unpublish, which is the emergency
 * override on ANY course.
 */
export async function unpublishCourse(courseId) {
  const user = requireUser();
  const existing = await getCourseById(courseId);
  if (!existing) throw new Error("Course not found.");
  if (existing.instructorId !== user.uid) {
    throw new Error("You can only unpublish your own courses.");
  }
  await updateDoc(doc(db, COURSES_COLLECTION, courseId), {
    status: COURSE_STATUS.DRAFT,
    updatedAt: serverTimestamp(),
  });
}