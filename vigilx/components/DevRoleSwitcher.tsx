import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useAuth } from "../context/AuthContext";
import { DEV_AUTH_BYPASS } from "../config/devAuth";
import { UserRole } from "../types/shared";

export function DevRoleSwitcher() {
  const { switchDevRole, role, subRole } = useAuth();
  const [open, setOpen] = useState(false);

  // Return nothing in PROD or if bypass is deactivated
  if (!__DEV__ || !DEV_AUTH_BYPASS) return null;

  const roles: { r: UserRole; sr?: string; label: string }[] = [
    { r: "student", sr: "hosteller", label: "Hosteller" },
    { r: "student", sr: "day scholar", label: "Day Scholar" },
    { r: "guard", label: "Guard" },
    { r: "faculty", label: "Faculty" },
    { r: "admin", label: "Admin" },
    { r: "worker", label: "Worker" },
    { r: "visitor", label: "Visitor" },
  ];

  return (
    <>
      <TouchableOpacity 
        style={styles.floatingButton} 
        onPress={() => setOpen(true)}
      >
        <Text style={styles.fabText}>🛠️ Dev</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.header}>Mock Role Switcher</Text>
            <Text style={styles.subtext}>
              Current: {role} {subRole ? `(${subRole})` : ""}
            </Text>

            {roles.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.roleBtn}
                onPress={() => {
                  if (switchDevRole) switchDevRole(item.r, item.sr);
                  setOpen(false);
                }}
              >
                <Text style={styles.roleBtnText}>{item.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity 
              style={[styles.roleBtn, styles.closeBtn]} 
              onPress={() => setOpen(false)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: "absolute",
    right: 20,
    bottom: 40,
    backgroundColor: "#111",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  fabText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 14,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    backgroundColor: "#fff",
    width: "80%",
    borderRadius: 16,
    padding: 24,
  },
  header: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  subtext: {
    fontSize: 12,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  roleBtn: {
    padding: 14,
    backgroundColor: "#f0f0f0",
    borderRadius: 8,
    marginBottom: 10,
    alignItems: "center",
  },
  roleBtnText: {
    fontSize: 16,
    fontWeight: "500",
  },
  closeBtn: {
    backgroundColor: "#ff4444",
    marginTop: 10,
  },
  closeBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
});
