import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { collection, query, orderBy, onSnapshot, limit } from "firebase/firestore";
import { db } from "../../services/firebase";
import { Ionicons } from "@expo/vector-icons";

export default function GuardLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "logs"),
      orderBy("timestamp", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate?.() || new Date()
      }));
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs: ", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const renderItem = ({ item }: { item: any }) => {
    const isAllow = item.systemDecision === "ALLOW";
    const statusColor = isAllow ? "#10B981" : (item.systemDecision === "DENY" ? "#EF4444" : "#F59E0B");
    
    return (
      <View style={[styles.logCard, { borderLeftColor: statusColor }]}>
        <View style={styles.logHeader}>
          <Text style={styles.logName}>{item.userName || "Unknown"}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
            <Text style={[styles.logStatus, { color: statusColor }]}>
              {item.systemDecision}
            </Text>
          </View>
        </View>
        
        <View style={styles.logDetailsRow}>
          <Text style={styles.logRole}>{String(item.userRole || "unknown").toUpperCase()}</Text>
          <Text style={styles.logTime}>
            {item.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {item.timestamp?.toLocaleDateString()}
          </Text>
        </View>
        
        {(item.flags && item.flags.length > 0) && (
           <Text style={styles.logFlags}>
             Flags: {item.flags.join(", ")}
           </Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Access Logs</Text>
        {loading && <ActivityIndicator size="small" color="#4CAF50" />}
      </View>

      {!loading && logs.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={48} color="#D1D5DB" />
          <Text style={styles.empty}>No scans recorded today</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
  },
  logCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  logStatus: {
    fontSize: 12,
    fontWeight: "bold",
  },
  logDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logRole: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "600",
  },
  logTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  logFlags: {
    fontSize: 12,
    color: "#EF4444",
    marginTop: 8,
    fontStyle: "italic",
  }
});