import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { auth, db } from "../firebase/Firebase";
import {
  CreditCard,
  CheckCircle2,
  IndianRupee,
  Loader2,
  ShieldCheck,
  Receipt,
  X,
  Printer,
} from "lucide-react";
import { Skeleton } from "../components/Skeleton";

const ACCENT = "#5227FF";
const VIOLET = "#2E1A55";
const cardShadow = "shadow-lg shadow-violet-900/[0.06]";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay: i * 0.06,
      ease: "easeOut",
    },
  }),
};

let razorpayScriptPromise = null;

function loadRazorpayScript() {
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";

    script.onload = () => resolve(true);
    script.onerror = () =>
      reject(new Error("Failed to load Razorpay checkout script."));

    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

function formatDate(d) {
  if (!d) return "—";

  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(d) {
  if (!d) return "—";

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* =========================================================
   RECEIPT MODAL
========================================================= */

function ReceiptModal({ payment, onClose }) {
  if (!payment) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="
          fixed inset-0 z-50
          flex items-center justify-center
          bg-black/40
          p-3
          backdrop-blur-sm
          sm:p-4
          print:bg-white
          print:p-0
        "
      >
        <motion.div
          initial={{
            opacity: 0,
            y: 16,
            scale: 0.97,
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          exit={{
            opacity: 0,
            y: 16,
            scale: 0.97,
          }}
          transition={{
            duration: 0.2,
            ease: "easeOut",
          }}
          onClick={(e) => e.stopPropagation()}
          className="
            flex
            max-h-[calc(100dvh-1.5rem)]
            w-full
            max-w-sm
            flex-col
            overflow-hidden
            rounded-2xl
            bg-white
            shadow-2xl
            sm:max-h-[92vh]
            sm:rounded-3xl
            print:max-w-full
            print:rounded-none
            print:shadow-none
          "
        >
          {/* Modal header */}
          <div
            className="
              relative
              flex
              shrink-0
              items-center
              justify-between
              px-4
              py-4
              sm:px-6
              sm:py-5
              print:hidden
            "
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})`,
            }}
          >
            <div className="flex min-w-0 items-center gap-2 text-white">
              <Receipt className="h-4 w-4 shrink-0" />

              <span className="truncate text-sm font-bold">
                Payment Receipt
              </span>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close receipt"
              className="
                flex
                h-8
                w-8
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-white/15
                text-white
                transition-colors
                hover:bg-white/25
              "
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Modal body */}
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
            <div className="mb-4 flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5 shrink-0" />

              <span className="text-sm font-bold">
                Payment successful
              </span>
            </div>

            <div className="space-y-3 rounded-2xl bg-[#F7F5FC] p-3.5 sm:p-4">
              <Row
                label="Course"
                value={payment.courseName}
                bold
              />

              <Row
                label="Amount paid"
                value={`₹${payment.amount?.toLocaleString("en-IN") ?? "—"
                  }`}
                bold
              />

              <Row
                label="Date & time"
                value={formatDateTime(payment.paidAt)}
              />

              {payment.razorpayPaymentId && (
                <Row
                  label="Payment ID"
                  value={payment.razorpayPaymentId}
                  mono
                />
              )}

              {payment.razorpayOrderId && (
                <Row
                  label="Order ID"
                  value={payment.razorpayOrderId}
                  mono
                />
              )}

              <Row
                label="Receipt ID"
                value={payment.id}
                mono
              />
            </div>

            <p className="
              mt-4
              flex
              items-start
              justify-center
              gap-1.5
              text-center
              text-[10px]
              leading-4
              text-[#B4ABCB]
            ">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />

              <span>
                Verified server-side by Creative Adhyayan.
              </span>
            </p>

            {/* Receipt actions */}
            <div className="
              mt-5
              flex
              flex-col
              gap-2
              print:hidden
              min-[400px]:flex-row
            ">
              <button
                type="button"
                onClick={() => window.print()}
                className="
                  flex
                  min-h-[42px]
                  w-full
                  items-center
                  justify-center
                  gap-1.5
                  rounded-full
                  py-2.5
                  text-xs
                  font-bold
                  text-white
                  transition-transform
                  active:scale-[0.98]
                "
                style={{
                  background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})`,
                }}
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </button>

              <button
                type="button"
                onClick={onClose}
                className="
                  flex
                  min-h-[42px]
                  w-full
                  items-center
                  justify-center
                  rounded-full
                  bg-[#F0ECFA]
                  py-2.5
                  text-xs
                  font-bold
                  text-[#1B0E3D]
                  transition-transform
                  active:scale-[0.98]
                "
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* =========================================================
   RECEIPT ROW
========================================================= */

function Row({
  label,
  value,
  bold = false,
  mono = false,
}) {
  return (
    <div className="
      flex
      min-w-0
      flex-col
      gap-1.5
      text-xs
      min-[400px]:flex-row
      min-[400px]:items-start
      min-[400px]:justify-between
      min-[400px]:gap-3
    ">
      <span className="shrink-0 text-[#8A82A6]">
        {label}
      </span>

      <span
        className={`
          min-w-0
          text-left
          text-[#1B0E3D]
          min-[400px]:text-right
          ${bold ? "font-bold" : "font-medium"}
          ${mono
            ? "break-all font-mono text-[10px] leading-4"
            : "break-words"
          }
        `}
      >
        {value || "—"}
      </span>
    </div>
  );
}

/* =========================================================
   PAYMENTS PAGE
========================================================= */

export default function Payments() {
  const [uid, setUid] = useState(null);

  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const [enrolledIds, setEnrolledIds] = useState(new Set());

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [payingId, setPayingId] = useState(null);
  const [error, setError] = useState("");

  const [receiptFor, setReceiptFor] = useState(null);

  /* =====================================================
     AUTH
  ===================================================== */

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);

      setUserProfile({
        name: user?.displayName || "",
        email: user?.email || "",
        phone: user?.phoneNumber || "",
      });
    });

    return unsub;
  }, []);

  /* =====================================================
     COURSES
  ===================================================== */

  useEffect(() => {
    setCoursesLoading(true);

    const unsub = onSnapshot(
      collection(db, "courses"),
      (snap) => {
        setCourses(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data(),
          }))
        );

        setCoursesLoading(false);
      },
      () => setCoursesLoading(false)
    );

    return unsub;
  }, []);

  /* =====================================================
     ENROLLMENTS
  ===================================================== */

  useEffect(() => {
    if (!uid) return;

    const q = query(
      collection(db, "enrollments"),
      where("uid", "==", uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setEnrolledIds(
        new Set(
          snap.docs.map(
            (d) => d.data().courseId
          )
        )
      );
    });

    return unsub;
  }, [uid]);

  /* =====================================================
     PAYMENT HISTORY
  ===================================================== */

  useEffect(() => {
    if (!uid) return;

    setHistoryLoading(true);

    const q = query(
      collection(db, "payments"),
      where("uid", "==", uid),
      where("status", "==", "paid")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) => {
          const data = d.data();

          const paidAt = data.paidAt?.toDate
            ? data.paidAt.toDate()
            : null;

          return {
            id: d.id,
            courseName: data.courseName,
            amount: data.amount,
            paidAt,
            razorpayPaymentId:
              data.razorpayPaymentId ||
              data.razorpay_payment_id ||
              null,
            razorpayOrderId:
              data.razorpayOrderId ||
              data.razorpay_order_id ||
              null,
          };
        });

        rows.sort(
          (a, b) =>
            (b.paidAt || 0) -
            (a.paidAt || 0)
        );

        setHistory(rows);
        setHistoryLoading(false);
      },
      () => setHistoryLoading(false)
    );

    return unsub;
  }, [uid]);

  /* =====================================================
     BUY COURSE
  ===================================================== */

  const handleBuy = async (course) => {
    setError("");

    if (!uid) {
      setError(
        "Please log in to purchase a course."
      );
      return;
    }

    setPayingId(course.id);

    try {
      await loadRazorpayScript();

      const functions = getFunctions();

      const createOrder = httpsCallable(
        functions,
        "createRazorpayOrder"
      );

      const verifyPayment = httpsCallable(
        functions,
        "verifyRazorpayPayment"
      );

      const { data: order } =
        await createOrder({
          courseId: course.id,
          courseName: course.name,
          amount: course.price,
        });

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,

        name: "Creative Adhyayan",
        description: course.name,

        prefill: {
          name: userProfile.name,
          email: userProfile.email,
          contact: userProfile.phone,
        },

        theme: {
          color: ACCENT,
        },

        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_order_id:
                response.razorpay_order_id,

              razorpay_payment_id:
                response.razorpay_payment_id,

              razorpay_signature:
                response.razorpay_signature,
            });
          } catch (err) {
            console.error(err);

            setError(
              "Payment verification failed. If money was deducted, it will be refunded — contact support."
            );
          } finally {
            setPayingId(null);
          }
        },

        modal: {
          ondismiss: () =>
            setPayingId(null),
        },
      });

      rzp.on("payment.failed", (resp) => {
        console.error(resp.error);

        setError(
          `Payment failed: ${resp.error.description ||
          "please try again."
          }`
        );

        setPayingId(null);
      });

      rzp.open();
    } catch (err) {
      console.error(err);

      setError(
        "Couldn't start checkout. Please try again in a moment."
      );

      setPayingId(null);
    }
  };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl overflow-x-hidden px-0">
      {/* Page heading */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={0}
        className="mb-5 sm:mb-6"
      >
        <h2 className="
          text-xl
          font-black
          tracking-tight
          text-[#1B0E3D]
          sm:text-2xl
        ">
          Payments
        </h2>

        <p className="
          mt-1
          max-w-2xl
          text-xs
          leading-5
          text-[#6b5f87]
          sm:text-sm
        ">
          Secure checkout powered by Razorpay —
          UPI, cards, netbanking, wallets.
        </p>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="
            mb-4
            rounded-2xl
            bg-red-50
            px-3.5
            py-3
            text-xs
            font-semibold
            leading-5
            text-red-600
            sm:px-4
          "
        >
          {error}
        </motion.div>
      )}

      {/* =================================================
          AVAILABLE COURSES
      ================================================= */}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={2}
      >
        <h3 className="
          mb-3
          text-sm
          font-bold
          text-[#1B0E3D]
        ">
          Available courses
        </h3>

        {coursesLoading ? (
          <div className="
            grid
            grid-cols-1
            gap-3
            sm:grid-cols-2
            sm:gap-4
          ">
            {Array.from({ length: 2 }).map(
              (_, i) => (
                <div
                  key={i}
                  className={`
                    space-y-3
                    rounded-2xl
                    bg-white
                    p-4
                    sm:rounded-3xl
                    sm:p-5
                    ${cardShadow}
                  `}
                >
                  <Skeleton className="h-4 w-2/3" />

                  <Skeleton className="h-3 w-full" />

                  <Skeleton className="h-5 w-1/3" />

                  <Skeleton className="mt-2 h-10 w-full rounded-full" />
                </div>
              )
            )}
          </div>
        ) : courses.length === 0 ? (
          <div
            className={`
              rounded-2xl
              bg-white
              p-8
              text-center
              sm:rounded-3xl
              sm:p-10
              ${cardShadow}
            `}
          >
            <p className="text-xs text-[#A79BC4]">
              No courses available yet.
            </p>
          </div>
        ) : (
          <div className="
            grid
            grid-cols-1
            gap-3
            sm:grid-cols-2
            sm:gap-4
          ">
            {courses.map((course, i) => {
              const owned = enrolledIds.has(
                course.id
              );

              const paying =
                payingId === course.id;

              return (
                <motion.div
                  key={course.id}
                  variants={fadeUp}
                  initial="hidden"
                  animate="show"
                  custom={3 + i}
                  className={`
                    flex
                    min-w-0
                    flex-col
                    justify-between
                    rounded-2xl
                    bg-white
                    p-4
                    sm:rounded-3xl
                    sm:p-5
                    ${cardShadow}
                  `}
                >
                  <div className="min-w-0">
                    <p className="
                      break-words
                      text-sm
                      font-bold
                      leading-5
                      text-[#1B0E3D]
                    ">
                      {course.name}
                    </p>

                    {course.description && (
                      <p className="
                        mt-1
                        line-clamp-3
                        break-words
                        text-[11px]
                        leading-4
                        text-[#8A82A6]
                      ">
                        {course.description}
                      </p>
                    )}

                    <p
                      className="
                        mt-3
                        flex
                        items-center
                        gap-0.5
                        text-lg
                        font-black
                      "
                      style={{ color: ACCENT }}
                    >
                      <IndianRupee className="h-4 w-4 shrink-0" />

                      <span>
                        {course.price?.toLocaleString(
                          "en-IN"
                        )}
                      </span>
                    </p>
                  </div>

                  {owned ? (
                    <div className="
                      mt-4
                      flex
                      min-h-[40px]
                      items-center
                      justify-center
                      gap-1.5
                      rounded-full
                      bg-emerald-50
                      py-2
                      text-xs
                      font-bold
                      text-emerald-600
                    ">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />

                      Enrolled
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={paying}
                      onClick={() =>
                        handleBuy(course)
                      }
                      className="
                        mt-4
                        flex
                        min-h-[40px]
                        w-full
                        items-center
                        justify-center
                        gap-1.5
                        rounded-full
                        py-2.5
                        text-xs
                        font-bold
                        text-white
                        transition-transform
                        active:scale-[0.98]
                        disabled:opacity-60
                      "
                      style={{
                        background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})`,
                      }}
                    >
                      {paying ? (
                        <>
                          <Loader2 className="
                            h-3.5
                            w-3.5
                            animate-spin
                          " />

                          Processing…
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3.5 w-3.5" />

                          Buy now
                        </>
                      )}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* =================================================
          PURCHASED COURSES
      ================================================= */}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={8}
        className="mt-7 sm:mt-8"
      >
        <h3 className="
          mb-3
          text-sm
          font-bold
          text-[#1B0E3D]
        ">
          Purchased courses
        </h3>

        {historyLoading ? (
          <div
            className={`
              overflow-hidden
              rounded-2xl
              bg-white
              sm:rounded-3xl
              ${cardShadow}
            `}
          >
            {Array.from({ length: 3 }).map(
              (_, i) => (
                <div
                  key={i}
                  className="
                    flex
                    flex-col
                    gap-3
                    border-b
                    border-[#F0ECFA]
                    px-4
                    py-3
                    last:border-0
                    min-[420px]:flex-row
                    min-[420px]:items-center
                    min-[420px]:justify-between
                    sm:px-5
                  "
                >
                  <div className="
                    min-w-0
                    flex-1
                    space-y-1.5
                  ">
                    <Skeleton className="h-3 w-2/3" />

                    <Skeleton className="h-2 w-1/3" />
                  </div>

                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
              )
            )}
          </div>
        ) : history.length === 0 ? (
          <div
            className={`
              rounded-2xl
              bg-white
              p-6
              text-center
              sm:rounded-3xl
              ${cardShadow}
            `}
          >
            <p className="text-xs text-[#A79BC4]">
              No courses purchased yet.
            </p>
          </div>
        ) : (
          <div
            className={`
              overflow-hidden
              rounded-2xl
              bg-white
              sm:rounded-3xl
              ${cardShadow}
            `}
          >
            {history.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  setReceiptFor(p)
                }
                className={`
                  flex
                  w-full
                  min-w-0
                  flex-col
                  gap-3
                  px-4
                  py-3.5
                  text-left
                  transition-colors
                  hover:bg-[#F7F5FC]
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                  sm:gap-3
                  sm:px-5
                  sm:py-3
                  ${i !== history.length - 1
                    ? "border-b border-[#F0ECFA]"
                    : ""
                  }
                `}
              >
                {/* Course */}
                <div className="min-w-0 flex-1">
                  <p className="
                    break-words
                    text-xs
                    font-bold
                    leading-4
                    text-[#1B0E3D]
                  ">
                    {p.courseName}
                  </p>

                  <p className="
                    mt-1
                    text-[10px]
                    text-[#8A82A6]
                  ">
                    {formatDate(p.paidAt)}
                  </p>
                </div>

                {/* Amount + receipt */}
                <div className="
                  flex
                  w-full
                  min-w-0
                  items-center
                  justify-between
                  gap-2
                  sm:w-auto
                  sm:shrink-0
                  sm:justify-end
                  sm:gap-3
                ">
                  <span className="
                    flex
                    items-center
                    gap-1
                    text-xs
                    font-bold
                    text-[#1B0E3D]
                  ">
                    <IndianRupee className="h-3 w-3 shrink-0" />

                    {p.amount?.toLocaleString(
                      "en-IN"
                    )}
                  </span>

                  <span
                    className="
                      flex
                      min-h-[32px]
                      items-center
                      justify-center
                      gap-1
                      rounded-full
                      px-3
                      py-1
                      text-[10px]
                      font-bold
                      text-white
                    "
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, ${VIOLET})`,
                    }}
                  >
                    <Receipt className="h-3 w-3" />

                    Receipt
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Security note */}
      <p className="
        mt-5
        flex
        items-start
        justify-center
        gap-1.5
        px-3
        text-center
        text-[10px]
        leading-4
        text-[#B4ABCB]
        sm:mt-6
      ">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />

        <span>
          Payments are verified server-side and
          never trusted from the browser.
        </span>
      </p>

      {/* Receipt */}
      <ReceiptModal
        payment={receiptFor}
        onClose={() => setReceiptFor(null)}
      />
    </div>
  );
}