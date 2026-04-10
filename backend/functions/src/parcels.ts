/**
 * SAU-Vigil: Parcel Management Functions
 * 
 * - createParcel: Guard logs a new parcel for a student
 * - collectParcel: Guard marks parcel as collected
 * - getUserParcels: User fetches their parcels
 * - sendParcelNotification: Push notification when parcel arrives
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

const REGION = "asia-south1";

// ─── Create Parcel ──────────────────────────────────────────

/**
 * Guard logs a new parcel at the gate.
 * Body: { userId, description, guardId }
 */
export const createParcel = onRequest(
  { cors: true, region: REGION, memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { userId, description, guardId } = req.body;

    if (!userId || !description || !guardId) {
      res.status(400).json({ error: "userId, description, and guardId are required" });
      return;
    }

    try {
      const db = admin.firestore();

      // Verify user exists
      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const userData = userSnap.data()!;

      // Create parcel doc
      const parcelRef = db.collection("parcels").doc();
      await parcelRef.set({
        parcelId: parcelRef.id,
        userId,
        userName: userData.name || "Unknown",
        description,
        status: "received",
        guardId,
        createdAt: new Date(),
        collectedAt: null,
      });

      res.status(201).json({
        success: true,
        parcelId: parcelRef.id,
        message: `Parcel logged for ${userData.name}`,
      });
    } catch (error) {
      console.error("Create parcel error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── Collect Parcel ─────────────────────────────────────────

/**
 * Guard verifies student screen and marks parcel as collected.
 * Body: { parcelId, guardId }
 */
export const collectParcel = onRequest(
  { cors: true, region: REGION, memory: "256MiB" },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    const { parcelId, guardId } = req.body;

    if (!parcelId || !guardId) {
      res.status(400).json({ error: "parcelId and guardId are required" });
      return;
    }

    try {
      const db = admin.firestore();
      const parcelRef = db.collection("parcels").doc(parcelId);
      const parcelSnap = await parcelRef.get();

      if (!parcelSnap.exists) {
        res.status(404).json({ error: "Parcel not found" });
        return;
      }

      const parcelData = parcelSnap.data()!;

      if (parcelData.status === "collected") {
        res.status(409).json({ error: "Parcel already collected" });
        return;
      }

      await parcelRef.update({
        status: "collected",
        collectedAt: new Date(),
        collectedBy: guardId,
      });

      res.status(200).json({
        success: true,
        message: "Parcel marked as collected",
      });
    } catch (error) {
      console.error("Collect parcel error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// ─── Push Notification on Parcel Creation ───────────────────

/**
 * Firestore trigger: when a new parcel is created,
 * send a push notification to the student via FCM.
 */
export const onParcelCreated = onDocumentCreated(
  { document: "parcels/{parcelId}", region: REGION },
  async (event) => {
    const parcelData = event.data?.data();
    if (!parcelData) return;

    const db = admin.firestore();

    // Get user's FCM token
    const userSnap = await db.collection("users").doc(parcelData.userId).get();
    if (!userSnap.exists) return;

    const userData = userSnap.data()!;
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      console.log(`No FCM token for user ${parcelData.userId}, skipping push`);
      return;
    }

    // Send push notification
    try {
      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: "📦 New Parcel!",
          body: `You have a new parcel: ${parcelData.description}. Collect it from the gate.`,
        },
        data: {
          type: "parcel",
          parcelId: parcelData.parcelId,
        },
      });
      console.log(`Push sent to ${parcelData.userId} for parcel ${parcelData.parcelId}`);

      // Update parcel status to notified
      await event.data?.ref.update({ status: "notified" });
    } catch (error) {
      console.error("FCM send error:", error);
    }
  }
);
