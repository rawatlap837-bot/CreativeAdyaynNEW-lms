import { useEffect, useState } from "react";

/**
 * Discourages casual copying of lesson content.
 * Returns `shield` = true when the video should be covered by a black overlay.
 *
 * This is a deterrent only: a browser cannot stop OS-level screenshots or
 * screen recorders. Pair it with a moving watermark (see LearnCourse notes).
 */
export default function useContentProtection(enabled = true) {
    const [shield, setShield] = useState(false);

    useEffect(() => {
        if (!enabled) return undefined;

        let timer;
        const flash = () => {
            setShield(true);
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setShield(false), 3000);
        };

        const block = (event) => event.preventDefault();

        const onKey = (event) => {
            const key = event.key.toLowerCase();

            // Windows fires PrintScreen on keyup only, so we listen to both events.
            if (key === "printscreen") {
                navigator.clipboard?.writeText("").catch(() => { });
                flash();
            }

            // Save / print / view-source
            if ((event.ctrlKey || event.metaKey) && ["s", "p", "u"].includes(key)) {
                event.preventDefault();
            }

            // Mac screenshot shortcuts and Windows Snip (Win+Shift+S)
            if (event.metaKey && event.shiftKey && ["3", "4", "5", "s"].includes(key)) {
                flash();
            }
        };

        const onVisibility = () => setShield(document.hidden);

        document.addEventListener("contextmenu", block);
        document.addEventListener("dragstart", block);
        document.addEventListener("keydown", onKey);
        document.addEventListener("keyup", onKey);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("beforeprint", flash);

        return () => {
            window.clearTimeout(timer);
            document.removeEventListener("contextmenu", block);
            document.removeEventListener("dragstart", block);
            document.removeEventListener("keydown", onKey);
            document.removeEventListener("keyup", onKey);
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("beforeprint", flash);
        };
    }, [enabled]);

    return { shield };
}