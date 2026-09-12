const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
const Razorpay = require("razorpay");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Set these once via CLI:
//   firebase functions:config:set razorpay.key_id="YOUR_KEY_ID" razorpay.key_secret="YOUR_KEY_SECRET"
const razorpay = new Razorpay({
  key_id: functions.config().razorpay.key_id,
  key_secret: functions.config().razorpay.key_secret,
});

/**
 * Looks a course up in EITHER catalog collection, since MyCourses.jsx
 * merges both "courses" (long/diploma courses) and "shortCourses".
 * Returns { ref, data } from whichever one has the doc.
 */
async function findCourse(courseId) {
  const longRef = db.collection("courses").doc(courseId);
  const longSnap = await longRef.get();
  if (longSnap.exists) return { ref: longRef, data: longSnap.data() };

  const shortRef = db.collection("shortCourses").doc(courseId);
  const shortSnap = await shortRef.get();
  if (shortSnap.exists) return { ref: shortRef, data: shortSnap.data() };

  return null;
}

/**
 * 1) Client calls this when the student clicks "Enroll Now".
 *    Creates a Razorpay order server-side using the REAL price
 *    stored in Firestore (never trust a price sent from the client).
 */
exports.createOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Please log in first.");
  }

  const { courseId } = data;
  if (!courseId) {
    throw new functions.https.HttpsError("invalid-argument", "courseId is required.");
  }

  const found = await findCourse(courseId);
  if (!found) {
    throw new functions.https.HttpsError("not-found", "Course not found.");
  }
  const course = found.data;

  if (!course.price) {
    throw new functions.https.HttpsError("failed-precondition", "This course has no price set.");
  }

  // Prevent re-buying a course already owned — matches the exact path
  // your MyCourses.jsx dashboard reads from.
  const existing = await db
    .collection("users")
    .doc(context.auth.uid)
    .collection("enrollments")
    .doc(courseId)
    .get();

  if (existing.exists && (existing.data().purchased || existing.data().enrolled)) {
    throw new functions.https.HttpsError("already-exists", "You already own this course.");
  }

  const order = await razorpay.orders.create({
    amount: Math.round(course.price * 100), // paise
    currency: "INR",
    receipt: `${context.auth.uid}_${courseId}_${Date.now()}`,
    notes: { userId: context.auth.uid, courseId },
  });

  return { orderId: order.id, amount: order.amount, currency: order.currency, courseTitle: course.title };
});

/**
 * 2) Client calls this from the Razorpay checkout success handler.
 *    Verifies the payment signature server-side, THEN grants access by
 *    writing to users/{uid}/enrollments/{courseId} — the exact document
 *    your MyCourses.jsx dashboard is already listening to with onSnapshot,
 *    so the purchased course appears there automatically, in real time,
 *    with no extra work on the dashboard side.
 */
exports.verifyPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Please log in first.");
  }

  const { courseId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = data;
  if (!courseId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new functions.https.HttpsError("invalid-argument", "Missing payment details.");
  }

  const expectedSignature = crypto
    .createHmac("sha256", functions.config().razorpay.key_secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    throw new functions.https.HttpsError("permission-denied", "Payment verification failed.");
  }

  await db
    .collection("users")
    .doc(context.auth.uid)
    .collection("enrollments")
    .doc(courseId)
    .set(
      {
        purchased: true,
        enrolled: true,
        lessonsDone: 0,
        progress: 0,
        status: "Not started",
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { success: true };
});