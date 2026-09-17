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