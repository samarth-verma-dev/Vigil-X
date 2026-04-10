import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../services/firebase";
import { Ionicons } from "@expo/vector-icons";

export default function AdminFlagsDashboard() {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load flags in real-time
  useEffect(() => {
    const q = query(collection(db, "flags"), orderBy("timestamp", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let fetched: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort to force unhandled/active to top
      fetched.sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return 0; // maintain descending chronological order
      });
      
      setFlags(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Admin Flags Listener Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getFlagVisuals = (type: string) => {
    switch(type) {
      case 'late_entry': return { label: 'Late Entry', bg: '#FFF3E0', text: '#F97316', icon: 'enter-outline' };
      case 'late_exit': return { label: 'Late Exit', bg: '#FEE2E2', text: '#EF4444', icon: 'exit-outline' };
      case 'repeat_violation': return { label: 'Repeat Offender', bg: '#7F1D1D', text: '#FEF2F2', icon: 'warning' };
      case 'late_request': return { label: 'Late Pass Request', bg: '#FEF3C7', text: '#D97706', icon: 'time-outline' };
      case 'emergency_exit': return { label: 'Emergency Exit', bg: '#FECACA', text: '#B91C1C', icon: 'medkit-outline' };
      case 'repeat_emergency': return { label: 'Repeat Emergency', bg: '#450A0A', text: '#FECACA', icon: 'warning' };
      default: return { label: 'Unknown Violation', bg: '#F3F4F6', text: '#4B5563', icon: 'alert-circle-outline' };
    }
  };

  const renderFlagItem = ({ item }: { item: any }) => {
    const visual = getFlagVisuals(item.type);

    let flagDate = "Unknown Date";
    if (item.timestamp?.toDate) {
      flagDate = item.timestamp.toDate().toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.identityGroup}>
            <Text style={styles.studentName}>{item.name || item.studentName || "Unknown Student"}</Text>
            <Text style={styles.studentIdLabel}>{item.studentId ? `ID: ${item.studentId}` : "ID: Unknown"}</Text>
            {item.email ? <Text style={[styles.studentIdLabel, { opacity: 0.7, marginTop: 0 }]}>{item.email}</Text> : null}
          </View>
          <View style={[styles.badge, { backgroundColor: visual.bg }]}>
            <Ionicons name={visual.icon as any} size={12} color={visual.text} />
            <Text style={[styles.badgeText, { color: visual.text }]}>{visual.label}</Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          {item.reason ? (
            <Text style={styles.reasonText}>Reason: {item.reason}</Text>
          ) : null}
          <Text style={styles.dateText}>
            <Ionicons name="calendar" size={14} color="#666" /> Flagged: <Text style={{fontWeight: "600"}}>{flagDate}</Text>
          </Text>
          {item.count ? (
            <Text style={styles.countText}>
              <Ionicons name="alert-circle" size={14} color="#DC2626" /> Offense Sequence Count: {item.count}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
            <Text style={styles.headerTitle}>Flags Center</Text>
            <Text style={styles.headerSubtitle}>Monitor curfew bypasses and anomalies.</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#DC2626" />
          <Text style={styles.loadingText}>Loading tracking module...</Text>
        </View>
      ) : (
        <FlatList
          data={flags}
          keyExtractor={(item) => item.id}
          renderItem={renderFlagItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={60} color="#D1D5DB" />
              <Text style={styles.emptyText}>All students have obeyed bounds!</Text>
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
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#991B1B",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "#E5E7EB",
    borderLeftColor: "#EF4444",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    paddingBottom: 10,
  },
  identityGroup: {
    flex: 1,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "bold",
  },
  cardBody: {
    padding: 16,
    paddingTop: 0,
    gap: 6
  },
  dateText: {
    fontSize: 14,
    color: "#4B5563",
    display: "flex",
    alignItems: "center"
  },
  reasonText: {
    fontSize: 14,
    color: "#1F2937",
    fontStyle: "italic",
    marginBottom: 4,
  },
  countText: {
    fontSize: 14,
    color: "#991B1B",
    marginTop: 4,
    fontWeight: "600"
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
