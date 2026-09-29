import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  memo,
} from "react";
import { Link } from "react-router-dom";
import Button from "../components/Buttons";
import { motion, animate, useInView } from "framer-motion";
import {
  Star,
  Megaphone,
  Code2,
  Palette,
  Cpu,
  BookOpen,
  Users,
  Award,
  PlayCircle,
} from "lucide-react";
import "slot-text/style.css";
import { SlotText } from "slot-text/react";
import sohilAlvi from "../assets/Images/SohilAlvi.png";
import carouselImage1 from "../assets/Images/img1.png";
import carouselImage2 from "../assets/Images/img2.png";
import carouselImage3 from "../assets/Images/img3.png";
import carouselImage4 from "../assets/Images/img4.png";
import carouselImage5 from "../assets/Images/img5.png";

// Lazy-loaded: this pulls in the WebGL shader engine, so we defer it
// until after the rest of the hero has mounted instead of blocking
// the initial page load for every visitor.
// react-router's Link wrapped in framer-motion so "Watch Demo" gets a
// real client-side route change to the Short Courses page while
// keeping the same whileHover/whileTap animation the old <motion.a>
// anchor had.
//
// motion.create(...) is the current Framer Motion API for wrapping an
// arbitrary custom component — motion(Link) still works today but logs
// a deprecation warning; motion.create is the same thing, just renamed.
const MotionLink = motion.create(Link);

/**
 * TOKENS
 * background: white with soft violet side glows
 * ink: #020617
 * muted: #475569
 * violet accent: #6C5DD3
 * display: Tirra / body: Pliant / mono: Pochaevsk
 */

const ROTATING_COURSES = [
  "Digital Marketing",
  "Programming",
  "Web Development",
  "Artificial Intelligence",
];

const QUICK_CATEGORIES = [
  { label: "Digital Marketing", icon: Megaphone, href: "/courses/digital-marketing" },
  { label: "Web Development", icon: Code2, href: "/courses/web-development" },
  { label: "UI/UX Design", icon: Palette, href: "/courses/ui-ux-design" },
  { label: "Software Dev", icon: Cpu, href: "/courses/software-dev" },
];

const STATS = [
  { icon: BookOpen, value: 25, suffix: "+", label: "Courses" },
  { icon: Users, value: 1200, suffix: "+", label: "Learners" },
  { icon: Award, value: 4.8, decimals: 1, suffix: " / 5", label: "Avg. rating" },
];

/** 
 * ---- Fanned card stack (bottom of hero) ----
 *
 * One raised, oversized card in the center, flanked by shorter
 * cards that rotate away and recede in z-order — same composition
 * as the reference screenshot, just themed to the hero's own
 * palette instead of introducing new colors.
 *
 * Each entry is a placeholder gradient tile for now. Swap `render`
 * for an <img src={...} className="h-full w-full object-cover" />
 * once you have real artwork — everything else (size, rotation,
 * stacking, motion) stays the same.
 *
 * On mobile, only the 3 center cards (c2, c3, c4) render — the two
 * outermost cards (c1, c5) are dropped so the stack doesn't get too
 * cramped/tall on narrow screens. Desktop still shows all 5.
 */
const FAN_CARDS = [
  { id: "c1", src: carouselImage1, from: "#7C3AED", to: "#4C1D95", rotate: -16, offsetY: 75, z: 10 },
  { id: "c2", src: carouselImage2, from: "#A78BFA", to: "#5B21B6", rotate: -8, offsetY: 10, z: 20 },
  { id: "c3", src: sohilAlvi, from: "#C4B2FF", to: "#6C5DD3", rotate: 0, offsetY: "10%", z: 40, featured: true },
  { id: "c4", src: carouselImage3, from: "#8B5CF6", to: "#4338CA", rotate: 8, offsetY: 10, z: 20 },
  { id: "c5", src: carouselImage4, from: "#6D28D9", to: "#2E1065", rotate: 16, offsetY: 75, z: 10 },
  { id: "c6", src: carouselImage5, from: "#A78BFA", to: "#6D28D9", rotate: 12, offsetY: 45, z: 15 },
];

const FAN_HOVER_FEATURED = {
  y: -3,
  scale: 1.008,
  transition: { duration: 0.25, ease: "easeOut" },
};

