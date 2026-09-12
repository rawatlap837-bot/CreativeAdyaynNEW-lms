import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { Users, Briefcase, PlayCircle, GraduationCap } from "lucide-react";
import CircularText from "../Animiations/CircularText";
import CALogo from "../assets/Images/CA.png";

const BG = "#FFFFFF";
const INK_TEXT = "#241F3D";
const MUTED = "#6E6789";
const VIOLET = "#7C6AE8";
const VIOLET_DEEP = "#5B4FC4";
const VIOLET_SOFT = "#EDEAFB";
const VIOLET_LINE = "#B7ACF2";

const CARDS = [
  {
    id: "teachers",
    eyebrow: "Our Faculty",
    icon: GraduationCap,
    stat: "20+",
    title: "Professional Teachers",
    desc: "Industry experts who bring real-world experience to every class.",
    corner: "top-left",
  },
  {
    id: "practical",
    eyebrow: "Our Method",
    icon: Briefcase,
    stat: "100%",
    title: "Practical Training",
    desc: "Hands-on learning with real internship opportunities.",
    corner: "top-right",
  },
  {
    id: "students",
    eyebrow: "Our Reach",
    icon: Users,
    stat: "1000+",
    title: "Students Trained",
    desc: "In Digital Marketing and AI Excellence.",
    corner: "bottom-left",
  },
  {
    id: "environment",
    eyebrow: "Our Space",
    icon: PlayCircle,
    stat: "",
    title: "Learning Environment",
    desc: "Expert-led training inside modern infrastructure.",
    corner: "bottom-right",
  },
];

const spokeIconStyle = { backgroundColor: VIOLET_SOFT, color: VIOLET_DEEP };

const spokeCardStyle = {
  backgroundColor: "#FFFFFF",
  borderColor: "rgba(124,106,232,0.18)",
  boxShadow: "0 8px 30px rgba(124,106,232,0.10)",
};

const eyebrowStyle = { color: MUTED };
const statStyle = { color: VIOLET_DEEP };
const titleStyle = { color: INK_TEXT };
const descStyle = { color: MUTED };

const corePulseStyle = {
  background: `radial-gradient(circle, ${VIOLET} 0%, ${VIOLET_LINE} 55%, transparent 75%)`,
  opacity: 0.22,
};

const coreSpinStyle = {
  background: `conic-gradient(from 0deg, ${VIOLET_DEEP}, transparent 35%, ${VIOLET}, transparent 75%, ${VIOLET_DEEP})`,
  padding: 2,
};

const coreSpinMaskStyle = { backgroundColor: BG };

const coreInnerStyle = {
  background: `radial-gradient(circle at 50% 35%, ${VIOLET_SOFT}, #FFFFFF)`,
  border: "1px solid rgba(124,106,232,0.16)",
  boxShadow: "0 10px 40px rgba(124,106,232,0.14)",
};

const sectionBgStyle = { backgroundColor: BG };

const gridTextureStyle = {
  backgroundImage:
    "linear-gradient(rgba(124,106,232,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,106,232,0.05) 1px, transparent 1px)",
  backgroundSize: "48px 48px",
};

const KEYFRAMES = `
  @keyframes core-spin-kf { to { transform: rotate(360deg); } }
  @keyframes core-pulse-kf { 0%, 100% { opacity: .18; transform: scale(1); } 50% { opacity: .3; transform: scale(1.06); } }
  @keyframes dash-flow-kf { to { stroke-dashoffset: -24; } }
  .core-spin { animation: core-spin-kf 14s linear infinite; }
  .core-pulse { animation: core-pulse-kf 5s ease-in-out infinite; }
  .circuit-dash { stroke-dasharray: 6 6; animation: dash-flow-kf 1.6s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .core-spin, .core-pulse, .circuit-dash { animation: none; }
  }
`;

// ---- Components ----

const SpokeIcon = memo(function SpokeIcon({ icon: Icon }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={spokeIconStyle}>
      <Icon size={20} aria-hidden="true" />
    </div>
  );
});

