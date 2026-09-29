import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "framer-motion";

import {
  ArrowUpRight,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Heart,
  Layers,
  Radio,
  Users,
} from "lucide-react";

import {
  COURSE_TYPES,
  usePublishedCourses,
} from "../services/CourseService";

/* ========================================================================
   HELPERS
   ======================================================================== */

const isExternalHref = (href) =>
  typeof href === "string" && /^https?:\/\//i.test(href);

function formatDate(value) {
  if (!value) return "";

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

/* ========================================================================
   CATEGORY ICONS
   ======================================================================== */

const CATEGORY_ICONS = {
  "Web Development": BookOpen,
  "UI/UX Design": Layers,
  "Software Development": BookOpen,
  "Digital Marketing": Radio,
  "E-Accounting": BookOpen,
  "Multimedia Animation": Layers,
};

function getCategoryIcon(category) {
  return CATEGORY_ICONS[category] || BookOpen;
}

/* ========================================================================
   AMBIENT BACKGROUND
   ======================================================================== */

function AmbientBackground({ className = "" }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`}
    >
      <style>{`
        @keyframes courseAmbientDrift {
          0%, 100% {
            transform: translate(-50%, -30%) scale(1);
            border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
          }

          33% {
            transform: translate(-46%, -22%) scale(1.08);
            border-radius: 58% 42% 30% 70% / 55% 45% 45% 55%;
          }

          66% {
            transform: translate(-54%, -26%) scale(0.95);
            border-radius: 30% 70% 45% 55% / 60% 30% 70% 40%;
          }
        }

        @keyframes courseImgShimmer {
          0% {
            background-position: -400px 0;
          }

          100% {
            background-position: 400px 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .course-ambient-blob,
          .course-img-shimmer {
            animation: none !important;
          }
        }
      `}</style>

      {/* Soft dot grid, fading out toward the bottom */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(rgba(82,39,255,0.18) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "linear-gradient(to bottom, #000 0%, #000 35%, transparent 90%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 0%, #000 35%, transparent 90%)",
        }}
      />

      <div
        className="course-ambient-blob absolute left-1/2 top-0 h-[380px] w-[380px] opacity-20 blur-[90px] sm:h-[520px] sm:w-[520px]"
        style={{
          background: "linear-gradient(135deg, #1B0E3D, #5227FF)",
          animation: "courseAmbientDrift 18s ease-in-out infinite",
        }}
      />

      {/* Second, static glow for balance at the bottom-right */}
      <div className="absolute -bottom-32 -right-24 h-[320px] w-[320px] rounded-full bg-[#8B5CF6] opacity-15 blur-[100px] sm:h-[420px] sm:w-[420px]" />
    </div>
  );
}

/* ========================================================================
   CATEGORY TABS
   Centered when they fit; scroll sideways (with faded edges) when they
   don't. Click, arrow-key and auto-scroll behaviour is unchanged.
   ======================================================================== */

function CategoryTabs({ categories, activeIndex, onSelect, counts }) {
  const scrollRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    const scroller = scrollRef.current;
    const btn = listRef.current?.children[activeIndex];

    if (!scroller || !btn) return;

    const railBox = scroller.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();

    if (btnBox.left < railBox.left || btnBox.right > railBox.right) {
      btn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [activeIndex]);

  const handleKeyDown = (event, index) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();

      onSelect((index + 1) % categories.length);
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();

      onSelect((index - 1 + categories.length) % categories.length);
    }
  };

  const fade =
    "linear-gradient(to right, transparent 0, #000 20px, #000 calc(100% - 20px), transparent 100%)";

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="-mx-5 overflow-x-auto px-5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:-mx-8 sm:px-8 xl:-mx-12 xl:px-12 [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: fade, WebkitMaskImage: fade }}
      >
        <div
          ref={listRef}
          role="tablist"
          aria-label="Course categories"
          className="mx-auto flex w-max gap-2 sm:gap-2.5"
        >
          {categories.map((category, index) => {
            const isActive = index === activeIndex;
            const Icon = getCategoryIcon(category);
            const count = counts?.[category] ?? 0;

            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                onClick={() => onSelect(index)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={[
                  "relative flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold tracking-tight outline-none transition-colors duration-300",
                  "focus-visible:ring-2 focus-visible:ring-[#5227FF] focus-visible:ring-offset-2 focus-visible:ring-offset-violet-100",
                  isActive
                    ? "text-white"
                    : "border border-violet-200 bg-white text-[#1B0E3D] hover:border-violet-300",
                ].join(" ")}
              >
                {isActive && (
                  <motion.span
                    layoutId="category-pill-active"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 32,
                    }}
                    className="absolute inset-0 rounded-full shadow-[0_8px_20px_-8px_rgba(82,39,255,0.6)]"
                    style={{
                      background: "linear-gradient(120deg, #5227FF, #8B5CF6)",
                    }}
                  />
                )}

                <Icon className="relative h-4 w-4 shrink-0" strokeWidth={2.2} />

                <span className="relative">{category}</span>

                <span
                  className={[
                    "relative rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums",
                    isActive
                      ? "bg-white/25 text-white"
                      : "bg-violet-100 text-[#5227FF]",
                  ].join(" ")}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ========================================================================
   COURSE MEDIA
   ======================================================================== */

function CourseMedia({
  images,
  thumbnailUrl,
  title,
  duration,
  saved,
  onToggleSave,
}) {
  const pics = images?.length ? images : thumbnailUrl ? [thumbnailUrl] : [];

  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);

  const cycleRef = useRef(null);

  useEffect(() => {
    if (!hovering || pics.length < 2) {
      return;
    }

    cycleRef.current = setInterval(() => {
      setActive((current) => (current + 1) % pics.length);
    }, 1100);

    return () => clearInterval(cycleRef.current);
  }, [hovering, pics.length]);

  useEffect(() => {
    if (!hovering) {
      setActive(0);
    }
  }, [hovering]);

  return (
    <div
      className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {!loaded && (
        <div
          className="course-img-shimmer absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, #ece9f7 0px, #f6f4fc 40px, #ece9f7 80px)",
            backgroundSize: "600px 100%",
            animation: "courseImgShimmer 1.4s linear infinite",
          }}
        />
      )}

      {pics.length > 0 ? (
        <AnimatePresence mode="wait">
          {pics.map((src, index) =>
            index === active ? (
              <motion.img
                key={src}
                src={src}
                alt={title}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                initial={{
                  opacity: 0,
                  scale: 1.04,
                }}
                animate={{
                  opacity: 1,
                  scale: hovering ? 1.06 : 1,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: {
                    duration: 0.5,
                  },
                  scale: {
                    duration: 0.9,
                    ease: "easeOut",
                  },
                }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : null
          )}
        </AnimatePresence>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-violet-50 text-violet-300">
          <BookOpen className="h-14 w-14" strokeWidth={1.4} />
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/30 to-transparent" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />

      {duration && (
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#1B0E3D] shadow-sm backdrop-blur-sm">
          <Clock className="h-3 w-3 text-[#5227FF]" strokeWidth={2.5} />

          {duration}
        </span>
      )}

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggleSave();
        }}
        aria-label={saved ? `Remove ${title} from saved` : `Save ${title}`}
        aria-pressed={saved}
        className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 shadow-sm backdrop-blur-sm outline-none transition-transform duration-200 hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#5227FF]"
      >
        <Heart
          className={[
            "h-4 w-4 transition-colors",
            saved ? "fill-rose-500 text-rose-500" : "text-[#1B0E3D]",
          ].join(" ")}
          strokeWidth={2.2}
        />
      </button>

      {pics.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {pics.map((_, index) => (
            <span
              key={index}
              className={[
                "h-1.5 rounded-full transition-all duration-300",
                index === active ? "w-5 bg-white" : "w-1.5 bg-white/50",
              ].join(" ")}
            />
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[#1B0E3D]/0 transition-colors duration-300 group-hover:bg-[#1B0E3D]/10" />
    </div>
  );
}

/* ========================================================================
   COURSE CARD
   ======================================================================== */

const FEATURES_PREVIEW_COUNT = 3;

function CourseCard({ course, index, saved, onToggleSave, className = "" }) {
  const allFeatures = Array.isArray(course.features) ? course.features : [];

  const extraFeatureCount = Math.max(
    0,
    allFeatures.length - FEATURES_PREVIEW_COUNT
  );

  const [showAllFeatures, setShowAllFeatures] = useState(false);

  // Mobile-only: feature list AND the mode / student-count / start-date
  // row stay collapsed behind a single "Course details" dropdown. On sm:
  // and up everything is always shown.
  const [detailsOpen, setDetailsOpen] = useState(false);

  const hasCollapsibleDetails = allFeatures.length > 0;

  const visibleFeatures = showAllFeatures
    ? allFeatures
    : allFeatures.slice(0, FEATURES_PREVIEW_COUNT);

  const courseId = course.id ?? course.title;

  const courseHref = course.link || `/courses/${encodeURIComponent(courseId)}`;

  const external = isExternalHref(courseHref);

  const CourseLink = external ? "a" : Link;

  const courseLinkProps = external
    ? {
      href: courseHref,
      target: "_blank",
      rel: "noopener noreferrer",
    }
    : {
      to: courseHref,
    };

  const prefersReducedMotion = useReducedMotion();

  const rotateXRaw = useMotionValue(0);
  const rotateYRaw = useMotionValue(0);

  const rotateX = useSpring(rotateXRaw, {
    stiffness: 300,
    damping: 25,
  });

  const rotateY = useSpring(rotateYRaw, {
    stiffness: 300,
    damping: 25,
  });

  const handlePointerMove = (event) => {
    if (prefersReducedMotion) return;

    const rect = event.currentTarget.getBoundingClientRect();

    const px = (event.clientX - rect.left) / rect.width - 0.5;

    const py = (event.clientY - rect.top) / rect.height - 0.5;

    rotateYRaw.set(px * 3);
    rotateXRaw.set(py * -3);
  };

  const handlePointerLeave = () => {
    rotateXRaw.set(0);
    rotateYRaw.set(0);
  };

  const toggleDetails = (event) => {
    event.preventDefault();
    event.stopPropagation();

    setDetailsOpen((previous) => {
      const next = !previous;

      // Opening on mobile reveals everything in one tap.
      if (next) {
        setShowAllFeatures(true);
      }

      return next;
    });
  };

  const hasMeta =
    Boolean(course.mode) ||
    course.studentCount > 0 ||
    Boolean(course.startDate);

  return (
    <motion.div
      layout
      initial={{
        opacity: 0,
        y: 18,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -8,
      }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1],
      }}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      whileHover={{ y: -6 }}
      style={{
        rotateX,
        rotateY,
        transformPerspective: 1000,
      }}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_1px_2px_rgba(27,14,61,0.04),0_8px_24px_-12px_rgba(27,14,61,0.12)] transition-all duration-300 hover:border-violet-200 hover:shadow-[0_1px_2px_rgba(27,14,61,0.06),0_24px_48px_-16px_rgba(82,39,255,0.28)] ${className}`}
    >
      {/* Decorative accent bar — appears on hover */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-20 h-1 bg-gradient-to-r from-[#5227FF] via-[#8B5CF6] to-[#5227FF] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />

      <CourseLink
        {...courseLinkProps}
        className="block"
        aria-label={`View ${course.title}`}
      >
        <CourseMedia
          images={course.images}
          thumbnailUrl={course.thumbnailUrl}
          title={course.title}
          duration={course.duration}
          saved={saved}
          onToggleSave={onToggleSave}
        />
      </CourseLink>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {course.category && (
          <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-[#5227FF]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5227FF]" />
            {course.category}
          </div>
        )}

        <CourseLink {...courseLinkProps} className="hover:text-[#5227FF]">
          <h3 className="text-base font-bold leading-snug tracking-tight text-[#1B0E3D] sm:text-lg">
            {course.title}
          </h3>
        </CourseLink>

        {(course.shortDescription || course.description) && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
            {course.shortDescription || course.description}
          </p>
        )}

        {course.tags?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {course.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-violet-100 bg-violet-50/70 px-2.5 py-1 text-[11px] font-semibold text-[#5227FF]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {allFeatures.length > 0 && (
          <div className="mt-4 border-t border-violet-50 pt-4">
            <button
              type="button"
              onClick={toggleDetails}
              aria-expanded={detailsOpen}
              className="flex w-full items-center justify-between gap-2 text-xs font-semibold text-[#5227FF] outline-none transition-colors duration-150 hover:text-[#1B0E3D] focus-visible:ring-2 focus-visible:ring-[#5227FF] sm:hidden"
            >
              <span className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />

                {detailsOpen
                  ? "Hide course details"
                  : `Course details (${allFeatures.length})`}
              </span>

              <ChevronDown
                className={[
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                  detailsOpen ? "rotate-180" : "",
                ].join(" ")}
                strokeWidth={2.5}
              />
            </button>

            <ul
              className={[
                "space-y-2",
                detailsOpen ? "mt-3 block" : "hidden",
                "sm:mt-0 sm:block",
              ].join(" ")}
            >
              {visibleFeatures.map((feature) => (
                <motion.li
                  key={feature}
                  initial={false}
                  animate={{ opacity: 1 }}
                  className="flex items-start gap-2 text-[13px] text-slate-600"
                >
                  <span className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-violet-100">
                    <CheckCircle2
                      className="h-3 w-3 text-[#5227FF]"
                      strokeWidth={3}
                    />
                  </span>

                  <span className="leading-snug">{feature}</span>
                </motion.li>
              ))}

              {extraFeatureCount > 0 && (
                <li>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();

                      setShowAllFeatures((previous) => !previous);
                    }}
                    aria-expanded={showAllFeatures}
                    className="hidden w-full items-center gap-2 rounded-md pl-6 text-xs font-semibold text-[#5227FF] outline-none transition-colors duration-150 hover:text-[#1B0E3D] focus-visible:ring-2 focus-visible:ring-[#5227FF] sm:flex"
                  >
                    <Layers className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />

                    <span>
                      {showAllFeatures
                        ? "Show less"
                        : `+${extraFeatureCount} more benefit${extraFeatureCount > 1 ? "s" : ""
                        }`}
                    </span>

                    <ChevronDown
                      className={[
                        "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                        showAllFeatures ? "rotate-180" : "",
                      ].join(" ")}
                      strokeWidth={2.5}
                    />
                  </button>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Footer — pinned to the bottom of every card. */}
        <div className="mt-auto pt-5">
          <div className="-mx-4 -mb-4 flex flex-col gap-3 border-t border-violet-100 bg-violet-50/50 px-4 py-4 sm:-mx-5 sm:-mb-5 sm:px-5 sm:py-5">
            {hasMeta && (
              <div
                className={[
                  "flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500",
                  hasCollapsibleDetails
                    ? detailsOpen
                      ? "flex"
                      : "hidden"
                    : "flex",
                  "sm:flex",
                ].join(" ")}
              >
                {course.mode && (
                  <span className="font-medium leading-snug text-slate-600">
                    {course.mode}
                  </span>
                )}

                {course.studentCount > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-[#5227FF]" />

                    {Number(course.studentCount).toLocaleString("en-IN")}
                  </span>
                )}

                {course.startDate && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-[#5227FF]" />
                    Starts {formatDate(course.startDate)}
                  </span>
                )}
              </div>
            )}

            <CourseLink
              {...courseLinkProps}
              className="group/cta inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1B0E3D] px-5 py-2.5 text-sm font-semibold text-white outline-none transition-colors duration-200 hover:bg-[#5227FF] focus-visible:ring-2 focus-visible:ring-[#5227FF] focus-visible:ring-offset-2"
            >
              View Course
              <ArrowUpRight
                className="h-4 w-4 transition-transform duration-200 group-hover/cta:-translate-y-0.5 group-hover/cta:translate-x-0.5"
                strokeWidth={2.5}
              />
            </CourseLink>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ========================================================================
   MAIN COMPONENT
   ======================================================================== */

export default function LiveCourses({
  title = "Our Courses",
  subtitle = "Real-Time Learning With Lifetime Access.",
  // eslint-disable-next-line no-unused-vars
  exploreAllHref = "/courses",
}) {
  /*
   * Courses come directly from the Supabase database.
   * Only published LONG courses appear here.
   */
  const { courses, loading, error } = usePublishedCourses(COURSE_TYPES.LONG);

  const [activeIndex, setActiveIndex] = useState(0);

  const [savedIds, setSavedIds] = useState(() => new Set());
  const courseRailRef = useRef(null);

  const [searchParams] = useSearchParams();
  const requestedCategory = searchParams.get("category");

  // `location.key` changes on every navigation (even to the same path),
  // which lets the effects below re-fire on repeat clicks.
  const location = useLocation();
  const navigate = useNavigate();

  /* ======================================================================
     BUILD CATEGORIES FROM Supabase database
     ====================================================================== */

  const categories = useMemo(() => {
    const uniqueCategories = new Set();

    courses.forEach((course) => {
      const category = course.category?.trim();

      if (category) {
        uniqueCategories.add(category);
      }
    });

    return Array.from(uniqueCategories).sort((a, b) => a.localeCompare(b));
  }, [courses]);

  /* ======================================================================
     KEEP ACTIVE INDEX VALID
     ====================================================================== */

  useEffect(() => {
    if (categories.length === 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= categories.length) {
      setActiveIndex(0);
    }
  }, [categories.length, activeIndex]);

  /* ======================================================================
     JUMP TO THE CATEGORY REQUESTED VIA ?category=
     ====================================================================== */

  const appliedKeyRef = useRef(null);

  useEffect(() => {
    if (
      !requestedCategory ||
      categories.length === 0 ||
      appliedKeyRef.current === location.key
    ) {
      return;
    }

    const index = categories.findIndex(
      (category) => category.toLowerCase() === requestedCategory.toLowerCase()
    );

    if (index !== -1) {
      setActiveIndex(index);
    }

    appliedKeyRef.current = location.key;
  }, [requestedCategory, categories, location.key]);

  /* ======================================================================
     SCROLL TO THIS SECTION WHEN ARRIVING VIA #live-courses
     ====================================================================== */

  useEffect(() => {
    if (location.hash !== "#live-courses") {
      return;
    }

    // A refresh should reopen Home at the hero, even when the previous
    // session left the courses anchor in the address bar.
    const isReload =
      performance.getEntriesByType("navigation")[0]?.type === "reload";
    if (location.key === "default" && isReload) {
      navigate(`${location.pathname}${location.search}`, { replace: true });
      window.scrollTo(0, 0);
      return;
    }

    const frame = requestAnimationFrame(() => {
      document.getElementById("live-courses")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [
    location.key,
    location.hash,
    location.pathname,
    location.search,
    navigate,
  ]);

  const activeCategory = categories[activeIndex] ?? null;

  /* ======================================================================
     FILTER COURSES BY CATEGORY
     ====================================================================== */

  const visibleCourses = useMemo(() => {
    if (!activeCategory) {
      return [];
    }

    return courses.filter(
      (course) => course.category?.trim() === activeCategory
    );
  }, [courses, activeCategory]);

  /* ======================================================================
     CATEGORY COUNTS
     ====================================================================== */

  const categoryCounts = useMemo(() => {
    const counts = {};

    categories.forEach((category) => {
      counts[category] = courses.filter(
        (course) => course.category?.trim() === category
      ).length;
    });

    return counts;
  }, [categories, courses]);

  /* ======================================================================
     SAVE / UNSAVE
     ====================================================================== */

  const toggleSaved = (id) => {
    setSavedIds((previous) => {
      const next = new Set(previous);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  /* ======================================================================
     LOADING
     ====================================================================== */

  if (loading) {
    return (
      <section
        id="live-courses"
        className="relative overflow-hidden bg-violet-100 py-16 sm:py-24"
      >
        <AmbientBackground />

        <div className="relative z-10 mx-auto flex max-w-7xl items-center justify-center px-5">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-[#5227FF]" />

            <p className="mt-4 text-sm text-slate-500">Loading courses...</p>
          </div>
        </div>
      </section>
    );
  }

  /* ======================================================================
     ERROR
     ====================================================================== */

  if (error) {
    return (
      <section
        id="live-courses"
        className="relative overflow-hidden bg-violet-100 py-16 sm:py-24"
      >
        <AmbientBackground />

        <div className="relative z-10 mx-auto max-w-3xl px-5">
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <h3 className="text-lg font-bold text-red-800">
              Unable to load courses
            </h3>

            <p className="mt-2 text-sm leading-6 text-red-600">{error}</p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-xl bg-[#1B0E3D] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#5227FF]"
            >
              Try Again
            </button>
          </div>
        </div>
      </section>
    );
  }

  /* ======================================================================
     PAGE
     ====================================================================== */

  return (
    <section
      id="live-courses"
      className="relative overflow-hidden bg-violet-100 py-12 sm:py-20 lg:py-24"
    >
      <AmbientBackground />

      <div className="relative z-10 mx-auto max-w-[1440px] px-5 sm:px-8 xl:px-12">
        {/* HEADER — centered */}
        <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
          {title && (
            <h2 className="font-[Space_Grotesk,sans-serif] text-[40px] font-bold tracking-tight text-[#1B0E3D] sm:text-4xl lg:text-5xl">
              {title === "Our Courses" ? (
                <>Our <span className="text-[#5227FF]">Courses</span></>
              ) : title}
            </h2>
          )}

          {subtitle && (
            <p className=" max-w-xl text-sm leading-relaxed text-slate-900 sm:text-base">
              {subtitle}
            </p>
          )}

          <span
            aria-hidden="true"
            className="mt-3 block h-1 w-40 rounded-full bg-gradient-to-r from-[#5227FF] to-[#8B5CF6]"
          />
        </div>

        {/* CATEGORIES */}
        {categories.length > 0 && (
          <div className="mt-5 sm:mt-8">
            <CategoryTabs
              categories={categories}
              activeIndex={activeIndex}
              onSelect={setActiveIndex}
              counts={categoryCounts}
            />
          </div>
        )}

        {/* COURSE COUNT */}
        {visibleCourses.length > 0 && (
          <div className="relative mx-auto mt-2 flex w-full items-center justify-center gap-2 sm:mt-6 sm:max-w-xl sm:gap-4">
            <span
              aria-hidden="true"
              className="hidden h-px flex-1 bg-gradient-to-r from-transparent to-violet-300 sm:block"
            />

            <p className="text-center text-xs font-bold uppercase text-slate-500">
              {visibleCourses.length} course
              {visibleCourses.length > 1 ? "s" : ""} in {activeCategory}

              {savedIds.size > 0 && (
                <span className="ml-3 inline-flex items-center gap-1 text-rose-500">
                  <Heart className="h-3 w-3 fill-rose-500" />

                  {savedIds.size} saved
                </span>
              )}
            </p>

            <span
              aria-hidden="true"
              className="hidden h-px flex-1 bg-gradient-to-l from-transparent to-violet-300 sm:block"
            />
            {categories.length > 1 && (
              <motion.button
                type="button"
                aria-label="Show next course category"
                onClick={() => setActiveIndex((activeIndex + 1) % categories.length)}
                animate={{ x: [0, 6, 0] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute right-0 flex h-8 w-10 items-center justify-center text-[#5227FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5227FF] sm:hidden"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </motion.button>
            )}
          </div>
        )}

        {/* Course cards scroll horizontally, including categories with only two courses. */}
        <div className="relative mt-5 min-w-0">
          {visibleCourses.length > 1 && (
            <div className="mb-3 flex justify-end gap-2">
              <button type="button" aria-label="Scroll courses left" onClick={() => {
                const rail = courseRailRef.current;
                const step = (rail?.firstElementChild?.getBoundingClientRect().width || 0) + 24;
                rail?.scrollBy({ left: -step, behavior: "smooth" });
              }} className="flex h-9 w-9 items-center justify-center rounded-full border border-violet-300 bg-white text-[#5227FF] hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5227FF]">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <button type="button" aria-label="Scroll courses right" onClick={() => {
                const rail = courseRailRef.current;
                const step = (rail?.firstElementChild?.getBoundingClientRect().width || 0) + 24;
                rail?.scrollBy({ left: step, behavior: "smooth" });
              }} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#5227FF] text-white hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5227FF] focus-visible:ring-offset-2">
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory ?? "empty"}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {visibleCourses.length > 0 ? (
                <div
                  ref={courseRailRef}
                  className={`mx-auto flex max-w-6xl snap-x snap-mandatory gap-6 overflow-x-auto pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                    visibleCourses.length === 1
                      ? "justify-center"
                      : "pr-[12%] sm:pr-0"
                  }`}
                >
                  {visibleCourses.map((course, index) => {
                    const id = course.id ?? course.title;

                    return (
                      <CourseCard
                        key={id}
                        course={course}
                        index={index}
                        saved={savedIds.has(id)}
                        onToggleSave={() => toggleSaved(id)}
                        className="w-[88%] shrink-0 snap-start sm:w-[60%] lg:w-[55%]"
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-3xl border border-dashed border-violet-300 bg-white/60 py-14 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-100">
                    <BookOpen
                      className="h-7 w-7 text-[#5227FF]"
                      strokeWidth={1.6}
                    />
                  </span>

                  <p className="text-sm text-slate-500">
                    {courses.length === 0
                      ? "No published live courses yet."
                      : "No courses in this category yet."}
                  </p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
