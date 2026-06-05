// src/screens/admin/AdminDashboardScreen.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  SHADOWS,
} from "../../utils/theme";
import { getAppAnalytics, getWeeklySessionData } from "../../services/firebase";

const { width } = Dimensions.get("window");
const BAR_MAX_H = 80;

const EMPTY_ANALYTICS = {
  totalUsers: 0,
  premiumUsers: 0,
  trialUsers: 0,
  freeUsers: 0,
  totalWords: 0,
  sessions30d: 0,
  activeToday: 0,
  conversionRate: "0.0",
};
const EMPTY_WEEK = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"].map(
  (l) => ({ label: l, count: 0 })
);

export default function AdminDashboardScreen({ navigation }) {
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [weekData, setWeekData] = useState(EMPTY_WEEK);
  const [refreshing, setRefresh] = useState(false);
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const a = await Promise.race([
        getAppAnalytics(),
        new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
      ]);
      setAnalytics(a);
    } catch (e) {
      console.warn("Analytics:", e.message);
    }

    try {
      const w = await Promise.race([
        getWeeklySessionData(),
        new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 5000)),
      ]);
      setWeekData(w);
    } catch (e) {
      console.warn("WeekData:", e.message);
    }
  };

  const onRefresh = async () => {
    setRefresh(true);
    await loadData();
    setRefresh(false);
  };

  const maxCount = Math.max(...weekData.map((d) => d.count), 1);

  const MENU_ITEMS = [
    {
      icon: "📚",
      label: "Kelime\nYönetimi",
      color: COLORS.accent,
      screen: "AdminWords",
    },
    {
      icon: "👥",
      label: "Kullanıcılar",
      color: COLORS.secondary,
      screen: "AdminUsers",
    },
    { icon: "💳", label: "Abonelikler", color: "#A29BFE", screen: "AdminSubs" },
    {
      icon: "📊",
      label: "Analitik",
      color: "#81C784",
      screen: "AdminAnalytics",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>ADMIN PANELİ</Text>
          <Text style={styles.headerTitle}>Da Vinci Words</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.exitBtn}
        >
          <Ionicons
            name="exit-outline"
            size={22}
            color={COLORS.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* Quick stats */}
        {analytics && (
          <Animated.View style={[styles.statsGrid, { opacity: fadeAnim }]}>
            <BigStat
              icon="👤"
              value={analytics.totalUsers}
              label="Toplam Kullanıcı"
              color={COLORS.secondary}
            />
            <BigStat
              icon="⭐"
              value={analytics.premiumUsers}
              label="Premium"
              color={COLORS.accent}
            />
            <BigStat
              icon="🎯"
              value={analytics.trialUsers}
              label="Trial"
              color="#A29BFE"
            />
            <BigStat
              icon="🟢"
              value={analytics.activeToday}
              label="Bugün Aktif"
              color={COLORS.success}
            />
          </Animated.View>
        )}

        {/* Conversion + Sessions */}
        {analytics && (
          <Animated.View style={[styles.convRow, { opacity: fadeAnim }]}>
            <LinearGradient
              colors={[COLORS.backgroundCard, COLORS.backgroundCardLight]}
              style={styles.convCard}
            >
              <Text style={styles.convLabel}>Dönüşüm Oranı</Text>
              <Text style={[styles.convValue, { color: COLORS.accent }]}>
                {analytics.conversionRate}%
              </Text>
              <Text style={styles.convSub}>Trial → Premium</Text>
            </LinearGradient>
            <LinearGradient
              colors={[COLORS.backgroundCard, COLORS.backgroundCardLight]}
              style={styles.convCard}
            >
              <Text style={styles.convLabel}>30 Günlük Oturum</Text>
              <Text style={[styles.convValue, { color: COLORS.secondary }]}>
                {analytics.sessions30d}
              </Text>
              <Text style={styles.convSub}>son 30 gün</Text>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Kullanıcı dağılımı */}
        {analytics && analytics.totalUsers > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kullanıcı Dağılımı</Text>
            <View style={styles.distCard}>
              {[
                {
                  label: "Premium",
                  value: analytics.premiumUsers,
                  color: COLORS.accent,
                  pct:
                    analytics.totalUsers > 0
                      ? Math.round(
                          (analytics.premiumUsers / analytics.totalUsers) * 100
                        )
                      : 0,
                },
                {
                  label: "Trial",
                  value: analytics.trialUsers,
                  color: "#A29BFE",
                  pct:
                    analytics.totalUsers > 0
                      ? Math.round(
                          (analytics.trialUsers / analytics.totalUsers) * 100
                        )
                      : 0,
                },
                {
                  label: "Ücretsiz",
                  value: analytics.freeUsers,
                  color: COLORS.textMuted,
                  pct:
                    analytics.totalUsers > 0
                      ? Math.round(
                          (analytics.freeUsers / analytics.totalUsers) * 100
                        )
                      : 0,
                },
              ].map((item) => (
                <View key={item.label} style={styles.distRow}>
                  <View
                    style={[styles.distDot, { backgroundColor: item.color }]}
                  />
                  <Text style={styles.distLabel}>{item.label}</Text>
                  <View style={styles.distBarBg}>
                    <View
                      style={[
                        styles.distBarFill,
                        { width: `${item.pct}%`, backgroundColor: item.color },
                      ]}
                    />
                  </View>
                  <Text style={[styles.distPct, { color: item.color }]}>
                    {item.pct}%
                  </Text>
                  <Text style={styles.distVal}>{item.value}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Haftalık aktivite */}
        {weekData.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Haftalık Oturumlar</Text>
            <View style={styles.barChart}>
              {weekData.map((d, i) => {
                const barH = Math.max(8, (d.count / maxCount) * BAR_MAX_H);
                const isToday = i === 6;
                return (
                  <View key={i} style={styles.barItem}>
                    <Text style={styles.barVal}>
                      {d.count > 0 ? d.count : ""}
                    </Text>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: barH,
                          backgroundColor: isToday
                            ? COLORS.accent
                            : COLORS.secondary + "80",
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.barLabel,
                        isToday && { color: COLORS.accent },
                      ]}
                    >
                      {d.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Yönetim menüsü */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Yönetim</Text>
          <View style={styles.menuGrid}>
            {MENU_ITEMS.map((item) => (
              <TouchableOpacity
                key={item.screen}
                style={styles.menuCard}
                onPress={() => navigation.navigate(item.screen)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[item.color + "20", item.color + "08"]}
                  style={styles.menuCardGradient}
                >
                  <View
                    style={[
                      styles.menuIconCircle,
                      {
                        backgroundColor: item.color + "20",
                        borderColor: item.color + "40",
                      },
                    ]}
                  >
                    <Text style={styles.menuIcon}>{item.icon}</Text>
                  </View>
                  <Text style={[styles.menuLabel, { color: item.color }]}>
                    {item.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Hızlı özet */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı Bakış</Text>
          <View style={styles.quickCard}>
            <QuickRow
              icon="📝"
              label="Firebase Kelime Sayısı"
              value={analytics?.totalWords || 0}
            />
            <QuickRow
              icon="🔥"
              label="Aktif Trial"
              value={analytics?.trialUsers || 0}
              color={COLORS.accent}
            />
            <QuickRow
              icon="💰"
              label="Premium Üye"
              value={analytics?.premiumUsers || 0}
              color={COLORS.success}
            />
            <QuickRow
              icon="📱"
              label="Bugün Aktif"
              value={analytics?.activeToday || 0}
              color={COLORS.secondary}
            />
          </View>
        </View>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function BigStat({ icon, value, label, color }) {
  return (
    <View style={[styles.bigStat, { borderColor: color + "30" }]}>
      <Text style={styles.bigStatIcon}>{icon}</Text>
      <Text style={[styles.bigStatValue, { color }]}>{value ?? 0}</Text>
      <Text style={styles.bigStatLabel}>{label}</Text>
    </View>
  );
}

function QuickRow({ icon, label, value, color }) {
  return (
    <View style={styles.quickRow}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
      <Text style={[styles.quickValue, color && { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLabel: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
    letterSpacing: 1,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
  },
  exitBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scroll: { paddingHorizontal: SPACING.lg },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
  },
  bigStat: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  bigStatIcon: { fontSize: 22 },
  bigStatValue: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  bigStatLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },
  convRow: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  convCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  convLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  convValue: { fontSize: FONT_SIZES.xxxl, fontWeight: "800" },
  convSub: { color: COLORS.textMuted, fontSize: 10 },
  section: { marginTop: SPACING.xl },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },
  distCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  distRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  distDot: { width: 10, height: 10, borderRadius: 5 },
  distLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    width: 60,
  },
  distBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  distBarFill: { height: 8, borderRadius: 4 },
  distPct: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
    width: 36,
    textAlign: "right",
  },
  distVal: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    width: 30,
    textAlign: "right",
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    height: BAR_MAX_H + 50,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  barItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  barVal: { color: COLORS.textMuted, fontSize: 9 },
  bar: { width: "80%", borderRadius: 4 },
  barLabel: { color: COLORS.textMuted, fontSize: 9 },
  menuGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  menuCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuCardGradient: {
    padding: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
  },
  menuIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIcon: { fontSize: 24 },
  menuLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
    textAlign: "center",
  },
  quickCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  quickIcon: { fontSize: 18, width: 28 },
  quickLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md, flex: 1 },
  quickValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
  },
});
