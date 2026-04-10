/**
 * SAU-Vigil: Guard Decision Endpoint
 * 
 * For hostel gates: when scan returns PENDING, the guard must
 * approve or deny. This endpoint handles that decision.
 * 
 * Flow:
 * 1. Guard taps ALLOW or DENY on their app
 * 2. This function updates the log entry with guardDecision
 * 3. Removes from pending_scans collection
 * 4. Guard app gets instant feedback
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { validateGuardDecision } from "./middleware/validate";

const REGION = "asia-south1";

// ─── Guard Decision HTTP Endpoint ───────────────────────────

export const guardDecision = onRequest(
  {
    cors: true,
    region: REGION,
    memory: "256MiB",
    concurrency: 40,
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const errors = validateGuardDecision(req.body);
    if (errors.length > 0) {
      res.status(400).json({ error: "Validation failed", details: errors });
      return;
    }

    const { logId, decision, guardId } = req.body;

    try {
      const db = admin.firestore();

      // Update the access log with guard's decision
      const logRef = db.collection("logs").doc(logId);
      const logSnap = await logRef.get();

      if (!logSnap.exists) {
        res.status(404).json({ error: "Log entry not found" });
        return;
      }

      const logData = logSnap.data()!;

      // Prevent double-decision
      if (logData.guardDecision) {
        res.status(409).json({
          error: "Decision already made",
          existingDecision: logData.guardDecision,
        });
        return;
      }

      // Update log and remove from pending
      const batch = db.batch();
      batch.update(logRef, {
        guardDecision: decision,
        guardId: guardId,
        decidedAt: new Date(),
      });

      // Remove from pending_scans
      batch.delete(db.collection("pending_scans").doc(logId));

      await batch.commit();

      res.status(200).json({
        success: true,
        logId,
        decision,
        message: `Guard ${decision === "ALLOW" ? "approved" : "denied"} access`,
      });
    } catch (error) {
      console.error("Guard decision error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── Auto-Deny Expired Pending Scans ────────────────────────

/**
 * Scheduled function: runs every minute to auto-deny
 * pending scans that have exceeded the 30-second timeout.
 */
export const autoExpirePendingScans = onSchedule(
  {
    schedule: "every 1 minutes",
    region: REGION,
    memory: "256MiB",
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    // Find expired pending scans
    const expiredSnap = await db
      .collection("pending_scans")
      .where("expiresAt", "<=", now)
      .get();

    if (expiredSnap.empty) return;

    const batch = db.batch();

    for (const doc of expiredSnap.docs) {
      const data = doc.data();

      // Update the log entry with auto-deny
      batch.update(db.collection("logs").doc(doc.id), {
        guardDecision: "DENY",
        flags: admin.firestore.FieldValue.arrayUnion("AUTO_EXPIRED"),
        decidedAt: new Date(),
      });

      // Remove from pending
      batch.delete(doc.ref);
    }

    await batch.commit();
    console.log(`Auto-expired ${expiredSnap.size} pending scans`);
  }
);
