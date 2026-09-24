import { useEffect, useState } from "react";
import { ExternalLink, Loader2, MessageCircle, Video } from "lucide-react";
import { getStudentCourseCommunity, openCourseWhatsAppGroup } from "../services/CourseCommunityService";

export default function CourseCommunityPanel({ courseId, compact = false }) {
  const [community, setCommunity] = useState(null);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getStudentCourseCommunity(courseId)
      .then((value) => { if (!cancelled) setCommunity(value); })
      .catch((err) => {
        if (!cancelled) setError(err?.message || "Unable to load the course group.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [courseId]);

  async function handleJoin() {
    setOpening(true);
    setError("");
    const popup = window.open("about:blank", "_blank");
    try {
      const result = await openCourseWhatsAppGroup(courseId);
      setCommunity(result);
      if (!result?.whatsapp_url) {
        popup?.close();
        setConfirming(false);
        return;
      }
      if (popup) popup.location.href = result.whatsapp_url;
      else window.location.href = result.whatsapp_url;
      setConfirming(false);
    } catch (err) {
      popup?.close();
      setError(err?.message || "Unable to open the course group.");
    } finally {
      setOpening(false);
    }
  }

  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading course community…</div>;
  if (error && !community) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  if (!community) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Group not created yet.</div>;

  return (
    <section className={`rounded-xl border border-emerald-200 bg-emerald-50 ${compact ? "p-3" : "p-4 sm:p-5"}`}>
      <h2 className="flex items-center gap-2 font-semibold text-slate-900"><MessageCircle className="h-5 w-5 text-emerald-600" />Course community</h2>
      {community.group_rules && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{community.group_rules}</p>}
      {community.live_class_url && <a href={community.live_class_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-violet-700 hover:underline"><Video className="h-4 w-4" />Join live class<ExternalLink className="h-3.5 w-3.5" /></a>}
      {community.whatsapp_url ? (
        confirming ? (
          <div className="mt-3 rounded-lg bg-white p-3">
            <p className="text-sm text-slate-700">Your phone number will be visible to group members. Follow the group rules.</p>
            {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={opening} onClick={handleJoin} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{opening && <Loader2 className="h-4 w-4 animate-spin" />}{opening ? "Opening…" : "Continue to WhatsApp"}</button>
              <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700">Cancel</button>
            </div>
          </div>
        ) : <button type="button" onClick={() => setConfirming(true)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"><MessageCircle className="h-4 w-4" />Join WhatsApp Group</button>
      ) : <p className="mt-3 text-sm text-slate-600">Group not created yet.</p>}
      {error && community && !confirming && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
