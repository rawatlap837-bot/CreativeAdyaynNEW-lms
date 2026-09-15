import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  Loader2,
  Save,
  Upload,
  Video,
  X,
} from "lucide-react";
import {
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

import { auth, db } from "../firebase/Firebase";

import {
  updateLesson,
} from "../services/CourseContentService";

import {
  uploadLessonVideo,
  uploadLessonThumbnail,
  uploadLessonResource,
  deleteStorageFile,
} from "../services/StorageService";

/* --------------------------------------------------
   VIDEO LINK HELPERS

   Converts a pasted YouTube / Vimeo URL into an
   embeddable iframe URL. Any other link (e.g. a
   direct .mp4 URL) falls back to a plain <video> tag.
-------------------------------------------------- */

const getYouTubeEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);
    let videoId = "";

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1);
    } else if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        return url;
      }

      if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
    } else {
      return null;
    }

    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  } catch {
    return null;
  }
};

const getVimeoEmbedUrl = (url) => {
  try {
    const parsed = new URL(url);

    if (!parsed.hostname.includes("vimeo.com")) {
      return null;
    }

    const id = parsed.pathname.split("/").filter(Boolean).pop();

    return id ? `https://player.vimeo.com/video/${id}` : null;
  } catch {
    return null;
  }
};

const getEmbedUrl = (url) => {
  if (!url) return null;
  return getYouTubeEmbedUrl(url) || getVimeoEmbedUrl(url);
};

const isLikelyVideoPlatformLink = (url) => {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes("youtube.com") ||
      parsed.hostname.includes("youtu.be") ||
      parsed.hostname.includes("vimeo.com")
    );
  } catch {
    return false;
  }
};

