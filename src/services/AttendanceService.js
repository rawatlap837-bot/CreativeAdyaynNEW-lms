import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/Firebase";

const ATTENDANCE_COLLECTION = "attendance";
const ATTENDANCE_SESSIONS_COLLECTION = "attendanceSessions";

/* ==================================================
   AUTH
================================================== */

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be logged in to use attendance."
    );
  }

  return user;
}

/* ==================================================
   ATTENDANCE ID
================================================== */

function getAttendanceId(sessionId, studentId) {
  return `${sessionId}_${studentId}`;
}

/* ==================================================
   TIMESTAMP HELPERS
================================================== */

function timestampToMillis(timestamp) {
  if (!timestamp) return 0;

  if (typeof timestamp.toMillis === "function") {
    return timestamp.toMillis();
  }

  if (timestamp.seconds) {
    return timestamp.seconds * 1000;
  }

  if (timestamp instanceof Date) {
    return timestamp.getTime();
  }

  return 0;
}

function sortNewestFirst(records) {
  return [...records].sort(
    (a, b) =>
      getRecordTime(b) - getRecordTime(a)
  );
}

function sortOldestFirst(records) {
  return [...records].sort(
    (a, b) =>
      getRecordTime(a) - getRecordTime(b)
  );
}

function getRecordTime(record) {
  return (
    timestampToMillis(record.markedAt) ||
    timestampToMillis(record.createdAt) ||
    timestampToMillis(record.updatedAt) ||
    timestampToMillis(record.date)
  );
}

/* ==================================================
   DATE HELPERS
================================================== */

function getTodayDate() {
  return new Date()
    .toISOString()
    .split("T")[0];
}

/* ==================================================
   CREATE ATTENDANCE SESSION
================================================== */

/**
 * Teacher/Admin creates an attendance session.
 *
 * Example:
 *
 * {
 *   courseId: "course123",
 *   teacherId: "teacher123",
 *   title: "Full Stack Development - Class",
 *   date: "2026-09-14"
 * }
 *
 * Session starts as "open".
 */
export async function createAttendanceSession({
  courseId,
  teacherId,
  title = "Class Attendance",
  date = getTodayDate(),
}) {
  const user = requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  if (!date) {
    throw new Error("Attendance date is required.");
  }

  const currentTeacherId =
    teacherId || user.uid;

  const sessionRef = doc(
    collection(
      db,
      ATTENDANCE_SESSIONS_COLLECTION
    )
  );

  const sessionData = {
    courseId,
    teacherId: currentTeacherId,
    title,
    date,
    status: "open",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(sessionRef, sessionData);

  return {
    id: sessionRef.id,
    ...sessionData,
  };
}

/* ==================================================
   GET ATTENDANCE SESSION
================================================== */

export async function getAttendanceSession(
  sessionId
) {
  requireUser();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  const sessionRef = doc(
    db,
    ATTENDANCE_SESSIONS_COLLECTION,
    sessionId
  );

  const snapshot = await getDoc(sessionRef);

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/* ==================================================
   GET COURSE ATTENDANCE SESSIONS
================================================== */

export async function getCourseAttendanceSessions(
  courseId
) {
  requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  /*
   * We intentionally only query by courseId.
   *
   * We do NOT use:
   *
   * where("courseId", "==", courseId)
   * orderBy("date", "desc")
   *
   * because that can require a composite index.
   *
   * Sorting happens locally.
   */

  const sessionsQuery = query(
    collection(
      db,
      ATTENDANCE_SESSIONS_COLLECTION
    ),
    where("courseId", "==", courseId)
  );

  const snapshot = await getDocs(
    sessionsQuery
  );

  const sessions = snapshot.docs.map(
    (sessionDoc) => ({
      id: sessionDoc.id,
      ...sessionDoc.data(),
    })
  );

  return sessions.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";

    if (dateA !== dateB) {
      return dateB.localeCompare(dateA);
    }

    return (
      timestampToMillis(b.createdAt) -
      timestampToMillis(a.createdAt)
    );
  });
}

/* ==================================================
   GET OPEN SESSION FOR COURSE
================================================== */

/**
 * Returns the currently open session for a course.
 *
 * We fetch course sessions and filter locally
 * to avoid requiring another composite index.
 */
export async function getOpenAttendanceSession(
  courseId
) {
  requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  const sessions =
    await getCourseAttendanceSessions(
      courseId
    );

  const openSessions = sessions.filter(
    (session) =>
      session.status === "open"
  );

  if (openSessions.length === 0) {
    return null;
  }

  /*
   * Return the newest open session.
   */
  return openSessions[0];
}

/* ==================================================
   CLOSE ATTENDANCE SESSION
================================================== */

export async function closeAttendanceSession(
  sessionId
) {
  requireUser();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  const sessionRef = doc(
    db,
    ATTENDANCE_SESSIONS_COLLECTION,
    sessionId
  );

  const sessionSnapshot =
    await getDoc(sessionRef);

  if (!sessionSnapshot.exists()) {
    throw new Error(
      "Attendance session not found."
    );
  }

  await updateDoc(sessionRef, {
    status: "closed",
    updatedAt: serverTimestamp(),
  });

  return {
    id: sessionId,
    status: "closed",
  };
}