// `align`: "left" | "right" controls the desktop spoke layout's
// left/right-facing row direction (unchanged from before).
// `centered`: when true (used for the mobile/tablet stacked layout),
// the whole card's content — icon, eyebrow/stat row, title, and
// description — is centered instead of following `align`.
const SpokeCard = memo(function SpokeCard({ card, align = "left", centered = false }) {
  const { icon, eyebrow, stat, title, desc } = card;

  const rowClass = centered
    ? "flex flex-col items-center gap-2 text-center"
    : align === "right"
    ? "flex items-start gap-3 flex-row-reverse text-right"
    : "flex items-start gap-3";

  return (
    <article
      className={
        "pointer-events-auto w-full max-w-[320px] rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl " +
        (centered ? "mx-auto flex flex-col items-center text-center" : "")
      }
      style={spokeCardStyle}
    >
      <div className={rowClass}>
        <SpokeIcon icon={icon} />
        <div className={centered ? "flex flex-col items-center" : ""}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={eyebrowStyle}>
            {eyebrow}
          </p>
          {stat && (
            <p className="mt-0.5 text-2xl font-bold leading-none" style={statStyle}>
              {stat}
            </p>
          )}
        </div>
      </div>
      <h3 className="mt-3 text-base font-semibold" style={titleStyle}>
        {title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed" style={descStyle}>
        {desc}
      </p>
    </article>
  );
});

const LearningCore = memo(function LearningCore({ coreRef, onLogoLoad }) {
  return (
    <div ref={coreRef} className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
      <div className="core-pulse absolute inset-0 rounded-full blur-3xl" style={corePulseStyle} aria-hidden="true" />

      <div className="core-spin absolute inset-0 rounded-full" style={coreSpinStyle} aria-hidden="true">
        <div className="h-full w-full rounded-full" style={coreSpinMaskStyle} />
      </div>

      <div className="absolute inset-0 flex items-center justify-center">
        <CircularText
          text="EMPOWERING*INDIA*WITH*DIGITAL*SKILLS*"
          onHover="slowDown"
          spinDuration={24}
          size={225}
          fontSize={15}
          textColor="#6E63CB"
        />
      </div>

      <div
        className="relative z-10 flex h-[62%] w-[62%] flex-col items-center justify-center rounded-full text-center px-4"
        style={coreInnerStyle}
      >
        <img
          src={CALogo}
          alt="Creative Adhyayan"
          className="h-30 w-30 object-contain sm:h-40 sm:w-40"
          draggable="false"
          onLoad={onLogoLoad}
        />
      </div>
    </div>
  );
});

const ConnectorLines = memo(function ConnectorLines({ lines }) {
  if (!lines.length) return null;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      aria-hidden="true"
      focusable="false"
    >
      {lines.map((line) => (
        <g key={line.id}>
          <path
            d={line.d}
            fill="none"
            stroke={VIOLET}
            strokeOpacity={0.45}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="miter"
            className="circuit-dash"
          />
          <circle cx={line.startX} cy={line.startY} r={4} fill={VIOLET} />
          <circle cx={line.endX} cy={line.endY} r={4} fill={VIOLET} />
        </g>
      ))}
    </svg>
  );
});

