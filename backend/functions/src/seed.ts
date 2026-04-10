/**
 * SAU-Vigil: Seed Data Script
 * 
 * Creates test data in the Firestore emulator for development.
 * Run this as a Cloud Function or manually via the emulator UI.
 */

import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

const REGION = "asia-south1";

export const seedDatabase = onRequest(
  { cors: true, region: REGION },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method not allowed. Use POST." });
      return;
    }

    const db = admin.firestore();
    const batch = db.batch();
    const now = new Date();

    // ─── Gates ────────────────────────────────────────────
    const gates = [
      {
        gateId: "main-gate",
        name: "Main Gate",
        type: "main",
        rules: {
          requiresManualApproval: false,
          curfew: null,
        },
      },
      {
        gateId: "hostel-gate-a",
        name: "Hostel A Gate",
        type: "hostel",
        rules: {
          requiresManualApproval: true,
          curfew: { start: "22:00", end: "06:00" },
        },
      },
      {
        gateId: "hostel-gate-b",
        name: "Hostel B Gate",
        type: "hostel",
        rules: {
          requiresManualApproval: true,
          curfew: { start: "23:00", end: "05:00" },
        },
      },
    ];

    for (const gate of gates) {
      batch.set(db.collection("gates").doc(gate.gateId), gate);
    }

    // ─── Test Users ───────────────────────────────────────
    const users = [
      {
        uid: "test-student-1",
        name: "Arpan Kumar",
        email: "arpan@sau.edu",
        phone: "+919876543210",
        role: "student",
        status: "active",
        permissions: { gates: ["main-gate", "hostel-gate-a"] },
        deviceId: "device-001",
        faceEmbedding: false,  // NEW: face not registered yet
        photoURL: "",
        fcmToken: "",
        createdAt: now,
      },
      {
        uid: "test-faculty-1",
        name: "Dr. Sharma",
        email: "sharma@sau.edu",
        phone: "+919876543211",
        role: "faculty",
        status: "active",
        permissions: { gates: ["*"] }, // Faculty: all gates
        deviceId: "device-002",
        faceEmbedding: false,
        photoURL: "",
        fcmToken: "",
        createdAt: now,
      },
      {
        uid: "test-worker-mess-1",
        name: "Ramesh Kumar",
        email: "ramesh@sau.edu",
        phone: "+919876543212",
        role: "worker",
        workerType: "mess",  // NEW: mess worker
        status: "active",
        permissions: { gates: ["main-gate"] },  // Only main gate
        deviceId: "device-003",
        faceEmbedding: false,
        photoURL: "",
        fcmToken: "",
        createdAt: now,
      },
      {
        uid: "test-worker-maintenance-1",
        name: "Suresh Patel",
        email: "suresh@sau.edu",
        phone: "+919876543216",
        role: "worker",
        workerType: "maintenance",  // NEW: maintenance worker
        status: "active",
        permissions: { gates: ["main-gate", "hostel-gate-a", "hostel-gate-b"] },  // All gates
        deviceId: "device-005",
        faceEmbedding: false,
        photoURL: "",
        fcmToken: "",
        createdAt: now,
      },
      {
        uid: "test-guard-1",
        name: "Security Guard 1",
        email: "guard1@sau.edu",
        phone: "+919876543213",
        role: "guard",
        status: "active",
        permissions: { gates: ["*"] },
        deviceId: "device-guard-001",
        faceEmbedding: false,
        photoURL: "",
        fcmToken: "",
        createdAt: now,
      },
      {
        uid: "test-admin-1",
        name: "Admin User",
        email: "admin@sau.edu",
        phone: "+919876543214",
        role: "admin",
        status: "active",
        permissions: { gates: ["*"] },
        deviceId: "device-admin-001",
        faceEmbedding: false,
        photoURL: "",
        fcmToken: "",
        createdAt: now,
      },
      {
        uid: "test-suspended-1",
        name: "Suspended Student",
        email: "suspended@sau.edu",
        phone: "+919876543215",
        role: "student",
        status: "suspended",
        permissions: { gates: ["main-gate"] },
        deviceId: "device-004",
        faceEmbedding: false,
        photoURL: "",
        fcmToken: "",
        createdAt: now,
      },
    ];

<<<<<<< Updated upstream
=======
    // Write users to users collection
>>>>>>> Stashed changes
    for (const user of users) {
      batch.set(db.collection("users").doc(user.uid), user);
      batch.set(db.collection("auth_state").doc(user.uid), {
        deviceVerified: true,
        faceVerified: false,
        lastVerifiedAt: now,
      });
    }

    // ─── Test Face Embeddings (optional - for testing) ──────
    // Generate dummy 128-dim embeddings for testing
    const generateDummyEmbedding = () => {
      return Array.from({ length: 128 }, () => Math.random() * 2 - 1);
    };

    // Add face embeddings for some test users
    const usersWithFaceEmbeddings = ["test-student-1", "test-guard-1"];
    for (const uid of usersWithFaceEmbeddings) {
      batch.set(db.collection("face_embeddings").doc(uid), {
        embedding: generateDummyEmbedding(),
        deviceId: users.find(u => u.uid === uid)?.deviceId || "unknown",
        createdAt: now,
      });
      // Update user document to reflect face embedding exists
      batch.update(db.collection("users").doc(uid), {
        faceEmbedding: true,
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(users.find(u => u.uid === uid)?.name || "User")}`,
      });
    }

    // ─── Test Parcels ─────────────────────────────────────
    const parcelRef = db.collection("parcels").doc();
    batch.set(parcelRef, {
      parcelId: parcelRef.id,
      userId: "test-student-1",
      userName: "Arpan Kumar",
      description: "Amazon package - Electronics",
      status: "received",
      guardId: "test-guard-1",
      createdAt: now,
      collectedAt: null,
    });

    try {
      await batch.commit();
      res.status(200).json({
        success: true,
        message: "Database seeded successfully",
        data: {
          gates: gates.length,
          users: users.length,
          usersWithFaceEmbeddings: usersWithFaceEmbeddings.length,
          parcels: 1,
        },
      });
    } catch (error) {
      console.error("Seed error:", error);
      res.status(500).json({ error: "Failed to seed database" });
    }
  }
);