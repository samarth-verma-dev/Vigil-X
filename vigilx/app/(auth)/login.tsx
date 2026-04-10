import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../services/firebase";
import { PROTOTYPE_MODE } from "../../config/devAuth";
import { useAuth } from "../../context/AuthContext";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { loginPrototypeUser } = useAuth();

  async function handleLogin() {
    if (!email) { // Password can be optional in prototype
      Alert.alert("Error", "Please enter an email");
      return;
    }

    setLoading(true);      
    try {
      if (__DEV__ && PROTOTYPE_MODE && loginPrototypeUser) {
        console.log(`[PrototypeAuth] Interactive bypass engaged for: ${email}`);
        loginPrototypeUser(email);
        setTimeout(() => setLoading(false), 200); // Fake load
        return;
      }

      if (!password) {
        Alert.alert("Error", "Please enter a password");
        setLoading(false);
        return;
      }

      console.log(`[Login] Attempting login for ${email}`);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const uid = userCredential.user.uid;
      console.log(`[Login] Auth successful. UID: ${uid}`);
      
      console.log(`[Login] Fetching verify doc for UID: ${uid}`);
      const userDoc = await getDoc(doc(db, "users", uid));
      console.log(`[Login] Document exists: ${userDoc.exists()}`);
      
      if (!userDoc.exists()) {
        console.error(`[Login] User document not found for UID: ${uid}`);
        await auth.signOut(); // Clean up invalid auth state
        Alert.alert("Error", "User record not found in system.");
        return;
      }
      
      // If it exists, Navigation happens automatically via AuthContext in _layout.tsx
    } catch (error: any) {
      console.error("[Login] Auth Error:", error);
      let errMsg = "Invalid email or password.";
      if (error.code === 'auth/network-request-failed') {
          errMsg = "Network error. Please check emulator connection.";
      } else if (error.message) {
          errMsg = error.message;
      }
      Alert.alert("Login Failed", errMsg);
    } finally {
      if (!(__DEV__ && PROTOTYPE_MODE)) setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VigilX</Text>
      <Text style={styles.subtitle}>
        {__DEV__ && PROTOTYPE_MODE ? "🚧 PROTOTYPE MODE 🚧" : "Campus Identity System"}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Email (e.g. guard@vigilx.app)"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {(!__DEV__ || !PROTOTYPE_MODE) && (
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      )}

      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {__DEV__ && PROTOTYPE_MODE ? "Enter App (Prototype)" : "Login"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 36,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    color: "#666",
    marginBottom: 40,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#000",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});