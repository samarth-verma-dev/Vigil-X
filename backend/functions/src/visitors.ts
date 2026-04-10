/**
 * SAU-Vigil: Visitor Session Management
 * 
 * - createVisitorSession: Guard/admin creates a temporary visitor pass
 * - validateVisitor: Check if a visitor session is still valid
 * - expireVisitorSessions: Scheduled cleanup of expired sessions
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";

const REGION = "asia-south1";

// ─── Create Visitor Session ─────────────────────────────────

/**
 * Guard or admin creates a temporary visitor pass.
 * Body: { name, phone, hostUserId, purpose, validHours, gates }
 */
export const createVisitorSession = onRequest(
  { cors: true, region: REGION, memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { name, phone, hostUserId, purpose, validHours, gates } = req.body;

    if (!name || !phone || !hostUserId || !purpose) {
      res.status(400).json({
        error: "name, phone, hostUserId, and purpose are required",
      });
      return;
    }

    try {
      const db = admin.firestore();

      // Verify host user exists
      const hostSnap = await db.collection("users").doc(hostUserId).get();
      if (!hostSnap.exists) {
        res.status(404).json({ error: "Host user not found" });
        return;
      }

      const hostData = hostSnap.data()!;
      const hours = validHours || 4; // Default: 4 hours

      const validTill = new Date(Date.now() + hours * 60 * 60 * 1000);

      const visitorRef = db.collection("visitor_sessions").doc();
      await visitorRef.set({
        visitorId: visitorRef.id,
        name,
        phone,
        photo: null,
        hostUserId,
        hostName: hostData.name || "Unknown",
        purpose,
        validTill,
        approved: true, // Auto-approved when guard creates
        permissions: {
          gates: gates || ["main-gate"],
        },
        status: "active",
        createdAt: new Date(),
      });

      res.status(201).json({
        success: true,
        visitorId: visitorRef.id,
        validTill: validTill.toISOString(),
        message: `Visitor pass created for ${name}, valid till ${validTill.toLocaleTimeString()}`,
      });
    } catch (error) {
      console.error("Create visitor session error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── Validate Visitor ───────────────────────────────────────

/**
 * Quick check if a visitor session is still valid (for gate scan).
 * GET: ?visitorId=xxx
 */
export const validateVisitor = onRequest(
  { cors: true, region: REGION, memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "GET") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const visitorId = req.query.visitorId as string;
    if (!visitorId) {
      res.status(400).json({ error: "visitorId query param is required" });
      return;
    }

    try {
      const db = admin.firestore();
      const visitorSnap = await db.collection("visitor_sessions").doc(visitorId).get();

      if (!visitorSnap.exists) {
        res.status(404).json({ valid: false, message: "Visitor session not found" });
        return;
      }

      const data = visitorSnap.data()!;
      const now = new Date();
      const validTill = data.validTill.toDate ? data.validTill.toDate() : new Date(data.validTill);

      const isValid = data.status === "active" && data.approved && now < validTill;

      res.status(200).json({
        valid: isValid,
        visitor: {
          name: data.name,
          phone: data.phone,
          hostName: data.hostName,
          purpose: data.purpose,
          validTill: validTill.toISOString(),
          status: data.status,
        },
        message: isValid ? "Visitor pass is valid" : "Visitor pass is expired or inactive",
      });
    } catch (error) {
      console.error("Validate visitor error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── Auto-Expire Visitor Sessions ───────────────────────────

/**
 * Runs every 15 minutes to expire visitor sessions past their validTill time.
 */
export const expireVisitorSessions = onSchedule(
  {
    schedule: "every 15 minutes",
    region: REGION,
    memory: "256MiB",
  },
  async () => {
    const db = admin.firestore();
    const now = new Date();

    const expiredSnap = await db
      .collection("visitor_sessions")
      .where("status", "==", "active")
      .where("validTill", "<=", now)
      .get();

    if (expiredSnap.empty) return;

    const batch = db.batch();
    for (const doc of expiredSnap.docs) {
      batch.update(doc.ref, { status: "expired" });
    }

    await batch.commit();
    console.log(`Expired ${expiredSnap.size} visitor sessions`);
  }
);
