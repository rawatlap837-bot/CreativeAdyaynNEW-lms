/* ------------------------------------------------------------------ */
/*  SiteData.js                                                        */
/*  Central place for course categories + course content.              */
/*                                                                      */
/*  HOW TO ADD IMAGES:                                                  */
/*  Replace the `image` value on each course with your real image      */
/*  path/URL, e.g. "/images/courses/digital-marketing-basic.jpg"        */
/*  (put files in /public/images/courses/ if using Vite/CRA) or a       */
/*  hosted URL. They're left as placeholders below.                    */
/* ------------------------------------------------------------------ */

export const COURSE_CATEGORIES = [
    "Digital Marketing",
    "Multimedia",
    "Web Development",
    "UI/UX Design",
    "Software Development",
    "E-Accounting",
];

const POPUP_LINK =
    "https://creativeadhyayan.com/#elementor-action%3Aaction%3Dpopup%3Aopen%26settings%3DeyJpZCI6IjEwNzAiLCJ0b2dnbGUiOmZhbHNlfQ%3D%3D";

export const COURSES_BY_CATEGORY = {
    /* ---------------------------- Digital Marketing --------------------------- */
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

    /* ------------------------------- Multimedia -------------------------------- */
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

    /* ----------------------------- Web Development ----------------------------- */
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

    /* ------------------------------- UI/UX Design ------------------------------- */
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

    /* --------------------------- Software Development --------------------------- */
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

    /* -------------------------------- E-Accounting -------------------------------- */
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