import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { AlertCircle, CheckSquare, FileSpreadsheet, FileText, Loader2, RefreshCw, Square } from "lucide-react";
import { supabase } from "../lib/supabase";
import { auth } from "../lib/backend";
import logo from "../assets/Images/CA2.png";
import { AT } from "./AdminUI.jsx";

const CATEGORIES = [
  { id: "students", label: "Students" },
  { id: "teachers", label: "Teachers" },
  { id: "courses", label: "Courses" },
  { id: "enrollments_payments", label: "Enrollments and payments" },
  { id: "attendance", label: "Attendance records" },
  { id: "revenue_summary", label: "Revenue summary" },
  { id: "notifications", label: "Notifications and activity" },
];
const PAGE_SIZE = 1000;
const localDayStart = (value) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day).toISOString(); };
const localDayEnd = (value) => { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day + 1).getTime() - 1; };
const isoLocalDayEnd = (value) => new Date(localDayEnd(value)).toISOString();
const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const flatten = (value) => value && typeof value === "object" ? JSON.stringify(value) : value ?? "";
const slug = (value) => String(value || "all").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
const inr = (paise) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(paise || 0) / 100);

function errorText(error) {
  if (typeof error === "string") return error;
  const parts = [error?.message, error?.details, error?.hint, error?.code && `Code: ${error.code}`].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  try { return JSON.stringify(error); } catch { return "Unknown database error."; }
}

function categoryArgs(category, filters) {
  const courseCategories = ["students", "courses", "enrollments_payments", "attendance", "notifications"];
  const teacherCategories = ["students", "courses", "enrollments_payments", "attendance", "notifications"];
  const paymentCategories = ["enrollments_payments"];
  const studentStatusCategories = ["students", "enrollments_payments", "attendance", "notifications"];
  return {
    p_category: category,
    p_course_id: courseCategories.includes(category) ? filters.courseId || null : null,
    p_teacher_id: teacherCategories.includes(category) ? filters.teacherId || null : null,
    p_payment_status: paymentCategories.includes(category) ? filters.paymentStatus || null : null,
    p_student_status: studentStatusCategories.includes(category) ? filters.studentStatus || null : null,
  };
}

function exportArgs(category, filters, bounds) {
  return {
    ...categoryArgs(category, filters),
    p_from: bounds.from,
    p_to: bounds.to,
  };
}

function dateBounds(filters) {
  if (filters.period === "all") return { from: null, to: null };
  if (filters.period === "custom") return { from: filters.from ? localDayStart(filters.from) : null, to: filters.to ? isoLocalDayEnd(filters.to) : null };
  if (filters.period === "monthly") {
    const [year, month] = filters.month.split("-").map(Number);
    const first = dateKey(new Date(year, month - 1, 1));
    const last = dateKey(new Date(year, month, 0));
    return { from: localDayStart(first), to: isoLocalDayEnd(last) };
  }
  if (filters.period === "yearly") return { from: localDayStart(`${filters.year}-01-01`), to: isoLocalDayEnd(`${filters.year}-12-31`) };
  const today = new Date();
  const end = dateKey(today);
  const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (filters.period === "weekly" ? 6 : 0));
  return { from: localDayStart(dateKey(startDate)), to: isoLocalDayEnd(end) };
}

