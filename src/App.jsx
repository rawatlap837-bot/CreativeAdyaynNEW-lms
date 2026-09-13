import { lazy, Suspense } from "react";
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

/* ============================================================
   AUTH GUARDS
   ============================================================ */

const RequireAuth = lazy(() =>
  import("./auth/RequireAuth.jsx")
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

// Admin layout
const AdminLayout = lazy(() =>
  import("./layouts/AdminLayout.jsx")
);

// Teacher layout
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

const Lessons = lazy(() =>
  import("./Admin/Lessons.jsx")
);

const AdminPayments = lazy(() =>
  import("./Admin/Payments.jsx")
);

const Analytics = lazy(() =>
  import("./Admin/Analytics.jsx")
);

const Admins = lazy(() =>
  import("./Admin/Admins.jsx")
);

/* ============================================================
   TEACHER PAGES
   ============================================================ */

// Teacher dashboard
const TeacherDashboard = lazy(() =>
  import("./Teacher/Dashboard.jsx")
);

// Teacher courses
const TeacherCourses = lazy(() =>
  import("./Teacher/Courses.jsx")
);

// Teacher attendance
const TeacherAttendance = lazy(() =>
  import("./Teacher/Attendance.jsx")
);

// Create course
const CreateCourse = lazy(() =>
  import("./Teacher/CreateCourse.jsx")
);

// Edit course
const EditCourse = lazy(() =>
  import("./Teacher/EditCourse.jsx")
);

// Manage course content
const CourseContent = lazy(() =>
  import("./Teacher/CourseContent.jsx")
);

// Edit lesson
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">

        <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />

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
  return (
    <Suspense fallback={<LoadingScreen />}>

      <Routes>

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

          {/* ==================================================
              STUDENT DASHBOARD
              ================================================== */}

          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />

          {/* ==================================================
              STUDENT PROFILE
              ================================================== */}

          <Route
            path="/dashboard/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
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
                to="/dashboard/profile?tab=payments"
                replace
              />
            }
          />

        </Route>

        {/* ======================================================
            TEACHER PANEL
            ====================================================== */}

        <Route element={<RequireTeacher />}>

          {/* ====================================================
              TEACHER LAYOUT
              ==================================================== */}

          <Route
            path="/Teacher"
            element={<TeacherLayout />}
          >

            {/* ==================================================
                TEACHER DASHBOARD
                ================================================== */}

            <Route
              index
              element={<TeacherDashboard />}
            />

            {/* ==================================================
                MY COURSES
                ================================================== */}

            <Route
              path="courses"
              element={<TeacherCourses />}
            />

            {/* ==================================================
                ATTENDANCE
                ================================================== */}

            <Route
              path="attendance"
              element={<TeacherAttendance />}
            />

            {/* ==================================================
                CREATE COURSE
                ================================================== */}

            <Route
              path="courses/create"
              element={<CreateCourse />}
            />

            {/* ==================================================
                EDIT COURSE
                ================================================== */}

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

            {/* ==================================================
                ADMIN DASHBOARD
                ================================================== */}

            <Route
              index
              element={<AdminDashboard />}
            />

            {/* ==================================================
                STUDENTS
                ================================================== */}

            <Route
              path="students"
              element={<Students />}
            />

            {/* ==================================================
                COURSES
                ================================================== */}

            <Route
              path="courses"
              element={<AdminCourses />}
            />

            {/* ==================================================
                LESSONS
                ================================================== */}

            <Route
              path="lessons"
              element={<Lessons />}
            />

            {/* ==================================================
                PAYMENTS
                ================================================== */}

            <Route
              path="payments"
              element={<AdminPayments />}
            />

            {/* ==================================================
                ANALYTICS
                ================================================== */}

            <Route
              path="analytics"
              element={<Analytics />}
            />

            {/* ==================================================
                ADMINS
                ================================================== */}

            <Route
              path="admins"
              element={<Admins />}
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

    </Suspense>
  );
}

export default App;