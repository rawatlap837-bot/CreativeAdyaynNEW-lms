import { useEffect, useRef } from "react";
import institute1 from "../assets/Images/institue1.jpeg";
import institute2 from "../assets/Images/institue2.jpeg";
import institute3 from "../assets/Images/institue3.jpeg";
import institute4 from "../assets/Images/institue4.jpeg";
import institute5 from "../assets/Images/institue5.jpeg";

const images = [institute1, institute2, institute3, institute4, institute5];

// Auto-scroll speed in pixels per millisecond (0.05 = 50px per second).
const SPEED = 0.05;

export default function InstituteGallery() {
  const trackRef = useRef(null);
  const interactionRef = useRef({ hovered: false, focused: false, touching: false, resumeAt: 0 });

  // Start in the middle copy so the visitor can scroll either way.
  useEffect(() => {
    const track = trackRef.current;
    track.scrollLeft = track.children[images.length].offsetLeft - track.children[0].offsetLeft;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    let frame;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previousTime = 0;

    // Browsers round scrollLeft to whole pixels on many screens, so a slow
    // speed (a fraction of a pixel per frame) would never move. We keep the
    // exact position in `offset` and write it back every frame instead.
    let offset = track.scrollLeft;

    const loopWidth = () => track.children[images.length].offsetLeft - track.children[0].offsetLeft;

    const animate = (time) => {
      const width = loopWidth();
      const interaction = interactionRef.current;
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;

      const paused =
        motionPreference.matches ||
        interaction.hovered ||
        interaction.focused ||
        interaction.touching ||
        time <= interaction.resumeAt;

      // If the visitor swiped, used the wheel or arrow keys, follow their position.
      if (paused || Math.abs(track.scrollLeft - offset) > 2) {
        offset = track.scrollLeft;
      }

      if (!paused) {
        offset += elapsed * SPEED;
        track.scrollLeft = offset;
      }

      // Three identical copies let either end wrap without a visible jump.
      if (!interaction.touching && width > 0) {
        if (offset >= width * 2) {
          offset -= width;
          track.scrollLeft = offset;
        } else if (offset < width) {
          offset += width;
          track.scrollLeft = offset;
        }
      }

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  const move = (direction) => {
    const track = trackRef.current;
    interactionRef.current.resumeAt = performance.now() + 4000;
    const step = track.children[1].offsetLeft - track.children[0].offsetLeft;
    track.scrollBy({
      left: direction * step,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  };

  return (
    <section
      className="bg-violet-50/60 px-5 py-14 sm:px-8 sm:py-20"
      aria-labelledby="institute-gallery-heading"
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 text-center">
          <h2
            id="institute-gallery-heading"
            className="font-pliant text-3xl font-bold tracking-tight text-[#1B0E3D] sm:text-5xl"
          >
            A Place to Learn, Grow & Build Your Future
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-600 sm:text-base">
            Discover a creative learning environment where you can develop practical skills, explore new opportunities, and take the first step toward a brighter future.
          </p>
        </div>

        <div
          onMouseEnter={() => { interactionRef.current.hovered = true; }}
          onMouseLeave={() => { interactionRef.current.hovered = false; }}
          onFocusCapture={() => { interactionRef.current.focused = true; }}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) interactionRef.current.focused = false;
          }}
        >
          <div
            ref={trackRef}
            role="region"
            aria-label="Institute photo gallery. Use arrow keys or swipe to scroll."
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                event.preventDefault();
                move(event.key === "ArrowLeft" ? -1 : 1);
              }
            }}
            onPointerDown={() => { interactionRef.current.touching = true; }}
            onPointerLeave={(event) => {
              if (event.pointerType === "mouse") interactionRef.current.touching = false;
            }}
            onPointerUp={() => {
              interactionRef.current.touching = false;
              interactionRef.current.resumeAt = performance.now() + 4000;
            }}
            onPointerCancel={() => {
              interactionRef.current.touching = false;
              interactionRef.current.resumeAt = performance.now() + 4000;
            }}
            onWheel={() => { interactionRef.current.resumeAt = performance.now() + 4000; }}
            className="relative flex gap-4 overflow-x-auto px-1 pb-4 [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:gap-6 [&::-webkit-scrollbar]:hidden"
          >
            {[...images, ...images, ...images].map((src, index) => (
              <div
                key={`${src}-${index}`}
                aria-hidden={index < images.length || index >= images.length * 2 ? true : undefined}
                className="w-[85%] shrink-0 overflow-hidden rounded-xl border border-violet-100 bg-white shadow-sm sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]"
              >
                <img
                  src={src}
                  alt={`Creative Adhyayan institute, view ${(index % images.length) + 1}`}
                  draggable={false}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
