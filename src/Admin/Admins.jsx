import { useState } from "react";
import { Search, ShieldCheck, ShieldOff, UserCheck } from "lucide-react";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/Firebase.js";
import { AT, Card, PrimaryButton, EmptyState } from "./AdminUI.jsx";

/**
 * Promote or demote a user to admin, by email — no Firebase Console
 * required. Requires the user to have signed up at least once (so a
 * users/{uid} doc with an `email` field exists — see
 * src/services/UserProfile.js, which now auto-creates this on every
 * sign-up/sign-in).
 */
export default function Admins() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("idle"); // idle | searching | found | notfound | error
    const [found, setFound] = useState(null);
    const [error, setError] = useState("");
    const [updating, setUpdating] = useState(false);

    const search = async (e) => {
        e.preventDefault();
        const trimmed = email.trim().toLowerCase();
        if (!trimmed) return;

        setStatus("searching");
        setError("");
        setFound(null);
        try {
            const q = query(collection(db, "users"), where("email", "==", trimmed));
            const snap = await getDocs(q);
            if (snap.empty) {
                setStatus("notfound");
            } else {
                const d = snap.docs[0];
                setFound({ id: d.id, ...d.data() });
                setStatus("found");
            }
        } catch (err) {
            console.error(err);
            setError(err?.message || "Search failed.");
            setStatus("error");
        }
    };

    const setRole = async (newRole) => {
        if (!found) return;
        setUpdating(true);
        setError("");
        try {
            await updateDoc(doc(db, "users", found.id), { role: newRole });
            setFound({ ...found, role: newRole });
        } catch (err) {
            console.error(err);
            setError(err?.message || "Couldn't update role.");
        } finally {
            setUpdating(false);
        }
    };

    return (
        <div className="space-y-4">
            <Card title="Promote or demote by email">
                <div className="p-5">
                    <form onSubmit={search} className="flex gap-2">
                        <div className="relative flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" color={AT.sub} />
                            <input
                                type="email"
                                required
                                placeholder="student@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
                                style={{ borderColor: AT.line }}
                            />
                        </div>
                        <PrimaryButton type="submit" disabled={status === "searching"}>
                            {status === "searching" ? "Searching…" : "Search"}
                        </PrimaryButton>
                    </form>

                    {status === "notfound" && (
                        <p className="text-sm mt-4" style={{ color: AT.sub }}>
                            No account found for that email. They need to sign up first — accounts created
                            before this feature was added may also need to log in once to get a profile
                            created automatically.
                        </p>
                    )}

                    {status === "error" && (
                        <div className="text-sm rounded-lg px-4 py-2 mt-4" style={{ background: AT.dangerSoft, color: AT.danger }}>
                            {error}
                        </div>
                    )}

                    {found && (
                        <div className="mt-4 flex items-center justify-between rounded-lg border p-4" style={{ borderColor: AT.line }}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: AT.accentSoft }}>
                                    <UserCheck size={16} color={AT.accentDeep} />
                                </div>
                                <div>
                                    <p className="text-sm font-medium" style={{ color: AT.ink }}>
                                        {found.name || "(no name on file)"}
                                    </p>
                                    <p className="text-xs" style={{ color: AT.sub }}>
                                        {found.email} · currently <span className="font-medium capitalize">{found.role || "student"}</span>
                                    </p>
                                </div>
                            </div>
                            {found.role === "admin" ? (
                                <button
                                    disabled={updating}
                                    onClick={() => setRole("student")}
                                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-white"
                                    style={{ background: AT.danger }}
                                >
                                    <ShieldOff size={15} /> Remove admin
                                </button>
                            ) : (
                                <button
                                    disabled={updating}
                                    onClick={() => setRole("admin")}
                                    className="flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg text-white"
                                    style={{ background: AT.chrome }}
                                >
                                    <ShieldCheck size={15} /> Make admin
                                </button>
                            )}
                        </div>
                    )}

                    {error && status !== "error" && (
                        <div className="text-sm rounded-lg px-4 py-2 mt-4" style={{ background: AT.dangerSoft, color: AT.danger }}>
                            {error}
                        </div>
                    )}

                    {status === "idle" && !found && (
                        <EmptyState text="Search a signed-up user's email to change their role." />
                    )}
                </div>
            </Card>
        </div>
    );
}