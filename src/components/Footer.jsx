import React from "react";
import { Link } from "react-router-dom";
import { FaInstagram, FaYoutube, FaFacebook } from "react-icons/fa";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import CA2 from "../assets/Images/CA2.png"; // update path/filename to your actual logo

const isExternalHref = (href) => typeof href === "string" && /^https?:\/\//.test(href);

// "Live Courses" / "Recorded Courses" map to tab labels inside LiveCourses
// (it reads ?category=<name>#live-courses — see LiveCourses.jsx). Keep those
// labels in sync with CATEGORIES in LiveCoursesData.js.
//
// "Short Term Courses" is a separate standalone page (ShortCourses.jsx),
// so it links directly to its own route rather than a category param.
// Adjust "/short-courses" below to match wherever it's registered in your
// router (App.jsx) — e.g. it might be "/courses/short-term" for you.
const DEFAULT_COURSE_LINKS = [
  { label: "Live Courses", to: "/?category=Live%20Courses#live-courses" },
  { label: "Recorded Courses", to: "/?category=Recorded%20Courses#live-courses" },
  { label: "Short Term Courses", to: "/ShortCourses" },
];

const DEFAULT_OTHER_LINKS = [
  { label: "About us", to: "/about" },
  { label: "Contact Us", to: "/contact" },
  { label: "Privacy Policies", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms" },
  { label: "Refund Policy", to: "/refund-policy" },
];

const DEFAULT_SOCIAL_LINKS = [
  { label: "Instagram", href: "https://www.instagram.com/creativeadhyayan?stkn=MTY4ZWhvbHlidjJ2Mg==", icon: FaInstagram },
  { label: "YouTube", href: "https://youtube.com/@creativeadhyayan?si=n-HGf8l8Gsi4kWIi", icon: FaYoutube },
  { label: "Facebook", href: "https://www.facebook.com/share/1BaeP5SmJP/", icon: FaFacebook },
];

const MAP_QUERY = encodeURIComponent("Building No. 532/1, First Floor, Bank Colony Deoli Village, New Delhi-110062");

function FooterLink({ label, to }) {
  if (isExternalHref(to)) {
    return (
      <a
        href={to}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-white/70 outline-none transition hover:text-white focus-visible:text-white focus-visible:underline"
      >
        {label}
      </a>
    );
  }
  return (
    <Link
      to={to}
      className="text-sm text-white/70 outline-none transition hover:text-white focus-visible:text-white focus-visible:underline"
    >
      {label}
    </Link>
  );
}

function FooterLinkList({ title, links }) {
  if (!links?.length) return null;
  return (
    <div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <ul className="mt-4 flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.label}>
            <FooterLink {...link} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer({
  logoSrc = CA2,
  logoAlt = "Creative Adhyayan",
  description = "We believe that quality education, practical skills, and the right guidance can transform anyone into a high-earning professional—and that's exactly what we deliver.",
  socialLinks = DEFAULT_SOCIAL_LINKS,
  courseLinks = DEFAULT_COURSE_LINKS,
  otherLinks = DEFAULT_OTHER_LINKS,
  brandColor = "#2D016E",
  onOpenRegistration,
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full" style={{ background: brandColor }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-6 sm:flex-row sm:justify-between sm:py-12">
        <div className="max-w-sm">
          <Link to="/" aria-label="Go to homepage">
            <img src={logoSrc} alt={logoAlt} className="h-10 w-auto object-contain" />
          </Link>

          <p className="mt-4 text-sm leading-relaxed text-white/70">
            {description}
          </p>

          {socialLinks?.length > 0 && (
            <div className="mt-6 flex items-center gap-3">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white outline-none transition hover:bg-white/25 focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-16 sm:gap-24">
          <FooterLinkList title="Courses" links={courseLinks} />
          <FooterLinkList title="Other Pages" links={otherLinks} />
        </div>
      </div>

      <div className="border-t border-white/15">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-12 lg:grid-cols-2 lg:gap-12">
          <div>
            <h2 className="font-pliant text-2xl font-bold text-white sm:text-3xl">Get in touch</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-white/70">Questions about a course or admission? Contact our team.</p>
            <div className="mt-6 space-y-5 text-sm text-white/80">
              <div className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" /><p>Building No. 532/1, First Floor,<br />Bank Colony Deoli Village, New Delhi-110062<br />Near by Shani Bazar Bandh Road.</p></div>
              <a href="mailto:contact@creativeadhyayan.com" className="flex items-center gap-3 hover:text-white"><Mail className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />contact@creativeadhyayan.com</a>
              <div className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" /><div><a href="tel:+919910232927" className="block hover:text-white">+91 9910232927</a><a href="tel:+919910232941" className="block hover:text-white">+91 9910232941</a></div></div>
            </div>
            {onOpenRegistration && (
              <button type="button" onClick={onOpenRegistration} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-5 py-3 font-semibold text-[#2E1A55] transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                Register for a course <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white/10">
            <iframe title="Creative Adhyayan head office location" src={`https://www.google.com/maps?q=${MAP_QUERY}&output=embed`} className="h-[320px] w-full sm:h-[360px]" style={{ border: 0 }} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-6 py-6 text-center text-xs text-white/50 sm:flex-row sm:justify-between sm:text-left">
          <p>© {year} {logoAlt}. All rights reserved.</p>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-white/80">Privacy</Link>
            <Link to="/terms" className="hover:text-white/80">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