const FixedImageCarousel = memo(function FixedImageCarousel() {
  const featuredCard = FAN_CARDS.find((card) => card.featured);
  const carouselCards = FAN_CARDS.filter((card) => !card.featured);
  const loopCards = [...carouselCards, ...carouselCards];

  return (
    <div className="relative mt-8 h-[clamp(280px,42vw,470px)] w-screen max-w-none overflow-hidden sm:mt-10">
      {/* Duplicated track keeps the background carousel filled and seamless. */}
      <div className="pointer-events-none absolute inset-0 z-20">
        <motion.div
          className="absolute bottom-0 left-0 flex w-max items-end gap-2"
          animate={{ x: ["-50%", "0%"] }}
          transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        >
          {loopCards.map((card, index) => (
            <div
              key={`${card.id}-${index}`}
              className="h-[250px] w-[130px] shrink-0 overflow-hidden rounded-[22px] border-2 border-white bg-white shadow-[0_20px_45px_-14px_rgba(76,29,149,0.7)] sm:h-[clamp(250px,35vw,400px)] sm:w-[clamp(130px,22vw,250px)] sm:rounded-[30px]"
              style={{
                background: `linear-gradient(160deg, ${card.from} 0%, ${card.to} 100%)`,
              }}
            >
              <img
                src={card.src}
                alt=""
                className="h-full w-full object-cover object-center grayscale contrast-110"
                draggable={false}
              />
            </div>
          ))}
        </motion.div>
      </div>

      {/* This center card stays fixed. Add `src` to c3 in FAN_CARDS. */}
      <div className="absolute bottom-0 left-1/2 z-30 -translate-x-1/2">
        <motion.div
          initial={{ opacity: 0, y: 45, scale: 0.9 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          whileHover={FAN_HOVER_FEATURED}
          className="relative h-[clamp(280px,42vw,470px)] w-[clamp(185px,30vw,320px)] overflow-hidden rounded-[24px] border-2 border-white/80 shadow-[0_26px_65px_-22px_rgba(76,29,149,0.68)] sm:rounded-[34px]"
          style={{
            background: `linear-gradient(160deg, ${featuredCard.from} 0%, ${featuredCard.to} 100%)`,
          }}
        >
          {featuredCard.src ? (
            <img
              src={featuredCard.src}
              alt="Sohil Alvi"
              className="h-full w-full object-cover object-top"
              draggable={false}
            />
          ) : (
            <span className="flex h-full items-center justify-center text-xs uppercase tracking-wider text-white/55 sm:text-sm">
              add image
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/55 to-transparent px-4 pb-4 pt-12 text-left text-white">
            <p className="font-display text-lg font-bold leading-none sm:text-xl">
              Sohil Alvi
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
});

// Hoisted outside the component so these plain objects aren't
// re-created (and don't trigger new prop identities) on every render.
const STATS_CONTAINER_VARIANTS = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const STATS_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

/**
 * ---- Animated count-up number ----
 *
 * Animates from 0 up to `value` once the element scrolls into view.
 * Memoized: its props are static per-stat, so it never needs to
 * re-render when a sibling stat or the parent Hero re-renders.
 */
const AnimatedStatValue = memo(function AnimatedStatValue({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });
  const [display, setDisplay] = useState((0).toFixed(decimals));

  useEffect(() => {
    if (!isInView) return;

    const controls = animate(0, value, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo-ish — quick start, gentle settle
      onUpdate(latest) {
        const rounded = decimals ? latest.toFixed(decimals) : Math.round(latest);
        setDisplay(
          Number(rounded).toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          })
        );
      },
    });

    return () => controls.stop();
  }, [isInView, value, decimals]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
});

/**
 * ---- Carousel logos ----
 *
 * Auto-imports every image in src/assets/Carousel at build time via Vite's
 * import.meta.glob, so you never have to type out filenames by hand.
 */
const logoModules = import.meta.glob(
  "../assets/Carousel/*.{png,jpg,jpeg,svg,webp,PNG,JPG,JPEG}",
  { eager: true, import: "default" }
);

function filenameToAlt(path) {
  const base = path.split("/").pop().split(".")[0];
  const match = base.match(/([A-Z0-9-]{3,})$/); // trailing UPPERCASE-ish chunk
  const raw = match ? match[1] : base;
  return raw.replace(/[-_]/g, " ").trim();
}

// Computed once at module load, not on every render.
const AUTO_LOGOS = Object.entries(logoModules).map(([path, src]) => ({
  src,
  alt: filenameToAlt(path),
}));

const LogoCarousel = memo(function LogoCarousel({
  logos = AUTO_LOGOS,
  speed = 30, // seconds per full loop — higher = slower
  pauseOnHover = true,
}) {
  // Duplicated so the loop is seamless — memoized so it isn't rebuilt
  // (and the DOM list isn't rekeyed) on every parent render.
  const track = useMemo(() => [...logos, ...logos], [logos]);

  return (
    <div className="relative w-full py-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent_0%,#000_5%,#000_95%,transparent_100%)]">
      <div
        className={`flex items-center w-max gap-4 sm:gap-10 md:gap-16 will-change-transform animate-[cl-scroll_var(--cl-speed)_linear_infinite] ${pauseOnHover ? "hover:[animation-play-state:paused]" : ""
          }`}
        style={{ "--cl-speed": `${speed}s` }}
      >
        {track.map((logo, i) => (
          <div
            key={`${logo.alt}-${i}`}
            className="flex-none flex items-center justify-center rounded-lg sm:rounded-xl border border-white/10 bg-[#241c38]/15 backdrop-blur-sm px-3 py-2 sm:px-6 sm:py-4 opacity-85 transition-all duration-200 hover:opacity-100 hover:scale-105"
          >
            {logo.src ? (
              <img
                src={logo.src}
                alt={logo.alt}
                loading="lazy"
                decoding="async"
                width={96}
                height={40}
                className="h-6 sm:h-8 md:h-10 w-auto object-contain select-none"
                draggable={false}
              />
            ) : (
              <span className="inline-flex items-center h-6 sm:h-8 md:h-10 px-2 sm:px-5 font-semibold text-xs sm:text-[15px] tracking-wide text-[#cbb8ff] whitespace-nowrap">
                {logo.alt}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-[#F4F2FA] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-[#F4F2FA] to-transparent" />

      <style>{`
        @keyframes cl-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-\\[cl-scroll_var\\(--cl-speed\\)_linear_infinite\\] {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
});

/**
 * ---- Rotating course word ----
 *
 * Owns its own interval + state so the 2.2s tick only re-renders this
 * small leaf node, instead of the entire Hero (shader wrapper, glow
 * blobs, stats strip, logo carousel) every 2.2 seconds.
 */
const RotatingCourseWord = memo(function RotatingCourseWord({ words }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [words]);

  return (
    <span className="text-[#FFDE21] whitespace-nowrap text-[clamp(20px,7.5vw,60px)]">
      <SlotText text={words[index]} options={{ direction: "up", stagger: 40 }} />
    </span>
  );
});

/** Static pill row — memoized since it never depends on Hero's state. */
const QuickCategories = memo(function QuickCategories() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5">
      {QUICK_CATEGORIES.map(({ label, icon: Icon, href }) => (
        <Link
          key={label}
          to={href}
          className="group flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-2 backdrop-blur-sm transition hover:border-white/30 hover:bg-white/10"
        >
          <Icon size={13} className="text-[#C4B2FF]" />
          <span className="text-xs font-medium text-white/80 transition ease-out group-hover:text-white">
            {label}
          </span>
        </Link>
      ))}
    </div>
  );
});

/** Static stats strip — memoized since it never depends on Hero's state. */
const StatsStrip = memo(function StatsStrip() {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={STATS_CONTAINER_VARIANTS}
      className="relative mt-8 grid w-full max-w-2xl grid-cols-3 overflow-hidden rounded-2xl border border-violet-200/70 bg-white/75 px-2 py-4 shadow-[0_14px_40px_-24px_rgba(109,40,217,0.55)] backdrop-blur-xl sm:rounded-3xl sm:px-5 sm:py-5"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent"
      />
      {STATS.map(({ icon: Icon, value, decimals, suffix, label }, index) => (
        <motion.div
          key={label}
          variants={STATS_ITEM_VARIANTS}
          className={`group relative flex min-w-0 items-center justify-center gap-2 px-2 py-1 transition duration-300 hover:-translate-y-0.5 sm:gap-3 sm:px-5 ${index > 0 ? "border-l border-violet-200/70" : ""}`}
        >
          {/*
            One icon element sized via CSS breakpoints instead of two
            SVGs toggled with sm:hidden / hidden sm:block — halves the
            icon DOM/paint cost per stat card.
          */}
          <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-purple-50 text-violet-600 ring-1 ring-violet-200/70 transition duration-300 group-hover:scale-105 group-hover:text-violet-700 sm:inline-flex">
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="flex min-w-0 flex-col items-center sm:items-start">
            <AnimatedStatValue
              value={value}
              decimals={decimals}
              suffix={suffix}
              className="font-display text-base font-bold leading-none tabular-nums tracking-tight text-slate-950 sm:text-xl"
            />
            <span className="mt-1.5 whitespace-nowrap rounded-md bg-violet-100 px-1.5 py-1 text-center text-[9px] font-extrabold uppercase leading-none tracking-[0.03em] text-violet-800 sm:px-2 sm:text-[11px]">
              {label}
            </span>
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
});

/** Shader background + glow blobs + scrim — isolated so it only re-renders when isMobile flips. */
const HeroBackground = memo(function HeroBackground() {
  return (
    <>
      <div
        className="pointer-events-none absolute -left-56 top-1/2 z-[1] h-[720px] w-[520px] -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.34) 0%, rgba(196,181,253,0.16) 42%, transparent 72%)" }}
      />
      <div
        className="pointer-events-none absolute -right-56 top-1/2 z-[1] h-[720px] w-[520px] -translate-y-1/2 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(124,58,237,0.32) 0%, rgba(196,181,253,0.14) 42%, transparent 72%)" }}
      />
    </>
  );
});

export default function Hero() {

  // Scroll to the very top whenever the Hero mounts — e.g. when the user
  // clicks the logo / "Home" in the navbar from somewhere scrolled down on
  // another page. The documentElement/body fallback covers older/mobile
  // Safari, where window.scrollTo alone can be unreliable right after a
  // route change.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <>
      <section
        className="relative w-full min-h-screen overflow-hidden bg-white"
      >
        <HeroBackground />

        {/* content — single straight centered column, no side layout */}
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-10 pb-0 text-center font-body sm:px-6 sm:py-15 sm:pb-0">
          <span className="relative mt-16 inline-flex rounded-full p-[1.5px] sm:mt-20">
            <span
              aria-hidden
              className="absolute inset-[-6px] rounded-full opacity-40 blur-md animate-[spin_3s_linear_infinite]"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, transparent 80%, #c4b5fd 92%, #ffffff 96%, transparent 100%)",
              }}
            />
            <span className="relative z-10 inline-flex items-center gap-2 rounded-full border border-violet-200 bg-white/75 px-4 py-1.5  text-bold text-xs sm:text-[15px] text-violet-900 shadow-sm backdrop-blur-md">
              <Star size={12} className="fill-violet-600 text-violet-600" />
              Building Skills For The AI Era
            </span>
          </span>

          <motion.h1
            initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.85 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 w-full max-w-5xl text-center font-pliant text-[40px] font-bold leading-[1.08] tracking-tight text-slate-950 sm:text-7xl"
          >
            {/* Line 1 */}
            <span className="block text-balance text-[2.5rem] min-[380px]:text-3xl sm:text-5xl lg:text-6xl text-slate-950">
              Learn Digital Marketing & AI
            </span>

            {/* Line 2 + 3 */}
            <span className="mt-2 flex flex-col items-center justify-center gap-1 sm:mt-3 sm:gap-2">
              {/* <span className="font-pliant text-[2rem] min-[380px]:text-3xl sm:text-5xl lg:text-6xl text-[#C4B2FF] leading-none">
                  
                </span> */}

              <span className="font-pliant text-[2.5rem] min-[380px]:text-4xl sm:text-6xl lg:text-7xl leading-none text-violet-600 drop-shadow-[0_0_20px_rgba(124,58,237,0.2)]">
                Create Your Own Career Path
              </span>
            </span>
          </motion.h1>
          <p className="mt-4 max-w-7xl  capitalize text-[1rem] leading-5 text-slate-600 sm:text-base lg:text-lg">
            Build job ready skills through expert. hands on training in Digital Marketing and AI. in our smart classrooms.

          </p>
          <StatsStrip />
          <div className="mt-8 flex w-full max-w-md flex-wrap items-center justify-center gap-4 px-2 sm:w-auto sm:max-w-none sm:gap-6 sm:px-0">
            <Button
              href="#live-courses"
              text="Explore Courses"
              shine
              onClick={(event) => {
                const courses = document.getElementById("live-courses");
                if (!courses) return;
                event.preventDefault();
                courses.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="flex-1 min-w-0 sm:flex-none"
            />
            <MotionLink
              to="/ShortCourses"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group relative flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl border border-violet-200 bg-white/70 px-4 py-3 text-sm font-semibold text-violet-950 shadow-sm backdrop-blur-sm transition-colors duration-300 hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:flex-none sm:gap-2.5 sm:px-8 sm:py-4 sm:text-base"
            >
              {/* soft sheen sweep on hover */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
              />
              <PlayCircle
                size={18}
                className="relative shrink-0 text-[#C4B2FF] transition-transform duration-300 group-hover:scale-110 sm:size-5"
              />
              <span className="relative">Watch Demo</span>
            </MotionLink>
          </div>

          <FixedImageCarousel />
        </div>
      </section>

      {/* Logo strip — sits right under the hero, naturally in the page flow */}
      <section id="programs" className="relative w-full py-3" style={{ background: "#F4F2FA" }}>
        <LogoCarousel />
      </section>
    </>
  );
}
