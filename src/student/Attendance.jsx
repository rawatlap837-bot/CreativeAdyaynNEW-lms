import { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  CalendarCheck2,
  BookOpen,
  RefreshCw,
  LockKeyhole,
} from "lucide-react";

import { auth, db } from "../firebase/Firebase";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";

import {
  getMySessionAttendance,
  markAttendance,
  getMyAttendance,
} from "../services/AttendanceService";


/* ============================================================
   DATE HELPERS
============================================================ */

function getTodayDate() {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}


/* ============================================================
   TIMESTAMP HELPERS
============================================================ */

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


/* ============================================================
   COMPONENT
============================================================ */

export default function Attendance() {
  const [user, setUser] = useState(null);

  const [courses, setCourses] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  /*
   * Stores the currently OPEN attendance session
   * for each course.
   *
   * Example:
   *
   * {
   *   courseId123: {
   *     id: "session123",
   *     courseId: "courseId123",
   *     teacherId: "...",
   *     title: "Today's Class",
   *     date: "2026-09-14",
   *     status: "open"
   *   }
   * }
   */
  const [openSessions, setOpenSessions] = useState({});

  /*
   * Stores whether the student has already marked
   * attendance for a particular open session.
   */
  const [markedSessions, setMarkedSessions] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [markingSessionId, setMarkingSessionId] =
    useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = useMemo(
    () => getTodayDate(),
    []
  );


  /* ============================================================
     AUTH
  ============================================================ */

  useEffect(() => {
    const unsubscribe =
      auth.onAuthStateChanged((currentUser) => {
        setUser(currentUser);
      });

    return () => unsubscribe();
  }, []);


  /* ============================================================
     LOAD DATA WHEN USER CHANGES
  ============================================================ */

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadAttendanceData();
  }, [user]);


  /* ============================================================
     LOAD ATTENDANCE DATA
  ============================================================ */

  async function loadAttendanceData(
    showRefreshLoader = false
  ) {
    try {
      if (showRefreshLoader) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setSuccess("");


      /* --------------------------------------------------------
         1. GET STUDENT ENROLLMENTS
      -------------------------------------------------------- */

      /*
       * Only query by uid.
       *
       * We intentionally do NOT do:
       *
       * where("uid", "==", user.uid)
       * where("status", "==", "active")
       *
       * because we don't need another composite index here.
       *
       * We filter active enrollments locally.
       */

      const enrollmentQuery = query(
        collection(db, "enrollments"),
        where("uid", "==", user.uid)
      );

      const enrollmentSnapshot =
        await getDocs(enrollmentQuery);

      const enrollments =
        enrollmentSnapshot.docs
          .map((enrollmentDoc) => ({
            id: enrollmentDoc.id,
            ...enrollmentDoc.data(),
          }))
          .filter(
            (enrollment) =>
              enrollment.status === "active"
          );


      /* --------------------------------------------------------
         2. LOAD COURSES
      -------------------------------------------------------- */

      const courseResults =
        await Promise.all(
          enrollments.map(
            async (enrollment) => {
              try {
                if (!enrollment.courseId) {
                  return null;
                }

                const courseRef = collection(
                  db,
                  "courses"
                );

                const courseQuery = query(
                  courseRef,
                  where(
                    "__name__",
                    "==",
                    enrollment.courseId
                  )
                );

                const courseSnapshot =
                  await getDocs(courseQuery);

                if (
                  courseSnapshot.empty
                ) {
                  return null;
                }

                const courseDoc =
                  courseSnapshot.docs[0];

                return {
                  id: courseDoc.id,
                  ...courseDoc.data(),
                  enrollmentId:
                    enrollment.id,
                };
              } catch (courseError) {
                console.error(
                  "Failed to load attendance course:",
                  courseError
                );

                return null;
              }
            }
          )
        );

      const validCourses =
        courseResults.filter(Boolean);

      setCourses(validCourses);


      /* --------------------------------------------------------
         3. LOAD MY ATTENDANCE HISTORY
      -------------------------------------------------------- */

      const records =
        await getMyAttendance();

      setAttendanceRecords(records);


      /* --------------------------------------------------------
         4. FIND OPEN SESSION FOR EACH COURSE
      -------------------------------------------------------- */

      /*
       * IMPORTANT:
       *
       * We query:
       *
       * courseId == X
       * status == "open"
       * date == today
       *
       * This matches the Firestore rules:
       *
       * Student can read an OPEN session for
       * a course they are enrolled in.
       *
       * We DO NOT create a fake session here.
       */

      const sessionResults =
        await Promise.all(
          validCourses.map(
            async (course) => {
              try {
                const sessionQuery =
                  query(
                    collection(
                      db,
                      "attendanceSessions"
                    ),
                    where(
                      "courseId",
                      "==",
                      course.id
                    ),
                    where(
                      "status",
                      "==",
                      "open"
                    ),
                    where(
                      "date",
                      "==",
                      today
                    )
                  );

                const sessionSnapshot =
                  await getDocs(
                    sessionQuery
                  );

                if (
                  sessionSnapshot.empty
                ) {
                  return {
                    courseId: course.id,
                    session: null,
                    attendance: null,
                  };
                }

                /*
                 * If multiple open sessions somehow
                 * exist, use the newest one.
                 */
                const sessions =
                  sessionSnapshot.docs
                    .map(
                      (sessionDoc) => ({
                        id: sessionDoc.id,
                        ...sessionDoc.data(),
                      })
                    )
                    .sort(
                      (a, b) =>
                        timestampToMillis(
                          b.createdAt
                        ) -
                        timestampToMillis(
                          a.createdAt
                        )
                    );

                const session =
                  sessions[0];

                /*
                 * Check whether THIS student
                 * already marked this session.
                 */
                const attendance =
                  await getMySessionAttendance(
                    session.id
                  );

                return {
                  courseId: course.id,
                  session,
                  attendance,
                };
              } catch (sessionError) {
                console.error(
                  `Failed to load open attendance session for ${course.title}:`,
                  sessionError
                );

                return {
                  courseId: course.id,
                  session: null,
                  attendance: null,
                  error: sessionError,
                };
              }
            }
          )
        );


      /* --------------------------------------------------------
         5. BUILD SESSION MAP
      -------------------------------------------------------- */

      const sessionMap = {};
      const markedMap = {};

      sessionResults.forEach(
        (item) => {
          sessionMap[item.courseId] =
            item.session;

          markedMap[item.courseId] =
            item.attendance;
        }
      );

      setOpenSessions(sessionMap);
      setMarkedSessions(markedMap);


    } catch (err) {
      console.error(
        "Failed to load attendance:",
        err
      );

      if (
        err?.code ===
        "permission-denied"
      ) {
        setError(
          "You don't have permission to access attendance."
        );
      } else {
        setError(
          err?.message ||
            "Failed to load attendance."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }


  /* ============================================================
     REFRESH
  ============================================================ */

  async function handleRefresh() {
    if (!user) return;

    await loadAttendanceData(true);
  }


  /* ============================================================
     MARK ATTENDANCE
  ============================================================ */

  async function handleMarkAttendance(
    course,
    session
  ) {
    if (!user) {
      setError(
        "Please log in first."
      );
      return;
    }

    if (!session) {
      setError(
        "There is no active attendance session for this course."
      );
      return;
    }

    try {
      setMarkingSessionId(
        session.id
      );

      setError("");
      setSuccess("");


      /* --------------------------------------------------------
         CHECK IF ALREADY MARKED
      -------------------------------------------------------- */

      const existing =
        markedSessions[course.id];

      if (existing) {
        setError(
          "Your attendance has already been marked for this class."
        );
        return;
      }


      /* --------------------------------------------------------
         MARK PRESENT
      -------------------------------------------------------- */

      const result =
        await markAttendance({
          sessionId: session.id,
          courseId: course.id,
          studentId: user.uid,
          status: "present",
        });


      /* --------------------------------------------------------
         UPDATE UI
      -------------------------------------------------------- */

      setMarkedSessions(
        (previous) => ({
          ...previous,
          [course.id]: result,
        })
      );

      setAttendanceRecords(
        (previous) => [
          result,
          ...previous,
        ]
      );

      setSuccess(
        `Attendance marked successfully for ${course.title}.`
      );


    } catch (err) {
      console.error(
        "Failed to mark attendance:",
        err
      );

      if (
        err?.code ===
        "permission-denied"
      ) {
        setError(
          "Attendance permission was denied. Please make sure the attendance session is open."
        );
      } else {
        setError(
          err?.message ||
            "Failed to mark attendance."
        );
      }
    } finally {
      setMarkingSessionId(null);
    }
  }


  /* ============================================================
     ATTENDANCE STATISTICS
  ============================================================ */

  const totalAttendance =
    attendanceRecords.length;

  const presentCount =
    attendanceRecords.filter(
      (record) =>
        record.status === "present"
    ).length;

  const lateCount =
    attendanceRecords.filter(
      (record) =>
        record.status === "late"
    ).length;

  const absentCount =
    attendanceRecords.filter(
      (record) =>
        record.status === "absent"
    ).length;

  /*
   * For the student dashboard we show:
   *
   * present + late
   * ----------------
   * recorded attendance
   *
   * IMPORTANT:
   *
   * This is the percentage of recorded attendance
   * records.
   *
   * Later, when we expose historical attendance
   * sessions to students, this can become:
   *
   * attended sessions / total sessions
   */

  const attendancePercentage =
    totalAttendance > 0
      ? Math.round(
          ((presentCount +
            lateCount) /
            totalAttendance) *
            100
        )
      : 0;


  /* ============================================================
     LOADING
  ============================================================ */

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            Loading attendance...
          </span>
        </div>
      </div>
    );
  }


  /* ============================================================
     NOT LOGGED IN
  ============================================================ */

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">

          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-red-500" />

          <h2 className="text-xl font-semibold text-gray-900">
            Please log in
          </h2>

          <p className="mt-2 text-gray-600">
            You need to be logged in to
            view attendance.
          </p>

        </div>
      </div>
    );
  }


  /* ============================================================
     UI
  ============================================================ */

  return (
    <div className="min-h-[70vh] bg-gray-50 px-4 py-6 sm:px-6 md:py-8 lg:px-8">

      <div className="mx-auto max-w-6xl">


        {/* ======================================================
            HEADER
        ====================================================== */}

        <div className="mb-6 sm:mb-8">

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <CalendarCheck2 className="h-6 w-6 text-violet-700" />
              </div>

              <div>

                <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
                  My Attendance
                </h1>

                <p className="text-sm text-gray-500">
                  Track your class attendance
                </p>

              </div>

            </div>


            {/* REFRESH */}

            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >

              <RefreshCw
                className={`h-4 w-4 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              {refreshing
                ? "Refreshing..."
                : "Refresh"}

            </button>

          </div>

        </div>


        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">

            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

            <p className="text-sm">
              {error}
            </p>

          </div>
        )}


        {/* ======================================================
            SUCCESS
        ====================================================== */}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">

            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

            <p className="text-sm">
              {success}
            </p>

          </div>
        )}


        {/* ======================================================
            TODAY'S ATTENDANCE
        ====================================================== */}

        <section className="mb-8">

          <div className="mb-4 flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold text-gray-900">
                Today's Attendance
              </h2>

              <p className="text-sm text-gray-500">
                {formatDate(today)}
              </p>

            </div>

            <Clock3 className="h-5 w-5 text-gray-400" />

          </div>


          {/* NO COURSES */}

          {courses.length === 0 ? (

            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">

              <BookOpen className="mx-auto mb-3 h-10 w-10 text-gray-400" />

              <h3 className="font-semibold text-gray-900">
                No enrolled courses
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Enroll in a course to
                view your attendance.
              </p>

            </div>

          ) : (

            <div className="grid gap-4 md:grid-cols-2">

              {courses.map(
                (course) => {

                  const session =
                    openSessions[
                      course.id
                    ];

                  const attendance =
                    markedSessions[
                      course.id
                    ];

                  const isMarked =
                    Boolean(
                      attendance
                    );

                  const isMarking =
                    markingSessionId ===
                    session?.id;


                  return (
                    <div
                      key={course.id}
                      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
                    >

                      {/* COURSE HEADER */}

                      <div className="flex items-start gap-3 sm:gap-4">

                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 sm:h-12 sm:w-12">

                          <BookOpen className="h-5 w-5 text-violet-700 sm:h-6 sm:w-6" />

                        </div>


                        <div className="min-w-0 flex-1">

                          <h3 className="break-words font-semibold text-gray-900">
                            {course.title}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            {session
                              ? session.title ||
                                "Today's class"
                              : "Today's attendance"}
                          </p>

                        </div>

                      </div>


                      {/* =================================================
                          OPEN SESSION
                      ================================================= */}

                      {session ? (

                        <div className="mt-5">

                          {/* SESSION OPEN BADGE */}

                          <div className="mb-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">

                            <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />

                            <span className="text-sm font-medium text-green-700">
                              Attendance is open
                            </span>

                          </div>


                          {/* ALREADY MARKED */}

                          {isMarked ? (

                            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">

                              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />

                              <div>

                                <p className="font-medium text-green-700">
                                  Attendance Marked
                                </p>

                                <p className="text-xs text-green-600">
                                  You are marked
                                  present for
                                  today's class.
                                </p>

                              </div>

                            </div>

                          ) : (

                            /* MARK BUTTON */

                            <button
                              type="button"
                              onClick={() =>
                                handleMarkAttendance(
                                  course,
                                  session
                                )
                              }
                              disabled={
                                isMarking
                              }
                              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 font-medium text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >

                              {isMarking ? (
                                <>
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                  Marking...
                                </>
                              ) : (
                                <>
                                  <CalendarCheck2 className="h-5 w-5" />
                                  Mark Attendance
                                </>
                              )}

                            </button>

                          )}

                        </div>

                      ) : (

                        /* =================================================
                           NO OPEN SESSION
                        ================================================= */

                        <div className="mt-5 flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">

                          <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />

                          <div>

                            <p className="font-medium text-gray-700">
                              Attendance not open
                            </p>

                            <p className="mt-0.5 text-xs leading-5 text-gray-500">
                              Your teacher has not
                              opened today's
                              attendance session yet.
                            </p>

                          </div>

                        </div>

                      )}

                    </div>
                  );
                }
              )}

            </div>

          )}

        </section>


        {/* ======================================================
            SUMMARY
        ====================================================== */}

        <section>

          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Attendance Summary
          </h2>


          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">


            {/* TOTAL RECORDED */}

            <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">

              <p className="text-xs text-gray-500 sm:text-sm">
                Classes Marked
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {totalAttendance}
              </p>

            </div>


            {/* PRESENT */}

            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 sm:p-5">

              <p className="text-xs text-green-700 sm:text-sm">
                Present
              </p>

              <p className="mt-2 text-2xl font-bold text-green-700">
                {presentCount}
              </p>

            </div>


            {/* LATE */}

            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 sm:p-5">

              <p className="text-xs text-yellow-700 sm:text-sm">
                Late
              </p>

              <p className="mt-2 text-2xl font-bold text-yellow-700">
                {lateCount}
              </p>

            </div>


            {/* PERCENTAGE */}

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 sm:p-5">

              <p className="text-xs text-violet-700 sm:text-sm">
                Attendance
              </p>

              <p className="mt-2 text-2xl font-bold text-violet-700">
                {attendancePercentage}%
              </p>

            </div>

          </div>

        </section>

      </div>

    </div>
  );
}