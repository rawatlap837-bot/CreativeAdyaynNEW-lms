import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  PlusCircle,
  LogOut,
  Menu,
  X,
  ChevronRight,
  UserCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/Firebase";
import CA2Logo from "../assets/Images/CA2.png";

const TeacherLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(undefined);

  // =====================================================
  // AUTH
  // =====================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // =====================================================
  // NAVIGATION
  // =====================================================

  const navigation = [
    {
      name: "Dashboard",
      path: "/teacher",
      icon: LayoutDashboard,
      end: true,
    },
    {
      name: "My Courses",
      path: "/teacher/courses",
      icon: BookOpen,
    },
    {
      name: "Attendance",
      path: "/teacher/attendance",
      icon: ClipboardCheck,
    },
  ];

  // =====================================================
  // PAGE TITLE
  // =====================================================

  const getPageTitle = () => {
    if (location.pathname === "/teacher") {
      return "Dashboard";
    }

    if (location.pathname === "/teacher/courses") {
      return "My Courses";
    }

    if (location.pathname.includes("/teacher/courses/create")) {
      return "Create Course";
    }

    if (location.pathname.includes("/teacher/courses/edit")) {
      return "Edit Course";
    }

    if (location.pathname.includes("/teacher/courses/")) {
      return "Course Content";
    }

    if (location.pathname === "/teacher/attendance") {
      return "Attendance";
    }

    return "Teacher Panel";
  };

  // =====================================================
  // LOGOUT
  // =====================================================

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Teacher logout error:", error);
    }
  };

  // =====================================================
  // CLOSE MOBILE SIDEBAR
  // =====================================================

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">

      {/* =====================================================
          MOBILE HEADER
      ===================================================== */}

      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white lg:hidden">

        <div className="flex w-full items-center px-4">

          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <div className="ml-3 flex min-w-0 items-center gap-2.5">

            {/* CA LOGO */}
            <img
              src={CA2Logo}
              alt="Creative Adhyayan"
              className="h-10 w-10 shrink-0 rounded-xl object-contain"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-none text-slate-900">
                Creative Adhyayan
              </p>

              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                Teacher Panel
              </p>
            </div>

          </div>

        </div>

      </header>

      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={closeSidebar}
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={`
          fixed inset-y-0 left-0 z-50
          flex w-[260px] flex-col
          border-r border-slate-200
          bg-white
          transition-transform duration-300
          lg:translate-x-0
          ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }
        `}
      >

        {/* =====================================================
            BRAND
        ===================================================== */}

        <div className="flex h-[82px] items-center border-b border-slate-200 px-5">

          <div className="flex min-w-0 items-center gap-3">

            {/* CA LOGO */}

            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-50 p-1.5 ring-1 ring-violet-100">
              <img
                src={CA2Logo}
                alt="Creative Adhyayan"
                className="h-full w-full object-contain"
              />
            </div>

            {/* BRAND TEXT */}

            <div className="min-w-0">

              <h1 className="truncate text-sm font-bold text-slate-900">
                Creative Adhyayan
              </h1>

              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-violet-600">
                Teacher Panel
              </p>

            </div>

          </div>

          {/* MOBILE CLOSE */}

          <button
            type="button"
            onClick={closeSidebar}
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>

        </div>

        {/* =====================================================
            NAVIGATION
        ===================================================== */}

        <nav className="flex-1 overflow-y-auto px-3 py-6">

          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
            Teaching
          </p>

          <div className="space-y-1">

            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.end}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `
                    group relative flex items-center gap-3
                    rounded-xl px-3 py-2.5
                    text-sm font-medium
                    transition-all duration-200
                    ${
                      isActive
                        ? "bg-violet-50 text-violet-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }
                    `
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Active indicator */}

                      {isActive && (
                        <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-violet-600" />
                      )}

                      {/* Icon */}

                      <span
                        className={`
                          flex h-9 w-9 shrink-0 items-center justify-center rounded-lg
                          transition
                          ${
                            isActive
                              ? "bg-white text-violet-600 shadow-sm"
                              : "text-slate-500 group-hover:bg-white group-hover:text-slate-700"
                          }
                        `}
                      >
                        <Icon
                          size={18}
                          strokeWidth={isActive ? 2.25 : 1.85}
                        />
                      </span>

                      {/* Label */}

                      <span className="flex-1">
                        {item.name}
                      </span>

                      {/* Arrow */}

                      {isActive && (
                        <ChevronRight
                          size={15}
                          className="text-violet-500"
                        />
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}

          </div>

          {/* =====================================================
              COURSE MANAGEMENT
          ===================================================== */}

          <div className="mt-8">

            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Course Management
            </p>

            <NavLink
              to="/teacher/courses/create"
              onClick={closeSidebar}
              className={({ isActive }) =>
                `
                group flex items-center gap-3
                rounded-xl border px-3 py-3
                transition-all duration-200
                ${
                  isActive
                    ? "border-violet-200 bg-violet-50"
                    : "border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50"
                }
                `
              }
            >

              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm transition group-hover:bg-violet-700">
                <PlusCircle size={18} />
              </span>

              <div className="min-w-0 flex-1">

                <p className="text-sm font-semibold text-slate-800">
                  Create Course
                </p>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  Add a new course
                </p>

              </div>

              <ChevronRight
                size={16}
                className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600"
              />

            </NavLink>

          </div>

        </nav>

        {/* =====================================================
            ACCOUNT
        ===================================================== */}

        <div className="border-t border-slate-200 p-3">

          {/* Teacher profile */}

          <div className="mb-2 flex items-center gap-3 rounded-xl bg-slate-50 p-3">

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <UserCircle size={19} />
            </div>

            <div className="min-w-0">

              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Account
              </p>

              <p className="mt-0.5 truncate text-sm font-semibold text-slate-700">
                {user?.displayName || "Teacher"}
              </p>

              {user?.email && (
                <p className="mt-0.5 truncate text-[11px] text-slate-400">
                  {user.email}
                </p>
              )}

            </div>

          </div>

          {/* Logout */}

          <button
            type="button"
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >

            <span className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition group-hover:bg-white group-hover:text-red-500">
              <LogOut size={18} />
            </span>

            <span>
              Logout
            </span>

          </button>

        </div>

      </aside>

      {/* =====================================================
          MAIN CONTENT
      ===================================================== */}

      <div className="min-h-screen lg:pl-[260px]">

        {/* =====================================================
            DESKTOP TOP HEADER
        ===================================================== */}

        <header className="sticky top-0 z-30 hidden h-[76px] items-center justify-between border-b border-slate-200 bg-white/95 px-8 backdrop-blur lg:flex">

          <div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
              Teacher Panel
            </p>

            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {getPageTitle()}
            </h2>

          </div>

          {/* Teacher identity */}

          <div className="flex items-center gap-3">

            <div className="hidden text-right xl:block">

              <p className="text-sm font-semibold text-slate-700">
                {user?.displayName || "Teacher"}
              </p>

              <p className="text-xs text-slate-400">
                Instructor
              </p>

            </div>

            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <UserCircle size={21} />
            </div>

          </div>

        </header>

        {/* Mobile spacing */}

        <div className="h-16 lg:hidden" />

        {/* =====================================================
            ROUTED PAGE
        ===================================================== */}

        <main className="min-h-[calc(100vh-76px)] px-4 py-6 sm:px-6 lg:px-8">

          <Outlet />

        </main>

      </div>

    </div>
  );
};

export default TeacherLayout;