/* ==================================================
   REOPEN ATTENDANCE SESSION
================================================== */

/**
 * Useful for teacher/admin corrections.
 */
export async function reopenAttendanceSession(
  sessionId
) {
  requireUser();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  const sessionRef = doc(
    db,
    ATTENDANCE_SESSIONS_COLLECTION,
    sessionId
  );

  const sessionSnapshot =
    await getDoc(sessionRef);

  if (!sessionSnapshot.exists()) {
    throw new Error(
      "Attendance session not found."
    );
  }

  await updateDoc(sessionRef, {
    status: "open",
    updatedAt: serverTimestamp(),
  });

  return {
    id: sessionId,
    status: "open",
  };
}

/* ==================================================
   DELETE ATTENDANCE SESSION
================================================== */

/**
 * Admin/teacher can use this later according
 * to Firestore security rules.
 *
 * IMPORTANT:
 * Deleting a session does NOT automatically
 * delete attendance records belonging to it.
 *
 * That should be handled carefully at the
 * admin level.
 */
export async function deleteAttendanceSession(
  sessionId
) {
  requireUser();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  const sessionRef = doc(
    db,
    ATTENDANCE_SESSIONS_COLLECTION,
    sessionId
  );

  const snapshot = await getDoc(sessionRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Attendance session not found."
    );
  }

  await deleteDoc(sessionRef);

  return true;
}

/* ==================================================
   MARK ATTENDANCE
================================================== */

export async function markAttendance({
  sessionId,
  courseId,
  studentId,
  status = "present",
}) {
  const user = requireUser();

  /*
   * Students can only mark their own attendance.
   */
  if (
    studentId &&
    studentId !== user.uid
  ) {
    throw new Error(
      "You can only mark your own attendance."
    );
  }

  const currentStudentId = user.uid;

  if (!sessionId) {
    throw new Error(
      "Session ID is required."
    );
  }

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  /*
   * Students should only create their own
   * "present" attendance record.
   *
   * Teacher/Admin correction should happen
   * through a separate function.
   */
  if (status !== "present") {
    throw new Error(
      "Students can only mark themselves present."
    );
  }

  /*
   * Make sure the session exists.
   */
  const sessionRef = doc(
    db,
    ATTENDANCE_SESSIONS_COLLECTION,
    sessionId
  );

  const sessionSnapshot =
    await getDoc(sessionRef);

  if (!sessionSnapshot.exists()) {
    throw new Error(
      "Attendance session not found."
    );
  }

  const sessionData =
    sessionSnapshot.data();

  /*
   * The session must be open.
   */
  if (sessionData.status !== "open") {
    throw new Error(
      "Attendance is currently closed."
    );
  }

  /*
   * Prevent marking attendance against
   * the wrong course.
   */
  if (sessionData.courseId !== courseId) {
    throw new Error(
      "This attendance session does not belong to this course."
    );
  }

  /*
   * Deterministic ID prevents duplicate
   * attendance for the same student/session.
   */
  const attendanceId =
    getAttendanceId(
      sessionId,
      currentStudentId
    );

  const attendanceRef = doc(
    db,
    ATTENDANCE_COLLECTION,
    attendanceId
  );

  /*
   * Check if already marked.
   */
  const existingAttendance =
    await getDoc(attendanceRef);

  if (existingAttendance.exists()) {
    return {
      id: existingAttendance.id,
      ...existingAttendance.data(),
      alreadyMarked: true,
    };
  }

  const attendanceData = {
    sessionId,
    courseId,
    studentId: currentStudentId,
    status: "present",
    markedAt: serverTimestamp(),
    markedBy: currentStudentId,
  };

  await setDoc(
    attendanceRef,
    attendanceData
  );

  return {
    id: attendanceId,
    ...attendanceData,
    alreadyMarked: false,
  };
}

/* ==================================================
   GET MY SESSION ATTENDANCE
================================================== */

export async function getMySessionAttendance(
  sessionId
) {
  const user = requireUser();

  if (!sessionId) {
    throw new Error(
      "Session ID is required."
    );
  }

  const attendanceId =
    getAttendanceId(
      sessionId,
      user.uid
    );

  const attendanceRef = doc(
    db,
    ATTENDANCE_COLLECTION,
    attendanceId
  );

  const snapshot = await getDoc(
    attendanceRef
  );

  if (!snapshot.exists()) {
    return null;
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  };
}

/* ==================================================
   GET MY ATTENDANCE
================================================== */

export async function getMyAttendance() {
  const user = requireUser();

  /*
   * No orderBy here.
   * We sort locally to avoid composite indexes.
   */

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where(
      "studentId",
      "==",
      user.uid
    )
  );

  const snapshot = await getDocs(
    attendanceQuery
  );

  const records = snapshot.docs.map(
    (attendanceDoc) => ({
      id: attendanceDoc.id,
      ...attendanceDoc.data(),
    })
  );

  return sortNewestFirst(records);
}

