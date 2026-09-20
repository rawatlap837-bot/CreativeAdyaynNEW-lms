import { supabase } from "../lib/supabase";
// The auth.users trigger creates profiles; clients cannot choose their roles.
export async function ensureUserDoc(user) {
  if (!user) return;
  const { data, error } = await supabase.from("lms_profiles").select("id").eq("id", user.id || user.uid).single();
  if (error) throw new Error("Your profile is missing. Run the Supabase migration before signing in.");
  return data;
}
