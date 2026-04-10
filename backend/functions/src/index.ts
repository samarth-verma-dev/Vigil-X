/**
 * SAU-Vigil: Cloud Functions Entry Point
 * 
 * All functions are exported from here.
 * Firebase deploys everything exported from this file.
 * 
 * Architecture note:
 * - We initialize Firebase Admin ONCE at the top level (global scope)
 * - Individual function files import admin but don't re-initialize
 * - This is optimal for cold start: global init runs once per instance
 */

import * as admin from "firebase-admin";

// ─── Initialize Firebase Admin SDK ──────────────────────────
// This runs once per Cloud Functions instance (warm or cold start)
admin.initializeApp();

// Export admin instances for use in other modules
export const db = admin.firestore();
export const auth = admin.auth();
export const messaging = admin.messaging();

// ─── Export All Functions ────────────────────────────────────

// QR Scan — the core access control endpoint
export { scanQR } from "./scan";

// Authentication — user initialization, role management, device binding
export { initializeUser, setUserRole, bindDevice, updateFCMToken } from "./auth";

// QR Generation — creates signed QR payloads for user app
export { generateQR } from "./qr";

// Guard Decision — approve/deny pending hostel gate scans
export { guardDecision, autoExpirePendingScans } from "./guard";

// Parcel Management — create, collect, push notifications
export { createParcel, collectParcel, onParcelCreated } from "./parcels";

// Visitor Sessions — create, validate, auto-expire
export { createVisitorSession, validateVisitor, expireVisitorSessions } from "./visitors";

// Face Embedding — upload and verify face embeddings for device binding
export { uploadFaceEmbedding } from "./face";

// Seed Data — development only, populates emulator
export { seedDatabase } from "./seed";
<<<<<<< Updated upstream
=======

// Mess System — seed mess menus and wallets
export { seedMessData, addSampleTransactions } from "./seedMess";
>>>>>>> Stashed changes
