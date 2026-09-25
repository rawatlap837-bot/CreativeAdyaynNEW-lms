import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useParams,
  useLocation,
  Outlet,
} from "react-router-dom";

/* ============================================================
   PUBLIC COMPONENTS
   ============================================================ */

import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import { MessageCircle, X } from "lucide-react";

function WhatsAppIcon({ className = "" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2a9.86 9.86 0 0 0-8.45 14.95L2 22l5.23-1.53A9.98 9.98 0 0 0 12.04 21 9.5 9.5 0 0 0 22 11.5 9.51 9.51 0 0 0 12.04 2Zm0 17.2c-1.45 0-2.87-.39-4.1-1.13l-.3-.18-3.1.9.92-3.02-.2-.31a7.78 7.78 0 0 1-1.2-4.15 7.96 7.96 0 1 1 7.98 7.89Zm4.38-5.93c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06a6.57 6.57 0 0 1-1.93-1.19 7.24 7.24 0 0 1-1.34-1.66c-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.4-.54-.41h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.57.25 1.02.4 1.37.51.58.18 1.1.15 1.51.09.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
    </svg>
  );
}

/* ============================================================
   PUBLIC PAGES
   ============================================================ */

import Home from "./pages/Home.jsx";
import ShortCourses from "./pages/ShortCourses.jsx";
import CourseDetails from "./pages/CourseDetails.jsx";
import About from "./pages/About.jsx";
import Contact from "./pages/Contact.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import AuthCallback from "./pages/AuthCallback.jsx";
import Terms from "./pages/Terms.jsx";
import PrivacyPolicy from "./pages/PrivacyPolicy.jsx";
import RefundPolicy from "./pages/RefundPolicy.jsx";

/* ============================================================
   AUTH GUARDS
   ============================================================ */

const RequireStudent = lazy(() =>
  import("./auth/RequireStudent.jsx")
);

const RequireAdmin = lazy(() =>
  import("./auth/RequireAdmin.jsx")
);

const RequireTeacher = lazy(() =>
  import("./auth/RequireTeacher.jsx")
);

/* ============================================================
   LAYOUTS
   ============================================================ */

const AdminLayout = lazy(() =>
  import("./layouts/AdminLayout.jsx")
);

const TeacherLayout = lazy(() =>
  import("./layouts/TeacherLayout.jsx")
);

/* ============================================================
   STUDENT PAGES
   ============================================================ */

const Dashboard = lazy(() =>
  import("./student/Dashboard.jsx")
);

const Profile = lazy(() =>
  import("./student/Profile.jsx")
);

const LearnCourse = lazy(() =>
  import("./student/LearnCourse.jsx")
);

/* ============================================================
   ADMIN PAGES
   ============================================================ */

const AdminDashboard = lazy(() =>
  import("./Admin/AdminDashboard.jsx")
);

const Students = lazy(() =>
  import("./Admin/Students.jsx")
);

const AdminCourses = lazy(() =>
  import("./Admin/Courses.jsx")
);

const AdminPayments = lazy(() =>
  import("./Admin/Payments.jsx")
);

const ExportReports = lazy(() =>
  import("./Admin/ExportReports.jsx")
);

const Analytics = lazy(() =>
  import("./Admin/Analytics.jsx")
);

const Admins = lazy(() =>
  import("./Admin/Admins.jsx")
);

const Announcements = lazy(() =>
  import("./Admin/Announcements.jsx")
);

/* ============================================================
   TEACHER PAGES
   ============================================================ */

const TeacherDashboard = lazy(() =>
  import("./Teacher/Dashboard.jsx")
);

const TeacherCourses = lazy(() =>
  import("./Teacher/Courses.jsx")
);

const TeacherAttendance = lazy(() =>
  import("./Teacher/Attendance.jsx")
);

const TeacherOfflineEnrollments = lazy(() =>
  import("./Teacher/OfflineEnrollments.jsx")
);

const TeacherBatchList = lazy(() =>
  import("./Teacher/BatchList.jsx")
);

