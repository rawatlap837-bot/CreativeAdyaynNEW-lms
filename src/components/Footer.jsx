import React from "react";
import { Link } from "react-router-dom";
import { FaInstagram, FaYoutube, FaFacebook } from "react-icons/fa";
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
  { label: "Short Term Courses", to: "/short-courses" },
];

const DEFAULT_OTHER_LINKS = [
  { label: "About us", to: "/about" },
  { label: "Contact Us", to: "/contact" },
  { label: "Privacy Policies", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms" },
];

const DEFAULT_SOCIAL_LINKS = [
  { label: "Instagram", href: "https://instagram.com", icon: FaInstagram },
  { label: "YouTube", href: "https://youtube.com", icon: FaYoutube },
  { label: "Facebook", href: "https://facebook.com", icon: FaFacebook },
];

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
  brandColor = "#3B1E8F",
}) {
  const year = new Date().getFullYear();

  return (
    <footer className="w-full" style={{ background: brandColor }}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-16 sm:flex-row sm:justify-between sm:py-20">
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