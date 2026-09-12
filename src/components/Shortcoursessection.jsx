import { useState, forwardRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    ArrowUpRight,
    GraduationCap,
    Clock,
    LayoutGrid,
    Code2,
    Globe,
    Palette,
    BookOpen,
} from "lucide-react";
import { usePublishedCoursesByCategory, slugify } from "../services/CourseService";

// Known category labels get their existing icon; any new category the
// admin creates falls back to BookOpen rather than breaking.
const ICON_BY_LABEL = {
    "Office & Computer Basics": LayoutGrid,
    "Programming & Development": Code2,
    "Design & Creative Tools": Palette,
    "Web & Scripting": Globe,
};

/**
 * Short Courses — SECTION version (tab-style).
 *
 * Behavior (per latest request):
 * - Only ONE track's courses are shown at a time (capped at `maxPerGroup`,
 *   default 4) — not all four tracks stacked on top of each other.
 * - The pill row up top is now a real tab switcher: clicking a pill swaps
 *   the grid below to that track's courses (cross-fades via AnimatePresence)
 *   instead of scrolling down to a stacked section.
 * - A single "Explore More" link sits under the grid and goes to the full
 *   Short Courses page, same as before.
 */

const img = (keyword, seed) => `https://loremflickr.com/500/400/${keyword}?lock=${seed}`;