const TeacherBatchDetail = lazy(() =>
  import("./Teacher/BatchDetail.jsx")
);

const CreateCourse = lazy(() =>
  import("./Teacher/CreateCourse.jsx")
);

const EditCourse = lazy(() =>
  import("./Teacher/EditCourse.jsx")
);

const CourseContent = lazy(() =>
  import("./Teacher/CourseContent.jsx")
);

/* ============================================================
   TEACHER ASSIGNMENTS
   ============================================================ */

const TeacherAssignments = lazy(() =>
  import("./Teacher/Assignments.jsx")
);

const LessonEditor = lazy(() =>
  import("./Teacher/LessonEditor.jsx")
);

/* ============================================================
   REDIRECT HELPERS
   ============================================================ */

function RedirectToCourse() {
  const { courseId } = useParams();

  return (
    <Navigate
      to={`/courses/${courseId}`}
      replace
    />
  );
}

/* ============================================================
   FOOTER CONFIGURATION
   ============================================================ */

const HIDE_FOOTER_ON = [
  "/dashboard",
];

/* ============================================================
   PUBLIC LAYOUT
   ============================================================ */

function PublicLayout() {
  const { pathname } = useLocation();

  const hideFooter = HIDE_FOOTER_ON.some(
    (path) =>
      pathname === path ||
      pathname.startsWith(`${path}/`)
  );

  return (
    <>
      <Navbar />

      <Outlet />

      {!hideFooter && <Footer />}
    </>
  );
}

/* ============================================================
   LOADING SCREEN
   ============================================================ */

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3">

        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />

        <p className="text-sm text-slate-500">
          Loading...
        </p>

      </div>
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

