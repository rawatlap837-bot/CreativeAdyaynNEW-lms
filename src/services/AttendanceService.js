import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/Firebase";

const ATTENDANCE_COLLECTION = "attendance";

/* --------------------------------------------------
   AUTH
-------------------------------------------------- */

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error(
      "You must be logged in to use attendance."
    );
  }

  return user;
}

/* --------------------------------------------------
   ATTENDANCE ID
-------------------------------------------------- */

function getAttendanceId(sessionId, studentId) {
  return `${sessionId}_${studentId}`;
}

/* --------------------------------------------------
   DATE SORTING
-------------------------------------------------- */

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
      timestampToMillis(b.markedAt) -
      timestampToMillis(a.markedAt)
  );
}

function sortOldestFirst(records) {
  return [...records].sort(
    (a, b) =>
      timestampToMillis(a.markedAt) -
      timestampToMillis(b.markedAt)
  );
}

/* --------------------------------------------------
   MARK ATTENDANCE
-------------------------------------------------- */

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
  if (studentId && studentId !== user.uid) {
    throw new Error(
      "You can only mark your own attendance."
    );
  }

  const currentStudentId = user.uid;

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  /*
   * Student attendance currently supports
   * present / late / absent.
   *
   * The Firestore rules should still control
   * which status the student is actually allowed
   * to create.
   */
  const allowedStatuses = [
    "present",
    "late",
    "absent",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new Error("Invalid attendance status.");
  }

  /*
   * Deterministic ID prevents duplicate attendance
   * for the same student and session.
   */
  const attendanceId = getAttendanceId(
    sessionId,
    currentStudentId
  );

  const attendanceRef = doc(
    db,
    ATTENDANCE_COLLECTION,
    attendanceId
  );

  /*
   * Check if attendance already exists.
   */
  const existingAttendance = await getDoc(
    attendanceRef
  );

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
    status,
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

/* --------------------------------------------------
   MY SESSION ATTENDANCE
-------------------------------------------------- */

export async function getMySessionAttendance(
  sessionId
) {
  const user = requireUser();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  const attendanceId = getAttendanceId(
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

/* --------------------------------------------------
   MY ATTENDANCE
-------------------------------------------------- */

export async function getMyAttendance() {
  const user = requireUser();

  /*
   * IMPORTANT:
   *
   * We intentionally do NOT use:
   *
   * orderBy("markedAt", "desc")
   *
   * together with where().
   *
   * That combination requires a composite Firestore
   * index.
   *
   * Instead, we sort the records locally.
   */

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where("studentId", "==", user.uid)
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

/* --------------------------------------------------
   COURSE ATTENDANCE
-------------------------------------------------- */

export async function getCourseAttendance(
  courseId
) {
  requireUser();

  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  /*
   * No orderBy here.
   * This avoids the composite index requirement.
   */

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where("courseId", "==", courseId)
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

/* --------------------------------------------------
   SESSION ATTENDANCE
-------------------------------------------------- */

export async function getSessionAttendance(
  sessionId
) {
  requireUser();

  if (!sessionId) {
    throw new Error("Session ID is required.");
  }

  /*
   * No orderBy here.
   */

  const attendanceQuery = query(
    collection(db, ATTENDANCE_COLLECTION),
    where("sessionId", "==", sessionId)
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

/* --------------------------------------------------
   ATTENDANCE PERCENTAGE
-------------------------------------------------- */

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
    (presentCount / totalSessions) * 100
  );
}