/**
 * SAU-Vigil: QR Code Generation
 * 
 * Generates HMAC-signed, time-limited QR payloads for users.
 * - User app calls this every 30 seconds to get a fresh QR
 * - QR contains {uid, timestamp, signature}
 * - Signature = HMAC-SHA256(uid:timestamp, secret)
 * - QR expires after 60 seconds
 */

import * as crypto from "crypto";
import { onCall, HttpsError } from "firebase-functions/v2/https";

const REGION = "asia-south1";
const QR_SECRET = process.env.QR_SECRET || "sau-vigil-dev-secret-key-2026";
const QR_VALIDITY_MS = 60 * 1000; // 60 seconds

// ─── Generate QR ────────────────────────────────────────────

/**
 * Callable function: generates a signed QR payload for the authenticated user.
 * 
 * Returns:
 * - qrData: JSON string to encode into QR code
 * - expiresAt: when this QR becomes invalid
 */
export const generateQR = onCall(
  { region: REGION, cors: true },
  async (request) => {
    // Must be authenticated
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be logged in to generate QR");
    }

    const uid = request.auth.uid;
    const ts = Date.now();

    // Create HMAC signature
    const sig = crypto
      .createHmac("sha256", QR_SECRET)
      .update(`${uid}:${ts}`)
      .digest("hex");

    const qrPayload = {
      uid,
      ts,
      sig,
    };

    return {
      qrData: JSON.stringify(qrPayload),
      expiresAt: ts + QR_VALIDITY_MS,
    };
  }
);
