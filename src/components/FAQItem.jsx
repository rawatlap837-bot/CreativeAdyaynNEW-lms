import React, { forwardRef, useId, useState, useCallback } from "react";
import { Plus, Link2, Check } from "lucide-react";
import { useMeasuredHeight } from "../hook/useMeasuredHeight";

/**
 * @param {Object} props
 * @param {string} props.faqId - stable id used for the #anchor deep link
 * @param {string} props.number - zero-padded index, e.g. "01"
 * @param {string} props.question
 * @param {string} props.answer
 * @param {boolean} props.isOpen
 * @param {() => void} props.onToggle
 * @param {(e: React.KeyboardEvent) => void} props.onKeyDown
 */
const FAQItem = forwardRef(function FAQItem(
  { faqId, number, question, answer, isOpen, onToggle, onKeyDown },
  buttonRef
) {
  const panelId = useId();
  const buttonId = useId();
  const { contentRef, height } = useMeasuredHeight(isOpen);
  const [copied, setCopied] = useState(false);

  const handleCopyLink = useCallback(
    (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}${window.location.pathname}#faq-${faqId}`;
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      });
    },
    [faqId]
  );

  return (
    <div
      id={`faq-${faqId}`}
      data-faq-item
      className={`group scroll-mt-24 rounded-2xl border transition-colors duration-300 ${
        isOpen
          ? "border-[#6C5DD3]/40 bg-white shadow-[0_8px_30px_rgba(108,93,211,0.12)]"
          : "border-black/5 bg-[#F4F2FA] hover:border-black/10 hover:bg-white"
      }`}
    >
      <h3 className="m-0 flex items-center">
        <button
          ref={buttonRef}
          id={buttonId}
          type="button"
          onClick={onToggle}
          onKeyDown={onKeyDown}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="flex flex-1 items-center gap-4 rounded-2xl px-5 py-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#6C5DD3] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F2FA] sm:px-6 sm:py-5"
        >
          <span
            className={`flex h-6 w-7 flex-none items-center justify-center rounded-full font-mono text-[11px] font-medium tabular-nums transition-colors duration-300 ${
              isOpen ? "bg-[#6C5DD3] text-white" : "bg-black/5 text-black/50"
            }`}
          >
            {number}
          </span>

          <span
            className={`flex-1 font-body text-sm font-semibold sm:text-base ${
              isOpen ? "text-[#150A30]" : "text-[#150A30]/80"
            }`}
          >
            {question}
          </span>

          {/* Single icon that morphs plus -> x via rotation, instead of
              swapping components. Cheaper to animate, no layout jump,
              and respects prefers-reduced-motion automatically since
              it's just a transform. */}
          <span
            aria-hidden="true"
            className={`flex h-8 w-8 flex-none items-center justify-center rounded-full transition-all duration-300 motion-reduce:transition-none ${
              isOpen
                ? "rotate-45 bg-white text-[#150A30] ring-1 ring-black/10"
                : "rotate-0 bg-[#150A30] text-white"
            }`}
          >
            <Plus size={14} />
          </span>
        </button>

        {/* Copy-link affordance — only meaningfully visible on hover/focus
            within the row, keeps the collapsed state visually identical
            to before for anyone not interacting with it. */}
        <button
          type="button"
          onClick={handleCopyLink}
          aria-label={copied ? "Link copied" : "Copy link to this question"}
          className="mr-3 flex h-7 w-7 flex-none items-center justify-center rounded-full text-[#150A30]/0 opacity-0 outline-none transition-all duration-200 hover:bg-black/5 hover:text-[#150A30]/60 focus-visible:opacity-100 focus-visible:text-[#150A30]/60 focus-visible:ring-2 focus-visible:ring-[#6C5DD3] group-hover:opacity-100 group-hover:text-[#150A30]/40 sm:mr-4"
        >
          {copied ? <Check size={13} /> : <Link2 size={13} />}
        </button>
      </h3>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        style={{ height }}
        className="overflow-hidden transition-[height] duration-300 ease-in-out motion-reduce:transition-none"
      >
        <div ref={contentRef}>
          <p className="px-5 pb-5 pl-[3.5rem] font-body text-sm leading-relaxed text-[#150A30]/60 sm:px-6 sm:pb-6 sm:pl-[3.9rem]">
            {answer}
          </p>
        </div>
      </div>
    </div>
  );
});

export default React.memo(FAQItem);