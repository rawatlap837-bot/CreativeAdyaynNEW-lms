import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Edit3,
  GripVertical,
  Loader2,
  Plus,
  Save,
  Trash2,
  Video,
  FileText,
  BookOpen,
  X,
} from "lucide-react";

import { auth, db } from "../firebase/Firebase";
import { doc, getDoc } from "firebase/firestore";

import {
  getCourseContent,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
} from "../services/CourseContentService";


const CourseContent = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expandedModules, setExpandedModules] = useState({});

  const [showModuleForm, setShowModuleForm] = useState(false);
  const [editingModule, setEditingModule] = useState(null);

  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);

  const [moduleForm, setModuleForm] = useState({
    title: "",
    description: "",
  });

  const [lessonForm, setLessonForm] = useState({
    title: "",
    description: "",
    type: "video",
    videoUrl: "",
    thumbnailUrl: "",
    resourceUrl: "",
    duration: "",
    published: false,
  });


  /* ============================================================
     LOAD COURSE
     ============================================================ */

  useEffect(() => {
    loadCourse();
  }, [courseId]);


  const loadCourse = async () => {
    try {
      setLoading(true);
      setError("");

      const user = auth.currentUser;

      if (!user) {
        navigate("/login");
        return;
      }

      const courseRef = doc(db, "courses", courseId);
      const courseSnapshot = await getDoc(courseRef);

      if (!courseSnapshot.exists()) {
        throw new Error("Course not found.");
      }

      const courseData = {
        id: courseSnapshot.id,
        ...courseSnapshot.data(),
      };

      if (courseData.instructorId !== user.uid) {
        throw new Error(
          "You do not have permission to manage this course."
        );
      }

      setCourse(courseData);

      const content = await getCourseContent(courseId);

      setModules(content);

      const expanded = {};

      content.forEach((module) => {
        expanded[module.id] = true;
      });

      setExpandedModules(expanded);
    } catch (err) {
      console.error("Course content loading error:", err);
      setError(err.message || "Failed to load course content.");
    } finally {
      setLoading(false);
    }
  };


  /* ============================================================
     HELPERS
     ============================================================ */

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };


  const showSuccess = (message) => {
    setSuccess(message);

    setTimeout(() => {
      setSuccess("");
    }, 3000);
  };


  const toggleModule = (moduleId) => {
    setExpandedModules((previous) => ({
      ...previous,
      [moduleId]: !previous[moduleId],
    }));
  };


  /* ============================================================
     MODULE FORM
     ============================================================ */

  const openCreateModule = () => {
    clearMessages();

    setEditingModule(null);

    setModuleForm({
      title: "",
      description: "",
    });

    setShowModuleForm(true);
  };


  const openEditModule = (module) => {
    clearMessages();

    setEditingModule(module);

    setModuleForm({
      title: module.title || "",
      description: module.description || "",
    });

    setShowModuleForm(true);
  };


  const closeModuleForm = () => {
    if (saving) return;

    setShowModuleForm(false);
    setEditingModule(null);

    setModuleForm({
      title: "",
      description: "",
    });
  };


  const handleModuleSubmit = async (event) => {
    event.preventDefault();

    if (!moduleForm.title.trim()) {
      setError("Please enter a module title.");
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      if (editingModule) {
        await updateModule(
          courseId,
          editingModule.id,
          {
            title: moduleForm.title,
            description: moduleForm.description,
          }
        );

        showSuccess("Module updated successfully.");
      } else {
        await createModule(courseId, {
          title: moduleForm.title,
          description: moduleForm.description,
        });

        showSuccess("Module created successfully.");
      }

      closeModuleForm();

      await loadCourse();
    } catch (err) {
      console.error("Module save error:", err);
      setError(err.message || "Failed to save module.");
    } finally {
      setSaving(false);
    }
  };


  /* ============================================================
     DELETE MODULE
     ============================================================ */

  const handleDeleteModule = async (module) => {
    const confirmed = window.confirm(
      `Delete "${module.title}"?\n\nThis will also permanently delete all lessons inside this module.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      clearMessages();

      await deleteModule(courseId, module.id);

      showSuccess("Module deleted successfully.");

      await loadCourse();
    } catch (err) {
      console.error("Module delete error:", err);
      setError(err.message || "Failed to delete module.");
    } finally {
      setSaving(false);
    }
  };


  /* ============================================================
     LESSON FORM
     ============================================================ */

  const openCreateLesson = (moduleId) => {
    clearMessages();

    setEditingLesson(null);
    setActiveModuleId(moduleId);

    setLessonForm({
      title: "",
      description: "",
      type: "video",
      videoUrl: "",
      thumbnailUrl: "",
      resourceUrl: "",
      duration: "",
      published: false,
    });

    setShowLessonForm(true);
  };


  const openEditLesson = (moduleId, lesson) => {
    clearMessages();

    setEditingLesson(lesson);
    setActiveModuleId(moduleId);

    setLessonForm({
      title: lesson.title || "",
      description: lesson.description || "",
      type: lesson.type || "video",
      videoUrl: lesson.videoUrl || "",
      thumbnailUrl: lesson.thumbnailUrl || "",
      resourceUrl: lesson.resourceUrl || "",
      duration: lesson.duration || "",
      published: lesson.published === true,
    });

    setShowLessonForm(true);
  };


  const closeLessonForm = () => {
    if (saving) return;

    setShowLessonForm(false);
    setEditingLesson(null);
    setActiveModuleId(null);

    setLessonForm({
      title: "",
      description: "",
      type: "video",
      videoUrl: "",
      thumbnailUrl: "",
      resourceUrl: "",
      duration: "",
      published: false,
    });
  };


  const handleLessonSubmit = async (event) => {
    event.preventDefault();

    if (!lessonForm.title.trim()) {
      setError("Please enter a lesson title.");
      return;
    }

    if (!activeModuleId) {
      setError("Module not selected.");
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      if (editingLesson) {
        await updateLesson(
          courseId,
          activeModuleId,
          editingLesson.id,
          lessonForm
        );

        showSuccess("Lesson updated successfully.");
      } else {
        await createLesson(
          courseId,
          activeModuleId,
          lessonForm
        );

        showSuccess("Lesson created successfully.");
      }

      closeLessonForm();

      await loadCourse();
    } catch (err) {
      console.error("Lesson save error:", err);
      setError(err.message || "Failed to save lesson.");
    } finally {
      setSaving(false);
    }
  };


  /* ============================================================
     DELETE LESSON
     ============================================================ */

  const handleDeleteLesson = async (
    moduleId,
    lesson
  ) => {
    const confirmed = window.confirm(
      `Delete "${lesson.title}"?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      clearMessages();

      await deleteLesson(
        courseId,
        moduleId,
        lesson.id
      );

      showSuccess("Lesson deleted successfully.");

      await loadCourse();
    } catch (err) {
      console.error("Lesson delete error:", err);
      setError(err.message || "Failed to delete lesson.");
    } finally {
      setSaving(false);
    }
  };


  /* ============================================================
     STATUS
     ============================================================ */

  const getStatusClasses = (status) => {
    switch (status) {
      case "published":
        return "bg-green-50 text-green-700 border-green-200";

      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";

      case "rejected":
        return "bg-red-50 text-red-700 border-red-200";

      case "archived":
        return "bg-slate-100 text-slate-600 border-slate-200";

      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };


  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-76px)] items-center justify-center">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2
            size={22}
            className="animate-spin text-violet-600"
          />
          <span className="text-sm font-medium">
            Loading course content...
          </span>
        </div>
      </div>
    );
  }


  /* ============================================================
     MAIN UI
     ============================================================ */

  return (
    <div className="min-h-[calc(100vh-76px)] bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">

        {/* BACK */}

        <button
          type="button"
          onClick={() => navigate("/teacher")}
          className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-violet-600"
        >
          <ArrowLeft size={17} />
          Back to Dashboard
        </button>


        {/* COURSE HEADER */}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

            <div className="flex items-start gap-4">

              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-50">
                {course?.thumbnailUrl ? (
                  <img
                    src={course.thumbnailUrl}
                    alt={course.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <BookOpen
                    size={24}
                    className="text-violet-600"
                  />
                )}
              </div>

              <div className="min-w-0">

                <div className="mb-1 flex flex-wrap items-center gap-2">

                  <h1 className="text-xl font-bold text-slate-900">
                    {course?.title || "Course Content"}
                  </h1>

                  <span
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${getStatusClasses(
                      course?.status
                    )}`}
                  >
                    {course?.status || "draft"}
                  </span>

                </div>

                <p className="text-sm text-slate-500">
                  Build your course modules and lessons.
                </p>

              </div>
            </div>


            <button
              type="button"
              onClick={openCreateModule}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={18} />
              Add Module
            </button>

          </div>
        </div>


        {/* MESSAGES */}

        {error && (
          <div className="mb-5 flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p>{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0 text-red-500 hover:text-red-700"
            >
              <X size={17} />
            </button>
          </div>
        )}


        {success && (
          <div className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            {success}
          </div>
        )}


        {/* COURSE STRUCTURE */}

        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Course Structure
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {modules.length}{" "}
              {modules.length === 1
                ? "module"
                : "modules"}{" "}
              in this course
            </p>
          </div>
        </div>


        {/* EMPTY STATE */}

        {modules.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">

            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <BookOpen size={25} />
            </div>

            <h3 className="mt-4 text-base font-bold text-slate-900">
              Start building your course
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Create your first module, then add lessons,
              videos and resources inside it.
            </p>

            <button
              type="button"
              onClick={openCreateModule}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
            >
              <Plus size={17} />
              Create First Module
            </button>

          </div>
        )}


        {/* MODULES */}

        <div className="space-y-4">

          {modules.map((module, moduleIndex) => {

            const isExpanded =
              expandedModules[module.id];

            return (
              <div
                key={module.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >

                {/* MODULE HEADER */}

                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">

                  <button
                    type="button"
                    onClick={() =>
                      toggleModule(module.id)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >

                    <GripVertical
                      size={17}
                      className="hidden shrink-0 text-slate-300 sm:block"
                    />

                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-xs font-bold text-violet-700">
                      {moduleIndex + 1}
                    </span>

                    <span className="min-w-0 flex-1">

                      <span className="flex items-center gap-2">

                        {isExpanded ? (
                          <ChevronDown
                            size={17}
                            className="shrink-0 text-slate-400"
                          />
                        ) : (
                          <ChevronRight
                            size={17}
                            className="shrink-0 text-slate-400"
                          />
                        )}

                        <span className="truncate text-sm font-bold text-slate-900">
                          {module.title}
                        </span>

                      </span>

                      <span className="ml-7 mt-0.5 block text-xs text-slate-400">
                        {module.lessons?.length || 0}{" "}
                        {(module.lessons?.length || 0) === 1
                          ? "lesson"
                          : "lessons"}
                      </span>

                    </span>

                  </button>


                  {/* MODULE ACTIONS */}

                  <div className="flex shrink-0 items-center gap-1">

                    <button
                      type="button"
                      onClick={() =>
                        openEditModule(module)
                      }
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
                      title="Edit module"
                    >
                      <Edit3 size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteModule(module)
                      }
                      disabled={saving}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                      title="Delete module"
                    >
                      <Trash2 size={16} />
                    </button>

                  </div>

                </div>


                {/* MODULE BODY */}

                {isExpanded && (
                  <div className="bg-slate-50/50 p-4 sm:p-5">

                    {/* DESCRIPTION */}

                    {module.description && (
                      <p className="mb-4 rounded-xl bg-white px-4 py-3 text-sm leading-6 text-slate-500">
                        {module.description}
                      </p>
                    )}


                    {/* LESSONS */}

                    <div className="space-y-2">

                      {module.lessons?.map(
                        (lesson, lessonIndex) => (
                          <div
                            key={lesson.id}
                            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-violet-200"
                          >

                            <GripVertical
                              size={16}
                              className="hidden shrink-0 text-slate-300 sm:block"
                            />

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                              {lesson.type === "pdf" ? (
                                <FileText size={17} />
                              ) : (
                                <Video size={17} />
                              )}
                            </div>

                            <div className="min-w-0 flex-1">

                              <div className="flex flex-wrap items-center gap-2">

                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {lessonIndex + 1}.{" "}
                                  {lesson.title}
                                </p>

                                {lesson.published ? (
                                  <span className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                    Published
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                    Draft
                                  </span>
                                )}

                              </div>

                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">

                                <span className="capitalize">
                                  {lesson.type || "video"}
                                </span>

                                {lesson.duration && (
                                  <span>
                                    {lesson.duration}
                                  </span>
                                )}

                                {lesson.videoUrl && (
                                  <span>
                                    Video added
                                  </span>
                                )}

                                {lesson.resourceUrl && (
                                  <span>
                                    Resource added
                                  </span>
                                )}

                              </div>

                            </div>


                            {/* LESSON ACTIONS */}

                            <div className="flex shrink-0 items-center gap-1">

                              <button
                                type="button"
                                onClick={() =>
                                  openEditLesson(
                                    module.id,
                                    lesson
                                  )
                                }
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600"
                                title="Edit lesson"
                              >
                                <Edit3 size={15} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteLesson(
                                    module.id,
                                    lesson
                                  )
                                }
                                disabled={saving}
                                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                title="Delete lesson"
                              >
                                <Trash2 size={15} />
                              </button>

                            </div>

                          </div>
                        )
                      )}

                    </div>


                    {/* ADD LESSON */}

                    <button
                      type="button"
                      onClick={() =>
                        openCreateLesson(module.id)
                      }
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-violet-200 bg-violet-50/50 px-4 py-3 text-sm font-semibold text-violet-700 transition hover:border-violet-300 hover:bg-violet-50"
                    >
                      <Plus size={17} />
                      Add Lesson
                    </button>

                  </div>
                )}

              </div>
            );
          })}

        </div>

      </div>


      {/* ========================================================
          MODULE MODAL
          ======================================================== */}

      {showModuleForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">

          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingModule
                    ? "Edit Module"
                    : "Create Module"}
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Organize your course into learning sections.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModuleForm}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>

            </div>


            <form
              onSubmit={handleModuleSubmit}
              className="space-y-5 p-5"
            >

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Module Title
                </label>

                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(event) =>
                    setModuleForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. HTML Fundamentals"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  autoFocus
                />

              </div>


              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                  <span className="ml-1 font-normal text-slate-400">
                    (optional)
                  </span>
                </label>

                <textarea
                  rows={4}
                  value={moduleForm.description}
                  onChange={(event) =>
                    setModuleForm((previous) => ({
                      ...previous,
                      description:
                        event.target.value,
                    }))
                  }
                  placeholder="What will students learn in this module?"
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />

              </div>


              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">

                <button
                  type="button"
                  onClick={closeModuleForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  {editingModule
                    ? "Save Changes"
                    : "Create Module"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* ========================================================
          LESSON MODAL
          ======================================================== */}

      {showLessonForm && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">

          <div className="mx-auto my-8 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {editingLesson
                    ? "Edit Lesson"
                    : "Create Lesson"}
                </h3>

                <p className="mt-1 text-xs text-slate-400">
                  Add learning material to this module.
                </p>
              </div>

              <button
                type="button"
                onClick={closeLessonForm}
                disabled={saving}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={18} />
              </button>

            </div>


            <form
              onSubmit={handleLessonSubmit}
              className="space-y-5 p-5"
            >

              {/* TITLE */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Lesson Title
                </label>

                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={(event) =>
                    setLessonForm((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Introduction to HTML"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  autoFocus
                />

              </div>


              {/* DESCRIPTION */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Description
                </label>

                <textarea
                  rows={4}
                  value={lessonForm.description}
                  onChange={(event) =>
                    setLessonForm((previous) => ({
                      ...previous,
                      description:
                        event.target.value,
                    }))
                  }
                  placeholder="Explain what students will learn..."
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />

              </div>


              {/* TYPE + DURATION */}

              <div className="grid gap-4 sm:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Lesson Type
                  </label>

                  <select
                    value={lessonForm.type}
                    onChange={(event) =>
                      setLessonForm((previous) => ({
                        ...previous,
                        type: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  >
                    <option value="video">
                      Video
                    </option>
                    <option value="pdf">
                      PDF / Resource
                    </option>
                    <option value="text">
                      Text Lesson
                    </option>
                  </select>

                </div>


                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Duration
                  </label>

                  <input
                    type="text"
                    value={lessonForm.duration}
                    onChange={(event) =>
                      setLessonForm((previous) => ({
                        ...previous,
                        duration:
                          event.target.value,
                      }))
                    }
                    placeholder="e.g. 18 min"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />

                </div>

              </div>


              {/* VIDEO */}

              {lessonForm.type === "video" && (
                <div>

                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Video URL
                  </label>

                  <input
                    type="url"
                    value={lessonForm.videoUrl}
                    onChange={(event) =>
                      setLessonForm((previous) => ({
                        ...previous,
                        videoUrl:
                          event.target.value,
                      }))
                    }
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                  />

                  <p className="mt-1.5 text-xs text-slate-400">
                    Video uploading to Firebase Storage can be connected next.
                  </p>

                </div>
              )}


              {/* THUMBNAIL */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Thumbnail URL
                </label>

                <input
                  type="url"
                  value={lessonForm.thumbnailUrl}
                  onChange={(event) =>
                    setLessonForm((previous) => ({
                      ...previous,
                      thumbnailUrl:
                        event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />

              </div>


              {/* RESOURCE */}

              <div>

                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Resource / PDF URL
                </label>

                <input
                  type="url"
                  value={lessonForm.resourceUrl}
                  onChange={(event) =>
                    setLessonForm((previous) => ({
                      ...previous,
                      resourceUrl:
                        event.target.value,
                    }))
                  }
                  placeholder="https://..."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                />

              </div>


              {/* PUBLISH */}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">

                <input
                  type="checkbox"
                  checked={lessonForm.published}
                  onChange={(event) =>
                    setLessonForm((previous) => ({
                      ...previous,
                      published:
                        event.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />

                <div>

                  <p className="text-sm font-semibold text-slate-800">
                    Publish lesson
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    Published lessons can be shown to enrolled students.
                  </p>

                </div>

              </label>


              {/* ACTIONS */}

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">

                <button
                  type="button"
                  onClick={closeLessonForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                >

                  {saving ? (
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                  ) : (
                    <Save size={17} />
                  )}

                  {editingLesson
                    ? "Save Lesson"
                    : "Create Lesson"}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
};

export default CourseContent;