// Fallback content only — shown while Firestore is loading, or if the
// admin hasn't published any short courses yet, so the homepage section
// never renders empty. Once courses are published in the Admin panel,
// they take over automatically (see usePublishedCoursesByCategory below).
const FALLBACK_GROUPS = [
    {
        id: "office",
        label: "Office & Computer Basics",
        icon: LayoutGrid,
        courses: [
            {
                title: "CCC / BCC",
                duration: "2 Month",
                color: "#6D3FC0",
                description: "Core computer literacy for absolute beginners.",
                image: img("computerclass", 101),
            },
            {
                title: "MS Word",
                duration: "1 Month",
                color: "#2B579A",
                description: "Type, format, and produce professional documents.",
                image: img("mswordapp", 102),
            },
            {
                title: "MS Excel",
                duration: "1 Month",
                color: "#217346",
                description: "Build spreadsheets, formulas, and simple reports.",
                image: img("msexcel", 103),
                popular: true,
            },
            {
                title: "Adv. Excel",
                duration: "1 Month",
                color: "#217346",
                description: "Pivot tables, macros, and data analysis at scale.",
                image: img("excelformula", 104),
            },
            {
                title: "MS PowerPoint",
                duration: "1 Month",
                color: "#D24726",
                description: "Design decks that pitch, teach, and persuade.",
                image: img("mspowerpoint", 105),
            },
            {
                title: "MS Access",
                duration: "1 Month",
                color: "#A4373A",
                description: "Design simple databases and manage records.",
                image: img("msaccess", 106),
            },
            {
                title: "Internet",
                duration: "1 Week",
                color: "#3A7BD5",
                description: "Browse, search, and stay safe online with confidence.",
                image: img("internetbrowsing", 107),
            },
        ],
    },
    {
        id: "programming",
        label: "Programming & Development",
        icon: Code2,
        courses: [
            {
                title: "C Programming",
                duration: "3 Month",
                color: "#3A3A3A",
                description: "Learn logic-building with the foundation language.",
                image: img("cprogramming", 201),
            },
            {
                title: "C++ Programming",
                duration: "3 Month",
                color: "#00599C",
                description: "Object-oriented programming for real applications.",
                image: img("cplusplus", 202),
            },
            {
                title: "Core Java",
                duration: "3 Months",
                color: "#EA2D2E",
                description: "Master Java fundamentals and OOP concepts.",
                image: img("javaprogramming", 203),
            },
            {
                title: "Full Java",
                duration: "9 Month",
                color: "#F89820",
                description: "End-to-end Java development for enterprise apps.",
                image: img("javadeveloper", 204),
                popular: true,
            },
            {
                title: "PHP",
                duration: "3 Months",
                color: "#4F5B93",
                description: "Build dynamic, database-driven websites.",
                image: img("phpcode", 205),
            },
            {
                title: "Python",
                duration: "3 Month",
                color: "#3776AB",
                description: "The most in-demand language for scripting & data.",
                image: img("pythoncode", 206),
                popular: true,
            },
            {
                title: "MySQL / MariaDB",
                duration: "2 Months",
                color: "#00758F",
                description: "Query, manage, and structure relational databases.",
                image: img("mysqldatabase", 207),
            },
        ],
    },
    {
        id: "design",
        label: "Design & Creative Tools",
        icon: Palette,
        courses: [
            {
                title: "Graphic Design",
                duration: "6 Month",
                color: "#6D3FC0",
                description: "Visual design fundamentals for branding & print.",
                image: img("graphicdesigner", 301),
                popular: true,
            },
            {
                title: "Web Designing",
                duration: "6 Months",
                color: "#E8A33D",
                description: "Design responsive, user-friendly websites.",
                image: img("webdesigner", 302),
            },
            {
                title: "Photoshop",
                duration: "2 Month",
                color: "#31A8FF",
                description: "Photo editing, retouching, and digital art.",
                image: img("photoshopediting", 303),
            },
            {
                title: "CorelDRAW",
                duration: "2 Month",
                color: "#00A651",
                description: "Vector illustration for logos and layouts.",
                image: img("coreldraw", 304),
            },
            {
                title: "Illustrator",
                duration: "1 Months",
                color: "#FF9A00",
                description: "Create scalable icons, logos, and artwork.",
                image: img("illustratorartist", 305),
            },
            {
                title: "After Effects",
                duration: "1 Month",
                color: "#9999FF",
                description: "Motion graphics and video visual effects.",
                image: img("aftereffects", 306),
            },
            {
                title: "3ds Max",
                duration: "3 Month",
                color: "#20BFA9",
                description: "3D modeling, texturing, and rendering basics.",
                image: img("3dmodeling", 307),
            },
        ],
    },
    {
        id: "web",
        label: "Web & Scripting",
        icon: Globe,
        courses: [
            {
                title: "WordPress",
                duration: "1 Month",
                color: "#21759B",
                description: "Build and manage websites without heavy coding.",
                image: img("wordpresswebsite", 401),
            },
            {
                title: "HTML & CSS",
                duration: "1 Month",
                color: "#E34F26",
                description: "The building blocks of every website, from scratch.",
                image: img("htmlcode", 402),
            },
            {
                title: "JavaScript",
                duration: "1 Months",
                color: "#D6B90A",
                description: "Add interactivity and logic to the modern web.",
                image: img("javascriptcode", 403),
                popular: true,
            },
            {
                title: "MIS",
                duration: "2 Month",
                color: "#2E1A55",
                description: "Manage information systems for business decisions.",
                image: img("businessdashboard", 404),
            },
        ],
    },
];

/* --- animation variants --- */
const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
};

const cardVariants = {
    hidden: { opacity: 0, y: 14, scale: 0.97 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: "easeOut" } },
    exit: { opacity: 0, scale: 0.96, transition: { duration: 0.12 } },
};

function DotGrid({ className = "", dot = "fill-[#2E1A55]/10" }) {
    return (
        <svg className={className} width="140" height="140" viewBox="0 0 140 140" fill="none" aria-hidden="true">
            {Array.from({ length: 7 }).map((_, row) =>
                Array.from({ length: 7 }).map((_, col) => (
                    <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r="2.5" className={dot} />
                ))
            )}
        </svg>
    );
}

/**
 * Wrapped in forwardRef: AnimatePresence needs to attach a ref to this
 * component's root DOM node to track it for exit animations. Plain
 * function components can't receive refs, which was previously causing
 * a "Function components cannot be given refs" warning and silently
 * breaking exit-animation tracking for cards leaving the grid.
 */
