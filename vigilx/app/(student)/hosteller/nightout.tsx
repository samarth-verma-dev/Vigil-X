import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView } from "react-native";
import { collection, addDoc, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { logViolationFlag } from "../../../services/flagService";
import { useAuth } from "../../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform } from "react-native";

export default function NightOutPermission() {
  const { user, userData } = useAuth();
  
  // Form State
  const [reason, setReason] = useState("");
  const [startDateTime, setStartDateTime] = useState(new Date());
  const [returnDateTime, setReturnDateTime] = useState(new Date());
  
  // Picker State
  const [showPicker, setShowPicker] = useState(false);
  const [pickerMode, setPickerMode] = useState<'date' | 'time'>('date');
  const [pickerTarget, setPickerTarget] = useState<'start' | 'return'>('start');
  
  const [submitting, setSubmitting] = useState(false);
  
  // Requests State
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    
    const q = query(collection(db, "night_out_requests"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort newest requests first
      fetchedRequests.sort((a: any, b: any) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      
      setRequests(fetchedRequests);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching permissions:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const onChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
    }
    
    if (selectedDate) {
      if (pickerTarget === 'start') {
        const currentDate = new Date(startDateTime);
        if (pickerMode === 'date') {
          currentDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        } else {
          currentDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
        }
        setStartDateTime(currentDate);
      } else {
        const currentDate = new Date(returnDateTime);
        if (pickerMode === 'date') {
          currentDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
        } else {
          currentDate.setHours(selectedDate.getHours(), selectedDate.getMinutes());
        }
        setReturnDateTime(currentDate);
      }
    }
  };

  const showMode = (mode: 'date' | 'time', target: 'start' | 'return') => {
    setPickerMode(mode);
    setPickerTarget(target);
    setShowPicker(true);
  };

  const handleSubmit = async () => {
    if (!reason.trim()) {
      Alert.alert("Missing Info", "Please provide a valid reason.");
      return;
    }

    // 🚨 Validation Rule 1: Request must be BEFORE 7 PM (19:00)
    const currentHour = new Date().getHours();
    if (currentHour >= 19) {
      Alert.alert("Curfew Protected", "Night-out requests must be submitted at least 3 hours before curfew (before 7:00 PM).");
      return;
    }

    // 🚨 Validation Rule 2: Chronological Ordering
    if (returnDateTime <= startDateTime) {
      Alert.alert("Invalid Times", "Your return time must be strictly after your departure time.");
      return;
    }

    setSubmitting(true);
    try {
      const fmtStartDate = startDateTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const fmtStartTime = startDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const fmtReturnDate = returnDateTime.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const fmtReturnTime = returnDateTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

      await addDoc(collection(db, "night_out_requests"), {
        uid: user?.uid || "",
        studentId: userData?.studentId || userData?.["Roll_No."] || "Unknown ID",
        name: userData?.name || user?.displayName || user?.email || "Unknown Student",
        email: user?.email || "",
        reason: reason.trim(),
        startDate: fmtStartDate,
        startTime: fmtStartTime,
        returnDate: fmtReturnDate + " (" + fmtReturnTime + ")",
        status: "pending",
        createdAt: serverTimestamp()
      });
      
      // 🚨 Check if submission is past 7:00 PM (19:00 hours)
      const currentHour = new Date().getHours();
      if (currentHour >= 19) {
        await logViolationFlag(
          user?.uid || "Unknown UID",
          user?.displayName || user?.email || "Unknown Student",
          "late_request"
        );
      }
      
      Alert.alert("Success", "Your night-out request has been submitted to administration.");
      setReason("");
      setStartDateTime(new Date());
      setReturnDateTime(new Date());
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not submit your request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      default: return '#FF9800'; // Pending
    }
  };

  const renderRequestItem = ({ item }: { item: any }) => {
    const statusColor = getStatusColor(item.status);
    
    // Format creation time
    let reqDate = "Unknown";
    if (item.createdAt?.toDate) {
      reqDate = item.createdAt.toDate().toLocaleDateString([], {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    }

    return (
      <View style={styles.requestCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.requestDate}>Filed: {reqDate}</Text>
          <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
            <Text style={[styles.badgeText, { color: statusColor }]}>
              {item.status?.toUpperCase() || 'PENDING'}
            </Text>
          </View>
        </View>
        <Text style={styles.reasonText}>"{item.reason}"</Text>
        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>
            <Ionicons name="calendar-outline" size={14} /> Out: {item.startDate} {item.startTime && `(${item.startTime})`}
          </Text>
          <Text style={styles.detailText}>
            <Ionicons name="return-down-back-outline" size={14} /> Back: {item.returnDate}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Night-Out Pass</Text>
        <Text style={styles.headerSubtitle}>Request permission for overnight leave.</Text>
      </View>

      <View style={styles.formContainer}>
        <Text style={styles.sectionTitle}>New Request</Text>
        
        <View style={styles.inputGroup}>
          <TextInput
            style={styles.input}
            placeholder="Reason for leaving campus"
            value={reason}
            onChangeText={setReason}
            multiline
          />
          
          <View style={styles.pickerSectionRow}>
             <View style={styles.halfWidth}>
                <Text style={styles.pickerLabel}>Leaves Campus</Text>
                <TouchableOpacity style={styles.pickerActionBtn} onPress={() => showMode('date', 'start')}>
                   <Ionicons name="calendar-outline" size={18} color="#1976D2" />
                   <Text style={styles.pickerActionText}>{startDateTime.toLocaleDateString([], {month:'short', day:'numeric'})}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerActionBtn} onPress={() => showMode('time', 'start')}>
                   <Ionicons name="time-outline" size={18} color="#1976D2" />
                   <Text style={styles.pickerActionText}>{startDateTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
                </TouchableOpacity>
             </View>
             
             <View style={styles.halfWidth}>
                <Text style={styles.pickerLabel}>Returns to Campus</Text>
                <TouchableOpacity style={styles.pickerActionBtn} onPress={() => showMode('date', 'return')}>
                   <Ionicons name="calendar-outline" size={18} color="#1976D2" />
                   <Text style={styles.pickerActionText}>{returnDateTime.toLocaleDateString([], {month:'short', day:'numeric'})}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.pickerActionBtn} onPress={() => showMode('time', 'return')}>
                   <Ionicons name="time-outline" size={18} color="#1976D2" />
                   <Text style={styles.pickerActionText}>{returnDateTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</Text>
                </TouchableOpacity>
             </View>
          </View>
        </View>

        {showPicker && (
          <DateTimePicker
            testID="dateTimePicker"
            value={pickerTarget === 'start' ? startDateTime : returnDateTime}
            mode={pickerMode}
            is24Hour={true}
            display="default"
            onChange={onChange}
            minimumDate={new Date()}
          />
        )}

        <TouchableOpacity 
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} 
          onPress={handleSubmit} 
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Submit Request</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.sectionTitle}>Request History</Text>
        
        {loading ? (
          <ActivityIndicator size="small" color="#1976D2" style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={requests}
            keyExtractor={(item) => item.id}
            renderItem={renderRequestItem}
            scrollEnabled={false} // since it's inside a ScrollView
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="document-text-outline" size={40} color="#ccc" />
                <Text style={styles.emptyText}>No requests submitted yet.</Text>
              </View>
            }
          />
        )}
      </View>
    </ScrollView>
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
    color: "#111827",
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 16,
  },
  inputGroup: {
    gap: 12,
  },
  row: {
    flexDirection: "row",
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
  pickerSectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 6,
  },
  halfWidth: {
    flex: 1,
    gap: 8,
  },
  pickerLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
  },
  pickerActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0F2FE",
    gap: 8,
  },
  pickerActionText: {
    fontSize: 14,
    color: "#0369A1",
    fontWeight: "500",
  },
  submitBtn: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 16,
  },
  submitBtnDisabled: {
    backgroundColor: "#90CAF9",
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 16,
  },
  listContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  requestCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  requestDate: {
    fontSize: 13,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  reasonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1F2937",
    marginBottom: 12,
    fontStyle: "italic",
  },
  cardDetails: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 10,
  },
  detailText: {
    fontSize: 14,
    color: "#4B5563",
    display: "flex",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: 30,
  },
  emptyText: {
    color: "#9CA3AF",
    marginTop: 10,
  }
});