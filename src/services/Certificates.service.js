// src/services/certificates.js
//
// Handles the real "did they actually finish the course" logic:
//   - watchForCourseCompletion(uid, name): watches this user's purchased
//     courses and their self-reported lesson progress; the moment one
//     hits progress === 100, it writes ONE certificate doc (checked
//     against enrollmentId so it's never duplicated).
//   - listenToCertificates(uid, cb): live list of certificates already earned.
//
// WHY TWO SOURCES: "purchased" lives only in the canonical enrollments/
// {uid}_{courseId} doc (written server-side by verifyRazorpayPayment —
// see firestore.rules, students can't fake this). "progress" is
// self-reported by the student as they click through lessons, and lives
// in users/{uid}/enrollments/{courseId} (see MyCourses.jsx's
// advanceLesson). A course only earns a certificate if it shows up in
// BOTH: genuinely purchased, and self-reported as finished.
//
// SECURITY NOTE (interim, until real lesson content exists): progress is
// still self-reported by the client — a student could in principle set
// their own progress to 100 without doing the work, and this would still
// mint a certificate. Closing that fully requires server-side lesson
// completion (e.g. a Cloud Function that verifies quiz/lesson state
// before writing progress) once the Lessons admin panel is wired to real
// content. Track that as a follow-up, not solved by this file alone.

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
 * Watches this user's purchased courses (canonical, server-written) and
 * cross-references their self-reported progress (subcollection). Any
 * purchased course at progress === 100 that doesn't already have a
 * matching certificate gets one issued automatically.
 * Call once (e.g. in a top-level effect) and keep the unsubscribe around.
 */
export function watchForCourseCompletion(uid, studentName) {
    // courseId -> { courseName, enrollmentId } — from the canonical,
    // server-written collection. This is the only place "purchased" is real.
    let purchasedMap = {};
    // courseId -> progress (0-100) — from the student-writable subcollection
    // that MyCourses.jsx's advanceLesson actually updates.
    let progressMap = {};

    async function checkAndIssue() {
        for (const [courseId, info] of Object.entries(purchasedMap)) {
            const progress = progressMap[courseId] ?? 0;
            if (progress < 100) continue;

            const already = await getDocs(
                query(collection(db, "certificates"), where("enrollmentId", "==", info.enrollmentId))
            );
            if (!already.empty) continue; // certificate already exists — don't duplicate

            await addDoc(collection(db, "certificates"), {
                uid,
                enrollmentId: info.enrollmentId,
                courseId,
                courseName: info.courseName || courseId,
                studentName: studentName || "Student",
                certificateId: generateCertificateId(courseId),
                issueDate: Timestamp.now(),
            });
        }
    }

    const unsubPurchased = onSnapshot(
        query(collection(db, "enrollments"), where("uid", "==", uid)),
        (snap) => {
            purchasedMap = {};
            snap.docs.forEach((d) => {
                const data = d.data();
                if (!data.courseId) return;
                purchasedMap[data.courseId] = { courseName: data.courseName, enrollmentId: d.id };
            });
            checkAndIssue();
        }
    );

    const unsubProgress = onSnapshot(
        collection(db, "users", uid, "enrollments"),
        (snap) => {
            progressMap = {};
            snap.docs.forEach((d) => {
                progressMap[d.id] = d.data().progress ?? 0;
            });
            checkAndIssue();
        }
    );

    return () => {
        unsubPurchased();
        unsubProgress();
    };
}