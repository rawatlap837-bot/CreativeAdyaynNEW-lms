import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  collection,
  getDocs,
  orderBy,
  query,
} from "../lib/database";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Lock,
  Loader2,
  Menu,
  Play,
  PlayCircle,
  RotateCcw,
  RotateCw,
  Video,
  X,
} from "lucide-react";

import { auth, db } from "../lib/backend";
import { supabase } from "../lib/supabase";
import CourseCommunityPanel from "../components/CourseCommunityPanel";

import {
  getEnrollment,
  getLessonWatchProgress,
  markLessonComplete,
  recordLessonWatch,
} from "../services/EnrollmentService";


/* =========================================================
   HELPERS
========================================================= */

const getTimestampValue = (value) => {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  if (value instanceof Date) {
    return value;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

/*
  Builds a locked-down YouTube embed:
  - controls=0        -> hides YouTube's own control bar (no share / copy link / watch on YouTube)
  - rel=0             -> limits related videos to the same channel
  - iv_load_policy=3  -> hides annotations
  - enablejsapi=1     -> lets us drive play/pause and read state via postMessage
*/
function getYouTubeEmbedUrl(url) {
  try {
    const parsed = new URL(url);
    let videoId = "";

    if (parsed.hostname.includes("youtu.be")) {
      videoId = parsed.pathname.slice(1).split("/")[0];
    } else if (parsed.hostname.includes("youtube.com")) {
      if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/embed/")[1]?.split("/")[0];
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/shorts/")[1]?.split("/")[0];
      } else {
        videoId = parsed.searchParams.get("v") || "";
      }
    }

    if (!videoId) return null;

    const origin =
      typeof window !== "undefined"
        ? `&origin=${encodeURIComponent(window.location.origin)}`
        : "";

    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&fs=0&disablekb=1&enablejsapi=1&controls=0&iv_load_policy=3${origin}`;
  } catch {
    return null;
  }
}

const formatWatchTime = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

/*
  Anti-piracy tag drawn faintly over the video. It shows a short learner
  code instead of the student's email, so nothing personal is exposed on
  screen, while an admin can still trace a leaked recording by matching
  the code against the end of the user's id. Set to false to hide it.
*/
const SHOW_VIDEO_WATERMARK = true;

/*
  Skip buttons. Going back is always allowed. Going forward is limited to
  the furthest point the student has already watched, so the skip buttons
  can't be used to jump to the end and unlock "Mark complete". Set
  ALLOW_SKIP_AHEAD to true to let students skip anywhere. Lessons the
  student has already finished are always freely skippable.
*/
const YT_ORIGIN = "https://www.youtube-nocookie.com";
const SEEK_STEP_SECONDS = 10;
const ALLOW_SKIP_AHEAD = false;

const getLearnerCode = (uid = "") =>
  uid ? `ID-${uid.replace(/-/g, "").slice(-8).toUpperCase()}` : "";

const getYouTubeThumbnailUrl = (url) => {
  const id = getYouTubeEmbedUrl(url)?.match(/\/embed\/([^?]+)/)?.[1];
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : "";
};

/*
  A lesson only "requires" watching before completion when it's a video
  lesson that actually has a video attached. Reading/quiz-type lessons
  are unaffected.
*/
const lessonRequiresFullWatch = (lesson) =>
  Boolean(lesson && lesson.type === "video" && lesson.videoUrl);

// Cycled positions for the traceable watermark overlay, so it can't be
// simply cropped out of a screen recording.
const WATERMARK_SLOTS = [
  { top: "8%", left: "6%" },
  { top: "8%", right: "6%" },
  { bottom: "14%", right: "6%" },
  { bottom: "14%", left: "6%" },
  { top: "42%", left: "50%", transform: "translateX(-50%)" },
];


const isEnrollmentActive = (enrollment) => {
  if (!enrollment) return false;

  if (enrollment.status !== "active") {
    return false;
  }

  if (enrollment.expiresAt) {
    const expiresAt = getTimestampValue(
      enrollment.expiresAt
    );

    if (expiresAt && expiresAt < new Date()) {
      return false;
    }
  }

  return true;
};


/* =========================================================
   MAIN COMPONENT
========================================================= */

export default function LearnCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [enrollment, setEnrollment] = useState(null);

  const [selectedLesson, setSelectedLesson] = useState(null);

  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);

  const [error, setError] = useState("");
  const [contentError, setContentError] = useState("");

  const [openModules, setOpenModules] = useState({});

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [completing, setCompleting] = useState(false);

  const [screenProtectionActive, setScreenProtectionActive] =
    useState(false);
  const [tabHidden, setTabHidden] = useState(false);
  const [devToolsSuspected, setDevToolsSuspected] = useState(false);
  const [watermarkSlot, setWatermarkSlot] = useState(0);

  /*
    watchProgress: { [lessonId]: { watchedSeconds, videoEnded } }
    Loaded from the server per enrollment, then kept in sync locally
    while a video plays. The authoritative copy always lives server-side
    (lms_lesson_watch_progress) — this state is just what we show the
    student and what we compare against before enabling "Mark complete".
  */
  const [watchProgress, setWatchProgress] = useState({});
  const [videoPlaying, setVideoPlaying] = useState(false);

  // True once the YouTube player reports "ended". Used to keep the
  // end-screen suggestions covered and to show a replay button.
  const [youtubeEnded, setYoutubeEnded] = useState(false);
  const ytIframeRef = useRef(null);
  const furthestWatchedRef = useRef(0);

  // True once the YouTube player has answered. Commands are only sent after
  // that, so nothing is posted to an iframe that is still loading.
  const [ytReady, setYtReady] = useState(false);
  const ytReadyRef = useRef(false);
  const [ytTime, setYtTime] = useState({ current: 0, duration: 0 });

  // Save back-off: if the backend rejects a watch save (e.g. the RPC is
  // missing), wait before retrying instead of failing every few seconds.
  const watchSaveBlockedUntilRef = useRef(0);
  const watchSaveWarnedRef = useRef(false);

  // Seconds accumulated since the last successful save — flushed every
  // ~10s and whenever the lesson changes, the video ends, or the tab
  // is hidden.
  const watchBufferRef = useRef(0);
  const selectedLessonRef = useRef(null);
  const enrollmentRef = useRef(null);

  useEffect(() => {
    enrollmentRef.current = enrollment;
  }, [enrollment]);

  /*
    Flush buffered watch seconds to the server. Safe to call often —
    it's a no-op if nothing is buffered and playback hasn't ended.
  */
  const flushWatchProgress = async (videoEnded = false) => {
    const lesson = selectedLessonRef.current;
    const activeEnrollment = enrollmentRef.current;
    const watchedSeconds = watchBufferRef.current;

    if (!lesson || !activeEnrollment?.id || lesson.type !== "video") {
      return;
    }

    if (!watchedSeconds && !videoEnded) return;

    // The "video ended" signal always goes through; regular ticks wait.
    if (!videoEnded && Date.now() < watchSaveBlockedUntilRef.current) {
      watchBufferRef.current = Math.min(watchBufferRef.current, 60);
      return;
    }

    const lessonId = lesson.id;
    watchBufferRef.current = 0;

    try {
      const progress = await recordLessonWatch(
        activeEnrollment.id,
        lessonId,
        watchedSeconds,
        videoEnded
      );

      watchSaveBlockedUntilRef.current = 0;
      watchSaveWarnedRef.current = false;

      setWatchProgress((previous) => ({
        ...previous,
        [lessonId]: {
          watchedSeconds: Math.max(
            Number(previous[lessonId]?.watchedSeconds || 0),
            Number(progress?.watchedSeconds || 0)
          ),
          videoEnded:
            Boolean(previous[lessonId]?.videoEnded) ||
            Boolean(progress?.videoEnded),
        },
      }));
    } catch (err) {
      // Playback must stay usable even if a save fails — keep the
      // seconds buffered (capped) and retry on the next tick.
      watchBufferRef.current = Math.min(
        60,
        watchBufferRef.current + watchedSeconds
      );

      const backendMissing =
        err?.code === "PGRST202" ||
        err?.status === 404 ||
        /schema cache/i.test(err?.message || "");

      watchSaveBlockedUntilRef.current =
        Date.now() + (backendMissing ? 5 * 60 * 1000 : 15 * 1000);

      if (!watchSaveWarnedRef.current) {
        watchSaveWarnedRef.current = true;
        console.warn("Unable to save video watch time.", err?.message);
      }
    }
  };

  /*
    Save whatever's buffered for the PREVIOUS lesson before switching to
    a new one, so quickly clicking through lessons doesn't lose watch
    time. Runs on every lesson change, including unmount.
  */
  useEffect(() => {
    selectedLessonRef.current = selectedLesson;
    watchBufferRef.current = 0;
    setVideoPlaying(false);
    setYoutubeEnded(false);
    setYtTime({ current: 0, duration: 0 });
    furthestWatchedRef.current = 0;
    ytReadyRef.current = false;
    setYtReady(false);

    return () => {
      flushWatchProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesson?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    let flashTimeout;

    const blockCaptureShortcuts = (event) => {
      const key = event.key.toLowerCase();
      const blocked =
        key === "printscreen" ||
        key === "f12" ||
        (event.ctrlKey && ["p", "s", "u"].includes(key)) ||
        (event.metaKey && ["p", "s", "u"].includes(key)) ||
        // DevTools shortcuts: Ctrl/Cmd+Shift+I/J/C, Cmd+Opt+I/J/C
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          ["i", "j", "c"].includes(key)) ||
        (event.metaKey && event.altKey && ["i", "j", "c"].includes(key));

      if (blocked) {
        event.preventDefault();
        setScreenProtectionActive(true);
        window.clearTimeout(flashTimeout);
        flashTimeout = window.setTimeout(
          () => setScreenProtectionActive(false),
          1500
        );
      }
    };

    document.addEventListener("keydown", blockCaptureShortcuts);
    return () => {
      document.removeEventListener("keydown", blockCaptureShortcuts);
      window.clearTimeout(flashTimeout);
    };
  }, []);

  /*
    Best-effort DevTools-open heuristic: an open, docked DevTools panel
    shrinks the window's inner viewport relative to its outer frame.
    This is not reliable (undocked/separate-window DevTools won't trip
    it, and it can rarely false-positive on some window managers), but
    it catches the common case without any third-party library.
  */
  useEffect(() => {
    const THRESHOLD = 160;

    const checkDevTools = () => {
      const widthGap = window.outerWidth - window.innerWidth;
      const heightGap = window.outerHeight - window.innerHeight;
      setDevToolsSuspected(widthGap > THRESHOLD || heightGap > THRESHOLD);
    };

    checkDevTools();
    const interval = window.setInterval(checkDevTools, 1000);
    return () => window.clearInterval(interval);
  }, []);

  // Cycle the watermark's on-screen position so it can't just be cropped
  // out of a recording.
  useEffect(() => {
    const interval = window.setInterval(
      () => setWatermarkSlot((slot) => (slot + 1) % WATERMARK_SLOTS.length),
      9000
    );
    return () => window.clearInterval(interval);
  }, []);


  /* =====================================================
     WATCH-TIME TRACKING

     While the video is actively playing (tab visible, lesson is a
     video), tick a local counter once a second for a responsive
     "Time watched" display, and flush it to the server every ~10s
     (and immediately when the video ends). The server is the source
     of truth for whether a video actually finished — see
     lms_complete_lesson, which rejects completion for a video
     lesson unless a matching watch-progress row has video_ended=true.
  ===================================================== */

  useEffect(() => {
    if (
      !videoPlaying ||
      document.hidden ||
      !selectedLesson?.id ||
      selectedLesson.type !== "video" ||
      !isEnrollmentActive(enrollment)
    ) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      watchBufferRef.current += 1;

      setWatchProgress((previous) => {
        const current = previous[selectedLesson.id] || {};
        return {
          ...previous,
          [selectedLesson.id]: {
            watchedSeconds: Number(current.watchedSeconds || 0) + 1,
            videoEnded: Boolean(current.videoEnded),
          },
        };
      });

      if (watchBufferRef.current >= 10) {
        flushWatchProgress();
      }
    }, 1000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoPlaying, selectedLesson?.id, enrollment?.id]);

  // Flush (without marking ended) whenever the tab is hidden, so
  // switching tabs mid-video doesn't lose buffered seconds.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) flushWatchProgress();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVideoEnded = async () => {
    setVideoPlaying(false);
    setYoutubeEnded(true);
    await flushWatchProgress(true);
  };

  // Direct (non-YouTube) <video> tags report play state natively via
  // onPlay/onPause/onEnded — no bridge needed. YouTube's iframe embed
  // requires the postMessage-based IFrame API bridge below instead.
  const connectYouTubePlayer = (event) => {
    const frame = event.currentTarget;
    if (!frame?.contentWindow) return;

    const handshake = () => {
      // Stop once YouTube has answered, or if this iframe is gone.
      if (ytReadyRef.current || ytIframeRef.current !== frame) return;

      try {
        frame.contentWindow.postMessage(
          JSON.stringify({ event: "listening" }),
          YT_ORIGIN
        );
        frame.contentWindow.postMessage(
          JSON.stringify({
            event: "command",
            func: "addEventListener",
            args: ["onStateChange"],
          }),
          YT_ORIGIN
        );
      } catch {
        // Frame not ready yet; retried below.
      }
    };

    [0, 300, 900, 2000].forEach((delay) => window.setTimeout(handshake, delay));

    // If YouTube never answers, unlock the play button anyway.
    window.setTimeout(() => {
      if (ytIframeRef.current === frame) {
        ytReadyRef.current = true;
        setYtReady(true);
      }
    }, 3000);
  };

  // Sends a player command (play, pause, seek) to the YouTube iframe.
  const sendYouTubeCommand = (func, args = []) => {
    const frame = ytIframeRef.current;
    if (!frame?.contentWindow || !ytReadyRef.current) return;

    try {
      frame.contentWindow.postMessage(
        JSON.stringify({ event: "command", func, args }),
        YT_ORIGIN
      );
    } catch {
      // Player not reachable right now; ignore.
    }
  };

  // The shield sitting over the iframe is the only thing the student can
  // click, so it doubles as the play / pause / replay control.
  const handleShieldClick = () => {
    if (!ytReadyRef.current) return;

    if (youtubeEnded) {
      sendYouTubeCommand("seekTo", [0, true]);
      sendYouTubeCommand("playVideo");
      setYoutubeEnded(false);
    } else if (videoPlaying) {
      sendYouTubeCommand("pauseVideo");
    } else {
      sendYouTubeCommand("playVideo");
    }
  };

  useEffect(() => {
    const handleYouTubeMessage = (event) => {
      if (!/^https:\/\/www\.youtube(?:-nocookie)?\.com$/.test(event.origin)) {
        return;
      }

      let payload = event.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          return;
        }
      }

      if (!ytReadyRef.current) {
        ytReadyRef.current = true;
        setYtReady(true);
      }

      const info = payload?.event === "infoDelivery" ? payload.info : null;

      if (info && (info.currentTime !== undefined || info.duration)) {
        if (info.currentTime !== undefined) {
          furthestWatchedRef.current = Math.max(
            furthestWatchedRef.current,
            Number(info.currentTime) || 0
          );
        }

        setYtTime((previous) => {
          const current =
            info.currentTime !== undefined
              ? Number(info.currentTime) || 0
              : previous.current;
          const duration = info.duration
            ? Number(info.duration) || previous.duration
            : previous.duration;

          if (
            Math.floor(previous.current) === Math.floor(current) &&
            previous.duration === duration
          ) {
            return previous;
          }

          return { current, duration };
        });
      }

      const playerState =
        payload?.event === "onStateChange"
          ? Number(payload.info)
          : payload?.event === "infoDelivery"
            ? Number(payload?.info?.playerState)
            : null;

      if (!Number.isFinite(playerState)) return;

      // YouTube IFrame API player states: 1 = playing, 2 = paused, 0 = ended.
      if (playerState === 1) {
        setVideoPlaying(true);
        setYoutubeEnded(false);
      }
      if (playerState === 2 || playerState === 0) setVideoPlaying(false);
      if (playerState === 0) handleVideoEnded();
    };

    window.addEventListener("message", handleYouTubeMessage);
    return () => window.removeEventListener("message", handleYouTubeMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =====================================================
     LOAD WATCH PROGRESS FOR THIS ENROLLMENT
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadWatchProgress = async () => {
      if (!enrollment?.id) {
        setWatchProgress({});
        return;
      }

      try {
        const rows = await getLessonWatchProgress(enrollment.id);
        if (cancelled) return;

        setWatchProgress(
          rows.reduce((progress, row) => {
            progress[row.lessonId] = {
              watchedSeconds: Number(row.watchedSeconds || 0),
              videoEnded: Boolean(row.videoEnded),
            };
            return progress;
          }, {})
        );
      } catch (err) {
        // Watch history should never block a student from opening a lesson.
        console.warn("Unable to load video watch progress.", err?.message);
      }
    };

    loadWatchProgress();
    return () => {
      cancelled = true;
    };
  }, [enrollment?.id]);


  /* =====================================================
     LOAD COURSE + ENROLLMENT
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadCourse = async () => {
      try {
        setLoading(true);
        setError("");

        const user = auth.currentUser;

        if (!user) {
          navigate("/login", {
            replace: true,
            state: {
              from: `/student/courses/${courseId}`,
            },
          });

          return;
        }

        if (!courseId) {
          throw new Error("Course ID is missing.");
        }

        /* -----------------------------------------------
           Load course
        ------------------------------------------------ */

        const courseRef = await import(
          "../lib/database"
        ).then(({ doc, getDoc }) =>
          getDoc(doc(db, "courses", courseId))
        );

        if (!courseRef.exists()) {
          throw new Error("Course not found.");
        }

        const courseData = {
          id: courseRef.id,
          ...courseRef.data(),
        };

        /* -----------------------------------------------
           Only published courses are learnable
        ------------------------------------------------ */

        if (courseData.status !== "published") {
          throw new Error(
            "This course is not currently available."
          );
        }

        /* -----------------------------------------------
           Check enrollment
        ------------------------------------------------ */

        const enrollmentData = await getEnrollment(
          user.uid,
          courseId
        );

        if (cancelled) return;

        setCourse(courseData);
        setEnrollment(enrollmentData);
      } catch (err) {
        console.error(
          "Failed to load learning page:",
          {
            code: err?.code,
            message: err?.message,
            courseId,
            uid: auth.currentUser?.uid,
          }
        );

        if (!cancelled) {
          setError(
            err?.message ||
            "Unable to load this course."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId, navigate]);


  /* =====================================================
     SCROLL TO TOP ON PAGE LOAD / COURSE CHANGE
  ===================================================== */

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [courseId]);


  /* =====================================================
     LOAD MODULES + LESSONS
  ===================================================== */

  useEffect(() => {
    let cancelled = false;

    const loadContent = async () => {
      if (!course?.id) {
        return;
      }

      try {
        setContentLoading(true);
        setContentError("");

        const modulesRef = collection(
          db,
          "courses",
          course.id,
          "modules"
        );

        const modulesQuery = query(
          modulesRef,
          orderBy("order", "asc")
        );

        let modulesSnapshot;

        try {
          modulesSnapshot = await getDocs(modulesQuery);
        } catch (err) {
          // Tag the error so we know it failed on the
          // MODULES collection specifically, not lessons.
          console.error(
            "Failed to load modules:",
            {
              code: err?.code,
              message: err?.message,
              path: `courses/${course.id}/modules`,
              uid: auth.currentUser?.uid,
            }
          );
          throw err;
        }

        const { data: accessRows, error: accessError } = auth.currentUser
          ? await supabase.from("lms_module_access").select("module_id,unlocked,scheduled_for").eq("student_id", auth.currentUser.uid).eq("course_id", course.id)
          : { data: [], error: null };
        if (accessError) throw accessError;
        const accessByModule = Object.fromEntries((accessRows || []).map((row) => [row.module_id, row]));

        const moduleData = await Promise.all(
          modulesSnapshot.docs.map(
            async (moduleDoc) => {
              const module = {
                id: moduleDoc.id,
                ...moduleDoc.data(),
              };

              const lessonsRef = collection(
                db,
                "courses",
                course.id,
                "modules",
                moduleDoc.id,
                "lessons"
              );

              const lessonsQuery = query(lessonsRef);

              let lessonsSnapshot;

              try {
                lessonsSnapshot = await getDocs(lessonsQuery);
              } catch (err) {
                // Tag the error so we know it failed on the
                // LESSONS collection, and exactly which module.
                console.error(
                  "Failed to load lessons:",
                  {
                    code: err?.code,
                    message: err?.message,
                    path: `courses/${course.id}/modules/${moduleDoc.id}/lessons`,
                    uid: auth.currentUser?.uid,
                  }
                );
                throw err;
              }

              const lessons =
                lessonsSnapshot.docs.map(
                  (lessonDoc) => ({
                    id: lessonDoc.id,
                    ...lessonDoc.data(),
                  })
                ).sort((a, b) => (a.order || 0) - (b.order || 0));

              return {
                ...module,
                access: accessByModule[module.id] || null,
                locked: hasAccess && !accessByModule[module.id]?.unlocked,
                lessons,
              };
            }
          )
        );

        if (cancelled) return;

        setModules(moduleData);

        /* -----------------------------------------------
           Select first lesson automatically
        ------------------------------------------------ */

        const firstLesson =
          moduleData
            .flatMap((module) =>
              (module.lessons || []).map(
                (lesson) => ({
                  ...lesson,
                  moduleId: module.id,
                  moduleTitle: module.title,
                })
              )
            ).find((lesson) => !moduleData.find((item) => item.id === lesson.moduleId)?.locked);

        if (firstLesson) {
          setSelectedLesson(firstLesson);
        }

        if (moduleData.length > 0) {
          // Keep earlier modules visible so learners can quickly revisit
          // completed lessons for revision, including on the mobile drawer.
          setOpenModules(
            Object.fromEntries(moduleData.map((module) => [module.id, true]))
          );
        }
      } catch (err) {
        // The two inner try/catch blocks above already logged
        // exactly which collection and path failed and why.
        if (!cancelled) {
          setContentError(
            err?.code === "permission-denied"
              ? "You don't have permission to view this course's content. If you believe this is a mistake, try enrolling or contact support."
              : "Unable to load course content."
          );
        }
      } finally {
        if (!cancelled) {
          setContentLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      cancelled = true;
    };
  }, [course?.id, enrollment?.status]);


  /* =====================================================
     SCROLL TO TOP ON LESSON CHANGE
     (covers the initial auto-selected lesson too, not just
     manual navigation clicks)
  ===================================================== */

  useEffect(() => {
    if (!selectedLesson) return;

    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedLesson?.id]);


  /* =====================================================
     FLATTEN LESSONS
  ===================================================== */

  const allLessons = useMemo(() => {
    return modules.flatMap((module) =>
      (module.lessons || []).map((lesson) => ({
        ...lesson,
        moduleId: module.id,
        moduleTitle: module.title,
      }))
    );
  }, [modules]);


  /* =====================================================
     PROGRESS
  ===================================================== */

  const completedLessons = Array.isArray(
    enrollment?.completedLessons
  )
    ? enrollment.completedLessons
    : [];

  const progress =
    allLessons.length > 0
      ? Math.round(
        (completedLessons.length /
          allLessons.length) *
        100
      )
      : Number(enrollment?.progress || 0);


  /* =====================================================
     ACCESS
  ===================================================== */

  const hasAccess = isEnrollmentActive(enrollment);


  /* =====================================================
     VIDEO WATCH REQUIREMENT (for the selected lesson)
  ===================================================== */

  const requiresFullWatch = lessonRequiresFullWatch(selectedLesson);

  const watchedSecondsForLesson = Number(
    watchProgress[selectedLesson?.id]?.watchedSeconds || 0
  );

  const isSelectedLessonWatched = Boolean(
    watchProgress[selectedLesson?.id]?.videoEnded
  );

  // A screen-shy blackout fires for any of three reasons: the tab is
  // hidden, a capture shortcut was just pressed, or DevTools looks open.
  const isScreenGuarded =
    screenProtectionActive || tabHidden || devToolsSuspected;

  const watermarkText = SHOW_VIDEO_WATERMARK
    ? getLearnerCode(auth.currentUser?.uid)
    : "";

  const selectedThumbnail = selectedLesson?.videoUrl
    ? getYouTubeThumbnailUrl(selectedLesson.videoUrl)
    : "";

  const canSkipAhead = ALLOW_SKIP_AHEAD || isSelectedLessonWatched;
  const canSeekForward =
    canSkipAhead || furthestWatchedRef.current - ytTime.current > 1;

  // Jump the YouTube player forward/back by `delta` seconds.
  const handleSeekBy = (delta) => {
    let target = ytTime.current + delta;

    if (delta > 0 && !canSkipAhead) {
      target = Math.min(
        target,
        Math.max(furthestWatchedRef.current, ytTime.current)
      );
    }

    if (ytTime.duration > 0) {
      target = Math.min(target, ytTime.duration - 1);
    }

    target = Math.max(0, target);

    sendYouTubeCommand("seekTo", [target, true]);
    setYtTime((previous) => ({ ...previous, current: target }));
  };


  /* =====================================================
     SELECT LESSON
  ===================================================== */

  const selectLesson = (module, lesson) => {
    /*
      Preview lessons are available publicly.
      Non-preview lessons require active enrollment.
    */

    if (!lesson.isPreview && !hasAccess) {
      return;
    }

    setSelectedLesson({
      ...lesson,
      moduleId: module.id,
      moduleTitle: module.title,
    });
    setOpenModules((previous) => ({ ...previous, [module.id]: true }));

    setSidebarOpen(false);
  };


  /* =====================================================
     TOGGLE MODULE
  ===================================================== */

  const toggleModule = (moduleId) => {
    setOpenModules((previous) => ({
      ...previous,
      [moduleId]: !previous[moduleId],
    }));
  };


  /* =====================================================
     COMPLETE LESSON
  ===================================================== */

  const handleCompleteLesson = async () => {
    if (!selectedLesson) return;

    if (!hasAccess) {
      return;
    }

    if (completedLessons.includes(selectedLesson.id)) {
      return;
    }

    if (!enrollment?.id) {
      return;
    }

    try {
      setCompleting(true);

      const result =
        await markLessonComplete(
          enrollment.id,
          selectedLesson.id,
          allLessons.length
        );

      setEnrollment((previous) => ({
        ...previous,
        progress: result.progress,
        completedLessons:
          result.completedLessons,
      }));
    } catch (err) {
      console.error(
        "Failed to complete lesson:",
        {
          code: err?.code,
          message: err?.message,
          enrollmentId: enrollment?.id,
          lessonId: selectedLesson?.id,
        }
      );

      alert(
        err?.message ||
        "Unable to update lesson progress."
      );
    } finally {
      setCompleting(false);
    }
  };


  /* =====================================================
     NEXT LESSON
  ===================================================== */

  const handleNextLesson = () => {
    if (!selectedLesson) return;

    const currentIndex = allLessons.findIndex(
      (lesson) =>
        lesson.id === selectedLesson.id
    );

    if (
      currentIndex === -1 ||
      currentIndex >= allLessons.length - 1
    ) {
      return;
    }

    const nextLesson =
      allLessons[currentIndex + 1];

    if (!nextLesson.isPreview && !hasAccess) {
      return;
    }

    setSelectedLesson(nextLesson);
    setOpenModules((previous) => ({ ...previous, [nextLesson.moduleId]: true }));
  };


  /* =====================================================
     PREVIOUS LESSON
  ===================================================== */

  const handlePreviousLesson = () => {
    if (!selectedLesson) return;

    const currentIndex = allLessons.findIndex(
      (lesson) =>
        lesson.id === selectedLesson.id
    );

    if (currentIndex <= 0) {
      return;
    }

    const previousLesson =
      allLessons[currentIndex - 1];

    if (
      !previousLesson.isPreview &&
      !hasAccess
    ) {
      return;
    }

    setSelectedLesson(previousLesson);
    setOpenModules((previous) => ({ ...previous, [previousLesson.moduleId]: true }));
  };


  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm font-medium">
            Loading course...
          </span>
        </div>
      </div>
    );
  }


  /* =====================================================
     ERROR
  ===================================================== */

  if (error || !course) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>

          <h1 className="mt-5 text-xl font-semibold text-slate-900">
            Course unavailable
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error}
          </p>

          <Link
            to="/courses"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to courses
          </Link>
        </div>
      </div>
    );
  }


  /* =====================================================
     DERIVED
  ===================================================== */

  const selectedIndex = selectedLesson
    ? allLessons.findIndex(
      (lesson) => lesson.id === selectedLesson.id
    )
    : -1;


  /* =====================================================
     MAIN UI
  ===================================================== */

  return (
    <div className="student-ui min-h-screen bg-slate-50 pt-24 text-slate-900">

      {/* =================================================
          TOP BAR
          Not sticky — scrolls away normally with the page,
          so it can't fight your global floating navbar for
          the top of the screen.
      ================================================= */}

      <header className="border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">

          <div className="flex min-w-0 items-center gap-3">

            <button
              type="button"
              onClick={() => selectedIndex > 0 ? handlePreviousLesson() : navigate(-1)}
              className="-ml-1.5 flex shrink-0 items-center gap-1.5 rounded-lg p-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 sm:gap-2 sm:px-2.5"
              aria-label={selectedIndex > 0 ? "Go to previous lesson" : "Go back"}
              title={selectedIndex > 0 ? "Previous lesson (including earlier modules)" : "Go back"}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{selectedIndex > 0 ? "Previous lesson" : "Back"}</span>
            </button>

            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 sm:gap-2 sm:px-3 lg:hidden"
              aria-label="Open course content"
            >
              <BookOpen className="h-4 w-4" />
              <span>Lessons</span>
            </button>

            <div className="hidden h-5 w-px bg-slate-200 sm:block" />

            <h1 className="min-w-0 truncate text-sm font-semibold text-slate-900">
              {course.title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden text-right leading-tight sm:block">
              <p className="text-[11px] font-medium text-slate-500">
                Progress
              </p>
              <p className="text-sm font-semibold text-slate-900">
                {progress}%
              </p>
            </div>

            <div
              className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 sm:w-24"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-violet-600 transition-[width] duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </header>


      {/* =================================================
          MOBILE SIDEBAR OVERLAY
      ================================================= */}

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}


      {/* =================================================
          LAYOUT
      ================================================= */}

      <div className="mx-auto flex w-full max-w-[1600px] items-stretch">

        {/* =================================================
            SIDEBAR
        ================================================= */}

        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[86%] max-w-[340px]
            overflow-y-auto border-r border-slate-200
            bg-white pt-16 transition-transform duration-300 ease-out
            lg:static lg:z-auto lg:h-auto lg:min-h-[calc(100vh-6rem)]
            lg:w-[340px] lg:max-w-none lg:translate-x-0 lg:pt-0
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          `}
        >
          <div className="p-4 sm:p-5">

            <div className="mb-4 flex items-center justify-between lg:hidden">
              <span className="text-sm font-semibold text-slate-900">
                Course content
              </span>

              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close course content"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* COURSE INFO */}

            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
                Your course
              </p>

              <p className="mt-1.5 line-clamp-2 text-sm font-semibold text-slate-900">
                {course.title}
              </p>

              <div className="mt-4">
                <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>Your progress</span>
                  <span className="font-medium text-slate-700">
                    {progress}%
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-violet-600 transition-[width] duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>


            {/* ENROLLMENT WARNING */}

            {!hasAccess && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-amber-800">
                      Enrollment required
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      Only preview lessons are available
                      until you enroll.
                    </p>

                    <Link
                      to={`/courses/${course.id}`}
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 transition hover:text-amber-800"
                    >
                      View course
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            )}


            {/* COURSE CURRICULUM */}

            {!contentLoading && !contentError && modules.length > 0 && (
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Course curriculum</h2>
                  <p className="mt-0.5 text-[11px] text-slate-500">Revisit any lesson in your enrolled course</p>
                </div>
                <span className="shrink-0 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                  {modules.length} {modules.length === 1 ? "module" : "modules"} · {allLessons.length} lessons
                </span>
              </div>
            )}

            {/* MODULES */}

            {contentLoading ? (
              <div className="flex items-center gap-2 py-10 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading lessons...
              </div>
            ) : contentError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-700">
                {contentError}
              </div>
            ) : modules.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                No lessons available yet.
              </div>
            ) : (
              <div className="space-y-2">
                {modules.map((module, moduleIndex) => {
                  const isOpen = !!openModules[module.id];
                  const moduleLessonCount =
                    module.lessons?.length || 0;

                  return (
                    <div
                      key={module.id}
                      className="overflow-hidden rounded-xl border border-slate-200 bg-white"
                    >

                      {/* MODULE HEADER */}

                      <button
                        type="button"
                        onClick={() => toggleModule(module.id)}
                        className="flex w-full items-center justify-between gap-3 p-3.5 text-left transition hover:bg-slate-50"
                        aria-expanded={isOpen}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
                            {moduleIndex + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {module.title ||
                                `Module ${moduleIndex + 1}`}
                            </p>

                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {module.locked ? `Unlocks ${module.access?.scheduled_for ? new Date(`${module.access.scheduled_for}T00:00:00`).toLocaleDateString() : "after payment and its scheduled class"}` : `${moduleLessonCount} ${moduleLessonCount === 1
                                ? "lesson"
                                : "lessons"}`}
                            </p>
                          </div>
                        </div>

                        {module.locked ? <Lock className="h-4 w-4 shrink-0 text-amber-600" /> : isOpen ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                        )}
                      </button>


                      {/* LESSONS */}

                      {isOpen && (
                        <div className="border-t border-slate-200">
                          {moduleLessonCount === 0 ? (
                            <p className="px-4 py-3 text-xs text-slate-500">
                              No lessons in this module yet.
                            </p>
                          ) : (
                            module.lessons.map(
                              (lesson, lessonIndex) => {
                                const selected =
                                  selectedLesson?.id === lesson.id;

                                const completed =
                                  completedLessons.includes(
                                    lesson.id
                                  );

                                const locked =
                                  !lesson.isPreview && (!hasAccess || module.locked);

                                return (
                                  <button
                                    key={lesson.id}
                                    type="button"
                                    disabled={locked}
                                    onClick={() =>
                                      selectLesson(module, lesson)
                                    }
                                    aria-current={
                                      selected ? "true" : undefined
                                    }
                                    className={`
                                      flex w-full items-start gap-3
                                      border-l-2 px-4 py-3 text-left
                                      transition
                                      ${selected
                                        ? "border-violet-600 bg-violet-50"
                                        : "border-transparent hover:bg-slate-50"
                                      }
                                      ${locked
                                        ? "cursor-not-allowed opacity-50"
                                        : ""
                                      }
                                    `}
                                  >
                                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                                      {completed ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                      ) : locked ? (
                                        <Lock className="h-3.5 w-3.5 text-slate-400" />
                                      ) : lesson.type === "video" ? (
                                        <PlayCircle className="h-4 w-4 text-slate-400" />
                                      ) : (
                                        <BookOpen className="h-4 w-4 text-slate-400" />
                                      )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`
                                          line-clamp-2 text-[13px] font-medium leading-5
                                          ${selected
                                            ? "text-violet-700"
                                            : "text-slate-700"
                                          }
                                        `}
                                      >
                                        {lessonIndex + 1}. {lesson.title}
                                      </p>

                                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
                                        {lesson.type === "video" && (
                                          <span>Video</span>
                                        )}

                                        {lesson.duration && (
                                          <span>{lesson.duration}</span>
                                        )}

                                        {lesson.isPreview && (
                                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-medium text-emerald-700">
                                            Preview
                                          </span>
                                        )}
                                        {completed && (
                                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                            Completed · review
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                );
                              }
                            )
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>


        {/* =================================================
            MAIN LEARNING AREA
        ================================================= */}

        <main className="min-w-0 flex-1">
          {hasAccess && <div className="p-4 sm:p-6"><CourseCommunityPanel courseId={course.id} /></div>}

          {!selectedLesson ? (
            <div className="flex min-h-[70vh] items-center justify-center px-6">
              <div className="text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <BookOpen className="h-6 w-6 text-slate-400" />
                </div>

                <h2 className="mt-4 text-lg font-semibold text-slate-900">
                  Select a lesson
                </h2>

                <p className="mt-1.5 text-sm text-slate-500">
                  Choose a lesson from the course curriculum
                  to get started.
                </p>

                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 lg:hidden"
                >
                  <Menu className="h-4 w-4" />
                  Browse lessons
                </button>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-4xl">

              {/* VIDEO / CONTENT */}

              {selectedLesson.type === "video" ? (
                <div
                  className="relative aspect-video w-full select-none bg-black"
                  onContextMenu={(event) => event.preventDefault()}
                >
                  {isScreenGuarded && (
                    <div
                      className="absolute inset-0 z-20 bg-black"
                      aria-label="Video temporarily hidden for screen protection"
                    />
                  )}

                  {!isScreenGuarded && watermarkText && (
                    <div
                      className="pointer-events-none absolute z-10 select-none whitespace-nowrap rounded bg-black/0 text-[10px] font-medium tracking-widest text-white/30 sm:text-[11px]"
                      style={WATERMARK_SLOTS[watermarkSlot]}
                    >
                      {watermarkText}
                    </div>
                  )}
                  {selectedLesson.videoUrl ? (
                    selectedLesson.isPreview || hasAccess ? (
                      getYouTubeEmbedUrl(selectedLesson.videoUrl) ? (
                        <div
                          className="h-full w-full select-none"
                          onContextMenu={(event) => event.preventDefault()}
                          onDragStart={(event) => event.preventDefault()}
                        >
                          <iframe
                            ref={ytIframeRef}
                            key={selectedLesson.videoUrl}
                            src={getYouTubeEmbedUrl(selectedLesson.videoUrl)}
                            title={selectedLesson.title || "Course video"}
                            className="h-full w-full"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allow="autoplay; encrypted-media"
                            tabIndex={-1}
                            onLoad={connectYouTubePlayer}
                          />

                          {/*
                            Shield: sits over the iframe so none of YouTube's
                            own UI (share, copy link, title, logo) can be
                            clicked or right-clicked. It's also solid black
                            whenever the video is paused or ended — exactly
                            when YouTube shows its "More videos" suggestions.
                            z-[5] keeps it under the watermark (z-10) and the
                            screen-guard blackout (z-20).
                          */}
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={handleShieldClick}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                handleShieldClick();
                              }
                            }}
                            onContextMenu={(event) => event.preventDefault()}
                            aria-label={
                              youtubeEnded
                                ? "Replay video"
                                : videoPlaying
                                  ? "Pause video"
                                  : "Play video"
                            }
                            className="absolute inset-0 z-[5] flex cursor-pointer flex-col items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400"
                            style={{
                              backgroundColor: videoPlaying
                                ? "transparent"
                                : "#0b0b12",
                              backgroundImage:
                                !videoPlaying && !youtubeEnded && selectedThumbnail
                                  ? `linear-gradient(rgba(8,8,16,0.55), rgba(8,8,16,0.55)), url(${selectedThumbnail})`
                                  : "none",
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          >
                            {!videoPlaying && (
                              <>
                                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-violet-600 text-white shadow-xl ring-4 ring-white/20 transition hover:bg-violet-500">
                                  {!ytReady ? (
                                    <Loader2 className="h-7 w-7 animate-spin" />
                                  ) : youtubeEnded ? (
                                    <RotateCcw className="h-7 w-7" />
                                  ) : (
                                    <Play className="h-7 w-7 translate-x-0.5" />
                                  )}
                                </span>
                                <span className="mt-3 text-xs font-medium text-white/80">
                                  {!ytReady
                                    ? "Loading video..."
                                    : youtubeEnded
                                      ? "Watch again"
                                      : ytTime.current > 1
                                        ? "Resume"
                                        : "Play lesson"}
                                </span>
                              </>
                            )}
                          </div>

                          {/* Progress + skip controls. Forward skipping is limited to what's already been watched. */}
                          {ytTime.duration > 0 && (
                            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-10 sm:px-4">
                              <div className="h-1 overflow-hidden rounded-full bg-white/25">
                                <div
                                  className="h-full rounded-full bg-violet-500"
                                  style={{
                                    width: `${Math.min(100, (ytTime.current / ytTime.duration) * 100)}%`,
                                  }}
                                />
                              </div>

                              <div className="mt-2 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <SeekButton
                                    label={`Back ${SEEK_STEP_SECONDS} seconds`}
                                    onClick={() => handleSeekBy(-SEEK_STEP_SECONDS)}
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                    {SEEK_STEP_SECONDS}s
                                  </SeekButton>

                                  <SeekButton
                                    label={
                                      canSeekForward
                                        ? `Forward ${SEEK_STEP_SECONDS} seconds`
                                        : "Forward is available once you've watched this far"
                                    }
                                    disabled={!canSeekForward}
                                    onClick={() => handleSeekBy(SEEK_STEP_SECONDS)}
                                  >
                                    {SEEK_STEP_SECONDS}s
                                    <RotateCw className="h-3.5 w-3.5" />
                                  </SeekButton>
                                </div>

                                <span className="text-[11px] font-medium tabular-nums text-white/85">
                                  {formatWatchTime(ytTime.current)} / {formatWatchTime(ytTime.duration)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <video
                          key={selectedLesson.videoUrl}
                          src={selectedLesson.videoUrl}
                          controls
                          controlsList="nodownload noplaybackrate"
                          disablePictureInPicture
                          playsInline
                          onContextMenu={(event) => event.preventDefault()}
                          onPlay={() => setVideoPlaying(true)}
                          onPause={() => setVideoPlaying(false)}
                          onEnded={handleVideoEnded}
                          className="h-full w-full select-none object-contain"
                        />
                      )
                    ) : (
                      <LockedContent />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center px-6">
                      <div className="text-center">
                        <Video className="mx-auto h-8 w-8 text-slate-600" />
                        <p className="mt-3 text-sm text-slate-400">
                          Video is not available yet.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-[320px] px-5 py-10 sm:px-10 sm:py-14">
                  {selectedLesson.isPreview || hasAccess ? (
                    <div className="max-w-2xl">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50">
                        <BookOpen className="h-6 w-6 text-violet-600" />
                      </div>

                      <h2 className="mt-5 text-2xl font-bold leading-tight text-slate-900 sm:text-[28px]">
                        {selectedLesson.title}
                      </h2>

                      <div className="mt-5 whitespace-pre-line text-[15px] leading-7 text-slate-600">
                        {selectedLesson.description ||
                          "No lesson content has been added yet."}
                      </div>
                    </div>
                  ) : (
                    <LockedContent />
                  )}
                </div>
              )}


              {/* LESSON DETAILS */}

              <div className="border-t border-slate-200 px-5 py-6 sm:px-10">

                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">

                  <div className="min-w-0">
                    <p className="text-xs font-medium text-violet-600">
                      {selectedLesson.moduleTitle}
                    </p>

                    <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">
                      {selectedLesson.title}
                    </h2>

                    {(selectedLesson.duration || requiresFullWatch) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                        {selectedLesson.duration && (
                          <span className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {selectedLesson.duration}
                          </span>
                        )}

                        {requiresFullWatch && (
                          <span className="flex items-center gap-1.5">
                            <PlayCircle className="h-3.5 w-3.5" />
                            Time watched: {formatWatchTime(watchedSecondsForLesson)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>


                  {/* COMPLETE */}

                  {hasAccess && (
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <button
                        type="button"
                        disabled={
                          completing ||
                          completedLessons.includes(selectedLesson.id) ||
                          (requiresFullWatch && !isSelectedLessonWatched)
                        }
                        onClick={handleCompleteLesson}
                        className={`
                          inline-flex shrink-0 items-center justify-center gap-2
                          rounded-lg px-4 py-2.5 text-sm font-semibold
                          transition disabled:cursor-not-allowed disabled:opacity-60
                          ${completedLessons.includes(selectedLesson.id)
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-violet-600 text-white hover:bg-violet-500"
                          }
                        `}
                      >
                        {completing ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}

                        {completedLessons.includes(selectedLesson.id)
                          ? "Completed"
                          : "Mark complete"}
                      </button>

                      {requiresFullWatch &&
                        !isSelectedLessonWatched &&
                        !completedLessons.includes(selectedLesson.id) && (
                          <span className="text-[11px] text-slate-400">
                            Watch the full video to unlock
                          </span>
                        )}
                    </div>
                  )}
                </div>


                {/* NAVIGATION */}

                <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-200 pt-6">

                  <button
                    type="button"
                    onClick={handlePreviousLesson}
                    disabled={selectedIndex <= 0}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>

                  <span className="text-xs text-slate-500">
                    {selectedIndex >= 0 && allLessons.length > 0
                      ? `Lesson ${selectedIndex + 1} of ${allLessons.length}`
                      : ""}
                  </span>

                  <button
                    type="button"
                    onClick={handleNextLesson}
                    disabled={
                      selectedIndex === -1 ||
                      selectedIndex >= allLessons.length - 1
                    }
                    className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-violet-600"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}


/* =========================================================
   LOCKED CONTENT
========================================================= */

function LockedContent() {
  return (
    <div className="flex min-h-[320px] items-center justify-center px-6 py-14">
      <div className="max-w-sm text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <Lock className="h-6 w-6 text-slate-400" />
        </div>

        <h3 className="mt-5 text-lg font-semibold text-slate-900">
          This lesson is locked
        </h3>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Enroll in this course to access the complete lesson.
        </p>

        <Link
          to="/courses"
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
        >
          Explore courses
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}


/* =========================================================
   SEEK BUTTON
   A div (not a <button>) so global button styles can't restyle it.
========================================================= */

function SeekButton({ label, disabled = false, onClick, children }) {
  const activate = () => {
    if (!disabled) onClick();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-disabled={disabled}
      title={label}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
      className={`pointer-events-auto flex h-8 select-none items-center gap-1 rounded-full px-3 text-xs font-semibold text-white outline-none transition focus-visible:ring-2 focus-visible:ring-violet-400 ${disabled
          ? "cursor-not-allowed opacity-35"
          : "cursor-pointer hover:bg-white/20"
        }`}
      style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
    >
      {children}
    </div>
  );
}
