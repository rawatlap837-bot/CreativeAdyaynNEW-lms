import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase/Firebase";

/* =========================================================
   COLLECTIONS
========================================================= */

const BATCHES_COLLECTION = "batches";
const ATTENDANCE_COLLECTION = "attendance";
const ENROLLMENTS_COLLECTION = "enrollments";
const STUDENTS_COLLECTION = "students";
const USERS_COLLECTION = "users";
const COURSES_COLLECTION = "courses";

const ALLOWED_MODES = ["online", "offline", "hybrid"];
const ALLOWED_STATUSES = ["active", "archived"];
const ALLOWED_ATTENDANCE = ["present", "absent", "late"];
const EDITABLE_FIELDS = ["name", "schedule", "mode"];

const WEEKDAY_INDEX = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

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

function batchFromDoc(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function attendanceFromDoc(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

function normalizeStudentIds(value) {
  return Array.isArray(value) ? [...value] : [];
}

function normalizeSchedule(schedule) {
  const days = Array.isArray(schedule?.days)
    ? schedule.days
      .map((day) => String(day || "").trim())
      .filter(Boolean)
    : [];

  return {
    days,
    time: String(schedule?.time || "").trim(),
  };
}

function getAttendanceDocId(batchId, date) {
  return `${batchId}_${date}`;
}

function isValidDateString(date) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(date || ""));
}

function assertMode(mode) {
  if (!ALLOWED_MODES.includes(mode)) {
    throw new Error("Mode must be online, offline, or hybrid.");
  }
}

function assertAttendanceRecords(records) {
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    throw new Error("Attendance records must be a map of student statuses.");
  }

  Object.entries(records).forEach(([studentUid, status]) => {
    if (!studentUid) {
      throw new Error("Attendance records include an invalid student id.");
    }

    if (!ALLOWED_ATTENDANCE.includes(status)) {
      throw new Error(
        "Attendance status must be present, absent, or late."
      );
    }
  });
}

function sortBatches(batches) {
  return [...batches].sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0;
    const bTime = b.createdAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
}

function sortAttendanceByDate(records) {
  return [...records].sort((a, b) =>
    String(a.date || "").localeCompare(String(b.date || ""))
  );
}

function weekdayIndex(day) {
  return WEEKDAY_INDEX[String(day || "").trim().toLowerCase()];
}

export function getNextScheduledSession(schedule) {
  const normalized = normalizeSchedule(schedule);

  if (!normalized.days.length) {
    return normalized.time || "Not scheduled";
  }

  const today = new Date();
  const todayIndex = today.getDay();

  let daysUntil = 7;
  let matchedDay = normalized.days[0];

  normalized.days.forEach((day) => {
    const index = weekdayIndex(day);

    if (index == null) {
      return;
    }

    const delta = (index - todayIndex + 7) % 7;
    const until = delta === 0 ? 0 : delta;

    if (until < daysUntil) {
      daysUntil = until;
      matchedDay = day;
    }
  });

  const timeLabel = normalized.time ? ` at ${normalized.time}` : "";

  if (daysUntil === 0) {
    return `Today${timeLabel}`;
  }

  if (daysUntil === 1) {
    return `Tomorrow${timeLabel}`;
  }

  return `${matchedDay}${timeLabel}`;
}

async function getStudentProfile(studentUid) {
  const studentRef = doc(db, STUDENTS_COLLECTION, studentUid);
  const studentSnapshot = await getDoc(studentRef);

  if (studentSnapshot.exists()) {
    const data = studentSnapshot.data();

    return {
      ...data,
      id: studentUid,
      uid: studentUid,
      name:
        data.name ||
        data.displayName ||
        data.fullName ||
        "",
      email: data.email || "",
    };
  }

  try {
    const userRef = doc(db, USERS_COLLECTION, studentUid);
    const userSnapshot = await getDoc(userRef);

    if (userSnapshot.exists()) {
      const data = userSnapshot.data();

      return {
        ...data,
        id: studentUid,
        uid: studentUid,
        name:
          data.displayName ||
          data.name ||
          data.fullName ||
          "",
        email: data.email || "",
      };
    }
  } catch {
    /*
      Teachers cannot read other users/{uid} docs.
      Fall through to a uid-only profile.
    */
  }

  return {
    id: studentUid,
    uid: studentUid,
    name: "",
    email: "",
  };
}

async function hydrateStudents(studentUids) {
  const uniqueIds = [...new Set(studentUids.filter(Boolean))];

  const profiles = await Promise.all(
    uniqueIds.map((uid) => getStudentProfile(uid))
  );

  return profiles;
}

/* =========================================================
   GET SINGLE BATCH
========================================================= */

