import { useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Award, ImagePlus } from "lucide-react";

// Replace each image value with an imported certificate/student image when ready.
const CERTIFICATES = [
  { id: "certificate-1", label: "Student certificate 1", image: null },
  { id: "certificate-2", label: "Student certificate 2", image: null },
  { id: "certificate-3", label: "Student certificate 3", image: null },
  { id: "certificate-4", label: "Student certificate 4", image: null },
];

export default function StudentCertificates({ certificates = CERTIFICATES }) {
  const trackRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (certificates.length === 0) return null;

  const goTo = (index) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children);
    const maxScroll = track.scrollWidth - track.clientWidth;
    const lastStartIndex = cards.reduce(
      (last, card, cardIndex) => card.offsetLeft <= maxScroll + 1 ? cardIndex : last,
      0,
    );
    const nextIndex = (index + lastStartIndex + 1) % (lastStartIndex + 1);

    track.scrollTo({
      left: cards[nextIndex].offsetLeft,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setActiveIndex(nextIndex);
  };

  const syncActiveIndex = () => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children);
    const closest = cards.reduce((best, card, index) => {
      const distance = Math.abs(card.offsetLeft - track.scrollLeft);
      return distance < best.distance ? { index, distance } : best;
    }, { index: 0, distance: Infinity });
    setActiveIndex(closest.index);
  };

  return (
    <section className="bg-white px-5 py-14 sm:px-8 sm:py-20" aria-labelledby="student-certificates-heading">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-violet-600">
              <Award className="h-4 w-4" aria-hidden="true" /> Student achievements
            </span>
            <h2 id="student-certificates-heading" className="mt-3 font-pliant text-3xl font-bold tracking-tight text-[#1B0E3D] sm:text-5xl">
              Certificates earned by our students
            </h2>
            <p className="mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
              A place to celebrate the skills and milestones our students have achieved.
            </p>
          </div>
          {certificates.length > 1 && (
            <div className="flex gap-2" aria-label="Certificate carousel controls">
              <button type="button" onClick={() => goTo(activeIndex - 1)} aria-label="Previous certificate" className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-200 text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                <ArrowLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => goTo(activeIndex + 1)} aria-label="Next certificate" className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div ref={trackRef} onScroll={syncActiveIndex} className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4 pr-[15%] [scrollbar-width:none] sm:gap-6 sm:pr-0 [&::-webkit-scrollbar]:hidden">
          {certificates.map(({ id, label, image }) => (
            <article key={id} className="w-[85%] shrink-0 snap-start overflow-hidden rounded-3xl border border-violet-100 bg-violet-50 shadow-sm sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]">
              {image ? (
                <img src={image} alt={label} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-gradient-to-br from-violet-100 via-white to-indigo-100 text-violet-500">
                  <ImagePlus className="h-10 w-10" strokeWidth={1.5} aria-hidden="true" />
                  <span className="text-sm font-medium">Add student certificate image</span>
                </div>
              )}
              <div className="border-t border-violet-100 bg-white px-5 py-4">
                <p className="font-semibold text-[#1B0E3D]">{label}</p>
              </div>
            </article>
          ))}
        </div>
        {certificates.length > 1 && (
          <div className="mt-4 flex justify-center gap-2 sm:hidden" aria-label="Certificate slides">
            {certificates.map((certificate, index) => (
              <button key={certificate.id} type="button" onClick={() => goTo(index)} aria-label={`Show ${certificate.label}`} aria-current={activeIndex === index ? "true" : undefined} className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${activeIndex === index ? "w-7 bg-violet-600" : "w-2 bg-violet-200"}`} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
