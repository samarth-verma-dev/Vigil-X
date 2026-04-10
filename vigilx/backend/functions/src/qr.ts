/**
 * QR Code Generation for Vigil-X.
 *
 * generateQR — callable, produces HMAC-SHA256 signed QR payloads valid for 60 s.
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as crypto from "crypto";

const REGION = "asia-south1";
const QR_SECRET = process.env.QR_SECRET || "sau-vigil-dev-secret-key-2026";
const QR_VALIDITY_MS = 60_000; // 60 seconds

export const generateQR = onCall(
  { region: REGION, cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Must be signed in.");
    }

    const uid = request.auth.uid;
    const ts = Date.now();

    // HMAC-SHA256 signature over "uid:ts"
    const sig = crypto
      .createHmac("sha256", QR_SECRET)
      .update(`${uid}:${ts}`)
      .digest("hex");

    const payload = { uid, ts, sig };

    return {
      qrData: JSON.stringify(payload),
      expiresAt: ts + QR_VALIDITY_MS,
    };
  }
);