export async function getBatch(batchId) {
  requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  const batchRef = doc(db, BATCHES_COLLECTION, batchId);
  const snapshot = await getDoc(batchRef);

  if (!snapshot.exists()) {
    return null;
  }

  return batchFromDoc(snapshot);
}

/* =========================================================
   1. CREATE BATCH
========================================================= */

export async function createBatch(
  courseId,
  teacherId,
  name,
  mode,
  schedule
) {
  const user = requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const ownerId = teacherId || user.uid;

  if (ownerId !== user.uid) {
    throw new Error("You can only create batches assigned to you.");
  }

  const trimmedName = String(name || "").trim();

  if (!trimmedName) {
    throw new Error("Batch name is required.");
  }

  assertMode(mode);

  const courseRef = doc(db, COURSES_COLLECTION, courseId);
  const courseSnapshot = await getDoc(courseRef);

  if (!courseSnapshot.exists()) {
    throw new Error("Course not found.");
  }

  const course = courseSnapshot.data();

  if (course.instructorId && course.instructorId !== ownerId) {
    throw new Error("You can only create batches for your own courses.");
  }

  const batchData = {
    name: trimmedName,
    courseId,
    teacherId: ownerId,
    mode,
    schedule: normalizeSchedule(schedule),
    studentIds: [],
    studentCount: 0,
    status: "active",
    createdAt: serverTimestamp(),
  };

  const batchRef = await addDoc(
    collection(db, BATCHES_COLLECTION),
    batchData
  );

  return {
    id: batchRef.id,
    ...batchData,
  };
}

/* =========================================================
   2. EDIT BATCH
========================================================= */

export async function editBatch(batchId, updates = {}) {
  requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  const payload = {};

  Object.keys(updates).forEach((key) => {
    if (EDITABLE_FIELDS.includes(key) && updates[key] !== undefined) {
      payload[key] = updates[key];
    }
  });

  if (payload.name !== undefined) {
    payload.name = String(payload.name || "").trim();

    if (!payload.name) {
      throw new Error("Batch name is required.");
    }
  }

  if (payload.mode !== undefined) {
    assertMode(payload.mode);
  }

  if (payload.schedule !== undefined) {
    payload.schedule = normalizeSchedule(payload.schedule);
  }

  if (Object.keys(payload).length === 0) {
    throw new Error("No valid batch updates were provided.");
  }

  const batchRef = doc(db, BATCHES_COLLECTION, batchId);
  const snapshot = await getDoc(batchRef);

  if (!snapshot.exists()) {
    throw new Error("Batch not found.");
  }

  await updateDoc(batchRef, payload);

  return {
    id: batchId,
    ...snapshot.data(),
    ...payload,
  };
}

/* =========================================================
   3. ARCHIVE BATCH
========================================================= */

export async function archiveBatch(batchId) {
  requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  const batchRef = doc(db, BATCHES_COLLECTION, batchId);
  const snapshot = await getDoc(batchRef);

  if (!snapshot.exists()) {
    throw new Error("Batch not found.");
  }

  await updateDoc(batchRef, {
    status: "archived",
  });

  return {
    id: batchId,
    ...snapshot.data(),
    status: "archived",
  };
}

/* =========================================================
   4. DELETE BATCH
========================================================= */

export async function deleteBatch(batchId) {
  requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  const attendance = await getAttendanceForBatch(batchId);

  if (attendance.length > 0) {
    throw new Error(
      "This batch has attendance history and cannot be deleted. Archive it instead."
    );
  }

  const batchRef = doc(db, BATCHES_COLLECTION, batchId);
  const snapshot = await getDoc(batchRef);

  if (!snapshot.exists()) {
    throw new Error("Batch not found.");
  }

  await deleteDoc(batchRef);

  return true;
}

/* =========================================================
   5. GET BATCHES FOR TEACHER
========================================================= */

export async function getBatchesForTeacher(teacherId) {
  const user = requireUser();
  const ownerId = teacherId || user.uid;

  if (!ownerId) {
    throw new Error("Teacher ID is required.");
  }

  /*
    One where() only. Sort on the client so Spark-plan
    composite indexes are not required.
  */

  const batchesQuery = query(
    collection(db, BATCHES_COLLECTION),
    where("teacherId", "==", ownerId)
  );

  const snapshot = await getDocs(batchesQuery);

  return sortBatches(
    snapshot.docs.map(batchFromDoc)
  );
}

/* =========================================================
   6. GET BATCHES FOR COURSE
========================================================= */

