import React, { useEffect, useMemo, useState } from "react";
import {
    AlertCircle,
    CheckCircle2,
    Clock,
    FileText,
    Loader2,
    Paperclip,
    Send,
    Upload,
    X,
} from "lucide-react";

import { auth } from "../firebase/Firebase";

import {
    getMyAssignments,
    getStudentSubmission,
    submitAssignment,
} from "../services/AssignmentService";

import {
    uploadAssignmentSubmission,
} from "../services/StorageService";

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value) {
    if (!value) return "No due date";

    try {
        let date;

        if (value?.seconds) {
            date = new Date(value.seconds * 1000);
        } else if (value instanceof Date) {
            date = value;
        } else {
            date = new Date(value);
        }

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

function getDateValue(value) {
    if (!value) return null;

    if (value?.seconds) {
        return new Date(value.seconds * 1000);
    }

    if (value instanceof Date) {
        return value;
    }

    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? null : date;
}

function isOverdue(assignment) {
    const dueDate = getDateValue(assignment.dueDate);

    if (!dueDate) return false;

    return dueDate.getTime() < Date.now();
}

function getStatus(assignment, submission) {
    if (!submission) {
        return isOverdue(assignment) ? "overdue" : "not-submitted";
    }

    if (
        submission.grade !== null &&
        submission.grade !== undefined
    ) {
        return "graded";
    }

    return "submitted";
}

function statusLabel(status) {
    switch (status) {
        case "graded":
            return "Graded";

        case "submitted":
            return "Submitted";

        case "overdue":
            return "Overdue";

        default:
            return "Not Submitted";
    }
}

/* =========================================================
   COMPONENT
========================================================= */

/*
  Expected props:

  courseIds:
    Array of course IDs the student is enrolled in.

  Example:

  <Assignments
    courseIds={["course123", "course456"]}
  />
*/

export default function Assignments({
    courseIds = [],
}) {
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({});

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [filter, setFilter] = useState("all");
    const [expandedId, setExpandedId] = useState(null);

    const [answerText, setAnswerText] = useState({});
    const [selectedFiles, setSelectedFiles] = useState({});

    const [uploadProgress, setUploadProgress] = useState({});
    const [submitting, setSubmitting] = useState({});

    /* =======================================================
       LOAD ASSIGNMENTS
    ======================================================= */

    const loadAssignments = async () => {
        try {
            setLoading(true);
            setError("");

            const user = auth.currentUser;

            if (!user) {
                setError("Please log in to view your assignments.");
                setLoading(false);
                return;
            }

            if (!Array.isArray(courseIds) || courseIds.length === 0) {
                setAssignments([]);
                setLoading(false);
                return;
            }

            const result = await getMyAssignments(courseIds);

            setAssignments(Array.isArray(result) ? result : []);

            /* ---------------------------------------------------
               LOAD STUDENT SUBMISSIONS
            --------------------------------------------------- */

            const submissionMap = {};

            await Promise.all(
                result.map(async (assignment) => {
                    try {
                        const submission =
                            await getStudentSubmission(
                                assignment.id,
                                user.uid
                            );

                        if (submission) {
                            submissionMap[assignment.id] = submission;
                        }
                    } catch (submissionError) {
                        console.error(
                            `Failed to load submission for ${assignment.id}:`,
                            submissionError
                        );
                    }
                })
            );

            setSubmissions(submissionMap);
        } catch (err) {
            console.error(
                "Failed to load assignments:",
                err
            );

            setError(
                err?.message ||
                "Failed to load assignments."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAssignments();
    }, [JSON.stringify(courseIds)]);

    /* =======================================================
       FILTER ASSIGNMENTS
    ======================================================= */

    const filteredAssignments = useMemo(() => {
        return assignments.filter((assignment) => {
            const submission =
                submissions[assignment.id];

            const status = getStatus(
                assignment,
                submission
            );

            if (filter === "all") return true;

            return status === filter;
        });
    }, [
        assignments,
        submissions,
        filter,
    ]);

    /* =======================================================
       COUNTS
    ======================================================= */

    const counts = useMemo(() => {
        let notSubmitted = 0;
        let submitted = 0;
        let graded = 0;
        let overdue = 0;

        assignments.forEach((assignment) => {
            const submission =
                submissions[assignment.id];

            const status = getStatus(
                assignment,
                submission
            );

            if (status === "not-submitted") {
                notSubmitted++;
            }

            if (status === "submitted") {
                submitted++;
            }

            if (status === "graded") {
                graded++;
            }

            if (status === "overdue") {
                overdue++;
            }
        });

        return {
            all: assignments.length,
            notSubmitted,
            submitted,
            graded,
            overdue,
        };
    }, [
        assignments,
        submissions,
    ]);

    /* =======================================================
       FILE SELECT
    ======================================================= */

    const handleFileChange = (
        assignmentId,
        event
    ) => {
        const file = event.target.files?.[0];

        if (!file) return;

        setSelectedFiles((previous) => ({
            ...previous,
            [assignmentId]: file,
        }));
    };

    /* =======================================================
       REMOVE FILE
    ======================================================= */

    const removeSelectedFile = (
        assignmentId
    ) => {
        setSelectedFiles((previous) => {
            const updated = {
                ...previous,
            };

            delete updated[assignmentId];

            return updated;
        });
    };

    /* =======================================================
       TEXT CHANGE
    ======================================================= */

    const handleAnswerChange = (
        assignmentId,
        value
    ) => {
        setAnswerText((previous) => ({
            ...previous,
            [assignmentId]: value,
        }));
    };

    /* =======================================================
       SUBMIT ASSIGNMENT
    ======================================================= */

    const handleSubmit = async (assignment) => {
        const user = auth.currentUser;

        if (!user) {
            alert("Please log in first.");
            return;
        }

        const text =
            answerText[assignment.id] || "";

        const file =
            selectedFiles[assignment.id];

        if (!text.trim() && !file) {
            alert(
                "Please write an answer or select a file."
            );
            return;
        }

        try {
            setSubmitting((previous) => ({
                ...previous,
                [assignment.id]: true,
            }));

            setUploadProgress((previous) => ({
                ...previous,
                [assignment.id]: 0,
            }));

            let uploadedFile = null;

            /* ---------------------------------------------------
               UPLOAD FILE
            --------------------------------------------------- */

            if (file) {
                uploadedFile =
                    await uploadAssignmentSubmission(
                        file,
                        assignment.id,
                        (progress) => {
                            setUploadProgress(
                                (previous) => ({
                                    ...previous,
                                    [assignment.id]:
                                        progress,
                                })
                            );
                        }
                    );
            }

            /* ---------------------------------------------------
               SUBMIT TO FIRESTORE

               FIX: submitAssignment(assignmentId, submissionData)
               takes the assignment ID and the submission payload
               as two SEPARATE arguments — it does not accept a
               single merged object. Passing everything as one
               object silently sent assignmentId as undefined,
               which threw "Assignment ID is required." on every
               submit attempt.
            --------------------------------------------------- */

            await submitAssignment(assignment.id, {
                studentId: user.uid,
                studentName:
                    user.displayName ||
                    user.email ||
                    "Student",
                text,
                fileUrl:
                    uploadedFile?.url || "",
                fileName:
                    uploadedFile?.name || "",
            });

            /* ---------------------------------------------------
               RELOAD SUBMISSION
            --------------------------------------------------- */

            const updatedSubmission =
                await getStudentSubmission(
                    assignment.id,
                    user.uid
                );

            setSubmissions((previous) => ({
                ...previous,
                [assignment.id]:
                    updatedSubmission,
            }));

            setAnswerText((previous) => ({
                ...previous,
                [assignment.id]: "",
            }));

            removeSelectedFile(
                assignment.id
            );

            setUploadProgress((previous) => ({
                ...previous,
                [assignment.id]: 100,
            }));

        } catch (err) {
            console.error(
                "Assignment submission error:",
                err
            );

            alert(
                err?.message ||
                "Failed to submit assignment."
            );
        } finally {
            setSubmitting((previous) => ({
                ...previous,
                [assignment.id]: false,
            }));
        }
    };

    /* =======================================================
       LOADING
    ======================================================= */

    if (loading) {
        return (
            <div className="flex min-h-[300px] items-center justify-center">
                <div className="flex items-center gap-3 text-gray-500">
                    <Loader2
                        className="animate-spin"
                        size={22}
                    />
                    <span>
                        Loading assignments...
                    </span>
                </div>
            </div>
        );
    }

    /* =======================================================
       ERROR
    ======================================================= */

    if (error) {
        return (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
                <div className="flex items-start gap-3">
                    <AlertCircle
                        size={22}
                        className="mt-0.5 shrink-0"
                    />

                    <div>
                        <p className="font-semibold">
                            Unable to load assignments
                        </p>

                        <p className="mt-1 text-sm">
                            {error}
                        </p>

                        <button
                            type="button"
                            onClick={loadAssignments}
                            className="mt-3 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                        >
                            Try Again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    /* =======================================================
       MAIN UI
    ======================================================= */

    return (
        <div className="space-y-6">

            {/* ---------------------------------------------------
          HEADER
      --------------------------------------------------- */}

            <div>
                <h1 className="text-2xl font-bold text-gray-900">
                    Assignments
                </h1>

                <p className="mt-1 text-sm text-gray-500">
                    View, submit and track your course assignments.
                </p>
            </div>

            {/* ---------------------------------------------------
          STATS
      --------------------------------------------------- */}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">

                <button
                    type="button"
                    onClick={() => setFilter("all")}
                    className={`rounded-xl border p-4 text-left transition ${filter === "all"
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <p className="text-xs text-gray-500">
                        All
                    </p>

                    <p className="mt-1 text-2xl font-bold text-gray-900">
                        {counts.all}
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setFilter("not-submitted")
                    }
                    className={`rounded-xl border p-4 text-left transition ${filter === "not-submitted"
                        ? "border-orange-500 bg-orange-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <p className="text-xs text-gray-500">
                        Not Submitted
                    </p>

                    <p className="mt-1 text-2xl font-bold text-gray-900">
                        {counts.notSubmitted}
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setFilter("submitted")
                    }
                    className={`rounded-xl border p-4 text-left transition ${filter === "submitted"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <p className="text-xs text-gray-500">
                        Submitted
                    </p>

                    <p className="mt-1 text-2xl font-bold text-gray-900">
                        {counts.submitted}
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setFilter("graded")
                    }
                    className={`rounded-xl border p-4 text-left transition ${filter === "graded"
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <p className="text-xs text-gray-500">
                        Graded
                    </p>

                    <p className="mt-1 text-2xl font-bold text-gray-900">
                        {counts.graded}
                    </p>
                </button>

                <button
                    type="button"
                    onClick={() =>
                        setFilter("overdue")
                    }
                    className={`rounded-xl border p-4 text-left transition ${filter === "overdue"
                        ? "border-red-500 bg-red-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                >
                    <p className="text-xs text-gray-500">
                        Overdue
                    </p>

                    <p className="mt-1 text-2xl font-bold text-gray-900">
                        {counts.overdue}
                    </p>
                </button>

            </div>

            {/* ---------------------------------------------------
          ASSIGNMENT LIST
      --------------------------------------------------- */}

            {filteredAssignments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">

                    <FileText
                        size={42}
                        className="mx-auto text-gray-300"
                    />

                    <h3 className="mt-4 text-lg font-semibold text-gray-800">
                        No assignments found
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                        There are no assignments matching this filter.
                    </p>

                </div>
            ) : (
                <div className="space-y-4">

                    {filteredAssignments.map(
                        (assignment) => {
                            const submission =
                                submissions[
                                assignment.id
                                ];

                            const status =
                                getStatus(
                                    assignment,
                                    submission
                                );

                            const expanded =
                                expandedId ===
                                assignment.id;

                            const file =
                                selectedFiles[
                                assignment.id
                                ];

                            const progress =
                                uploadProgress[
                                assignment.id
                                ] || 0;

                            const isSubmitting =
                                submitting[
                                assignment.id
                                ];

                            return (
                                <div
                                    key={assignment.id}
                                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                                >

                                    {/* ---------------------------------------
                      CARD HEADER
                  --------------------------------------- */}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedId(
                                                expanded
                                                    ? null
                                                    : assignment.id
                                            )
                                        }
                                        className="w-full p-5 text-left"
                                    >
                                        <div className="flex items-start justify-between gap-4">

                                            <div className="flex min-w-0 gap-4">

                                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                                    <FileText
                                                        size={22}
                                                    />
                                                </div>

                                                <div className="min-w-0">

                                                    <h2 className="truncate text-base font-semibold text-gray-900">
                                                        {assignment.title}
                                                    </h2>

                                                    <p className="mt-1 text-sm text-gray-500">
                                                        {assignment.points || 100} points
                                                    </p>

                                                    <p className="mt-1 truncate text-sm font-medium text-indigo-600">
                                                        {assignment.courseName ||
                                                            assignment.courseTitle ||
                                                            `Course ${assignment.courseId || ""}`}
                                                    </p>

                                                </div>

                                            </div>

                                            <span
                                                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${status === "graded"
                                                    ? "bg-green-100 text-green-700"
                                                    : status === "submitted"
                                                        ? "bg-blue-100 text-blue-700"
                                                        : status === "overdue"
                                                            ? "bg-red-100 text-red-700"
                                                            : "bg-orange-100 text-orange-700"
                                                    }`}
                                            >
                                                {statusLabel(
                                                    status
                                                )}
                                            </span>

                                        </div>

                                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-500">

                                            <span className="flex items-center gap-1.5">
                                                <Clock size={15} />
                                                Due:{" "}
                                                {formatDate(
                                                    assignment.dueDate
                                                )}
                                            </span>

                                            {submission && (
                                                <span className="flex items-center gap-1.5 text-green-600">
                                                    <CheckCircle2
                                                        size={15}
                                                    />
                                                    Submitted
                                                </span>
                                            )}

                                        </div>
                                    </button>

                                    {/* ---------------------------------------
                      EXPANDED CONTENT
                  --------------------------------------- */}

                                    {expanded && (
                                        <div className="border-t border-gray-100 p-5">

                                            {/* INSTRUCTIONS */}

                                            {assignment.instructions && (
                                                <div className="mb-6">

                                                    <h3 className="mb-2 text-sm font-semibold text-gray-900">
                                                        Instructions
                                                    </h3>

                                                    <div className="rounded-xl bg-gray-50 p-4 text-sm leading-6 text-gray-700 whitespace-pre-wrap">
                                                        {
                                                            assignment.instructions
                                                        }
                                                    </div>

                                                </div>
                                            )}

                                            {assignment.attachment?.url && (
                                                <div className="mb-6">
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <h3 className="text-sm font-semibold text-gray-900">
                                                            Assignment file
                                                        </h3>
                                                        <a
                                                            href={assignment.attachment.url}
                                                            download={assignment.attachment.name || true}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
                                                        >
                                                            Download
                                                        </a>
                                                    </div>

                                                    {assignment.attachment.type?.startsWith("image/") ? (
                                                        <img
                                                            src={assignment.attachment.url}
                                                            alt={assignment.attachment.name || "Assignment attachment"}
                                                            className="max-h-80 w-full rounded-xl border border-gray-200 object-contain bg-gray-50 p-2"
                                                        />
                                                    ) : (
                                                        <a
                                                            href={assignment.attachment.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="block rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                                                        >
                                                            {assignment.attachment.name || "Open assignment PDF"}
                                                        </a>
                                                    )}
                                                </div>
                                            )}

                                            {/* GRADE */}

                                            {submission &&
                                                submission.grade !==
                                                null &&
                                                submission.grade !==
                                                undefined && (
                                                    <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">

                                                        <div className="flex items-center justify-between gap-4">

                                                            <div>
                                                                <p className="text-sm font-medium text-green-800">
                                                                    Your Grade
                                                                </p>

                                                                <p className="mt-1 text-2xl font-bold text-green-700">
                                                                    {
                                                                        submission.grade
                                                                    }{" "}
                                                                    /{" "}
                                                                    {
                                                                        assignment.points
                                                                    }
                                                                </p>
                                                            </div>

                                                            <CheckCircle2
                                                                size={32}
                                                                className="text-green-600"
                                                            />

                                                        </div>

                                                        {submission.feedback && (
                                                            <div className="mt-4 border-t border-green-200 pt-4">

                                                                <p className="text-sm font-medium text-green-800">
                                                                    Teacher Feedback
                                                                </p>

                                                                <p className="mt-1 whitespace-pre-wrap text-sm text-green-700">
                                                                    {
                                                                        submission.feedback
                                                                    }
                                                                </p>

                                                            </div>
                                                        )}

                                                    </div>
                                                )}

                                            {/* PREVIOUS SUBMISSION */}

                                            {submission && (
                                                <div className="mb-6 rounded-xl border border-gray-200 p-4">

                                                    <h3 className="mb-3 text-sm font-semibold text-gray-900">
                                                        Previous Submission
                                                    </h3>

                                                    {submission.text && (
                                                        <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                                                            {
                                                                submission.text
                                                            }
                                                        </div>
                                                    )}

                                                    {submission.fileUrl && (
                                                        <a
                                                            href={
                                                                submission.fileUrl
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                                                        >
                                                            <Paperclip
                                                                size={16}
                                                            />

                                                            {submission.fileName ||
                                                                "View submitted file"}
                                                        </a>
                                                    )}

                                                </div>
                                            )}

                                            {/* SUBMISSION FORM */}

                                            <div>

                                                <h3 className="mb-3 text-sm font-semibold text-gray-900">
                                                    {submission
                                                        ? "Resubmit Assignment"
                                                        : "Submit Assignment"}
                                                </h3>

                                                <textarea
                                                    value={
                                                        answerText[
                                                        assignment.id
                                                        ] || ""
                                                    }
                                                    onChange={(event) =>
                                                        handleAnswerChange(
                                                            assignment.id,
                                                            event.target.value
                                                        )
                                                    }
                                                    placeholder="Write your answer here..."
                                                    rows={6}
                                                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                                                />

                                                {/* FILE UPLOAD */}

                                                <div className="mt-4">

                                                    {!file ? (
                                                        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 transition hover:border-indigo-400 hover:bg-indigo-50/30">

                                                            <Upload
                                                                size={20}
                                                            />

                                                            <span>
                                                                Choose a file to upload
                                                            </span>

                                                            <input
                                                                type="file"
                                                                className="hidden"
                                                                onChange={(event) =>
                                                                    handleFileChange(
                                                                        assignment.id,
                                                                        event
                                                                    )
                                                                }
                                                            />

                                                        </label>
                                                    ) : (
                                                        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">

                                                            <div className="flex min-w-0 items-center gap-3">

                                                                <Paperclip
                                                                    size={18}
                                                                    className="shrink-0 text-indigo-600"
                                                                />

                                                                <div className="min-w-0">

                                                                    <p className="truncate text-sm font-medium text-gray-800">
                                                                        {file.name}
                                                                    </p>

                                                                    <p className="text-xs text-gray-500">
                                                                        {(
                                                                            file.size /
                                                                            1024 /
                                                                            1024
                                                                        ).toFixed(
                                                                            2
                                                                        )}{" "}
                                                                        MB
                                                                    </p>

                                                                </div>

                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    removeSelectedFile(
                                                                        assignment.id
                                                                    )
                                                                }
                                                                className="rounded-lg p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                                                            >
                                                                <X
                                                                    size={18}
                                                                />
                                                            </button>

                                                        </div>
                                                    )}

                                                </div>

                                                {/* PROGRESS */}

                                                {isSubmitting &&
                                                    file && (
                                                        <div className="mt-4">

                                                            <div className="mb-1 flex justify-between text-xs text-gray-500">
                                                                <span>
                                                                    Uploading...
                                                                </span>

                                                                <span>
                                                                    {progress}%
                                                                </span>
                                                            </div>

                                                            <div className="h-2 overflow-hidden rounded-full bg-gray-200">

                                                                <div
                                                                    className="h-full rounded-full bg-indigo-600 transition-all"
                                                                    style={{
                                                                        width: `${progress}%`,
                                                                    }}
                                                                />

                                                            </div>

                                                        </div>
                                                    )}

                                                {/* SUBMIT BUTTON */}

                                                <button
                                                    type="button"
                                                    disabled={
                                                        isSubmitting
                                                    }
                                                    onClick={() =>
                                                        handleSubmit(
                                                            assignment
                                                        )
                                                    }
                                                    className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                                                >
                                                    {isSubmitting ? (
                                                        <>
                                                            <Loader2
                                                                size={18}
                                                                className="animate-spin"
                                                            />
                                                            Submitting...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Send
                                                                size={18}
                                                            />
                                                            {submission
                                                                ? "Resubmit Assignment"
                                                                : "Submit Assignment"}
                                                        </>
                                                    )}
                                                </button>

                                            </div>

                                        </div>
                                    )}

                                </div>
                            );
                        }
                    )}

                </div>
            )}
        </div>
    );
}