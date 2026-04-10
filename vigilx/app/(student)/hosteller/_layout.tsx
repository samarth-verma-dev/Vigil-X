import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../../context/AuthContext";
import { View, ActivityIndicator } from "react-native";

export default function HostellerLayout() {
  const { role, subRole, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  const normalizedRole = String(role || "").toLowerCase().trim();
  const normalizedSubRole = String(subRole || "").toLowerCase().trim();

  if (normalizedRole !== "student" || !normalizedSubRole.includes("hostel")) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#1976D2",
        tabBarStyle: {
          borderTopWidth: 1,
          borderColor: "#E0E0E0",
          backgroundColor: "#ffffff",
          paddingBottom: 5,
        },
      }}
    >
      <Tabs.Screen
        name="qr"
        options={{
          title: "QR ID",
          tabBarIcon: ({ color }) => <Ionicons name="qr-code" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="parcel"
        options={{
          title: "Parcels",
          tabBarIcon: ({ color }) => <Ionicons name="cube" size={26} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mess"
        options={{
          title: "Mess",
          tabBarIcon: ({ color }) => <Ionicons name="restaurant" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nightout"
        options={{
          title: "Night-Out",
          tabBarIcon: ({ color }) => <Ionicons name="moon" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="emergency"
        options={{
          title: "Emergency",
          tabBarIcon: ({ color }) => <Ionicons name="alert-circle" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}