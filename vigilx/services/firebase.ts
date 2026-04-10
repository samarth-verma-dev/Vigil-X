import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
<<<<<<< Updated upstream
// @ts-ignore
import { getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
=======
>>>>>>> Stashed changes

// 🔥 Auth (React Native compatible)
import {
  initializeAuth,
  getReactNativePersistence,
  connectAuthEmulator,
} from "firebase/auth";

// 🔥 Firestore
import {
  getFirestore,
  connectFirestoreEmulator,
} from "firebase/firestore";

// 🔥 Functions
import {
  getFunctions,
  connectFunctionsEmulator,
} from "firebase/functions";

// ─── Firebase Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyApK-TgNqNNTkDWIewl5tjkT80IRBCASmg",
  authDomain: "vigil-x.firebaseapp.com",
  projectId: "vigil-x",
  storageBucket: "vigil-x.firebasestorage.app",
  messagingSenderId: "687924008406",
  appId: "1:687924008406:web:e659cffedaf1f4fe200077",
};

<<<<<<< Updated upstream
=======
// ─── Initialize App ───────────────────────────────────────────
>>>>>>> Stashed changes
const app = initializeApp(firebaseConfig);

// ─── Initialize Auth (FIXED ✅) ───────────────────────────────
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// ─── Initialize Services ──────────────────────────────────────
export const db = getFirestore(app);
<<<<<<< Updated upstream
export const functions = getFunctions(app, "asia-south1");
=======
export const functions = getFunctions(app, "asia-south1");

// ─── Emulator Config ──────────────────────────────────────────
const USE_EMULATOR = __DEV__; // safer than hardcoding true

// ⚠️ CHANGE THIS BASED ON DEVICE
// Android Emulator → "10.0.2.2"
// iOS Simulator → "localhost"
// Physical Phone → your PC IP (e.g. "192.168.x.x")

const EMULATOR_HOST = "10.0.72.212";

if (USE_EMULATOR) {
  try {
    // 🔥 Firestore Emulator
    connectFirestoreEmulator(db, EMULATOR_HOST, 8080);

    // 🔥 Auth Emulator
    connectAuthEmulator(auth, `http://${EMULATOR_HOST}:9099`, {
      disableWarnings: true,
    });

    // 🔥 Functions Emulator
    connectFunctionsEmulator(functions, EMULATOR_HOST, 5001);

    console.log(`🔥 Connected to Firebase Emulator @ ${EMULATOR_HOST}`);
  } catch (error) {
    console.log("⚠️ Emulator connection error:", error);
  }
}
>>>>>>> Stashed changes
