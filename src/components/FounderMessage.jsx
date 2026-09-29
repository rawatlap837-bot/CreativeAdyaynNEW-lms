import SohilAlvi from "../assets/Images/SohilAlvi.png";

export default function FounderMessage() {
  return (
    <section className="bg-white px-5 py-8 sm:px-8 sm:py-24" aria-labelledby="founder-message-heading">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
        <div className="relative mx-auto w-full max-w-md">
          <div className="absolute -inset-4 rounded-[2rem] bg-violet-100/70 blur-2xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[2rem] bg-violet-100 shadow-[0_24px_60px_-30px_rgba(59,30,143,0.45)]">
            <img src={SohilAlvi} alt="Sohil, Founder of Creative Adhyayan" loading="lazy" className="aspect-[4/5] w-full object-cover object-top" />
          </div>
        </div>

        <div>
          <h2 id="founder-message-heading" className="font-pliant text-3xl font-bold leading-tight tracking-tight text-[#1B0E3D] sm:text-5xl">
            Founder&rsquo;s <span className="text-violet-600">Message</span>
          </h2>
          <div className="mt-2 border-l-4 border-violet-500 pl-4">
            <p className="font-semibold text-[22px] text-[#1B0E3D]">Sohil Alvi</p>
            <p className="text-sm text-slate-500">Founder - Creative Adhyayan,Creative Crew</p>
          </div>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            <p>
              I believe that real success comes from what you can do, not just what you learn on paper. At Creative
              Adhyayan, we focus on practical skills, real-world experience, and helping students turn their potential
              into opportunities.
            </p>
            <p className="font-semibold text-[#1B0E3D]">
              Because at the end of the day, your skills are what truly matter.
            </p>
          </div>

        </div>
      </div>
    </section>
  );
}