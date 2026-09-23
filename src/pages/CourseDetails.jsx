import { supabase } from "../lib/supabase";
import { createPaymentOrder, getInstallmentPlan, verifyPayment } from "../services/Payments";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "../lib/database";

import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  CreditCard,
  GraduationCap,
  Loader2,
  Lock,
  PlayCircle,
  User,
  Video,
} from "lucide-react";

import { onAuthStateChanged } from "../lib/auth";

import { auth, db } from "../lib/backend";

import {
  getPublishedCourseByIdOrSlug,
} from "../services/CourseService";

import {
  enrollStudent,
  getEnrollment,
} from "../services/EnrollmentService";


/* =========================================================
   HELPERS
========================================================= */

const formatPrice = (value) => {
  const price = Number(value || 0);

  if (price <= 0) {
    return "Free";
  }

  return `₹${price.toLocaleString("en-IN")}`;
};


const calculateDiscount = (price, discountPrice) => {
  const original = Number(price || 0);
  const discounted = Number(discountPrice || 0);

  if (
    !original ||
    !discounted ||
    discounted >= original
  ) {
    return 0;
  }

  return Math.round(
    ((original - discounted) / original) * 100
  );
};


/* =========================================================
   RAZORPAY
========================================================= */

const RAZORPAY_SCRIPT_URL =
  "https://checkout.razorpay.com/v1/checkout.js";

/* Public Razorpay key only. Never put your Razorpay key secret in this file. */


const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existingScript = document.querySelector(
      `script[src="${RAZORPAY_SCRIPT_URL}"]`
    );

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(true));
      existingScript.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;

    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);

    document.body.appendChild(script);
  });
};


/* =========================================================
   COURSE DETAILS
========================================================= */


