import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  CalendarCheck2,
  BookOpen,
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


export default function Attendance() {
  const [user, setUser] = useState(null);

  const [courses, setCourses] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [markedSessions, setMarkedSessions] = useState({});

  const [loading, setLoading] = useState(true);
  const [markingCourseId, setMarkingCourseId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const today = useMemo(() => getTodayDate(), []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);


  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    loadAttendanceData();
  }, [user]);


  async function loadAttendanceData() {
    try {
      setLoading(true);
      setError("");

      // -------------------------------------------------------
      // Get student's enrollments
      // -------------------------------------------------------

      const enrollmentQuery = query(
        collection(db, "enrollments"),
        where("uid", "==", user.uid),
        where("status", "==", "active")
      );

      const enrollmentSnapshot = await getDocs(enrollmentQuery);

      const enrollments = enrollmentSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));


      // -------------------------------------------------------
      // Load the corresponding courses
      // -------------------------------------------------------

      const courseResults = await Promise.all(
        enrollments.map(async (enrollment) => {
          try {
            const courseRef = collection(db, "courses");

            const courseQuery = query(
              courseRef,
              where("__name__", "==", enrollment.courseId)
            );

            const courseSnapshot = await getDocs(courseQuery);

            if (courseSnapshot.empty) {
              return null;
            }

            const courseDoc = courseSnapshot.docs[0];

            return {
              id: courseDoc.id,
              ...courseDoc.data(),
              enrollmentId: enrollment.id,
            };
          } catch (courseError) {
            console.error(
              "Failed to load attendance course:",
              courseError
            );

            return null;
          }
        })
      );

      const validCourses = courseResults.filter(Boolean);

      setCourses(validCourses);


      // -------------------------------------------------------
      // Load student's attendance
      // -------------------------------------------------------

      const records = await getMyAttendance();

      setAttendanceRecords(records);


      // -------------------------------------------------------
      // Check today's attendance for each course
      // -------------------------------------------------------

      const sessionResults = await Promise.all(
        validCourses.map(async (course) => {
          const sessionId = `${course.id}_${today}`;

          try {
            const attendance =
              await getMySessionAttendance(sessionId);

            return {
              courseId: course.id,
              attendance,
            };
          } catch (sessionError) {
            console.error(
              "Failed to check session attendance:",
              sessionError
            );

            return {
              courseId: course.id,
              attendance: null,
            };
          }
        })
      );


      const sessionMap = {};

      sessionResults.forEach((item) => {
        sessionMap[item.courseId] = item.attendance;
      });

      setMarkedSessions(sessionMap);

    } catch (err) {
      console.error("Failed to load attendance:", err);

      if (err?.code === "permission-denied") {
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
    }
  }


  async function handleMarkAttendance(course) {
    if (!user) {
      setError("Please log in first.");
      return;
    }

    const sessionId = `${course.id}_${today}`;

    try {
      setMarkingCourseId(course.id);
      setError("");
      setSuccess("");

      const existing =
        markedSessions[course.id];

      if (existing) {
        setError(
          "Your attendance has already been marked for today's class."
        );
        return;
      }

      const result = await markAttendance({
        sessionId,
        courseId: course.id,
        studentId: user.uid,
        status: "present",
      });

      setMarkedSessions((previous) => ({
        ...previous,
        [course.id]: result,
      }));

      setAttendanceRecords((previous) => [
        ...previous,
        result,
      ]);

      setSuccess(
        `Attendance marked successfully for ${course.title}.`
      );

    } catch (err) {
      console.error(
        "Failed to mark attendance:",
        err
      );

      if (err?.code === "permission-denied") {
        setError(
          "Attendance permission was denied. Please check your Firebase rules."
        );
      } else {
        setError(
          err?.message ||
            "Failed to mark attendance."
        );
      }
    } finally {
      setMarkingCourseId(null);
    }
  }


  // ---------------------------------------------------------
  // Attendance statistics
  // ---------------------------------------------------------

  const totalAttendance = attendanceRecords.length;

  const presentCount = attendanceRecords.filter(
    (record) => record.status === "present"
  ).length;

  const lateCount = attendanceRecords.filter(
    (record) => record.status === "late"
  ).length;

  const absentCount = attendanceRecords.filter(
    (record) => record.status === "absent"
  ).length;

  const attendancePercentage =
    totalAttendance > 0
      ? Math.round(
          ((presentCount + lateCount) /
            totalAttendance) *
            100
        )
      : 0;


  // ---------------------------------------------------------
  // Loading
  // ---------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading attendance...</span>
        </div>
      </div>
    );
  }


  // ---------------------------------------------------------
  // Not logged in
  // ---------------------------------------------------------

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-500" />

          <h2 className="text-xl font-semibold text-gray-900">
            Please log in
          </h2>

          <p className="mt-2 text-gray-600">
            You need to be logged in to view attendance.
          </p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8 md:px-6 lg:px-8">

      <div className="max-w-6xl mx-auto">

        {/* ===================================================
            HEADER
        =================================================== */}

        <div className="mb-8">

          <div className="flex items-center gap-3 mb-2">

            <div className="w-11 h-11 rounded-xl bg-violet-100 flex items-center justify-center">
              <CalendarCheck2 className="w-6 h-6 text-violet-700" />
            </div>

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                My Attendance
              </h1>

              <p className="text-sm text-gray-500">
                Track your class attendance
              </p>
            </div>

          </div>

        </div>


        {/* ===================================================
            MESSAGES
        =================================================== */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">

            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />

            <p className="text-sm">
              {error}
            </p>

          </div>
        )}


        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-700">

            <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" />

            <p className="text-sm">
              {success}
            </p>

          </div>
        )}


        {/* ===================================================
            TODAY
        =================================================== */}

        <section className="mb-8">

          <div className="flex items-center justify-between mb-4">

            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Today's Attendance
              </h2>

              <p className="text-sm text-gray-500">
                {formatDate(today)}
              </p>
            </div>

            <Clock3 className="w-5 h-5 text-gray-400" />

          </div>


          {courses.length === 0 ? (

            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center">

              <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-400" />

              <h3 className="font-semibold text-gray-900">
                No enrolled courses
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Enroll in a course to mark attendance.
              </p>

            </div>

          ) : (

            <div className="grid gap-4 md:grid-cols-2">

              {courses.map((course) => {

                const attendance =
                  markedSessions[course.id];

                const isMarked =
                  Boolean(attendance);

                const isMarking =
                  markingCourseId === course.id;


                return (
                  <div
                    key={course.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                  >

                    <div className="flex items-start gap-4">

                      <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">

                        <BookOpen className="w-6 h-6 text-violet-700" />

                      </div>


                      <div className="min-w-0 flex-1">

                        <h3 className="font-semibold text-gray-900">
                          {course.title}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          Today's attendance
                        </p>

                      </div>

                    </div>


                    <div className="mt-5">

                      {isMarked ? (

                        <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 px-4 py-3">

                          <CheckCircle2 className="w-5 h-5 text-green-600" />

                          <div>

                            <p className="font-medium text-green-700">
                              Attendance Marked
                            </p>

                            <p className="text-xs text-green-600">
                              You are marked present today.
                            </p>

                          </div>

                        </div>

                      ) : (

                        <button
                          type="button"
                          onClick={() =>
                            handleMarkAttendance(course)
                          }
                          disabled={isMarking}
                          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-700 px-4 py-3 font-medium text-white transition hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                        >

                          {isMarking ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Marking...
                            </>
                          ) : (
                            <>
                              <CalendarCheck2 className="w-5 h-5" />
                              Mark Attendance
                            </>
                          )}

                        </button>

                      )}

                    </div>

                  </div>
                );
              })}

            </div>

          )}

        </section>


        {/* ===================================================
            SUMMARY
        =================================================== */}

        <section>

          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Attendance Summary
          </h2>


          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Total */}

            <div className="rounded-2xl border border-gray-200 bg-white p-5">

              <p className="text-sm text-gray-500">
                Total Classes
              </p>

              <p className="mt-2 text-2xl font-bold text-gray-900">
                {totalAttendance}
              </p>

            </div>


            {/* Present */}

            <div className="rounded-2xl border border-green-200 bg-green-50 p-5">

              <p className="text-sm text-green-700">
                Present
              </p>

              <p className="mt-2 text-2xl font-bold text-green-700">
                {presentCount}
              </p>

            </div>


            {/* Late */}

            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5">

              <p className="text-sm text-yellow-700">
                Late
              </p>

              <p className="mt-2 text-2xl font-bold text-yellow-700">
                {lateCount}
              </p>

            </div>


            {/* Percentage */}

            <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">

              <p className="text-sm text-violet-700">
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