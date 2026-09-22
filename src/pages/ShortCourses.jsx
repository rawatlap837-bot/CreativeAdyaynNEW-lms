import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Clock3,
  Filter,
  GraduationCap,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
  Zap,
} from "lucide-react";

import {
  COURSE_TYPES,
  usePublishedCourses,
} from "../services/CourseService";

/* ================================================================
   BRAND
================================================================ */

const BRAND = {
  violet: "#5b21b6",
  violetDark: "#4c1d95",
  orange: "#f97316",
};

/* ================================================================
   LAYOUT
================================================================ */

const HEADER_CLEARANCE = "pt-24 sm:pt-28";
const FILTER_BAR_TOP = "top-16";

/* ================================================================
   NEW LAUNCH SETTINGS
================================================================ */

/* A course counts as "new" if it was published within this window */
const NEW_WINDOW_DAYS = 45;

/* How many launches appear in the scrolling strip */
const MAX_LAUNCHES = 10;

/* Seconds per card — loop time grows with the number of cards */
const SECONDS_PER_CARD = 6;

/* ================================================================
   FORMATTERS
================================================================ */

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactNumber = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/* ================================================================
   SORT OPTIONS
================================================================ */

const SORT_OPTIONS = [
  {
    value: "featured",
    label: "Featured",
  },
  {
    value: "newest",
    label: "Newest",
  },
  {
    value: "popular",
    label: "Most popular",
  },
  {
    value: "price-asc",
    label: "Price: Low to high",
  },
  {
    value: "price-desc",
    label: "Price: High to low",
  },
  {
    value: "title",
    label: "A–Z",
  },
];

/* ================================================================
   HELPERS
================================================================ */

function getPricing(course) {
  const price = Number(course.price) || 0;
  const discountPrice = Number(course.discountPrice) || 0;

  const hasDiscount =
    discountPrice > 0 &&
    price > 0 &&
    discountPrice < price;

  const effectivePrice = hasDiscount
    ? discountPrice
    : price;

  const percentOff = hasDiscount
    ? Math.round(((price - discountPrice) / price) * 100)
    : 0;

  return {
    price,
    discountPrice,
    effective: effectivePrice,
    original: hasDiscount ? price : null,
    percentOff,
    isFree: effectivePrice <= 0,
  };
}

function getCourseTitle(course) {
  return (
    course.title ||
    course.name ||
    "Untitled course"
  );
}

function getDescription(course) {
  return (
    course.shortDescription ||
    course.description ||
    "Build practical skills through a focused learning experience."
  );
}

function getLevel(course) {
  return (
    course.level ||
    course.difficulty ||
    "All levels"
  );
}

function getMode(course) {
  return (
    course.mode ||
    "Online"
  );
}

/* --------------------------------------------------------------
   DATE HANDLING
   Supabase database returns Timestamp objects, but a course may also
   carry a Date, an ISO string, or millis depending on how it
   was written. Normalise all of them to a number.
-------------------------------------------------------------- */

function getCreatedTime(course) {
  const raw =
    course?.publishedAt ??
    course?.createdAt ??
    course?.created_at ??
    course?.updatedAt;

  if (!raw) {
    return 0;
  }

  if (typeof raw?.toDate === "function") {
    return raw.toDate().getTime();
  }

  if (typeof raw?.seconds === "number") {
    return raw.seconds * 1000;
  }

  if (raw instanceof Date) {
    return raw.getTime();
  }

  const parsed = new Date(raw).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
}

function isNewCourse(course, days = NEW_WINDOW_DAYS) {
  const created = getCreatedTime(course);

  if (!created) {
    return false;
  }

  return (
    Date.now() - created <=
    days * 24 * 60 * 60 * 1000
  );
}

