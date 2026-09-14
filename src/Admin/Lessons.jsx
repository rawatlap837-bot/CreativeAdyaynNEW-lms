import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  PlayCircle,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ArrowUp,
  ArrowDown,
  UploadCloud,
  X as XIcon,
  Image as ImageIcon,
  Video,
  Link2,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import {
  AT,
  Card,
  Modal,
  Field,
  PrimaryButton,
  GhostButton,
  EmptyState,
  ConfirmDeleteModal,
} from "./AdminUI.jsx";

import {
  listenToCourses,
  listenToModules,
  listenToLessons,
  addModule,
  updateModule,
  deleteModule,
  reorderModules,
  addLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
} from "../services/CourseContentService";

import {
  uploadLessonVideo,
  uploadLessonThumbnail,
  deleteStorageFile,
} from "../services/StorageService";

const typeIcon = {
  video: PlayCircle,
  quiz: HelpCircle,
  reading: FileText,
};

const MAX_VIDEO_MB = 500;
const MAX_THUMB_MB = 5;

export default function Lessons() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [modules, setModules] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState("");

  const [moduleModal, setModuleModal] = useState(null);
  const [confirmDeleteModule, setConfirmDeleteModule] = useState(null);

  useEffect(() => {
    const unsub = listenToCourses(
      (list) => {
        setCourses(list);
        setLoadingCourses(false);

        setCourseId((prev) => prev || list[0]?.id || "");
      },
      (err) => {
        console.error(err);
        setError(
          "Couldn't load courses. Check your connection or permissions."
        );
        setLoadingCourses(false);
      }
    );

    return unsub;
  }, []);

  useEffect(() => {
    if (!courseId) {
      setModules([]);
      return;
    }

    const unsub = listenToModules(
      courseId,
      (list) => setModules(list),
      (err) => {
        console.error(err);
        setError("Couldn't load modules.");
      }
    );

    return unsub;
  }, [courseId]);

  const activeCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId]
  );

  const saveModule = async (form) => {
    try {
      if (form.id) {
        await updateModule(courseId, form.id, {
          title: form.title.trim(),
        });
      } else {
        await addModule(courseId, {
          title: form.title.trim(),
          order: modules.length,
        });
      }

      setModuleModal(null);
    } catch (err) {
      console.error(err);
      setError("Couldn't save module. " + (err?.message || ""));
      throw err;
    }
  };

  const removeModule = async (mod) => {
    try {
      await deleteModule(courseId, mod.id);
      setConfirmDeleteModule(null);
    } catch (err) {
      console.error(err);
      setError("Couldn't delete module. " + (err?.message || ""));
    }
  };

  const moveModule = async (index, direction) => {
    const target = index + direction;

    if (target < 0 || target >= modules.length) return;

    const reordered = [...modules];

    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];

    try {
      await reorderModules(
        courseId,
        reordered.map((m) => m.id)
      );
    } catch (err) {
      console.error(err);
      setError("Couldn't reorder modules. " + (err?.message || ""));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden">
      {/* Error */}
      {error && (
        <div
          className="flex min-w-0 items-start gap-3 rounded-lg px-3 py-2.5 text-sm sm:px-4"
          style={{
            background: AT.dangerSoft,
            color: AT.danger,
          }}
        >
          <span className="min-w-0 flex-1 break-words">{error}</span>

          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0 rounded p-1"
            aria-label="Dismiss error"
          >
            <XIcon size={14} />
          </button>
        </div>
      )}

      {/* Course selector */}
      <div className="w-full min-w-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <label
            className="text-sm font-medium"
            style={{ color: AT.sub }}
          >
            Course
          </label>

          {loadingCourses ? (
            <span
              className="text-sm"
              style={{ color: AT.sub }}
            >
              Loading courses…
            </span>
          ) : courses.length === 0 ? (
            <span
              className="text-sm break-words"
              style={{ color: AT.sub }}
            >
              No courses yet — create one in the Courses tab first.
            </span>
          ) : (
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="min-w-0 w-full rounded-lg border bg-white px-3 py-2.5 text-sm outline-none transition focus:ring-2 sm:w-auto sm:min-w-[260px]"
              style={{
                borderColor: AT.line,
                color: AT.ink,
              }}
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          )}

          {courseId && (
            <div className="w-full sm:ml-auto sm:w-auto">
              <PrimaryButton
                className="w-full sm:w-auto"
                onClick={() => setModuleModal("new")}
              >
                <FolderPlus size={15} />
                Add Module
              </PrimaryButton>
            </div>
          )}
        </div>
      </div>

      {/* Modules */}
      {courseId && (
        <Card
          title={`${activeCourse?.title || ""} · ${
            modules.length
          } module${modules.length === 1 ? "" : "s"}`}
        >
          <div
            className="divide-y"
            style={{ borderColor: AT.line }}
          >
            {modules.map((mod, i) => (
              <ModuleRow
                key={mod.id}
                courseId={courseId}
                mod={mod}
                index={i}
                total={modules.length}
                onMove={moveModule}
                onEdit={() => setModuleModal(mod)}
                onDelete={() => setConfirmDeleteModule(mod)}
              />
            ))}
          </div>

          {modules.length === 0 && (
            <EmptyState text="No modules yet — add the first one for this course." />
          )}
        </Card>
      )}

      {/* Module form */}
      {moduleModal && (
        <ModuleForm
          initial={moduleModal === "new" ? null : moduleModal}
          onCancel={() => setModuleModal(null)}
          onSave={saveModule}
        />
      )}

      {/* Delete module */}
      {confirmDeleteModule && (
        <ConfirmDeleteModal
          name={confirmDeleteModule.title}
          onCancel={() => setConfirmDeleteModule(null)}
          onConfirm={() => removeModule(confirmDeleteModule)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Module Row                                                          */
/* ------------------------------------------------------------------ */

function ModuleRow({
  courseId,
  mod,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const [lessons, setLessons] = useState([]);
  const [lessonModal, setLessonModal] = useState(null);
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!open) return;

    const unsub = listenToLessons(
      courseId,
      mod.id,
      (list) => setLessons(list),
      (err) => {
        console.error(err);
        setError("Couldn't load lessons.");
      }
    );

    return unsub;
  }, [open, courseId, mod.id]);

  const saveLesson = async (form) => {
    if (form.id) {
      const { id, ...data } = form;

      await updateLesson(
        courseId,
        mod.id,
        id,
        data
      );
    } else {
      await addLesson(courseId, mod.id, {
        ...form,
        order: lessons.length,
      });
    }

    setLessonModal(null);
  };

  const removeLesson = async (lesson) => {
    setDeletingId(lesson.id);

    try {
      await deleteLesson(courseId, mod.id, lesson);
      setConfirmDeleteLesson(null);
    } catch (err) {
      console.error(err);
      setError(
        "Couldn't delete lesson. " +
          (err?.message || "")
      );
    } finally {
      setDeletingId(null);
    }
  };

  const moveLesson = async (idx, direction) => {
    const target = idx + direction;

    if (target < 0 || target >= lessons.length) return;

    const reordered = [...lessons];

    [reordered[idx], reordered[target]] = [
      reordered[target],
      reordered[idx],
    ];

    try {
      await reorderLessons(
        courseId,
        mod.id,
        reordered.map((l) => l.id)
      );
    } catch (err) {
      console.error(err);
      setError(
        "Couldn't reorder lessons. " +
          (err?.message || "")
      );
    }
  };

  return (
    <div className="min-w-0">
      {/* Module header */}
      <div className="flex min-w-0 items-start gap-2 px-3 py-3 sm:items-center sm:px-5">
        {/* Expand */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-0.5 shrink-0 rounded p-1.5 sm:mt-0"
          style={{ color: AT.sub }}
          aria-label={
            open ? "Collapse module" : "Expand module"
          }
        >
          {open ? (
            <ChevronDown size={17} />
          ) : (
            <ChevronRight size={17} />
          )}
        </button>

        {/* Module reorder */}
        <div
          className="flex shrink-0 flex-col -my-1"
          style={{ color: AT.sub }}
        >
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            className="rounded p-1 disabled:opacity-30"
            aria-label="Move module up"
          >
            <ArrowUp size={12} />
          </button>

          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            className="rounded p-1 disabled:opacity-30"
            aria-label="Move module down"
          >
            <ArrowDown size={12} />
          </button>
        </div>

        {/* Drag icon */}
        <GripVertical
          size={15}
          color={AT.sub}
          className="mt-1 shrink-0 sm:mt-0"
        />

        {/* Module information */}
        <div className="min-w-0 flex-1">
          <p
            className="break-words font-medium leading-5"
            style={{ color: AT.ink }}
          >
            {mod.title}
          </p>

          <p
            className="mt-0.5 text-xs"
            style={{ color: AT.sub }}
          >
            {open
              ? `${lessons.length} lesson${
                  lessons.length === 1 ? "" : "s"
                }`
              : "Click to expand"}
          </p>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 hover:bg-slate-100"
            style={{ color: AT.sub }}
            aria-label="Edit module"
          >
            <Pencil size={16} />
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-2 hover:bg-red-50"
            style={{ color: AT.danger }}
            aria-label="Delete module"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Lessons */}
      {open && (
        <div className="space-y-2 px-3 pb-4 sm:pl-16 sm:pr-5">
          {error && (
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs"
              style={{
                background: AT.dangerSoft,
                color: AT.danger,
              }}
            >
              <span className="min-w-0 flex-1 break-words">
                {error}
              </span>

              <button
                type="button"
                onClick={() => setError("")}
                className="shrink-0 p-0.5"
              >
                <XIcon size={12} />
              </button>
            </div>
          )}

          {lessons.map((l, i) => {
            const Icon = typeIcon[l.type] || FileText;
            const isBusy = deletingId === l.id;

            return (
              <div
                key={l.id}
                className="flex min-w-0 items-start gap-2 border-b py-2.5 last:border-b-0 sm:items-center sm:gap-3"
                style={{ borderColor: AT.line }}
              >
                {/* Lesson reorder */}
                <div
                  className="flex shrink-0 flex-col -my-1"
                  style={{ color: AT.sub }}
                >
                  <button
                    type="button"
                    disabled={i === 0}
                    onClick={() => moveLesson(i, -1)}
                    className="rounded p-1 disabled:opacity-30"
                    aria-label="Move lesson up"
                  >
                    <ArrowUp size={11} />
                  </button>

                  <button
                    type="button"
                    disabled={
                      i === lessons.length - 1
                    }
                    onClick={() =>
                      moveLesson(i, 1)
                    }
                    className="rounded p-1 disabled:opacity-30"
                    aria-label="Move lesson down"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>

                {/* Thumbnail */}
                {l.thumbnail ? (
                  <img
                    src={l.thumbnail}
                    alt=""
                    className="h-10 w-14 shrink-0 rounded object-cover sm:h-11 sm:w-16"
                    style={{
                      border: `1px solid ${AT.line}`,
                    }}
                  />
                ) : (
                  <div
                    className="flex h-10 w-14 shrink-0 items-center justify-center rounded sm:h-11 sm:w-16"
                    style={{
                      background: AT.canvas,
                    }}
                  >
                    <Icon
                      size={16}
                      color={AT.accentDeep}
                    />
                  </div>
                )}

                {/* Lesson information */}
                <div className="min-w-0 flex-1">
                  <p
                    className="break-words text-sm font-medium leading-5"
                    style={{ color: AT.ink }}
                  >
                    {l.title}
                  </p>

                  <div
                    className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs capitalize"
                    style={{ color: AT.sub }}
                  >
                    {l.videoPath ? (
                      <Video size={11} />
                    ) : l.videoUrl ? (
                      <Link2 size={11} />
                    ) : null}

                    <span>{l.type}</span>

                    <span>·</span>

                    <span>
                      {l.duration ||
                        "no duration set"}
                    </span>

                    <span>·</span>

                    <span
                      style={{
                        color: l.isPublished
                          ? AT.success
                          : AT.sub,
                      }}
                    >
                      {l.isPublished
                        ? "published"
                        : "draft"}
                    </span>
                  </div>
                </div>

                {/* Lesson actions */}
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      setLessonModal(l)
                    }
                    className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40"
                    style={{ color: AT.sub }}
                    aria-label="Edit lesson"
                  >
                    <Pencil size={15} />
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      setConfirmDeleteLesson(l)
                    }
                    className="rounded-lg p-2 hover:bg-red-50 disabled:opacity-40"
                    style={{ color: AT.danger }}
                    aria-label="Delete lesson"
                  >
                    {isBusy ? (
                      <Loader2
                        size={15}
                        className="animate-spin"
                      />
                    ) : (
                      <Trash2 size={15} />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {lessons.length === 0 && (
            <p
              className="py-2 text-xs"
              style={{ color: AT.sub }}
            >
              No lessons in this module yet.
            </p>
          )}

          <GhostButton
            className="w-full sm:w-auto"
            onClick={() => setLessonModal("new")}
          >
            <Plus size={14} />
            Add Lesson
          </GhostButton>
        </div>
      )}

      {/* Lesson form */}
      {lessonModal && (
        <LessonForm
          courseId={courseId}
          moduleId={mod.id}
          initial={
            lessonModal === "new"
              ? null
              : lessonModal
          }
          onCancel={() => setLessonModal(null)}
          onSave={saveLesson}
        />
      )}

      {/* Delete lesson */}
      {confirmDeleteLesson && (
        <ConfirmDeleteModal
          name={confirmDeleteLesson.title}
          onCancel={() =>
            setConfirmDeleteLesson(null)
          }
          onConfirm={() =>
            removeLesson(confirmDeleteLesson)
          }
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Module Form                                                         */
/* ------------------------------------------------------------------ */

function ModuleForm({
  initial,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState(
    initial || { title: "" }
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!form.title.trim() || saving) return;

    setSaving(true);
    setError("");

    try {
      await onSave(form);
    } catch (err) {
      console.error(err);
      setError(
        "Couldn't save module. " +
          (err?.message || "")
      );
      setSaving(false);
    }
  };

  return (
    <Modal
      title={
        initial ? "Edit module" : "Add module"
      }
      onClose={onCancel}
    >
      {error && (
        <div
          className="mb-3 rounded-lg px-3 py-2 text-xs break-words"
          style={{
            background: AT.dangerSoft,
            color: AT.danger,
          }}
        >
          {error}
        </div>
      )}

      <Field
        label="Module title"
        placeholder="e.g. Week 1 — Foundations"
        value={form.title}
        onChange={(e) =>
          setForm({
            ...form,
            title: e.target.value,
          })
        }
      />

      <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <GhostButton
          className="w-full sm:w-auto"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </GhostButton>

        <PrimaryButton
          className="w-full sm:w-auto"
          onClick={submit}
          disabled={
            saving || !form.title.trim()
          }
        >
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Video Helpers                                                       */
/* ------------------------------------------------------------------ */

function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(
      2,
      "0"
    )}:${String(sec).padStart(2, "0")}`;
  }

  return `${m}:${String(sec).padStart(2, "0")}`;
}

function readVideoDuration(file) {
  return new Promise((resolve) => {
    try {
      const video =
        document.createElement("video");

      video.preload = "metadata";

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);

        resolve(
          Number.isFinite(video.duration)
            ? video.duration
            : null
        );
      };

      video.onerror = () => resolve(null);

      video.src = URL.createObjectURL(file);
    } catch {
      resolve(null);
    }
  });
}

function docId() {
  return `l_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 9)}`;
}

/* ------------------------------------------------------------------ */
/* Lesson Form                                                         */
/* ------------------------------------------------------------------ */

function LessonForm({
  courseId,
  moduleId,
  initial,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState(
    initial || {
      title: "",
      description: "",
      type: "video",
      videoUrl: "",
      videoPath: "",
      videoSize: null,
      thumbnail: "",
      thumbnailPath: "",
      duration: "",
      isPublished: false,
    }
  );

  const [videoSource, setVideoSource] =
    useState(
      initial?.videoPath
        ? "upload"
        : "link"
    );

  const [videoFile, setVideoFile] =
    useState(null);

  const [thumbFile, setThumbFile] =
    useState(null);

  const [thumbPreview, setThumbPreview] =
    useState(initial?.thumbnail || "");

  const [videoProgress, setVideoProgress] =
    useState(0);

  const [thumbProgress, setThumbProgress] =
    useState(0);

  const [uploading, setUploading] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const onPickVideo = async (e) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }

    if (
      file.size >
      MAX_VIDEO_MB * 1024 * 1024
    ) {
      setError(
        `That video is too large — keep it under ${MAX_VIDEO_MB}MB.`
      );
      return;
    }

    setError("");
    setVideoFile(file);

    const duration =
      await readVideoDuration(file);

    if (duration) {
      setForm((f) => ({
        ...f,
        duration:
          formatDuration(duration),
      }));
    }
  };

  const onPickThumb = (e) => {
    const file = e.target.files?.[0];

    e.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError(
        "Please choose an image file for the thumbnail."
      );
      return;
    }

    if (
      file.size >
      MAX_THUMB_MB * 1024 * 1024
    ) {
      setError(
        `That image is too large — keep it under ${MAX_THUMB_MB}MB.`
      );
      return;
    }

    setError("");
    setThumbFile(file);
    setThumbPreview(
      URL.createObjectURL(file)
    );
  };

  const submit = async () => {
    if (
      !form.title.trim() ||
      saving ||
      uploading
    ) {
      return;
    }

    if (
      videoSource === "link" &&
      form.type === "video" &&
      !form.videoUrl.trim() &&
      !initial?.videoPath
    ) {
      setError(
        'Add a video link, or switch to "Upload file" and choose a file.'
      );
      return;
    }

    setError("");
    setSaving(true);

    const lessonId =
      initial?.id || docId();

    let nextForm = {
      ...form,
    };

    try {
      if (
        videoSource === "upload" &&
        videoFile
      ) {
        setUploading(true);

        const result =
          await uploadLessonVideo(
            videoFile,
            courseId,
            moduleId,
            lessonId,
            (progress) =>
              setVideoProgress(progress)
          );

        if (
          initial?.videoPath &&
          initial.videoPath !== result.path
        ) {
          await deleteStorageFile(
            initial.videoPath
          ).catch(() => {});
        }

        nextForm = {
          ...nextForm,
          videoUrl: result.url,
          videoPath: result.path,
          videoSize: result.size,
        };
      } else if (
        videoSource === "link"
      ) {
        if (initial?.videoPath) {
          await deleteStorageFile(
            initial.videoPath
          ).catch(() => {});
        }

        nextForm = {
          ...nextForm,
          videoPath: "",
          videoSize: null,
        };
      }

      if (thumbFile) {
        setThumbProgress(0);

        const result =
          await uploadLessonThumbnail(
            thumbFile,
            courseId,
            moduleId,
            lessonId,
            (progress) =>
              setThumbProgress(progress)
          );

        if (
          initial?.thumbnailPath &&
          initial.thumbnailPath !== result.path
        ) {
          await deleteStorageFile(
            initial.thumbnailPath
          ).catch(() => {});
        }

        nextForm = {
          ...nextForm,
          thumbnail: result.url,
          thumbnailPath: result.path,
        };
      }

      setUploading(false);

      await onSave({
        ...nextForm,
        id: initial?.id || lessonId,
      });
    } catch (err) {
      console.error(err);

      setUploading(false);
      setSaving(false);

      if (
        err?.code === "storage/canceled"
      ) {
        setError("Upload cancelled.");
      } else if (
        err?.code ===
        "storage/unauthorized"
      ) {
        setError(
          "You don't have permission to upload here. Check that you're signed in as an admin."
        );
      } else {
        setError(
          "Upload failed. " +
            (err?.message ||
              "Please try again.")
        );
      }

      return;
    }
  };

  const removeUploadedVideo = () => {
    setVideoFile(null);

    setForm((f) => ({
      ...f,
      videoUrl: "",
      videoPath: "",
    }));
  };

  const busy = saving || uploading;

  return (
    <Modal
      title={
        initial
          ? "Edit lesson"
          : "Add lesson"
      }
      onClose={
        busy ? () => {} : onCancel
      }
    >
      <div className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain pr-0.5 sm:max-h-[70vh] sm:pr-1">
        {/* Error */}
        {error && (
          <div
            className="mb-3 rounded-lg px-3 py-2 text-xs break-words"
            style={{
              background: AT.dangerSoft,
              color: AT.danger,
            }}
          >
            {error}
          </div>
        )}

        {/* Title */}
        <Field
          label="Lesson title"
          value={form.title}
          disabled={busy}
          onChange={(e) =>
            setForm({
              ...form,
              title: e.target.value,
            })
          }
        />

        {/* Type */}
        <label className="mb-3 block text-sm">
          <span
            className="mb-1 block font-medium"
            style={{ color: AT.ink }}
          >
            Type
          </span>

          <select
            value={form.type}
            disabled={busy}
            onChange={(e) =>
              setForm({
                ...form,
                type: e.target.value,
              })
            }
            className="w-full rounded-lg border bg-white px-3 py-2.5 text-base outline-none sm:text-sm"
            style={{
              borderColor: AT.line,
            }}
          >
            <option value="video">
              Video
            </option>
            <option value="reading">
              Reading
            </option>
            <option value="quiz">
              Quiz
            </option>
          </select>
        </label>

        {/* Video */}
        {form.type === "video" && (
          <div className="mb-4">
            <span
              className="mb-1.5 block text-sm font-medium"
              style={{ color: AT.ink }}
            >
              Video source
            </span>

            {/* Source switch */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setVideoSource("upload")
                }
                className="min-h-10 rounded-lg border px-3 py-2 text-xs transition disabled:opacity-50"
                style={{
                  borderColor:
                    videoSource === "upload"
                      ? AT.accentDeep
                      : AT.line,
                  background:
                    videoSource === "upload"
                      ? AT.accentSoft
                      : "transparent",
                  color: AT.ink,
                }}
              >
                Upload file
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  setVideoSource("link")
                }
                className="min-h-10 rounded-lg border px-3 py-2 text-xs transition disabled:opacity-50"
                style={{
                  borderColor:
                    videoSource === "link"
                      ? AT.accentDeep
                      : AT.line,
                  background:
                    videoSource === "link"
                      ? AT.accentSoft
                      : "transparent",
                  color: AT.ink,
                }}
              >
                External link
              </button>
            </div>

            {/* Upload */}
            {videoSource === "upload" ? (
              <div
                className="mt-2 rounded-lg border p-3 sm:p-4"
                style={{
                  borderColor: AT.line,
                }}
              >
                {form.videoPath &&
                !videoFile ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span
                      className="flex items-center gap-1.5 text-sm"
                      style={{
                        color: AT.success,
                      }}
                    >
                      <CheckCircle2
                        size={14}
                      />
                      Video uploaded
                    </span>

                    <div className="flex items-center gap-4">
                      <label
                        className="cursor-pointer text-xs underline"
                        style={{
                          color:
                            AT.accentDeep,
                        }}
                      >
                        Replace

                        <input
                          type="file"
                          accept="video/*"
                          className="hidden"
                          disabled={busy}
                          onChange={
                            onPickVideo
                          }
                        />
                      </label>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={
                          removeUploadedVideo
                        }
                        className="rounded p-1"
                        style={{
                          color: AT.danger,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : videoFile ? (
                  <div className="min-w-0 text-sm">
                    <div className="flex min-w-0 items-start gap-2">
                      <span
                        className="min-w-0 flex-1 break-all"
                        style={{
                          color: AT.ink,
                        }}
                      >
                        {videoFile.name}
                      </span>

                      <span
                        className="shrink-0 text-xs"
                        style={{
                          color: AT.sub,
                        }}
                      >
                        {(
                          videoFile.size /
                          (1024 * 1024)
                        ).toFixed(1)}
                        MB
                      </span>
                    </div>

                    {uploading && (
                      <div className="mt-2 space-y-1">
                        <div
                          className="h-1.5 overflow-hidden rounded-full"
                          style={{
                            background:
                              AT.line,
                          }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${videoProgress}%`,
                              background:
                                AT.accentDeep,
                              transition:
                                "width 0.2s",
                            }}
                          />
                        </div>

                        <div
                          className="text-xs"
                          style={{
                            color: AT.sub,
                          }}
                        >
                          Uploading…{" "}
                          {videoProgress}%
                        </div>
                      </div>
                    )}

                    {!uploading && (
                      <button
                        type="button"
                        onClick={() =>
                          setVideoFile(
                            null
                          )
                        }
                        className="mt-2 text-xs underline"
                        style={{
                          color: AT.sub,
                        }}
                      >
                        Choose a different
                        file
                      </button>
                    )}
                  </div>
                ) : (
                  <label
                    className="flex cursor-pointer flex-col items-center justify-center gap-1.5 py-7 text-center text-sm"
                    style={{
                      color: AT.sub,
                    }}
                  >
                    <UploadCloud
                      size={24}
                    />

                    <span className="break-words">
                      Click to choose a video
                      file
                    </span>

                    <span className="text-xs">
                      MP4, WebM · up to{" "}
                      {MAX_VIDEO_MB}MB
                    </span>

                    <input
                      type="file"
                      accept="video/*"
                      className="hidden"
                      disabled={busy}
                      onChange={
                        onPickVideo
                      }
                    />
                  </label>
                )}
              </div>
            ) : (
              <div className="mt-2">
                <Field
                  label={null}
                  placeholder="Paste a YouTube/Vimeo link"
                  value={form.videoUrl}
                  disabled={busy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      videoUrl:
                        e.target.value,
                    })
                  }
                />
              </div>
            )}
          </div>
        )}

        {/* Thumbnail */}
        <div className="mb-4">
          <span
            className="mb-1.5 block text-sm font-medium"
            style={{ color: AT.ink }}
          >
            Thumbnail (optional)
          </span>

          <div className="flex min-w-0 items-start gap-3 sm:items-center">
            {thumbPreview ? (
              <img
                src={thumbPreview}
                alt=""
                className="h-12 w-20 shrink-0 rounded object-cover"
                style={{
                  border: `1px solid ${AT.line}`,
                }}
              />
            ) : (
              <div
                className="flex h-12 w-20 shrink-0 items-center justify-center rounded"
                style={{
                  background: AT.canvas,
                  border: `1px solid ${AT.line}`,
                }}
              >
                <ImageIcon
                  size={16}
                  color={AT.sub}
                />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <label
                className="cursor-pointer text-xs underline"
                style={{
                  color: AT.accentDeep,
                }}
              >
                {thumbPreview
                  ? "Replace image"
                  : "Upload image"}

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={busy}
                  onChange={onPickThumb}
                />
              </label>

              {uploading &&
                thumbFile && (
                  <div
                    className="mt-1.5 h-1 overflow-hidden rounded-full"
                    style={{
                      background: AT.line,
                    }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${thumbProgress}%`,
                        background:
                          AT.accentDeep,
                        transition:
                          "width 0.2s",
                      }}
                    />
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Description */}
        <Field
          label="Description (optional)"
          placeholder="What this lesson covers"
          value={form.description}
          disabled={busy}
          onChange={(e) =>
            setForm({
              ...form,
              description:
                e.target.value,
            })
          }
        />

        {/* Duration */}
        <Field
          label="Duration"
          placeholder="Auto-filled from the video, or set manually"
          value={form.duration}
          disabled={busy}
          onChange={(e) =>
            setForm({
              ...form,
              duration:
                e.target.value,
            })
          }
        />

        {/* Published */}
        <label
          className="flex items-start gap-2 py-1 text-sm"
          style={{ color: AT.ink }}
        >
          <input
            type="checkbox"
            checked={form.isPublished}
            disabled={busy}
            onChange={(e) =>
              setForm({
                ...form,
                isPublished:
                  e.target.checked,
              })
            }
            className="mt-0.5 shrink-0"
          />

          <span className="break-words">
            Published (visible to enrolled
            students)
          </span>
        </label>
      </div>

      {/* Form actions */}
      <div
        className="mt-3 flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:justify-end"
        style={{
          borderColor: AT.line,
        }}
      >
        <GhostButton
          className="w-full sm:w-auto"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </GhostButton>

        <PrimaryButton
          className="w-full sm:w-auto"
          onClick={submit}
          disabled={
            busy || !form.title.trim()
          }
        >
          {uploading
            ? `Uploading… ${videoProgress}%`
            : saving
            ? "Saving…"
            : "Save"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}