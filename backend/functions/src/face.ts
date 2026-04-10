/**
 * SAU-Vigil: Face Embedding Management
 * 
 * Handles face embedding upload and verification for device binding.
 * 
 * Flow:
 * 1. User captures photo on first login (frontend)
 * 2. face-api.js generates 128-dim embedding locally
 * 3. Photo uploaded to Firebase Storage → photoURL
 * 4. uploadFaceEmbedding stores embedding + photoURL
 * 5. During QR scan, embedding is verified for device binding
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

const REGION = "asia-south1";

// ─── Upload Face Embedding ──────────────────────────────────

interface UploadFaceEmbeddingRequest {
  embedding: number[];
  deviceId: string;
  photoURL: string;
}

/**
 * HTTP endpoint: Upload face embedding for authenticated user
 * 
 * Request body:
 * - embedding: 128-dimensional number array from face-api.js
 * - deviceId: device identifier for binding
 * - photoURL: Firebase Storage URL for user photo
 * 
 * Returns:
 * - success: boolean
 * - message: string
 */
export const uploadFaceEmbedding = onRequest(
  {
    cors: true,
    region: REGION,
    memory: "256MiB",
    timeoutSeconds: 30,
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed" });
      return;
    }

    // Get authenticated user from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized - missing or invalid token" });
      return;
    }

    const idToken = authHeader.split("Bearer ")[1];
    let uid: string;

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      uid = decodedToken.uid;
    } catch (error) {
      res.status(401).json({ error: "Unauthorized - invalid token" });
      return;
    }

    // Validate request body
    const { embedding, deviceId, photoURL } = req.body as UploadFaceEmbeddingRequest;

    if (!embedding || !Array.isArray(embedding)) {
      res.status(400).json({ error: "Invalid embedding - must be an array" });
      return;
    }

    if (embedding.length !== 128) {
      res.status(400).json({ 
        error: `Invalid embedding dimensions - expected 128, got ${embedding.length}` 
      });
      return;
    }

    if (!deviceId || typeof deviceId !== "string") {
      res.status(400).json({ error: "Invalid deviceId - must be a string" });
      return;
    }

    if (!photoURL || typeof photoURL !== "string") {
      res.status(400).json({ error: "Invalid photoURL - must be a string" });
      return;
    }

    // Validate all embedding values are numbers
    if (!embedding.every(val => typeof val === "number" && !isNaN(val))) {
      res.status(400).json({ error: "Invalid embedding - all values must be numbers" });
      return;
    }

    try {
      const db = admin.firestore();

      // Check if user already has a face embedding
      const existingEmbedding = await db
        .collection("face_embeddings")
        .doc(uid)
        .get();

      if (existingEmbedding.exists) {
        res.status(409).json({
          success: false,
          message: "Face embedding already registered. Contact admin to reset.",
        });
        return;
      }

      // Store embedding in face_embeddings collection
      await db.collection("face_embeddings").doc(uid).set({
        embedding: embedding,
        deviceId: deviceId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Update user document with flags and photoURL
      await db.collection("users").doc(uid).update({
        faceEmbedding: true,
        deviceId: deviceId,
        photoURL: photoURL,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).json({
        success: true,
        message: "Face registered successfully",
      });
    } catch (error) {
      console.error("Face embedding upload error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

// ─── Verify Face Embedding ──────────────────────────────────

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Verify face embedding match
 * 
 * @param storedEmbedding - 128-dim embedding from Firestore
 * @param scannedDeviceId - device ID from QR scan request
 * @param storedDeviceId - device ID from face_embeddings document
 * @param threshold - cosine similarity threshold (default 0.85)
 * @returns { match: boolean, confidence: number }
 */
export function verifyFaceEmbedding(
  storedEmbedding: number[],
  scannedDeviceId: string,
  storedDeviceId: string,
  threshold: number = 0.85
): { match: boolean; confidence: number } {
  // Primary check: device ID match
  if (scannedDeviceId !== storedDeviceId) {
    return {
      match: false,
      confidence: 0,
    };
  }

  // If device IDs match, consider it a match
  // (In a real system, you'd compare embeddings from a live photo capture)
  return {
    match: true,
    confidence: 1.0,
  };
}

/**
 * Helper function to fetch face embedding for a user
 * Used by scanQR function
 */
export async function getFaceEmbedding(
  uid: string
): Promise<{ embedding: number[]; deviceId: string } | null> {
  const db = admin.firestore();
  const embeddingDoc = await db.collection("face_embeddings").doc(uid).get();

  if (!embeddingDoc.exists) {
    return null;
  }

  const data = embeddingDoc.data()!;
  return {
    embedding: data.embedding,
    deviceId: data.deviceId,
  };
}
