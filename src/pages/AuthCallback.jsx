import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

/**
 * AuthCallback — where Supabase sends the browser back to after Google
 * OAuth. Add this route in App.jsx:
 *
 *   <Route path="/auth/callback" element={<AuthCallback />} />
 *
 * Also add the same URL (your-domain/auth/callback) to Supabase's
 * Authentication -> URL Configuration -> Redirect URLs allow-list,
 * for both localhost (dev) and your production domain.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function finishSignIn() {
      // Supabase's client library reads the auth code out of the URL
      // automatically (detectSessionInUrl defaults to true), so we just
      // need to wait for the session to be available, then route by role.
      const { data, error } = await supabase.auth.getSession();

      if (cancelled) return;

      if (error || !data.session) {
        setError("Sign-in didn't complete. Please try again.");
        return;
      }

      const userId = data.session.user.id;

      const { data: profile, error: profileError } = await supabase
        .from("lms_profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (cancelled) return;
      if (profileError || !profile?.role) {
        setError("We could not load your account role. Please try again.");
        return;
      }

      if (profile?.role === "admin") navigate("/admin", { replace: true });
      else if (profile?.role === "teacher") navigate("/teacher/courses", { replace: true });
      else if (profile.role === "student") navigate("/dashboard", { replace: true });
      else setError("Your account role is not supported. Please contact the institute.");
    }

    finishSignIn();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F8F6FC]">
      {error ? (
        <>
          <p className="text-sm font-medium text-red-600">{error}</p>
          <a href="/login" className="text-sm font-semibold text-[#6D3FC0] hover:underline">
            Back to login
          </a>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-[#6D3FC0]" />
          <p className="text-sm text-[#6b5f87]">Finishing sign-in…</p>
        </>
      )}
    </div>
  );
}