async function readRows(category, filters, bounds) {
  const args = exportArgs(category, filters, bounds);
  const rows = [];
  for (let start = 0; ; start += PAGE_SIZE) {
    const query = supabase.rpc("lms_admin_export_rows", args).range(start, start + PAGE_SIZE - 1);
    const { data, error } = await query;
    if (error) throw error;
    const batch = (data || []).map((row) => row.payload || {});
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}

async function exactCount(category, filters, bounds) {
  if (category === "revenue_summary") return 1;
  const { data, error } = await supabase.rpc("lms_admin_export_count", exportArgs(category, filters, bounds));
  if (error) throw error;
  return Number(data || 0);
}

function formatPeriod(bounds, filters) {
  if (filters.period === "all") return "All time";
  if (bounds.from && bounds.to) return `${new Date(bounds.from).toLocaleDateString()} – ${new Date(bounds.to).toLocaleDateString()}`;
  return "Custom date range";
}

export default function ExportReports() {
  const [selected, setSelected] = useState(["students"]);
  const [filters, setFilters] = useState(() => ({ period: "monthly", month: dateKey(new Date()).slice(0, 7), year: String(new Date().getFullYear()), from: dateKey(new Date()), to: dateKey(new Date()), courseId: "", teacherId: "", paymentStatus: "", studentStatus: "" }));
  const [courses, setCourses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [counts, setCounts] = useState(null);
  const [countLoading, setCountLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");
  const [adminName, setAdminName] = useState(auth.currentUser?.displayName || auth.currentUser?.email || "Administrator");

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      try {
        setOptionsLoading(true);
        const [courseResult, teacherResult, profileResult] = await Promise.all([
          supabase.from("lms_courses").select("id,title").order("title"),
          supabase.from("lms_profiles").select("id,name,email,status").eq("role", "teacher").order("name"),
          supabase.from("lms_profiles").select("name,email").eq("id", auth.currentUser?.uid).maybeSingle(),
        ]);
        if (courseResult.error) throw courseResult.error;
        if (teacherResult.error) throw teacherResult.error;
        if (profileResult.error) throw profileResult.error;
        if (active) {
          setCourses(courseResult.data || []);
          setTeachers(teacherResult.data || []);
          setAdminName(profileResult.data?.name || auth.currentUser?.displayName || profileResult.data?.email || auth.currentUser?.email || "Administrator");
        }
      } catch (err) {
        if (active) setError(err?.message || "Unable to load export filters.");
      } finally { if (active) setOptionsLoading(false); }
    }
    loadOptions();
    return () => { active = false; };
  }, []);

  const selectedCategories = useMemo(() => CATEGORIES.filter((item) => selected.includes(item.id)), [selected]);
  const allSelected = selected.length === CATEGORIES.length;
  const totalCount = counts ? Object.values(counts).reduce((sum, value) => sum + value, 0) : 0;

  function changeFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setCounts(null);
    setError("");
  }

  function toggleAll() { setSelected(allSelected ? [] : CATEGORIES.map((item) => item.id)); setCounts(null); }
  function toggleCategory(id) { setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); setCounts(null); }

  async function previewCounts() {
    if (!selected.length) { setError("Select at least one report category."); return; }
    if (filters.period === "custom" && (!filters.from || !filters.to || filters.from > filters.to)) { setError("Choose a valid custom date range."); return; }
    setCountLoading(true); setError(""); setCounts(null);
    try {
      const bounds = dateBounds(filters);
      const result = [];
      for (const id of selected) {
        try {
          result.push([id, await exactCount(id, filters, bounds)]);
        } catch (err) {
          const label = CATEGORIES.find((item) => item.id === id)?.label || id;
          throw new Error(`${label}: ${errorText(err)}`);
        }
      }
      setCounts(Object.fromEntries(result));
    } catch (err) { setError(errorText(err) || "Unable to count matching records."); }
    finally { setCountLoading(false); }
  }

  async function loadReportData(bounds) {
    const data = {};
    const standardCategories = selected.filter((id) => id !== "revenue_summary");
    const result = await Promise.all(standardCategories.map(async (id) => [id, await readRows(id, filters, bounds)]));
    for (const [id, rows] of result) data[id] = rows;
    const { data: summaryRows, error: summaryError } = await supabase.rpc("lms_admin_export_summary", {
        p_from: bounds.from,
        p_to: bounds.to,
        p_course_id: filters.courseId || null,
        p_teacher_id: filters.teacherId || null,
        p_payment_status: filters.paymentStatus || null,
        p_student_status: filters.studentStatus || null,
    });
    if (summaryError) throw summaryError;
    data.summaryStats = summaryRows?.[0] || null;
    if (selected.includes("revenue_summary")) data.revenue_summary = (summaryRows || []).map((row) => ({ total_students: row.total_students, total_revenue: Number(row.total_revenue || 0) / 100, total_enrollments: row.total_enrollments }));
    return data;
  }

  async function makeCsv() {
    if (!counts) { setError("Preview the record counts before exporting."); return; }
    setExportLoading(true); setError("");
    try {
      const bounds = dateBounds(filters);
      const data = await loadReportData(bounds);
      const allRows = selected.flatMap((id) => (data[id] || []).map((row) => ({ category: CATEGORIES.find((item) => item.id === id)?.label || id, ...row })));
      if (!allRows.length) { setError("No data for this period and filter selection."); return; }
      const headers = [...new Set(allRows.flatMap((row) => Object.keys(row)))];
      const csv = `\uFEFF${[headers.map(csvCell).join(","), ...allRows.map((row) => headers.map((key) => csvCell(flatten(row[key]))).join(","))].join("\r\n")}`;
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename(bounds, selected); anchor.click(); URL.revokeObjectURL(url);
    } catch (err) { setError(err?.message || "Unable to create CSV export."); }
    finally { setExportLoading(false); }
  }

  async function makePdf() {
    if (!counts) { setError("Preview the record counts before exporting."); return; }
    setExportLoading(true); setError("");
    try {
      const bounds = dateBounds(filters);
      const data = await loadReportData(bounds);
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const summary = data.summaryStats;
      const imageData = await toDataUrl(logo).catch(() => null);
      if (imageData) doc.addImage(imageData, "PNG", 14, 10, 14, 14);
      doc.setFontSize(16); doc.setTextColor(24, 35, 50); doc.text("Creative Adhyayan", 32, 16);
      doc.setFontSize(10); doc.setTextColor(90, 100, 115); doc.text("Admin export report", 32, 22);
      doc.setFontSize(9); doc.text(`Generated: ${new Date().toLocaleString()}    Admin: ${adminName}`, 14, 32);
      doc.text(`Period: ${formatPeriod(bounds, filters)}    Categories: ${selectedCategories.map((item) => item.label).join(", ")}`, 14, 38, { maxWidth: 265 });
      const selectedFilters = [filters.courseId && `Course: ${courses.find((course) => course.id === filters.courseId)?.title || "Selected"}`, filters.teacherId && `Teacher: ${teachers.find((teacher) => teacher.id === filters.teacherId)?.name || "Selected"}`, filters.paymentStatus && `Payment: ${filters.paymentStatus}`, filters.studentStatus && `Student status: ${filters.studentStatus}`].filter(Boolean).join(" · ") || "Additional filters: none";
      doc.text(selectedFilters, 14, 43, { maxWidth: 265 });
      doc.setFillColor(244, 246, 248); doc.roundedRect(14, 49, 269, 23, 3, 3, "F");
      doc.setFontSize(9); doc.setTextColor(80, 90, 105);
      doc.text(`STUDENTS  ${summary?.total_students ?? "—"}`, 20, 58);
      doc.text(`REVENUE  ${summary ? inr(summary.total_revenue) : "—"}`, 105, 58);
      doc.text(`ENROLLMENTS  ${summary?.total_enrollments ?? "—"}`, 205, 58);
      let hasTable = false;
      for (const category of selectedCategories) {
        const rows = data[category.id] || [];
        if (!rows.length) continue;
        doc.addPage();
        hasTable = true;
        const columns = Object.keys(rows[0]);
        doc.setFontSize(12); doc.setTextColor(24, 35, 50); doc.text(category.label, 14, 19);
        autoTable(doc, {
          startY: 25,
          head: [columns.map((key) => key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()))],
          body: rows.map((row) => columns.map((key) => String(flatten(row[key]) ?? ""))),
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
          headStyles: { fillColor: [15, 21, 32], textColor: [255, 255, 255] },
          margin: { top: 25, right: 12, bottom: 15, left: 12 },
          showHead: "everyPage",
        });
      }
      if (!hasTable) { doc.setFontSize(11); doc.text("No data for this period and filter selection.", 14, 82); }
      const pages = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pages; page++) {
        doc.setPage(page);
        if (page > 1) {
          if (imageData) doc.addImage(imageData, "PNG", 12, 5, 10, 10);
          doc.setFontSize(8); doc.setTextColor(95); doc.text("Creative Adhyayan · Admin Export Report", 25, 12);
        }
        doc.setFontSize(8); doc.setTextColor(110); doc.text(`Page ${page} of ${pages}`, 283, 202, { align: "right" });
      }
      doc.save(filename(bounds, selected).replace(/\.csv$/, ".pdf"));
    } catch (err) { setError(err?.message || "Unable to create PDF report."); }
    finally { setExportLoading(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header><p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: AT.accentDeep }}>Reporting</p><h1 className="mt-1 text-2xl font-bold" style={{ color: AT.ink }}>Export Reports</h1><p className="mt-1 text-sm" style={{ color: AT.sub }}>Choose the records and filters to generate a PDF or CSV report.</p></header>
      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: AT.line }}>
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="font-semibold" style={{ color: AT.ink }}>Data categories</h2><button type="button" onClick={toggleAll} className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: AT.accentDeep }}>{allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}{allSelected ? "Clear all" : "Select all"}</button></div>
          <div className="grid gap-2 sm:grid-cols-2">{CATEGORIES.map((category) => <label key={category.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: selected.includes(category.id) ? AT.accent : AT.line, background: selected.includes(category.id) ? "#F0FDFA" : "white" }}><input type="checkbox" checked={selected.includes(category.id)} onChange={() => toggleCategory(category.id)} className="h-4 w-4 accent-teal-600" />{category.label}{category.id === "notifications" && <span className="ml-auto text-[10px] text-slate-400">available</span>}</label>)}</div>
          <p className="mt-3 text-xs text-slate-500">Notifications/activity is available in this project’s `lms_notifications` table.</p>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: AT.line }}>
          <h2 className="mb-4 font-semibold" style={{ color: AT.ink }}>Time period</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[["today","Today"],["weekly","Weekly · last 7 days"],["monthly","Monthly"],["yearly","Yearly"],["all","All time"],["custom","Custom range"]].map(([value,label]) => <label key={value} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs sm:text-sm ${filters.period===value ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}><input type="radio" name="period" checked={filters.period===value} onChange={() => changeFilter("period",value)} className="accent-teal-600" />{label}</label>)}</div>
          {filters.period === "monthly" && <label className="mt-4 block text-sm">Month<input type="month" value={filters.month} onChange={(event) => changeFilter("month",event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>}
          {filters.period === "yearly" && <label className="mt-4 block text-sm">Year<input type="number" min="2000" max="2100" value={filters.year} onChange={(event) => changeFilter("year",event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label>}
          {filters.period === "custom" && <div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">From<input type="date" value={filters.from} onChange={(event) => changeFilter("from",event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label><label className="text-sm">To<input type="date" value={filters.to} onChange={(event) => changeFilter("to",event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" /></label></div>}
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm sm:p-5" style={{ borderColor: AT.line }}>
        <h2 className="mb-4 font-semibold" style={{ color: AT.ink }}>Additional filters</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm">Course<select value={filters.courseId} onChange={(event) => changeFilter("courseId",event.target.value)} disabled={optionsLoading} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All courses</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title}</option>)}</select></label>
          <label className="text-sm">Teacher<select value={filters.teacherId} onChange={(event) => changeFilter("teacherId",event.target.value)} disabled={optionsLoading} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All teachers</option>{teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name || teacher.email}</option>)}</select></label>
          <label className="text-sm">Payment status<select value={filters.paymentStatus} onChange={(event) => changeFilter("paymentStatus",event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All statuses</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="free">Free</option></select></label>
          <label className="text-sm">Student status<select value={filters.studentStatus} onChange={(event) => changeFilter("studentStatus",event.target.value)} className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"><option value="">All statuses</option><option value="active">Active</option><option value="__non_active__">Non-active</option></select></label>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5" style={{ borderColor: AT.line }}>
        <div aria-live="polite">{countLoading ? <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Counting matching records…</p> : counts ? totalCount === 0 ? <p className="text-sm text-slate-600">No data for this period and filter selection.</p> : <div><p className="text-sm font-semibold text-slate-900">{totalCount.toLocaleString()} records found</p><p className="mt-1 text-xs text-slate-500">{selectedCategories.map((category) => `${category.label}: ${(counts[category.id] || 0).toLocaleString()}`).join(" · ")}</p></div> : <p className="text-sm text-slate-500">Preview record counts before downloading.</p>}</div>
        <div className="flex flex-col gap-2 sm:flex-row"> <button type="button" onClick={previewCounts} disabled={countLoading || exportLoading || optionsLoading} className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ borderColor: AT.line, color: AT.ink }}><RefreshCw className={`h-4 w-4 ${countLoading ? "animate-spin" : ""}`} />Preview records</button><button type="button" onClick={makePdf} disabled={!counts || totalCount === 0 || exportLoading || countLoading} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: AT.chrome }}><FileText className="h-4 w-4" />{exportLoading ? "Preparing…" : "Download PDF"}</button><button type="button" onClick={makeCsv} disabled={!counts || totalCount === 0 || exportLoading || countLoading} className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50" style={{ background: AT.accentDeep }}><FileSpreadsheet className="h-4 w-4" />Download CSV</button></div>
      </section>
      {optionsLoading && <p className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Loading course and teacher filters…</p>}
    </div>
  );
}

function filename(bounds, selected) {
  const from = bounds.from ? dateKey(new Date(bounds.from)) : "all-time";
  const to = bounds.to ? dateKey(new Date(bounds.to)) : "all-time";
  const category = selected.map((id) => slug(CATEGORIES.find((item) => item.id === id)?.label || id)).join("-") || "none";
  return `CreativeAdhyayan_Report_${category}_${from}_${to}.csv`;
}

async function toDataUrl(source) {
  const response = await fetch(source);
  if (!response.ok) throw new Error("Unable to load institution logo.");
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
