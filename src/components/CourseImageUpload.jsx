// src/components/CourseImageUpload.jsx
import { useRef, useState, useEffect } from "react";
import { uploadImage, imageUrl, COURSE_COVER, validateImage } from "../lib/Media";

/**
 * Cover image picker for the course form.
 *
 * Controlled component. The parent owns the value and decides when to
 * write it to Supabase database, so an abandoned form leaves no orphan reference.
 *
 * @param {{url: string, publicId: string} | null} value
 * @param {function} onChange  Receives the new value, or null when removed
 * @param {string} folder
 */
export default function CourseImageUpload({ value, onChange, folder = "lms/courses" }) {
    const inputRef = useRef(null);
    const abortRef = useRef(null);

    const [progress, setProgress] = useState(null);
    const [error, setError] = useState("");
    const [dragging, setDragging] = useState(false);

    const busy = progress !== null;

    useEffect(() => () => abortRef.current?.abort(), []);

    async function handleFile(file) {
        setError("");

        const invalid = validateImage(file);
        if (invalid) {
            setError(invalid);
            return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        setProgress(0);

        try {
            const result = await uploadImage(file, {
                folder,
                onProgress: setProgress,
                signal: controller.signal,
            });
            onChange(result);
        } catch (err) {
            if (err.name !== "AbortError") setError(err.message);
        } finally {
            setProgress(null);
            abortRef.current = null;
            if (inputRef.current) inputRef.current.value = "";
        }
    }

    function onDrop(e) {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFile(file);
    }

    // ---------------------------------------------------------------- preview
    if (value?.publicId && !busy) {
        return (
            <div className="space-y-3">
                <div className="relative overflow-hidden rounded-xl border border-slate-200">
                    <img
                        src={imageUrl(value.publicId, COURSE_COVER)}
                        alt="Course cover"
                        className="aspect-video w-full object-cover"
                    />
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => inputRef.current?.click()}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium
                       text-slate-700 transition-colors hover:bg-slate-50
                       focus-visible:outline focus-visible:outline-2
                       focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                    >
                        Replace image
                    </button>
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-red-600
                       transition-colors hover:bg-red-50
                       focus-visible:outline focus-visible:outline-2
                       focus-visible:outline-offset-2 focus-visible:outline-red-600"
                    >
                        Remove
                    </button>
                </div>

                <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
            </div>
        );
    }

    // ---------------------------------------------------------------- dropzone
    return (
        <div className="space-y-3">
            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${dragging ? "border-slate-900 bg-slate-50" : "border-slate-300"
                    }`}
            >
                {busy ? (
                    <div className="space-y-3">
                        <div
                            className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className="h-full rounded-full bg-slate-900 transition-[width] duration-200"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-slate-600">Uploading… {progress}%</p>
                        <button
                            type="button"
                            onClick={() => abortRef.current?.abort()}
                            className="text-sm font-medium text-slate-500 underline underline-offset-2"
                        >
                            Cancel
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-slate-600">
                            Drag a cover image here, or
                        </p>
                        <button
                            type="button"
                            onClick={() => inputRef.current?.click()}
                            className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium
                         text-white transition-colors hover:bg-slate-800
                         focus-visible:outline focus-visible:outline-2
                         focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                        >
                            Choose a file
                        </button>
                        <p className="mt-3 text-xs text-slate-500">
                            JPG, PNG or WebP up to 5 MB. 16:9 works best.
                        </p>
                    </>
                )}
            </div>

            {error && (
                <p className="text-sm text-red-600" role="alert">
                    {error}
                </p>
            )}

            <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
        </div>
    );
}