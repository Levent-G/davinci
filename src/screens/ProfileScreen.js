// src/screens/ProfileScreen.jsx
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { useSubscription } from "../context/SubscriptionContext";
import { Storage } from "../utils/storage";
import { saveUser } from "../services/firebase";
import {
  scheduleDailyReminder,
  cancelAllNotifications,
} from "../utils/notifications";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const SESSION_SIZES = [3, 5, 7, 10];

export default function ProfileScreen({ navigation }) {
  const { state, actions } = useApp();
  const { state: subState, actions: subActions } = useSubscription();
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState(state.user?.name || "");

  const settings = state.settings;
  const user = state.user;
  const trialStatus = subActions.getTrialStatus();

  const handleUpdateSetting = async (key, value) => {
    await actions.updateSettings({ [key]: value });
    // Bildirim toggle
    if (key === "notifications") {
      if (value) {
        scheduleDailyReminder(20, 0).catch(() => {});
      } else {
        cancelAllNotifications().catch(() => {});
      }
    }
  };

  const handleSaveName = async () => {
    if (nameInput.trim()) {
      await actions.setUser({ ...user, name: nameInput.trim() });
      setShowNameModal(false);
    }
  };

  const handleResetData = () => {
    Alert.alert(
      "Verileri Sifirla",
      "Tum ogrenme ilerlemeni ve istatistiklerini silmek istediğinden emin misin? (Firebase verisi silinmez)",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sıfırla",
          style: "destructive",
          onPress: async () => {
            await Storage.clearAll();
            Alert.alert(
              "Sıfırlandı",
              "Uygulama yeniden başlatıldığında sıfırlanmış olarak başlayacaksın."
            );
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.pageTitle}>Profil</Text>

        {/* User Card */}
        <TouchableOpacity
          style={styles.userCard}
          onPress={() => setShowNameModal(true)}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.backgroundCard, COLORS.backgroundCardLight]}
            style={styles.userCardGradient}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {(user?.name || "Ö")[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || "Öğrenci"}</Text>
              <Text style={styles.userLevel}>
                Seviye: {settings.preferredLevel}
              </Text>
              <Text style={styles.userJoined}>
                Katılım:{" "}
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("tr-TR")
                  : "-"}
              </Text>
            </View>
            <Ionicons name="pencil" size={18} color={COLORS.textMuted} />
          </LinearGradient>
        </TouchableOpacity>

        {/* Subscription Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Abonelik</Text>
          {subState.isPremium ? (
            <View style={styles.premiumCard}>
              <LinearGradient
                colors={[COLORS.accent, COLORS.accentDark]}
                style={styles.premiumGradient}
              >
                <Ionicons name="star" size={24} color="#fff" />
                <View style={styles.premiumInfo}>
                  <Text style={styles.premiumTitle}>Premium Üye</Text>
                  <Text style={styles.premiumSub}>Sınırsız erişim aktif</Text>
                </View>
              </LinearGradient>
            </View>
          ) : trialStatus.isOnTrial ? (
            <TouchableOpacity
              onPress={() => navigation.navigate("Paywall")}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[COLORS.backgroundCard, COLORS.backgroundCardLight]}
                style={styles.trialCard}
              >
                <View style={styles.trialInfo}>
                  <View style={styles.trialDaysBadge}>
                    <Text style={styles.trialDaysNum}>
                      {trialStatus.daysLeft}
                    </Text>
                    <Text style={styles.trialDaysLabel}>gün kaldı</Text>
                  </View>
                  <View>
                    <Text style={styles.trialTitle}>Ücretsiz Deneme</Text>
                    <Text style={styles.trialSub}>
                      Premium'a geç, sınırsız öğren →
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => navigation.navigate("Paywall")}
              style={styles.expiredCard}
            >
              <Ionicons name="lock-closed" size={20} color={COLORS.error} />
              <Text style={styles.expiredText}>
                Deneme süresi bitti - Günde 10 kelime limiti
              </Text>
              <Text style={styles.expiredLink}>Premium Al →</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Learning Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Öğrenme Ayarları</Text>

          {/* Preferred Level */}
          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Tercih Edilen Seviye</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: SPACING.sm }}
            >
              <View style={{ flexDirection: "row", gap: SPACING.sm }}>
                {LEVELS.map((lvl) => (
                  <TouchableOpacity
                    key={lvl}
                    style={[
                      styles.levelChip,
                      settings.preferredLevel === lvl && styles.levelChipActive,
                    ]}
                    onPress={() => handleUpdateSetting("preferredLevel", lvl)}
                  >
                    <Text
                      style={[
                        styles.levelChipText,
                        settings.preferredLevel === lvl &&
                          styles.levelChipTextActive,
                      ]}
                    >
                      {lvl}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Session Size */}
          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>Oturum Kelime Sayısı</Text>
            <View style={styles.sessionSizeRow}>
              {SESSION_SIZES.map((size) => (
                <TouchableOpacity
                  key={size}
                  style={[
                    styles.sizeChip,
                    settings.sessionSize === size && styles.sizeChipActive,
                  ]}
                  onPress={() => handleUpdateSetting("sessionSize", size)}
                >
                  <Text
                    style={[
                      styles.sizeChipText,
                      settings.sessionSize === size &&
                        styles.sizeChipTextActive,
                    ]}
                  >
                    {size}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Daily Goal */}
          <View style={[styles.settingCard, styles.settingRow]}>
            <View>
              <Text style={styles.settingLabel}>Günlük Hedef</Text>
              <Text style={styles.settingSubLabel}>
                {settings.dailyGoal} kelime/gün
              </Text>
            </View>
            <View style={styles.goalButtons}>
              <TouchableOpacity
                style={styles.goalBtn}
                onPress={() =>
                  handleUpdateSetting(
                    "dailyGoal",
                    Math.max(5, settings.dailyGoal - 5)
                  )
                }
              >
                <Ionicons name="remove" size={16} color={COLORS.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.goalValue}>{settings.dailyGoal}</Text>
              <TouchableOpacity
                style={styles.goalBtn}
                onPress={() =>
                  handleUpdateSetting(
                    "dailyGoal",
                    Math.min(50, settings.dailyGoal + 5)
                  )
                }
              >
                <Ionicons name="add" size={16} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Uygulama Ayarları</Text>
          <SettingToggle
            label="Bildirimler"
            icon="notifications"
            value={settings.notifications}
            onToggle={(v) => handleUpdateSetting("notifications", v)}
          />
          <SettingToggle
            label="Ses Efektleri"
            icon="volume-high"
            value={settings.soundEnabled}
            onToggle={(v) => handleUpdateSetting("soundEnabled", v)}
          />
          <SettingToggle
            label="Dokunsal Geri Bildirim"
            icon="phone-portrait"
            value={settings.hapticEnabled}
            onToggle={(v) => handleUpdateSetting("hapticEnabled", v)}
          />
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dangerButton}
            onPress={handleResetData}
          >
            <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            <Text style={styles.dangerButtonText}>Verileri Sıfırla</Text>
          </TouchableOpacity>
        </View>

        {/* Version */}
        <AdminSecretButton navigation={navigation} />
        <Text style={styles.version}>DaVinci Words v1.0.0</Text>
        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>

      {/* Name Modal */}
      <Modal visible={showNameModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>İsim Güncelle</Text>
            <TextInput
              style={styles.modalInput}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="İsminizi girin"
              placeholderTextColor={COLORS.textMuted}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowNameModal(false)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveName}
              >
                <Text style={styles.modalSaveText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingToggle({ label, icon, value, onToggle }) {
  return (
    <View style={[styles.settingCard, styles.settingRow]}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={20} color={COLORS.textSecondary} />
        <Text style={styles.settingLabel}>{label}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: COLORS.border, true: COLORS.accentGlow }}
        thumbColor={value ? COLORS.accent : COLORS.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg },
  pageTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
    paddingVertical: SPACING.lg,
  },

  userCard: {
    marginBottom: SPACING.xl,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.card,
  },
  userCardGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xl,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 2,
    borderColor: COLORS.borderAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  userInfo: { flex: 1, gap: 2 },
  userName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  userLevel: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  userJoined: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },

  premiumCard: { borderRadius: RADIUS.xl, overflow: "hidden" },
  premiumGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  premiumInfo: {},
  premiumTitle: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "800" },
  premiumSub: { color: "rgba(255,255,255,0.7)", fontSize: FONT_SIZES.sm },

  trialCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    padding: SPACING.lg,
  },
  trialInfo: { flexDirection: "row", alignItems: "center", gap: SPACING.lg },
  trialDaysBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 2,
    borderColor: COLORS.borderAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  trialDaysNum: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  trialDaysLabel: { color: COLORS.accent, fontSize: 10 },
  trialTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  trialSub: { color: COLORS.accent, fontSize: FONT_SIZES.sm },

  expiredCard: {
    backgroundColor: COLORS.errorGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "40",
    gap: SPACING.sm,
  },
  expiredText: { color: COLORS.errorLight, fontSize: FONT_SIZES.sm },
  expiredLink: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },

  settingCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  settingLabel: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  settingSubLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginTop: 2,
  },

  levelChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelChipActive: {
    backgroundColor: COLORS.accentGlow,
    borderColor: COLORS.borderAccent,
  },
  levelChipText: { color: COLORS.textSecondary, fontWeight: "700" },
  levelChipTextActive: { color: COLORS.accent },

  sessionSizeRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  sizeChip: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sizeChipActive: {
    backgroundColor: COLORS.accentGlow,
    borderColor: COLORS.borderAccent,
  },
  sizeChipText: { color: COLORS.textSecondary, fontWeight: "700" },
  sizeChipTextActive: { color: COLORS.accent },

  goalButtons: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  goalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.backgroundCardLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  goalValue: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
    minWidth: 32,
    textAlign: "center",
  },

  dangerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.errorGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "30",
  },
  dangerButtonText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
  },
  version: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
    marginBottom: SPACING.md,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: SPACING.xxl,
  },
  modalCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    width: "100%",
    gap: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
  },
  modalInput: {
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtons: { flexDirection: "row", gap: SPACING.md },
  modalCancelBtn: {
    flex: 1,
    padding: SPACING.md,
    alignItems: "center",
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundCardLight,
  },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: "600" },
  modalSaveBtn: {
    flex: 1,
    padding: SPACING.md,
    alignItems: "center",
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent,
  },
  modalSaveText: { color: "#fff", fontWeight: "700" },
});

// Gizli admin erişimi — versiyon yazısının üstüne 5 kez hızlı dokun
function AdminSecretButton({ navigation }) {
  const tapCount = useRef(0);
  const tapTimer = useRef(null);

  const handleTap = () => {
    tapCount.current += 1;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, 2000);
    if (tapCount.current >= 5) {
      tapCount.current = 0;
      navigation.navigate("Admin");
    }
  };

  return (
    <TouchableOpacity
      onPress={handleTap}
      style={{ paddingVertical: 8, alignItems: "center" }}
      activeOpacity={1}
    >
      <Text style={{ color: "transparent", fontSize: 1 }}>admin</Text>
    </TouchableOpacity>
  );
}
