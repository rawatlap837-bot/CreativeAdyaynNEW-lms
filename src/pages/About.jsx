import React, { memo, useEffect } from "react";
import { ArrowUpRight, Sparkles, Target, Users2 } from "lucide-react";
import Sohilsir from "../assets/Images/Sohilsir.jpg";
import Akashsir from "../assets/Images/Akashsir.jpg";
import About from "../assets/Images/About.png";
import { motion } from "framer-motion";

/**
 * About Us section — Creative Adhyayan
 * Palette: deep violet (#2E1A55) + electric indigo (#6D3FC0) + amber spark (#E8A33D) on soft lavender (#F8F6FC)
 * Display face: bold geometric sans (tracking-tight) / Body: default sans / Labels: mono uppercase
 * Signature: a dotted "learning path" that threads from the eyebrow, through the mission, to the leadership cards —
 * literalizing "guided growth" instead of a generic numbered-step layout.
 */

const FEATURES = [
  { icon: Target, value: "Day 1", label: "career-ready focus" },
  { icon: Users2, value: "1:1", label: "personalized mentorship" },
  { icon: Sparkles, value: "Hands-on", label: "structured training", hideOnMobile: true },
];

const OFFERINGS = [
  "IT Courses",
  "Software Training",
  "E-Accounting",
  "Digital Marketing",
  "Design",
  "Freelancing",
  "Career Diplomas",
];

const LEADERS = [
  {
    name: "Sohil Alvi",
    role: "Director",
    years: "4 yrs",
    focus: "Digital Marketing",
    bio: "Has helped numerous brands grow online. His dedication to teaching ensures students learn the latest and most effective marketing skills.",
    image: Sohilsir,
  },
  {
    name: "Akash Nagar",
    role: "Academic Head",
    years: "3 yrs",
    focus: "IT Education",
    bio: "Has mentored countless students with dedication and precision. As Academic Head, he ensures every learner receives structured, industry-focused training.",
    image: Akashsir,
  },
];

// ---- Static style objects & handlers, hoisted so they aren't re-allocated ----
// ---- on every render of the component that uses them. ----

const heroBlobStyle = {
  background: "radial-gradient(circle at 30% 30%, #C9AFF0 0%, #8B5FE0 45%, transparent 70%)",
};

const imageWashStyle = {
  background:
    "linear-gradient(160deg, rgba(46,26,85,0.35) 0%, rgba(109,63,192,0.05) 55%, transparent 80%)",
};

const leaderPhotoOverlayStyle = {
  background: "linear-gradient(to top, rgba(46,26,85,0.55) 0%, rgba(46,26,85,0) 45%)",
};

// Shared onError handler for both photos — one stable function reference
// instead of a fresh arrow function allocated per <img> per render.
function hideBrokenImage(e) {
  e.currentTarget.style.display = "none";
}

const featuresContainerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const featuresItemVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

// Coordinates computed once at module load rather than on every DotGrid render.
const DOT_GRID_POINTS = Array.from({ length: 6 }, (_, row) =>
  Array.from({ length: 6 }, (_, col) => ({ cx: 10 + col * 20, cy: 10 + row * 20 }))
).flat();

const DotGrid = memo(function DotGrid({ className = "" }) {
  return (
    <svg className={className} width="120" height="120" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      {DOT_GRID_POINTS.map(({ cx, cy }) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.5" className="fill-violet-300/60" />
      ))}
    </svg>
  );
});

const FeatureCard = memo(function FeatureCard({ icon: Icon, value, label, hideOnMobile }) {
  return (
    <motion.div
      variants={featuresItemVariants}
      className={`group rounded-2xl border border-violet-200 bg-white/60 p-4 backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md hover:shadow-violet-200/50 ${hideOnMobile ? "hidden sm:block" : ""
        }`}
    >
      <div className="flex items-center gap-2 text-[#2E1A55]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E8A33D]/10 transition-colors duration-300 group-hover:bg-[#E8A33D]/20">
          <Icon className="h-4 w-4 text-[#E8A33D]" aria-hidden="true" />
        </span>
        <span className="text-2xl font-black">{value}</span>
      </div>
      <p className="mt-1.5 text-sm text-[#4A3D66]">{label}</p>
    </motion.div>
  );
});

