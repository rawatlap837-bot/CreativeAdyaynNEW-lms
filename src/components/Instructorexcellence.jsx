import React, { useEffect, useRef, useState } from "react";
import ClassRoom from "../assets/Images/classroom.png"
import {
  Star,
  Megaphone,
  Palette,
  Code2,
  LayoutPanelTop,
  Terminal,
  Calculator,
} from "lucide-react";

const DEFAULT_SKILLS = [
  { label: "Digital Marketing Instructors", value: 95, icon: Megaphone },
  { label: "Multimedia & Animation Instructors", value: 97, icon: Palette },
  { label: "Web Development Instructors", value: 93, icon: Code2 },
  { label: "UI/UX Instructors", value: 98, icon: LayoutPanelTop },
  { label: "Software Development Instructors", value: 92, icon: Terminal },
  { label: "E - Accounting Instructors", value: 90, icon: Calculator },
];

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

// Single rAF loop drives the bar's scale, the counted-up number, and the
// row's own entrance (fade/slide), so nothing runs on a separate clock.
function useProgress(target, active, delay, duration = 1100) {
  const [progress, setProgress] = useState(0);
  const [entered, setEntered] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const startRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    if (!active) return;

    if (reducedMotion) {
      setProgress(1);
      setEntered(true);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(() => {
      setEntered(true);
      const step = (timestamp) => {
        if (cancelled) return;
        if (!startRef.current) startRef.current = timestamp;
        const elapsed = timestamp - startRef.current;
        const t = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        setProgress(eased);
        if (t < 1) frameRef.current = requestAnimationFrame(step);
      };
      frameRef.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active, delay, duration, reducedMotion]);

  return { progress, entered, value: Math.round(progress * target) };
}

const SkillBar = React.memo(function SkillBar({
  label,
  value,
  icon: Icon,
  active,
  delay,
}) {
  const { progress, entered, value: count } = useProgress(value, active, delay);

  return (
    <div
      className={`transition-all duration-500 ease-out ${
        entered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center flex-shrink-0">
            <Icon size={15} aria-hidden="true" />
          </span>
          <span className="font-semibold text-sm md:text-base text-slate-800">
            {label}
          </span>
        </div>
        <span className="font-bold text-sm md:text-base text-violet-700 tabular-nums w-11 text-right">
          {count}%
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-violet-100 overflow-hidden"
        role="progressbar"
        aria-label={label}
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full w-full rounded-full origin-left bg-gradient-to-r from-violet-600 to-violet-400 will-change-transform"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
    </div>
  );
});

export default function InstructorExcellence({
  heading = "Primary Instruction, Higher Department Of Education.",
  imageSrc = ClassRoom,
  imageAlt = "Live digital marketing & AI class at Creative Adhyayan",
  rating = "4.9",
  ratingLabel = "Excellent",
  ratingTag = "Client Ratings",
  skills = DEFAULT_SKILLS,
}) {
  const [inView, setInView] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [headingEntered, setHeadingEntered] = useState(false);
  const sectionRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2, rootMargin: "0px 0px -10% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      setHeadingEntered(true);
      return;
    }
    const t = setTimeout(() => setHeadingEntered(true), 60);
    return () => clearTimeout(t);
  }, [inView, reducedMotion]);

  return (
    <section
      ref={sectionRef}
      className="relative bg-violet-50/60 py-16 md:py-24 px-4 sm:px-6 md:px-10"
    >
      {/* ambient background accents, clipped to their own layer so they never affect layout */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-violet-200/40 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-orange-100/50 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left: image + floating rating card */}
        <div className="relative mb-12 sm:mb-16 lg:mb-0">
          <div
            className="relative overflow-hidden shadow-2xl shadow-violet-900/10 bg-violet-100"
            style={{ borderRadius: "56px 16px 56px 16px" }}
          >
            {!imgLoaded && (
              <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-violet-100 via-violet-50 to-violet-100" />
            )}
            <img
              src={imageSrc}
              alt={imageAlt}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgLoaded(true)}
              className={`w-full h-[300px] sm:h-[400px] md:h-[480px] object-cover transition-all duration-700 ease-out
                ${imgLoaded ? "opacity-100 scale-100" : "opacity-0 scale-105"}
                motion-safe:hover:scale-[1.03] motion-safe:transition-transform motion-safe:duration-700`}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-violet-950/25 via-transparent to-transparent" />
          </div>

          {/* Floating rating card */}
          <div
            className={`absolute -bottom-8 left-5 sm:left-10 w-44 sm:w-52 rounded-2xl bg-white shadow-2xl shadow-violet-900/20 overflow-hidden border border-violet-100
              transition-all duration-500 ease-out motion-safe:hover:-translate-y-1
              ${
                inView
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-4"
              }`}
            style={{ transitionDelay: inView ? "300ms" : "0ms" }}
          >
            <div className="bg-violet-800 px-4 sm:px-5 py-2.5 sm:py-3">
              <span className="text-white font-semibold text-xs sm:text-sm tracking-wide">
                {ratingLabel}
              </span>
            </div>
            <div className="px-4 sm:px-5 py-3 sm:py-4">
              <div className="flex items-center gap-2">
                <span className="text-3xl sm:text-4xl font-extrabold text-violet-800 tabular-nums">
                  {rating}
                </span>
                <div className="flex gap-0.5 mb-1" aria-hidden="true">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={11}
                      className="text-orange-400"
                      fill="currentColor"
                    />
                  ))}
                </div>
              </div>
              <span className="inline-block mt-2.5 sm:mt-3 bg-orange-500 text-white text-[11px] sm:text-xs font-bold px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full">
                {ratingTag}
              </span>
            </div>
          </div>
        </div>

        {/* Right: heading + animated skill bars */}
        <div className="lg:pl-4">
          <h2
            className={`font-extrabold text-3xl sm:text-4xl md:text-5xl leading-tight text-violet-900 tracking-tight
              transition-all duration-600 ease-out
              ${
                headingEntered
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-3"
              }`}
          >
            {heading}
          </h2>

          <div className="mt-10 flex flex-col gap-6">
            {skills.map((skill, i) => (
              <SkillBar
                key={skill.label}
                {...skill}
                active={inView}
                delay={i * 110}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}