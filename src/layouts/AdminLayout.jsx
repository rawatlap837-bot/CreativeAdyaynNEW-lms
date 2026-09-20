import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "../lib/auth";
import { collection, onSnapshot } from "../lib/database";
import { auth, db } from "../lib/backend";

import {
  getAdminActivityNotifications,
} from "../services/CommunicationService";

import {
  LayoutDashboard,
  Users,
  BookOpen,
  Wallet,
  BarChart3,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Check,
  Circle,
  ShieldCheck,
  Megaphone,
} from "lucide-react";

import { AT } from "../Admin/AdminUI";
import logo from "../assets/Images/CA2.png";

/* ================================================================
 * ADMIN NAVIGATION
 * ================================================================ */

const NAV = [
  {
    to: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: "/admin/students",
    label: "Students",
    icon: Users,
  },
  {
    to: "/admin/courses",
    label: "Courses",
    icon: BookOpen,
  },
  {
    to: "/admin/payments",
    label: "Payments",
    icon: Wallet,
  },
  {
    to: "/admin/analytics",
    label: "Analytics",
    icon: BarChart3,
  },

  /* --------------------------------------------------------------
   * COMMUNICATION
   * -------------------------------------------------------------- */

  {
    to: "/admin/announcements",
    label: "Announcements",
    icon: Megaphone,
  },

  {
    to: "/admin/admins",
    label: "Admins",
    icon: ShieldCheck,
  },
];

/* ================================================================
 * FIRESTORE COLLECTIONS
 * These are used by the admin search.
 * ================================================================ */

const COLLECTIONS = {
  students: "students",
  courses: "courses",
  payments: "payments",
};

/* ================================================================
 * DATE HELPERS
 * ================================================================ */

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const d = new Date(value);

  return isNaN(d.getTime()) ? null : d;
}

