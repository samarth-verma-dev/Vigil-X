/**
 * QR Scan Function for Vigil-X — the most critical path.
 *
 * scanQR — HTTP POST, target < 2 s end-to-end.
 * Verifies QR signature, runs access checks, writes log, returns decision.
 */

import { onRequest } from "firebase-functions/v2/https";
import * as crypto from "crypto";
import cors from "cors";
import { db } from "./index";
import { validateScanRequest } from "./middleware/validate";
import { verifyFaceEmbedding } from "./face";

const REGION = "asia-south1";
const QR_SECRET = process.env.QR_SECRET || "sau-vigil-dev-secret-key-2026";
const QR_VALIDITY_MS = 60_000;
const PENDING_EXPIRY_MS = 30_000;
const corsHandler = cors({ origin: true });

// ── Helpers ──────────────────────────────────────────────────────

/** Constant-time string comparison to prevent timing attacks. */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  const bufA = Buffer.from(a, "utf-8");
  const bufB = Buffer.from(b, "utf-8");
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Check if current time falls within a curfew window. */
function isDuringCurfew(
  curfew: { start: string; end: string } | undefined
): boolean {
  if (!curfew || !curfew.start || !curfew.end) return false;

  const now = new Date();
  const [startH, startM] = curfew.start.split(":").map(Number);
  const [endH, endM] = curfew.end.split(":").map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  // Handle overnight curfew (e.g., 22:00 → 06:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  }

  return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

// ── scanQR ───────────────────────────────────────────────────────
export const scanQR = onRequest(
  { region: REGION, memory: "256MiB", concurrency: 80 },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // ── Validate request ────────────────────────────────────
      const validationErrors = validateScanRequest(req.body);
      if (validationErrors.length > 0) {
        res.status(400).json({ errors: validationErrors });
        return;
      }

      const { qrData, gateId, guardId, deviceId } = req.body;

      try {
        // ── 1. Parse & verify QR ────────────────────────────
        let qrPayload: { uid: string; ts: number; sig: string };
        try {
          qrPayload = JSON.parse(qrData);
        } catch {
          res.status(400).json({
            decision: "DENY",
            flags: ["INVALID_QR"],
            message: "Invalid QR data format",
          });
          return;
        }

        const { uid, ts, sig } = qrPayload;
        if (!uid || !ts || !sig) {
          res.status(400).json({
            decision: "DENY",
            flags: ["INVALID_QR"],
            message: "Incomplete QR payload",
          });
          return;
        }

        // Verify HMAC signature (constant-time)
        const expectedSig = crypto
          .createHmac("sha256", QR_SECRET)
          .update(`${uid}:${ts}`)
          .digest("hex");

        if (!safeCompare(sig, expectedSig)) {
          res.status(403).json({
            decision: "DENY",
            flags: ["INVALID_QR"],
            message: "Invalid QR signature",
          });
          return;
        }

        // Check expiry
        if (Date.now() - ts > QR_VALIDITY_MS) {
          res.status(403).json({
            decision: "DENY",
            flags: ["QR_EXPIRED"],
            message: "QR code has expired",
          });
          return;
        }

        // ── 2. Parallel fetch: user, gate, face embedding ───
        const [userSnap, gateSnap, faceSnap] = await Promise.all([
          db.collection("users").doc(uid).get(),
          db.collection("gates").doc(gateId).get(),
          db.collection("face_embeddings").doc(uid).get(),
        ]);

        if (!userSnap.exists) {
          res.status(404).json({
            decision: "DENY",
            flags: ["USER_NOT_FOUND"],
            message: "User not found",
          });
          return;
        }

        if (!gateSnap.exists) {
          res.status(404).json({
            decision: "DENY",
            flags: ["GATE_NOT_FOUND"],
            message: "Gate not found",
          });
          return;
        }

        const user = userSnap.data()!;
        const gate = gateSnap.data()!;
        const faceData = faceSnap.exists ? faceSnap.data()! : null;

        // ── 3. Access checks ────────────────────────────────
        const flags: string[] = [];
        let decision: "ALLOW" | "DENY" | "PENDING" = "ALLOW";
        let faceVerified = false;

        // User active?
        if (user.status !== "active") {
          flags.push("USER_INACTIVE");
          decision = "DENY";
        }

        // Face verification (if embedding exists)
        if (faceData && decision !== "DENY") {
          const faceResult = verifyFaceEmbedding(
            faceData.embedding,
            deviceId,
            faceData.deviceId
          );
          faceVerified = faceResult.match;
          if (!faceResult.match) {
            flags.push("FACE_MISMATCH");
            decision = "DENY";
          }
        }

        // Device match (if deviceId is set on user)
        if (user.deviceId && decision !== "DENY") {
          if (deviceId !== user.deviceId) {
            flags.push("DEVICE_MISMATCH");
            decision = "DENY";
          }
        }

        // Worker gate permissions
        if (user.role === "worker" && decision !== "DENY") {
          const allowedGates: string[] = user.permissions?.gates || [];
          if (!allowedGates.includes(gateId)) {
            flags.push("NO_GATE_PERMISSION");
            decision = "DENY";
          }
        }

        // General gate permissions
        if (decision !== "DENY") {
          const allowedGates: string[] = user.permissions?.gates || [];
          if (allowedGates.length > 0 && !allowedGates.includes(gateId)) {
            flags.push("UNAUTHORIZED_GATE");
            decision = "DENY";
          }
        }

        // Curfew check
        if (decision !== "DENY") {
          const curfew = gate.rules?.curfew;
          if (isDuringCurfew(curfew)) {
            flags.push("CURFEW_ACTIVE");
            decision = "DENY";
          }
        }

        // ── 4. Gate-specific logic ──────────────────────────
        let autoAllow = false;

        if (decision !== "DENY") {
          const isMainGate = gateId === "main-gate";
          const requiresManualApproval = gate.rules?.requiresManualApproval === true;

          if (isMainGate && user.role === "student") {
            // Main gate + student → auto-ALLOW
            decision = "ALLOW";
            autoAllow = true;
          } else if (isMainGate && user.role !== "student") {
            // Main gate + non-student → PENDING
            decision = "PENDING";
          } else if (requiresManualApproval) {
            // Hostel / restricted gates → PENDING
            decision = "PENDING";
          }
          // else: ALLOW (default)
        }

        // ── 5. Build user response ──────────────────────────
        let userResponse: Record<string, any>;

        if (autoAllow) {
          // Minimal data for auto-allowed students
          userResponse = {
            name: user.name,
            photoURL: user.photoURL || "",
          };
        } else {
          userResponse = {
            name: user.name,
            role: user.role,
            photoURL: user.photoURL || "",
            email: user.email || "",
            phone: user.phone || "",
            department: user.department || "",
            roomNumber: user.roomNumber || "",
            workerType: user.workerType || "",
            status: user.status,
            permissions: user.permissions || {},
          };
        }

        // ── 6. Write access log ─────────────────────────────
        const logId = db.collection("logs").doc().id;

        const logEntry = {
          logId,
          userId: uid,
          userName: user.name || "",
          userRole: user.role || "",
          gateId,
          gateName: gate.name || gateId,
          timestamp: new Date(),
          systemDecision: decision,
          guardDecision: null,
          flags,
          deviceId,
          faceVerified,
          guardId,
          decidedAt: null,
        };

        const writeOps: Promise<any>[] = [
          db.collection("logs").doc(logId).set(logEntry),
        ];

        // ── 7. If PENDING, create pending_scans entry ───────
        if (decision === "PENDING") {
          writeOps.push(
            db.collection("pending_scans").doc(logId).set({
              ...logEntry,
              guardId,
              expiresAt: new Date(Date.now() + PENDING_EXPIRY_MS),
            })
          );
        }

        await Promise.all(writeOps);

        // ── 8. Respond ──────────────────────────────────────
        const message =
          decision === "ALLOW"
            ? "Access granted"
            : decision === "PENDING"
              ? "Waiting for guard approval"
              : `Access denied: ${flags.join(", ")}`;

        res.status(200).json({
          decision,
          user: userResponse,
          flags,
          logId,
          message,
          autoAllow,
        });
      } catch (error: any) {
        console.error("scanQR error:", error);
        res.status(500).json({
          decision: "DENY",
          flags: ["SYSTEM_ERROR"],
          message: "Internal server error",
        });
      }
    });
  }
);
