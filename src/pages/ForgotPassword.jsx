import { useState } from "react";
import { Link } from "react-router-dom";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/Firebase";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");

    if (!email.trim()) {
      setStatus("error");
      setMessage("Enter your email address first.");
      return;
    }

    try {
      setStatus("submitting");

      await sendPasswordResetEmail(auth, email.trim());

      setStatus("success");
      setMessage(
        "If an account exists for this email, a password-reset link has been sent. Check your inbox and spam folder."
      );
    } catch (error) {
      console.error("Password reset error:", error);

      setStatus("error");

      if (error.code === "auth/invalid-email") {
        setMessage("Enter a valid email address.");
      } else if (error.code === "auth/too-many-requests") {
        setMessage("Too many attempts. Please try again later.");
      } else {
        setMessage("Unable to send the reset email. Please try again.");
      }
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8F6FC] px-4">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-violet-900/10">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#6D3FC0] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to login
        </Link>

        <h1 className="mt-7 text-3xl font-semibold text-[#1F1533]">
          Reset password
        </h1>

        <p className="mt-2 text-sm leading-6 text-[#6b5f87]">
          Enter your account email address and we’ll send you a password-reset link.
        </p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4A3D66]"
            >
              Email
            </label>

            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A79BC4]" />

              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-violet-100 bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:border-[#6D3FC0] focus:ring-2 focus:ring-[#6D3FC0]/20"
              />
            </div>
          </div>

          {message && (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${
                status === "success"
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-600"
              }`}
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={status === "submitting"}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#6D3FC0] px-5 py-3 text-sm font-bold text-white disabled:opacity-70"
          >
            {status === "submitting" && (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}

            {status === "submitting"
              ? "Sending reset link…"
              : "Send reset link"}
          </button>
        </form>
      </section>
    </main>
  );
}