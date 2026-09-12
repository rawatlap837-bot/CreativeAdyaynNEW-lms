import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Pencil, Trash2, GripVertical, PlayCircle, FileText, HelpCircle,
  ChevronDown, ChevronRight, FolderPlus, ArrowUp, ArrowDown, UploadCloud,
  X as XIcon, Image as ImageIcon, Video, Link2, Loader2, CheckCircle2,
} from "lucide-react";
import { AT, Card, Modal, Field, PrimaryButton, GhostButton, EmptyState, ConfirmDeleteModal } from "./AdminUI.jsx";
import {
  listenToCourses, listenToModules, listenToLessons,
  addModule, updateModule, deleteModule, reorderModules,
  addLesson, updateLesson, deleteLesson, reorderLessons,
  uploadLessonVideo, uploadLessonThumbnail, deleteFileByPath,
} from "../services/CourseContent.js";

const typeIcon = { video: PlayCircle, quiz: HelpCircle, reading: FileText };

const MAX_VIDEO_MB = 500;
const MAX_THUMB_MB = 5;

export default function Lessons() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [modules, setModules] = useState([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [error, setError] = useState("");

  const [moduleModal, setModuleModal] = useState(null); // "new" | module obj | null
  const [confirmDeleteModule, setConfirmDeleteModule] = useState(null);

  // Real courses from Firestore (same collection Admin/Courses.jsx writes to)
  useEffect(() => {
    const unsub = listenToCourses(
      (list) => {
        setCourses(list);
        setLoadingCourses(false);
        setCourseId((prev) => prev || list[0]?.id || "");
      },
      (err) => {
        console.error(err);
        setError("Couldn't load courses. Check your connection or permissions.");
        setLoadingCourses(false);
      }
    );
    return unsub;
  }, []);

  // Modules for the selected course
  useEffect(() => {
    if (!courseId) { setModules([]); return; }
    const unsub = listenToModules(
      courseId,
      (list) => setModules(list),
      (err) => { console.error(err); setError("Couldn't load modules."); }
    );
    return unsub;
  }, [courseId]);

  const activeCourse = useMemo(() => courses.find((c) => c.id === courseId), [courses, courseId]);

  const saveModule = async (form) => {
    try {
      if (form.id) {
        await updateModule(courseId, form.id, { title: form.title.trim() });
      } else {
        await addModule(courseId, { title: form.title, order: modules.length });
      }
      setModuleModal(null);
    } catch (err) {
      console.error(err);
      setError("Couldn't save module. " + (err?.message || ""));
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
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await reorderModules(courseId, reordered.map((m) => m.id));
    } catch (err) {
      console.error(err);
      setError("Couldn't reorder modules. " + (err?.message || ""));
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between text-sm rounded-lg px-4 py-2" style={{ background: AT.dangerSoft, color: AT.danger }}>
          <span>{error}</span>
          <button onClick={() => setError("")}><XIcon size={14} /></button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" style={{ color: AT.sub }}>Course:</label>
        {loadingCourses ? (
          <span className="text-sm" style={{ color: AT.sub }}>Loading courses…</span>
        ) : courses.length === 0 ? (
          <span className="text-sm" style={{ color: AT.sub }}>
            No courses yet — create one in the Courses tab first.
          </span>
        ) : (
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="text-sm border rounded-lg px-3 py-2 outline-none"
            style={{ borderColor: AT.line, color: AT.ink }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
        {courseId && (
          <PrimaryButton className="ml-auto" onClick={() => setModuleModal("new")}>
            <FolderPlus size={15} /> Add Module
          </PrimaryButton>
        )}
      </div>

      {courseId && (
        <Card title={`${activeCourse?.title || ""} · ${modules.length} module${modules.length === 1 ? "" : "s"}`}>
          <div className="divide-y" style={{ borderColor: AT.line }}>
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

      {moduleModal && (
        <ModuleForm
          initial={moduleModal === "new" ? null : moduleModal}
          onCancel={() => setModuleModal(null)}
          onSave={saveModule}
        />
      )}
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
/*  A single module row — expands to show/manage its lessons           */
/* ------------------------------------------------------------------ */

function ModuleRow({ courseId, mod, index, total, onMove, onEdit, onDelete }) {
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
      (err) => { console.error(err); setError("Couldn't load lessons."); }
    );
    return unsub;
  }, [open, courseId, mod.id]);

  const saveLesson = async (form) => {
    if (form.id) {
      const { id, ...data } = form;
      await updateLesson(courseId, mod.id, id, data);
    } else {
      await addLesson(courseId, mod.id, { ...form, order: lessons.length });
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
      setError("Couldn't delete lesson. " + (err?.message || ""));
    } finally {
      setDeletingId(null);
    }
  };

  const moveLesson = async (idx, direction) => {
    const target = idx + direction;
    if (target < 0 || target >= lessons.length) return;
    const reordered = [...lessons];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    try {
      await reorderLessons(courseId, mod.id, reordered.map((l) => l.id));
    } catch (err) {
      console.error(err);
      setError("Couldn't reorder lessons. " + (err?.message || ""));
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 px-5 py-3 text-sm">
        <button onClick={() => setOpen((v) => !v)} style={{ color: AT.sub }}>
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        <div className="flex flex-col -my-1" style={{ color: AT.sub }}>
          <button disabled={index === 0} onClick={() => onMove(index, -1)} className="disabled:opacity-30">
            <ArrowUp size={12} />
          </button>
          <button disabled={index === total - 1} onClick={() => onMove(index, 1)} className="disabled:opacity-30">
            <ArrowDown size={12} />
          </button>
        </div>
        <GripVertical size={15} color={AT.sub} />
        <div className="flex-1">
          <p className="font-medium" style={{ color: AT.ink }}>{mod.title}</p>
          <p className="text-xs" style={{ color: AT.sub }}>
            {open ? `${lessons.length} lesson${lessons.length === 1 ? "" : "s"}` : "Click to expand"}
          </p>
        </div>
        <button onClick={onEdit} style={{ color: AT.sub }}><Pencil size={16} /></button>
        <button onClick={onDelete} style={{ color: AT.danger }}><Trash2 size={16} /></button>
      </div>

      {open && (
        <div className="pl-16 pr-5 pb-4 space-y-2">
          {error && (
            <div className="flex items-center justify-between text-xs rounded-lg px-3 py-2" style={{ background: AT.dangerSoft, color: AT.danger }}>
              <span>{error}</span>
              <button onClick={() => setError("")}><XIcon size={12} /></button>
            </div>
          )}
          {lessons.map((l, i) => {
            const Icon = typeIcon[l.type] || FileText;
            const isBusy = deletingId === l.id;
            return (
              <div key={l.id} className="flex items-center gap-3 py-2 border-b last:border-b-0" style={{ borderColor: AT.line }}>
                <div className="flex flex-col -my-1" style={{ color: AT.sub }}>
                  <button disabled={i === 0} onClick={() => moveLesson(i, -1)} className="disabled:opacity-30">
                    <ArrowUp size={11} />
                  </button>
                  <button disabled={i === lessons.length - 1} onClick={() => moveLesson(i, 1)} className="disabled:opacity-30">
                    <ArrowDown size={11} />
                  </button>
                </div>
                {l.thumbnail ? (
                  <img src={l.thumbnail} alt="" className="w-14 h-9 object-cover rounded" style={{ border: `1px solid ${AT.line}` }} />
                ) : (
                  <div className="w-14 h-9 rounded flex items-center justify-center" style={{ background: AT.canvas }}>
                    <Icon size={16} color={AT.accentDeep} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: AT.ink }}>{l.title}</p>
                  <p className="text-xs capitalize flex items-center gap-1" style={{ color: AT.sub }}>
                    {l.videoPath ? <Video size={11} /> : l.videoUrl ? <Link2 size={11} /> : null}
                    {l.type} · {l.duration || "no duration set"} ·{" "}
                    <span style={{ color: l.isPublished ? AT.success : AT.sub }}>
                      {l.isPublished ? "published" : "draft"}
                    </span>
                  </p>
                </div>
                <button disabled={isBusy} onClick={() => setLessonModal(l)} style={{ color: AT.sub }}><Pencil size={15} /></button>
                <button disabled={isBusy} onClick={() => setConfirmDeleteLesson(l)} style={{ color: AT.danger }}>
                  {isBusy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                </button>
              </div>
            );
          })}
          {lessons.length === 0 && (
            <p className="text-xs py-2" style={{ color: AT.sub }}>No lessons in this module yet.</p>
          )}
          <GhostButton onClick={() => setLessonModal("new")}>
            <Plus size={14} /> Add Lesson
          </GhostButton>
        </div>
      )}

      {lessonModal && (
        <LessonForm
          courseId={courseId}
          moduleId={mod.id}
          initial={lessonModal === "new" ? null : lessonModal}
          onCancel={() => setLessonModal(null)}
          onSave={saveLesson}
        />
      )}
      {confirmDeleteLesson && (
        <ConfirmDeleteModal
          name={confirmDeleteLesson.title}
          onCancel={() => setConfirmDeleteLesson(null)}
          onConfirm={() => removeLesson(confirmDeleteLesson)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms                                                               */
/* ------------------------------------------------------------------ */

function ModuleForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial || { title: "" });
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
      setError("Couldn't save module. " + (err?.message || ""));
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "Edit module" : "Add module"} onClose={onCancel}>
      {error && (
        <div className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: AT.dangerSoft, color: AT.danger }}>{error}</div>
      )}
      <Field
        label="Module title"
        placeholder="e.g. Week 1 — Foundations"
        value={form.title}
        onChange={(e) => setForm({ ...form, title: e.target.value })}
      />
      <div className="flex justify-end gap-2 mt-2">
        <GhostButton onClick={onCancel} disabled={saving}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} disabled={saving || !form.title.trim()}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

// Formats seconds -> "mm:ss" (or "h:mm:ss" for longer videos)
function formatDuration(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function readVideoDuration(file) {
  return new Promise((resolve) => {
    try {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        resolve(Number.isFinite(video.duration) ? video.duration : null);
      };
      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(file);
    } catch {
      resolve(null);
    }
  });
}

// Small local id generator for pre-assigning a lesson id before its
// Firestore doc exists, so uploaded files can live at a stable path.
function docId() {
  return `l_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function LessonForm({ courseId, moduleId, initial, onCancel, onSave }) {
  const [form, setForm] = useState(
    initial || {
      title: "", description: "", type: "video",
      videoUrl: "", videoPath: "", videoSize: null,
      thumbnail: "", thumbnailPath: "",
      duration: "", isPublished: false,
    }
  );
  const [videoSource, setVideoSource] = useState(initial?.videoPath ? "upload" : "link");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbFile, setThumbFile] = useState(null);
  const [thumbPreview, setThumbPreview] = useState(initial?.thumbnail || "");
  const [videoProgress, setVideoProgress] = useState(0);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const videoTaskRef = useRef(null);

  const onPickVideo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again later (e.g. after a failed upload)
    if (!file) return;
    if (!file.type.startsWith("video/")) {
      setError("Please choose a video file.");
      return;
    }
    if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
      setError(`That video is too large — keep it under ${MAX_VIDEO_MB}MB.`);
      return;
    }
    setError("");
    setVideoFile(file);
    const duration = await readVideoDuration(file);
    if (duration) setForm((f) => ({ ...f, duration: formatDuration(duration) }));
  };

  const onPickThumb = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file for the thumbnail.");
      return;
    }
    if (file.size > MAX_THUMB_MB * 1024 * 1024) {
      setError(`That image is too large — keep it under ${MAX_THUMB_MB}MB.`);
      return;
    }
    setError("");
    setThumbFile(file);
    setThumbPreview(URL.createObjectURL(file));
  };

  const cancelVideoUpload = () => {
    videoTaskRef.current?.cancel();
  };

  const submit = async () => {
    if (!form.title.trim() || saving || uploading) return;
    if (videoSource === "link" && form.type === "video" && !form.videoUrl.trim() && !initial?.videoPath) {
      setError('Add a video link, or switch to "Upload file" and choose a file.');
      return;
    }
    setError("");
    setSaving(true);

    // Lesson doc id is needed before upload so files live at a stable,
    // predictable Storage path. New lessons get one up front; edits reuse
    // the existing lesson id.
    const lessonId = initial?.id || docId();

    let nextForm = { ...form };

    try {
      if (videoSource === "upload" && videoFile) {
        setUploading(true);
        // Replacing an existing uploaded video — remove the old file once
        // the new one is safely up, so a failed upload never destroys the
        // still-working original.
        const { task, promise } = uploadLessonVideo(courseId, moduleId, lessonId, videoFile);
        videoTaskRef.current = task;
        task.on("state_changed", (snap) => {
          setVideoProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        });
        const result = await promise;
        if (initial?.videoPath && initial.videoPath !== result.path) {
          await deleteFileByPath(initial.videoPath).catch(() => {});
        }
        nextForm = { ...nextForm, videoUrl: result.url, videoPath: result.path, videoSize: result.size };
      } else if (videoSource === "link") {
        // Switching to an external link on an edit — drop the old uploaded file.
        if (initial?.videoPath) {
          await deleteFileByPath(initial.videoPath).catch(() => {});
        }
        nextForm = { ...nextForm, videoPath: "", videoSize: null };
      }

      if (thumbFile) {
        setThumbProgress(0);
        const { task, promise } = uploadLessonThumbnail(courseId, moduleId, lessonId, thumbFile);
        task.on("state_changed", (snap) => {
          setThumbProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        });
        const result = await promise;
        if (initial?.thumbnailPath && initial.thumbnailPath !== result.path) {
          await deleteFileByPath(initial.thumbnailPath).catch(() => {});
        }
        nextForm = { ...nextForm, thumbnail: result.url, thumbnailPath: result.path };
      }

      setUploading(false);
      await onSave({ ...nextForm, id: initial?.id || lessonId });
    } catch (err) {
      console.error(err);
      setUploading(false);
      setSaving(false);
      if (err?.code === "storage/canceled") {
        setError("Upload cancelled.");
      } else if (err?.code === "storage/unauthorized") {
        setError("You don't have permission to upload here. Check that you're signed in as an admin.");
      } else {
        setError("Upload failed. " + (err?.message || "Please try again."));
      }
      return;
    }
  };

  const removeUploadedVideo = () => {
    setVideoFile(null);
    setForm((f) => ({ ...f, videoUrl: "", videoPath: "" }));
  };

  const busy = saving || uploading;

  return (
    <Modal title={initial ? "Edit lesson" : "Add lesson"} onClose={busy ? () => {} : onCancel}>
      <div className="max-h-[70vh] overflow-y-auto pr-1">
        {error && (
          <div className="text-xs rounded-lg px-3 py-2 mb-3" style={{ background: AT.dangerSoft, color: AT.danger }}>{error}</div>
        )}

        <Field label="Lesson title" value={form.title} disabled={busy} onChange={(e) => setForm({ ...form, title: e.target.value })} />

        <label className="block mb-3 text-sm">
          <span className="block mb-1 font-medium" style={{ color: AT.ink }}>Type</span>
          <select
            value={form.type}
            disabled={busy}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="w-full border rounded-lg px-3 py-2 text-sm outline-none"
            style={{ borderColor: AT.line }}
          >
            <option value="video">Video</option>
            <option value="reading">Reading</option>
            <option value="quiz">Quiz</option>
          </select>
        </label>

        {form.type === "video" && (
          <div className="mb-3">
            <span className="block mb-1.5 text-sm font-medium" style={{ color: AT.ink }}>Video source</span>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setVideoSource("upload")}
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border"
                style={{
                  borderColor: videoSource === "upload" ? AT.accentDeep : AT.line,
                  background: videoSource === "upload" ? AT.accentSoft : "transparent",
                  color: AT.ink,
                }}
              >
                Upload file
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setVideoSource("link")}
                className="flex-1 text-xs px-3 py-1.5 rounded-lg border"
                style={{
                  borderColor: videoSource === "link" ? AT.accentDeep : AT.line,
                  background: videoSource === "link" ? AT.accentSoft : "transparent",
                  color: AT.ink,
                }}
              >
                External link
              </button>
            </div>

            {videoSource === "upload" ? (
              <div className="rounded-lg border p-3" style={{ borderColor: AT.line }}>
                {form.videoPath && !videoFile ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5" style={{ color: AT.success }}>
                      <CheckCircle2 size={14} /> Video uploaded
                    </span>
                    <div className="flex items-center gap-3">
                      <label className="text-xs underline cursor-pointer" style={{ color: AT.accentDeep }}>
                        Replace
                        <input type="file" accept="video/*" className="hidden" disabled={busy} onChange={onPickVideo} />
                      </label>
                      <button type="button" disabled={busy} onClick={removeUploadedVideo} style={{ color: AT.danger }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ) : videoFile ? (
                  <div className="text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="truncate flex-1" style={{ color: AT.ink }}>{videoFile.name}</span>
                      <span className="text-xs shrink-0 ml-2" style={{ color: AT.sub }}>
                        {(videoFile.size / (1024 * 1024)).toFixed(1)}MB
                      </span>
                    </div>
                    {uploading && (
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: AT.line }}>
                          <div className="h-full rounded-full" style={{ width: `${videoProgress}%`, background: AT.accentDeep, transition: "width 0.2s" }} />
                        </div>
                        <div className="flex items-center justify-between text-xs" style={{ color: AT.sub }}>
                          <span>Uploading… {videoProgress}%</span>
                          <button type="button" onClick={cancelVideoUpload} style={{ color: AT.danger }}>Cancel</button>
                        </div>
                      </div>
                    )}
                    {!uploading && (
                      <button type="button" onClick={() => setVideoFile(null)} className="text-xs underline" style={{ color: AT.sub }}>
                        Choose a different file
                      </button>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-1.5 py-6 cursor-pointer text-sm" style={{ color: AT.sub }}>
                    <UploadCloud size={22} />
                    <span>Click to choose a video file</span>
                    <span className="text-xs">MP4, WebM · up to {MAX_VIDEO_MB}MB</span>
                    <input type="file" accept="video/*" className="hidden" disabled={busy} onChange={onPickVideo} />
                  </label>
                )}
              </div>
            ) : (
              <Field
                label={null}
                placeholder="Paste a YouTube/Vimeo link"
                value={form.videoUrl}
                disabled={busy}
                onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              />
            )}
          </div>
        )}

        <div className="mb-3">
          <span className="block mb-1.5 text-sm font-medium" style={{ color: AT.ink }}>Thumbnail (optional)</span>
          <div className="flex items-center gap-3">
            {thumbPreview ? (
              <img src={thumbPreview} alt="" className="w-20 h-12 object-cover rounded" style={{ border: `1px solid ${AT.line}` }} />
            ) : (
              <div className="w-20 h-12 rounded flex items-center justify-center" style={{ background: AT.canvas, border: `1px solid ${AT.line}` }}>
                <ImageIcon size={16} color={AT.sub} />
              </div>
            )}
            <div className="flex-1">
              <label className="text-xs underline cursor-pointer" style={{ color: AT.accentDeep }}>
                {thumbPreview ? "Replace image" : "Upload image"}
                <input type="file" accept="image/*" className="hidden" disabled={busy} onChange={onPickThumb} />
              </label>
              {uploading && thumbFile && (
                <div className="h-1 rounded-full overflow-hidden mt-1.5" style={{ background: AT.line }}>
                  <div className="h-full rounded-full" style={{ width: `${thumbProgress}%`, background: AT.accentDeep, transition: "width 0.2s" }} />
                </div>
              )}
            </div>
          </div>
        </div>

        <Field
          label="Description (optional)"
          placeholder="What this lesson covers"
          value={form.description}
          disabled={busy}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <Field
          label="Duration"
          placeholder="Auto-filled from the video, or set manually"
          value={form.duration}
          disabled={busy}
          onChange={(e) => setForm({ ...form, duration: e.target.value })}
        />

        <label className="flex items-center gap-2 mb-1 text-sm" style={{ color: AT.ink }}>
          <input
            type="checkbox"
            checked={form.isPublished}
            disabled={busy}
            onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
          />
          Published (visible to enrolled students)
        </label>
      </div>

      <div className="flex justify-end gap-2 mt-3 pt-3 border-t" style={{ borderColor: AT.line }}>
        <GhostButton onClick={onCancel} disabled={busy}>Cancel</GhostButton>
        <PrimaryButton onClick={submit} disabled={busy || !form.title.trim()}>
          {uploading ? `Uploading… ${videoProgress}%` : saving ? "Saving…" : "Save"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}