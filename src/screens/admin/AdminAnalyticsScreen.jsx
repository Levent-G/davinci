// src/screens/admin/AdminAnalyticsScreen.jsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import {
  getAppAnalytics,
  getWeeklySessionData,
  getAllUsers,
} from "../../services/firebase";

const { width } = Dimensions.get("window");
const BAR_MAX_H = 90;

export default function AdminAnalyticsScreen({ navigation }) {
  const [analytics, setAnalytics] = useState(null);
  const [weekData, setWeekData] = useState([]);
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [a, w, u] = await Promise.all([
        getAppAnalytics(),
        getWeeklySessionData(),
        getAllUsers(100),
      ]);
      setAnalytics(a);
      setWeekData(w);
      setUsers(u);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Kullanicilardan istatistik hesapla
  const userStats = {
    totalWords: users.reduce(
      (s, u) => s + (u.stats?.totalWordsLearned || 0),
      0
    ),
    totalSession: users.reduce((s, u) => s + (u.stats?.totalSessions || 0), 0),
    avgStreak:
      users.length > 0
        ? Math.round(
            users.reduce((s, u) => s + (u.stats?.streak || 0), 0) / users.length
          )
        : 0,
    maxStreak: users.reduce(
      (m, u) => Math.max(m, u.stats?.longestStreak || 0),
      0
    ),
  };

  // Level dagilimi
  const levelDist = users.reduce((acc, u) => {
    const lvl = u.settings?.preferredLevel || "A1";
    acc[lvl] = (acc[lvl] || 0) + 1;
    return acc;
  }, {});

  const maxWeek = Math.max(...weekData.map((d) => d.count), 1);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analitik</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text style={styles.loadingText}>Veriler hesaplaniyor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analitik</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Tab secici */}
      <View style={styles.tabs}>
        {[
          { id: "overview", label: "Genel" },
          { id: "users", label: "Kullanicilar" },
          { id: "learning", label: "Ogrenme" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.id && styles.tabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
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
        {/* GENEL TAB */}
        {activeTab === "overview" && analytics && (
          <Animated.View style={{ opacity: fadeAnim, gap: SPACING.xl }}>
            <View style={styles.kpiGrid}>
              <KPICard
                icon="👤"
                label="Toplam Kullanici"
                value={analytics.totalUsers}
                color={COLORS.secondary}
              />
              <KPICard
                icon="🎯"
                label="30G Oturum"
                value={analytics.sessions30d}
                color={COLORS.accent}
              />
              <KPICard
                icon="🟢"
                label="Buguu Aktif"
                value={analytics.activeToday}
                color={COLORS.success}
              />
              <KPICard
                icon="📈"
                label="Donusum"
                value={`${analytics.conversionRate}%`}
                color="#A29BFE"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Haftalik Oturumlar</Text>
              <View style={styles.barChart}>
                {weekData.map((d, i) => {
                  const h = Math.max(8, (d.count / maxWeek) * BAR_MAX_H);
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
                            height: h,
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

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Plan Dagilimi</Text>
              <View style={styles.distCard}>
                {[
                  {
                    label: "Premium",
                    value: analytics.premiumUsers,
                    color: COLORS.accent,
                    total: analytics.totalUsers,
                  },
                  {
                    label: "Trial",
                    value: analytics.trialUsers,
                    color: "#A29BFE",
                    total: analytics.totalUsers,
                  },
                  {
                    label: "Ucretsiz",
                    value: analytics.freeUsers,
                    color: COLORS.textMuted,
                    total: analytics.totalUsers,
                  },
                ].map((item) => {
                  const pct =
                    item.total > 0
                      ? Math.round((item.value / item.total) * 100)
                      : 0;
                  return (
                    <View key={item.label} style={styles.distRow}>
                      <View
                        style={[
                          styles.distDot,
                          { backgroundColor: item.color },
                        ]}
                      />
                      <Text style={styles.distLabel}>{item.label}</Text>
                      <View style={styles.distBarBg}>
                        <View
                          style={[
                            styles.distBarFill,
                            { width: `${pct}%`, backgroundColor: item.color },
                          ]}
                        />
                      </View>
                      <Text style={[styles.distPct, { color: item.color }]}>
                        {pct}%
                      </Text>
                      <Text style={styles.distVal}>{item.value}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}

        {/* KULLANICILAR TAB */}
        {activeTab === "users" && (
          <Animated.View style={{ opacity: fadeAnim, gap: SPACING.xl }}>
            <View style={styles.kpiGrid}>
              <KPICard
                icon="👤"
                label="Toplam"
                value={users.length}
                color={COLORS.secondary}
              />
              <KPICard
                icon="⭐"
                label="Premium"
                value={
                  users.filter((u) => u.subscription?.plan === "premium").length
                }
                color={COLORS.accent}
              />
              <KPICard
                icon="🎯"
                label="Trial"
                value={
                  users.filter((u) => u.subscription?.plan === "trial").length
                }
                color="#A29BFE"
              />
              <KPICard
                icon="🆓"
                label="Ucretsiz"
                value={
                  users.filter(
                    (u) =>
                      !u.subscription?.plan || u.subscription?.plan === "free"
                  ).length
                }
                color={COLORS.textMuted}
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Seviye Dagilimi</Text>
              <View style={styles.distCard}>
                {Object.entries(levelDist)
                  .sort()
                  .map(([level, count]) => {
                    const pct =
                      users.length > 0
                        ? Math.round((count / users.length) * 100)
                        : 0;
                    const colors = {
                      A1: COLORS.levelA1,
                      A2: COLORS.levelA2,
                      B1: COLORS.levelB1,
                      B2: COLORS.levelB2,
                      C1: COLORS.levelC1,
                      C2: COLORS.levelC2,
                    };
                    const color = colors[level] || COLORS.accent;
                    return (
                      <View key={level} style={styles.distRow}>
                        <View
                          style={[styles.distDot, { backgroundColor: color }]}
                        />
                        <Text style={[styles.distLabel, { color }]}>
                          {level}
                        </Text>
                        <View style={styles.distBarBg}>
                          <View
                            style={[
                              styles.distBarFill,
                              { width: `${pct}%`, backgroundColor: color },
                            ]}
                          />
                        </View>
                        <Text style={[styles.distPct, { color }]}>{pct}%</Text>
                        <Text style={styles.distVal}>{count}</Text>
                      </View>
                    );
                  })}
                {Object.keys(levelDist).length === 0 && (
                  <Text style={styles.noDataText}>Henuz veri yok</Text>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Son Katilan Kullanicilar</Text>
              {users.slice(0, 5).map((u) => (
                <View key={u.id} style={styles.userRow}>
                  <View
                    style={[
                      styles.userAvatar,
                      {
                        backgroundColor:
                          (u.subscription?.plan === "premium"
                            ? COLORS.accent
                            : "#A29BFE") + "20",
                      },
                    ]}
                  >
                    <Text style={styles.userAvatarText}>
                      {(u.name || "U")[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userRowInfo}>
                    <Text style={styles.userRowName}>
                      {u.name || "Isimsiz"}
                    </Text>
                    <Text style={styles.userRowEmail}>{u.email || "-"}</Text>
                  </View>
                  <View
                    style={[
                      styles.planMini,
                      {
                        backgroundColor:
                          (u.subscription?.plan === "premium"
                            ? COLORS.accent
                            : "#A29BFE") + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.planMiniText,
                        {
                          color:
                            u.subscription?.plan === "premium"
                              ? COLORS.accent
                              : "#A29BFE",
                        },
                      ]}
                    >
                      {u.subscription?.plan || "free"}
                    </Text>
                  </View>
                </View>
              ))}
              {users.length === 0 && (
                <Text style={styles.noDataText}>Henuz kullanici yok</Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* OGRENME TAB */}
        {activeTab === "learning" && (
          <Animated.View style={{ opacity: fadeAnim, gap: SPACING.xl }}>
            <View style={styles.kpiGrid}>
              <KPICard
                icon="📚"
                label="Toplam Ogrenilen"
                value={userStats.totalWords}
                color={COLORS.accent}
              />
              <KPICard
                icon="🎯"
                label="Toplam Oturum"
                value={userStats.totalSession}
                color={COLORS.secondary}
              />
              <KPICard
                icon="🔥"
                label="Ort. Seri"
                value={userStats.avgStreak}
                color={COLORS.error}
              />
              <KPICard
                icon="⚡"
                label="En Uzun Seri"
                value={userStats.maxStreak}
                color="#A29BFE"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Firebase Kelime Istatistikleri
              </Text>
              <View style={styles.infoCard}>
                <InfoRow
                  label="Firebase Kelime Sayisi"
                  value={analytics?.totalWords || 0}
                />
                <InfoRow
                  label="Toplam Ogrenilen"
                  value={userStats.totalWords}
                />
                <InfoRow label="Toplam Oturum" value={userStats.totalSession} />
                <InfoRow
                  label="Ortalama Seri"
                  value={`${userStats.avgStreak} gun`}
                />
                <InfoRow
                  label="En Uzun Seri"
                  value={`${userStats.maxStreak} gun`}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Haftalik Oturum Aktivitesi
              </Text>
              <View style={styles.barChart}>
                {weekData.map((d, i) => {
                  const h = Math.max(8, (d.count / maxWeek) * BAR_MAX_H);
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
                            height: h,
                            backgroundColor: isToday
                              ? COLORS.success
                              : COLORS.success + "60",
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.barLabel,
                          isToday && { color: COLORS.success },
                        ]}
                      >
                        {d.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>
        )}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({ icon, label, value, color }) {
  return (
    <View style={[styles.kpiCard, { borderColor: color + "30" }]}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRowItem}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  tabs: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    borderRadius: RADIUS.md,
  },
  tabActive: { backgroundColor: COLORS.backgroundCardLight },
  tabText: {
    color: COLORS.textMuted,
    fontWeight: "600",
    fontSize: FONT_SIZES.sm,
  },
  tabTextActive: { color: COLORS.textPrimary },
  scroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  section: { gap: SPACING.md },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
  },
  kpiIcon: { fontSize: 22 },
  kpiValue: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  kpiLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },
  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    height: BAR_MAX_H + 44,
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
    gap: 3,
  },
  barVal: { color: COLORS.textMuted, fontSize: 9 },
  bar: { width: "80%", borderRadius: 3 },
  barLabel: { color: COLORS.textMuted, fontSize: 9 },
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
    width: 70,
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
  noDataText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
    padding: SPACING.md,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { fontWeight: "800", color: COLORS.textPrimary },
  userRowInfo: { flex: 1 },
  userRowName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  userRowEmail: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  planMini: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  planMiniText: { fontSize: 10, fontWeight: "700" },
  infoCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRowItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
  },

  // Level colors
  levelA1: COLORS.levelA1,
  levelA2: COLORS.levelA2,
  levelB1: COLORS.levelB1,
  levelB2: COLORS.levelB2,
  levelC1: COLORS.levelC1,
  levelC2: COLORS.levelC2,
});
