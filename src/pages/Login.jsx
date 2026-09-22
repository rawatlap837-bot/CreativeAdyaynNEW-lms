import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import Cubes from "../Animiations/Cubes";
import { supabase } from "../lib/supabase";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  GraduationCap,
} from "lucide-react";

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

// The only real mobile failure case for Google sign-in is an in-app
// browser (Instagram/Facebook/WhatsApp's built-in webview) — Google
// actively blocks OAuth there for security reasons, and no client code
// can work around it.
function isInAppBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat/i.test(ua);
}

function supabaseAuthErrorMessage(error) {
  const msg = (error?.message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) return "Incorrect email or password.";
  if (msg.includes("email not confirmed")) return "Please confirm your email before logging in.";
  if (msg.includes("user not found")) return "Incorrect email or password.";
  if (msg.includes("too many requests") || msg.includes("rate limit")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (msg.includes("network")) return "Network error. Check your connection and try again.";
  if (msg.includes("popup") && msg.includes("closed")) return "";
  return error?.message || "Something went wrong. Please try again.";
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// Looks up the signed-in user's role and returns the route they should
// land on. A missing or unavailable role must never temporarily route an
// administrator into the student area.
async function resolvePostLoginRoute(userId) {
  const { data, error } = await supabase
    .from("lms_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data?.role) {
    throw new Error("We could not load your account role. Please try again.");
  }

  const role = String(data.role).toLowerCase();
  if (role === "admin") return "/admin";
  if (role === "teacher") return "/teacher/courses";
  if (role === "student") return "/dashboard";
  throw new Error("Your account role is not supported. Please contact the institute.");
}

export default function LoginForm() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const cubesRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const suppressAutoRedirect = useRef(false);

  // Already signed in (e.g. hit the back button, or opened /login from a
  // bookmark) — send them straight into their LMS instead of showing the
  // form again.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      if (user && !suppressAutoRedirect.current) {
        resolvePostLoginRoute(user.id)
          .then((dest) => navigate(dest, { replace: true }))
          .catch((error) => setErrorMsg(error.message));
      }
    });
  }, [navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  const pulseCubesFor = (fieldName, value) => {
    const col = Math.min(CUBE_GRID_SIZE - 1, value.length % (CUBE_GRID_SIZE + 3));
    const row = fieldName === "email" ? 1.5 : 4.5;
    cubesRef.current?.pulse(row, col);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    pulseCubesFor(e.target.name, e.target.value);
  };

  const handleFocus = (e) => {
    pulseCubesFor(e.target.name, e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    scrollToTop();
    setErrorMsg("");

    if (!form.email || !form.password) {
      setStatus("error");
      setErrorMsg("Enter both your email and password to continue.");
      return;
    }

    setStatus("submitting");
    cubesRef.current?.ripple(2.5, 2.5);
    try {
      // "Remember me" -> Supabase persists sessions to localStorage by
      // default (survives browser close). If unchecked, we clear the
      // session on tab close by storing a flag and relying on
      // sessionStorage instead — simplest correct approach is to just
      // sign out on window unload when remember is false.
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (error) throw error;

      if (!remember) {
        window.addEventListener("beforeunload", () => {
          supabase.auth.signOut();
        });
      }

      const dest = await resolvePostLoginRoute(data.user.id);
      setStatus("idle");
      navigate(dest);
    } catch (err) {
      setStatus("error");
      setErrorMsg(supabaseAuthErrorMessage(err));
    }
  };

  const handleGoogleSignIn = async () => {
    scrollToTop();
    setErrorMsg("");

    if (isInAppBrowser()) {
      setStatus("error");
      setErrorMsg(
        "Google sign-in doesn't work inside this app's built-in browser. Please open this page in Chrome or Safari instead."
      );
      return;
    }

    setGoogleLoading(true);
    suppressAutoRedirect.current = true;

    try {
      // signInWithOAuth redirects the whole page to Google, then back to
      // redirectTo — Supabase does not support a popup flow the way
      // Supabase's signInWithPopup did, so there's no post-redirect code
      // to run here. The redirect target page below handles routing.
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
      suppressAutoRedirect.current = false;
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
              Welcome back
            </span>
            <h1 className="mt-5 text-4xl font-black leading-[1.1] tracking-tight text-white">
              Pick up right where you left off.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/60">
              Log in to track your course progress, join live batches, and stay
              connected with your mentors.
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
            <h2 className="text-3xl font-semibold tracking-tight">Log in</h2>
            <p className="mt-2 text-sm text-[#6b5f87]">
              New here?{" "}
              <a href="/register" className="font-semibold text-[#6D3FC0] hover:underline">
                Create an account
              </a>
            </p>

            {location.state?.justRegistered && <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">Check your email and confirm your account before signing in.</p>}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide text-[#4A3D66]">
                    Password
                  </label>
                  <a href="/forgot-password" className="text-xs font-semibold text-[#6D3FC0] hover:underline">
                    Forgot password?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A79BC4]" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
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
              </div>

              <label className="flex select-none items-center gap-2 text-sm text-[#4A3D66]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-violet-200 text-[#6D3FC0] focus:ring-[#6D3FC0]/30"
                />
                Remember me
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
                  {status === "submitting" ? "Logging in…" : "Log in"}
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
              By logging in, you agree to our{" "}
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

/*
 * SETTING SOMEONE UP AS ADMIN
 * ────────────────────────────
 * 1. In Supabase, the row at public.profiles where id = their-auth-uid
 *    needs role = 'admin'. Do this from the Supabase Table Editor or SQL
 *    Editor — NEVER expose an endpoint that lets a logged-in client set
 *    their own role column.
 * 2. This is already locked down by the RLS policy in supabase_schema.sql:
 *    "users update own profile" only allows updating your OWN row, and
 *    there's no policy permitting a client to change `role` at all — do
 *    it via the dashboard (service role) instead.
 * 3. Route guard: wrap AdminLayout in a RequireAdmin component (checks
 *    profiles.role === 'admin') so someone can't just type /admin into
 *    the URL bar and get in without the role check.
 */
