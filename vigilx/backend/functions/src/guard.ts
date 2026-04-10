/**
 * Guard Functions for Vigil-X.
 *
 * guardDecision           — HTTP POST, guard approves/denies a pending scan
 * autoExpirePendingScans  — scheduled (every 1 min), auto-denies expired pending scans
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import cors from "cors";
import { db } from "./index";
import { validateGuardDecision } from "./middleware/validate";

const REGION = "asia-south1";
const corsHandler = cors({ origin: true });

// ── guardDecision ────────────────────────────────────────────────
export const guardDecision = onRequest(
  { region: REGION },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const validationErrors = validateGuardDecision(req.body);
      if (validationErrors.length > 0) {
        res.status(400).json({ errors: validationErrors });
        return;
      }

      const { logId, decision, guardId } = req.body;

      try {
        const logRef = db.collection("logs").doc(logId);
        const logSnap = await logRef.get();

        if (!logSnap.exists) {
          res.status(404).json({ error: "Log entry not found" });
          return;
        }

        const logData = logSnap.data()!;

        // Prevent double-decision
        if (logData.guardDecision !== null) {
          res.status(409).json({
            error: "Decision already made for this scan",
            existingDecision: logData.guardDecision,
          });
          return;
        }

        // Update log with guard's decision
        await logRef.update({
          guardDecision: decision,
          guardId,
          decidedAt: new Date(),
        });

        // Remove from pending_scans
        await db.collection("pending_scans").doc(logId).delete();

        res.status(200).json({
          success: true,
          logId,
          decision,
        });
      } catch (error: any) {
        console.error("guardDecision error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
);

// ── autoExpirePendingScans (every 1 minute) ──────────────────────
export const autoExpirePendingScans = onSchedule(
  {
    schedule: "every 1 minutes",
    region: REGION,
  },
  async () => {
    const now = new Date();

    const expiredSnap = await db
      .collection("pending_scans")
      .where("expiresAt", "<=", now)
      .get();

    if (expiredSnap.empty) {
      console.log("No expired pending scans found.");
      return;
    }

    const batch = db.batch();

    expiredSnap.docs.forEach((doc) => {
      const data = doc.data();

      // Update log: auto-deny + flag
      const logRef = db.collection("logs").doc(doc.id);
      const existingFlags: string[] = data.flags || [];
      batch.update(logRef, {
        guardDecision: "DENY",
        flags: [...existingFlags, "AUTO_EXPIRED"],
        decidedAt: now,
      });

      // Delete from pending_scans
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Auto-expired ${expiredSnap.size} pending scan(s).`);
  }
);
