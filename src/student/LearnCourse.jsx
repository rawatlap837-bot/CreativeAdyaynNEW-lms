import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  collection,
  getDocs,
  orderBy,
  query,
} from "../lib/database";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Lock,
  Loader2,
  Menu,
  PlayCircle,
  Video,
  X,
} from "lucide-react";

import { auth, db } from "../lib/backend";

import {
  getEnrollment,
  markLessonComplete,
} from "../services/EnrollmentService";


/* =========================================================
   HELPERS
========================================================= */

const getTimestampValue = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

function getYouTubeEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    let videoId = "";

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1).split("/")[0];
    } else if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1]?.split("/")[0];
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0];
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
    }

    if (!videoId) return null;

    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1`;
  } catch {
    return null;
  }
}


const isEnrollmentActive = (enrollment) => {
  if (!enrollment) return false;

  if (enrollment.status !== "active") {
    return false;
  }

  if (enrollment.expiresAt) {
    const expiresAt = getTimestampValue(
      enrollment.expiresAt
    );

    if (expiresAt && expiresAt < new Date()) {
      return false;
    }
  }

  return true;
};


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LearnCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [enrollment, setEnrollment] = useState(null);

  const [selectedLesson, setSelectedLesson] = useState(null);

  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);

  const [error, setError] = useState("");
  const [contentError, setContentError] = useState("");

  const [openModules, setOpenModules] = useState({});

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [completing, setCompleting] = useState(false);

  const [screenProtectionActive, setScreenProtectionActive] =
    useState(false);

  useEffect(() => {
    const protectScreen = () => setScreenProtectionActive(true);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        protectScreen();
      } else {
        setScreenProtectionActive(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const blockCaptureShortcuts = (event) => {
      const key = event.key.toLowerCase();
      const blocked =
        key === "printscreen" ||
        (event.ctrlKey && ["p", "s", "u"].includes(key)) ||
        (event.metaKey && ["p", "s", "u"].includes(key));

      if (blocked) {
        event.preventDefault();
        setScreenProtectionActive(true);
        window.setTimeout(() => setScreenProtectionActive(false), 1500);
      }
    };

    document.addEventListener("keydown", blockCaptureShortcuts);
    return () => document.removeEventListener("keydown", blockCaptureShortcuts);
  }, []);


  /* =====================================================
     LOAD COURSE + ENROLLMENT
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadCourse = async () => {
      try {
        setLoading(true);
        setError("");

        const user = auth.currentUser;

        if (!user) {
          navigate("/login", {
            replace: true,
            state: {
              from: `/student/courses/${courseId}`,
            },
          });

          return;
        }

        if (!courseId) {
          throw new Error("Course ID is missing.");
        }

        /* -----------------------------------------------
           Load course
        ------------------------------------------------ */

        const courseRef = await import(
          "../lib/database"
        ).then(({ doc, getDoc }) =>
          getDoc(doc(db, "courses", courseId))
        );

        if (!courseRef.exists()) {
          throw new Error("Course not found.");
        }

        const courseData = {
          id: courseRef.id,
          ...courseRef.data(),
        };

        /* -----------------------------------------------
           Only published courses are learnable
        ------------------------------------------------ */

        if (courseData.status !== "published") {
          throw new Error(
            "This course is not currently available."
          );
        }

        /* -----------------------------------------------
           Check enrollment
        ------------------------------------------------ */

        const enrollmentData = await getEnrollment(
          user.uid,
          courseId
        );

        if (cancelled) return;

        setCourse(courseData);
        setEnrollment(enrollmentData);

        /* -----------------------------------------------
           Open first module initially
        ------------------------------------------------ */

      } catch (err) {
        console.error(
          "Failed to load learning page:",
          {
            code: err?.code,
            message: err?.message,
            courseId,
            uid: auth.currentUser?.uid,
          }
        );

        if (!cancelled) {
          setError(
            err?.message ||
            "Unable to load this course."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId, navigate]);


  /* =====================================================
     SCROLL TO TOP ON PAGE LOAD / COURSE CHANGE
  ===================================================== */

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [courseId]);


  /* =====================================================
     LOAD MODULES + LESSONS
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      if (!course?.id) {
        return;
      }

      try {
        setContentLoading(true);
        setContentError("");

        const modulesRef = collection(
          db,
          "courses",
          course.id,
          "modules"
        );

        const modulesQuery = query(
          modulesRef,
          orderBy("order", "asc")
        );

        let modulesSnapshot;

        try {
          modulesSnapshot = await getDocs(modulesQuery);
        } catch (err) {
          // Tag the error so we know it failed on the
          // MODULES collection specifically, not lessons.
          console.error(
            "Failed to load modules:",
            {
              code: err?.code,
              message: err?.message,
              path: `courses/${course.id}/modules`,
              uid: auth.currentUser?.uid,
            }
          );
          throw err;
        }

        const moduleData = await Promise.all(
          modulesSnapshot.docs.map(
            async (moduleDoc) => {
              const module = {
                id: moduleDoc.id,
                ...moduleDoc.data(),
              };

              const lessonsRef = collection(
                db,
                "courses",
                course.id,
                "modules",
                moduleDoc.id,
                "lessons"
              );

              const lessonsQuery = query(lessonsRef);

              let lessonsSnapshot;

              try {
                lessonsSnapshot = await getDocs(lessonsQuery);
              } catch (err) {
                // Tag the error so we know it failed on the
                // LESSONS collection, and exactly which module.
                console.error(
                  "Failed to load lessons:",
                  {
                    code: err?.code,
                    message: err?.message,
                    path: `courses/${course.id}/modules/${moduleDoc.id}/lessons`,
                    uid: auth.currentUser?.uid,
                  }
                );
                throw err;
              }

              const lessons =
                lessonsSnapshot.docs.map(
                  (lessonDoc) => ({
                    id: lessonDoc.id,
                    ...lessonDoc.data(),
                  })
                ).sort((a, b) => (a.order || 0) - (b.order || 0));

              return {
                ...module,
                lessons,
              };
            }
          )
        );

        if (cancelled) return;

        setModules(moduleData);

        /* -----------------------------------------------
           Select first lesson automatically
        ------------------------------------------------ */

        const firstLesson =
          moduleData
            .flatMap((module) =>
              (module.lessons || []).map(
                (lesson) => ({
                  ...lesson,
                  moduleId: module.id,
                  moduleTitle: module.title,
                })
              )
            )[0];

        if (firstLesson) {
          setSelectedLesson(firstLesson);
        }

        if (moduleData.length > 0) {
          setOpenModules({
            [moduleData[0].id]: true,
          });
        }
      } catch (err) {
        // The two inner try/catch blocks above already logged
        // exactly which collection and path failed and why.
        if (!cancelled) {
          setContentError(
            err?.code === "permission-denied"
              ? "You don't have permission to view this course's content. If you believe this is a mistake, try enrolling or contact support."
              : "Unable to load course content."
          );
        }
      } finally {
        if (!cancelled) {
          setContentLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [course?.id]);


  /* =====================================================
     SCROLL TO TOP ON LESSON CHANGE
     (covers the initial auto-selected lesson too, not just
     manual navigation clicks)
  ===================================================== */

  useEffect(() => {
    if (!selectedLesson) return;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedLesson?.id]);


  /* =====================================================
     FLATTEN LESSONS
  ===================================================== */

  const allLessons = useMemo(() => {
    return modules.flatMap((module) =>
      (module.lessons || []).map((lesson) => ({
        ...lesson,
        moduleId: module.id,
        moduleTitle: module.title,
      }))
    );
  }, [modules]);


  /* =====================================================
     PROGRESS
  ===================================================== */

  const completedLessons = Array.isArray(
    enrollment?.completedLessons
  )
    ? enrollment.completedLessons
    : [];

  const progress =
    allLessons.length > 0
      ? Math.round(
        (completedLessons.length /
          allLessons.length) *
        100
      )
      : Number(enrollment?.progress || 0);


  /* =====================================================
     ACCESS
  ===================================================== */

  const hasAccess = isEnrollmentActive(enrollment);


  /* =====================================================
     SELECT LESSON
  ===================================================== */

  const selectLesson = (module, lesson) => {
    /*
      Preview lessons are available publicly.
      Non-preview lessons require active enrollment.
    */

    if (!lesson.isPreview && !hasAccess) {
      return;
    }

    setSelectedLesson({
      ...lesson,
      moduleId: module.id,
      moduleTitle: module.title,
    });

    setSidebarOpen(false);
  };


  /* =====================================================
     TOGGLE MODULE
  ===================================================== */

  const toggleModule = (moduleId) => {
    setOpenModules((previous) => ({
      ...previous,
      [moduleId]: !previous[moduleId],
    }));
  };


  /* =====================================================
     COMPLETE LESSON
  ===================================================== */

  const handleCompleteLesson = async () => {
    if (!selectedLesson) return;

    if (!hasAccess) {
      return;
    }

    if (completedLessons.includes(selectedLesson.id)) {
      return;
    }

    if (!enrollment?.id) {
      return;
    }

    try {
      setCompleting(true);

      const result =
        await markLessonComplete(
          enrollment.id,
          selectedLesson.id,
          allLessons.length
        );

      setEnrollment((previous) => ({
        ...previous,
        progress: result.progress,
        completedLessons:
          result.completedLessons,
      }));
    } catch (err) {
      console.error(
        "Failed to complete lesson:",
        {
          code: err?.code,
          message: err?.message,
          enrollmentId: enrollment?.id,
          lessonId: selectedLesson?.id,
        }
      );

      alert(
        err?.message ||
        "Unable to update lesson progress."
      );
    } finally {
      setCompleting(false);
    }
  };


  /* =====================================================
     NEXT LESSON
  ===================================================== */

  const handleNextLesson = () => {
    if (!selectedLesson) return;

    const currentIndex = allLessons.findIndex(
      (lesson) =>
        lesson.id === selectedLesson.id
    );

    if (
      currentIndex === -1 ||
      currentIndex >= allLessons.length - 1
    ) {
      return;
    }

    const nextLesson =
      allLessons[currentIndex + 1];

    if (!nextLesson.isPreview && !hasAccess) {
      return;
    }

    setSelectedLesson(nextLesson);
  };


  /* =====================================================
     PREVIOUS LESSON
  ===================================================== */

  const handlePreviousLesson = () => {
    if (!selectedLesson) return;

    const currentIndex = allLessons.findIndex(
      (lesson) =>
        lesson.id === selectedLesson.id
    );

    if (currentIndex <= 0) {
      return;
    }

    const previousLesson =
      allLessons[currentIndex - 1];

    if (
      !previousLesson.isPreview &&
      !hasAccess
    ) {
      return;
    }

    setSelectedLesson(previousLesson);
  };


  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">
            Loading course...
          </span>
        </div>
      </div>
    );
  }


  /* =====================================================
     ERROR
  ===================================================== */

  if (error || !course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            Course unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error}
          </p>

          <Link
            to="/courses"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to courses
          </Link>
        </div>
      </div>
    );
  }


  /* =====================================================
     DERIVED
  ===================================================== */

  const selectedIndex = selectedLesson
    ? allLessons.findIndex(
      (lesson) => lesson.id === selectedLesson.id
    )
    : -1;


  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <div className="min-h-screen bg-slate-50 pt-24 text-slate-900">

      {/* =================================================
          TOP BAR
          Not sticky — scrolls away normally with the page,
          so it can't fight your global floating navbar for
          the top of the screen.
      ================================================= */}

      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">

          <div className="flex min-w-0 items-center gap-3">

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="-ml-1.5 flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:gap-2 sm:px-2.5"
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Open course content"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="hidden h-5 w-px bg-slate-200 sm:block" />

            <h1 className="min-w-0 truncate text-sm font-semibold text-slate-900">
              {course.title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[11px] font-medium text-slate-500">
                Progress
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {progress}%
              </p>
            </div>

            <div
              className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 sm:w-24"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-violet-600 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>


      {/* =================================================
          MOBILE SIDEBAR OVERLAY
      ================================================= */}

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}


      {/* =================================================
          LAYOUT
      ================================================= */}

      <div className="mx-auto flex w-full max-w-[1600px] items-stretch">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[86%] max-w-[340px]
            overflow-y-auto border-r border-slate-200
            bg-white pt-16 transition-transform duration-300 ease-out
            lg:static lg:z-auto lg:h-auto lg:min-h-[calc(100vh-6rem)]
            lg:w-[340px] lg:max-w-none lg:translate-x-0 lg:pt-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="p-4 sm:p-5">

            <div className="mb-4 flex items-center justify-between lg:hidden">
              <span className="text-sm font-semibold text-slate-900">
                Course content
              </span>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close course content"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* COURSE INFO */}

            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
                Your course
              </p>

              <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-900">
                {course.title}
              </p>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>Your progress</span>
                  <span className="font-medium text-slate-700">
                    {progress}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-violet-600 transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>


            {/* ENROLLMENT WARNING */}

            {!hasAccess && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-800">
                      Enrollment required
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Only preview lessons are available
                      until you enroll.
                    </p>

                    <Link
                      to={`/courses/${course.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 transition hover:text-amber-800"
                    >
                      View course
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}


            {/* MODULES */}

            {contentLoading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading lessons...
              </div>
            ) : contentError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-700">
                {contentError}
              </div>
            ) : modules.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No lessons available yet.
              </div>
            ) : (
              <div className="space-y-2">
                {modules.map((module, moduleIndex) => {
                  const isOpen = !!openModules[module.id];
                  const moduleLessonCount =
                    module.lessons?.length || 0;

                  return (
                    <div
                      key={module.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >

                      {/* MODULE HEADER */}

                      <button
                        type="button"
                        onClick={() => toggleModule(module.id)}
                        className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                            {moduleIndex + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {module.title ||
                                `Module ${moduleIndex + 1}`}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {moduleLessonCount}{" "}
                              {moduleLessonCount === 1
                                ? "lesson"
                                : "lessons"}
                            </p>
                          </div>
                        </div>

                        {isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </button>


                      {/* LESSONS */}

                      {isOpen && (
                        <div className="border-t border-slate-200">
                          {moduleLessonCount === 0 ? (
                            <p className="px-4 py-3 text-xs text-slate-500">
                              No lessons in this module yet.
                            </p>
                          ) : (
                            module.lessons.map(
                              (lesson, lessonIndex) => {
                                const selected =
                                  selectedLesson?.id === lesson.id;

                                const completed =
                                  completedLessons.includes(
                                    lesson.id
                                  );

                                const locked =
                                  !lesson.isPreview && !hasAccess;

                                return (
                                  <button
                                    key={lesson.id}
                                    type="button"
                                    disabled={locked}
                                    onClick={() =>
                                      selectLesson(module, lesson)
                                    }
                                    aria-current={
                                      selected ? "true" : undefined
                                    }
                                    className={`
                                      flex w-full items-start gap-3
                                      border-l-2 px-4 py-3 text-left
                                      transition
                                      ${selected
                                        ? "border-violet-600 bg-violet-50"
                                        : "border-transparent hover:bg-slate-50"
                                      }
                                      ${locked
                                        ? "cursor-not-allowed opacity-50"
                                        : ""
                                      }
                                    `}
                                  >
                                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                                      {completed ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      ) : locked ? (
                                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                                      ) : lesson.type === "video" ? (
                                        <PlayCircle className="h-4 w-4 text-slate-400" />
                                      ) : (
                                        <BookOpen className="h-4 w-4 text-slate-400" />
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`
                                          line-clamp-2 text-[13px] font-medium leading-5
                                          ${selected
                                            ? "text-violet-700"
                                            : "text-slate-700"
                                          }
                                        `}
                                      >
                                        {lessonIndex + 1}. {lesson.title}
                                      </p>

                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                        {lesson.type === "video" && (
                                          <span>Video</span>
                                        )}

                                        {lesson.duration && (
                                          <span>{lesson.duration}</span>
                                        )}

                                        {lesson.isPreview && (
                                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                                            Preview
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              }
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>


        {/* =================================================
            MAIN LEARNING AREA
        ================================================= */}

        <main className="min-w-0 flex-1">

          {!selectedLesson ? (
            <div className="flex min-h-[70vh] items-center justify-center px-6">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <BookOpen className="h-6 w-6 text-slate-400" />
                </div>

                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  Select a lesson
                </h2>

                <p className="mt-1.5 text-sm text-slate-500">
                  Choose a lesson from the course curriculum
                  to get started.
                </p>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 lg:hidden"
                >
                  <Menu className="h-4 w-4" />
                  Browse lessons
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl">

              {/* VIDEO / CONTENT */}

              {selectedLesson.type === "video" ? (
                <div
                  className="relative aspect-video w-full select-none bg-black"
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {screenProtectionActive && (
                    <div
                      className="absolute inset-0 z-20 bg-black"
                      aria-label="Video temporarily hidden for screen protection"
                    />
                  )}
                  {selectedLesson.videoUrl ? (
                    selectedLesson.isPreview || hasAccess ? (
                      getYouTubeEmbedUrl(selectedLesson.videoUrl) ? (
                        <div
                          className="h-full w-full select-none"
                          onContextMenu={(event) => event.preventDefault()}
                        >
                          <iframe
                            key={selectedLesson.videoUrl}
                            src={getYouTubeEmbedUrl(selectedLesson.videoUrl)}
                            title={selectedLesson.title || "Course video"}
                            className="h-full w-full"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allow="autoplay; encrypted-media"
                          />
                        </div>
                      ) : (
                        <video
                          key={selectedLesson.videoUrl}
                          src={selectedLesson.videoUrl}
                          controls
                          controlsList="nodownload noplaybackrate"
                          disablePictureInPicture
                          playsInline
                          onContextMenu={(event) => event.preventDefault()}
                          className="h-full w-full select-none object-contain"
                        />
                      )
                    ) : (
                      <LockedContent />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center px-6">
                      <div className="text-center">
                        <Video className="mx-auto h-8 w-8 text-slate-600" />
                        <p className="mt-3 text-sm text-slate-400">
                          Video is not available yet.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-[320px] px-5 py-10 sm:px-10 sm:py-14">
                  {selectedLesson.isPreview || hasAccess ? (
                    <div className="max-w-2xl">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
                        <BookOpen className="h-6 w-6 text-violet-600" />
                      </div>

                      <h2 className="mt-5 text-2xl font-bold leading-tight text-slate-900 sm:text-[28px]">
                        {selectedLesson.title}
                      </h2>

                      <div className="mt-5 whitespace-pre-line text-[15px] leading-7 text-slate-600">
                        {selectedLesson.description ||
                          "No lesson content has been added yet."}
                      </div>
                    </div>
                  ) : (
                    <LockedContent />
                  )}
                </div>
              )}


              {/* LESSON DETAILS */}

              <div className="border-t border-slate-200 px-5 py-6 sm:px-10">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-violet-600">
                      {selectedLesson.moduleTitle}
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
                      {selectedLesson.title}
                    </h2>

                    {selectedLesson.duration && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        {selectedLesson.duration}
                      </div>
                    )}
                  </div>


                  {/* COMPLETE */}

                  {hasAccess && (
                    <button
                      type="button"
                      disabled={
                        completing ||
                        completedLessons.includes(selectedLesson.id)
                      }
                      onClick={handleCompleteLesson}
                      className={`
                        inline-flex shrink-0 items-center justify-center gap-2
                        rounded-lg px-4 py-2.5 text-sm font-semibold
                        transition disabled:cursor-default
                        ${completedLessons.includes(selectedLesson.id)
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-violet-600 text-white hover:bg-violet-500"
                        }
                      `}
                    >
                      {completing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}

                      {completedLessons.includes(selectedLesson.id)
                        ? "Completed"
                        : "Mark complete"}
                    </button>
                  )}
                </div>


                {/* NAVIGATION */}

                <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-6">

                  <button
                    type="button"
                    onClick={handlePreviousLesson}
                    disabled={selectedIndex <= 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <span className="text-xs text-slate-500">
                    {selectedIndex >= 0 && allLessons.length > 0
                      ? `Lesson ${selectedIndex + 1} of ${allLessons.length}`
                      : ""}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextLesson}
                    disabled={
                      selectedIndex === -1 ||
                      selectedIndex >= allLessons.length - 1
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-violet-600"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


/* =========================================================
   LOCKED CONTENT
========================================================= */

function LockedContent() {
  return (
    <div className="flex min-h-[320px] items-center justify-center px-6 py-14">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Lock className="h-6 w-6 text-slate-400" />
        </div>

        <h3 className="mt-5 text-lg font-semibold text-slate-900">
          This lesson is locked
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enroll in this course to access the complete lesson.
        </p>

        <Link
          to="/courses"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Explore courses
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}