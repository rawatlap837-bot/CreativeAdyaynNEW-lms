// src/services/certificates.js
//
// Handles the real "did they actually finish the course" logic:
//   - watchForCourseCompletion(uid, name): watches this user's enrollments;
//     the moment one hits progress === 100, it writes ONE certificate doc
//     (checked against enrollmentId so it's never duplicated).
//   - listenToCertificates(uid, cb): live list of certificates already earned.
//
// SECURITY NOTE: this issues the certificate from the client the instant it
// sees progress hit 100 in Firestore. That's fine for a v1, but it means
// anyone who can write to their own `enrollments` doc could set progress to
// 100 directly and mint a certificate for a course they didn't finish.
// Two ways to close that:
//   1. (minimum) Firestore rule that only allows creating a certificate doc
//      if a `lessonsCompleted == totalLessons` style check passes server-side
//      via `get()` on the enrollment doc — see the rules snippet in chat.
//   2. (recommended once certificates matter) move issuance into a Cloud
//      Function triggered on enrollment writes, so completion is verified
//      with logic the client can never touch.

import {
    collection,
    query,
    where,
    onSnapshot,
    addDoc,
    getDocs,
    Timestamp,
} from "firebase/firestore";
import { db } from "../firebase/Firebase"; // adjust import path to match your project

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
export function watchForCourseCompletion(uid, studentName) {
    const enrollmentsQuery = query(collection(db, "enrollments"), where("uid", "==", uid));

    const unsub = onSnapshot(enrollmentsQuery, async (snap) => {
        for (const enrollmentDoc of snap.docs) {
            const enrollment = enrollmentDoc.data();
            if ((enrollment.progress ?? 0) < 100) continue;

            const already = await getDocs(
                query(collection(db, "certificates"), where("enrollmentId", "==", enrollmentDoc.id))
            );
            if (!already.empty) continue; // certificate already exists — don't duplicate

            await addDoc(collection(db, "certificates"), {
                uid,
                enrollmentId: enrollmentDoc.id,
                courseId: enrollment.courseId || enrollmentDoc.id,
                courseName: enrollment.courseName,
                studentName: studentName || "Student",
                certificateId: generateCertificateId(enrollment.courseId || enrollmentDoc.id),
                issueDate: Timestamp.now(),
            });
        }
    });

    return unsub;
}