function App() {
  const [supportOpen, setSupportOpen] = useState(false);
  const supportRef = useRef(null);

  useEffect(() => {
    if (!supportOpen) return undefined;
    const closeOutside = (event) => {
      if (!supportRef.current?.contains(event.target)) setSupportOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSupportOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [supportOpen]);

  return (
    <Suspense fallback={<LoadingScreen />}>

      <Routes>
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* ======================================================
            PUBLIC WEBSITE + STUDENT AREA
        ====================================================== */}

        <Route element={<PublicLayout />}>

          {/* ====================================================
              PUBLIC WEBSITE
          ==================================================== */}

          <Route
            path="/"
            element={<Home />}
          />

          <Route
            path="/ShortCourses"
            element={<ShortCourses />}
          />

          <Route
            path="/courses/:courseId"
            element={<CourseDetails />}
          />

          <Route
            path="/about"
            element={<About />}
          />

          <Route
            path="/contact"
            element={<Contact />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Navigate to="/privacy-policy" replace />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />

          {/* Forgot password page */}

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          {/* Google OAuth redirect lands here */}

          <Route
            path="/auth/callback"
            element={<AuthCallback />}
          />

          {/* ==================================================
              STUDENT DASHBOARD
          ================================================== */}

          <Route
            path="/dashboard"
            element={
              <RequireStudent>
                <Dashboard />
              </RequireStudent>
            }
          />

          <Route
            path="/dashboard/profile"
            element={
              <RequireStudent>
                <Profile />
              </RequireStudent>
            }
          />

          <Route
            path="/student/courses/:courseId"
            element={
              <RequireStudent>
                <LearnCourse />
              </RequireStudent>
            }
          />

          {/* ==================================================
              LEGACY STUDENT ROUTES
          ================================================== */}

          <Route
            path="/dashboard/my-courses"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/dashboard/my-courses/:courseId"
            element={<RedirectToCourse />}
          />

          <Route
            path="/dashboard/progress"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

          <Route
            path="/dashboard/certificates"
            element={
              <Navigate
                to="/dashboard?tab=certificates"
                replace
              />
            }
          />

          <Route
            path="/dashboard/payments"
            element={
              <Navigate
                to="/dashboard?tab=payments"
                replace
              />
            }
          />

        </Route>

        {/* ======================================================
            TEACHER PANEL
        ====================================================== */}

        <Route element={<RequireTeacher />}>

          <Route
            path="/Teacher"
            element={<TeacherLayout />}
          >

            <Route
              index
              element={<TeacherDashboard />}
            />

            <Route
              path="courses"
              element={<TeacherCourses />}
            />

            <Route
              path="attendance"
              element={<TeacherAttendance />}
            />

            <Route
              path="offline-enrollments"
              element={<TeacherOfflineEnrollments />}
            />

            <Route
              path="announcements"
              element={<Announcements />}
            />

            <Route
              path="batches"
              element={<TeacherBatchList />}
            />

            <Route
              path="batches/:batchId"
              element={<TeacherBatchDetail />}
            />

            <Route
              path="courses/create"
              element={<CreateCourse />}
            />

            <Route
              path="courses/edit/:courseId"
              element={<EditCourse />}
            />

            {/* ==================================================
                COURSE CONTENT
            ================================================== */}

            <Route
              path="courses/:courseId/content"
              element={<CourseContent />}
            />

            {/* ==================================================
                ASSIGNMENTS
            ================================================== */}

            <Route
              path="courses/:courseId/assignments"
              element={<TeacherAssignments />}
            />

            {/* ==================================================
                LESSON EDITOR
            ================================================== */}

            <Route
              path="courses/:courseId/content/:moduleId/lesson/:lessonId"
              element={<LessonEditor />}
            />

          </Route>

        </Route>

        {/* ======================================================
            ADMIN PANEL
        ====================================================== */}

        <Route element={<RequireAdmin />}>

          <Route
            path="/admin"
            element={<AdminLayout />}
          >

            <Route
              index
              element={<AdminDashboard />}
            />

            <Route
              path="students"
              element={<Students />}
            />

            <Route
              path="courses"
              element={<AdminCourses />}
            />

            <Route
              path="payments"
              element={<AdminPayments />}
            />

            <Route
              path="exports"
              element={<ExportReports />}
            />

            <Route
              path="analytics"
              element={<Analytics />}
            />

            <Route
              path="admins"
              element={<Admins />}
            />

            <Route
              path="announcements"
              element={<Announcements />}
            />

          </Route>

        </Route>

        {/* ======================================================
            FALLBACK
        ====================================================== */}

        <Route
          path="*"
          element={
            <Navigate
              to="/"
              replace
            />
          }
        />

      </Routes>

      <div ref={supportRef} className="fixed bottom-24 right-0 z-[100] flex items-end sm:bottom-8">
        {supportOpen && (
          <div className="mb-2 mr-3 w-[min(18rem,calc(100vw-5rem))] overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-2xl">
            <div className="bg-[#128C7E] px-4 py-3 text-white">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold">WhatsApp support</p>
                  <p className="mt-0.5 text-xs text-white/80">We’re here to help</p>
                </div>
                <button type="button" onClick={() => setSupportOpen(false)} aria-label="Close support panel" className="rounded-full p-1.5 transition hover:bg-white/15">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-600">Chat with our team about courses, payments, or your account.</p>
              <a href="https://wa.me/919910232927?text=Hello%2C%20I%20need%20help%20with%20Creative%20Adhyayan." target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#1fb95a]">
                <MessageCircle className="h-4 w-4" />
                Chat on WhatsApp
              </a>
            </div>
          </div>
        )}
        <button type="button" onClick={() => setSupportOpen((open) => !open)} aria-expanded={supportOpen} aria-label={supportOpen ? "Close WhatsApp support" : "Open WhatsApp support"} className="flex h-14 w-11 items-center justify-center rounded-l-2xl bg-[#25D366] text-white shadow-xl transition hover:w-12 hover:bg-[#1fb95a] focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2">
          {supportOpen ? <X className="h-5 w-5" /> : <WhatsAppIcon className="h-6 w-6" />}
        </button>
      </div>

    </Suspense>
  );
}

export default App;
