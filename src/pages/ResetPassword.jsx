import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      setReady(Boolean(data.session));
      if (error || !data.session) setError("This reset link has expired. Request a new password reset email.");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) { setReady(true); setError(""); }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  async function submit(event) {
    event.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirmation) return setError("Passwords do not match.");
    setSaving(true); setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return setError(error.message);
    navigate("/dashboard", { replace: true });
  }
  return <main className="mx-auto max-w-md px-6 py-24">
    <h1 className="mb-6 text-3xl font-bold">Set a new password</h1>
    <form onSubmit={submit} className="space-y-4">
      <label className="block">New password<input className="mt-2 w-full rounded border p-3" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <label className="block">Confirm password<input className="mt-2 w-full rounded border p-3" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} /></label>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      <button disabled={!ready || saving} className="rounded bg-violet-700 px-5 py-3 text-white disabled:opacity-50">{saving ? "Saving…" : "Save password"}</button>
      <Link className="block underline" to="/forgot-password">Request a new reset link</Link>
    </form>
  </main>;
}