const CourseCard = forwardRef(function CourseCard(
    { id, title, duration, color, image, popular, description },
    ref
) {
    const href = `/courses/${encodeURIComponent(id)}`;
    return (
        <motion.div
            ref={ref}
            layout
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            whileHover={{ y: -4 }}
            className="group flex h-[272px] flex-col overflow-hidden rounded-2xl border-2 border-violet-100 bg-white shadow-sm transition-all duration-300 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-200/50"
        >
            <div className="relative h-[55%] w-full shrink-0 overflow-hidden">
                <img
                    src={image}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />

                {popular && (
                    <span
                        className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm"
                        style={{ background: "linear-gradient(135deg, #E8A33D, #D2891F)" }}
                    >
                        Popular
                    </span>
                )}

                <span
                    className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold shadow-sm backdrop-blur-sm"
                    style={{ color }}
                >
                    <Clock className="h-2.5 w-2.5" />
                    {duration}
                </span>
            </div>

            <div className="flex h-[45%] flex-col justify-between gap-1 border-t-2 border-violet-100 px-3 py-2.5">
                <div>
                    <h3 className="truncate text-sm font-black leading-tight tracking-tight text-[#1F1533]">
                        {title}
                    </h3>
                    <p className="mt-1 line-clamp-1 text-[11px] leading-snug text-[#6b5f87]">
                        {description}
                    </p>
                </div>

                <Link
                    to={href}
                    className="group/btn relative flex w-full items-center justify-between overflow-hidden rounded-full p-1 pl-4 text-xs font-bold text-white shadow-sm ring-1 ring-inset ring-white/10 transition-all duration-300 hover:shadow-lg active:scale-[0.97]"
                    style={{
                        background: `linear-gradient(135deg, ${color}, ${color}CC)`,
                        boxShadow: `0 0 0 0 ${color}55`,
                    }}
                >
                    <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/25 opacity-0 transition-all duration-500 group-hover/btn:left-full group-hover/btn:opacity-100" />
                    <span className="relative z-10">Enroll Now</span>
                    <span
                        className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:rotate-45"
                        style={{ color }}
                    >
                        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                </Link>
            </div>
        </motion.div>
    );
});

/**
 * @param {string} [eyebrow]
 * @param {string} [title]
 * @param {string} [subtitle]
 * @param {number} [maxPerGroup] - cap on cards shown for the active track.
 * @param {string} [exploreAllHref] - route to the full Short Courses page.
 */
