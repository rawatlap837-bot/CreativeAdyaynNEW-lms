import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "firebase/auth";
import { collection, onSnapshot } from "firebase/firestore";
import { auth, db } from "../firebase/Firebase";
import {
  LayoutDashboard, Users, BookOpen, PlayCircle, Wallet, BarChart3,
  LogOut, Menu, X, Bell, Search, Check, Circle, ShieldCheck,
} from "lucide-react";
import { AT } from "../Admin/AdminUI";
import logo from "../assets/Images/CA2.png"; // swap to CA2.png here if you'd rather use that version

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/students", label: "Students", icon: Users },
  { to: "/admin/courses", label: "Courses", icon: BookOpen },
  { to: "/admin/lessons", label: "Lessons", icon: PlayCircle },
  { to: "/admin/payments", label: "Payments", icon: Wallet },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/admins", label: "Admins", icon: ShieldCheck },
];

/* ------------------------------------------------------------------
 * Firestore collection names — change these to match your DB.
 * ------------------------------------------------------------------ */
const COLLECTIONS = {
  students: "students",
  courses: "courses",
  payments: "payments",
};

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals = [
    ["y", 31536000], ["mo", 2592000], ["d", 86400], ["h", 3600], ["m", 60],
  ];
  for (const [label, secs] of intervals) {
    const val = Math.floor(seconds / secs);
    if (val >= 1) return `${val}${label} ago`;
  }
  return "just now";
}

/* ==================================================================
 * Search bar — searches live students / courses / payments.
 * ================================================================== */
