import { supabase } from "./supabase";

// Keep the UI's user shape while using a single Supabase session everywhere.
export function toAppUser(user) {
  if (!user) return null;
  return {
    ...user,
    uid: user.id,
    displayName: user.user_metadata?.name || user.user_metadata?.full_name || "",
    photoURL: user.user_metadata?.avatar_url || "",
    phoneNumber: user.phone || "",
    emailVerified: Boolean(user.email_confirmed_at),
    getIdTokenResult: async () => {
      const { data, error } = await supabase.from("lms_profiles").select("role").eq("id", user.id).single();
      if (error) throw error;
      return { claims: { role: data.role } };
    },
  };
}

export const auth = { currentUser: null };
const listeners = new Set();
let initialized = false;
supabase.auth.onAuthStateChange((_event, session) => {
  auth.currentUser = toAppUser(session?.user);
  initialized = true;
  // Auth callbacks must return before another Supabase request is made.
  setTimeout(() => {
    for (const listener of listeners) listener(auth.currentUser);
  }, 0);
});

export function onAuthStateChanged(_auth, callback) {
  let active = true;
  const listener = (user) => { if (active) callback(user); };
  listeners.add(listener);
  if (initialized) queueMicrotask(() => listener(auth.currentUser));
  return () => { active = false; listeners.delete(listener); };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateProfile(_user, updates) {
  const { data, error } = await supabase.auth.updateUser({ data: {
    ...(updates.displayName !== undefined ? { name: updates.displayName } : {}),
    ...(updates.photoURL !== undefined ? { avatar_url: updates.photoURL } : {}),
  } });
  if (error) throw error;
  auth.currentUser = toAppUser(data.user);
}

export async function sendPasswordResetEmail(_auth, email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  if (error) throw error;
}