function timeAgo(date) {
  if (!date) return "just now";

  const seconds = Math.floor(
    (Date.now() - date.getTime()) / 1000
  );

  if (seconds < 0) return "just now";

  const intervals = [
    ["y", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];

  for (const [label, secs] of intervals) {
    const val = Math.floor(seconds / secs);

    if (val >= 1) {
      return `${val}${label} ago`;
    }
  }

  return "just now";
}

/* ================================================================
 * ADMIN SEARCH
 * Searches live students / courses / payments.
 * ================================================================ */

function HeaderSearch({ students, courses, payments }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const boxRef = useRef(null);
  const inputRef = useRef(null);

  /* --------------------------------------------------------------
   * Close search when clicking outside
   * -------------------------------------------------------------- */

  useEffect(() => {
    function handleClick(e) {
      if (
        boxRef.current &&
        !boxRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener("mousedown", handleClick);
    };
  }, []);

  /* --------------------------------------------------------------
   * Keyboard shortcut: Ctrl + K / Cmd + K
   * -------------------------------------------------------------- */

  useEffect(() => {
    function handleKey(e) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "k"
      ) {
        e.preventDefault();

        inputRef.current?.focus();
        setOpen(true);
      }

      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  /* --------------------------------------------------------------
   * Search results
   * -------------------------------------------------------------- */

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return [];

    const studentMatches = students
      .filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.email?.toLowerCase().includes(q) ||
          s.course?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((s) => ({
        type: "student",
        id: s.id,
        title: s.name || s.fullName || "Student",
        subtitle: s.course || s.email || "Student",
      }));

    const courseMatches = courses
      .filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.category?.toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((c) => ({
        type: "course",
        id: c.id,
        title: c.title || "Course",
        subtitle: c.category || "Course",
      }));

    const paymentMatches = payments
      .filter(
        (p) =>
          p.studentName?.toLowerCase().includes(q) ||
          p.status?.toLowerCase().includes(q) ||
          String(p.amount || "").includes(q)
      )
      .slice(0, 5)
      .map((p) => ({
        type: "payment",
        id: p.id,
        title: `₹${p.amount} — ${p.studentName || p.name || "Unknown"
          }`,
        subtitle: p.status || "Payment",
      }));

    return [
      ...studentMatches,
      ...courseMatches,
      ...paymentMatches,
    ];
  }, [query, students, courses, payments]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function selectResult() {
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e) {
    if (!open || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();

      setActiveIndex(
        (i) => (i + 1) % results.length
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();

      setActiveIndex(
        (i) =>
          (i - 1 + results.length) %
          results.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();

      selectResult(results[activeIndex]);
    }
  }

  const iconFor = {
    student: Users,
    course: BookOpen,
    payment: Wallet,
  };

  return (
    <div
      ref={boxRef}
      className="relative hidden sm:block flex-1 max-w-xs"
    >
      <div
        className="flex items-center gap-2 border rounded-lg px-3 py-1.5"
        style={{
          borderColor: AT.line,
        }}
      >
        <Search size={15} color={AT.sub} />

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search…"
          className="text-sm outline-none w-full bg-transparent"
          style={{
            color: AT.ink,
          }}
        />

        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="flex"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            aria-label="Clear search"
          >
            <X size={14} color={AT.sub} />
          </button>
        )}
      </div>

      {open && query && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: `1px solid ${AT.line}`,
            borderRadius: 10,
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.08)",
            maxHeight: 340,
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          {results.length === 0 ? (
            <div
              style={{
                padding: "16px 14px",
                fontSize: 13,
                color: AT.sub,
              }}
            >
              No results for "{query}"
            </div>
          ) : (
            results.map((item, idx) => {
              const Icon = iconFor[item.type];
              const active = idx === activeIndex;

              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onMouseEnter={() =>
                    setActiveIndex(idx)
                  }
                  onClick={() =>
                    selectResult(item)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 14px",
                    cursor: "pointer",
                    background: active
                      ? "rgba(0,0,0,0.04)"
                      : "transparent",
                  }}
                >
                  <Icon size={15} color={AT.sub} />

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        color: AT.ink,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {item.title}
                    </span>

                    <span
                      style={{
                        fontSize: 11.5,
                        color: AT.sub,
                      }}
                    >
                      {item.subtitle}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * NOTIFICATION BELL
 * ================================================================ */

function HeaderBell() {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState(() => new Set());

  const boxRef = useRef(null);
  const navigate = useNavigate();

  const readStorageKey = auth.currentUser
    ? `admin-activity-read-${auth.currentUser.uid}`
    : "admin-activity-read";

  /* --------------------------------------------------------------
   * Real-time notification subscription
   * -------------------------------------------------------------- */

  useEffect(() => {
    if (!auth.currentUser) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    let cancelled = false;

    const load = async () => {
      try {
        const items = await getAdminActivityNotifications();
        if (!cancelled) setNotifications(items || []);
      } catch (error) {
        console.error("Admin activity feed failed:", error);
        if (!cancelled) setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const interval = window.setInterval(load, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(readStorageKey) || "[]"
      );
      setReadIds(new Set(stored));
    } catch {
      setReadIds(new Set());
    }
  }, [readStorageKey]);

  /* --------------------------------------------------------------
   * Close notification dropdown when clicking outside
   * -------------------------------------------------------------- */

  useEffect(() => {
    function handleClick(e) {
      if (
        boxRef.current &&
        !boxRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClick
      );
    };
  }, []);

  /* --------------------------------------------------------------
   * Close on Escape too (nice on mobile keyboards / a11y)
   * -------------------------------------------------------------- */

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  /* --------------------------------------------------------------
   * Unread count
   * -------------------------------------------------------------- */

  const unreadCount = notifications.filter(
    (notification) => !readIds.has(notification.id)
  ).length;

  /* --------------------------------------------------------------
   * Notification click
   * -------------------------------------------------------------- */

  async function handleNotificationClick(
    notification
  ) {
    try {
      const next = new Set(readIds);
      next.add(notification.id);
      setReadIds(next);
      localStorage.setItem(readStorageKey, JSON.stringify([...next].slice(-200)));

      setOpen(false);

      if (notification.actionUrl) {
        navigate(notification.actionUrl);
        return;
      }

      if (notification.courseId) {
        navigate(
          `/courses/${notification.courseId}`
        );
      }
    } catch (error) {
      console.error(
        "Failed to open notification:",
        error
      );
    }
  }

  /* --------------------------------------------------------------
   * Mark all notifications as read
   * -------------------------------------------------------------- */

  async function handleMarkAllRead() {
    const next = new Set(notifications.map((notification) => notification.id));
    setReadIds(next);
    localStorage.setItem(readStorageKey, JSON.stringify([...next].slice(-200)));
  }

  /* --------------------------------------------------------------
   * Notification title
   * -------------------------------------------------------------- */

  function getNotificationTitle(notification) {
    if (notification.title) {
      return notification.title;
    }

    switch (notification.type) {
      case "course_published":
        return "Course Published";

      case "course_updated":
        return "Course Updated";

      case "announcement":
        return "New Announcement";

      case "discussion_reply":
        return "New Discussion Reply";

      case "payment_success":
        return "Payment Received";

      case "payment_reminder":
        return "Payment Reminder";

      case "live_class":
        return "Live Class";

      case "certificate":
        return "Certificate";

      default:
        return "Notification";
    }
  }

  /* --------------------------------------------------------------
   * Notification message
   * -------------------------------------------------------------- */

  function getNotificationMessage(notification) {
    if (notification.message) {
      return notification.message;
    }

    if (notification.text) {
      return notification.text;
    }

    return "You have a new notification.";
  }

  /* --------------------------------------------------------------
   * Notification time
   * -------------------------------------------------------------- */

  function getNotificationTime(notification) {
    const date = toDate(
      notification.createdAt
    );

    return date
      ? timeAgo(date)
      : "just now";
  }

  return (
    <div
      ref={boxRef}
      className="relative"
    >
      {/* Bell */}
      <button
        onClick={() =>
          setOpen((current) => !current)
        }
        aria-label="Notifications"
        style={{
          position: "relative",
          display: "flex",
          background: "none",
          border: "none",
          cursor: "pointer",
        }}
      >
        <Bell
          size={18}
          color={AT.sub}
        />

        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 15,
              height: 15,
              padding: "0 4px",
              borderRadius: 999,
              background:
                AT.accent || "#d9534f",
              color: "#fff",
              fontSize: 9.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9
              ? "9+"
              : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {/*
        Responsive fix:
        - On mobile (< sm): `fixed`, pinned to the viewport with left-3/right-3
          margins instead of a rigid 340px panel anchored to the bell button.
          This is what stops it overflowing off-screen on narrow phones.
        - On sm+: reverts to the original 340px panel anchored under the bell.
      */}
      {open && (
        <div
          className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-[calc(100%+10px)] w-auto sm:w-[340px]"
          style={{
            background: "#fff",
            border: `1px solid ${AT.line}`,
            borderRadius: 12,
            boxShadow:
              "0 8px 24px rgba(0,0,0,0.10)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          {/* Dropdown header */}
          <div
            className="flex items-center justify-between px-3.5 py-2.5 border-b"
            style={{
              borderColor: AT.line,
            }}
          >
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: AT.ink,
              }}
            >
              Notifications
            </span>

            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 11.5,
                  color: AT.sub,
                }}
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div
            style={{
              maxHeight: "min(360px, 60vh)",
              overflowY: "auto",
            }}
          >
            {loading ? (
              <div
                style={{
                  padding: "24px 14px",
                  fontSize: 13,
                  color: AT.sub,
                  textAlign: "center",
                }}
              >
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div
                style={{
                  padding: "24px 14px",
                  fontSize: 13,
                  color: AT.sub,
                  textAlign: "center",
                }}
              >
                You're all caught up.
              </div>
            ) : (
              notifications.map(
                (notification) => {
                  const isRead =
                    notification.read === true;

                  return (
                    <button
                      key={notification.id}
                      onClick={() =>
                        handleNotificationClick(
                          notification
                        )
                      }
                      className="w-full flex gap-2.5 items-start px-3.5 py-3 text-left"
                      style={{
                        cursor: "pointer",
                        background: isRead
                          ? "transparent"
                          : "rgba(91,33,182,0.045)",
                        border: "none",
                        borderBottom:
                          `1px solid ${AT.line}`,
                      }}
                    >
                      <div
                        style={{
                          marginTop: 5,
                          width: 7,
                          minWidth: 7,
                        }}
                      >
                        {!isRead && (
                          <Circle
                            size={7}
                            fill={
                              AT.accent ||
                              "#5b21b6"
                            }
                            color={
                              AT.accent ||
                              "#5b21b6"
                            }
                          />
                        )}
                      </div>

                      <div
                        className="flex flex-col gap-0.5 min-w-0"
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: isRead
                              ? 500
                              : 600,
                            color: AT.ink,
                            lineHeight: 1.35,
                          }}
                        >
                          {getNotificationTitle(
                            notification
                          )}
                        </span>

                        <span
                          style={{
                            fontSize: 12,
                            color: AT.sub,
                            lineHeight: 1.4,
                          }}
                        >
                          {getNotificationMessage(
                            notification
                          )}
                        </span>

                        <span
                          style={{
                            fontSize: 10.5,
                            color: AT.sub,
                            marginTop: 2,
                          }}
                        >
                          {getNotificationTime(
                            notification
                          )}
                        </span>
                      </div>
                    </button>
                  );
                }
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * ADMIN LAYOUT
 * ================================================================ */

const AdminLayout = () => {
  const [mobileNavOpen, setMobileNavOpen] =
    useState(false);

  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [payments, setPayments] = useState([]);

  /* --------------------------------------------------------------
   * Live Firestore data
   * -------------------------------------------------------------- */

  useEffect(() => {
    const unsubs = [
      onSnapshot(
        collection(
          db,
          COLLECTIONS.students
        ),
        (snap) => {
          setStudents(
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }))
          );
        },
        (error) => {
          console.error(
            "Students listener error:",
            error
          );
        }
      ),

      onSnapshot(
        collection(
          db,
          COLLECTIONS.courses
        ),
        (snap) => {
          setCourses(
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }))
          );
        },
        (error) => {
          console.error(
            "Courses listener error:",
            error
          );
        }
      ),

      onSnapshot(
        collection(
          db,
          COLLECTIONS.payments
        ),
        (snap) => {
          setPayments(
            snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            }))
          );
        },
        (error) => {
          console.error(
            "Payments listener error:",
            error
          );
        }
      ),
    ];

    return () =>
      unsubs.forEach((unsubscribe) => {
        if (
          typeof unsubscribe === "function"
        ) {
          unsubscribe();
        }
      });
  }, []);

  /* --------------------------------------------------------------
   * Lock body scroll while the mobile sidebar is open
   * -------------------------------------------------------------- */

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen
      ? "hidden"
      : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  /* --------------------------------------------------------------
   * Logout
   * -------------------------------------------------------------- */

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error(
        "Sign out failed:",
        error
      );
    }
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: AT.canvas,
        fontFamily:
          "Inter, system-ui, sans-serif",
      }}
    >
      {/* Backdrop behind the mobile sidebar so it can be dismissed
          by tapping outside, and so it reads as a modal overlay
          rather than content floating over content. */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ==========================================================
          SIDEBAR
      ========================================================== */}

      <aside
        className={`w-64 shrink-0 flex-col ${mobileNavOpen
          ? "flex fixed inset-y-0 left-0 z-40"
          : "hidden"
          } md:flex md:static`}
        style={{
          background: AT.chrome,
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-2 px-5 py-5 border-b"
          style={{
            borderColor:
              "rgba(255,255,255,0.08)",
          }}
        >
          <img
            src={logo}
            alt="Creative Adhyayan"
            className="w-20 h-10 rounded-md object-contain shrink-0"
          />

          <button
            className="ml-auto md:hidden text-white/70"
            onClick={() =>
              setMobileNavOpen(false)
            }
          >
            <X size={18} />
          </button>
        </div>

        {/* ========================================================
            NAVIGATION
        ======================================================== */}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() =>
                  setMobileNavOpen(false)
                }
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                style={({ isActive }) =>
                  isActive
                    ? {
                      background:
                        AT.chromeLight,
                      color: "white",
                      borderLeft:
                        `3px solid ${AT.accent}`,
                    }
                    : {
                      color: "#94A3B8",
                      borderLeft:
                        "3px solid transparent",
                    }
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        {/* Sign out */}
        <div
          className="px-3 py-4 border-t"
          style={{
            borderColor:
              "rgba(255,255,255,0.08)",
          }}
        >
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium"
            style={{
              color: "#94A3B8",
            }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ==========================================================
          MAIN
      ========================================================== */}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Header */}
        <header
          className="flex items-center gap-3 px-4 sm:px-5 py-4 bg-white border-b"
          style={{
            borderColor: AT.line,
          }}
        >
          {/* Mobile menu */}
          <button
            className="md:hidden shrink-0"
            onClick={() =>
              setMobileNavOpen(true)
            }
            aria-label="Open menu"
          >
            <Menu
              size={20}
              color={AT.ink}
            />
          </button>

          {/* Search */}
          <HeaderSearch
            students={students}
            courses={courses}
            payments={payments}
          />

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4 shrink-0">
            <HeaderBell />

            {/* Admin avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
              style={{
                background: AT.chrome,
              }}
            >
              {auth.currentUser?.email?.[0]?.toUpperCase() ||
                "A"}
            </div>
          </div>
        </header>

        {/* Page */}
        <main className="p-4 sm:p-5 md:p-6 overflow-y-auto flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;