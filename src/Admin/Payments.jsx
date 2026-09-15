import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
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
  AlertCircle,
} from "lucide-react";

import { Skeleton } from "../components/Skeleton";

/* =========================================================
   DESIGN
========================================================= */

const ACCENT = "#16A34A";
const VIOLET = "#166534";

const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

const cardShadow = "shadow-lg shadow-green-900/[0.06]";

const fadeUp = {
  hidden: {
    opacity: 0,
    y: 14,
  },

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

/* =========================================================
   RAZORPAY SCRIPT
========================================================= */

let razorpayScriptPromise = null;

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("Razorpay can only be loaded in the browser.")
    );
  }

  if (window.Razorpay) {
    return Promise.resolve(true);
  }

  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));

      existingScript.addEventListener("error", () =>
        reject(
          new Error("Failed to load Razorpay checkout script.")
        )
      );

      return;
    }

    const script = document.createElement("script");

    script.src =
      "https://checkout.razorpay.com/v1/checkout.js";

    script.async = true;

    script.onload = () => {
      razorpayScriptPromise = null;
      resolve(true);
    };

    script.onerror = () => {
      razorpayScriptPromise = null;

      reject(
        new Error("Failed to load Razorpay checkout script.")
      );
    };

    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

/* =========================================================
   HELPERS
========================================================= */

