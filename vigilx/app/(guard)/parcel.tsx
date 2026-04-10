import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, ActivityIndicator } from "react-native";
import { collection, doc, addDoc, updateDoc, onSnapshot, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import StudentSearch from "../../components/StudentSearch";
import { UserProfile } from "../../services/userService";

const translations = {
  student_id: { en: "Student Identification", hi: "छात्र पहचान" },
  add_parcel: { en: "Add Pending Parcel", hi: "पार्सल जोड़ें" },
  active_parcels: { en: "Active Pending Parcels", hi: "सक्रिय पार्सल" },
  no_parcels: { en: "No pending parcels for this student.", hi: "इस छात्र के लिए कोई पार्सल नहीं है।" },
  parcel_received: { en: "Parcel Received", hi: "पार्सल प्राप्त हुआ" },
  just_now: { en: "Just now", hi: "अभी" },
  mark_collected: { en: "Mark Collected", hi: "एकत्रित चिह्नित करें" },
  success: { en: "Success", hi: "सफलता" },
  error: { en: "Error", hi: "त्रुटि" },
  logged: { en: "Parcel logged and student notified!", hi: "पार्सल दर्ज किया गया और छात्र को सूचित किया गया!" },
  failed_log: { en: "Could not log parcel.", hi: "पार्सल दर्ज नहीं किया जा सका।" },
  failed_update: { en: "Could not update parcel status.", hi: "पार्सल की स्थिति अपडेट नहीं की जा सकी।" }
} as const;

const t = (key: keyof typeof translations) => {
  if (!translations[key]) return key;
  return `${translations[key].en} / ${translations[key].hi}`;
};

export default function GuardParcelHub() {
  const { user: guardUser } = useAuth();
  const [student, setStudent] = useState<UserProfile | null>(null);
  
  const [pendingParcels, setPendingParcels] = useState<any[]>([]);
  const [parcelTrackerLoading, setParcelTrackerLoading] = useState(false);

  // When a student is selected via Type-Ahead, sync their active parcels
  useEffect(() => {
    if (!student?.id) {
      setPendingParcels([]);
      return;
    }

    setParcelTrackerLoading(true);
    const q = query(
      collection(db, "parcels"),
      where("studentId", "==", student.id),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parcels = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      parcels.sort((a: any, b: any) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      setPendingParcels(parcels);
      setParcelTrackerLoading(false);
    }, (error) => {
      console.error("Parcel Listener Error:", error);
      setParcelTrackerLoading(false);
    });

    return () => unsubscribe();
  }, [student]);

  const handleStudentSelect = (selectedStudent: UserProfile) => {
    setStudent(selectedStudent);
  };

  const clearSelection = () => {
    setStudent(null);
  };

  const handleAddParcel = async () => {
    if (!student) return;

    try {
      await addDoc(collection(db, "parcels"), {
        studentId: student.id,
        studentName: student.name || "Unknown Student",
        createdBy: guardUser?.uid || "Unknown Guard",
        status: "pending",
        createdAt: serverTimestamp(),
      });
      Alert.alert(t("success"), t("logged"));
    } catch (error) {
      console.error("Failed to add parcel:", error);
      Alert.alert(t("error"), t("failed_log"));
    }
  };

  const handleMarkCollected = async (parcelId: string) => {
    try {
      const parcelRef = doc(db, "parcels", parcelId);
      await updateDoc(parcelRef, {
        status: "collected",
        collectedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      Alert.alert(t("error"), t("failed_update"));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>{t("student_id")}</Text>
      
      {!student ? (
        // Renders the type-ahead unified search experience when nobody is selected
        <StudentSearch onSelect={handleStudentSelect} />
      ) : (
        <View style={styles.studentCard}>
          <View style={styles.cardHeader}>
             <View>
                <Text style={styles.studentName}>{student.name || "Student"}</Text>
                <Text style={styles.studentRole}>
                  {student.role} • {student.Department || student.department_lowercase || 'N/A'} - {student["Roll_No."] || 'N/A'}
                </Text>
             </View>
             <TouchableOpacity style={styles.closeBtn} onPress={clearSelection}>
                <Ionicons name="close-circle" size={28} color="#999" />
             </TouchableOpacity>
          </View>
          
          {/* Quick Actions Panel directly mapped to the selected student */}
          <View style={styles.actionsPanel}>
            <TouchableOpacity style={styles.addParcelBtn} onPress={handleAddParcel}>
              <Ionicons name="cube" size={20} color="#fff" style={{marginRight: 8}}/>
              <Text style={styles.btnText}>{t("add_parcel")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {student && (
        <View style={styles.listContainer}>
          <Text style={styles.sectionTitle}>{t("active_parcels")}</Text>
          
          {parcelTrackerLoading && <ActivityIndicator color="#000" style={{marginTop: 20}}/>}
          
          {!parcelTrackerLoading && pendingParcels.length === 0 && (
             <Text style={styles.emptyText}>{t("no_parcels")}</Text>
          )}

          {!parcelTrackerLoading && pendingParcels.length > 0 && (
             <FlatList 
               data={pendingParcels}
               keyExtractor={item => item.id}
               contentContainerStyle={{ paddingBottom: 100 }}
               renderItem={({item}) => {
                  const date = item.createdAt ? new Date(item.createdAt.toMillis()).toLocaleString() : t("just_now");
                  
                  return (
                    <View style={styles.parcelCard}>
                      <View>
                        <Text style={styles.parcelLabel}>{t("parcel_received")}</Text>
                        <Text style={styles.parcelDate}>{date}</Text>
                      </View>
                      <TouchableOpacity style={styles.collectBtn} onPress={() => handleMarkCollected(item.id)}>
                        <Text style={styles.collectBtnText}>{t("mark_collected")}</Text>
                      </TouchableOpacity>
                    </View>
                  )
               }}
             />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F7",
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
  },
  studentCard: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: "#4CAF50"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  closeBtn: {
    padding: 4,
  },
  studentName: {
    fontSize: 22,
    fontWeight: "bold",
  },
  studentRole: {
    color: "#666",
    fontSize: 14,
    textTransform: "capitalize"
  },
  actionsPanel: {
    marginTop: 10,
  },
  addParcelBtn: {
    backgroundColor: "#333",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
  },
  btnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  listContainer: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  emptyText: {
    color: "#888",
    fontStyle: "italic",
    marginTop: 10,
  },
  parcelCard: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  parcelLabel: {
    fontWeight: "600",
    fontSize: 16,
  },
  parcelDate: {
    color: "#777",
    fontSize: 12,
    marginTop: 4,
  },
  collectBtn: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#4CAF50",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  collectBtnText: {
    color: "#4CAF50",
    fontWeight: "bold",
    fontSize: 14,
  }
});
