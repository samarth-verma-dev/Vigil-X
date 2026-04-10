/**
 * Parcel Functions for Vigil-X.
 *
 * createParcel    — HTTP POST, registers a new parcel for a user
 * collectParcel   — HTTP POST, marks parcel as collected
 * onParcelCreated — Firestore trigger, sends FCM notification on new parcel
 */

import { onRequest } from "firebase-functions/v2/https";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import cors from "cors";
import { db, messaging } from "./index";

const REGION = "asia-south1";
const corsHandler = cors({ origin: true });

// ── createParcel ─────────────────────────────────────────────────
export const createParcel = onRequest(
  { region: REGION },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const { userId, description, guardId } = req.body;

      if (!userId || !description || !guardId) {
        res.status(400).json({
          error: "userId, description, and guardId are required",
        });
        return;
      }

      try {
        // Fetch user name
        const userSnap = await db.collection("users").doc(userId).get();
        const userName = userSnap.exists ? userSnap.data()!.name || "" : "";

        const parcelId = db.collection("parcels").doc().id;

        await db.collection("parcels").doc(parcelId).set({
          parcelId,
          userId,
          userName,
          description,
          status: "received",
          guardId,
          createdAt: new Date(),
          collectedAt: null,
          collectedBy: null,
        });

        res.status(201).json({ success: true, parcelId });
      } catch (error: any) {
        console.error("createParcel error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
);

// ── collectParcel ────────────────────────────────────────────────
export const collectParcel = onRequest(
  { region: REGION },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      const { parcelId, guardId } = req.body;

      if (!parcelId || !guardId) {
        res.status(400).json({
          error: "parcelId and guardId are required",
        });
        return;
      }

      try {
        const parcelRef = db.collection("parcels").doc(parcelId);
        const parcelSnap = await parcelRef.get();

        if (!parcelSnap.exists) {
          res.status(404).json({ error: "Parcel not found" });
          return;
        }

        await parcelRef.update({
          status: "collected",
          collectedAt: new Date(),
          collectedBy: guardId,
        });

        res.status(200).json({ success: true, parcelId });
      } catch (error: any) {
        console.error("collectParcel error:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
  }
);

// ── onParcelCreated (Firestore trigger) ──────────────────────────
export const onParcelCreated = onDocumentCreated(
  {
    document: "parcels/{parcelId}",
    region: REGION,
  },
  async (event) => {
    const parcelData = event.data?.data();
    if (!parcelData) return;

    const { userId, description, parcelId } = parcelData;

    try {
      // Fetch user's FCM token
      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) {
        console.warn(`User ${userId} not found for parcel notification.`);
        return;
      }

      const userData = userSnap.data()!;
      const fcmToken = userData.fcmToken;

      if (!fcmToken) {
        console.warn(`No FCM token for user ${userId}.`);
        return;
      }

      // Send push notification
      await messaging.send({
        token: fcmToken,
        notification: {
          title: "📦 New Parcel!",
          body: `You have a new parcel: ${description}. Collect it from the gate.`,
        },
        data: {
          type: "parcel",
          parcelId: parcelId || "",
        },
      });

      console.log(`Parcel notification sent to user ${userId}.`);

      // Update parcel status to "notified"
      if (event.data?.ref) {
        await event.data.ref.update({ status: "notified" });
      }
    } catch (error: any) {
      console.error("onParcelCreated notification error:", error);
    }
  }
);
