import React, { useState } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { logEmergencyFlag } from "../../../services/flagService";
import { useAuth } from "../../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function EmergencyExit() {
  const { user, userData } = useAuth();
  const [reason, setReason] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert("Missing Info", "Please provide a reason for the emergency exit.");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Log the emergency exit state in Firestore
      const explicitStudentId = userData?.studentId || userData?.["Roll_No."] || "Unknown ID";
      const explicitName = userData?.name || user?.displayName || user?.email || "Unknown Student";

      await addDoc(collection(db, "emergency_logs"), {
        uid: user?.uid || "",
        studentId: explicitStudentId,
        name: explicitName,
        email: user?.email || "",
        reason: reason.trim(),
        contactInfo: contactInfo.trim(),
        status: "active",
        hasExited: false, // For scanner direction logic
        createdAt: serverTimestamp()
      });

      // 2. Trigger Admin Violation Flag Warning Engine natively
      await logEmergencyFlag(
        explicitStudentId,
        explicitName,
        reason.trim(),
        user?.uid || "" // passing UID just in case flagService internally relies on it but flagService stores it as studentId.
      );
      
      Alert.alert("Emergency Logged", "You may proceed to the gate explicitly. Security has been notified.");
      setReason("");
      setContactInfo("");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not submit your emergency exit.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Emergency Exit</Text>
        <Text style={styles.headerSubtitle}>By-pass constraints strictly for emergencies.</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.warningBox}>
          <Ionicons name="warning-outline" size={24} color="#991B1B" />
          <Text style={styles.warningText}>No admin approval needed. You will have immediate clearance at the gate.</Text>
        </View>

        <Text style={styles.sectionTitle}>Emergency Details</Text>
        
        <View style={styles.inputGroup}>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Nature of emergency (Mandatory)"
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <TextInput
            style={styles.input}
            placeholder="Emergency Contact Number (Optional)"
            value={contactInfo}
            onChangeText={setContactInfo}
            keyboardType="phone-pad"
          />
        </View>

        <TouchableOpacity 
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
          onPress={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6}}>
                <Ionicons name="exit-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Trigger Emergency Exit</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#B91C1C",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 4,
  },
  formContainer: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    marginTop: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#E5E7EB",
  },
  warningBox: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "500",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 16,
  },
  inputGroup: {
    gap: 12,
  },
  input: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
  },
  textArea: {
    minHeight: 100,
  },
  submitBtn: {
    backgroundColor: "#DC2626",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    flexDirection: "row"
  },
  submitBtnDisabled: {
    backgroundColor: "#FCA5A5",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
});
