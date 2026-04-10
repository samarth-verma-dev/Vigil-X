import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { View, ActivityIndicator } from "react-native";

export default function AdminLayout() {
  const { role, loading } = useAuth();

  // Show loading while auth state is resolving
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1976D2" />
      </View>
    );
  }

  // Role guard — MainLayout handles the actual redirect logic,
  // so we just render nothing here to avoid a redirect loop
  if (String(role).toLowerCase().trim() !== "admin") {
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
        name="dashboard"
        options={{
          title: "Approvals",
          tabBarIcon: ({ color }) => <Ionicons name="document-text-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="flags"
        options={{
          title: "Flags",
          tabBarIcon: ({ color }) => <Ionicons name="warning-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
