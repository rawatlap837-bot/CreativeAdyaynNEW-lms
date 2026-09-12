import React from "react";
import { ArrowUpRight } from "lucide-react";
import Dashboard from "../assets/Images/Dashboradsection.png";

const features = [
  {
    title: "Practical Learning That Works",
    body: "100% practical & skill-based training with hands-on implementation.",
    badge: "bg-orange-500",
    ring: "focus-visible:ring-orange-300",
  },
  {
    title: "Freelancing Launch & Income Support",
    body: "Guaranteed freelancing setup support to help you start earning online.",
    badge: "bg-emerald-500",
    ring: "focus-visible:ring-emerald-300",
  },
  {
    title: "Work on Real Business Projects",
    body: "Live projects + guaranteed internship opportunities for real experience.",
    badge: "bg-violet-600",
    ring: "focus-visible:ring-violet-300",
  },
  {
    title: "Learn Directly from Industry Experts",
    body: "Mentorship & guidance from real working professionals and marketers.",
    badge: "bg-slate-900",
    ring: "focus-visible:ring-slate-400",
  },
];

export default function WhyChooseUs() {
  return (
    <section className="bg-white py-12 md:py-20 px-4 sm:px-6 md:px-10">
      <div className="max-w-6xl mx-auto">
        {/* <span className="inline-flex items-center bg-violet-100 text-violet-700 font-semibold text-xs uppercase tracking-wide px-4 py-2 rounded-full">
          Why Choose Us
        </span>
        <h2 className="mt-4 md:mt-5 font-extrabold text-2xl sm:text-3xl md:text-4xl leading-tight text-violet-900 tracking-tight max-w-2xl">
          Because Digital Marketing Is Not Theory — It&rsquo;s A Performance
          Skill.  
        </h2> */}

        {/* outer frame */}
        <div className="mt-8 md:mt-12 bg-white rounded-[24px] md:rounded-[40px] shadow-xl shadow-violet-900/5 border border-slate-400 p-2 sm:p-3 md:p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3 md:gap-4 items-stretch">
            {/* Left: headline + photo — stacks on mobile, sits side by side from md up */}
            <div className="group relative rounded-[20px] md:rounded-[32px] overflow-hidden flex flex-col md:flex-row min-h-0 lg:min-h-[520px] bg-violet-700">
              {/* decorative abstract shapes, desktop only so they don't clutter the stacked mobile view */}
              <div className="hidden md:block absolute -top-12 -left-12 w-44 h-44 bg-violet-500/40 rotate-12 rounded-[32px]" />
              <div className="hidden md:block absolute top-1/3 left-0 w-24 h-24 bg-orange-400/20 rotate-45 rounded-3xl" />
              <div className="absolute bottom-0 left-0 w-full h-2/5 bg-gradient-to-t from-violet-900/70 via-violet-900/10 to-transparent pointer-events-none" />

              <div className="relative z-10 w-full md:w-2/5 flex flex-col justify-center px-5 md:px-6 py-6 md:py-8">
                <span className="w-9 h-1 bg-orange-400 rounded-full mb-3 md:mb-4" />
                <p className="text-white font-extrabold text-xl sm:text-2xl md:text-3xl leading-[1.15] tracking-tight">
                  What you&rsquo;ll build in yourself
                </p>
              </div>

              <div className="relative z-10 w-full md:w-5/5 md:self-end overflow-hidden rounded-[20px] md:rounded-t-[32px] md:rounded-b-none">
                <img
                  src={Dashboard}
                  alt="Creative Adhyayan student"
                  className="w-full h-70 sm:h-64 md:h-[380px] lg:h-[480px] object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                />
              </div>
            </div>

            {/* Right: feature card grid — 1 col on mobile, 2 cols from sm up */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              {features.map(({ title, body, badge, ring }) => (
                <div
                  key={title}
                  tabIndex={0}
                  className={`group relative bg-slate-100 rounded-tl-[20px] rounded-tr-[20px] rounded-bl-[20px] rounded-br-[44px] md:rounded-tl-[28px] md:rounded-tr-[28px] md:rounded-bl-[28px] md:rounded-br-[56px] p-5 md:p-6 pb-8 min-h-[200px] md:min-h-[248px] flex flex-col justify-between
                    transition-all duration-300 ease-out
                    hover:bg-slate-50 hover:shadow-lg hover:shadow-slate-200 hover:-translate-y-1
                    outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${ring}`}
                >
                  <div>
                    <h3 className="font-bold text-lg md:text-xl text-slate-900 leading-snug">
                      {title}
                    </h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed pr-10">
                      {body}
                    </p>
                  </div>

                  {/* badge nested into the enlarged corner curve */}
                  <div
                    className={`absolute bottom-1.5 right-1.5 w-10 h-10 md:w-12 md:h-12 rounded-full ${badge} flex items-center justify-center shadow-md
                      transition-transform duration-300 ease-out group-hover:scale-110`}
                  >
                    <ArrowUpRight
                      size={16}
                      className="text-white transition-transform duration-300 ease-out group-hover:rotate-45 md:w-[18px] md:h-[18px]"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}