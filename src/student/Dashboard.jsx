import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "../lib/auth";

import Attendance from "./Attendance";
import Certificates from "./Certificates.jsx";
import MyCourses from "./MyCourses.jsx";
import Assignments from "./Assignments.jsx";

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
} from "../lib/database";

import { auth, db } from "../lib/backend";
import usePresence from "../hooks/usePresence";

import {
  Plus,
  Video,
  CalendarClock,
  Bell,
  X,
  Clock,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  ArrowUpRight,
  Play,
  RotateCcw,
  MapPin,
  LayoutGrid,
  Award,
  BookOpen,
  Megaphone,
  Pin,
  Globe2,
  GraduationCap,
  AlertTriangle,
} from "lucide-react";

import {
  ListRowSkeleton,
  Skeleton,
} from "../components/Skeleton";

import {
  getAccessibleAnnouncements,
} from "../services/CommunicationService";

import {
  getMyEnrollments,
} from "../services/EnrollmentService";

/* =========================================================
   DESIGN
========================================================= */

const ACCENT = "#5227FF";
const AMBER = "#E8A33D";
const VIOLET = "#2E1A55";
const CANVAS = "#ECEEF3";

const cardShadow =
  "shadow-lg shadow-violet-900/[0.06]";

const WEEK_DAYS = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const COURSES_ROUTE = "/ShortCourses";

/* =========================================================
   ANIMATION
========================================================= */

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 14,
  },

  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay: i * 0.06,
      ease: "easeOut",
    },
  }),
};

/* =========================================================
   QUICK ACTIONS
========================================================= */

const QUICK_ACTIONS = [
  {
    label: "Study planner",
    caption: "Plan this week's sessions",
    icon: CalendarClock,
    to: "#schedule",
  },
  {
    label: "Live sessions",
    caption: "Join your next live class",
    icon: Video,
    to: "#live",
  },
];

/* =========================================================
   DASHBOARD TABS
========================================================= */

const DASHBOARD_TABS = [
  {
    key: "overview",
    label: "Overview",
    icon: LayoutGrid,
  },
  {
    key: "courses",
    label: "My Courses",
    icon: BookOpen,
  },
  {
    key: "assignments",
    label: "Assignments",
    icon: GraduationCap,
  },
  {
    key: "certificates",
    label: "Certificates",
    icon: Award,
  },
];

/* =========================================================
   DATE HELPERS
========================================================= */

function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();

  const mondayOffset =
    day === 0 ? -6 : 1 - day;

  const monday = new Date(now);

  monday.setHours(0, 0, 0, 0);

  monday.setDate(
    now.getDate() +
    mondayOffset +
    offset * 7
  );

  const sunday = new Date(monday);

  sunday.setDate(
    monday.getDate() + 6
  );

  sunday.setHours(
    23,
    59,
    59,
    999
  );

  return {
    start: monday,
    end: sunday,
  };
}

function dayLabelFromDate(date) {
  const idx = date.getDay();

  return WEEK_DAYS[
    idx === 0 ? 6 : idx - 1
  ];
}

function startEndOfToday() {
  const start = new Date();

  start.setHours(
    0,
    0,
    0,
    0
  );

  const end = new Date();

  end.setHours(
    23,
    59,
    59,
    999
  );

  return {
    start,
    end,
  };
}

function formatTime(date) {
  if (!date) return "";

  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/* =========================================================
   ANNOUNCEMENT DATE HELPERS
========================================================= */

function formatAnnouncementDate(date) {
  if (!date) {
    return "";
  }

  const now = new Date();

  if (
    now.toDateString() ===
    date.toDateString()
  ) {
    return `Today · ${formatTime(date)}`;
  }

  const yesterday = new Date(now);

  yesterday.setDate(
    now.getDate() - 1
  );

  if (
    yesterday.toDateString() ===
    date.toDateString()
  ) {
    return `Yesterday · ${formatTime(date)}`;
  }

  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year:
      date.getFullYear() !==
        now.getFullYear()
        ? "numeric"
        : undefined,
  });
}

/* =========================================================
   TIME AGO
========================================================= */

function timeAgo(date) {
  if (!date) {
    return "";
  }

  const diffMs =
    Date.now() -
    date.getTime();

  const mins = Math.round(
    diffMs / 60000
  );

  if (mins < 1) {
    return "Just now";
  }

  if (mins < 60) {
    return `${mins} min ago`;
  }

  const hrs = Math.round(
    mins / 60
  );

  if (hrs < 24) {
    return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  }

  const days = Math.round(
    hrs / 24
  );

  if (days === 1) {
    return "Yesterday";
  }

  return `${days} days ago`;
}

/* =========================================================
   NORMALIZE ANNOUNCEMENT
========================================================= */

function normalizeAnnouncement(item) {
  if (!item) {
    return null;
  }

  const rawDate =
    item.createdAt ||
    item.updatedAt ||
    item.date;

  let date = null;

  if (
    rawDate instanceof Timestamp
  ) {
    date = rawDate.toDate();
  } else if (
    rawDate instanceof Date
  ) {
    date = rawDate;
  } else if (
    rawDate &&
    typeof rawDate.toDate ===
    "function"
  ) {
    date = rawDate.toDate();
  } else if (rawDate) {
    const parsed =
      new Date(rawDate);

    if (
      !Number.isNaN(
        parsed.getTime()
      )
    ) {
      date = parsed;
    }
  }

  return {
    id: item.id,

    title:
      item.title ||
      "Announcement",

    message:
      item.body ||
      item.message ||
      "",

    body:
      item.body ||
      item.message ||
      "",

    courseId:
      item.courseId ||
      null,

    audienceType:
      item.audienceType ||
      item.audience ||
      "global",

    status:
      item.status ||
      "published",

    pinned:
      Boolean(item.pinned),

    authorName:
      item.authorName ||
      item.author ||
      "Creative Adhyayan",

    date,
  };
}

