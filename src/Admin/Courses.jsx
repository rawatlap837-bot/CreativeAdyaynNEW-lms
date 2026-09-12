// src/Admin/Courses.jsx

import React, { useEffect, useMemo, useState } from "react";

import {
  AlertCircle,
  Archive,
  BookOpen,
  Check,
  Eye,
  Filter,
  LayoutGrid,
  RefreshCw,
  Search,
  Star,
  Trash2,
  Users,
  X,
} from "lucide-react";

import {
  collection,
  getDocs,
} from "firebase/firestore";

import {
  AT,
  Card,
  ConfirmDeleteModal,
  EmptyState,
  GhostButton,
  Modal,
  PrimaryButton,
  StatCard,
} from "./AdminUI";

import {
  approveCourse,
  rejectCourse,
  adminUnpublishCourse,
  adminDeleteCourse,
  setFeatured,
  subscribeToAllCourses,
} from "../services/AdminCourseService";

import { db } from "../firebase/Firebase";


// ============================================================
// HELPERS
// ============================================================

function toDate(value) {
  if (!value) return null;

  if (
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}


function formatDate(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}


function formatPrice(course) {
  const currency =
    course.currency || "INR";

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
        currency,
        maximumFractionDigits: 0,
      }
    ).format(Number(price));
  } catch {
    return `₹${price}`;
  }
}


function getTypeLabel(type) {
  if (type === "long") {
    return "Long / Live";
  }

  return "Short Course";
}


function getStatusStyle(status) {
  const styles = {
    published: {
      background: AT.successSoft,
      color: AT.success,
    },

    pending: {
      background: AT.warnSoft,
      color: AT.warn,
    },

    draft: {
      background: AT.line,
      color: AT.sub,
    },

    rejected: {
      background: AT.dangerSoft,
      color: AT.danger,
    },

    archived: {
      background: AT.line,
      color: AT.sub,
    },
  };

  return (
    styles[status] || {
      background: AT.line,
      color: AT.sub,
    }
  );
}


function StatusBadge({ status }) {
  const style =
    getStatusStyle(status);

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize"
      style={{
        background:
          style.background,
        color: style.color,
      }}
    >
      {status || "unknown"}
    </span>
  );
}


