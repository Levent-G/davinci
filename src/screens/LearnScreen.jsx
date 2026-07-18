// src/screens/LearnScreen.jsx — sade versiyon
import React, { useMemo, useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import {
  getDailyWords,
  getTodayReviewWords,
  hasDoneSessionToday,
  getNextReviewIn,
  getDailyStats,
  WORD_STATUS,
  getWordStatus,
  isToday,
  getReviewType,
  STATUS,
  getReviewWords,
  getReviewType as getRT,
} from "../utils/davinciAlgorithm";

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
  const prefLevel =
    route.params?.level ||
    state.settings?.preferredLevel ||
    state.user?.settings?.preferredLevel ||
    "A1";

  const [selectedLevel, setSelectedLevel] = React.useState(prefLevel);

  // Uygulama focus aldığında (arka plandan gelince) state'i yenile
  const [tick, setTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1); // re-render tetikle — isDue kontrolü güncellensin
    }, [])
  );

  const allWords = actions.getAllWords();
  const dailyStats = getDailyStats(allWords, state.wordProgress);

  // Seçili seviye ilerleme
  const levelProgress = useMemo(() => {
    const words = allWords.filter((w) => w.level === selectedLevel);
    if (!words.length) return { pct: 0, learned: 0, total: 0 };
    const learned = words.filter((w) => {
      const p = state.wordProgress[w.id];
      if (!p) return false;
      const s = p.status || getWordStatus(p);
      return [
        "done",
        "learned",
        "known",
        WORD_STATUS.LEARNED,
        WORD_STATUS.KNOWN,
      ].includes(s);
    }).length;
    return {
      pct: Math.round((learned / words.length) * 100),
      learned,
      total: words.length,
    };
  }, [allWords, state.wordProgress, selectedLevel]);

  // Bugün oturum yapıldı mı?
  // Bugün kaç kelime REVIEW_1 veya üstüne geçti (aşamalar tamamlandı)
  // Bugün kaç kelime öğrenme aşamasına girdi
  const SESSION_TARGET = 5;
  const todayLearnedCount = allWords.filter((w) => {
    const p = state.wordProgress[w.id];
    if (!p) return false;
    const s = p.status || "new";
    if (!["r1", "r2", "r3", "done", "retry"].includes(s)) return false;
    return p.startedAt && isToday(p.startedAt);
  }).length;

  // Bugün done olan kelimeler NEXT_DAY geçti mi? Geçtiyse yeni kelimeler açılır
  const doneWordsReady = allWords.some((w) => {
    const p = state.wordProgress[w.id];
    if (!p || p.status !== "done") return false;
    return p.nextReviewAt && Date.now() >= new Date(p.nextReviewAt).getTime();
  });
  const sessionDoneToday = todayLearnedCount >= SESSION_TARGET;
  const reviewWords = React.useMemo(() => {
    try {
      return getReviewWords(allWords, state.wordProgress);
    } catch {
      return [];
    }
  }, [tick, state.wordProgress]);
  const hasReview = reviewWords.length > 0;

  // Kaç saat sonra tekrar?
  const nextReviewIn = getNextReviewIn(state.wordProgress);

  // Yeni kelimeler
  const newWords = useMemo(
    () => getDailyWords(allWords, state.wordProgress, selectedLevel, 5),
    [
      selectedLevel,
      allWords.length,
      Object.keys(state.wordProgress).length,
      tick,
    ]
  );
  const hasNewWords = newWords.length > 0;

  // Daha önce başlanmış (FAILED) kelime var mı
  const hasRetryWords = React.useMemo(() => {
    return allWords.some((w) => {
      const p = state.wordProgress[w.id];
      if (!p) return false;
      if (!["retry", "failed"].includes(p.status)) return false;
      if (w.level !== selectedLevel) return false;
      return (
        !p.nextReviewAt || Date.now() >= new Date(p.nextReviewAt).getTime()
      );
    });
  }, [tick, state.wordProgress, selectedLevel]);
  const hasFailedWords = hasRetryWords;
  const btnLabel = hasFailedWords
    ? "Öğrenmeye Devam Et →"
    : "Öğrenmeye Başla →";

  // ReviewType belirle
  const getReviewType = () => {
    const types = reviewWords.map((w) => state.wordProgress[w.id]?.status);
    if (types.includes(WORD_STATUS.REVIEW_1)) return "review_1";
    if (types.includes(WORD_STATUS.REVIEW_2)) return "review_2";
    return "review_3";
  };

  const handleStartSession = () => {
    if (!newWords.length) return;

    // retry kelimeler varsa direkt ReviewScreen'e git
    if (hasRetryWords) {
      const retryWords = allWords.filter((w) => {
        if (w.level !== selectedLevel) return false;
        const p = state.wordProgress[w.id];
        return p?.status === "retry" || p?.status === "failed";
      });
      if (retryWords.length > 0) {
        navigation.navigate("Review", {
          words: retryWords,
          reviewType: "r1",
          fromRetry: true,
          level: selectedLevel,
        });
        return;
      }
    }

    // Yeni kelimeler — PreScan (biliyorum/bilmiyorum)
    const onlyNew = newWords.filter((w) => {
      const s = state.wordProgress[w.id]?.status;
      return !s || s === "new";
    });
    navigation.navigate("PreScan", {
      words: onlyNew.length ? onlyNew : newWords,
      level: selectedLevel,
    });
  };

  const handleStartReview = () => {
    const { getReviewType: grt } = require("../utils/davinciAlgorithm");
    const rType = grt(reviewWords, state.wordProgress);
    navigation.navigate("Review", { words: reviewWords, reviewType: rType });
  };

  const handleQuickScan = () => {
    const candidates = allWords
      .filter((w) => {
        if (w.level !== selectedLevel) return false;
        const p = state.wordProgress[w.id];
        if (!p) return true;
        const s = p.status || getWordStatus(p);
        return ![WORD_STATUS.LEARNED, WORD_STATUS.KNOWN].includes(s);
      })
      .sort(() => Math.random() - 0.5)
      .slice(0, 15);

    if (!candidates.length) return;
    navigation.navigate("QuickScan", {
      words: candidates,
      level: selectedLevel,
    });
  };

  const color = LEVEL_COLORS[selectedLevel];
  const lp = levelProgress;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Öğren</Text>
          <Text style={styles.sub}>
            Bugün {dailyStats.todayStudied} kelime öğrendin
          </Text>
        </View>

        {/* Seviye seçici */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.levelRow}
        >
          {LEVELS.map((lvl) => {
            const words = allWords.filter((w) => w.level === lvl);
            const learned = words.filter((w) => {
              const p = state.wordProgress[w.id];
              if (!p) return false;
              const s = p.status || getWordStatus(p);
              return [
                "done",
                "learned",
                "known",
                WORD_STATUS.LEARNED,
                WORD_STATUS.KNOWN,
              ].includes(s);
            }).length;
            const pct = words.length
              ? Math.round((learned / words.length) * 100)
              : 0;
            const lc = LEVEL_COLORS[lvl];
            const active = selectedLevel === lvl;
            const done = pct === 100;
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  styles.levelChip,
                  active && { backgroundColor: lc, borderColor: lc },
                  !active && { borderColor: lc + "60" },
                  done && !active && { opacity: 0.5 },
                ]}
                onPress={() => setSelectedLevel(lvl)}
              >
                <View
                  style={[
                    styles.levelChipBar,
                    {
                      width: `${pct}%`,
                      backgroundColor: active
                        ? "rgba(255,255,255,0.25)"
                        : lc + "30",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.levelChipText,
                    { color: active ? "#fff" : lc },
                  ]}
                >
                  {done ? "✅" : lvl}
                </Text>
                <Text
                  style={[
                    styles.levelChipPct,
                    { color: active ? "rgba(255,255,255,0.8)" : lc + "AA" },
                  ]}
                >
                  {pct}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Seviye ilerleme */}
        <View style={[styles.levelCard, { borderColor: color + "40" }]}>
          <View style={styles.levelCardTop}>
            <View>
              <Text style={[styles.levelCardTitle, { color }]}>
                {selectedLevel} Seviyesi
              </Text>
              <Text style={styles.levelCardSub}>
                {lp.learned}/{lp.total} kelime öğrenildi
              </Text>
            </View>
            <Text style={[styles.levelCardPct, { color }]}>{lp.pct}%</Text>
          </View>
          <View style={styles.barBg}>
            <View
              style={[
                styles.barFill,
                { width: `${lp.pct}%`, backgroundColor: color },
              ]}
            />
          </View>
        </View>

        {/* ── ANA DURUM KARTI ── */}

        {/* 1. Tekrar var mı? */}
        {hasReview && (
          <TouchableOpacity
            style={styles.reviewCard}
            onPress={handleStartReview}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[COLORS.secondary, COLORS.secondary + "CC"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.reviewGrad}
            >
              <Text style={styles.reviewEmoji}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reviewTitle}>
                  {reviewWords.length} kelime tekrar bekliyor!
                </Text>
                <Text style={styles.reviewSub}>
                  Şimdi tekrar yap — hafızan pekişsin
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* 2. Bugün oturum yapıldı ama tekrar yok → bekleme durumu */}
        {sessionDoneToday &&
          !hasReview &&
          !doneWordsReady &&
          (() => {
            // retry varsa ama zamanı gelmediyse "yarın" kartı göster
            const retryNotReady = allWords.some((w) => {
              const p = state.wordProgress[w.id];
              return (
                p?.status === "retry" &&
                p.nextReviewAt &&
                Date.now() < new Date(p.nextReviewAt).getTime()
              );
            });
            return !hasRetryWords || retryNotReady;
          })() && (
            <View style={styles.waitCard}>
              <Text style={styles.waitEmoji}>🧠</Text>
              <Text style={styles.waitTitle}>
                Da Vinci sizi tekrar çağıracak
              </Text>
              <Text style={styles.waitSub}>
                {nextReviewIn && nextReviewIn.ms > 0
                  ? `${
                      nextReviewIn.hours > 0
                        ? `${nextReviewIn.hours} saat `
                        : ""
                    }${nextReviewIn.minutes} dakika sonra tekrar zamanı`
                  : "Bugünkü tekrarlar tamamlandı! Yarın yeni kelimeler gelecek."}
              </Text>
              <View style={styles.waitDots}>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={[styles.waitDot, { opacity: 0.3 + i * 0.35 }]}
                  />
                ))}
              </View>
            </View>
          )}

        {/* 3. Yeni oturum başlatılabilir */}
        {(hasNewWords || hasRetryWords || doneWordsReady) &&
          !hasReview &&
          (!sessionDoneToday || hasRetryWords || doneWordsReady) &&
          !lp.done && (
            <View style={styles.actionArea}>
              {/* Ana buton */}
              <TouchableOpacity
                style={styles.mainBtn}
                onPress={handleStartSession}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={[color, color + "CC"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.mainBtnGrad}
                >
                  <Ionicons name="play-circle" size={26} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.mainBtnTitle}>{btnLabel}</Text>
                    <Text style={styles.mainBtnSub}>
                      5 yeni kelime • Da Vinci metodu
                    </Text>
                  </View>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>

              {/* Hızlı Tarama */}
              <TouchableOpacity
                style={[styles.scanBtn, { borderColor: color + "60" }]}
                onPress={handleQuickScan}
              >
                <Ionicons name="flash" size={18} color={color} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.scanTitle, { color }]}>
                    Hızlı Tarama
                  </Text>
                  <Text style={styles.scanSub}>
                    Hangilerini bildiğini işaretle
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

        {/* 4. Seviye tamamlandı */}
        {lp.done && (
          <View style={[styles.doneCard, { borderColor: color + "40" }]}>
            <Text style={styles.doneEmoji}>🏆</Text>
            <Text style={[styles.doneTitle, { color }]}>
              {selectedLevel} Tamamlandı!
            </Text>
            <Text style={styles.doneSub}>Bir sonraki seviyeye hazırsın</Text>
            {LEVELS.indexOf(selectedLevel) < LEVELS.length - 1 && (
              <TouchableOpacity
                style={[styles.nextLvlBtn, { backgroundColor: color }]}
                onPress={() =>
                  setSelectedLevel(LEVELS[LEVELS.indexOf(selectedLevel) + 1])
                }
              >
                <Text style={styles.nextLvlText}>
                  {LEVELS[LEVELS.indexOf(selectedLevel) + 1]}'e Geç →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* 5. Bu seviyede kelime kalmadı ama tamamlanmadı */}
        {!sessionDoneToday && !hasNewWords && !lp.done && (
          <View style={styles.waitCard}>
            <Text style={styles.waitEmoji}>✨</Text>
            <Text style={styles.waitTitle}>
              Tüm kelimeler öğrenme aşamasında
            </Text>
            <Text style={styles.waitSub}>
              Tekrar zamanı geldiğinde bildirim alacaksın
            </Text>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg },

  header: { paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  sub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  levelRow: { paddingVertical: SPACING.md, gap: SPACING.sm },
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
  levelChipBar: { position: "absolute", left: 0, top: 0, bottom: 0 },
  levelChipText: { fontSize: FONT_SIZES.md, fontWeight: "900", zIndex: 1 },
  levelChipPct: { fontSize: 10, fontWeight: "600", zIndex: 1 },

  levelCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1.5,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  levelCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  levelCardTitle: { fontSize: FONT_SIZES.lg, fontWeight: "800" },
  levelCardSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  levelCardPct: { fontSize: FONT_SIZES.xxl, fontWeight: "900" },
  barBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: 8, borderRadius: 4 },

  // Tekrar kartı
  reviewCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.md,
  },
  reviewGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  reviewEmoji: { fontSize: 32 },
  reviewTitle: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "800" },
  reviewSub: { color: "rgba(255,255,255,0.8)", fontSize: FONT_SIZES.xs },

  // Bekleme kartı
  waitCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  waitEmoji: { fontSize: 48 },
  waitTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    textAlign: "center",
  },
  waitSub: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  waitDots: { flexDirection: "row", gap: SPACING.sm },
  waitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.accent,
  },

  // Aksiyon
  actionArea: { gap: SPACING.sm, marginBottom: SPACING.lg },
  mainBtn: { borderRadius: RADIUS.xl, overflow: "hidden" },
  mainBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  mainBtnTitle: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "700" },
  mainBtnSub: { color: "rgba(255,255,255,0.8)", fontSize: FONT_SIZES.xs },
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

  // Tamamlandı
  doneCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    marginBottom: SPACING.lg,
  },
  doneEmoji: { fontSize: 48 },
  doneTitle: { fontSize: FONT_SIZES.xl, fontWeight: "800" },
  doneSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  nextLvlBtn: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    marginTop: SPACING.sm,
  },
  nextLvlText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
});