/* =========================================================
   DASHBOARD
========================================================= */

export default function Dashboard() {
  const navigate = useNavigate();

  // Marks this student "online" in Realtime Database for as long as
  // the dashboard is mounted; Supabase's onDisconnect flips them back
  // to "offline" automatically when the tab closes or connection drops.
  // Free on the Spark plan — see src/hooks/usePresence.js.
  usePresence();

  const [
    searchParams,
    setSearchParams,
  ] = useSearchParams();

  /* =======================================================
     ACTIVE TAB
  ======================================================= */

  const requestedTab =
    searchParams.get("tab");

  const activeTab =
    DASHBOARD_TABS.some(
      (tab) =>
        tab.key === requestedTab
    )
      ? requestedTab
      : "overview";

  const setActiveTab = (key) => {
    setSearchParams(
      key === "overview"
        ? {}
        : {
          tab: key,
        },
      {
        replace: true,
      }
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  /* =======================================================
     AUTH
  ======================================================= */

  const [uid, setUid] =
    useState(null);

  const [
    assignmentCourseIds,
    setAssignmentCourseIds,
  ] = useState([]);

  const [
    firstName,
    setFirstName,
  ] = useState("there");

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  const [
    notifLoading,
    setNotifLoading,
  ] = useState(true);

  const [
    notifError,
    setNotifError,
  ] = useState(false);

  /* =======================================================
     TASKS
  ======================================================= */

  const [
    tasks,
    setTasks,
  ] = useState([]);

  const [
    tasksLoading,
    setTasksLoading,
  ] = useState(true);

  const [
    tasksError,
    setTasksError,
  ] = useState(false);

  /* =======================================================
     SCHEDULE
  ======================================================= */

  const [
    scheduleEvents,
    setScheduleEvents,
  ] = useState([]);

  const [
    scheduleLoading,
    setScheduleLoading,
  ] = useState(true);

  const [
    scheduleError,
    setScheduleError,
  ] = useState(false);

  /* =======================================================
     LIVE CLASS
  ======================================================= */

  const [
    liveClass,
    setLiveClass,
  ] = useState(null);

  const [
    liveClassLoading,
    setLiveClassLoading,
  ] = useState(true);

  const [
    liveClassError,
    setLiveClassError,
  ] = useState(false);

  /* =======================================================
     ANNOUNCEMENTS
  ======================================================= */

  const [
    announcements,
    setAnnouncements,
  ] = useState([]);

  const [
    announcementsLoading,
    setAnnouncementsLoading,
  ] = useState(true);

  const [
    announcementsError,
    setAnnouncementsError,
  ] = useState(false);

  const [
    showAllAnnouncements,
    setShowAllAnnouncements,
  ] = useState(false);

  /* =======================================================
     SCHEDULE STATE
  ======================================================= */

  const [
    activeDay,
    setActiveDay,
  ] = useState(() => {
    const idx =
      new Date().getDay();

    return WEEK_DAYS[
      idx === 0 ? 6 : idx - 1
    ];
  });

  const [
    weekOffset,
    setWeekOffset,
  ] = useState(0);

  const scheduleSectionRef =
    useRef(null);

  const liveClassSectionRef =
    useRef(null);

  /* =======================================================
     AUTH LISTENER
  ======================================================= */

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        (user) => {
          if (!user) {
            setUid(null);
            setFirstName("there");
            return;
          }

          setUid(user.uid);

          const name =
            user.displayName
              ?.trim()
              ?.split(" ")[0];

          if (name) {
            setFirstName(name);
          }
        }
      );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) {
      setAssignmentCourseIds([]);
      return;
    }

    let cancelled = false;

    const loadAssignmentCourses = async () => {
      try {
        const enrollments = await getMyEnrollments();

        if (!cancelled) {
          setAssignmentCourseIds(
            enrollments
              .map((enrollment) => enrollment.courseId)
              .filter(Boolean)
          );
        }
      } catch (error) {
        console.error(
          "Failed to load assignment courses:",
          error
        );

        if (!cancelled) {
          setAssignmentCourseIds([]);
        }
      }
    };

    loadAssignmentCourses();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  /* =======================================================
     LOAD ANNOUNCEMENTS
  ======================================================= */

  useEffect(() => {
    if (!uid) {
      setAnnouncements([]);
      setAnnouncementsLoading(false);
      setAnnouncementsError(false);
      return;
    }

    let cancelled = false;

    const loadAnnouncements =
      async () => {
        setAnnouncementsLoading(true);
        setAnnouncementsError(false);

        try {
          const result =
            await getAccessibleAnnouncements();

          if (cancelled) {
            return;
          }

          const normalized =
            (
              Array.isArray(result)
                ? result
                : []
            )
              .map(
                normalizeAnnouncement
              )
              .filter(Boolean)
              .filter(
                (item) =>
                  item.status ===
                  "published"
              )
              .sort(
                (a, b) => {
                  if (
                    a.pinned &&
                    !b.pinned
                  ) {
                    return -1;
                  }

                  if (
                    !a.pinned &&
                    b.pinned
                  ) {
                    return 1;
                  }

                  const aTime =
                    a.date?.getTime() ||
                    0;

                  const bTime =
                    b.date?.getTime() ||
                    0;

                  return (
                    bTime - aTime
                  );
                }
              );

          setAnnouncements(
            normalized
          );
        } catch (error) {
          console.error(
            "Failed to load announcements:",
            error
          );

          if (!cancelled) {
            setAnnouncements([]);
            setAnnouncementsError(true);
          }
        } finally {
          if (!cancelled) {
            setAnnouncementsLoading(false);
          }
        }
      };

    loadAnnouncements();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  /* =======================================================
     NOTIFICATIONS
  ======================================================= */

  useEffect(() => {
    if (!uid) {
      setNotifications([]);
      setNotifLoading(false);
      setNotifError(false);
      return;
    }

    setNotifLoading(true);
    setNotifError(false);

    const q = query(
      collection(
        db,
        "notifications"
      ),
      where(
        "recipientId",
        "==",
        uid
      ),
      orderBy(
        "createdAt",
        "desc"
      ),
      limit(10)
    );

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          const items =
            snapshot.docs.map(
              (item) => {
                const data =
                  item.data();

                const createdAt =
                  data.createdAt instanceof
                    Timestamp
                    ? data.createdAt.toDate()
                    : new Date();

                return {
                  id: item.id,

                  title:
                    data.title ||
                    "Notification",

                  body:
                    data.body ||
                    "",

                  time:
                    timeAgo(
                      createdAt
                    ),
                };
              }
            );

          setNotifications(items);
          setNotifLoading(false);
          setNotifError(false);
        },
        (error) => {
          console.error(
            "Notification listener failed:",
            error
          );

          setNotifications([]);
          setNotifLoading(false);
          setNotifError(true);
        }
      );

    return unsubscribe;
  }, [uid]);

  /* =======================================================
     TODAY'S TASKS
  ======================================================= */

  useEffect(() => {
    if (!uid) {
      setTasks([]);
      setTasksLoading(false);
      setTasksError(false);
      return;
    }

    setTasksLoading(true);
    setTasksError(false);

    const {
      start,
      end,
    } = startEndOfToday();

    const q = query(
      collection(
        db,
        "tasks"
      ),
      where(
        "uid",
        "==",
        uid
      ),
      where(
        "date",
        ">=",
        Timestamp.fromDate(start)
      ),
      where(
        "date",
        "<=",
        Timestamp.fromDate(end)
      )
    );

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          const items =
            snapshot.docs.map(
              (item) => {
                const data =
                  item.data();

                return {
                  id: item.id,

                  title:
                    data.title ||
                    "Task",

                  duration:
                    data.duration ||
                    "",

                  progress:
                    data.progress ??
                    0,

                  prevProgress:
                    data.prevProgress ??
                    data.progress ??
                    0,
                };
              }
            );

          setTasks(items);
          setTasksLoading(false);
          setTasksError(false);
        },
        (error) => {
          console.error(
            "Tasks listener failed:",
            error
          );

          setTasks([]);
          setTasksLoading(false);
          setTasksError(true);
        }
      );

    return unsubscribe;
  }, [uid]);

  /* =======================================================
     WEEKLY SCHEDULE
  ======================================================= */

  useEffect(() => {
    if (!uid) {
      setScheduleEvents([]);
      setScheduleLoading(false);
      setScheduleError(false);
      return;
    }

    setScheduleLoading(true);
    setScheduleError(false);

    const {
      start,
      end,
    } = getWeekRange(
      weekOffset
    );

    const q = query(
      collection(
        db,
        "scheduleEvents"
      ),
      where(
        "uid",
        "==",
        uid
      ),
      where(
        "date",
        ">=",
        Timestamp.fromDate(start)
      ),
      where(
        "date",
        "<=",
        Timestamp.fromDate(end)
      ),
      orderBy(
        "date",
        "asc"
      )
    );

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          const items =
            snapshot.docs.map(
              (item) => {
                const data =
                  item.data();

                const date =
                  data.date instanceof
                    Timestamp
                    ? data.date.toDate()
                    : new Date();

                return {
                  id: item.id,

                  day:
                    dayLabelFromDate(
                      date
                    ),

                  time:
                    data.time ||
                    formatTime(
                      date
                    ),

                  label:
                    data.label ||
                    "Scheduled session",
                };
              }
            );

          setScheduleEvents(items);
          setScheduleLoading(false);
          setScheduleError(false);
        },
        (error) => {
          console.error(
            "Schedule listener failed:",
            error
          );

          setScheduleEvents([]);
          setScheduleLoading(false);
          setScheduleError(true);
        }
      );

    return unsubscribe;
  }, [
    uid,
    weekOffset,
  ]);

  /* =======================================================
     AGENDA BY DAY
  ======================================================= */

  const agendaByDay =
    useMemo(() => {
      const map = {};

      WEEK_DAYS.forEach(
        (day) => {
          map[day] = [];
        }
      );

      scheduleEvents.forEach(
        (event) => {
          if (
            map[event.day]
          ) {
            map[event.day].push(
              event
            );
          }
        }
      );

      return map;
    }, [
      scheduleEvents,
    ]);

  /* =======================================================
     LIVE CLASS
  ======================================================= */

  useEffect(() => {
    if (!uid) {
      setLiveClass(null);
      setLiveClassLoading(false);
      setLiveClassError(false);
      return;
    }

    setLiveClassLoading(true);
    setLiveClassError(false);

    const q = query(
      collection(
        db,
        "liveClasses"
      ),
      where(
        "uid",
        "==",
        uid
      ),
      where(
        "startTime",
        ">=",
        Timestamp.fromDate(
          new Date()
        )
      ),
      orderBy(
        "startTime",
        "asc"
      ),
      limit(1)
    );

    const unsubscribe =
      onSnapshot(
        q,
        (snapshot) => {
          if (snapshot.empty) {
            setLiveClass(null);
            setLiveClassLoading(false);
            setLiveClassError(false);
            return;
          }

          const item =
            snapshot.docs[0];

          const data =
            item.data();

          const start =
            data.startTime instanceof
              Timestamp
              ? data.startTime.toDate()
              : new Date();

          const end =
            data.endTime instanceof
              Timestamp
              ? data.endTime.toDate()
              : null;

          setLiveClass({
            id: item.id,

            title:
              data.title ||
              "Live class",

            location:
              data.location ||
              "",

            status:
              data.status ||
              "upcoming",

            timeLabel: end
              ? `Today · ${formatTime(
                start
              )}–${formatTime(
                end
              )}`
              : `Today · ${formatTime(
                start
              )}`,
          });

          setLiveClassLoading(false);
          setLiveClassError(false);
        },
        (error) => {
          console.error(
            "Live class listener failed:",
            error
          );

          setLiveClass(null);
          setLiveClassLoading(false);
          setLiveClassError(true);
        }
      );

    return unsubscribe;
  }, [uid]);

  /* =======================================================
     SCROLL HELPERS
  ======================================================= */

  const scrollToSchedule =
    () => {
      scheduleSectionRef.current?.scrollIntoView(
        {
          behavior: "smooth",
          block: "start",
        }
      );
    };

  const scrollToLive = () => {
    liveClassSectionRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "start",
      }
    );
  };

  const handleQuickAction =
    (to) => {
      if (
        to === "#schedule"
      ) {
        scrollToSchedule();
        return;
      }

      if (to === "#live") {
        scrollToLive();
        return;
      }

      navigate(to);
    };

  /* =======================================================
     NOTIFICATION ACTIONS
  ======================================================= */

  const dismissNotification =
    async (id) => {
      setNotifications(
        (previous) =>
          previous.filter(
            (item) =>
              item.id !== id
          )
      );

      try {
        await deleteDoc(
          doc(
            db,
            "notifications",
            id
          )
        );
      } catch (error) {
        console.error(
          "Failed to dismiss notification:",
          error
        );
      }
    };

  const clearAllNotifications =
    async () => {
      const ids =
        notifications.map(
          (item) => item.id
        );

      setNotifications([]);

      try {
        await Promise.all(
          ids.map((id) =>
            deleteDoc(
              doc(
                db,
                "notifications",
                id
              )
            )
          )
        );
      } catch (error) {
        console.error(
          "Failed to clear notifications:",
          error
        );
      }
    };

  /* =======================================================
     TASK ACTIONS
  ======================================================= */

  const toggleTask =
    async (id) => {
      const target =
        tasks.find(
          (item) =>
            item.id === id
        );

      if (!target) {
        return;
      }

      const nowDone =
        target.progress !==
        100;

      const nextProgress =
        nowDone
          ? 100
          : target.prevProgress;

      setTasks(
        (previous) =>
          previous.map(
            (item) =>
              item.id === id
                ? {
                  ...item,

                  progress:
                    nextProgress,

                  prevProgress:
                    nowDone
                      ? item.progress
                      : item.prevProgress,
                }
                : item
          )
      );

      try {
        await updateDoc(
          doc(
            db,
            "tasks",
            id
          ),
          {
            progress:
              nextProgress,

            prevProgress:
              nowDone
                ? target.progress
                : target.prevProgress,
          }
        );
      } catch (error) {
        console.error(
          "Failed to update task:",
          error
        );
      }
    };

  /* =======================================================
     LIVE CLASS STATUS
  ======================================================= */

  const setLiveClassStatus =
    async (status) => {
      if (!liveClass) {
        return;
      }

      setLiveClass(
        (previous) =>
          previous
            ? {
              ...previous,
              status,
            }
            : previous
      );

      try {
        await updateDoc(
          doc(
            db,
            "liveClasses",
            liveClass.id
          ),
          {
            status,
          }
        );
      } catch (error) {
        console.error(
          "Failed to update live class status:",
          error
        );
      }
    };

  /* =======================================================
     ANNOUNCEMENT DISPLAY
  ======================================================= */

  const visibleAnnouncements =
    showAllAnnouncements
      ? announcements
      : announcements.slice(
        0,
        4
      );

  const tasksDone =
    tasks.filter(
      (task) =>
        task.progress === 100
    ).length;

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{
        background: CANVAS,
      }}
    >
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-8">

        {/* =================================================
            DASHBOARD TABS
        ================================================= */}

        <div className="mb-5">
          <div className="grid grid-cols-2 gap-1.5 sm:inline-flex sm:w-auto sm:gap-2 lg:grid-cols-none">

            {DASHBOARD_TABS.map(
              ({
                key,
                label,
                icon: Icon,
              }) => {
                const isActive =
                  key === activeTab;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        key
                      )
                    }
                    className="flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-2.5 text-[11px] font-bold leading-tight transition-colors sm:gap-2 sm:px-4 sm:py-2.5 sm:text-sm"
                    style={{
                      background:
                        isActive
                          ? "#1B0E3D"
                          : "white",

                      color:
                        isActive
                          ? "white"
                          : "#8A82A6",

                      boxShadow:
                        isActive
                          ? "none"
                          : "0 1px 2px rgba(27,14,61,0.06)",
                    }}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />

                    <span className="truncate">
                      {label}
                    </span>
                  </button>
                );
              }
            )}

          </div>
        </div>

        {/* =================================================
            CERTIFICATES
        ================================================= */}

        {activeTab ===
          "certificates" ? (
          <Certificates />

          /* =================================================
             ASSIGNMENTS
          ================================================= */

        ) : activeTab ===
          "assignments" ? (
          <Assignments
            courseIds={assignmentCourseIds}
          />

          /* =================================================
             MY COURSES
          ================================================= */

        ) : activeTab ===
          "courses" ? (
          <MyCourses />

          /* =================================================
             OVERVIEW
          ================================================= */

        ) : (
          <div>

            {/* =================================================
                GREETING + QUICK ACTIONS
            ================================================= */}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">

              {/* GREETING */}

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={0}
                className={`relative overflow-hidden rounded-3xl bg-white p-7 lg:col-span-7 ${cardShadow}`}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-[0.07] blur-2xl"
                  style={{
                    background:
                      ACCENT,
                  }}
                />

                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-[#1B0E3D] sm:text-3xl">
                  Hi, {firstName}! 👋
                  <br />
                  What's the plan for today?
                </h2>

                {tasksLoading ? (
                  <Skeleton className="mt-3 h-3 w-64" />
                ) : (
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-[#6b5f87]">
                    You've completed{" "}
                    {tasksDone} of{" "}
                    {tasks.length}{" "}
                    tasks today. Keep the
                    streak going — your next
                    lesson is waiting.
                  </p>
                )}

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "courses"
                    )
                  }
                  className="group/cta mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})`,
                  }}
                >
                  Resume learning

                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
                </button>
              </motion.div>

              {/* QUICK ACTIONS */}

              <div className="grid grid-cols-2 gap-4 lg:col-span-5">

                <motion.button
                  type="button"
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  custom={1}
                  onClick={() =>
                    navigate(
                      COURSES_ROUTE
                    )
                  }
                  className="flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-5 text-center transition-colors hover:bg-violet-50"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#6D3FC0] shadow-sm">
                    <Plus className="h-5 w-5" />
                  </span>

                  <span className="text-xs font-bold text-[#4A3D66]">
                    Browse courses
                  </span>

                  <span className="text-[10px] text-[#8A82A6]">
                    Buy on the main site
                  </span>
                </motion.button>

                {QUICK_ACTIONS.map(
                  (
                    {
                      label,
                      caption,
                      icon: Icon,
                      to,
                    },
                    index
                  ) => (
                    <motion.button
                      key={label}
                      type="button"
                      variants={fadeUp}
                      initial="hidden"
                      animate="show"
                      custom={
                        2 + index
                      }
                      onClick={() =>
                        handleQuickAction(
                          to
                        )
                      }
                      className={`flex flex-col items-center justify-center gap-2 rounded-3xl bg-white p-5 text-center transition-transform hover:-translate-y-0.5 ${cardShadow}`}
                    >
                      <span
                        className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                        style={{
                          background: `linear-gradient(135deg, ${AMBER}, #d98f22)`,
                        }}
                      >
                        <Icon className="h-5 w-5" />
                      </span>

                      <span className="text-xs font-bold text-[#1B0E3D]">
                        {label}
                      </span>

                      <span className="text-[10px] text-[#8A82A6]">
                        {caption}
                      </span>
                    </motion.button>
                  )
                )}

              </div>
            </div>

            {/* =================================================
                ATTENDANCE
            ================================================= */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={3}
              className="mt-4"
            >
              <Attendance />
            </motion.div>

            {/* =================================================
                ANNOUNCEMENTS
            ================================================= */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="show"
              custom={4}
              className={`mt-4 rounded-3xl bg-white p-5 ${cardShadow}`}
            >

              <div className="mb-4 flex items-center justify-between gap-3">

                <div className="flex min-w-0 items-center gap-3">

                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, #059669, #0f766e)",
                    }}
                  >
                    <Megaphone className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[#1B0E3D]">
                      Announcements
                    </h3>

                    <p className="mt-0.5 text-[10px] text-[#8A82A6]">
                      Important updates from
                      Creative Adhyayan
                    </p>
                  </div>

                </div>

                {announcements.length >
                  4 && (
                    <button
                      type="button"
                      onClick={() =>
                        setShowAllAnnouncements(
                          (previous) =>
                            !previous
                        )
                      }
                      className="shrink-0 text-xs font-bold text-emerald-600 transition-colors hover:text-emerald-700"
                    >
                      {showAllAnnouncements
                        ? "Show less"
                        : "View all"}
                    </button>
                  )}

              </div>

              {announcementsLoading ? (
                <div className="space-y-2">
                  {Array.from({
                    length: 3,
                  }).map(
                    (_, index) => (
                      <ListRowSkeleton
                        key={index}
                      />
                    )
                  )}
                </div>

              ) : announcementsError ? (
                <div className="rounded-2xl bg-red-50 px-4 py-6 text-center">
                  <Megaphone className="mx-auto h-6 w-6 text-red-400" />

                  <p className="mt-2 text-xs font-bold text-red-600">
                    Unable to load announcements.
                  </p>

                  <p className="mt-1 text-[10px] text-red-400">
                    Please refresh the dashboard
                    and try again.
                  </p>
                </div>

              ) : announcements.length ===
                0 ? (
                <div className="rounded-2xl bg-[#F7F5FC] px-4 py-8 text-center">
                  <Megaphone className="mx-auto h-6 w-6 text-[#B4ABCB]" />

                  <p className="mt-2 text-xs font-bold text-[#6B5F87]">
                    No announcements yet.
                  </p>

                  <p className="mx-auto mt-1 max-w-sm text-[10px] leading-relaxed text-[#A79BC4]">
                    Important updates from your
                    institution will appear here.
                  </p>
                </div>

              ) : (
                <div className="space-y-2">

                  {visibleAnnouncements.map(
                    (announcement) => (
                      <div
                        key={
                          announcement.id
                        }
                        className="group rounded-2xl bg-[#F7F5FC] p-3.5 transition-colors hover:bg-[#F3EFFC]"
                      >

                        <div className="flex items-start gap-3">

                          <div
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${announcement.pinned
                              ? "bg-amber-100 text-amber-600"
                              : "bg-emerald-100 text-emerald-600"
                              }`}
                          >
                            {announcement.pinned ? (
                              <Pin className="h-3.5 w-3.5" />
                            ) : announcement.audienceType ===
                              "global" ? (
                              <Globe2 className="h-3.5 w-3.5" />
                            ) : (
                              <GraduationCap className="h-3.5 w-3.5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">

                            <div className="flex flex-wrap items-start justify-between gap-2">

                              <div className="min-w-0">

                                <h4 className="text-xs font-bold text-[#1B0E3D]">
                                  {
                                    announcement.title
                                  }
                                </h4>

                                <div className="mt-1 flex flex-wrap items-center gap-1.5">

                                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[9px] font-bold text-emerald-600">

                                    {announcement.audienceType ===
                                      "global" ? (
                                      <>
                                        <Globe2 className="h-2.5 w-2.5" />
                                        Everyone
                                      </>
                                    ) : (
                                      <>
                                        <GraduationCap className="h-2.5 w-2.5" />
                                        Course update
                                      </>
                                    )}

                                  </span>

                                  {announcement.pinned && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold text-amber-600">
                                      <Pin className="h-2.5 w-2.5" />
                                      Pinned
                                    </span>
                                  )}

                                </div>

                              </div>

                              {announcement.date && (
                                <span className="shrink-0 text-[9px] font-medium text-[#B4ABCB]">
                                  {formatAnnouncementDate(
                                    announcement.date
                                  )}
                                </span>
                              )}

                            </div>

                            <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-[#766B91]">
                              {
                                announcement.message
                              }
                            </p>

                            {announcement.authorName && (
                              <p className="mt-2 text-[9px] font-semibold text-[#A79BC4]">
                                Posted by{" "}
                                {
                                  announcement.authorName
                                }
                              </p>
                            )}

                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </motion.div>

            {/* =================================================
                NOTIFICATIONS + SCHEDULE
            ================================================= */}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">

              {/* NOTIFICATIONS */}

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={5}
                className={`rounded-3xl bg-white p-5 ${cardShadow}`}
              >

                <div className="mb-3 flex items-center justify-between">

                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#1B0E3D]">
                    <Bell className="h-4 w-4 text-[#6D3FC0]" />
                    Notifications
                  </h3>

                  {notifications.length >
                    0 && (
                      <button
                        type="button"
                        onClick={
                          clearAllNotifications
                        }
                        className="text-xs font-semibold text-[#8A82A6] hover:text-[#6D3FC0]"
                      >
                        Clear
                      </button>
                    )}

                </div>

                {notifLoading ? (
                  <div className="space-y-1">
                    {Array.from({
                      length: 3,
                    }).map(
                      (_, index) => (
                        <ListRowSkeleton
                          key={index}
                        />
                      )
                    )}
                  </div>

                ) : notifError ? (
                  <div className="flex flex-col items-center gap-1.5 py-6 text-center">
                    <AlertTriangle className="h-4 w-4 text-red-400" />

                    <p className="text-xs font-bold text-red-500">
                      Couldn't load notifications.
                    </p>

                    <p className="text-[10px] text-red-400">
                      Try refreshing the page.
                    </p>
                  </div>

                ) : notifications.length ===
                  0 ? (
                  <p className="py-6 text-center text-xs text-[#A79BC4]">
                    You're all caught up.
                  </p>

                ) : (
                  <ul className="space-y-2">

                    {notifications.map(
                      (notification) => (
                        <li
                          key={
                            notification.id
                          }
                          className="group flex items-start justify-between gap-2 rounded-2xl bg-[#F7F5FC] p-3"
                        >

                          <div className="min-w-0">

                            <p className="truncate text-xs font-bold text-[#1B0E3D]">
                              {
                                notification.title
                              }
                            </p>

                            <p className="mt-0.5 line-clamp-2 text-[11px] text-[#8A82A6]">
                              {
                                notification.body
                              }
                            </p>

                            <p className="mt-1 text-[10px] font-medium text-[#B4ABCB]">
                              {
                                notification.time
                              }
                            </p>

                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              dismissNotification(
                                notification.id
                              )
                            }
                            aria-label="Dismiss notification"
                            className="shrink-0 rounded-full p-1 text-[#B4ABCB] opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>

                        </li>
                      )
                    )}

                  </ul>
                )}

              </motion.div>

              {/* SCHEDULE */}

              <motion.div
                ref={
                  scheduleSectionRef
                }
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={6}
                className={`scroll-mt-6 rounded-3xl bg-white p-5 ${cardShadow}`}
              >

                <div className="mb-3 flex items-center justify-between">

                  <h3 className="text-sm font-bold text-[#1B0E3D]">
                    This week
                  </h3>

                  <div className="flex items-center gap-1">

                    <button
                      type="button"
                      onClick={() =>
                        setWeekOffset(
                          (value) =>
                            value - 1
                        )
                      }
                      aria-label="Previous week"
                      className="rounded-full p-1 text-[#8A82A6] hover:bg-violet-50 hover:text-[#6D3FC0]"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setWeekOffset(
                          (value) =>
                            value + 1
                        )
                      }
                      aria-label="Next week"
                      className="rounded-full p-1 text-[#8A82A6] hover:bg-violet-50 hover:text-[#6D3FC0]"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>

                  </div>

                </div>

                {weekOffset !== 0 && (
                  <p className="mb-2 text-[10px] font-semibold text-[#B4ABCB]">

                    {weekOffset > 0
                      ? `${weekOffset} week(s) ahead`
                      : `${-weekOffset} week(s) back`}

                    {" · "}

                    <button
                      type="button"
                      onClick={() =>
                        setWeekOffset(
                          0
                        )
                      }
                      className="underline underline-offset-2 hover:text-[#6D3FC0]"
                    >
                      back to this week
                    </button>

                  </p>
                )}

                <div className="grid grid-cols-7 gap-1">

                  {WEEK_DAYS.map(
                    (day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() =>
                          setActiveDay(
                            day
                          )
                        }
                        className="flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition-colors"
                        style={{
                          background:
                            activeDay ===
                              day
                              ? ACCENT
                              : "transparent",

                          color:
                            activeDay ===
                              day
                              ? "#fff"
                              : "#8A82A6",
                        }}
                      >

                        {day[0]}

                        {(
                          agendaByDay[
                          day
                          ] || []
                        ).length > 0 && (
                            <span
                              className="h-1 w-1 rounded-full"
                              style={{
                                background:
                                  activeDay ===
                                    day
                                    ? "#fff"
                                    : AMBER,
                              }}
                            />
                          )}

                      </button>
                    )
                  )}

                </div>

                <div className="mt-3 space-y-2">

                  {scheduleLoading ? (
                    <div className="space-y-2">
                      {Array.from({
                        length: 3,
                      }).map(
                        (_, index) => (
                          <ListRowSkeleton
                            key={index}
                          />
                        )
                      )}
                    </div>

                  ) : scheduleError ? (
                    <div className="flex flex-col items-center gap-1.5 py-4 text-center">

                      <AlertTriangle className="h-4 w-4 text-red-400" />

                      <p className="text-xs font-bold text-red-500">
                        Couldn't load your schedule.
                      </p>

                    </div>

                  ) : (
                    (
                      agendaByDay[
                      activeDay
                      ] || []
                    ).length === 0 ? (
                      <p className="py-4 text-center text-xs text-[#A79BC4]">
                        Nothing scheduled.
                      </p>
                    ) : (
                      agendaByDay[
                        activeDay
                      ].map(
                        (item) => (
                          <div
                            key={
                              item.id
                            }
                            className="flex items-center gap-2 rounded-2xl bg-[#F7F5FC] p-2.5"
                          >

                            <span
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white"
                              style={{
                                background:
                                  ACCENT,
                              }}
                            >
                              <Clock className="h-3.5 w-3.5" />
                            </span>

                            <div className="min-w-0">

                              <p className="truncate text-[11px] font-bold text-[#1B0E3D]">
                                {
                                  item.label
                                }
                              </p>

                              <p className="text-[10px] text-[#8A82A6]">
                                {
                                  item.time
                                }
                              </p>

                            </div>

                          </div>
                        )
                      )
                    )
                  )}

                </div>

              </motion.div>

            </div>

            {/* =================================================
                TASKS + PREMIUM + LIVE CLASS
            ================================================= */}

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">

              {/* TASKS */}

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={7}
                className={`rounded-3xl bg-white p-5 lg:col-span-6 ${cardShadow}`}
              >

                <div className="mb-3 flex items-center justify-between">

                  <h3 className="text-sm font-bold text-[#1B0E3D]">
                    Today's tasks
                  </h3>

                  <span className="text-[11px] font-semibold text-[#8A82A6]">
                    {tasksDone}/
                    {tasks.length}{" "}
                    done
                  </span>

                </div>

                {tasksLoading ? (
                  <div className="space-y-3">
                    {Array.from({
                      length: 3,
                    }).map(
                      (_, index) => (
                        <ListRowSkeleton
                          key={index}
                        />
                      )
                    )}
                  </div>

                ) : tasksError ? (
                  <div className="flex flex-col items-center gap-1.5 py-6 text-center">

                    <AlertTriangle className="h-4 w-4 text-red-400" />

                    <p className="text-xs font-bold text-red-500">
                      Couldn't load today's tasks.
                    </p>

                  </div>

                ) : tasks.length ===
                  0 ? (
                  <p className="py-6 text-center text-xs text-[#A79BC4]">
                    No tasks for today.
                  </p>

                ) : (
                  <ul className="space-y-3">

                    {tasks.map(
                      (task) => {
                        const done =
                          task.progress ===
                          100;

                        return (
                          <li
                            key={
                              task.id
                            }
                            className="flex items-center gap-3"
                          >

                            <button
                              type="button"
                              onClick={() =>
                                toggleTask(
                                  task.id
                                )
                              }
                              aria-label={
                                done
                                  ? "Mark as not done"
                                  : "Mark as done"
                              }
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                              style={{
                                borderColor:
                                  done
                                    ? ACCENT
                                    : "#D9D2EC",

                                background:
                                  done
                                    ? ACCENT
                                    : "transparent",
                              }}
                            >
                              {done && (
                                <Check
                                  className="h-3.5 w-3.5 text-white"
                                  strokeWidth={
                                    3
                                  }
                                />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">

                              <div className="flex items-center justify-between gap-2">

                                <p
                                  className={`truncate text-xs font-bold ${done
                                    ? "text-[#B4ABCB] line-through"
                                    : "text-[#1B0E3D]"
                                    }`}
                                >
                                  {
                                    task.title
                                  }
                                </p>

                                <span className="shrink-0 text-[10px] font-semibold text-[#8A82A6]">
                                  {
                                    task.duration
                                  }
                                </span>

                              </div>

                              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EFEAFB]">

                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${Math.min(
                                      Math.max(
                                        task.progress,
                                        0
                                      ),
                                      100
                                    )}%`,

                                    background:
                                      done
                                        ? "#22c55e"
                                        : ACCENT,
                                  }}
                                />

                              </div>

                            </div>

                          </li>
                        );
                      }
                    )}

                  </ul>
                )}

              </motion.div>

              {/* PREMIUM */}

              <motion.div
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={8}
                className="relative overflow-hidden rounded-3xl p-5 text-white lg:col-span-3"
                style={{
                  background: `linear-gradient(155deg, #6D3FC0, ${VIOLET})`,
                }}
              >

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full opacity-20 blur-xl"
                  style={{
                    background:
                      AMBER,
                  }}
                />

                <Crown
                  className="h-7 w-7"
                  style={{
                    color: AMBER,
                  }}
                />

                <h3 className="mt-3 text-base font-black leading-tight">
                  Go Premium
                </h3>

                <p className="mt-1.5 text-xs leading-relaxed text-white/70">
                  Unlock mentor 1:1s,
                  verified certificates,
                  and every course in the
                  catalog.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    navigate(
                      "/dashboard/profile?tab=payments"
                    )
                  }
                  className="mt-4 flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-bold text-[#2E1A55] transition-transform active:scale-[0.98]"
                >
                  Explore plans

                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>

              </motion.div>

              {/* LIVE CLASS */}

              <motion.div
                ref={
                  liveClassSectionRef
                }
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={9}
                className={`scroll-mt-6 rounded-3xl bg-white p-5 lg:col-span-3 ${cardShadow}`}
              >

                <h3 className="flex items-center gap-2 text-sm font-bold text-[#1B0E3D]">
                  <Video className="h-4 w-4 text-[#6D3FC0]" />
                  Live class
                </h3>

                {liveClassLoading ? (
                  <div className="mt-3 space-y-2">

                    <Skeleton className="h-3 w-2/3" />

                    <Skeleton className="h-3 w-1/2" />

                    <Skeleton className="mt-3 h-8 w-full rounded-full" />

                  </div>

                ) : liveClassError ? (
                  <div className="mt-3 flex flex-col items-center gap-1.5 text-center">

                    <AlertTriangle className="h-4 w-4 text-red-400" />

                    <p className="text-xs font-bold text-red-500">
                      Couldn't load your live class.
                    </p>

                  </div>

                ) : !liveClass ? (
                  <p className="mt-3 text-center text-xs text-[#A79BC4]">
                    No upcoming live class.
                  </p>

                ) : (
                  <>

                    <p className="mt-2 text-xs font-bold text-[#1B0E3D]">
                      {
                        liveClass.title
                      }
                    </p>

                    <p className="mt-1 flex items-center gap-1 text-[10px] text-[#8A82A6]">
                      <Clock className="h-3 w-3" />

                      {
                        liveClass.timeLabel
                      }
                    </p>

                    {liveClass.location && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[#8A82A6]">

                        <MapPin className="h-3 w-3" />

                        {
                          liveClass.location
                        }

                      </p>
                    )}

                    {liveClass.status ===
                      "joined" ? (
                      <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-center text-[11px] font-bold text-emerald-600">
                        You're in! See you there.
                      </p>

                    ) : liveClass.status ===
                      "rescheduled" ? (
                      <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-center text-[11px] font-bold text-amber-700">
                        Reschedule requested.
                      </p>

                    ) : (
                      <div className="mt-4 flex gap-2">

                        <button
                          type="button"
                          onClick={() =>
                            setLiveClassStatus(
                              "rescheduled"
                            )
                          }
                          aria-label="Request reschedule"
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-violet-100 text-[#6D3FC0] transition-colors hover:bg-violet-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setLiveClassStatus(
                              "joined"
                            )
                          }
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold text-white transition-transform active:scale-[0.98]"
                          style={{
                            background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})`,
                          }}
                        >
                          <Play className="h-3.5 w-3.5" />
                          Join
                        </button>

                      </div>
                    )}

                  </>
                )}

              </motion.div>

            </div>

          </div>
        )}

      </div>
    </div>
  );
}