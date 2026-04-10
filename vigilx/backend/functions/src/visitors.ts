/**
 * Visitor Functions for Vigil-X.
 *
 * createVisitorSession   — HTTP POST, creates a time-limited visitor pass
 * validateVisitor        — HTTP GET, checks if a visitor session is still valid
 * expireVisitorSessions  — scheduled (every 15 min), auto-expires stale sessions
 */

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import cors from "cors";
import { db } from "./index";

const REGION = "asia-south1";
const corsHandler = cors({ origin: true });
const DEFAULT_VALID_HOURS = 4;

// ── createVisitorSession ─────────────────────────────────────────
export const createVisitorSession = onRequest(
  { region: REGION },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const {
        name,
        phone,
        hostUserId,
        purpose,
        validHours = DEFAULT_VALID_HOURS,
        gates,
      } = req.body;

      if (!name || !phone || !hostUserId || !purpose) {
        res.status(400).json({
          error: "name, phone, hostUserId, and purpose are required",
        });
        return;
      }

      try {
        // Fetch host name
        const hostSnap = await db.collection("users").doc(hostUserId).get();
        const hostName = hostSnap.exists ? hostSnap.data()!.name || "" : "";

        const visitorId = db.collection("visitor_sessions").doc().id;
        const now = new Date();
        const validTill = new Date(now.getTime() + validHours * 60 * 60 * 1000);

        await db.collection("visitor_sessions").doc(visitorId).set({
          visitorId,
          name,
          phone,
          photo: null,
          hostUserId,
          hostName,
          purpose,
          validTill,
          approved: true,
          permissions: { gates: gates || ["main-gate"] },
          status: "active",
          createdAt: now,
        });

        res.status(201).json({
          success: true,
          visitorId,
          validTill: validTill.toISOString(),
        });
      } catch (error: any) {
        console.error("createVisitorSession error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
);

// ── validateVisitor ──────────────────────────────────────────────
export const validateVisitor = onRequest(
  { region: REGION },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const visitorId = req.query.visitorId as string;
      if (!visitorId) {
        res.status(400).json({ error: "visitorId query parameter is required" });
        return;
      }

      try {
        const visitorSnap = await db
          .collection("visitor_sessions")
          .doc(visitorId)
          .get();

        if (!visitorSnap.exists) {
          res.status(404).json({
            valid: false,
            visitor: null,
            message: "Visitor session not found",
          });
          return;
        }

        const visitor = visitorSnap.data()!;
        const now = new Date();
        const validTill = visitor.validTill?.toDate
          ? visitor.validTill.toDate()
          : new Date(visitor.validTill);

        const isValid =
          visitor.status === "active" &&
          visitor.approved === true &&
          now < validTill;

        res.status(200).json({
          valid: isValid,
          visitor: {
            visitorId: visitor.visitorId,
            name: visitor.name,
            phone: visitor.phone,
            hostName: visitor.hostName,
            purpose: visitor.purpose,
            validTill: validTill.toISOString(),
            status: visitor.status,
            permissions: visitor.permissions,
          },
          message: isValid ? "Visitor session is valid" : "Visitor session is invalid or expired",
        });
      } catch (error: any) {
        console.error("validateVisitor error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
);

// ── expireVisitorSessions (every 15 minutes) ─────────────────────
export const expireVisitorSessions = onSchedule(
  {
    schedule: "every 15 minutes",
    region: REGION,
  },
  async () => {
    const now = new Date();

    const expiredSnap = await db
      .collection("visitor_sessions")
      .where("status", "==", "active")
      .where("validTill", "<=", now)
      .get();

    if (expiredSnap.empty) {
      console.log("No expired visitor sessions found.");
      return;
    }

    const batch = db.batch();
    expiredSnap.docs.forEach((doc) => {
      batch.update(doc.ref, { status: "expired" });
    });

    await batch.commit();
    console.log(`Expired ${expiredSnap.size} visitor session(s).`);
  }
);
