import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { AT, Card } from "./AdminUI.jsx";

const enrollTrend = [
  { m: "Mar", v: 210 }, { m: "Apr", v: 260 }, { m: "May", v: 240 },
  { m: "Jun", v: 310 }, { m: "Jul", v: 380 }, { m: "Aug", v: 420 },
];
const revenueTrend = [
  { m: "Mar", v: 4.1 }, { m: "Apr", v: 3.8 }, { m: "May", v: 5.2 },
  { m: "Jun", v: 6.0 }, { m: "Jul", v: 5.4 }, { m: "Aug", v: 6.8 },
];
const topCourses = [
  { name: "Data Structures & Algorithms", students: 128 },
  { name: "Operating Systems", students: 102 },
  { name: "Digital Signal Processing", students: 76 },
  { name: "Principles of Marketing", students: 54 },
];
const deptSplit = [
  { name: "CSE", value: 44 },
  { name: "ECE", value: 22 },
  { name: "BBA", value: 18 },
  { name: "M.Sc IT", value: 16 },
];
const pieColors = [AT.accentDeep, AT.accent, "#94A3B8", "#CBD5E1"];

export default function Analytics() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Enrollment trend">
          <div className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={enrollTrend}>
                <defs>
                  <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={AT.accent} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={AT.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="m" tick={{ fontSize: 12, fill: AT.sub }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip />
                <Area type="monotone" dataKey="v" stroke={AT.accentDeep} fill="url(#gA)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Revenue (₹ Lakh)">
          <div className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={220}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Top courses by enrollment">
          <div className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topCourses} layout="vertical" margin={{ left: 24 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={160}
                  tick={{ fontSize: 11, fill: AT.sub }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar dataKey="students" fill={AT.accentDeep} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Students by department">
          <div className="p-5 pt-3">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={deptSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                  {deptSplit.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}