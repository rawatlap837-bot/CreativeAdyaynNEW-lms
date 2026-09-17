const cloudinaryCleanup = require("./cloudinaryCleanup");
exports.onCourseDeleted = cloudinaryCleanup.onCourseDeleted;
exports.onCourseImageReplaced = cloudinaryCleanup.onCourseImageReplaced;

const notifications = require("./notifications");
exports.onUserCreated = notifications.onUserCreated;
exports.onEnrollmentCreated = notifications.onEnrollmentCreated;
exports.onPaymentConfirmed = notifications.onPaymentConfirmed;