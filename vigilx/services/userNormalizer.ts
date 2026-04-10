// ─── userNormalizer.ts ────────────────────────────────────────────────────────
// Single source of truth for normalizing raw Firestore user documents.
// All field name variants and casing inconsistencies are resolved here.
// ─────────────────────────────────────────────────────────────────────────────

type AnyRecord = Record<string, any>;

/**
 * Normalize sub_role to one of two canonical values:
 *   "hosteller"   — students living on campus
 *   "day scholar" — students commuting daily
 */
export function normalizeSubRole(value: unknown): string {
  const raw = String(value || "").trim();
  const lower = raw.toLowerCase();

  if (lower === "dayscholar" || lower === "day scholar" || lower === "day-scholar") {
    return "day scholar";
  }
  if (lower === "hosteller" || lower === "hostel" || lower === "hosteler") {
    return "hosteller";
  }
  return lower; // pass through for worker/faculty/etc.
}

/**
 * Normalize a department string to lowercase+trimmed for comparisons.
 * The canonical casing (e.g. "BTech") is preserved in `Department`.
 */
export function normalizeDepartment(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

/**
 * Normalize a raw Firestore user document, resolving all field name variants.
 *
 * Canonical field names used everywhere in app code:
 *   name, role, sub_role, studentID, Roll_No, Department,
 *   department_lowercase, isActive, isInside, lastGate, lastScanTime,
 *   nightout_permission
 *
 * Safe fallbacks handle DB inconsistencies without modifying Firestore.
 */
export function normalizeUserDocument<T extends AnyRecord>(raw: T): T & {
  name: string;
  role: string;
  sub_role: string;
  studentID: string;
  Roll_No: string;
  Department: string;
  department_lowercase: string;
  isActive: boolean;
  isInside: boolean;
  lastGate: string;
  lastScanTime: any;
  nightout_permission: any;
} {
  const normalized = { ...raw } as AnyRecord;

  // ── Identity ─────────────────────────────────────────────────────────────
  normalized.name      = raw.name ?? "";
  normalized.role      = String(raw.role ?? "").toLowerCase().trim();
  normalized.sub_role  = normalizeSubRole(raw.sub_role ?? raw.subRole);

  // ── Student IDs — try every known casing variant ─────────────────────────
  // NOTE: Firestore may store roll number as "Roll_No" OR "Roll_No." (with dot)
  normalized.studentID = raw.studentID ?? raw.StudentId ?? raw.studentId ?? "";
  normalized.Roll_No   =
    raw["Roll_No."] ??   // dot variant (some records)
    raw.Roll_No    ??   // standard variant
    raw.Roll_no    ??   // lowercase_n variant
    "";

  // ── Department ────────────────────────────────────────────────────────────
  // Keep original casing for display; expose lowercase for comparisons
  normalized.Department          = raw.Department ?? raw.department ?? "";
  normalized.department_lowercase = normalizeDepartment(normalized.Department);

  // ── Access / Status ───────────────────────────────────────────────────────
  normalized.isActive           = raw.isActive ?? (raw.status === "active" ? true : raw.status == null ? true : false);
  normalized.isInside           = raw.isInside ?? false;
  normalized.lastGate           = raw.lastGate ?? "";
  normalized.lastScanTime       = raw.lastScanTime ?? null;
  normalized.nightout_permission = raw.nightout_permission ?? false;

  console.log("[normalizeUserDocument]", {
    uid: raw.uid ?? raw.studentID ?? "(unknown)",
    role: normalized.role,
    sub_role: normalized.sub_role,
    Department: normalized.Department,
    Roll_No: normalized.Roll_No,
  });

  return normalized as any;
}
