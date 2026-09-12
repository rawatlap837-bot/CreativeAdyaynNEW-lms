import Hero from "../components/Hero";
import Navbar from "../components/Navbar";
import Testimonials from "../components/Testimonials";
import TrustSection from "../components/TrustSection";
// import PopularCategory from "../components/Popularcategory";
import ShortCourses from "../components/Shortcoursessection";
import DashboardSection from "../components/Dashboard";
// import InstructorExcellence from "../components/Instructorexcellence";
import LiveCourses from "../components/Livecourses";
import FAQ from "../components/FAQ";
import { usePublishedCoursesByCategory } from "../services/CourseService";

// Firestore doc -> the exact shape <LiveCourses> already expects via its
// `coursesByCategory` prop (see Livecourses.jsx's CourseCard). Using the
// slug (falling back to the raw doc id) as `id` gives friendly
// /courses/:slug links wherever this feeds into <Link to={`/courses/${id}`}>.
function toLiveCourseCard(course) {
  return {
    id: course.slug || course.id,
    title: course.title,
    images: course.images,
    tags: course.tags,
    description: course.description,
    features: course.features,
    duration: course.duration,
    mode: course.mode,
    link: course.link,
  };
}

export default function Home() {
  // Admin-published "long" courses are the source of truth for this
  // section — see src/services/courseService.js. While loading, or if the
  // admin hasn't published any long courses yet, <LiveCourses> falls back
  // to its own built-in defaults so the homepage never renders empty.
  const { categories, coursesByCategory, loading } = usePublishedCoursesByCategory("long");
  const hasLiveCourses = !loading && categories.length > 0;
  const liveCoursesProps = hasLiveCourses
    ? {
      categories,
      coursesByCategory: Object.fromEntries(
        categories.map((c) => [c, coursesByCategory[c].map(toLiveCourseCard)])
      ),
    }
    : {};

  return (
    <>
      <Navbar />
      <Hero />
      <TrustSection />
      {/* <PopularCategory /> */}
      <LiveCourses {...liveCoursesProps} />
      <DashboardSection />
      {/* <InstructorExcellence /> */}
      <ShortCourses />
      <FAQ />
      <Testimonials />
    </>
  );
}