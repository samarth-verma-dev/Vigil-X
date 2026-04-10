import { View, Text, StyleSheet, TouchableOpacity, Image, Alert } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { signOut } from "firebase/auth";
import { useEffect, useState, useRef } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../services/firebase";
import { useAuth } from "../../../context/AuthContext";
import { useSecureQR } from "../../../hooks/useSecureQR";
import { Ionicons } from "@expo/vector-icons";

export default function DayScholarQR() {
  const { user, userData } = useAuth();
  const { qrData, loading: qrLoading } = useSecureQR();
  const [activeParcels, setActiveParcels] = useState(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "parcels"),
      where("studentId", "==", user.uid),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveParcels(snapshot.docs.length);
      
      if (!isInitialLoad.current) {
        const newParcels = snapshot.docChanges().filter(change => change.type === "added");
        if (newParcels.length > 0) {
          Alert.alert(
            "New Parcel Arrived! 📦", 
            "You have a new parcel waiting for pickup at the guard gate."
          );
        }
      }
      
      isInitialLoad.current = false;
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <View style={styles.container}>
      {/* Parcel Alert Banner */}
      {activeParcels > 0 && (
        <View style={styles.parcelBanner}>
          <Ionicons name="cube" size={24} color="#fff" />
          <Text style={styles.parcelText}>
            You have {activeParcels} parcel{activeParcels > 1 ? "s" : ""} ready for pickup!
          </Text>
        </View>
      )}

      <Text style={styles.title}>Day Scholar QR</Text>
      
      {userData && (
        <View style={styles.profileContainer}>
          <Image 
            source={{ uri: userData.photoURL || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" }} 
            style={styles.profileImage} 
          />
          <Text style={styles.profileName}>{userData.name}</Text>
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
  container: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 10 },
  parcelBanner: {
    position: "absolute",
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: "#F44336",
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  parcelText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
    marginLeft: 10,
    flex: 1,
  },
  logoutButton: {
    marginTop: 40,
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 8,
  },
  logoutText: { fontWeight: "bold" },
  qrContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    marginTop: 20,
  },
  profileContainer: {
    alignItems: "center",
    marginBottom: 10,
    marginTop: 20,
  },
  profileImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#eee",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "600",
    color: "#333",
  },
});