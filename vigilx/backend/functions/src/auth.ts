/**
 * Authentication Cloud Functions for Vigil-X.
 *
 * initializeUser  — callable, creates Firestore profile + custom claims after sign-up
 * setUserRole     — callable (admin-only), updates role & claims
 * bindDevice      — callable, links device ID to user
 * updateFCMToken  — callable, stores FCM push token
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, auth } from "./index";

const REGION = "asia-south1";
const VALID_ROLES = ["student", "worker", "faculty", "visitor", "guard", "admin"];

// ── initializeUser ───────────────────────────────────────────────
export const initializeUser = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const uid = request.auth.uid;

    // Idempotent — bail if already initialised
    const existingDoc = await db.collection("users").doc(uid).get();
    if (existingDoc.exists) {
      const data = existingDoc.data();
      return { success: true, role: data?.role ?? "student" };
    }

    // Determine default role from auth provider
    const userRecord = await auth.getUser(uid);
    const providers = userRecord.providerData.map((p) => p.providerId);

    let defaultRole = "student";
    if (providers.includes("phone")) {
      defaultRole = "worker";
    }
    // Google and all others → "student"

    // Set custom claims
    await auth.setCustomUserClaims(uid, { role: defaultRole });

    // Create user profile
    await db.collection("users").doc(uid).set({
      uid,
      name: userRecord.displayName || "",
      email: userRecord.email || "",
      phone: userRecord.phoneNumber || "",
      role: defaultRole,
      status: "active",
      permissions: { gates: ["main-gate"] },
      deviceId: "",
      fcmToken: "",
      photoURL: userRecord.photoURL || "",
      createdAt: new Date(),
    });

    // Create auth_state
    await db.collection("auth_state").doc(uid).set({
      deviceVerified: false,
      faceVerified: false,
      lastVerifiedAt: null,
    });

    return { success: true, role: defaultRole };
  }
);

// ── setUserRole (admin-only) ─────────────────────────────────────
export const setUserRole = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    // Only admins may change roles
    if (request.auth.token.role !== "admin") {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const { targetUid, role, subtype, gates } = request.data as {
      targetUid: string;
      role: string;
      subtype?: string;
      gates?: string[];
    };

    if (!targetUid || !role) {
      throw new HttpsError("invalid-argument", "targetUid and role are required.");
    }

    if (!VALID_ROLES.includes(role)) {
      throw new HttpsError(
        "invalid-argument",
        `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`
      );
    }

    // Update Auth custom claims
    await auth.setCustomUserClaims(targetUid, { role });

    // Update Firestore doc
    const updates: Record<string, any> = { role, updatedAt: new Date() };
    if (subtype !== undefined) updates.subtype = subtype;
    if (gates !== undefined) updates["permissions.gates"] = gates;

    await db.collection("users").doc(targetUid).update(updates);

    return { success: true, role };
  }
);

// ── bindDevice ───────────────────────────────────────────────────
export const bindDevice = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { deviceId } = request.data as { deviceId: string };
    if (!deviceId) {
      throw new HttpsError("invalid-argument", "deviceId is required.");
    }

    const uid = request.auth.uid;

    await db.collection("users").doc(uid).update({ deviceId, updatedAt: new Date() });
    await db.collection("auth_state").doc(uid).update({ deviceVerified: true });

    return { success: true };
  }
);

// ── updateFCMToken ───────────────────────────────────────────────
export const updateFCMToken = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const { fcmToken } = request.data as { fcmToken: string };
    if (!fcmToken) {
      throw new HttpsError("invalid-argument", "fcmToken is required.");
    }

    await db.collection("users").doc(request.auth.uid).update({
      fcmToken,
      updatedAt: new Date(),
    });

    return { success: true };
  }
);
