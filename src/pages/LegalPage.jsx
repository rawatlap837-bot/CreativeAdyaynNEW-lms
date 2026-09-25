import { Link } from "react-router-dom";

export default function LegalPage({ eyebrow, title, updated = "25 September 2026", children }) {
  return (
    <main className="min-h-screen bg-[#f7f5fc] px-4 py-14 text-[#231942] sm:px-6 sm:py-20">
      <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-sm">
        <header className="bg-[#2e1a55] px-6 py-10 text-white sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-200">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-black sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm text-violet-100">Last updated: {updated}</p>
        </header>
        <div className="prose prose-slate max-w-none space-y-8 px-6 py-10 leading-7 sm:px-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-[#2e1a55] [&_li]:my-2 [&_ul]:list-disc [&_ul]:pl-6">
          {children}
          <div className="border-t border-slate-200 pt-6 text-sm text-slate-600">
            Questions? Contact <a className="font-semibold text-violet-700 underline" href="mailto:contact@creativeadhyayan.com">contact@creativeadhyayan.com</a> or visit our <Link className="font-semibold text-violet-700 underline" to="/contact">contact page</Link>.
          </div>
        </div>
      </article>
    </main>
  );
}
