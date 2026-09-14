import { useEffect, useMemo, useState } from "react";
import {
  Users,
  GraduationCap,
  BookOpen,
  Wallet,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import {
  collection,
  onSnapshot,
} from "firebase/firestore";

import { db } from "../firebase/Firebase.js";

import {
  AT,
  StatCard,
  Card,
} from "./AdminUI.jsx";

import { StatCardSkeleton } from "../components/Skeleton";

/* ------------------------------------------------------------------
 * Firestore collection names
 * ------------------------------------------------------------------ */

const COLLECTIONS = {
  students: "students",
  courses: "courses",
  payments: "payments",
  instructors: "instructors",
};

/* ------------------------------------------------------------------
 * Last 6 calendar months
 * ------------------------------------------------------------------ */

function last6MonthKeys() {
  const out = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    out.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleString("en-US", {
        month: "short",
      }),
    });
  }

  return out;
}

/* ------------------------------------------------------------------
 * Firestore Timestamp / Date helper
 * ------------------------------------------------------------------ */

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const d = new Date(value);

  return isNaN(d) ? null : d;
}

/* ------------------------------------------------------------------
 * Time ago
 * ------------------------------------------------------------------ */

function timeAgo(date) {
  const seconds = Math.floor(
    (Date.now() - date.getTime()) / 1000
  );

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

/* ==================================================================
   ADMIN DASHBOARD
================================================================== */

export default function AdminDashboard() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [instructorsCount, setInstructorsCount] =
    useState(null);

  const [loaded, setLoaded] = useState({
    students: false,
    courses: false,
    payments: false,
    instructors: false,
  });

  const [error, setError] = useState(null);

  const loading = !(
    loaded.students &&
    loaded.courses &&
    loaded.payments &&
    loaded.instructors
  );

  /* ================================================================
     FIRESTORE LIVE DATA
  ================================================================ */

  useEffect(() => {
    const unsubs = [];

    try {
      /* ------------------------------------------------------------
         STUDENTS
      ------------------------------------------------------------ */

      unsubs.push(
        onSnapshot(
          collection(db, COLLECTIONS.students),
          (snap) => {
            setStudents(
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }))
            );

            setLoaded((prev) => ({
              ...prev,
              students: true,
            }));
          },
          (err) => setError(err.message)
        )
      );

      /* ------------------------------------------------------------
         COURSES
      ------------------------------------------------------------ */

      unsubs.push(
        onSnapshot(
          collection(db, COLLECTIONS.courses),
          (snap) => {
            setCourses(
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }))
            );

            setLoaded((prev) => ({
              ...prev,
              courses: true,
            }));
          },
          (err) => setError(err.message)
        )
      );

      /* ------------------------------------------------------------
         PAYMENTS
      ------------------------------------------------------------ */

      unsubs.push(
        onSnapshot(
          collection(db, COLLECTIONS.payments),
          (snap) => {
            setPayments(
              snap.docs.map((d) => ({
                id: d.id,
                ...d.data(),
              }))
            );

            setLoaded((prev) => ({
              ...prev,
              payments: true,
            }));
          },
          (err) => setError(err.message)
        )
      );

      /* ------------------------------------------------------------
         INSTRUCTORS
      ------------------------------------------------------------ */

      if (COLLECTIONS.instructors) {
        unsubs.push(
          onSnapshot(
            collection(db, COLLECTIONS.instructors),
            (snap) => {
              setInstructorsCount(snap.size);

              setLoaded((prev) => ({
                ...prev,
                instructors: true,
              }));
            },
            (err) => setError(err.message)
          )
        );
      } else {
        setLoaded((prev) => ({
          ...prev,
          instructors: true,
        }));
      }
    } catch (err) {
      setError(err.message);

      setLoaded({
        students: true,
        courses: true,
        payments: true,
        instructors: true,
      });
    }

    return () =>
      unsubs.forEach((unsub) => unsub());
  }, []);

  /* ================================================================
     STATS
  ================================================================ */

  const totalStudents = students.length;

  const publishedCourses = courses.filter(
    (course) => course.status === "published"
  ).length;

  const totalRevenue = payments
    .filter(
      (payment) =>
        !payment.status ||
        payment.status === "success" ||
        payment.status === "paid"
    )
    .reduce(
      (sum, payment) =>
        sum + (Number(payment.amount) || 0),
      0
    );

  /* ================================================================
     INSTRUCTORS
  ================================================================ */

  const distinctCourseInstructors = useMemo(() => {
    const names = new Set(
      courses
        .map((course) =>
          (course.instructor || "").trim()
        )
        .filter(Boolean)
    );

    return names.size;
  }, [courses]);

  const instructorsDisplay =
    instructorsCount && instructorsCount > 0
      ? instructorsCount
      : distinctCourseInstructors;

  /* ================================================================
     ENROLLMENT TREND
  ================================================================ */

  const enrollTrend = useMemo(() => {
    const buckets = last6MonthKeys();

    const counts = Object.fromEntries(
      buckets.map((bucket) => [
        bucket.key,
        0,
      ])
    );

    students.forEach((student) => {
      const date = toDate(
        student.createdAt ||
          student.enrolledAt
      );

      if (!date) return;

      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (key in counts) {
        counts[key] += 1;
      }
    });

    return buckets.map((bucket) => ({
      m: bucket.label,
      v: counts[bucket.key],
    }));
  }, [students]);

  /* ================================================================
     REVENUE TREND
  ================================================================ */

  const revenueTrend = useMemo(() => {
    const buckets = last6MonthKeys();

    const sums = Object.fromEntries(
      buckets.map((bucket) => [
        bucket.key,
        0,
      ])
    );

    payments.forEach((payment) => {
      const date = toDate(
        payment.createdAt ||
          payment.paidAt
      );

      if (!date) return;

      const key = `${date.getFullYear()}-${date.getMonth()}`;

      if (key in sums) {
        sums[key] +=
          Number(payment.amount) || 0;
      }
    });

    return buckets.map((bucket) => ({
      m: bucket.label,
      v: +(
        sums[bucket.key] / 100000
      ).toFixed(2),
    }));
  }, [payments]);

  /* ================================================================
     RECENT ACTIVITY
  ================================================================ */

  const recent = useMemo(() => {
    const items = [];

    /* --------------------------------------------------------------
       STUDENTS
    -------------------------------------------------------------- */

    students.forEach((student) => {
      const date = toDate(
        student.createdAt ||
          student.enrolledAt
      );

      if (!date) return;

      items.push({
        id: `student-${student.id}`,

        text: `New student ${
          student.name ||
          student.fullName ||
          "Unknown"
        } enrolled${
          student.course
            ? ` in ${student.course}`
            : ""
        }`,

        date,
      });
    });

    /* --------------------------------------------------------------
       PAYMENTS
    -------------------------------------------------------------- */

    payments.forEach((payment) => {
      if (
        payment.status &&
        payment.status !== "success" &&
        payment.status !== "paid"
      ) {
        return;
      }

      const date = toDate(
        payment.paidAt ||
          payment.createdAt
      );

      if (!date) return;

      items.push({
        id: `payment-${payment.id}`,

        text: `Payment received — ₹${
          payment.amount
        }${
          payment.courseName
            ? ` for ${payment.courseName}`
            : ""
        }`,

        date,
      });
    });

    /* --------------------------------------------------------------
       COURSES
    -------------------------------------------------------------- */

    courses.forEach((course) => {
      const date = toDate(
        course.createdAt ||
          course.publishedAt
      );

      if (!date) return;

      items.push({
        id: `course-${course.id}`,

        text:
          course.status === "published"
            ? `Course "${course.title}" published`
            : `Course "${course.title}" added as draft`,

        date,
      });
    });

    return items
      .sort((a, b) => b.date - a.date)
      .slice(0, 6)
      .map((item) => ({
        ...item,
        time: timeAgo(item.date),
      }));
  }, [
    students,
    payments,
    courses,
  ]);

  /* ================================================================
     UI
  ================================================================ */

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">

      {/* ============================================================
          ERROR
      ============================================================ */}

      {error && (
        <div
          className="mx-0 rounded-xl px-4 py-3 text-xs leading-5 sm:text-sm"
          style={{
            background: "#fdecea",
            color: "#b3261e",
          }}
        >
          Couldn't load live data: {error}.
          Check your Firestore collection names
          and Firestore security rules.
        </div>
      )}

      {/* ============================================================
          STAT CARDS
      ============================================================ */}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map(
            (_, i) => (
              <StatCardSkeleton key={i} />
            )
          )
        ) : (
          <>
            <StatCard
              label="Total Students"
              value={totalStudents.toLocaleString()}
              icon={Users}
            />

            <StatCard
              label="Active Instructors"
              value={
                instructorsDisplay || "—"
              }
              icon={GraduationCap}
            />

            <StatCard
              label="Published Courses"
              value={publishedCourses}
              icon={BookOpen}
            />

            <StatCard
              label="Revenue (₹L)"
              value={(
                totalRevenue / 100000
              ).toFixed(1)}
              icon={Wallet}
            />
          </>
        )}
      </section>

      {/* ============================================================
          CHARTS
      ============================================================ */}

      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">

        {/* ----------------------------------------------------------
            ENROLLMENT
        ---------------------------------------------------------- */}

        <Card title="Enrollment trend">
          <div className="w-full min-w-0 overflow-hidden p-3 pt-1 sm:p-5 sm:pt-3">
            <div className="h-[190px] w-full min-w-0 sm:h-[210px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <AreaChart
                  data={enrollTrend}
                  margin={{
                    top: 10,
                    right: 5,
                    left: -20,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="gEnroll"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={AT.accent}
                        stopOpacity={0.35}
                      />

                      <stop
                        offset="100%"
                        stopColor={AT.accent}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <XAxis
                    dataKey="m"
                    tick={{
                      fontSize: 11,
                      fill: AT.sub,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis hide />

                  <Tooltip />

                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={AT.accentDeep}
                    fill="url(#gEnroll)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* ----------------------------------------------------------
            REVENUE
        ---------------------------------------------------------- */}

        <Card title="Revenue (₹ Lakh)">
          <div className="w-full min-w-0 overflow-hidden p-3 pt-1 sm:p-5 sm:pt-3">
            <div className="h-[190px] w-full min-w-0 sm:h-[210px]">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={revenueTrend}
                  margin={{
                    top: 10,
                    right: 5,
                    left: -20,
                    bottom: 0,
                  }}
                >
                  <XAxis
                    dataKey="m"
                    tick={{
                      fontSize: 11,
                      fill: AT.sub,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />

                  <YAxis hide />

                  <Tooltip />

                  <Bar
                    dataKey="v"
                    fill={AT.chrome}
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

      </section>

      {/* ============================================================
          RECENT ACTIVITY
      ============================================================ */}

      <Card title="Recent activity">

        <div
          className="divide-y"
          style={{
            borderColor: AT.line,
          }}
        >
          {recent.length === 0 ? (
            <div
              className="px-4 py-8 text-center text-sm sm:px-5"
              style={{
                color: AT.sub,
              }}
            >
              No recent activity yet.
            </div>
          ) : (
            recent.map((item) => (
              <div
                key={item.id}
                className="
                  flex
                  flex-col
                  gap-1
                  px-4
                  py-3
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                  sm:px-5
                "
              >
                <span
                  className="min-w-0 break-words text-xs leading-5 sm:text-sm"
                  style={{
                    color: AT.ink,
                  }}
                >
                  {item.text}
                </span>

                <span
                  className="shrink-0 text-[11px] sm:text-xs"
                  style={{
                    color: AT.sub,
                  }}
                >
                  {item.time}
                </span>
              </div>
            ))
          )}
        </div>

      </Card>

    </div>
  );
}