import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { searchStudentsByPhone, UserProfile } from "../services/userService";

interface StudentSearchProps {
  onSelect: (student: UserProfile) => void;
}

const translations = {
  search_student: { en: "Search Student by Phone", hi: "फ़ोन द्वारा छात्र खोजें" },
  phone_number: { en: "Phone Number (e.g. +919876543210)", hi: "फ़ोन नंबर" },
  searching: { en: "Searching top matches...", hi: "शीर्ष मिलान खोज रहे हैं..." },
  no_match: { en: "No students matched the criteria", hi: "किसी छात्र का मिलान नहीं हुआ" },
  dept: { en: "Dept", hi: "विभाग" },
  roll_no: { en: "Roll No", hi: "रोल नंबर" },
} as const;

const t = (key: keyof typeof translations) => {
  if (!translations[key]) return key;
  return `${translations[key].en} / ${translations[key].hi}`;
};

export default function StudentSearch({ onSelect }: StudentSearchProps) {
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear debounce timer on destruction
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const executeSearch = (phoneText: string) => {
    if (phoneText.trim().length < 5) { // Reasonable minimum for a phone query match check
      setResults([]);
      setShowDropdown(false);
      setLoading(false);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    setShowDropdown(true);
    setLoading(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    // 400ms Debounce implementation
    timerRef.current = setTimeout(async () => {
      const matches = await searchStudentsByPhone(phoneText);
      setResults(matches);
      setLoading(false);
    }, 400);
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    executeSearch(text);
  };

  const handleSelect = (student: UserProfile) => {
    setShowDropdown(false);
    setPhone("");
    onSelect(student);
  };

  const hasInput = phone.trim().length > 0;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t("search_student")}</Text>

      <View style={styles.inputGroup}>
        {/* Phone Number Input */}
        <View style={styles.inputContainer}>
          <Ionicons name="call-outline" size={18} color="#666" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder={t("phone_number")}
            value={phone}
            onChangeText={handlePhoneChange}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>

      {/* Activity indicator explicitly beside/under the inputs if loading and no results shown yet */}
      {loading && !showDropdown && (
        <ActivityIndicator size="small" color="#000" style={{ marginTop: 10 }} />
      )}

      {/* Results Dropdown */}
      {showDropdown && hasInput && (
        <View style={styles.resultsDropdown}>
          {loading && results.length === 0 ? (
            <View style={styles.emptyState}>
              <ActivityIndicator size="small" color="#000" style={{ marginBottom: 10 }} />
              <Text>{t("searching")}</Text>
            </View>
          ) : results.length === 0 && phone.length >= 5 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: "#d9534f" }}>{t("no_match")}</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.resultItem} onPress={() => handleSelect(item)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{item.name || "Student"}</Text>
                    <Text style={styles.resultId}>
                       {t("dept")}: {item.Department || item.department_lowercase || "N/A"} • Phone: {item.phone || "N/A"}
                    </Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.role}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 10,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 8,
  },
  inputGroup: {
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 6,
    paddingHorizontal: 12,
    height: 46,
  },
  icon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    height: "100%",
  },
  resultsDropdown: {
    position: "absolute",
    top: 85,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    maxHeight: 250,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 999,
  },
  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  resultName: {
    fontWeight: "bold",
    fontSize: 16,
  },
  resultId: {
    color: "#666",
    fontSize: 13,
    marginTop: 4,
    textTransform: "uppercase"
  },
  badge: {
    backgroundColor: "#E3F2FD",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: "#1976D2",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  emptyState: {
    padding: 20,
    alignItems: "center",
  }
});
