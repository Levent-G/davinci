// src/screens/StatsScreen.jsx
import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { getMasteryLevel, getMasteryLabel } from "../utils/davinciAlgorithm";
import { WORDS_BY_LEVEL } from "../data/wordDatabase";

const { width } = Dimensions.get("window");
const BAR_MAX_H = 90;

const LEVEL_COLORS = {
  A1: "#4ECDC4",
  A2: "#45B7D1",
  B1: "#96C93D",
  B2: "#F9CA24",
  C1: "#F0932B",
  C2: "#E17055",
};
const MASTERY_COLORS = [
  COLORS.textMuted,
  "#EF5350",
  "#FFA726",
  COLORS.secondary,
  COLORS.accent,
  COLORS.success,
];

export default function StatsScreen({ navigation }) {
  const { state, actions } = useApp();
  const [activeTab, setActiveTab] = useState("week"); // week | month | alltime
  const [expandedSection, setExpanded] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const allWords = actions.getAllWords();
  const { stats, wordProgress } = state;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // ── Haftalık aktivite ───────────────────────────────────────────────────
  const weekActivity = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toDateString();
      const dayData = stats.dailyStats?.[key] || {};
      days.push({
        label: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][d.getDay()],
        count: dayData.wordsLearned || 0,
        sessions: dayData.sessionsCompleted || 0,
        isToday: i === 0,
      });
    }
    return days;
  }, [stats.dailyStats]);

  // ── Aylık aktivite ──────────────────────────────────────────────────────
  const monthActivity = useMemo(() => {
    const weeks = [];
    for (let w = 3; w >= 0; w--) {
      let total = 0;
      for (let d = 0; d < 7; d++) {
        const date = new Date();
        date.setDate(date.getDate() - (w * 7 + d));
        total += stats.dailyStats?.[date.toDateString()]?.wordsLearned || 0;
      }
      weeks.push({ label: `${4 - w}. Hafta`, count: total });
    }
    return weeks;
  }, [stats.dailyStats]);

  const chartData = activeTab === "week" ? weekActivity : monthActivity;
  const maxCount = Math.max(...chartData.map((d) => d.count), 1);

  // ── Seviye istatistikleri ───────────────────────────────────────────────
  const levelStats = useMemo(() => {
    return ["A1", "A2", "B1", "B2", "C1", "C2"].map((level) => {
      const words = [
        ...(WORDS_BY_LEVEL[level] || []),
        ...state.customWords.filter((w) => w.level === level),
      ];
      const learned = words.filter(
        (w) => getMasteryLevel(wordProgress[w.id] || {}) >= 3
      ).length;
      const mastered = words.filter(
        (w) => getMasteryLevel(wordProgress[w.id] || {}) >= 5
      ).length;
      const inProgress = words.filter((w) => {
        const m = getMasteryLevel(wordProgress[w.id] || {});
        return m > 0 && m < 3;
      }).length;
      return {
        level,
        total: words.length,
        learned,
        mastered,
        inProgress,
        percentage:
          words.length > 0 ? Math.round((learned / words.length) * 100) : 0,
      };
    });
  }, [wordProgress, state.customWords]);

  // ── Ustalık dağılımı ────────────────────────────────────────────────────
  const masteryDist = useMemo(() => {
    const dist = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    allWords.forEach((w) => {
      const m = getMasteryLevel(wordProgress[w.id] || {});
      dist[m] = (dist[m] || 0) + 1;
    });
    return dist;
  }, [wordProgress, allWords]);

  // ── Kategori analizi ─────────────────────────────────────────────────────
  const categoryStats = useMemo(() => {
    const cats = {};
    allWords.forEach((w) => {
      const cat = w.category || "other";
      if (!cats[cat]) cats[cat] = { total: 0, learned: 0 };
      cats[cat].total++;
      if (getMasteryLevel(wordProgress[w.id] || {}) >= 3) cats[cat].learned++;
    });
    return Object.entries(cats)
      .map(([cat, data]) => ({
        cat,
        ...data,
        pct: Math.round((data.learned / data.total) * 100),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [wordProgress, allWords]);

  // ── Kişisel rekorlar ─────────────────────────────────────────────────────
  const personalBests = useMemo(() => {
    const dailyValues = Object.values(stats.dailyStats || {}).map(
      (d) => d.wordsLearned || 0
    );
    return {
      bestDay: Math.max(...dailyValues, 0),
      bestStreak: stats.longestStreak || 0,
      totalSessions: stats.totalSessions || 0,
      avgPerDay:
        dailyValues.length > 0
          ? Math.round(
              dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length
            )
          : 0,
      totalLearned: stats.totalWordsLearned || 0,
    };
  }, [stats]);

  const totalLearned = Object.values(wordProgress).filter((p) => {
    const s = p?.status || "new";
    // Yeni: done, known | Eski: learned, known
    return ["done", "known", "learned"].includes(s) || getMasteryLevel(p) >= 3;
  }).length;
  const completionPct =
    allWords.length > 0
      ? Math.round((totalLearned / allWords.length) * 100)
      : 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Text style={styles.pageTitle}>İstatistikler</Text>

        {/* ── KPI Kartlar ── */}
        <Animated.View style={[styles.kpiGrid, { opacity: fadeAnim }]}>
          <KPICard
            icon="🔥"
            value={stats.streak || 0}
            label="Günlük Seri"
            color={COLORS.error}
          />
          <KPICard
            icon="📚"
            value={stats.totalWordsLearned || 0}
            label="Öğrenilen"
            color={COLORS.accent}
          />
          <KPICard
            icon="🎯"
            value={stats.totalSessions || 0}
            label="Oturum"
            color={COLORS.secondary}
          />
          <KPICard
            icon="⚡"
            value={stats.longestStreak || 0}
            label="En Uzun Seri"
            color="#A29BFE"
          />
        </Animated.View>

        {/* ── Genel İlerleme ── */}
        <View style={styles.section}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle}>Genel İlerleme</Text>
            <Text style={[styles.pctBig, { color: COLORS.accent }]}>
              {completionPct}%
            </Text>
          </View>
          <View style={styles.progressBarBg}>
            <Animated.View
              style={[styles.progressBarFill, { width: `${completionPct}%` }]}
            />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressMetaText}>
              {totalLearned} öğrenildi
            </Text>
            <Text style={styles.progressMetaText}>
              {allWords.length - totalLearned} kaldı
            </Text>
          </View>
        </View>

        {/* ── Aktivite Grafik ── */}
        <View style={styles.section}>
          <View style={styles.chartHeader}>
            <Text style={styles.sectionTitle}>Aktivite</Text>
            <View style={styles.tabRow}>
              {[
                { id: "week", label: "Hafta" },
                { id: "month", label: "Ay" },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.tabChip,
                    activeTab === t.id && styles.tabChipActive,
                  ]}
                  onPress={() => setActiveTab(t.id)}
                >
                  <Text
                    style={[
                      styles.tabChipText,
                      activeTab === t.id && styles.tabChipTextActive,
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.barChart}>
            {chartData.map((d, i) => {
              const h = Math.max(8, (d.count / maxCount) * BAR_MAX_H);
              const isHighlight =
                d.isToday || (activeTab === "month" && i === 3);
              return (
                <View key={i} style={styles.barItem}>
                  <Text style={styles.barVal}>
                    {d.count > 0 ? d.count : ""}
                  </Text>
                  <View style={styles.barBg}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: h,
                          backgroundColor: isHighlight
                            ? COLORS.accent
                            : d.count > 0
                            ? COLORS.secondary + "AA"
                            : COLORS.border,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barLabel,
                      isHighlight && {
                        color: COLORS.accent,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Özet satırı */}
          <View style={styles.chartSummary}>
            <SummaryChip
              icon="📖"
              value={chartData.reduce((s, d) => s + d.count, 0)}
              label="kelime"
            />
            <SummaryChip
              icon="🎯"
              value={weekActivity.reduce((s, d) => s + (d.sessions || 0), 0)}
              label="oturum"
            />
            <SummaryChip
              icon="📅"
              value={weekActivity.filter((d) => d.count > 0).length}
              label="aktif gün"
            />
          </View>
        </View>

        {/* ── Kişisel Rekorlar ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kişisel Rekorlar 🏆</Text>
          <View style={styles.recordsGrid}>
            <RecordCard
              icon="🔥"
              label="En Uzun Seri"
              value={`${personalBests.bestStreak} gün`}
              color={COLORS.error}
            />
            <RecordCard
              icon="📚"
              label="En İyi Gün"
              value={`${personalBests.bestDay} kelime`}
              color={COLORS.accent}
            />
            <RecordCard
              icon="📊"
              label="Günlük Ort."
              value={`${personalBests.avgPerDay} kelime`}
              color={COLORS.secondary}
            />
            <RecordCard
              icon="🎯"
              label="Toplam Oturum"
              value={`${personalBests.totalSessions}`}
              color="#A29BFE"
            />
          </View>
        </View>

        {/* ── Seviye İlerlemesi ── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sectionHeaderRow}
            onPress={() =>
              setExpanded(expandedSection === "levels" ? null : "levels")
            }
          >
            <Text style={styles.sectionTitle}>Seviye İlerlemesi</Text>
            <Ionicons
              name={
                expandedSection === "levels" ? "chevron-up" : "chevron-down"
              }
              size={20}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
          {levelStats.map((ls, i) => (
            <View key={ls.level} style={styles.levelRow}>
              <View
                style={[
                  styles.levelBadge,
                  { backgroundColor: LEVEL_COLORS[ls.level] + "20" },
                ]}
              >
                <Text
                  style={[
                    styles.levelBadgeText,
                    { color: LEVEL_COLORS[ls.level] },
                  ]}
                >
                  {ls.level}
                </Text>
              </View>
              <View style={styles.levelMid}>
                <View style={styles.levelBarBg}>
                  <View
                    style={[
                      styles.levelBarFill,
                      {
                        width: `${ls.percentage}%`,
                        backgroundColor: LEVEL_COLORS[ls.level],
                      },
                    ]}
                  />
                </View>
                {expandedSection === "levels" && (
                  <View style={styles.levelDetail}>
                    <Text style={styles.levelDetailText}>
                      ✅ {ls.learned} öğrenildi
                    </Text>
                    <Text style={styles.levelDetailText}>
                      🔄 {ls.inProgress} devam ediyor
                    </Text>
                    <Text style={styles.levelDetailText}>
                      🏆 {ls.mastered} ustalaşıldı
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.levelRight}>
                <Text
                  style={[styles.levelPct, { color: LEVEL_COLORS[ls.level] }]}
                >
                  {ls.percentage}%
                </Text>
                <Text style={styles.levelCount}>
                  {ls.learned}/{ls.total}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Ustalık Dağılımı ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ustalık Dağılımı</Text>
          <View style={styles.masteryChart}>
            {[0, 1, 2, 3, 4, 5].map((level) => {
              const count = masteryDist[level] || 0;
              const maxM = Math.max(...Object.values(masteryDist), 1);
              const h = Math.max(8, (count / maxM) * 60);
              return (
                <View key={level} style={styles.masteryBar}>
                  <Text
                    style={[
                      styles.masteryCount,
                      { color: MASTERY_COLORS[level] },
                    ]}
                  >
                    {count}
                  </Text>
                  <View
                    style={[
                      styles.masteryFill,
                      { height: h, backgroundColor: MASTERY_COLORS[level] },
                    ]}
                  />
                  <Text style={styles.masteryLabel}>
                    {getMasteryLabel(level).slice(0, 6)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Kategori Analizi ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kategori Analizi</Text>
          <View style={styles.categoryList}>
            {categoryStats.map((c, i) => (
              <View key={i} style={styles.catRow}>
                <Text style={styles.catName}>{c.cat.replace(/_/g, " ")}</Text>
                <View style={styles.catBarBg}>
                  <View
                    style={[
                      styles.catBarFill,
                      {
                        width: `${c.pct}%`,
                        backgroundColor: Object.values(LEVEL_COLORS)[i % 6],
                      },
                    ]}
                  />
                </View>
                <Text style={styles.catPct}>{c.pct}%</Text>
                <Text style={styles.catCount}>
                  {c.learned}/{c.total}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Özet ── */}
        <LinearGradient
          colors={[COLORS.backgroundCard, COLORS.backgroundCardLight]}
          style={styles.summaryCard}
        >
          <Text style={styles.summaryTitle}>📋 Detaylı Özet</Text>
          <SummaryRow label="Toplam kelime havuzu" value={allWords.length} />
          <SummaryRow
            label="Öğrenilmiş (≥ Orta)"
            value={totalLearned}
            color={COLORS.success}
          />
          <SummaryRow
            label="Ustalaşılmış (Maks.)"
            value={masteryDist[5] || 0}
            color={COLORS.accent}
          />
          <SummaryRow
            label="Tamamlanma oranı"
            value={`${completionPct}%`}
            color={COLORS.secondary}
          />
          <SummaryRow
            label="Günlük ortalama"
            value={`${personalBests.avgPerDay} kelime`}
          />
          <SummaryRow label="Özel kelimeler" value={state.customWords.length} />
        </LinearGradient>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function KPICard({ icon, value, label, color }) {
  return (
    <View style={[styles.kpiCard, { borderColor: color + "30" }]}>
      <Text style={styles.kpiIcon}>{icon}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function RecordCard({ icon, label, value, color }) {
  return (
    <View style={[styles.recordCard, { borderColor: color + "30" }]}>
      <Text style={styles.recordIcon}>{icon}</Text>
      <Text style={[styles.recordValue, { color }]}>{value}</Text>
      <Text style={styles.recordLabel}>{label}</Text>
    </View>
  );
}

function SummaryChip({ icon, value, label }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipIcon}>{icon}</Text>
      <Text style={styles.summaryChipValue}>{value}</Text>
      <Text style={styles.summaryChipLabel}>{label}</Text>
    </View>
  );
}

function SummaryRow({ label, value, color }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryRowLabel}>{label}</Text>
      <Text style={[styles.summaryRowValue, color && { color }]}>{value}</Text>
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

  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  kpiCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  kpiIcon: { fontSize: 24 },
  kpiValue: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  kpiLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },

  section: { marginBottom: SPACING.xl },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },

  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.sm,
  },
  pctBig: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  progressBarBg: {
    height: 12,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 6,
  },
  progressBarFill: {
    height: 12,
    backgroundColor: COLORS.accent,
    borderRadius: 6,
  },
  progressMeta: { flexDirection: "row", justifyContent: "space-between" },
  progressMetaText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.md,
  },
  tabRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    padding: 3,
  },
  tabChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  tabChipActive: { backgroundColor: COLORS.accent },
  tabChipText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  tabChipTextActive: { color: "#fff" },

  barChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: BAR_MAX_H + 50,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  barItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  barVal: { color: COLORS.textMuted, fontSize: 9 },
  barBg: {
    width: "80%",
    alignItems: "center",
    justifyContent: "flex-end",
    height: BAR_MAX_H,
  },
  barFill: { width: "100%", borderRadius: 4 },
  barLabel: { color: COLORS.textMuted, fontSize: 9 },

  chartSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryChip: { alignItems: "center", gap: 2 },
  summaryChipIcon: { fontSize: 16 },
  summaryChipValue: {
    color: COLORS.textPrimary,
    fontWeight: "800",
    fontSize: FONT_SIZES.md,
  },
  summaryChipLabel: { color: COLORS.textMuted, fontSize: 9 },

  recordsGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  recordCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  recordIcon: { fontSize: 22 },
  recordValue: { fontSize: FONT_SIZES.lg, fontWeight: "800" },
  recordLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },

  levelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  levelBadge: {
    width: 36,
    height: 24,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeText: { fontSize: FONT_SIZES.xs, fontWeight: "800" },
  levelMid: { flex: 1 },
  levelBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  levelBarFill: { height: 8, borderRadius: 4 },
  levelDetail: { flexDirection: "row", gap: SPACING.sm, marginTop: 4 },
  levelDetailText: { color: COLORS.textMuted, fontSize: 9 },
  levelRight: { alignItems: "flex-end", gap: 1 },
  levelPct: { fontSize: FONT_SIZES.sm, fontWeight: "700" },
  levelCount: { color: COLORS.textMuted, fontSize: 9 },

  masteryChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    height: 100,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  masteryBar: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  masteryCount: { fontSize: 10, fontWeight: "700" },
  masteryFill: { width: "80%", borderRadius: 3 },
  masteryLabel: { color: COLORS.textMuted, fontSize: 8, textAlign: "center" },

  categoryList: { gap: SPACING.sm },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catName: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    width: 80,
    textTransform: "capitalize",
  },
  catBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  catBarFill: { height: 6, borderRadius: 3 },
  catPct: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
    width: 30,
    textAlign: "right",
  },
  catCount: {
    color: COLORS.textMuted,
    fontSize: 9,
    width: 32,
    textAlign: "right",
  },

  summaryCard: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  summaryTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryRowLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  summaryRowValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
  },
});