export default function CourseDetails() {
  const { courseId } = useParams();
  const navigate = useNavigate();


  /* =========================================================
     SCROLL TO TOP
  ========================================================= */

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [courseId]);


  /* =========================================================
     COURSE
  ========================================================= */

  const [course, setCourse] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  /* =========================================================
     CURRICULUM
  ========================================================= */

  const [modules, setModules] = useState([]);

  const [curriculumLoading, setCurriculumLoading] =
    useState(true);

  const [curriculumError, setCurriculumError] =
    useState("");

  const [openModules, setOpenModules] = useState({});


  /* =========================================================
     AUTH
  ========================================================= */

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);


  /* =========================================================
     ENROLLMENT
  ========================================================= */

  const [enrollment, setEnrollment] = useState(null);

  const [enrollmentLoading, setEnrollmentLoading] =
    useState(false);

  const [enrolling, setEnrolling] = useState(false);

  const [enrollmentMessage, setEnrollmentMessage] =
    useState("");

  const [enrollmentError, setEnrollmentError] =
    useState("");

  const [paymentChoice, setPaymentChoice] = useState("one_time");
  const [emiMonths, setEmiMonths] = useState(3);
  const [installmentPlan, setInstallmentPlan] = useState(null);


  /* =========================================================
     AUTH STATE
  ========================================================= */

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        setUser(currentUser);
        setAuthReady(true);
      }
    );

    return unsubscribe;
  }, []);


  /* =========================================================
     LOAD COURSE
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadCourse = async () => {
      if (!courseId) {
        setError("Course not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data =
          await getPublishedCourseByIdOrSlug(courseId);

        if (cancelled) {
          return;
        }

        if (!data) {
          setCourse(null);
          setError(
            "This course does not exist or is not published."
          );
          return;
        }

        setCourse(data);
      } catch (err) {
        console.error(
          "Failed to load course:",
          err
        );

        if (!cancelled) {
          setError(
            "Unable to load this course. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId]);


  /* =========================================================
     LOAD CURRICULUM
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    const loadCurriculum = async () => {
      if (!course?.id) {
        setModules([]);
        setCurriculumLoading(false);
        return;
      }

      try {
        setCurriculumLoading(true);
        setCurriculumError("");

        const modulesRef = collection(
          db,
          "courses",
          course.id,
          "modules"
        );

        const modulesQuery = query(
          modulesRef,
          orderBy("order", "asc")
        );

        const modulesSnapshot =
          await getDocs(modulesQuery);

        const { data: outline, error: outlineError } = await supabase.rpc("lms_course_outline", { course: course.id });
        if (outlineError) throw outlineError;
        const moduleData = modulesSnapshot.docs.map((moduleDoc) => ({
          id: moduleDoc.id,
          ...moduleDoc.data(),
          lessons: (outline || []).filter((lesson) => lesson.module_id === moduleDoc.id)
            .map((lesson) => ({ ...lesson, order: lesson.sort_order, isPreview: lesson.is_preview })),
        }));

        if (cancelled) {
          return;
        }

        setModules(moduleData);

        /* Open first module automatically */
        if (moduleData.length > 0) {
          setOpenModules({
            [moduleData[0].id]: true,
          });
        }
      } catch (err) {
        console.error(
          "Failed to load curriculum:",
          err
        );

        if (!cancelled) {
          setCurriculumError(
            "Unable to load the course curriculum."
          );
        }
      } finally {
        if (!cancelled) {
          setCurriculumLoading(false);
        }
      }
    };

    loadCurriculum();

    return () => {
      cancelled = true;
    };
  }, [course?.id]);


  /* =========================================================
     CHECK ENROLLMENT
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    const checkEnrollment = async () => {
      if (!course?.id || !user) {
        setEnrollment(null);
        setEnrollmentLoading(false);
        return;
      }

      try {
        setEnrollmentLoading(true);
        setEnrollmentError("");

        const data = await getEnrollment(
          user.uid,
          course.id
        );

        if (!cancelled) {
          setEnrollment(data);
        }
      } catch (err) {
        /*
          Enrollment lookup should not prevent the course
          details page from working.

          Keep this as a console warning because a missing
          enrollment is normal for a new student.
        */
        console.warn(
          "Enrollment check unavailable:",
          err?.code || err?.message || err
        );

        if (!cancelled) {
          setEnrollment(null);
        }
      } finally {
        if (!cancelled) {
          setEnrollmentLoading(false);
        }
      }
    };

    if (authReady) {
      checkEnrollment();
    }

    return () => {
      cancelled = true;
    };
  }, [course?.id, user, authReady]);

  useEffect(() => {
    let cancelled = false;
    if (!course?.id || !user) { setInstallmentPlan(null); return undefined; }
    getInstallmentPlan(course.id).then(({ plan }) => {
      if (!cancelled) {
        setInstallmentPlan(plan || null);
        if (plan && plan.status !== "completed") { setPaymentChoice("emi"); setEmiMonths(Number(plan.installment_count)); }
      }
    }).catch(() => { if (!cancelled) setInstallmentPlan(null); });
    return () => { cancelled = true; };
  }, [course?.id, user]);


  /* =========================================================
     COURSE STATS
  ========================================================= */

  const totalModules = modules.length;

  const totalLessons = useMemo(() => {
    return modules.reduce(
      (total, module) =>
        total + (module.lessons?.length || 0),
      0
    );
  }, [modules]);


  const discountPercentage = useMemo(() => {
    return calculateDiscount(
      course?.price,
      course?.discountPrice
    );
  }, [course]);


  /* =========================================================
     ENROLLMENT STATUS
  ========================================================= */

  const isEnrolled =
    enrollment?.status === "active";

  const isPending =
    enrollment?.status === "pending";

  const isFree =
    Number(course?.price || 0) === 0;

  const effectivePrice = Number(
    course?.discountPrice > 0 && course?.discountPrice < course?.price
      ? course.discountPrice
      : course?.price || 0
  );
  const visibleEmiAmount = Math.ceil((effectivePrice * 100) / emiMonths) / 100;
  const planIsOpen = installmentPlan && installmentPlan.status !== "completed";
  const canChoosePayment = !isFree && (!isEnrolled || planIsOpen) && !isPending;


  /* =========================================================
     TOGGLE MODULE
  ========================================================= */

  const toggleModule = (moduleId) => {
    setOpenModules((previous) => ({
      ...previous,
      [moduleId]: !previous[moduleId],
    }));
  };


  /* =========================================================
     ENROLL
  ========================================================= */

  const handleEnroll = async () => {
    setEnrollmentError("");
    setEnrollmentMessage("");

    /* -------------------------------------------------------
       COURSE CHECK
    ------------------------------------------------------- */

    if (!course?.id) {
      setEnrollmentError(
        "Course information is unavailable."
      );
      return;
    }


    /* -------------------------------------------------------
       LOGIN
    ------------------------------------------------------- */

    if (!user) {
      navigate("/login", {
        state: {
          from: `/courses/${course.id}`,
        },
      });

      return;
    }


    /* -------------------------------------------------------
       ALREADY ACTIVE
    ------------------------------------------------------- */

    if (isEnrolled && !planIsOpen) {
      navigate(
        `/student/courses/${course.id}`
      );

      return;
    }


    /* -------------------------------------------------------
       ALREADY PENDING
    ------------------------------------------------------- */

    if (isPending) {
      setEnrollmentMessage(
        "Your enrollment is waiting for payment verification."
      );

      return;
    }


    /* -------------------------------------------------------
       PAID COURSE — Supabase-ONLY CLIENT FLOW

       The Edge Function creates the order using the stored course price.
       Enrollment is activated only after signature and capture verification.
    ------------------------------------------------------- */

    if (!isFree) {
      try {
        setEnrolling(true);

        const razorpayLoaded = await loadRazorpayScript();

        if (!razorpayLoaded) {
          throw new Error(
            "Razorpay Checkout could not be loaded. Please check your internet connection and try again."
          );
        }

        const usingEmi = paymentChoice === "emi";
        const order = await createPaymentOrder(course.id, usingEmi ? "emi" : "one_time", usingEmi ? emiMonths : null);

        const razorpay = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: "Creative Adhyayan",
          description: usingEmi ? `${course.title} — EMI ${order.installmentNumber} of ${order.installmentCount}` : course.title,

          prefill: {
            name: user.displayName || "",
            email: user.email || "",
            contact: user.phoneNumber || "",
          },

          notes: {
            courseId: course.id,
            courseName: course.title,
            uid: user.uid,
          },

          theme: {
            color: "#000000",
          },

          modal: {
            ondismiss: () => {
              setEnrolling(false);
              setEnrollmentMessage(
                "Payment window closed. No payment was completed."
              );
            },
          },

          handler: async (response) => {
            try {
              setEnrollmentMessage(
                "Payment received. Enrolling you in the course..."
              );

              const newEnrollment = await verifyPayment({ courseId: course.id, ...response });

              setEnrollment(newEnrollment);
              if (usingEmi) {
                const { plan } = await getInstallmentPlan(course.id);
                setInstallmentPlan(plan || null);
              }
              setEnrollmentMessage(
                "Payment successful! Your course is now unlocked."
              );

              setTimeout(() => {
                navigate(`/student/courses/${course.id}`);
              }, 800);
            } catch (err) {
              console.error("Enrollment failed after payment:", err);

              setEnrollmentError(
                err?.message ||
                "Payment was successful, but enrollment could not be completed. Please contact the institute with your Razorpay payment ID."
              );

              setEnrolling(false);
            }
          },
        });

        razorpay.on("payment.failed", (response) => {
          console.error("Razorpay payment failed:", response?.error);

          setEnrollmentError(
            response?.error?.description ||
            "Payment failed. Please try again."
          );

          setEnrollmentMessage("");
          setEnrolling(false);
        });

        razorpay.open();
      } catch (err) {
        console.error("Razorpay checkout failed:", err);

        setEnrollmentError(
          err?.message ||
          "Unable to start online payment. Please try again."
        );

        setEnrolling(false);
      }

      return;
    }


    /* -------------------------------------------------------
       FREE COURSE
    ------------------------------------------------------- */

    try {
      setEnrolling(true);

      const newEnrollment =
        await enrollStudent({
          courseId: course.id,
          paymentStatus: "free",
          paymentId: "",
        });

      setEnrollment(newEnrollment);

      setEnrollmentMessage(
        "Enrollment successful. Opening your course..."
      );

      navigate(
        `/student/courses/${course.id}`
      );
    } catch (err) {
      console.error(
        "Enrollment failed:",
        err
      );

      setEnrollmentError(
        err?.message ||
        "Unable to enroll in this course."
      );
    } finally {
      setEnrolling(false);
    }
  };


  /* =========================================================
     LOADING
  ========================================================= */

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="flex items-center gap-3 text-gray-600">
            <Loader2 className="h-5 w-5 animate-spin" />

            <span>
              Loading course...
            </span>
          </div>
        </div>
      </div>
    );
  }


  /* =========================================================
     ERROR
  ========================================================= */

  if (error || !course) {
    return (
      <div className="min-h-screen bg-white px-6 pt-24">
        <div className="mx-auto flex min-h-[60vh] max-w-md items-center justify-center text-center">

          <div>

            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
              <AlertCircle className="h-7 w-7 text-red-500" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Course unavailable
            </h1>

            <p className="mt-3 text-gray-600">
              {error ||
                "This course could not be found."}
            </p>

            <Link
              to="/courses"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />

              Back to Courses
            </Link>

          </div>

        </div>
      </div>
    );
  }


  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#F8F7FC] text-[#1B0E3D]">

      <main className="pt-24">

        {/* ===================================================
            HERO
        =================================================== */}

        <section className="border-b border-violet-100 bg-[radial-gradient(circle_at_top_left,_#EEE9FF_0,_#F8F7FC_42%,_#FFFFFF_100%)]">

          <div className="mx-auto max-w-7xl px-5 pb-14 pt-8 sm:px-6 sm:pt-10 lg:px-8">

            {/* BACK */}

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white/80 px-4 py-2 text-sm font-semibold text-[#62567F] shadow-sm transition hover:border-violet-300 hover:text-[#5227FF]"
            >
              <ArrowLeft className="h-4 w-4" />

              Back
            </button>


            <div className="grid gap-8 lg:grid-cols-[1.45fr_0.75fr] lg:items-start">

              {/* =================================================
                  LEFT CONTENT
              ================================================= */}

              <div>

                {/* TAGS */}

                <div className="mb-5 flex flex-wrap gap-2">

                  {course.category && (
                    <span className="rounded-full bg-[#2E1A55] px-3 py-1.5 text-xs font-semibold text-white shadow-sm">
                      {course.category}
                    </span>
                  )}

                  {course.type && (
                    <span className="rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-semibold capitalize text-[#62567F]">
                      {course.type === "long"
                        ? "Live Course"
                        : "Short Course"}
                    </span>
                  )}

                  {course.level && (
                    <span className="rounded-full border border-violet-200 bg-white/80 px-3 py-1.5 text-xs font-semibold capitalize text-[#62567F]">
                      {course.level}
                    </span>
                  )}

                </div>


                {/* TITLE */}

                <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight text-[#1B0E3D] sm:text-5xl lg:text-6xl">
                  {course.title}
                </h1>


                {/* SHORT DESCRIPTION */}

                {course.shortDescription && (
                  <p className="mt-5 max-w-3xl text-lg leading-8 text-[#62567F]">
                    {course.shortDescription}
                  </p>
                )}


                {/* COURSE INFO */}

                <div className="mt-8 flex flex-wrap gap-3 text-sm text-[#62567F]">

                  {course.instructorName && (
                    <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-white/80 px-3 py-2 shadow-sm">
                      <User className="h-4 w-4 text-[#6D3FC0]" />

                      <span>
                        Instructor{" "}
                        <strong className="text-[#1B0E3D]">
                          {course.instructorName}
                        </strong>
                      </span>
                    </div>
                  )}


                  {course.duration && (
                    <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-white/80 px-3 py-2 shadow-sm">
                      <Clock3 className="h-4 w-4 text-[#6D3FC0]" />

                      <span>
                        {course.duration}
                      </span>
                    </div>
                  )}


                  {totalModules > 0 && (
                    <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-white/80 px-3 py-2 shadow-sm">
                      <BookOpen className="h-4 w-4 text-[#6D3FC0]" />

                      <span>
                        {totalModules}{" "}
                        {totalModules === 1
                          ? "module"
                          : "modules"}
                      </span>
                    </div>
                  )}


                  {totalLessons > 0 && (
                    <div className="flex items-center gap-2 rounded-2xl border border-violet-100 bg-white/80 px-3 py-2 shadow-sm">
                      <Video className="h-4 w-4 text-[#6D3FC0]" />

                      <span>
                        {totalLessons}{" "}
                        {totalLessons === 1
                          ? "lesson"
                          : "lessons"}
                      </span>
                    </div>
                  )}

                </div>


                {/* FUNCTIONAL FEATURES */}

                <div className="mt-10 grid gap-3 border-t border-violet-100 pt-7 sm:grid-cols-3">

                  <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/75 p-4 shadow-sm">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />

                    <span className="text-sm font-medium text-[#3E315E]">
                      Structured curriculum
                    </span>
                  </div>


                  <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/75 p-4 shadow-sm">
                    <PlayCircle className="h-5 w-5 text-[#6D3FC0]" />

                    <span className="text-sm font-medium text-[#3E315E]">
                      Video lessons
                    </span>
                  </div>


                  <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-white/75 p-4 shadow-sm">
                    <Lock className="h-5 w-5 text-[#6D3FC0]" />

                    <span className="text-sm font-medium text-[#3E315E]">
                      Secure access
                    </span>
                  </div>

                </div>

              </div>


              {/* =================================================
                  PURCHASE CARD
              ================================================= */}

              <div className="lg:sticky lg:top-24">

                <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-xl shadow-violet-900/[0.08]">

                  {/* IMAGE */}

                  <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-[#2E1A55] via-[#5227FF] to-[#A78BFA]">

                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-8 text-center text-white">
                        <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
                          <BookOpen className="h-7 w-7" />
                        </span>
                        <p className="line-clamp-2 text-lg font-bold">
                          {course.title}
                        </p>
                        <p className="mt-1 text-xs text-white/70">
                          Start your learning journey
                        </p>
                      </div>
                    )}


                    {discountPercentage > 0 && (
                      <span className="absolute right-4 top-4 rounded-full bg-[#1B0E3D] px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                        {discountPercentage}% OFF
                      </span>
                    )}

                  </div>


                  {/* CARD */}

                  <div className="p-6 sm:p-7">

                    {/* PRICE */}

                    <div className="flex items-end gap-3">

                      <span className="text-3xl font-extrabold text-[#1B0E3D]">
                        {formatPrice(
                          course.discountPrice ??
                          course.price
                        )}
                      </span>


                      {discountPercentage > 0 && (
                        <span className="pb-1 text-sm text-gray-400 line-through">
                          {formatPrice(course.price)}
                        </span>
                      )}

                    </div>

                    {canChoosePayment && (
                      <div className="mt-6 rounded-2xl border border-violet-100 bg-violet-50/50 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-[#2E1A55]"><CreditCard className="h-4 w-4 text-violet-600" />Choose how you want to pay</div>
                        {planIsOpen ? (
                          <div className="mt-3 rounded-xl border border-violet-200 bg-white px-3 py-3 text-sm text-[#62567F]"><p className="font-semibold text-[#2E1A55]">Your {installmentPlan.installment_count}-month EMI plan</p><p className="mt-1">{installmentPlan.paid_installments} of {installmentPlan.installment_count} payments completed. Pay EMI {Number(installmentPlan.paid_installments) + 1} to keep access active.</p></div>
                        ) : <>
                          <label className={`mt-3 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${paymentChoice === "one_time" ? "border-violet-500 bg-white shadow-sm" : "border-transparent bg-white/70"}`}><input type="radio" name="payment-choice" checked={paymentChoice === "one_time"} onChange={() => setPaymentChoice("one_time")} className="mt-1 accent-violet-600" /><span><span className="block text-sm font-semibold text-[#2E1A55]">Pay in full</span><span className="block text-xs text-[#7B7194]">One secure Razorpay payment of {formatPrice(effectivePrice)}.</span></span></label>
                          <label className={`mt-3 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${paymentChoice === "emi" ? "border-violet-500 bg-white shadow-sm" : "border-transparent bg-white/70"}`}><input type="radio" name="payment-choice" checked={paymentChoice === "emi"} onChange={() => setPaymentChoice("emi")} className="mt-1 accent-violet-600" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[#2E1A55]">Pay monthly with EMI</span><span className="block text-xs text-[#7B7194]">Interest-free instalments. The first payment unlocks the course.</span></span></label>
                          {paymentChoice === "emi" && <div className="mt-3 grid grid-cols-2 gap-2"><select value={emiMonths} onChange={(event) => setEmiMonths(Number(event.target.value))} className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm text-[#2E1A55] outline-none focus:border-violet-500">{[3, 6, 9, 12].map((months) => <option key={months} value={months}>{months} monthly payments</option>)}</select><div className="rounded-xl bg-white px-3 py-2 text-right text-sm text-[#62567F]">≈ <span className="font-semibold text-[#2E1A55]">{formatPrice(visibleEmiAmount)}</span>/month</div></div>}
                        </>}
                      </div>
                    )}


                    {/* ENROLLMENT ERROR */}

                    {enrollmentError && (
                      <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                        {enrollmentError}
                      </div>
                    )}


                    {/* ENROLLMENT MESSAGE */}

                    {enrollmentMessage && (
                      <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-700">
                        {enrollmentMessage}
                      </div>
                    )}


                    {/* ACTION BUTTON */}

                    {isEnrolled && !planIsOpen ? (

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/student/courses/${course.id}`
                          )
                        }
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#5227FF] to-[#6D3FC0] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110"
                      >
                        <PlayCircle className="h-5 w-5" />

                        Continue Learning
                      </button>

                    ) : isPending ? (

                      <button
                        type="button"
                        disabled
                        className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-violet-100 px-5 py-4 text-sm font-semibold text-[#62567F]"
                      >
                        <Clock3 className="h-5 w-5" />

                        Awaiting Payment
                      </button>

                    ) : (

                      <button
                        type="button"
                        disabled={
                          enrolling ||
                          enrollmentLoading
                        }
                        onClick={handleEnroll}
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#5227FF] to-[#6D3FC0] px-5 py-4 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                      >

                        {enrolling ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />

                            Enrolling...
                          </>
                        ) : (
                          <>
                            <GraduationCap className="h-5 w-5" />

                            {isFree ? "Enroll for Free" : paymentChoice === "emi" ? planIsOpen ? `Pay EMI ${Number(installmentPlan.paid_installments) + 1}` : `Pay first EMI · ${formatPrice(visibleEmiAmount)}` : "Pay in Full"}
                          </>
                        )}

                      </button>

                    )}


                    {/* INFO */}

                    <p className="mt-4 text-center text-xs leading-5 text-[#8A82A6]">

                      {isEnrolled
                        ? "You already have access to this course."
                        : isPending
                          ? "Your enrollment is waiting for payment verification."
                          : isFree
                            ? "Create your account and start learning immediately."
                            : paymentChoice === "emi" ? "Your next EMI is due one month after each successful payment. Payments are processed securely by Razorpay." : "Secure payment powered by Razorpay."}

                    </p>


                    {/* COURSE INCLUDES */}

                    {(totalLessons > 0 ||
                      totalModules > 0 ||
                      course.duration) && (

                        <div className="mt-7 border-t border-violet-100 pt-6">

                          <h3 className="font-bold text-[#1B0E3D]">
                            This course includes
                          </h3>

                          <div className="mt-4 space-y-3">

                            {totalLessons > 0 && (
                              <div className="flex items-center gap-3 text-sm text-[#62567F]">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                                {totalLessons} lessons
                              </div>
                            )}


                            {totalModules > 0 && (
                              <div className="flex items-center gap-3 text-sm text-[#62567F]">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                                {totalModules} structured modules
                              </div>
                            )}


                            {course.duration && (
                              <div className="flex items-center gap-3 text-sm text-[#62567F]">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />

                                {course.duration} learning duration
                              </div>
                            )}

                          </div>

                        </div>

                      )}

                  </div>

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            ABOUT COURSE
        ===================================================== */}

        <section className="border-b border-gray-200 bg-white">

          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">

            <div className="max-w-4xl">

              <h2 className="text-2xl font-bold text-gray-950 sm:text-3xl">
                About This Course
              </h2>

              <div className="mt-6 whitespace-pre-line text-base leading-8 text-gray-600">
                {course.description ||
                  course.shortDescription ||
                  "No course description available."}
              </div>

            </div>

          </div>

        </section>


        {/* =====================================================
            CURRICULUM
        ===================================================== */}

        <section className="bg-gray-50">

          <div className="mx-auto max-w-7xl px-5 py-14 sm:px-6 lg:px-8">

            <div className="mb-8">

              <h2 className="text-2xl font-bold text-gray-950 sm:text-3xl">
                Course Curriculum
              </h2>

              <p className="mt-2 text-sm text-gray-600">

                {totalModules > 0
                  ? `${totalModules} ${totalModules === 1
                    ? "module"
                    : "modules"
                  }`
                  : "Curriculum"}

                {totalLessons > 0 &&
                  ` · ${totalLessons} ${totalLessons === 1
                    ? "lesson"
                    : "lessons"
                  }`}

              </p>

            </div>


            {/* CURRICULUM LOADING */}

            {curriculumLoading && (
              <div className="rounded-2xl border border-gray-200 bg-white p-8">

                <div className="flex items-center gap-3 text-gray-600">

                  <Loader2 className="h-5 w-5 animate-spin" />

                  <span>
                    Loading curriculum...
                  </span>

                </div>

              </div>
            )}


            {/* CURRICULUM ERROR */}

            {!curriculumLoading &&
              curriculumError && (

                <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
                  {curriculumError}
                </div>

              )}


            {/* EMPTY CURRICULUM */}

            {!curriculumLoading &&
              !curriculumError &&
              modules.length === 0 && (

                <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">

                  <BookOpen className="mx-auto h-10 w-10 text-gray-300" />

                  <h3 className="mt-4 font-semibold text-gray-900">
                    Curriculum coming soon
                  </h3>

                  <p className="mt-2 text-sm text-gray-500">
                    The instructor has not added lessons yet.
                  </p>

                </div>

              )}


            {/* MODULES */}

            {!curriculumLoading &&
              !curriculumError &&
              modules.length > 0 && (

                <div className="space-y-4">

                  {modules.map(
                    (module, moduleIndex) => {

                      const isOpen =
                        !!openModules[module.id];

                      return (
                        <div
                          key={module.id}
                          className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                        >

                          {/* MODULE HEADER */}

                          <button
                            type="button"
                            onClick={() =>
                              toggleModule(
                                module.id
                              )
                            }
                            className="flex w-full items-center justify-between gap-4 p-5 text-left transition hover:bg-gray-50"
                          >

                            <div className="flex min-w-0 items-center gap-4">

                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-sm font-bold text-gray-700">
                                {moduleIndex + 1}
                              </div>

                              <div className="min-w-0">

                                <h3 className="font-semibold text-gray-900">
                                  {module.title ||
                                    `Module ${moduleIndex + 1
                                    }`}
                                </h3>

                                <p className="mt-1 text-xs text-gray-500">
                                  {module.lessons?.length ||
                                    0}{" "}
                                  {module.lessons
                                    ?.length === 1
                                    ? "lesson"
                                    : "lessons"}
                                </p>

                              </div>

                            </div>


                            {isOpen ? (
                              <ChevronUp className="h-5 w-5 shrink-0 text-gray-500" />
                            ) : (
                              <ChevronDown className="h-5 w-5 shrink-0 text-gray-500" />
                            )}

                          </button>


                          {/* LESSONS */}

                          {isOpen && (

                            <div className="border-t border-gray-200">

                              {module.lessons?.length > 0 ? (

                                module.lessons.map(
                                  (
                                    lesson,
                                    lessonIndex
                                  ) => {

                                    const isPreview =
                                      !!lesson.isPreview;

                                    return (
                                      <div
                                        key={lesson.id}
                                        className="flex items-center justify-between gap-4 border-b border-gray-100 px-5 py-4 last:border-b-0"
                                      >

                                        <div className="flex min-w-0 items-center gap-3">

                                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">

                                            {lesson.type ===
                                              "video" ? (
                                              <Video className="h-4 w-4 text-gray-600" />
                                            ) : (
                                              <BookOpen className="h-4 w-4 text-gray-600" />
                                            )}

                                          </div>


                                          <div className="min-w-0">

                                            <div className="flex items-center gap-2">

                                              <p className="truncate text-sm font-medium text-gray-900">

                                                {lessonIndex +
                                                  1}
                                                .{" "}

                                                {lesson.title ||
                                                  "Untitled lesson"}

                                              </p>


                                              {isPreview && (
                                                <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                                  Preview
                                                </span>
                                              )}

                                            </div>


                                            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">

                                              {lesson.type ===
                                                "video" && (
                                                  <span className="flex items-center gap-1">

                                                    <PlayCircle className="h-3.5 w-3.5" />

                                                    Video

                                                  </span>
                                                )}

                                              {lesson.duration && (
                                                <span>
                                                  {lesson.duration}
                                                </span>
                                              )}

                                            </div>

                                          </div>

                                        </div>


                                        {/* PREVIEW / LOCK */}

                                        {isPreview ? (

                                          <Link
                                            to={`/student/courses/${course.id}?lesson=${lesson.id}&preview=true`}
                                            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-800 transition hover:bg-gray-100"
                                          >
                                            <PlayCircle className="h-4 w-4" />

                                            Preview
                                          </Link>

                                        ) : (

                                          <div className="flex shrink-0 items-center gap-1 text-xs text-gray-400">

                                            <Lock className="h-4 w-4" />

                                            <span className="hidden sm:inline">
                                              Locked
                                            </span>

                                          </div>

                                        )}

                                      </div>
                                    );
                                  }
                                )

                              ) : (

                                <div className="px-5 py-6 text-sm text-gray-500">
                                  No lessons added yet.
                                </div>

                              )}

                            </div>

                          )}

                        </div>
                      );
                    }
                  )}

                </div>

              )}

          </div>

        </section>

      </main>

    </div>
  );
}
