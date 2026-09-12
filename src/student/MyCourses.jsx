import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  BookOpen,
  Clock3,
  PlayCircle,
  Search,
  Loader2,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  RefreshCw,
  Lock,
} from "lucide-react";

import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../firebase/Firebase";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { getMyEnrollments } from "../services/EnrollmentService";


/* =========================================================
   MY COURSES
========================================================= */

export default function MyCourses() {
  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const [enrollments, setEnrollments] = useState([]);
  const [courses, setCourses] = useState([]);

  /* -------------------------------------------------------
     AUTH
  ------------------------------------------------------- */

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  /* -------------------------------------------------------
     UI
  ------------------------------------------------------- */

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  /* =========================================================
     SCROLL TO TOP
  ========================================================= */

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, []);

  /* =========================================================
     AUTH STATE
  ========================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthReady(true);
      }
    );

    return unsubscribe;
  }, []);

  /* =========================================================
     LOAD STUDENT COURSES
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadCourses = async () => {
      if (!authReady) {
        return;
      }

      if (!user) {
        if (!cancelled) {
          setEnrollments([]);
          setCourses([]);
          setError("Please log in to view your courses.");
          setLoading(false);
        }

        return;
      }

      try {
        setLoading(true);
        setError("");

        /* ---------------------------------------------------
           GET STUDENT ENROLLMENTS

           Firestore query:

           where("uid", "==", user.uid)

           This matches the Firestore rules.
        --------------------------------------------------- */

        const enrollmentData =
          await getMyEnrollments();

        if (cancelled) {
          return;
        }

        setEnrollments(enrollmentData);

        /* ---------------------------------------------------
           LOAD COURSE DOCUMENTS
        --------------------------------------------------- */

        const courseResults = await Promise.all(
          enrollmentData.map(
            async (enrollment) => {
              if (
                !enrollment.courseId ||
                !enrollment.id
              ) {
                return null;
              }

              try {
                const courseRef = doc(
                  db,
                  "courses",
                  enrollment.courseId
                );

                const courseSnapshot =
                  await getDoc(courseRef);

                if (!courseSnapshot.exists()) {
                  console.warn(
                    "Course does not exist:",
                    enrollment.courseId
                  );

                  return null;
                }

                const courseData =
                  courseSnapshot.data();

                /* ------------------------------------------------
                   Only show published courses to students.

                   The Firestore rules already protect this,
                   but this also keeps the UI clean.
                ------------------------------------------------ */

                if (
                  courseData.status !==
                  "published"
                ) {
                  return null;
                }

                return {
                  id: courseSnapshot.id,
                  ...courseData,

                  enrollmentId:
                    enrollment.id,

                  enrollment,
                };
              } catch (courseError) {
                console.error(
                  `Failed to load course ${enrollment.courseId}:`,
                  courseError
                );

                return null;
              }
            }
          )
        );

        if (cancelled) {
          return;
        }

        setCourses(
          courseResults.filter(Boolean)
        );
      } catch (err) {
        console.error(
          "Failed to load student courses:",
          err
        );

        if (!cancelled) {
          if (
            err?.code ===
            "permission-denied"
          ) {
            setError(
              "You do not have permission to access your enrollments. Please make sure your student account is correctly configured."
            );
          } else {
            setError(
              err?.message ||
              "Unable to load your courses."
            );
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCourses();

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  /* =========================================================
     REFRESH
  ========================================================= */

  const handleRefresh = () => {
    window.location.reload();
  };

  /* =========================================================
     FILTER COURSES
  ========================================================= */

  const filteredCourses = useMemo(() => {
    const searchValue = search
      .trim()
      .toLowerCase();

    return courses.filter((course) => {
      const matchesSearch =
        !searchValue ||
        course.title
          ?.toLowerCase()
          .includes(searchValue) ||
        course.category
          ?.toLowerCase()
          .includes(searchValue);

      const progress = Math.min(
        100,
        Math.max(
          0,
          Number(
            course.enrollment?.progress || 0
          )
        )
      );

      let matchesFilter = true;

      if (filter === "in-progress") {
        matchesFilter =
          progress > 0 &&
          progress < 100;
      }

      if (filter === "completed") {
        matchesFilter =
          progress >= 100;
      }

      if (filter === "not-started") {
        matchesFilter =
          progress === 0;
      }

      return (
        matchesSearch &&
        matchesFilter
      );
    });
  }, [
    courses,
    search,
    filter,
  ]);

  /* =========================================================
     STATS
  ========================================================= */

  const stats = useMemo(() => {
    const total = courses.length;

    const completed = courses.filter(
      (course) =>
        Number(
          course.enrollment?.progress || 0
        ) >= 100
    ).length;

    const inProgress = courses.filter(
      (course) => {
        const progress = Number(
          course.enrollment?.progress || 0
        );

        return (
          progress > 0 &&
          progress < 100
        );
      }
    ).length;

    const notStarted = courses.filter(
      (course) =>
        Number(
          course.enrollment?.progress || 0
        ) === 0
    ).length;

    return {
      total,
      completed,
      inProgress,
      notStarted,
    };
  }, [courses]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    !authReady ||
    loading
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />

          <span>
            Loading your courses...
          </span>
        </div>
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-md text-center">

          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>

          <h2 className="mt-5 text-xl font-bold text-gray-900">
            Unable to load your courses
          </h2>

          <p className="mt-2 text-sm leading-6 text-gray-600">
            {error}
          </p>

          <button
            type="button"
            onClick={handleRefresh}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>

        </div>
      </div>
    );
  }

  /* =========================================================
     EMPTY STATE
  ========================================================= */

  if (courses.length === 0) {
    return (
      <div className="min-h-[60vh] px-5 py-10">
        <div className="mx-auto max-w-6xl">

          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center">

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <GraduationCap className="h-8 w-8 text-gray-500" />
            </div>

            <h1 className="mt-5 text-2xl font-bold text-gray-900">
              You haven't enrolled in any courses yet
            </h1>

            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-500">
              Explore our courses and start
              learning something new.
            </p>

            <Link
              to="/courses"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Explore Courses
              <ArrowRight className="h-4 w-4" />
            </Link>

          </div>

        </div>
      </div>
    );
  }

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8 sm:px-6 lg:px-8">

      <div className="mx-auto max-w-7xl">

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-sm font-semibold text-violet-600">
              MY LEARNING
            </p>

            <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
              My Courses
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              Continue learning and track your
              progress.
            </p>

          </div>

          <Link
            to="/courses"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 transition hover:bg-gray-100"
          >
            Browse Courses
            <ArrowRight className="h-4 w-4" />
          </Link>

        </div>


        {/* =================================================
            STATS
        ================================================= */}

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="Total Courses"
            value={stats.total}
            icon={
              <BookOpen className="h-5 w-5" />
            }
          />

          <StatCard
            label="In Progress"
            value={stats.inProgress}
            icon={
              <PlayCircle className="h-5 w-5" />
            }
          />

          <StatCard
            label="Completed"
            value={stats.completed}
            icon={
              <GraduationCap className="h-5 w-5" />
            }
          />

          <StatCard
            label="Not Started"
            value={stats.notStarted}
            icon={
              <Clock3 className="h-5 w-5" />
            }
          />

        </div>


        {/* =================================================
            SEARCH + FILTER
        ================================================= */}

        <div className="mt-8 flex flex-col gap-3 md:flex-row">

          <div className="relative flex-1">

            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search your courses..."
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />

          </div>


          <select
            value={filter}
            onChange={(event) =>
              setFilter(
                event.target.value
              )
            }
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 outline-none focus:border-violet-400"
          >

            <option value="all">
              All Courses
            </option>

            <option value="in-progress">
              In Progress
            </option>

            <option value="completed">
              Completed
            </option>

            <option value="not-started">
              Not Started
            </option>

          </select>

        </div>


        {/* =================================================
            COURSE GRID
        ================================================= */}

        <div className="mt-8">

          {filteredCourses.length === 0 ? (

            <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center">

              <Search className="mx-auto h-8 w-8 text-gray-300" />

              <h3 className="mt-4 font-semibold text-gray-900">
                No courses found
              </h3>

              <p className="mt-2 text-sm text-gray-500">
                Try changing your search or filter.
              </p>

            </div>

          ) : (

            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">

              {filteredCourses.map(
                (course) => (
                  <StudentCourseCard
                    key={
                      course.enrollmentId
                    }
                    course={course}
                  />
                )
              )}

            </div>

          )}

        </div>

      </div>

    </div>
  );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  icon,
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 transition hover:shadow-sm">

      <div className="flex items-center justify-between">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
          {icon}
        </div>

        <span className="text-2xl font-bold text-gray-900">
          {value}
        </span>

      </div>

      <p className="mt-4 text-sm text-gray-500">
        {label}
      </p>

    </div>
  );
}


