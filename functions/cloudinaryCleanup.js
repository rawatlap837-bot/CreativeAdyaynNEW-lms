// functions/cloudinaryCleanup.js
//
// Deletion needs the API secret, so it cannot happen in the browser.
// These run with the Admin SDK and bypass Firestore rules.
//
// Install:   cd functions && npm i cloudinary firebase-functions firebase-admin
// Secrets:   firebase functions:secrets:set CLOUDINARY_API_KEY
//            firebase functions:secrets:set CLOUDINARY_API_SECRET
// Deploy:    firebase deploy --only functions

const { onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { v2: cloudinary } = require("cloudinary");
const logger = require("firebase-functions/logger");

const CLOUD_NAME = "s0rwavfd";
const API_KEY = defineSecret("CLOUDINARY_API_KEY");
const API_SECRET = defineSecret("CLOUDINARY_API_SECRET");

function configure() {
  cloudinary.config({
    cloud_name: CLOUD_NAME,
    api_key: API_KEY.value(),
    api_secret: API_SECRET.value(),
    secure: true,
  });
}

async function destroy(publicId) {
  if (!publicId) return;
  try {
    const res = await cloudinary.uploader.destroy(publicId, { invalidate: true });
    logger.info("Cloudinary destroy", { publicId, result: res.result });
  } catch (err) {
    // Swallow the error. A leftover asset is cheap; a retry storm is not.
    logger.error("Cloudinary destroy failed", { publicId, error: err.message });
  }
}

/** Course deleted → remove its cover image. */
exports.onCourseDeleted = onDocumentDeleted(
  { document: "courses/{courseId}", secrets: [API_KEY, API_SECRET] },
  async (event) => {
    configure();
    await destroy(event.data?.data()?.thumbnailPath);
  }
);

/** Cover image replaced → remove the old asset. */
exports.onCourseImageReplaced = onDocumentUpdated(
  { document: "courses/{courseId}", secrets: [API_KEY, API_SECRET] },
  async (event) => {
    const before = event.data?.before.data()?.thumbnailPath;
    const after = event.data?.after.data()?.thumbnailPath;

    if (!before || before === after) return;

    configure();
    await destroy(before);
  }
);