const LeaderCard = memo(function LeaderCard({ leader }) {
  return (
    <article className="group relative overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm shadow-violet-900/5 transition-shadow hover:shadow-lg hover:shadow-violet-900/10">
      {/* photo */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#6D3FC0] to-[#2E1A55]">
        <img
          src={leader.image}
          alt={leader.name}
          className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.02]"
          loading="lazy"
          decoding="async"
          onError={hideBrokenImage}
        />
        <div className="pointer-events-none absolute inset-0" style={leaderPhotoOverlayStyle} aria-hidden="true" />
        <span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-[#2E1A55] shadow">
          {leader.years} experience
        </span>
      </div>

      {/* content */}
      <div className="p-8">
        <h3 className="text-xl font-bold">{leader.name}</h3>
        <p className="text-sm font-medium text-[#6D3FC0]">{leader.role}</p>

        <p className="mt-4 text-sm leading-relaxed text-[#4A3D66]">{leader.bio}</p>

        <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-[#2E1A55] opacity-0 transition-opacity group-hover:opacity-100">
          Focus area: {leader.focus}
          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
});

export default function AboutSection() {
  // Scroll to the very top whenever this page mounts — e.g. when the user
  // clicks "About" in the navbar from somewhere scrolled down on another
  // page. The documentElement/body fallback covers older/mobile Safari,
  // where window.scrollTo alone can be unreliable right after a route change.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return (
    <section className="relative overflow-hidden bg-[#F8F6FC] text-[#1F1533]">
      {/* ambient gradient blob */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full opacity-70 blur-3xl"
        style={heroBlobStyle}
      />
      <DotGrid className="pointer-events-none absolute left-6 top-24 hidden sm:block" />

      {/* ---------------- HERO ---------------- */}
      <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-24 sm:pt-32">
        <span className="inline-flex items-center bg-violet-100 text-violet-700 font-semibold text-xs uppercase tracking-wide px-4 py-2 rounded-full">
          About Creative Adhyayan
        </span>

        <h1 className="mt-6 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Empowering the{" "}
          <span className="relative inline-block">
            next generation
            <svg
              className="absolute -bottom-2 left-0 w-full"
              height="10"
              viewBox="0 0 200 10"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 6 Q 50 0, 100 6 T 200 6"
                stroke="#E8A33D"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          of digital professionals.
        </h1>

        <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#4A3D66]">
          A premier skill-development and IT training institute, built to turn
          real practice into real careers — not another certificate that sits
          in a drawer.
        </p>
      </div>

      {/* ---------------- STORY ---------------- */}
      <div className="relative mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-12 lg:grid-cols-5 lg:gap-16">
          {/* image column */}
          <div className="relative lg:col-span-2">
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-[2rem] rounded-tl-none bg-gradient-to-br from-[#6D3FC0] to-[#2E1A55] shadow-xl shadow-violet-900/20">
              <img
                src={About}
                alt="Students collaborating at Creative Adhyayan"
                className="h-full w-full object-cover object-center"
                loading="lazy"
                decoding="async"
                onError={hideBrokenImage}
              />
              {/* subtle violet wash to keep the palette consistent over any photo */}
              <div className="pointer-events-none absolute inset-0 mix-blend-multiply" style={imageWashStyle} aria-hidden="true" />
            </div>
            <div className="absolute -bottom-6 -right-6 flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-lg shadow-violet-900/10">
              <Sparkles className="h-5 w-5 text-[#E8A33D]" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold leading-none">Industry-led</p>
                <p className="mt-1 text-xs text-[#4A3D66]">mentors &amp; curriculum</p>
              </div>
            </div>
          </div>

          {/* text column */}
          <div className="lg:col-span-3">
            <p className="text-base leading-relaxed text-[#4A3D66]">
              We believe quality education, practical skills, and the right
              guidance can transform anyone into a high-earning professional
              — and that's exactly what we deliver.
            </p>
            <p className="mt-5 text-base leading-relaxed text-[#4A3D66]">
              Creative Adhyayan was founded by industry experts with a
              mission to bridge the gap between education and real-world
              skills. In today's digital age, traditional degrees alone
              aren't enough — students need practical, job-ready skills
              through structured training, hands-on practice, and
              personalized mentorship.
            </p>

            {/* offerings */}
            <div className="mt-8">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#6D3FC0]">
                What we offer
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {OFFERINGS.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-violet-200 bg-white px-4 py-1.5 text-sm font-medium text-[#2E1A55] transition-colors hover:border-[#6D3FC0] hover:bg-violet-50"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* mini stats */}
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              variants={featuresContainerVariants}
              className="mt-10 grid grid-cols-2 gap-4 border-t border-violet-100 pt-8 sm:grid-cols-3 sm:gap-6"
            >
              {FEATURES.map((feature) => (
                <FeatureCard key={feature.label} {...feature} />
              ))}
            </motion.div>
          </div>
        </div>
      </div>

      {/* ---------------- LEADERSHIP ---------------- */}
      <div className="relative bg-white/60">
        <div className="mx-auto max-w-6xl px-6 py-1">
          <div className="max-w-xl">
            <span className="inline-flex items-center bg-violet-100 text-violet-700 font-semibold text-xs uppercase tracking-wide px-4 py-2 rounded-full">
              The people behind it
            </span>
            <h2 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Leadership that inspires growth
            </h2>
          </div>

          {/* path-connected cards */}
          <div className="relative mt-16 grid gap-10 sm:grid-cols-2">
            <svg
              className="pointer-events-none absolute left-0 right-0 top-1/2 hidden -translate-y-1/2 sm:block"
              height="2"
              width="100%"
              aria-hidden="true"
            >
              <line x1="0" y1="1" x2="100%" y2="1" stroke="#D8C9F0" strokeWidth="2" strokeDasharray="6 8" />
            </svg>

            {LEADERS.map((leader) => (
              <LeaderCard key={leader.name} leader={leader} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}