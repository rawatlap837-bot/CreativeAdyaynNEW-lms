import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { onAuthStateChanged, updateProfile, sendPasswordResetEmail, signOut } from "../lib/auth";
import { doc, onSnapshot, setDoc, collection, query, where, onSnapshot as onSnap } from "../lib/database";
import { ref, uploadBytes, getDownloadURL } from "../lib/storage";
import { auth, db, storage } from "../lib/backend";
import { Camera, Pencil, Check, X, Award, BookOpen, Calendar, KeyRound, LogOut, Loader2, ShieldCheck, Sparkles, ChevronRight } from "lucide-react";
import { Skeleton } from "../components/Skeleton"; // adjust path
import { useToastState } from "../hooks/useToastState";

const ACCENT = "#5227FF";
const AMBER = "#E8A33D";
const VIOLET = "#2E1A55";
const cardShadow = "shadow-lg shadow-violet-900/[0.06]";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.4, delay: i * 0.06, ease: "easeOut" } }),
};

function initials(name, email) {
  const source = (name || email || "?").trim();
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [uid, setUid] = useState(null);
  const [authUser, setAuthUser] = useState(null);

  const [profileDoc, setProfileDoc] = useState({ phone: "", bio: "" });
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ displayName: "", phone: "", bio: "" });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [courseCount, setCourseCount] = useState(0);
  const [certCount, setCertCount] = useState(0);

  const [message, setMessage] = useToastState("", "success");
  const [error, setError] = useToastState("", "error");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      setAuthUser(user);
      if (!user) setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.exists() ? snap.data() : {};
        setProfileDoc({ phone: data.phone || "", bio: data.bio || "" });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsubEnroll = onSnap(query(collection(db, "enrollments"), where("uid", "==", uid)), (snap) =>
      setCourseCount(snap.size)
    );
    const unsubCerts = onSnap(query(collection(db, "certificates"), where("uid", "==", uid)), (snap) =>
      setCertCount(snap.size)
    );
    return () => {
      unsubEnroll();
      unsubCerts();
    };
  }, [uid]);

  const startEditing = () => {
    setForm({
      displayName: authUser?.displayName || "",
      phone: profileDoc.phone || "",
      bio: profileDoc.bio || "",
    });
    setError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setError("");
  };

  const handleSave = async () => {
    if (!authUser) return;
    setSaving(true);
    setError("");
    try {
      if (form.displayName !== authUser.displayName) {
        await updateProfile(auth.currentUser, { displayName: form.displayName });
      }
      await setDoc(
        doc(db, "users", uid),
        { phone: form.phone, bio: form.bio, updatedAt: new Date() },
        { merge: true }
      );
      setAuthUser({ ...authUser, displayName: form.displayName });
      setEditing(false);
      setMessage("Profile updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setError("Couldn't save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uid) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5MB.");
      return;
    }
    setUploadingPhoto(true);
    setError("");
    try {
      const storageRef = ref(storage, `avatars/${uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateProfile(auth.currentUser, { photoURL: url });
      setAuthUser((prev) => ({ ...prev, photoURL: url }));
      setMessage("Profile photo updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error(err);
      setError("Couldn't upload photo. Please try again.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!authUser?.email) return;
    setError("");
    try {
      await sendPasswordResetEmail(auth, authUser.email);
      setMessage(`Password reset link sent to ${authUser.email}.`);
      setTimeout(() => setMessage(""), 5000);
    } catch (err) {
      console.error(err);
      setError("Couldn't send reset email. Please try again.");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    navigate("/login");
  };

  const memberSince = authUser?.metadata?.creationTime
    ? new Date(authUser.metadata.creationTime).toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : "—";

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className={`relative overflow-hidden rounded-3xl bg-white p-7 ${cardShadow}`}>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <Skeleton className="h-20 w-20 rounded-full shrink-0" />
            <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
              <Skeleton className="h-4 w-40 mx-auto sm:mx-0" />
              <Skeleton className="h-3 w-56 mx-auto sm:mx-0" />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`rounded-2xl bg-white p-4 text-center space-y-2 ${cardShadow}`}>
              <Skeleton className="h-4 w-4 mx-auto rounded-full" />
              <Skeleton className="h-4 w-8 mx-auto" />
              <Skeleton className="h-2 w-12 mx-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="student-ui min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_50%_0%,_#EAE4FF_0,_#ECEEF3_35%,_#F8F7FC_100%)]">
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28">
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={0} className="mb-5 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#6D3FC0]"><Sparkles className="h-3.5 w-3.5" /> Student account</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#1B0E3D]">Your profile</h1>
          <p className="mt-1 text-sm text-[#6B5F87]">Keep your learning profile and account details up to date.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-3 py-2 text-xs font-bold text-[#62567F] shadow-sm"><ShieldCheck className="h-4 w-4 text-emerald-500" /> Account secured</div>
      </motion.div>
      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={1} className={`relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/90 p-6 sm:p-8 ${cardShadow}`}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full opacity-[0.14] blur-2xl"
          style={{ background: ACCENT }}
        />
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            {authUser?.photoURL ? (
              <img src={authUser.photoURL} alt="Profile" className="h-24 w-24 rounded-3xl object-cover ring-4 ring-violet-100" />
            ) : (
              <div
                className="flex h-24 w-24 items-center justify-center rounded-3xl text-2xl font-black text-white shadow-lg shadow-violet-500/25"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})` }}
              >
                {initials(authUser?.displayName, authUser?.email)}
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
              aria-label="Change profile photo"
              className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-white text-[#6D3FC0] shadow-md transition-colors hover:bg-violet-50"
            >
              {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
          </div>

          <div className="min-w-0 flex-1 text-center sm:text-left">
            {!editing ? (
              <>
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start"><p className="text-xl font-black text-[#1B0E3D]">{authUser?.displayName || "Add your name"}</p><span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#6D3FC0]">Student</span></div>
                <p className="mt-0.5 text-xs text-[#8A82A6]">{authUser?.email}</p>
                {profileDoc.bio && <p className="mt-2 text-xs leading-relaxed text-[#6b5f87]">{profileDoc.bio}</p>}
              </>
            ) : (
              <div className="space-y-2">
                <input
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="Full name"
                  className="w-full rounded-xl border border-violet-100 px-3 py-2 text-sm font-bold text-[#1B0E3D] outline-none focus:border-[#6D3FC0]"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number"
                  className="w-full rounded-xl border border-violet-100 px-3 py-2 text-xs text-[#1B0E3D] outline-none focus:border-[#6D3FC0]"
                />
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                  placeholder="Short bio"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-violet-100 px-3 py-2 text-xs text-[#1B0E3D] outline-none focus:border-[#6D3FC0]"
                />
              </div>
            )}
          </div>

          <div className="shrink-0">
            {!editing ? (
              <button
                type="button"
                onClick={startEditing}
                className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#5227FF] to-[#6D3FC0] px-4 py-2 text-xs font-bold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  aria-label="Cancel"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-violet-100 text-[#8A82A6] hover:bg-violet-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  aria-label="Save"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-white disabled:opacity-60"
                  style={{ background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})` }}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
              </div>
            )}
          </div>
        </div>

        {!editing && profileDoc.phone && (
          <p className="mt-4 text-center text-xs text-[#8A82A6] sm:text-left">{profileDoc.phone}</p>
        )}
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={2} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={`flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/90 p-4 ${cardShadow}`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100"><BookOpen className="h-5 w-5" style={{ color: ACCENT }} /></span>
          <div><p className="text-xl font-black text-[#1B0E3D]">{courseCount}</p><p className="text-[10px] font-semibold text-[#8A82A6]">Enrolled courses</p></div>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border border-amber-100 bg-white/90 p-4 ${cardShadow}`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50"><Award className="h-5 w-5" style={{ color: AMBER }} /></span>
          <div><p className="text-xl font-black text-[#1B0E3D]">{certCount}</p><p className="text-[10px] font-semibold text-[#8A82A6]">Certificates earned</p></div>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white/90 p-4 ${cardShadow}`}>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50"><Calendar className="h-5 w-5 text-emerald-500" /></span>
          <div><p className="text-sm font-black text-[#1B0E3D]">{memberSince}</p><p className="text-[10px] font-semibold text-[#8A82A6]">Member since</p></div>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className={`mt-4 rounded-[2rem] border border-white/80 bg-white/90 p-5 sm:p-6 ${cardShadow}`}>
        <div className="mb-4"><h3 className="text-base font-black text-[#1B0E3D]">Account settings</h3><p className="mt-1 text-xs text-[#8A82A6]">Manage your account security and session.</p></div>

        <button
          type="button"
          onClick={handlePasswordReset}
          className="group flex w-full items-center justify-between rounded-2xl border border-violet-100 bg-[#F7F5FC] px-4 py-3.5 text-left transition hover:border-violet-300 hover:bg-violet-50"
        >
          <span className="flex items-center gap-2.5">
            <KeyRound className="h-4 w-4 text-[#6D3FC0]" />
            <span className="text-xs font-bold text-[#1B0E3D]">Reset password</span>
          </span>
          <span className="flex items-center gap-2 text-[10px] text-[#8A82A6]"><span className="hidden sm:inline">Sends a link to {authUser?.email}</span><ChevronRight className="h-4 w-4 text-[#6D3FC0] transition group-hover:translate-x-0.5" /></span>
        </button>

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-3 flex w-full items-center justify-between rounded-2xl border border-red-100 bg-[#FDF2F2] px-4 py-3.5 text-left transition hover:bg-red-50"
        >
          <span className="flex items-center gap-2.5"><LogOut className="h-4 w-4 text-red-500" /><span className="text-xs font-bold text-red-500">Sign out</span></span><ChevronRight className="h-4 w-4 text-red-400" />
        </button>
      </motion.div>
      </div>
    </div>
  );
}