function toDate(value) {
  if (!value) return null;

  if (typeof value.toDate === "function") {
    return value.toDate();
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  if (!date) return "—";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(date) {
  if (!date) return "—";

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCourseName(course) {
  return course?.name || course?.title || "Course";
}

function getCoursePrice(course) {
  const discountPrice = Number(course?.discountPrice);
  const regularPrice = Number(course?.price);

  if (
    Number.isFinite(discountPrice) &&
    discountPrice > 0 &&
    Number.isFinite(regularPrice) &&
    discountPrice < regularPrice
  ) {
    return discountPrice;
  }

  return Number.isFinite(regularPrice)
    ? regularPrice
    : 0;
}

function getPaymentAmount(payment) {
  const amount = Number(payment?.amount);

  return Number.isFinite(amount) ? amount : 0;
}

function isSuccessfulPayment(payment) {
  return (
    !payment?.status ||
    payment.status === "paid" ||
    payment.status === "success"
  );
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
            max-w-md
            flex-col
            overflow-hidden
            rounded-3xl
            bg-white
            shadow-2xl
          "
        >
          {/* Header */}

          <div
            className="
              flex
              items-center
              justify-between
              gap-3
              px-4
              py-3.5
              sm:px-5
            "
            style={{
              background: `linear-gradient(
                135deg,
                ${ACCENT},
                ${VIOLET}
              )`,
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

          {/* Body */}

          <div
            className="
              min-h-0
              overflow-y-auto
              overscroll-contain
              px-4
              py-4
              sm:px-6
              sm:py-5
            "
          >
            <div className="mb-4 flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-5 w-5 shrink-0" />

              <span className="text-sm font-bold">
                Payment successful
              </span>
            </div>

            <div className="space-y-3 rounded-2xl bg-[#F3FDF6] p-3.5 sm:p-4">
              <Row
                label="Course"
                value={payment.courseName}
                bold
              />

              <Row
                label="Amount paid"
                value={`₹${getPaymentAmount(
                  payment
                ).toLocaleString("en-IN")}`}
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

              <Row
                label="Receipt ID"
                value={payment.id}
                mono
              />
            </div>

            <p
              className="
                mt-4
                flex
                items-start
                justify-center
                gap-1.5
                text-center
                text-[10px]
                leading-4
                text-[#A1AEA5]
              "
            >
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />

              <span>
                Payment processed by Razorpay and recorded automatically.
              </span>
            </p>

            <div
              className="
                mt-5
                flex
                flex-col
                gap-2
                print:hidden
                min-[400px]:flex-row
              "
            >
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
                  background: `linear-gradient(
                    135deg,
                    ${ACCENT},
                    ${VIOLET}
                  )`,
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
                  bg-[#ECFDF3]
                  py-2.5
                  text-xs
                  font-bold
                  text-[#16351F]
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
    <div
      className="
        flex
        min-w-0
        flex-col
        gap-1.5
        text-xs
        min-[400px]:flex-row
        min-[400px]:items-start
        min-[400px]:justify-between
        min-[400px]:gap-3
      "
    >
      <span className="shrink-0 text-[#708074]">
        {label}
      </span>

      <span
        className={`
          min-w-0
          text-left
          text-[#16351F]
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
   PAYMENT PAGE
========================================================= */

export default function Payments() {
  const [uid, setUid] = useState(null);

  const [userProfile, setUserProfile] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] =
    useState(true);

  const [enrolledIds, setEnrolledIds] = useState(
    new Set()
  );

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] =
    useState(true);

  const [payingId, setPayingId] = useState(null);

  const [error, setError] = useState("");

  const [receiptFor, setReceiptFor] =
    useState(null);

  /* =====================================================
     AUTH
  ===================================================== */

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (user) => {
        setUid(user?.uid ?? null);

        setUserProfile({
          name: user?.displayName || "",
          email: user?.email || "",
          phone: user?.phoneNumber || "",
        });
      }
    );

    return unsub;
  }, []);

  /* =====================================================
     PUBLISHED COURSES
  ===================================================== */

  useEffect(() => {
    setCoursesLoading(true);

    const coursesQuery = query(
      collection(db, "courses"),
      where("status", "==", "published")
    );

    const unsub = onSnapshot(
      coursesQuery,
      (snap) => {
        const rows = snap.docs
          .map((d) => ({
            id: d.id,
            ...d.data(),
          }))
          .filter((course) => {
            return getCoursePrice(course) > 0;
          });

        rows.sort((a, b) => {
          const orderA = Number.isFinite(
            Number(a.order)
          )
            ? Number(a.order)
            : 999999;

          const orderB = Number.isFinite(
            Number(b.order)
          )
            ? Number(b.order)
            : 999999;

          return orderA - orderB;
        });

        setCourses(rows);
        setCoursesLoading(false);
      },
      (err) => {
        console.error(
          "Published courses error:",
          err
        );

        setCoursesLoading(false);

        setError(
          "Unable to load available courses."
        );
      }
    );

    return unsub;
  }, []);

  /* =====================================================
     ENROLLMENTS
  ===================================================== */

  useEffect(() => {
    if (!uid) {
      setEnrolledIds(new Set());
      return;
    }

    const enrollmentQuery = query(
      collection(db, "enrollments"),
      where("uid", "==", uid)
    );

    const unsub = onSnapshot(
      enrollmentQuery,
      (snap) => {
        const ids = new Set();

        snap.docs.forEach((d) => {
          const data = d.data();

          if (
            data.courseId &&
            (!data.status ||
              data.status === "active")
          ) {
            ids.add(data.courseId);
          }
        });

        setEnrolledIds(ids);
      },
      (err) => {
        console.error(
          "Enrollment listener error:",
          err
        );
      }
    );

    return unsub;
  }, [uid]);

  /* =====================================================
     PAYMENT HISTORY
  ===================================================== */

  useEffect(() => {
    if (!uid) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    setHistoryLoading(true);

    const paymentQuery = query(
      collection(db, "payments"),
      where("uid", "==", uid)
    );

    const unsub = onSnapshot(
      paymentQuery,
      (snap) => {
        const rows = snap.docs
          .map((d) => {
            const data = d.data();

            return {
              id: d.id,

              courseId:
                data.courseId || null,

              courseName:
                data.courseName ||
                data.courseTitle ||
                "Course",

              amount:
                Number(data.amount) || 0,

              status:
                data.status || "paid",

              paidAt:
                toDate(data.paidAt) ||
                toDate(data.createdAt),

              razorpayPaymentId:
                data.razorpayPaymentId ||
                data.razorpay_payment_id ||
                null,
            };
          })
          .filter(isSuccessfulPayment);

        rows.sort((a, b) => {
          const timeA =
            a.paidAt?.getTime() || 0;

          const timeB =
            b.paidAt?.getTime() || 0;

          return timeB - timeA;
        });

        setHistory(rows);
        setHistoryLoading(false);
      },
      (err) => {
        console.error(
          "Payment history error:",
          err
        );

        setHistoryLoading(false);

        setError(
          "Unable to load payment history."
        );
      }
    );

    return unsub;
  }, [uid]);

  /* =====================================================
     AVAILABLE COURSES
  ===================================================== */

  const availableCourses = useMemo(() => {
    return courses.filter(
      (course) => !enrolledIds.has(course.id)
    );
  }, [courses, enrolledIds]);

  /* =====================================================
     BUY COURSE
     (Fully client-side: Firestore client SDK only,
     no server, no Blaze. Razorpay Checkout opens
     directly against `amount` — there is no order
     creation step and no signature verification,
     since both require RAZORPAY_KEY_SECRET which must
     never be shipped to the browser.)
  ===================================================== */

  const handleBuy = async (course) => {
    setError("");

    if (!uid) {
      setError(
        "Please log in to purchase a course."
      );
      return;
    }

    if (!course?.id) {
      setError(
        "Invalid course. Please refresh the page."
      );
      return;
    }

    if (enrolledIds.has(course.id)) {
      setError(
        "You are already enrolled in this course."
      );
      return;
    }

    const clientPrice = getCoursePrice(course);

    if (!clientPrice || clientPrice <= 0) {
      setError(
        "This course is currently unavailable for purchase."
      );
      return;
    }

    if (!RAZORPAY_KEY_ID) {
      setError(
        "Payments are not configured. Missing Razorpay key."
      );
      return;
    }

    setPayingId(course.id);

    try {
      /* -----------------------------------------------
         Load Razorpay
      ------------------------------------------------ */

      await loadRazorpayScript();

      if (!window.Razorpay) {
        throw new Error(
          "Razorpay checkout is unavailable."
        );
      }

      /* -----------------------------------------------
         RAZORPAY CHECKOUT (no server order needed)
      ------------------------------------------------ */

      const razorpayOptions = {
        key: RAZORPAY_KEY_ID,

        amount: Math.round(clientPrice * 100),

        currency: "INR",

        name: "Creative Adhyayan",

        description: getCourseName(course),

        prefill: {
          name: userProfile.name,
          email: userProfile.email,
          contact: userProfile.phone,
        },

        notes: {
          courseId: course.id,
          uid,
        },

        theme: {
          color: ACCENT,
        },

        handler: async (razorpayResponse) => {
          try {
            setError("");

            const paymentId =
              razorpayResponse.razorpay_payment_id;

            /* -------------------------------------
               DUPLICATE CHECK
            ------------------------------------- */

            const existingPaymentSnap = await getDoc(
              doc(db, "payments", paymentId)
            );

            if (existingPaymentSnap.exists()) {
              setReceiptFor({
                id: paymentId,
                ...existingPaymentSnap.data(),
                paidAt:
                  toDate(existingPaymentSnap.data().paidAt) ||
                  new Date(),
              });
              setPayingId(null);
              return;
            }

            /* -------------------------------------
               WRITE PAYMENT
            ------------------------------------- */

            const paymentData = {
              uid,
              courseId: course.id,
              courseName: getCourseName(course),
              amount: clientPrice,
              currency: "INR",
              status: "paid",
              razorpayPaymentId: paymentId,
              paidAt: serverTimestamp(),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };

            await setDoc(
              doc(db, "payments", paymentId),
              paymentData
            );

            /* -------------------------------------
               CREATE / UPDATE ENROLLMENT
            ------------------------------------- */

            const enrollmentQuery = query(
              collection(db, "enrollments"),
              where("uid", "==", uid),
              where("courseId", "==", course.id)
            );

            const enrollmentSnap = await getDocs(
              enrollmentQuery
            );

            let enrollmentId;

            if (!enrollmentSnap.empty) {
              const enrollmentDoc =
                enrollmentSnap.docs[0];

              enrollmentId = enrollmentDoc.id;

              await updateDoc(enrollmentDoc.ref, {
                status: "active",
                courseName: getCourseName(course),
                lastPaymentId: paymentId,
                lastPaymentAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            } else {
              const newEnrollmentRef = doc(
                collection(db, "enrollments")
              );

              enrollmentId = newEnrollmentRef.id;

              await setDoc(newEnrollmentRef, {
                uid,
                courseId: course.id,
                courseName: getCourseName(course),
                status: "active",
                paymentId,
                paymentAmount: clientPrice,
                enrolledAt: serverTimestamp(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });
            }

            /* -------------------------------------
               RECEIPT
            ------------------------------------- */

            setReceiptFor({
              id: paymentId,
              courseId: course.id,
              courseName: getCourseName(course),
              amount: clientPrice,
              paidAt: new Date(),
              razorpayPaymentId: paymentId,
              status: "paid",
            });
          } catch (err) {
            console.error(
              "Post-payment write error:",
              err
            );

            setError(
              "Payment succeeded but we couldn't record it (Payment ID: " +
              razorpayResponse.razorpay_payment_id +
              "). Please contact support."
            );
          } finally {
            setPayingId(null);
          }
        },

        modal: {
          ondismiss: () => {
            setPayingId(null);
          },
        },
      };

      const razorpay = new window.Razorpay(
        razorpayOptions
      );

      razorpay.on(
        "payment.failed",
        (response) => {
          console.error(
            "Razorpay payment failed:",
            response?.error
          );

          const description =
            response?.error?.description;

          setError(
            description
              ? `Payment failed: ${description}`
              : "Payment failed. Please try again."
          );

          setPayingId(null);
        }
      );

      razorpay.open();
    } catch (err) {
      console.error(
        "Checkout initialization error:",
        err
      );

      setError(
        err?.message ||
        "Couldn't start checkout. Please try again."
      );

      setPayingId(null);
    }
  };

  /* =====================================================
     UI
  ===================================================== */

  return (
    <div
      className="
        mx-auto
        w-full
        min-w-0
        max-w-5xl
        overflow-x-hidden
        px-0
      "
    >
      {/* HEADER */}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={0}
        className="mb-5 sm:mb-6"
      >
        <h2
          className="
            text-xl
            font-black
            tracking-tight
            text-[#16351F]
            sm:text-2xl
          "
        >
          Payments
        </h2>

        <p
          className="
            mt-1
            max-w-2xl
            text-xs
            leading-5
            text-[#64756A]
            sm:text-sm
          "
        >
          Secure checkout powered by Razorpay —
          UPI, cards, netbanking and wallets.
        </p>
      </motion.div>

      {/* ERROR */}

      {error && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="
            mb-4
            flex
            items-start
            gap-2.5
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
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

          <span className="min-w-0 flex-1 break-words">
            {error}
          </span>

          <button
            type="button"
            onClick={() => setError("")}
            className="
              shrink-0
              rounded-md
              p-1
              transition-colors
              hover:bg-red-100
            "
            aria-label="Close error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}

      {/* AVAILABLE COURSES */}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={2}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            className="
              text-sm
              font-bold
              text-[#16351F]
            "
          >
            Available courses
          </h3>

          {availableCourses.length > 0 && (
            <span
              className="
                rounded-full
                bg-[#ECFDF3]
                px-2.5
                py-1
                text-[10px]
                font-bold
                text-[#477254]
              "
            >
              {availableCourses.length} available
            </span>
          )}
        </div>

        {coursesLoading ? (
          <div
            className="
              grid
              grid-cols-1
              gap-3
              sm:grid-cols-2
              sm:gap-4
            "
          >
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
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="mt-2 h-10 w-full rounded-full" />
                </div>
              )
            )}
          </div>
        ) : courses.length === 0 ? (
          <EmptyPaymentState
            text="No paid courses are currently available."
          />
        ) : availableCourses.length === 0 ? (
          <EmptyPaymentState
            success
            text="You are already enrolled in all available courses."
          />
        ) : (
          <div
            className="
              grid
              grid-cols-1
              gap-3
              sm:grid-cols-2
              sm:gap-4
            "
          >
            {availableCourses.map(
              (course, i) => {
                const paying =
                  payingId === course.id;

                const price =
                  getCoursePrice(course);

                const regularPrice =
                  Number(course.price) || 0;

                const hasDiscount =
                  regularPrice > price &&
                  price > 0;

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
                      {course.type && (
                        <span
                          className="
                            inline-flex
                            rounded-full
                            bg-[#ECFDF3]
                            px-2.5
                            py-1
                            text-[9px]
                            font-bold
                            uppercase
                            tracking-wide
                            text-[#477254]
                          "
                        >
                          {course.type}
                        </span>
                      )}

                      <p
                        className="
                          mt-2
                          break-words
                          text-sm
                          font-bold
                          leading-5
                          text-[#16351F]
                        "
                      >
                        {getCourseName(course)}
                      </p>

                      {course.description && (
                        <p
                          className="
                            mt-1
                            line-clamp-3
                            break-words
                            text-[11px]
                            leading-4
                            text-[#708074]
                          "
                        >
                          {course.description}
                        </p>
                      )}

                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <p
                          className="
                            flex
                            items-center
                            gap-0.5
                            text-lg
                            font-black
                          "
                          style={{
                            color: ACCENT,
                          }}
                        >
                          <IndianRupee className="h-4 w-4 shrink-0" />

                          {price.toLocaleString(
                            "en-IN"
                          )}
                        </p>

                        {hasDiscount && (
                          <p
                            className="
                              mb-0.5
                              text-[11px]
                              font-medium
                              text-[#A1AEA5]
                              line-through
                            "
                          >
                            ₹
                            {regularPrice.toLocaleString(
                              "en-IN"
                            )}
                          </p>
                        )}

                        {hasDiscount && (
                          <span
                            className="
                              mb-0.5
                              rounded-full
                              bg-emerald-50
                              px-2
                              py-0.5
                              text-[9px]
                              font-bold
                              text-emerald-600
                            "
                          >
                            OFF
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={
                        paying ||
                        !uid ||
                        enrolledIds.has(course.id)
                      }
                      onClick={() =>
                        handleBuy(course)
                      }
                      className="
                        mt-4
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
                        disabled:cursor-not-allowed
                        disabled:opacity-60
                      "
                      style={{
                        background:
                          `linear-gradient(
                            135deg,
                            ${ACCENT},
                            ${VIOLET}
                          )`,
                      }}
                    >
                      {paying ? (
                        <>
                          <Loader2
                            className="
                              h-3.5
                              w-3.5
                              animate-spin
                            "
                          />

                          Processing…
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3.5 w-3.5" />

                          Buy now
                        </>
                      )}
                    </button>
                  </motion.div>
                );
              }
            )}
          </div>
        )}
      </motion.div>

      {/* PURCHASE HISTORY */}

      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="show"
        custom={8}
        className="mt-7 sm:mt-8"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3
            className="
              text-sm
              font-bold
              text-[#16351F]
            "
          >
            Purchase history
          </h3>

          {history.length > 0 && (
            <span
              className="
                text-[10px]
                font-medium
                text-[#94A39A]
              "
            >
              {history.length} payment
              {history.length === 1
                ? ""
                : "s"}
            </span>
          )}
        </div>

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
                    border-[#ECFDF3]
                    px-4
                    py-3
                    last:border-0
                    min-[420px]:flex-row
                    min-[420px]:items-center
                    min-[420px]:justify-between
                    sm:px-5
                  "
                >
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2 w-1/3" />
                  </div>

                  <Skeleton className="h-8 w-20 rounded-full" />
                </div>
              )
            )}
          </div>
        ) : history.length === 0 ? (
          <EmptyPaymentState
            text="No successful payments yet."
          />
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
            {history.map((payment, i) => (
              <button
                key={payment.id}
                type="button"
                onClick={() =>
                  setReceiptFor(payment)
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
                  hover:bg-[#F3FDF6]
                  sm:flex-row
                  sm:items-center
                  sm:justify-between
                  sm:gap-3
                  sm:px-5
                  sm:py-3
                  ${i !== history.length - 1
                    ? "border-b border-[#ECFDF3]"
                    : ""
                  }
                `}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className="
                      break-words
                      text-xs
                      font-bold
                      leading-4
                      text-[#16351F]
                    "
                  >
                    {payment.courseName}
                  </p>

                  <p
                    className="
                      mt-1
                      text-[10px]
                      text-[#708074]
                    "
                  >
                    {formatDate(payment.paidAt)}
                  </p>
                </div>

                <div
                  className="
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
                  "
                >
                  <span
                    className="
                      flex
                      items-center
                      gap-1
                      text-xs
                      font-bold
                      text-[#16351F]
                    "
                  >
                    <IndianRupee className="h-3 w-3 shrink-0" />

                    {getPaymentAmount(
                      payment
                    ).toLocaleString("en-IN")}
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
                      background:
                        `linear-gradient(
                          135deg,
                          ${ACCENT},
                          ${VIOLET}
                        )`,
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

      {/* SECURITY NOTE */}

      <p
        className="
          mt-5
          flex
          items-start
          justify-center
          gap-1.5
          px-3
          text-center
          text-[10px]
          leading-4
          text-[#A1AEA5]
          sm:mt-6
        "
      >
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />

        <span>
          Payments are processed securely by Razorpay.
        </span>
      </p>

      {/* RECEIPT */}

      <ReceiptModal
        payment={receiptFor}
        onClose={() => setReceiptFor(null)}
      />
    </div>
  );
}

/* =========================================================
   EMPTY PAYMENT STATE
========================================================= */

function EmptyPaymentState({
  text,
  success = false,
}) {
  return (
    <div
      className={`
        rounded-2xl
        bg-white
        p-7
        text-center
        sm:rounded-3xl
        sm:p-9
        ${cardShadow}
      `}
    >
      <div
        className="
          mx-auto
          flex
          h-10
          w-10
          items-center
          justify-center
          rounded-full
        "
        style={{
          background: success
            ? "#ECFDF3"
            : "#F3FDF6",
        }}
      >
        {success ? (
          <CheckCircle2
            className="h-5 w-5 text-emerald-500"
          />
        ) : (
          <CreditCard
            className="h-5 w-5 text-[#708074]"
          />
        )}
      </div>

      <p
        className="
          mt-3
          text-xs
          font-medium
          text-[#94A39A]
        "
      >
        {text}
      </p>
    </div>
  );
}