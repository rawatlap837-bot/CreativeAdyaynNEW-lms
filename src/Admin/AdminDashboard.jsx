import { useEffect, useMemo, useState } from "react";
import { Users, GraduationCap, BookOpen, Wallet } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar,
} from "recharts";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/Firebase.js";
import { AT, StatCard, Card } from "./AdminUI.jsx";
import { StatCardSkeleton } from "../components/Skeleton";

/* ------------------------------------------------------------------
 * Firestore collection names — change these to match your DB.
 * Set instructors to null if you don't track instructors separately.
 * ------------------------------------------------------------------ */
const COLLECTIONS = {
  students: "students",
  courses: "courses",
  payments: "payments",
  instructors: "instructors",
};

/* Builds the last 6 calendar months, oldest -> newest, as chart buckets */
function last6MonthKeys() {
  const out = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-US", { month: "short" }),
    });
  }
  return out;
}

// Handles both Firestore Timestamp objects and plain date strings/numbers
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

export default function AdminDashboard() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [instructorsCount, setInstructorsCount] = useState(null);
  const [loaded, setLoaded] = useState({
    students: false,
    courses: false,
    payments: false,
    instructors: false,
  });
  const [error, setError] = useState(null);

  const loading = !(loaded.students && loaded.courses && loaded.payments && loaded.instructors);

  useEffect(() => {
    const unsubs = [];

    try {
      unsubs.push(
        onSnapshot(
          collection(db, COLLECTIONS.students),
          (snap) => {
            setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoaded((prev) => ({ ...prev, students: true }));
          },
          (err) => setError(err.message)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, COLLECTIONS.courses),
          (snap) => {
            setCourses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoaded((prev) => ({ ...prev, courses: true }));
          },
          (err) => setError(err.message)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, COLLECTIONS.payments),
          (snap) => {
            setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
            setLoaded((prev) => ({ ...prev, payments: true }));
          },
          (err) => setError(err.message)
        )
      );

      if (COLLECTIONS.instructors) {
        unsubs.push(
          onSnapshot(
            collection(db, COLLECTIONS.instructors),
            (snap) => {
              setInstructorsCount(snap.size);
              setLoaded((prev) => ({ ...prev, instructors: true }));
            },
            (err) => setError(err.message)
          )
        );
      } else {
        setLoaded((prev) => ({ ...prev, instructors: true }));
      }
    } catch (err) {
      setError(err.message);
      setLoaded({ students: true, courses: true, payments: true, instructors: true });
    }

    return () => unsubs.forEach((unsub) => unsub());
  }, []);

  const totalStudents = students.length;

  // Real course docs use status: "draft" | "published" (see Admin/Courses.jsx) —
  // there is no `published` boolean field, so check status explicitly.
  const publishedCourses = courses.filter((c) => c.status === "published").length;

  const totalRevenue = payments
    .filter((p) => !p.status || p.status === "success" || p.status === "paid")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // The `instructors` collection has security rules reserved for it but no
  // admin UI writes to it yet, so it's empty in a fresh/typical setup — a
  // raw count would always read 0 and look broken. Fall back to the number
  // of distinct instructor names already stored on courses, so the stat is
  // meaningful today and will automatically prefer the real collection once
  // an instructor-management UI starts populating it.
  const distinctCourseInstructors = useMemo(() => {
    const names = new Set(
      courses
        .map((c) => (c.instructor || "").trim())
        .filter(Boolean)
    );
    return names.size;
  }, [courses]);

  const instructorsDisplay =
    instructorsCount && instructorsCount > 0 ? instructorsCount : distinctCourseInstructors;

  const enrollTrend = useMemo(() => {
    const buckets = last6MonthKeys();
    const counts = Object.fromEntries(buckets.map((b) => [b.key, 0]));
    students.forEach((s) => {
      const d = toDate(s.createdAt || s.enrolledAt);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in counts) counts[key] += 1;
    });
    return buckets.map((b) => ({ m: b.label, v: counts[b.key] }));
  }, [students]);

  const revenueTrend = useMemo(() => {
    const buckets = last6MonthKeys();
    const sums = Object.fromEntries(buckets.map((b) => [b.key, 0]));
    payments.forEach((p) => {
      const d = toDate(p.createdAt || p.paidAt);
      if (!d) return;
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (key in sums) sums[key] += Number(p.amount) || 0;
    });
    return buckets.map((b) => ({ m: b.label, v: +(sums[b.key] / 100000).toFixed(2) }));
  }, [payments]);

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
      // Real payment docs (functions/razorpay.js) only ever store uid,
      // courseId, courseName, amount, status — never a student name — so
      // fall back to the course name instead of always showing "Unknown".
      if (p.status && p.status !== "success" && p.status !== "paid") return;
      const d = toDate(p.paidAt || p.createdAt);
      if (!d) return;
      items.push({
        id: `payment-${p.id}`,
        text: `Payment received — ₹${p.amount}${p.courseName ? ` for ${p.courseName}` : ""}`,
        date: d,
      });
    });

    courses.forEach((c) => {
      const d = toDate(c.createdAt || c.publishedAt);
      if (!d) return;
      items.push({
        id: `course-${c.id}`,
        text:
          c.status === "published"
            ? `Course "${c.title}" published`
            : `Course "${c.title}" added as draft`,
        date: d,
      });
    });

    return items
      .sort((a, b) => b.date - a.date)
      .slice(0, 6)
      .map((item) => ({ ...item, time: timeAgo(item.date) }));
  }, [students, payments, courses]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="px-4 py-2 rounded-lg text-sm" style={{ background: "#fdecea", color: "#b3261e" }}>
          Couldn't load live data: {error}. Check your Firestore collection names in COLLECTIONS
          at the top of this file, and your Firestore security rules.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Students" value={totalStudents.toLocaleString()} icon={Users} />
            <StatCard label="Active Instructors" value={instructorsDisplay || "—"} icon={GraduationCap} />
            <StatCard label="Published Courses" value={publishedCourses} icon={BookOpen} />
            <StatCard label="Revenue (₹L)" value={(totalRevenue / 100000).toFixed(1)} icon={Wallet} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Enrollment trend">
          <div className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={enrollTrend}>
                <defs>
                  <linearGradient id="gEnroll" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AT.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={AT.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: AT.sub }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="v" stroke={AT.accentDeep} fill="url(#gEnroll)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Revenue (₹ Lakh)">
          <div className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueTrend}>
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: AT.sub }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Bar dataKey="v" fill={AT.chrome} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title="Recent activity">
        <div className="divide-y" style={{ borderColor: AT.line }}>
          {recent.length === 0 ? (
            <div className="px-5 py-6 text-sm text-center" style={{ color: AT.sub }}>
              No recent activity yet.
            </div>
          ) : (
            recent.map((r) => (
              <div key={r.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <span style={{ color: AT.ink }}>{r.text}</span>
                <span style={{ color: AT.sub }}>{r.time}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}