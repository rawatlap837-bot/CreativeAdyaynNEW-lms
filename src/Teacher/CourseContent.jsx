import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Check,
  FileText,
  GripVertical,
  ClipboardList,
  Loader2,
  Pencil,
  PlayCircle,
  Plus,
  Send,
  Trash2,
  Upload,
  Video,
  X,
} from "lucide-react";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import { auth, db, storage } from "../firebase/Firebase";

const STATUS = {
  DRAFT: "draft",
  PENDING: "pending",
  PUBLISHED: "published",
  REJECTED: "rejected",
  ARCHIVED: "archived",
};

const LESSON_TYPES = {
  VIDEO: "video",
  TEXT: "text",
};

export default function CourseContent() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expandedModules, setExpandedModules] = useState({});

  const [showModuleModal, setShowModuleModal] = useState(false);
  const [editingModule, setEditingModule] = useState(null);
  const [moduleTitle, setModuleTitle] = useState("");

  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [activeModuleId, setActiveModuleId] = useState(null);

  const [lessonForm, setLessonForm] = useState({
    title: "",
    type: LESSON_TYPES.VIDEO,
    description: "",
    duration: "",
    videoUrl: "",
    videoPath: "",
    isPreview: false,
  });

  const [lessonVideo, setLessonVideo] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const videoInputRef = useRef(null);

  useEffect(() => {
    loadCourse();
  }, [courseId]);

  const loadCourse = async () => {
    try {
      setLoading(true);
      setError("");

      const currentUser = auth.currentUser;

      if (!currentUser) {
        navigate("/login", {
          replace: true,
          state: {
            from: `/teacher/courses/${courseId}/content`,
          },
        });
        return;
      }

      const courseRef = doc(db, "courses", courseId);
      const courseSnapshot = await getDoc(courseRef);

      if (!courseSnapshot.exists()) {
        setError("Course not found.");
        return;
      }

      const courseData = {
        id: courseSnapshot.id,
        ...courseSnapshot.data(),
      };

      /*
       * IMPORTANT:
       * Teacher can only access their own course.
       */
      if (courseData.instructorId !== currentUser.uid) {
        setError(
          "You do not have permission to manage this course."
        );
        return;
      }

      setCourse(courseData);

      await loadModules();

      /*
       * Automatically expand modules when first loaded.
       */
      setExpandedModules((previous) => {
        const next = { ...previous };

        return next;
      });
    } catch (err) {
      console.error("Load course content error:", err);

      setError(
        err?.message ||
        "Unable to load the course content."
      );
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async () => {
    const modulesRef = collection(
      db,
      "courses",
      courseId,
      "modules"
    );

    const modulesQuery = query(
      modulesRef,
      orderBy("order", "asc")
    );

    const moduleSnapshot = await getDocs(modulesQuery);

    const moduleList = [];

    for (const moduleDoc of moduleSnapshot.docs) {
      const moduleData = {
        id: moduleDoc.id,
        ...moduleDoc.data(),
        lessons: [],
      };

      const lessonsRef = collection(
        db,
        "courses",
        courseId,
        "modules",
        moduleDoc.id,
        "lessons"
      );

      const lessonsQuery = query(
        lessonsRef,
        orderBy("order", "asc")
      );

      const lessonSnapshot = await getDocs(lessonsQuery);

      moduleData.lessons = lessonSnapshot.docs.map(
        (lessonDoc) => ({
          id: lessonDoc.id,
          ...lessonDoc.data(),
        })
      );

      moduleList.push(moduleData);
    }

    setModules(moduleList);
  };

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const isLocked =
    course?.status === STATUS.PENDING ||
    course?.status === STATUS.ARCHIVED;

  const isPublished =
    course?.status === STATUS.PUBLISHED;

  /*
   * -------------------------------------------------------
   * MODULES
   * -------------------------------------------------------
   */

  const openAddModule = () => {
    if (isLocked) return;

    clearMessages();

    setEditingModule(null);
    setModuleTitle("");
    setShowModuleModal(true);
  };

  const openEditModule = (module) => {
    if (isLocked) return;

    clearMessages();

    setEditingModule(module);
    setModuleTitle(module.title || "");
    setShowModuleModal(true);
  };

  const closeModuleModal = () => {
    if (saving) return;

    setShowModuleModal(false);
    setEditingModule(null);
    setModuleTitle("");
  };

  const saveModule = async () => {
    if (!moduleTitle.trim()) {
      setError("Module title is required.");
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      if (editingModule) {
        const moduleRef = doc(
          db,
          "courses",
          courseId,
          "modules",
          editingModule.id
        );

        await updateDoc(moduleRef, {
          title: moduleTitle.trim(),
          updatedAt: serverTimestamp(),
        });

        setSuccess("Module updated successfully.");
      } else {
        const moduleRef = collection(
          db,
          "courses",
          courseId,
          "modules"
        );

        await addDoc(moduleRef, {
          title: moduleTitle.trim(),
          order: modules.length,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        setSuccess("Module created successfully.");
      }

      closeModuleModal();
      await loadModules();
    } catch (err) {
      console.error("Save module error:", err);

      setError(
        err?.message || "Unable to save module."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteModule = async (module) => {
    if (isLocked) return;

    const confirmed = window.confirm(
      `Delete "${module.title}" and all of its lessons? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      clearMessages();

      /*
       * Delete lessons first.
       */
      const lessonsRef = collection(
        db,
        "courses",
        courseId,
        "modules",
        module.id,
        "lessons"
      );

      const lessonSnapshot = await getDocs(lessonsRef);

      for (const lessonDoc of lessonSnapshot.docs) {
        const lessonData = lessonDoc.data();

        /*
         * Delete associated video from Storage
         * when a videoPath exists.
         */
        if (lessonData.videoPath) {
          try {
            const videoRef = ref(
              storage,
              lessonData.videoPath
            );

            await deleteObject(videoRef);
          } catch (storageError) {
            console.warn(
              "Video could not be deleted:",
              storageError
            );
          }
        }

        await deleteDoc(lessonDoc.ref);
      }

      /*
       * Delete module.
       */
      await deleteDoc(
        doc(
          db,
          "courses",
          courseId,
          "modules",
          module.id
        )
      );

      /*
       * Re-number remaining modules.
       */
      const remainingModules = modules.filter(
        (item) => item.id !== module.id
      );

      for (let index = 0; index < remainingModules.length; index++) {
        await updateDoc(
          doc(
            db,
            "courses",
            courseId,
            "modules",
            remainingModules[index].id
          ),
          {
            order: index,
            updatedAt: serverTimestamp(),
          }
        );
      }

      await loadModules();

      setSuccess("Module deleted successfully.");
    } catch (err) {
      console.error("Delete module error:", err);

      setError(
        err?.message || "Unable to delete module."
      );
    } finally {
      setSaving(false);
    }
  };

  const moveModule = async (index, direction) => {
    if (isLocked) return;

    const targetIndex =
      direction === "up" ? index - 1 : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= modules.length
    ) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const currentModule = modules[index];
      const targetModule = modules[targetIndex];

      await updateDoc(
        doc(
          db,
          "courses",
          courseId,
          "modules",
          currentModule.id
        ),
        {
          order: targetIndex,
          updatedAt: serverTimestamp(),
        }
      );

      await updateDoc(
        doc(
          db,
          "courses",
          courseId,
          "modules",
          targetModule.id
        ),
        {
          order: index,
          updatedAt: serverTimestamp(),
        }
      );

      await loadModules();
    } catch (err) {
      console.error("Move module error:", err);

      setError(
        err?.message || "Unable to reorder modules."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * -------------------------------------------------------
   * LESSONS
   * -------------------------------------------------------
   */

  const openAddLesson = (moduleId) => {
    if (isLocked) return;

    clearMessages();

    setActiveModuleId(moduleId);
    setEditingLesson(null);

    setLessonForm({
      title: "",
      type: LESSON_TYPES.VIDEO,
      description: "",
      duration: "",
      videoUrl: "",
      videoPath: "",
      isPreview: false,
    });

    setLessonVideo(null);

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setVideoPreviewUrl("");
    setUploadProgress(0);

    setShowLessonModal(true);
  };

  const openEditLesson = (moduleId, lesson) => {
    if (isLocked) return;

    clearMessages();

    setActiveModuleId(moduleId);
    setEditingLesson(lesson);

    setLessonForm({
      title: lesson.title || "",
      type: lesson.type || LESSON_TYPES.VIDEO,
      description: lesson.description || "",
      duration: lesson.duration || "",
      videoUrl: lesson.videoUrl || "",
      videoPath: lesson.videoPath || "",
      isPreview: Boolean(lesson.isPreview),
    });

    setLessonVideo(null);

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setVideoPreviewUrl("");
    setUploadProgress(0);

    setShowLessonModal(true);
  };

  const closeLessonModal = () => {
    if (uploadingVideo) return;

    setShowLessonModal(false);
    setEditingLesson(null);
    setActiveModuleId(null);
    setLessonVideo(null);

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setVideoPreviewUrl("");
    setUploadProgress(0);
  };

  const updateLessonField = (field, value) => {
    setLessonForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    clearMessages();
  };

  const handleLessonVideoChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please select a valid video file.");
      return;
    }

    /*
     * Keep the same 500MB limit used by the Storage rules.
     */
    if (file.size > 500 * 1024 * 1024) {
      setError("Video must be smaller than 500MB.");
      return;
    }

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }

    setLessonVideo(file);
    setVideoPreviewUrl(URL.createObjectURL(file));

    setError("");
    setSuccess("");
  };

  const uploadLessonVideo = async (
    moduleId,
    lessonId,
    file
  ) => {
    const extension =
      file.name.split(".").pop()?.toLowerCase() || "mp4";

    const safeExtension = extension.replace(
      /[^a-z0-9]/g,
      ""
    );

    /*
     * Matches storage.rules:
     *
     * courseVideos/{courseId}/{moduleId}/{lessonId}/{fileName}
     */
    const storagePath =
      `courseVideos/${courseId}/${moduleId}/${lessonId}/` +
      `video-${Date.now()}.${safeExtension}`;

    const storageRef = ref(storage, storagePath);

    const uploadTask = uploadBytesResumable(
      storageRef,
      file,
      {
        contentType: file.type,
      }
    );

    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = Math.round(
            (snapshot.bytesTransferred /
              snapshot.totalBytes) *
            100
          );

          setUploadProgress(progress);
        },
        (uploadError) => {
          reject(uploadError);
        },
        async () => {
          try {
            const downloadUrl =
              await getDownloadURL(
                uploadTask.snapshot.ref
              );

            resolve({
              url: downloadUrl,
              path: storagePath,
            });
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  };

  const deleteLessonVideo = async (videoPath) => {
    if (!videoPath) return;

    try {
      await deleteObject(
        ref(storage, videoPath)
      );
    } catch (err) {
      console.warn(
        "Unable to delete lesson video:",
        err
      );
    }
  };

  const saveLesson = async () => {
    if (!activeModuleId) {
      setError("No module selected.");
      return;
    }

    if (!lessonForm.title.trim()) {
      setError("Lesson title is required.");
      return;
    }

    if (
      lessonForm.type === LESSON_TYPES.VIDEO &&
      !editingLesson &&
      !lessonVideo
    ) {
      setError("Please upload a video for this lesson.");
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const lessonsRef = collection(
        db,
        "courses",
        courseId,
        "modules",
        activeModuleId,
        "lessons"
      );

      let lessonId = editingLesson?.id;

      /*
       * ---------------------------------------------------
       * CREATE LESSON
       * ---------------------------------------------------
       */
      if (!editingLesson) {
        const existingSnapshot = await getDocs(
          lessonsRef
        );

        lessonId = null;

        const newLessonRef = await addDoc(
          lessonsRef,
          {
            title: lessonForm.title.trim(),
            type: lessonForm.type,
            description:
              lessonForm.description.trim(),
            duration: lessonForm.duration.trim(),
            videoUrl: null,
            videoPath: null,
            isPreview: Boolean(
              lessonForm.isPreview
            ),
            order: existingSnapshot.size,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }
        );

        lessonId = newLessonRef.id;
      }

      /*
       * ---------------------------------------------------
       * UPLOAD VIDEO
       * ---------------------------------------------------
       */
      let videoUrl = lessonForm.videoUrl || null;
      let videoPath = lessonForm.videoPath || null;

      if (
        lessonForm.type === LESSON_TYPES.VIDEO &&
        lessonVideo
      ) {
        setUploadingVideo(true);
        setUploadProgress(0);

        const uploaded = await uploadLessonVideo(
          activeModuleId,
          lessonId,
          lessonVideo
        );

        /*
         * Delete old video only after the new upload
         * has successfully completed.
         */
        if (
          videoPath &&
          videoPath !== uploaded.path
        ) {
          await deleteLessonVideo(videoPath);
        }

        videoUrl = uploaded.url;
        videoPath = uploaded.path;

        setUploadingVideo(false);
      }

      /*
       * ---------------------------------------------------
       * SAVE LESSON
       * ---------------------------------------------------
       */
      const lessonRef = doc(
        db,
        "courses",
        courseId,
        "modules",
        activeModuleId,
        "lessons",
        lessonId
      );

      await updateDoc(lessonRef, {
        title: lessonForm.title.trim(),
        type: lessonForm.type,
        description:
          lessonForm.description.trim(),
        duration: lessonForm.duration.trim(),
        videoUrl:
          lessonForm.type === LESSON_TYPES.VIDEO
            ? videoUrl
            : null,
        videoPath:
          lessonForm.type === LESSON_TYPES.VIDEO
            ? videoPath
            : null,
        isPreview: Boolean(
          lessonForm.isPreview
        ),
        updatedAt: serverTimestamp(),
      });

      closeLessonModal();

      await loadModules();

      setSuccess(
        editingLesson
          ? "Lesson updated successfully."
          : "Lesson created successfully."
      );
    } catch (err) {
      console.error("Save lesson error:", err);

      setUploadingVideo(false);

      setError(
        err?.message || "Unable to save lesson."
      );
    } finally {
      setSaving(false);
      setUploadProgress(0);
    }
  };

  const deleteLesson = async (moduleId, lesson) => {
    if (isLocked) return;

    const confirmed = window.confirm(
      `Delete "${lesson.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      clearMessages();

      if (lesson.videoPath) {
        await deleteLessonVideo(
          lesson.videoPath
        );
      }

      await deleteDoc(
        doc(
          db,
          "courses",
          courseId,
          "modules",
          moduleId,
          "lessons",
          lesson.id
        )
      );

      /*
       * Re-number remaining lessons.
       */
      const module = modules.find(
        (item) => item.id === moduleId
      );

      const remainingLessons =
        module?.lessons.filter(
          (item) => item.id !== lesson.id
        ) || [];

      for (
        let index = 0;
        index < remainingLessons.length;
        index++
      ) {
        await updateDoc(
          doc(
            db,
            "courses",
            courseId,
            "modules",
            moduleId,
            "lessons",
            remainingLessons[index].id
          ),
          {
            order: index,
            updatedAt: serverTimestamp(),
          }
        );
      }

      await loadModules();

      setSuccess("Lesson deleted successfully.");
    } catch (err) {
      console.error("Delete lesson error:", err);

      setError(
        err?.message || "Unable to delete lesson."
      );
    } finally {
      setSaving(false);
    }
  };

  const moveLesson = async (
    moduleId,
    lessonIndex,
    direction
  ) => {
    if (isLocked) return;

    const module = modules.find(
      (item) => item.id === moduleId
    );

    if (!module) return;

    const targetIndex =
      direction === "up"
        ? lessonIndex - 1
        : lessonIndex + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= module.lessons.length
    ) {
      return;
    }

    try {
      setSaving(true);
      clearMessages();

      const currentLesson =
        module.lessons[lessonIndex];

      const targetLesson =
        module.lessons[targetIndex];

      await updateDoc(
        doc(
          db,
          "courses",
          courseId,
          "modules",
          moduleId,
          "lessons",
          currentLesson.id
        ),
        {
          order: targetIndex,
          updatedAt: serverTimestamp(),
        }
      );

      await updateDoc(
        doc(
          db,
          "courses",
          courseId,
          "modules",
          moduleId,
          "lessons",
          targetLesson.id
        ),
        {
          order: lessonIndex,
          updatedAt: serverTimestamp(),
        }
      );

      await loadModules();
    } catch (err) {
      console.error("Move lesson error:", err);

      setError(
        err?.message || "Unable to reorder lessons."
      );
    } finally {
      setSaving(false);
    }
  };

  /*
   * -------------------------------------------------------
   * SUBMIT
   * -------------------------------------------------------
   */

  const submitCourse = async () => {
    if (!course) return;

    if (
      course.status !== STATUS.DRAFT &&
      course.status !== STATUS.REJECTED
    ) {
      return;
    }

    if (modules.length === 0) {
      setError(
        "Add at least one module before submitting."
      );
      return;
    }

    const lessonCount = modules.reduce(
      (total, module) =>
        total + module.lessons.length,
      0
    );

    if (lessonCount === 0) {
      setError(
        "Add at least one lesson before submitting."
      );
      return;
    }

    const confirmed = window.confirm(
      "Submit this course for admin approval? You will not be able to edit it while it is pending."
    );

    if (!confirmed) return;

    try {
      setSubmitting(true);
      clearMessages();

      await updateDoc(
        doc(db, "courses", courseId),
        {
          status: STATUS.PENDING,
          rejectionReason: null,
          updatedAt: serverTimestamp(),
        }
      );

      setCourse((previous) => ({
        ...previous,
        status: STATUS.PENDING,
        rejectionReason: null,
      }));

      setSuccess(
        "Course submitted successfully for admin approval."
      );
    } catch (err) {
      console.error(
        "Submit course error:",
        err
      );

      setError(
        err?.message ||
        "Unable to submit the course."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /*
   * -------------------------------------------------------
   * UI
   * -------------------------------------------------------
   */

  const toggleModule = (moduleId) => {
    setExpandedModules((previous) => ({
      ...previous,
      [moduleId]: !previous[moduleId],
    }));
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">
            Unable to load course
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {error || "Course not found."}
          </p>

          <button
            type="button"
            onClick={() =>
              navigate("/teacher/courses")
            }
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ArrowLeft size={17} />
            Back to My Courses
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* HEADER */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() =>
                  navigate("/teacher/courses")
                }
                disabled={saving || submitting}
                className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 disabled:opacity-50"
              >
                <ArrowLeft size={17} />
                My Courses
              </button>

              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Course Content
                </h1>

                <StatusBadge
                  status={course.status}
                />
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {course.title}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/teacher/courses/${courseId}/assignments`
                  )
                }
                disabled={saving || submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm font-semibold text-purple-700 hover:bg-purple-100 disabled:opacity-50 sm:w-auto"
              >
                <ClipboardList size={17} />
                Assignments
              </button>

              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/teacher/courses/edit/${courseId}`
                  )
                }
                disabled={saving || submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
              >
                <Pencil size={17} />
                Course Details
              </button>

              {!isLocked &&
                (course.status === STATUS.DRAFT ||
                  course.status ===
                  STATUS.REJECTED) && (
                  <button
                    type="button"
                    onClick={submitCourse}
                    disabled={
                      saving || submitting
                    }
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
                  >
                    {submitting ? (
                      <Loader2
                        size={17}
                        className="animate-spin"
                      />
                    ) : (
                      <Send size={17} />
                    )}

                    {submitting
                      ? "Submitting..."
                      : "Submit for Approval"}
                  </button>
                )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* REJECTION */}
        {course.status === STATUS.REJECTED &&
          course.rejectionReason && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5">
              <h2 className="font-semibold text-red-900">
                Changes Requested by Admin
              </h2>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {course.rejectionReason}
              </p>

              <p className="mt-2 text-xs text-red-600">
                Make the requested changes and submit
                the course again.
              </p>
            </div>
          )}

        {/* PENDING */}
        {course.status === STATUS.PENDING && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                <Send size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-amber-900">
                  Waiting for Admin Approval
                </h2>

                <p className="mt-1 text-sm leading-6 text-amber-700">
                  Your course has been submitted for
                  review. Editing is locked until the
                  administrator makes a decision.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PUBLISHED */}
        {isPublished && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-emerald-900">
                  Course Published
                </h2>

                <p className="mt-1 text-sm leading-6 text-emerald-700">
                  Students can access this course from
                  the main LMS.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TOOLBAR */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-slate-900">
              Curriculum
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {modules.length}{" "}
              {modules.length === 1
                ? "module"
                : "modules"}{" "}
              ·{" "}
              {modules.reduce(
                (total, module) =>
                  total + module.lessons.length,
                0
              )}{" "}
              lessons
            </p>
          </div>

          <button
            type="button"
            onClick={openAddModule}
            disabled={isLocked || saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <Plus size={18} />
            Add Module
          </button>
        </div>

        {/* EMPTY */}
        {modules.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <BookOpen size={27} />
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900">
              No modules yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Start building your course by creating your
              first module. You can then add lessons and
              videos inside it.
            </p>

            {!isLocked && (
              <button
                type="button"
                onClick={openAddModule}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <Plus size={17} />
                Create First Module
              </button>
            )}
          </div>
        )}

        {/* MODULES */}
        <div className="space-y-4">
          {modules.map((module, moduleIndex) => {
            const expanded =
              expandedModules[module.id] !== false;

            return (
              <section
                key={module.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                {/* MODULE HEADER */}
                <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-1 text-slate-300">
                      <GripVertical size={20} />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        toggleModule(module.id)
                      }
                      className="flex min-w-0 items-start gap-3 text-left"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <BookOpen size={19} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Module {moduleIndex + 1}
                          </span>

                          <span className="text-xs text-slate-400">
                            {module.lessons.length}{" "}
                            {module.lessons.length ===
                              1
                              ? "lesson"
                              : "lessons"}
                          </span>
                        </div>

                        <h3 className="mt-1 truncate font-semibold text-slate-900">
                          {module.title}
                        </h3>
                      </div>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-10 sm:pl-0">
                    {!isLocked && (
                      <>
                        <IconButton
                          title="Move up"
                          disabled={
                            moduleIndex === 0 ||
                            saving
                          }
                          onClick={() =>
                            moveModule(
                              moduleIndex,
                              "up"
                            )
                          }
                        >
                          <ChevronUp size={17} />
                        </IconButton>

                        <IconButton
                          title="Move down"
                          disabled={
                            moduleIndex ===
                            modules.length -
                            1 || saving
                          }
                          onClick={() =>
                            moveModule(
                              moduleIndex,
                              "down"
                            )
                          }
                        >
                          <ChevronDown size={17} />
                        </IconButton>

                        <IconButton
                          title="Edit module"
                          disabled={saving}
                          onClick={() =>
                            openEditModule(module)
                          }
                        >
                          <Pencil size={16} />
                        </IconButton>

                        <IconButton
                          title="Delete module"
                          danger
                          disabled={saving}
                          onClick={() =>
                            deleteModule(module)
                          }
                        >
                          <Trash2 size={16} />
                        </IconButton>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        toggleModule(module.id)
                      }
                      className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      {expanded ? (
                        <ChevronUp size={18} />
                      ) : (
                        <ChevronDown size={18} />
                      )}
                    </button>
                  </div>
                </div>

                {/* LESSONS */}
                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60">
                    {module.lessons.length === 0 ? (
                      <div className="px-6 py-8 text-center">
                        <FileText
                          size={24}
                          className="mx-auto text-slate-300"
                        />

                        <p className="mt-2 text-sm text-slate-500">
                          No lessons in this module.
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-200">
                        {module.lessons.map(
                          (lesson, lessonIndex) => (
                            <LessonRow
                              key={lesson.id}
                              lesson={lesson}
                              lessonIndex={
                                lessonIndex
                              }
                              lessonCount={
                                module.lessons
                                  .length
                              }
                              locked={isLocked}
                              saving={saving}
                              onEdit={() =>
                                openEditLesson(
                                  module.id,
                                  lesson
                                )
                              }
                              onDelete={() =>
                                deleteLesson(
                                  module.id,
                                  lesson
                                )
                              }
                              onMoveUp={() =>
                                moveLesson(
                                  module.id,
                                  lessonIndex,
                                  "up"
                                )
                              }
                              onMoveDown={() =>
                                moveLesson(
                                  module.id,
                                  lessonIndex,
                                  "down"
                                )
                              }
                            />
                          )
                        )}
                      </div>
                    )}

                    {!isLocked && (
                      <div className="border-t border-slate-200 p-4">
                        <button
                          type="button"
                          onClick={() =>
                            openAddLesson(
                              module.id
                            )
                          }
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
                        >
                          <Plus size={17} />
                          Add Lesson
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>

        {/* MESSAGES */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <X
              size={17}
              className="mt-0.5 shrink-0"
            />

            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <Check
              size={17}
              className="mt-0.5 shrink-0"
            />

            <span>{success}</span>
          </div>
        )}
      </main>

      {/* MODULE MODAL */}
      {showModuleModal && (
        <Modal
          title={
            editingModule
              ? "Edit Module"
              : "Add Module"
          }
          onClose={closeModuleModal}
          disabled={saving}
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Module Title
            </label>

            <input
              autoFocus
              type="text"
              value={moduleTitle}
              onChange={(event) =>
                setModuleTitle(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !saving
                ) {
                  saveModule();
                }
              }}
              placeholder="e.g. Introduction to Digital Marketing"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closeModuleModal}
              disabled={saving}
              className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={saveModule}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {saving && (
                <Loader2
                  size={17}
                  className="animate-spin"
                />
              )}

              {editingModule
                ? "Save Changes"
                : "Create Module"}
            </button>
          </div>
        </Modal>
      )}

      {/* LESSON MODAL */}
      {showLessonModal && (
        <Modal
          title={
            editingLesson
              ? "Edit Lesson"
              : "Add Lesson"
          }
          onClose={closeLessonModal}
          disabled={saving || uploadingVideo}
          wide
        >
          <div className="space-y-5">
            {/* Title */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Lesson Title
              </label>

              <input
                type="text"
                value={lessonForm.title}
                onChange={(event) =>
                  updateLessonField(
                    "title",
                    event.target.value
                  )
                }
                placeholder="e.g. What is Digital Marketing?"
                disabled={
                  saving || uploadingVideo
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            {/* Type */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Lesson Type
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <LessonTypeCard
                  selected={
                    lessonForm.type ===
                    LESSON_TYPES.VIDEO
                  }
                  icon={<Video size={20} />}
                  title="Video Lesson"
                  description="Teach students through a video."
                  onClick={() =>
                    updateLessonField(
                      "type",
                      LESSON_TYPES.VIDEO
                    )
                  }
                  disabled={
                    saving || uploadingVideo
                  }
                />

                <LessonTypeCard
                  selected={
                    lessonForm.type ===
                    LESSON_TYPES.TEXT
                  }
                  icon={<FileText size={20} />}
                  title="Text Lesson"
                  description="Create a reading-based lesson."
                  onClick={() =>
                    updateLessonField(
                      "type",
                      LESSON_TYPES.TEXT
                    )
                  }
                  disabled={
                    saving || uploadingVideo
                  }
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Lesson Description
              </label>

              <textarea
                rows={5}
                value={lessonForm.description}
                onChange={(event) =>
                  updateLessonField(
                    "description",
                    event.target.value
                  )
                }
                placeholder="Explain what students will learn in this lesson."
                disabled={
                  saving || uploadingVideo
                }
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Duration
              </label>

              <input
                type="text"
                value={lessonForm.duration}
                onChange={(event) =>
                  updateLessonField(
                    "duration",
                    event.target.value
                  )
                }
                placeholder="e.g. 12 min"
                disabled={
                  saving || uploadingVideo
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100"
              />
            </div>

            {/* VIDEO */}
            {lessonForm.type ===
              LESSON_TYPES.VIDEO && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Lesson Video
                  </label>

                  {videoPreviewUrl ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
                      <video
                        src={videoPreviewUrl}
                        controls
                        className="max-h-[300px] w-full"
                      />

                      <div className="flex items-center justify-between gap-3 bg-white px-4 py-3">
                        <span className="max-w-[70%] truncate text-xs text-slate-500">
                          {lessonVideo?.name}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            if (
                              uploadingVideo
                            ) {
                              return;
                            }

                            if (
                              videoPreviewUrl
                            ) {
                              URL.revokeObjectURL(
                                videoPreviewUrl
                              );
                            }

                            setLessonVideo(
                              null
                            );
                            setVideoPreviewUrl(
                              ""
                            );

                            if (
                              videoInputRef.current
                            ) {
                              videoInputRef.current.value =
                                "";
                            }
                          }}
                          disabled={
                            uploadingVideo
                          }
                          className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        videoInputRef.current?.click()
                      }
                      disabled={
                        saving ||
                        uploadingVideo
                      }
                      className="flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center hover:border-blue-400 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-blue-600 shadow-sm">
                        <Upload size={22} />
                      </div>

                      <span className="mt-3 text-sm font-semibold text-slate-700">
                        {editingLesson
                          ? "Replace video"
                          : "Upload lesson video"}
                      </span>

                      <span className="mt-1 text-xs text-slate-400">
                        MP4, WebM or other browser-supported
                        video · Max 500MB
                      </span>
                    </button>
                  )}

                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    onChange={
                      handleLessonVideoChange
                    }
                    className="hidden"
                    disabled={
                      saving ||
                      uploadingVideo
                    }
                  />

                  {editingLesson &&
                    !videoPreviewUrl &&
                    lessonForm.videoUrl && (
                      <div className="mt-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                        <PlayCircle
                          size={16}
                          className="text-blue-600"
                        />

                        <span>
                          Existing video is attached.
                          Upload a new video to replace
                          it.
                        </span>
                      </div>
                    )}
                </div>
              )}

            {/* Preview */}
            {lessonForm.type ===
              LESSON_TYPES.VIDEO && (
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    checked={
                      lessonForm.isPreview
                    }
                    onChange={(event) =>
                      updateLessonField(
                        "isPreview",
                        event.target.checked
                      )
                    }
                    disabled={
                      saving || uploadingVideo
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-slate-800">
                      Make this a preview lesson
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-slate-500">
                      Allows visitors to preview this
                      lesson before purchasing the course.
                    </span>
                  </span>
                </label>
              )}

            {/* Progress */}
            {uploadingVideo && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-blue-900">
                    Uploading video...
                  </span>

                  <span className="font-medium text-blue-700">
                    {uploadProgress}%
                  </span>
                </div>

                <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all"
                    style={{
                      width: `${uploadProgress}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-blue-700">
                  Keep this window open until the upload
                  finishes.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeLessonModal}
                disabled={
                  saving || uploadingVideo
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveLesson}
                disabled={
                  saving || uploadingVideo
                }
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
              >
                {saving || uploadingVideo ? (
                  <Loader2
                    size={17}
                    className="animate-spin"
                  />
                ) : (
                  <Check size={17} />
                )}

                {uploadingVideo
                  ? "Uploading..."
                  : editingLesson
                    ? "Save Lesson"
                    : "Create Lesson"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/*
 * -------------------------------------------------------
 * LESSON ROW
 * -------------------------------------------------------
 */

function LessonRow({
  lesson,
  lessonIndex,
  lessonCount,
  locked,
  saving,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const isVideo =
    lesson.type === LESSON_TYPES.VIDEO;

  return (
    <div className="flex flex-col gap-4 px-4 py-4 sm:flex-row sm:px-5 sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <div className="text-slate-300">
          <GripVertical size={18} />
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isVideo
              ? "bg-blue-50 text-blue-600"
              : "bg-slate-100 text-slate-600"
            }`}
        >
          {isVideo ? (
            <PlayCircle size={19} />
          ) : (
            <FileText size={19} />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400">
              Lesson {lessonIndex + 1}
            </span>

            {lesson.isPreview && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Preview
              </span>
            )}
          </div>

          <h4 className="truncate text-sm font-semibold text-slate-800">
            {lesson.title}
          </h4>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>
              {isVideo ? "Video" : "Text"}
            </span>

            {lesson.duration && (
              <>
                <span>•</span>
                <span>{lesson.duration}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1 pl-12 sm:pl-0">
        {!locked && (
          <>
            <IconButton
              title="Move up"
              disabled={
                lessonIndex === 0 || saving
              }
              onClick={onMoveUp}
            >
              <ChevronUp size={16} />
            </IconButton>

            <IconButton
              title="Move down"
              disabled={
                lessonIndex ===
                lessonCount - 1 || saving
              }
              onClick={onMoveDown}
            >
              <ChevronDown size={16} />
            </IconButton>

            <IconButton
              title="Edit lesson"
              disabled={saving}
              onClick={onEdit}
            >
              <Pencil size={15} />
            </IconButton>

            <IconButton
              title="Delete lesson"
              danger
              disabled={saving}
              onClick={onDelete}
            >
              <Trash2 size={15} />
            </IconButton>
          </>
        )}

        {isVideo && lesson.videoUrl && (
          <a
            href={lesson.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="ml-1 flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            <PlayCircle size={15} />
            Preview
          </a>
        )}
      </div>
    </div>
  );
}

/*
 * -------------------------------------------------------
 * MODAL
 * -------------------------------------------------------
 */

function Modal({
  title,
  children,
  onClose,
  disabled,
  wide = false,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4 backdrop-blur-sm">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl ${wide ? "max-w-2xl" : "max-w-lg"
          }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-5">
          <h2 className="text-lg font-semibold text-slate-900">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X size={19} />
          </button>
        </div>

        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

/*
 * -------------------------------------------------------
 * TYPE CARD
 * -------------------------------------------------------
 */

function LessonTypeCard({
  selected,
  icon,
  title,
  description,
  onClick,
  disabled,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl border-2 p-4 text-left transition ${selected
          ? "border-blue-600 bg-blue-50"
          : "border-slate-200 hover:border-slate-300"
        } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${selected
              ? "bg-blue-100 text-blue-600"
              : "bg-slate-100 text-slate-500"
            }`}
        >
          {icon}
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-800">
            {title}
          </p>

          <p className="mt-0.5 text-xs text-slate-500">
            {description}
          </p>
        </div>

        {selected && (
          <Check
            size={17}
            className="ml-auto text-blue-600"
          />
        )}
      </div>
    </button>
  );
}

/*
 * -------------------------------------------------------
 * STATUS
 * -------------------------------------------------------
 */

function StatusBadge({ status }) {
  const config = {
    draft: {
      label: "Draft",
      className:
        "bg-slate-100 text-slate-700",
    },

    pending: {
      label: "Pending Approval",
      className:
        "bg-amber-100 text-amber-700",
    },

    published: {
      label: "Published",
      className:
        "bg-emerald-100 text-emerald-700",
    },

    rejected: {
      label: "Rejected",
      className:
        "bg-red-100 text-red-700",
    },

    archived: {
      label: "Archived",
      className:
        "bg-slate-200 text-slate-600",
    },
  };

  const item =
    config[status] || config.draft;

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${item.className}`}
    >
      {item.label}
    </span>
  );
}

/*
 * -------------------------------------------------------
 * ICON BUTTON
 * -------------------------------------------------------
 */

function IconButton({
  children,
  onClick,
  disabled,
  danger = false,
  title,
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border bg-white transition disabled:cursor-not-allowed disabled:opacity-40 ${danger
          ? "border-red-200 text-red-500 hover:bg-red-50"
          : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
        }`}
    >
      {children}
    </button>
  );
}

/*
 * -------------------------------------------------------
 * LOADING
 * -------------------------------------------------------
 */

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
        <Loader2
          size={20}
          className="animate-spin"
        />
        Loading course content...
      </div>
    </div>
  );
}