function useDebounced(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/* ================================================================
   MAIN PAGE
================================================================ */

export default function ShortCourses() {
  const {
    courses,
    loading,
    error,
  } = usePublishedCourses(COURSE_TYPES.SHORT);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");

  const query = useDebounced(search)
    .trim()
    .toLowerCase();

  const hasFilters =
    Boolean(search.trim()) ||
    category !== "all";

  /* --------------------------------------------------------------
     SCROLL TO TOP
  -------------------------------------------------------------- */

  const scrollToTop = useCallback(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion
        ? "auto"
        : "smooth",
    });
  }, []);

  /* Jump back to the top whenever the visible result set changes,
     so a new filter never leaves the user mid-page. */
  useEffect(() => {
    if (loading) {
      return;
    }

    scrollToTop();
  }, [query, category, sort, loading, scrollToTop]);

  /* --------------------------------------------------------------
     NEW LAUNCHES
  -------------------------------------------------------------- */

  const launches = useMemo(() => {
    const byNewest = [...courses].sort(
      (a, b) => getCreatedTime(b) - getCreatedTime(a)
    );

    const recent = byNewest.filter((course) =>
      isNewCourse(course)
    );

    /* Fall back to the newest courses so the strip never
       disappears during a quiet month. */
    const source =
      recent.length > 0 ? recent : byNewest;

    return source.slice(0, MAX_LAUNCHES);
  }, [courses]);

  /* --------------------------------------------------------------
     CATEGORIES
  -------------------------------------------------------------- */

  const categories = useMemo(() => {
    const unique = new Set();

    courses.forEach((course) => {
      const value = course.category?.trim();

      if (value) {
        unique.add(value);
      }
    });

    return [
      "all",
      ...Array.from(unique).sort((a, b) =>
        a.localeCompare(b)
      ),
    ];
  }, [courses]);

  /* --------------------------------------------------------------
     FILTER + SORT
  -------------------------------------------------------------- */

  const visibleCourses = useMemo(() => {
    const filtered = courses.filter((course) => {
      if (
        category !== "all" &&
        course.category !== category
      ) {
        return false;
      }

      if (!query) {
        return true;
      }

      const searchableText = [
        getCourseTitle(course),
        course.shortDescription,
        course.description,
        course.category,
        course.instructor,
        getLevel(course),
        getMode(course),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(query);
    });

    const sorted = [...filtered];

    sorted.sort((a, b) => {
      switch (sort) {
        case "newest":
          return (
            getCreatedTime(b) - getCreatedTime(a)
          );

        case "popular":
          return (
            (Number(b.studentCount) || 0) -
            (Number(a.studentCount) || 0)
          );

        case "price-asc":
          return (
            getPricing(a).effective -
            getPricing(b).effective
          );

        case "price-desc":
          return (
            getPricing(b).effective -
            getPricing(a).effective
          );

        case "title":
          return getCourseTitle(a).localeCompare(
            getCourseTitle(b)
          );

        case "featured":
        default: {
          /* Featured first, then newest within each group so a
             fresh launch outranks an older course. */
          const byFeatured =
            Number(Boolean(b.featured)) -
            Number(Boolean(a.featured));

          if (byFeatured !== 0) {
            return byFeatured;
          }

          return (
            getCreatedTime(b) - getCreatedTime(a)
          );
        }
      }
    });

    return sorted;
  }, [
    courses,
    query,
    category,
    sort,
  ]);

  const showFilters =
    !error &&
    (loading || courses.length > 0);

  const showLaunches =
    !error &&
    !loading &&
    launches.length > 0;

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setSort("featured");
  }

  return (
    <div className="min-h-screen bg-white">

      <PageHeader courseCount={courses.length} />

      {showLaunches && (
        <NewCourseLaunches launches={launches} />
      )}

      {showFilters && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          categories={categories}
          category={category}
          onCategoryChange={setCategory}
          sort={sort}
          onSortChange={setSort}
          disabled={loading}
        />
      )}

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">

        {error ? (
          <ErrorState message={error} />
        ) : loading ? (
          <CourseGridSkeleton />
        ) : (
          <>
            {courses.length > 0 && (
              <CourseResultsHeader
                category={category}
                visibleCount={visibleCourses.length}
                totalCount={courses.length}
                hasFilters={hasFilters}
              />
            )}

            {visibleCourses.length === 0 ? (
              <EmptyState
                hasFilters={hasFilters}
                onClearFilters={clearFilters}
              />
            ) : (
              <ul
                className="
                  grid
                  gap-6
                  sm:grid-cols-2
                  xl:grid-cols-3
                "
              >
                {visibleCourses.map((course) => (
                  <li
                    key={course.id}
                    className="flex"
                  >
                    <CourseCard course={course} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <ScrollToTopButton onClick={scrollToTop} />
    </div>
  );
}

/* ================================================================
   NEW COURSE LAUNCHES
   Auto-scrolling strip of the most recent courses. The track is
   duplicated and shifted by exactly 50%, which makes the loop
   seamless. Pauses on hover and on keyboard focus.
================================================================ */

function NewCourseLaunches({ launches }) {
  /* A short list just jitters, so only animate once there is
     enough content to fill more than the viewport. */
  const shouldScroll = launches.length >= 3;

  const duration = launches.length * SECONDS_PER_CARD;

  const track = shouldScroll
    ? [...launches, ...launches]
    : launches;

  return (
    <section
      aria-label="New course launches"
      className="border-b border-slate-200 bg-slate-50"
    >
      <style>{`
        @keyframes launch-marquee {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }

        .launch-track {
          display: flex;
          gap: 1rem;
          width: max-content;
        }

        .launch-track--animated {
          animation: launch-marquee var(--launch-duration, 60s) linear infinite;
        }

        .launch-viewport:hover .launch-track--animated,
        .launch-viewport:focus-within .launch-track--animated {
          animation-play-state: paused;
        }

        @media (prefers-reduced-motion: reduce) {
          .launch-track--animated {
            animation: none;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">

        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-bold text-slate-900">
            <Sparkles
              size={16}
              className="text-orange-500"
            />

            Just launched
          </h2>

          <p className="text-xs text-slate-500">
            {shouldScroll
              ? "Hover to pause"
              : `${launches.length} new`}
          </p>
        </div>

        <div
          className="
            launch-viewport
            overflow-x-auto
            [scrollbar-width:none]
            [&::-webkit-scrollbar]:hidden
          "
        >
          <ul
            className={`launch-track ${shouldScroll
              ? "launch-track--animated"
              : ""
              }`}
            style={{
              "--launch-duration": `${duration}s`,
            }}
          >
            {track.map((course, index) => (
              <li
                key={`${course.id}-${index}`}
                aria-hidden={
                  shouldScroll &&
                  index >= launches.length
                }
              >
                <LaunchCard course={course} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   LAUNCH CARD
================================================================ */

function LaunchCard({ course }) {
  const pricing = getPricing(course);

  const thumbnail =
    course.thumbnailUrl ||
    course.imageUrl ||
    course.thumbnail;

  return (
    <Link
      to={`/courses/${course.id}`}
      className="
        group
        flex w-72
        items-center gap-3
        rounded-xl
        border border-slate-200
        bg-white
        p-3
        transition
        hover:border-violet-200
        hover:shadow-md
        hover:shadow-violet-900/[0.06]
        focus-visible:outline
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-violet-700
      "
    >
      <div
        className="
          flex h-14 w-14 shrink-0
          items-center justify-center
          overflow-hidden
          rounded-lg
          bg-gradient-to-br from-violet-100 to-orange-50
          text-violet-300
        "
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <BookOpen size={20} />
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-violet-700">
          {getCourseTitle(course)}
        </p>

        <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span className="rounded bg-orange-50 px-1.5 py-0.5 font-semibold text-orange-600">
            New
          </span>

          <span>
            {pricing.isFree
              ? "Free"
              : inr.format(pricing.effective)}
          </span>
        </p>
      </div>
    </Link>
  );
}

/* ================================================================
   SCROLL TO TOP BUTTON
================================================================ */

function ScrollToTopButton({ onClick }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setVisible(window.scrollY > 600);
    }

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () =>
      window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to top"
      className="
        fixed bottom-6 right-6
        z-40
        flex h-12 w-12
        items-center justify-center
        rounded-full
        bg-violet-700
        text-white
        shadow-lg
        shadow-violet-900/20
        transition
        hover:bg-violet-800
        focus-visible:outline
        focus-visible:outline-2
        focus-visible:outline-offset-2
        focus-visible:outline-violet-700
      "
    >
      <ArrowUp size={20} />
    </button>
  );
}

/* ================================================================
   PAGE HEADER
================================================================ */

function PageHeader({ courseCount }) {
  return (
    <section className="relative overflow-hidden border-b border-violet-100 bg-gradient-to-br from-violet-50 via-white to-orange-50">

      {/* Decorative background */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-violet-200/30 blur-3xl" />

      <div className="pointer-events-none absolute -bottom-40 -left-20 h-80 w-80 rounded-full bg-orange-200/20 blur-3xl" />

      <div
        className={`
          relative mx-auto max-w-7xl
          px-4 pb-12
          sm:px-6 sm:pb-16
          lg:px-8 lg:pb-20
          ${HEADER_CLEARANCE}
        `}
      >

        <div className="max-w-4xl">

          {/* Eyebrow */}
          <div
            className="
              mb-5 inline-flex items-center gap-2
              rounded-full
              border border-violet-200
              bg-white/80
              px-3.5 py-2
              text-xs font-bold
              text-violet-700
              shadow-sm
              backdrop-blur
            "
          >
            <GraduationCap size={15} />

            Practical digital skills

            {courseCount > 0 && (
              <>
                <span className="text-slate-300">
                  •
                </span>

                <span className="text-slate-500">
                  {courseCount} courses
                </span>
              </>
            )}
          </div>

          {/* Heading */}
          <h1
            className="
              max-w-4xl
              text-[2.35rem]
              font-extrabold
              leading-[1.06]
              tracking-tight
              text-slate-950
              sm:text-5xl
              lg:text-6xl
          "
          >
            Learn a skill.
            <br />

            <span className="text-violet-700">
              Build something real.
            </span>
          </h1>

          {/* Description */}
          <p
            className="
              mt-5
              max-w-2xl
              text-base
              leading-7
              text-slate-600
              sm:text-lg
          "
          >
            Short, practical courses designed to help you
            learn valuable digital skills, complete real
            projects, and move closer to your career goals.
          </p>

          {/* Trust points */}
          <div
            className="
              mt-7
              flex flex-wrap
              gap-x-5 gap-y-3
              text-sm
              font-medium
              text-slate-600
          "
          >
            <TrustPoint text="Practical learning" />
            <TrustPoint text="Project-focused" />
            <TrustPoint text="Learn at your pace" />
          </div>

        </div>
      </div>
    </section>
  );
}

/* ================================================================
   TRUST POINT
================================================================ */

function TrustPoint({ text }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 size={14} />
      </span>

      {text}
    </span>
  );
}

/* ================================================================
   FILTER BAR
================================================================ */

function FilterBar({
  search,
  onSearchChange,
  categories,
  category,
  onCategoryChange,
  sort,
  onSortChange,
  disabled,
}) {
  const showCategories =
    categories.length > 2;

  return (
    <section
      className={`
        sticky ${FILTER_BAR_TOP}
        z-30
        border-b border-slate-200
        bg-white/90
        backdrop-blur-xl
      `}
    >
      <div
        className="
          mx-auto max-w-7xl
          px-4 py-3
          sm:px-6 sm:py-4
          lg:px-8
        "
      >
        <div
          className="
            flex flex-col gap-3
            lg:flex-row
            lg:items-center
            lg:justify-between
            lg:gap-6
          "
        >

          {/* Search */}
          <div className="relative w-full lg:max-w-md">

            <Search
              size={18}
              className="
                pointer-events-none
                absolute left-4 top-1/2
                -translate-y-1/2
                text-slate-400
              "
            />

            <label
              htmlFor="course-search"
              className="sr-only"
            >
              Search short courses
            </label>

            <input
              id="course-search"
              type="search"
              value={search}
              disabled={disabled}
              onChange={(event) =>
                onSearchChange(event.target.value)
              }
              placeholder="Search courses, skills or categories..."
              className="
                w-full
                rounded-xl
                border border-slate-200
                bg-slate-50
                py-3
                pl-11 pr-11
                text-sm
                text-slate-950
                outline-none
                transition
                placeholder:text-slate-400
                focus:border-violet-500
                focus:bg-white
                focus:ring-4
                focus:ring-violet-500/10
                disabled:opacity-60
              "
            />

            {search && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Clear search"
                className="
                  absolute right-3 top-1/2
                  -translate-y-1/2
                  rounded-full
                  p-1.5
                  text-slate-400
                  transition
                  hover:bg-slate-100
                  hover:text-slate-700
                "
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Right controls */}
          <div className="flex min-w-0 items-center gap-2">

            {showCategories && (
              <div
                role="group"
                aria-label="Course categories"
                className="
                  -mx-1
                  flex min-w-0 flex-1
                  items-center gap-2
                  overflow-x-auto
                  px-1 py-1
                  [scrollbar-width:none]
                  [&::-webkit-scrollbar]:hidden
                "
              >
                {categories.map((item) => {
                  const selected =
                    category === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      onClick={() =>
                        onCategoryChange(item)
                      }
                      className={`
                        shrink-0
                        rounded-full
                        px-4 py-2
                        text-sm
                        font-semibold
                        transition
                        disabled:opacity-60
                        ${selected
                          ? "bg-violet-700 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                        }
                      `}
                    >
                      {item === "all"
                        ? "All"
                        : item}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Sort */}
            <div className="relative shrink-0">
              <SlidersHorizontal
                size={15}
                className="
                  pointer-events-none
                  absolute left-3 top-1/2
                  -translate-y-1/2
                  text-slate-400
                "
              />

              <label
                htmlFor="course-sort"
                className="sr-only"
              >
                Sort courses
              </label>

              <select
                id="course-sort"
                value={sort}
                disabled={disabled}
                onChange={(event) =>
                  onSortChange(event.target.value)
                }
                className="
                  rounded-xl
                  border border-slate-200
                  bg-slate-50
                  py-2.5
                  pl-9 pr-8
                  text-sm
                  font-semibold
                  text-slate-700
                  outline-none
                  transition
                  focus:border-violet-500
                  focus:bg-white
                  focus:ring-4
                  focus:ring-violet-500/10
                "
              >
                {SORT_OPTIONS.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   RESULTS HEADER
================================================================ */

function CourseResultsHeader({
  category,
  visibleCount,
  totalCount,
  hasFilters,
}) {
  return (
    <div
      className="
        mb-6
        flex flex-wrap
        items-center
        justify-between
        gap-3
      "
    >
      <div>
        <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
          {category === "all"
            ? "Explore short courses"
            : category}
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          {hasFilters
            ? `${visibleCount} of ${totalCount} courses`
            : `${totalCount} courses available`}
        </p>
      </div>

      <div
        className="
          hidden
          items-center gap-2
          rounded-full
          bg-violet-50
          px-3 py-1.5
          text-xs
          font-semibold
          text-violet-700
          sm:flex
        "
      >
        <BookOpen size={14} />

        Learn. Practice. Grow.
      </div>
    </div>
  );
}

/* ================================================================
   COURSE CARD
================================================================ */

function CourseCard({ course }) {
  const [imageFailed, setImageFailed] =
    useState(false);

  const pricing = getPricing(course);

  const title = getCourseTitle(course);
  const description = getDescription(course);

  const students =
    Number(course.studentCount) || 0;

  const thumbnail =
    course.thumbnailUrl ||
    course.imageUrl ||
    course.thumbnail;

  const showImage =
    Boolean(thumbnail) &&
    !imageFailed;

  const isNew = isNewCourse(course);

  const href =
    `/courses/${course.id}`;

  return (
    <article
      className="
        group
        relative
        flex w-full
        flex-col
        overflow-hidden
        rounded-2xl
        border border-slate-200
        bg-white
        transition-all
        duration-300
        hover:-translate-y-1
        hover:border-violet-200
        hover:shadow-xl
        hover:shadow-violet-900/[0.07]
      "
    >

      {/* ----------------------------------------------------------
          IMAGE
      ---------------------------------------------------------- */}

      <div
        className="
          relative
          aspect-[16/9]
          overflow-hidden
          bg-gradient-to-br
          from-violet-100
          to-slate-100
        "
      >
        {showImage ? (
          <img
            src={thumbnail}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() =>
              setImageFailed(true)
            }
            className="
              h-full w-full
              object-cover
              transition duration-500
              group-hover:scale-105
            "
          />
        ) : (
          <div
            className="
              flex h-full w-full
              items-center justify-center
              bg-gradient-to-br
              from-violet-100
              via-violet-50
              to-orange-50
              text-violet-300
            "
          >
            <BookOpen size={44} />
          </div>
        )}

        {/* Image overlay */}
        <div
          className="
            pointer-events-none
            absolute inset-0
            bg-gradient-to-t
            from-black/25
            via-transparent
            to-transparent
          "
        />

        {/* Top badges */}
        <div
          className="
            absolute inset-x-3 top-3
            flex items-start
            justify-between
            gap-2
          "
        >
          <div className="flex flex-wrap gap-2">

            {isNew && (
              <span
                className="
                  inline-flex items-center gap-1.5
                  rounded-full
                  bg-orange-500
                  px-3 py-1.5
                  text-xs
                  font-bold
                  text-white
                  shadow-sm
                "
              >
                <Sparkles size={12} />

                New
              </span>
            )}

            {course.featured && (
              <span
                className="
                  inline-flex items-center gap-1.5
                  rounded-full
                  bg-white/95
                  px-3 py-1.5
                  text-xs
                  font-bold
                  text-violet-700
                  shadow-sm
                  backdrop-blur
                "
              >
                <Zap size={12} />

                Featured
              </span>
            )}

            {course.popular && (
              <span
                className="
                  rounded-full
                  bg-violet-700
                  px-3 py-1.5
                  text-xs
                  font-bold
                  text-white
                  shadow-sm
                "
              >
                Popular
              </span>
            )}
          </div>

          {pricing.percentOff > 0 && (
            <span
              className="
                shrink-0
                rounded-full
                bg-emerald-600
                px-3 py-1.5
                text-xs
                font-bold
                text-white
                shadow-sm
              "
            >
              {pricing.percentOff}% OFF
            </span>
          )}
        </div>

        {/* Category */}
        {course.category && (
          <span
            className="
              absolute
              bottom-3 left-3
              rounded-full
              bg-black/60
              px-3 py-1.5
              text-[11px]
              font-semibold
              text-white
              backdrop-blur
            "
          >
            {course.category}
          </span>
        )}
      </div>

      {/* ----------------------------------------------------------
          CONTENT
      ---------------------------------------------------------- */}

      <div className="flex flex-1 flex-col p-5">

        {/* Title */}
        <h3
          className="
            text-lg
            font-bold
            leading-7
            text-slate-950
          "
        >
          <Link
            to={href}
            className="
              transition
              group-hover:text-violet-700
              focus-visible:outline-none
            "
          >
            {title}
          </Link>
        </h3>

        {/* Description */}
        <p
          className="
            mt-2
            line-clamp-2
            text-sm
            leading-6
            text-slate-500
          "
        >
          {description}
        </p>

        {/* --------------------------------------------------------
            COURSE META
        -------------------------------------------------------- */}

        <div
          className="
            mt-4
            flex flex-wrap
            gap-x-4 gap-y-2
            text-xs
            text-slate-500
          "
        >
          {course.duration && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={14} />

              {course.duration}
            </span>
          )}

          {course.level && (
            <span className="inline-flex items-center gap-1.5">
              <GraduationCap size={14} />

              {getLevel(course)}
            </span>
          )}

          {students > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} />

              {compactNumber.format(students)}
            </span>
          )}
        </div>

        {/* Mode */}
        <div className="mt-3">
          <span
            className="
              inline-flex
              rounded-md
              bg-slate-50
              px-2.5 py-1
              text-xs
              font-medium
              text-slate-600
            "
          >
            {getMode(course)}
          </span>
        </div>

        {/* --------------------------------------------------------
            FOOTER
        -------------------------------------------------------- */}

        <div className="mt-auto pt-5">

          <div className="mb-5 h-px bg-slate-100" />

          <div
            className="
              flex
              items-end
              justify-between
              gap-4
            "
          >

            {/* Price */}
            <Price pricing={pricing} />

            {/* CTA */}
            <Link
              to={href}
              className="
                relative
                z-10
                inline-flex
                shrink-0
                items-center
                gap-2
                rounded-xl
                bg-violet-700
                px-4 py-2.5
                text-sm
                font-semibold
                text-white
                transition
                hover:bg-violet-800
                focus-visible:outline
                focus-visible:outline-2
                focus-visible:outline-offset-2
                focus-visible:outline-violet-700
              "
            >
              View course

              <ArrowRight
                size={16}
                className="
                  transition-transform
                  group-hover:translate-x-0.5
                "
              />
            </Link>

          </div>
        </div>
      </div>
    </article>
  );
}

/* ================================================================
   PRICE
================================================================ */

function Price({ pricing }) {
  if (pricing.isFree) {
    return (
      <div>
        <p className="text-lg font-bold text-emerald-600">
          Free
        </p>

        <p className="text-[11px] text-slate-400">
          Start learning
        </p>
      </div>
    );
  }

  return (
    <div>

      <div className="flex items-baseline gap-2">

        <span className="text-lg font-bold text-slate-950">
          {inr.format(pricing.effective)}
        </span>

        {pricing.original && (
          <span className="text-xs text-slate-400 line-through">
            {inr.format(pricing.original)}
          </span>
        )}
      </div>

      {pricing.percentOff > 0 && (
        <p className="mt-0.5 text-[11px] font-medium text-emerald-600">
          Save {pricing.percentOff}%
        </p>
      )}
    </div>
  );
}

/* ================================================================
   SKELETON
================================================================ */

function CourseGridSkeleton({ count = 6 }) {
  return (
    <div
      className="
        grid gap-6
        sm:grid-cols-2
        xl:grid-cols-3
      "
      role="status"
      aria-label="Loading courses"
    >
      {Array.from({ length: count }).map(
        (_, index) => (
          <div
            key={index}
            className="
              overflow-hidden
              rounded-2xl
              border border-slate-200
              bg-white
            "
          >
            <div className="aspect-[16/9] animate-pulse bg-slate-100" />

            <div className="space-y-4 p-5">

              <div className="h-5 w-4/5 animate-pulse rounded bg-slate-100" />

              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />

              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />

              <div className="flex gap-3 pt-2">
                <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="h-6 w-20 animate-pulse rounded bg-slate-100" />

                <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
              </div>

            </div>
          </div>
        )
      )}
    </div>
  );
}

/* ================================================================
   EMPTY STATE
================================================================ */

function EmptyState({
  hasFilters,
  onClearFilters,
}) {
  return (
    <div
      className="
        rounded-3xl
        border border-dashed
        border-slate-300
        bg-slate-50
        px-6 py-16
        text-center
      "
    >
      <div
        className="
          mx-auto
          flex h-16 w-16
          items-center justify-center
          rounded-2xl
          bg-white
          text-violet-400
          shadow-sm
        "
      >
        {hasFilters ? (
          <Search size={26} />
        ) : (
          <BookOpen size={26} />
        )}
      </div>

      <h3 className="mt-5 text-xl font-bold text-slate-950">
        {hasFilters
          ? "No courses found"
          : "Short courses coming soon"}
      </h3>

      <p
        className="
          mx-auto mt-2
          max-w-md
          text-sm
          leading-6
          text-slate-500
        "
      >
        {hasFilters
          ? "Try another search term or explore all available categories."
          : "Courses will appear here once they are published by the institute."}
      </p>

      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="
            mt-6
            inline-flex
            items-center
            gap-2
            rounded-xl
            bg-violet-700
            px-5 py-2.5
            text-sm
            font-semibold
            text-white
            transition
            hover:bg-violet-800
          "
        >
          <Filter size={16} />

          Clear filters
        </button>
      )}
    </div>
  );
}

/* ================================================================
   ERROR
================================================================ */

function ErrorState({ message }) {
  return (
    <div
      role="alert"
      className="
        mx-auto
        max-w-xl
        rounded-3xl
        border border-red-200
        bg-red-50
        px-6 py-12
        text-center
      "
    >
      <div
        className="
          mx-auto
          flex h-14 w-14
          items-center justify-center
          rounded-2xl
          bg-white
          text-red-600
          shadow-sm
        "
      >
        <AlertCircle size={25} />
      </div>

      <h2 className="mt-5 text-lg font-bold text-red-900">
        Courses couldn't load
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-red-700">
        {message ||
          "Something went wrong while fetching the course list."}
      </p>

      <button
        type="button"
        onClick={() =>
          window.location.reload()
        }
        className="
          mt-6
          inline-flex
          items-center
          gap-2
          rounded-xl
          bg-red-700
          px-5 py-2.5
          text-sm
          font-semibold
          text-white
          transition
          hover:bg-red-800
        "
      >
        <RefreshCw size={16} />

        Try again
      </button>
    </div>
  );
}