// src/teacher/Courses.jsx

import React, { useMemo, useState } from "react";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Edit3,
  Eye,
  FileText,
  Plus,
  Search,
  Trash2,
  Video,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  deleteCourse,
  useMyCourses,
} from "../services/CourseService";


// ============================================================
// SMALL HELPERS
// ============================================================

function formatDate(value) {
  if (!value) return "—";

  let date = null;

  if (
    typeof value?.toDate === "function"
  ) {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (
    !date ||
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


// Turns a Firestore Timestamp, Date, ISO string, or millis number
// into a plain number of milliseconds, so courses can be sorted
// newest-first regardless of how their date fields are stored.
function toMillis(value) {
  if (!value) return 0;

  if (typeof value?.toDate === "function") {
    return value.toDate().getTime();
  }

  if (typeof value?.seconds === "number") {
    // Raw Firestore Timestamp-like object (not yet hydrated).
    return value.seconds * 1000;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 0
    : date.getTime();
}


function getTypeLabel(type) {
  return type === "long"
    ? "Long / Live Course"
    : "Short Course";
}


function getStatusConfig(status) {
  const configs = {
    draft: {
      label: "Draft",
      className:
        "bg-slate-100 text-slate-600",
      icon: FileText,
    },


    published: {
      label: "Published",
      className:
        "bg-emerald-50 text-emerald-700",
      icon: CheckCircle2,
    },

    rejected: {
      label: "Rejected",
      className:
        "bg-red-50 text-red-700",
      icon: XCircle,
    },

    archived: {
      label: "Archived",
      className:
        "bg-slate-100 text-slate-500",
      icon: Archive,
    },
  };

  return (
    configs[status] || {
      label: status || "Unknown",
      className:
        "bg-slate-100 text-slate-600",
      icon: FileText,
    }
  );
}


function formatPrice(course) {
  const price =
    course.discountPrice ??
    course.price ??
    0;

  if (
    price === 0 ||
    price === "0"
  ) {
    return "Free";
  }

  try {
    return new Intl.NumberFormat(
      "en-IN",
      {
        style: "currency",
        currency:
          course.currency || "INR",
        maximumFractionDigits: 0,
      }
    ).format(Number(price));
  } catch {
    return `₹${price}`;
  }
}


// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({ status }) {
  const config =
    getStatusConfig(status);

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <Icon size={12} />
      {config.label}
    </span>
  );
}


// ============================================================
// TYPE BADGE
// ============================================================

function TypeBadge({ type }) {
  const isLive =
    type === "long";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${isLive
          ? "bg-violet-50 text-violet-700"
          : "bg-blue-50 text-blue-700"
        }`}
    >
      {isLive ? (
        <Video size={12} />
      ) : (
        <BookOpen size={12} />
      )}

      {getTypeLabel(type)}
    </span>
  );
}


// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TeacherCourses() {
  const navigate = useNavigate();

  const {
    courses,
    loading,
    error,
  } = useMyCourses();

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [deletingId, setDeletingId] =
    useState(null);

  const [actionError, setActionError] =
    useState("");


  // ==========================================================
  // FILTER + SORT COURSES
  //
  // Newest first — sorted by createdAt (falling back to
  // updatedAt for older documents that might not have a
  // createdAt field), so a course you just added always shows
  // up at the top of the list instead of wherever the backend
  // happened to return it.
  // ==========================================================

  const filteredCourses =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return courses
        .filter(
          (course) => {
            const matchesSearch =
              !term ||
              String(
                course.title || ""
              )
                .toLowerCase()
                .includes(term) ||

              String(
                course.category || ""
              )
                .toLowerCase()
                .includes(term);

            const matchesStatus =
              statusFilter === "all" ||
              course.status ===
              statusFilter;

            const matchesType =
              typeFilter === "all" ||
              course.type ===
              typeFilter;

            return (
              matchesSearch &&
              matchesStatus &&
              matchesType
            );
          }
        )
        .sort(
          (a, b) =>
            toMillis(
              b.createdAt ||
              b.updatedAt
            ) -
            toMillis(
              a.createdAt ||
              a.updatedAt
            )
        );
    }, [
      courses,
      search,
      statusFilter,
      typeFilter,
    ]);


  // ==========================================================
  // COURSE COUNTS
  // ==========================================================

  const counts = useMemo(
    () => ({
      all: courses.length,

      draft: courses.filter(
        (course) =>
          course.status ===
          "draft"
      ).length,

      published: courses.filter(
        (course) =>
          course.status ===
          "published"
      ).length,

      rejected: courses.filter(
        (course) =>
          course.status ===
          "rejected"
      ).length,
    }),
    [courses]
  );


  // ==========================================================
  // DELETE COURSE
  // ==========================================================

  async function handleDelete(course) {
    const confirmed =
      window.confirm(
        `Delete "${course.title}"?\n\nThis will permanently remove the course and its content.`
      );

    if (!confirmed) {
      return;
    }

    setDeletingId(course.id);
    setActionError("");

    try {
      await deleteCourse(
        course.id
      );
    } catch (err) {
      console.error(
        "Delete course:",
        err
      );

      setActionError(
        err?.message ||
        "Unable to delete course."
      );
    } finally {
      setDeletingId(null);
    }
  }




  // ==========================================================
  // CREATE COURSE
  // ==========================================================

  function handleCreateCourse() {
    navigate(
      "/teacher/courses/create"
    );
  }


  // ==========================================================
  // EDIT COURSE
  // ==========================================================

  function handleEdit(course) {
    navigate(
      `/teacher/courses/edit/${course.id}`
    );
  }


  // ==========================================================
  // CONTENT
  // ==========================================================

  function handleContent(course) {
    navigate(
      `/teacher/courses/${course.id}/content`
    );
  }


  // ==========================================================
  // VIEW
  // ==========================================================

  function handleView(course) {
    navigate(
      `/courses/${course.id}`
    );
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className="min-h-screen bg-slate-50">

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">

          <div>
            <p className="text-sm text-slate-500 mb-1">
              Teacher Dashboard
            </p>

            <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900">
              My Courses
            </h1>

            <p className="text-sm text-slate-500 mt-1">
              Create, manage and publish your courses.
            </p>
          </div>

          <button
            type="button"
            onClick={
              handleCreateCourse
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-slate-800 transition sm:w-auto"
          >
            <Plus size={17} />

            Add Course
          </button>
        </div>


        {/* ==================================================
            ERROR
        ================================================== */}

        {(error ||
          actionError) && (
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">

              <XCircle
                size={18}
                className="shrink-0 mt-0.5"
              />

              <span>
                {actionError ||
                  error}
              </span>
            </div>
          )}


        {/* ==================================================
            QUICK STATS
        ================================================== */}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">

          <MiniStat
            label="All Courses"
            value={counts.all}
            active={
              statusFilter ===
              "all"
            }
            onClick={() =>
              setStatusFilter(
                "all"
              )
            }
          />

          <MiniStat
            label="Draft"
            value={counts.draft}
            active={
              statusFilter ===
              "draft"
            }
            onClick={() =>
              setStatusFilter(
                "draft"
              )
            }
          />

          <MiniStat
            label="Published"
            value={counts.published}
            active={
              statusFilter ===
              "published"
            }
            onClick={() =>
              setStatusFilter(
                "published"
              )
            }
          />

          <MiniStat
            label="Rejected"
            value={counts.rejected}
            active={
              statusFilter ===
              "rejected"
            }
            onClick={() =>
              setStatusFilter(
                "rejected"
              )
            }
          />
        </div>


        {/* ==================================================
            SEARCH + FILTER
        ================================================== */}

        <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5">

          <div className="flex flex-col lg:flex-row gap-3">

            {/* Search */}

            <div className="relative flex-1">

              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search your courses..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
              />
            </div>


            {/* Type */}

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none lg:w-auto"
            >
              <option value="all">
                All Course Types
              </option>

              <option value="short">
                Short Courses
              </option>

              <option value="long">
                Long / Live Courses
              </option>
            </select>


            {/* Status */}

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none lg:w-auto"
            >
              <option value="all">
                All Statuses
              </option>

              <option value="draft">
                Draft
              </option>


              <option value="published">
                Published
              </option>

              <option value="rejected">
                Rejected
              </option>

              <option value="archived">
                Archived
              </option>
            </select>
          </div>
        </div>


        {/* ==================================================
            COURSE LIST
        ================================================== */}

        {loading ? (
          <LoadingState />
        ) : filteredCourses.length ===
          0 ? (
          <EmptyCourses
            hasCourses={
              courses.length > 0
            }
            onCreate={
              handleCreateCourse
            }
          />
        ) : (
          <div className="space-y-4">

            {filteredCourses.map(
              (course) => (
                <CourseRow
                  key={
                    course.id
                  }
                  course={
                    course
                  }
                  deleting={
                    deletingId ===
                    course.id
                  }
                  onEdit={
                    handleEdit
                  }
                  onContent={
                    handleContent
                  }
                  onView={
                    handleView
                  }
                  onDelete={
                    handleDelete
                  }
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ============================================================
// MINI STAT
// ============================================================

function MiniStat({
  label,
  value,
  active,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border p-4 transition ${active
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white hover:border-slate-300"
        }`}
    >
      <p
        className={`text-xs ${active
            ? "text-slate-300"
            : "text-slate-500"
          }`}
      >
        {label}
      </p>

      <p className="text-xl font-semibold mt-1">
        {value}
      </p>
    </button>
  );
}


