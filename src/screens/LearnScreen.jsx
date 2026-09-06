import React, { useState, useCallback, useMemo, useEffect } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import {
  STATUS,
  DAILY_TARGET,
  getReviewWords,
  getNewWords,
  getNextReviewIn,
  getDailyStats,
  getWaitingReviewCount,
  getRestingCount,
  getReviewType,
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
  const [selectedLevel, setSelectedLevel] = useState("A1");
  const [tick, setTick] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
      const iv = setInterval(() => setTick((t) => t + 1), 10000);
      return () => clearInterval(iv);
    }, [])
  );

  // HomeScreen "Learn" tab'ına navigate("Learn", { level }) ile bir seviye
  // önerisiyle yönlendirebiliyor (örn. tercih edilen seviye ya da
  // "Seviyeler" gridindeki bir seviye kartı). Tab navigator ekranı
  // unmount etmediği için bu route.params değişikliği daha önce hiç
  // okunmuyordu — kullanıcı her zaman A1'de kalıyordu.
  useEffect(() => {
    if (route?.params?.level) setSelectedLevel(route.params.level);
  }, [route?.params?.level]);

  const allWords = actions.getAllWords();
  const wp = state.wordProgress;

  const reviewWords = useMemo(() => getReviewWords(allWords, wp), [wp, tick]);
  const newWords = useMemo(
    () => getNewWords(allWords, wp, selectedLevel, 5),
    [wp, selectedLevel, tick]
  );
  const nextReviewIn = useMemo(() => getNextReviewIn(wp), [wp, tick]);
  const stats = useMemo(() => getDailyStats(allWords, wp), [wp]);

  // Hiçbir yerde gerçek takvim tarihine (isToday) bakılmıyor. Bunun yerine
  // üç ayrı, tarihsiz durum takip ediliyor:
  //  - hasReview: şu an tekrar zamanı gelmiş kelime var mı
  //  - waitingCount: 3 turluk döngüde olup henüz sırası gelmemiş kelime
  //  - restingCount: döngüsü tamamen bitmiş ve şu an dinlenen kelime
  const waitingCount = useMemo(() => getWaitingReviewCount(wp), [wp, tick]);
  const restingCount = useMemo(() => getRestingCount(wp), [wp, tick]);
  const batchInPlay = Math.min(
    reviewWords.length + waitingCount + restingCount,
    DAILY_TARGET
  );
  const remainingToday = Math.max(DAILY_TARGET - batchInPlay, 0);

  // Daha önce başlanmış mı (öğreniyor veya öğrendi)
  const hasStarted = useMemo(
    () =>
      Object.values(wp).some((p) =>
        [STATUS.REVIEW, STATUS.LEARNED, STATUS.LEARNING].includes(p?.status)
      ),
    [wp]
  );

  const color = LEVEL_COLORS[selectedLevel] || COLORS.accent;
  const hasReview = reviewWords.length > 0;
  const hasNew = newWords.length > 0;

  const levelProgress = useMemo(() => {
    const lvlWords = allWords.filter((w) => w.level === selectedLevel);
    if (!lvlWords.length) return { pct: 0, learned: 0, total: 0 };
    const learned = lvlWords.filter((w) =>
      [STATUS.LEARNED, STATUS.KNOWN].includes(wp[w.id]?.status)
    ).length;
    return {
      pct: Math.round((learned / lvlWords.length) * 100),
      learned,
      total: lvlWords.length,
    };
  }, [wp, selectedLevel]);

  // ── Durum ──────────────────────────────────────────────────────────────
  // Öncelik sırası:
  // 1. Tekrar zamanı geldi (hasReview)         → Tekrar butonu (her zaman ilk iş)
  // 2. Günlük 5 kotasında hâlâ boş yer var      → Öğren butonu (kalan kadar)
  // 3. Kota dolu ama hâlâ döngüde (waiting) kelime var → Da Vinci çağıracak
  // 4. Kota dolu ve hiçbir şey döngüde değil (hepsi dinleniyor) → Yarın bekliyor
  const showReviewBtn = hasReview;
  const showLearnBtn = !hasReview && hasNew && remainingToday > 0;
  const showWaitReview = !hasReview && !showLearnBtn && waitingCount > 0;
  const showWaitTomorrow =
    !hasReview && !showLearnBtn && waitingCount === 0 && restingCount > 0;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Başlık */}
        <View style={s.topRow}>
          <View>
            <Text style={s.title}>Da Vinci Words</Text>
            <Text style={s.subtitle}>
              {stats.totalLearned} kelime öğrenildi
            </Text>
          </View>
          <TouchableOpacity
            style={s.statsBtn}
            onPress={() => navigation.navigate("Stats")}
          >
            <Ionicons
              name="bar-chart-outline"
              size={22}
              color={COLORS.accent}
            />
          </TouchableOpacity>
        </View>

        {/* Seviye seçici */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.levelRow}
          contentContainerStyle={{ gap: 8, paddingHorizontal: SPACING.lg }}
        >
          {LEVELS.map((lvl) => {
            const lc = LEVEL_COLORS[lvl];
            const active = lvl === selectedLevel;
            const words = allWords.filter((w) => w.level === lvl);
            const learned = words.filter((w) =>
              [STATUS.LEARNED, STATUS.KNOWN].includes(wp[w.id]?.status)
            ).length;
            const pct = words.length
              ? Math.round((learned / words.length) * 100)
              : 0;
            return (
              <TouchableOpacity
                key={lvl}
                style={[
                  s.chip,
                  active && { backgroundColor: lc, borderColor: lc },
                ]}
                onPress={() => setSelectedLevel(lvl)}
              >
                <Text style={[s.chipTxt, { color: active ? "#fff" : lc }]}>
                  {pct === 100 ? "✅" : lvl}
                </Text>
                <Text
                  style={[
                    s.chipPct,
                    { color: active ? "rgba(255,255,255,0.8)" : lc + "AA" },
                  ]}
                >
                  {pct}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Seviye progress */}
        <View style={s.progressCard}>
          <View style={s.progressTop}>
            <Text style={s.progressLbl}>{selectedLevel} Seviyesi</Text>
            <Text style={[s.progressPct, { color }]}>{levelProgress.pct}%</Text>
          </View>
          <View style={s.progressBg}>
            <View
              style={[
                s.progressFill,
                { width: `${levelProgress.pct}%`, backgroundColor: color },
              ]}
            />
          </View>
          <Text style={s.progressSub}>
            {levelProgress.learned} / {levelProgress.total} kelime
          </Text>
        </View>

        {/* 1. Tekrar zamanı */}
        {showReviewBtn && (
          <TouchableOpacity
            style={s.reviewCard}
            onPress={() => {
              navigation.navigate("Review", {
                words: reviewWords,
                reviewType: getReviewType(reviewWords, wp),
              });
            }}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[COLORS.secondary, COLORS.secondary + "CC"]}
              style={s.reviewGrad}
            >
              <Text style={s.reviewEmoji}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.reviewTitle}>
                  {reviewWords.length} kelime tekrar bekliyor!
                </Text>
                <Text style={s.reviewSub}>Şimdi tekrar et → hafızana işle</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* 2. Da Vinci çağıracak */}
        {showWaitReview && (
          <View style={s.waitCard}>
            <Text style={s.waitEmoji}>🧠</Text>
            <Text style={s.waitTitle}>Da Vinci sizi tekrar çağıracak</Text>
            <Text style={s.waitSub}>
              {nextReviewIn
                ? `${
                    nextReviewIn.hours > 0 ? `${nextReviewIn.hours} saat ` : ""
                  }${nextReviewIn.minutes} dakika sonra tekrar zamanı`
                : "Yakında tekrar zamanı"}
            </Text>
            <View style={s.dots}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[s.dot, { opacity: 0.3 + i * 0.35 }]} />
              ))}
            </View>
          </View>
        )}

        {/* 3. Yarın bekliyor (günün 5 kelimelik hedefi tam bitti) */}
        {showWaitTomorrow && (
          <View style={s.waitCard}>
            <Text style={s.waitEmoji}>🌙</Text>
            <Text style={s.waitTitle}>Yarın seni bekliyorum!</Text>
            <Text style={s.waitSub}>
              Bugünkü kelimeler tamamlandı. Yarın yeni kelimeler ve tekrarlar
              seni bekliyor.
            </Text>
          </View>
        )}

        {/* 4. Öğren butonu — sadece kalan kadar kelime istenir */}
        {showLearnBtn && (
          <TouchableOpacity
            style={s.learnCard}
            onPress={() =>
              navigation.navigate("PreScan", {
                level: selectedLevel,
                wordsNeeded: remainingToday,
              })
            }
            activeOpacity={0.9}
          >
            <LinearGradient colors={[color, color + "CC"]} style={s.learnGrad}>
              <Text style={s.learnEmoji}>🚀</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.learnTitle}>
                  {hasStarted ? "Öğrenmeye Devam Et" : "Öğrenmeye Başla"}
                </Text>
                <Text style={s.learnSub}>
                  {batchInPlay > 0
                    ? `${remainingToday} kelime daha • Da Vinci metodu`
                    : "Günlük 5 kelime • Da Vinci metodu"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Seviye tamamlandı */}
        {!hasNew &&
          !hasReview &&
          waitingCount === 0 &&
          levelProgress.pct === 100 && (
            <View style={s.waitCard}>
              <Text style={s.waitEmoji}>🏆</Text>
              <Text style={s.waitTitle}>{selectedLevel} Tamamlandı!</Text>
              <Text style={s.waitSub}>
                Bir sonraki seviyeye geçmeye hazırsın
              </Text>
              {LEVELS.indexOf(selectedLevel) < LEVELS.length - 1 && (
                <TouchableOpacity
                  style={[s.nextBtn, { backgroundColor: color }]}
                  onPress={() =>
                    setSelectedLevel(LEVELS[LEVELS.indexOf(selectedLevel) + 1])
                  }
                >
                  <Text style={s.nextBtnTxt}>
                    {LEVELS[LEVELS.indexOf(selectedLevel) + 1]}'e Geç →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

        {/* İstatistikler */}
        <View style={s.statsRow}>
          {[
            { num: stats.totalLearned, lbl: "Öğrenilen" },
            { num: stats.totalKnown, lbl: "Bilinen" },
            { num: stats.todayStudied, lbl: "Bugün" },
            { num: stats.dueCount, lbl: "Tekrar" },
          ].map((item, i) => (
            <View key={i} style={s.statBox}>
              <Text style={s.statNum}>{item.num}</Text>
              <Text style={s.statLbl}>{item.lbl}</Text>
            </View>
          ))}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingBottom: 20 },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "900",
  },
  subtitle: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm, marginTop: 2 },
  statsBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelRow: { marginBottom: SPACING.md },
  chip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    minWidth: 60,
  },
  chipTxt: { fontWeight: "800", fontSize: FONT_SIZES.md },
  chipPct: { fontSize: 10, fontWeight: "600" },
  progressCard: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  progressTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  progressLbl: {
    color: COLORS.textPrimary,
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
  progressPct: { fontWeight: "800", fontSize: FONT_SIZES.md },
  progressBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    marginBottom: SPACING.xs,
  },
  progressFill: { height: 8, borderRadius: 4 },
  progressSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  reviewCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  reviewGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  reviewEmoji: { fontSize: 32 },
  reviewTitle: { color: "#fff", fontSize: FONT_SIZES.md, fontWeight: "800" },
  reviewSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  waitCard: {
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  waitEmoji: { fontSize: 40 },
  waitTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
    textAlign: "center",
  },
  waitSub: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
    lineHeight: 20,
  },
  dots: { flexDirection: "row", gap: 8, marginTop: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  learnCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  learnGrad: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  learnEmoji: { fontSize: 28 },
  learnTitle: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "800" },
  learnSub: {
    color: "rgba(255,255,255,0.8)",
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  nextBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  nextBtnTxt: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statBox: { flex: 1, alignItems: "center", gap: 4 },
  statNum: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "900",
  },
  statLbl: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
});
