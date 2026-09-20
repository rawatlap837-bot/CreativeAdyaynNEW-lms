import { useEffect, useMemo, useState } from "react";

import {
  Megaphone,
  Plus,
  Search,
  Edit3,
  Trash2,
  Pin,
  PinOff,
  X,
  Send,
  Save,
  BookOpen,
  Globe2,
  Clock3,
  Timer,
  FileText,
  AlertCircle,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";

import {
  getAnnouncements,
  getMyTeacherAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  toggleAnnouncementPin,
} from "../services/CommunicationService";

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "../lib/database";

import { auth, db } from "../lib/backend";

/* ================================================================
   INITIAL FORM
================================================================ */

const INITIAL_FORM = {
  title: "",
  body: "",
  audienceType: "course",
  courseId: "",
  status: "draft",
  pinned: false,
  // Optional scheduling window. Both stored as datetime-local
  // strings while the form is open, converted to real Dates only
  // when the form is submitted.
  startAt: "",
  endAt: "",
};

/* ================================================================
   HELPERS
================================================================ */

function formatDate(value) {
  if (!value) return "Just now";

  let date;

  if (value?.toDate) {
    date = value.toDate();
  } else if (value instanceof Date) {
    date = value;
  } else {
    date = new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/*
 * Normalizes a Firestore Timestamp, JS Date, ISO string, or
 * datetime-local string into a plain JS Date (or null).
 */
function toJsDate(value) {
  if (!value) return null;

  if (value?.toDate) {
    return value.toDate();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getAnnouncementStartAt(item) {
  return toJsDate(item.startAt);
}

function getAnnouncementEndAt(item) {
  return toJsDate(item.endAt);
}

// "yyyy-MM-ddThh:mm" — what an <input type="datetime-local"> needs.
function toDatetimeLocalValue(value) {
  const date = toJsDate(value);

  if (!date) return "";

  const pad = (n) => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}` + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// The reverse: a datetime-local input's string value back into a
// real Date, in the browser's local timezone.
function fromDatetimeLocalValue(value) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

// "2d 4h", "3h 12m", "45m 10s", "8s" — whichever two units are
// most useful at the current distance from now.
function formatCountdown(ms) {
  if (ms <= 0) return "0s";

  const totalSeconds = Math.floor(ms / 1000);

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;

  return `${seconds}s`;
}

/*
 * Works out where an announcement currently sits relative to its
 * optional start/end window, given the current time.
 *
 *   - "scheduled": startAt is in the future — not visible yet.
 *   - "live":      currently within its window (or has no window
 *                   at all, in which case there's nothing to show).
 *   - "expired":   endAt has already passed.
 *   - null:        no schedule set on this announcement.
 */
function getAnnouncementTiming(item, now) {
  const startAt = getAnnouncementStartAt(item);
  const endAt = getAnnouncementEndAt(item);

  if (!startAt && !endAt) {
    return null;
  }

  const nowMs = now.getTime();

  if (startAt && startAt.getTime() > nowMs) {
    return {
      phase: "scheduled",
      label: `Live in ${formatCountdown(
        startAt.getTime() - nowMs
      )}`,
      detail: `Goes live ${formatDate(startAt)}`,
    };
  }

  if (endAt) {
    if (endAt.getTime() <= nowMs) {
      return {
        phase: "expired",
        label: "Expired",
        detail: `Ended ${formatDate(endAt)}`,
      };
    }

    return {
      phase: "live",
      label: `Ends in ${formatCountdown(
        endAt.getTime() - nowMs
      )}`,
      detail: `Ends ${formatDate(endAt)}`,
    };
  }

  return {
    phase: "live",
    label: "Live now",
    detail: `Went live ${formatDate(startAt)}`,
  };
}

function getAnnouncementStatusClass(status) {
  switch (status) {
    case "published":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "draft":
      return "border-slate-200 bg-slate-100 text-slate-700";

    case "archived":
      return "border-amber-200 bg-amber-50 text-amber-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getTimingBadgeClass(phase) {
  switch (phase) {
    case "scheduled":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";

    case "live":
      return "border-teal-200 bg-teal-50 text-teal-700";

    case "expired":
      return "border-slate-200 bg-slate-100 text-slate-500";

    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function getAudienceLabel(item) {
  const audience =
    item.audienceType || item.audience || "course";

  if (audience === "course") {
    return "Course Students";
  }

  return "Everyone";
}

function getCourseName(courseId, courses) {
  const course = courses.find(
    (item) => item.id === courseId
  );

  return course?.title || "Selected Course";
}

/*
 * Supports old documents while the database is being migrated.
 */
function getAnnouncementBody(item) {
  return item.body || item.message || "";
}

function getAnnouncementAudience(item) {
  return item.audienceType || item.audience || "course";
}

function getAnnouncementAuthorId(item) {
  return item.authorId || item.createdBy || "";
}

/* ================================================================
   MAIN
================================================================ */

export default function Announcements() {
  const [announcements, setAnnouncements] = useState([]);

  const [courses, setCourses] = useState([]);

  const [loading, setLoading] = useState(true);

  const [coursesLoading, setCoursesLoading] =
    useState(true);

  const [roleLoading, setRoleLoading] =
    useState(true);

  const [userRole, setUserRole] = useState("");

  const [search, setSearch] = useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const [audienceFilter, setAudienceFilter] =
    useState("all");

  const [showModal, setShowModal] =
    useState(false);

  const [editingAnnouncement, setEditingAnnouncement] =
    useState(null);

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [error, setError] = useState("");

  // Ticks every second so any "Live in 2m 14s" / "Ends in 3h 2m"
  // badges on the list stay accurate without a page refresh.
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  /* ==============================================================
     CURRENT USER ROLE
  ============================================================== */

  const loadUserRole = async () => {
    try {
      setRoleLoading(true);
      setError("");

      const user = auth.currentUser;

      if (!user) {
        throw new Error(
          "You must be logged in to manage announcements."
        );
      }

      const userRef = doc(
        db,
        "users",
        user.uid
      );

      const userSnapshot =
        await getDoc(userRef);

      if (!userSnapshot.exists()) {
        throw new Error(
          "Your user profile could not be found."
        );
      }

      const role =
        userSnapshot.data()?.role;

      if (
        role !== "admin" &&
        role !== "teacher"
      ) {
        throw new Error(
          "You do not have permission to manage announcements."
        );
      }

      setUserRole(role);
    } catch (err) {
      console.error(
        "Failed to load user role:",
        err
      );

      setError(
        err?.message ||
        "Unable to determine your account permissions."
      );
    } finally {
      setRoleLoading(false);
    }
  };

  /* ==============================================================
     LOAD ANNOUNCEMENTS
  ============================================================== */

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      setError("");

      let data = [];

      /*
       * ADMIN
       * -----
       * Admin can see all announcements.
       */
      if (userRole === "admin") {
        data = await getAnnouncements();
      }

      /*
       * TEACHER
       * -------
       * Teacher must NOT call getAnnouncements().
       *
       * Firestore rules restrict teacher access to
       * their own course announcements.
       */
      if (userRole === "teacher") {
        data =
          await getMyTeacherAnnouncements();
      }

      setAnnouncements(data || []);
    } catch (err) {
      console.error(
        "Failed to load announcements:",
        err
      );

      setError(
        err?.message ||
        "Unable to load announcements. Please check your Firestore rules."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ==============================================================
     LOAD COURSES
  ============================================================== */

  const loadCourses = async () => {
    try {
      setCoursesLoading(true);

      const user = auth.currentUser;

      if (!user) {
        setCourses([]);
        return;
      }

      /*
       * ADMIN
       * -----
       * Admin can create announcements for any
       * published course.
       */
      if (userRole === "admin") {
        const coursesQuery = query(
          collection(db, "courses"),
          where(
            "status",
            "==",
            "published"
          )
        );

        const snapshot =
          await getDocs(coursesQuery);

        const data = snapshot.docs
          .map((courseDoc) => ({
            id: courseDoc.id,
            ...courseDoc.data(),
          }))
          .sort((a, b) =>
            String(
              a.title || ""
            ).localeCompare(
              String(
                b.title || ""
              )
            )
          );

        setCourses(data);

        return;
      }

      /*
       * TEACHER
       * -------
       * Teacher can only use their own
       * published courses.
       */
      if (userRole === "teacher") {
        const coursesQuery = query(
          collection(db, "courses"),
          where(
            "instructorId",
            "==",
            user.uid
          )
        );

        const snapshot =
          await getDocs(coursesQuery);

        const data = snapshot.docs
          .map((courseDoc) => ({
            id: courseDoc.id,
            ...courseDoc.data(),
          }))
          .filter(
            (course) =>
              course.status ===
              "published"
          )
          .sort((a, b) =>
            String(
              a.title || ""
            ).localeCompare(
              String(
                b.title || ""
              )
            )
          );

        setCourses(data);

        return;
      }

      setCourses([]);
    } catch (err) {
      console.error(
        "Failed to load courses:",
        err
      );

      setCourses([]);

      /*
       * Do not replace the main page error here.
       * The user can still see the announcement
       * list even if courses fail.
       */
    } finally {
      setCoursesLoading(false);
    }
  };

  /* ==============================================================
     INITIAL LOAD
  ============================================================== */

  useEffect(() => {
    loadUserRole();
  }, []);

  useEffect(() => {
    if (
      !roleLoading &&
      userRole
    ) {
      loadAnnouncements();
      loadCourses();
    }
  }, [
    roleLoading,
    userRole,
  ]);

  /* ==============================================================
     FILTERED ANNOUNCEMENTS
  ============================================================== */

  const filteredAnnouncements =
    useMemo(() => {
      const searchValue =
        search.trim().toLowerCase();

      return announcements.filter(
        (item) => {
          const body =
            getAnnouncementBody(item);

          const audience =
            getAnnouncementAudience(item);

          const matchesSearch =
            !searchValue ||
            String(
              item.title || ""
            )
              .toLowerCase()
              .includes(searchValue) ||
            String(body)
              .toLowerCase()
              .includes(searchValue);

          const matchesStatus =
            statusFilter === "all" ||
            item.status ===
            statusFilter;

          const matchesAudience =
            audienceFilter === "all" ||
            audience ===
            audienceFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesAudience
          );
        }
      );
    }, [
      announcements,
      search,
      statusFilter,
      audienceFilter,
    ]);

  /* ==============================================================
     STATS
  ============================================================== */

  const stats = useMemo(() => {
    return {
      total:
        announcements.length,

      published:
        announcements.filter(
          (item) =>
            item.status ===
            "published"
        ).length,

      drafts:
        announcements.filter(
          (item) =>
            item.status ===
            "draft"
        ).length,

      pinned:
        announcements.filter(
          (item) =>
            item.pinned === true
        ).length,
    };
  }, [announcements]);

  /* ==============================================================
     OPEN CREATE MODAL
  ============================================================== */

  const openCreateModal = () => {
    setEditingAnnouncement(null);

    setForm({
      ...INITIAL_FORM,

      /*
       * Admin can choose Everyone.
       * Teacher must use a course.
       */
      audienceType:
        userRole === "admin"
          ? "global"
          : "course",
    });

    setError("");
    setShowModal(true);
  };

  /* ==============================================================
     OPEN EDIT MODAL
  ============================================================== */

  const openEditModal = (
    announcement
  ) => {
    const user =
      auth.currentUser;

    const authorId =
      getAnnouncementAuthorId(
        announcement
      );

    /*
     * Teacher can only edit their own
     * announcements.
     */
    if (
      userRole === "teacher" &&
      authorId !== user?.uid
    ) {
      setError(
        "You can only edit announcements created by you."
      );

      return;
    }

    const audience =
      getAnnouncementAudience(
        announcement
      );

    const body =
      getAnnouncementBody(
        announcement
      );

    setEditingAnnouncement(
      announcement
    );

    setForm({
      title:
        announcement.title ||
        "",

      body,

      audienceType:
        audience,

      courseId:
        announcement.courseId ||
        "",

      status:
        announcement.status ||
        "draft",

      pinned:
        announcement.pinned ===
        true,

      startAt: toDatetimeLocalValue(
        announcement.startAt
      ),

      endAt: toDatetimeLocalValue(
        announcement.endAt
      ),
    });

    setError("");
    setShowModal(true);
  };

  /* ==============================================================
     CLOSE MODAL
  ============================================================== */

  const closeModal = () => {
    if (saving) return;

    setShowModal(false);

    setEditingAnnouncement(null);

    setForm({
      ...INITIAL_FORM,

      audienceType:
        userRole === "admin"
          ? "global"
          : "course",
    });

    setError("");
  };

  /* ==============================================================
     FORM CHANGE
  ============================================================== */

  const updateForm = (
    field,
    value
  ) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  /* ==============================================================
     SAVE ANNOUNCEMENT
  ============================================================== */

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setError("");

    const user =
      auth.currentUser;

    if (!user) {
      setError(
        "You must be logged in."
      );

      return;
    }

    const title =
      form.title.trim();

    const body =
      form.body.trim();

    if (!title) {
      setError(
        "Please enter an announcement title."
      );

      return;
    }

    if (!body) {
      setError(
        "Please enter an announcement message."
      );

      return;
    }

    /*
     * TEACHER CANNOT CREATE GLOBAL ANNOUNCEMENTS
     */
    if (
      userRole === "teacher" &&
      form.audienceType !==
      "course"
    ) {
      setError(
        "Teachers can only send announcements to their own course students."
      );

      return;
    }

    /*
     * COURSE IS REQUIRED
     */
    if (
      form.audienceType ===
      "course" &&
      !form.courseId
    ) {
      setError(
        "Please select a course for this announcement."
      );

      return;
    }

    /*
     * TEACHER COURSE OWNERSHIP CHECK
     */
    if (
      userRole === "teacher" &&
      form.audienceType ===
      "course"
    ) {
      const selectedCourse =
        courses.find(
          (course) =>
            course.id ===
            form.courseId
        );

      if (
        !selectedCourse ||
        selectedCourse.instructorId !==
        user.uid
      ) {
        setError(
          "You can only create announcements for courses assigned to you."
        );

        return;
      }
    }

    /*
     * TEACHER EDIT OWNERSHIP CHECK
     */
    if (
      editingAnnouncement &&
      userRole === "teacher"
    ) {
      const authorId =
        getAnnouncementAuthorId(
          editingAnnouncement
        );

      if (
        authorId !== user.uid
      ) {
        setError(
          "You can only edit announcements created by you."
        );

        return;
      }
    }

    /*
     * SCHEDULE WINDOW
     * ----------------
     * Both ends are optional. If both are set, the end must come
     * after the start or the window makes no sense.
     */
    const startAtDate =
      fromDatetimeLocalValue(form.startAt);

    const endAtDate =
      fromDatetimeLocalValue(form.endAt);

    if (
      startAtDate &&
      endAtDate &&
      endAtDate.getTime() <=
      startAtDate.getTime()
    ) {
      setError(
        "The end time must be after the start time."
      );

      return;
    }

    /*
     * IMPORTANT
     * ----------
     * We now use the canonical fields expected
     * by CommunicationService.
     */
    const payload = {
      title,

      body,

      audienceType:
        form.audienceType,

      courseId:
        form.audienceType ===
          "course"
          ? form.courseId
          : null,

      status:
        form.status,

      pinned:
        form.pinned,

      // Null clears a previously-set schedule when editing.
      startAt: startAtDate,
      endAt: endAtDate,
    };

    try {
      setSaving(true);

      if (editingAnnouncement) {
        await updateAnnouncement(
          editingAnnouncement.id,
          payload
        );
      } else {
        await createAnnouncement(
          payload
        );
      }

      await loadAnnouncements();

      closeModal();
    } catch (err) {
      console.error(
        "Failed to save announcement:",
        err
      );

      setError(
        err?.message ||
        "Unable to save announcement. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ==============================================================
     DELETE
  ============================================================== */

  const handleDelete = async (
    announcement
  ) => {
    const user =
      auth.currentUser;

    const authorId =
      getAnnouncementAuthorId(
        announcement
      );

    /*
     * Teacher can delete only their
     * own announcements.
     */
    if (
      userRole === "teacher" &&
      authorId !== user?.uid
    ) {
      window.alert(
        "You can only delete announcements created by you."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Delete "${announcement.title}"?\n\nThis action cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(
        announcement.id
      );

      await deleteAnnouncement(
        announcement.id
      );

      await loadAnnouncements();
    } catch (err) {
      console.error(
        "Failed to delete announcement:",
        err
      );

      window.alert(
        err?.message ||
        "Unable to delete announcement."
      );
    } finally {
      setDeletingId(null);
    }
  };

  /* ==============================================================
     PIN
  ============================================================== */

  const handleTogglePin = async (
    announcement
  ) => {
    const user =
      auth.currentUser;

    const authorId =
      getAnnouncementAuthorId(
        announcement
      );

    /*
     * Teacher can pin/unpin only
     * their own announcements.
     */
    if (
      userRole === "teacher" &&
      authorId !== user?.uid
    ) {
      window.alert(
        "You can only change announcements created by you."
      );

      return;
    }

    try {
      await toggleAnnouncementPin(
        announcement.id,
        !announcement.pinned
      );

      await loadAnnouncements();
    } catch (err) {
      console.error(
        "Failed to update pin:",
        err
      );

      window.alert(
        err?.message ||
        "Unable to update announcement."
      );
    }
  };

  /* ==============================================================
     ROLE LOADING
  ============================================================== */

  if (roleLoading) {
    return (
      <div className="flex min-h-full w-full items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-teal-600" />

          <p className="mt-4 text-sm font-medium text-slate-500">
            Checking permissions...
          </p>
        </div>
      </div>
    );
  }

  /* ==============================================================
     UI
  ============================================================== */

  return (
    <div
      className="
        min-h-full
        w-full
        min-w-0
        overflow-x-hidden
        bg-slate-50
        px-3
        py-4
        sm:px-6
        sm:py-5
        lg:px-8
      "
    >
      <div
        className="
          mx-auto
          w-full
          max-w-[1500px]
          min-w-0
        "
      >
        {/* ======================================================
            HEADER
        ====================================================== */}

        <div
          className="
            mb-5
            flex
            flex-col
            gap-4
            sm:mb-6
            sm:flex-row
            sm:items-center
            sm:justify-between
          "
        >
          <div className="min-w-0">
            <div
              className="
                mb-1.5
                flex
                flex-wrap
                items-center
                gap-2
                text-xs
                font-semibold
                text-teal-700
                sm:text-sm
              "
            >
              <Megaphone size={16} />

              Communication

              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded-full
                  bg-teal-50
                  px-2
                  py-1
                  text-[10px]
                  font-bold
                  uppercase
                  tracking-wide
                  text-teal-700
                  sm:text-[11px]
                "
              >
                {userRole === "admin" ? (
                  <>
                    <ShieldCheck
                      size={11}
                    />
                    Admin
                  </>
                ) : (
                  <>
                    <GraduationCap
                      size={11}
                    />
                    Teacher
                  </>
                )}
              </span>
            </div>

            <h1
              className="
                break-words
                text-2xl
                font-bold
                tracking-tight
                text-slate-900
                sm:text-3xl
              "
            >
              Announcements
            </h1>

            <p
              className="
                mt-1
                max-w-2xl
                text-xs
                leading-5
                text-slate-500
                sm:text-sm
              "
            >
              {userRole === "admin"
                ? "Broadcast important updates to all students or specific course cohorts."
                : "Send important updates and notices to students enrolled in your courses."}
            </p>
          </div>

          <button
            type="button"
            onClick={
              openCreateModal
            }
            className="
              inline-flex
              min-h-[42px]
              w-full
              items-center
              justify-center
              gap-2
              rounded-xl
              bg-teal-600
              px-4
              py-2.5
              text-sm
              font-semibold
              text-white
              shadow-sm
              transition
              hover:bg-teal-700
              active:scale-[0.98]
              sm:w-auto
            "
          >
            <Plus size={18} />

            New Announcement
          </button>
        </div>

        {/* ======================================================
            ERROR
        ====================================================== */}

        {error && !showModal && (
          <div
            className="
              mb-5
              flex
              items-start
              gap-3
              rounded-xl
              border
              border-red-200
              bg-red-50
              p-3
              text-xs
              text-red-700
              sm:p-4
              sm:text-sm
            "
          >
            <AlertCircle
              className="mt-0.5 shrink-0"
              size={18}
            />

            <div className="min-w-0">
              <p className="font-semibold">
                Something went wrong
              </p>

              <p className="mt-1 break-words">
                {error}
              </p>
            </div>
          </div>
        )}

        {/* ======================================================
            STATS
        ====================================================== */}

        <div
          className="
            mb-5
            grid
            grid-cols-2
            gap-3
            sm:mb-6
            sm:gap-4
            lg:grid-cols-4
          "
        >
          <StatCard
            icon={FileText}
            label="Total"
            value={stats.total}
          />

          <StatCard
            icon={Send}
            label="Published"
            value={stats.published}
          />

          <StatCard
            icon={Clock3}
            label="Drafts"
            value={stats.drafts}
          />

          <StatCard
            icon={Pin}
            label="Pinned"
            value={stats.pinned}
          />
        </div>

        {/* ======================================================
            FILTER BAR
        ====================================================== */}

        <div
          className="
            mb-5
            w-full
            min-w-0
            rounded-2xl
            border
            border-slate-200
            bg-white
            p-3
            shadow-sm
            sm:p-4
          "
        >
          <div
            className="
              grid
              min-w-0
              grid-cols-1
              gap-3
              md:grid-cols-[minmax(0,1fr)_auto_auto]
            "
          >
            <div className="relative min-w-0">
              <Search
                size={18}
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search announcements..."
                className="
                  min-h-[42px]
                  w-full
                  min-w-0
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50
                  py-2.5
                  pl-10
                  pr-4
                  text-sm
                  text-slate-900
                  outline-none
                  transition
                  placeholder:text-slate-400
                  focus:border-teal-400
                  focus:bg-white
                  focus:ring-2
                  focus:ring-teal-100
                "
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value
                )
              }
              className="
                min-h-[42px]
                w-full
                min-w-0
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-3
                py-2.5
                text-sm
                font-medium
                text-slate-700
                outline-none
                focus:border-teal-400
                focus:ring-2
                focus:ring-teal-100
                md:w-[150px]
              "
            >
              <option value="all">
                All Status
              </option>

              <option value="published">
                Published
              </option>

              <option value="draft">
                Draft
              </option>

              <option value="archived">
                Archived
              </option>
            </select>

            <select
              value={audienceFilter}
              onChange={(event) =>
                setAudienceFilter(
                  event.target.value
                )
              }
              className="
                min-h-[42px]
                w-full
                min-w-0
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-3
                py-2.5
                text-sm
                font-medium
                text-slate-700
                outline-none
                focus:border-teal-400
                focus:ring-2
                focus:ring-teal-100
                md:w-[170px]
              "
            >
              <option value="all">
                All Audiences
              </option>

              {userRole ===
                "admin" && (
                  <option value="global">
                    Everyone
                  </option>
                )}

              <option value="course">
                Course Students
              </option>
            </select>
          </div>
        </div>

        {/* ======================================================
            LIST
        ====================================================== */}

        <div
          className="
            w-full
            min-w-0
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-white
            shadow-sm
          "
        >
          {loading ? (
            <LoadingState />
          ) : filteredAnnouncements.length ===
            0 ? (
            <EmptyState
              onCreate={
                openCreateModal
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAnnouncements.map(
                (announcement) => {
                  const authorId =
                    getAnnouncementAuthorId(
                      announcement
                    );

                  const currentUserId =
                    auth.currentUser?.uid;

                  const canManage =
                    userRole ===
                    "admin" ||
                    authorId ===
                    currentUserId;

                  return (
                    <AnnouncementRow
                      key={
                        announcement.id
                      }
                      announcement={
                        announcement
                      }
                      courseName={getCourseName(
                        announcement.courseId,
                        courses
                      )}
                      now={now}
                      deleting={
                        deletingId ===
                        announcement.id
                      }
                      canEdit={
                        canManage
                      }
                      canDelete={
                        canManage
                      }
                      canPin={
                        canManage
                      }
                      onEdit={() =>
                        openEditModal(
                          announcement
                        )
                      }
                      onDelete={() =>
                        handleDelete(
                          announcement
                        )
                      }
                      onTogglePin={() =>
                        handleTogglePin(
                          announcement
                        )
                      }
                    />
                  );
                }
              )}
            </div>
          )}
        </div>

        {/* ======================================================
            COUNT
        ====================================================== */}

        {!loading &&
          filteredAnnouncements.length >
          0 && (
            <div
              className="
                mt-3
                px-2
                text-center
                text-[11px]
                text-slate-400
                sm:mt-4
                sm:text-xs
              "
            >
              Showing{" "}
              {
                filteredAnnouncements.length
              }{" "}
              of{" "}
              {announcements.length}{" "}
              announcements
            </div>
          )}
      </div>

      {/* ========================================================
          MODAL
      ======================================================== */}

      {showModal && (
        <AnnouncementModal
          form={form}
          editing={
            !!editingAnnouncement
          }
          saving={saving}
          courses={courses}
          coursesLoading={
            coursesLoading
          }
          error={error}
          userRole={userRole}
          onChange={updateForm}
          onClose={closeModal}
          onSubmit={handleSubmit}
        />
      )}
    </div>
  );
}

/* ================================================================
   STAT CARD
================================================================ */

function StatCard({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div
      className="
        min-w-0
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-3
        shadow-sm
        sm:p-4
      "
    >
      <div
        className="
          flex
          min-w-0
          items-center
          gap-2.5
          sm:gap-3
        "
      >
        <div
          className="
            flex
            h-9
            w-9
            shrink-0
            items-center
            justify-center
            rounded-xl
            bg-teal-50
            text-teal-700
            sm:h-10
            sm:w-10
          "
        >
          <Icon size={18} />
        </div>

        <div className="min-w-0">
          <p
            className="
              truncate
              text-[11px]
              font-medium
              text-slate-500
              sm:text-xs
            "
          >
            {label}
          </p>

          <p
            className="
              mt-0.5
              truncate
              text-lg
              font-bold
              text-slate-900
              sm:text-xl
            "
          >
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   ANNOUNCEMENT ROW
================================================================ */

function AnnouncementRow({
  announcement,
  courseName,
  now,
  deleting,
  canEdit,
  canDelete,
  canPin,
  onEdit,
  onDelete,
  onTogglePin,
}) {
  const audience =
    getAnnouncementAudience(
      announcement
    );

  const body =
    getAnnouncementBody(
      announcement
    );

  const timing = getAnnouncementTiming(
    announcement,
    now
  );

  return (
    <div
      className="
        min-w-0
        p-4
        transition
        hover:bg-slate-50/70
        sm:p-5
      "
    >
      <div
        className="
          flex
          min-w-0
          flex-col
          gap-4
          lg:flex-row
          lg:items-start
          lg:justify-between
        "
      >
        <div className="min-w-0 flex-1">
          {/* BADGES */}

          <div
            className="
              flex
              min-w-0
              flex-wrap
              items-center
              gap-1.5
              sm:gap-2
            "
          >
            {announcement.pinned && (
              <span
                className="
                  inline-flex
                  items-center
                  gap-1
                  rounded-full
                  bg-amber-50
                  px-2
                  py-1
                  text-[11px]
                  font-semibold
                  text-amber-700
                  sm:px-2.5
                  sm:text-xs
                "
              >
                <Pin size={12} />

                Pinned
              </span>
            )}

            <span
              className={`
                max-w-full
                rounded-full
                border
                px-2
                py-1
                text-[11px]
                font-semibold
                capitalize
                sm:px-2.5
                sm:text-xs
                ${getAnnouncementStatusClass(
                announcement.status
              )}
              `}
            >
              {announcement.status ||
                "draft"}
            </span>

            <span
              className="
                inline-flex
                max-w-full
                items-center
                gap-1
                rounded-full
                border
                border-slate-200
                bg-slate-50
                px-2
                py-1
                text-[11px]
                font-medium
                text-slate-600
                sm:px-2.5
                sm:text-xs
              "
            >
              {audience ===
                "course" ? (
                <BookOpen
                  size={12}
                  className="shrink-0"
                />
              ) : (
                <Globe2
                  size={12}
                  className="shrink-0"
                />
              )}

              <span className="truncate">
                {getAudienceLabel(
                  announcement
                )}
              </span>
            </span>

            {/* SCHEDULE / TIMER */}

            {timing && (
              <span
                title={
                  timing.detail
                }
                className={`
                  inline-flex
                  max-w-full
                  items-center
                  gap-1
                  rounded-full
                  border
                  px-2
                  py-1
                  text-[11px]
                  font-semibold
                  tabular-nums
                  sm:px-2.5
                  sm:text-xs
                  ${getTimingBadgeClass(
                  timing.phase
                )}
                `}
              >
                <Timer
                  size={12}
                  className="shrink-0"
                />

                <span className="truncate">
                  {timing.label}
                </span>
              </span>
            )}
          </div>

          {/* TITLE */}

          <h3
            className="
              mt-3
              break-words
              text-base
              font-bold
              text-slate-900
              sm:text-lg
            "
          >
            {announcement.title}
          </h3>

          {/* MESSAGE */}

          <p
            className="
              mt-1.5
              max-w-4xl
              whitespace-pre-wrap
              break-words
              text-sm
              leading-6
              text-slate-600
            "
          >
            {body}
          </p>

          {/* META */}

          <div
            className="
              mt-4
              flex
              min-w-0
              flex-col
              items-start
              gap-2
              text-xs
              text-slate-400
              sm:flex-row
              sm:flex-wrap
              sm:items-center
              sm:gap-x-5
              sm:gap-y-2
            "
          >
            {audience ===
              "course" && (
                <span
                  className="
                  inline-flex
                  min-w-0
                  max-w-full
                  items-center
                  gap-1.5
                  font-medium
                  text-teal-600
                "
                >
                  <BookOpen
                    size={13}
                    className="shrink-0"
                  />

                  <span className="truncate">
                    {courseName}
                  </span>
                </span>
              )}

            <span
              className="
                inline-flex
                max-w-full
                items-center
                gap-1.5
              "
            >
              <Clock3
                size={13}
                className="shrink-0"
              />

              <span className="break-words">
                {formatDate(
                  announcement.publishedAt ||
                  announcement.createdAt
                )}
              </span>
            </span>

            {timing && (
              <span
                className="
                  inline-flex
                  max-w-full
                  items-center
                  gap-1.5
                "
              >
                <Timer
                  size={13}
                  className="shrink-0"
                />

                <span className="break-words">
                  {timing.detail}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* ACTIONS */}

        {(canEdit ||
          canDelete ||
          canPin) && (
            <div
              className="
              flex
              w-full
              shrink-0
              items-center
              gap-2
              border-t
              border-slate-100
              pt-3
              lg:w-auto
              lg:border-0
              lg:pt-1
            "
            >
              {canPin && (
                <button
                  type="button"
                  onClick={
                    onTogglePin
                  }
                  title={
                    announcement.pinned
                      ? "Unpin"
                      : "Pin"
                  }
                  aria-label={
                    announcement.pinned
                      ? "Unpin announcement"
                      : "Pin announcement"
                  }
                  className={`
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  border
                  transition
                  ${announcement.pinned
                      ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    }
                `}
                >
                  {announcement.pinned ? (
                    <PinOff size={16} />
                  ) : (
                    <Pin size={16} />
                  )}
                </button>
              )}

              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  title="Edit"
                  aria-label="Edit announcement"
                  className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  transition
                  hover:border-teal-200
                  hover:bg-teal-50
                  hover:text-teal-700
                "
                >
                  <Edit3 size={16} />
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  title="Delete"
                  aria-label="Delete announcement"
                  className="
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  transition
                  hover:border-red-200
                  hover:bg-red-50
                  hover:text-red-600
                  disabled:cursor-not-allowed
                  disabled:opacity-50
                "
                >
                  {deleting ? (
                    <span
                      className="
                      h-4
                      w-4
                      animate-spin
                      rounded-full
                      border-2
                      border-slate-300
                      border-t-red-500
                    "
                    />
                  ) : (
                    <Trash2 size={16} />
                  )}
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
}

/* ================================================================
   ANNOUNCEMENT MODAL
================================================================ */

function AnnouncementModal({
  form,
  editing,
  saving,
  courses,
  coursesLoading,
  error,
  userRole,
  onChange,
  onClose,
  onSubmit,
}) {
  return (
    <div
      className="
        fixed
        inset-0
        z-[100]
        flex
        items-center
        justify-center
        overflow-y-auto
        bg-slate-950/50
        p-3
        backdrop-blur-sm
        sm:p-4
      "
    >
      <div
        className="
          my-auto
          flex
          max-h-[calc(100vh-24px)]
          w-full
          max-w-2xl
          flex-col
          overflow-hidden
          rounded-2xl
          bg-white
          shadow-2xl
          sm:max-h-[92vh]
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            gap-3
            border-b
            border-slate-200
            px-4
            py-3
            sm:px-6
            sm:py-4
          "
        >
          <div className="min-w-0">
            <div
              className="
                flex
                items-center
                gap-2
                text-teal-700
              "
            >
              <Megaphone
                size={18}
                className="shrink-0"
              />

              <span
                className="
                  truncate
                  text-[11px]
                  font-semibold
                  uppercase
                  tracking-wide
                  sm:text-xs
                "
              >
                {userRole === "admin"
                  ? "Admin Communication"
                  : "Teacher Communication"}
              </span>
            </div>

            <h2
              className="
                mt-1
                truncate
                text-base
                font-bold
                text-slate-900
                sm:text-lg
              "
            >
              {editing
                ? "Edit Announcement"
                : "Create Announcement"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            className="
              flex
              h-9
              w-9
              shrink-0
              items-center
              justify-center
              rounded-lg
              text-slate-400
              transition
              hover:bg-slate-100
              hover:text-slate-700
              disabled:opacity-50
            "
          >
            <X size={19} />
          </button>
        </div>

        {/* FORM */}

        <form
          onSubmit={onSubmit}
          className="
            min-h-0
            overflow-y-auto
            px-4
            py-4
            sm:px-6
            sm:py-5
          "
        >
          {error && (
            <div
              className="
                mb-5
                flex
                items-start
                gap-2.5
                rounded-xl
                border
                border-red-200
                bg-red-50
                p-3
                text-xs
                leading-5
                text-red-700
                sm:p-3.5
                sm:text-sm
              "
            >
              <AlertCircle
                size={17}
                className="mt-0.5 shrink-0"
              />

              <span className="break-words">
                {error}
              </span>
            </div>
          )}

          {/* TITLE */}

          <div>
            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Announcement Title
            </label>

            <input
              type="text"
              value={form.title}
              onChange={(event) =>
                onChange(
                  "title",
                  event.target.value
                )
              }
              placeholder="e.g. New Live Class Schedule"
              maxLength={150}
              className="
                min-h-[44px]
                w-full
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-4
                py-3
                text-sm
                text-slate-900
                outline-none
                transition
                placeholder:text-slate-400
                focus:border-teal-400
                focus:bg-white
                focus:ring-2
                focus:ring-teal-100
              "
            />
          </div>

          {/* MESSAGE */}

          <div className="mt-5">
            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Message
            </label>

            <textarea
              value={form.body}
              onChange={(event) =>
                onChange(
                  "body",
                  event.target.value
                )
              }
              placeholder="Write the announcement students should receive..."
              rows={6}
              maxLength={5000}
              className="
                min-h-[140px]
                w-full
                resize-y
                rounded-xl
                border
                border-slate-200
                bg-slate-50
                px-4
                py-3
                text-sm
                leading-6
                text-slate-900
                outline-none
                transition
                placeholder:text-slate-400
                focus:border-teal-400
                focus:bg-white
                focus:ring-2
                focus:ring-teal-100
              "
            />

            <div
              className="
                mt-1
                text-right
                text-[11px]
                text-slate-400
                sm:text-xs
              "
            >
              {form.body.length}/5000
            </div>
          </div>

          {/* AUDIENCE */}

          <div className="mt-5">
            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Audience
            </label>

            {userRole ===
              "admin" ? (
              <div
                className="
                  grid
                  grid-cols-1
                  gap-3
                  sm:grid-cols-2
                "
              >
                <AudienceOption
                  selected={
                    form.audienceType ===
                    "global"
                  }
                  icon={Globe2}
                  title="Everyone"
                  description="Send to all students"
                  onClick={() => {
                    onChange(
                      "audienceType",
                      "global"
                    );

                    onChange(
                      "courseId",
                      ""
                    );
                  }}
                />

                <AudienceOption
                  selected={
                    form.audienceType ===
                    "course"
                  }
                  icon={BookOpen}
                  title="Specific Course"
                  description="Send to enrolled students"
                  onClick={() =>
                    onChange(
                      "audienceType",
                      "course"
                    )
                  }
                />
              </div>
            ) : (
              <div
                className="
                  flex
                  items-start
                  gap-3
                  rounded-xl
                  border
                  border-teal-200
                  bg-teal-50
                  p-3
                  sm:p-4
                "
              >
                <div
                  className="
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-teal-600
                    text-white
                  "
                >
                  <BookOpen size={17} />
                </div>

                <div className="min-w-0">
                  <p
                    className="
                      text-sm
                      font-semibold
                      text-slate-900
                    "
                  >
                    Your Course Students
                  </p>

                  <p
                    className="
                      mt-0.5
                      text-xs
                      leading-5
                      text-slate-500
                    "
                  >
                    This announcement will
                    only be visible to students
                    enrolled in your selected
                    course.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* COURSE */}

          {form.audienceType ===
            "course" && (
              <div className="mt-4">
                <label
                  className="
                  mb-2
                  block
                  text-sm
                  font-semibold
                  text-slate-700
                "
                >
                  Select Course
                </label>

                <select
                  value={form.courseId}
                  onChange={(event) =>
                    onChange(
                      "courseId",
                      event.target.value
                    )
                  }
                  disabled={
                    coursesLoading
                  }
                  className="
                  min-h-[44px]
                  w-full
                  rounded-xl
                  border
                  border-slate-200
                  bg-slate-50
                  px-4
                  py-3
                  text-sm
                  text-slate-900
                  outline-none
                  focus:border-teal-400
                  focus:bg-white
                  focus:ring-2
                  focus:ring-teal-100
                  disabled:opacity-60
                "
                >
                  <option value="">
                    {coursesLoading
                      ? "Loading courses..."
                      : courses.length ===
                        0
                        ? "No courses available"
                        : "Select a course"}
                  </option>

                  {courses.map(
                    (course) => (
                      <option
                        key={
                          course.id
                        }
                        value={
                          course.id
                        }
                      >
                        {course.title}
                      </option>
                    )
                  )}
                </select>

                <p
                  className="
                  mt-1.5
                  text-xs
                  leading-5
                  text-slate-400
                "
                >
                  {userRole ===
                    "teacher"
                    ? "Only your published courses are available."
                    : "Only students enrolled in this course will see this announcement."}
                </p>
              </div>
            )}

          {/* STATUS */}

          <div className="mt-5">
            <label
              className="
                mb-2
                block
                text-sm
                font-semibold
                text-slate-700
              "
            >
              Status
            </label>

            <div
              className="
                grid
                grid-cols-1
                gap-3
                sm:grid-cols-2
              "
            >
              <StatusOption
                selected={
                  form.status ===
                  "draft"
                }
                icon={Save}
                title="Save as Draft"
                description="Keep it unpublished"
                onClick={() =>
                  onChange(
                    "status",
                    "draft"
                  )
                }
              />

              <StatusOption
                selected={
                  form.status ===
                  "published"
                }
                icon={Send}
                title="Publish Now"
                description="Make it visible immediately"
                onClick={() =>
                  onChange(
                    "status",
                    "published"
                  )
                }
              />
            </div>
          </div>

          {/* SCHEDULE (LIVE / EXPIRY WINDOW) */}

          <div className="mt-5">
            <label
              className="
                mb-2
                flex
                items-center
                gap-1.5
                text-sm
                font-semibold
                text-slate-700
              "
            >
              <Timer size={15} />
              Schedule
              <span
                className="
                  text-xs
                  font-normal
                  text-slate-400
                "
              >
                (optional)
              </span>
            </label>

            <div
              className="
                grid
                grid-cols-1
                gap-3
                sm:grid-cols-2
              "
            >
              <div>
                <span
                  className="
                    mb-1.5
                    block
                    text-xs
                    font-medium
                    text-slate-500
                  "
                >
                  Goes live at
                </span>

                <input
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(event) =>
                    onChange(
                      "startAt",
                      event.target.value
                    )
                  }
                  className="
                    min-h-[44px]
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50
                    px-3
                    py-2.5
                    text-sm
                    text-slate-900
                    outline-none
                    transition
                    focus:border-teal-400
                    focus:bg-white
                    focus:ring-2
                    focus:ring-teal-100
                  "
                />
              </div>

              <div>
                <span
                  className="
                    mb-1.5
                    block
                    text-xs
                    font-medium
                    text-slate-500
                  "
                >
                  Expires at
                </span>

                <input
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(event) =>
                    onChange(
                      "endAt",
                      event.target.value
                    )
                  }
                  className="
                    min-h-[44px]
                    w-full
                    rounded-xl
                    border
                    border-slate-200
                    bg-slate-50
                    px-3
                    py-2.5
                    text-sm
                    text-slate-900
                    outline-none
                    transition
                    focus:border-teal-400
                    focus:bg-white
                    focus:ring-2
                    focus:ring-teal-100
                  "
                />
              </div>
            </div>

            <p
              className="
                mt-1.5
                text-xs
                leading-5
                text-slate-400
              "
            >
              Leave "Goes live at" empty to
              treat this as live as soon as
              it's published. Leave "Expires
              at" empty for no expiry. The
              list shows a live countdown
              until each date.
            </p>
          </div>

          {/* PIN */}

          <label
            className="
              mt-5
              flex
              cursor-pointer
              items-start
              gap-3
              rounded-xl
              border
              border-slate-200
              bg-slate-50
              p-3
              transition
              hover:border-teal-200
              hover:bg-teal-50/40
              sm:p-4
            "
          >
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(event) =>
                onChange(
                  "pinned",
                  event.target.checked
                )
              }
              className="
                mt-0.5
                h-4
                w-4
                shrink-0
                rounded
                border-slate-300
                text-teal-600
                focus:ring-teal-500
              "
            />

            <div className="min-w-0">
              <p
                className="
                  text-sm
                  font-semibold
                  text-slate-800
                "
              >
                Pin this announcement
              </p>

              <p
                className="
                  mt-0.5
                  text-xs
                  leading-5
                  text-slate-500
                "
              >
                Keep this announcement at
                the top of the communication
                feed.
              </p>
            </div>
          </label>

          {/* ACTIONS */}

          <div
            className="
              mt-6
              flex
              flex-col-reverse
              gap-2.5
              border-t
              border-slate-100
              pt-4
              sm:mt-7
              sm:flex-row
              sm:justify-end
              sm:pt-5
            "
          >
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
                min-h-[44px]
                w-full
                rounded-xl
                border
                border-slate-200
                bg-white
                px-5
                py-2.5
                text-sm
                font-semibold
                text-slate-700
                transition
                hover:bg-slate-50
                disabled:opacity-50
                sm:w-auto
              "
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="
                inline-flex
                min-h-[44px]
                w-full
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-teal-600
                px-5
                py-2.5
                text-sm
                font-semibold
                text-white
                transition
                hover:bg-teal-700
                disabled:cursor-not-allowed
                disabled:opacity-60
                sm:w-auto
              "
            >
              {saving ? (
                <>
                  <span
                    className="
                      h-4
                      w-4
                      animate-spin
                      rounded-full
                      border-2
                      border-white/40
                      border-t-white
                    "
                  />

                  Saving...
                </>
              ) : (
                <>
                  {form.status ===
                    "published" ? (
                    <Send size={16} />
                  ) : (
                    <Save size={16} />
                  )}

                  {editing
                    ? "Save Changes"
                    : "Create Announcement"}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================================================================
   AUDIENCE OPTION
================================================================ */

function AudienceOption({
  selected,
  icon: Icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex
        min-w-0
        items-start
        gap-3
        rounded-xl
        border
        p-3
        text-left
        transition
        sm:p-4
        ${selected
          ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
          : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
        }
      `}
    >
      <div
        className={`
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-lg
          ${selected
            ? "bg-teal-600 text-white"
            : "bg-slate-100 text-slate-500"
          }
        `}
      >
        <Icon size={17} />
      </div>

      <div className="min-w-0">
        <p
          className="
            text-sm
            font-semibold
            text-slate-900
          "
        >
          {title}
        </p>

        <p
          className="
            mt-0.5
            break-words
            text-xs
            leading-5
            text-slate-500
          "
        >
          {description}
        </p>
      </div>
    </button>
  );
}

/* ================================================================
   STATUS OPTION
================================================================ */

function StatusOption({
  selected,
  icon: Icon,
  title,
  description,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex
        min-w-0
        items-start
        gap-3
        rounded-xl
        border
        p-3
        text-left
        transition
        sm:p-4
        ${selected
          ? "border-teal-300 bg-teal-50 ring-1 ring-teal-200"
          : "border-slate-200 bg-white hover:border-teal-200 hover:bg-slate-50"
        }
      `}
    >
      <div
        className={`
          flex
          h-9
          w-9
          shrink-0
          items-center
          justify-center
          rounded-lg
          ${selected
            ? "bg-teal-600 text-white"
            : "bg-slate-100 text-slate-500"
          }
        `}
      >
        <Icon size={17} />
      </div>

      <div className="min-w-0">
        <p
          className="
            text-sm
            font-semibold
            text-slate-900
          "
        >
          {title}
        </p>

        <p
          className="
            mt-0.5
            break-words
            text-xs
            leading-5
            text-slate-500
          "
        >
          {description}
        </p>
      </div>
    </button>
  );
}

/* ================================================================
   LOADING
================================================================ */

function LoadingState() {
  return (
    <div
      className="
        flex
        min-h-[260px]
        flex-col
        items-center
        justify-center
        px-5
        text-center
        sm:min-h-[300px]
      "
    >
      <div
        className="
          h-9
          w-9
          animate-spin
          rounded-full
          border-4
          border-slate-200
          border-t-teal-600
        "
      />

      <p
        className="
          mt-4
          text-xs
          font-medium
          text-slate-500
          sm:text-sm
        "
      >
        Loading announcements...
      </p>
    </div>
  );
}

/* ================================================================
   EMPTY
================================================================ */

function EmptyState({
  onCreate,
}) {
  return (
    <div
      className="
        flex
        min-h-[300px]
        flex-col
        items-center
        justify-center
        px-5
        py-10
        text-center
        sm:min-h-[350px]
      "
    >
      <div
        className="
          flex
          h-14
          w-14
          items-center
          justify-center
          rounded-2xl
          bg-teal-50
          text-teal-700
          sm:h-16
          sm:w-16
        "
      >
        <Megaphone size={26} />
      </div>

      <h3
        className="
          mt-4
          text-base
          font-bold
          text-slate-900
          sm:mt-5
          sm:text-lg
        "
      >
        No announcements yet
      </h3>

      <p
        className="
          mt-2
          max-w-md
          text-xs
          leading-5
          text-slate-500
          sm:text-sm
          sm:leading-6
        "
      >
        Create your first announcement
        to communicate important updates,
        schedules and notices to your
        students.
      </p>

      <button
        type="button"
        onClick={onCreate}
        className="
          mt-5
          inline-flex
          min-h-[42px]
          w-full
          items-center
          justify-center
          gap-2
          rounded-xl
          bg-teal-600
          px-4
          py-2.5
          text-sm
          font-semibold
          text-white
          transition
          hover:bg-teal-700
          sm:w-auto
        "
      >
        <Plus size={17} />

        Create Announcement
      </button>
    </div>
  );
}