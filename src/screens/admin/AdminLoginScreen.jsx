// src/screens/admin/AdminLoginScreen.jsx
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Vibration,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { verifyAdminPin } from "../../services/firebase";

const PIN_LENGTH = 4;

export default function AdminLoginScreen({ navigation }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (pin.length === PIN_LENGTH) handleSubmit(pin);
  }, [pin]);

  const handlePress = (digit) => {
    if (pin.length >= PIN_LENGTH) return;
    setError("");
    setPin((prev) => prev + digit);
  };

  const handleDelete = () => setPin((prev) => prev.slice(0, -1));

  const handleSubmit = async (currentPin) => {
    setLoading(true);
    const valid = await verifyAdminPin(currentPin);
    setLoading(false);
    if (valid) {
      navigation.replace("AdminDashboard");
    } else {
      setError("Yanlış PIN. Tekrar dene.");
      Vibration.vibrate([0, 80, 80, 80]);
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 12,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -12,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 8,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -8,
          duration: 70,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 70,
          useNativeDriver: true,
        }),
      ]).start(() => setPin(""));
    }
  };

  const KEYS = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "⌫"],
  ];

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={["#0A0E1A", "#111827", "#0D1526"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoEmoji}>🔐</Text>
          </View>
          <Text style={styles.title}>Admin Paneli</Text>
          <Text style={styles.subtitle}>Da Vinci Words · Gizli Erişim</Text>
        </View>

        {/* PIN göstergesi */}
        <Animated.View
          style={[styles.pinRow, { transform: [{ translateX: shakeAnim }] }]}
        >
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pinDot,
                i < pin.length && styles.pinDotFilled,
                error && styles.pinDotError,
              ]}
            />
          ))}
        </Animated.View>

        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : (
          <View style={styles.errorPlaceholder} />
        )}

        {/* Numpad */}
        <View style={styles.numpad}>
          {KEYS.map((row, ri) => (
            <View key={ri} style={styles.numpadRow}>
              {row.map((key, ki) => {
                if (key === "")
                  return <View key={ki} style={styles.numpadKeyEmpty} />;
                const isDelete = key === "⌫";
                return (
                  <TouchableOpacity
                    key={ki}
                    style={[
                      styles.numpadKey,
                      isDelete && styles.numpadKeyDelete,
                    ]}
                    onPress={() =>
                      isDelete ? handleDelete() : handlePress(key)
                    }
                    activeOpacity={0.7}
                  >
                    {isDelete ? (
                      <Ionicons
                        name="backspace-outline"
                        size={24}
                        color={COLORS.textSecondary}
                      />
                    ) : (
                      <Text style={styles.numpadKeyText}>{key}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.cancelBtn}
        >
          <Text style={styles.cancelText}>İptal</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xxl,
    gap: SPACING.xl,
  },

  logoArea: { alignItems: "center", gap: SPACING.sm },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(245,166,35,0.15)",
    borderWidth: 2,
    borderColor: "rgba(245,166,35,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 36 },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  subtitle: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },

  pinRow: { flexDirection: "row", gap: SPACING.lg },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: "transparent",
  },
  pinDotFilled: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pinDotError: { borderColor: COLORS.error },

  errorText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  errorPlaceholder: { height: 20 },

  numpad: { gap: SPACING.md, width: "100%", maxWidth: 280 },
  numpadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.md,
  },
  numpadKey: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  numpadKeyDelete: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  numpadKeyEmpty: { width: 72, height: 72 },
  numpadKeyText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "300",
  },

  cancelBtn: { paddingVertical: SPACING.md, paddingHorizontal: SPACING.xl },
  cancelText: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
});
