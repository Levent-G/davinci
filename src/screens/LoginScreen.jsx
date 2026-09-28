// src/screens/LoginScreen.jsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import {
  signInWithGoogle,
  signInWithApple,
  isAppleSignInAvailable,
} from "../services/auth";

export default function LoginScreen() {
  const [loading, setLoading] = useState(null); // null | "google" | "apple"
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const handleGoogle = async () => {
    setLoading("google");
    try {
      await signInWithGoogle();
      // Başarılı girişten sonra AppContext'teki auth listener devralır —
      // burada ayrıca navigasyon yapmaya gerek yok.
    } catch (e) {
      if (e?.code !== "SIGN_IN_CANCELLED" && e?.code !== "-5") {
        Alert.alert("Giriş Başarısız", e?.message || "Bir şeyler ters gitti.");
      }
    } finally {
      setLoading(null);
    }
  };

  const handleApple = async () => {
    setLoading("apple");
    try {
      await signInWithApple();
    } catch (e) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Giriş Başarısız", e?.message || "Bir şeyler ters gitti.");
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <LinearGradient
      colors={["#0A0E1A", "#111827", "#0D1526"]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.content}>
          <View style={styles.logoWrapper}>
            <LinearGradient
              colors={[COLORS.accent, COLORS.accentDark]}
              style={styles.logoCircle}
            >
              <Text style={styles.logoEmoji}>🎨</Text>
            </LinearGradient>
          </View>

          <Text style={styles.title}>Da Vinci Words</Text>
          <Text style={styles.subtitle}>
            Günde sadece 5 kelimeyle İngilizceyi kalıcı olarak öğren
          </Text>

          <View style={styles.spacer} />

          <View style={styles.buttons}>
            {Platform.OS === "ios" && appleAvailable && (
              <TouchableOpacity
                style={[styles.button, styles.appleButton]}
                onPress={handleApple}
                disabled={loading !== null}
                activeOpacity={0.85}
              >
                {loading === "apple" ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <Ionicons name="logo-apple" size={20} color="#000" />
                    <Text style={styles.appleButtonText}>
                      Apple ile Devam Et
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.button, styles.googleButton]}
              onPress={handleGoogle}
              disabled={loading !== null}
              activeOpacity={0.85}
            >
              {loading === "google" ? (
                <ActivityIndicator color={COLORS.textPrimary} />
              ) : (
                <>
                  <Ionicons name="logo-google" size={20} color="#4285F4" />
                  <Text style={styles.googleButtonText}>
                    Google ile Devam Et
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.footnote}>
            Devam ederek Kullanım Koşulları'nı ve Gizlilik Politikası'nı kabul
            etmiş olursun.
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.xxl,
    alignItems: "center",
    justifyContent: "center",
  },

  logoWrapper: { marginBottom: SPACING.xl, ...SHADOWS.accent },
  logoCircle: {
    width: 96,
    height: 96,
    borderRadius: RADIUS.xxl || 32,
    alignItems: "center",
    justifyContent: "center",
  },
  logoEmoji: { fontSize: 44 },

  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    marginTop: SPACING.sm,
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },

  spacer: { flex: 1, minHeight: SPACING.xxxl },

  buttons: { width: "100%", gap: SPACING.md },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    height: 54,
    borderRadius: RADIUS.full,
    width: "100%",
  },
  appleButton: { backgroundColor: "#fff" },
  appleButtonText: { color: "#000", fontSize: FONT_SIZES.md, fontWeight: "700" },
  googleButton: {
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  googleButtonText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },

  footnote: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
    marginTop: SPACING.xl,
    lineHeight: 16,
  },
});
