/**
 * courseMeta.js
 * -----------------------------------------------------------------------
 * Shared between the admin Courses panel (src/Admin/Courses.jsx) and the
 * student-facing MyCourses page (src/student/MyCourses.jsx) so both sides
 * agree on the same defaults when a course is missing icon/price/lessons.
 *
 * Icon keys here MUST match keys in the ICONS map wherever they're
 * rendered (Palette, Code2, PenTool, Camera, BookOpen, Megaphone, Cpu,
 * Calculator, Globe).
 * -----------------------------------------------------------------------
 */

export const CATEGORY_ICON_MAP = {
  // long-course categories (from Sitedata.js)
  "Digital Marketing": "Megaphone",
  Multimedia: "Camera",
  "Web Development": "Code2",
  "UI/UX Design": "PenTool",
  "Software Development": "Cpu",
  "E-Accounting": "Calculator",
  // short-course group labels
  "Office & Computer Basics": "BookOpen",
  "Programming & Development": "Code2",
  "Design & Creative Tools": "Palette",
  "Web & Scripting": "Globe",
};

export const ICON_KEYS = [
  "Palette",
  "Code2",
  "PenTool",
  "Camera",
  "BookOpen",
  "Megaphone",
  "Cpu",
  "Calculator",
  "Globe",
];

export function iconForCategory(category) {
  return CATEGORY_ICON_MAP[category] || "BookOpen";
}

/** Rough placeholder: ~4 lessons per month of course duration. */
export function estimateLessons(duration = "") {
  const yearMatch = duration.match(/([\d.]+)\s*Year/i);
  const monthMatch = duration.match(/([\d.]+)\s*Month/i);
  const weekMatch = duration.match(/([\d.]+)\s*Week/i);

  let months = 0;
  if (yearMatch) months = parseFloat(yearMatch[1]) * 12;
  else if (monthMatch) months = parseFloat(monthMatch[1]);
  else if (weekMatch) months = parseFloat(weekMatch[1]) / 4;

  return Math.max(4, Math.round(months * 4));
}

export const DEFAULT_PRICE = "Contact us"; // TODO: replace with real pricing per course
export const DEFAULT_INSTRUCTOR = "Creative Adhyayan Faculty";