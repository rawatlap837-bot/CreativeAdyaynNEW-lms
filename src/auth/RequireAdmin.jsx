import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase/Firebase";
import { Loader2 } from "lucide-react";

export default function RequireAdmin() {
  const [state, setState] = useState({ checked: false, allowed: false });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        console.log("No user logged in"); // TEMP DEBUG
        setState({ checked: true, allowed: false });
        return;
      }
      try {
        console.log("Checking admin for UID:", user.uid); // TEMP DEBUG
        const snap = await getDoc(doc(db, "users", user.uid));
        console.log("Doc exists?", snap.exists(), "Data:", snap.data()); // TEMP DEBUG
        const role = snap.exists() ? snap.data()?.role : null;
        console.log("Role found:", role); // TEMP DEBUG
        setState({ checked: true, allowed: role === "admin" });
      } catch (err) {
        console.error("RequireAdmin error:", err); // TEMP DEBUG
        setState({ checked: true, allowed: false });
      }
    });
    return unsub;
  }, []);

  if (!state.checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F6FC]">
        <Loader2 className="h-6 w-6 animate-spin text-[#6D3FC0]" />
      </div>
    );
  }

  if (!state.allowed) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}