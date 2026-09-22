import { Navigate, Outlet, useLocation } from "react-router-dom";
import useSessionProfile from "../hooks/useSessionProfile";
import usePresence from "../hooks/usePresence";
import { signOut } from "../lib/auth";

export default function AccessGate({ roles, children }) {
  const { loading, user, profile, error } = useSessionProfile();
  const location = useLocation();
  usePresence(profile?.status === "active" ? user?.uid : null);
  if (loading) return <div className="flex min-h-screen items-center justify-center" role="status">Checking your session…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (error || profile?.status !== "active") return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
    <p role="alert">{error || "Your account is blocked. Please contact the institute."}</p>
    {error && <button className="underline" onClick={() => window.location.reload()}>Try again</button>}
    <button className="underline" onClick={() => signOut().catch(() => window.location.reload())}>Sign out</button>
  </div>;
  const role = String(profile?.role || "").trim().toLowerCase();
  const allowedRoles = roles?.map((item) => String(item).trim().toLowerCase());

  if (!role) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
    <p role="alert">Your account has no assigned role. Please contact the institute administrator.</p>
    <button className="underline" onClick={() => signOut().catch(() => window.location.reload())}>Sign out</button>
  </div>;

  if (allowedRoles && !allowedRoles.includes(role)) {
    const homeByRole = {
      admin: "/admin",
      teacher: "/teacher/courses",
      student: "/dashboard",
    };

    const destination = homeByRole[role];
    if (destination) return <Navigate to={destination} replace />;

    return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <p role="alert">Your account role is not supported. Please contact the institute administrator.</p>
      <button className="underline" onClick={() => signOut().catch(() => window.location.reload())}>Sign out</button>
    </div>;
  }
  return children || <Outlet />;
}
