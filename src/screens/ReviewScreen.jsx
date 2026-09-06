import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import {
  generateQuizOptions,
  afterQuiz,
  STATUS,
  HOUR,
  alignToGroup,
  getInFlightReviewCount,
} from "../utils/davinciAlgorithm";
import { speakWord } from "../utils/textToSpeech";
import { hapticSuccess, hapticError } from "../utils/haptics";
import {
  cancelReviewNotifications,
  scheduleReviewNotification,
} from "../utils/notifications";

const { width } = Dimensions.get("window");
const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

export default function ReviewScreen({ navigation, route }) {
  const { words = [], reviewType = "r1" } = route.params || {};
  const { state, actions } = useApp();
  const allWords = actions.getAllWords();

  const [idx, setIdx] = useState(0);
  const [quizOpts, setQuizOpts] = useState([]);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [results, setResults] = useState([]);
  // Her cevaptan sonra güncel progress'i burada da tutuyoruz çünkü
  // state.wordProgress'in re-render ile senkron gelmesini beklemeden
  // "done" ekranındaki mesajı ve bildirim sayısını doğru hesaplamak
  // istiyoruz.
  const latestProgressRef = useRef(state.wordProgress);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const word = words[idx] || null;

  useEffect(() => {
    latestProgressRef.current = state.wordProgress;
  }, [state.wordProgress]);

  useEffect(() => {
    if (!word) return;
    setQuizAnswer(null);
    setQuizOpts(generateQuizOptions(word, allWords));
    // Öğrenme aşamasında kullanıcı fotoğrafı yenilediyse, o seçim
    // kelimenin ilerleme kaydına yazılmıştır — burada da aynısını
    // gösteriyoruz (yeniden Pexels sorgusu atıp farklı/ilk sonucu
    // göstermek yerine).
    const savedPhoto = state.wordProgress[word.id]?.photoUri;
    if (savedPhoto) {
      setImageUri(savedPhoto);
      setImgLoading(false);
    } else {
      loadImage(word.word);
    }
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [idx]);

  // Bildirim — done olunca 1 kez
  useEffect(() => {
    if (!done || !results.length) return;
    (async () => {
      try {
        // SADECE tekrar bildirimlerini iptal et — günlük hatırlatıcıyı
        // (kullanıcının Profil'de ayarladığı) etkileme (bkz. notifications.js).
        await cancelReviewNotifications();
        const progress = latestProgressRef.current;
        const pendingCount = getInFlightReviewCount(progress);
        if (pendingCount <= 0) return; // döngü tamamen bitti (yarına ertelendi ya da öğrenildi)

        const reviewsDoneVals = results
          .map((r) => progress[r.word.id]?.reviewsDone)
          .filter(
            (v) => typeof v === "number" && !progress[r.word.id]?.dayDone
          );
        const nextRound =
          (reviewsDoneVals.length ? Math.min(...reviewsDoneVals) : 0) + 1;

        await scheduleReviewNotification(
          pendingCount,
          Math.min(nextRound, 3),
          HOUR
        );
      } catch {}
    })();
  }, [done]);

  const loadImage = async (w) => {
    setImageUri(null);
    setImgLoading(true);
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          w
        )}&per_page=3`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await res.json();
      if (data.photos?.length > 0) setImageUri(data.photos[0].src.medium);
    } catch {
    } finally {
      setImgLoading(false);
    }
  };

  const handleAnswer = async (opt) => {
    if (quizAnswer || !word) return;
    setQuizAnswer(opt);

    if (opt.isCorrect) {
      hapticSuccess();
    } else {
      hapticError();
    }

    if (!opt.isCorrect) {
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

    const prog = state.wordProgress[word.id] || {};
    let newProg = afterQuiz(prog, opt.isCorrect);
    // Bu kelime, döngüde kalmaya devam ediyorsa (henüz 3 turu bitmediyse),
    // grupta başka bekleyen kelimeler varsa onların ortak zamanına
    // hizalanıyor. Böylece aynı gün içindeki tüm kelimeler (eski+yeni
    // karışık olsa bile) tek bir ortak tekrar zamanlamasında buluşuyor.
    newProg = alignToGroup(newProg, state.wordProgress, word.id);
    try {
      await actions.updateWordProgress(word.id, newProg);
      // Yerel referansı hemen güncelle — sonraki hesaplamalar
      // (done ekranı / bildirim) state re-render'ını beklemesin.
      latestProgressRef.current = {
        ...latestProgressRef.current,
        [word.id]: newProg,
      };
    } catch {}

    // DÜZELTME: Bir kelime tekrar döngüsünü bitirip STATUS.LEARNED'a
    // geçtiğinde recordWordLearned() hiçbir yerden çağrılmıyordu — bu
    // yüzden StatsScreen'in "Öğrenilen" KPI'ı ve haftalık/aylık grafiği,
    // wordProgress'e göre gerçekten öğrenilmiş kelimeleri hiç saymıyordu.
    // prog.status !== LEARNED kontrolü: bu geçiş sadece REVIEW → LEARNED
    // olduğunda bir kez tetiklenir (getReviewWords zaten LEARNED olmuş
    // kelimeleri tekrar havuzuna hiç sokmuyor).
    if (newProg.status === STATUS.LEARNED && prog.status !== STATUS.LEARNED) {
      actions.recordWordLearned();
    }

    const newResults = [...results, { word, correct: opt.isCorrect }];
    setResults(newResults);

    setTimeout(() => {
      shakeAnim.setValue(0);
      if (idx >= words.length - 1) {
        setDone(true);
        // DÜZELTME: recordSessionComplete hiçbir yerden çağrılmıyordu —
        // "Oturum" KPI'ı ve totalSessions her zaman 0 kalıyordu. Kelime
        // sayısı burada 0 veriyoruz çünkü öğrenilenler yukarıda tek tek
        // recordWordLearned() ile zaten sayıldı (çift sayım olmasın diye).
        actions.recordSessionComplete(0);
      } else setIdx((i) => i + 1);
    }, 1500);
  };

  // Done ekranı
  if (done) {
    const correct = results.filter((r) => r.correct).length;
    const score = words.length ? Math.round((correct / words.length) * 100) : 0;
    const progress = latestProgressRef.current;

    const allLearned = results.every(
      (r) => progress[r.word.id]?.status === STATUS.LEARNED
    );
    const stillPendingToday = results.some((r) => {
      const p = progress[r.word.id];
      return p?.status === STATUS.REVIEW && !p?.dayDone;
    });
    const deferredToTomorrow = results.some((r) => {
      const p = progress[r.word.id];
      return p?.status === STATUS.REVIEW && p?.dayDone;
    });

    let callMessage;
    if (allLearned) {
      callMessage = "Tebrikler! Tüm kelimeler öğrenildi! 🎉";
    } else if (stillPendingToday) {
      callMessage =
        `Da Vinci sizi tekrar çağıracak\n${
          HOUR / (60 * 60 * 1000)
        } saat sonra tekrar zamanı!`;
    } else if (deferredToTomorrow) {
      callMessage =
        "Bazı kelimeler yarın tekrar karşına çıkacak.\nYarın devam edebilirsin.";
    } else {
      callMessage = "Tekrar tamamlandı!";
    }

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
              <Text style={s.doneStatLbl}>Doğru</Text>
            </View>
            <View style={s.doneStatDiv} />
            <View style={s.doneStat}>
              <Text style={[s.doneStatNum, { color: COLORS.error }]}>
                {words.length - correct}
              </Text>
              <Text style={s.doneStatLbl}>Yanlış</Text>
            </View>
          </View>
          <View style={s.callBox}>
            <Text style={s.callEmoji}>🧠</Text>
            <Text style={s.callTxt}>{callMessage}</Text>
          </View>
          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => navigation.navigate("MainTabs", { screen: "Learn" })}
          >
            <LinearGradient
              colors={[COLORS.accent, COLORS.accent + "CC"]}
              style={s.doneBtnGrad}
            >
              <Text style={s.doneBtnTxt}>Ana Sayfaya Dön →</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!word) return null;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.closeBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={s.headerTitle}>
            {reviewType === "r1"
              ? "1. Tekrar"
              : reviewType === "r2"
              ? "2. Tekrar"
              : "3. Tekrar"}
          </Text>
          <Text style={s.headerSub}>
            {idx + 1} / {words.length}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.progressBg}>
        <View
          style={[
            s.progressFill,
            {
              width: `${((idx + (quizAnswer ? 1 : 0)) / words.length) * 100}%`,
            },
          ]}
        />
      </View>

      <Animated.ScrollView
        style={{ opacity: fadeAnim }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.imgBox}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={s.image}
              resizeMode="contain"
            />
          ) : (
            <View style={s.imgPH}>
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

        <View style={s.wordCard}>
          <Text style={s.wordTxt}>{word.word}</Text>
          {word.partOfSpeech && (
            <Text style={s.wordPos}>{word.partOfSpeech}</Text>
          )}
          {/* Türkçe anlam quiz sırasında gizli */}
          <TouchableOpacity
            style={s.speakBtn}
            onPress={() => speakWord(word.word)}
          >
            <Ionicons
              name="volume-high-outline"
              size={22}
              color={COLORS.accent}
            />
            <Text style={s.speakTxt}>Sesli Dinle</Text>
          </TouchableOpacity>
        </View>

        <View style={s.quizBox}>
          <Text style={s.quizQ}>Bu kelimenin Türkçe anlamı nedir?</Text>
          <Animated.View
            style={[s.opts, { transform: [{ translateX: shakeAnim }] }]}
          >
            {quizOpts.map((opt, i) => {
              let bg = COLORS.backgroundCard,
                border = COLORS.border,
                col = COLORS.textPrimary;
              if (quizAnswer) {
                if (opt.isCorrect) {
                  bg = "rgba(100,220,150,0.15)";
                  border = COLORS.success;
                  col = COLORS.success;
                } else if (quizAnswer === opt) {
                  bg = "rgba(255,100,100,0.15)";
                  border = COLORS.error;
                  col = COLORS.error;
                }
              }
              return (
                <TouchableOpacity
                  key={i}
                  style={[s.opt, { backgroundColor: bg, borderColor: border }]}
                  onPress={() => handleAnswer(opt)}
                  disabled={!!quizAnswer}
                >
                  <Text style={[s.optTxt, { color: col }]}>
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
                  s.feedbackTxt,
                  {
                    color: quizAnswer.isCorrect ? COLORS.success : COLORS.error,
                  },
                ]}
              >
                {quizAnswer.isCorrect
                  ? "✅ Doğru!"
                  : `❌ Doğrusu: ${word.translation}`}
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
  imgBox: {
    marginVertical: SPACING.md,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: 340,
    backgroundColor: COLORS.backgroundCard,
  },
  imgPH: {
    height: 160,
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
  wordTxt: {
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
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.accent + "15",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  speakTxt: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.sm,
  },
  quizBox: { gap: SPACING.md },
  quizQ: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
    textAlign: "center",
  },
  opts: { gap: SPACING.sm },
  opt: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
  },
  optTxt: { fontSize: FONT_SIZES.md, fontWeight: "600", flex: 1 },
  feedback: { borderWidth: 1.5, borderRadius: RADIUS.lg, padding: SPACING.md },
  feedbackTxt: { fontWeight: "600", fontSize: FONT_SIZES.sm },
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
  doneStatDiv: { width: 1, height: 40, backgroundColor: COLORS.border },
  doneStatNum: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  doneStatLbl: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  callBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  callEmoji: { fontSize: 28 },
  callTxt: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    flex: 1,
    lineHeight: 20,
  },
  doneBtn: { width: "100%", borderRadius: RADIUS.full, overflow: "hidden" },
  doneBtnGrad: { paddingVertical: SPACING.md + 2, alignItems: "center" },
  doneBtnTxt: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "800" },
});
