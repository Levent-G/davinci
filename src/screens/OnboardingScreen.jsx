// src/screens/OnboardingScreen.jsx
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
  ScrollView,
  TextInput,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";

const { width, height } = Dimensions.get("window");

// Seviye testi soruları
const LEVEL_QUESTIONS = [
  {
    question: 'What is the meaning of "ephemeral"?',
    options: ["Kalıcı", "Geçici", "Güçlü", "Sessiz"],
    answer: 1,
    level: "C1",
  },
  {
    question: 'What does "resilience" mean?',
    options: ["Zayıflık", "Dayanıklılık", "Hız", "Sessizlik"],
    answer: 1,
    level: "B2",
  },
  {
    question: 'What is the meaning of "challenge"?',
    options: ["Zorluk", "Kolaylık", "Yardım", "Oyun"],
    answer: 0,
    level: "B1",
  },
  {
    question: 'What does "beautiful" mean?',
    options: ["Çirkin", "Küçük", "Güzel", "Eski"],
    answer: 2,
    level: "A2",
  },
  {
    question: 'What is "water" in Turkish?',
    options: ["Yemek", "Su", "Hava", "Ateş"],
    answer: 1,
    level: "A1",
  },
];

const SLIDES = [
  {
    id: "welcome",
    icon: "🎨",
    title: "Da Vinci\nMetodu",
    subtitle: "Leonardo'nun düşünme biçimini keşfet",
    description: "5 aşamalı sistemiyle İngilizce kelimeleri kalıcı öğren.",
    gradient: [COLORS.background, "#1A1030"],
    accentColor: COLORS.accent,
  },
  {
    id: "method",
    icon: "🧠",
    title: "Nasıl Çalışır?",
    subtitle: "5 Da Vinci Prensibi",
    description:
      "Her kelime merak → duyular → deneyim → bağlantı → test süreçlerinden geçer.",
    gradient: [COLORS.background, "#0D1A1A"],
    accentColor: COLORS.secondary,
    steps: [
      { icon: "🔍", label: "Merak", color: "#F5A623" },
      { icon: "✨", label: "Duyular", color: "#A29BFE" },
      { icon: "⚗️", label: "Deneyim", color: "#4ECDC4" },
      { icon: "🕸️", label: "Bağlantı", color: "#81C784" },
      { icon: "⚖️", label: "Test", color: "#E17055" },
    ],
  },
  {
    id: "spaced",
    icon: "🔄",
    title: "Aralıklı\nTekrar",
    subtitle: "Bilimsel hafıza sistemi",
    description:
      "Ebbinghaus unutma eğrisini yenerek kelimeleri doğru zamanda tekrar et.",
    gradient: [COLORS.background, "#1A0D10"],
    accentColor: COLORS.error,
  },
];

