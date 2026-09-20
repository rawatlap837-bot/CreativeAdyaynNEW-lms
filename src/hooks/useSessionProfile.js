import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { auth, onAuthStateChanged } from "../lib/auth";

export default function useSessionProfile() {
  const [state, setState] = useState({ loading: true, user: null, profile: null, error: "" });
  useEffect(() => {
    let active = true;
    let version = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const request = ++version;
      if (!user) { setState({ loading: false, user: null, profile: null, error: "" }); return; }
      try {
        const { data, error } = await supabase.from("lms_profiles").select("role,status").eq("id", user.uid).single();
        if (!active || request !== version) return;
        setState({ loading: false, user, profile: data, error: error ? "Unable to load your account. Please try again or contact the institute." : "" });
      } catch {
        if (active && request === version) setState({ loading: false, user, profile: null, error: "Unable to connect. Please try again." });
      }
    });
    return () => { active = false; version++; unsubscribe(); };
  }, []);
  return state;
}
