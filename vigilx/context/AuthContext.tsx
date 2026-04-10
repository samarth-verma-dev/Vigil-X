import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useReducer } from "react";
import { auth, db } from "../services/firebase";
import { normalizeUserDocument } from "../services/userNormalizer";
import { UserRole, User as SharedUser } from "../types/shared";

import { DEV_AUTH_BYPASS, mockUser, PROTOTYPE_MODE } from "../config/devAuth";

// Shape of data this context provides
export type AuthState = {
  user: User | null;
  role: UserRole | null;
  subRole: string | null;        // "hosteller" | "day scholar" | workerType | null
  userData: SharedUser | null;
  loading: boolean;
  switchDevRole?: (role: UserRole, subRole?: string) => void;
  loginPrototypeUser?: (email: string) => void;
};

type AuthAction =
  | { type: "SET_AUTH"; user: User; role: UserRole | null; subRole: string | null; userData: SharedUser | null }
  | { type: "CLEAR_AUTH" }
  | { type: "SET_LOADING" };

const initialState: AuthState = {
  user: null,
  role: null,
  subRole: null,
  userData: null,
  loading: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SET_AUTH":
      return {
        ...state,
        user: action.user,
        role: action.role,
        subRole: action.subRole,
        userData: action.userData,
        loading: false,
      };
    case "CLEAR_AUTH":
      return {
        ...state,
        user: null,
        role: null,
        subRole: null,
        userData: null,
        loading: false,
      };
    case "SET_LOADING":
      return { ...state, loading: true };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthState>(initialState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Expose role switcher explicitly in dev
  const switchDevRole = (role: UserRole, subRole?: string) => {
    if (!__DEV__ || !DEV_AUTH_BYPASS) return;
    
    // Create new proxy user based on toggled roles
    const nextUser = { ...mockUser, role, sub_role: subRole || null, name: `Dev ${role} ${subRole || ""}` };
    
    dispatch({
      type: "SET_AUTH",
      user: { uid: nextUser.uid } as User,
      role: nextUser.role as UserRole,
      subRole: nextUser.sub_role || null,
      userData: nextUser as SharedUser,
    });
  };

  // Prototype specific interactive bypass
  const loginPrototypeUser = async (email: string) => {
    if (!__DEV__ || !PROTOTYPE_MODE) return;
    
    const e = email.toLowerCase();
    let role: UserRole = "student";
    let subRole: string | null = null;

    if (e.includes("admin")) role = "admin";
    else if (e.includes("guard")) role = "guard";
    else if (e.includes("faculty")) role = "faculty";
    else if (e.includes("worker")) role = "worker";
    else if (e.includes("visitor")) role = "visitor";
    else if (e.includes("hostel")) { role = "student"; subRole = "hosteller"; }
    else if (e.includes("day")) { role = "student"; subRole = "day scholar"; }

    console.log(`[PrototypeAuth] Parsed email '${email}' -> role: ${role}, subRole: ${subRole}`);

    let fetchedName = `Prototype ${role}`;
    let fetchedPhotoUrl = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";
    let fetchedUid = `proto-${Math.floor(Math.random() * 10000)}`;

    try {
      const { collection, query, where, getDocs } = require("firebase/firestore");
      const q1 = query(collection(db, "users"), where("email", "==", email));
      const q2 = query(collection(db, "usersnew"), where("email", "==", email));
      
      const [snap1, snap2] = await Promise.all([
          getDocs(q1).catch(() => ({ empty: true, docs: [] })),
          getDocs(q2).catch(() => ({ empty: true, docs: [] }))
      ]);
      
      let userDoc = null;
      if (!snap1.empty && snap1.docs.length > 0) userDoc = snap1.docs[0];
      else if (!snap2.empty && snap2.docs.length > 0) userDoc = snap2.docs[0];
      
      if (userDoc) {
        const data = userDoc.data();
        fetchedName = data.name || fetchedName;
        fetchedPhotoUrl = data.photoURL || fetchedPhotoUrl;
        fetchedUid = userDoc.id;
        role = data.role as UserRole || role;
        subRole = data.sub_role || subRole;
      }
    } catch (err) {
      console.error("[PrototypeAuth] Error fetching user:", err);
    }

    const protoUser = {
      ...mockUser,
      uid: fetchedUid,
      email,
      name: fetchedName,
      role,
      sub_role: subRole,
      photoURL: fetchedPhotoUrl
    };

    dispatch({
      type: "SET_AUTH",
      user: { uid: protoUser.uid, email: protoUser.email } as User,
      role: protoUser.role as UserRole,
      subRole: protoUser.sub_role || null,
      userData: protoUser as SharedUser,
    });
  };

  useEffect(() => {
    let isMounted = true;

    if (__DEV__ && DEV_AUTH_BYPASS) {
      // 🚀 INJECT MOCK USER BYPASS
      console.log(`[DevAuth] Bypass Active: Setting mock user as ${mockUser.role} / ${mockUser.sub_role}`);
      dispatch({
        type: "SET_AUTH",
        user: { uid: mockUser.uid } as User, // Mock minimal User
        role: mockUser.role as UserRole,
        subRole: mockUser.sub_role || null,
        userData: mockUser as SharedUser,
      });
      return;
    }
    
    // Stop standard Firebase auth listeners if we're solely prototyping interactive inputs
    if (__DEV__ && PROTOTYPE_MODE) {
      console.log(`[PrototypeAuth] Standby Mode Active. Waiting for Interactive Login...`);
      dispatch({ type: "CLEAR_AUTH" }); 
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch role from Firestore, trying users then usersnew
          let userDoc = await getDoc(doc(db, "users", firebaseUser.uid)).catch(() => null);
          if (!userDoc || !userDoc.exists()) {
             userDoc = await getDoc(doc(db, "usersnew", firebaseUser.uid)).catch(() => null);
          }

          if (isMounted) {
            if (userDoc && userDoc.exists()) {
              const raw = userDoc.data();
              const normalized = normalizeUserDocument(raw);
              console.log("[AuthContext] uid:", firebaseUser.uid, "role:", normalized.role, "sub_role:", normalized.sub_role);
              dispatch({
                type: "SET_AUTH",
                user: firebaseUser,
                role: (normalized.role as UserRole) || null,
                subRole: normalized.sub_role || null,
                userData: normalized as SharedUser,
              });
            } else {
              console.error("[AuthContext] User document not found for uid:", firebaseUser.uid, "Forcing signout.");
              auth.signOut();
              dispatch({ type: "CLEAR_AUTH" });
            }
          }
        } catch (err) {
          console.error("[AuthContext] Error fetching user role:", err);
          if (isMounted) {
            // Keep user loaded but with no role to show potential UI errors or allow retry
            dispatch({
              type: "SET_AUTH",
              user: firebaseUser,
              role: null,
              subRole: null,
              userData: null,
            });
          }
        }
      } else {
        if (isMounted) {
          dispatch({ type: "CLEAR_AUTH" });
        }
      }
    });

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // inject the switch dev role
  const providerValue = {
    ...state,
    ...(__DEV__ && DEV_AUTH_BYPASS ? { switchDevRole } : {}),
    ...(__DEV__ && PROTOTYPE_MODE ? { loginPrototypeUser } : {}),
  }

  return (
    <AuthContext.Provider value={providerValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}