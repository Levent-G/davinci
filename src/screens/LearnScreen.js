// src/screens/LearnScreen.jsx
import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { useSubscription } from "../context/SubscriptionContext";
import {
  getMasteryLevel,
  getMasteryLabel,
  isDueForReview,
  getDailyWords,
  getDailyStats,
} from "../utils/davinciAlgorithm";
import { WORDS_BY_LEVEL } from "../data/wordDatabase";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_COLORS = {
  A1: COLORS.levelA1,
  A2: COLORS.levelA2,
  B1: COLORS.levelB1,
  B2: COLORS.levelB2,
  C1: COLORS.levelC1,
  C2: COLORS.levelC2,
};

export default function LearnScreen({ navigation, route }) {
  const { state, actions } = useApp();
  const { state: subState, actions: subActions } = useSubscription();
  const [selectedLevel, setSelectedLevel] = useState(
    route.params?.level || "A1"
  );
  const [searchText, setSearchText] = useState("");
  const [activeTab, setActiveTab] = useState("words"); // 'words' | 'review'

  // HomeScreen'den seviye parametresi geldiğinde güncelle
  useEffect(() => {
    if (route.params?.level) {
      setSelectedLevel(route.params.level);
      setActiveTab("words");
    }
  }, [route.params?.level]);

  const allWords = actions.getAllWords();
  const todayCount = actions.getTodayWordCount();

  const levelWords = useMemo(() => {
    // Firebase kelimeleri varsa onları kullan, yoksa lokal
    const fsWords = state.firestoreWords || [];
    const levelSource =
      fsWords.length > 0
        ? fsWords.filter((w) => w.level === selectedLevel)
        : WORDS_BY_LEVEL[selectedLevel] || [];
    const base = [
      ...levelSource,
      ...state.customWords.filter((w) => w.level === selectedLevel),
    ];
    if (!searchText) return base;
    return base.filter(
      (w) =>
        w.word.toLowerCase().includes(searchText.toLowerCase()) ||
        w.translation.toLowerCase().includes(searchText.toLowerCase())
    );
  }, [selectedLevel, state.customWords, state.firestoreWords, searchText]);

  const reviewWords = useMemo(() => {
    return allWords.filter((w) => {
      const progress = state.wordProgress[w.id];
      return progress && isDueForReview(progress);
    });
  }, [allWords, state.wordProgress]);

  const handleStartSession = (level, words) => {
    if (!subActions.canLearnWord(todayCount)) {
      navigation.navigate("Paywall");
      return;
    }
    // Akilli kelime secimi - spaced repetition
    const sessionSize = state.settings.sessionSize || 5;
    const sessionWords =
      words ||
      getDailyWords(
        actions.getAllWords().filter((w) => !level || w.level === level),
        state.wordProgress,
        sessionSize,
        level || state.settings.preferredLevel
      );
    navigation.navigate("LearningSession", {
      level,
      words:
        sessionWords.length > 0
          ? sessionWords
          : levelWords.slice(0, sessionSize),
      mode: "learn",
    });
  };

  const handleStartReview = () => {
    if (!subActions.canLearnWord(todayCount)) {
      navigation.navigate("Paywall");
      return;
    }
    navigation.navigate("LearningSession", {
      words: reviewWords.slice(0, 5),
      mode: "review",
    });
  };

  const getWordProgress = (wordId) => state.wordProgress[wordId];

  const renderWord = ({ item }) => {
    const progress = getWordProgress(item.id);
    const mastery = getMasteryLevel(progress || {});
    const masteryColor =
      mastery >= 4
        ? COLORS.success
        : mastery >= 2
        ? COLORS.accent
        : COLORS.textMuted;

    return (
      <TouchableOpacity
        style={styles.wordCard}
        onPress={() => navigation.navigate("WordDetail", { word: item })}
        activeOpacity={0.8}
      >
        <View style={styles.wordCardLeft}>
          <Text style={styles.wordText}>{item.word}</Text>
          <Text style={styles.wordPhonetic}>{item.phonetic}</Text>
          <Text style={styles.wordTranslation}>{item.translation}</Text>
        </View>
        <View style={styles.wordCardRight}>
          <View
            style={[
              styles.masteryBadge,
              { backgroundColor: masteryColor + "20" },
            ]}
          >
            <Text style={[styles.masteryText, { color: masteryColor }]}>
              {getMasteryLabel(mastery)}
            </Text>
          </View>
          {item.isCustom && (
            <View style={styles.customBadge}>
              <Text style={styles.customBadgeText}>Özel</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Günlük istatistikler
  const dailyStats = getDailyStats(actions.getAllWords(), state.wordProgress);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kelimeler</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => navigation.navigate("AddWord")}
        >
          <Ionicons name="add" size={22} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "words" && styles.tabActive]}
          onPress={() => setActiveTab("words")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "words" && styles.tabTextActive,
            ]}
          >
            Kelimeler
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "review" && styles.tabActive]}
          onPress={() => setActiveTab("review")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "review" && styles.tabTextActive,
            ]}
          >
            Tekrar {reviewWords.length > 0 && `(${reviewWords.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === "words" ? (
        <View style={{ flex: 1 }}>
          {/* Level Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.levelScroll}
            contentContainerStyle={styles.levelScrollContent}
          >
            {LEVELS.map((level) => (
              <TouchableOpacity
                key={level}
                style={[
                  styles.levelChip,
                  selectedLevel === level && {
                    backgroundColor: LEVEL_COLORS[level] + "25",
                    borderColor: LEVEL_COLORS[level],
                  },
                ]}
                onPress={() => setSelectedLevel(level)}
              >
                <Text
                  style={[
                    styles.levelChipText,
                    selectedLevel === level && { color: LEVEL_COLORS[level] },
                  ]}
                >
                  {level}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} />
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
                  size={18}
                  color={COLORS.textMuted}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Günlük özet */}
          <View style={styles.dailyStatsRow}>
            <View style={styles.dailyStat}>
              <Text style={styles.dailyStatNum}>{dailyStats.newCount}</Text>
              <Text style={styles.dailyStatLbl}>Yeni</Text>
            </View>
            <View style={styles.dailyStat}>
              <Text style={[styles.dailyStatNum, { color: COLORS.secondary }]}>
                {dailyStats.dueCount}
              </Text>
              <Text style={styles.dailyStatLbl}>Tekrar</Text>
            </View>
            <View style={styles.dailyStat}>
              <Text style={[styles.dailyStatNum, { color: COLORS.success }]}>
                {dailyStats.todayStudied}
              </Text>
              <Text style={styles.dailyStatLbl}>Bugün</Text>
            </View>
            <View style={styles.dailyStat}>
              <Text style={[styles.dailyStatNum, { color: COLORS.accent }]}>
                {dailyStats.masteredCount}
              </Text>
              <Text style={styles.dailyStatLbl}>Ustalaşıldı</Text>
            </View>
          </View>

          {/* Start Session Button */}
          <TouchableOpacity
            style={styles.sessionButton}
            onPress={() => handleStartSession(selectedLevel)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[
                LEVEL_COLORS[selectedLevel],
                LEVEL_COLORS[selectedLevel] + "BB",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.sessionButtonGradient}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.sessionButtonText}>
                Akilli Oturum Baslat ({state.settings.sessionSize || 5} kelime)
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Word List */}
          <FlatList
            data={levelWords}
            renderItem={renderWord}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.wordList}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>Kelime bulunamadı</Text>
              </View>
            }
          />
        </View>
      ) : (
        /* Review Tab */
        <ScrollView contentContainerStyle={styles.reviewContainer}>
          {reviewWords.length > 0 ? (
            <>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewTitle}>
                  {reviewWords.length} kelime tekrarı bekliyor
                </Text>
                <Text style={styles.reviewDesc}>
                  Aralıklı tekrar algoritması bu kelimeleri bugün tekrar etmeni
                  öneriyor.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.reviewStartBtn}
                onPress={handleStartReview}
              >
                <LinearGradient
                  colors={[COLORS.secondary, COLORS.secondaryDark]}
                  style={styles.reviewStartGradient}
                >
                  <Ionicons name="refresh" size={18} color="#fff" />
                  <Text style={styles.reviewStartText}>Tekrarı Başlat</Text>
                </LinearGradient>
              </TouchableOpacity>
              {reviewWords.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.wordCard,
                    { borderLeftWidth: 3, borderLeftColor: COLORS.secondary },
                  ]}
                >
                  <View style={styles.wordCardLeft}>
                    <Text style={styles.wordText}>{item.word}</Text>
                    <Text style={styles.wordTranslation}>
                      {item.translation}
                    </Text>
                  </View>
                  <View style={styles.wordCardRight}>
                    <View
                      style={[
                        styles.masteryBadge,
                        { backgroundColor: COLORS.secondaryGlow },
                      ]}
                    >
                      <Text
                        style={[
                          styles.masteryText,
                          { color: COLORS.secondary },
                        ]}
                      >
                        Tekrar
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🎉</Text>
              <Text style={styles.emptyText}>
                Bugün tekrar yapacak kelime yok!
              </Text>
              <Text style={styles.emptySubText}>
                Harika iş çıkardın, yeni kelimeler öğren.
              </Text>
            </View>
          )}
        </ScrollView>
      )}
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
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: 4,
    marginBottom: SPACING.md,
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
    fontSize: FONT_SIZES.md,
  },
  tabTextActive: { color: COLORS.textPrimary },
  levelScroll: { marginBottom: SPACING.md, flexGrow: 0 },
  levelScrollContent: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    alignItems: "center",
    paddingVertical: SPACING.xs,
  },
  levelChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelChipText: {
    color: COLORS.textSecondary,
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 44,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZES.md },
  sessionButton: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  sessionButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  sessionButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
  wordList: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  wordCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wordCardLeft: { flex: 1, gap: 2 },
  wordCardRight: { alignItems: "flex-end", gap: 4 },
  wordText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  wordPhonetic: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
  },
  wordTranslation: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: "500",
  },
  masteryBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  masteryText: { fontSize: FONT_SIZES.xs, fontWeight: "600" },
  customBadge: {
    backgroundColor: COLORS.secondaryGlow,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  customBadgeText: {
    color: COLORS.secondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  dailyStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  dailyStat: { alignItems: "center", gap: 2 },
  dailyStatNum: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
  },
  dailyStatLbl: { color: COLORS.textMuted, fontSize: 10 },
  emptyState: {
    alignItems: "center",
    paddingTop: SPACING.xxxl,
    gap: SPACING.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
  },
  emptySubText: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  reviewContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  reviewHeader: { marginBottom: SPACING.md, gap: SPACING.sm },
  reviewTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
  },
  reviewDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
  },
  reviewStartBtn: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginBottom: SPACING.md,
  },
  reviewStartGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  reviewStartText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
});
