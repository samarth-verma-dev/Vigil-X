/**
 * SAU-Vigil: Authentication Functions
 * 
 * - initializeUser: Callable to create user profile after sign-up
 * - setUserRole: Admin callable to assign roles + custom claims
 * - bindDevice: User callable to register their device
 */

import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const REGION = "asia-south1";

// ─── Initialize User (Callable) ─────────────────────────────

/**
 * Client calls this immediately after sign-up to create Firestore profile.
 * Sets custom claims based on auth provider.
 * Call from app: await initializeUser()
 */
export const initializeUser = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const uid = request.auth.uid;
    const db = admin.firestore();

    // Check if already initialized
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      return { success: true, message: "User already initialized" };
    }

    // Get full user record from Auth
    const userRecord = await admin.auth().getUser(uid);
    const provider = userRecord.providerData?.[0]?.providerId || "unknown";
    const defaultRole = provider === "google.com" ? "student" : "worker";

    // Set custom claims
    await admin.auth().setCustomUserClaims(uid, { role: defaultRole });

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

    // Create auth state
    await db.collection("auth_state").doc(uid).set({
      deviceVerified: false,
      faceVerified: false,
      lastVerifiedAt: null,
    });

    return { success: true, role: defaultRole };
  }
);

// ─── Set User Role (Admin Only) ─────────────────────────────

/**
 * Callable function for admin to set a user's role.
 * Updates: custom claims + Firestore user doc + permissions.
 */
export const setUserRole = onCall(
  { region: REGION, cors: true },
  async (request) => {
    // Verify caller is admin
    if (!request.auth || request.auth.token.role !== "admin") {
      throw new HttpsError("permission-denied", "Only admins can set user roles");
    }

    const { targetUid, role, subtype, gates } = request.data;

    if (!targetUid || !role) {
      throw new HttpsError("invalid-argument", "targetUid and role are required");
    }

    const validRoles = ["student", "worker", "faculty", "visitor", "guard", "admin"];
    if (!validRoles.includes(role)) {
      throw new HttpsError("invalid-argument", `Invalid role: ${role}`);
    }

    const db = admin.firestore();

    // Update custom claims
    await admin.auth().setCustomUserClaims(targetUid, { role });

    // Update Firestore doc
    const updateData: Record<string, unknown> = {
      role,
      permissions: {
        gates: gates || ["main-gate"],
      },
    };

    if (subtype) {
      updateData.subtype = subtype;
    }

    await db.collection("users").doc(targetUid).update(updateData);

    return { success: true, message: `Role set to ${role} for user ${targetUid}` };
  }
);

// ─── Bind Device ────────────────────────────────────────────

/**
 * Callable function for users to bind their device ID.
 * This prevents QR code sharing across devices.
 */
export const bindDevice = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { deviceId } = request.data;
    if (!deviceId) {
      throw new HttpsError("invalid-argument", "deviceId is required");
    }

    const db = admin.firestore();
    const uid = request.auth.uid;

    // Update device ID
    await db.collection("users").doc(uid).update({
      deviceId: deviceId,
    });

    // Update auth state
    await db.collection("auth_state").doc(uid).update({
      deviceVerified: true,
      lastVerifiedAt: new Date(),
    });

    return { success: true, message: "Device bound successfully" };
  }
);

// ─── Update FCM Token ──────────────────────────────────────

/**
 * Callable function for users to update their FCM push notification token.
 */
export const updateFCMToken = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in");
    }

    const { fcmToken } = request.data;
    if (!fcmToken) {
      throw new HttpsError("invalid-argument", "fcmToken is required");
    }

    const db = admin.firestore();
    await db.collection("users").doc(request.auth.uid).update({ fcmToken });

    return { success: true };
  }
);
