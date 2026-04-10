/**
 * Seed Function for Vigil-X (development only).
 *
 * seedDatabase — HTTP, populates emulator with test gates, users, and parcels.
 */

import { onRequest } from "firebase-functions/v2/https";
import cors from "cors";
import { db, auth } from "./index";

const REGION = "asia-south1";
const corsHandler = cors({ origin: true });

export const seedDatabase = onRequest(
  { region: REGION },
  (req, res) => {
    corsHandler(req, res, async () => {
      try {
        const batch = db.batch();

        // ── Gates ────────────────────────────────────────────
        const gates = [
          {
            gateId: "main-gate",
            name: "Main Gate",
            rules: {
              curfew: { start: "23:00", end: "05:00" },
              requiresManualApproval: false,
            },
          },
          {
            gateId: "hostel-a",
            name: "Hostel A Gate",
            rules: {
              curfew: { start: "22:00", end: "06:00" },
              requiresManualApproval: true,
            },
          },
          {
            gateId: "hostel-b",
            name: "Hostel B Gate",
            rules: {
              curfew: { start: "22:00", end: "06:00" },
              requiresManualApproval: true,
            },
          },
          {
            gateId: "library-gate",
            name: "Library Gate",
            rules: {
              curfew: null,
              requiresManualApproval: false,
            },
          },
        ];

        gates.forEach((gate) => {
          batch.set(db.collection("gates").doc(gate.gateId), gate);
        });

        // ── Test Users ───────────────────────────────────────
        const testUsers = [
          {
            uid: "test-student-001",
            name: "Aarav Sharma",
            email: "aarav@university.edu",
            phone: "+919876543210",
            role: "student",
            status: "active",
            permissions: { gates: ["main-gate", "hostel-a", "library-gate"] },
            deviceId: "device-001",
            fcmToken: "",
            photoURL: "",
            department: "Computer Science",
            roomNumber: "A-201",
            createdAt: new Date(),
          },
          {
            uid: "test-student-002",
            name: "Priya Patel",
            email: "priya@university.edu",
            phone: "+919876543211",
            role: "student",
            status: "active",
            permissions: { gates: ["main-gate", "hostel-b", "library-gate"] },
            deviceId: "device-002",
            fcmToken: "",
            photoURL: "",
            department: "Electrical Engineering",
            roomNumber: "B-105",
            createdAt: new Date(),
          },
          {
            uid: "test-worker-001",
            name: "Rajesh Kumar",
            email: "",
            phone: "+919876543212",
            role: "worker",
            status: "active",
            permissions: { gates: ["main-gate"] },
            deviceId: "device-003",
            fcmToken: "",
            photoURL: "",
            workerType: "housekeeping",
            createdAt: new Date(),
          },
          {
            uid: "test-guard-001",
            name: "Vikram Singh",
            email: "vikram@university.edu",
            phone: "+919876543213",
            role: "guard",
            status: "active",
            permissions: { gates: ["main-gate", "hostel-a", "hostel-b"] },
            deviceId: "device-004",
            fcmToken: "",
            photoURL: "",
            createdAt: new Date(),
          },
          {
            uid: "test-admin-001",
            name: "Dr. Meera Iyer",
            email: "meera@university.edu",
            phone: "+919876543214",
            role: "admin",
            status: "active",
            permissions: { gates: ["main-gate", "hostel-a", "hostel-b", "library-gate"] },
            deviceId: "device-005",
            fcmToken: "",
            photoURL: "",
            createdAt: new Date(),
          },
        ];

        for (const user of testUsers) {
          batch.set(db.collection("users").doc(user.uid), user);
          batch.set(db.collection("auth_state").doc(user.uid), {
            deviceVerified: true,
            faceVerified: false,
            lastVerifiedAt: null,
          });
        }

        // ── Test Parcels ─────────────────────────────────────
        const parcels = [
          {
            parcelId: "parcel-001",
            userId: "test-student-001",
            userName: "Aarav Sharma",
            description: "Amazon package — textbooks",
            status: "received",
            guardId: "test-guard-001",
            createdAt: new Date(),
            collectedAt: null,
            collectedBy: null,
          },
          {
            parcelId: "parcel-002",
            userId: "test-student-002",
            userName: "Priya Patel",
            description: "Flipkart — electronics",
            status: "received",
            guardId: "test-guard-001",
            createdAt: new Date(),
            collectedAt: null,
            collectedBy: null,
          },
        ];

        parcels.forEach((parcel) => {
          batch.set(db.collection("parcels").doc(parcel.parcelId), parcel);
        });

        await batch.commit();

        // ── Set custom claims for test users (cannot batch) ──
        const claimOps = testUsers.map((u) =>
          auth.setCustomUserClaims(u.uid, { role: u.role }).catch((err) => {
            // In emulator, user may not exist in Auth yet — that's OK
            console.warn(`Could not set claims for ${u.uid}: ${err.message}`);
          })
        );
        await Promise.all(claimOps);

        res.status(200).json({
          success: true,
          seeded: {
            gates: gates.length,
            users: testUsers.length,
            parcels: parcels.length,
          },
        });
      } catch (error: any) {
        console.error("seedDatabase error:", error);
        res.status(500).json({ error: "Seed failed: " + error.message });
      }
    });
  }
);
