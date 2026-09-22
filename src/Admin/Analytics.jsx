import { useEffect, useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from "recharts";
import { AlertCircle, BookOpen, IndianRupee, RefreshCw, UserPlus, Users } from "lucide-react";

import { collection, onSnapshot } from "../lib/database";
import { db } from "../lib/backend";
import { AT, Card } from "./AdminUI.jsx";

// Core collections — errors here show in the red banner.
const COLLECTIONS = ["students", "courses", "enrollments", "payments"];
// Optional — used only to enrich the role-split chart. Missing/failing
// silently falls back to the course-category chart instead of erroring.
const OPTIONAL_COLLECTIONS = ["profiles"];

const pieColors = [AT.accentDeep, AT.accent, "#64748B", "#94A3B8", "#CBD5E1"];
const tooltipStyle = {
  borderRadius: "10px",
  border: `1px solid ${AT.line}`,
  background: AT.card,
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
};

function snapshotRows(snapshot) {
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value.toMillis === "function") return new Date(value.toMillis());
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function monthBuckets(count = 6) {
  const now = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
    return {
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleDateString("en-IN", { month: "short" }),
    };
  });
}

function monthKey(value) {
  const date = asDate(value);
  return date ? `${date.getFullYear()}-${date.getMonth()}` : null;
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 truncate text-2xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-500">{detail}</p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

function EmptyChart({ message }) {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState({ students: [], courses: [], enrollments: [], payments: [] });
  const [optionalData, setOptionalData] = useState({ profiles: [] });
  const [loaded, setLoaded] = useState({});
  const [errors, setErrors] = useState({});
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    const unsubscribers = COLLECTIONS.map((name) =>
      onSnapshot(
        collection(db, name),
        (snapshot) => {
          setData((current) => ({ ...current, [name]: snapshotRows(snapshot) }));
          setLoaded((current) => ({ ...current, [name]: true }));
          setErrors((current) => {
            const next = { ...current };
            delete next[name];
            return next;
          });
          setLastUpdated(new Date());
        },
        (error) => {
          setErrors((current) => ({ ...current, [name]: error.message || "Unable to load data." }));
          setLoaded((current) => ({ ...current, [name]: true }));
        }
      )
    );

    // Optional collections: never surface these as errors, just leave
    // the array empty so the role chart quietly falls back.
    const optionalUnsubscribers = OPTIONAL_COLLECTIONS.map((name) =>
      onSnapshot(
        collection(db, name),
        (snapshot) => {
          setOptionalData((current) => ({ ...current, [name]: snapshotRows(snapshot) }));
        },
        () => {
          setOptionalData((current) => ({ ...current, [name]: [] }));
        }
      )
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      optionalUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  const analytics = useMemo(() => {
    const months = monthBuckets();
    const activeEnrollments = data.enrollments.filter((item) => item.status !== "cancelled");
    const paidPayments = data.payments.filter((item) => ["paid", "captured", "verified"].includes(item.status));
    const coursesById = new Map(data.courses.map((course) => [course.id, course]));

    const enrollmentTrend = months.map((month) => ({
      month: month.label,
      enrollments: activeEnrollments.filter(
        (item) => monthKey(item.enrolledAt || item.createdAt) === month.key
      ).length,
    }));

    const revenueTrend = months.map((month) => ({
      month: month.label,
      revenue: paidPayments
        .filter((item) => monthKey(item.paidAt || item.updatedAt || item.createdAt) === month.key)
        .reduce((sum, item) => sum + Number(item.amount || 0) / 100, 0),
    }));

    const enrollmentsByCourse = new Map();
    const courseNameFallback = new Map();
    for (const enrollment of activeEnrollments) {
      enrollmentsByCourse.set(enrollment.courseId, (enrollmentsByCourse.get(enrollment.courseId) || 0) + 1);
      if (enrollment.courseName && !courseNameFallback.has(enrollment.courseId)) {
        courseNameFallback.set(enrollment.courseId, enrollment.courseName);
      }
    }
    const topCourses = data.courses
      .map((course) => ({
        name: course.title || courseNameFallback.get(course.id) || "Untitled course",
        students: enrollmentsByCourse.get(course.id) || 0,
      }))
      .sort((a, b) => b.students - a.students)
      .slice(0, 5);

    const studentsByCategory = new Map();
    for (const enrollment of activeEnrollments) {
      const course = coursesById.get(enrollment.courseId);
      const category = course?.category?.trim() || "Uncategorized";
      if (!studentsByCategory.has(category)) studentsByCategory.set(category, new Set());
      studentsByCategory.get(category).add(enrollment.studentId || enrollment.uid);
    }
    const categorySplit = [...studentsByCategory.entries()]
      .map(([name, students]) => ({ name, value: students.size }))
      .sort((a, b) => b.value - a.value);

    // Fallback chart when there's no enrollment/category data yet:
    // break down known user profiles by role instead, so the dashboard
    // shows something real from day one.
    const roleCounts = new Map();
    for (const profile of optionalData.profiles) {
      const role = profile.role?.trim() || "unassigned";
      roleCounts.set(role, (roleCounts.get(role) || 0) + 1);
    }
    const roleSplit = [...roleCounts.entries()]
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }))
      .sort((a, b) => b.value - a.value);

    const distributionChart = categorySplit.length > 0
      ? { title: "Enrolled students by course category", data: categorySplit, emptyMessage: "Category distribution will appear after students enroll." }
      : { title: "Users by role", data: roleSplit, emptyMessage: "Role breakdown will appear once profiles are synced." };

    return {
      activeEnrollments,
      paidPayments,
      enrollmentTrend,
      revenueTrend,
      topCourses,
      distributionChart,
      totalRevenue: paidPayments.reduce((sum, item) => sum + Number(item.amount || 0) / 100, 0),
      publishedCourses: data.courses.filter((course) => course.status === "published").length,
    };
  }, [data, optionalData]);

  const loading = COLLECTIONS.some((name) => !loaded[name]);
  const errorMessages = Object.entries(errors);

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden sm:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Live analytics</h1>
          <p className="mt-1 text-sm text-slate-500">Calculated from your Supabase LMS records.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading live data…" : lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-IN")}` : "Waiting for data"}
        </div>
      </div>

      {errorMessages.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">Some analytics could not be loaded.</p>
              {errorMessages.map(([name, message]) => <p key={name}>{name}: {message}</p>)}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Students" value={data.students.length.toLocaleString("en-IN")} detail="Registered student profiles" />
        <Stat icon={UserPlus} label="Active enrollments" value={analytics.activeEnrollments.length.toLocaleString("en-IN")} detail="Across all courses" />
        <Stat icon={IndianRupee} label="Collected revenue" value={money(analytics.totalRevenue)} detail="Paid and verified payments" />
        <Stat icon={BookOpen} label="Published courses" value={analytics.publishedCourses.toLocaleString("en-IN")} detail={`${data.courses.length} total courses`} />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Enrollment trend · last 6 months">
          <div className="h-[240px] min-w-0 p-3 sm:p-5">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.enrollmentTrend} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="enrollmentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AT.accent} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={AT.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AT.line} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: AT.sub }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: AT.sub }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Enrollments"]} />
                  <Area type="monotone" dataKey="enrollments" stroke={AT.accentDeep} fill="url(#enrollmentFill)" strokeWidth={2} />
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Revenue trend · last 6 months">
          <div className="h-[240px] min-w-0 p-3 sm:p-5">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.revenueTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={AT.line} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: AT.sub }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: AT.sub }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [money(value), "Revenue"]} />
                  <Bar dataKey="revenue" fill={AT.chrome} radius={[4, 4, 0, 0]} maxBarSize={38} />
                </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Top courses by active enrollment">
          <div className="h-[260px] min-w-0 p-3 sm:p-5">
            {analytics.topCourses.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.topCourses} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10, fill: AT.sub }} axisLine={false} tickLine={false} tickFormatter={(value) => value.length > 18 ? `${value.slice(0, 17)}…` : value} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Students"]} />
                  <Bar dataKey="students" fill={AT.accentDeep} radius={[0, 4, 4, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyChart message="Course rankings will appear after students enroll." />}
          </div>
        </Card>

        <Card title={analytics.distributionChart.title}>
          <div className="h-[260px] min-w-0 p-3 sm:p-5">
            {analytics.distributionChart.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={analytics.distributionChart.data} dataKey="value" nameKey="name" innerRadius="42%" outerRadius="68%" paddingAngle={2}>
                    {analytics.distributionChart.data.map((item, index) => (
                      <Cell key={item.name} fill={pieColors[index % pieColors.length]} />
                    ))}
                  </Pie>
                  <Legend verticalAlign="bottom" height={32} wrapperStyle={{ fontSize: "11px" }} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Users"]} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyChart message={analytics.distributionChart.emptyMessage} />}
          </div>
        </Card>
      </div>
    </div>
  );
}
