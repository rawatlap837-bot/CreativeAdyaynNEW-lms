import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  collection,
  getDocs,
  orderBy,
  query,
} from "firebase/firestore";

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

import { auth, db } from "../firebase";

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
          "firebase/firestore"
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
          err
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

        const modulesSnapshot =
          await getDocs(modulesQuery);

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

              const lessonsQuery = query(
                lessonsRef,
                orderBy("order", "asc")
              );

              const lessonsSnapshot =
                await getDocs(lessonsQuery);

              const lessons =
                lessonsSnapshot.docs.map(
                  (lessonDoc) => ({
                    id: lessonDoc.id,
                    ...lessonDoc.data(),
                  })
                );

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
        console.error(
          "Failed to load course content:",
          err
        );

        if (!cancelled) {
          setContentError(
            "Unable to load course content."
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

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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
        err
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

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
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

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };


  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading course...</span>
        </div>
      </div>
    );
  }


  /* =====================================================
     ERROR
  ===================================================== */

  if (error || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-7 w-7 text-red-500" />
          </div>

          <h1 className="mt-5 text-2xl font-bold text-gray-900">
            Course unavailable
          </h1>

          <p className="mt-3 text-sm text-gray-600">
            {error}
          </p>

          <Link
            to="/courses"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Courses
          </Link>
        </div>
      </div>
    );
  }


  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* =================================================
          TOP BAR
      ================================================= */}

      <header className="sticky top-0 z-50 border-b border-white/10 bg-gray-950/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">

          <div className="flex min-w-0 items-center gap-3">

            <button
              type="button"
              onClick={() =>
                setSidebarOpen(true)
              }
              className="rounded-lg p-2 text-gray-300 hover:bg-white/10 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link
              to="/dashboard"
              className="hidden items-center gap-2 text-sm font-semibold text-gray-300 hover:text-white sm:flex"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>

            <div className="hidden h-5 w-px bg-white/10 sm:block" />

            <h1 className="max-w-[220px] truncate text-sm font-semibold sm:max-w-[400px]">
              {course.title}
            </h1>
          </div>

          <div className="flex items-center gap-4">

            <div className="hidden text-right sm:block">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">
                Progress
              </p>

              <p className="text-sm font-bold">
                {progress}%
              </p>
            </div>

            <div className="h-2 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{
                  width: `${progress}%`,
                }}
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
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={() =>
            setSidebarOpen(false)
          }
        />
      )}


      {/* =================================================
          LAYOUT
      ================================================= */}

      <div className="flex min-h-[calc(100vh-4rem)]">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside
          className={`
            fixed inset-y-16 left-0 z-50 w-[320px]
            overflow-y-auto border-r border-white/10
            bg-gray-950 transition-transform
            lg:static lg:z-auto lg:block
            lg:w-[350px] lg:translate-x-0
            ${sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
            }
          `}
        >
          <div className="p-4">

            <div className="mb-5 flex items-center justify-between lg:hidden">
              <span className="font-semibold">
                Course Content
              </span>

              <button
                type="button"
                onClick={() =>
                  setSidebarOpen(false)
                }
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* COURSE INFO */}

            <div className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-400">
                Your Course
              </p>

              <p className="mt-1 line-clamp-2 text-sm font-semibold">
                {course.title}
              </p>

              <div className="mt-4">
                <div className="mb-1 flex justify-between text-xs text-gray-400">
                  <span>Your progress</span>
                  <span>{progress}%</span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{
                      width: `${progress}%`,
                    }}
                  />
                </div>
              </div>
            </div>


            {/* ENROLLMENT WARNING */}

            {!hasAccess && (
              <div className="mb-5 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
                <div className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />

                  <div>
                    <p className="text-sm font-semibold text-yellow-300">
                      Enrollment required
                    </p>

                    <p className="mt-1 text-xs leading-5 text-gray-400">
                      Only preview lessons are
                      available until you enroll.
                    </p>

                    <Link
                      to={`/courses/${course.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-yellow-300 hover:text-yellow-200"
                    >
                      View Course
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}


            {/* MODULES */}

            {contentLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading lessons...
              </div>
            ) : contentError ? (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
                {contentError}
              </div>
            ) : modules.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                No lessons available.
              </div>
            ) : (
              <div className="space-y-2">
                {modules.map(
                  (module, moduleIndex) => {
                    const isOpen =
                      !!openModules[module.id];

                    return (
                      <div
                        key={module.id}
                        className="overflow-hidden rounded-xl border border-white/10"
                      >

                        {/* MODULE HEADER */}

                        <button
                          type="button"
                          onClick={() =>
                            toggleModule(
                              module.id
                            )
                          }
                          className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-white/[0.03]"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-bold">
                              {moduleIndex + 1}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {module.title ||
                                  `Module ${moduleIndex + 1
                                  }`}
                              </p>

                              <p className="mt-0.5 text-[11px] text-gray-500">
                                {module.lessons?.length ||
                                  0}{" "}
                                lessons
                              </p>
                            </div>
                          </div>

                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                          )}
                        </button>


                        {/* LESSONS */}

                        {isOpen && (
                          <div className="border-t border-white/10">
                            {module.lessons?.map(
                              (
                                lesson,
                                lessonIndex
                              ) => {
                                const selected =
                                  selectedLesson?.id ===
                                  lesson.id;

                                const completed =
                                  completedLessons.includes(
                                    lesson.id
                                  );

                                const locked =
                                  !lesson.isPreview &&
                                  !hasAccess;

                                return (
                                  <button
                                    key={lesson.id}
                                    type="button"
                                    disabled={locked}
                                    onClick={() =>
                                      selectLesson(
                                        module,
                                        lesson
                                      )
                                    }
                                    className={`
                                      flex w-full items-center gap-3
                                      px-4 py-3 text-left
                                      transition
                                      ${selected
                                        ? "bg-violet-500/15"
                                        : "hover:bg-white/[0.03]"
                                      }
                                      ${locked
                                        ? "cursor-not-allowed opacity-50"
                                        : ""
                                      }
                                    `}
                                  >
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                                      {completed ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                                      ) : locked ? (
                                        <Lock className="h-3.5 w-3.5 text-gray-500" />
                                      ) : lesson.type ===
                                        "video" ? (
                                        <PlayCircle className="h-4 w-4 text-gray-400" />
                                      ) : (
                                        <BookOpen className="h-4 w-4 text-gray-400" />
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`
                                          line-clamp-2 text-xs font-medium
                                          ${selected
                                            ? "text-violet-300"
                                            : "text-gray-300"
                                          }
                                        `}
                                      >
                                        {lessonIndex +
                                          1}
                                        .{" "}
                                        {lesson.title}
                                      </p>

                                      <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-500">
                                        {lesson.type ===
                                          "video" && (
                                            <span>
                                              Video
                                            </span>
                                          )}

                                        {lesson.duration && (
                                          <span>
                                            {
                                              lesson.duration
                                            }
                                          </span>
                                        )}

                                        {lesson.isPreview && (
                                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-green-400">
                                            Preview
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              }
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>
        </aside>


        {/* =================================================
            MAIN LEARNING AREA
        ================================================= */}

        <main className="min-w-0 flex-1 bg-gray-900">

          {!selectedLesson ? (
            <div className="flex min-h-[70vh] items-center justify-center px-6">
              <div className="text-center">
                <BookOpen className="mx-auto h-10 w-10 text-gray-600" />

                <h2 className="mt-4 text-xl font-bold">
                  Select a lesson
                </h2>

                <p className="mt-2 text-sm text-gray-500">
                  Choose a lesson from the course
                  curriculum.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* VIDEO / CONTENT */}

              <div className="mx-auto max-w-6xl">

                {selectedLesson.type ===
                  "video" ? (
                  <div className="aspect-video bg-black">
                    {selectedLesson.videoUrl ? (
                      selectedLesson.isPreview ||
                        hasAccess ? (
                        <video
                          key={
                            selectedLesson.videoUrl
                          }
                          src={
                            selectedLesson.videoUrl
                          }
                          controls
                          playsInline
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <LockedContent />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <div className="text-center">
                          <Video className="mx-auto h-10 w-10 text-gray-600" />

                          <p className="mt-3 text-sm text-gray-500">
                            Video is not available
                            yet.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="min-h-[420px] bg-gray-900 px-6 py-12 sm:px-10">
                    {selectedLesson.isPreview ||
                      hasAccess ? (
                      <div className="mx-auto max-w-3xl">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-500/10">
                          <BookOpen className="h-7 w-7 text-violet-400" />
                        </div>

                        <h2 className="mt-6 text-2xl font-bold sm:text-3xl">
                          {selectedLesson.title}
                        </h2>

                        <div className="mt-6 whitespace-pre-line text-sm leading-8 text-gray-400">
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

                <div className="border-t border-white/10 px-5 py-6 sm:px-8">

                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">

                    <div className="min-w-0">
                      <p className="text-xs font-medium text-violet-400">
                        {selectedLesson.moduleTitle}
                      </p>

                      <h2 className="mt-1 text-xl font-bold">
                        {selectedLesson.title}
                      </h2>

                      {selectedLesson.duration && (
                        <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {selectedLesson.duration}
                        </div>
                      )}
                    </div>


                    {/* COMPLETE */}

                    {hasAccess &&
                      selectedLesson.isPreview !==
                      false && (
                        <button
                          type="button"
                          disabled={
                            completing ||
                            completedLessons.includes(
                              selectedLesson.id
                            )
                          }
                          onClick={
                            handleCompleteLesson
                          }
                          className={`
                            inline-flex shrink-0
                            items-center justify-center gap-2
                            rounded-xl px-4 py-2.5
                            text-sm font-semibold
                            transition
                            ${completedLessons.includes(
                            selectedLesson.id
                          )
                              ? "bg-green-500/10 text-green-400"
                              : "bg-violet-600 text-white hover:bg-violet-500"
                            }
                          `}
                        >
                          {completing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}

                          {completedLessons.includes(
                            selectedLesson.id
                          )
                            ? "Completed"
                            : "Mark Complete"}
                        </button>
                      )}
                  </div>


                  {/* NAVIGATION */}

                  <div className="mt-8 flex items-center justify-between gap-3 border-t border-white/10 pt-6">

                    <button
                      type="button"
                      onClick={
                        handlePreviousLesson
                      }
                      disabled={
                        !selectedLesson ||
                        allLessons.findIndex(
                          (lesson) =>
                            lesson.id ===
                            selectedLesson.id
                        ) <= 0
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-gray-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous
                    </button>

                    <button
                      type="button"
                      onClick={handleNextLesson}
                      disabled={
                        !selectedLesson ||
                        allLessons.findIndex(
                          (lesson) =>
                            lesson.id ===
                            selectedLesson.id
                        ) >=
                        allLessons.length - 1
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </>
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
    <div className="flex h-full min-h-[420px] items-center justify-center bg-gray-950 px-6">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5">
          <Lock className="h-7 w-7 text-gray-500" />
        </div>

        <h3 className="mt-5 text-xl font-bold">
          This lesson is locked
        </h3>

        <p className="mt-2 text-sm leading-6 text-gray-500">
          Enroll in this course to access the
          complete lesson.
        </p>

        <Link
          to="/courses"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100"
        >
          Explore Courses
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}