import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  Upload,
  Video,
  X,
} from "lucide-react";

import { auth } from "../lib/backend";

import {
  createCourse,
  getCourseById,
  updateCourse,
  uploadCourseThumbnail,
} from "../services/CourseService";

const INITIAL_FORM = {
  type: "short",
  title: "",
  shortDescription: "",
  description: "",
  category: "",
  level: "",
  duration: "",
  price: "",
  discountPrice: "",
};

const COURSE_TYPES = [
  {
    value: "short",
    title: "Short Course",
    description:
      "Self-paced or compact courses designed for quick learning.",
    icon: BookOpen,
  },
  {
    value: "long",
    title: "Long / Live Course",
    description:
      "Long-form programs with live classes, structured modules and ongoing learning.",
    icon: Video,
  },
];

export default function CreateCourse() {
  const navigate = useNavigate();

  const [form, setForm] =
    useState(INITIAL_FORM);

  const [thumbnail, setThumbnail] =
    useState(null);

  const [thumbnailPreview, setThumbnailPreview] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const [uploadProgress, setUploadProgress] =
    useState(0);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  /* ============================================================
     AUTH CHECK
     ============================================================ */

  useEffect(() => {
    if (!auth.currentUser) {
      navigate("/login", {
        replace: true,
      });
    }
  }, [navigate]);

  /* ============================================================
     CLEAN PREVIEW URL
     ============================================================ */

  useEffect(() => {
    return () => {
      if (thumbnailPreview) {
        URL.revokeObjectURL(
          thumbnailPreview
        );
      }
    };
  }, [thumbnailPreview]);

  /* ============================================================
     FORM CHANGE
     ============================================================ */

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
  }

  /* ============================================================
     THUMBNAIL SELECT
     ============================================================ */

  function handleThumbnailChange(
    event
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    setError("");

    /* ----------------------------------------------------------
       IMAGE VALIDATION
       ---------------------------------------------------------- */

    if (
      !file.type.startsWith(
        "image/"
      )
    ) {
      setError(
        "Please select a valid image file."
      );

      event.target.value = "";
      return;
    }

    /* ----------------------------------------------------------
       5MB LIMIT
       ---------------------------------------------------------- */

    const MAX_SIZE =
      5 * 1024 * 1024;

    if (
      file.size > MAX_SIZE
    ) {
      setError(
        "Thumbnail must be smaller than 5MB."
      );

      event.target.value = "";
      return;
    }

    /* ----------------------------------------------------------
       CREATE PREVIEW
       ---------------------------------------------------------- */

    if (thumbnailPreview) {
      URL.revokeObjectURL(
        thumbnailPreview
      );
    }

    const previewUrl =
      URL.createObjectURL(
        file
      );

    setThumbnail(file);
    setThumbnailPreview(
      previewUrl
    );
  }

  /* ============================================================
     REMOVE THUMBNAIL
     ============================================================ */

  function removeThumbnail() {
    if (thumbnailPreview) {
      URL.revokeObjectURL(
        thumbnailPreview
      );
    }

    setThumbnail(null);
    setThumbnailPreview("");
  }

  /* ============================================================
     VALIDATION
     ============================================================ */

  function validateForm() {
    if (!form.title.trim()) {
      return "Course title is required.";
    }

    if (!form.shortDescription.trim()) {
      return "Short description is required.";
    }

    if (!form.description.trim()) {
      return "Course description is required.";
    }

    if (!form.category.trim()) {
      return "Course category is required.";
    }

    if (!form.duration.trim()) {
      return "Course duration is required.";
    }

    const price =
      Number(form.price);

    const discountPrice =
      Number(form.discountPrice);

    if (
      form.price !== "" &&
      (Number.isNaN(price) ||
        price < 0)
    ) {
      return "Please enter a valid course price.";
    }

    if (
      form.discountPrice !== "" &&
      (Number.isNaN(
        discountPrice
      ) ||
        discountPrice < 0)
    ) {
      return "Please enter a valid discount price.";
    }

    if (
      form.price !== "" &&
      form.discountPrice !== "" &&
      discountPrice > price
    ) {
      return "Discount price cannot be higher than the original price.";
    }

    return "";
  }

  /* ============================================================
     CREATE COURSE
     ============================================================ */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (creating || uploading) {
      return;
    }

    setError("");
    setSuccess("");

    /* ----------------------------------------------------------
       VALIDATE
       ---------------------------------------------------------- */

    const validationError =
      validateForm();

    if (validationError) {
      setError(
        validationError
      );
      return;
    }

    /* ----------------------------------------------------------
       AUTH
       ---------------------------------------------------------- */

    const user =
      auth.currentUser;

    if (!user) {
      navigate("/login");
      return;
    }

    try {
      setCreating(true);

      /* ========================================================
         STEP 1 — CREATE FIRESTORE COURSE
         ======================================================== */

      const createdCourse =
        await createCourse({
          type: form.type,

          title:
            form.title.trim(),

          shortDescription:
            form.shortDescription.trim(),

          description:
            form.description.trim(),

          category:
            form.category.trim(),

          level:
            form.level.trim(),

          duration:
            form.duration.trim(),

          price:
            form.price === ""
              ? 0
              : Number(form.price),

          discountPrice:
            form.discountPrice === ""
              ? 0
              : Number(
                  form.discountPrice
                ),

          /*
           * instructorId is NOT supplied here.
           *
           * courseService automatically
           * takes it from auth.currentUser.uid.
           */
        });

      /* ========================================================
         STEP 2 — UPLOAD THUMBNAIL
         ======================================================== */

      if (thumbnail) {
        setCreating(false);
        setUploading(true);
        setUploadProgress(0);

        const uploaded =
          await uploadCourseThumbnail(
            createdCourse.id,
            thumbnail,
            (progress) => {
              setUploadProgress(
                progress
              );
            }
          );

        /* ======================================================
           STEP 3 — SAVE THUMBNAIL DATA
           ====================================================== */

        await updateCourse(
          createdCourse.id,
          {
            thumbnailUrl:
              uploaded.url,

            thumbnailPath:
              uploaded.path,
          }
        );
      }

      /* ========================================================
         STEP 4 — VERIFY COURSE
         ======================================================== */

      const savedCourse =
        await getCourseById(
          createdCourse.id
        );

      if (!savedCourse) {
        throw new Error(
          "Course was created but could not be loaded again."
        );
      }

      setCreating(false);
      setUploading(false);
      setUploadProgress(100);

      setSuccess(
        "Course created successfully."
      );

      /* ========================================================
         STEP 5 — GO TO EDIT COURSE
         ======================================================== */

      setTimeout(() => {
        navigate(
          `/teacher/courses/edit/${createdCourse.id}`
        );
      }, 500);
    } catch (err) {
      console.error(
        "Create course error:",
        err
      );

      setCreating(false);
      setUploading(false);

      setError(
        err?.message ||
          "Something went wrong while creating the course."
      );
    }
  }

  /* ============================================================
     BACK
     ============================================================ */

  function handleBack() {
    if (
      creating ||
      uploading
    ) {
      return;
    }

    navigate(
      "/teacher/courses"
    );
  }

  /* ============================================================
     UI
     ============================================================ */

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* ======================================================
           HEADER
           ====================================================== */}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={handleBack}
              disabled={
                creating ||
                uploading
              }
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowLeft
                size={18}
              />

              Back to My Courses
            </button>

            <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
              Create New Course
            </h1>

            <p className="mt-2 text-sm text-slate-500 sm:text-base">
              Create your course first.
              You can add modules,
              lessons and videos after
              the course is created.
            </p>
          </div>
        </div>

        {/* ======================================================
           ERROR
           ====================================================== */}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <X
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>
              {error}
            </span>
          </div>
        )}

        {/* ======================================================
           SUCCESS
           ====================================================== */}

        {success && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            <CheckCircle2
              size={18}
              className="mt-0.5 shrink-0"
            />

            <span>
              {success}
            </span>
          </div>
        )}

        <form
          onSubmit={
            handleSubmit
          }
          className="space-y-6"
        >
          {/* ==================================================
             COURSE TYPE
             ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-slate-950">
                Course Type
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Choose how this course
                will be delivered.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {COURSE_TYPES.map(
                (courseType) => {
                  const Icon =
                    courseType.icon;

                  const selected =
                    form.type ===
                    courseType.value;

                  return (
                    <button
                      key={
                        courseType.value
                      }
                      type="button"
                      onClick={() =>
                        setForm(
                          (previous) => ({
                            ...previous,
                            type:
                              courseType.value,
                          })
                        )
                      }
                      disabled={
                        creating ||
                        uploading
                      }
                      className={[
                        "relative rounded-2xl border p-5 text-left transition",
                        selected
                          ? "border-slate-950 bg-slate-50 ring-2 ring-slate-950/10"
                          : "border-slate-200 bg-white hover:border-slate-400",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-4">
                        <div
                          className={[
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                            selected
                              ? "bg-slate-950 text-white"
                              : "bg-slate-100 text-slate-600",
                          ].join(" ")}
                        >
                          <Icon
                            size={21}
                          />
                        </div>

                        <div>
                          <h3 className="font-semibold text-slate-950">
                            {
                              courseType.title
                            }
                          </h3>

                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            {
                              courseType.description
                            }
                          </p>
                        </div>
                      </div>

                      {selected && (
                        <div className="absolute right-4 top-4">
                          <CheckCircle2
                            size={20}
                            className="text-slate-950"
                          />
                        </div>
                      )}
                    </button>
                  );
                }
              )}
            </div>
          </section>

          {/* ==================================================
             BASIC INFORMATION
             ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Course Information
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Basic information students
                will see about your course.
              </p>
            </div>

            <div className="space-y-5">
              {/* TITLE */}

              <div>
                <label
                  htmlFor="title"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Course Title
                  <span className="text-red-500">
                    {" "}
                    *
                  </span>
                </label>

                <input
                  id="title"
                  name="title"
                  value={form.title}
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Complete Digital Marketing Course"
                  disabled={
                    creating ||
                    uploading
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                />
              </div>

              {/* SHORT DESCRIPTION */}

              <div>
                <label
                  htmlFor="shortDescription"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Short Description
                  <span className="text-red-500">
                    {" "}
                    *
                  </span>
                </label>

                <textarea
                  id="shortDescription"
                  name="shortDescription"
                  value={
                    form.shortDescription
                  }
                  onChange={
                    handleChange
                  }
                  rows={3}
                  placeholder="A short summary of what students will learn."
                  disabled={
                    creating ||
                    uploading
                  }
                  className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                />
              </div>

              {/* DESCRIPTION */}

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Full Description
                  <span className="text-red-500">
                    {" "}
                    *
                  </span>
                </label>

                <textarea
                  id="description"
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  rows={7}
                  placeholder="Explain the course, outcomes, curriculum and what students can expect."
                  disabled={
                    creating ||
                    uploading
                  }
                  className="w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                />
              </div>

              {/* CATEGORY + LEVEL */}

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="category"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Category
                    <span className="text-red-500">
                      {" "}
                      *
                    </span>
                  </label>

                  <input
                    id="category"
                    name="category"
                    value={
                      form.category
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="e.g. Digital Marketing"
                    disabled={
                      creating ||
                      uploading
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label
                    htmlFor="level"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Level
                  </label>

                  <select
                    id="level"
                    name="level"
                    value={
                      form.level
                    }
                    onChange={
                      handleChange
                    }
                    disabled={
                      creating ||
                      uploading
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                  >
                    <option value="">
                      Select level
                    </option>

                    <option value="beginner">
                      Beginner
                    </option>

                    <option value="intermediate">
                      Intermediate
                    </option>

                    <option value="advanced">
                      Advanced
                    </option>

                    <option value="all-levels">
                      All Levels
                    </option>
                  </select>
                </div>
              </div>

              {/* DURATION */}

              <div>
                <label
                  htmlFor="duration"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Duration
                  <span className="text-red-500">
                    {" "}
                    *
                  </span>
                </label>

                <input
                  id="duration"
                  name="duration"
                  value={
                    form.duration
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. 8 Weeks / 40 Hours"
                  disabled={
                    creating ||
                    uploading
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                />
              </div>
            </div>
          </section>

          {/* ==================================================
             PRICING
             ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Pricing
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Set the price students will
                see for this course.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label
                  htmlFor="price"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Original Price
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    ₹
                  </span>

                  <input
                    id="price"
                    name="price"
                    type="number"
                    min="0"
                    step="1"
                    value={
                      form.price
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="0"
                    disabled={
                      creating ||
                      uploading
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="discountPrice"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Discount Price
                </label>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
                    ₹
                  </span>

                  <input
                    id="discountPrice"
                    name="discountPrice"
                    type="number"
                    min="0"
                    step="1"
                    value={
                      form.discountPrice
                    }
                    onChange={
                      handleChange
                    }
                    placeholder="0"
                    disabled={
                      creating ||
                      uploading
                    }
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:ring-2 focus:ring-slate-950/10 disabled:bg-slate-50"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ==================================================
             THUMBNAIL
             ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-950">
                Course Thumbnail
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Upload the image that will
                represent this course.
                Maximum 5MB.
              </p>
            </div>

            {thumbnailPreview ? (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                <img
                  src={
                    thumbnailPreview
                  }
                  alt="Course thumbnail preview"
                  className="aspect-video w-full object-cover"
                />

                <button
                  type="button"
                  onClick={
                    removeThumbnail
                  }
                  disabled={
                    creating ||
                    uploading
                  }
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Remove thumbnail"
                >
                  <X
                    size={18}
                  />
                </button>

                <div className="border-t border-slate-200 bg-white px-4 py-3">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {thumbnail.name}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {(
                      thumbnail.size /
                      (1024 * 1024)
                    ).toFixed(2)}{" "}
                    MB
                  </p>
                </div>
              </div>
            ) : (
              <label
                htmlFor="thumbnail"
                className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center transition hover:border-slate-400 hover:bg-slate-100"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
                  <ImageIcon
                    size={25}
                  />
                </div>

                <p className="text-sm font-semibold text-slate-800">
                  Upload course thumbnail
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  PNG, JPG, WEBP up to 5MB
                </p>

                <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-medium text-white">
                  <Upload
                    size={16}
                  />

                  Choose Image
                </span>

                <input
                  id="thumbnail"
                  type="file"
                  accept="image/*"
                  onChange={
                    handleThumbnailChange
                  }
                  disabled={
                    creating ||
                    uploading
                  }
                  className="hidden"
                />
              </label>
            )}
          </section>

          {/* ==================================================
             WHAT HAPPENS NEXT
             ================================================== */}

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
            <h3 className="font-semibold text-slate-950">
              What happens after creation?
            </h3>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">
                  1. Course created
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your course starts as a
                  draft.
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">
                  2. Add content
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Add modules, lessons,
                  videos and resources.
                </p>
              </div>

              <div className="rounded-xl bg-white p-4">
                <div className="text-sm font-semibold text-slate-950">
                  3. Publish your course
                </div>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Admin reviews the course
                  before it becomes public.
                </p>
              </div>
            </div>
          </section>

          {/* ==================================================
             SUBMIT
             ================================================== */}

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:backdrop-blur-none">
            {(creating ||
              uploading) && (
              <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-medium text-slate-700">
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                    {uploading
                      ? "Uploading thumbnail..."
                      : "Creating course..."}
                  </div>

                  {uploading && (
                    <span className="font-semibold text-slate-950">
                      {
                        uploadProgress
                      }
                      %
                    </span>
                  )}
                </div>

                {uploading && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-slate-950 transition-all"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={
                  handleBack
                }
                disabled={
                  creating ||
                  uploading
                }
                className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  creating ||
                  uploading
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating ||
                uploading ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />

                    {uploading
                      ? "Uploading..."
                      : "Creating..."}
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={17}
                    />

                    Create Course
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}