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
import { getWordPhotos, getLocalCachedPhotoUri } from "../services/wordPhotos";

const { width } = Dimensions.get("window");

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
  // Fotoğraf kartı — "Türkçesini Gör" ile 3D çevrilip arkasında Türkçe
  // anlamı gösteriyor. Quiz artık fotoğraftan İNGİLİZCE kelimeyi
  // buldurtuyor (eskiden kelimenin İngilizcesi zaten yazılı duruyor,
  // sadece Türkçesi soruluyordu — bu da gerçek bir hatırlama testi
  // değildi).
  const [flipped, setFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const word = words[idx] || null;

  const toggleFlip = () => {
    Animated.spring(flipAnim, {
      toValue: flipped ? 0 : 1,
      friction: 8,
      tension: 10,
      useNativeDriver: true,
    }).start();
    setFlipped((f) => !f);
  };
  const frontInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "180deg"],
  });
  const backInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["180deg", "360deg"],
  });

  useEffect(() => {
    latestProgressRef.current = state.wordProgress;
  }, [state.wordProgress]);

  useEffect(() => {
    if (!word) return;
    setQuizAnswer(null);
    setFlipped(false);
    flipAnim.setValue(0);
    setQuizOpts(generateQuizOptions(word, allWords));
    // Önce cihaza indirilmiş yerel kopyaya bak — varsa internet olmasa
    // bile anında gösterilir (bkz. LearningSessionScreen'deki
    // cacheWordPhotoLocally çağrısı).
    const localUri = getLocalCachedPhotoUri(word.id);
    // Öğrenme aşamasında kullanıcı fotoğrafı yenilediyse, o seçim
    // kelimenin ilerleme kaydına yazılmıştır — burada da aynısını
    // gösteriyoruz (yeniden Pexels sorgusu atıp farklı/ilk sonucu
    // göstermek yerine).
    const savedPhoto = state.wordProgress[word.id]?.photoUri;
    if (localUri) {
      setImageUri(localUri);
      setImgLoading(false);
    } else if (savedPhoto) {
      setImageUri(savedPhoto);
      setImgLoading(false);
    } else if (word.imageUrl) {
      // Kelimenin Firebase'deki kalıcı foto havuzunda zaten bir aktif
      // fotoğraf varsa (admin panelinden ya da daha önce başka bir
      // kullanıcının cihazında ilk kez çekilip kaydedilmişse), Pexels'e
      // hiç sorulmadan doğrudan o kullanılır.
      setImageUri(word.imageUrl);
      setImgLoading(false);
    } else {
      loadImage(word);
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

  // Önce kelimenin Firebase'deki kalıcı foto havuzuna bakar; havuz boşsa
  // (bu kelime ilk kez görülüyorsa) Pexels'ten çekip bir daha hiç
  // sorulmamak üzere Firebase'e kalıcı olarak kaydeder.
  const loadImage = async (w) => {
    setImageUri(null);
    setImgLoading(true);
    try {
      const result = await getWordPhotos(w);
      if (result.activeUrl) setImageUri(result.activeUrl);
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
        <View style={s.flipWrap}>
          <Animated.View
            pointerEvents={flipped ? "none" : "auto"}
            style={[
              s.imgBox,
              s.flipFace,
              {
                transform: [
                  { perspective: 1000 },
                  { rotateY: frontInterpolate },
                ],
              },
            ]}
          >
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
            <TouchableOpacity style={s.flipHintBtn} onPress={toggleFlip}>
              <Ionicons name="language" size={14} color="#fff" />
              <Text style={s.flipHintTxt}>Türkçesini Gör</Text>
            </TouchableOpacity>
          </Animated.View>
          <Animated.View
            pointerEvents={flipped ? "auto" : "none"}
            style={[
              s.imgBox,
              s.flipFace,
              s.flipBack,
              {
                transform: [
                  { perspective: 1000 },
                  { rotateY: backInterpolate },
                ],
              },
            ]}
          >
            <Text style={s.flipBackTxt}>{word.translation}</Text>
            <TouchableOpacity style={s.flipHintBtn} onPress={toggleFlip}>
              <Ionicons name="image" size={14} color="#fff" />
              <Text style={s.flipHintTxt}>Fotoğrafa Dön</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <View style={s.quizBox}>
          <Text style={s.quizQ}>Bu fotoğraftaki kelime hangisi?</Text>
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
                    {opt.word.word}
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
                  : `❌ Doğrusu: ${word.word}`}
              </Text>
            </View>
          )}
          {quizAnswer && (
            <TouchableOpacity
              style={s.speakBtn}
              onPress={() => speakWord(word.word)}
            >
              <Ionicons
                name="volume-high-outline"
                size={22}
                color={COLORS.accent}
              />
              <Text style={s.speakTxt}>
                {word.word} — Sesli Dinle
              </Text>
            </TouchableOpacity>
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
  flipWrap: {
    height: 340,
    marginVertical: SPACING.md,
    position: "relative",
  },
  imgBox: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  flipFace: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backfaceVisibility: "hidden",
    backgroundColor: COLORS.backgroundCard,
  },
  flipBack: {
    backgroundColor: COLORS.accent + "15",
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
  },
  flipBackTxt: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: "900",
    textAlign: "center",
  },
  flipHintBtn: {
    position: "absolute",
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  flipHintTxt: { color: "#fff", fontSize: FONT_SIZES.xs, fontWeight: "700" },
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
