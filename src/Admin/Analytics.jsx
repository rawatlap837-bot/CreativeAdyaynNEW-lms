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
} from "recharts";

import { AT, Card } from "./AdminUI.jsx";

/* ================================================================
   DATA
================================================================ */

const enrollTrend = [
  { m: "Mar", v: 210 },
  { m: "Apr", v: 260 },
  { m: "May", v: 240 },
  { m: "Jun", v: 310 },
  { m: "Jul", v: 380 },
  { m: "Aug", v: 420 },
];

const revenueTrend = [
  { m: "Mar", v: 4.1 },
  { m: "Apr", v: 3.8 },
  { m: "May", v: 5.2 },
  { m: "Jun", v: 6.0 },
  { m: "Jul", v: 5.4 },
  { m: "Aug", v: 6.8 },
];

const topCourses = [
  {
    name: "Data Structures & Algorithms",
    students: 128,
  },
  {
    name: "Operating Systems",
    students: 102,
  },
  {
    name: "Digital Signal Processing",
    students: 76,
  },
  {
    name: "Principles of Marketing",
    students: 54,
  },
];

const deptSplit = [
  {
    name: "CSE",
    value: 44,
  },
  {
    name: "ECE",
    value: 22,
  },
  {
    name: "BBA",
    value: 18,
  },
  {
    name: "M.Sc IT",
    value: 16,
  },
];

const pieColors = [
  AT.accentDeep,
  AT.accent,
  "#94A3B8",
  "#CBD5E1",
];

/* ================================================================
   TOOLTIP
================================================================ */

const tooltipStyle = {
  borderRadius: "10px",
  border: `1px solid ${AT.line}`,
  background: AT.card,
  boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
};

/* ================================================================
   ANALYTICS
================================================================ */

export default function Analytics() {
  return (
    <div
      className="
        w-full
        min-w-0
        space-y-4
        overflow-x-hidden
        sm:space-y-5
      "
    >
      {/* ==========================================================
          ENROLLMENT + REVENUE
      ========================================================== */}

      <div
        className="
          grid
          min-w-0
          grid-cols-1
          gap-4
          lg:grid-cols-2
        "
      >
        {/* --------------------------------------------------------
            ENROLLMENT TREND
        -------------------------------------------------------- */}

        <Card title="Enrollment trend">
          <div
            className="
              w-full
              min-w-0
              p-3
              pt-2
              sm:p-5
              sm:pt-3
            "
          >
            <div
              className="
                h-[190px]
                w-full
                min-w-0
                sm:h-[220px]
              "
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <AreaChart
                  data={enrollTrend}
                  margin={{
                    top: 5,
                    right: 5,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <defs>
                    <linearGradient
                      id="gA"
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
                    tickMargin={8}
                  />

                  <YAxis hide />

                  <Tooltip
                    contentStyle={tooltipStyle}
                  />

                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={AT.accentDeep}
                    fill="url(#gA)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* --------------------------------------------------------
            REVENUE
        -------------------------------------------------------- */}

        <Card title="Revenue (₹ Lakh)">
          <div
            className="
              w-full
              min-w-0
              p-3
              pt-2
              sm:p-5
              sm:pt-3
            "
          >
            <div
              className="
                h-[190px]
                w-full
                min-w-0
                sm:h-[220px]
              "
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={revenueTrend}
                  margin={{
                    top: 5,
                    right: 5,
                    left: 0,
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
                    tickMargin={8}
                  />

                  <YAxis hide />

                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      `₹${value} L`,
                      "Revenue",
                    ]}
                  />

                  <Bar
                    dataKey="v"
                    fill={AT.chrome}
                    radius={[
                      4,
                      4,
                      0,
                      0,
                    ]}
                    maxBarSize={38}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>

      {/* ==========================================================
          TOP COURSES + DEPARTMENT
      ========================================================== */}

      <div
        className="
          grid
          min-w-0
          grid-cols-1
          gap-4
          lg:grid-cols-2
        "
      >
        {/* --------------------------------------------------------
            TOP COURSES
        -------------------------------------------------------- */}

        <Card title="Top courses by enrollment">
          <div
            className="
              w-full
              min-w-0
              p-3
              pt-2
              sm:p-5
              sm:pt-3
            "
          >
            <div
              className="
                h-[230px]
                w-full
                min-w-0
                sm:h-[220px]
              "
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={topCourses}
                  layout="vertical"
                  margin={{
                    top: 5,
                    right: 8,
                    left: 0,
                    bottom: 5,
                  }}
                >
                  <XAxis
                    type="number"
                    hide
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={95}
                    tick={{
                      fontSize: 9,
                      fill: AT.sub,
                    }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => {
                      if (
                        value.length <= 14
                      ) {
                        return value;
                      }

                      return (
                        value.slice(0, 13) +
                        "…"
                      );
                    }}
                  />

                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [
                      value,
                      "Students",
                    ]}
                  />

                  <Bar
                    dataKey="students"
                    fill={AT.accentDeep}
                    radius={[
                      0,
                      4,
                      4,
                      0,
                    ]}
                    maxBarSize={28}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* --------------------------------------------------------
            STUDENTS BY DEPARTMENT
        -------------------------------------------------------- */}

        <Card title="Students by department">
          <div
            className="
              w-full
              min-w-0
              p-3
              pt-2
              sm:p-5
              sm:pt-3
            "
          >
            <div
              className="
                h-[230px]
                w-full
                min-w-0
                sm:h-[220px]
              "
            >
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <PieChart>
                  <Pie
                    data={deptSplit}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="45%"
                    outerRadius="68%"
                    paddingAngle={2}
                  >
                    {deptSplit.map(
                      (_, i) => (
                        <Cell
                          key={i}
                          fill={
                            pieColors[
                              i %
                                pieColors.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Legend
                    verticalAlign="bottom"
                    height={32}
                    wrapperStyle={{
                      fontSize: "11px",
                    }}
                  />

                  <Tooltip
                    contentStyle={
                      tooltipStyle
                    }
                    formatter={(value) => [
                      `${value}%`,
                      "Students",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}