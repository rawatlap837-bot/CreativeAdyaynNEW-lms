import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytesResumable,
} from "firebase/storage";

import { auth, storage } from "../firebase/Firebase";

/* --------------------------------------------------
   AUTH
-------------------------------------------------- */

function requireUser() {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("You must be logged in.");
  }

  return user;
}

/* --------------------------------------------------
   FILE VALIDATION
-------------------------------------------------- */

function validateFile(file, allowedTypes = [], maxSizeMB = 100) {
  if (!file) {
    throw new Error("Please select a file.");
  }

  if (
    allowedTypes.length > 0 &&
    !allowedTypes.includes(file.type)
  ) {
    throw new Error(
      `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`
    );
  }

  const maxBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxBytes) {
    throw new Error(
      `File is too large. Maximum size is ${maxSizeMB} MB.`
    );
  }
}

/* --------------------------------------------------
   FILE NAME
-------------------------------------------------- */

function createFileName(file) {
  const extension = file.name.includes(".")
    ? file.name.substring(file.name.lastIndexOf("."))
    : "";

  const randomId = `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 10)}`;

  return `${randomId}${extension}`;
}

/* --------------------------------------------------
   RESUMABLE UPLOAD
-------------------------------------------------- */

function uploadFile(
  file,
  path,
  allowedTypes = [],
  maxSizeMB = 100,
  onProgress
) {
  return new Promise((resolve, reject) => {
    try {
      const user = requireUser();

      validateFile(file, allowedTypes, maxSizeMB);

      const fileName = createFileName(file);

      const storagePath = `${path}/${user.uid}/${fileName}`;

      const storageRef = ref(storage, storagePath);

      const uploadTask = uploadBytesResumable(
        storageRef,
        file,
        {
          contentType: file.type,
        }
      );

      uploadTask.on(
        "state_changed",

        /* ------------------------------------------
           PROGRESS
        ------------------------------------------ */

        (snapshot) => {
          const progress =
            snapshot.totalBytes > 0
              ? Math.round(
                  (snapshot.bytesTransferred /
                    snapshot.totalBytes) *
                    100
                )
              : 0;

          if (typeof onProgress === "function") {
            onProgress(progress);
          }
        },

        /* ------------------------------------------
           ERROR
        ------------------------------------------ */

        (error) => {
          console.error("Firebase Storage upload error:", error);

          switch (error.code) {
            case "storage/unauthorized":
              reject(
                new Error(
                  "You do not have permission to upload this file."
                )
              );
              break;

            case "storage/canceled":
              reject(
                new Error("The upload was cancelled.")
              );
              break;

            case "storage/quota-exceeded":
              reject(
                new Error(
                  "Firebase Storage quota has been exceeded."
                )
              );
              break;

            case "storage/invalid-checksum":
              reject(
                new Error(
                  "The upload failed because the file checksum was invalid."
                )
              );
              break;

            default:
              reject(
                new Error(
                  error.message || "File upload failed."
                )
              );
          }
        },

        /* ------------------------------------------
           COMPLETE
        ------------------------------------------ */

        async () => {
          try {
            const downloadURL =
              await getDownloadURL(uploadTask.snapshot.ref);

            if (typeof onProgress === "function") {
              onProgress(100);
            }

            resolve({
              url: downloadURL,
              path: storagePath,
              name: file.name,
              size: file.size,
              type: file.type,
            });
          } catch (error) {
            console.error(
              "Failed to get download URL:",
              error
            );

            reject(
              new Error(
                "Upload completed, but the file URL could not be created."
              )
            );
          }
        }
      );
    } catch (error) {
      reject(error);
    }
  });
}

/* --------------------------------------------------
   LESSON VIDEO
-------------------------------------------------- */

export async function uploadLessonVideo(
  file,
  courseId,
  moduleId,
  lessonId,
  onProgress
) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  if (!lessonId) {
    throw new Error("Lesson ID is required.");
  }

  return uploadFile(
    file,
    `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/video`,
    [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-matroska",
    ],
    2048,
    onProgress
  );
}

/* --------------------------------------------------
   LESSON THUMBNAIL
-------------------------------------------------- */

export async function uploadLessonThumbnail(
  file,
  courseId,
  moduleId,
  lessonId,
  onProgress
) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  if (!lessonId) {
    throw new Error("Lesson ID is required.");
  }

  return uploadFile(
    file,
    `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/thumbnail`,
    [
      "image/jpeg",
      "image/png",
      "image/webp",
    ],
    10,
    onProgress
  );
}

/* --------------------------------------------------
   LESSON RESOURCE
-------------------------------------------------- */

export async function uploadLessonResource(
  file,
  courseId,
  moduleId,
  lessonId,
  onProgress
) {
  if (!courseId) {
    throw new Error("Course ID is required.");
  }

  if (!moduleId) {
    throw new Error("Module ID is required.");
  }

  if (!lessonId) {
    throw new Error("Lesson ID is required.");
  }

  return uploadFile(
    file,
    `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/resources`,
    [
      "application/pdf",
      "application/zip",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
    ],
    100,
    onProgress
  );
}

/* --------------------------------------------------
   DELETE STORAGE FILE
-------------------------------------------------- */

export async function deleteStorageFile(storagePath) {
  requireUser();

  if (!storagePath) {
    return;
  }

  const fileRef = ref(storage, storagePath);

  try {
    await deleteObject(fileRef);
  } catch (error) {
    if (error.code === "storage/object-not-found") {
      return;
    }

    console.error(
      "Firebase Storage delete error:",
      error
    );

    throw new Error(
      error.message || "Failed to delete file."
    );
  }
}