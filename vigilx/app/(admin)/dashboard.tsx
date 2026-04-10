import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert } from "react-native";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../services/firebase";
import { useAuth } from "../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import { updateNightOutStatus } from "../../services/nightOutService";
import { signOut } from "firebase/auth";
import { auth } from "../../services/firebase";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load requests in real-time
  useEffect(() => {
    // We order by createdAt. Local sorting handles "Pending" prioritization.
    const q = query(collection(db, "night_out_requests"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetched: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Soft-sorting: Force 'pending' to the very top, then fallback to descending timestamp (built-in arrays)
      fetched.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0; // maintain descending chronological order sorted by server
      });

      setRequests(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Admin Request Listener Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDecision = (id: string, newStatus: "approved" | "rejected") => {
    Alert.alert(
      `Confirm ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      `Are you sure you want to ${newStatus} this pass?`,
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Confirm", 
          onPress: async () => {
            if (!user?.uid) return;
            try {
              await updateNightOutStatus(id, newStatus, user.uid);
            } catch (err) {
              Alert.alert("Action Failed", "There was an issue processing the state update.");
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusBadgeStyles = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'approved': return { bg: '#E8F5E9', text: '#2E7D32' };
      case 'rejected': return { bg: '#FFEBEE', text: '#C62828' };
      default: return { bg: '#FFF3E0', text: '#EF6C00' };
    }
  };

  const renderRequestItem = ({ item }: { item: any }) => {
    const isPending = item.status === "pending";
    const colors = getStatusBadgeStyles(item.status);

    let submitDate = "N/A";
    if (item.createdAt?.toDate) {
      submitDate = item.createdAt.toDate().toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.studentName}>{item.name || item.studentName || "Unknown Student"}</Text>
            <Text style={styles.studentIdLabel}>{item.studentId ? `ID: ${item.studentId}` : "ID: Unknown"}</Text>
            {item.email ? <Text style={[styles.studentIdLabel, { opacity: 0.7, marginTop: 0 }]}>{item.email}</Text> : null}
          </View>
          <View style={[styles.badge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.badgeText, { color: colors.text }]}>{item.status?.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.reasonLabel}>Reason for Request</Text>
          <Text style={styles.reasonText}>"{item.reason}"</Text>
          
          <View style={styles.dateBlock}>
            <Text style={styles.dateText}>
              <Ionicons name="calendar" size={14} color="#666" /> Leaves: <Text style={{fontWeight: "600"}}>{item.startDate} {item.startTime && `(${item.startTime})`}</Text>
            </Text>
            <Text style={styles.dateText}>
              <Ionicons name="return-down-back" size={14} color="#666" /> Returns: <Text style={{fontWeight: "600"}}>{item.returnDate}</Text>
            </Text>
          </View>
          <Text style={styles.submissionData}>Submitted: {submitDate}</Text>
        </View>

        {isPending && (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionBtn, styles.rejectBtn]} 
              activeOpacity={0.8}
              onPress={() => handleDecision(item.id, "rejected")}
            >
              <Ionicons name="close-circle" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Reject</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionBtn, styles.approveBtn]} 
              activeOpacity={0.8}
              onPress={() => handleDecision(item.id, "approved")}
            >
              <Ionicons name="checkmark-circle" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Approve</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>Approvals</Text>
            <Text style={styles.headerSubtitle}>Night-Out Permissions Dashboard</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.loadingText}>Syncing securely...</Text>
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequestItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark" size={60} color="#E0E0E0" />
              <Text style={styles.emptyText}>Inbox is clear!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F6F8",
  },
  header: {
    padding: 24,
    paddingTop: 60,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  logoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 3,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FAFAFA",
  },
  studentName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
  },
  studentIdLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  cardBody: {
    padding: 16,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#9CA3AF",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 22,
    marginBottom: 16,
  },
  dateBlock: {
    backgroundColor: "#F9FAFB",
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    color: "#4B5563",
    display: "flex",
    alignItems: "center"
  },
  submissionData: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  actionRow: {
    flexDirection: "row",
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectBtn: {
    backgroundColor: "#EF4444",
  },
  approveBtn: {
    backgroundColor: "#10B981",
  },
  actionBtnText: {
    color: "#ffffff",
    fontWeight: "bold",
    fontSize: 14,
  },
  loadingState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 15,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: "40%",
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "500",
  }
});
