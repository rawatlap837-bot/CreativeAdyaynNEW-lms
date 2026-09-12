// src/auth/RequireTeacher.jsx

import { useEffect, useState } from "react";
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase/Firebase";

/* ============================================================
   LOADING SCREEN
   ============================================================ */

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">

        <div className="w-8 h-8 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin" />

        <p className="text-sm text-slate-500">
          Checking teacher access...
        </p>

      </div>
    </div>
  );
}

/* ============================================================
   REQUIRE TEACHER
   ============================================================ */

/*
  This guard protects the complete Teacher Panel.

  Access flow:

      Firebase Auth
           ↓
      Is user logged in?
           ↓
          YES
           ↓
      Read users/{uid}
           ↓
      Check role === "teacher"
           ↓
          YES
           ↓
      Allow Teacher Panel

  Everyone else is redirected away.
*/

export default function RequireTeacher({ children }) {
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!mounted) return;

        /* ----------------------------------------------------
           User is not logged in
           ---------------------------------------------------- */

        if (!currentUser) {
          setUser(null);
          setIsTeacher(false);
          setLoading(false);
          return;
        }

        setUser(currentUser);

        try {
          /* --------------------------------------------------
             Get user's Firestore profile
             -------------------------------------------------- */

          const userRef = doc(
            db,
            "users",
            currentUser.uid
          );

          const userSnap = await getDoc(userRef);

          if (!mounted) return;

          /* --------------------------------------------------
             User document doesn't exist
             -------------------------------------------------- */

          if (!userSnap.exists()) {
            console.warn(
              "Teacher access denied: user profile does not exist."
            );

            setIsTeacher(false);
            setLoading(false);
            return;
          }

          const userData = userSnap.data();

          /* --------------------------------------------------
             Check role
             -------------------------------------------------- */

          const teacher =
            userData.role === "teacher";

          setIsTeacher(teacher);
        } catch (error) {
          console.error(
            "Teacher role verification failed:",
            error
          );

          if (!mounted) return;

          setIsTeacher(false);
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /* ==========================================================
     LOADING
     ========================================================== */

  if (loading) {
    return <LoadingScreen />;
  }

  /* ==========================================================
     NOT LOGGED IN
     ========================================================== */

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  /* ==========================================================
     NOT A TEACHER
     ========================================================== */

  if (!isTeacher) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  /* ==========================================================
     TEACHER AUTHORIZED
     ========================================================== */

  /*
    Support both styles:

      <RequireTeacher>
        <Page />
      </RequireTeacher>

    and:

      <Route element={<RequireTeacher />}>
        ...
      </Route>

    Your current App.jsx uses the second style.
  */

  if (children) {
    return children;
  }

  return <Outlet />;
}