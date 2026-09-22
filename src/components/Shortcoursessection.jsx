import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowRight,
    ArrowUpRight,
    BookOpen,
    Clock3,
    Code2,
    GraduationCap,
    LayoutGrid,
    Globe,
    Palette,
    Sparkles,
    Users,
    Zap,
} from "lucide-react";
import { usePublishedCoursesByCategory, slugify } from "../services/CourseService";

/* ================================================================
   This section is the compact, homepage-facing sibling of the full
   ShortCourses.jsx page. It reuses the SAME live data (Supabase database via
   usePublishedCoursesByCategory) and the SAME card vocabulary —
   price, New/Featured/Popular badges, category, duration, students —
   just sized down to fit a homepage section instead of a full grid.
================================================================ */

const ICON_BY_LABEL = {
    "Office & Computer Basics": LayoutGrid,
    "Programming & Development": Code2,
    "Design & Creative Tools": Palette,
    "Web & Scripting": Globe,
};

const NEW_WINDOW_DAYS = 45;

const inr = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
});

const compactNumber = new Intl.NumberFormat("en-IN", {
    notation: "compact",
    maximumFractionDigits: 1,
});

/* --- helpers (trimmed copies of the ones in ShortCourses.jsx) --- */

function getPricing(course) {
    const price = Number(course.price) || 0;
    const discountPrice = Number(course.discountPrice) || 0;
    const hasDiscount = discountPrice > 0 && price > 0 && discountPrice < price;
    const effective = hasDiscount ? discountPrice : price;
    const percentOff = hasDiscount ? Math.round(((price - discountPrice) / price) * 100) : 0;
    return { effective, original: hasDiscount ? price : null, percentOff, isFree: effective <= 0 };
}

function getCreatedTime(course) {
    const raw = course?.publishedAt ?? course?.createdAt ?? course?.created_at ?? course?.updatedAt;
    if (!raw) return 0;
    if (typeof raw?.toDate === "function") return raw.toDate().getTime();
    if (typeof raw?.seconds === "number") return raw.seconds * 1000;
    if (raw instanceof Date) return raw.getTime();
    const parsed = new Date(raw).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}

function isNewCourse(course) {
    const created = getCreatedTime(course);
    if (!created) return false;
    return Date.now() - created <= NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/* --- fallback so the section never renders empty pre-launch --- */

const FALLBACK_GROUPS = [
    {
        id: "office",
        label: "Office & Computer Basics",
        courses: [
            { id: "mword", title: "MS Word", duration: "1 Month", students: 480, category: "Office", price: 1999, thumbnailUrl: null, description: "Type, format, and produce professional documents." },
            { id: "mexcel", title: "MS Excel", duration: "1 Month", students: 610, category: "Office", price: 2499, popular: true, thumbnailUrl: null, description: "Build spreadsheets, formulas, and simple reports." },
            { id: "adv-excel", title: "Adv. Excel", duration: "1 Month", students: 340, category: "Office", price: 2999, thumbnailUrl: null, description: "Pivot tables, macros, and data analysis at scale." },
            { id: "ppt", title: "MS PowerPoint", duration: "1 Month", students: 275, category: "Office", price: 1799, thumbnailUrl: null, description: "Design decks that pitch, teach, and persuade." },
        ],
    },
    {
        id: "programming",
        label: "Programming & Development",
        courses: [
            { id: "python", title: "Python", duration: "3 Month", students: 920, category: "Programming", price: 6999, discountPrice: 4999, popular: true, thumbnailUrl: null, description: "The most in-demand language for scripting & data." },
            { id: "java", title: "Core Java", duration: "3 Months", students: 540, category: "Programming", price: 5999, thumbnailUrl: null, description: "Master Java fundamentals and OOP concepts." },
            { id: "cpp", title: "C++ Programming", duration: "3 Month", students: 300, category: "Programming", price: 4999, thumbnailUrl: null, description: "Object-oriented programming for real applications." },
            { id: "mysql", title: "MySQL / MariaDB", duration: "2 Months", students: 210, category: "Programming", price: 3499, thumbnailUrl: null, description: "Query, manage, and structure relational databases." },
        ],
    },
    {
        id: "design",
        label: "Design & Creative Tools",
        courses: [
            { id: "graphic", title: "Graphic Design", duration: "6 Month", students: 700, category: "Design", price: 8999, popular: true, thumbnailUrl: null, description: "Visual design fundamentals for branding & print." },
            { id: "webdesign", title: "Web Designing", duration: "6 Months", students: 430, category: "Design", price: 7999, thumbnailUrl: null, description: "Design responsive, user-friendly websites." },
            { id: "photoshop", title: "Photoshop", duration: "2 Month", students: 380, category: "Design", price: 3999, thumbnailUrl: null, description: "Photo editing, retouching, and digital art." },
            { id: "illustrator", title: "Illustrator", duration: "1 Month", students: 190, category: "Design", price: 3499, thumbnailUrl: null, description: "Create scalable icons, logos, and artwork." },
        ],
    },
    {
        id: "web",
        label: "Web & Scripting",
        courses: [
            { id: "html-css", title: "HTML & CSS", duration: "1 Month", students: 860, category: "Web", price: 1999, thumbnailUrl: null, description: "The building blocks of every website, from scratch." },
            { id: "js", title: "JavaScript", duration: "1 Month", students: 730, category: "Web", price: 2999, popular: true, thumbnailUrl: null, description: "Add interactivity and logic to the modern web." },
            { id: "wordpress", title: "WordPress", duration: "1 Month", students: 410, category: "Web", price: 2499, thumbnailUrl: null, description: "Build and manage websites without heavy coding." },
            { id: "mis", title: "MIS", duration: "2 Month", students: 150, category: "Web", price: 3999, thumbnailUrl: null, description: "Manage information systems for business decisions." },
        ],
    },
];

/* --- motion --- */

const gridVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
};

const cardVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, transition: { duration: 0.1 } },
};

/**
 * @param {string} [eyebrow]
 * @param {string} [title]
 * @param {string} [subtitle]
 * @param {number} [maxPerGroup] - how many cards show for the active track.
 * @param {string} [exploreAllHref] - route to the full Short Courses page.
 */
export default function ShortCoursesSection({
    eyebrow = "Skill Up Fast",
    title = "Short Courses",
    subtitle = "Focused, job-ready skills — live now in both online & offline formats.",
    maxPerGroup = 4,
    exploreAllHref = "/ShortCourses",
}) {
    const { categories, coursesByCategory, loading } = usePublishedCoursesByCategory("short");

    const liveGroups = categories.map((label) => ({
        id: slugify(label) || label,
        label,
        courses: coursesByCategory[label],
    }));

    const GROUPS = !loading && liveGroups.length > 0 ? liveGroups : FALLBACK_GROUPS;
    const totalCourses = GROUPS.reduce((sum, g) => sum + g.courses.length, 0);

    const [activeId, setActiveId] = useState(GROUPS[0]?.id ?? null);
    const activeGroup = GROUPS.find((g) => g.id === activeId) ?? GROUPS[0] ?? { id: "", label: "", courses: [] };
    const visibleCourses = activeGroup.courses.slice(0, maxPerGroup);

    return (
        <section id="short-courses" className="bg-[#FAF9FC] px-5 py-14 sm:px-8 sm:py-16">
            <div className="mx-auto max-w-6xl">
                {/* ---------------- header ---------------- */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        {eyebrow && (
                            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#6D3FC0]">
                                {eyebrow}
                            </span>
                        )}
                        <h2 className="mt-1.5 text-2xl font-black tracking-tight text-[#1F1533] sm:text-3xl">
                            {title}
                        </h2>
                        {subtitle && <p className="mt-2 max-w-md text-sm text-[#6b5f87]">{subtitle}</p>}
                    </div>

                    <div className="flex items-center gap-2 text-xs font-semibold text-[#4A3D66] sm:mb-1">
                        <span className="rounded-full border border-violet-100 bg-white px-3 py-1.5">
                            {totalCourses}+ courses
                        </span>
                        <Link
                            to={exploreAllHref}
                            className="hidden items-center gap-1 rounded-full bg-[#2E1A55] px-3.5 py-1.5 text-white transition hover:bg-[#231143] sm:inline-flex"
                        >
                            Explore all
                            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </Link>
                    </div>
                </div>

                {/* ---------------- category tabs ---------------- */}
                <div className="mt-6 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {GROUPS.map((group) => {
                        const GroupIcon = ICON_BY_LABEL[group.label] || BookOpen;
                        const isActive = activeGroup.id === group.id;
                        return (
                            <button
                                key={group.id}
                                type="button"
                                onClick={() => setActiveId(group.id)}
                                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-all ${isActive
                                        ? "border-transparent bg-[#6D3FC0] text-white shadow-sm"
                                        : "border-violet-100 bg-white text-[#4A3D66] hover:border-violet-200"
                                    }`}
                            >
                                <GroupIcon className="h-3.5 w-3.5" />
                                {group.label}
                            </button>
                        );
                    })}
                </div>

                {/* ---------------- cards ---------------- */}
                <div className="relative mt-6 min-h-[260px]">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeGroup.id}
                            variants={gridVariants}
                            initial="hidden"
                            animate="visible"
                            exit="hidden"
                            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
                        >
                            {visibleCourses.map((course) => (
                                <CompactCourseCard key={course.id || course.title} course={course} />
                            ))}
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* ---------------- mobile explore link ---------------- */}
                <div className="mt-8 flex justify-center sm:hidden">
                    <Link
                        to={exploreAllHref}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[#2E1A55] px-5 py-2.5 text-sm font-semibold text-white"
                    >
                        Explore all courses
                        <ArrowUpRight className="h-4 w-4" strokeWidth={2.5} />
                    </Link>
                </div>
            </div>
        </section>
    );
}

/* ================================================================
   COMPACT COURSE CARD — same vocabulary as ShortCourses.jsx's
   CourseCard (badges, price, meta) but sized for a dense homepage
   grid: shorter image, tighter type, one meta row instead of two.
================================================================ */

function CompactCourseCard({ course }) {
    const pricing = useMemo(() => getPricing(course), [course]);
    const isNew = useMemo(() => isNewCourse(course), [course]);
    const thumbnail = course.thumbnailUrl || course.imageUrl || course.thumbnail;
    const href = `/courses/${encodeURIComponent(course.id || course.slug || course.title)}`;

    return (
        <motion.div variants={cardVariants} className="group flex flex-col overflow-hidden rounded-xl border border-violet-100 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-200 hover:shadow-md hover:shadow-violet-900/[0.06]">
            <Link to={href} className="relative block aspect-[4/3] w-full shrink-0 overflow-hidden bg-gradient-to-br from-violet-100 to-orange-50">
                {thumbnail ? (
                    <img
                        src={thumbnail}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-violet-300">
                        <BookOpen className="h-8 w-8" />
                    </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

                <div className="absolute inset-x-1.5 top-1.5 flex flex-wrap gap-1">
                    {isNew && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                            <Sparkles className="h-2 w-2" />
                            New
                        </span>
                    )}
                    {course.popular && (
                        <span className="rounded-full bg-[#6D3FC0] px-1.5 py-0.5 text-[9px] font-bold text-white">
                            Popular
                        </span>
                    )}
                    {course.featured && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                            <Zap className="h-2 w-2" />
                            Featured
                        </span>
                    )}
                </div>

                <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-white/90 px-1.5 py-0.5 text-[9px] font-bold text-[#4A3D66]">
                    <Clock3 className="h-2.5 w-2.5" />
                    {course.duration || "Flexible"}
                </span>
            </Link>

            <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <h3 className="truncate text-[13px] font-bold leading-tight text-[#1F1533]">
                    {course.title || course.name}
                </h3>

                <div className="flex items-center justify-between text-[10.5px] text-[#8577a0]">
                    {course.students > 0 ? (
                        <span className="inline-flex items-center gap-1">
                            <Users className="h-2.5 w-2.5" />
                            {compactNumber.format(course.students)}
                        </span>
                    ) : (
                        <span className="truncate">{course.category}</span>
                    )}
                    {pricing.percentOff > 0 && (
                        <span className="font-semibold text-emerald-600">{pricing.percentOff}% off</span>
                    )}
                </div>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1">
                    <div className="leading-none">
                        {pricing.isFree ? (
                            <span className="text-[13px] font-bold text-emerald-600">Free</span>
                        ) : (
                            <div className="flex items-baseline gap-1">
                                <span className="text-[13px] font-bold text-[#1F1533]">{inr.format(pricing.effective)}</span>
                                {pricing.original && (
                                    <span className="text-[9px] text-[#B4A9CC] line-through">{inr.format(pricing.original)}</span>
                                )}
                            </div>
                        )}
                    </div>

                    <Link
                        to={href}
                        aria-label={`Enroll in ${course.title || course.name}`}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#6D3FC0] text-white transition-transform group-hover:translate-x-0.5"
                    >
                        <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                    </Link>
                </div>
            </div>
        </motion.div>
    );
}