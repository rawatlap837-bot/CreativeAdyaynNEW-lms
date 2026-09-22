import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { onAuthStateChanged } from "../lib/auth";
import { collection, query, where, onSnapshot } from "../lib/database";
import { auth, db } from "../lib/backend";
import { Award, Download, Eye, X, Lock } from "lucide-react";
import { watchForCourseCompletion, listenToCertificates } from "../services/Certificates";
import { downloadCertificatePdf } from "../services/Certificatepdf";
import { Skeleton } from "../components/Skeleton"; // adjust path

const ACCENT = "#5227FF";
const AMBER = "#E8A33D";
const VIOLET = "#2E1A55";
const cardShadow = "shadow-lg shadow-violet-900/[0.06]";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06, ease: "easeOut" } }),
};

export default function Certificates() {
  const [uid, setUid] = useState(null);
  const [studentName, setStudentName] = useState("Student");
  const [previewCert, setPreviewCert] = useState(null);

  const [certificates, setCertificates] = useState([]);
  const [certsLoading, setCertsLoading] = useState(true);

  // Purchased courses (canonical, server-written — the only trustworthy
  // "did they buy this" source) and their self-reported progress (the
  // subcollection MyCourses.jsx's advanceLesson actually writes to).
  const [purchasedCourses, setPurchasedCourses] = useState([]);
  const [progressMap, setProgressMap] = useState({});
  const [progressLoading, setProgressLoading] = useState(true);
  const [purchasedLoading, setPurchasedLoading] = useState(true);

  useEffect(() => {
    if (!uid) return;
    setPurchasedLoading(true);
    const q = query(collection(db, "enrollments"), where("uid", "==", uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPurchasedCourses(
          snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((e) => e.courseId)
        );
        setPurchasedLoading(false);
      },
      () => setPurchasedLoading(false)
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    setProgressLoading(true);
    const unsub = onSnapshot(
      collection(db, "users", uid, "enrollments"),
      (snap) => {
        const next = {};
        snap.docs.forEach((d) => (next[d.id] = d.data().progress ?? 0));
        setProgressMap(next);
        setProgressLoading(false);
      },
      () => setProgressLoading(false)
    );
    return unsub;
  }, [uid]);

  const inProgress = purchasedCourses
    .map((e) => ({ ...e, progress: progressMap[e.courseId] ?? 0 }))
    .filter((e) => e.progress < 100);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setStudentName(user?.displayName || "Student");
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const unsub = watchForCourseCompletion(uid, studentName);
    return unsub;
  }, [uid, studentName]);

  useEffect(() => {
    if (!uid) return;
    setCertsLoading(true);
    const unsub = listenToCertificates(uid, (certs) => {
      setCertificates(certs);
      setCertsLoading(false);
    });
    return unsub;
  }, [uid]);

  const handleDownload = (cert) => {
    downloadCertificatePdf({
      studentName: cert.studentName,
      courseName: cert.courseName,
      issueDate: cert.issuedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }),
      certificateId: cert.certificateId,
    });
  };

  const loading = certsLoading || progressLoading || purchasedLoading;

  return (
    <div className="student-ui mx-auto max-w-5xl">
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0} className="mb-6">
        <h2 className="text-2xl font-black tracking-tight text-[#1B0E3D]">Certificates</h2>
        <p className="mt-1 text-sm text-[#6b5f87]">
          Earned automatically the moment you finish a course — 100% real progress, not a checkbox.
        </p>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={1} className="mb-4">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className={`rounded-3xl bg-white p-5 ${cardShadow}`}>
                <div className="flex items-start gap-3">
                  <Skeleton className="h-11 w-11 rounded-2xl shrink-0" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-1/2" />
                    <Skeleton className="h-2 w-1/3" />
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Skeleton className="h-8 flex-1 rounded-full" />
                  <Skeleton className="h-8 flex-1 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : certificates.length === 0 ? (
          <div className={`rounded-3xl bg-white p-10 text-center ${cardShadow}`}>
            <Award className="mx-auto h-8 w-8 text-[#D9D2EC]" />
            <p className="mt-3 text-sm font-bold text-[#1B0E3D]">No certificates yet</p>
            <p className="mt-1 text-xs text-[#8A82A6]">
              Finish a course to 100% and your certificate will appear here automatically.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {certificates.map((cert, i) => (
              <motion.div
                key={cert.id}
                variants={fadeUp}
                initial="hidden"
                animate="show"
                custom={2 + i}
                className={`relative overflow-hidden rounded-3xl bg-white p-5 ${cardShadow}`}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-[0.06] blur-2xl"
                  style={{ background: ACCENT }}
                />
                <div className="flex items-start gap-3">
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})` }}
                  >
                    <Award className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#1B0E3D]">{cert.courseName}</p>
                    <p className="mt-0.5 text-[11px] text-[#8A82A6]">
                      Issued {cert.issuedDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium text-[#B4ABCB]">ID: {cert.certificateId}</p>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewCert(cert)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-violet-100 py-2 text-xs font-bold text-[#6D3FC0] transition-colors hover:bg-violet-50"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownload(cert)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-bold text-white transition-transform active:scale-[0.98]"
                    style={{ background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})` }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download PDF
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {!loading && inProgress.length > 0 && (
        <motion.div variants={fadeUp} initial="hidden" animate="show" custom={6} className="mt-6">
          <h3 className="mb-3 text-sm font-bold text-[#1B0E3D]">Still in progress</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {inProgress.map((e) => (
              <div key={e.id} className={`rounded-2xl bg-white p-4 ${cardShadow}`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F7F5FC] text-[#B4ABCB]">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                  <p className="truncate text-xs font-bold text-[#1B0E3D]">{e.courseName}</p>
                </div>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-[#EFEAFB]">
                  <div className="h-full rounded-full" style={{ width: `${e.progress ?? 0}%`, background: AMBER }} />
                </div>
                <p className="mt-1.5 text-[10px] font-semibold text-[#8A82A6]">
                  {e.progress ?? 0}% complete — finish to unlock your certificate
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {previewCert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPreviewCert(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl rounded-3xl bg-white p-8 text-center shadow-2xl"
            style={{ border: `2px solid ${ACCENT}` }}
          >
            <button
              type="button"
              onClick={() => setPreviewCert(null)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-full p-1 text-[#B4ABCB] hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
            <p className="text-xs font-bold tracking-wide text-[#6D3FC0]">CREATIVE ADHYAYAN</p>
            <h3 className="mt-3 text-2xl font-black" style={{ color: ACCENT }}>
              Certificate of Completion
            </h3>
            <div className="mx-auto mt-3 h-px w-24" style={{ background: AMBER }} />
            <p className="mt-5 text-xs text-[#8A82A6]">This certifies that</p>
            <p className="mt-1 text-xl font-black text-[#1B0E3D]">{previewCert.studentName}</p>
            <p className="mt-2 text-xs text-[#8A82A6]">has successfully completed the course</p>
            <p className="mt-1 text-base font-bold" style={{ color: ACCENT }}>
              {previewCert.courseName}
            </p>
            <p className="mt-3 text-[10px] text-[#B4ABCB]">
              Issued {previewCert.issuedDate.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })} · ID: {previewCert.certificateId}
            </p>
            <button
              type="button"
              onClick={() => handleDownload(previewCert)}
              className="mt-6 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})` }}
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