/* =========================================================
   COURSE CARD
========================================================= */

function StudentCourseCard({
  course,
}) {
  const enrollment =
    course.enrollment || {};

  const progress = Math.min(
    100,
    Math.max(
      0,
      Number(
        enrollment.progress || 0
      )
    )
  );

  const completedLessons =
    Array.isArray(
      enrollment.completedLessons
    )
      ? enrollment.completedLessons.length
      : 0;

  const isCompleted =
    progress >= 100;

  const isActive =
    enrollment.status === "active";

  const isPending =
    enrollment.status === "pending";

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">

      {/* =================================================
          IMAGE
      ================================================= */}

      <div className="relative aspect-video overflow-hidden bg-gray-100">

        {course.thumbnailUrl ? (

          <img
            src={course.thumbnailUrl}
            alt={course.title}
            className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]"
          />

        ) : (

          <div className="flex h-full items-center justify-center">
            <BookOpen className="h-12 w-12 text-gray-300" />
          </div>

        )}

        {/* COURSE TYPE */}

        <div className="absolute left-3 top-3 rounded-full bg-black/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {course.type === "long"
            ? "Live Course"
            : "Short Course"}
        </div>

        {/* COMPLETED */}

        {isCompleted && (
          <div className="absolute right-3 top-3 rounded-full bg-green-600 px-3 py-1 text-xs font-semibold text-white">
            Completed
          </div>
        )}

      </div>


      {/* =================================================
          CONTENT
      ================================================= */}

      <div className="p-5">

        {/* CATEGORY */}

        {course.category && (
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
            {course.category}
          </p>
        )}


        {/* TITLE */}

        <h2 className="mt-1 line-clamp-2 text-lg font-bold text-gray-900">
          {course.title}
        </h2>


        {/* DESCRIPTION */}

        {course.shortDescription && (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-500">
            {course.shortDescription}
          </p>
        )}


        {/* =================================================
            PROGRESS
        ================================================= */}

        <div className="mt-5">

          <div className="mb-2 flex items-center justify-between text-xs">

            <span className="font-medium text-gray-600">
              Progress
            </span>

            <span className="font-bold text-gray-900">
              {progress}%
            </span>

          </div>

          <div className="h-2 overflow-hidden rounded-full bg-gray-100">

            <div
              className="h-full rounded-full bg-violet-600 transition-all duration-500"
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

        </div>


        {/* =================================================
            META
        ================================================= */}

        <div className="mt-3 flex items-center justify-between text-xs text-gray-500">

          <span>
            {completedLessons}{" "}
            {completedLessons === 1
              ? "lesson"
              : "lessons"}{" "}
            completed
          </span>

          {course.duration && (
            <span className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {course.duration}
            </span>
          )}

        </div>


        {/* =================================================
            ACTION
        ================================================= */}

        {isActive ? (

          <Link
            to={`/student/courses/${course.id}`}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >

            {isCompleted
              ? "Review Course"
              : progress > 0
                ? "Continue Learning"
                : "Start Learning"}

            <ArrowRight className="h-4 w-4" />

          </Link>

        ) : isPending ? (

          <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-500">
            <Lock className="h-4 w-4" />
            Awaiting Payment
          </div>

        ) : (

          <div className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 px-4 py-3 text-sm font-semibold text-gray-500">
            <Lock className="h-4 w-4" />
            Access Unavailable
          </div>

        )}

      </div>

    </div>
  );
}