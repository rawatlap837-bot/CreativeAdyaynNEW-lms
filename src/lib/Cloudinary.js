// src/lib/cloudinary.js
//
// Client-side Cloudinary helpers.
//
// Only the cloud name and the unsigned upload preset live here. Both are
// safe to ship to the browser. The API secret must NEVER appear in this
// file or in any VITE_ variable — Vite inlines those into the bundle.

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Validates a File before it leaves the browser.
 * Returns an error string, or null when the file is acceptable.
 */
export function validateImage(file) {
  if (!file) return "Choose an image first.";
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "That file type isn't supported. Use JPG, PNG, WebP or AVIF.";
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `That image is ${mb} MB. The limit is 5 MB.`;
  }
  return null;
}

/**
 * Uploads a File to Cloudinary using an unsigned preset.
 *
 * Uses XMLHttpRequest rather than fetch because fetch gives no upload
 * progress events, and a cover image on a slow connection needs a bar.
 *
 * @param {File} file
 * @param {object} opts
 * @param {string} opts.folder      Cloudinary folder, e.g. "lms/courses"
 * @param {function} opts.onProgress Called with 0-100
 * @param {AbortSignal} opts.signal  Cancels the upload
 * @returns {Promise<{url: string, publicId: string, width: number,
 *                    height: number, format: string, bytes: number}>}
 */
export function uploadImage(file, { folder = "lms/courses", onProgress, signal } = {}) {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    return Promise.reject(
      new Error("Cloudinary isn't configured. Check your .env file.")
    );
  }

  const invalid = validateImage(file);
  if (invalid) return Promise.reject(new Error(invalid));

  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", UPLOAD_PRESET);
  form.append("folder", folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_URL);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let body;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        return reject(new Error("Cloudinary returned an unreadable response."));
      }

      if (xhr.status < 200 || xhr.status >= 300) {
        return reject(new Error(body?.error?.message || "Upload failed."));
      }

      resolve({
        url: body.secure_url,
        publicId: body.public_id,
        width: body.width,
        height: body.height,
        format: body.format,
        bytes: body.bytes,
      });
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    if (signal) {
      if (signal.aborted) return xhr.abort();
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}

/**
 * Builds a transformed delivery URL from a stored publicId.
 *
 * Store the publicId in Firestore, not a pre-transformed URL — that way you
 * can change thumbnail sizes later without rewriting every course document.
 *
 * @param {string} publicId
 * @param {object} opts
 * @param {number} opts.width
 * @param {number} opts.height
 * @param {string} opts.crop     fill | fit | thumb | scale
 * @param {string} opts.gravity  auto | face | center
 */
export function imageUrl(publicId, { width, height, crop = "fill", gravity = "auto" } = {}) {
  if (!publicId) return "";

  const parts = ["f_auto", "q_auto"];
  if (width) parts.push(`w_${width}`);
  if (height) parts.push(`h_${height}`);
  if (width || height) parts.push(`c_${crop}`, `g_${gravity}`);
  parts.push("dpr_auto");

  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${parts.join(",")}/${publicId}`;
}

/** Named sizes, so every course card in the app crops identically. */
export const COURSE_THUMB = { width: 400, height: 225, crop: "fill" };
export const COURSE_COVER = { width: 1280, height: 720, crop: "fill" };
export const AVATAR = { width: 128, height: 128, crop: "thumb", gravity: "face" };

/**
 * Low-quality placeholder for blur-up loading.
 */
export function blurUrl(publicId) {
  if (!publicId) return "";
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_32,e_blur:400,q_30,f_auto/${publicId}`;
}