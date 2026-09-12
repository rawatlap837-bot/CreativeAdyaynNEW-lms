import { motion, useTransform, useScroll } from "motion/react";
import { useEffect, useRef, useState } from "react";

import DigitalMarketing from "../assets/Images/DigitalMarketing.png";
import EAccounting from "../assets/Images/E accounting.png";
import MultimediaAnimation from "../assets/Images/Multimediea.png";
import SoftwareDevelopment from "../assets/Images/Softwaredevelopment.png";
import UIUXDesign from "../assets/Images/Ui ux.png";
import WebDevelopment from "../assets/Images/webdevelopemnt.png";

const categories = [
    { id: 1, title: "Web Development", tag: "Development", url: WebDevelopment },
    { id: 2, title: "UI/UX Design", tag: "Design", url: UIUXDesign },
    { id: 3, title: "Software Development", tag: "Development", url: SoftwareDevelopment },
    { id: 4, title: "E Accounting", tag: "Finance", url: EAccounting },
    { id: 5, title: "Multimedia Animation", tag: "Creative", url: MultimediaAnimation },
    { id: 6, title: "Digital Marketing", tag: "Marketing", url: DigitalMarketing },
];

const PopularCategory = ({ scrollContainerRef }) => {
    const targetRef = useRef(null);
    const rowRef = useRef(null);
    const [maxTranslate, setMaxTranslate] = useState(0);

    const { scrollYProgress } = useScroll({
        target: targetRef,
        ...(scrollContainerRef ? { container: scrollContainerRef } : {}),
    });

    useEffect(() => {
        const measure = () => {
            if (!rowRef.current) return;
            const rowWidth = rowRef.current.scrollWidth;
            const viewportWidth = window.innerWidth;
            const trailingGap = 32;
            setMaxTranslate(Math.max(0, rowWidth - viewportWidth + trailingGap));
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, []);

    const x = useTransform(scrollYProgress, [0, 1], [0, -maxTranslate]);

    return (
        <section ref={targetRef} className="relative h-[420vh] bg-[#1a0b33]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(212,175,110,0.08),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(122,58,201,0.25),transparent_50%)]" />

            <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden px-2">
                <span className="mb-3 text-xs font-semibold uppercase tracking-[0.35em] text-[#FFFFFF]">
                    What You Can Learn
                </span>

                <h2 className="mb-3 text-center text-4xl font-bold text-white sm:text-5xl">
                    Popular <span className="text-[#C4B2FF]">Category</span>
                </h2>

                <p className="mb-10 max-w-md text-center text-sm text-purple-200/70">
                    Six in-demand skill tracks, built to take you from beginner to
                    job-ready.
                </p>

                {/* fade mask: fully opaque in the middle, fades to transparent
                    only right at the left/right edges of the viewport —
                    pure CSS, not tied to scroll progress, can't glitch */}
                <div
                    className="w-full overflow-hidden"
                    style={{
                        WebkitMaskImage:
                            "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                        maskImage:
                            "linear-gradient(to right, transparent 0%, black 6%, black 94%, transparent 100%)",
                    }}
                >
                    <motion.div
                        ref={rowRef}
                        style={{ x }}
                        className="flex w-max flex-shrink-0 gap-8 pl-6 sm:pl-10 md:pl-16"
                    >
                        {categories.map((category) => (
                            <CategoryCard key={category.id} category={category} />
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
};

const CategoryCard = ({ category }) => {
    return (
        <div className="group relative h-[380px] w-[300px] flex-shrink-0 overflow-hidden rounded-[22px] sm:h-[440px] sm:w-[360px] lg:h-[480px] lg:w-[400px]">
            <div className="absolute inset-0 rounded-[22px] bg-gradient-to-br from-[#d4af6e]/0 via-purple-400/0 to-[#d4af6e]/0 p-[1px] transition-all duration-500 group-hover:from-[#d4af6e]/70 group-hover:via-purple-400/40 group-hover:to-[#d4af6e]/70">
                <div className="h-full w-full rounded-[21px] bg-[#160829]" />
            </div>

            <div className="absolute inset-[1px] overflow-hidden rounded-[21px] bg-[#160829]">
                <div
                    style={{
                        backgroundImage: `url(${category.url})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                    className="absolute inset-0 scale-105 grayscale-[30%] transition-all duration-700 ease-out group-hover:scale-115 group-hover:grayscale-0"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#0c0316/50] via-[#0c0316]/60 to-transparent" />

                <div className="absolute inset-x-0 bottom-0 p-6">
                    <span className="mb-2 inline-block text-[11px] font-semibold uppercase tracking-[0.25em] text-[#C4B2FF]">
                        {category.tag}
                    </span>
                    <p className="text-2xl font-bold leading-tight text-white">
                        {category.title}
                    </p>
                    <div className="mt-3 h-[2px] w-0 bg-[#C4B2FF] transition-all duration-500 group-hover:w-12" />
                </div>
            </div>
        </div>
    );
};

export default PopularCategory;