export async function getBatchesForCourse(courseId) {
  requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const batchesQuery = query(
    collection(db, BATCHES_COLLECTION),
    where("courseId", "==", courseId)
  );

  const snapshot = await getDocs(batchesQuery);

  return sortBatches(
    snapshot.docs.map(batchFromDoc)
  );
}

/* =========================================================
   7. GET ELIGIBLE STUDENTS
========================================================= */

export async function getEligibleStudents(courseId, batchId) {
  requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  const batch = await getBatch(batchId);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  if (batch.courseId !== courseId) {
    throw new Error("This batch does not belong to the selected course.");
  }

  const alreadyInBatch = new Set(
    normalizeStudentIds(batch.studentIds)
  );

  const enrollmentsQuery = query(
    collection(db, ENROLLMENTS_COLLECTION),
    where("courseId", "==", courseId)
  );

  const snapshot = await getDocs(enrollmentsQuery);

  const enrolledUids = snapshot.docs
    .map((enrollmentDoc) => {
      const data = enrollmentDoc.data();
      return data.uid || data.studentId || "";
    })
    .filter((uid) => uid && !alreadyInBatch.has(uid));

  const uniqueUids = [...new Set(enrolledUids)];

  return hydrateStudents(uniqueUids);
}

/* =========================================================
   8. ADD STUDENT TO BATCH
========================================================= */

export async function addStudentToBatch(batchId, studentUid) {
  requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  if (!studentUid) {
    throw new Error("Student ID is required.");
  }

  const batchRef = doc(db, BATCHES_COLLECTION, batchId);

  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(batchRef);

    if (!snapshot.exists()) {
      throw new Error("Batch not found.");
    }

    const data = snapshot.data();
    const studentIds = normalizeStudentIds(data.studentIds);
    const enrollmentRef = doc(
      db,
      ENROLLMENTS_COLLECTION,
      `${studentUid}_${data.courseId}`
    );
    const enrollmentSnapshot = await transaction.get(enrollmentRef);

    if (studentIds.includes(studentUid)) {
      throw new Error("This student is already in the batch.");
    }

    if (
      !enrollmentSnapshot.exists() ||
      enrollmentSnapshot.data().status !== "active" ||
      (enrollmentSnapshot.data().uid || enrollmentSnapshot.data().studentId) !==
      studentUid
    ) {
      throw new Error("Only actively enrolled students can join this batch.");
    }

    if (!ALLOWED_STATUSES.includes(data.status || "active")) {
      throw new Error("This batch cannot be updated.");
    }

    transaction.update(batchRef, {
      studentIds: arrayUnion(studentUid),
      studentCount: studentIds.length + 1,
    });

    return {
      id: batchId,
      ...data,
      studentIds: [...studentIds, studentUid],
      studentCount: studentIds.length + 1,
    };
  });

  return result;
}

/* =========================================================
   9. REMOVE STUDENT FROM BATCH
========================================================= */

export async function removeStudentFromBatch(batchId, studentUid) {
  requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  if (!studentUid) {
    throw new Error("Student ID is required.");
  }

  const batchRef = doc(db, BATCHES_COLLECTION, batchId);

  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(batchRef);

    if (!snapshot.exists()) {
      throw new Error("Batch not found.");
    }

    const data = snapshot.data();
    const studentIds = normalizeStudentIds(data.studentIds);

    if (!studentIds.includes(studentUid)) {
      throw new Error("This student is not in the batch.");
    }

    const nextCount = Math.max(0, studentIds.length - 1);

    transaction.update(batchRef, {
      studentIds: arrayRemove(studentUid),
      studentCount: nextCount,
    });

    return {
      id: batchId,
      ...data,
      studentIds: studentIds.filter((id) => id !== studentUid),
      studentCount: nextCount,
    };
  });

  return result;
}

/* =========================================================
   10. SHIFT STUDENT BETWEEN BATCHES
========================================================= */

