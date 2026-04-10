import { collection, addDoc, query, where, getDocs, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export type FlagType = "late_entry" | "late_exit" | "repeat_violation" | "late_request" | "emergency_exit" | "repeat_emergency";

export const logViolationFlag = async (
  studentId: string, 
  studentName: string, 
  type: FlagType,
  relatedLogId?: string,
  uid?: string,
  email?: string
) => {
  try {
    // 1. Log the immediate flag
    await addDoc(collection(db, "flags"), {
      uid: uid || "",
      studentId: studentId || "Unknown ID",
      studentName: studentName || "Unknown Student",
      name: studentName || "Unknown Student", // Saved natively 
      email: email || "",
      type,
      timestamp: serverTimestamp(),
      relatedLogId: relatedLogId || null,
      status: "active"
    });

    // 2. Repeat Offender Sub-Engine
    // We only evaluate repeat status if the current flag isn't ALREADY a repeat flag
    if (type !== "repeat_violation") {
      const q = query(
        collection(db, "flags"),
        where("studentId", "==", studentId),
        where("type", "in", ["late_entry", "late_exit"])
      );
      
      const snapshot = await getDocs(q);
      
      // If student has committed 3 or more physical time violations
      if (snapshot.size >= 3) {
        // Tag them as a repeat offender natively.
        await addDoc(collection(db, "flags"), {
          uid: uid || "",
          studentId: studentId || "Unknown ID",
          studentName: studentName || "Unknown Student",
          name: studentName || "Unknown Student",
          email: email || "",
          type: "repeat_violation",
          count: snapshot.size,
          timestamp: serverTimestamp(),
          status: "active"
        });
      }
    }
  } catch (err) {
    console.error("Failed to commit violation flag:", err);
  }
};

export const logEmergencyFlag = async (
  studentId: string, 
  studentName: string, 
  reason: string,
  relatedLogId?: string,
  uid?: string,
  email?: string
) => {
  try {
    await addDoc(collection(db, "flags"), {
      uid: uid || "",
      studentId: studentId || "Unknown ID",
      studentName: studentName || "Unknown Student",
      name: studentName || "Unknown Student",
      email: email || "",
      type: "emergency_exit",
      reason: reason || "Emergency triggered",
      timestamp: serverTimestamp(),
      relatedLogId: relatedLogId || null,
      status: "active"
    });

    const q = query(
      collection(db, "flags"),
      where("studentId", "==", studentId),
      where("type", "==", "emergency_exit")
    );
    const snapshot = await getDocs(q);
    
    // threshold: 3 or more emergencies
    if (snapshot.size >= 3) {
      await addDoc(collection(db, "flags"), {
        uid: uid || "",
        studentId: studentId || "Unknown ID",
        studentName: studentName || "Unknown Student",
        name: studentName || "Unknown Student",
        email: email || "",
        type: "repeat_emergency",
        count: snapshot.size,
        timestamp: serverTimestamp(),
        status: "active"
      });
    }
  } catch (err) {
    console.error("Failed to map emergency flag:", err);
  }
};
