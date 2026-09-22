import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CourseCategorySelect from "./CourseCategorySelect";
import {
  ArrowLeft,
  Check,
  Image as ImageIcon,
  Loader2,
  Save,
  Upload,
  X,
} from "lucide-react";

import { auth, storage } from "../lib/backend";
import {
  getCourseById,
  updateCourse,
  uploadCourseThumbnail,
} from "../services/CourseService";

export default function EditCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);

  const [form, setForm] = useState({
    title: "",
    shortDescription: "",
    description: "",
    category: "",
    level: "",
    duration: "",
    price: "",
    discountPrice: "",
    type: "short",
  });

  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadCourse();

    return () => {
      if (thumbnailPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, [courseId]);

  async function loadCourse() {
    try {
      setLoading(true);
      setError("");

      const user = auth.currentUser;

      if (!user) {
        navigate("/login", {
          replace: true,
          state: {
            from: `/teacher/courses/edit/${courseId}`,
          },
        });

        return;
      }

      const courseData = await getCourseById(courseId);

      if (!courseData) {
        throw new Error("Course not found.");
      }

      if (courseData.instructorId !== user.uid) {
        throw new Error(
          "You do not have permission to edit this course."
        );
      }

      setCourse(courseData);

      setForm({
        title: courseData.title || "",
        shortDescription: courseData.shortDescription || "",
        description: courseData.description || "",
        category: courseData.category || "",
        level: courseData.level || "",
        duration: courseData.duration || "",
        price:
          courseData.price !== undefined && courseData.price !== null
            ? String(courseData.price)
            : "",
        discountPrice:
          courseData.discountPrice !== undefined &&
          courseData.discountPrice !== null
            ? String(courseData.discountPrice)
            : "",
        type: courseData.type || "short",
      });

      setThumbnailPreview(courseData.thumbnailUrl || "");
    } catch (err) {
      console.error("Course loading error:", err);
      setError(err.message || "Failed to load course.");
    } finally {
      setLoading(false);
    }
  }

  const isLocked =
    
    course?.status === "archived";

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setSuccess("");
  }

  function handleThumbnailChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setSuccess("");

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Thumbnail must be smaller than 5MB.");
      event.target.value = "";
      return;
    }

    if (thumbnailPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }

    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  }

  function removeSelectedThumbnail() {
    if (thumbnailPreview?.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreview);
    }

    setThumbnailPreview(course?.thumbnailUrl || "");
    setThumbnailFile(null);
  }

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
      return "Please select a category.";
    }

    if (!form.level.trim()) {
      return "Please select a course level.";
    }

    if (!form.duration.trim()) {
      return "Course duration is required.";
    }

    if (
      form.price !== "" &&
      (Number.isNaN(Number(form.price)) || Number(form.price) < 0)
    ) {
      return "Please enter a valid course price.";
    }

    if (
      form.discountPrice !== "" &&
      (Number.isNaN(Number(form.discountPrice)) ||
        Number(form.discountPrice) < 0)
    ) {
      return "Please enter a valid discounted price.";
    }

    if (
      form.price !== "" &&
      form.discountPrice !== "" &&
      Number(form.discountPrice) > Number(form.price)
    ) {
      return "Discounted price cannot be greater than the original price.";
    }

    return null;
  }

  async function handleSave(event) {
    event.preventDefault();

    if (isLocked) {
      setError(
        "This course cannot be edited while it is archived."
      );

      return;
    }

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const updatedData = {
        title: form.title.trim(),
        shortDescription: form.shortDescription.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        level: form.level.trim(),
        duration: form.duration.trim(),
        type: form.type,

        price:
          form.price === ""
            ? 0
            : Number(form.price),

        discountPrice:
          form.discountPrice === ""
            ? 0
            : Number(form.discountPrice),
      };

      await updateCourse(courseId, updatedData);

      /*
       * Upload thumbnail after the course update.
       * The service automatically checks teacher ownership.
       */
      if (thumbnailFile) {
        setUploading(true);
        setUploadProgress(0);

        const uploaded = await uploadCourseThumbnail(
          courseId,
          thumbnailFile,
          (progress) => {
            setUploadProgress(progress);
          }
        );

        await updateCourse(courseId, {
          thumbnailUrl: uploaded.url,
          thumbnailPath: uploaded.path,
        });

        setUploading(false);
      }

      setSuccess("Course updated successfully.");

      setThumbnailFile(null);

      await loadCourse();
    } catch (err) {
      console.error("Course update error:", err);

      setUploading(false);
      setError(err.message || "Failed to update course.");
    } finally {
      setSaving(false);
    }
  }

  function goBack() {
    navigate("/teacher/courses");
  }

  function goToContent() {
    navigate(`/teacher/courses/${courseId}/content`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading course...</span>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-semibold text-red-800">
              Unable to load course
            </h2>

            <p className="mt-2 text-sm text-red-700">
              {error || "Course could not be found."}
            </p>

            <button
              onClick={goBack}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to My Courses
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <button
            type="button"
            onClick={goBack}
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Courses
          </button>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-1 text-sm text-slate-500">
                {course.type === "long"
                  ? "Long / Live Course"
                  : "Short Course"}
              </p>

              <h1 className="text-2xl font-bold text-slate-900">
                Edit Course
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Update your course information and manage its content.
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${
                course.status === "published"
                  ? "bg-emerald-100 text-emerald-700"
                  : course.status === "pending"
                  ? "bg-amber-100 text-amber-700"
                  : course.status === "rejected"
                  ? "bg-red-100 text-red-700"
                  : course.status === "archived"
                  ? "bg-slate-200 text-slate-700"
                  : "bg-violet-100 text-violet-700"
              }`}
            >
              {course.status === "pending"
                ? "Pending Approval"
                : course.status?.charAt(0).toUpperCase() +
                  course.status?.slice(1)}
            </span>
          </div>
        </div>

        {/* Locked */}
        {isLocked && (
          <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex gap-3">
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

              <div>
                <p className="font-semibold text-amber-900">
                  Editing is temporarily locked
                </p>

                <p className="mt-1 text-sm text-amber-800">
                  {course.status === "pending"
                    ? "This course is ready for you to publish from Manage Content."
                    : "This course has been archived and cannot be edited."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rejected */}
        {course.status === "rejected" &&
          course.rejectionReason && (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="font-semibold text-red-900">
                Admin feedback
              </p>

              <p className="mt-1 text-sm text-red-800">
                {course.rejectionReason}
              </p>

              <p className="mt-2 text-xs text-red-700">
                Make the required changes and submit the course
                again when ready.
              </p>
            </div>
          )}

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Success */}
        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <Check className="h-5 w-5" />
            {success}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="space-y-6">
            {/* Course Information */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Course Information
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Basic information about your course.
                </p>
              </div>

              <div className="space-y-5">
                {/* Title */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Course Title
                  </label>

                  <input
                    name="title"
                    value={form.title}
                    onChange={handleChange}
                    disabled={isLocked || saving}
                    placeholder="Enter course title"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Course Type
                  </label>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label
                      className={`cursor-pointer rounded-xl border p-4 ${
                        form.type === "short"
                          ? "border-violet-500 bg-violet-50"
                          : "border-slate-200"
                      } ${
                        isLocked
                          ? "cursor-not-allowed opacity-60"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value="short"
                        checked={form.type === "short"}
                        onChange={handleChange}
                        disabled={isLocked || saving}
                        className="sr-only"
                      />

                      <p className="text-sm font-semibold text-slate-900">
                        Short Course
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Self-paced or compact learning experience.
                      </p>
                    </label>

                    <label
                      className={`cursor-pointer rounded-xl border p-4 ${
                        form.type === "long"
                          ? "border-violet-500 bg-violet-50"
                          : "border-slate-200"
                      } ${
                        isLocked
                          ? "cursor-not-allowed opacity-60"
                          : ""
                      }`}
                    >
                      <input
                        type="radio"
                        name="type"
                        value="long"
                        checked={form.type === "long"}
                        onChange={handleChange}
                        disabled={isLocked || saving}
                        className="sr-only"
                      />

                      <p className="text-sm font-semibold text-slate-900">
                        Long / Live Course
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Longer program with live learning or
                        structured sessions.
                      </p>
                    </label>
                  </div>
                </div>

                {/* Short Description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Short Description
                  </label>

                  <textarea
                    name="shortDescription"
                    value={form.shortDescription}
                    onChange={handleChange}
                    disabled={isLocked || saving}
                    rows={3}
                    placeholder="A short description for course cards..."
                    className="w-full resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Full Description
                  </label>

                  <textarea
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    disabled={isLocked || saving}
                    rows={7}
                    placeholder="Describe the course in detail..."
                    className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                  />
                </div>
              </div>
            </section>

            {/* Category / Level / Duration */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Course Classification
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Help students find and understand your course.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Category
                  </label>

                  <CourseCategorySelect
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    disabled={isLocked || saving}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Level
                  </label>

                  <select
                    name="level"
                    value={form.level}
                    onChange={handleChange}
                    disabled={isLocked || saving}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                  >
                    <option value="">Select level</option>
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">
                      Intermediate
                    </option>
                    <option value="Advanced">Advanced</option>
                    <option value="All Levels">All Levels</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Duration
                  </label>

                  <input
                    name="duration"
                    value={form.duration}
                    onChange={handleChange}
                    disabled={isLocked || saving}
                    placeholder="e.g. 8 weeks / 20 hours"
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                  />
                </div>
              </div>
            </section>

            {/* Pricing */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Pricing
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Set the price students will see.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Original Price
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      ₹
                    </span>

                    <input
                      name="price"
                      type="number"
                      min="0"
                      value={form.price}
                      onChange={handleChange}
                      disabled={isLocked || saving}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Discount Price
                  </label>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                      ₹
                    </span>

                    <input
                      name="discountPrice"
                      type="number"
                      min="0"
                      value={form.discountPrice}
                      onChange={handleChange}
                      disabled={isLocked || saving}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-300 py-3 pl-9 pr-4 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-violet-50"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Thumbnail */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-slate-900">
                  Course Thumbnail
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  This image will appear on your course cards and
                  course page.
                </p>
              </div>

              {thumbnailPreview ? (
                <div className="relative overflow-hidden rounded-2xl border border-slate-200">
                  <img
                    src={thumbnailPreview}
                    alt={form.title || "Course thumbnail"}
                    className="aspect-video w-full object-cover"
                  />

                  {thumbnailFile && !saving && (
                    <button
                      type="button"
                      onClick={removeSelectedThumbnail}
                      className="absolute right-3 top-3 rounded-full bg-white/95 p-2 text-slate-700 shadow hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-2xl bg-violet-50">
                  <ImageIcon className="h-10 w-10 text-slate-400" />
                </div>
              )}

              {!isLocked && (
                <div className="mt-4">
                  <input
                    id="course-thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailChange}
                    disabled={saving}
                    className="hidden"
                  />

                  <label
                    htmlFor="course-thumbnail"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Upload className="h-4 w-4" />

                    {thumbnailFile
                      ? "Choose Another Image"
                      : "Upload New Thumbnail"}
                  </label>

                  <p className="mt-2 text-xs text-slate-500">
                    JPG, PNG, WebP • Maximum 5MB
                  </p>
                </div>
              )}

              {uploading && (
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="font-medium text-slate-700">
                      Uploading thumbnail...
                    </span>

                    <span className="font-semibold text-slate-900">
                      {uploadProgress}%
                    </span>
                  </div>

                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-violet-600 transition-all"
                      style={{
                        width: `${uploadProgress}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </section>

            {/* Actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={goToContent}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
              >
                Manage Course Content
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 sm:w-auto"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isLocked || saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {uploading ? "Uploading..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
