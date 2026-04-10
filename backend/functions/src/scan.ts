/**
 * SAU-Vigil: QR Scan Endpoint
 * 
 * This is the MOST CRITICAL function in the system.
 * 
 * Flow:
 * 1. Guard app scans QR → sends {qrData, gateId, guardId, deviceId}
 * 2. Function verifies QR signature + expiry (no DB read)
 * 3. Fetches users/{uid} doc (1 read)
 * 4. Fetches gates/{gateId} doc (1 read) — TOTAL: 2 reads max
 * 5. Runs permission checks (device match, status, gate permission, curfew)
 * 6. Returns ALLOW / DENY / PENDING
 * 7. Writes access log (1 write)
 * 
 * Target: < 2 seconds end-to-end
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { validateScanRequest } from "./middleware/validate";
import { getFaceEmbedding, verifyFaceEmbedding } from "./face";
import { QRPayload, User, Gate, AccessDecision, ScanRequest, ScanResponse } from "./types";

// QR expiry time: 60 seconds
const QR_EXPIRY_MS = 60 * 1000;

// HMAC secret — in production, use Firebase Secrets Manager
// For local dev, this constant is fine
const QR_SECRET = process.env.QR_SECRET || "sau-vigil-dev-secret-key-2026";

// ─── QR Verification ────────────────────────────────────────

/**
 * Verify QR code signature using HMAC-SHA256
 * Returns the parsed payload if valid, null if tampered
 */