export async function shiftStudentBatch(
  oldBatchId,
  newBatchId,
  studentUid
) {
  requireUser();

  if (!oldBatchId || !newBatchId) {
    throw new Error("Both batch IDs are required.");
  }

  if (oldBatchId === newBatchId) {
    throw new Error("Choose a different batch to shift the student.");
  }

  if (!studentUid) {
    throw new Error("Student ID is required.");
  }

  const oldBatchRef = doc(db, BATCHES_COLLECTION, oldBatchId);
  const newBatchRef = doc(db, BATCHES_COLLECTION, newBatchId);

  const result = await runTransaction(db, async (transaction) => {
    const oldSnapshot = await transaction.get(oldBatchRef);
    const newSnapshot = await transaction.get(newBatchRef);

    if (!oldSnapshot.exists()) {
      throw new Error("Current batch not found.");
    }

    if (!newSnapshot.exists()) {
      throw new Error("Destination batch not found.");
    }

    const oldData = oldSnapshot.data();
    const newData = newSnapshot.data();

    if (oldData.courseId !== newData.courseId) {
      throw new Error(
        "Students can only be shifted between batches of the same course."
      );
    }

    const oldIds = normalizeStudentIds(oldData.studentIds);
    const newIds = normalizeStudentIds(newData.studentIds);

    if (!oldIds.includes(studentUid)) {
      throw new Error("This student is not in the current batch.");
    }

    if (newIds.includes(studentUid)) {
      throw new Error("This student is already in the destination batch.");
    }

    if (oldData.status !== "active" || newData.status !== "active") {
      throw new Error("Students can only be shifted between active batches.");
    }

    transaction.update(oldBatchRef, {
      studentIds: arrayRemove(studentUid),
      studentCount: Math.max(0, oldIds.length - 1),
    });

    transaction.update(newBatchRef, {
      studentIds: arrayUnion(studentUid),
      studentCount: newIds.length + 1,
    });

    return {
      oldBatchId,
      newBatchId,
      studentUid,
    };
  });

  return result;
}

/* =========================================================
   11. MARK ATTENDANCE
========================================================= */

export async function markAttendance(
  batchId,
  date,
  teacherId,
  records
) {
  const user = requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  if (!isValidDateString(date)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }

  assertAttendanceRecords(records);

  const ownerId = teacherId || user.uid;

  const batch = await getBatch(batchId);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const attendanceId = getAttendanceDocId(batchId, date);
  const attendanceRef = doc(
    db,
    ATTENDANCE_COLLECTION,
    attendanceId
  );

  const attendanceData = {
    batchId,
    date,
    teacherId: ownerId,
    records,
    markedAt: serverTimestamp(),
  };

  await setDoc(attendanceRef, attendanceData);

  return {
    id: attendanceId,
    ...attendanceData,
  };
}

/* =========================================================
   12. GET ATTENDANCE FOR BATCH
========================================================= */

export async function getAttendanceForBatch(batchId) {
  const user = requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where("batchId", "==", batchId),
    where("teacherId", "==", user.uid)
  );

  const snapshot = await getDocs(attendanceQuery);

  return sortAttendanceByDate(
    snapshot.docs.map(attendanceFromDoc)
  );
}

/* =========================================================
   13. GET ATTENDANCE FOR DATE
========================================================= */

export async function getAttendanceForDate(batchId, date) {
  const user = requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  if (!isValidDateString(date)) {
    throw new Error("Date must be in YYYY-MM-DD format.");
  }

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where("batchId", "==", batchId),
    where("date", "==", date),
    where("teacherId", "==", user.uid)
  );

  const snapshot = await getDocs(attendanceQuery);

  return snapshot.empty
    ? null
    : attendanceFromDoc(snapshot.docs[0]);
}

/* =========================================================
   14. GET STUDENT ATTENDANCE STATS
========================================================= */

export async function getStudentAttendanceStats(
  batchId,
  studentUid
) {
  requireUser();

  if (!batchId) {
    throw new Error("Batch ID is required.");
  }

  if (!studentUid) {
    throw new Error("Student ID is required.");
  }

  const sessions = await getAttendanceForBatch(batchId);
  const total = sessions.length;

  let present = 0;
  let late = 0;
  let absent = 0;
  let unmarked = 0;

  sessions.forEach((session) => {
    const status = session.records?.[studentUid];

    if (status === "present") {
      present += 1;
    } else if (status === "late") {
      late += 1;
    } else if (status === "absent") {
      absent += 1;
    } else {
      unmarked += 1;
    }
  });

  const percentage =
    total > 0 ? Math.round((present / total) * 100) : 0;

  return {
    studentUid,
    batchId,
    total,
    present,
    late,
    absent,
    unmarked,
    percentage,
  };
}

export async function getBatchRoster(batchId) {
  const batch = await getBatch(batchId);

  if (!batch) {
    throw new Error("Batch not found.");
  }

  const students = await hydrateStudents(
    normalizeStudentIds(batch.studentIds)
  );

  return {
    batch,
    students,
  };
}

export default {
  createBatch,
  editBatch,
  archiveBatch,
  deleteBatch,
  getBatch,
  getBatchesForTeacher,
  getBatchesForCourse,
  getEligibleStudents,
  addStudentToBatch,
  removeStudentFromBatch,
  shiftStudentBatch,
  markAttendance,
  getAttendanceForBatch,
  getAttendanceForDate,
  getStudentAttendanceStats,
  getBatchRoster,
  getNextScheduledSession,
};
