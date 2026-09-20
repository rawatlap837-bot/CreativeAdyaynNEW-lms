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
} from "../lib/database";

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
  adminPublishCourse,
  adminDeleteCourse,
  setFeatured,
  subscribeToAllCourses,
} from "../services/AdminCourseService";

import { db } from "../lib/backend";

// ============================================================
// HELPERS
// ============================================================

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = toDate(value);

  if (!date) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrice(course) {
  const currency = course.currency || "INR";

  const price =
    course.discountPrice ??
    course.price ??
    0;

  if (price === 0 || price === "0") {
    return "Free";
  }

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(price));
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
  const style = getStatusStyle(status);

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize whitespace-nowrap"
      style={{
        background: style.background,
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
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap"
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
  const [courses, setCourses] = useState([]);

  const [instructors, setInstructors] = useState({});

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [search, setSearch] = useState("");

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

  const [confirmAction, setConfirmAction] =
    useState(null);

  // shape: { type: "publish" | "unpublish", course }

  const [busyAction, setBusyAction] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  // ==========================================================
  // LOAD COURSES
  // ==========================================================

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

  // ==========================================================
  // LOAD INSTRUCTORS
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadInstructors() {
      try {
        const snapshot = await getDocs(
          collection(db, "users")
        );

        if (cancelled) return;

        const map = {};

        snapshot.docs.forEach((userDoc) => {
          const data = userDoc.data();

          if (data.role === "teacher") {
            map[userDoc.id] = {
              id: userDoc.id,

              name:
                data.displayName ||
                data.name ||
                data.fullName ||
                data.email ||
                "Teacher",

              email: data.email || "",
            };
          }
        });

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

  const instructorOptions = useMemo(() => {
    const ids = new Set();

    courses.forEach((course) => {
      if (course.instructorId) {
        ids.add(course.instructorId);
      }
    });

    return Array.from(ids).map((id) => ({
      id,
      name:
        instructors[id]?.name ||
        "Unknown Instructor",
    }));
  }, [courses, instructors]);

  // ==========================================================
  // FILTERED + SORTED COURSES
  // NEWEST COURSES FIRST
  // ==========================================================

  const filteredCourses = useMemo(() => {
    const term = search.trim().toLowerCase();

    // Create a copy so the original courses array
    // from Firebase is never mutated.
    const sortedCourses = [...courses].sort(
      (a, b) => {
        const getTimestamp = (course) => {
          // Created date is the primary sorting value.
          // Updated date is used only when createdAt
          // is not available.
          const date =
            toDate(course.createdAt) ||
            toDate(course.updatedAt);

          return date ? date.getTime() : 0;
        };

        const dateA = getTimestamp(a);
        const dateB = getTimestamp(b);

        // Newest courses first
        if (dateA !== dateB) {
          return dateB - dateA;
        }

        // Fallback when dates are identical or missing
        return String(b.id || "").localeCompare(
          String(a.id || "")
        );
      }
    );

    return sortedCourses.filter((course) => {
      const instructor =
        instructors[course.instructorId];

      const instructorName =
        instructor?.name || "";

      const matchesSearch =
        !term ||
        String(course.title || "")
          .toLowerCase()
          .includes(term) ||
        String(course.category || "")
          .toLowerCase()
          .includes(term) ||
        instructorName
          .toLowerCase()
          .includes(term);

      const matchesStatus =
        statusFilter === "all" ||
        course.status === statusFilter;

      const matchesType =
        typeFilter === "all" ||
        course.type === typeFilter;

      const matchesInstructor =
        instructorFilter === "all" ||
        course.instructorId ===
        instructorFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesType &&
        matchesInstructor
      );
    });
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
          course.status === "published"
      ).length,

      pending: courses.filter(
        (course) =>
          course.status === "pending"
      ).length,

      draft: courses.filter(
        (course) =>
          course.status === "draft"
      ).length,

      rejected: courses.filter(
        (course) =>
          course.status === "rejected"
      ).length,

      archived: courses.filter(
        (course) =>
          course.status === "archived"
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

  async function runAction(key, action) {
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
        await approveCourse(course.id);

        setSelectedCourse(null);
      }
    );
  }

  // ==========================================================
  // PUBLISH
  // ==========================================================

  function handlePublish(course) {
    setConfirmAction({
      type: "publish",
      course,
    });
  }

  // ==========================================================
  // REJECT
  // ==========================================================

  async function handleReject() {
    if (!rejectingCourse) return;

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

  function handleUnpublish(course) {
    setConfirmAction({
      type: "unpublish",
      course,
    });
  }

  // ==========================================================
  // CONFIRM PUBLISH / UNPUBLISH
  // ==========================================================

  async function handleConfirmAction() {
    if (!confirmAction) return;

    const { type, course } = confirmAction;

    setConfirmAction(null);

    if (type === "publish") {
      await runAction(
        `publish-${course.id}`,
        async () => {
          await adminPublishCourse(course.id);

          setSelectedCourse(null);
        }
      );
    }

    if (type === "unpublish") {
      await runAction(
        `unpublish-${course.id}`,
        async () => {
          await adminUnpublishCourse(course.id);
        }
      );
    }
  }

  // ==========================================================
  // DELETE
  // ==========================================================

  async function handleDelete() {
    if (!deleteCourse) return;

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

  async function handleFeatured(course) {
    if (course.status !== "published") {
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
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{
        background: AT.canvas,
        color: AT.ink,
      }}
    >
      <div className="mx-auto w-full max-w-[1600px] px-3 py-4 sm:px-5 sm:py-6 lg:px-8 lg:py-8">

        {/* ==================================================
            HEADER
        ================================================== */}

        <div className="mb-5 sm:mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <BookOpen
                  size={21}
                  color={AT.accentDeep}
                  className="shrink-0"
                />

                <h1 className="text-xl font-semibold sm:text-2xl">
                  Course Approvals
                </h1>
              </div>

              <p
                className="mt-1 max-w-2xl text-xs leading-5 sm:text-sm"
                style={{
                  color: AT.sub,
                }}
              >
                Review and oversee courses
                created by teachers.
              </p>
            </div>

            <div className="w-full sm:w-auto">
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

        {(error || actionError) && (
          <div
            className="mb-5 flex items-start gap-3 rounded-xl px-3 py-3 sm:px-4"
            style={{
              background: AT.dangerSoft,
              color: AT.danger,
              border: `1px solid ${AT.danger}`,
            }}
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="min-w-0 text-xs leading-5 sm:text-sm break-words">
              {actionError || error}
            </div>
          </div>
        )}

        {/* ==================================================
            STATS
        ================================================== */}

        <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
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
          <div className="p-3 sm:p-4">

            <div className="mb-3 flex items-center gap-2">
              <Filter
                size={16}
                color={AT.sub}
              />

              <span className="text-sm font-semibold">
                Search & Filters
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-5">

              {/* Search */}

              <div className="relative sm:col-span-2 xl:col-span-2">
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
                  className="w-full rounded-lg border py-2.5 pl-9 pr-3 text-sm outline-none"
                  style={{
                    borderColor: AT.line,
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
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{
                  borderColor: AT.line,
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
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none"
                style={{
                  borderColor: AT.line,
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
                value={instructorFilter}
                onChange={(event) =>
                  setInstructorFilter(
                    event.target.value
                  )
                }
                className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none sm:col-span-2 xl:col-span-1"
                style={{
                  borderColor: AT.line,
                }}
              >
                <option value="all">
                  All Instructors
                </option>

                {instructorOptions.map(
                  (instructor) => (
                    <option
                      key={instructor.id}
                      value={instructor.id}
                    >
                      {instructor.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
                statusFilter !== "all" ||
                typeFilter !== "all" ||
                instructorFilter !== "all") && (
                  <button
                    onClick={resetFilters}
                    className="self-start text-xs font-medium sm:self-auto"
                    style={{
                      color: AT.accentDeep,
                    }}
                  >
                    Clear filters
                  </button>
                )}
            </div>
          </div>
        </Card>

        {/* ==================================================
            COURSE LIST
        ================================================== */}

        <div className="mt-4 sm:mt-5">
          <Card title="All Courses">

            {loading ? (
              <div className="px-4 py-12 text-center sm:px-5">
                <RefreshCw
                  size={22}
                  className="mx-auto mb-3 animate-spin"
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
            ) : filteredCourses.length === 0 ? (
              <EmptyState
                text={
                  courses.length === 0
                    ? "No courses have been created yet."
                    : "No courses match your filters."
                }
              />
            ) : (
              <>
                {/* ==================================================
                    MOBILE / TABLET CARD LIST
                ================================================== */}

                <div className="space-y-3 p-3 md:hidden">
                  {filteredCourses.map((course) => {
                    const instructor =
                      instructors[
                      course.instructorId
                      ];

                    const studentCount =
                      course.students ??
                      course.studentCount ??
                      0;

                    return (
                      <MobileCourseCard
                        key={course.id}
                        course={course}
                        instructor={instructor}
                        studentCount={
                          studentCount
                        }
                        busyAction={
                          busyAction
                        }
                        onView={() =>
                          setSelectedCourse(
                            course
                          )
                        }
                        onPublish={() =>
                          handlePublish(
                            course
                          )
                        }
                        onApprove={() =>
                          handleApprove(
                            course
                          )
                        }
                        onReject={() => {
                          setRejectingCourse(
                            course
                          );
                          setRejectReason("");
                          setActionError("");
                        }}
                        onFeatured={() =>
                          handleFeatured(
                            course
                          )
                        }
                        onUnpublish={() =>
                          handleUnpublish(
                            course
                          )
                        }
                        onDelete={() =>
                          setDeleteCourse(
                            course
                          )
                        }
                      />
                    );
                  })}
                </div>

                {/* ==================================================
                    DESKTOP TABLE
                ================================================== */}

                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[1050px]">

                    <thead>
                      <tr
                        className="border-b"
                        style={{
                          borderColor:
                            AT.line,
                        }}
                      >
                        <th className="px-5 py-3 text-left text-xs font-semibold">
                          Course
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold">
                          Type
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold">
                          Instructor
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold">
                          Price
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold">
                          Students
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold">
                          Status
                        </th>

                        <th className="px-4 py-3 text-left text-xs font-semibold">
                          Updated
                        </th>

                        <th className="px-5 py-3 text-right text-xs font-semibold">
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
                              key={course.id}
                              className="border-b last:border-b-0 hover:bg-slate-50"
                              style={{
                                borderColor:
                                  AT.line,
                              }}
                            >
                              {/* Course */}

                              <td className="px-5 py-4">
                                <CourseIdentity
                                  course={course}
                                />
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
                                <InstructorCell
                                  instructor={
                                    instructor
                                  }
                                />
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
                                <CourseActions
                                  course={course}
                                  busyAction={
                                    busyAction
                                  }
                                  onView={() =>
                                    setSelectedCourse(
                                      course
                                    )
                                  }
                                  onPublish={() =>
                                    handlePublish(
                                      course
                                    )
                                  }
                                  onApprove={() =>
                                    handleApprove(
                                      course
                                    )
                                  }
                                  onReject={() => {
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
                                  onFeatured={() =>
                                    handleFeatured(
                                      course
                                    )
                                  }
                                  onUnpublish={() =>
                                    handleUnpublish(
                                      course
                                    )
                                  }
                                  onDelete={() =>
                                    setDeleteCourse(
                                      course
                                    )
                                  }
                                />
                              </td>
                            </tr>
                          );
                        }
                      )}
                    </tbody>
                  </table>
                </div>
              </>
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

            {selectedCourse.thumbnailUrl && (
              <img
                src={
                  selectedCourse.thumbnailUrl
                }
                alt={
                  selectedCourse.title
                }
                className="mb-4 h-36 w-full rounded-xl object-cover sm:h-44"
              />
            )}

            <h2 className="break-words text-lg font-semibold sm:text-xl">
              {selectedCourse.title ||
                "Untitled Course"}
            </h2>

            <div className="mt-2 flex flex-wrap gap-2">
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
                    color: AT.warn,
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

            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              <InfoItem
                label="Instructor"
                value={
                  instructors[
                    selectedCourse
                      .instructorId
                  ]?.name || "Unknown"
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
                <h3 className="mb-1 text-sm font-semibold">
                  Short Description
                </h3>

                <p
                  className="break-words text-sm leading-6"
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
                <h3 className="mb-1 text-sm font-semibold">
                  Description
                </h3>

                <p
                  className="whitespace-pre-wrap break-words text-sm leading-6"
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
                  className="mt-1 break-words text-sm"
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

            <div className="mt-5 grid grid-cols-1 gap-2.5 border-t pt-4 sm:grid-cols-2 sm:gap-3">
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

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <GhostButton
                onClick={() =>
                  setSelectedCourse(null)
                }
              >
                Close
              </GhostButton>

              {selectedCourse.status ===
                "draft" && (
                  <PrimaryButton
                    disabled={
                      busyAction ===
                      `publish-${selectedCourse.id}`
                    }
                    onClick={() =>
                      handlePublish(
                        selectedCourse
                      )
                    }
                  >
                    <Check size={15} />
                    Publish
                  </PrimaryButton>
                )}

              {selectedCourse.status ===
                "pending" && (
                  <>
                    <GhostButton
                      onClick={() => {
                        setRejectingCourse(
                          selectedCourse
                        );

                        setRejectReason("");

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
                    <Archive size={15} />
                    Unpublish
                  </GhostButton>
                )}
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
            setRejectingCourse(null);
            setRejectReason("");
          }}
        >
          <p
            className="mb-4 text-sm leading-6"
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
            className="w-full resize-none rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              borderColor: AT.line,
            }}
          />

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <GhostButton
              onClick={() => {
                setRejectingCourse(null);
                setRejectReason("");
              }}
            >
              Cancel
            </GhostButton>

            <button
              onClick={handleReject}
              disabled={
                busyAction ===
                `reject-${rejectingCourse.id}`
              }
              className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              style={{
                background: AT.danger,
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
          PUBLISH / UNPUBLISH CONFIRMATION
      ====================================================== */}

      {confirmAction && (
        <Modal
          title={
            confirmAction.type ===
              "publish"
              ? "Publish Course"
              : "Unpublish Course"
          }
          onClose={() =>
            setConfirmAction(null)
          }
        >
          <div
            className="mb-4 flex items-start gap-3 rounded-xl p-3"
            style={{
              background:
                confirmAction.type ===
                  "publish"
                  ? AT.successSoft
                  : AT.warnSoft,
            }}
          >
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
              color={
                confirmAction.type ===
                  "publish"
                  ? AT.success
                  : AT.warn
              }
            />

            <p
              className="text-sm leading-6"
              style={{
                color:
                  confirmAction.type ===
                    "publish"
                    ? AT.success
                    : AT.warn,
              }}
            >
              {confirmAction.type ===
                "publish" ? (
                <>
                  Publish{" "}
                  <strong>
                    {
                      confirmAction
                        .course.title
                    }
                  </strong>{" "}
                  directly? This skips the
                  pending-review step and
                  makes it visible to students
                  immediately.
                </>
              ) : (
                <>
                  Unpublish{" "}
                  <strong>
                    {
                      confirmAction
                        .course.title
                    }
                  </strong>
                  ? This will remove the
                  course from the public LMS.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <GhostButton
              onClick={() =>
                setConfirmAction(null)
              }
            >
              Cancel
            </GhostButton>

            <PrimaryButton
              onClick={
                handleConfirmAction
              }
            >
              {confirmAction.type ===
                "publish" ? (
                <>
                  <Check size={15} />
                  Publish
                </>
              ) : (
                <>
                  <Archive size={15} />
                  Unpublish
                </>
              )}
            </PrimaryButton>
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
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ============================================================
// COURSE IDENTITY
// ============================================================

function CourseIdentity({ course }) {
  return (
    <div className="flex items-center gap-3">

      <div
        className="h-12 w-12 shrink-0 overflow-hidden rounded-lg"
        style={{
          background: AT.line,
        }}
      >
        {course.thumbnailUrl ? (
          <img
            src={course.thumbnailUrl}
            alt={
              course.title || "Course"
            }
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <BookOpen
              size={19}
              color={AT.sub}
            />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <p className="max-w-[300px] truncate text-sm font-medium">
          {course.title ||
            "Untitled Course"}
        </p>

        <p
          className="mt-0.5 max-w-[300px] truncate text-xs"
          style={{
            color: AT.sub,
          }}
        >
          {course.category ||
            "Uncategorized"}
        </p>

        {course.featured === true && (
          <span
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium"
            style={{
              color: AT.warn,
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
  );
}

// ============================================================
// INSTRUCTOR CELL
// ============================================================

function InstructorCell({ instructor }) {
  return (
    <div className="flex items-center gap-2">

      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background:
            AT.accentSoft,
        }}
      >
        <Users
          size={14}
          color={AT.accentDeep}
        />
      </div>

      <div className="min-w-0">
        <p className="max-w-[190px] truncate text-sm font-medium">
          {instructor?.name ||
            "Unknown Instructor"}
        </p>

        {instructor?.email && (
          <p
            className="max-w-[190px] truncate text-xs"
            style={{
              color: AT.sub,
            }}
          >
            {instructor.email}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// COURSE ACTIONS
// ============================================================

function CourseActions({
  course,
  busyAction,
  onView,
  onPublish,
  onApprove,
  onReject,
  onFeatured,
  onUnpublish,
  onDelete,
}) {
  return (
    <div className="flex items-center justify-end gap-1.5">

      {/* View */}

      <button
        title="View"
        onClick={onView}
        className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
        style={{
          color: AT.sub,
        }}
      >
        <Eye size={16} />
      </button>

      {/* Publish */}

      {course.status === "draft" && (
        <button
          title="Publish"
          disabled={
            busyAction ===
            `publish-${course.id}`
          }
          onClick={onPublish}
          className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
          style={{
            color: AT.success,
            background:
              AT.successSoft,
          }}
        >
          <Check size={16} />
        </button>
      )}

      {/* Approve */}

      {course.status === "pending" && (
        <button
          title="Approve"
          disabled={
            busyAction ===
            `approve-${course.id}`
          }
          onClick={onApprove}
          className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
          style={{
            color: AT.success,
            background:
              AT.successSoft,
          }}
        >
          <Check size={16} />
        </button>
      )}

      {/* Reject */}

      {course.status === "pending" && (
        <button
          title="Reject"
          onClick={onReject}
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            color: AT.danger,
            background:
              AT.dangerSoft,
          }}
        >
          <X size={16} />
        </button>
      )}

      {/* Featured */}

      {course.status === "published" && (
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
          onClick={onFeatured}
          className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
          style={{
            color: course.featured
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

      {/* Unpublish */}

      {course.status === "published" && (
        <button
          title="Emergency unpublish"
          disabled={
            busyAction ===
            `unpublish-${course.id}`
          }
          onClick={onUnpublish}
          className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-50"
          style={{
            color: AT.warn,
          }}
        >
          <Archive size={16} />
        </button>
      )}

      {/* Delete */}

      <button
        title="Emergency delete"
        onClick={onDelete}
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{
          color: AT.danger,
        }}
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

// ============================================================
// MOBILE COURSE CARD
// ============================================================

function MobileCourseCard({
  course,
  instructor,
  studentCount,
  busyAction,
  onView,
  onPublish,
  onApprove,
  onReject,
  onFeatured,
  onUnpublish,
  onDelete,
}) {
  return (
    <div
      className="overflow-hidden rounded-xl border bg-white"
      style={{
        borderColor: AT.line,
      }}
    >

      {/* Course top */}

      <div className="flex gap-3 p-3">

        <div
          className="h-16 w-16 shrink-0 overflow-hidden rounded-lg"
          style={{
            background: AT.line,
          }}
        >
          {course.thumbnailUrl ? (
            <img
              src={course.thumbnailUrl}
              alt={
                course.title || "Course"
              }
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <BookOpen
                size={20}
                color={AT.sub}
              />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">

          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-2 text-sm font-semibold leading-5">
              {course.title ||
                "Untitled Course"}
            </p>

            {course.featured && (
              <Star
                size={15}
                fill="currentColor"
                className="mt-0.5 shrink-0"
                color={AT.warn}
              />
            )}
          </div>

          <p
            className="mt-0.5 truncate text-xs"
            style={{
              color: AT.sub,
            }}
          >
            {course.category ||
              "Uncategorized"}
          </p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <TypeBadge
              type={course.type}
            />

            <StatusBadge
              status={course.status}
            />
          </div>
        </div>
      </div>

      {/* Course details */}

      <div
        className="grid grid-cols-2 gap-px border-y"
        style={{
          background: AT.line,
          borderColor: AT.line,
        }}
      >
        <MobileInfo
          label="Instructor"
          value={
            instructor?.name ||
            "Unknown"
          }
        />

        <MobileInfo
          label="Price"
          value={formatPrice(course)}
        />

        <MobileInfo
          label="Students"
          value={Number(
            studentCount
          ).toLocaleString("en-IN")}
        />

        <MobileInfo
          label="Updated"
          value={formatDate(
            course.updatedAt ||
            course.createdAt
          )}
        />
      </div>

      {/* Actions */}

      <div className="flex items-center justify-between gap-2 p-3">

        <button
          onClick={onView}
          className="flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
          style={{
            borderColor: AT.line,
            color: AT.ink,
          }}
        >
          <Eye size={14} />
          View
        </button>

        <div className="flex items-center gap-1.5">

          {course.status === "draft" && (
            <button
              onClick={onPublish}
              disabled={
                busyAction ===
                `publish-${course.id}`
              }
              title="Publish"
              className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-50"
              style={{
                color: AT.success,
                background:
                  AT.successSoft,
              }}
            >
              <Check size={16} />
            </button>
          )}

          {course.status === "pending" && (
            <>
              <button
                onClick={onApprove}
                disabled={
                  busyAction ===
                  `approve-${course.id}`
                }
                title="Approve"
                className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-50"
                style={{
                  color: AT.success,
                  background:
                    AT.successSoft,
                }}
              >
                <Check size={16} />
              </button>

              <button
                onClick={onReject}
                title="Reject"
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{
                  color: AT.danger,
                  background:
                    AT.dangerSoft,
                }}
              >
                <X size={16} />
              </button>
            </>
          )}

          {course.status === "published" && (
            <>
              <button
                onClick={onFeatured}
                disabled={
                  busyAction ===
                  `featured-${course.id}`
                }
                title={
                  course.featured
                    ? "Remove featured"
                    : "Make featured"
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-50"
                style={{
                  color: course.featured
                    ? AT.warn
                    : AT.sub,
                  background:
                    course.featured
                      ? AT.warnSoft
                      : AT.line,
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

              <button
                onClick={onUnpublish}
                disabled={
                  busyAction ===
                  `unpublish-${course.id}`
                }
                title="Unpublish"
                className="flex h-9 w-9 items-center justify-center rounded-lg disabled:opacity-50"
                style={{
                  color: AT.warn,
                  background:
                    AT.warnSoft,
                }}
              >
                <Archive size={16} />
              </button>
            </>
          )}

          <button
            onClick={onDelete}
            title="Delete"
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{
              color: AT.danger,
              background:
                AT.dangerSoft,
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MOBILE INFO
// ============================================================

function MobileInfo({ label, value }) {
  return (
    <div className="min-w-0 bg-white px-3 py-2.5">
      <p
        className="text-[10px] uppercase tracking-wide"
        style={{
          color: AT.sub,
        }}
      >
        {label}
      </p>

      <p className="mt-0.5 truncate text-xs font-medium">
        {value}
      </p>
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
      className="min-w-0 rounded-lg p-3"
      style={{
        background: AT.canvas,
      }}
    >
      <p
        className="mb-1 text-[11px]"
        style={{
          color: AT.sub,
        }}
      >
        {label}
      </p>

      <p className="break-words text-sm font-medium">
        {value}
      </p>
    </div>
  );
}