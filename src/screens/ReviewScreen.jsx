// src/screens/ReviewScreen.jsx
// Günlük tekrar ekranı — görsel + quiz
// 1. tekrar (+3 saat): görsel + kelime + 4 şık
// 2. tekrar (+8 saat): kelime + 4 şık
// 3. tekrar (ertesi gün): kelime + 4 şık

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Image,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import {
  generateQuizOptions,
  calcNextReview,
  WORD_STATUS,
  scheduleReviewNotifications as _,
} from "../utils/davinciAlgorithm";
import { scheduleReviewNotifications } from "../utils/notifications";
import { speakWord } from "../utils/textToSpeech";

const { width } = Dimensions.get("window");
const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

export default function ReviewScreen({ navigation, route }) {
  const { words = [], reviewType = "review_1" } = route.params || {};
  const { state, actions } = useApp();

  const [index, setIndex] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizOptions, setQuizOptions] = useState([]);
  const [imageUri, setImageUri] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [results, setResults] = useState([]); // { word, correct }
  const [done, setDone] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const allWords = actions.getAllWords();
  const currentWord = words[index];
  const showImage = reviewType === "review_1"; // Sadece 1. tekrarda resim

  useEffect(() => {
    if (!currentWord) return;
    setQuizOptions(generateQuizOptions(currentWord, allWords, 4));
    setQuizAnswer(null);
    if (showImage) loadImage(currentWord.word);
    animateIn();
  }, [index]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: index / words.length,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [index]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.95);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadImage = async (word) => {
    setImageUri(null);
    setImgLoading(true);
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          word
        )}&per_page=3`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await res.json();
      if (data.photos?.length > 0) {
        setImageUri(data.photos[0].src.large || data.photos[0].src.medium);
      }
    } catch {}
    setImgLoading(false);
  };

  const handleAnswer = async (option) => {
    if (quizAnswer) return;
    setQuizAnswer(option);

    const isCorrect = option.isCorrect;
    const prog = state.wordProgress[currentWord.id] || {};

    if (!isCorrect) {
      // Shake animasyonu
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -8,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Progress kaydet
    const newProg = calcNextReview({ ...prog }, isCorrect);
    await actions.updateWordProgress(currentWord.id, { ...prog, ...newProg });

    setResults((prev) => [...prev, { word: currentWord, correct: isCorrect }]);

    // 1.5 saniye sonra sonraki kelimeye
    setTimeout(() => {
      if (index >= words.length - 1) {
        setDone(true);
      } else {
        setIndex((i) => i + 1);
      }
    }, 1500);
  };

  if (done) {
    const correct = results.filter((r) => r.correct).length;
    const score = Math.round((correct / words.length) * 100);
    const allGood = score === 100;
    return (
      <ReviewComplete
        results={results}
        score={score}
        allGood={allGood}
        reviewType={reviewType}
        onExit={() => navigation.goBack()}
      />
    );
  }

  if (!currentWord) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            {reviewType === "review_1"
              ? "1. Tekrar"
              : reviewType === "review_2"
              ? "2. Tekrar"
              : "Günlük Tekrar"}
          </Text>
          <Text style={styles.headerSub}>
            {index + 1} / {words.length}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressBg}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          }}
        >
          {/* Resim (sadece 1. tekrarda) */}
          {showImage && (
            <View style={styles.imageBox}>
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : imgLoading ? (
                <View style={styles.imagePlaceholder}>
                  <ActivityIndicator size="small" color={COLORS.accent} />
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={{ fontSize: 32 }}>🖼️</Text>
                </View>
              )}
            </View>
          )}

          {/* Kelime kartı */}
          <View style={styles.wordCard}>
            <Text style={styles.wordText}>{currentWord.word}</Text>
            <Text style={styles.wordPos}>{currentWord.partOfSpeech}</Text>
            <TouchableOpacity
              style={styles.speakBtn}
              onPress={() => speakWord(currentWord.word)}
            >
              <Ionicons
                name="volume-high-outline"
                size={22}
                color={COLORS.accent}
              />
              <Text style={styles.speakText}>Sesli Dinle</Text>
            </TouchableOpacity>
          </View>

          {/* Soru */}
          <Text style={styles.question}>Bu kelimenin anlamı nedir?</Text>

          {/* Quiz Seçenekleri */}
          <Animated.View
            style={[styles.options, { transform: [{ translateX: shakeAnim }] }]}
          >
            {quizOptions.map((opt, i) => {
              let bg = COLORS.backgroundCard;
              let border = COLORS.border;
              let color = COLORS.textPrimary;

              if (quizAnswer) {
                if (opt.isCorrect) {
                  bg = COLORS.successGlow || "rgba(100,220,150,0.15)";
                  border = COLORS.success;
                  color = COLORS.success;
                } else if (quizAnswer === opt) {
                  bg = COLORS.errorGlow || "rgba(255,100,100,0.15)";
                  border = COLORS.error;
                  color = COLORS.error;
                }
              }

              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.option,
                    { backgroundColor: bg, borderColor: border },
                  ]}
                  onPress={() => handleAnswer(opt)}
                  disabled={!!quizAnswer}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.optionText, { color }]}>
                    {opt.word.translation}
                  </Text>
                  {quizAnswer && opt.isCorrect && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={COLORS.success}
                    />
                  )}
                  {quizAnswer === opt && !opt.isCorrect && (
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={COLORS.error}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>

          {/* Cevap sonrası bilgi */}
          {quizAnswer && (
            <View
              style={[
                styles.feedback,
                {
                  borderColor: quizAnswer.isCorrect
                    ? COLORS.success
                    : COLORS.error,
                  backgroundColor: quizAnswer.isCorrect
                    ? COLORS.successGlow || "rgba(100,220,150,0.1)"
                    : COLORS.errorGlow || "rgba(255,100,100,0.1)",
                },
              ]}
            >
              <Text
                style={[
                  styles.feedbackText,
                  {
                    color: quizAnswer.isCorrect ? COLORS.success : COLORS.error,
                  },
                ]}
              >
                {quizAnswer.isCorrect
                  ? "✅ Doğru! Harika gidiyorsun."
                  : `❌ Yanlış. Doğrusu: ${currentWord.translation}`}
              </Text>
              {!quizAnswer.isCorrect && (
                <Text style={styles.feedbackExample}>
                  "{currentWord.example}"
                </Text>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReviewComplete({ results, score, allGood, reviewType, onExit }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const nextReview =
    reviewType === "review_1"
      ? "5 saat sonra"
      : reviewType === "review_2"
      ? "yarın sabah"
      : "7 gün sonra";

  useEffect(() => {
    if (reviewType === "review_1") {
      scheduleReviewNotifications(results.length).catch(() => {});
    }
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.completeContainer, { opacity: fadeAnim }]}>
        <Text style={styles.completeEmoji}>
          {allGood ? "🏆" : score >= 60 ? "⭐" : "📚"}
        </Text>
        <Text style={styles.completeTitle}>Tekrar Tamamlandı!</Text>

        <View style={styles.scoreCircle}>
          <Text style={styles.scoreNum}>{score}</Text>
          <Text style={styles.scorePct}>%</Text>
        </View>

        <View style={styles.completeStats}>
          <View style={styles.completeStat}>
            <Text style={[styles.completeStatVal, { color: COLORS.success }]}>
              {results.filter((r) => r.correct).length}
            </Text>
            <Text style={styles.completeStatLabel}>Doğru</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.completeStat}>
            <Text style={[styles.completeStatVal, { color: COLORS.error }]}>
              {results.filter((r) => !r.correct).length}
            </Text>
            <Text style={styles.completeStatLabel}>Yanlış</Text>
          </View>
        </View>

        <View style={styles.nextInfo}>
          <Ionicons name="time-outline" size={18} color={COLORS.textMuted} />
          <Text style={styles.nextInfoText}>
            {allGood
              ? `Bir sonraki tekrar: ${nextReview} sonra`
              : "Yanlış kelimeler yakında tekrar gelecek"}
          </Text>
        </View>

        <TouchableOpacity style={styles.completeBtn} onPress={onExit}>
          <LinearGradient
            colors={[COLORS.accent, COLORS.accent + "CC"]}
            style={styles.completeBtnGrad}
          >
            <Text style={styles.completeBtnText}>Tamam →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
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
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  headerSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  progressBg: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: 3, backgroundColor: COLORS.accent },

  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 40,
  },

  imageBox: {
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  image: { width: "100%", height: 180 },
  imagePlaceholder: {
    height: 140,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  wordCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wordText: {
    color: COLORS.textPrimary,
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1,
  },
  wordPos: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
  },
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.accent + "15",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    marginTop: SPACING.xs,
  },
  speakText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.sm,
  },

  question: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: SPACING.md,
  },

  options: { gap: SPACING.sm },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
  },
  optionText: { fontSize: FONT_SIZES.md, fontWeight: "600", flex: 1 },

  feedback: {
    marginTop: SPACING.md,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  feedbackText: { fontWeight: "600", fontSize: FONT_SIZES.sm },
  feedbackExample: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
  },

  // Complete
  completeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  completeEmoji: { fontSize: 64 },
  completeTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  scoreNum: { color: COLORS.accent, fontSize: 48, fontWeight: "800" },
  scorePct: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
    alignSelf: "flex-end",
    paddingBottom: 8,
  },
  completeStats: { flexDirection: "row", alignItems: "center" },
  completeStat: { alignItems: "center", paddingHorizontal: SPACING.xl, gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  completeStatVal: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  completeStatLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  nextInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  nextInfoText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    flex: 1,
  },
  completeBtn: { width: "100%", borderRadius: RADIUS.full, overflow: "hidden" },
  completeBtnGrad: { paddingVertical: SPACING.md + 2, alignItems: "center" },
  completeBtnText: {
    color: "#fff",
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
  },
});
