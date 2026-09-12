import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

const TeacherDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeSection, setActiveSection] = useState("overview");

  const menuItems = [
    {
      id: "overview",
      label: "Overview",
      icon: LayoutDashboard,
    },
    {
      id: "courses",
      label: "My Courses",
      icon: BookOpen,
    },
    {
      id: "attendance",
      label: "Attendance",
      icon: ClipboardCheck,
    },
  ];

  const handleMenuClick = (id) => {
    setActiveSection(id);

    if (id === "courses") {
      navigate("/teacher/courses");
      return;
    }

    if (id === "attendance") {
      navigate("/teacher/attendance");
      return;
    }

    navigate("/teacher");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-violet-600">
                Teacher Panel
              </p>

              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                Teacher Dashboard
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Manage your courses and monitor your students.
              </p>
            </div>

            <button
              type="button"
              onClick={() => navigate("/teacher/courses/create")}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700"
            >
              <PlusCircle size={18} />
              Create Course
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================
          CONTENT
      ===================================================== */}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">

          {/* =================================================
              SIDEBAR
          ================================================= */}

          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3">
            <nav className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleMenuClick(item.id)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                      isActive
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={19} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* =================================================
              MAIN
          ================================================= */}

          <main>
            {activeSection === "overview" && (
              <div className="space-y-6">

                {/* Welcome */}

                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <p className="text-sm font-medium text-violet-600">
                    Welcome back
                  </p>

                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Manage your teaching workspace
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                    Create and manage your courses, organize lessons, and
                    monitor student attendance from one place.
                  </p>
                </div>

                {/* Quick Actions */}

                <div className="grid gap-4 md:grid-cols-2">

                  {/* Courses */}

                  <button
                    type="button"
                    onClick={() => navigate("/teacher/courses")}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-violet-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <BookOpen size={21} />
                      </div>

                      <ArrowRight
                        size={18}
                        className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600"
                      />
                    </div>

                    <h3 className="mt-5 font-semibold text-slate-900">
                      My Courses
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      View, edit and manage the courses you own.
                    </p>
                  </button>

                  {/* Attendance */}

                  <button
                    type="button"
                    onClick={() => navigate("/teacher/attendance")}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-left transition hover:border-violet-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                        <ClipboardCheck size={21} />
                      </div>

                      <ArrowRight
                        size={18}
                        className="text-slate-400 transition group-hover:translate-x-1 group-hover:text-violet-600"
                      />
                    </div>

                    <h3 className="mt-5 font-semibold text-slate-900">
                      Attendance
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      View attendance records for students enrolled in your
                      courses.
                    </p>
                  </button>

                </div>

                {/* Create Course */}

                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        Want to add another course?
                      </h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Create a short course or long/live course and submit
                        it for approval.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        navigate("/teacher/courses/create")
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <PlusCircle size={18} />
                      Add Course
                    </button>
                  </div>
                </div>

              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;