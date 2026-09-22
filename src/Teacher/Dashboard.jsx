import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Users,
  PlusCircle,
  ArrowRight,
  Megaphone,
  Pin,
  Globe2,
  GraduationCap,
  RefreshCw,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getMyTeacherAnnouncements } from "../services/CommunicationService";

const TeacherDashboard = () => {
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("overview");

  const [announcements, setAnnouncements] = useState([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [announcementsError, setAnnouncementsError] = useState("");

  const menuItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "courses",
      label: "My Courses",
      icon: BookOpen,
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: ClipboardCheck,
    },
    {
      id: "batches",
      label: "Batches",
      icon: Users,
    },
  ];

  /* =========================================================
     LOAD TEACHER ANNOUNCEMENTS
  ========================================================= */

  const loadAnnouncements = async () => {
    try {
      setAnnouncementsLoading(true);
      setAnnouncementsError("");

      const data = await getMyTeacherAnnouncements();

      const sorted = [...(data || [])]
        .filter((item) => item.status === "published")
        .sort((a, b) => {
          // Pinned announcements first
          if (a.pinned && !b.pinned) return -1;
          if (!a.pinned && b.pinned) return 1;

          // Newest first
          const dateA =
            a.createdAt?.toDate?.() ||
            (a.createdAt ? new Date(a.createdAt) : new Date(0));

          const dateB =
            b.createdAt?.toDate?.() ||
            (b.createdAt ? new Date(b.createdAt) : new Date(0));

          return dateB - dateA;
        });

      setAnnouncements(sorted.slice(0, 5));
    } catch (error) {
      console.error("Failed to load teacher announcements:", error);
      setAnnouncementsError(
        "Unable to load announcements. Please try again."
      );
    } finally {
      setAnnouncementsLoading(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
  }, []);

  /* =========================================================
     DATE FORMATTER
  ========================================================= */

  const formatAnnouncementDate = (timestamp) => {
    if (!timestamp) return "";

    let date;

    if (timestamp?.toDate) {
      date = timestamp.toDate();
    } else {
      date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  /* =========================================================
     MENU NAVIGATION
  ========================================================= */

  const handleMenuClick = (id) => {
    setActiveSection(id);

    if (id === "courses") {
      navigate("/teacher/courses");
      return;
    }

    if (id === "attendance") {
      navigate("/teacher/attendance");
      return;
    }

    if (id === "batches") {
      navigate("/teacher/batches");
      return;
    }

    navigate("/teacher");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-violet-600">
                Teacher Panel
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Teacher Dashboard
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage your courses, students and institution communication.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/teacher/courses/create")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 sm:w-auto"
            >
              <PlusCircle size={18} />
              Create Course
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          {/* =================================================
              SIDEBAR
          ================================================= */}

          <aside className="h-fit overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3">
            <nav className="flex min-w-max gap-1 lg:block lg:min-w-0 lg:space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMenuClick(item.id)}
                    className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition lg:w-full ${
                      isActive
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={19} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* =================================================
              MAIN
          ================================================= */}

          <main>
            {activeSection === "overview" && (
              <div className="space-y-6">
                {/* =================================================
                    WELCOME
                ================================================= */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <p className="text-sm font-medium text-violet-600">
                    Welcome back
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Manage your teaching workspace
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Create and manage your courses, organize lessons, monitor
                    student attendance and stay updated with institution
                    announcements.
                  </p>
                </div>

                {/* =================================================
                    ANNOUNCEMENTS
                ================================================= */}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {/* Announcement Header */}

                  <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Megaphone size={20} />
                      </div>

                      <div className="min-w-0">
                        <h2 className="font-semibold text-slate-900">
                          Announcements
                        </h2>

                        <p className="text-xs text-slate-500">
                          Important updates from the institution
                        </p>
                      </div>
                    </div>

                    <div className="flex w-full items-center gap-2 sm:w-auto">
                      <button
                        type="button"
                        onClick={loadAnnouncements}
                        disabled={announcementsLoading}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 sm:flex-none"
                      >
                        <RefreshCw
                          size={14}
                          className={
                            announcementsLoading ? "animate-spin" : ""
                          }
                        />
                        Refresh
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate("/teacher/announcements")}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-50 sm:flex-none"
                      >
                        View all
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Announcement Content */}

                  <div className="p-5">
                    {announcementsLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map((item) => (
                          <div
                            key={item}
                            className="animate-pulse rounded-xl border border-slate-100 p-4"
                          >
                            <div className="h-4 w-1/3 rounded bg-violet-50" />
                            <div className="mt-3 h-3 w-full rounded bg-violet-50" />
                            <div className="mt-2 h-3 w-3/4 rounded bg-violet-50" />
                          </div>
                        ))}
                      </div>
                    ) : announcementsError ? (
                      <div className="rounded-xl border border-red-100 bg-red-50 p-5 text-center">
                        <p className="text-sm font-medium text-red-700">
                          {announcementsError}
                        </p>

                        <button
                          type="button"
                          onClick={loadAnnouncements}
                          className="mt-3 text-xs font-semibold text-red-600 underline"
                        >
                          Try again
                        </button>
                      </div>
                    ) : announcements.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center">
                        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm">
                          <Megaphone size={20} />
                        </div>

                        <h3 className="mt-3 text-sm font-semibold text-slate-800">
                          No announcements yet
                        </h3>

                        <p className="mt-1 text-xs text-slate-500">
                          Important institution and course updates will appear
                          here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {announcements.map((announcement) => {
                          const isCourseAnnouncement =
                            announcement.audienceType === "course";
                          const isTeacherAnnouncement =
                            announcement.audienceType === "teachers";

                          return (
                            <div
                              key={announcement.id}
                              className={`rounded-xl border p-4 transition ${
                                announcement.pinned
                                  ? "border-emerald-200 bg-emerald-50/40"
                                  : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Icon */}

                                <div
                                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                                    announcement.pinned
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-violet-50 text-slate-500"
                                  }`}
                                >
                                  {announcement.pinned ? (
                                    <Pin size={16} />
                                  ) : isCourseAnnouncement || isTeacherAnnouncement ? (
                                    <GraduationCap size={17} />
                                  ) : (
                                    <Globe2 size={17} />
                                  )}
                                </div>

                                {/* Content */}

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="font-semibold text-slate-900">
                                      {announcement.title ||
                                        "Untitled announcement"}
                                    </h3>

                                    {announcement.pinned && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                        <Pin size={10} />
                                        Pinned
                                      </span>
                                    )}
                                  </div>

                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                                    <span className="inline-flex items-center gap-1">
                                      {isCourseAnnouncement ? (
                                        <>
                                          <GraduationCap size={12} />
                                          Course Announcement
                                        </>
                                      ) : isTeacherAnnouncement ? (
                                        <>
                                          <GraduationCap size={12} />
                                          Teachers Only
                                        </>
                                      ) : (
                                        <>
                                          <Globe2 size={12} />
                                          Everyone
                                        </>
                                      )}
                                    </span>

                                    {announcement.createdAt && (
                                      <>
                                        <span>•</span>

                                        <span>
                                          {formatAnnouncementDate(
                                            announcement.createdAt
                                          )}
                                        </span>
                                      </>
                                    )}
                                  </div>

                                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                                    {announcement.body ||
                                      announcement.message ||
                                      "No announcement message."}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </section>

                {/* =================================================
                    QUICK ACTIONS
                ================================================= */}

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Courses */}

                  <button
                    type="button"
                    onClick={() => navigate("/teacher/courses")}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-violet-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <BookOpen size={21} />
                      </div>

                      <ArrowRight
                        size={18}
                        className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600"
                      />
                    </div>

                    <h3 className="mt-5 font-semibold text-slate-900">
                      My Courses
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      View, edit and manage the courses you own.
                    </p>
                  </button>

                  {/* Attendance */}

                  <button
                    type="button"
                    onClick={() => navigate("/teacher/attendance")}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-violet-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <ClipboardCheck size={21} />
                      </div>

                      <ArrowRight
                        size={18}
                        className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600"
                      />
                    </div>

                    <h3 className="mt-5 font-semibold text-slate-900">
                      Attendance
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      View attendance records for students enrolled in your
                      courses.
                    </p>
                  </button>
                </div>

                {/* =================================================
                    CREATE COURSE
                ================================================= */}

                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Want to add another course?
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Create a short course or long/live course and submit
                        it directly.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate("/teacher/courses/create")
                      }
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                    >
                      <PlusCircle size={18} />
                      Add Course
                    </button>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
