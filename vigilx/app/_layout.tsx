import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "../context/AuthContext";

/**
 * Determines the correct route for a given role + subRole.
 */
function getTargetRoute(role: string, subRole: string | null, userData: any): string {
  if (!role) return "/(auth)/login";
  const r = String(role).toLowerCase().trim();
  const sr = String(subRole || "").toLowerCase().trim();

  if (r.includes("admin")) return "/(admin)/dashboard";
  if (r.includes("guard")) return "/(guard)/scanner";
  if (r.includes("faculty")) return "/(faculty)/home";
  if (r.includes("visitor")) return "/(visitor)/status";
  if (r.includes("worker") || sr.includes("worker")) return "/(workers)/qr";

  if (r.includes("student")) {
    if (userData?.roomNumber || sr.includes("hostel") || r.includes("hostel")) {
      return "/(student)/hosteller/qr";
    }
    return "/(student)/dayscholar/qr";
  }

  console.warn("Unknown role routing fallback for:", role);
  return "/(student)/dayscholar/qr";
}

function MainLayout() {
  const { user, role, subRole, userData, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Prevent double-navigation for the same auth state
  const lastNavigatedAuthKey = useRef("");

  useEffect(() => {
    // Don't navigate while auth is still resolving
    if (loading) return;

    // Build a unique key for the current auth state
    const authKey = `${user?.uid || "none"}|${role || "none"}|${subRole || "none"}`;

    // If we've already navigated for this exact auth state, skip
    if (authKey === lastNavigatedAuthKey.current) return;

    // Read current route segment (NOT in dep array — we only care about
    // where the user IS right now, we don't want segment changes to re-trigger)
    const inAuthGroup = segments[0] === "(auth)";

    if (!user) {
      // Not authenticated — push to login if not already there
      if (!inAuthGroup) {
        lastNavigatedAuthKey.current = authKey;
        router.replace("/(auth)/login");
      }
    } else if (role) {
      // Authenticated — redirect away from auth/index screens
      const atRootOrAuth =
        inAuthGroup ||
        segments.length === 0 ||
        segments[0] === undefined;

      if (atRootOrAuth) {
        lastNavigatedAuthKey.current = authKey;
        router.replace(getTargetRoute(role, subRole, userData) as any);
      } else {
        // Already on a valid role route — mark as handled
        lastNavigatedAuthKey.current = authKey;
      }
    }
    // CRITICAL: Only depend on auth values. Do NOT include segments,
    // rootNavigationState, or router — those change on every navigation
    // and will cause infinite re-render loops.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, role, subRole, userData, loading]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#000" />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

import { DevRoleSwitcher } from "../components/DevRoleSwitcher";

export default function RootLayout() {
  return (
    <AuthProvider>
      <MainLayout />
      <DevRoleSwitcher />
    </AuthProvider>
  );
}
