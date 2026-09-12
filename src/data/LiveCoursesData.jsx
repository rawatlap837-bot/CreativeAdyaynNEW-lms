import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Loader2,
  Radio,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import {
  COURSE_TYPES,
  usePublishedCourses,
} from "../services/CourseService";

export default function Livecourses() {
  const {
    courses,
    loading,
    error,
  } = usePublishedCourses(
    COURSE_TYPES.LONG
  );

  const [search, setSearch] =
    useState("");

  const [category, setCategory] =
    useState("all");

  /* ============================================================
     CATEGORIES
     ============================================================ */

  const categories = useMemo(() => {
    const unique =
      new Set();

    courses.forEach(
      (course) => {
        if (
          course.category?.trim()
        ) {
          unique.add(
            course.category.trim()
          );
        }
      }
    );

    return [
      "all",
      ...Array.from(unique).sort(
        (a, b) =>
          a.localeCompare(b)
      ),
    ];
  }, [courses]);

  /* ============================================================
     FILTER COURSES
     ============================================================ */

  const filteredCourses =
    useMemo(() => {
      const searchValue =
        search
          .trim()
          .toLowerCase();

      return courses.filter(
        (course) => {
          const matchesSearch =
            !searchValue ||
            course.title
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            course.shortDescription
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            course.description
              ?.toLowerCase()
              .includes(
                searchValue
              ) ||
            course.category
              ?.toLowerCase()
              .includes(
                searchValue
              );

          const matchesCategory =
            category ===
            "all" ||
            course.category ===
            category;

          return (
            matchesSearch &&
            matchesCategory
          );
        }
      );
    }, [
      courses,
      search,
      category,
    ]);

  /* ============================================================
     PRICE
     ============================================================ */

  function renderPrice(
    course
  ) {
    const price =
      Number(course.price) ||
      0;

    const discountPrice =
      Number(
        course.discountPrice
      ) || 0;

    if (
      discountPrice > 0 &&
      discountPrice < price
    ) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-slate-950">
            ₹
            {discountPrice.toLocaleString(
              "en-IN"
            )}
          </span>

          <span className="text-sm text-slate-400 line-through">
            ₹
            {price.toLocaleString(
              "en-IN"
            )}
          </span>
        </div>
      );
    }

    if (price > 0) {
      return (
        <span className="text-lg font-bold text-slate-950">
          ₹
          {price.toLocaleString(
            "en-IN"
          )}
        </span>
      );
    }

    return (
      <span className="text-lg font-bold text-emerald-600">
        Free
      </span>
    );
  }

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="min-h-[60vh] bg-white">
        <div className="mx-auto flex min-h-[60vh] max-w-7xl items-center justify-center px-6">
          <div className="text-center">
            <Loader2
              size={32}
              className="mx-auto animate-spin text-slate-700"
            />

            <p className="mt-4 text-sm text-slate-500">
              Loading live courses...
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     ERROR
     ============================================================ */

  if (error) {
    return (
      <div className="min-h-[60vh] bg-white">
        <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <h2 className="text-lg font-semibold text-red-800">
              Unable to load live courses
            </h2>

            <p className="mt-2 text-sm text-red-600">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="mt-5 rounded-xl bg-red-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     PAGE
     ============================================================ */

  return (
    <div className="min-h-screen bg-white">
      {/* ======================================================
         HERO
         ====================================================== */}

      <section className="border-b border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
              <Radio
                size={14}
              />

              Live Courses
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Learn live.
              <br />
              Learn with experts.
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Join structured long-form
              programs with live classes,
              expert guidance, practical
              assignments and continuous
              support.
            </p>
          </div>
        </div>
      </section>

      {/* ======================================================
         FILTER BAR
         ====================================================== */}

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* SEARCH */}

            <div className="relative w-full lg:max-w-md">
              <Search
                size={18}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search live courses..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:bg-white focus:ring-2 focus:ring-slate-950/10"
              />
            </div>

            {/* CATEGORY */}

            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <SlidersHorizontal
                size={17}
                className="hidden shrink-0 text-slate-400 sm:block"
              />

              {categories.map(
                (item) => {
                  const selected =
                    category ===
                    item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() =>
                        setCategory(
                          item
                        )
                      }
                      className={[
                        "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition",
                        selected
                          ? "bg-slate-950 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      ].join(" ")}
                    >
                      {item ===
                        "all"
                        ? "All Courses"
                        : item}
                    </button>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
         COURSES
         ====================================================== */}

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950 sm:text-2xl">
              Live Courses
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {filteredCourses.length}{" "}
              {filteredCourses.length ===
                1
                ? "program"
                : "programs"}{" "}
              available
            </p>
          </div>
        </div>

        {/* ====================================================
           EMPTY
           ==================================================== */}

        {filteredCourses.length ===
          0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
              <Radio
                size={24}
              />
            </div>

            <h3 className="mt-5 text-lg font-semibold text-slate-950">
              No live courses found
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Try another search term
              or select a different
              category.
            </p>

            {(search ||
              category !==
              "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory(
                      "all"
                    );
                  }}
                  className="mt-5 rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Clear Filters
                </button>
              )}
          </div>
        ) : (
          /* ====================================================
             GRID
             ==================================================== */

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {filteredCourses.map(
              (course) => (
                <LiveCourseCard
                  key={course.id}
                  course={course}
                  renderPrice={
                    renderPrice
                  }
                />
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}

/* ==============================================================
   LIVE COURSE CARD
   ============================================================== */

function LiveCourseCard({
  course,
  renderPrice,
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl">
      {/* ======================================================
         IMAGE
         ====================================================== */}

      <Link
        to={`/courses/${course.id}`}
        className="block"
      >
        <div className="relative aspect-video overflow-hidden bg-slate-100">
          {course.thumbnailUrl ? (
            <img
              src={
                course.thumbnailUrl
              }
              alt={
                course.title ||
                "Live course"
              }
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-400">
              <Radio
                size={42}
              />
            </div>
          )}

          {/* LIVE BADGE */}

          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-slate-950 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-red-500" />

            Live Course
          </div>

          {/* FEATURED */}

          {course.featured && (
            <div className="absolute right-3 top-3 rounded-full bg-slate-950 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
              Featured
            </div>
          )}
        </div>
      </Link>

      {/* ======================================================
         CONTENT
         ====================================================== */}

      <div className="p-5">
        {course.category && (
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {course.category}
          </div>
        )}

        {/* TITLE */}

        <Link
          to={`/courses/${course.id}`}
          className="block"
        >
          <h3 className="line-clamp-2 text-lg font-bold leading-7 text-slate-950 transition group-hover:text-slate-700">
            {course.title}
          </h3>
        </Link>

        {/* DESCRIPTION */}

        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">
          {course.shortDescription ||
            course.description ||
            "Join this live learning program."}
        </p>

        {/* META */}

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-500">
          {course.duration && (
            <span className="inline-flex items-center gap-1.5">
              <Clock3
                size={14}
              />

              <span className="truncate">
                {course.duration}
              </span>
            </span>
          )}

          {course.studentCount >
            0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users
                  size={14}
                />

                <span className="truncate">
                  {course.studentCount.toLocaleString(
                    "en-IN"
                  )}{" "}
                  students
                </span>
              </span>
            )}

          {course.startDate && (
            <span className="col-span-2 inline-flex items-center gap-1.5">
              <CalendarDays
                size={14}
              />

              Starts{" "}
              {formatDate(
                course.startDate
              )}
            </span>
          )}
        </div>

        {/* DIVIDER */}

        <div className="my-5 h-px bg-slate-100" />

        {/* FOOTER */}

        <div className="flex items-center justify-between gap-4">
          <div>
            {renderPrice(
              course
            )}
          </div>

          <Link
            to={`/courses/${course.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            View Course

            <ArrowRight
              size={16}
            />
          </Link>
        </div>
      </div>
    </article>
  );
}

/* ==============================================================
   DATE FORMATTER
   ============================================================== */

function formatDate(value) {
  if (!value) {
    return "";
  }

  try {
    if (
      typeof value?.toDate ===
      "function"
    ) {
      return value
        .toDate()
        .toLocaleDateString(
          "en-IN",
          {
            day: "numeric",
            month: "short",
            year: "numeric",
          }
        );
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    return date.toLocaleDateString(
      "en-IN",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  } catch {
    return "";
  }
}