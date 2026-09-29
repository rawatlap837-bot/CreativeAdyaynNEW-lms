import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Users, X } from "lucide-react";
import { toast } from "react-toastify";
import CA2 from "../assets/Images/CA2.png";
import { COURSE_TYPES, usePublishedCourses } from "../services/CourseService";
import { submitToSheet } from "../services/contactSubmission";

const EMPTY_FORM = { name: "", phone: "", email: "", course: "" };

export default function CourseRegistrationModal({ onClose }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState("idle");
  const closeRef = useRef(null);
  const panelRef = useRef(null);
  const { courses: longCourses } = usePublishedCourses(COURSE_TYPES.LONG);
  const { courses: shortCourses } = usePublishedCourses(COURSE_TYPES.SHORT);
  const courseOptions = useMemo(
    () => [...new Set([...longCourses, ...shortCourses].map((course) => course.title?.trim()).filter(Boolean))].sort(),
    [longCourses, shortCourses],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape" && status !== "sending") onClose();
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll("button:not(:disabled), input, select");
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, status]);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus("sending");
    try {
      await submitToSheet({
        type: "contact",
        name: form.name.trim(),
        surname: "",
        phone: form.phone.trim(),
        email: form.email.trim(),
        subject: `Course registration: ${form.course}`,
        message: `Interested in ${form.course}`,
        course: form.course,
      });
      toast.success("Thanks for registering! Our team will contact you soon.");
      setForm(EMPTY_FORM);
      onClose();
    } catch {
      setStatus("error");
      toast.error("Could not send your registration. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#140B2F]/70 sm:px-5 sm:pb-5" onMouseDown={(event) => { if (event.target === event.currentTarget && status !== "sending") onClose(); }}>
      <style>{`
        @keyframes registration-slide-up { from { transform: translateY(100%); opacity: .4; } to { transform: translateY(0); opacity: 1; } }
        @keyframes registration-ring-spin { to { transform: rotate(360deg); } }
        .registration-panel { animation: registration-slide-up .55s cubic-bezier(.2,.8,.2,1) both; }
        .registration-ring { transform-box: view-box; transform-origin: 50% 50%; animation: registration-ring-spin 14s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .registration-panel, .registration-ring { animation: none; } }
      `}</style>
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="registration-title" className="registration-panel max-h-[92dvh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-t-[28px] bg-white shadow-2xl sm:rounded-[28px]">
        <div className="relative bg-gradient-to-br from-violet-50 via-white to-indigo-50 px-5 pb-4 pt-5 sm:px-8">
          <button ref={closeRef} type="button" aria-label="Close registration form" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-slate-600 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><X className="h-5 w-5" /></button>
          <div className="flex flex-row-reverse items-center gap-3 sm:gap-6">
            <div className="relative mt-6 h-24 w-24 shrink-0 sm:h-36 sm:w-36">
              <svg className="registration-ring h-full w-full overflow-visible" viewBox="0 0 160 160" aria-hidden="true">
                <defs><path id="registration-circle" d="M80,80 m-62,0 a62,62 0 1,1 124,0 a62,62 0 1,1 -124,0" /></defs>
                <text fill="#6D3FC0" fontSize="11" fontWeight="700" letterSpacing="2.1"><textPath href="#registration-circle">CREATIVE • LEARN • GROW • CREATIVE ADHYAYAN • </textPath></text>
              </svg>
              <div className="absolute inset-[19%] flex items-center justify-center rounded-full bg-gradient-to-br from-[#5227FF] to-[#3B1E8F] p-1 shadow-lg shadow-violet-500/25 sm:p-2">
                <img src={CA2} alt="Creative Adhyayan" className="w-full object-contain" />
              </div>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.06em] text-violet-700 sm:text-xs"><Users className="h-3 w-3 shrink-0" aria-hidden="true" />1,678 students enrolled</p>
              <h2 id="registration-title" className="mt-2 font-pliant text-[1.35rem] font-bold leading-tight text-[#1B0E3D] sm:text-3xl"><span className="text-[#5227FF]">learn</span> with us</h2>
              <p className="mt-2 text-xs leading-relaxed text-slate-600 sm:text-sm">Find the Right Skills for Your Future and Build a Career You Love.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 px-5 pb-6 pt-4 sm:gap-4 sm:px-8">
          <label className="col-span-1 min-w-0 text-sm font-semibold text-[#1B0E3D]">Name
            <input name="name" autoComplete="name" required value={form.name} onChange={update} placeholder="Your name" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <label className="col-span-1 min-w-0 text-sm font-semibold text-[#1B0E3D]">Phone
            <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={update} placeholder="+91 00000 00000" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <label className="col-span-1 min-w-0 text-sm font-semibold text-[#1B0E3D]">Email
            <input name="email" type="email" autoComplete="email" required value={form.email} onChange={update} placeholder="you@example.com" className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" />
          </label>
          <label className="col-span-1 min-w-0 text-sm font-semibold text-[#1B0E3D]">Course
            <select name="course" required value={form.course} onChange={update} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100">
              <option value="">Select a course</option>
              {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
              <option value="Not sure yet">Not sure yet</option>
            </select>
          </label>
          {status === "error" && <p role="alert" className="col-span-2 text-sm text-red-600">Could not send your registration. Please try again.</p>}
          <button type="submit" disabled={status === "sending"} className="col-span-2 mt-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5227FF] px-5 py-3 font-bold text-white shadow-lg shadow-violet-500/20 hover:bg-[#4320d4] disabled:opacity-60">
            {status === "sending" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {status === "sending" ? "Sending..." : "Register now"}
          </button>
        </form>
      </div>
    </div>
  );
}
