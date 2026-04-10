import React, { useState } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../context/AuthContext";
import { PROTOTYPE_MODE } from "../../config/devAuth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../services/firebase";

export default function VisitorScreen() {
  const { user: guardUser } = useAuth();
  const [visitorName, setVisitorName] = useState("");
  const [visitorPhone, setVisitorPhone] = useState("");
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreateVisitor = async () => {
    if (!visitorName || !visitorPhone || !purpose) {
      Alert.alert("Missing Fields", "Please fill all details to create a visitor pass.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: visitorName,
        phone: visitorPhone,
        purpose: purpose,
        hostUserId: guardUser?.uid || "unknown-guard",
        validHours: 4,
        gates: ["main-gate"],
      };

      if (__DEV__ && PROTOTYPE_MODE) {
         // 🚧 BYPASS: Push locally via Dev Rule Bypass
         const simulatedTicket = Date.now().toString();
         await setDoc(doc(db, "visitor_sessions", simulatedTicket), {
            ...payload,
            validTill: Date.now() + (4 * 60 * 60 * 1000)
         });
         Alert.alert("Prototype Bypass", `Visitor Pass Created Native!\nValid till: ${new Date(Date.now() + (4 * 60 * 60 * 1000)).toLocaleTimeString()}`);
         setVisitorName("");
         setVisitorPhone("");
         setPurpose("");
         setLoading(false);
         return;
      }

      const response = await fetch("https://asia-south1-vigil-x.cloudfunctions.net/createVisitorSession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create visitor pass");
      }

      Alert.alert("Success", `Visitor Pass Created!\nValid till: ${new Date(data.validTill).toLocaleTimeString()}`);
      
      // Reset form
      setVisitorName("");
      setVisitorPhone("");
      setPurpose("");

    } catch (error: any) {
      console.error("Visitor creation error:", error);
      Alert.alert("Error", error.message);
    } finally {
      if (!(__DEV__ && PROTOTYPE_MODE)) setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
       <View style={styles.header}>
         <Text style={styles.title}>Register Visitor</Text>
         <Text style={styles.subtitle}>Issue temporary gate passes</Text>
       </View>

       <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
         
         <View style={styles.formGroup}>
           <Text style={styles.label}>Visitor Name</Text>
           <TextInput 
             style={styles.input} 
             placeholder="John Doe"
             value={visitorName}
             onChangeText={setVisitorName}
           />
         </View>

         <View style={styles.formGroup}>
           <Text style={styles.label}>Phone Number</Text>
           <TextInput 
             style={styles.input} 
             placeholder="9876543210"
             keyboardType="phone-pad"
             value={visitorPhone}
             onChangeText={setVisitorPhone}
           />
         </View>

         <View style={styles.formGroup}>
           <Text style={styles.label}>Purpose of Visit</Text>
           <TextInput 
             style={styles.input} 
             placeholder="Meeting, Event, etc."
             value={purpose}
             onChangeText={setPurpose}
           />
         </View>

         <TouchableOpacity 
           style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
           onPress={handleCreateVisitor}
           disabled={loading}
         >
           {loading ? (
             <ActivityIndicator color="#fff" />
           ) : (
             <Text style={styles.submitText}>Issue Visitor Pass</Text>
           )}
         </TouchableOpacity>

       </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F6F8" },
  header: { padding: 24, paddingTop: 60, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E0E0E0" },
  title: { fontSize: 26, fontWeight: "bold", color: "#111827" },
  subtitle: { fontSize: 14, color: "#6B7280", marginTop: 4 },
  scrollContent: { padding: 24, paddingBottom: 100 },
  formGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#D1D5DB", borderRadius: 8, padding: 12, fontSize: 16, color: "#111827" },
  submitButton: { backgroundColor: "#000", paddingVertical: 16, borderRadius: 8, alignItems: "center", marginTop: 20 },
  submitButtonDisabled: { opacity: 0.7 },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "bold" }
});