function HeaderSearch({ students, courses, payments }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
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
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

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
      .map((s) => ({ type: "student", id: s.id, title: s.name, subtitle: s.course || s.email }));

    const courseMatches = courses
      .filter((c) => c.title?.toLowerCase().includes(q) || c.category?.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({ type: "course", id: c.id, title: c.title, subtitle: c.category || "Course" }));

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
        title: `₹${p.amount} — ${p.studentName}`,
        subtitle: p.status || "Payment",
      }));

    return [...studentMatches, ...courseMatches, ...paymentMatches];
  }, [query, students, courses, payments]);

  useEffect(() => setActiveIndex(0), [query]);

  function selectResult() {
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectResult(results[activeIndex]);
    }
  }

  const iconFor = { student: Users, course: BookOpen, payment: Wallet };

  return (
    <div ref={boxRef} className="relative hidden sm:block flex-1 max-w-xs">
      <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5" style={{ borderColor: AT.line }}>
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
          style={{ color: AT.ink }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="flex"
            style={{ background: "none", border: "none", cursor: "pointer" }}
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
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
            maxHeight: 340,
            overflowY: "auto",
            zIndex: 50,
          }}
        >
          {results.length === 0 ? (
            <div style={{ padding: "16px 14px", fontSize: 13, color: AT.sub }}>No results for "{query}"</div>
          ) : (
            results.map((item, idx) => {
              const Icon = iconFor[item.type];
              const active = idx === activeIndex;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectResult(item)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 14px",
                    cursor: "pointer",
                    background: active ? "rgba(0,0,0,0.04)" : "transparent",
                  }}
                >
                  <Icon size={15} color={AT.sub} />
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: 13.5, color: AT.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {item.title}
                    </span>
                    <span style={{ fontSize: 11.5, color: AT.sub }}>{item.subtitle}</span>
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

/* ==================================================================
 * Notification bell — badge count, dropdown, mark read / mark all read.
 * Built from live recent-activity across students/courses/payments.
 * ================================================================== */
function HeaderBell({ items }) {
  const [readIds, setReadIds] = useState(new Set());
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = items.filter((n) => !readIds.has(n.id)).length;

  function markRead(id) {
    setReadIds((prev) => new Set(prev).add(id));
  }

  function markAllRead() {
    setReadIds(new Set(items.map((n) => n.id)));
  }

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        style={{ position: "relative", display: "flex", background: "none", border: "none", cursor: "pointer" }}
      >
        <Bell size={18} color={AT.sub} />
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
              background: AT.accent || "#d9534f",
              color: "#fff",
              fontSize: 9.5,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 320,
            background: "#fff",
            border: `1px solid ${AT.line}`,
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b" style={{ borderColor: AT.line }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: AT.ink }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1"
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: AT.sub }}
              >
                <Check size={12} />
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {items.length === 0 ? (
              <div style={{ padding: "20px 14px", fontSize: 13, color: AT.sub, textAlign: "center" }}>
                You're all caught up.
              </div>
            ) : (
              items.map((n) => {
                const isRead = readIds.has(n.id);
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className="flex gap-2.5 items-start px-3.5 py-2.5 border-b"
                    style={{
                      cursor: "pointer",
                      background: isRead ? "transparent" : "rgba(0,0,0,0.03)",
                      borderColor: AT.line,
                    }}
                  >
                    <div style={{ marginTop: 4, width: 6 }}>
                      {!isRead && <Circle size={6} fill={AT.accent || "#d9534f"} color={AT.accent || "#d9534f"} />}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span style={{ fontSize: 13, color: AT.ink, lineHeight: 1.35 }}>{n.text}</span>
                      <span style={{ fontSize: 11, color: AT.sub }}>{n.time}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const AdminLayout = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navigate = useNavigate();

  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [payments, setPayments] = useState([]);

  // Live Firestore data — powers both search and notifications
  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, COLLECTIONS.students), (snap) =>
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, COLLECTIONS.courses), (snap) =>
        setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(collection(db, COLLECTIONS.payments), (snap) =>
        setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const recent = useMemo(() => {
    const items = [];

    students.forEach((s) => {
      const d = toDate(s.createdAt || s.enrolledAt);
      if (!d) return;
      items.push({
        id: `student-${s.id}`,
        text: `New student ${s.name || s.fullName || "Unknown"} enrolled${s.course ? ` in ${s.course}` : ""}`,
        date: d,
      });
    });

    payments.forEach((p) => {
      const d = toDate(p.createdAt || p.paidAt);
      if (!d) return;
      items.push({
        id: `payment-${p.id}`,
        text: `Payment received from ${p.studentName || p.name || "Unknown"} — ₹${p.amount}`,
        date: d,
      });
    });

    courses.forEach((c) => {
      const d = toDate(c.createdAt || c.publishedAt);
      if (!d) return;
      items.push({ id: `course-${c.id}`, text: `Course "${c.title}" published`, date: d });
    });

    return items
      .sort((a, b) => b.date - a.date)
      .slice(0, 8)
      .map((item) => ({ ...item, time: timeAgo(item.date) }));
  }, [students, payments, courses]);

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/login");
  };

  return (
    <div className="min-h-screen flex" style={{ background: AT.canvas, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* ---------- Sidebar ---------- */}
      <aside
        className={`w-64 shrink-0 flex-col ${mobileNavOpen ? "flex fixed inset-y-0 left-0 z-40" : "hidden"} md:flex md:static`}
        style={{ background: AT.chrome }}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <img
            src={logo}
            alt="Creative Adhyayan"
            className="w-20 h-10 rounded-md object-contain shrink-0"
          />
          <div>
            <p className="text-[15px]" style={{ color: "#8593A8" }}>Admin Console</p>
          </div>
          <button className="ml-auto md:hidden text-white/70" onClick={() => setMobileNavOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileNavOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors"
                style={({ isActive }) =>
                  isActive
                    ? { background: AT.chromeLight, color: "white", borderLeft: `3px solid ${AT.accent}` }
                    : { color: "#94A3B8", borderLeft: "3px solid transparent" }
                }
              >
                <Icon size={17} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium"
            style={{ color: "#94A3B8" }}
          >
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="flex items-center gap-3 px-5 py-4 bg-white border-b" style={{ borderColor: AT.line }}>
          <button className="md:hidden" onClick={() => setMobileNavOpen(true)}>
            <Menu size={20} color={AT.ink} />
          </button>

          <HeaderSearch students={students} courses={courses} payments={payments} />

          <div className="ml-auto flex items-center gap-4">
            <HeaderBell items={recent} />
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white"
              style={{ background: AT.chrome }}
            >
              {auth.currentUser?.email?.[0]?.toUpperCase() || "A"}
            </div>
          </div>
        </header>

        <main className="p-5 md:p-6 overflow-y-auto flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;