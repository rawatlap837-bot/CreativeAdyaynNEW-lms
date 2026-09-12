import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  memo,
  lazy,
  Suspense,
} from "react";
import { Link } from "react-router-dom";
import Button from "../components/Buttons"; // adjust path to wherever you save it
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

// Lazy-loaded: this pulls in the WebGL shader engine, so we defer it
// until after the rest of the hero has mounted instead of blocking
// the initial page load for every visitor.
const GradientWaves = lazy(() => import("../Animiations/GradientWaves"));

/**
 * TOKENS
 * background: GradientWaves shader (horizon violet → wave pink → crest white)
 * ink (on-wave text): #FFFFFF
 * muted (on-wave text): #D9D2F5
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
  { icon: BookOpen, value: 50, suffix: "+", label: "Courses" },
  { icon: Users, value: 12000, suffix: "+", label: "Learners" },
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
  { id: "c1", from: "#7C3AED", to: "#4C1D95", rotate: -16, offsetY: 75, z: 10 },
  { id: "c2", from: "#A78BFA", to: "#5B21B6", rotate: -8, offsetY: 10, z: 20 },
  { id: "c3", from: "#C4B2FF", to: "#6C5DD3", rotate: 0, offsetY: "10%", z: 40, featured: true },
  { id: "c4", from: "#8B5CF6", to: "#4338CA", rotate: 8, offsetY: 10, z: 20 },
  { id: "c5", from: "#6D28D9", to: "#2E1065", rotate: 16, offsetY: 75, z: 10 },
];

// The 3 center cards shown on mobile.
const FAN_CARDS_MOBILE = FAN_CARDS.slice(1, 4);

const FAN_CONTAINER_VARIANTS = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
};

const FAN_CARD_VARIANTS = {
  hidden: { opacity: 0, y: 60, rotate: 0, scale: 0.5 },
  visible: (c) => ({
    opacity: 1,
    y: c.offsetY,
    rotate: c.rotate,
    scale: 1,
    transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  }),
};

// Hoisted so these plain objects aren't re-created on every card render —
// only two variants exist (featured vs. not), so we pick between them
// instead of building a fresh object literal per card per render.
const FAN_HOVER_FEATURED = {
  y: -3,
  scale: 1.008,
  transition: { duration: 0.25, ease: "easeOut" },
};
const FAN_HOVER_DEFAULT = {
  y: -3,
  scale: 1.005,
  transition: { duration: 0.25, ease: "easeOut" },
};

const ImageCardFan = memo(function ImageCardFan({ isMobile }) {
  // Recomputed only when `isMobile` actually flips (this component is
  // memoized on that single prop), so the width/height clamp() strings
  // and per-card style objects aren't rebuilt on unrelated parent renders.
  const cards = useMemo(() => {
    const source = isMobile ? FAN_CARDS_MOBILE : FAN_CARDS;
    return source.map((c, i) => ({
      ...c,
      style: {
        zIndex: c.z,
        marginLeft: i === 0 ? 0 : "clamp(-60px, -6vw, -26px)",
        width: isMobile
          ? c.featured
            ? "clamp(150px, 34vw, 220px)"
            : "clamp(110px, 26vw, 170px)"
          : c.featured
            ? "clamp(118px, 25vw, 320px)"
            : "clamp(88px, 18vw, 245px)",
        height: isMobile
          ? c.featured
            ? "clamp(230px, 52vw, 330px)"
            : "clamp(170px, 40vw, 250px)"
          : c.featured
            ? "clamp(178px, 36vw, 445px)"
            : "clamp(132px, 27vw, 345px)",
        background: `linear-gradient(160deg, ${c.from} 0%, ${c.to} 100%)`,
      },
      hover: c.featured ? FAN_HOVER_FEATURED : FAN_HOVER_DEFAULT,
    }));
  }, [isMobile]);

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      variants={FAN_CONTAINER_VARIANTS}
      className={`relative mt-5 flex w-full items-end justify-center sm:mt-5 ${isMobile ? "translate-y-6" : ""
        }`}
    >
      {cards.map((c) => (
        <motion.div
          key={c.id}
          custom={c}
          variants={FAN_CARD_VARIANTS}
          whileHover={c.hover}
          style={c.style}
          className="relative flex-none origin-bottom overflow-hidden rounded-[16px] border border-white/15 shadow-[0_24px_52px_-13px_rgba(10,4,26,0.7)] sm:rounded-[28px]"
        >
          {/*
            Placeholder tile — replace this whole block with:
            <img src={c.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
          */}
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-[10px] uppercase tracking-wide text-white/50 sm:text-sm">
              image
            </span>
          </div>
        </motion.div>
      ))}
    </motion.div>
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

