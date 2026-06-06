// src/screens/HomeScreen.jsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { useSubscription } from "../context/SubscriptionContext";
import { getDailyStats } from "../utils/davinciAlgorithm";

const { width } = Dimensions.get("window");

export default function HomeScreen({ navigation }) {
  const { state, actions } = useApp();
  const { state: subState } = useSubscription();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const streakAnim = useRef(new Animated.Value(0)).current;

  const todayCount = actions.getTodayWordCount();
  const streak = state.stats.streak || 0;
  const totalLearned = state.stats.totalWordsLearned || 0;
  const allWords = actions.getAllWords();
  const dailyStats = getDailyStats(allWords, state.wordProgress);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
    // Streak animasyonu
    if (streak > 0) {
      Animated.spring(streakAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
        delay: 400,
      }).start();
    }
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Günaydın";
    if (h < 18) return "İyi günler";
    return "İyi akşamlar";
  };

  const getDailyMessage = () => {
    if (dailyStats.dueCount > 0)
      return `${dailyStats.dueCount} kelime tekrar bekliyor`;
    if (dailyStats.todayStudied === 0) return "Bugün henüz çalışmadın";
    return `Bugün ${dailyStats.todayStudied} kelime öğrendin!`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {state.user?.name || "Da Vinci"} 👋
            </Text>
            <Text style={styles.headerTitle}>Da Vinci ile Öğren</Text>
          </View>
          {subState.plan === "trial" && !subState.isTrialExpired && (
            <TouchableOpacity
              style={styles.trialBadge}
              onPress={() => navigation.navigate("Paywall")}
            >
              <Ionicons name="flash" size={14} color={COLORS.accent} />
              <Text style={styles.trialBadgeText}>
                {subState.trialDaysLeft}g
              </Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Streak Kartı */}
        {streak > 0 && (
          <Animated.View
            style={[{ opacity: fadeAnim, transform: [{ scale: streakAnim }] }]}
          >
            <LinearGradient
              colors={
                streak >= 7 ? ["#FF6B35", "#F7B731"] : ["#FF8C42", "#FFA07A"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.streakCard}
            >
              <View style={styles.streakLeft}>
                <Text style={styles.streakFire}>🔥</Text>
                <View>
                  <Text style={styles.streakNum}>{streak}</Text>
                  <Text style={styles.streakLabel}>Günlük Seri</Text>
                </View>
              </View>
              <View style={styles.streakRight}>
                <Text style={styles.streakMsg}>
                  {streak >= 30
                    ? "🏆 Efsane!"
                    : streak >= 14
                    ? "⚡ Muhteşem!"
                    : streak >= 7
                    ? "🌟 Harika!"
                    : "💪 Devam et!"}
                </Text>
                <View style={styles.streakDots}>
                  {[...Array(Math.min(streak, 7))].map((_, i) => (
                    <View
                      key={i}
                      style={[styles.streakDot, { opacity: 1 - i * 0.1 }]}
                    />
                  ))}
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Günlük Durum */}
        <Animated.View style={[styles.dailyCard, { opacity: fadeAnim }]}>
          <View style={styles.dailyHeader}>
            <Text style={styles.dailyTitle}>Bugün</Text>
            <Text style={styles.dailyMsg}>{getDailyMessage()}</Text>
          </View>
          <View style={styles.dailyStats}>
            <DailyStat
              icon="✨"
              value={dailyStats.newCount}
              label="Yeni"
              color={COLORS.accent}
            />
            <DailyStat
              icon="🔄"
              value={dailyStats.dueCount}
              label="Tekrar"
              color={COLORS.secondary}
            />
            <DailyStat
              icon="✅"
              value={dailyStats.todayStudied}
              label="Öğrenildi"
              color={COLORS.success}
            />
            <DailyStat
              icon="🏆"
              value={dailyStats.masteredCount}
              label="Ustalaşıldı"
              color="#F9CA24"
            />
          </View>
          {/* Progress bar */}
          <View style={styles.dailyProgress}>
            <View
              style={[
                styles.dailyProgressFill,
                {
                  width: `${Math.min(
                    100,
                    (dailyStats.todayStudied /
                      (state.settings?.dailyGoal || 10)) *
                      100
                  )}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.dailyGoalText}>
            Günlük hedef: {dailyStats.todayStudied}/
            {state.settings?.dailyGoal || 10}
          </Text>
        </Animated.View>

        {/* Stats Row */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
          <StatCard
            icon="📚"
            value={totalLearned}
            label="Toplam"
            color={COLORS.accent}
          />
          <StatCard
            icon="⭐"
            value={
              allWords.filter(
                (w) => (state.wordProgress[w.id]?.masteryLevel || 0) >= 4
              ).length
            }
            label="Ustalaşıldı"
            color="#F9CA24"
          />
          <StatCard
            icon="🎯"
            value={state.stats.totalSessions || 0}
            label="Oturum"
            color={COLORS.secondary}
          />
        </Animated.View>

        {/* Firebase badge */}
        {state.firestoreWords?.length > 0 && (
          <Animated.View style={[styles.syncBadge, { opacity: fadeAnim }]}>
            <Ionicons name="cloud-done" size={14} color={COLORS.secondary} />
            <Text style={styles.syncText}>
              {state.firestoreWords.length} kelime senkronize edildi
            </Text>
          </Animated.View>
        )}

        {/* CTA Butonu */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => navigation.navigate("Learn")}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[COLORS.accent, COLORS.accentDark || "#5A52D5"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.startGradient}
            >
              <Ionicons name="play-circle" size={28} color="#fff" />
              <View>
                <Text style={styles.startTitle}>Öğrenmeye Başla</Text>
                <Text style={styles.startSubtitle}>
                  {dailyStats.dueCount > 0
                    ? `${dailyStats.dueCount} tekrar + yeni kelimeler`
                    : `${dailyStats.newCount} yeni kelime seni bekliyor`}
                </Text>
              </View>
              <Ionicons
                name="arrow-forward"
                size={22}
                color="#fff"
                style={{ marginLeft: "auto" }}
              />
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* Da Vinci Prensipleri */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Da Vinci Prensipleri</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: SPACING.sm, paddingHorizontal: 2 }}
          >
            {[
              {
                icon: "🔍",
                name: "Curiosità",
                desc: "Sonsuz merak",
                color: "#F5A623",
              },
              {
                icon: "✨",
                name: "Sensazione",
                desc: "5 duyuyla algı",
                color: "#A29BFE",
              },
              {
                icon: "⚗️",
                name: "Dimostrazione",
                desc: "Deneyerek öğren",
                color: "#4ECDC4",
              },
              {
                icon: "🕸️",
                name: "Connessione",
                desc: "Her şey bağlantılı",
                color: "#81C784",
              },
              {
                icon: "⚖️",
                name: "Arte/Scienza",
                desc: "Denge ve test",
                color: "#E17055",
              },
            ].map((p, i) => (
              <View
                key={i}
                style={[styles.principleCard, { borderColor: p.color + "40" }]}
              >
                <Text style={styles.principleIcon}>{p.icon}</Text>
                <Text style={[styles.principleName, { color: p.color }]}>
                  {p.name}
                </Text>
                <Text style={styles.principleDesc}>{p.desc}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ icon, value, label, color }) {
  return (
    <View style={[styles.statCard, { borderColor: color + "30" }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function DailyStat({ icon, value, label, color }) {
  return (
    <View style={styles.dailyStatItem}>
      <Text style={styles.dailyStatIcon}>{icon}</Text>
      <Text style={[styles.dailyStatValue, { color }]}>{value}</Text>
      <Text style={styles.dailyStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingTop: 4 },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  greeting: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  trialBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.accentGlow,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  trialBadgeText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
  },

  streakCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  streakFire: { fontSize: 40 },
  streakNum: { color: "#fff", fontSize: 36, fontWeight: "900" },
  streakLabel: { color: "rgba(255,255,255,0.8)", fontSize: FONT_SIZES.sm },
  streakRight: { alignItems: "flex-end", gap: SPACING.sm },
  streakMsg: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  streakDots: { flexDirection: "row", gap: 4 },
  streakDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.8)",
  },

  dailyCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  dailyHeader: { gap: 4 },
  dailyTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  dailyMsg: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  dailyStats: { flexDirection: "row", justifyContent: "space-around" },
  dailyStatItem: { alignItems: "center", gap: 3 },
  dailyStatIcon: { fontSize: 20 },
  dailyStatValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  dailyStatLabel: { color: COLORS.textMuted, fontSize: 10 },
  dailyProgress: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  dailyProgressFill: {
    height: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  dailyGoalText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "right",
  },

  statsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.md },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  statIcon: { fontSize: 20 },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: "800" },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.secondary + "30",
  },
  syncText: {
    color: COLORS.secondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },

  startButton: {
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  startGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  startTitle: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "700" },
  startSubtitle: { color: "rgba(255,255,255,0.8)", fontSize: FONT_SIZES.xs },

  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },
  principleCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignItems: "center",
    width: 100,
    gap: 4,
    borderWidth: 1,
  },
  principleIcon: { fontSize: 28 },
  principleName: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
    textAlign: "center",
  },
  principleDesc: { color: COLORS.textMuted, fontSize: 9, textAlign: "center" },
});
