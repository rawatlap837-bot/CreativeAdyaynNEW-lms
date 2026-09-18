import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    ClipboardList,
    Plus,
    Pencil,
    Trash2,
    Eye,
    EyeOff,
    Users,
    Calendar,
    Loader2,
    X,
    Save,
    CheckCircle,
    Clock,
    FileText,
    AlertTriangle,
    Info,
    XCircle,
    Paperclip,
} from "lucide-react";

import {
    createAssignment,
    getAssignment,
    getTeacherAssignments,
    updateAssignment,
    publishAssignment,
    unpublishAssignment,
    deleteAssignment,
    getAssignmentSubmissions,
    gradeSubmission,
} from "../services/AssignmentService.js";

import { auth } from "../firebase/Firebase.js";
import { getBatchesForTeacher } from "../services/BatchService.js";
import { uploadAssignmentResource } from "../lib/Cloudinary.js";


/* ============================================================
   HELPERS
   ============================================================ */

function formatDate(value) {
    if (!value) return "No due date";

    try {
        const date =
            typeof value?.toDate === "function"
                ? value.toDate()
                : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "No due date";
        }

        return date.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
    } catch {
        return "No due date";
    }
}

function getTimestampValue(value) {
    if (!value) return 0;

    if (typeof value?.toDate === "function") {
        return value.toDate().getTime();
    }

    if (typeof value?.seconds === "number") {
        return value.seconds * 1000;
    }

    if (value instanceof Date) {
        return value.getTime();
    }

    const parsed = new Date(value).getTime();

    return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDateTime(value) {
    if (!value) return "";

    try {
        const date =
            typeof value?.toDate === "function"
                ? value.toDate()
                : new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}


/* ============================================================
   TOAST NOTIFICATIONS
   ============================================================

   Replaces window.alert(). Call showToast(message, type) from
   inside the component. Toasts stack in the top-right corner,
   auto-dismiss after a few seconds, and can be dismissed early.
   ============================================================ */

const TOAST_STYLES = {
    success: {
        icon: CheckCircle,
        border: "border-green-200",
        bg: "bg-green-50",
        iconColor: "text-green-600",
        text: "text-green-800",
    },
    error: {
        icon: XCircle,
        border: "border-red-200",
        bg: "bg-red-50",
        iconColor: "text-red-600",
        text: "text-red-800",
    },
    info: {
        icon: Info,
        border: "border-purple-200",
        bg: "bg-purple-50",
        iconColor: "text-purple-600",
        text: "text-purple-800",
    },
};

function ToastStack({ toasts, onDismiss }) {
    if (toasts.length === 0) return null;

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
            {toasts.map((toast) => {
                const style =
                    TOAST_STYLES[toast.type] || TOAST_STYLES.info;
                const Icon = style.icon;

                return (
                    <div
                        key={toast.id}
                        role="status"
                        className={`pointer-events-auto flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3 shadow-lg animate-[toast-in_0.2s_ease-out]`}
                    >
                        <Icon
                            className={`w-5 h-5 mt-0.5 shrink-0 ${style.iconColor}`}
                        />

                        <p
                            className={`flex-1 text-sm font-medium ${style.text}`}
                        >
                            {toast.message}
                        </p>

                        <button
                            type="button"
                            onClick={() => onDismiss(toast.id)}
                            className={`shrink-0 rounded-md p-0.5 hover:bg-black/5 ${style.text}`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                );
            })}

            <style>{`
                @keyframes toast-in {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}


/* ============================================================
   CONFIRM MODAL
   ============================================================

   Replaces window.confirm(). Rendered once, driven by state.
   ============================================================ */

function ConfirmModal({ confirmState, onCancel, onConfirm }) {
    if (!confirmState) return null;

    return (
        <div className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
                <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-red-100 shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>

                    <div className="flex-1">
                        <h3 className="text-base font-bold text-slate-900">
                            {confirmState.title}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                            {confirmState.description}
                        </p>
                    </div>
                </div>

                <div className="mt-5 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50 text-sm"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        className="px-4 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 text-sm"
                    >
                        {confirmState.confirmLabel || "Delete"}
                    </button>
                </div>
            </div>
        </div>
    );
}


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

export default function TeacherAssignments() {
    const { courseId } = useParams();
    const navigate = useNavigate();

    const user = auth.currentUser;

    const [assignments, setAssignments] = useState([]);
    const [courseBatches, setCourseBatches] = useState([]);
    const [loading, setLoading] = useState(true);

    const [showForm, setShowForm] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);

    const [saving, setSaving] = useState(false);
    const [attachmentFile, setAttachmentFile] = useState(null);
    const [attachmentProgress, setAttachmentProgress] = useState(0);
    const [actionLoading, setActionLoading] = useState("");

    const [selectedAssignment, setSelectedAssignment] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);

    const [gradingSubmission, setGradingSubmission] = useState(null);
    const [grade, setGrade] = useState("");
    const [feedback, setFeedback] = useState("");
    const [grading, setGrading] = useState(false);

    const [form, setForm] = useState({
        title: "",
        description: "",
        instructions: "",
        dueDate: "",
        totalMarks: 100,
        status: "draft",
        targetBatchId: "",
    });

    // Toast + confirm-modal state
    const [toasts, setToasts] = useState([]);
    const [confirmState, setConfirmState] = useState(null);
    const toastTimers = useRef({});

    const showToast = useCallback((message, type = "info") => {
        const id = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}`;

        setToasts((prev) => [...prev, { id, message, type }]);

        toastTimers.current[id] = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            delete toastTimers.current[id];
        }, 4000);
    }, []);

    const dismissToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));

        if (toastTimers.current[id]) {
            clearTimeout(toastTimers.current[id]);
            delete toastTimers.current[id];
        }
    }, []);

    useEffect(() => {
        return () => {
            Object.values(toastTimers.current).forEach(clearTimeout);
        };
    }, []);

    // Promise-based replacement for window.confirm()
    const askConfirm = useCallback(
        ({ title, description, confirmLabel }) =>
            new Promise((resolve) => {
                setConfirmState({
                    title,
                    description,
                    confirmLabel,
                    resolve,
                });
            }),
        []
    );

    const handleConfirmCancel = () => {
        confirmState?.resolve(false);
        setConfirmState(null);
    };

    const handleConfirmAccept = () => {
        confirmState?.resolve(true);
        setConfirmState(null);
    };


    /* ============================================================
       LOAD ASSIGNMENTS
       ============================================================ */

    const loadAssignments = async () => {
        if (!user?.uid || !courseId) return;

        try {
            setLoading(true);

            const data = await getTeacherAssignments(
                user.uid,
                courseId
            );

            const sorted = Array.isArray(data)
                ? [...data].sort(
                    (a, b) =>
                        getTimestampValue(b.createdAt) -
                        getTimestampValue(a.createdAt)
                )
                : [];

            setAssignments(sorted);
        } catch (error) {
            console.error("Failed to load assignments:", error);
            showToast(
                error?.message || "Failed to load assignments.",
                "error"
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAssignments();
    }, [courseId, user?.uid]);

    useEffect(() => {
        let cancelled = false;

        async function loadCourseBatches() {
            if (!user?.uid || !courseId) {
                setCourseBatches([]);
                return;
            }

            try {
                const batches = await getBatchesForTeacher(user.uid);

                if (!cancelled) {
                    setCourseBatches(
                        batches.filter((batch) => batch.courseId === courseId)
                    );
                }
            } catch (error) {
                console.error("Failed to load assignment batches:", error);
                if (!cancelled) setCourseBatches([]);
            }
        }

        loadCourseBatches();

        return () => {
            cancelled = true;
        };
    }, [courseId, user?.uid]);


    /* ============================================================
       FORM
       ============================================================ */

    const openCreateForm = () => {
        setEditingAssignment(null);

        setForm({
            title: "",
            description: "",
            instructions: "",
            dueDate: "",
            totalMarks: 100,
            status: "draft",
            targetBatchId: "",
        });
        setAttachmentFile(null);
        setAttachmentProgress(0);

        setShowForm(true);
    };

    const openEditForm = (assignment) => {
        setEditingAssignment(assignment);

        let dueDate = "";

        if (assignment.dueDate) {
            try {
                const date =
                    typeof assignment.dueDate?.toDate === "function"
                        ? assignment.dueDate.toDate()
                        : new Date(assignment.dueDate);

                if (!Number.isNaN(date.getTime())) {
                    const local = new Date(
                        date.getTime() -
                        date.getTimezoneOffset() * 60000
                    );

                    dueDate = local
                        .toISOString()
                        .slice(0, 16);
                }
            } catch {
                dueDate = "";
            }
        }

        setForm({
            title: assignment.title || "",
            description: assignment.description || "",
            instructions: assignment.instructions || "",
            dueDate,
            totalMarks: assignment.totalMarks || 100,
            status: assignment.status || "draft",
            targetBatchId: assignment.targetBatchId || "",
        });
        setAttachmentFile(null);
        setAttachmentProgress(0);

        setShowForm(true);
    };

    const closeForm = () => {
        if (saving) return;

        setShowForm(false);
        setEditingAssignment(null);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setForm((prev) => ({
            ...prev,
            [name]: value,
        }));
    };


    /* ============================================================
       SAVE ASSIGNMENT
       ============================================================ */

    const handleSave = async (e) => {
        e.preventDefault();

        if (!user?.uid) {
            showToast("Please log in again.", "error");
            return;
        }

        if (!courseId) {
            showToast("Course ID is missing.", "error");
            return;
        }

        if (!form.title.trim()) {
            showToast("Please enter an assignment title.", "error");
            return;
        }

        try {
            setSaving(true);

            const assignmentData = {
                title: form.title.trim(),
                description: form.description.trim(),
                instructions: form.instructions.trim(),
                dueDate: form.dueDate
                    ? new Date(form.dueDate)
                    : null,
                totalMarks: Number(form.totalMarks) || 100,
                targetBatchId: form.targetBatchId || null,
                targetBatchName:
                    courseBatches.find(
                        (batch) => batch.id === form.targetBatchId
                    )?.name || null,
            };

            if (attachmentFile) {
                const uploadedAttachment = await uploadAssignmentResource(
                    attachmentFile,
                    {
                        folder: `lms/assignments/${courseId}/resources`,
                        onProgress: setAttachmentProgress,
                    }
                );

                assignmentData.attachment = uploadedAttachment;
            } else if (editingAssignment?.attachment) {
                assignmentData.attachment = editingAssignment.attachment;
            }

            if (editingAssignment) {
                await updateAssignment(
                    editingAssignment.id,
                    assignmentData
                );
            } else {
                await createAssignment({
                    ...assignmentData,
                    courseId,
                    teacherId: user.uid,
                    status: "draft",
                });
            }

            setShowForm(false);
            setEditingAssignment(null);

            await loadAssignments();

            showToast(
                editingAssignment
                    ? "Assignment updated successfully."
                    : "Assignment created successfully.",
                "success"
            );
        } catch (error) {
            console.error("Failed to save assignment:", error);

            showToast(
                error?.message || "Failed to save assignment.",
                "error"
            );
        } finally {
            setSaving(false);
        }
    };


    /* ============================================================
       PUBLISH / UNPUBLISH
       ============================================================ */

    const handleTogglePublish = async (assignment) => {
        try {
            setActionLoading(assignment.id);

            if (assignment.status === "published") {
                await unpublishAssignment(assignment.id);
            } else {
                await publishAssignment(assignment.id);
            }

            await loadAssignments();

            showToast(
                assignment.status === "published"
                    ? "Assignment unpublished."
                    : "Assignment published.",
                "success"
            );
        } catch (error) {
            console.error(
                "Failed to change assignment status:",
                error
            );

            showToast(
                error?.message ||
                "Failed to update assignment status.",
                "error"
            );
        } finally {
            setActionLoading("");
        }
    };


    /* ============================================================
       DELETE
       ============================================================ */

    const handleDelete = async (assignment) => {
        const confirmed = await askConfirm({
            title: `Delete "${assignment.title}"?`,
            description: "This action cannot be undone.",
            confirmLabel: "Delete",
        });

        if (!confirmed) return;

        try {
            setActionLoading(assignment.id);

            await deleteAssignment(assignment.id);

            if (
                selectedAssignment?.id === assignment.id
            ) {
                setSelectedAssignment(null);
                setSubmissions([]);
            }

            await loadAssignments();

            showToast("Assignment deleted.", "success");
        } catch (error) {
            console.error(
                "Failed to delete assignment:",
                error
            );

            showToast(
                error?.message || "Failed to delete assignment.",
                "error"
            );
        } finally {
            setActionLoading("");
        }
    };


    /* ============================================================
       VIEW SUBMISSIONS
       ============================================================ */

    const viewSubmissions = async (assignment) => {
        try {
            setSelectedAssignment(assignment);
            setLoadingSubmissions(true);

            const data =
                await getAssignmentSubmissions(
                    assignment.id
                );

            setSubmissions(
                Array.isArray(data) ? data : []
            );
        } catch (error) {
            console.error(
                "Failed to load submissions:",
                error
            );

            showToast(
                error?.message || "Failed to load submissions.",
                "error"
            );
        } finally {
            setLoadingSubmissions(false);
        }
    };


    /* ============================================================
       CLOSE SUBMISSIONS
       ============================================================ */

    const closeSubmissions = () => {
        if (grading) return;

        setSelectedAssignment(null);
        setSubmissions([]);
        setGradingSubmission(null);
    };


    /* ============================================================
       OPEN GRADING
       ============================================================ */

    const openGrading = (submission) => {
        setGradingSubmission(submission);

        setGrade(
            submission.grade !== undefined &&
                submission.grade !== null
                ? String(submission.grade)
                : ""
        );

        setFeedback(
            submission.feedback || ""
        );
    };


    /* ============================================================
       GRADE SUBMISSION
       ============================================================ */

    const handleGrade = async (e) => {
        e.preventDefault();

        if (!gradingSubmission) return;

        if (grade === "") {
            showToast("Please enter a grade.", "error");
            return;
        }

        const numericGrade = Number(grade);

        if (
            Number.isNaN(numericGrade) ||
            numericGrade < 0
        ) {
            showToast("Please enter a valid grade.", "error");
            return;
        }

        try {
            setGrading(true);

            // gradeSubmission(assignmentId, studentId, grade,
            // feedback, teacherId) takes five SEPARATE arguments.
            await gradeSubmission(
                gradingSubmission.assignmentId ||
                selectedAssignment.id,
                gradingSubmission.studentId,
                numericGrade,
                feedback.trim(),
                user.uid
            );

            const updated =
                await getAssignmentSubmissions(
                    selectedAssignment.id
                );

            setSubmissions(
                Array.isArray(updated)
                    ? updated
                    : []
            );

            setGradingSubmission(null);
            setGrade("");
            setFeedback("");

            showToast("Submission graded successfully.", "success");
        } catch (error) {
            console.error(
                "Failed to grade submission:",
                error
            );

            showToast(
                error?.message || "Failed to grade submission.",
                "error"
            );
        } finally {
            setGrading(false);
        }
    };


    /* ============================================================
       LOADING
       ============================================================ */

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-600" />

                    <p className="text-sm text-slate-500">
                        Loading assignments...
                    </p>
                </div>
            </div>
        );
    }


    /* ============================================================
       RENDER
       ============================================================ */

    return (
        <div className="min-h-screen bg-slate-50">

            {/* TOASTS + CONFIRM MODAL */}

            <ToastStack toasts={toasts} onDismiss={dismissToast} />

            <ConfirmModal
                confirmState={confirmState}
                onCancel={handleConfirmCancel}
                onConfirm={handleConfirmAccept}
            />

            {/* ========================================================
          HEADER
      ======================================================== */}

            <div className="bg-white border-b border-slate-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

                        <div className="flex items-center gap-3">

                            <button
                                type="button"
                                onClick={() =>
                                    navigate(
                                        `/teacher/courses/${courseId}/content`
                                    )
                                }
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>

                            <div className="p-3 rounded-xl bg-purple-100">
                                <ClipboardList className="w-6 h-6 text-purple-600" />
                            </div>

                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                                    Assignments
                                </h1>

                                <p className="text-sm text-slate-500">
                                    Create and manage course assignments
                                </p>
                            </div>

                        </div>

                        <button
                            type="button"
                            onClick={openCreateForm}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 transition"
                        >
                            <Plus className="w-5 h-5" />
                            Create Assignment
                        </button>

                    </div>

                </div>
            </div>


            {/* ========================================================
          CONTENT
      ======================================================== */}

            <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

                {assignments.length === 0 ? (

                    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">

                        <div className="mx-auto w-16 h-16 rounded-2xl bg-purple-100 flex items-center justify-center">
                            <ClipboardList className="w-8 h-8 text-purple-600" />
                        </div>

                        <h2 className="mt-5 text-xl font-bold text-slate-900">
                            No assignments yet
                        </h2>

                        <p className="mt-2 text-slate-500 max-w-md mx-auto">
                            Create your first assignment for this course.
                            Students will be able to see published
                            assignments from their dashboard.
                        </p>

                        <button
                            type="button"
                            onClick={openCreateForm}
                            className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700"
                        >
                            <Plus className="w-5 h-5" />
                            Create Assignment
                        </button>

                    </div>

                ) : (

                    <div className="grid gap-5">

                        {assignments.map((assignment) => {

                            const published =
                                assignment.status === "published";

                            return (
                                <div
                                    key={assignment.id}
                                    className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
                                >

                                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">

                                        <div className="flex-1">

                                            <div className="flex flex-wrap items-center gap-2">

                                                <h2 className="text-lg font-bold text-slate-900">
                                                    {assignment.title}
                                                </h2>

                                                <span
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${published
                                                        ? "bg-green-100 text-green-700"
                                                        : "bg-amber-100 text-amber-700"
                                                        }`}
                                                >
                                                    {published ? (
                                                        <>
                                                            <CheckCircle className="w-3.5 h-3.5" />
                                                            Published
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Clock className="w-3.5 h-3.5" />
                                                            Draft
                                                        </>
                                                    )}
                                                </span>

                                            </div>

                                            {assignment.description && (
                                                <p className="mt-2 text-sm text-slate-600">
                                                    {assignment.description}
                                                </p>
                                            )}

                                            <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-500">

                                                <span className="inline-flex items-center gap-1.5">
                                                    <Calendar className="w-4 h-4" />
                                                    Due:{" "}
                                                    {formatDate(
                                                        assignment.dueDate
                                                    )}
                                                </span>

                                                <span className="inline-flex items-center gap-1.5">
                                                    <FileText className="w-4 h-4" />
                                                    {assignment.totalMarks || 100} marks
                                                </span>

                                            </div>

                                        </div>


                                        {/* ACTIONS */}

                                        <div className="flex flex-wrap gap-2">

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    viewSubmissions(
                                                        assignment
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                                            >
                                                <Users className="w-4 h-4" />
                                                Submissions
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() =>
                                                    openEditForm(
                                                        assignment
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium"
                                            >
                                                <Pencil className="w-4 h-4" />
                                                Edit
                                            </button>

                                            <button
                                                type="button"
                                                disabled={
                                                    actionLoading ===
                                                    assignment.id
                                                }
                                                onClick={() =>
                                                    handleTogglePublish(
                                                        assignment
                                                    )
                                                }
                                                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${published
                                                    ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                                    : "bg-green-50 text-green-700 hover:bg-green-100"
                                                    }`}
                                            >
                                                {actionLoading ===
                                                    assignment.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : published ? (
                                                    <EyeOff className="w-4 h-4" />
                                                ) : (
                                                    <Eye className="w-4 h-4" />
                                                )}

                                                {published
                                                    ? "Unpublish"
                                                    : "Publish"}
                                            </button>

                                            <button
                                                type="button"
                                                disabled={
                                                    actionLoading ===
                                                    assignment.id
                                                }
                                                onClick={() =>
                                                    handleDelete(
                                                        assignment
                                                    )
                                                }
                                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-sm font-medium"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                            </button>

                                        </div>

                                    </div>

                                </div>
                            );
                        })}

                    </div>

                )}

            </main>


            {/* ========================================================
          CREATE / EDIT MODAL
      ======================================================== */}

            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

                        <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between">

                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    {editingAssignment
                                        ? "Edit Assignment"
                                        : "Create Assignment"}
                                </h2>

                                <p className="text-sm text-slate-500">
                                    Add the assignment details below.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeForm}
                                className="p-2 rounded-lg hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>


                        <form
                            onSubmit={handleSave}
                            className="p-5 space-y-5"
                        >

                            {/* TITLE */}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Assignment Title
                                </label>

                                <input
                                    type="text"
                                    name="title"
                                    value={form.title}
                                    onChange={handleChange}
                                    placeholder="Example: Digital Marketing Case Study"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>


                            {/* DESCRIPTION */}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Description
                                </label>

                                <textarea
                                    name="description"
                                    value={form.description}
                                    onChange={handleChange}
                                    rows={3}
                                    placeholder="Briefly describe the assignment..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                />
                            </div>


                            {/* INSTRUCTIONS */}

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Instructions
                                </label>

                                <textarea
                                    name="instructions"
                                    value={form.instructions}
                                    onChange={handleChange}
                                    rows={5}
                                    placeholder="Write detailed instructions for students..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Assign to
                                </label>

                                <select
                                    name="targetBatchId"
                                    value={form.targetBatchId}
                                    onChange={handleChange}
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                >
                                    <option value="">
                                        All students in this course
                                    </option>
                                    {courseBatches.map((batch) => (
                                        <option key={batch.id} value={batch.id}>
                                            Batch: {batch.name}
                                        </option>
                                    ))}
                                </select>

                                <p className="mt-1.5 text-xs text-slate-500">
                                    Students outside the selected batch will not see this assignment.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Attachment (photo or PDF)
                                </label>
                                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-600 hover:border-purple-400 hover:bg-purple-50/40">
                                    <Paperclip className="h-5 w-5 shrink-0 text-purple-600" />
                                    <span className="min-w-0 flex-1 truncate">
                                        {attachmentFile?.name ||
                                            editingAssignment?.attachment?.name ||
                                            "Choose JPG, PNG, WEBP, or PDF (max 25 MB)"}
                                    </span>
                                    <input
                                        type="file"
                                        accept="application/pdf,image/jpeg,image/png,image/webp"
                                        onChange={(event) => {
                                            setAttachmentFile(event.target.files?.[0] || null);
                                            setAttachmentProgress(0);
                                        }}
                                        className="sr-only"
                                    />
                                </label>
                                {attachmentProgress > 0 && attachmentProgress < 100 && (
                                    <p className="mt-1.5 text-xs text-purple-600">
                                        Uploading attachment: {attachmentProgress}%
                                    </p>
                                )}
                            </div>


                            {/* DATE + MARKS */}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        Due Date
                                    </label>

                                    <input
                                        type="datetime-local"
                                        name="dueDate"
                                        value={form.dueDate}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                        Total Marks
                                    </label>

                                    <input
                                        type="number"
                                        name="totalMarks"
                                        value={form.totalMarks}
                                        onChange={handleChange}
                                        min="1"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>

                            </div>


                            {/* ACTIONS */}

                            <div className="flex justify-end gap-3 pt-3">

                                <button
                                    type="button"
                                    onClick={closeForm}
                                    disabled={saving}
                                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-60"
                                >
                                    {saving ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <Save className="w-5 h-5" />
                                    )}

                                    {editingAssignment
                                        ? "Update Assignment"
                                        : "Create Assignment"}
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}


            {/* ========================================================
          SUBMISSIONS MODAL
      ======================================================== */}

            {selectedAssignment && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">

                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">

                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">

                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Submissions
                                </h2>

                                <p className="text-sm text-slate-500">
                                    {selectedAssignment.title}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={closeSubmissions}
                                className="p-2 rounded-lg hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>


                        <div className="flex-1 overflow-y-auto p-5">

                            {loadingSubmissions ? (

                                <div className="py-12 flex justify-center">
                                    <Loader2 className="w-7 h-7 animate-spin text-purple-600" />
                                </div>

                            ) : submissions.length === 0 ? (

                                <div className="py-12 text-center">

                                    <Users className="w-12 h-12 mx-auto text-slate-300" />

                                    <p className="mt-3 text-slate-500">
                                        No submissions yet.
                                    </p>

                                </div>

                            ) : (

                                <div className="space-y-4">

                                    {submissions.map((submission) => (

                                        <div
                                            key={
                                                submission.id ||
                                                submission.studentId
                                            }
                                            className="border border-slate-200 rounded-xl p-4"
                                        >

                                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">

                                                <div className="flex-1">

                                                    <div className="flex items-center gap-2">

                                                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                                                            <Users className="w-5 h-5 text-purple-600" />
                                                        </div>

                                                        <div>
                                                            <p className="font-semibold text-slate-900">
                                                                {submission.studentName ||
                                                                    submission.studentEmail ||
                                                                    submission.studentId ||
                                                                    "Student"}
                                                            </p>

                                                            {submission.submittedAt && (
                                                                <p className="text-xs text-slate-500">
                                                                    Submitted{" "}
                                                                    {formatDateTime(
                                                                        submission.submittedAt
                                                                    )}
                                                                </p>
                                                            )}
                                                        </div>

                                                    </div>


                                                    {submission.answerText && (
                                                        <div className="mt-4 bg-slate-50 rounded-lg p-3">

                                                            <p className="text-xs font-semibold text-slate-500 mb-1">
                                                                Answer
                                                            </p>

                                                            <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                                                {submission.answerText}
                                                            </p>

                                                        </div>
                                                    )}


                                                    {submission.fileUrl && (
                                                        <a
                                                            href={
                                                                submission.fileUrl
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-3 inline-flex items-center gap-2 text-sm text-purple-600 font-medium hover:underline"
                                                        >
                                                            <FileText className="w-4 h-4" />
                                                            View submitted file
                                                        </a>
                                                    )}

                                                </div>


                                                <div className="md:min-w-[180px]">

                                                    {submission.grade !==
                                                        undefined &&
                                                        submission.grade !==
                                                        null ? (

                                                        <div className="bg-green-50 rounded-xl p-3">

                                                            <p className="text-xs text-green-700 font-medium">
                                                                Grade
                                                            </p>

                                                            <p className="text-2xl font-bold text-green-700">
                                                                {submission.grade}
                                                                {" / "}
                                                                {selectedAssignment.totalMarks ||
                                                                    100}
                                                            </p>

                                                        </div>

                                                    ) : (

                                                        <div className="bg-amber-50 rounded-xl p-3">

                                                            <p className="text-sm font-semibold text-amber-700">
                                                                Not graded
                                                            </p>

                                                        </div>

                                                    )}

                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            openGrading(
                                                                submission
                                                            )
                                                        }
                                                        className="mt-2 w-full px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-semibold hover:bg-purple-700"
                                                    >
                                                        {submission.grade !==
                                                            undefined &&
                                                            submission.grade !==
                                                            null
                                                            ? "Update Grade"
                                                            : "Grade Submission"}
                                                    </button>

                                                </div>

                                            </div>

                                        </div>

                                    ))}

                                </div>

                            )}

                        </div>

                    </div>

                </div>
            )}


            {/* ========================================================
          GRADING MODAL
      ======================================================== */}

            {gradingSubmission && (
                <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">

                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

                        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">

                            <div>
                                <h2 className="text-lg font-bold text-slate-900">
                                    Grade Submission
                                </h2>

                                <p className="text-sm text-slate-500">
                                    Maximum marks:{" "}
                                    {selectedAssignment?.totalMarks ||
                                        100}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setGradingSubmission(null)
                                }
                                disabled={grading}
                                className="p-2 rounded-lg hover:bg-slate-100"
                            >
                                <X className="w-5 h-5" />
                            </button>

                        </div>


                        <form
                            onSubmit={handleGrade}
                            className="p-5 space-y-5"
                        >

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Grade
                                </label>

                                <input
                                    type="number"
                                    value={grade}
                                    onChange={(e) =>
                                        setGrade(e.target.value)
                                    }
                                    min="0"
                                    max={
                                        selectedAssignment?.totalMarks ||
                                        100
                                    }
                                    step="0.01"
                                    placeholder="Enter marks"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                                    Feedback
                                </label>

                                <textarea
                                    value={feedback}
                                    onChange={(e) =>
                                        setFeedback(e.target.value)
                                    }
                                    rows={5}
                                    placeholder="Write feedback for the student..."
                                    className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                                />
                            </div>


                            <div className="flex justify-end gap-3">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setGradingSubmission(null)
                                    }
                                    disabled={grading}
                                    className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    disabled={grading}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-60"
                                >
                                    {grading && (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    )}

                                    Save Grade
                                </button>

                            </div>

                        </form>

                    </div>

                </div>
            )}

        </div>
    );
}