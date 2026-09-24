import { useCallback, useEffect, useRef, useState } from "react";
import { getLessonWatchProgress, recordLessonWatch } from "../services/EnrollmentService";

const YT_ORIGIN = /^https:\/\/www\.youtube(-nocookie)?\.com$/;

export default function useLessonWatchTracker({ enrollment, lesson, active }) {
  const [progressMap, setProgressMap] = useState({});
  const [playing, setPlaying] = useState(false);
  const iframeRef = useRef(null);
  const bufferRef = useRef(0);
  const ctx = useRef({});
  ctx.current = { enrollmentId: enrollment?.id, lessonId: lesson?.id, isVideo: lesson?.type === "video" };

  const flush = useCallback(async (ended = false) => {
    const { enrollmentId, lessonId, isVideo } = ctx.current;
    const seconds = bufferRef.current;
    if (!enrollmentId || !lessonId || !isVideo || (!seconds && !ended)) return;
    bufferRef.current = 0;
    try {
      const row = await recordLessonWatch(enrollmentId, lessonId, seconds, ended);
      setProgressMap((p) => ({
        ...p,
        [lessonId]: {
          watchedSeconds: Number(row?.watched_seconds || 0),
          videoEnded: Boolean(row?.video_ended),
        },
      }));
    } catch {
      bufferRef.current = Math.min(15, bufferRef.current + seconds); // retry next tick
    }
  }, []);

  // load saved progress
  useEffect(() => {
    if (!enrollment?.id) return setProgressMap({});
    let cancelled = false;
    getLessonWatchProgress(enrollment.id)
      .then((rows) => {
        if (cancelled) return;
        setProgressMap(Object.fromEntries(rows.map((r) => [
          r.lesson_id,
          { watchedSeconds: r.watched_seconds, videoEnded: r.video_ended },
        ])));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enrollment?.id]);

  // save leftover time when switching lessons / leaving
  useEffect(() => {
    const captured = { enrollmentId: enrollment?.id, lessonId: lesson?.id };
    return () => {
      const s = bufferRef.current;
      bufferRef.current = 0;
      setPlaying(false);
      if (s && captured.enrollmentId && captured.lessonId) {
        recordLessonWatch(captured.enrollmentId, captured.lessonId, s, false).catch(() => {});
      }
    };
  }, [enrollment?.id, lesson?.id]);

  // count only real, visible playback
  useEffect(() => {
    if (!active || !playing || lesson?.type !== "video") return;
    const id = setInterval(() => {
      if (document.hidden) return;
      bufferRef.current += 1;
      const lessonId = ctx.current.lessonId;
      setProgressMap((p) => {
        const cur = p[lessonId] || {};
        return { ...p, [lessonId]: { watchedSeconds: (cur.watchedSeconds || 0) + 1, videoEnded: !!cur.videoEnded } };
      });
      if (bufferRef.current >= 10) flush();
    }, 1000);
    return () => clearInterval(id);
  }, [active, playing, lesson?.id, lesson?.type, flush]);

  // YouTube player state
  useEffect(() => {
    const onMessage = (e) => {
      if (!YT_ORIGIN.test(e.origin)) return;
      if (e.source !== iframeRef.current?.contentWindow) return;
      let d = e.data;
      if (typeof d === "string") { try { d = JSON.parse(d); } catch { return; } }
      const state =
        d?.event === "onStateChange" ? Number(d.info)
        : d?.event === "infoDelivery" && d.info?.playerState !== undefined ? Number(d.info.playerState)
        : NaN;
      if (!Number.isFinite(state)) return;
      if (state === 1) setPlaying(true);
      if (state === 2) { setPlaying(false); flush(); }
      if (state === 0) { setPlaying(false); flush(true); }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [flush]);

  const onIframeLoad = useCallback(() => {
    const w = iframeRef.current?.contentWindow;
    if (!w) return;
    const send = (m) => w.postMessage(JSON.stringify(m), "https://www.youtube-nocookie.com");
    send({ event: "listening", id: 1, channel: "widget" });
    setTimeout(() => send({ event: "command", func: "addEventListener", args: ["onStateChange"] }), 250);
  }, []);

  return { progress: progressMap[lesson?.id] || { watchedSeconds: 0, videoEnded: false }, iframeRef, onIframeLoad, playing };
}