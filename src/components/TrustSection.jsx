import React, { memo } from "react";
import { Users, Briefcase, PlayCircle, GraduationCap } from "lucide-react";
import teacherImage from "../assets/Images/teacher.PNG?url";

// Set src to your imported image or a public image path when ready.
const SECTION_IMAGE = {
  src: teacherImage,
  alt: "Teacher explaining digital marketing to students at Creative Adhyayan",
  caption: "Live Mentor-Led Sessions, Hands-On Practical Training & Real-World Project Guidance.",
};

const CARDS = [
  { id: "teachers", icon: GraduationCap, stat: "20+", title: "Professional Teachers" },
  { id: "practical", icon: Briefcase, stat: "100%", title: "Practical Training" },
  { id: "students", icon: Users, stat: "1000+", title: "Students Trained" },
  { id: "environment", icon: PlayCircle, stat: "7+", title: "Years of Real-Life Experience" },
];

const CARD_THEMES = [
  { background: "linear-gradient(145deg, #F8FAFF 0%, #FAF8FF 100%)", border: "#DCE1F5", accent: "#6366F1", gradient: "linear-gradient(135deg, #4F8DF7, #7C3AED)", glow: "rgba(99,102,241,0.38)", shadow: "0 22px 44px -32px rgba(99,102,241,0.7)" },
  { background: "linear-gradient(145deg, #FEFBFF 0%, #FBF4FF 100%)", border: "#E6D3F4", accent: "#B83FE4", gradient: "linear-gradient(135deg, #8B5CF6, #D946EF)", glow: "rgba(192,56,238,0.38)", shadow: "0 22px 44px -32px rgba(168,85,247,0.7)" },
  { background: "linear-gradient(145deg, #F1FCFF 0%, #F3F8FF 100%)", border: "#C5E6EF", accent: "#0EA5E9", gradient: "linear-gradient(135deg, #06B6D4, #2584F5)", glow: "rgba(14,165,233,0.38)", shadow: "0 22px 44px -32px rgba(14,165,233,0.7)" },
  { background: "linear-gradient(145deg, #FFFBF3 0%, #FFF7F6 100%)", border: "#F2DFC8", accent: "#F97316", gradient: "linear-gradient(135deg, #F59E0B, #FF5A4F)", glow: "rgba(249,115,22,0.38)", shadow: "0 22px 44px -32px rgba(249,115,22,0.7)" },
];

const MetricCard = memo(function MetricCard({ card, index }) {
  const Icon = card.icon;
  const theme = CARD_THEMES[index];
  const suffix = card.stat?.match(/[+%]$/)?.[0] || "";
  const statValue = suffix ? card.stat.slice(0, -1) : card.stat;

  return (
    <article
      className="group relative flex aspect-square w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-2xl border p-3 text-center transition duration-300 hover:-translate-y-1 sm:rounded-3xl sm:p-5 lg:aspect-auto lg:min-h-[210px]"
      style={{ background: theme.background, borderColor: theme.border, boxShadow: theme.shadow }}
    >
      <span aria-hidden="true" className="absolute left-1/2 top-0 h-1 w-16 -translate-x-1/2 rounded-b-full" style={{ background: theme.gradient }} />

      <div
        className="mb-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition duration-300 group-hover:scale-105 sm:h-14 sm:w-14 sm:rounded-2xl"
        style={{ background: theme.gradient, boxShadow: `0 13px 25px -9px ${theme.glow}` }}
      >
        <Icon className="h-5 w-5 sm:h-7 sm:w-7" strokeWidth={1.8} aria-hidden="true" />
      </div>

      {card.stat && (
        <p className="font-display text-2xl font-bold leading-none tracking-tight text-[#080B24] sm:text-4xl">
          {statValue}<span style={{ color: theme.accent }}>{suffix}</span>
        </p>
      )}
      <h3 className="mt-2 text-xs font-bold leading-tight text-[#10132D] sm:text-base">{card.title}</h3>
    </article>
  );
});

export default function LearningEnvironmentSection() {
  return (
    <section className="relative w-full overflow-hidden bg-[#F9F9FF] px-4 py-14 sm:px-8 sm:py-20" aria-labelledby="trust-heading">
      <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-[#DDE7FF]/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-[#F0DEFF]/60 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <h2 id="trust-heading" className="mx-auto max-w-7xl text-center font-pliant font-bold tracking-[-0.035em] text-[#080B24] lg:whitespace-nowrap">
          <span className="block text-3xl leading-tight sm:text-4xl lg:inline lg:text-5xl">Why Choose</span>
          <span
            className="inline-block pb-2 leading-tight lg:ml-3 lg:mt-0"
            style={{ fontSize: "clamp(2rem, 5vw, 3.75rem)", color: "#7C3AED", backgroundImage: "linear-gradient(110deg, #5B21B6, #9333EA, #6366F1)", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
          >
            Creative Adhyayan
          </span>
        </h2>

        <div className="lg:grid lg:grid-cols-2 lg:items-stretch lg:gap-8 xl:mt-10 xl:gap-10">
          <div className="grid mt-4 grid-cols-2 gap-3 sm:gap-4 lg:gap-3">
            {CARDS.map((card, index) => <MetricCard key={card.id} card={card} index={index} />)}
          </div>

          <figure className="mx-auto mt-8 w-full max-w-4xl overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm sm:mt-12 sm:rounded-3xl lg:ml-8 lg:mr-0 lg:mt-0 lg:flex lg:h-full lg:w-[calc(100%-2rem)] lg:flex-col">
            <div className="bg-violet-50 lg:relative lg:min-h-0 lg:flex-1 overflow-hidden">
              <img src={SECTION_IMAGE.src} alt={SECTION_IMAGE.alt} loading="lazy" decoding="async" className="block h-auto w-full lg:absolute lg:inset-0 lg:h-full lg:object-cover" />
            </div>
            <figcaption className="border-t border-violet-200 bg-violet-50 px-4 py-4 text-center text-sm font-extrabold leading-relaxed text-[#5B21B6] sm:px-6 sm:py-5 sm:text-xl">
              {SECTION_IMAGE.caption}
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
