/**
 * Vigil-X Cloud Functions — Entry Point
 *
 * Single Firebase Admin SDK initialization shared by all function modules.
 * All v2 functions target asia-south1 (Mumbai).
 */

import * as admin from "firebase-admin";

// ── Initialize Admin SDK (once) ──────────────────────────────────
admin.initializeApp();

export const db = admin.firestore();
export const auth = admin.auth();
export const messaging = admin.messaging();

// ── Re-export every function module ──────────────────────────────
export { initializeUser, setUserRole, bindDevice, updateFCMToken } from "./auth";
export { generateQR } from "./qr";
export { scanQR } from "./scan";
export { guardDecision, autoExpirePendingScans } from "./guard";
export { createParcel, collectParcel, onParcelCreated } from "./parcels";
export { createVisitorSession, validateVisitor, expireVisitorSessions } from "./visitors";
export { uploadFaceEmbedding } from "./face";
export { seedDatabase } from "./seed";
