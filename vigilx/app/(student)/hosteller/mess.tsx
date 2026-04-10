import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useAuth } from "../../../context/AuthContext";

// Sample data
const SAMPLE_BALANCE = 450.00;

const SAMPLE_TRANSACTIONS = [
  {
    id: "1",
    type: "topup" as const,
    amount: 500,
    description: "Top-up via UPI",
    timestamp: new Date("2026-04-09T10:00:00"),
    balanceAfter: 500
  },
  {
    id: "2",
    type: "debit" as const,
    amount: 50,
    description: "Breakfast payment",
    timestamp: new Date("2026-04-10T08:30:00"),
    balanceAfter: 450
  }
];

const SAMPLE_MENU = {
  day: "Friday",
  date: "2026-04-10",
  breakfast: ["Idli", "Sambar", "Coconut Chutney", "Tea"],
  lunch: ["Rice", "Dal Tadka", "Paneer Curry", "Roti", "Salad"],
  dinner: ["Fried Rice", "Manchurian", "Sweet Corn Soup"]
};

export default function HostellerMess() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(SAMPLE_BALANCE);
  const [transactions, setTransactions] = useState(SAMPLE_TRANSACTIONS);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  // QR refresh animation
  const qrRotation = useRef(new Animated.Value(0)).current;
  const [qrTimestamp, setQrTimestamp] = useState(Date.now());

  // Generate QR data
  const generateQRData = () => {
    return JSON.stringify({
      studentId: user?.uid || "sample-student-id",
      studentName: user?.displayName || "Student Name",
      balance: balance,
      timestamp: qrTimestamp,
      signature: `MESS_QR_${user?.uid || "sample"}`
    });
  };

  const refreshQR = () => {
    // Animate rotation
    Animated.sequence([
      Animated.timing(qrRotation, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(qrRotation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    setQrTimestamp(Date.now());
  };

  const handleTopUp = () => {
    const amount = parseFloat(topUpAmount);
    
    if (isNaN(amount) || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    
    if (amount < 50) {
      Alert.alert("Error", "Minimum top-up amount is ₹50");
      return;
    }
    
    if (amount > 5000) {
      Alert.alert("Error", "Maximum top-up amount is ₹5000");
      return;
    }

    setSubmitting(true);
    
    // Simulate payment processing
    setTimeout(() => {
      const newBalance = balance + amount;
      const newTransaction = {
        id: Date.now().toString(),
        type: "topup" as const,
        amount: amount,
        description: "Top-up via UPI",
        timestamp: new Date(),
        balanceAfter: newBalance
      };
      
      setBalance(newBalance);
      setTransactions([newTransaction, ...transactions]);
      setSubmitting(false);
      
      Alert.alert("Success", `₹${amount} added to your mess wallet`);
      setShowTopUpModal(false);
      setTopUpAmount("");
      setQrTimestamp(Date.now()); // Refresh QR with new balance
    }, 1500);
  };

  const spin = qrRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mess</Text>
        <Text style={styles.headerSubtitle}>Scan QR to pay for meals</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* QR Code Section */}
        <View style={styles.qrSection}>
          <View style={styles.qrCard}>
            <View style={styles.qrHeader}>
              <Text style={styles.qrTitle}>Mess QR Code</Text>
              <TouchableOpacity onPress={refreshQR} style={styles.refreshButton}>
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                  <Ionicons name="refresh" size={20} color="#1976D2" />
                </Animated.View>
              </TouchableOpacity>
            </View>
            
            <View style={styles.qrContainer}>
              <QRCode value={generateQRData()} size={200} />
            </View>
            
            <Text style={styles.qrSubtext}>Show this QR at mess counter</Text>
          </View>
        </View>

        {/* Balance Section */}
        <View style={styles.balanceSection}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <View>
                <Text style={styles.balanceLabel}>Available Balance</Text>
                <Text style={styles.balanceAmount}>₹{balance.toFixed(2)}</Text>
              </View>
              <TouchableOpacity 
                style={styles.topUpButton}
                onPress={() => setShowTopUpModal(true)}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.topUpButtonText}>Top Up</Text>
              </TouchableOpacity>
            </View>
            
            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <View style={styles.transactionsSection}>
                <Text style={styles.transactionsTitle}>Recent Transactions</Text>
                {transactions.slice(0, 5).map((txn) => (
                  <View key={txn.id} style={styles.transactionItem}>
                    <View style={styles.transactionLeft}>
                      <Ionicons 
                        name={txn.type === "topup" ? "arrow-down-circle" : "arrow-up-circle"} 
                        size={20} 
                        color={txn.type === "topup" ? "#4CAF50" : "#F44336"} 
                      />
                      <View style={styles.transactionDetails}>
                        <Text style={styles.transactionDesc}>{txn.description}</Text>
                        <Text style={styles.transactionDate}>
                          {txn.timestamp.toLocaleDateString()} {txn.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      { color: txn.type === "topup" ? "#4CAF50" : "#F44336" }
                    ]}>
                      {txn.type === "topup" ? "+" : "-"}₹{txn.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Today's Menu Section */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Today's Menu</Text>
          
          <View style={styles.menuCard}>
            <View style={styles.mealRow}>
              <View style={styles.mealIcon}>
                <Ionicons name="sunny" size={24} color="#FF9800" />
              </View>
              <View style={styles.mealContent}>
                <Text style={styles.mealTitle}>Breakfast</Text>
                <Text style={styles.mealItems}>
                  {SAMPLE_MENU.breakfast.join(", ")}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.mealRow}>
              <View style={styles.mealIcon}>
                <Ionicons name="partly-sunny" size={24} color="#FFC107" />
              </View>
              <View style={styles.mealContent}>
                <Text style={styles.mealTitle}>Lunch</Text>
                <Text style={styles.mealItems}>
                  {SAMPLE_MENU.lunch.join(", ")}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.mealRow}>
              <View style={styles.mealIcon}>
                <Ionicons name="moon" size={24} color="#3F51B5" />
              </View>
              <View style={styles.mealContent}>
                <Text style={styles.mealTitle}>Dinner</Text>
                <Text style={styles.mealItems}>
                  {SAMPLE_MENU.dinner.join(", ")}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Top Up Modal */}
      <Modal
        visible={showTopUpModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTopUpModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Top Up Wallet</Text>
              <TouchableOpacity onPress={() => setShowTopUpModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Enter Amount</Text>
            <View style={styles.amountInputContainer}>
              <Text style={styles.currencySymbol}>₹</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="numeric"
                placeholder="0.00"
                value={topUpAmount}
                onChangeText={setTopUpAmount}
              />
            </View>

            <View style={styles.quickAmounts}>
              {[100, 200, 500, 1000].map((amount) => (
                <TouchableOpacity
                  key={amount}
                  style={styles.quickAmountButton}
                  onPress={() => setTopUpAmount(amount.toString())}
                >
                  <Text style={styles.quickAmountText}>₹{amount}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.paymentNote}>
              <Ionicons name="information-circle" size={14} color="#666" /> 
              {" "}Payment will be processed via UPI
            </Text>

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleTopUp}
              disabled={submitting}
            >
              {submitting ? (
                <View style={styles.submitButtonContent}>
                  <Ionicons name="hourglass" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Processing...</Text>
                </View>
              ) : (
                <View style={styles.submitButtonContent}>
                  <Ionicons name="card" size={20} color="#fff" />
                  <Text style={styles.submitButtonText}>Pay ₹{topUpAmount || "0"}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  qrSection: {
    marginBottom: 16,
  },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: 20,
  },
  qrTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  refreshButton: {
    padding: 8,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  qrSubtext: {
    marginTop: 16,
    fontSize: 13,
    color: "#6B7280",
  },
  balanceSection: {
    marginBottom: 16,
  },
  balanceCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  balanceLabel: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 4,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#1F2937",
  },
  topUpButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1976D2",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  topUpButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  transactionsSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  transactionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 12,
  },
  transactionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  transactionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionDesc: {
    fontSize: 14,
    color: "#1F2937",
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  transactionAmount: {
    fontSize: 15,
    fontWeight: "600",
  },
  menuSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  mealIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  mealContent: {
    flex: 1,
  },
  mealTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 6,
  },
  mealItems: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1F2937",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  amountInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  currencySymbol: {
    fontSize: 24,
    fontWeight: "600",
    color: "#6B7280",
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: "600",
    color: "#1F2937",
    paddingVertical: 16,
  },
  quickAmounts: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  quickAmountButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    alignItems: "center",
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
  },
  paymentNote: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 20,
    textAlign: "center",
  },
  submitButton: {
    backgroundColor: "#1976D2",
    paddingVertical: 16,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
