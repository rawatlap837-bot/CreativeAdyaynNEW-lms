// functions/razorpay.js
//
// Two callable Cloud Functions:
//   createRazorpayOrder   — client asks for an order before opening checkout
//   verifyRazorpayPayment — client reports the checkout result; THIS function
//                           is the only place that decides a payment is real
//
// Setup:
//   1. cd functions && npm install razorpay
//   2. Get API keys: Razorpay Dashboard → Settings → API Keys
//      (use the Test keys while developing, Live keys only in production)
//   3. Store them as Firebase secrets (never hardcode, never put in client code):
//        firebase functions:secrets:set RAZORPAY_KEY_ID
//        firebase functions:secrets:set RAZORPAY_KEY_SECRET
//   4. Deploy: firebase deploy --only functions
//   5. Requires the Blaze (pay-as-you-go) plan — Spark plan blocks the
//      outbound network call to Razorpay's API.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");
const Razorpay = require("razorpay");
const crypto = require("crypto");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const RAZORPAY_KEY_ID = defineSecret("RAZORPAY_KEY_ID");
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");

/**
 * Creates a Razorpay order and a matching "pending" record in Firestore.
 * Call this right before opening the Razorpay checkout widget.
 *
 * data: { courseId: string, courseName: string, amount: number }  // amount in ₹
 * returns: { orderId, amount, currency, keyId }
 */
exports.createRazorpayOrder = onCall(
  { secrets: [RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in to make a payment.");
    }

    const { courseId, courseName, amount } = request.data || {};
    if (!courseId || !courseName || !amount || amount <= 0) {
      throw new HttpsError("invalid-argument", "courseId, courseName, and a positive amount are required.");
    }

    const razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID.value(),
      key_secret: RAZORPAY_KEY_SECRET.value(),
    });

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Razorpay wants paise
      currency: "INR",
      receipt: `rcpt_${request.auth.uid.slice(0, 8)}_${Date.now()}`,
      notes: { uid: request.auth.uid, courseId, courseName },
    });

    // Source of truth even if the browser tab closes before verification runs.
    await db.collection("payments").doc(order.id).set({
      uid: request.auth.uid,
      courseId,
      courseName,
      amount,
      currency: "INR",
      razorpayOrderId: order.id,
      status: "created",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID.value(),
    };
  }
);

/**
 * Verifies the signature Razorpay returns after checkout succeeds. This is
 * the ONLY step that actually grants course access — everything before this
 * is just UI. A forged/missing/mismatched signature is rejected outright.
 *
 * data: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * returns: { success: true }
 */
exports.verifyRazorpayPayment = onCall(
  { secrets: [RAZORPAY_KEY_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "You must be logged in.");
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = request.data || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new HttpsError("invalid-argument", "Missing Razorpay verification fields.");
    }

    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET.value())
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await db.collection("payments").doc(razorpay_order_id).update({ status: "failed_verification" }).catch(() => {});
      throw new HttpsError("permission-denied", "Payment signature verification failed.");
    }

    const paymentRef = db.collection("payments").doc(razorpay_order_id);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) {
      throw new HttpsError("not-found", "No matching order found.");
    }

    const payment = paymentSnap.data();
    if (payment.uid !== request.auth.uid) {
      throw new HttpsError("permission-denied", "This order does not belong to you.");
    }
    if (payment.status === "paid") {
      return { success: true }; // already processed, don't double-grant
    }

    await paymentRef.update({
      status: "paid",
      razorpayPaymentId: razorpay_payment_id,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Grant access: create/refresh the enrollment so the course unlocks.
    const enrollmentRef = db.collection("enrollments").doc(`${request.auth.uid}_${payment.courseId}`);
    await enrollmentRef.set(
      {
        uid: request.auth.uid,
        courseId: payment.courseId,
        courseName: payment.courseName,
        progress: 0,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { success: true };
  }
);