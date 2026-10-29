// src/screens/HomeScreen.jsx
import React, { useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import {
  getDailyStats,
  getTodayReviewWords,
  REVIEW_MERGE_TOLERANCE,
  hasDoneSessionToday,
  getNextReviewIn,
  getReviewType,
  WORD_STATUS,
  getWordStatus,
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

export default function HomeScreen({ navigation }) {
  const { state, actions } = useApp();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;

  // LearnScreen'deki gibi periyodik "tick" — reviewCount/nextReviewIn gibi
  // değerler saate göre hesaplanıyor (isDue/isToday). Bu tick olmadan,
  // kullanıcı Ana Sayfa'da dururken bir kelimenin tekrar zamanı gelse bile
  // (başka bir state değişikliği tetiklenmeden) ekran bunu hiç
  // yansıtmıyordu — sadece uygulama arka plana alınıp öne gelince
  // (AppContext'in AppState dinleyicisi) güncelleniyordu.
  const [tick, setTick] = React.useState(0);
  useFocusEffect(
    React.useCallback(() => {
      setTick((t) => t + 1);
      const iv = setInterval(() => setTick((t) => t + 1), 10000);
      return () => clearInterval(iv);
    }, [])
  );

  const allWords = actions.getAllWords();
  const streak = state.stats.streak || 0;
  const userName = state.user?.name || "Öğrenci";
  const prefLevel =
    state.user?.settings?.preferredLevel ||
    state.settings?.preferredLevel ||
    "A1";

  // dailyStats/reviewWords/nextReviewIn zaten her render'da yeniden
  // hesaplanıyor (memoize edilmemiş) — yukarıdaki tick sadece periyodik
  // re-render'ı TETİKLEMEK için var, burada ayrıca referans vermeye gerek yok.
  const dailyStats = getDailyStats(allWords, state.wordProgress);
  // DÜZELTME: burada tolerans olmadan (sadece tam due olanlar) çağrılıyordu,
  // LearnScreen.jsx ise REVIEW_MERGE_TOLERANCE ile (yakın zamanda due olacak
  // kelimeleri de dahil ederek) — bu yüzden Ana Sayfa'dan "Tekrar Et" ile
  // Öğren ekranından "Tekrar Et" FARKLI kelime listeleri gösteriyordu. Artık
  // ikisi aynı mantığı kullanıyor.
  const reviewWords = getTodayReviewWords(
    allWords,
    state.wordProgress,
    REVIEW_MERGE_TOLERANCE
  );
  const reviewCount = reviewWords.length;
  const sessionDone = hasDoneSessionToday(state.wordProgress);
  const nextReviewIn = getNextReviewIn(state.wordProgress);

  // Mevcut seviye ilerleme
  const currentLevelProgress = useMemo(() => {
    const words = allWords.filter((w) => w.level === prefLevel);
    if (!words.length) return { pct: 0, learned: 0, total: 0 };
    const learned = words.filter((w) => {
      const p = state.wordProgress[w.id];
      return p && [WORD_STATUS.LEARNED, WORD_STATUS.KNOWN].includes(p.status);
    }).length;
    return {
      pct: Math.round((learned / words.length) * 100),
      learned,
      total: words.length,
    };
  }, [allWords, state.wordProgress, prefLevel]);

  // Akıllı yönlendirme — duruma göre tek net mesaj
  const guidance = useMemo(() => {
    if (reviewCount > 0) {
      return {
        emoji: "🔄",
        title: `${reviewCount} kelime tekrar bekliyor`,
        subtitle: "Hafızan zayıflamadan tekrar et",
        btnLabel: "Şimdi Tekrar Yap",
        btnColor: COLORS.secondary,
        // DÜZELTME: eskiden burada isDueForReview ile (toleranssız, dayDone
        // durumunu dikkate almadan, en fazla 5 kelimeyle sınırlı) ayrı bir
        // liste hesaplanıyordu — hem yukarıdaki "X kelime tekrar bekliyor"
        // başlığıyla hem de Öğren ekranının "Tekrar Et" butonuyla FARKLI
        // kelimeler gösteriyordu. Artık ikisi de aynı reviewWords'ü kullanıyor.
        onPress: () => {
          navigation.navigate("Review", {
            words: reviewWords,
            reviewType: getReviewType(reviewWords, state.wordProgress),
          });
        },
      };
    }
    if (dailyStats.todayStudied === 0) {
      return {
        emoji: "🎯",
        title: "Bugün henüz başlamadın",
        subtitle: `${prefLevel} seviyesinde 5 yeni kelime seni bekliyor`,
        btnLabel: "Öğrenmeye Başla →",
        btnColor: COLORS.accent,
        onPress: () => navigation.navigate("Learn", { level: prefLevel }),
      };
    }
    if (currentLevelProgress.pct >= 100) {
      const nextLvl = LEVELS[LEVELS.indexOf(prefLevel) + 1];
      return {
        emoji: "🏆",
        title: `${prefLevel} seviyesini bitirdin!`,
        subtitle: nextLvl
          ? `${nextLvl} seviyesine geçmeye hazırsın`
          : "Tebrikler, her şeyi öğrendin!",
        btnLabel: nextLvl
          ? `${nextLvl} Seviyesine Geç →`
          : "İstatistiklere Bak",
        btnColor: LEVEL_COLORS[prefLevel],
        onPress: () =>
          nextLvl
            ? navigation.navigate("Learn", { level: nextLvl })
            : navigation.navigate("Stats"),
      };
    }
    return {
      emoji: "💪",
      title: `${dailyStats.todayStudied} kelime öğrendin`,
      subtitle: `${prefLevel}: %${currentLevelProgress.pct} tamamlandı, devam et!`,
      btnLabel: "Devam Et →",
      btnColor: LEVEL_COLORS[prefLevel],
      onPress: () => navigation.navigate("Learn", { level: prefLevel }),
    };
  }, [reviewCount, dailyStats, currentLevelProgress, prefLevel, allWords]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Günaydın";
    if (h < 18) return "İyi günler";
    return "İyi akşamlar";
  };

  const clp = currentLevelProgress;
  const levelColor = LEVEL_COLORS[prefLevel];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header ── */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View>
            <Text style={styles.greeting}>
              {getGreeting()}, {userName} 👋
            </Text>
            <Text style={styles.appName}>Da Vinci Words</Text>
          </View>
          {streak > 0 && (
            <TouchableOpacity style={styles.streakPill}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakNum}>{streak} gün</Text>
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* ── Ana Aksiyon Kartı ── */}
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            marginBottom: SPACING.lg,
          }}
        >
          <TouchableOpacity
            onPress={guidance.onPress}
            activeOpacity={0.92}
            style={styles.mainCard}
          >
            <LinearGradient
              colors={[guidance.btnColor, guidance.btnColor + "DD"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.mainCardGrad}
            >
              <Text style={styles.mainCardEmoji}>{guidance.emoji}</Text>
              <View style={styles.mainCardText}>
                <Text style={styles.mainCardTitle}>{guidance.title}</Text>
                <Text style={styles.mainCardSubtitle}>{guidance.subtitle}</Text>
              </View>
              <View style={styles.mainCardBtn}>
                <Text style={styles.mainCardBtnText}>{guidance.btnLabel}</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Mevcut Seviye ── */}
        <Animated.View
          style={[
            styles.levelCard,
            {
              opacity: fadeAnim,
              borderColor: levelColor + "40",
            },
          ]}
        >
          <View style={styles.levelCardHeader}>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: levelColor + "20" },
              ]}
            >
              <Text style={[styles.levelBadgeText, { color: levelColor }]}>
                {prefLevel}
              </Text>
            </View>
            <View style={styles.levelCardMid}>
              <Text style={styles.levelCardTitle}>Mevcut Seviye</Text>
              <Text style={[styles.levelCardFrac, { color: levelColor }]}>
                {clp.learned} / {clp.total} kelime
              </Text>
            </View>
            <Text style={[styles.levelCardPct, { color: levelColor }]}>
              {clp.pct}%
            </Text>
          </View>
          {/* Progress bar */}
          <View style={styles.levelBarBg}>
            <Animated.View
              style={[
                styles.levelBarFill,
                {
                  width: `${clp.pct}%`,
                  backgroundColor: levelColor,
                },
              ]}
            />
          </View>
          <Text style={styles.levelCardHint}>
            {clp.pct === 0
              ? "Henüz başlamadın — ilk kelimeni öğren!"
              : clp.pct < 50
              ? "İyi gidiyorsun, devam et!"
              : clp.pct < 100
              ? "Yarısından fazlasını geçtin! 🔥"
              : "🎉 Bu seviyeyi tamamladın!"}
          </Text>
        </Animated.View>

        {/* ── 3 Stat ── */}
        <Animated.View style={[styles.statsRow, { opacity: fadeAnim }]}>
          <StatPill
            icon="📚"
            value={dailyStats.todayStudied}
            label="Bugün öğrendim"
            color={COLORS.accent}
          />
          <StatPill
            icon="🔄"
            value={reviewCount}
            label="Tekrar bekliyor"
            color={COLORS.secondary}
            onPress={
              reviewCount > 0
                ? () => {
                    navigation.navigate("Review", {
                      words: reviewWords,
                      reviewType: getReviewType(reviewWords, state.wordProgress),
                    });
                  }
                : null
            }
          />
          <StatPill
            icon="🏆"
            value={state.stats.totalWordsLearned || 0}
            label="Toplam öğrendim"
            color="#F9CA24"
          />
        </Animated.View>

        {/* ── Hızlı Seviye Geçişi ── */}
        <Animated.View style={[styles.section, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>Seviyeler</Text>
          <View style={styles.levelsGrid}>
            {LEVELS.map((lvl) => {
              const words = allWords.filter((w) => w.level === lvl);
              const learned = words.filter((w) => {
                const p = state.wordProgress[w.id];
                return (
                  p && [WORD_STATUS.LEARNED, WORD_STATUS.KNOWN].includes(p.status)
                );
              }).length;
              const pct = words.length
                ? Math.round((learned / words.length) * 100)
                : 0;
              const color = LEVEL_COLORS[lvl];
              const current = lvl === prefLevel;
              const done = pct === 100;
              return (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.levelGridItem,
                    current && { borderColor: color, borderWidth: 2 },
                    done && { opacity: 0.7 },
                  ]}
                  onPress={() => navigation.navigate("Learn", { level: lvl })}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.levelGridLabel,
                      { color: done ? COLORS.success : color },
                    ]}
                  >
                    {done ? "✅" : lvl}
                  </Text>
                  <View style={styles.levelGridBarBg}>
                    <View
                      style={[
                        styles.levelGridBarFill,
                        {
                          height: `${pct}%`,
                          backgroundColor: done ? COLORS.success : color,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.levelGridPct,
                      { color: done ? COLORS.success : color },
                    ]}
                  >
                    {pct}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatPill({ icon, value, label, color, onPress }) {
  const content = (
    <View
      style={[
        styles.statPill,
        { borderColor: color + "30" },
        onPress && { borderColor: color + "60" },
      ]}
    >
      <Text style={styles.statPillIcon}>{icon}</Text>
      <Text style={[styles.statPillValue, { color }]}>{value}</Text>
      <Text style={styles.statPillLabel}>{label}</Text>
      {onPress && value > 0 && (
        <View style={[styles.statPillDot, { backgroundColor: color }]} />
      )}
    </View>
  );
  if (onPress && value > 0) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={{ flex: 1 }}
        activeOpacity={0.8}
      >
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={{ flex: 1 }}>{content}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: SPACING.lg,
  },
  greeting: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  appName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FF6B35" + "15",
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: "#FF6B35" + "40",
  },
  streakFire: { fontSize: 16 },
  streakNum: { color: "#FF6B35", fontWeight: "800", fontSize: FONT_SIZES.sm },

  // Ana Aksiyon Kartı
  mainCard: { borderRadius: RADIUS.xl, overflow: "hidden" },
  mainCardGrad: { padding: SPACING.xl, gap: SPACING.md },
  mainCardEmoji: { fontSize: 44 },
  mainCardText: { gap: 4 },
  mainCardTitle: {
    color: "#fff",
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
    lineHeight: 26,
  },
  mainCardSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  mainCardBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.2)",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  },
  mainCardBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: FONT_SIZES.md,
  },

  // Mevcut Seviye
  levelCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    gap: SPACING.md,
  },
  levelCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  levelBadge: {
    width: 44,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  levelBadgeText: { fontSize: FONT_SIZES.md, fontWeight: "900" },
  levelCardMid: { flex: 1 },
  levelCardTitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  levelCardFrac: { fontSize: FONT_SIZES.sm, fontWeight: "700" },
  levelCardPct: { fontSize: FONT_SIZES.xxl, fontWeight: "900" },
  levelBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  levelBarFill: { height: 8, borderRadius: 4 },
  levelCardHint: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  // Stats
  statsRow: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg },
  statPill: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 3,
    borderWidth: 1,
    position: "relative",
  },
  statPillIcon: { fontSize: 20 },
  statPillValue: { fontSize: FONT_SIZES.xl, fontWeight: "800" },
  statPillLabel: { color: COLORS.textMuted, fontSize: 9, textAlign: "center" },
  statPillDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // Seviyeler grid
  section: { marginBottom: SPACING.lg },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },
  levelsGrid: { flexDirection: "row", gap: SPACING.sm },
  levelGridItem: {
    flex: 1,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    height: 90,
  },
  levelGridLabel: { fontSize: FONT_SIZES.sm, fontWeight: "900" },
  levelGridBarBg: {
    flex: 1,
    width: "60%",
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  levelGridBarFill: { width: "100%", borderRadius: 3 },
  levelGridPct: { fontSize: 9, fontWeight: "700" },
});
