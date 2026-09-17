// functions/notifications.js
//
// Notifies every admin when something happens in the LMS:
//   - a new user signs up
//   - a student enrolls in a course
//   - a payment is verified as paid
//
// These run with the Admin SDK, so they bypass firestore.rules — the client
// is NOT trusted to write notifications for other users (a student calling
// createNotification() for the admin would be a self-notification exploit).
//
// Deploy: firebase deploy --only functions

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/**
 * Fan a notification out to every admin user.
 */
async function notifyAdmins({ type, title, message, link = "", courseId = null, actorId = null }) {
    const adminsSnap = await db.collection("users").where("role", "==", "admin").get();

    if (adminsSnap.empty) {
        logger.warn("notifyAdmins: no admin users found, nothing to notify.");
        return;
    }

    const batch = db.batch();

    adminsSnap.docs.forEach((adminDoc) => {
        const ref = db.collection("notifications").doc();
        batch.set(ref, {
            recipientId: adminDoc.id,
            type,
            title,
            message,
            link,
            courseId,
            actorId,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    });

    await batch.commit();
}

/* ============================================================
   NEW USER SIGNED UP
   Fires when users/{userId} is first created (Register.jsx
   writes this doc right after Firebase Auth account creation).
============================================================ */

exports.onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
    const user = event.data?.data();
    if (!user) return;

    // Don't notify admins about other admins being created (e.g. seeding).
    if (user.role === "admin") return;

    await notifyAdmins({
        type: "system",
        title: "New user joined",
        message: `${user.name || user.fullName || user.email || "A new user"} signed up as a ${user.role || "student"}.`,
        link: "/admin/students",
        actorId: event.params.userId,
    });
});

/* ============================================================
   NEW ENROLLMENT
   Fires on enrollments/{uid_courseId} creation — covers both
   free enrollments and paid ones once verifyRazorpayPayment
   (see razorpay.js) creates/merges the doc.
============================================================ */

exports.onEnrollmentCreated = onDocumentCreated("enrollments/{enrollmentId}", async (event) => {
    const enrollment = event.data?.data();
    if (!enrollment) return;

    const courseId = enrollment.courseId;
    let courseName = enrollment.courseName;

    if (!courseName && courseId) {
        const courseSnap = await db.collection("courses").doc(courseId).get();
        courseName = courseSnap.exists ? courseSnap.data()?.title : "a course";
    }

    await notifyAdmins({
        type: "system",
        title: "New enrollment",
        message: `A student enrolled in "${courseName || "a course"}".`,
        link: "/admin/students",
        courseId: courseId || null,
        actorId: enrollment.uid || null,
    });
});

/* ============================================================
   PAYMENT CONFIRMED
   Fires when payments/{orderId}.status transitions to "paid"
   (set by verifyRazorpayPayment in razorpay.js).
============================================================ */

exports.onPaymentConfirmed = onDocumentUpdated("payments/{orderId}", async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    if (before.status === "paid" || after.status !== "paid") return; // only fire on the transition

    await notifyAdmins({
        type: "payment",
        title: "Payment received",
        message: `₹${after.amount} received for "${after.courseName || "a course"}".`,
        link: "/admin/payments",
        courseId: after.courseId || null,
        actorId: after.uid || null,
    });
});

/* ============================================================
   COURSE PUBLISHED
   Fires when a teacher/admin changes a course to published.
============================================================ */

exports.onCoursePublished = onDocumentUpdated("courses/{courseId}", async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    if (before.status === "published" || after.status !== "published") return;

    await notifyAdmins({
        type: "course_published",
        title: "Course published",
        message: `"${after.title || "A course"}" is now published.`,
        link: "/admin/courses",
        courseId: event.params.courseId,
        actorId: after.instructorId || null,
    });
});

/* ============================================================
   ANNOUNCEMENT CREATED OR PUBLISHED
============================================================ */

exports.onAnnouncementCreated = onDocumentCreated("announcements/{announcementId}", async (event) => {
    const announcement = event.data?.data();
    if (!announcement || announcement.status === "draft") return;

    await notifyAdmins({
        type: "announcement",
        title: "New announcement",
        message: announcement.title || "A new announcement was published.",
        link: "/admin/announcements",
        courseId: announcement.courseId || null,
        actorId: announcement.authorId || null,
    });
});

exports.onAnnouncementPublished = onDocumentUpdated("announcements/{announcementId}", async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    if (before.status === "published" || after.status !== "published") return;

    await notifyAdmins({
        type: "announcement",
        title: "Announcement published",
        message: after.title || "An announcement was published.",
        link: "/admin/announcements",
        courseId: after.courseId || null,
        actorId: after.authorId || null,
    });
});

/* ============================================================
   REFUND
   Handles refund/refunded status transitions from payment providers.
============================================================ */

exports.onPaymentRefunded = onDocumentUpdated("payments/{orderId}", async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const wasRefunded = ["refunded", "refund_completed"].includes(before.status);
    const isRefunded = ["refunded", "refund_completed"].includes(after.status);

    if (wasRefunded || !isRefunded) return;

    await notifyAdmins({
        type: "refund",
        title: "Refund processed",
        message: `A refund of ₹${after.amount || 0} was processed for "${after.courseName || "a course"}".`,
        link: "/admin/payments",
        courseId: after.courseId || null,
        actorId: after.uid || null,
    });
});

/* ============================================================
   ANNOUNCEMENT EXPIRY
   Runs hourly and marks expired announcements once, then notifies admins.
============================================================ */

exports.onAnnouncementsExpire = onSchedule("every 60 minutes", async () => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db.collection("announcements")
        .where("status", "==", "published")
        .get();

    const expiredAnnouncements = snapshot.docs.filter((announcementDoc) => {
        const endAt = announcementDoc.data()?.endAt;
        return endAt && typeof endAt.toMillis === "function" && endAt.toMillis() <= now.toMillis();
    });

    if (expiredAnnouncements.length === 0) return;

    for (const announcementDoc of expiredAnnouncements) {
        const announcement = announcementDoc.data();

        await announcementDoc.ref.update({
            status: "expired",
            expiredAt: now,
            updatedAt: now,
        });

        await notifyAdmins({
            type: "announcement_expired",
            title: "Announcement expired",
            message: announcement.title || "An announcement expired.",
            link: "/admin/announcements",
            courseId: announcement.courseId || null,
            actorId: announcement.authorId || null,
        });
    }
});