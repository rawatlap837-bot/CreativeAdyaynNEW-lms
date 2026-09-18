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
import ForgotPassword from "./pages/ForgotPassword.jsx";

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

          {/* Forgot password page */}

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
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

          <Route
            path="/dashboard/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />

          <Route
            path="/student/courses/:courseId"
            element={
              <RequireAuth>
                <LearnCourse />
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

    </Suspense>
  );
}

export default App;