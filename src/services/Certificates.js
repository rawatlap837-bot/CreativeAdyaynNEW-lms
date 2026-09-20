import {
    collection,
    query,
    where,
    onSnapshot,
    Timestamp,
} from "../lib/database";
import { db } from "../lib/backend"; // adjust import path to match your project

function generateCertificateId(courseId) {
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    const prefix = (courseId || "GEN").slice(0, 4).toUpperCase();
    return `CA-${prefix}-${rand}`;
}

/** Live list of certificates this user has actually earned, newest first. */
export function listenToCertificates(uid, callback) {
    const q = query(collection(db, "certificates"), where("uid", "==", uid));
    return onSnapshot(q, (snap) => {
        const certs = snap.docs.map((d) => {
            const data = d.data();
            const issuedDate = data.issueDate instanceof Timestamp ? data.issueDate.toDate() : new Date();
            return { id: d.id, ...data, issuedDate };
        });
        certs.sort((a, b) => b.issuedDate - a.issuedDate);
        callback(certs);
    });
}

/**
 * Watches this user's enrollments. Any enrollment at progress === 100 that
 * doesn't already have a matching certificate gets one issued automatically.
 * Call once (e.g. in a top-level effect) and keep the unsubscribe around.
 */
// Certificates are issued atomically by lms_complete_lesson in PostgreSQL.
// Retained for dashboard callers; no browser-side certificate issuance.
export function watchForCourseCompletion() { return () => {}; }
