import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Cubes from "../Animiations/Cubes";
import { supabase } from "../lib/supabase";
import {
  Mail,
  Phone,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  GraduationCap,
  Check,
} from "lucide-react";

/**
 * Register — Creative Adhyayan
 *
 * Same Google sign-in handling as LoginForm — keep the two in sync.
 * Supabase's OAuth is redirect-based (not a popup), so the actual
 * post-Google routing happens in /auth/callback (AuthCallback.jsx),
 * not in this component.
 */

function DotGrid({ className = "", dot = "fill-white/25" }) {
  return (
    <svg className={className} width="140" height="140" viewBox="0 0 140 140" fill="none" aria-hidden="true">
      {Array.from({ length: 7 }).map((_, row) =>
        Array.from({ length: 7 }).map((_, col) => (
          <circle key={`${row}-${col}`} cx={10 + col * 20} cy={10 + row * 20} r="2.5" className={dot} />
        ))
      )}
    </svg>
  );
}

const CUBE_GRID_SIZE = 8;

function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat/i.test(ua);
}

function supabaseAuthErrorMessage(error) {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("already registered") || msg.includes("already exists")) {
    return "An account already exists with this mobile number.";
  }
  if (msg.includes("password") && msg.includes("least")) {
    return "Choose a stronger password (at least 6 characters).";
  }
  if (msg.includes("invalid") && msg.includes("email")) return "That email address doesn't look right.";
  if (msg.includes("invalid") && msg.includes("phone")) return "That mobile number doesn't look right.";
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("network")) return "Network error. Check your connection and try again.";
  if (msg.includes("popup") && msg.includes("closed")) return "";
  return error?.message || "Something went wrong. Please try again.";
}

function passwordStrength(password) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const STRENGTH_LABEL = ["Too short", "Weak", "Okay", "Good", "Strong"];