// ============================================================
// COURSE ROW
// ============================================================

function CourseRow({
  course,
  deleting,
  onEdit,
  onContent,
  onView,
  onDelete,
}) {
  const status =
    getStatusConfig(
      course.status
    );

  const canEdit =
    course.status !==
    "published";

  const canDelete =
    course.status !==
    "published";


  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">

      <div className="p-4 sm:p-5">

        <div className="flex flex-col lg:flex-row gap-5">

          {/* =================================================
              THUMBNAIL
          ================================================= */}

          <div className="w-full lg:w-52 h-32 shrink-0 rounded-xl overflow-hidden bg-slate-100">

            {course.thumbnailUrl ? (
              <img
                src={
                  course.thumbnailUrl
                }
                alt={
                  course.title ||
                  "Course"
                }
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <BookOpen
                  size={30}
                />
              </div>
            )}
          </div>


          {/* =================================================
              COURSE INFORMATION
          ================================================= */}

          <div className="flex-1 min-w-0">

            <div className="flex flex-wrap items-center gap-2 mb-2">

              <TypeBadge
                type={
                  course.type
                }
              />

              <StatusBadge
                status={
                  course.status
                }
              />
            </div>


            <h2 className="text-lg font-semibold text-slate-900 truncate">
              {course.title ||
                "Untitled Course"}
            </h2>


            {course.shortDescription && (
              <p className="text-sm text-slate-500 mt-1 line-clamp-2 max-w-3xl">
                {
                  course.shortDescription
                }
              </p>
            )}


            <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4 text-xs text-slate-500">

              <span>
                Category:{" "}
                <strong className="text-slate-700 font-medium">
                  {course.category ||
                    "—"}
                </strong>
              </span>

              <span>
                Price:{" "}
                <strong className="text-slate-700 font-medium">
                  {formatPrice(
                    course
                  )}
                </strong>
              </span>

              <span>
                Updated:{" "}
                <strong className="text-slate-700 font-medium">
                  {formatDate(
                    course.updatedAt ||
                    course.createdAt
                  )}
                </strong>
              </span>

              {course.students !==
                undefined && (
                  <span>
                    Students:{" "}
                    <strong className="text-slate-700 font-medium">
                      {course.students}
                    </strong>
                  </span>
                )}
            </div>


            {/* =================================================
                REJECTION REASON
            ================================================= */}

            {course.status ===
              "rejected" &&
              course.rejectionReason && (
                <div className="mt-4 rounded-xl bg-red-50 border border-red-100 p-3">

                  <p className="text-xs font-semibold text-red-700">
                    Admin feedback
                  </p>

                  <p className="text-sm text-red-700 mt-1">
                    {
                      course.rejectionReason
                    }
                  </p>
                </div>
              )}
          </div>


          {/* =================================================
              ACTIONS
          ================================================= */}

          <div className="grid grid-cols-2 gap-2 sm:flex lg:flex-col lg:items-stretch lg:w-40 shrink-0">

            {/* Content */}

            <button
              type="button"
              onClick={() =>
                onContent(
                  course
                )
              }
              className="w-full lg:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-medium hover:bg-slate-800 transition"
            >
              <FileText
                size={14}
              />

              Manage Content
            </button>


            {/* Edit */}

            {canEdit && (
              <button
                type="button"
                onClick={() =>
                  onEdit(
                    course
                  )
                }
                className="w-full lg:flex-none inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition"
              >
                <Edit3
                  size={14}
                />

                Edit Details
              </button>
            )}


            {/* View published */}

            {course.status ===
              "published" && (
                <button
                  type="button"
                  onClick={() =>
                    onView(
                      course
                    )
                  }
                  className="w-full lg:flex-none inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-slate-700 px-3 py-2 text-xs font-medium hover:bg-slate-50 transition"
                >
                  <Eye
                    size={14}
                  />

                  View Live
                </button>
              )}




            {/* Delete */}

            {canDelete && (
              <button
                type="button"
                disabled={
                  deleting
                }
                onClick={() =>
                  onDelete(
                    course
                  )
                }
                className="w-full lg:flex-none inline-flex items-center justify-center gap-2 rounded-lg text-red-600 px-3 py-2 text-xs font-medium hover:bg-red-50 disabled:opacity-50 transition"
              >
                <Trash2
                  size={14}
                />

                {deleting
                  ? "Deleting..."
                  : "Delete"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ============================================================
// LOADING
// ============================================================

function LoadingState() {
  return (
    <div className="space-y-4">

      {[1, 2, 3].map(
        (item) => (
          <div
            key={item}
            className="bg-white border border-slate-200 rounded-2xl p-5 animate-pulse"
          >
            <div className="flex gap-5">

              <div className="w-52 h-32 bg-slate-100 rounded-xl" />

              <div className="flex-1">
                <div className="h-4 bg-slate-100 rounded w-32 mb-3" />

                <div className="h-6 bg-slate-100 rounded w-2/3 mb-3" />

                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}


// ============================================================
// EMPTY
// ============================================================

function EmptyCourses({
  hasCourses,
  onCreate,
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">

      <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500">
        {hasCourses ? (
          <Search
            size={24}
          />
        ) : (
          <BookOpen
            size={24}
          />
        )}
      </div>

      <h3 className="mt-4 text-lg font-semibold text-slate-900">
        {hasCourses
          ? "No courses found"
          : "You haven't created a course yet"}
      </h3>

      <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
        {hasCourses
          ? "Try changing your search or filters."
          : "Create your first course and start adding your learning content."}
      </p>

      {!hasCourses && (
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-2 mt-5 rounded-xl bg-slate-900 text-white px-4 py-2.5 text-sm font-medium"
        >
          <Plus size={16} />
          Create Course
        </button>
      )}
    </div>
  );
}