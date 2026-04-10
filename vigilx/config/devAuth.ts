import { UserRole } from "../types/shared";

// 🚀 Toggle this to TRUE to bypass the login screen completely in __DEV__
export const DEV_AUTH_BYPASS = false;

// 🧪 Toggle this to TRUE to turn the Login screen into a Prototype String-Matcher purely bypassing actual Firebase verification
export const PROTOTYPE_MODE = true;

// 🧑 MOCK USER IDENTITY
// The app will boot using these exact details instead of calling Firestore
export const mockUser = {
  uid: "dev-mock-uid-001",
  name: "Local Dev User",
  email: "dev@vigilx.app",
  role: "student" as UserRole, // options: "student", "guard", "admin", "faculty", "worker", "visitor"
  sub_role: "hosteller",       // options for student: "hosteller", "day scholar". For worker: "mess", "housekeeping", etc.
  phone: "+910000000000",
  // specific mock properties
  studentID: "SAU/DEV/2026",
  Roll_No: "001",
  Department: "DEV",
  status: "active",
  permissions: { gates: ["*"] },
  deviceId: "dev-device",
  faceEmbedding: false,
  photoURL: "https://ui-avatars.com/api/?name=Local+Dev",
  fcmToken: "",
  isActive: true,
  isInside: true,
  createdAt: new Date(),
};
