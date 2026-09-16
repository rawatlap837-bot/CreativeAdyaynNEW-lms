import { useEffect, useMemo, useRef, useState } from "react";
import CALogo from "../assets/Images/CA.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../firebase/Firebase";
import { COURSE_TYPES, usePublishedCourses } from "../services/CourseService";
import {
  Menu,
  X,
  ChevronDown,
  Megaphone,
  Code2,
  Palette,
  Cpu,
  Layers,
  Calculator,
  BookOpen,
  ArrowRight,
  LayoutDashboard,
  UserCircle,
  LogOut,
} from "lucide-react";

// Icons for the categories we expect. A category a teacher types that
// isn't in this list still shows up in the dropdown — it just falls
// back to a generic icon instead of breaking the menu.
const CATEGORY_ICONS = {
  "Digital Marketing": Megaphone,
  "Web Development": Code2,
  "UI/UX Design": Palette,
  "Software Development": Cpu,
  "Multimedia": Layers,
  "E-Accounting": Calculator,
};

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || BookOpen;
}

// Static links that are always shown, regardless of what courses exist.
const HOME_LINK = { label: "Home", href: "/" };
const STATIC_LINKS = [
  { label: "Short Courses", href: "/ShortCourses" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

// Builds the link for a course-category item: lands on the homepage,
// preselects that category tab in <LiveCourses />, and scrolls to it.
function categoryHref(category) {
  return `/?category=${encodeURIComponent(category)}#live-courses`;
}

/* ------------------------------------------------------------------
   Neumorphic tokens — soft off-white canvas, dual-tone shadows.
   Same canvas color used everywhere so raised/pressed shadows read
   correctly (neumorphism relies on background === shadow base).
------------------------------------------------------------------- */
const CANVAS = "#ECEEF3";
const LIGHT = "#ffffff";
const DARK = "#c7cbd9";

const raised = (radius = 9999) => ({
  background: CANVAS,
  borderRadius: radius,
  boxShadow: `6px 6px 14px ${DARK}, -6px -6px 14px ${LIGHT}`,
});

const raisedSm = (radius = 9999) => ({
  background: CANVAS,
  borderRadius: radius,
  boxShadow: `3px 3px 8px ${DARK}, -3px -3px 8px ${LIGHT}`,
});

const pressed = (radius = 9999) => ({
  background: CANVAS,
  borderRadius: radius,
  boxShadow: `inset 3px 3px 6px ${DARK}, inset -3px -3px 6px ${LIGHT}`,
});

// Where the "Enroll now" CTA sends people — same registration screen as
// the "Create an account" link on the login form, so both entry points
// land in one place.
const REGISTER_ROUTE = "/register";

function initialsFrom(name, email) {
  const source = (name || email || "?").trim();
  if (!source) return "?";
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [coursesOpen, setCoursesOpen] = useState(false);
  const [mobileCoursesOpen, setMobileCoursesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [coursesHover, setCoursesHover] = useState(false);
  const [hoveredLink, setHoveredLink] = useState(null);
  // undefined = still resolving Firebase's auth state (avoids a Login-button
  // flash for users who are actually signed in); null = signed out.
  const [user, setUser] = useState(undefined);
  const navigate = useNavigate();
  const location = useLocation();
  const coursesRef = useRef(null);
  const accountRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const mobileToggleRef = useRef(null);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Logo + "Home" both use this. If we're already on the homepage,
  // clicking either wouldn't otherwise do anything — navigating to the
  // same route doesn't remount the page or move the scroll position — so
  // this scrolls to the hero manually. If a category link left ?/#
  // params in the URL, this also clears them back to a bare "/".
  // Coming from a different page, normal navigation runs and Hero's own
  // mount effect puts it at the top.
  const handleHomeClick = (event) => {
    setMobileOpen(false);

    if (location.pathname === "/") {
      event.preventDefault();

      if (location.search || location.hash) {
        navigate("/", { replace: true });
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  // Same source of truth as the homepage's course tabs: only categories
  // that have at least one published course show up here. If a category
  // has zero courses, it simply never appears — no empty tabs.
  const { courses: liveCourses } = usePublishedCourses(COURSE_TYPES.LONG);

  const courseCategories = useMemo(() => {
    const unique = new Set();
    liveCourses.forEach((course) => {
      const category = course.category?.trim();
      if (category) unique.add(category);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [liveCourses]);

  const NAV_LINKS = useMemo(() => {
    const links = [HOME_LINK];

    // Only render the "Courses" dropdown at all once there's something
    // to put in it.
    if (courseCategories.length > 0) {
      links.push({
        label: "Courses",
        dropdown: courseCategories.map((category) => ({
          label: category,
          icon: getCategoryIcon(category),
          category,
        })),
      });
    }

    return [...links, ...STATIC_LINKS];
  }, [courseCategories]);

  const isLoggedIn = Boolean(user);

  const handleLogout = async () => {
    setAccountOpen(false);
    setMobileOpen(false);
    try {
      await signOut(auth);
      navigate("/login");
    } catch {
      // best-effort — the auth-state listener will still catch up
    }
  };

  useEffect(() => {
    function handleClick(e) {
      if (coursesRef.current && !coursesRef.current.contains(e.target)) {
        setCoursesOpen(false);
      }
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setAccountOpen(false);
      }
    }
    function handleKey(e) {
      if (e.key === "Escape") {
        setCoursesOpen(false);
        setMobileOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handleChange = (e) => {
      if (e.matches) setMobileOpen(false);
    };
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  // The mobile menu panel is always mounted (for the open/close transition)
  // and gets aria-hidden when closed. If a link inside it still has
  // keyboard focus at that moment — e.g. the user tabbed to it, or clicked
  // it and this fires before navigation steals focus — browsers correctly
  // flag "aria-hidden element contains focus" as invalid. Move focus back
  // to the toggle button first so the container is genuinely inert.
  useEffect(() => {
    if (!mobileOpen && mobileMenuRef.current?.contains(document.activeElement)) {
      document.activeElement.blur();
      mobileToggleRef.current?.focus();
    }
  }, [mobileOpen]);

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4 sm:px-6">
      <div
        className="relative z-50 mx-auto flex max-w-6xl items-center justify-between px-6 py-2 sm:px-8"
        style={{ background: CANVAS, borderRadius: 9999 }}
      >
        {/* logo */}
        <Link to="/" onClick={handleHomeClick} className="flex shrink-0 items-center gap-2">
          <img
            src={CALogo}
            alt="Creative Adyayan logo"
            className="h-8 w-auto"
          />
        </Link>

        {/* desktop nav */}
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) =>
            link.dropdown ? (
              <div key={link.label} ref={coursesRef} className="relative">
                <button
                  type="button"
                  onClick={() => setCoursesOpen((o) => !o)}
                  onMouseEnter={() => setCoursesHover(true)}
                  onMouseLeave={() => setCoursesHover(false)}
                  aria-expanded={coursesOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-1 px-4 py-2 text-lg font-bold text-slate-700 transition-all hover:text-[#1B0E3D]"
                  style={coursesOpen || coursesHover ? pressed(9999) : {}}
                >
                  {link.label}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${coursesOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>

                {coursesOpen && (
                  <div className="absolute left-1/2 top-full w-72 -translate-x-1/2 pt-3">
                    <div className="grid grid-cols-2 gap-2 p-3" style={{ background: CANVAS, borderRadius: 28 }}>
                      {link.dropdown.map(({ label, icon: Icon, category }) => (
                        <Link
                          key={label}
                          to={categoryHref(category)}
                          onClick={() => setCoursesOpen(false)}
                          onMouseEnter={() => setHoveredLink(label)}
                          onMouseLeave={() => setHoveredLink(null)}
                          className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 transition-all hover:text-[#1B0E3D]"
                          style={hoveredLink === label ? pressed(16) : { borderRadius: 16 }}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-[#5227FF]" strokeWidth={1.75} />
                          {label}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.label}
                to={link.href}
                onClick={link.href === "/" ? handleHomeClick : undefined}
                onMouseEnter={() => setHoveredLink(link.label)}
                onMouseLeave={() => setHoveredLink(null)}
                className="px-4 py-2 text-lg font-bold text-slate-700 transition-all hover:text-[#1B0E3D]"
                style={hoveredLink === link.label ? pressed(9999) : {}}
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* desktop actions */}
        <div className="hidden items-center gap-3 lg:flex">
          {isLoggedIn ? (
            <div ref={accountRef} className="relative">
              <button
                type="button"
                onClick={() => setAccountOpen((o) => !o)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 py-1 pl-1 pr-3 transition-all"
                style={accountOpen ? pressed(9999) : {}}
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: "linear-gradient(135deg, #5227FF, #8B5CF6)" }}
                >
                  {initialsFrom(user?.displayName, user?.email)}
                </span>
                <span className="max-w-[120px] truncate text-sm font-semibold text-[#1B0E3D]">
                  {user?.displayName?.split(" ")[0] || "Account"}
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-[#1B0E3D] transition-transform duration-200 ${accountOpen ? "rotate-180" : ""}`} />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-3 w-56 overflow-hidden p-1.5"
                  style={{ background: CANVAS, borderRadius: 24 }}
                >
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-[#1B0E3D]">{user?.displayName || "Student"}</p>
                    <p className="truncate text-xs text-slate-500">{user?.email || ""}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      navigate("/dashboard");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-[#1B0E3D] transition-all hover:bg-white/60"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      navigate("/dashboard/profile");
                    }}
                    className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-[#1B0E3D] transition-all hover:bg-white/60"
                  >
                    <UserCircle className="h-4 w-4" />
                    Profile
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition-all hover:bg-white/60"
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("/login")}
                onMouseEnter={(e) => Object.assign(e.currentTarget.style, pressed(9999))}
                onMouseLeave={(e) => Object.assign(e.currentTarget.style, { boxShadow: "none" })}
                className="rounded-full px-6 py-3 text-base font-bold text-[#1B0E3D] transition-colors"
              >
                Log in
              </button>

              <button
                type="button"
                onClick={() => navigate(REGISTER_ROUTE)}
                onMouseEnter={(e) =>
                  Object.assign(e.currentTarget.style, {
                    boxShadow: `inset 4px 4px 8px rgba(0,0,0,0.45), inset -4px -4px 8px rgba(255,255,255,0.06)`,
                  })
                }
                onMouseLeave={(e) =>
                  Object.assign(e.currentTarget.style, {
                    boxShadow: `4px 4px 10px ${DARK}, -4px -4px 10px ${LIGHT}`,
                  })
                }
                className="flex items-center gap-2 px-7 py-3.5 text-base font-semibold text-white transition-shadow"
                style={{
                  borderRadius: 9999,
                  background: "linear-gradient(155deg, #2C1A5E, #1B0E3D)",
                  boxShadow: `4px 4px 10px ${DARK}, -4px -4px 10px ${LIGHT}`,
                }}
              >
                Enroll now
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* mobile toggle */}
        <button
          ref={mobileToggleRef}
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center text-[#1B0E3D] transition-all lg:hidden"
          style={mobileOpen ? pressed(9999) : {}}
        >
          <span className="relative flex h-4 w-5 flex-col items-center justify-between">
            <span
              className={`h-0.5 w-full rounded-full bg-current transition-all duration-300 ease-in-out ${mobileOpen ? "translate-y-[7px] rotate-45" : ""
                }`}
            />
            <span
              className={`h-0.5 w-full rounded-full bg-current transition-all duration-300 ease-in-out ${mobileOpen ? "opacity-0" : "opacity-100"
                }`}
            />
            <span
              className={`h-0.5 w-full rounded-full bg-current transition-all duration-300 ease-in-out ${mobileOpen ? "-translate-y-[7px] -rotate-45" : ""
                }`}
            />
          </span>
        </button>
      </div>

      {/* mobile menu — always mounted, animated open/close */}
      <div
        ref={mobileMenuRef}
        aria-hidden={!mobileOpen}
        className={`fixed inset-0 z-40 lg:hidden transition-opacity duration-300 ease-in-out ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        style={{ background: CANVAS }}
      >
        <div
          className={`h-full overflow-y-auto px-6 pb-10 pt-28 transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-y-0" : "-translate-y-4"
            }`}
        >
          <nav className="mx-auto flex max-w-md flex-col gap-3">
            {NAV_LINKS.map((link) =>
              link.dropdown ? (
                <div key={link.label} className="flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={() => setMobileCoursesOpen((o) => !o)}
                    aria-expanded={mobileCoursesOpen}
                    className="flex items-center gap-1.5 px-5 py-2.5 text-base font-bold text-slate-700 transition-all hover:text-[#1B0E3D]"
                    style={mobileCoursesOpen ? pressed(20) : raisedSm(20)}
                  >
                    {link.label}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${mobileCoursesOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {mobileCoursesOpen && (
                    <div className="grid grid-cols-2 gap-2 p-3" style={pressed(20)}>
                      {link.dropdown.map(({ label, icon: Icon, category }) => (
                        <Link
                          key={label}
                          to={categoryHref(category)}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700"
                          style={raisedSm(14)}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-[#5227FF]" strokeWidth={1.75} />
                          {label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.label}
                  to={link.href}
                  onClick={
                    link.href === "/"
                      ? handleHomeClick
                      : () => setMobileOpen(false)
                  }
                  className="px-4 py-3.5 text-base font-bold text-slate-700"
                  style={raisedSm(20)}
                >
                  {link.label}
                </Link>
              )
            )}

            <div className="mt-6 flex flex-col gap-3">
              {isLoggedIn ? (
                <>
                  <div className="flex items-center gap-3 px-4 py-3" style={raisedSm(20)}>
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #5227FF, #8B5CF6)" }}
                    >
                      {initialsFrom(user?.displayName, user?.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#1B0E3D]">{user?.displayName || "Student"}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email || ""}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate("/dashboard");
                    }}
                    onMouseEnter={(e) =>
                      Object.assign(e.currentTarget.style, {
                        boxShadow: `inset 4px 4px 8px rgba(0,0,0,0.45), inset -4px -4px 8px rgba(255,255,255,0.06)`,
                      })
                    }
                    onMouseLeave={(e) =>
                      Object.assign(e.currentTarget.style, {
                        boxShadow: `4px 4px 10px ${DARK}, -4px -4px 10px ${LIGHT}`,
                      })
                    }
                    className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-white transition-shadow"
                    style={{
                      borderRadius: 9999,
                      background: "linear-gradient(155deg, #2C1A5E, #1B0E3D)",
                      boxShadow: `4px 4px 10px ${DARK}, -4px -4px 10px ${LIGHT}`,
                    }}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate("/dashboard/profile");
                    }}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-[#1B0E3D]"
                    style={raisedSm(9999)}
                  >
                    <UserCircle className="h-4 w-4" />
                    Profile
                  </button>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium text-red-600"
                    style={raisedSm(9999)}
                  >
                    <LogOut className="h-4 w-4" />
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate("/login");
                    }}
                    className="px-4 py-3 text-sm font-bold text-[#1B0E3D]"
                    style={pressed(9999)}
                  >
                    Log in
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate(REGISTER_ROUTE);
                    }}
                    onMouseEnter={(e) =>
                      Object.assign(e.currentTarget.style, {
                        boxShadow: `inset 4px 4px 8px rgba(0,0,0,0.45), inset -4px -4px 8px rgba(255,255,255,0.06)`,
                      })
                    }
                    onMouseLeave={(e) =>
                      Object.assign(e.currentTarget.style, {
                        boxShadow: `4px 4px 10px ${DARK}, -4px -4px 10px ${LIGHT}`,
                      })
                    }
                    className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-white transition-shadow"
                    style={{
                      borderRadius: 9999,
                      background: "linear-gradient(155deg, #2C1A5E, #1B0E3D)",
                      boxShadow: `4px 4px 10px ${DARK}, -4px -4px 10px ${LIGHT}`,
                    }}
                  >
                    Enroll now
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}