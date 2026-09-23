import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { getMyCourses } from "../services/CourseService";

export default function OfflineEnrollments() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [query, setQuery] = useState("");
  const [students, setStudents] = useState([]);
  const [student, setStudent] = useState(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === courseId),
    [courses, courseId]
  );

  useEffect(() => {
    getMyCourses()
      .then((rows) => setCourses(rows.filter((course) => course.status === "published")))
      .catch((reason) => setError(reason.message || "Unable to load your courses."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!courseId || query.trim().length < 1 || student) {
      setStudents([]);
      return;
    }

    const timeout = setTimeout(async () => {
      const { data, error: searchError } = await supabase.rpc("lms_search_course_students", {
        p_course: courseId,
        p_search: query.trim(),
      });
      if (searchError) setError(searchError.message);
      else setStudents(data || []);
    }, 180);

    return () => clearTimeout(timeout);
  }, [courseId, query, student]);

  function chooseCourse(event) {
    const nextCourseId = event.target.value;
    const course = courses.find((item) => item.id === nextCourseId);
    setCourseId(nextCourseId);
    setStudent(null);
    setQuery("");
    setStudents([]);
    setAmount(course ? String(course.discountPrice || course.originalPrice || "") : "");
  }

  async function grantAccess(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    const email = (student?.email || query).trim().toLowerCase();
    if (!courseId || !email || !/^\S+@\S+\.\S+$/.test(email) || !Number(amount)) {
      setError("Select a course, enter a valid student email, and enter the offline amount received.");
      return;
    }

    setSaving(true);
    const { data, error: grantError } = await supabase.rpc("lms_grant_offline_enrollment_by_email", {
      p_course: courseId,
      p_email: email,
      p_amount: Math.round(Number(amount)),
    });
    setSaving(false);

    if (grantError) {
      setError(grantError.message || "Unable to grant course access.");
      return;
    }

    setMessage(
      data?.status === "pending"
        ? `Admission saved for ${email}. The course will appear automatically when this email creates a student account.`
        : `${student?.name || email} now has access to ${selectedCourse?.title || "the course"}.`
    );
    setStudent(null);
    setQuery("");
    setStudents([]);
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6">
        <p className="text-sm text-violet-600">OFFLINE ADMISSIONS</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">Grant course access</h1>
        <p className="mt-2 text-sm text-slate-500">Record an offline fee using any email. Existing students receive access now; new emails receive the course automatically when they register.</p>
      </div>

      <form onSubmit={grantAccess} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {message && <p className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</p>}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">Course
            <select value={courseId} onChange={chooseCourse} disabled={loading} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-violet-500">
              <option value="">Select your published course</option>
              {courses.map((course) => <option key={course.id} value={course.id}>{course.title || course.name}</option>)}
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">Offline amount received (₹)
            <input type="number" min="1" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="e.g. 5000" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-violet-500" />
          </label>
        </div>

        <div className="relative mt-5">
          <label className="text-sm font-medium text-slate-700">Student email</label>
          <div className="relative mt-2">
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
            <input type="email" value={student?.email || query} disabled={!courseId || Boolean(student)} onChange={(event) => setQuery(event.target.value)} placeholder={courseId ? "Type an existing or new student email" : "Choose a course first"} className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50" />
          </div>
          {student && <button type="button" onClick={() => setStudent(null)} className="mt-2 text-xs font-medium text-violet-600">Choose a different student</button>}
          {!student && students.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{students.map((item) => <button key={item.uid} type="button" onClick={() => { setStudent(item); setStudents([]); }} className="block w-full border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-violet-50"><span className="block text-sm font-medium text-slate-900">{item.name || "Unnamed student"}</span><span className="block text-xs text-slate-500">Existing account · {item.email}</span></button>)}</div>}
          {!student && query.trim() && students.length === 0 && <p className="mt-2 text-xs text-slate-500">New email? Submit it to save the admission. The course will appear after the student registers with this same email.</p>}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button type="submit" disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"><UserPlus className="h-4 w-4" />{saving ? "Granting access..." : "Record offline payment & grant access"}</button>
        </div>
      </form>
    </div>
  );
}
