// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAnalytics,
  isSupported,
} from "firebase/analytics";

/* ============================================================
   1. FIREBASE CONFIGURATION
   ============================================================ */

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/* ============================================================
   2. VALIDATE REQUIRED CONFIGURATION
   ============================================================ */

const requiredFirebaseConfig = {
  VITE_FIREBASE_API_KEY: firebaseConfig.apiKey,
  VITE_FIREBASE_AUTH_DOMAIN:
    firebaseConfig.authDomain,
  VITE_FIREBASE_PROJECT_ID:
    firebaseConfig.projectId,
  VITE_FIREBASE_STORAGE_BUCKET:
    firebaseConfig.storageBucket,
  VITE_FIREBASE_MESSAGING_SENDER_ID:
    firebaseConfig.messagingSenderId,
  VITE_FIREBASE_APP_ID:
    firebaseConfig.appId,
};

const missingVariables = Object.entries(
  requiredFirebaseConfig
)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVariables.length > 0) {
  throw new Error(
    `Firebase configuration is incomplete.

Missing environment variables:
${missingVariables.join("\n")}

Check your .env.local file.`
  );
}

/* ============================================================
   3. INITIALIZE FIREBASE APP
   ============================================================ */

const app = initializeApp(firebaseConfig);

/* ============================================================
   4. FIREBASE AUTHENTICATION
   ============================================================ */

const auth = getAuth(app);

/* ============================================================
   5. FIRESTORE DATABASE
   ============================================================ */

const db = getFirestore(app);

/* ============================================================
   6. FIREBASE STORAGE
   ============================================================ */

const storage = getStorage(app);

/* ============================================================
   7. FIREBASE ANALYTICS
   ============================================================ */

let analytics = null;

if (firebaseConfig.measurementId) {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch((error) => {
      console.warn(
        "Firebase Analytics could not initialize:",
        error
      );
    });
}

/* ============================================================
   8. EXPORT EVERYTHING
   ============================================================ */

export {
  app,
  auth,
  db,
  storage,
  analytics,
};

export default app;