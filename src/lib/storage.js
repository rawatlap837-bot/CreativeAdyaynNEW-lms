import { supabase } from "./supabase";

export function ref(_storage, path) {
  const prefixed = /^(lms-public|lms-media)\//.exec(path);
  const bucket = prefixed?.[1] || (path.startsWith("avatars/") ? "lms-public" : "lms-media");
  return { bucket, fullPath: prefixed ? path.slice(prefixed[0].length) : path };
}
export async function uploadBytes(reference, file, options = {}) {
  const { error } = await supabase.storage.from(reference.bucket).upload(reference.fullPath, file, {
    contentType: options.contentType || file.type, upsert: true,
  });
  if (error) throw error;
  return { ref: reference };
}
export function uploadBytesResumable(reference, file, options) {
  const task = { snapshot: { ref: reference, bytesTransferred: 0, totalBytes: file.size } };
  task.on = (_event, progress, failure, complete) => {
    progress?.(task.snapshot);
    uploadBytes(reference, file, options).then(() => {
      task.snapshot.bytesTransferred = file.size;
      progress?.(task.snapshot);
      complete?.();
    }).catch(failure);
  };
  return task;
}
export async function getDownloadURL(reference) {
  if (reference.bucket === "lms-public") {
    return supabase.storage.from(reference.bucket).getPublicUrl(reference.fullPath).data.publicUrl;
  }
  const { data, error } = await supabase.storage.from(reference.bucket).createSignedUrl(reference.fullPath, 3600);
  if (error) throw error;
  return data.signedUrl;
}
export async function deleteObject(reference) {
  const { error } = await supabase.storage.from(reference.bucket).remove([reference.fullPath]);
  if (error) throw error;
}
export async function listAll(reference) {
  const items = [], prefixes = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await supabase.storage.from(reference.bucket).list(reference.fullPath, { limit: 100, offset });
    if (error) throw error;
    for (const entry of data) {
      const child = { bucket: reference.bucket, fullPath: `${reference.fullPath}/${entry.name}` };
      (entry.id ? items : prefixes).push(child);
    }
    if (data.length < 100) break;
  }
  return { items, prefixes };
}

// Private URLs expire. Refresh persisted URLs whenever their row is loaded.
// Cache only within the current session; logout must not retain another user's access.
const signedUrls = new Map();
supabase.auth.onAuthStateChange(() => signedUrls.clear());
export async function refreshMediaUrls(value) {
  if (typeof value === "string") {
    const base = `${import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "")}/storage/v1/object/sign/lms-media/`;
    if (!value.startsWith(base)) return value;
    const path = decodeURIComponent(value.slice(base.length).split("?")[0]);
    const cached = signedUrls.get(path);
    if (cached && cached.until > Date.now()) return cached.url;
    const url = await getDownloadURL({ bucket: "lms-media", fullPath: path });
    signedUrls.set(path, { url, until: Date.now() + 45 * 60000 });
    return url;
  }
  if (Array.isArray(value)) return Promise.all(value.map(refreshMediaUrls));
  if (value && typeof value === "object") return Object.fromEntries(await Promise.all(
    Object.entries(value).map(async ([key, item]) => [key, await refreshMediaUrls(item)]),
  ));
  return value;
}
