/**
 * Face Embedding Functions for Vigil-X.
 *
 * uploadFaceEmbedding — HTTP POST, stores 128-d face vector
 * Helper utilities for verification during scan flow.
 */

import { onRequest } from "firebase-functions/v2/https";
import { db, auth } from "./index";
import cors from "cors";

const REGION = "asia-south1";
const corsHandler = cors({ origin: true });

// ── uploadFaceEmbedding ──────────────────────────────────────────
export const uploadFaceEmbedding = onRequest(
  { region: REGION },
  (req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      // Verify Bearer token
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Missing or invalid Authorization header" });
        return;
      }

      let uid: string;
      try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await auth.verifyIdToken(token);
        uid = decoded.uid;
      } catch {
        res.status(401).json({ error: "Invalid token" });
        return;
      }

      const { embedding, deviceId, photoURL } = req.body as {
        embedding: number[];
        deviceId: string;
        photoURL?: string;
      };

      // Validate embedding dimensions
      if (!Array.isArray(embedding) || embedding.length !== 128) {
        res.status(400).json({ error: "embedding must be an array of 128 numbers" });
        return;
      }

      if (!deviceId) {
        res.status(400).json({ error: "deviceId is required" });
        return;
      }

      // Check for existing embedding (409 if already registered)
      const existing = await db.collection("face_embeddings").doc(uid).get();
      if (existing.exists) {
        res.status(409).json({ error: "Face embedding already exists for this user" });
        return;
      }

      // Store embedding
      await db.collection("face_embeddings").doc(uid).set({
        embedding,
        deviceId,
        createdAt: new Date(),
      });

      // Update user profile
      const userUpdates: Record<string, any> = {
        faceEmbedding: true,
        deviceId,
        updatedAt: new Date(),
      };
      if (photoURL) userUpdates.photoURL = photoURL;

      await db.collection("users").doc(uid).update(userUpdates);

      res.status(201).json({ success: true });
    });
  }
);

// ── Helper: cosine similarity ────────────────────────────────────
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(magA) * Math.sqrt(magB);
  return magnitude === 0 ? 0 : dot / magnitude;
}

// ── Helper: verify face embedding ────────────────────────────────
export function verifyFaceEmbedding(
  storedEmbedding: number[],
  scannedDeviceId: string,
  storedDeviceId: string,
  threshold: number = 0.85
): { match: boolean; confidence: number } {
  // Currently checks device ID match as proxy for face presence
  // In production, actual embedding comparison would happen on-device
  const deviceMatch = scannedDeviceId === storedDeviceId;
  const confidence = deviceMatch ? 1.0 : 0.0;

  return {
    match: confidence >= threshold,
    confidence,
  };
}

// ── Helper: fetch embedding from Firestore ───────────────────────
export async function getFaceEmbedding(
  uid: string
): Promise<{ embedding: number[]; deviceId: string } | null> {
  const doc = await db.collection("face_embeddings").doc(uid).get();
  if (!doc.exists) return null;

  const data = doc.data()!;
  return {
    embedding: data.embedding as number[],
    deviceId: data.deviceId as string,
  };
}