const SCRIM_MOBILE =
  "linear-gradient(180deg, rgba(10,4,26,0.30) 0%, rgba(10,4,26,0.02) 35%, rgba(10,4,26,0.40) 100%)";
const SCRIM_DESKTOP =
  "linear-gradient(180deg, rgba(10,4,26,0.45) 0%, rgba(10,4,26,0.05) 35%, rgba(10,4,26,0.55) 100%)";

/**
 * Responsive breakpoint hook. Uses matchMedia's native `change` event
 * rather than a `resize` listener, so it's already event-driven (fires
 * only when the query's truth value actually flips) instead of firing
 * on every pixel of a window drag — no manual debounce needed.
 */
function useIsMobile(breakpoint = 768) {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const pointerQuery = "(pointer: coarse)";

  // Requires BOTH a narrow viewport AND a touch/coarse pointer, so
  // resizing a desktop browser window (or opening dev tools) never
  // flips this to true — only actual phones/tablets do.
  const computeIsMobile = () =>
    typeof window !== "undefined" &&
    window.matchMedia(query).matches &&
    window.matchMedia(pointerQuery).matches;

  const [isMobile, setIsMobile] = useState(computeIsMobile);

  useEffect(() => {
    const widthMql = window.matchMedia(query);
    const pointerMql = window.matchMedia(pointerQuery);
    const handleChange = () =>
      setIsMobile(widthMql.matches && pointerMql.matches);

    widthMql.addEventListener("change", handleChange);
    pointerMql.addEventListener("change", handleChange);
    return () => {
      widthMql.removeEventListener("change", handleChange);
      pointerMql.removeEventListener("change", handleChange);
    };
  }, [query]);

  return isMobile;
}

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
    <span className="text-[#FFDE21] text-4xl sm:text-6xl">
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
      className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-6"
    >
      {STATS.map(({ icon: Icon, value, decimals, suffix, label }) => (
        <motion.div
          key={label}
          variants={STATS_ITEM_VARIANTS}
          className="group flex flex-col items-center gap-0.5 rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 backdrop-blur-sm transition duration-300 hover:border-white/20 hover:bg-white/[0.07] sm:rounded-2xl sm:px-8 sm:py-2"
        >
          {/*
            One icon element sized via CSS breakpoints instead of two
            SVGs toggled with sm:hidden / hidden sm:block — halves the
            icon DOM/paint cost per stat card.
          */}
          <Icon
            className="h-[13px] w-[13px] text-[#C4B2FF] transition-transform duration-300 group-hover:scale-110 sm:h-4 sm:w-4"
          />
          <AnimatedStatValue
            value={value}
            decimals={decimals}
            suffix={suffix}
            className="font-display text-sm font-semibold tabular-nums text-white sm:text-xl"
          />
          <span className="text-center text-[8px] leading-tight uppercase tracking-wide text-white/60 sm:text-xs">
            {label}
          </span>
        </motion.div>
      ))}
    </motion.div>
  );
});

