import React, { useState } from "react";
import { Plus, X, ArrowUpRight } from "lucide-react";
import { FAQ_DATA } from "../data/faqData";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(1);

  const handleToggle = (i) => {
    setOpenIndex((prev) => (prev === i ? null : i));
  };

  return (
    <section className="w-full py-20 sm:py-28" style={{ background: "#F4F2FA" }}>
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <div className="mb-4 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/5 px-3 py-1 text-[10px] uppercase tracking-widest text-black/50">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6C5DD3]" />
            FAQs
          </span>
        </div>

        {/* Only the heading overrides the default body font — it uses
            font-display (Tirra) intentionally, matching the Hero h1. */}
        <h2 className="mb-10 text-center font-display text-3xl font-semibold tracking-tight text-[#150A30] sm:mb-14 sm:text-5xl">
          Common Questions
        </h2>

        <div className="flex flex-col gap-3 sm:gap-4">
          {FAQ_DATA.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <div
                key={item.question}
                className={`rounded-2xl border transition-colors duration-300 ${
                  isOpen
                    ? "border-[#6C5DD3]/40 bg-white shadow-[0_8px_30px_rgba(108,93,211,0.12)]"
                    : "border-black/5 bg-[#F4F2FA] hover:border-black/10 hover:bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(i)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#6C5DD3] sm:px-6 sm:py-5"
                >
                  <span
                    className={`flex h-6 w-7 flex-none items-center justify-center rounded-full text-[11px] font-medium ${
                      isOpen ? "bg-[#6C5DD3] text-white" : "bg-black/5 text-black/50"
                    }`}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  <span
                    className={`flex-1 text-sm font-semibold sm:text-base ${
                      isOpen ? "text-[#150A30]" : "text-[#150A30]/80"
                    }`}
                  >
                    {item.question}
                  </span>

                  <span
                    className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors duration-300 ${
                      isOpen
                        ? "bg-white text-[#150A30] ring-1 ring-black/10"
                        : "bg-[#150A30] text-white"
                    }`}
                  >
                    {isOpen ? <X size={14} /> : <Plus size={14} />}
                  </span>
                </button>

                {isOpen && (
                  <p className="px-5 pb-5 pl-[3.5rem] text-sm leading-relaxed text-[#150A30]/60 sm:px-6 sm:pb-6 sm:pl-[3.9rem]">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-10 flex flex-col items-center gap-1 text-center sm:mt-14">
          <span className="text-sm text-[#150A30]/60">Have any other questions?</span>
          <a
            href="/contact"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[#150A30] underline underline-offset-4 transition hover:text-[#6C5DD3]"
          >
            Contact Us
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}