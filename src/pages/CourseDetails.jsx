import { supabase } from "../lib/supabase";
import { createPaymentOrder, verifyPayment } from "../services/Payments";
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

    if (isEnrolled) {
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
       PAID COURSE — FIREBASE-ONLY CLIENT FLOW

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

        const order = await createPaymentOrder(course.id);

        const razorpay = new window.Razorpay({
          key: order.keyId,
          order_id: order.orderId,
          amount: order.amount,
          currency: order.currency,
          name: "Creative Adhyayan",
          description: course.title,

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
    <div className="min-h-screen bg-white text-gray-900">

      <main className="pt-24">

        {/* ===================================================
            HERO
        =================================================== */}

        <section className="border-b border-gray-200 bg-white">

          <div className="mx-auto max-w-7xl px-5 pb-14 sm:px-6 lg:px-8">

            {/* BACK */}

            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-black"
            >
              <ArrowLeft className="h-4 w-4" />

              Back
            </button>


            <div className="grid gap-12 lg:grid-cols-[1.45fr_0.75fr] lg:items-start">

              {/* =================================================
                  LEFT CONTENT
              ================================================= */}

              <div>

                {/* TAGS */}

                <div className="mb-5 flex flex-wrap gap-2">

                  {course.category && (
                    <span className="rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white">
                      {course.category}
                    </span>
                  )}

                  {course.type && (
                    <span className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold capitalize text-gray-700">
                      {course.type === "long"
                        ? "Live Course"
                        : "Short Course"}
                    </span>
                  )}

                  {course.level && (
                    <span className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold capitalize text-gray-700">
                      {course.level}
                    </span>
                  )}

                </div>


                {/* TITLE */}

                <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-gray-950 sm:text-5xl lg:text-6xl">
                  {course.title}
                </h1>


                {/* SHORT DESCRIPTION */}

                {course.shortDescription && (
                  <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-600">
                    {course.shortDescription}
                  </p>
                )}


                {/* COURSE INFO */}

                <div className="mt-8 flex flex-wrap gap-x-7 gap-y-4 text-sm text-gray-600">

                  {course.instructorName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />

                      <span>
                        Instructor{" "}
                        <strong className="text-gray-900">
                          {course.instructorName}
                        </strong>
                      </span>
                    </div>
                  )}


                  {course.duration && (
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-4 w-4" />

                      <span>
                        {course.duration}
                      </span>
                    </div>
                  )}


                  {totalModules > 0 && (
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />

                      <span>
                        {totalModules}{" "}
                        {totalModules === 1
                          ? "module"
                          : "modules"}
                      </span>
                    </div>
                  )}


                  {totalLessons > 0 && (
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4" />

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

                <div className="mt-10 grid gap-5 border-t border-gray-200 pt-7 sm:grid-cols-3">

                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />

                    <span className="text-sm text-gray-700">
                      Structured curriculum
                    </span>
                  </div>


                  <div className="flex items-center gap-3">
                    <PlayCircle className="h-5 w-5 text-gray-700" />

                    <span className="text-sm text-gray-700">
                      Video lessons
                    </span>
                  </div>


                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-gray-700" />

                    <span className="text-sm text-gray-700">
                      Secure access
                    </span>
                  </div>

                </div>

              </div>


              {/* =================================================
                  PURCHASE CARD
              ================================================= */}

              <div className="lg:sticky lg:top-24">

                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

                  {/* IMAGE */}

                  <div className="relative aspect-video overflow-hidden bg-gray-100">

                    {course.thumbnailUrl ? (
                      <img
                        src={course.thumbnailUrl}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <BookOpen className="h-14 w-14 text-gray-300" />
                      </div>
                    )}


                    {discountPercentage > 0 && (
                      <span className="absolute right-4 top-4 rounded-full bg-black px-3 py-1.5 text-xs font-bold text-white">
                        {discountPercentage}% OFF
                      </span>
                    )}

                  </div>


                  {/* CARD */}

                  <div className="p-6">

                    {/* PRICE */}

                    <div className="flex items-end gap-3">

                      <span className="text-3xl font-bold text-gray-950">
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

                    {isEnrolled ? (

                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/student/courses/${course.id}`
                          )
                        }
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-4 text-sm font-semibold text-white transition hover:bg-green-700"
                      >
                        <PlayCircle className="h-5 w-5" />

                        Continue Learning
                      </button>

                    ) : isPending ? (

                      <button
                        type="button"
                        disabled
                        className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-gray-200 px-5 py-4 text-sm font-semibold text-gray-600"
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
                        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-5 py-4 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >

                        {enrolling ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />

                            Enrolling...
                          </>
                        ) : (
                          <>
                            <GraduationCap className="h-5 w-5" />

                            {isFree
                              ? "Enroll for Free"
                              : "Enroll Now"}
                          </>
                        )}

                      </button>

                    )}


                    {/* INFO */}

                    <p className="mt-4 text-center text-xs leading-5 text-gray-500">

                      {isEnrolled
                        ? "You already have access to this course."
                        : isPending
                          ? "Your enrollment is waiting for payment verification."
                          : isFree
                            ? "Create your account and start learning immediately."
                            : "Secure payment powered by Razorpay."}

                    </p>


                    {/* COURSE INCLUDES */}

                    {(totalLessons > 0 ||
                      totalModules > 0 ||
                      course.duration) && (

                        <div className="mt-7 border-t border-gray-200 pt-6">

                          <h3 className="font-semibold text-gray-900">
                            This course includes
                          </h3>

                          <div className="mt-4 space-y-3">

                            {totalLessons > 0 && (
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />

                                {totalLessons} lessons
                              </div>
                            )}


                            {totalModules > 0 && (
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />

                                {totalModules} structured modules
                              </div>
                            )}


                            {course.duration && (
                              <div className="flex items-center gap-3 text-sm text-gray-600">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />

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
