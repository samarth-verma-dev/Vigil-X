import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { signOut } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";

export default function FacultyHome() {
  const { user } = useAuth();

  async function handleLogout() {
    await signOut(auth);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Welcome 👋</Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>Faculty</Text>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },
  role: {
    fontSize: 14,
    color: "#fff",
    backgroundColor: "#1a1a2e",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 40,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: "#000",
    padding: 14,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});