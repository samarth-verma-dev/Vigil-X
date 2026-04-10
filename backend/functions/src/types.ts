// ============================================================
// SAU-Vigil: Shared Type Definitions
// Used across backend, user-app, guard-app, and admin-dashboard
// ============================================================

// --- Enums / Union Types ---

export type UserRole = "student" | "worker" | "faculty" | "visitor" | "guard" | "admin";
export type WorkerSubtype = "mess" | "cleaning" | "security" | "maintenance" | "other";
export type GateType = "main" | "hostel";
export type AccessDecision = "ALLOW" | "DENY" | "PENDING";
export type ParcelStatus = "received" | "notified" | "collected";
export type VisitorStatus = "active" | "expired" | "exited";

// --- Firestore Document Interfaces ---

export interface User {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  workerType?: WorkerSubtype;
  department?: string;
  roomNumber?: string;
  studentId?: string;
  "Roll_No."?: string;
  faceEmbedding?: boolean;
  status: "active" | "suspended" | "inactive";
  permissions: {
    gates: string[]; // list of gateIds user is allowed through
  };
  deviceId: string;
  fcmToken?: string; // Firebase Cloud Messaging token for push notifications
  photoURL?: string;
  createdAt: any; // FirebaseFirestore.Timestamp (using any for cross-platform compat)
}

export interface AuthState {
  deviceVerified: boolean;
  faceVerified: boolean;
  lastVerifiedAt: any;
}

export interface Gate {
  gateId: string;
  name: string;
  type: GateType;
  rules: {
    requiresManualApproval: boolean;
    curfew?: {
      start: string; // "22:00"
      end: string;   // "06:00"
    };
  };
}

export interface AccessLog {
  logId: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  gateId: string;
  gateName: string;
  timestamp: any;
  systemDecision: AccessDecision;
  guardDecision?: "ALLOW" | "DENY";
  flags: string[];
  deviceId: string;
}

export interface Parcel {
  parcelId: string;
  userId: string;
  userName: string;
  description: string;
  status: ParcelStatus;
  guardId: string;
  createdAt: any;
  collectedAt?: any;
}

export interface VisitorSession {
  visitorId: string;
  name: string;
  phone: string;
  photo?: string;
  hostUserId: string;
  hostName: string;
  purpose: string;
  validTill: any;
  approved: boolean;
  approvedBy?: string;
  permissions: {
    gates: string[];
  };
  status: VisitorStatus;
  createdAt: any;
}

// --- QR Code Payload ---

/** Encoded into the QR code shown by user app */
export interface QRPayload {
  uid: string;
  ts: number;  // Unix timestamp (ms) of QR generation — for expiry
  sig: string; // HMAC-SHA256 signature for tamper-proofing
}

// --- API Request / Response Types ---

/** Guard app → Cloud Function: scan request */
export interface ScanRequest {
  qrData: string;  // JSON string of QRPayload
  gateId: string;
  guardId: string;
  deviceId: string;
}

/** Cloud Function → Guard app: scan response */
export interface ScanResponse {
  decision: AccessDecision;
  user: {
    name: string;
    role: UserRole;
    photoURL?: string;
  };
  flags: string[];
  logId: string;
  message: string;
}

/** Guard app → Cloud Function: guard decision on PENDING scans */
export interface GuardDecisionRequest {
  logId: string;
  decision: "ALLOW" | "DENY";
  guardId: string;
}

/** Cloud Function → User app: fresh signed QR payload */
export interface QRGenerateResponse {
  qrData: string; // JSON string of QRPayload
  expiresAt: number; // Unix timestamp (ms) when this QR expires
}
