import { ActivityIndicator, View } from "react-native";

export default function IndexScreen() {
  // Navigation is smartly handled by app/_layout.tsx MainLayout component.
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#000" />
    </View>
  );
}
