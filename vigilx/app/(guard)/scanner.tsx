import React, { useState, useRef, useEffect } from "react";
import { View, Text, StyleSheet, Alert, TouchableOpacity, Modal, Image } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { signOut } from "firebase/auth";
import { auth, db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { PROTOTYPE_MODE } from "../../config/devAuth";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";

const translations = {
  point_qr: { en: "Point at QR Code", hi: "क्यूआर कोड की ओर इंगित करें" },
  logout: { en: "Logout", hi: "लॉग आउट" },
  processing: { en: "Processing...", hi: "प्रक्रिया हो रही है..." },
  grant_permission: { en: "Grant Permission", hi: "अनुमति दें" },
  camera_permission: { en: "We need your permission to show the camera", hi: "कैमरा अनुमति की आवश्यकता है" },
  allowed: { en: "Access Granted", hi: "प्रवेश स्वीकृत" },
  denied: { en: "Access Denied", hi: "प्रवेश अस्वीकृत" },
  pending: { en: "Pending Approval", hi: "अनुमोदन लंबित" },
  warning: { en: "Warning", hi: "चेतावनी" },
  error: { en: "Error", hi: "त्रुटि" },
  failed_scan: { en: "Failed to process scan.", hi: "स्कैन संसाधित करने में विफल।" }
} as const;

const t = (key: keyof typeof translations) => {
  if (!translations[key]) return key;
  return `${translations[key].en} / ${translations[key].hi}`;
};

export default function GuardScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [idCardData, setIdCardData] = useState<any>(null);
  const { user: guardUser } = useAuth();
  
  const lastScannedRef = useRef<{ data: string; time: number } | null>(null);

  // Auto-fade 5-second timer
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (idCardData) {
      timeout = setTimeout(() => {
        setIdCardData(null);
        setScanned(false);
      }, 5000);
    }
    return () => clearTimeout(timeout);
  }, [idCardData]);

  if (!permission) return <View />;

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>{t("camera_permission")}</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>{t("grant_permission")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    const now = Date.now();
    if (
      lastScannedRef.current &&
      lastScannedRef.current.data === data &&
      now - lastScannedRef.current.time < 5000
    ) {
      return;
    }

    if (processing) return;
    
    lastScannedRef.current = { data, time: now };
    setScanned(true);
    setProcessing(true);

    try {
      // 🚧 PROTOTYPE BYPASS 🚧
      if (__DEV__ && PROTOTYPE_MODE) {
         let parsed: any;
         try { parsed = JSON.parse(data); } catch(e) { parsed = { uid: data }; }
         
         const userDoc = await getDoc(doc(db, "users", parsed.uid || data));
         let idData;
         
         if (userDoc.exists()) {
             idData = userDoc.data();
         } else {
             // Mock fallback if user doesn't exist
             idData = {
                 name: "Unknown Prototype",
                 role: parsed.role || "student",
                 studentId: parsed.uid?.substring(0, 8) || "N/A",
                 sub_role: "N/A",
                 photoURL: null
             };
         }
         
         // 🚨 ADD LOG CREATION HERE FOR PROTOTYPE BYPASS
         try {
           await addDoc(collection(db, "logs"), {
              userId: parsed.uid || data,
              userName: idData.name || "Unknown",
              userRole: idData.role || "student",
              gateId: "main-gate",
              timestamp: new Date(),
              systemDecision: "ALLOW",
              flags: ["PROTOTYPE_BYPASS"],
              guardId: guardUser?.uid || "unknown-guard"
           });
         } catch (err) {
           console.error("Failed to create bypass log", err);
         }

         setIdCardData(idData);
         setProcessing(false);
         return; 
      }

      // PRODUCTION PIPELINE
      const payload = {
        qrData: data,
        gateId: "main-gate", 
        guardId: guardUser?.uid || "unknown-guard",
        deviceId: "guard-scanner-1", 
      };

      const response = await fetch("https://asia-south1-vigil-x.cloudfunctions.net/scanQR", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
         Alert.alert(t("denied"), result.message || "Invalid QR or server error");
         return;
      }

      const { decision, message, user } = result;

      let displayStatus = t("warning");
      if (decision === "ALLOW") displayStatus = t("allowed");
      else if (decision === "DENY") displayStatus = t("denied");
      else if (decision === "PENDING") displayStatus = t("pending");

      const userName = user?.name || "Unknown User";
      Alert.alert(displayStatus, `${userName}\n\n${message}`);

    } catch (error: any) {
      console.error("Scan error:", error);
      Alert.alert(t("error"), t("failed_scan"));
    } finally {
      if (!(__DEV__ && PROTOTYPE_MODE)) {
        setTimeout(() => {
          setProcessing(false);
          setScanned(false);
        }, 2000);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
      />
      <View style={styles.overlay}>
        <View style={styles.header}>
          <Text style={styles.headerText}>{t("point_qr")}</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#fff" />
          <Text style={styles.logoutBtnText}>{t("logout")}</Text>
        </TouchableOpacity>

        <View style={styles.reticle}>
          <Ionicons name="scan-outline" size={250} color={scanned ? "#4CAF50" : "#FFF"} />
        </View>
        <View style={styles.footer}>
          {processing && (
            <Text style={styles.processingText}>{t("processing")}</Text>
          )}
        </View>
      </View>

      {/* ID Card Modal */}
      <Modal visible={!!idCardData} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.idCardContainer}>
            <View style={styles.idHeader}>
              <Text style={styles.idHeaderText}>VIGILX ACCESS</Text>
            </View>
            
            <View style={styles.idBody}>
              <Image 
                source={{ uri: idCardData?.photoURL || "https://cdn-icons-png.flaticon.com/512/3135/3135715.png" }}
                style={styles.idPhoto}
              />
              <Text style={styles.idName}>{idCardData?.name}</Text>
              
              <View style={styles.idAttrRow}>
                <Text style={styles.idAttrLabel}>Role:</Text>
                <Text style={styles.idAttrVal}>{String(idCardData?.role || 'N/A').toUpperCase()}</Text>
              </View>

              {idCardData?.Department && (
                <View style={styles.idAttrRow}>
                  <Text style={styles.idAttrLabel}>Department:</Text>
                  <Text style={styles.idAttrVal}>{idCardData.Department}</Text>
                </View>
              )}

              {idCardData?.Roll_No && (
                <View style={styles.idAttrRow}>
                  <Text style={styles.idAttrLabel}>Roll No:</Text>
                  <Text style={styles.idAttrVal}>{idCardData.Roll_No}</Text>
                </View>
              )}

              {(idCardData?.studentId || idCardData?.employeeId) && (
                <View style={styles.idAttrRow}>
                  <Text style={styles.idAttrLabel}>ID Number:</Text>
                  <Text style={styles.idAttrVal}>{idCardData.studentId || idCardData.employeeId}</Text>
                </View>
              )}
            </View>

            <View style={styles.idFooter}>
               <TouchableOpacity style={[styles.idButton, { backgroundColor: "#4CAF50" }]} onPress={() => { setIdCardData(null); setScanned(false); }}>
                 <Ionicons name="checkmark-circle-outline" size={20} color="#fff" style={{marginRight: 6}} />
                 <Text style={styles.idButtonText}>Allow Access</Text>
               </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center" },
  message: { textAlign: "center", paddingBottom: 10, fontSize: 16 },
  button: { backgroundColor: "#000", padding: 14, borderRadius: 8, marginHorizontal: 30 },
  buttonText: { color: "#fff", textAlign: "center", fontWeight: "bold" },
  overlay: { flex: 1, backgroundColor: "transparent", justifyContent: "space-between", alignItems: "center" },
  header: { marginTop: 60, padding: 20, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10 },
  headerText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  logoutBtn: { position: "absolute", top: 60, right: 20, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  logoutBtnText: { color: "#fff", fontWeight: "bold", marginLeft: 4 },
  reticle: { flex: 1, justifyContent: "center", alignItems: "center" },
  footer: { marginBottom: 60 },
  processingText: { color: "#fff", fontSize: 16, backgroundColor: "rgba(0,0,0,0.6)", padding: 10, borderRadius: 8, overflow: "hidden" },
  
  // ID Card Styles
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "center", alignItems: "center", padding: 20 },
  idCardContainer: { width: "100%", maxWidth: 360, backgroundColor: "#fff", borderRadius: 16, overflow: "hidden", elevation: 10, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10 },
  idHeader: { backgroundColor: "#111827", padding: 16, alignItems: "center" },
  idHeaderText: { color: "#fff", fontSize: 18, fontWeight: "800", letterSpacing: 2 },
  idBody: { padding: 24, alignItems: "center" },
  idPhoto: { width: 120, height: 120, borderRadius: 60, borderWidth: 4, borderColor: "#E5E7EB", marginBottom: 16 },
  idName: { fontSize: 24, fontWeight: "bold", color: "#111827", marginBottom: 20, textAlign: "center" },
  idAttrRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  idAttrLabel: { fontSize: 15, color: "#6B7280", fontWeight: "600" },
  idAttrVal: { fontSize: 15, color: "#111827", fontWeight: "bold" },
  idFooter: { flexDirection: "row", padding: 16, backgroundColor: "#F9FAFB", borderTopWidth: 1, borderTopColor: "#E5E7EB", justifyContent: "space-between" },
  idButton: { flex: 1, flexDirection: "row", paddingVertical: 14, borderRadius: 8, justifyContent: "center", alignItems: "center", marginHorizontal: 6 },
  idButtonText: { color: "#fff", fontWeight: "bold", fontSize: 16 }
});
