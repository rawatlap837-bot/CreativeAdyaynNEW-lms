// src/services/UserProfile.js
//
// Ensures every signed-up user gets a Firestore users/{uid} profile doc
// with an email field and a default role. Previously, signup only
// created a Firebase Auth account — no Firestore doc was ever written,
// which is why every admin promotion had to be done by hand in the
// Firebase Console. Call this right after any successful sign-up or
// first-ever sign-in.

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/Firebase";

export async function ensureUserDoc(user, extra = {}) {
  if (!user) return;
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // never overwrite an existing profile/role

  await setDoc(ref, {
    name: user.displayName || extra.name || "",
    email: user.email || "",
    role: "student", // default; promote via the admin panel afterwards
    createdAt: serverTimestamp(),
  });
}