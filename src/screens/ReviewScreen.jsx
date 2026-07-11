// ReviewScreen — Tekrar ekranı
// Fotoğraf + Kelime + Anlam + Sesli + Quiz
// 2 yanlış → FAILED, hepsi doğru → sonraki status

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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { generateQuizOptions, calcNextReview } from "../utils/davinciAlgorithm";
import { speakWord } from "../utils/textToSpeech";
import { scheduleNextReviewNotification } from "../utils/notifications";

const { width } = Dimensions.get("window");
const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

export default function ReviewScreen({ navigation, route }) {
  const { words = [], reviewType = "review_1" } = route.params || {};
  const { state, actions } = useApp();
  const allWords = actions.getAllWords();

  const [idx, setIdx] = useState(0);
  const [quizOpts, setQuizOpts] = useState([]);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [done, setDone] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const currentWord = words[idx] || null;

  useEffect(() => {
    if (!currentWord) return;
    setQuizAnswer(null);
    setQuizOpts(generateQuizOptions(currentWord, allWords, 4));
    loadImage(currentWord.word);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [idx]);

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
      if (data.photos?.length > 0)
        setImageUri(data.photos[0].src.large || data.photos[0].src.medium);
    } catch {}
    setImgLoading(false);
  };

  const handleAnswer = async (opt) => {
    if (quizAnswer) return;
    setQuizAnswer(opt);

    const isCorrect = opt.isCorrect;
    const prog = state.wordProgress[currentWord.id] || {};

    if (!isCorrect) {
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
          toValue: 6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -6,
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

    // Progress güncelle
    const newProg = calcNextReview({ ...prog }, isCorrect);
    await actions.updateWordProgress(currentWord.id, { ...prog, ...newProg });

    const newResults = [...results, { word: currentWord, correct: isCorrect }];
    setResults(newResults);

    setTimeout(() => {
      shakeAnim.setValue(0);
      if (idx >= words.length - 1) {
        setDone(true);
      } else {
        fadeAnim.setValue(0);
        setIdx((i) => i + 1);
      }
    }, 1500);
  };

  // Tamamlandı ekranı
  if (done) {
    const correct = results.filter((r) => r.correct).length;
    const score = Math.round((correct / words.length) * 100);
    const isLast = reviewType === "review_3";
    // Bildirim planla
    scheduleNextReviewNotification(reviewType).catch(() => {});

    return (
      <SafeAreaView style={s.container}>
        <View style={s.doneBox}>
          <Text style={s.doneEmoji}>
            {score >= 80 ? "🏆" : score >= 60 ? "⭐" : "📚"}
          </Text>
          <Text style={s.doneTitle}>Tekrar Tamamlandı!</Text>
          <View style={s.scoreCircle}>
            <Text style={s.scoreNum}>{score}</Text>
            <Text style={s.scorePct}>%</Text>
          </View>
          <View style={s.doneStats}>
            <View style={s.doneStat}>
              <Text style={[s.doneStatNum, { color: COLORS.success }]}>
                {correct}
              </Text>
              <Text style={s.doneStatLabel}>Doğru</Text>
            </View>
            <View style={s.doneStatDivider} />
            <View style={s.doneStat}>
              <Text style={[s.doneStatNum, { color: COLORS.error }]}>
                {words.length - correct}
              </Text>
              <Text style={s.doneStatLabel}>Yanlış</Text>
            </View>
          </View>
          {!isLast && (
            <View style={s.nextInfo}>
              <Ionicons
                name="time-outline"
                size={16}
                color={COLORS.textMuted}
              />
              <Text style={s.nextInfoText}>1 saat sonra tekrar zamanı</Text>
            </View>
          )}
          {isLast && (
            <View style={s.nextInfo}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={COLORS.success}
              />
              <Text style={[s.nextInfoText, { color: COLORS.success }]}>
                {score >= 60
                  ? "Kelimeler öğrenildi! Yarın yeni kelimeler gelecek."
                  : "Bazı kelimeler yarın tekrar gelecek."}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => navigation.goBack()}
          >
            <LinearGradient
              colors={[COLORS.accent, COLORS.accent + "CC"]}
              style={s.doneBtnGrad}
            >
              <Text style={s.doneBtnText}>Tamam →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentWord) return null;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.closeBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={s.headerTitle}>
            {reviewType === "review_1"
              ? "1. Tekrar"
              : reviewType === "review_2"
              ? "2. Tekrar"
              : "3. Tekrar"}
          </Text>
          <Text style={s.headerSub}>
            {idx + 1} / {words.length}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={s.progressBg}>
        <View
          style={[s.progressFill, { width: `${(idx / words.length) * 100}%` }]}
        />
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Büyük fotoğraf */}
        <View style={s.imageBox}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={s.image}
              resizeMode="cover"
            />
          ) : (
            <View style={s.imagePlaceholder}>
              {imgLoading ? (
                <ActivityIndicator size="large" color={COLORS.accent} />
              ) : (
                <Ionicons
                  name="image-outline"
                  size={48}
                  color={COLORS.textMuted}
                />
              )}
            </View>
          )}
        </View>

        {/* Kelime kartı — her zaman görünür */}
        <View style={s.wordCard}>
          <Text style={s.wordText}>{currentWord.word}</Text>
          <Text style={s.wordPos}>{currentWord.partOfSpeech}</Text>
          <Text style={s.wordTranslation}>{currentWord.translation}</Text>
          <TouchableOpacity
            style={s.speakBtn}
            onPress={() => speakWord(currentWord.word)}
          >
            <Ionicons
              name="volume-high-outline"
              size={22}
              color={COLORS.accent}
            />
            <Text style={s.speakText}>Sesli Dinle</Text>
          </TouchableOpacity>
        </View>

        {/* Quiz — her zaman göster */}
        <View style={s.quizBox}>
          <Text style={s.quizQ}>Bu kelimenin Türkçe anlamı nedir?</Text>
          <Animated.View
            style={[s.options, { transform: [{ translateX: shakeAnim }] }]}
          >
            {quizOpts.map((opt, i) => {
              let bg = COLORS.backgroundCard,
                border = COLORS.border,
                color = COLORS.textPrimary;
              if (quizAnswer) {
                if (opt.isCorrect) {
                  bg = "rgba(100,220,150,0.15)";
                  border = COLORS.success;
                  color = COLORS.success;
                } else if (quizAnswer === opt) {
                  bg = "rgba(255,100,100,0.15)";
                  border = COLORS.error;
                  color = COLORS.error;
                }
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.option,
                    { backgroundColor: bg, borderColor: border },
                  ]}
                  onPress={() => handleAnswer(opt)}
                  disabled={!!quizAnswer}
                >
                  <Text style={[s.optionText, { color }]}>
                    {opt.word.translation}
                  </Text>
                  {quizAnswer && opt.isCorrect && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.success}
                    />
                  )}
                  {quizAnswer === opt && !opt.isCorrect && (
                    <Ionicons
                      name="close-circle"
                      size={20}
                      color={COLORS.error}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </Animated.View>
          {quizAnswer && (
            <View
              style={[
                s.feedback,
                {
                  borderColor: quizAnswer.isCorrect
                    ? COLORS.success
                    : COLORS.error,
                  backgroundColor: quizAnswer.isCorrect
                    ? "rgba(100,220,150,0.1)"
                    : "rgba(255,100,100,0.1)",
                },
              ]}
            >
              <Text
                style={[
                  s.feedbackText,
                  {
                    color: quizAnswer.isCorrect ? COLORS.success : COLORS.error,
                  },
                ]}
              >
                {quizAnswer.isCorrect
                  ? "✅ Doğru!"
                  : `❌ Doğrusu: ${currentWord.translation}`}
              </Text>
            </View>
          )}
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  headerSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  progressBg: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: 3, backgroundColor: COLORS.accent },
  scroll: { paddingHorizontal: SPACING.lg, paddingBottom: 40 },
  imageBox: {
    marginVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  image: { width: "100%", height: 280 },
  imagePlaceholder: {
    height: 240,
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
    fontSize: 44,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -1,
  },
  wordPos: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
  },
  wordTranslation: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "700",
    color: COLORS.accent,
  },
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.accent + "15",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  speakText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.sm,
  },
  nextBtn: {
    borderRadius: RADIUS.full,
    overflow: "hidden",
    marginBottom: SPACING.lg,
  },
  nextBtnGrad: { paddingVertical: SPACING.md + 2, alignItems: "center" },
  nextBtnText: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "800" },
  quizBox: { gap: SPACING.md },
  quizQ: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
    textAlign: "center",
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
  feedback: { borderWidth: 1.5, borderRadius: RADIUS.lg, padding: SPACING.md },
  feedbackText: { fontWeight: "600", fontSize: FONT_SIZES.sm },
  doneBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  doneEmoji: { fontSize: 64 },
  doneTitle: {
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
  doneStats: { flexDirection: "row", alignItems: "center" },
  doneStat: { alignItems: "center", paddingHorizontal: SPACING.xl, gap: 4 },
  doneStatDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  doneStatNum: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  doneStatLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
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
  doneBtn: { width: "100%", borderRadius: RADIUS.full, overflow: "hidden" },
  doneBtnGrad: { paddingVertical: SPACING.md + 2, alignItems: "center" },
  doneBtnText: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "800" },
});