/** Shader background + glow blobs + scrim — isolated so it only re-renders when isMobile flips. */
const HeroBackground = memo(function HeroBackground({ isMobile }) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.2, ease: [0.16, 1, 0.3, 1] }}
        className="gradient-waves-container absolute inset-0 z-0"
      >
        <Suspense fallback={null}>
          <GradientWaves
            horizonColor="#a627ff"
            waveColor="#7C3AED"
            crestColor="#FFFFFF"
            speed={0.8}
            amplitude={2.5}
            waveScale={0.75}
            waveRatio={0.8}
            swell={35}
            turbulence={16.5}
            tilt={0.92}
            zoom={1.05}
            height={3.5}
            fogDepth={15}
            detail="high"
            brightness={1}
            opacity={1}
            mouseInteraction
            parallaxStrength={0.23}
            grain
            grainIntensity={0.05}
          />
        </Suspense>
      </motion.div>

      <div
        className="pointer-events-none absolute -top-40 -left-40 z-[1] h-[520px] w-[520px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #6C5DD3 0%, transparent 70%)", opacity: 0.35 }}
      />
      <div
        className="pointer-events-none absolute -bottom-52 -right-32 z-[1] h-[600px] w-[600px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #8B5CF6 0%, transparent 70%)", opacity: 0.3 }}
      />

      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{ background: isMobile ? SCRIM_MOBILE : SCRIM_DESKTOP }}
      />
    </>
  );
});

export default function Hero() {
  const isMobile = useIsMobile();

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
        className="relative w-full min-h-screen overflow-hidden"
        style={{ background: "#150A30" }}
      >
        <HeroBackground isMobile={isMobile} />

        {/* content — single straight centered column, no side layout */}
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-10 pb-6 text-center font-body sm:px-6 sm:py-15 sm:pb-0">
          <span className="relative mt-16 inline-flex rounded-full p-[1.5px] sm:mt-20">
            <span
              aria-hidden
              className="absolute inset-[-6px] rounded-full opacity-40 blur-md animate-[spin_3s_linear_infinite]"
              style={{
                background:
                  "conic-gradient(from 0deg, transparent 0%, transparent 80%, #c4b5fd 92%, #ffffff 96%, transparent 100%)",
              }}
            />
            <span className="relative z-10 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs text-white backdrop-blur-md">
              <Star size={12} className="fill-white text-white" />
              Skill OS for the AI era
            </span>
          </span>

          <motion.h1
            initial={{ opacity: 0, y: 40, filter: "blur(10px)" }}
            whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            viewport={{ once: true, amount: 0.85 }}
            transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 text-center font-pliant text-[40px] font-semibold leading-[1.08] tracking-tight text-white sm:text-7xl"
          >
            <span className="block">Learn. Get Hired. Get Paid.</span>
            <span className="flex flex-col items-center justify-center">
              <span className="font-pliant mt-2.5 mb-5 inline-flex flex-wrap items-baseline justify-center gap-x-3 text-4xl sm:text-6xl text-[#C4B2FF] leading-none">
                <span>Faster With</span>
                <RotatingCourseWord words={ROTATING_COURSES} />
              </span>
            </span>
          </motion.h1>
          <StatsStrip />
          <div className="mt-9 flex w-full max-w-sm flex-nowrap items-center justify-center gap-3 sm:max-w-none sm:w-auto sm:gap-4">
            <Button
              href="#programs"
              text="Explore Courses"
              className="flex-1 min-w-0 justify-center whitespace-nowrap px-4 py-3 text-sm sm:flex-none sm:px-8 sm:py-4 sm:text-base"
            />
            <motion.a
              href="#demo"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="group relative flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 overflow-hidden whitespace-nowrap rounded-xl border border-white/25 bg-white/5 px-4 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors duration-300 hover:border-white/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4B2FF]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#150A30] sm:flex-none sm:gap-2.5 sm:px-8 sm:py-4 sm:text-base"
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
            </motion.a>
          </div>

          <ImageCardFan isMobile={isMobile} />
        </div>
      </section>

      {/* Logo strip — sits right under the hero, naturally in the page flow */}
      <section id="programs" className="relative w-full py-3" style={{ background: "#F4F2FA" }}>
        <LogoCarousel />
      </section>
    </>
  );
}