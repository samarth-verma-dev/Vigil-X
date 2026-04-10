import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../../services/firebase";
import { useAuth } from "../../../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

export default function HostellerParcel() {
  const { user } = useAuth();
  const [parcels, setParcels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    
    // Real-time listener for current student's parcels
    const q = query(collection(db, "parcels"), where("studentId", "==", user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedParcels = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort: freshest first
      fetchedParcels.sort((a: any, b: any) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      
      setParcels(fetchedParcels);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching parcels:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const renderParcelItem = ({ item }: { item: any }) => {
    const isCollected = item.status === "Collected";
    
    // Format timestamp
    let dateStr = "Unknown Date";
    if (item.createdAt?.toDate) {
      dateStr = item.createdAt.toDate().toLocaleString([], {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    }

    return (
      <View style={styles.parcelCard}>
        <View style={styles.cardHeader}>
          <View style={styles.headerLeft}>
            <Ionicons name="cube" size={24} color={isCollected ? "#4CAF50" : "#FF9800"} />
            <Text style={styles.parcelTitle}>Delivery</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isCollected ? '#E8F5E9' : '#FFF3E0' }]}>
            <Text style={[styles.statusText, { color: isCollected ? '#2E7D32' : '#E65100' }]}>
              {item.status || "Pending"}
            </Text>
          </View>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.detailText}>
            <Ionicons name="location-outline" size={14} /> Gate: {item.gate || 'N/A'}
          </Text>
          <Text style={styles.detailText}>
            <Ionicons name="time-outline" size={14} /> Arrived: {dateStr}
          </Text>
          <Text style={styles.detailText}>
            <Ionicons name="shield-checkmark-outline" size={14} /> Guard: {item.guardName || 'system'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Parcels</Text>
        <Text style={styles.headerSubtitle}>Track your campus deliveries here.</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#1976D2" style={{ marginTop: 50 }} />
      ) : (
        <FlatList
          data={parcels}
          keyExtractor={(item) => item.id}
          renderItem={renderParcelItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="file-tray-outline" size={60} color="#ccc" />
              <Text style={styles.emptyText}>No parcels found attached to your ID.</Text>
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
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  parcelCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth:1,
    borderBottomColor: "#F3F4F6",
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  parcelTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  cardBody: {
    paddingTop: 4,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: "#4B5563",
    display: "flex",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#9CA3AF",
  }
});