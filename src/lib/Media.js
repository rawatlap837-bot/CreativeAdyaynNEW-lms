import { supabase } from "./supabase";
import { auth } from "./auth";
import { ref, uploadBytes, getDownloadURL } from "./storage";

export function validateImage(file) {
  if (!file) return "Choose an image first.";
  if (!["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type)) return "Use JPG, PNG, WebP or AVIF.";
  if (file.size > 5 * 1024 * 1024) return "Image must be under 5 MB.";
  return null;
}
export async function uploadImage(file, { folder = "courses", onProgress, signal } = {}) {
  if (!auth.currentUser) throw new Error("Sign in to upload an image.");
  const invalid = validateImage(file);
  if (invalid) throw new Error(invalid);
  if (signal?.aborted) throw new Error("Upload cancelled.");
  const extension = file.type.split("/")[1];
  const path = `lms-public/${auth.currentUser.uid}/${folder}/${crypto.randomUUID()}.${extension}`;
  const reference = ref(null, path);
  onProgress?.(0);
  await uploadBytes(reference, file);
  onProgress?.(100);
  return { url: await getDownloadURL(reference), publicId: path, bytes: file.size };
}
export function imageUrl(path) {
  if (!path) return "";
  if (/^https?:/.test(path)) return path;
  const reference = ref(null, path);
  return supabase.storage.from(reference.bucket).getPublicUrl(reference.fullPath).data.publicUrl;
}
export const COURSE_COVER = {};
export const COURSE_THUMB = {};
export const AVATAR = {};
export const blurUrl = imageUrl;

export async function uploadAssignmentResource(file, { folder, onProgress } = {}) {
  if (!auth.currentUser) throw new Error("Sign in to upload a resource.");
  if (!file || file.size > 50 * 1024 * 1024) throw new Error("Choose a file smaller than 50 MB.");
  const courseId = /^lms\/assignments\/([^/]+)\/resources$/.exec(folder || "")?.[1];
  if (!courseId) throw new Error("Course is required for an assignment resource.");
  const path = `course-resources/${courseId}/${auth.currentUser.uid}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const reference = ref(null, path);
  onProgress?.(0);
  await uploadBytes(reference, file);
  onProgress?.(100);
  return { url: await getDownloadURL(reference), path, name: file.name, size: file.size, type: file.type };
}
