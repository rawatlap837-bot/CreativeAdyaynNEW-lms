import { useEffect, useMemo, useState } from "react";

import {
  Users,
  GraduationCap,
  BookOpen,
  Wallet,
  UserPlus,
  CreditCard,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
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
  CartesianGrid,
} from "recharts";

import {
  collection,
  onSnapshot,
} from "../lib/database";

import { db } from "../lib/backend";

import {
  AT,
  StatCard,
  Card,
} from "./AdminUI.jsx";

import { StatCardSkeleton } from "../components/Skeleton";


/* ================================================================
   Supabase database COLLECTIONS
================================================================ */

const COLLECTIONS = {
  users: "users",
  students: "students",
  instructors: "instructors",
  courses: "courses",
  enrollments: "enrollments",
  payments: "payments",
};


/* ================================================================
   HELPERS
================================================================ */

/**
 * Convert Supabase database Timestamp / Date / number / string
 * into a JavaScript Date.
 */
function toDate(value) {
  if (!value) return null;

  if (
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }

  if (
    typeof value.toMillis === "function"
  ) {
    return new Date(value.toMillis());
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "number") {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  if (typeof value === "string") {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  return null;
}


/**
 * Timestamp → milliseconds.
 */
function timestampValue(value) {
  const date = toDate(value);

  return date
    ? date.getTime()
    : 0;
}


/**
 * Last 6 calendar months.
 */
function getLast6Months() {
  const months = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const date = new Date(
      now.getFullYear(),
      now.getMonth() - i,
      1
    );

    months.push({
      key: `${date.getFullYear()}-${date.getMonth()}`,
      label: date.toLocaleString(
        "en-IN",
        {
          month: "short",
        }
      ),
    });
  }

  return months;
}


/**
 * Relative time.
 */
function timeAgo(date) {
  if (!date) {
    return "";
  }

  const seconds = Math.max(
    0,
    Math.floor(
      (Date.now() - date.getTime()) / 1000
    )
  );

  const intervals = [
    ["y", 31536000],
    ["mo", 2592000],
    ["d", 86400],
    ["h", 3600],
    ["m", 60],
  ];

  for (const [label, secondsPerUnit] of intervals) {
    const value = Math.floor(
      seconds / secondsPerUnit
    );

    if (value >= 1) {
      return `${value}${label} ago`;
    }
  }

  return "just now";
}


/**
 * Convert payment amount to INR.
 *
 * Supported formats:
 *
 * amount = rupees
 *
 * OR
 *
 * amountInRupees = rupees
 *
 * OR
 *
 * amountRupees = rupees
 *
 * OR
 *
 * amountInPaise / amountPaise = paise
 *
 * OR
 *
 * amount + amountUnit = "paise"
 */
function getPaymentAmount(payment) {
  if (!payment) {
    return 0;
  }

  const amountInRupees = Number(
    payment.amountInRupees
  );

  if (Number.isFinite(amountInRupees)) {
    return amountInRupees;
  }

  const amountRupees = Number(
    payment.amountRupees
  );

  if (Number.isFinite(amountRupees)) {
    return amountRupees;
  }

  const amountInPaise = Number(
    payment.amountInPaise
  );

  if (Number.isFinite(amountInPaise)) {
    return amountInPaise / 100;
  }

  const amountPaise = Number(
    payment.amountPaise
  );

  if (Number.isFinite(amountPaise)) {
    return amountPaise / 100;
  }

  const amount = Number(
    payment.amount
  );

  if (!Number.isFinite(amount)) {
    return 0;
  }

  if (
    payment.amountUnit === "paise" ||
    payment.unit === "paise"
  ) {
    return amount / 100;
  }

  /**
   * Your existing payment UI treats `amount`
   * as INR, so that remains the default.
   */
  return amount;
}


/**
 * Successful payment statuses.
 */
function isSuccessfulPayment(payment) {
  const status = String(
    payment?.status || ""
  )
    .trim()
    .toLowerCase();

  return [
    "success",
    "successful",
    "paid",
    "captured",
    "completed",
  ].includes(status);
}


/**
 * Payment was refunded.
 */
function isRefundedPayment(payment) {
  const status = String(
    payment?.status || ""
  )
    .trim()
    .toLowerCase();

  return [
    "refunded",
    "refund",
    "partially_refunded",
  ].includes(status);
}


/**
 * Payment date.
 */
function getPaymentDate(payment) {
  return (
    toDate(payment?.paidAt) ||
    toDate(payment?.capturedAt) ||
    toDate(payment?.createdAt) ||
    toDate(payment?.updatedAt)
  );
}


/**
 * Generic document conversion.
 */
function mapSnapshot(snapshot) {
  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}


/* ================================================================
   ADMIN DASHBOARD
================================================================ */

export default function AdminDashboard() {

  /* --------------------------------------------------------------
     LIVE DATA
  -------------------------------------------------------------- */

  const [users, setUsers] = useState([]);
  const [legacyStudents, setLegacyStudents] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [payments, setPayments] = useState([]);


  /* --------------------------------------------------------------
     LOADING
  -------------------------------------------------------------- */

  const [loaded, setLoaded] = useState({
    users: false,
    students: false,
    instructors: false,
    courses: false,
    enrollments: false,
    payments: false,
  });


  const [errors, setErrors] = useState([]);


  const loading =
    !loaded.users ||
    !loaded.students ||
    !loaded.instructors ||
    !loaded.courses ||
    !loaded.enrollments ||
    !loaded.payments;


  /* ================================================================
     LIVE Supabase database LISTENERS
  ================================================================= */

  useEffect(() => {

    const unsubscribers = [];


    function subscribe(
      collectionName,
      setter,
      loadedKey
    ) {

      const unsubscribe = onSnapshot(
        collection(
          db,
          collectionName
        ),

        (snapshot) => {

          setter(
            mapSnapshot(snapshot)
          );

          setLoaded((previous) => ({
            ...previous,
            [loadedKey]: true,
          }));

        },

        (error) => {

          console.error(
            `Admin dashboard ${collectionName} error:`,
            error
          );

          setErrors((previous) => {

            const message =
              `${collectionName}: ${error.message}`;

            if (
              previous.includes(message)
            ) {
              return previous;
            }

            return [
              ...previous,
              message,
            ];
          });

          setLoaded((previous) => ({
            ...previous,
            [loadedKey]: true,
          }));

        }
      );

      unsubscribers.push(
        unsubscribe
      );
    }


    subscribe(
      COLLECTIONS.users,
      setUsers,
      "users"
    );

    subscribe(
      COLLECTIONS.students,
      setLegacyStudents,
      "students"
    );

    subscribe(
      COLLECTIONS.instructors,
      setInstructors,
      "instructors"
    );

    subscribe(
      COLLECTIONS.courses,
      setCourses,
      "courses"
    );

    subscribe(
      COLLECTIONS.enrollments,
      setEnrollments,
      "enrollments"
    );

    subscribe(
      COLLECTIONS.payments,
      setPayments,
      "payments"
    );


    return () => {
      unsubscribers.forEach(
        (unsubscribe) =>
          unsubscribe()
      );
    };

  }, []);


  /* ================================================================
     REAL STUDENTS
  ================================================================= */

  const students = useMemo(() => {

    /**
     * Canonical source:
     *
     * users/{uid}
     * role = student
     */
    const userStudents = users.filter(
      (user) =>
        String(
          user.role || ""
        ).toLowerCase() === "student"
    );


    /**
     * Legacy students collection.
     *
     * Used only when the same student
     * doesn't already exist in users.
     */
    const existingIds = new Set(
      userStudents.map(
        (student) => student.id
      )
    );


    const legacy = legacyStudents.filter(
      (student) =>
        !existingIds.has(student.id)
    );


    return [
      ...userStudents,
      ...legacy,
    ];

  }, [
    users,
    legacyStudents,
  ]);


  /* ================================================================
     ACTIVE INSTRUCTORS
  ================================================================= */

  const activeInstructors = useMemo(() => {

    /**
     * Users with teacher/instructor role.
     */
    const teacherUsers = users.filter(
      (user) => {

        const role =
          String(
            user.role || ""
          ).toLowerCase();

        if (
          role !== "teacher" &&
          role !== "instructor"
        ) {
          return false;
        }

        /**
         * If status exists and explicitly says
         * inactive/disabled, don't count it.
         */
        if (
          user.status &&
          [
            "inactive",
            "disabled",
            "suspended",
          ].includes(
            String(
              user.status
            ).toLowerCase()
          )
        ) {
          return false;
        }

        if (
          user.active === false
        ) {
          return false;
        }

        return true;
      }
    );


    /**
     * Instructor collection.
     *
     * This supports your existing
     * instructors collection as well.
     */
    const activeInstructorDocs =
      instructors.filter(
        (instructor) => {

          if (
            instructor.status &&
            [
              "inactive",
              "disabled",
              "suspended",
            ].includes(
              String(
                instructor.status
              ).toLowerCase()
            )
          ) {
            return false;
          }

          if (
            instructor.active === false
          ) {
            return false;
          }

          return true;
        }
      );


    /**
     * Deduplicate by UID / ID.
     */
    const ids = new Set();

    [
      ...teacherUsers,
      ...activeInstructorDocs,
    ].forEach((item) => {

      const id =
        item.uid ||
        item.userId ||
        item.id;

      if (id) {
        ids.add(id);
      }

    });


    return ids.size;

  }, [
    users,
    instructors,
  ]);


  /* ================================================================
     COURSE STATISTICS
  ================================================================= */

  const publishedCourses =
    courses.filter(
      (course) =>
        course.status === "published"
    ).length;


  const draftCourses =
    courses.filter(
      (course) =>
        course.status === "draft"
    ).length;


  const pendingCourses =
    courses.filter(
      (course) =>
        course.status === "pending"
    ).length;


  /* ================================================================
     ENROLLMENT STATISTICS
  ================================================================= */

  const activeEnrollments =
    enrollments.filter(
      (enrollment) =>
        enrollment.status === "active"
    );


  const totalEnrollments =
    activeEnrollments.length;


  /* ================================================================
     REVENUE
  ================================================================= */

  const successfulPayments =
    payments.filter(
      isSuccessfulPayment
    );


  const refundedPayments =
    payments.filter(
      isRefundedPayment
    );


  const grossRevenue =
    successfulPayments.reduce(
      (total, payment) =>
        total +
        getPaymentAmount(payment),
      0
    );


  const refundAmount =
    refundedPayments.reduce(
      (total, payment) =>
        total +
        getPaymentAmount(payment),
      0
    );


  const totalRevenue =
    Math.max(
      0,
      grossRevenue - refundAmount
    );


  /* ================================================================
     REVENUE TREND
  ================================================================= */

  const revenueTrend = useMemo(() => {

    const months =
      getLast6Months();


    const totals =
      Object.fromEntries(
        months.map(
          (month) => [
            month.key,
            0,
          ]
        )
      );


    successfulPayments.forEach(
      (payment) => {

        const date =
          getPaymentDate(payment);

        if (!date) {
          return;
        }

        const key =
          `${date.getFullYear()}-${date.getMonth()}`;


        if (
          Object.prototype.hasOwnProperty.call(
            totals,
            key
          )
        ) {

          totals[key] +=
            getPaymentAmount(
              payment
            );

        }

      }
    );


    return months.map(
      (month) => ({
        m: month.label,
        v: Number(
          (
            totals[month.key] /
            100000
          ).toFixed(2)
        ),
      })
    );

  }, [
    successfulPayments,
  ]);


  /* ================================================================
     ENROLLMENT TREND
  ================================================================= */

  const enrollmentTrend =
    useMemo(() => {

      const months =
        getLast6Months();


      const totals =
        Object.fromEntries(
          months.map(
            (month) => [
              month.key,
              0,
            ]
          )
        );


      enrollments.forEach(
        (enrollment) => {

          const date =
            toDate(
              enrollment.createdAt ||
              enrollment.enrolledAt ||
              enrollment.updatedAt
            );

          if (!date) {
            return;
          }


          const key =
            `${date.getFullYear()}-${date.getMonth()}`;


          if (
            Object.prototype.hasOwnProperty.call(
              totals,
              key
            )
          ) {

            totals[key] += 1;

          }

        }
      );


      return months.map(
        (month) => ({
          m: month.label,
          v: totals[
            month.key
          ],
        })
      );

    }, [
      enrollments,
    ]);


  /* ================================================================
     RECENT ACTIVITY
  ================================================================= */

  const recentActivity =
    useMemo(() => {

      const items = [];


      /* ------------------------------------------------------------
         STUDENTS
      ------------------------------------------------------------ */

      students.forEach(
        (student) => {

          const date =
            toDate(
              student.createdAt ||
              student.registeredAt ||
              student.enrolledAt
            );

          if (!date) {
            return;
          }


          items.push({
            id:
              `student-${student.id}`,

            type:
              "student",

            icon:
              UserPlus,

            text:
              `New student ${
                student.name ||
                student.fullName ||
                student.displayName ||
                student.email ||
                "Unknown"
              } registered`,

            date,
          });

        }
      );


      /* ------------------------------------------------------------
         ENROLLMENTS
      ------------------------------------------------------------ */

      enrollments.forEach(
        (enrollment) => {

          const date =
            toDate(
              enrollment.createdAt ||
              enrollment.enrolledAt
            );

          if (!date) {
            return;
          }


          if (
            enrollment.status &&
            enrollment.status !== "active"
          ) {
            return;
          }


          const studentName =
            enrollment.studentName ||
            enrollment.name ||
            enrollment.email ||
            "Student";


          const courseName =
            enrollment.courseName ||
            enrollment.courseTitle ||
            "course";


          items.push({
            id:
              `enrollment-${enrollment.id}`,

            type:
              "enrollment",

            icon:
              CheckCircle2,

            text:
              `${studentName} enrolled in ${courseName}`,

            date,
          });

        }
      );


      /* ------------------------------------------------------------
         PAYMENTS
      ------------------------------------------------------------ */

      successfulPayments.forEach(
        (payment) => {

          const date =
            getPaymentDate(
              payment
            );

          if (!date) {
            return;
          }


          const studentName =
            payment.studentName ||
            payment.name ||
            payment.userName ||
            payment.email ||
            "Student";


          const courseName =
            payment.courseName ||
            payment.courseTitle ||
            "course";


          const amount =
            getPaymentAmount(
              payment
            );


          items.push({
            id:
              `payment-${payment.id}`,

            type:
              "payment",

            icon:
              CreditCard,

            text:
              `Payment received from ${studentName} — ₹${amount.toLocaleString(
                "en-IN"
              )} for ${courseName}`,

            date,
          });

        }
      );


      /* ------------------------------------------------------------
         COURSES
      ------------------------------------------------------------ */

      courses.forEach(
        (course) => {

          const date =
            toDate(
              course.publishedAt ||
              course.createdAt ||
              course.updatedAt
            );

          if (!date) {
            return;
          }


          let text;


          if (
            course.status ===
            "published"
          ) {

            text =
              `Course "${course.title || "Untitled"}" published`;

          } else if (
            course.status ===
            "pending"
          ) {

            text =
              `Course "${course.title || "Untitled"}" submitted for approval`;

          } else if (
            course.status ===
            "rejected"
          ) {

            text =
              `Course "${course.title || "Untitled"}" rejected`;

          } else {

            text =
              `Course "${course.title || "Untitled"}" added as draft`;

          }


          items.push({
            id:
              `course-${course.id}`,

            type:
              "course",

            icon:
              BookOpen,

            text,

            date,
          });

        }
      );


      return items
        .sort(
          (a, b) =>
            b.date - a.date
        )
        .slice(0, 8)
        .map(
          (item) => ({
            ...item,
            time:
              timeAgo(
                item.date
              ),
          })
        );

    }, [
      students,
      enrollments,
      successfulPayments,
      courses,
    ]);


  /* ================================================================
     REFRESH TIME
  ================================================================= */

  const [lastUpdated, setLastUpdated] =
    useState(
      new Date()
    );


  useEffect(() => {

    if (!loading) {
      setLastUpdated(
        new Date()
      );
    }

  }, [
    loading,
    users,
    courses,
    enrollments,
    payments,
    instructors,
  ]);


  /* ================================================================
     UI
  ================================================================= */

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden sm:space-y-6">


      {/* ============================================================
          ERROR
      ============================================================ */}

      {errors.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-xl border px-4 py-3 text-xs leading-5 sm:text-sm"
          style={{
            background:
              "#fff7ed",
            borderColor:
              "#fed7aa",
            color:
              "#9a3412",
          }}
        >

          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-medium">
              Some dashboard data could not be loaded.
            </p>

            <p className="mt-1">
              {errors.join(" • ")}
            </p>
          </div>

        </div>
      )}


      {/* ============================================================
          DASHBOARD HEADER
      ============================================================ */}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <h1
            className="text-xl font-semibold"
            style={{
              color: AT.ink,
            }}
          >
            Dashboard
          </h1>

          <p
            className="mt-1 text-xs sm:text-sm"
            style={{
              color: AT.sub,
            }}
          >
            Live overview of your LMS
          </p>
        </div>


        <div
          className="flex items-center gap-2 text-[11px] sm:text-xs"
          style={{
            color: AT.sub,
          }}
        >

          <RefreshCw
            size={13}
          />

          <span>
            Live • updated{" "}
            {lastUpdated.toLocaleTimeString(
              "en-IN",
              {
                hour:
                  "2-digit",
                minute:
                  "2-digit",
              }
            )}
          </span>

        </div>

      </div>


      {/* ============================================================
          STAT CARDS
      ============================================================ */}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">

        {loading ? (

          Array.from({
            length: 4,
          }).map(
            (_, index) => (
              <StatCardSkeleton
                key={index}
              />
            )
          )

        ) : (

          <>

            <StatCard
              label="Total Students"
              value={students.length.toLocaleString(
                "en-IN"
              )}
              icon={Users}
            />


            <StatCard
              label="Active Instructors"
              value={activeInstructors.toLocaleString(
                "en-IN"
              )}
              icon={GraduationCap}
            />


            <StatCard
              label="Published Courses"
              value={publishedCourses.toLocaleString(
                "en-IN"
              )}
              icon={BookOpen}
            />


            <StatCard
              label="Total Revenue"
              value={`₹${(
                totalRevenue /
                100000
              ).toFixed(2)}L`}
              icon={Wallet}
            />

          </>

        )}

      </section>


      {/* ============================================================
          SECONDARY LIVE STATS
      ============================================================ */}

      {!loading && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">

          <div
            className="rounded-xl border bg-white px-4 py-3"
            style={{
              borderColor: AT.line,
            }}
          >
            <p
              className="text-xs"
              style={{
                color: AT.sub,
              }}
            >
              Active Enrollments
            </p>

            <p
              className="mt-1 text-lg font-semibold"
              style={{
                color: AT.ink,
              }}
            >
              {totalEnrollments}
            </p>
          </div>


          <div
            className="rounded-xl border bg-white px-4 py-3"
            style={{
              borderColor: AT.line,
            }}
          >
            <p
              className="text-xs"
              style={{
                color: AT.sub,
              }}
            >
              Successful Payments
            </p>

            <p
              className="mt-1 text-lg font-semibold"
              style={{
                color: AT.ink,
              }}
            >
              {successfulPayments.length}
            </p>
          </div>


          <div
            className="rounded-xl border bg-white px-4 py-3"
            style={{
              borderColor: AT.line,
            }}
          >
            <p
              className="text-xs"
              style={{
                color: AT.sub,
              }}
            >
              Pending Courses
            </p>

            <p
              className="mt-1 text-lg font-semibold"
              style={{
                color: AT.ink,
              }}
            >
              {pendingCourses}
            </p>
          </div>


          <div
            className="rounded-xl border bg-white px-4 py-3"
            style={{
              borderColor: AT.line,
            }}
          >
            <p
              className="text-xs"
              style={{
                color: AT.sub,
              }}
            >
              Draft Courses
            </p>

            <p
              className="mt-1 text-lg font-semibold"
              style={{
                color: AT.ink,
              }}
            >
              {draftCourses}
            </p>
          </div>

        </section>
      )}


      {/* ============================================================
          CHARTS
      ============================================================ */}

      <section className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2">


        {/* ----------------------------------------------------------
            ENROLLMENT TREND
        ---------------------------------------------------------- */}

        <Card title="Enrollment trend">

          <div className="w-full min-w-0 overflow-hidden p-3 pt-2 sm:p-5 sm:pt-3">

            <div className="h-[220px] w-full min-w-0">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <AreaChart
                  data={enrollmentTrend}
                  margin={{
                    top: 10,
                    right: 8,
                    left: -20,
                    bottom: 0,
                  }}
                >

                  <defs>

                    <linearGradient
                      id="adminEnrollmentGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >

                      <stop
                        offset="0%"
                        stopColor={
                          AT.accent
                        }
                        stopOpacity={0.35}
                      />

                      <stop
                        offset="100%"
                        stopColor={
                          AT.accent
                        }
                        stopOpacity={0}
                      />

                    </linearGradient>

                  </defs>


                  <CartesianGrid
                    vertical={false}
                    stroke={
                      AT.line
                    }
                    strokeDasharray="3 3"
                  />


                  <XAxis
                    dataKey="m"
                    tick={{
                      fontSize: 11,
                      fill: AT.sub,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />


                  <YAxis
                    allowDecimals={false}
                    tick={{
                      fontSize: 10,
                      fill: AT.sub,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />


                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      value,
                      "Enrollments",
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: `1px solid ${AT.line}`,
                      boxShadow:
                        "0 8px 24px rgba(0,0,0,0.08)",
                    }}
                  />


                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={
                      AT.accentDeep
                    }
                    fill="url(#adminEnrollmentGradient)"
                    strokeWidth={2}
                    dot={{
                      r: 3,
                    }}
                  />

                </AreaChart>

              </ResponsiveContainer>

            </div>

          </div>

        </Card>


        {/* ----------------------------------------------------------
            REVENUE TREND
        ---------------------------------------------------------- */}

        <Card title="Revenue (₹ Lakh)">

          <div className="w-full min-w-0 overflow-hidden p-3 pt-2 sm:p-5 sm:pt-3">

            <div className="h-[220px] w-full min-w-0">

              <ResponsiveContainer
                width="100%"
                height="100%"
              >

                <BarChart
                  data={revenueTrend}
                  margin={{
                    top: 10,
                    right: 8,
                    left: -20,
                    bottom: 0,
                  }}
                >

                  <CartesianGrid
                    vertical={false}
                    stroke={
                      AT.line
                    }
                    strokeDasharray="3 3"
                  />


                  <XAxis
                    dataKey="m"
                    tick={{
                      fontSize: 11,
                      fill: AT.sub,
                    }}
                    axisLine={false}
                    tickLine={false}
                  />


                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: AT.sub,
                    }}
                    axisLine={false}
                    tickLine={false}
                    width={35}
                  />


                  <Tooltip
                    formatter={(
                      value
                    ) => [
                      `₹${value}L`,
                      "Revenue",
                    ]}
                    contentStyle={{
                      borderRadius: 10,
                      border: `1px solid ${AT.line}`,
                      boxShadow:
                        "0 8px 24px rgba(0,0,0,0.08)",
                    }}
                  />


                  <Bar
                    dataKey="v"
                    fill={
                      AT.chrome
                    }
                    radius={[
                      5,
                      5,
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
          REVENUE DETAILS
      ============================================================ */}

      {!loading && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">

          <div
            className="rounded-xl border bg-white p-4"
            style={{
              borderColor: AT.line,
            }}
          >
            <div className="flex items-center justify-between">

              <div>
                <p
                  className="text-xs"
                  style={{
                    color: AT.sub,
                  }}
                >
                  Gross Revenue
                </p>

                <p
                  className="mt-1 text-xl font-semibold"
                  style={{
                    color: AT.ink,
                  }}
                >
                  ₹
                  {grossRevenue.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <Wallet
                size={20}
                style={{
                  color: AT.accent,
                }}
              />

            </div>
          </div>


          <div
            className="rounded-xl border bg-white p-4"
            style={{
              borderColor: AT.line,
            }}
          >
            <div className="flex items-center justify-between">

              <div>
                <p
                  className="text-xs"
                  style={{
                    color: AT.sub,
                  }}
                >
                  Refunds
                </p>

                <p
                  className="mt-1 text-xl font-semibold"
                  style={{
                    color: AT.ink,
                  }}
                >
                  ₹
                  {refundAmount.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <RefreshCw
                size={20}
                style={{
                  color: AT.sub,
                }}
              />

            </div>
          </div>


          <div
            className="rounded-xl border bg-white p-4"
            style={{
              borderColor: AT.line,
            }}
          >
            <div className="flex items-center justify-between">

              <div>
                <p
                  className="text-xs"
                  style={{
                    color: AT.sub,
                  }}
                >
                  Net Revenue
                </p>

                <p
                  className="mt-1 text-xl font-semibold"
                  style={{
                    color: AT.ink,
                  }}
                >
                  ₹
                  {totalRevenue.toLocaleString(
                    "en-IN"
                  )}
                </p>
              </div>

              <CheckCircle2
                size={20}
                style={{
                  color: AT.accent,
                }}
              />

            </div>
          </div>

        </section>
      )}


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

          {recentActivity.length === 0 ? (

            <div
              className="px-4 py-10 text-center sm:px-5"
              style={{
                color: AT.sub,
              }}
            >

              <BookOpen
                size={28}
                className="mx-auto mb-3"
                style={{
                  color: AT.sub,
                }}
              />

              <p className="text-sm">
                No recent activity yet.
              </p>

              <p className="mt-1 text-xs">
                New students, enrollments,
                payments and course changes
                will appear here automatically.
              </p>

            </div>

          ) : (

            recentActivity.map(
              (item) => {

                const Icon =
                  item.icon ||
                  BookOpen;


                return (
                  <div
                    key={item.id}
                    className="
                      flex
                      items-start
                      gap-3
                      px-4
                      py-3.5
                      sm:px-5
                    "
                  >

                    <div
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                      style={{
                        background:
                          "rgba(91,33,182,0.08)",
                      }}
                    >

                      <Icon
                        size={15}
                        style={{
                          color:
                            AT.accentDeep,
                        }}
                      />

                    </div>


                    <div className="min-w-0 flex-1">

                      <p
                        className="break-words text-xs leading-5 sm:text-sm"
                        style={{
                          color:
                            AT.ink,
                        }}
                      >
                        {item.text}
                      </p>

                      <p
                        className="mt-0.5 text-[11px]"
                        style={{
                          color:
                            AT.sub,
                        }}
                      >
                        {item.time}
                      </p>

                    </div>

                  </div>
                );

              }
            )

          )}

        </div>

      </Card>


      {/* ============================================================
          LIVE DATA FOOTER
      ============================================================ */}

      {!loading && (
        <div
          className="flex flex-col gap-2 rounded-xl border bg-white px-4 py-3 text-[11px] sm:flex-row sm:items-center sm:justify-between sm:text-xs"
          style={{
            borderColor: AT.line,
            color: AT.sub,
          }}
        >

          <div className="flex items-center gap-2">

            <span
              className="h-2 w-2 rounded-full"
              style={{
                background:
                  "#10b981",
              }}
            />

            <span>
              Connected to live Supabase database data
            </span>

          </div>


          <div>
            {students.length} students •{" "}
            {courses.length} courses •{" "}
            {enrollments.length} enrollments •{" "}
            {payments.length} payments
          </div>

        </div>
      )}

    </div>
  );
}