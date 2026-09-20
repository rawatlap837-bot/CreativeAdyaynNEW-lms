import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const instructorId = process.env.SEED_INSTRUCTOR_ID;
if (!url || !key || !instructorId) throw new Error("Set VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_INSTRUCTOR_ID locally before seeding. Never prefix the service key with VITE_.");
const db = createClient(url, key, { auth: { persistSession: false } });

/* ==================================================================== */
/*  LONG COURSES  (from SiteData.js -> COURSES_BY_CATEGORY)              */
/*  Uploaded to the "courses" collection.                                */
/*  If you add/edit courses in SiteData.js, just paste the updated       */
/*  COURSES_BY_CATEGORY object body below (keep the "category" flatten   */
/*  step as-is).                                                         */
/* ==================================================================== */

const POPUP_LINK =
  "https://creativeadhyayan.com/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjEwNzAiLCJ0b2dnbGUiOmZhbHNlfQ%3D%3D";

const COURSES_BY_CATEGORY = {
  "Digital Marketing": [
    {
      id: "dm-basic",
      title: "Digital Marketing Basic Programme",
      image: "/images/courses/digital-marketing-basic.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Start your digital journey. Learn the basics of SEO, social media, content, and branding in a fun and practical program designed for beginners.",
      features: [
        "High-demand career opportunities",
        "Freelancing and remote work options",
        "Financial independence",
        "Strong personal branding skills",
      ],
      duration: "4 Months",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "dm-advanced",
      title: "Digital Marketing Advanced Programme",
      image: "/images/courses/digital-marketing-advanced.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Go from basic to badass marketer! Learn advanced ads, SEO, email automation, and data-driven strategies to scale brands and get real results.",
      features: [
        "High-demand career opportunities",
        "Freelancing and remote work options",
        "Financial independence",
        "Support for starting their own business",
        "Strong personal branding skills",
        "Free Internship",
      ],
      duration: "1 Year",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
  ],

  Multimedia: [
    {
      id: "cgd",
      title: "(CGD) Certificate in Graphic Design",
      image: "/images/courses/cgd.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Turn ideas into stunning visuals! Learn graphic tools, branding basics, and modern design skills to become a confident designer.",
      features: [
        "Turns Creativity into a Career",
        "Teaches Practical & Job-Oriented Skills",
        "Perfect for Freelancing & Online Earning",
        "Wide Job Opportunities",
      ],
      duration: "6 Months",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "sdma",
      title: "(SDMA) Specialized Diploma in Multimedia and Animation",
      image: "/images/courses/sdma.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Create the magic you watch on screen! Learn animation, 3D design, motion graphics, VFX, and creative media skills used in movies, gaming, and digital content.",
      features: [
        "Turns Creativity into a Career",
        "Teaches Practical & Job-Oriented Skills",
        "Perfect for Freelancing & Online Earning",
        "Wide Job Opportunities",
        "Free Internship",
      ],
      duration: "1 Year",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "adma",
      title: "(ADMA) Advance Diploma in Multimedia and Animation",
      image: "/images/courses/adma.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "A complete advanced diploma designed for students aiming for professional careers in animation studios, film production, gaming, VFX houses, and creative media companies.",
      features: [
        "Turns Creativity into a Career",
        "Teaches Practical & Job-Oriented Skills",
        "Perfect for Freelancing & Online Earning",
        "Wide Job Opportunities",
        "Free Internship",
        "Freelancing Projects",
      ],
      duration: "2.5 Years",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "mdma",
      title: "(MDMA) Master Diploma in Multimedia and Animation",
      image: "/images/courses/mdma.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Master the world of animation and multimedia with expert-level training in 3D, VFX, CGI, film editing, and high-end digital content creation.",
      features: [
        "Turns Creativity into a Career",
        "Teaches Practical & Job-Oriented Skills",
        "Perfect for Freelancing & Online Earning",
        "Wide Job Opportunities",
        "Free Internship",
        "Freelancing Projects",
      ],
      duration: "3 Years",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
  ],

  "Web Development": [
    {
      id: "frontend-dev",
      title: "Front-End Development",
      image: "/images/courses/frontend-development.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "A complete front-end development course covering web fundamentals, interactive UI design, and modern frameworks for industry-ready skills.",
      features: [
        "Builds digital skills",
        "Increases creativity",
        "Improves problem-solving",
        "Creates job opportunities",
        "Supports freelancing income",
      ],
      duration: "1 Year",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "fullstack-dev",
      title: "Full-Stack Development",
      image: "/images/courses/fullstack-development.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Become a job-ready full-stack developer. Learn UI design, server-side coding, databases, APIs, and cloud deployment through real-world projects.",
      features: [
        "Builds digital skills",
        "Increases creativity",
        "Improves problem-solving",
        "Creates job opportunities",
        "Supports freelancing income",
        "Freelancing Projects",
        "Free Internship",
      ],
      duration: "2 Years",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
  ],

  "UI/UX Design": [
    {
      id: "uiux-diploma",
      title: "Diploma in UI/UX Design",
      image: "/images/courses/uiux-diploma.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Build a career in UI/UX with hands-on training in user research, design thinking, interface creation, prototyping, and portfolio development for real-world projects.",
      features: [
        "Boosts creative and visual thinking skills.",
        "Enhances problem-solving through user understanding.",
        "Improves attention to detail and quality.",
        "Encourages innovation and new ideas",
        "Free Internship",
        "Freelancing Projects",
      ],
      duration: "1 Year",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
  ],

  "Software Development": [
    {
      id: "pdse",
      title: "(PDSE) Professional Diploma in Software Engineering",
      image: "/images/courses/pdse.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Master coding, software development, and real-world engineering skills to build modern applications from scratch.",
      features: [
        "Builds strong coding and technical skills",
        "Improves creativity and logical thinking",
        "High demand in almost every industry",
        "Useful for jobs, freelancing, and startups",
      ],
      duration: "1 Year",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "adse",
      title: "(ADSE) Advance Diploma in Software Engineering",
      image: "/images/courses/adse.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Level up your software engineering skills with advanced coding, system design, cloud deployment, and scalable application development.",
      features: [
        "Builds strong coding and technical skills",
        "Improves creativity and logical thinking",
        "High demand in almost every industry",
        "Useful for jobs, freelancing, and startups",
        "Free Internship",
        "Freelancing Projects",
      ],
      duration: "2.5 Years",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "mdse",
      title: "(MDSE) Master Diploma in Software Engineering",
      image: "/images/courses/mdse.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Master software engineering with advanced programming, system design, cloud technologies, and enterprise-grade application development.",
      features: [
        "Builds strong coding and technical skills",
        "Improves creativity and logical thinking",
        "High demand in almost every industry",
        "Useful for jobs, freelancing, and startups",
        "Free Internship",
        "Freelancing Projects",
      ],
      duration: "3 Years",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
  ],

  "E-Accounting": [
    {
      id: "cifa",
      title: "(CIFA) Certificate in Financial Accounting",
      image: "/images/courses/cifa.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Start your accounting career with hands-on training in bookkeeping, ledger management, and financial statement preparation. Ideal for students, entrepreneurs, and professionals.",
      features: [
        "Builds strong coding and technical skills",
        "Improves creativity and logical thinking",
        "High demand in almost every industry",
        "Useful for jobs, freelancing, and startups",
      ],
      duration: "4 Months",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "sdea",
      title: "(SDEA) Specialized Diploma in E-Accounting",
      image: "/images/courses/sdea.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Build a career in e-accounting with hands-on training in Tally Prime, GST, automated accounting workflows, and real-world financial management.",
      features: [
        "Builds strong coding and technical skills",
        "Improves creativity and logical thinking",
        "High demand in almost every industry",
        "Useful for jobs, freelancing, and startups",
        "Free Internship",
      ],
      duration: "1 Year",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
    {
      id: "mdea",
      title: "(MDEA) Master Diploma in E-Accounting",
      image: "/images/courses/mdea.jpg",
      rating: 5,
      tags: ["Beginner friendly", "Flexible Batches", "Hands-On Projects"],
      description:
        "Lead the future of finance! Learn advanced e-accounting, automation, ERP systems, and real-world financial management skills for high-level careers.",
      features: [
        "Builds strong coding and technical skills",
        "Improves creativity and logical thinking",
        "High demand in almost every industry",
        "Useful for jobs, freelancing, and startups",
        "Free Internship",
      ],
      duration: "2 Years",
      mode: "Online & Offline Both available",
      link: POPUP_LINK,
    },
  ],
};

/* ==================================================================== */
/*  SHORT COURSES  (from ShortCourses.jsx -> COURSE_GROUPS)              */
/*  Uploaded to the "shortCourses" collection.                           */
/*  Each doc id = slugified title, doc data includes its group.          */
/* ==================================================================== */

const SHORT_COURSE_GROUPS = [
  {
    id: "office",
    label: "Office & Computer Basics",
    courses: [
      { title: "CCC / BCC", duration: "2 Month", description: "Core computer literacy for absolute beginners." },
      { title: "MS Word", duration: "1 Month", description: "Type, format, and produce professional documents." },
      { title: "MS Excel", duration: "1 Month", description: "Build spreadsheets, formulas, and simple reports.", popular: true },
      { title: "Adv. Excel", duration: "1 Month", description: "Pivot tables, macros, and data analysis at scale." },
      { title: "MS PowerPoint", duration: "1 Month", description: "Design decks that pitch, teach, and persuade." },
      { title: "MS Access", duration: "1 Month", description: "Design simple databases and manage records." },
      { title: "Internet", duration: "1 Week", description: "Browse, search, and stay safe online with confidence." },
    ],
  },
  {
    id: "programming",
    label: "Programming & Development",
    courses: [
      { title: "C Programming", duration: "3 Month", description: "Learn logic-building with the foundation language." },
      { title: "C++ Programming", duration: "3 Month", description: "Object-oriented programming for real applications." },
      { title: "Core Java", duration: "3 Months", description: "Master Java fundamentals and OOP concepts." },
      { title: "Full Java", duration: "9 Month", description: "End-to-end Java development for enterprise apps.", popular: true },
      { title: "PHP", duration: "3 Months", description: "Build dynamic, database-driven websites." },
      { title: "Python", duration: "3 Month", description: "The most in-demand language for scripting & data.", popular: true },
      { title: "MySQL / MariaDB", duration: "2 Months", description: "Query, manage, and structure relational databases." },
    ],
  },
  {
    id: "design",
    label: "Design & Creative Tools",
    courses: [
      { title: "Graphic Design", duration: "6 Month", description: "Visual design fundamentals for branding & print.", popular: true },
      { title: "Web Designing", duration: "6 Months", description: "Design responsive, user-friendly websites." },
      { title: "Photoshop", duration: "2 Month", description: "Photo editing, retouching, and digital art." },
      { title: "CorelDRAW", duration: "2 Month", description: "Vector illustration for logos and layouts." },
      { title: "Illustrator", duration: "1 Months", description: "Create scalable icons, logos, and artwork." },
      { title: "After Effects", duration: "1 Month", description: "Motion graphics and video visual effects." },
      { title: "3ds Max", duration: "3 Month", description: "3D modeling, texturing, and rendering basics." },
    ],
  },
  {
    id: "web",
    label: "Web & Scripting",
    courses: [
      { title: "WordPress", duration: "1 Month", description: "Build and manage websites without heavy coding." },
      { title: "HTML & CSS", duration: "1 Month", description: "The building blocks of every website, from scratch." },
      { title: "JavaScript", duration: "1 Months", description: "Add interactivity and logic to the modern web.", popular: true },
      { title: "MIS", duration: "2 Month", description: "Manage information systems for business decisions." },
    ],
  },
];

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* ==================================================================== */
/*  UPLOAD LOGIC                                                         */
/* ==================================================================== */

async function seed() {
  const { data: instructor, error } = await db.from("lms_profiles").select("id,role").eq("id", instructorId).single();
  if (error || !["teacher", "admin"].includes(instructor?.role)) throw new Error("Choose an existing teacher or administrator as SEED_INSTRUCTOR_ID.");
  const rows = [];
  function add(course, type, category) {
    const id = `seed-${type}-${slugify(course.title)}`;
    rows.push({ id, slug: id, title: course.title, type, category, instructor_id: instructorId,
      description: course.description || "", duration: course.duration || "", price: Number(course.price) || 0,
      status: "draft", metadata: { ...course, category },
    });
  }
  for (const [category, courses] of Object.entries(COURSES_BY_CATEGORY)) for (const course of courses) add(course, "long", category);
  for (const category of SHORT_COURSE_GROUPS) for (const course of category.courses) add(course, "short", category.label);
  const { error: insertError } = await db.from("lms_courses").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (insertError) throw insertError;
  console.log(`Seed checked ${rows.length} courses. New courses are drafts; existing courses were preserved.`);
}
seed().catch((error) => { console.error(error.message); process.exitCode = 1; });