/* ==================================================
   GET COURSE ATTENDANCE
================================================== */

export async function getCourseAttendance(
  courseId
) {
  requireUser();

  if (!courseId) {
    throw new Error(
      "Course ID is required."
    );
  }

  /*
   * No orderBy.
   */
  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where(
      "courseId",
      "==",
      courseId
    )
  );

  const snapshot = await getDocs(
    attendanceQuery
  );

  const records = snapshot.docs.map(
    (attendanceDoc) => ({
      id: attendanceDoc.id,
      ...attendanceDoc.data(),
    })
  );

  return sortNewestFirst(records);
}

/* ==================================================
   GET SESSION ATTENDANCE
================================================== */

export async function getSessionAttendance(
  sessionId
) {
  requireUser();

  if (!sessionId) {
    throw new Error(
      "Session ID is required."
    );
  }

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where(
      "sessionId",
      "==",
      sessionId
    )
  );

  const snapshot = await getDocs(
    attendanceQuery
  );

  const records = snapshot.docs.map(
    (attendanceDoc) => ({
      id: attendanceDoc.id,
      ...attendanceDoc.data(),
    })
  );

  return sortOldestFirst(records);
}

/* ==================================================
   UPDATE ATTENDANCE
================================================== */

/**
 * Used later by Teacher/Admin.
 *
 * Example:
 *
 * updateAttendance("session_student", "absent")
 */
export async function updateAttendance(
  attendanceId,
  status
) {
  requireUser();

  if (!attendanceId) {
    throw new Error(
      "Attendance ID is required."
    );
  }

  const allowedStatuses = [
    "present",
    "late",
    "absent",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error(
      "Invalid attendance status."
    );
  }

  const attendanceRef = doc(
    db,
    ATTENDANCE_COLLECTION,
    attendanceId
  );

  const snapshot =
    await getDoc(attendanceRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Attendance record not found."
    );
  }

  await updateDoc(attendanceRef, {
    status,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser.uid,
  });

  return {
    id: attendanceId,
    status,
  };
}

/* ==================================================
   DELETE ATTENDANCE
================================================== */

export async function deleteAttendance(
  attendanceId
) {
  requireUser();

  if (!attendanceId) {
    throw new Error(
      "Attendance ID is required."
    );
  }

  const attendanceRef = doc(
    db,
    ATTENDANCE_COLLECTION,
    attendanceId
  );

  const snapshot =
    await getDoc(attendanceRef);

  if (!snapshot.exists()) {
    throw new Error(
      "Attendance record not found."
    );
  }

  await deleteDoc(attendanceRef);

  return true;
}

/* ==================================================
   ATTENDANCE STATISTICS
================================================== */

/**
 * Calculate attendance percentage.
 *
 * Present = present
 * Late = counted separately
 * Absent = absent
 *
 * By default, percentage is:
 *
 * present / total sessions
 */
export function calculateAttendancePercentage(
  attendanceRecords = [],
  totalSessions = 0
) {
  if (
    !totalSessions ||
    totalSessions <= 0
  ) {
    return 0;
  }

  const presentCount =
    attendanceRecords.filter(
      (record) =>
        record.status === "present"
    ).length;

  return Math.round(
    (presentCount / totalSessions) *
      100
  );
}

/* ==================================================
   ATTENDANCE SUMMARY
================================================== */

/**
 * Returns complete attendance statistics.
 *
 * Example:
 *
 * {
 *   total: 30,
 *   present: 26,
 *   late: 2,
 *   absent: 2,
 *   percentage: 87
 * }
 */
export function getAttendanceSummary(
  attendanceRecords = [],
  totalSessions = null
) {
  const present =
    attendanceRecords.filter(
      (record) =>
        record.status === "present"
    ).length;

  const late =
    attendanceRecords.filter(
      (record) =>
        record.status === "late"
    ).length;

  const absent =
    attendanceRecords.filter(
      (record) =>
        record.status === "absent"
    ).length;

  /*
   * If totalSessions is not supplied,
   * use attendance records count.
   *
   * Later the Admin dashboard should pass
   * the actual number of sessions.
   */
  const total =
    totalSessions !== null
      ? totalSessions
      : attendanceRecords.length;

  const percentage =
    total > 0
      ? Math.round(
          (present / total) * 100
        )
      : 0;

  return {
    total,
    present,
    late,
    absent,
    percentage,
  };
}

/* ==================================================
   DEFAULT EXPORT
================================================== */

export default {
  createAttendanceSession,
  getAttendanceSession,
  getCourseAttendanceSessions,
  getOpenAttendanceSession,
  closeAttendanceSession,
  reopenAttendanceSession,
  deleteAttendanceSession,

  markAttendance,
  getMySessionAttendance,
  getMyAttendance,
  getCourseAttendance,
  getSessionAttendance,

  updateAttendance,
  deleteAttendance,

  calculateAttendancePercentage,
  getAttendanceSummary,
};