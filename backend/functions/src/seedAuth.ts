import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { Request, Response } from "express";


export const seedAuth = onRequest(
  {
    cors: true,
    region: "asia-south1",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST" });
      return;
    }

    const auth = admin.auth();
    const results: any[] = [];
    const errors: any[] = [];

    const users = [
      { uid: "XXoSuUz4sWRJ31DZjOdSy3N6lq63", email: "student1@gmail.com", password: "Password1", name: "Student 1" },
      { uid: "fGYIPbudPac5iRpRsj6Hrz754mF2", email: "student2@gmail.com", password: "Password2", name: "Student 2" },
      { uid: "MMtJ0opjthaRwMkVS0w89GGpEiJ2", email: "guard1@gmail.com", password: "Passwordg1", name: "Guard 1" },
    ];

    for (const user of users) {
      try {
        await auth.createUser({
          uid: user.uid,
          email: user.email,
          password: user.password,
          displayName: user.name,
          emailVerified: true,
        });

        results.push({ email: user.email, status: "created" });
      } catch (error: any) {
        if (
          error.code === "auth/uid-already-exists" ||
          error.code === "auth/email-already-exists"
        ) {
          results.push({ email: user.email, status: "already exists" });
        } else {
          errors.push({ email: user.email, error: error.message });
        }
      }
    }

    res.status(200).json({
      success: true,
      message: "Auth seeded successfully",
      results,
      errors,
    });
  }
);