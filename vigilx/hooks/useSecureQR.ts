import { useState, useEffect } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { PROTOTYPE_MODE } from "../config/devAuth";

export function useSecureQR() {
  const { user } = useAuth();
  const [qrData, setQrData] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchQR = async () => {
      try {
        setError(null);

        // 🚧 PROTOTYPE MODE BYPASS 🚧
        if (__DEV__ && PROTOTYPE_MODE) {
          setQrData(user.uid);
          setLoading(false);
          return;
        }

        const generateQR = httpsCallable(functions, "generateQR");
        const result = await generateQR();
        const data = result.data as { qrData: string; expiresAt: number };
        setQrData(data.qrData);
      } catch (err: any) {
        console.error("Failed to fetch secure QR:", err);
        setError(err.message || "Failed to load QR");
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchQR();

    // Refresh every 50 seconds (since validity is 60 seconds)
    const intervalId = setInterval(fetchQR, 50 * 1000);

    return () => clearInterval(intervalId);
  }, [user]);

  return { qrData, error, loading };
}