export default function RegisterForm() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const cubesRef = useRef(null);
  const navigate = useNavigate();

  // Already signed in — send them straight into their LMS instead of
  // showing the registration form again.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const strength = passwordStrength(form.password);

  const pulseCubesFor = (fieldName, value) => {
    const col = Math.min(CUBE_GRID_SIZE - 1, value.length % (CUBE_GRID_SIZE + 3));
    const rowByField = { name: 0.5, phone: 2.5, email: 4.5, password: 6.5 };
    cubesRef.current?.pulse(rowByField[fieldName] ?? 3.5, col);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    pulseCubesFor(e.target.name, e.target.value);
  };

  const handleFocus = (e) => {
    pulseCubesFor(e.target.name, e.target.value);
  };

  const validate = () => {
    if (!form.name.trim()) return "Enter your name to continue.";
    if (!/^\d{10}$/.test(form.phone.replace(/\D/g, "").replace(/^91/, ""))) return "Enter a valid 10-digit mobile number.";
    if (!form.email) return "Enter your email to continue.";
    if (!form.password) return "Choose a password to continue.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (!agreed) return "Please agree to the Terms and Privacy Policy.";
    return "";
  };

  const indianPhone = (value) => {
    const digits = value.replace(/\D/g, "").replace(/^91/, "");
    return `+91${digits}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    const validationError = validate();
    if (validationError) {
      setStatus("error");
      setErrorMsg(validationError);
      return;
    }

    setStatus("submitting");
    cubesRef.current?.ripple(3.5, 3.5);
    try {
      // profiles.name/email/role get filled in automatically by the
      // handle_new_user trigger (see supabase_schema.sql) — we pass name
      // through raw_user_meta_data so that trigger can read it.
      const { data, error } = await supabase.auth.signUp({
        phone: indianPhone(form.phone),
        password: form.password,
        options: {
          data: { name: form.name.trim(), contactEmail: form.email.trim().toLowerCase() },
        },
      });
      if (error) throw error;

      // If your Supabase project has "Confirm email" turned on,
      // data.session will be null here — the person isn't logged in yet
      // until they click the confirmation link. Handle both cases.
      if (!data.session) {
        throw new Error("Phone confirmation is enabled in Supabase. Disable phone confirmation to sign users in immediately.");
      }

      setStatus("idle");
      navigate("/dashboard");
    } catch (err) {
      setStatus("error");
      setErrorMsg(supabaseAuthErrorMessage(err));
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg("");

    if (isInAppBrowser()) {
      setStatus("error");
      setErrorMsg(
        "Google sign-in doesn't work inside this app's built-in browser. Please open this page in Chrome or Safari instead."
      );
      return;
    }

    setGoogleLoading(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Browser navigates away here; nothing else runs in this component.
    } catch (err) {
      const message = supabaseAuthErrorMessage(err);
      if (message) {
        setStatus("error");
        setErrorMsg(message);
      }
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#F8F6FC]">
      <section className="relative z-10 flex min-h-screen text-[#1F1533]">
        <div className="relative hidden w-[45%] shrink-0 overflow-hidden bg-gradient-to-br from-[#1B0F38]/95 via-[#2E1A55]/95 to-[#3A2170]/95 lg:flex lg:flex-col lg:justify-between lg:p-12">
          <DotGrid className="pointer-events-none absolute right-6 top-8" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 bottom-0 h-[380px] w-[380px] rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(circle, #6D3FC0 0%, transparent 70%)" }}
          />

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative max-w-sm"
          >
            <span className="inline-block mt-20 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
              Join us
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight text-white">
              Start learning something new today.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Create your account to enroll in courses, join live batches,
              and track your progress from day one.
            </p>

            <div className="mt-7 w-full">
              <Cubes
                ref={cubesRef}
                gridSize={CUBE_GRID_SIZE}
                radius={4}
                maxAngle={32}
                faceColor="transparent"
                borderStyle="2px dashed rgba(216, 189, 250, 0.7)"
                rippleColor="#E8A33D"
                shadow="none"
                cellGap={12}
                className="w-full max-w-[240px]"
              />
            </div>
          </motion.div>
        </div>

        <div className="flex flex-1 items-center justify-center px-3 py-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="w-full max-w-sm rounded-3xl bg-white/90 p-8 shadow-xl shadow-violet-900/10 backdrop-blur-sm lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-0"
          >
            <h2 className="text-3xl font-semibold tracking-tight">Create your account</h2>
            <p className="mt-2 text-sm text-[#6b5f87]">
              Already have one?{" "}
              <a href="/login" className="font-semibold text-[#6D3FC0] hover:underline">
                Log in
              </a>
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4A3D66]">
                  Full name
                </label>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A79BC4]" />
                  <input
                    id="name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    placeholder="Ananya Sharma"
                    value={form.name}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="w-full rounded-xl border border-violet-100 bg-white py-3 pl-10 pr-4 text-sm text-[#1F1533] placeholder:text-[#A79BC4] outline-none transition-colors focus:border-[#6D3FC0] focus:ring-2 focus:ring-[#6D3FC0]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4A3D66]">
                  Mobile number
                </label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A79BC4]" />
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="9876543210"
                    value={form.phone}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="w-full rounded-xl border border-violet-100 bg-white py-3 pl-10 pr-4 text-sm text-[#1F1533] placeholder:text-[#A79BC4] outline-none transition-colors focus:border-[#6D3FC0] focus:ring-2 focus:ring-[#6D3FC0]/20"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[#8A7CA8]">Indian mobile number; +91 is added automatically.</p>
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4A3D66]">
                  Email
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A79BC4]" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="w-full rounded-xl border border-violet-100 bg-white py-3 pl-10 pr-4 text-sm text-[#1F1533] placeholder:text-[#A79BC4] outline-none transition-colors focus:border-[#6D3FC0] focus:ring-2 focus:ring-[#6D3FC0]/20"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4A3D66]">
                  Password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A79BC4]" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="w-full rounded-xl border border-violet-100 bg-white py-3 pl-10 pr-10 text-sm text-[#1F1533] placeholder:text-[#A79BC4] outline-none transition-colors focus:border-[#6D3FC0] focus:ring-2 focus:ring-[#6D3FC0]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A79BC4] transition-colors hover:text-[#6D3FC0]"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {form.password && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <span
                          key={i}
                          className="h-1 flex-1 rounded-full transition-colors"
                          style={{ background: i < strength ? "#6D3FC0" : "rgba(109, 63, 192, 0.12)" }}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] font-medium text-[#8A7CA8]">{STRENGTH_LABEL[strength]}</p>
                  </div>
                )}
              </div>

              <div className="hidden">
                <label htmlFor="confirm" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4A3D66]">
                  Confirm password
                </label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A79BC4]" />
                  <input
                    id="confirm"
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={form.confirm}
                    onChange={handleChange}
                    onFocus={handleFocus}
                    className="w-full rounded-xl border border-violet-100 bg-white py-3 pl-10 pr-10 text-sm text-[#1F1533] placeholder:text-[#A79BC4] outline-none transition-colors focus:border-[#6D3FC0] focus:ring-2 focus:ring-[#6D3FC0]/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((s) => !s)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#A79BC4] transition-colors hover:text-[#6D3FC0]"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  {form.confirm && form.confirm === form.password && (
                    <Check className="pointer-events-none absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
                  )}
                </div>
              </div>

              <label className="flex select-none items-start gap-2 text-sm text-[#4A3D66]">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-violet-200 text-[#6D3FC0] focus:ring-[#6D3FC0]/30"
                />
                <span>
                  I agree to the{" "}
                  <a href="/terms" className="font-semibold text-[#6D3FC0] hover:underline">Terms</a>{" "}
                  and{" "}
                  <a href="/privacy" className="font-semibold text-[#6D3FC0] hover:underline">Privacy Policy</a>
                </span>
              </label>

              {status === "error" && errorMsg && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600"
                >
                  {errorMsg}
                </motion.p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="group/btn relative flex w-full items-center justify-between overflow-hidden rounded-full p-1 pl-5 text-sm font-bold text-white shadow-lg shadow-violet-900/20 transition-transform active:scale-[0.98] disabled:opacity-70"
                style={{ background: "linear-gradient(135deg, #6D3FC0, #2E1A55)" }}
              >
                <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-white/20 opacity-0 transition-all duration-500 group-hover/btn:left-full group-hover/btn:opacity-100" />
                <span className="relative z-10">
                  {status === "submitting" ? "Creating account…" : "Create account"}
                </span>
                <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[#2E1A55] transition-transform duration-300 group-hover/btn:translate-x-0.5 group-hover/btn:rotate-45">
                  {status === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" strokeWidth={2.5} />}
                </span>
              </button>
            </form>

            <div className="my-7 flex items-center gap-3">
              <span className="h-px flex-1 bg-violet-100" />
              <span className="text-xs font-medium uppercase tracking-wide text-[#A79BC4]">or</span>
              <span className="h-px flex-1 bg-violet-100" />
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-violet-100 bg-white py-3 text-sm font-semibold text-[#2E1A55] transition-colors hover:border-violet-200 hover:bg-violet-50 disabled:opacity-70"
            >
              {googleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.55-5.17 3.55-8.66Z" />
                  <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z" />
                  <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.27a12 12 0 0 0 0 10.76l4-3.09Z" />
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.27 6.62l4 3.09C6.22 6.86 8.87 4.75 12 4.75Z" />
                </svg>
              )}
              {googleLoading ? "Redirecting…" : "Continue with Google"}
            </button>

            <p className="mt-8 text-center text-xs text-[#A79BC4]">
              By creating an account, you agree to our{" "}
              <a href="/terms" className="font-medium text-[#6D3FC0] hover:underline">Terms</a>{" "}
              and{" "}
              <a href="/privacy" className="font-medium text-[#6D3FC0] hover:underline">Privacy Policy</a>.
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
