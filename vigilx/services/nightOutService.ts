import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Updates the evaluation status of a student's night-out permission request.
 * Stamps the review cycle with the resolving administrator's identifier.
 */
export const updateNightOutStatus = async (
  requestId: string,
  newStatus: "approved" | "rejected",
  adminUid: string
): Promise<void> => {
  try {
    const requestRef = doc(db, "night_out_requests", requestId);
    await updateDoc(requestRef, {
      status: newStatus,
      reviewedBy: adminUid,
      reviewedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to update Night-Out permission:", error);
    throw error;
  }
};
