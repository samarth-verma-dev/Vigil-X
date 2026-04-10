import { StyleSheet, Text, View, Image, TouchableOpacity } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { signOut } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { useSecureQR } from "../../hooks/useSecureQR";

export default function WorkersQR() {
  const { userData } = useAuth();
  const { qrData, loading: qrLoading } = useSecureQR();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Worker Pass</Text>
      <Text style={styles.subtitle}>Show this to the guard at the gate</Text>

      {userData && (
        <View style={styles.profileContainer}>
          <Image 
            source={{ uri: userData.photoURL || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" }} 
            style={styles.profileImage} 
          />
          <Text style={styles.profileName}>{userData.name}</Text>
          <Text style={styles.profileRole}>{userData.workerType}</Text>
        </View>
      )}

      <View style={styles.qrContainer}>
        {qrLoading || !qrData ? (
          <Text>Loading Secure QR...</Text>
        ) : (
          <QRCode value={qrData} size={220} backgroundColor="transparent" />
        )}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={() => signOut(auth)}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff", padding: 24 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#666", marginBottom: 32, textAlign: "center" },
  qrContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginBottom: 32,
  },
  profileContainer: { alignItems: "center", marginBottom: 24 },
  profileImage: { width: 90, height: 90, borderRadius: 45, marginBottom: 12, borderWidth: 2, borderColor: "#e1e1e1" },
  profileName: { fontSize: 22, fontWeight: "bold", color: "#2c3e50" },
  profileRole: { fontSize: 16, color: "#666", textTransform: "capitalize", marginTop: 4 },
  logoutButton: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 8,
  },
  logoutText: { fontWeight: "bold" },
});
