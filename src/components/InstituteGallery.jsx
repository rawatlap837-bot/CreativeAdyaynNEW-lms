import { useEffect, useRef } from "react";
import institute1 from "../assets/Images/institue1.jpeg";
import institute3 from "../assets/Images/institue3.jpeg";
import institute4 from "../assets/Images/institue4.jpeg";
import institute5 from "../assets/Images/institue5.jpeg";

const images = [institute1, institute3, institute4, institute5];

// Auto-scroll speed in pixels per millisecond (0.05 = 50px per second).
const SPEED = 0.05;

export default function InstituteGallery() {
  const trackRef = useRef(null);
  // `touching` is true only while a finger/pointer is physically dragging.
  // `impulse` is the remaining distance (px) of an arrow-key nudge.
  const stateRef = useRef({ touching: false, impulse: 0 });

  // Start in the middle copy so the visitor can scroll either way.
  useEffect(() => {
    const track = trackRef.current;
    track.scrollLeft = track.children[images.length].offsetLeft - track.children[0].offsetLeft;
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    let frame;
    let previousTime = 0;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Browsers round scrollLeft to whole pixels, so we keep the exact
    // position in `offset` and write it back every frame.
    let offset = track.scrollLeft;

    const loopWidth = () => track.children[images.length].offsetLeft - track.children[0].offsetLeft;

    const animate = (time) => {
      const width = loopWidth();
      const state = stateRef.current;
      const elapsed = previousTime ? Math.min(time - previousTime, 50) : 0;
      previousTime = time;

      // If the visitor scrolled (drag, swipe, wheel, keys), follow their position.
      if (Math.abs(track.scrollLeft - offset) > 1.5) {
        offset = track.scrollLeft;
      }

      if (state.touching) {
        // While a finger is dragging, the user is in full control.
        offset = track.scrollLeft;
      } else {
        let delta = 0;

        // Auto-scroll never stops for hover, focus, wheel or keys.
        if (!motionPreference.matches) delta += elapsed * SPEED;

        // Smooth arrow-key nudge (eases out, works together with auto-scroll).
        if (Math.abs(state.impulse) > 0.5) {
          const step = state.impulse * 0.15;
          delta += step;
          state.impulse -= step;
        } else {
          state.impulse = 0;
        }

        if (delta !== 0) {
          offset += delta;
          track.scrollLeft = offset;
        }
      }

      // Three identical copies let either end wrap without a visible jump.
      if (!state.touching && width > 0) {
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

  const nudge = (direction) => {
    const track = trackRef.current;
    const step = track.children[1].offsetLeft - track.children[0].offsetLeft;
    stateRef.current.impulse += direction * step;
  };

  const release = () => {
    stateRef.current.touching = false;
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
          ref={trackRef}
          role="region"
          aria-label="Institute photo gallery. Use arrow keys or swipe to scroll."
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
              event.preventDefault();
              nudge(event.key === "ArrowLeft" ? -1 : 1);
            }
          }}
          onPointerDown={() => { stateRef.current.touching = true; }}
          onPointerUp={release}
          onPointerCancel={release}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse") release();
          }}
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
    </section>
  );
}