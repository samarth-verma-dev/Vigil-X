import { collection, query, where, getDocs, limit, FieldPath } from "firebase/firestore";
import { db } from "./firebase";
import { normalizeDepartment, normalizeUserDocument } from "./userNormalizer";

// ─── UserProfile ─────────────────────────────────────────────────────────────
// Shape returned by searchStudentsByDeptAndRoll and used in UI components.
// Canonical fields only — normalization happens in normalizeUserDocument.
export interface UserProfile {
  id: string;                     // Firestore document ID
  uid?: string;
  name?: string;
  email?: string;
  role?: string;
  sub_role?: string;              // "hosteller" | "day scholar"
  studentID?: string;             // canonical student ID
  Roll_No?: string;               // canonical roll number (resolved from Roll_No / Roll_no / Roll_No.)
  Department?: string;            // original casing (e.g. "BTech", "Eco")
  department_lowercase?: string;  // lowercase for comparisons
  isActive?: boolean;
  isInside?: boolean;
  lastGate?: string;
  lastScanTime?: any;
  nightout_permission?: any;
  // Legacy aliases preserved for safety
  studentId?: string;
  subRole?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// searchStudentsByDeptAndRoll
//
// Strategy: query by roll number (both "Roll_No" and "Roll_No." field names),
// then client-side filter by Department (exact match, case-sensitive as in DB).
//
// We avoid a compound Firestore index by doing the Department filter in JS.
// ─────────────────────────────────────────────────────────────────────────────
export const searchStudentsByDeptAndRoll = async (
  department: string,
  rollNo: string
): Promise<UserProfile[]> => {
  const exactDept    = department.trim();         // case-sensitive: "BTech", "Eco", etc.
  const cleanRoll    = rollNo.trim();
  const lowerDept    = normalizeDepartment(exactDept); // for fallback comparison

  if (!exactDept || !cleanRoll) return [];

  try {
    // Query both known Firestore field name variants in parallel.
    // "Roll_No"  — most common
    // "Roll_No." — some records have a trailing dot (data entry inconsistency)
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(db, "users"), where("Roll_No", "==", cleanRoll), limit(20))),
      getDocs(query(collection(db, "users"), where(new FieldPath("Roll_No."), "==", cleanRoll), limit(20))),
    ]);

    const seen = new Set<string>();
    const merged = [...snap1.docs, ...snap2.docs].filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    if (merged.length === 0) {
      console.log("[searchStudents] No docs matched Roll_No:", cleanRoll);
      return [];
    }

    const results: UserProfile[] = [];

    merged.forEach((docSnap) => {
      const raw  = docSnap.data();
      const data = normalizeUserDocument(raw);

      // Department filter — prefer exact casing match, fall back to lowercase
      const docDeptExact = raw.Department ?? raw.department ?? "";
      const docDeptLower = normalizeDepartment(docDeptExact);
      const deptMatch =
        docDeptExact === exactDept ||          // "BTech" === "BTech"
        docDeptLower === lowerDept;            // "btech" === "btech" (fallback)

      if (!deptMatch) {
        console.log("[searchStudents] Skip — dept mismatch:", docDeptExact, "vs", exactDept);
        return;
      }

      // Only return students (role field should be "student" after normalization)
      if (data.role !== "student") {
        console.log("[searchStudents] Skip — not a student, role:", data.role);
        return;
      }

      results.push({ ...data, id: docSnap.id });
    });

    console.log("[searchStudents] Matches:", results.length, "for dept:", exactDept, "roll:", cleanRoll);
    return results;

  } catch (err) {
    console.error("[searchStudents] Error:", err);
    return [];
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// searchStudentsByPhone
//
// Strategy: query by exactly matched phone number, returning matched students.
// ─────────────────────────────────────────────────────────────────────────────
export const searchStudentsByPhone = async (
  phone: string
): Promise<UserProfile[]> => {
  const cleanPhone = phone.trim();
  if (!cleanPhone) return [];

  try {
    const [snap1, snap2] = await Promise.all([
      getDocs(query(collection(db, "users"), where("phone", "==", cleanPhone), limit(20))),
      getDocs(query(collection(db, "usersnew"), where("phone", "==", cleanPhone), limit(20)))
    ]).catch(e => {
        console.warn("One of the queries failed (likely usersnew does not exist in prod):", e);
        // Fallback to just querying users
        return Promise.all([
          getDocs(query(collection(db, "users"), where("phone", "==", cleanPhone), limit(20))),
          { docs: [] } as any
        ]);
    });

    const results: UserProfile[] = [];
    const seen = new Set<string>();

    const mergedDocs = [...(snap1?.docs || []), ...(snap2?.docs || [])];

    mergedDocs.forEach((docSnap) => {
      if (seen.has(docSnap.id)) return;
      seen.add(docSnap.id);

      const raw = docSnap.data();
      const data = normalizeUserDocument(raw);

      // Only return true students
      if (data.role !== "student") {
        console.log("[searchStudentsByPhone] Skip — not a student, role:", data.role);
        return;
      }

      results.push({ ...data, id: docSnap.id });
    });

    console.log("[searchStudentsByPhone] Matches:", results.length, "for phone:", cleanPhone);
    return results;
  } catch (err) {
    console.error("[searchStudentsByPhone] Error:", err);
    return [];
  }
};