const LessonEditor = () => {
  const navigate = useNavigate();

  const { courseId, moduleId, lessonId } = useParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [course, setCourse] = useState(null);
  const [module, setModule] = useState(null);
  const [lesson, setLesson] = useState(null);

  const [user, setUser] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "video",
    videoUrl: "",
    videoPath: "",
    thumbnailUrl: "",
    thumbnailPath: "",
    resourceUrl: "",
    resourcePath: "",
    duration: "",
    published: false,
  });

  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [resourceFile, setResourceFile] = useState(null);

  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [uploadingResource, setUploadingResource] = useState(false);

  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbnailProgress, setThumbnailProgress] = useState(0);
  const [resourceProgress, setResourceProgress] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // "upload" = file uploaded to storage, "link" = pasted YouTube / Vimeo / direct URL
  const [videoMode, setVideoMode] = useState("upload");
  const [videoLinkInput, setVideoLinkInput] = useState("");
  const [savingVideoLink, setSavingVideoLink] = useState(false);

  /* --------------------------------------------------
     AUTH
  -------------------------------------------------- */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  /* --------------------------------------------------
     LOAD LESSON
  -------------------------------------------------- */

  useEffect(() => {
    const loadLesson = async () => {
      try {
        setLoading(true);
        setError("");

        if (!courseId || !moduleId || !lessonId) {
          throw new Error("Invalid lesson URL.");
        }

        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);

        if (!courseSnap.exists()) {
          throw new Error("Course not found.");
        }

        const courseData = {
          id: courseSnap.id,
          ...courseSnap.data(),
        };

        if (user && courseData.instructorId !== user.uid) {
          throw new Error(
            "You do not have permission to edit this course."
          );
        }

        const moduleRef = doc(
          db,
          "courses",
          courseId,
          "modules",
          moduleId
        );

        const moduleSnap = await getDoc(moduleRef);

        if (!moduleSnap.exists()) {
          throw new Error("Module not found.");
        }

        const moduleData = {
          id: moduleSnap.id,
          ...moduleSnap.data(),
        };

        const lessonRef = doc(
          db,
          "courses",
          courseId,
          "modules",
          moduleId,
          "lessons",
          lessonId
        );

        const lessonSnap = await getDoc(lessonRef);

        if (!lessonSnap.exists()) {
          throw new Error("Lesson not found.");
        }

        const lessonData = {
          id: lessonSnap.id,
          ...lessonSnap.data(),
        };

        setCourse(courseData);
        setModule(moduleData);
        setLesson(lessonData);

        setForm({
          title: lessonData.title || "",
          description: lessonData.description || "",
          type: lessonData.type || "video",
          videoUrl: lessonData.videoUrl || "",
          videoPath: lessonData.videoPath || "",
          thumbnailUrl: lessonData.thumbnailUrl || "",
          thumbnailPath: lessonData.thumbnailPath || "",
          resourceUrl: lessonData.resourceUrl || "",
          resourcePath: lessonData.resourcePath || "",
          duration: lessonData.duration || "",
          published: Boolean(lessonData.published),
        });

        // Decide which video mode to show based on existing data.
        if (!lessonData.videoPath && lessonData.videoUrl) {
          setVideoMode("link");
          setVideoLinkInput(lessonData.videoUrl);
        } else {
          setVideoMode("upload");
        }
      } catch (err) {
        console.error("Lesson loading error:", err);
        setError(err.message || "Failed to load lesson.");
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadLesson();
    }
  }, [user, courseId, moduleId, lessonId]);

  /* --------------------------------------------------
     FORM CHANGE
  -------------------------------------------------- */

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  /* --------------------------------------------------
     VIDEO MODE SWITCH
  -------------------------------------------------- */

  const handleVideoModeChange = (mode) => {
    setVideoMode(mode);
    setError("");
    setSuccess("");

    if (mode === "link") {
      setVideoFile(null);
      setVideoLinkInput(form.videoPath ? "" : form.videoUrl);
    }
  };

  /* --------------------------------------------------
     VIDEO UPLOAD (FILE)
  -------------------------------------------------- */

  const handleVideoUpload = async () => {
    if (!videoFile) {
      setError("Please select a video first.");
      return;
    }

    try {
      setUploadingVideo(true);
      setVideoProgress(0);
      setError("");
      setSuccess("");

      /*
       * StorageService currently uses uploadBytes().
       * Therefore Firebase does not provide real progress
       * callbacks yet.
       *
       * We show an upload state here and set progress to
       * 100 when the upload finishes.
       */

      const result = await uploadLessonVideo(
        videoFile,
        courseId,
        moduleId,
        lessonId
      );

      await updateLesson(courseId, moduleId, lessonId, {
        videoUrl: result.url,
        videoPath: result.path,
      });

      setForm((previous) => ({
        ...previous,
        videoUrl: result.url,
        videoPath: result.path,
      }));

      setVideoProgress(100);
      setVideoFile(null);

      setSuccess("Video uploaded successfully.");
    } catch (err) {
      console.error("Video upload error:", err);
      setError(err.message || "Video upload failed.");
    } finally {
      setUploadingVideo(false);
    }
  };

  /* --------------------------------------------------
     VIDEO LINK SAVE (YOUTUBE / VIMEO / DIRECT URL)
  -------------------------------------------------- */

  const handleSaveVideoLink = async () => {
    const trimmedLink = videoLinkInput.trim();

    if (!trimmedLink) {
      setError("Please paste a video link first.");
      return;
    }

    try {
      new URL(trimmedLink);
    } catch {
      setError("That doesn't look like a valid URL.");
      return;
    }

    try {
      setSavingVideoLink(true);
      setError("");
      setSuccess("");

      // If a file was previously uploaded to storage, remove it
      // since we're replacing it with an external link.
      if (form.videoPath) {
        try {
          await deleteStorageFile(form.videoPath);
        } catch (err) {
          console.error("Failed to remove previous video file:", err);
        }
      }

      await updateLesson(courseId, moduleId, lessonId, {
        videoUrl: trimmedLink,
        videoPath: "",
      });

      setForm((previous) => ({
        ...previous,
        videoUrl: trimmedLink,
        videoPath: "",
      }));

      setSuccess("Video link saved successfully.");
    } catch (err) {
      console.error("Video link save error:", err);
      setError(err.message || "Failed to save video link.");
    } finally {
      setSavingVideoLink(false);
    }
  };

  /* --------------------------------------------------
     THUMBNAIL UPLOAD
  -------------------------------------------------- */

  const handleThumbnailUpload = async () => {
    if (!thumbnailFile) {
      setError("Please select a thumbnail first.");
      return;
    }

    try {
      setUploadingThumbnail(true);
      setThumbnailProgress(0);
      setError("");
      setSuccess("");

      const result = await uploadLessonThumbnail(
        thumbnailFile,
        courseId,
        moduleId,
        lessonId
      );

      await updateLesson(courseId, moduleId, lessonId, {
        thumbnailUrl: result.url,
        thumbnailPath: result.path,
      });

      setForm((previous) => ({
        ...previous,
        thumbnailUrl: result.url,
        thumbnailPath: result.path,
      }));

      setThumbnailProgress(100);
      setThumbnailFile(null);

      setSuccess("Thumbnail uploaded successfully.");
    } catch (err) {
      console.error("Thumbnail upload error:", err);
      setError(err.message || "Thumbnail upload failed.");
    } finally {
      setUploadingThumbnail(false);
    }
  };

  /* --------------------------------------------------
     RESOURCE UPLOAD
  -------------------------------------------------- */

  const handleResourceUpload = async () => {
    if (!resourceFile) {
      setError("Please select a resource first.");
      return;
    }

    try {
      setUploadingResource(true);
      setResourceProgress(0);
      setError("");
      setSuccess("");

      const result = await uploadLessonResource(
        resourceFile,
        courseId,
        moduleId,
        lessonId
      );

      await updateLesson(courseId, moduleId, lessonId, {
        resourceUrl: result.url,
        resourcePath: result.path,
      });

      setForm((previous) => ({
        ...previous,
        resourceUrl: result.url,
        resourcePath: result.path,
      }));

      setResourceProgress(100);
      setResourceFile(null);

      setSuccess("Resource uploaded successfully.");
    } catch (err) {
      console.error("Resource upload error:", err);
      setError(err.message || "Resource upload failed.");
    } finally {
      setUploadingResource(false);
    }
  };

  /* --------------------------------------------------
     DELETE VIDEO
  -------------------------------------------------- */

  const handleDeleteVideo = async () => {
    if (!form.videoUrl && !form.videoPath) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this video?"
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      if (form.videoPath) {
        await deleteStorageFile(form.videoPath);
      }

      await updateLesson(courseId, moduleId, lessonId, {
        videoUrl: "",
        videoPath: "",
      });

      setForm((previous) => ({
        ...previous,
        videoUrl: "",
        videoPath: "",
      }));

      setVideoLinkInput("");
      setSuccess("Video removed.");
    } catch (err) {
      console.error("Video deletion error:", err);
      setError(err.message || "Failed to remove video.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
     DELETE THUMBNAIL
  -------------------------------------------------- */

  const handleDeleteThumbnail = async () => {
    if (!form.thumbnailPath) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this thumbnail?"
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      await deleteStorageFile(form.thumbnailPath);

      await updateLesson(courseId, moduleId, lessonId, {
        thumbnailUrl: "",
        thumbnailPath: "",
      });

      setForm((previous) => ({
        ...previous,
        thumbnailUrl: "",
        thumbnailPath: "",
      }));

      setSuccess("Thumbnail removed.");
    } catch (err) {
      console.error("Thumbnail deletion error:", err);
      setError(err.message || "Failed to remove thumbnail.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
     DELETE RESOURCE
  -------------------------------------------------- */

  const handleDeleteResource = async () => {
    if (!form.resourcePath) return;

    const confirmed = window.confirm(
      "Are you sure you want to remove this resource?"
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      await deleteStorageFile(form.resourcePath);

      await updateLesson(courseId, moduleId, lessonId, {
        resourceUrl: "",
        resourcePath: "",
      });

      setForm((previous) => ({
        ...previous,
        resourceUrl: "",
        resourcePath: "",
      }));

      setSuccess("Resource removed.");
    } catch (err) {
      console.error("Resource deletion error:", err);
      setError(err.message || "Failed to remove resource.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
     SAVE LESSON
  -------------------------------------------------- */

  const handleSave = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!form.title.trim()) {
        throw new Error("Lesson title is required.");
      }

      await updateLesson(courseId, moduleId, lessonId, {
        title: form.title.trim(),
        description: form.description.trim(),
        type: form.type,
        videoUrl: form.videoUrl,
        videoPath: form.videoPath,
        thumbnailUrl: form.thumbnailUrl,
        thumbnailPath: form.thumbnailPath,
        resourceUrl: form.resourceUrl,
        resourcePath: form.resourcePath,
        duration: form.duration,
        published: form.published,
        updatedAt: serverTimestamp(),
      });

      setSuccess("Lesson saved successfully.");

      setTimeout(() => {
        navigate(`/teacher/courses/${courseId}/content`);
      }, 700);
    } catch (err) {
      console.error("Lesson save error:", err);
      setError(err.message || "Failed to save lesson.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------------------------------------
     BACK
  -------------------------------------------------- */

  const handleBack = () => {
    navigate(`/teacher/courses/${courseId}/content`);
  };

  /* --------------------------------------------------
     LOADING
  -------------------------------------------------- */

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-76px)] items-center justify-center p-6">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
          <Loader2 className="animate-spin" size={20} />
          Loading lesson...
        </div>
      </div>
    );
  }

  /* --------------------------------------------------
     ERROR
  -------------------------------------------------- */

  if (!lesson || !course || !module) {
    return (
      <div className="mx-auto max-w-4xl p-6 lg:p-8">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-700">
            Unable to load lesson
          </h2>

          <p className="mt-2 text-sm text-red-600">
            {error || "Lesson information could not be found."}
          </p>

          <button
            type="button"
            onClick={handleBack}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            <ArrowLeft size={17} />
            Back to Course Content
          </button>
        </div>
      </div>
    );
  }

  const videoEmbedUrl = getEmbedUrl(form.videoUrl);
  const isPlatformLink = isLikelyVideoPlatformLink(form.videoUrl);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">

      {/* HEADER */}

      <div className="mb-6">
        <button
          type="button"
          onClick={handleBack}
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-violet-600"
        >
          <ArrowLeft size={17} />
          Back to Course Content
        </button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
              {course.title}
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
              Edit Lesson
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <BookOpen size={15} />
              <span>{module.title}</span>
              <span className="text-slate-300">/</span>
              <span>{lesson.title}</span>
            </div>
          </div>

          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
              form.published
                ? "bg-green-50 text-green-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                form.published ? "bg-green-500" : "bg-amber-500"
              }`}
            />

            {form.published ? "Published" : "Draft"}
          </div>
        </div>
      </div>

      {/* ALERTS */}

      {error && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <X size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">

        {/* BASIC INFORMATION */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-slate-900">
              Lesson Information
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              Basic information students will see about this lesson.
            </p>
          </div>

          <div className="space-y-5 p-5 sm:p-6">

            {/* TITLE */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Lesson Title
              </label>

              <input
                type="text"
                name="title"
                value={form.title}
                onChange={handleChange}
                placeholder="e.g. Introduction to HTML"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
              />
            </div>

            {/* DESCRIPTION */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Description
              </label>

              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="Explain what students will learn in this lesson..."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
              />
            </div>

            {/* TYPE + DURATION */}

            <div className="grid gap-5 sm:grid-cols-2">

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Lesson Type
                </label>

                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                >
                  <option value="video">Video</option>
                  <option value="pdf">PDF / Resource</option>
                  <option value="text">Text Lesson</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Duration
                </label>

                <input
                  type="text"
                  name="duration"
                  value={form.duration}
                  onChange={handleChange}
                  placeholder="e.g. 15:30"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                />
              </div>

            </div>

          </div>
        </section>

        {/* VIDEO */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <Video size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Lesson Video
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Upload a video file, or paste a YouTube / Vimeo / direct
                  video link.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">

            {/* CURRENT VIDEO PREVIEW */}

            {form.videoUrl && (
              <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">

                {videoEmbedUrl ? (
                  <div className="aspect-video w-full">
                    <iframe
                      src={videoEmbedUrl}
                      title="Lesson video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full"
                    />
                  </div>
                ) : (
                  <video
                    src={form.videoUrl}
                    controls
                    className="max-h-[420px] w-full"
                  />
                )}

                <div className="flex flex-col gap-3 border-t border-slate-800 bg-slate-900 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white">
                      {form.videoPath
                        ? "Current video (uploaded)"
                        : "Current video (external link)"}
                    </p>

                    <p className="mt-1 truncate text-[11px] text-slate-400">
                      {form.videoPath || form.videoUrl}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDeleteVideo}
                    disabled={saving || uploadingVideo || savingVideoLink}
                    className="w-full shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50 sm:w-auto"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            {/* MODE SWITCH */}

            <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => handleVideoModeChange("upload")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  videoMode === "upload"
                    ? "bg-white text-violet-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <Upload size={14} />
                Upload File
              </button>

              <button
                type="button"
                onClick={() => handleVideoModeChange("link")}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition ${
                  videoMode === "link"
                    ? "bg-white text-violet-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <LinkIcon size={14} />
                Paste Link
              </button>
            </div>

            {/* UPLOAD MODE */}

            {videoMode === "upload" && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 transition hover:border-violet-300">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Upload a new video
                    </p>

                    <p className="mt-1 text-xs text-slate-400">
                      MP4, WebM, MOV or MKV • Maximum 2 GB
                    </p>
                  </div>

                  <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-violet-300 hover:text-violet-600">
                    <Upload size={16} />

                    Choose Video

                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
                      className="hidden"
                      onChange={(event) => {
                        setVideoFile(event.target.files?.[0] || null);
                        setError("");
                      }}
                    />
                  </label>

                </div>

                {videoFile && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {videoFile.name}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setVideoFile(null)}
                        className="text-slate-400 hover:text-red-500"
                      >
                        <X size={17} />
                      </button>
                    </div>

                    {uploadingVideo && (
                      <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                          <span>Uploading...</span>
                          <span>{videoProgress}%</span>
                        </div>

                        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full bg-violet-600 transition-all"
                            style={{
                              width: `${videoProgress}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={handleVideoUpload}
                      disabled={uploadingVideo}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {uploadingVideo ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Upload Video
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* LINK MODE */}

            {videoMode === "link" && (
              <div className="rounded-xl border-2 border-dashed border-slate-200 p-5 transition hover:border-violet-300">

                <p className="text-sm font-semibold text-slate-800">
                  Paste a video link
                </p>

                <p className="mt-1 text-xs text-slate-400">
                  YouTube, Vimeo, or a direct link to an .mp4 file. The video
                  will be embedded automatically when possible.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    type="url"
                    value={videoLinkInput}
                    onChange={(event) => {
                      setVideoLinkInput(event.target.value);
                      setError("");
                    }}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
                  />

                  <button
                    type="button"
                    onClick={handleSaveVideoLink}
                    disabled={savingVideoLink}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingVideoLink ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <LinkIcon size={16} />
                        Save Link
                      </>
                    )}
                  </button>
                </div>

                {videoLinkInput && !getEmbedUrl(videoLinkInput) && !isPlatformLink && (
                  <p className="mt-2 text-xs text-slate-400">
                    This doesn't look like a YouTube or Vimeo link — it will
                    be played as a direct video file instead.
                  </p>
                )}
              </div>
            )}

          </div>
        </section>

        {/* THUMBNAIL */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <ImageIcon size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Lesson Thumbnail
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Image displayed before students start the lesson.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">

            {form.thumbnailUrl && (
              <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">

                <img
                  src={form.thumbnailUrl}
                  alt="Lesson thumbnail"
                  className="aspect-video w-full object-cover"
                />

                <div className="flex flex-col gap-2 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-400">
                    Current thumbnail
                  </p>

                  <button
                    type="button"
                    onClick={handleDeleteThumbnail}
                    disabled={saving || uploadingThumbnail}
                    className="text-left text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 sm:text-right"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border-2 border-dashed border-slate-200 p-5">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Upload thumbnail
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    JPG, PNG or WebP • Maximum 10 MB
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-600">
                  <ImageIcon size={16} />

                  Choose Image

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      setThumbnailFile(event.target.files?.[0] || null);
                      setError("");
                    }}
                  />
                </label>

              </div>

              {thumbnailFile && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3">

                  <div className="flex items-center justify-between gap-3">

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {thumbnailFile.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {(thumbnailFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setThumbnailFile(null)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X size={17} />
                    </button>

                  </div>

                  {uploadingThumbnail && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                        <span>Uploading...</span>
                        <span>{thumbnailProgress}%</span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-violet-600 transition-all"
                          style={{
                            width: `${thumbnailProgress}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleThumbnailUpload}
                    disabled={uploadingThumbnail}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {uploadingThumbnail ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload Thumbnail
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* RESOURCES */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <FileText size={18} />
              </div>

              <div>
                <h2 className="font-semibold text-slate-900">
                  Lesson Resources
                </h2>

                <p className="mt-1 text-xs text-slate-500">
                  Upload PDFs, documents, ZIP files and other learning materials.
                </p>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6">

            {form.resourceUrl && (
              <div className="mb-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-violet-600 shadow-sm">
                    <FileText size={19} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">
                      Lesson Resource
                    </p>

                    <a
                      href={form.resourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block truncate text-xs text-violet-600 hover:underline"
                    >
                      Open resource
                    </a>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteResource}
                  disabled={saving || uploadingResource}
                  className="text-left text-xs font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 sm:shrink-0 sm:text-right"
                >
                  Remove
                </button>

              </div>
            )}

            <div className="rounded-xl border-2 border-dashed border-slate-200 p-5">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Upload learning material
                  </p>

                  <p className="mt-1 text-xs text-slate-400">
                    PDF, ZIP, DOC, DOCX, PPT, PPTX or TXT • Maximum 100 MB
                  </p>
                </div>

                <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-violet-300 hover:text-violet-600">
                  <FileText size={16} />

                  Choose File

                  <input
                    type="file"
                    accept=".pdf,.zip,.doc,.docx,.ppt,.pptx,.txt"
                    className="hidden"
                    onChange={(event) => {
                      setResourceFile(event.target.files?.[0] || null);
                      setError("");
                    }}
                  />
                </label>

              </div>

              {resourceFile && (
                <div className="mt-4 rounded-xl bg-slate-50 p-3">

                  <div className="flex items-center justify-between gap-3">

                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">
                        {resourceFile.name}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {(resourceFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setResourceFile(null)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X size={17} />
                    </button>

                  </div>

                  {uploadingResource && (
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-[11px] text-slate-400">
                        <span>Uploading...</span>
                        <span>{resourceProgress}%</span>
                      </div>

                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-violet-600 transition-all"
                          style={{
                            width: `${resourceProgress}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleResourceUpload}
                    disabled={uploadingResource}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                  >
                    {uploadingResource ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload size={16} />
                        Upload Resource
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* PUBLISH SETTINGS */}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="p-5 sm:p-6">

            <label className="flex cursor-pointer items-start gap-3">

              <input
                type="checkbox"
                name="published"
                checked={form.published}
                onChange={handleChange}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />

              <div>
                <p className="text-sm font-semibold text-slate-800">
                  Publish this lesson
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Published lessons can become visible to enrolled students
                  depending on the course's publication status.
                </p>
              </div>

            </label>

          </div>
        </section>

        {/* ACTIONS */}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || uploadingVideo || uploadingThumbnail || uploadingResource || savingVideoLink}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={17} />
                Save Lesson
              </>
            )}
          </button>

        </div>

      </form>
    </div>
  );
};

export default LessonEditor;