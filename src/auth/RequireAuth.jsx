import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase/Firebase";

/**
 * RequireAuth — wraps protected routes (dashboard, admin) so a signed-out
 * person hitting /dashboard directly is bounced to /login instead of
 * seeing a half-loaded layout. Waits for Firebase's first auth check
 * before deciding, so a refresh doesn't flash a redirect before the
 * session is restored.
 *
 * Usage in App.jsx:
 *   <Route path="/dashboard" element={<RequireAuth><StudentLayout /></RequireAuth>}>
 */
export default function RequireAuth({ children }) {
    const [user, setUser] = useState(undefined); // undefined = still checking
    const location = useLocation();

    useEffect(() => onAuthStateChanged(auth, setUser), []);

    if (user === undefined) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#ECEEF3]">
                <div
                    className="h-8 w-8 animate-spin rounded-full border-2 border-[#6D3FC0] border-t-transparent"
                    aria-label="Checking your session…"
                />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    }

    return children;
}