function TypeBadge({ type }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background:
          type === "long"
            ? "#EEF2FF"
            : "#F0FDFA",
        color:
          type === "long"
            ? "#4F46E5"
            : AT.accentDeep,
      }}
    >
      {type === "long" ? (
        <LayoutGrid size={12} />
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

export default function Courses() {
  const [courses, setCourses] =
    useState([]);

  const [instructors, setInstructors] =
    useState({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [typeFilter, setTypeFilter] =
    useState("all");

  const [instructorFilter, setInstructorFilter] =
    useState("all");

  const [selectedCourse, setSelectedCourse] =
    useState(null);

  const [rejectingCourse, setRejectingCourse] =
    useState(null);

  const [rejectReason, setRejectReason] =
    useState("");

  const [deleteCourse, setDeleteCourse] =
    useState(null);

  const [busyAction, setBusyAction] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  // ----------------------------------------------------------
  // LOAD COURSES
  // ----------------------------------------------------------

  useEffect(() => {
    setLoading(true);
    setError("");

    const unsubscribe =
      subscribeToAllCourses(
        (items) => {
          setCourses(items);
          setLoading(false);
        },

        (firebaseError) => {
          console.error(
            "Admin course listener:",
            firebaseError
          );

          setError(
            firebaseError?.message ||
              "Unable to load courses."
          );

          setLoading(false);
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);


  // ----------------------------------------------------------
  // LOAD INSTRUCTORS
  // ----------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadInstructors() {
      try {
        const snapshot =
          await getDocs(
            collection(db, "users")
          );

        if (cancelled) return;

        const map = {};

        snapshot.docs.forEach(
          (userDoc) => {
            const data =
              userDoc.data();

            if (
              data.role === "teacher"
            ) {
              map[userDoc.id] = {
                id: userDoc.id,

                name:
                  data.displayName ||
                  data.name ||
                  data.fullName ||
                  data.email ||
                  "Teacher",

                email:
                  data.email || "",
              };
            }
          }
        );

        setInstructors(map);
      } catch (firebaseError) {
        console.error(
          "Unable to load instructors:",
          firebaseError
        );
      }
    }

    loadInstructors();

    return () => {
      cancelled = true;
    };
  }, []);


  // ==========================================================
  // FILTER OPTIONS
  // ==========================================================

  const instructorOptions =
    useMemo(() => {
      const ids = new Set();

      courses.forEach(
        (course) => {
          if (course.instructorId) {
            ids.add(
              course.instructorId
            );
          }
        }
      );

      return Array.from(ids).map(
        (id) => ({
          id,
          name:
            instructors[id]?.name ||
            "Unknown Instructor",
        })
      );
    }, [courses, instructors]);


  // ==========================================================
  // FILTERED COURSES
  // ==========================================================

  const filteredCourses =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return courses.filter(
        (course) => {
          const instructor =
            instructors[
              course.instructorId
            ];

          const instructorName =
            instructor?.name ||
            "";

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
              .includes(term) ||

            instructorName
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

          const matchesInstructor =
            instructorFilter ===
              "all" ||
            course.instructorId ===
              instructorFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType &&
            matchesInstructor
          );
        }
      );
    }, [
      courses,
      instructors,
      search,
      statusFilter,
      typeFilter,
      instructorFilter,
    ]);


  // ==========================================================
  // STATS
  // ==========================================================

  const stats = useMemo(() => {
    return {
      total: courses.length,

      short: courses.filter(
        (course) =>
          course.type === "short"
      ).length,

      live: courses.filter(
        (course) =>
          course.type === "long"
      ).length,

      published: courses.filter(
        (course) =>
          course.status ===
          "published"
      ).length,

      pending: courses.filter(
        (course) =>
          course.status ===
          "pending"
      ).length,

      draft: courses.filter(
        (course) =>
          course.status ===
          "draft"
      ).length,

      rejected: courses.filter(
        (course) =>
          course.status ===
          "rejected"
      ).length,

      archived: courses.filter(
        (course) =>
          course.status ===
          "archived"
      ).length,

      featured: courses.filter(
        (course) =>
          course.featured === true
      ).length,
    };
  }, [courses]);


  // ==========================================================
  // ACTION WRAPPER
  // ==========================================================

  async function runAction(
    key,
    action
  ) {
    setBusyAction(key);
    setActionError("");

    try {
      await action();
    } catch (firebaseError) {
      console.error(
        "Admin course action:",
        firebaseError
      );

      setActionError(
        firebaseError?.message ||
          "Something went wrong."
      );
    } finally {
      setBusyAction("");
    }
  }


  // ==========================================================
  // APPROVE
  // ==========================================================

  async function handleApprove(course) {
    await runAction(
      `approve-${course.id}`,

      async () => {
        await approveCourse(
          course.id
        );

        setSelectedCourse(null);
      }
    );
  }


  // ==========================================================
  // REJECT
  // ==========================================================

  async function handleReject() {
    if (!rejectingCourse) {
      return;
    }

    if (!rejectReason.trim()) {
      setActionError(
        "Please enter a rejection reason."
      );

      return;
    }

    await runAction(
      `reject-${rejectingCourse.id}`,

      async () => {
        await rejectCourse(
          rejectingCourse.id,
          rejectReason
        );

        setRejectingCourse(null);
        setRejectReason("");
      }
    );
  }


  // ==========================================================
  // UNPUBLISH
  // ==========================================================

  async function handleUnpublish(
    course
  ) {
    const confirmed =
      window.confirm(
        `Unpublish "${course.title}"?\n\nThis will remove the course from the public LMS.`
      );

    if (!confirmed) {
      return;
    }

    await runAction(
      `unpublish-${course.id}`,

      async () => {
        await adminUnpublishCourse(
          course.id
        );
      }
    );
  }


  // ==========================================================
  // DELETE
  // ==========================================================

  async function handleDelete() {
    if (!deleteCourse) {
      return;
    }

    await runAction(
      `delete-${deleteCourse.id}`,

      async () => {
        await adminDeleteCourse(
          deleteCourse.id
        );

        setDeleteCourse(null);
        setSelectedCourse(null);
      }
    );
  }


  // ==========================================================
  // FEATURED
  // ==========================================================

  async function handleFeatured(
    course
  ) {
    /**
     * Featured is an admin-only platform
     * curation control.
     *
     * Only published courses should
     * normally be featured.
     */
    if (
      course.status !==
      "published"
    ) {
      return;
    }

    await runAction(
      `featured-${course.id}`,

      async () => {
        await setFeatured(
          course.id,
          !course.featured
        );
      }
    );
  }


  // ==========================================================
  // RESET FILTERS
  // ==========================================================

  function resetFilters() {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setInstructorFilter("all");
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          AT.canvas,
        color: AT.ink,
      }}
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

            <div>
              <div className="flex items-center gap-2">
                <BookOpen
                  size={22}
                  color={AT.accentDeep}
                />

                <h1 className="text-2xl font-semibold">
                  Course Approvals
                </h1>
              </div>

              <p
                className="text-sm mt-1"
                style={{
                  color: AT.sub,
                }}
              >
                Review and oversee courses
                created by teachers.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <GhostButton
                onClick={() => {
                  window.location.reload();
                }}
              >
                <RefreshCw size={15} />
                Refresh
              </GhostButton>
            </div>
          </div>
        </div>


        {/* ==================================================
            ACTION ERROR
        ================================================== */}

        {(error ||
          actionError) && (
          <div
            className="mb-5 rounded-xl px-4 py-3 flex items-start gap-3"
            style={{
              background:
                AT.dangerSoft,
              color:
                AT.danger,
              border:
                `1px solid ${AT.danger}`,
            }}
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="text-sm">
              {actionError ||
                error}
            </div>
          </div>
        )}


        {/* ==================================================
            STATS
        ================================================== */}

        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">

          <StatCard
            label="Total Courses"
            value={stats.total}
            icon={BookOpen}
          />

          <StatCard
            label="Short Courses"
            value={stats.short}
            icon={BookOpen}
          />

          <StatCard
            label="Live Courses"
            value={stats.live}
            icon={LayoutGrid}
          />

          <StatCard
            label="Published"
            value={stats.published}
            icon={Check}
          />

          <StatCard
            label="Pending"
            value={stats.pending}
            icon={AlertCircle}
          />

          <StatCard
            label="Draft"
            value={stats.draft}
            icon={BookOpen}
          />

          <StatCard
            label="Archived"
            value={stats.archived}
            icon={Archive}
          />

          <StatCard
            label="Featured"
            value={stats.featured}
            icon={Star}
          />
        </div>


        {/* ==================================================
            FILTERS
        ================================================== */}

        <Card>
          <div className="p-4">

            <div className="flex items-center gap-2 mb-3">
              <Filter
                size={16}
                color={AT.sub}
              />

              <span className="text-sm font-semibold">
                Search & Filters
              </span>
            </div>


            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">

              {/* Search */}

              <div className="relative xl:col-span-2">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                  color={AT.sub}
                />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search course, category or instructor..."
                  className="w-full rounded-lg border pl-9 pr-3 py-2 text-sm outline-none"
                  style={{
                    borderColor:
                      AT.line,
                  }}
                />
              </div>


              {/* Status */}

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor:
                    AT.line,
                }}
              >
                <option value="all">
                  All Statuses
                </option>

                <option value="pending">
                  Pending Approval
                </option>

                <option value="published">
                  Published
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="rejected">
                  Rejected
                </option>

                <option value="archived">
                  Archived
                </option>
              </select>


              {/* Type */}

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor:
                    AT.line,
                }}
              >
                <option value="all">
                  All Types
                </option>

                <option value="short">
                  Short Course
                </option>

                <option value="long">
                  Long / Live
                </option>
              </select>


              {/* Instructor */}

              <select
                value={
                  instructorFilter
                }
                onChange={(event) =>
                  setInstructorFilter(
                    event.target.value
                  )
                }
                className="rounded-lg border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor:
                    AT.line,
                }}
              >
                <option value="all">
                  All Instructors
                </option>

                {instructorOptions.map(
                  (instructor) => (
                    <option
                      key={
                        instructor.id
                      }
                      value={
                        instructor.id
                      }
                    >
                      {instructor.name}
                    </option>
                  )
                )}
              </select>
            </div>


            <div className="flex justify-between items-center mt-3">

              <p
                className="text-xs"
                style={{
                  color: AT.sub,
                }}
              >
                Showing{" "}
                <strong>
                  {filteredCourses.length}
                </strong>{" "}
                of{" "}
                <strong>
                  {courses.length}
                </strong>{" "}
                courses
              </p>

              {(search ||
                statusFilter !==
                  "all" ||
                typeFilter !==
                  "all" ||
                instructorFilter !==
                  "all") && (
                <button
                  onClick={
                    resetFilters
                  }
                  className="text-xs font-medium"
                  style={{
                    color:
                      AT.accentDeep,
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        </Card>


        {/* ==================================================
            COURSE TABLE
        ================================================== */}

        <div className="mt-5">
          <Card title="All Courses">
            {loading ? (
              <div className="px-5 py-12 text-center">
                <RefreshCw
                  size={22}
                  className="animate-spin mx-auto mb-3"
                  color={AT.accentDeep}
                />

                <p
                  className="text-sm"
                  style={{
                    color: AT.sub,
                  }}
                >
                  Loading courses...
                </p>
              </div>
            ) : filteredCourses.length ===
              0 ? (
              <EmptyState
                text={
                  courses.length === 0
                    ? "No courses have been created yet."
                    : "No courses match your filters."
                }
              />
            ) : (
              <div className="overflow-x-auto">

                <table className="w-full min-w-[1050px]">

                  <thead>
                    <tr
                      className="border-b"
                      style={{
                        borderColor:
                          AT.line,
                      }}
                    >
                      <th className="text-left px-5 py-3 text-xs font-semibold">
                        Course
                      </th>

                      <th className="text-left px-4 py-3 text-xs font-semibold">
                        Type
                      </th>

                      <th className="text-left px-4 py-3 text-xs font-semibold">
                        Instructor
                      </th>

                      <th className="text-left px-4 py-3 text-xs font-semibold">
                        Price
                      </th>

                      <th className="text-left px-4 py-3 text-xs font-semibold">
                        Students
                      </th>

                      <th className="text-left px-4 py-3 text-xs font-semibold">
                        Status
                      </th>

                      <th className="text-left px-4 py-3 text-xs font-semibold">
                        Updated
                      </th>

                      <th className="text-right px-5 py-3 text-xs font-semibold">
                        Actions
                      </th>
                    </tr>
                  </thead>


                  <tbody>

                    {filteredCourses.map(
                      (course) => {
                        const instructor =
                          instructors[
                            course.instructorId
                          ];

                        const studentCount =
                          course.students ??
                          course.studentCount ??
                          0;

                        return (
                          <tr
                            key={
                              course.id
                            }
                            className="border-b last:border-b-0 hover:bg-slate-50"
                            style={{
                              borderColor:
                                AT.line,
                            }}
                          >

                            {/* Course */}

                            <td className="px-5 py-4">

                              <div className="flex items-center gap-3">

                                <div
                                  className="w-12 h-12 rounded-lg overflow-hidden shrink-0"
                                  style={{
                                    background:
                                      AT.line,
                                  }}
                                >
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
                                    <div className="w-full h-full flex items-center justify-center">
                                      <BookOpen
                                        size={19}
                                        color={
                                          AT.sub
                                        }
                                      />
                                    </div>
                                  )}
                                </div>

                                <div className="min-w-0">

                                  <p className="font-medium text-sm truncate max-w-[300px]">
                                    {course.title ||
                                      "Untitled Course"}
                                  </p>

                                  <p
                                    className="text-xs mt-0.5 truncate max-w-[300px]"
                                    style={{
                                      color:
                                        AT.sub,
                                    }}
                                  >
                                    {course.category ||
                                      "Uncategorized"}
                                  </p>

                                  {course.featured ===
                                    true && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] mt-1 font-medium"
                                      style={{
                                        color:
                                          AT.warn,
                                      }}
                                    >
                                      <Star
                                        size={10}
                                        fill="currentColor"
                                      />
                                      Featured
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>


                            {/* Type */}

                            <td className="px-4 py-4">
                              <TypeBadge
                                type={
                                  course.type
                                }
                              />
                            </td>


                            {/* Instructor */}

                            <td className="px-4 py-4">

                              <div className="flex items-center gap-2">

                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center"
                                  style={{
                                    background:
                                      AT.accentSoft,
                                  }}
                                >
                                  <Users
                                    size={14}
                                    color={
                                      AT.accentDeep
                                    }
                                  />
                                </div>

                                <div>
                                  <p className="text-sm font-medium">
                                    {instructor?.name ||
                                      "Unknown Instructor"}
                                  </p>

                                  {instructor?.email && (
                                    <p
                                      className="text-xs"
                                      style={{
                                        color:
                                          AT.sub,
                                      }}
                                    >
                                      {instructor.email}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>


                            {/* Price */}

                            <td className="px-4 py-4">
                              <span className="text-sm font-medium">
                                {formatPrice(
                                  course
                                )}
                              </span>
                            </td>


                            {/* Students */}

                            <td className="px-4 py-4">
                              <span className="text-sm">
                                {Number(
                                  studentCount
                                ).toLocaleString(
                                  "en-IN"
                                )}
                              </span>
                            </td>


                            {/* Status */}

                            <td className="px-4 py-4">
                              <StatusBadge
                                status={
                                  course.status
                                }
                              />
                            </td>


                            {/* Updated */}

                            <td className="px-4 py-4">
                              <span
                                className="text-xs"
                                style={{
                                  color:
                                    AT.sub,
                                }}
                              >
                                {formatDate(
                                  course.updatedAt ||
                                    course.createdAt
                                )}
                              </span>
                            </td>


                            {/* Actions */}

                            <td className="px-5 py-4">

                              <div className="flex items-center justify-end gap-1.5">

                                {/* View */}

                                <button
                                  title="View"
                                  onClick={() =>
                                    setSelectedCourse(
                                      course
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100"
                                  style={{
                                    color:
                                      AT.sub,
                                  }}
                                >
                                  <Eye
                                    size={16}
                                  />
                                </button>


                                {/* Approve */}

                                {course.status ===
                                  "pending" && (
                                  <button
                                    title="Approve"
                                    disabled={
                                      busyAction ===
                                      `approve-${course.id}`
                                    }
                                    onClick={() =>
                                      handleApprove(
                                        course
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                                    style={{
                                      color:
                                        AT.success,
                                      background:
                                        AT.successSoft,
                                    }}
                                  >
                                    <Check
                                      size={16}
                                    />
                                  </button>
                                )}


                                {/* Reject */}

                                {course.status ===
                                  "pending" && (
                                  <button
                                    title="Reject"
                                    onClick={() => {
                                      setRejectingCourse(
                                        course
                                      );
                                      setRejectReason(
                                        ""
                                      );
                                      setActionError(
                                        ""
                                      );
                                    }}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{
                                      color:
                                        AT.danger,
                                      background:
                                        AT.dangerSoft,
                                    }}
                                  >
                                    <X
                                      size={16}
                                    />
                                  </button>
                                )}


                                {/* Featured */}

                                {course.status ===
                                  "published" && (
                                  <button
                                    title={
                                      course.featured
                                        ? "Remove featured"
                                        : "Make featured"
                                    }
                                    disabled={
                                      busyAction ===
                                      `featured-${course.id}`
                                    }
                                    onClick={() =>
                                      handleFeatured(
                                        course
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                                    style={{
                                      color:
                                        course.featured
                                          ? AT.warn
                                          : AT.sub,
                                      background:
                                        course.featured
                                          ? AT.warnSoft
                                          : "transparent",
                                    }}
                                  >
                                    <Star
                                      size={16}
                                      fill={
                                        course.featured
                                          ? "currentColor"
                                          : "none"
                                      }
                                    />
                                  </button>
                                )}


                                {/* Emergency Unpublish */}

                                {course.status ===
                                  "published" && (
                                  <button
                                    title="Emergency unpublish"
                                    disabled={
                                      busyAction ===
                                      `unpublish-${course.id}`
                                    }
                                    onClick={() =>
                                      handleUnpublish(
                                        course
                                      )
                                    }
                                    className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50"
                                    style={{
                                      color:
                                        AT.warn,
                                    }}
                                  >
                                    <Archive
                                      size={16}
                                    />
                                  </button>
                                )}


                                {/* Emergency Delete */}

                                <button
                                  title="Emergency delete"
                                  onClick={() =>
                                    setDeleteCourse(
                                      course
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                                  style={{
                                    color:
                                      AT.danger,
                                  }}
                                >
                                  <Trash2
                                    size={16}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                    )}

                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>


      {/* ======================================================
          VIEW COURSE MODAL
      ====================================================== */}

      {selectedCourse && (
        <Modal
          title="Course Review"
          onClose={() =>
            setSelectedCourse(null)
          }
        >
          <div className="max-h-[75vh] overflow-y-auto">

            {/* Thumbnail */}

            {selectedCourse.thumbnailUrl && (
              <img
                src={
                  selectedCourse.thumbnailUrl
                }
                alt={
                  selectedCourse.title
                }
                className="w-full h-44 object-cover rounded-xl mb-4"
              />
            )}


            {/* Title */}

            <h2 className="text-xl font-semibold">
              {selectedCourse.title ||
                "Untitled Course"}
            </h2>

            <div className="flex flex-wrap gap-2 mt-2">
              <TypeBadge
                type={
                  selectedCourse.type
                }
              />

              <StatusBadge
                status={
                  selectedCourse.status
                }
              />

              {selectedCourse.featured && (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{
                    background:
                      AT.warnSoft,
                    color:
                      AT.warn,
                  }}
                >
                  <Star
                    size={12}
                    fill="currentColor"
                  />
                  Featured
                </span>
              )}
            </div>


            {/* Information */}

            <div className="grid grid-cols-2 gap-3 mt-5">

              <InfoItem
                label="Instructor"
                value={
                  instructors[
                    selectedCourse
                      .instructorId
                  ]?.name ||
                  "Unknown"
                }
              />

              <InfoItem
                label="Category"
                value={
                  selectedCourse.category ||
                  "—"
                }
              />

              <InfoItem
                label="Level"
                value={
                  selectedCourse.level ||
                  "—"
                }
              />

              <InfoItem
                label="Price"
                value={formatPrice(
                  selectedCourse
                )}
              />

              <InfoItem
                label="Duration"
                value={
                  selectedCourse.duration ||
                  "—"
                }
              />

              <InfoItem
                label="Students"
                value={
                  selectedCourse.students ??
                  selectedCourse.studentCount ??
                  0
                }
              />

              <InfoItem
                label="Homepage Order"
                value={
                  selectedCourse.order ??
                  "—"
                }
              />

              <InfoItem
                label="Last Updated"
                value={formatDate(
                  selectedCourse.updatedAt
                )}
              />
            </div>


            {/* Description */}

            {selectedCourse.shortDescription && (
              <div className="mt-5">
                <h3 className="text-sm font-semibold mb-1">
                  Short Description
                </h3>

                <p
                  className="text-sm leading-6"
                  style={{
                    color: AT.sub,
                  }}
                >
                  {
                    selectedCourse.shortDescription
                  }
                </p>
              </div>
            )}


            {selectedCourse.description && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold mb-1">
                  Description
                </h3>

                <p
                  className="text-sm leading-6 whitespace-pre-wrap"
                  style={{
                    color: AT.sub,
                  }}
                >
                  {
                    selectedCourse.description
                  }
                </p>
              </div>
            )}


            {/* Rejection */}

            {selectedCourse.rejectionReason && (
              <div
                className="mt-4 rounded-lg p-3"
                style={{
                  background:
                    AT.dangerSoft,
                }}
              >
                <p
                  className="text-xs font-semibold"
                  style={{
                    color:
                      AT.danger,
                  }}
                >
                  Rejection Reason
                </p>

                <p
                  className="text-sm mt-1"
                  style={{
                    color:
                      AT.danger,
                  }}
                >
                  {
                    selectedCourse.rejectionReason
                  }
                </p>
              </div>
            )}


            {/* Dates */}

            <div className="mt-5 pt-4 border-t grid grid-cols-2 gap-3">
              <InfoItem
                label="Created"
                value={formatDate(
                  selectedCourse.createdAt
                )}
              />

              <InfoItem
                label="Published"
                value={formatDate(
                  selectedCourse.publishedAt
                )}
              />
            </div>


            {/* Admin Actions */}

            <div className="flex flex-wrap justify-end gap-2 mt-6">

              {selectedCourse.status ===
                "pending" && (
                <>
                  <GhostButton
                    onClick={() => {
                      setRejectingCourse(
                        selectedCourse
                      );

                      setRejectReason(
                        ""
                      );

                      setSelectedCourse(
                        null
                      );
                    }}
                  >
                    <X size={15} />
                    Reject
                  </GhostButton>

                  <PrimaryButton
                    disabled={
                      busyAction ===
                      `approve-${selectedCourse.id}`
                    }
                    onClick={() =>
                      handleApprove(
                        selectedCourse
                      )
                    }
                  >
                    <Check size={15} />
                    Approve
                  </PrimaryButton>
                </>
              )}

              {selectedCourse.status ===
                "published" && (
                <GhostButton
                  onClick={() =>
                    handleUnpublish(
                      selectedCourse
                    )
                  }
                >
                  <Archive
                    size={15}
                  />
                  Unpublish
                </GhostButton>
              )}

              <GhostButton
                onClick={() =>
                  setSelectedCourse(null)
                }
              >
                Close
              </GhostButton>
            </div>
          </div>
        </Modal>
      )}


      {/* ======================================================
          REJECT MODAL
      ====================================================== */}

      {rejectingCourse && (
        <Modal
          title="Reject Course"
          onClose={() => {
            setRejectingCourse(
              null
            );

            setRejectReason("");
          }}
        >
          <p
            className="text-sm mb-4"
            style={{
              color: AT.sub,
            }}
          >
            Explain why{" "}
            <strong
              style={{
                color: AT.ink,
              }}
            >
              {rejectingCourse.title}
            </strong>{" "}
            needs changes.
          </p>

          <textarea
            value={rejectReason}
            onChange={(event) =>
              setRejectReason(
                event.target.value
              )
            }
            rows={5}
            autoFocus
            placeholder="Example: Please update the course thumbnail and correct the pricing information."
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none"
            style={{
              borderColor:
                AT.line,
            }}
          />

          <div className="flex justify-end gap-2 mt-4">

            <GhostButton
              onClick={() => {
                setRejectingCourse(
                  null
                );

                setRejectReason("");
              }}
            >
              Cancel
            </GhostButton>

            <button
              onClick={
                handleReject
              }
              disabled={
                busyAction ===
                `reject-${rejectingCourse.id}`
              }
              className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-white disabled:opacity-50"
              style={{
                background:
                  AT.danger,
              }}
            >
              <X size={15} />

              {busyAction ===
              `reject-${rejectingCourse.id}`
                ? "Rejecting..."
                : "Reject Course"}
            </button>
          </div>
        </Modal>
      )}


      {/* ======================================================
          DELETE CONFIRMATION
      ====================================================== */}

      {deleteCourse && (
        <ConfirmDeleteModal
          name={
            deleteCourse.title ||
            "this course"
          }
          onCancel={() =>
            setDeleteCourse(null)
          }
          onConfirm={
            handleDelete
          }
        />
      )}
    </div>
  );
}


// ============================================================
// INFO ITEM
// ============================================================

function InfoItem({
  label,
  value,
}) {
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background:
          AT.canvas,
      }}
    >
      <p
        className="text-[11px] mb-1"
        style={{
          color: AT.sub,
        }}
      >
        {label}
      </p>

      <p className="text-sm font-medium break-words">
        {value}
      </p>
    </div>
  );
}