export default function ShortCoursesSection({
    eyebrow = "Skill Up Fast",
    title = "Short Courses",
    subtitle = "Focused, job-ready skills — now live in both online & offline formats.",
    maxPerGroup = 4,
    exploreAllHref = "/ShortCourses",
}) {
    // Admin-published "short" courses are the source of truth here — see
    // src/services/courseService.js. Falls back to FALLBACK_GROUPS while
    // loading or if nothing has been published yet.
    const { categories, coursesByCategory, loading } = usePublishedCoursesByCategory("short");
    const liveGroups = categories.map((label) => ({
        id: slugify(label) || label,
        label,
        icon: ICON_BY_LABEL[label] || BookOpen,
        courses: coursesByCategory[label].map((c) => ({
            id: c.slug || c.id,
            title: c.title,
            duration: c.duration,
            color: c.color || "#6D3FC0",
            image: c.image,
            popular: !!c.popular,
            description: c.description,
        })),
    }));
    const COURSE_GROUPS = !loading && liveGroups.length > 0 ? liveGroups : FALLBACK_GROUPS;
    const TOTAL_COURSES = COURSE_GROUPS.reduce((sum, g) => sum + g.courses.length, 0);

    const [activeGroupId, setActiveGroupId] = useState(COURSE_GROUPS[0]?.id ?? null);

    const activeGroup =
        COURSE_GROUPS.find((g) => g.id === activeGroupId) ?? COURSE_GROUPS[0] ?? { courses: [], icon: BookOpen, label: "" };
    const visibleCourses = activeGroup.courses.slice(0, maxPerGroup);
    const ActiveIcon = activeGroup.icon;

    return (
        <section id="short-courses" className="relative bg-[#F8F6FC] px-5 py-14 sm:px-8 sm:py-20 lg:py-24">
            <DotGrid className="pointer-events-none absolute right-6 top-6 hidden sm:block" />

            <div className="relative mx-auto max-w-6xl">
                {/* ---------------- header ---------------- */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="text-center"
                >
                    {eyebrow && (
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#6D3FC0] sm:text-xs">
                            {eyebrow}
                        </span>
                    )}
                    {title && (
                        <h2 className="mt-2 text-2xl font-black tracking-tight text-[#1F1533] sm:text-3xl lg:text-4xl">
                            {title}
                        </h2>
                    )}
                    {subtitle && (
                        <p className="mx-auto mt-3 max-w-xl text-sm text-[#6b5f87] sm:text-base">{subtitle}</p>
                    )}

                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 text-xs text-[#4A3D66]">
                        <span className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3.5 py-1.5">
                            <GraduationCap className="h-3.5 w-3.5 text-[#E8A33D]" />
                            {TOTAL_COURSES}+ courses
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3.5 py-1.5">
                            <LayoutGrid className="h-3.5 w-3.5 text-[#E8A33D]" />
                            {COURSE_GROUPS.length} tracks
                        </span>
                        <span className="flex items-center gap-1.5 rounded-full border border-violet-100 bg-white px-3.5 py-1.5">
                            <Clock className="h-3.5 w-3.5 text-[#E8A33D]" />
                            From 1 week
                        </span>
                    </div>
                </motion.div>

                {/* ---------------- category tabs — click swaps the grid below ---------------- */}
                <div className="mt-6 flex justify-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
                    {COURSE_GROUPS.map((group) => {
                        const GroupIcon = group.icon;
                        const isActive = activeGroupId === group.id;
                        return (
                            <button
                                key={group.id}
                                type="button"
                                onClick={() => setActiveGroupId(group.id)}
                                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all sm:text-[13px] ${isActive
                                    ? "border-transparent text-white shadow-md"
                                    : "border-violet-100 bg-white text-[#4A3D66] hover:border-violet-200"
                                    }`}
                                style={isActive ? { background: "linear-gradient(135deg, #6D3FC0, #2E1A55)" } : undefined}
                            >
                                <GroupIcon className="h-3 w-3" />
                                {group.label}
                            </button>
                        );
                    })}
                </div>

                {/* ---------------- active track — only 4 courses shown at a time ---------------- */}
                <div className="relative mt-8 min-h-[340px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeGroup.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.25, ease: "easeOut" }}
                        >
                            <div className="mb-4 flex items-center justify-between gap-3">
                                <span className="flex items-center gap-2.5 text-base font-black tracking-tight text-[#2E1A55] sm:text-lg">
                                    <span
                                        className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
                                        style={{ background: "linear-gradient(135deg, #6D3FC0, #E8A33D)" }}
                                    >
                                        <ActiveIcon className="h-4 w-4" />
                                    </span>
                                    {activeGroup.label}
                                </span>
                                <span className="hidden text-xs font-medium text-[#A79BC4] sm:block">
                                    {activeGroup.courses.length} courses
                                </span>
                            </div>

                            <motion.div
                                layout
                                initial="hidden"
                                animate="visible"
                                variants={containerVariants}
                                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                            >
                                <AnimatePresence mode="popLayout">
                                    {visibleCourses.map((course) => (
                                        <CourseCard key={course.title} {...course} />
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ---------------- explore all ---------------- */}
                {exploreAllHref && (
                    <div className="mt-10 flex justify-center">
                        <Link
                            to={exploreAllHref}
                            className="group/cta inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.98]"
                            style={{ background: "linear-gradient(135deg, #6D3FC0, #2E1A55)" }}
                        >
                            Explore More
                            <ArrowUpRight
                                className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5"
                                strokeWidth={2.5}
                            />
                        </Link>
                    </div>
                )}
            </div>
        </section>
    );
}