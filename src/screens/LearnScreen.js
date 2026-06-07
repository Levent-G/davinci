// src/screens/LearnScreen.jsx
import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  FlatList,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import {
  getMasteryLevel,
  getDailyWords,
  getDailyStats,
  isDueForReview,
} from "../utils/davinciAlgorithm";
import { WORDS_BY_LEVEL } from "../data/wordDatabase";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_COLORS = {
  A1: "#4ECDC4",
  A2: "#45B7D1",
  B1: "#96C93D",
  B2: "#F9CA24",
  C1: "#F0932B",
  C2: "#E17055",
};

export default function LearnScreen({ navigation, route }) {
  const { state, actions } = useApp();
  const [selectedLevel, setSelectedLevel] = useState(
    route.params?.level || "A1"
  );
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("words");

  useEffect(() => {
    if (route.params?.level) {
      setSelectedLevel(route.params.level);
      setActiveTab("words");
    }
  }, [route.params?.level]);

  const allWords = actions.getAllWords();
  const dailyStats = getDailyStats(allWords, state.wordProgress);

  // Her seviye için tamamlanma yüzdesi
  const levelProgress = useMemo(() => {
    const result = {};
    LEVELS.forEach((lvl) => {
      const words = allWords.filter((w) => w.level === lvl);
      if (words.length === 0) {
        result[lvl] = { pct: 0, learned: 0, total: 0, done: false };
        return;
      }
      const learned = words.filter((w) => {
        const p = state.wordProgress[w.id];
        if (!p) return false;
        return p.knownByUser || (p.masteryLevel || 0) >= 4;
      }).length;
      const pct = Math.round((learned / words.length) * 100);
      result[lvl] = { pct, learned, total: words.length, done: pct === 100 };
    });
    return result;
  }, [allWords, state.wordProgress]);

  const levelWords = useMemo(() => {
    const fsWords = state.firestoreWords || [];
    const source =
      fsWords.length > 0
        ? fsWords.filter((w) => w.level === selectedLevel)
        : WORDS_BY_LEVEL[selectedLevel] || [];
    const base = [
      ...source,
      ...state.customWords.filter((w) => w.level === selectedLevel),
    ];
    if (!searchText) return base;
    return base.filter(
      (w) =>
        w.word.toLowerCase().includes(searchText.toLowerCase()) ||
        w.translation.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [selectedLevel, state.customWords, state.firestoreWords, searchText]);

  const reviewWords = useMemo(
    () =>
      allWords.filter((w) => {
        const p = state.wordProgress[w.id];
        return p && isDueForReview(p);
      }),
    [allWords, state.wordProgress]
  );

  // Seçili seviyede öğrenilmemiş kelimeler
  const unlearnedForLevel = useMemo(() => {
    return allWords.filter((w) => {
      if (w.level !== selectedLevel) return false;
      const p = state.wordProgress[w.id];
      if (!p) return true;
      if (p.knownByUser) return false;
      if ((p.masteryLevel || 0) >= 4) return false;
      return true;
    });
  }, [allWords, state.wordProgress, selectedLevel]);

  const handleStartSession = () => {
    const sessionSize = state.settings?.sessionSize || 5;
    const sessionWords = getDailyWords(
      allWords.filter((w) => w.level === selectedLevel),
      state.wordProgress,
      sessionSize,
      selectedLevel
    );

    if (sessionWords.length === 0) {
      // Seviye tamamlandı
      return;
    }

    navigation.navigate("LearningSession", {
      level: selectedLevel,
      words: sessionWords,
      mode: "learn",
    });
  };

  const handleQuickScan = () => {
    // Hızlı tarama — bilinen/öğrenilmiş kelimeleri dışla, karıştır
    const candidates = allWords
      .filter((w) => {
        if (w.level !== selectedLevel) return false;
        const p = state.wordProgress[w.id];
        if (!p) return true; // hiç görülmemiş — dahil
        if (p.knownByUser) return false; // "biliyorum" denilmiş — dışla
        if ((p.masteryLevel || 0) >= 4) return false; // tam öğrenilmiş — dışla
        return true;
      })
      .sort(() => Math.random() - 0.5) // her seferinde farklı sıra
      .slice(0, 15);

    if (candidates.length === 0) {
      alert("🎉 Bu seviyedeki tüm kelimeler öğrenildi!");
      return;
    }

    navigation.navigate("QuickScan", {
      words: candidates,
      level: selectedLevel,
    });
  };

  const lp = levelProgress[selectedLevel] || {
    pct: 0,
    learned: 0,
    total: 0,
    done: false,
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[0]}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Öğren</Text>
            <Text style={styles.headerSub}>
              Bugün {dailyStats.todayStudied} kelime öğrendin
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate("AddWord")}
          >
            <Ionicons name="add" size={22} color={COLORS.accent} />
          </TouchableOpacity>
        </View>

        {/* ── Seviye Seçici ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.levelRow}
        >
          {LEVELS.map((lvl) => {
            const lpi = levelProgress[lvl] || { pct: 0, done: false };
            const active = selectedLevel === lvl;
            const color = LEVEL_COLORS[lvl];
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.levelChip,
                  active && { backgroundColor: color, borderColor: color },
                  !active && { borderColor: color + "60" },
                  lpi.done && !active && { opacity: 0.5 },
                ]}
                onPress={() => setSelectedLevel(lvl)}
                activeOpacity={0.8}
              >
                {/* Tamamlanma bar */}
                {!lpi.done && lpi.pct > 0 && (
                  <View
                    style={[
                      styles.levelChipBar,
                      {
                        width: `${lpi.pct}%`,
                        backgroundColor: active
                          ? "rgba(255,255,255,0.3)"
                          : color + "30",
                      },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.levelChipText,
                    active && { color: "#fff" },
                    !active && { color: color },
                  ]}
                >
                  {lpi.done ? "✅" : lvl}
                </Text>
                <Text
                  style={[
                    styles.levelChipPct,
                    active && { color: "rgba(255,255,255,0.8)" },
                    !active && { color: color + "AA" },
                  ]}
                >
                  {lpi.pct}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Seçili Seviye Özeti ── */}
        <View style={styles.levelSummary}>
          <View style={styles.levelSummaryLeft}>
            <Text
              style={[
                styles.levelSummaryTitle,
                { color: LEVEL_COLORS[selectedLevel] },
              ]}
            >
              {selectedLevel} Seviyesi
            </Text>
            <Text style={styles.levelSummaryDesc}>
              {lp.done
                ? "🎉 Bu seviyeyi tamamladın!"
                : `${unlearnedForLevel.length} kelime öğrenmeyi bekliyor`}
            </Text>
          </View>
          <View style={styles.levelSummaryRight}>
            <Text
              style={[
                styles.levelSummaryPct,
                { color: LEVEL_COLORS[selectedLevel] },
              ]}
            >
              {lp.pct}%
            </Text>
            <Text style={styles.levelSummaryFrac}>
              {lp.learned}/{lp.total}
            </Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.levelProgressBg}>
          <View
            style={[
              styles.levelProgressFill,
              {
                width: `${lp.pct}%`,
                backgroundColor: LEVEL_COLORS[selectedLevel],
              },
            ]}
          />
        </View>

        {/* ── Aksiyon Butonları ── */}
        {!lp.done ? (
          <View style={styles.actionBtns}>
            {/* Ana öğrenme butonu */}
            <TouchableOpacity
              style={styles.mainStartBtn}
              onPress={handleStartSession}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={[
                  LEVEL_COLORS[selectedLevel],
                  LEVEL_COLORS[selectedLevel] + "BB",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.mainStartGrad}
              >
                <Ionicons name="play-circle" size={24} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.mainStartTitle}>Öğrenmeye Başla</Text>
                  <Text style={styles.mainStartSub}>
                    5 yeni kelime • Da Vinci metodu
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>

            {/* Hızlı Tarama butonu */}
            {unlearnedForLevel.length > 5 && (
              <TouchableOpacity
                style={[
                  styles.scanBtn,
                  { borderColor: LEVEL_COLORS[selectedLevel] + "60" },
                ]}
                onPress={handleQuickScan}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="flash"
                  size={18}
                  color={LEVEL_COLORS[selectedLevel]}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.scanTitle,
                      { color: LEVEL_COLORS[selectedLevel] },
                    ]}
                  >
                    Hızlı Tarama
                  </Text>
                  <Text style={styles.scanSub}>
                    Hangilerini bildiğini işaretle, kalanları öğren
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          // Seviye tamamlandı
          <View
            style={[
              styles.doneBox,
              { borderColor: LEVEL_COLORS[selectedLevel] + "40" },
            ]}
          >
            <Text style={styles.doneEmoji}>🏆</Text>
            <Text
              style={[styles.doneTitle, { color: LEVEL_COLORS[selectedLevel] }]}
            >
              {selectedLevel} Tamamlandı!
            </Text>
            <Text style={styles.doneDesc}>
              Bir sonraki seviyeye geçmeye hazırsın
            </Text>
            {LEVELS.indexOf(selectedLevel) < LEVELS.length - 1 && (
              <TouchableOpacity
                style={[
                  styles.nextLevelBtn,
                  { backgroundColor: LEVEL_COLORS[selectedLevel] },
                ]}
                onPress={() =>
                  setSelectedLevel(LEVELS[LEVELS.indexOf(selectedLevel) + 1])
                }
              >
                <Text style={styles.nextLevelBtnText}>
                  {LEVELS[LEVELS.indexOf(selectedLevel) + 1]}'e Geç →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Tekrar Gereken ── */}
        {reviewWords.length > 0 && (
          <TouchableOpacity
            style={styles.reviewBtn}
            onPress={() =>
              navigation.navigate("LearningSession", {
                words: reviewWords.slice(0, 5),
                mode: "review",
              })
            }
          >
            <View style={styles.reviewLeft}>
              <Text style={styles.reviewIcon}>🔄</Text>
              <View>
                <Text style={styles.reviewTitle}>Tekrar Zamanı</Text>
                <Text style={styles.reviewDesc}>
                  {reviewWords.length} kelime seni bekliyor
                </Text>
              </View>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={COLORS.secondary}
            />
          </TouchableOpacity>
        )}

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          {["words", "review"].map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.tabTextActive,
                ]}
              >
                {tab === "words"
                  ? "Kelimeler"
                  : `Tekrar (${reviewWords.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Arama ── */}
        {activeTab === "words" && (
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color={COLORS.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Kelime ara..."
              placeholderTextColor={COLORS.textMuted}
              value={searchText}
              onChangeText={setSearchText}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText("")}>
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ── Kelime Listesi ── */}
        {activeTab === "words" && (
          <View style={{ paddingHorizontal: SPACING.lg }}>
            {levelWords.map((word) => {
              const p = state.wordProgress[word.id];
              const mastery = getMasteryLevel(p || {});
              const known = p?.knownByUser || mastery >= 4;
              const color = LEVEL_COLORS[word.level];
              return (
                <TouchableOpacity
                  key={word.id}
                  style={styles.wordCard}
                  onPress={() => navigation.navigate("WordDetail", { word })}
                  activeOpacity={0.85}
                >
                  <View style={styles.wordCardLeft}>
                    <Text style={styles.wordText}>{word.word}</Text>
                    <Text style={styles.wordTr}>{word.translation}</Text>
                  </View>
                  <View style={styles.wordCardRight}>
                    {known ? (
                      <View
                        style={[
                          styles.masteryBadge,
                          { backgroundColor: COLORS.success + "20" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.masteryText,
                            { color: COLORS.success },
                          ]}
                        >
                          ✓ Öğrenildi
                        </Text>
                      </View>
                    ) : mastery > 0 ? (
                      <View
                        style={[
                          styles.masteryBadge,
                          { backgroundColor: color + "20" },
                        ]}
                      >
                        <Text style={[styles.masteryText, { color }]}>
                          {mastery}/5
                        </Text>
                      </View>
                    ) : (
                      <View
                        style={[
                          styles.masteryBadge,
                          { backgroundColor: COLORS.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.masteryText,
                            { color: COLORS.textMuted },
                          ]}
                        >
                          Yeni
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={{ height: 100 }} />
          </View>
        )}

        {/* ── Tekrar Listesi ── */}
        {activeTab === "review" && (
          <View style={{ paddingHorizontal: SPACING.lg }}>
            {reviewWords.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>✅</Text>
                <Text style={styles.emptyText}>
                  Şu an tekrar gereken kelime yok
                </Text>
              </View>
            ) : (
              reviewWords.map((word) => (
                <TouchableOpacity
                  key={word.id}
                  style={styles.wordCard}
                  onPress={() => navigation.navigate("WordDetail", { word })}
                >
                  <View style={styles.wordCardLeft}>
                    <Text style={styles.wordText}>{word.word}</Text>
                    <Text style={styles.wordTr}>{word.translation}</Text>
                  </View>
                  <View
                    style={[
                      styles.masteryBadge,
                      { backgroundColor: COLORS.secondary + "20" },
                    ]}
                  >
                    <Text
                      style={[styles.masteryText, { color: COLORS.secondary }]}
                    >
                      Tekrar
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
            <View style={{ height: 100 }} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  headerSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  levelRow: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  levelChip: {
    minWidth: 64,
    height: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
    overflow: "hidden",
    position: "relative",
  },
  levelChipBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: RADIUS.lg,
  },
  levelChipText: { fontSize: FONT_SIZES.md, fontWeight: "900", zIndex: 1 },
  levelChipPct: { fontSize: 10, fontWeight: "600", zIndex: 1 },

  levelSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  levelSummaryLeft: { gap: 2 },
  levelSummaryTitle: { fontSize: FONT_SIZES.lg, fontWeight: "800" },
  levelSummaryDesc: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  levelSummaryRight: { alignItems: "flex-end" },
  levelSummaryPct: { fontSize: FONT_SIZES.xxl, fontWeight: "900" },
  levelSummaryFrac: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  levelProgressBg: {
    height: 6,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    borderRadius: 3,
    marginBottom: SPACING.lg,
    overflow: "hidden",
  },
  levelProgressFill: { height: 6, borderRadius: 3 },

  actionBtns: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  mainStartBtn: { borderRadius: RADIUS.xl, overflow: "hidden" },
  mainStartGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  mainStartTitle: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "700" },
  mainStartSub: { color: "rgba(255,255,255,0.8)", fontSize: FONT_SIZES.xs },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    backgroundColor: COLORS.backgroundCard,
  },
  scanTitle: { fontSize: FONT_SIZES.md, fontWeight: "700" },
  scanSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  doneBox: {
    margin: SPACING.lg,
    padding: SPACING.xl,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    alignItems: "center",
    gap: SPACING.sm,
  },
  doneEmoji: { fontSize: 48 },
  doneTitle: { fontSize: FONT_SIZES.xl, fontWeight: "800" },
  doneDesc: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
  },
  nextLevelBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  nextLevelBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },

  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.secondary + "40",
  },
  reviewLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  reviewIcon: { fontSize: 24 },
  reviewTitle: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
  reviewDesc: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  tabs: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    borderRadius: RADIUS.md,
  },
  tabActive: { backgroundColor: COLORS.accent },
  tabText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  tabTextActive: { color: "#fff" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    paddingVertical: SPACING.sm,
  },

  wordCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wordCardLeft: { flex: 1, gap: 2 },
  wordCardRight: {},
  wordText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  wordTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  masteryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  masteryText: { fontSize: 11, fontWeight: "700" },

  emptyBox: { padding: SPACING.xxxl, alignItems: "center", gap: SPACING.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
  },
});