const SectionInner = memo(function SectionInner() {
  const [teachers, practical, students, environment] = CARDS;

  const gridRef = useRef(null);
  const coreRef = useRef(null);
  const mobileCoreRef = useRef(null);
  const cardRefs = useRef({});
  const [lines, setLines] = useState([]);

  const PORT_ANGLE_DEG = 34;

  const recomputeLines = useCallback(() => {
    const gridEl = gridRef.current;
    const coreEl = coreRef.current;
    if (!gridEl || !coreEl) return;

    const gridRect = gridEl.getBoundingClientRect();
    const coreRect = coreEl.getBoundingClientRect();
    const coreCenter = {
      x: coreRect.left + coreRect.width / 2 - gridRect.left,
      y: coreRect.top + coreRect.height / 2 - gridRect.top,
    };
    const coreRadius = coreRect.width / 2;
    const angleRad = (PORT_ANGLE_DEG * Math.PI) / 180;

    const nextLines = CARDS.map((card) => {
      const cardEl = cardRefs.current[card.id];
      if (!cardEl) return null;

      const cardRect = cardEl.getBoundingClientRect();
      const isRightSide = card.corner.endsWith("right");
      const isTop = card.corner.startsWith("top");

      const startX = (isRightSide ? cardRect.left : cardRect.right) - gridRect.left;
      const startY = cardRect.top + cardRect.height / 2 - gridRect.top;

      const sideSign = isRightSide ? 1 : -1;
      const verticalSign = isTop ? -1 : 1;
      const endX = coreCenter.x + sideSign * coreRadius * Math.sin(angleRad);
      const endY = coreCenter.y + verticalSign * coreRadius * Math.cos(angleRad);

      const elbowX = endX;
      const elbowY = startY;

      const d = `M ${startX} ${startY} L ${elbowX} ${elbowY} L ${endX} ${endY}`;

      return { id: card.id, d, startX, startY, endX, endY };
    }).filter(Boolean);

    setLines(nextLines);
  }, []);

  useEffect(() => {
    recomputeLines();

    const observer = new ResizeObserver(() => recomputeLines());
    if (gridRef.current) observer.observe(gridRef.current);
    if (coreRef.current) observer.observe(coreRef.current);
    Object.values(cardRefs.current).forEach((el) => el && observer.observe(el));

    window.addEventListener("resize", recomputeLines);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", recomputeLines);
    };
  }, [recomputeLines]);

  const registerCardRef = (id) => (el) => {
    cardRefs.current[id] = el;
  };

  return (
    <div className="relative w-full px-4 pt-10 pb-20 sm:px-8 sm:pt-0 sm:pb-0" style={sectionBgStyle}>
      <style>{KEYFRAMES}</style>

      <div className="pointer-events-none absolute inset-0 opacity-50" style={gridTextureStyle} aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <h2 className="sr-only">Our Learning Environment</h2>

        {/* desktop: 2x2 grid, wide gap, right-angle circuit-style
            connectors computed from measured geometry. */}
        <div
          ref={gridRef}
          className="relative hidden lg:grid lg:grid-cols-[minmax(280px,1fr)_minmax(280px,1fr)] lg:items-center lg:gap-x-80 lg:gap-y-20 lg:py-12"
        >
          <ConnectorLines lines={lines} />

          <div className="justify-self-end self-end" ref={registerCardRef(teachers.id)}>
            <SpokeCard card={teachers} />
          </div>
          <div className="justify-self-start self-end" ref={registerCardRef(practical.id)}>
            <SpokeCard card={practical} align="right" />
          </div>
          <div className="justify-self-end self-start" ref={registerCardRef(students.id)}>
            <SpokeCard card={students} />
          </div>
          <div className="justify-self-start self-start" ref={registerCardRef(environment.id)}>
            <SpokeCard card={environment} align="right" />
          </div>

          <div
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <LearningCore coreRef={coreRef} onLogoLoad={recomputeLines} />
          </div>
        </div>

        {/* mobile / tablet stacked layout — card content is centered
            (icon on top, text centered) since there's no left/right
            spoke direction to justify off-center alignment at this
            width. */}
        <div className="flex flex-col items-center gap-8 lg:hidden">
          <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            {CARDS.slice(0, 2).map((c) => (
              <SpokeCard key={c.id} card={c} centered />
            ))}
          </div>

          <LearningCore coreRef={mobileCoreRef} onLogoLoad={undefined} />

          <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            {CARDS.slice(2).map((c) => (
              <SpokeCard key={c.id} card={c} centered />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
});

export default function LearningEnvironmentSection() {
  return (
    <section className="relative w-full" aria-label="Learning environment">
      <SectionInner />
    </section>
  );
}