export default function OnboardingScreen({ navigation }) {
  const { state, actions } = useApp();
  const [step, setStep] = useState("slides"); // slides | name | level_test | result
  const [slideIndex, setSlideIndex] = useState(0);
  // Google/Apple girişinden gelen adı öneri olarak dolduruyoruz — kullanıcı
  // isterse değiştirebilir.
  const [userName, setUserName] = useState(state.authUser?.displayName || "");
  // DÜZELTME (Apple Guideline 4 reddi — Sign In with Apple): Authentication
  // Services zaten adı sağladıysa (Apple SADECE ilk girişte verir, Google
  // her zaman verir), kullanıcıya bunu TEKRAR sormak Apple'ın HIG
  // kurallarına aykırı. İsim zaten varsa "name" adımı tamamen atlanıyor.
  const hasNameAlready = !!state.authUser?.displayName?.trim();
  const nextAfterSlides = hasNameAlready ? "level_test" : "name";
  const [testIndex, setTestIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedAnswer, setSelected] = useState(null);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const animateTransition = (callback) => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(callback, 200);
  };

  // Seviye testi sonucunu hesapla
  const calculateLevel = (answers) => {
    let score = 0;
    answers.forEach((ans, i) => {
      if (ans === LEVEL_QUESTIONS[i].answer) score++;
    });
    // DÜZELTME: C2 hiçbir puanla ulaşılamıyordu (en yüksek dilim C1'de
    // tavan yapıyordu) — 5 üzerinden tam puan artık C2'ye karşılık geliyor.
    if (score >= 5) return "C2";
    if (score >= 4) return "C1";
    if (score >= 3) return "B2";
    if (score >= 2) return "B1";
    if (score >= 1) return "A2";
    return "A1";
  };

  const handleTestAnswer = (answerIndex) => {
    setSelected(answerIndex);
    setTimeout(() => {
      const newAnswers = [...answers, answerIndex];
      setAnswers(newAnswers);
      setSelected(null);
      if (testIndex < LEVEL_QUESTIONS.length - 1) {
        animateTransition(() => setTestIndex(testIndex + 1));
      } else {
        animateTransition(() => setStep("result"));
      }
    }, 800);
  };

  const handleFinish = async (level) => {
    const settings = {
      preferredLevel: level,
      dailyGoal: 10,
      sessionSize: 5,
      notifications: true,
      soundEnabled: true,
    };
    const profile = {
      // Google/Apple ile giriş zorunlu olduğu için kimlik artık Firebase
      // Auth'un uid'si — böylece bu hesap başka bir cihazda giriş yaptığında
      // da aynı kullanıcı olarak eşleşir (Firestore'da users/{uid}).
      id: state.authUser?.uid || `user_${Date.now()}`,
      name: userName.trim() || "Öğrenci",
      email: state.authUser?.email || "",
      avatar: state.authUser?.photoURL || null,
      settings,
    };
    await actions.setUser(profile);
    // DÜZELTME: setUser sadece profile.settings'i (state.user içinde) yazıyor.
    // Kanonik ayar kaynağı state.settings ise ve buraya hiç yazılmıyordu —
    // ProfileScreen ("Seviye: ...") ve önceden LearnScreen bu yüzden seviye
    // testi sonucunu hiç görmüyor, hep varsayılan A1'de kalıyordu.
    await actions.updateSettings(settings);
    await actions.setOnboardingDone();
  };

  // ── SLIDES ──────────────────────────────────────────────────────────────
  if (step === "slides") {
    const slide = SLIDES[slideIndex];
    const isLast = slideIndex === SLIDES.length - 1;
    return (
      <LinearGradient colors={slide.gradient} style={styles.container}>
        <SafeAreaView style={styles.safe}>
          <Animated.View style={[styles.slideContent, { opacity: fadeAnim }]}>
            {/* Skip */}
            <TouchableOpacity
              style={styles.skipBtn}
              onPress={() => animateTransition(() => setStep(nextAfterSlides))}
            >
              <Text style={styles.skipText}>Atla</Text>
            </TouchableOpacity>

            <Text style={styles.slideIcon}>{slide.icon}</Text>
            <Text style={styles.slideTitle}>{slide.title}</Text>
            <Text style={styles.slideSubtitle}>{slide.subtitle}</Text>
            <Text style={styles.slideDesc}>{slide.description}</Text>

            {slide.steps && (
              <View style={styles.stepsRow}>
                {slide.steps.map((s, i) => (
                  <View key={i} style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        {
                          backgroundColor: s.color + "20",
                          borderColor: s.color,
                        },
                      ]}
                    >
                      <Text style={styles.stepIcon}>{s.icon}</Text>
                    </View>
                    <Text style={[styles.stepLabel, { color: s.color }]}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Dots */}
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i === slideIndex && {
                      backgroundColor: slide.accentColor,
                      width: 20,
                    },
                  ]}
                />
              ))}
            </View>

            <TouchableOpacity
              style={[styles.nextBtn, { backgroundColor: slide.accentColor }]}
              onPress={() => {
                if (isLast) {
                  animateTransition(() => setStep(nextAfterSlides));
                } else {
                  animateTransition(() => setSlideIndex(slideIndex + 1));
                }
              }}
            >
              <Text style={styles.nextBtnText}>
                {isLast ? "Başlayalım" : "İleri"}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── AD GİRİŞİ ───────────────────────────────────────────────────────────
  if (step === "name") {
    return (
      <LinearGradient
        colors={[COLORS.background, "#1A1030"]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safe}>
          <Animated.View style={[styles.formContent, { opacity: fadeAnim }]}>
            <Text style={styles.formIcon}>👋</Text>
            <Text style={styles.formTitle}>Merhaba!</Text>
            <Text style={styles.formSubtitle}>Sana nasıl hitap edelim?</Text>
            <TextInput
              style={styles.nameInput}
              placeholder="Adın..."
              placeholderTextColor={COLORS.textMuted}
              value={userName}
              onChangeText={setUserName}
              autoFocus
              maxLength={30}
            />
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: COLORS.accent, marginTop: SPACING.xl },
              ]}
              onPress={() => animateTransition(() => setStep("level_test"))}
            >
              <Text style={styles.nextBtnText}>Devam Et</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => animateTransition(() => setStep("level_test"))}
            >
              <Text style={styles.skipText}>Geç</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── SEVİYE TESTİ ────────────────────────────────────────────────────────
  if (step === "level_test") {
    const q = LEVEL_QUESTIONS[testIndex];
    return (
      <LinearGradient
        colors={[COLORS.background, "#0D1A1A"]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safe}>
          <Animated.View style={[styles.testContent, { opacity: fadeAnim }]}>
            <View style={styles.testHeader}>
              <Text style={styles.testCounter}>
                {testIndex + 1} / {LEVEL_QUESTIONS.length}
              </Text>
              <Text style={styles.testTitle}>Seviye Testi</Text>
              <Text style={styles.testSubtitle}>
                Başlangıç seviyeni belirleyelim
              </Text>
            </View>
            {/* Progress */}
            <View style={styles.testProgress}>
              <View
                style={[
                  styles.testProgressFill,
                  { width: `${(testIndex / LEVEL_QUESTIONS.length) * 100}%` },
                ]}
              />
            </View>
            <View style={styles.questionCard}>
              <Text style={styles.questionText}>{q.question}</Text>
            </View>
            <View style={styles.optionsGrid}>
              {q.options.map((opt, i) => {
                let bg = COLORS.backgroundCard;
                let border = COLORS.border;
                let textColor = COLORS.textPrimary;
                if (selectedAnswer !== null) {
                  if (i === q.answer) {
                    bg = COLORS.success + "20";
                    border = COLORS.success;
                    textColor = COLORS.success;
                  } else if (i === selectedAnswer) {
                    bg = COLORS.error + "20";
                    border = COLORS.error;
                    textColor = COLORS.error;
                  }
                }
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.optionBtn,
                      { backgroundColor: bg, borderColor: border },
                    ]}
                    onPress={() =>
                      selectedAnswer === null && handleTestAnswer(i)
                    }
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionText, { color: textColor }]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              onPress={() => animateTransition(() => setStep("result"))}
            >
              <Text style={styles.skipTestText}>Testi Atla</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // ── SONUÇ ───────────────────────────────────────────────────────────────
  if (step === "result") {
    const level = calculateLevel(answers);
    const correct = answers.filter(
      (ans, i) => ans === LEVEL_QUESTIONS[i].answer
    ).length;
    const levelColors = {
      A1: "#4ECDC4",
      A2: "#45B7D1",
      B1: "#96C93D",
      B2: "#F9CA24",
      C1: "#F0932B",
      C2: "#E17055",
    };
    const color = levelColors[level] || COLORS.accent;
    return (
      <LinearGradient
        colors={[COLORS.background, "#1A1030"]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safe}>
          <Animated.View style={[styles.resultContent, { opacity: fadeAnim }]}>
            <Text style={styles.resultIcon}>🎯</Text>
            <Text style={styles.resultTitle}>Seviyeniz</Text>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: color + "20", borderColor: color },
              ]}
            >
              <Text style={[styles.levelText, { color }]}>{level}</Text>
            </View>
            <Text style={styles.resultScore}>
              {correct}/{LEVEL_QUESTIONS.length} doğru
            </Text>
            <Text style={styles.resultDesc}>
              {level === "A1" &&
                "Temel seviyeden başlıyorsunuz. Harika bir başlangıç!"}
              {level === "A2" && "Temel İngilizce bilginiz var. Geliştirelim!"}
              {level === "B1" && "Orta seviye İngilizcesiniz var. İlerleyelim!"}
              {level === "B2" && "Üst orta seviyedesiniz. Çok iyi!"}
              {level === "C1" && "İleri seviyedesiniz. Mükemmel!"}
              {level === "C2" && "Uzman seviyedesiniz. İnanılmaz!"}
            </Text>
            <TouchableOpacity
              style={[styles.startBtn, { backgroundColor: color }]}
              onPress={() => handleFinish(level)}
            >
              <Text style={styles.startBtnText}>{level} Seviyesinde Başla</Text>
              <Ionicons name="rocket" size={20} color="#fff" />
            </TouchableOpacity>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.levelScroll}
              contentContainerStyle={{
                gap: SPACING.sm,
                paddingHorizontal: SPACING.md,
              }}
            >
              {["A1", "A2", "B1", "B2", "C1", "C2"].map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[
                    styles.levelChip,
                    l === level && {
                      backgroundColor: color + "20",
                      borderColor: color,
                    },
                  ]}
                  onPress={() => handleFinish(l)}
                >
                  <Text
                    style={[styles.levelChipText, l === level && { color }]}
                  >
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        </SafeAreaView>
      </LinearGradient>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },

  // Slides
  slideContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  skipBtn: { position: "absolute", top: SPACING.md, right: SPACING.lg },
  skipText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    marginTop: SPACING.md,
  },
  slideIcon: { fontSize: 72 },
  slideTitle: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 44,
  },
  slideSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
    textAlign: "center",
  },
  slideDesc: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    lineHeight: 22,
  },
  stepsRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  stepItem: { alignItems: "center", gap: 4 },
  stepCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  stepIcon: { fontSize: 22 },
  stepLabel: { fontSize: 10, fontWeight: "700" },
  dots: { flexDirection: "row", gap: SPACING.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  nextBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.lg },

  // Name
  formContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  formIcon: { fontSize: 72 },
  formTitle: { color: COLORS.textPrimary, fontSize: 36, fontWeight: "800" },
  formSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
    textAlign: "center",
  },
  nameInput: {
    width: "100%",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: "center",
  },

  // Test
  testContent: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.lg,
  },
  testHeader: { alignItems: "center", gap: SPACING.xs },
  testCounter: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.sm,
  },
  testTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  testSubtitle: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  testProgress: {
    height: 6,
    backgroundColor: COLORS.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  testProgressFill: {
    height: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 3,
  },
  questionCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  questionText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 26,
  },
  optionsGrid: { gap: SPACING.sm },
  optionBtn: {
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    alignItems: "center",
  },
  optionText: { fontSize: FONT_SIZES.md, fontWeight: "600" },
  skipTestText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
  },

  // Result
  resultContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    gap: SPACING.lg,
  },
  resultIcon: { fontSize: 72 },
  resultTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  levelBadge: {
    paddingHorizontal: SPACING.xxxl,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
  },
  levelText: { fontSize: 48, fontWeight: "900" },
  resultScore: { color: COLORS.textSecondary, fontSize: FONT_SIZES.lg },
  resultDesc: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    lineHeight: 22,
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  startBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.lg },
  levelScroll: { flexGrow: 0 },
  levelChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelChipText: { color: COLORS.textMuted, fontWeight: "700" },
});