function verifyQRSignature(qrData: string): QRPayload | null {
  try {
    const payload: QRPayload = JSON.parse(qrData);
    const { uid, ts, sig } = payload;

    if (!uid || !ts || !sig) return null;

    // Recreate the expected signature
    const crypto = require("crypto");
    const expectedSig = crypto
      .createHmac("sha256", QR_SECRET)
      .update(`${uid}:${ts}`)
      .digest("hex");

    // Constant-time comparison to prevent timing attacks
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Check if QR code has expired (older than 60 seconds)
 */
function isQRExpired(ts: number): boolean {
  return Date.now() - ts > QR_EXPIRY_MS;
}

// ─── Curfew Check ───────────────────────────────────────────

/**
 * Check if current time falls within curfew hours
 * Curfew: e.g., start="22:00", end="06:00" means 10 PM to 6 AM
 */
function isDuringCurfew(curfew?: { start: string; end: string }): boolean {
  if (!curfew) return false;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const currentMinutes = hours * 60 + minutes;

  const [startH, startM] = curfew.start.split(":").map(Number);
  const [endH, endM] = curfew.end.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight curfew (e.g., 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// ─── Access Decision Logic ──────────────────────────────────

interface AccessCheckResult {
  decision: AccessDecision;
  flags: string[];
  message: string;
  autoAllow?: boolean;  // NEW: for main gate student auto-allow
}

function checkAccess(
  user: User,
  gate: Gate,
  scannedDeviceId: string,
  faceVerified: boolean
): AccessCheckResult {
  const flags: string[] = [];

  // Check 1: User status
  if (user.status !== "active") {
    return {
      decision: "DENY",
      flags: ["USER_INACTIVE"],
      message: `Access denied: account is ${user.status}`,
    };
  }

  // Check 2: Face embedding verification (if available)
  if (!faceVerified && user.faceEmbedding) {
    flags.push("FACE_MISMATCH");
    return {
      decision: "DENY",
      flags,
      message: "Access denied: face verification failed — possible QR sharing",
    };
  }

  // Check 3: Device match (secondary check)
  if (user.deviceId && user.deviceId !== scannedDeviceId) {
    flags.push("DEVICE_MISMATCH");
    return {
      decision: "DENY",
      flags,
      message: "Access denied: device mismatch — possible QR sharing",
    };
  }

  // Check 4: Worker gate permissions
  if (user.role === "worker") {
    const workerGates: string[] = user.permissions?.gates || [];
    if (!workerGates.includes(gate.gateId)) {
      flags.push("UNAUTHORIZED_GATE");
      return {
        decision: "DENY",
        flags,
        message: `Access denied: ${user.workerType || "worker"} not authorized for ${gate.name}`,
      };
    }
  }

  // Check 5: Gate permission (for non-workers)
  if (user.role !== "worker") {
    const userGates: string[] = user.permissions?.gates || [];
    if (!userGates.includes(gate.gateId) && !userGates.includes("*")) {
      flags.push("NO_GATE_PERMISSION");
      return {
        decision: "DENY",
        flags,
        message: `Access denied: no permission for gate ${gate.name}`,
      };
    }
  }

  // Check 6: Curfew
  if (isDuringCurfew(gate.rules?.curfew)) {
    flags.push("CURFEW_ACTIVE");
    // During curfew, always require manual approval
    return {
      decision: "PENDING",
      flags,
      message: "Curfew active — guard approval required",
    };
  }

  // Check 7: Gate-specific logic (NEW)
  // Main gate + student = auto ALLOW
  if (gate.gateId === "main-gate" && user.role === "student") {
    return {
      decision: "ALLOW",
      flags,
      message: "Access granted",
      autoAllow: true,
    };
  }

  // Main gate + non-student = PENDING
  if (gate.gateId === "main-gate" && user.role !== "student") {
    return {
      decision: "PENDING",
      flags,
      message: "Awaiting guard approval",
    };
  }

  // Check 8: Gate type determines decision (hostel gates)
  if (gate.rules?.requiresManualApproval) {
    // Hostel gates → PENDING (guard decides)
    return {
      decision: "PENDING",
      flags,
      message: "Awaiting guard approval",
    };
  }

  // Default: ALLOW
  return {
    decision: "ALLOW",
    flags,
    message: "Access granted",
  };
}

// ─── HTTP Endpoint ──────────────────────────────────────────

export const scanQR = onRequest(
  {
    cors: true,
    // 2nd gen options for cold start optimization
    minInstances: 0, // Set to 1 in production for warm instances
    concurrency: 80,
    memory: "256MiB",
    timeoutSeconds: 30,
    region: "asia-south1", // Mumbai — closest to Indian campus
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Validate request body
    const errors = validateScanRequest(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    const { qrData, gateId, guardId, deviceId } = req.body;

    try {
      // Step 1: Verify QR signature (no DB read)
      const qrPayload = verifyQRSignature(qrData);
      if (!qrPayload) {
        res.status(400).json({
          decision: "DENY",
          flags: ["INVALID_QR"],
          message: "Invalid or tampered QR code",
          user: null,
          logId: null,
        });
        return;
      }

      // Step 2: Check QR expiry (no DB read)
      if (isQRExpired(qrPayload.ts)) {
        res.status(400).json({
          decision: "DENY",
          flags: ["QR_EXPIRED"],
          message: "QR code has expired — ask user to refresh",
          user: null,
          logId: null,
        });
        return;
      }

      const db = admin.firestore();

      // Step 3: Fetch user + gate + face_embeddings in parallel (3 reads total)
      const [userSnap, gateSnap, faceEmbeddingData] = await Promise.all([
        db.collection("users").doc(qrPayload.uid).get(),
        db.collection("gates").doc(gateId).get(),
        getFaceEmbedding(qrPayload.uid),
      ]);

      if (!userSnap.exists) {
        res.status(404).json({
          decision: "DENY",
          flags: ["USER_NOT_FOUND"],
          message: "User not found in system",
          user: null,
          logId: null,
        });
        return;
      }

      if (!gateSnap.exists) {
        res.status(404).json({
          decision: "DENY",
          flags: ["GATE_NOT_FOUND"],
          message: "Gate not found in system",
          user: null,
          logId: null,
        });
        return;
      }

      const userData = userSnap.data() as User;
      const gateData = gateSnap.data() as Gate;

      // Step 4: Verify face embedding (if available)
      let faceVerified = false;
      if (faceEmbeddingData) {
        const verification = verifyFaceEmbedding(
          faceEmbeddingData.embedding,
          deviceId,
          faceEmbeddingData.deviceId
        );
        faceVerified = verification.match;
      } else if (userData.faceEmbedding) {
        // User should have face embedding but it's missing
        faceVerified = false;
      } else {
        // User hasn't registered face embedding yet - allow for now
        faceVerified = true;
      }

      // Step 5: Run access checks
      const result = checkAccess(userData, gateData, deviceId, faceVerified);

      // Step 6: Prepare user data based on gate type and role
      let userResponse: any;

      if (gateData.gateId === "main-gate" && userData.role === "student") {
        // Main gate + student: minimal info only
        userResponse = {
          name: userData.name,
          photoURL: userData.photoURL || null,
        };
      } else {
        // All other cases: full details
        userResponse = {
          name: userData.name,
          role: userData.role,
          photoURL: userData.photoURL || null,
          email: userData.email || null,
          phone: userData.phone || null,
          department: userData.department || null,
          roomNumber: userData.roomNumber || null,
          workerType: userData.workerType || null,
          status: userData.status,
          permissions: userData.permissions || null,
        };
      }

      // Step 7: Write access log
      const logRef = db.collection("logs").doc();
      const logEntry = {
        logId: logRef.id,
        userId: qrPayload.uid,
        userName: userData.name || "Unknown",
        userRole: userData.role || "unknown",
        gateId: gateId,
        gateName: gateData.name || gateId,
        timestamp: new Date(),
        systemDecision: result.decision,
        guardDecision: null,
        flags: result.flags,
        deviceId: deviceId,
        faceVerified: faceVerified,
      };

      // If PENDING, also create a pending_scans doc for real-time guard app
      if (result.decision === "PENDING") {
        const batch = db.batch();
        batch.set(logRef, logEntry);
        batch.set(db.collection("pending_scans").doc(logRef.id), {
          ...logEntry,
          guardId: guardId,
          expiresAt: new Date(Date.now() + 30 * 1000), // 30s timeout
        });
        await batch.commit();
      } else {
        await logRef.set(logEntry);
      }

      // Step 8: Return response
      res.status(200).json({
        decision: result.decision,
        user: userResponse,
        flags: result.flags,
        logId: logRef.id,
        message: result.message,
        autoAllow: result.autoAllow || false,
      });
    } catch (error) {
      console.error("Scan error:", error);
      res.status(500).json({
        decision: "DENY",
        flags: ["SYSTEM_ERROR"],
        message: "Internal server error",
        user: null,
        logId: null,
      });
    }
  }
);
