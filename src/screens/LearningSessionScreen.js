// src/screens/LearningSessionScreen.jsx
// Da Vinci 5 Aşama: Merak · Duyular · Yaz · Bağla · Test

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  ScrollView,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import {
  DAVINCI_STAGES,
  calculateNextReview,
  getMasteryLevel,
  generateQuizOptions,
} from "../utils/davinciAlgorithm";
import { useApp } from "../context/AppContext";
import { speakWord } from "../utils/textToSpeech";

const { width } = Dimensions.get("window");

const STAGE_CONFIG = [
  {
    id: 1,
    name: "Merak",
    icon: "🔍",
    color: "#F5A623",
    desc: "Biliyor musun?",
  },
  {
    id: 2,
    name: "Duyular",
    icon: "✨",
    color: "#A29BFE",
    desc: "Hisset & Hayal et",
  },
  {
    id: 3,
    name: "Yaz",
    icon: "⚗️",
    color: "#4ECDC4",
    desc: "Kendi cümleni kur",
  },
  { id: 4, name: "Bağla", icon: "🕸️", color: "#81C784", desc: "Sesli söyle" },
  { id: 5, name: "Test", icon: "⚖️", color: "#E17055", desc: "Kendini sına" },
];

/* ─────────────────────────────────────────
   ANA EKRAN
───────────────────────────────────────── */
export default function LearningSessionScreen({ navigation, route }) {
  const { words: initialWords = [], mode = "learn" } = route.params || {};
  const { state, actions } = useApp();

  // Kelime havuzu — activeWords ile yönetilir
  // usedIds: oturumda kullanılan/bilinen tüm kelime ID'leri (yeni kelime seçerken bunları atla)
  const [activeWords, setActiveWords] = useState([...initialWords]);
  const [usedIds, setUsedIds] = useState(
    new Set(initialWords.map((w) => w.id))
  );
  const [wordIndex, setWordIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const wordPool = activeWords; // alias
  const [isSessionComplete, setComplete] = useState(false);
  const [sessionResults, setResults] = useState([]);

  // Aşama state'leri
  const [showMeaning, setShowMeaning] = useState(false);
  const [userSentence, setUserSentence] = useState("");
  const [sentenceChecked, setSentenceCheck] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizOptions, setQuizOptions] = useState([]);
  const [aiScene, setAiScene] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [imageUri, setImageUri] = useState(null);

  // Animasyonlar
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const allWords = actions.getAllWords();
  const currentWord = wordPool[wordIndex];
  const stage = STAGE_CONFIG[stageIndex];
  const totalSteps = wordPool.length * 5;
  const doneSteps = wordIndex * 5 + stageIndex;
  const progress = totalSteps > 0 ? doneSteps / totalSteps : 0;

  // ── Her aşama/kelime değişiminde sıfırla ve animasyon ──
  useEffect(() => {
    if (!currentWord) return;
    resetStageState();
    animateIn();
    if (stage.id === 2) loadImage(currentWord.word);
    if (stage.id === 5)
      setQuizOptions(generateQuizOptions(currentWord, allWords, 4));
  }, [wordIndex, stageIndex]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Pulse animasyonu — Aşama 4 için
  useEffect(() => {
    if (stage?.id === 4 && repeatCount < 3) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => pulseAnim.stopAnimation();
  }, [stage?.id, repeatCount]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    scaleAnim.setValue(0.95);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
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
  };

  const resetStageState = () => {
    setShowMeaning(false);
    setUserSentence("");
    setSentenceCheck(false);
    setRepeatCount(0);
    setQuizAnswer(null);
    setAiScene(null);
    setAiLoading(false);
    setImageUri(null);
  };

  const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

  const loadImage = async (word) => {
    setImageUri(null);
    try {
      // Önce İngilizce kelimeyle ara
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          word
        )}&per_page=5&orientation=landscape`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await res.json();
      if (data.photos && data.photos.length > 0) {
        // Rastgele bir fotoğraf seç
        const idx = Math.floor(Math.random() * Math.min(data.photos.length, 5));
        const photo = data.photos[idx];
        setImageUri(photo.src.large || photo.src.medium);
        return;
      }
      // Kelime bulunamazsa kategori ile ara
      if (currentWord?.category) {
        const res2 = await fetch(
          `https://api.pexels.com/v1/search?query=${encodeURIComponent(
            currentWord.category
          )}&per_page=5&orientation=landscape`,
          { headers: { Authorization: PEXELS_KEY } }
        );
        const data2 = await res2.json();
        if (data2.photos && data2.photos.length > 0) {
          setImageUri(data2.photos[0].src.large || data2.photos[0].src.medium);
        }
      }
    } catch {
      // Sessizce geç — placeholder gösterilir
    }
  };

  const loadAiScene = async () => {
    if (aiScene || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 150,
          messages: [
            {
              role: "user",
              content: `"${currentWord.word}" (${currentWord.translation}) kelimesi için tek cümlelik, tüm duyuları içeren Türkçe duyusal bir sahne yaz. Sadece sahneyi yaz.`,
            },
          ],
        }),
      });
      const data = await res.json();
      setAiScene(data.content?.[0]?.text || null);
    } catch {}
    setAiLoading(false);
  };

  // ── Kelime havuzdan çıkar (Aşama 1 — "Biliyorum") ──
  const handleKnowWord = async () => {
    const prog = state.wordProgress[currentWord.id] || {};
    const wasAlreadyLearned = (prog.masteryLevel || 0) >= 3;

    // Kelimeyi öğrenilmiş olarak kaydet
    await actions.updateWordProgress(currentWord.id, {
      ...prog,
      correctCount: (prog.correctCount || 0) + 3,
      masteryLevel: 5,
      lastReviewDate: new Date().toISOString(),
      nextReviewDate: new Date(
        Date.now() + 60 * 24 * 60 * 60 * 1000
      ).toISOString(),
      intervalIndex: 5,
      knownByUser: true,
    });

    if (!wasAlreadyLearned) {
      await actions.recordWordLearned();
    }

    setResults((prev) => [
      ...prev,
      { word: currentWord, wasCorrect: true, masteryLevel: 5, known: true },
    ]);

    // usedIds'e ekle
    const newUsedIds = new Set(usedIds);
    newUsedIds.add(currentWord.id);

    // Tüm kelimeler arasından kullanılmamış birini bul
    const allWords = actions.getAllWords();
    // Aynı seviyeden yeni kelime bul — başka seviye karışmasın
    const sessionLevel = route.params?.level;
    const candidate = allWords.find(
      (w) =>
        !newUsedIds.has(w.id) &&
        !state.wordProgress[w.id]?.knownByUser &&
        (state.wordProgress[w.id]?.masteryLevel || 0) < 4 &&
        w.level === sessionLevel
    );

    // Bilinen kelimeyi listeden çıkar, yerine yeni kelime koy
    const withoutCurrent = activeWords.filter((w) => w.id !== currentWord.id);

    let newWords;
    if (candidate) {
      // Yeni kelimeyi aynı konuma ekle
      newWords = [
        ...withoutCurrent.slice(0, wordIndex),
        candidate,
        ...withoutCurrent.slice(wordIndex),
      ];
      newUsedIds.add(candidate.id);
    } else {
      // Yeni kelime kalmadı — sadece çıkar
      newWords = withoutCurrent;
    }

    if (newWords.length === 0) {
      await actions.recordSessionComplete(0);
      setComplete(true);
      return;
    }

    setUsedIds(newUsedIds);
    setActiveWords(newWords);
    // wordIndex aynı kalır — yerine yeni kelime geldi
    const safeIndex =
      wordIndex >= newWords.length ? newWords.length - 1 : wordIndex;
    setWordIndex(safeIndex);
    setStageIndex(0);
    setShowMeaning(false);
    resetStageState();
  };

  // ── Sonraki aşama ──
  const handleNext = async (wasCorrect = true) => {
    // Aşama 5'te (test) progress kaydet
    if (stage.id === 5) {
      const prog = state.wordProgress[currentWord.id] || {};
      const newCorrect = (prog.correctCount || 0) + (wasCorrect ? 1 : 0);
      const newIncorrect = (prog.incorrectCount || 0) + (wasCorrect ? 0 : 1);
      const nextReview = calculateNextReview({
        ...prog,
        correctCount: newCorrect,
        incorrectCount: newIncorrect,
      });
      const masteryLevel = getMasteryLevel({
        ...prog,
        correctCount: newCorrect,
        incorrectCount: newIncorrect,
        intervalIndex: nextReview.nextIntervalIndex,
      });
      await actions.updateWordProgress(currentWord.id, {
        correctCount: newCorrect,
        incorrectCount: newIncorrect,
        masteryLevel,
        lastReviewDate: new Date().toISOString(),
        nextReviewDate: nextReview.nextReviewDate,
        intervalIndex: nextReview.nextIntervalIndex,
      });
      setResults((prev) => [
        ...prev,
        { word: currentWord, wasCorrect, masteryLevel },
      ]);
    }

    if (stageIndex < 4) {
      setStageIndex(stageIndex + 1);
    } else if (wordIndex < wordPool.length - 1) {
      setWordIndex(wordIndex + 1);
      setStageIndex(0);
      setShowMeaning(false);
    } else {
      await actions.recordSessionComplete(wordPool.length);
      setComplete(true);
    }
  };

  const handleQuizAnswer = (option) => {
    if (quizAnswer) return;
    setQuizAnswer(option);
    if (!option.isCorrect) {
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
    setTimeout(() => handleNext(option.isCorrect), 1300);
  };

  const handleExit = () => {
    Alert.alert("Oturumu Bitir?", "İlerlemeniz kaydedilmeyecek.", [
      { text: "İptal", style: "cancel" },
      { text: "Çık", style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  // ── Next butonu kilitli mi? ──
  const isLocked = () => {
    if (stage.id === 1) return false;
    if (stage.id === 2) return false;
    if (stage.id === 3) return !sentenceChecked;
    if (stage.id === 4) return repeatCount < 3;
    if (stage.id === 5) return true; // quiz kendi geçiyor
    return false;
  };

  if (!currentWord) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Kelime bulunamadı.</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.goBackBtn}
          >
            <Text style={styles.goBackText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isSessionComplete) {
    return (
      <SessionComplete
        results={sessionResults}
        words={wordPool}
        onExit={() => navigation.goBack()}
      />
    );
  }

  const locked = isLocked();

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>

        <View style={styles.stagePills}>
          {STAGE_CONFIG.map((s, i) => (
            <View
              key={s.id}
              style={[
                styles.stagePill,
                i < stageIndex && {
                  backgroundColor: s.color + "60",
                  width: 16,
                },
                i === stageIndex && { backgroundColor: s.color, width: 28 },
                i > stageIndex && { backgroundColor: COLORS.border, width: 8 },
              ]}
            />
          ))}
        </View>

        <Text style={styles.wordCounter}>
          {wordIndex + 1}/{wordPool.length}
        </Text>
      </View>

      {/* ── Progress bar ── */}
      <View style={styles.progressBg}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: stage.color,
            },
          ]}
        />
      </View>

      {/* ── Aşama başlığı ── */}
      <View
        style={[styles.stageHeader, { backgroundColor: stage.color + "15" }]}
      >
        <Text style={styles.stageIcon}>{stage.icon}</Text>
        <View>
          <Text style={[styles.stageName, { color: stage.color }]}>
            Aşama {stage.id} — {stage.name}
          </Text>
          <Text style={styles.stageDesc}>{stage.desc}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          }}
        >
          {/* ── Kelime kartı ── */}
          <View style={styles.wordCard}>
            <View style={styles.wordRow}>
              <Text style={styles.wordMain}>{currentWord.word}</Text>
              <TouchableOpacity
                onPress={() => speakWord(currentWord.word)}
                style={styles.speakBtn}
              >
                <Ionicons
                  name="volume-high-outline"
                  size={22}
                  color={stage.color}
                />
              </TouchableOpacity>
            </View>
            {showMeaning && (
              <Animated.View style={styles.meaningReveal}>
                <Text style={[styles.meaningText, { color: stage.color }]}>
                  {currentWord.translation}
                </Text>
                <Text style={styles.exampleText}>"{currentWord.example}"</Text>
                <Text style={styles.exampleTrText}>
                  {currentWord.exampleTr}
                </Text>
              </Animated.View>
            )}
          </View>

          {/* ──────────────────────────────────────
              AŞAMA 1 — MERAK
          ────────────────────────────────────── */}
          {stage.id === 1 && (
            <View style={styles.stageContent}>
              {!showMeaning ? (
                <>
                  <Text style={styles.stageQuestion}>
                    Bu kelimeyi biliyor musun?
                  </Text>
                  <View style={styles.knowBtns}>
                    {/* Evet — kelimeyi havuzdan çıkar */}
                    <TouchableOpacity
                      style={[styles.knowBtn, styles.knowBtnYes]}
                      onPress={handleKnowWord}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#fff"
                      />
                      <Text style={styles.knowBtnText}>Biliyorum</Text>
                    </TouchableOpacity>
                    {/* Hayır — anlamı göster */}
                    <TouchableOpacity
                      style={[styles.knowBtn, styles.knowBtnNo]}
                      onPress={() => setShowMeaning(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name="help-circle-outline"
                        size={22}
                        color="#fff"
                      />
                      <Text style={styles.knowBtnText}>Bilmiyorum</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.knowHint}>
                    "Biliyorum" seçersen bu kelime atlanır, havuzdan yeni kelime
                    gelir.
                  </Text>
                </>
              ) : (
                <View style={styles.knewItBox}>
                  <Text style={styles.knewItText}>
                    Harika! Şimdi bu kelimeyi 5 aşamadan geçireceğiz 💪
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ──────────────────────────────────────
              AŞAMA 2 — DUYULAR
          ────────────────────────────────────── */}
          {stage.id === 2 && (
            <View style={styles.stageContent}>
              {/* Görsel */}
              {imageUri ? (
                <Image
                  source={{ uri: imageUri }}
                  style={styles.wordImage}
                  resizeMode="cover"
                  onError={() => setImageUri(null)}
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <ActivityIndicator size="small" color={stage.color} />
                  <Text style={styles.imagePlaceholderText}>
                    Görsel yükleniyor...
                  </Text>
                </View>
              )}

              {/* AI Sahne */}
              {!aiScene ? (
                <TouchableOpacity
                  style={[
                    styles.aiSceneBtn,
                    { borderColor: stage.color + "60" },
                  ]}
                  onPress={loadAiScene}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <ActivityIndicator size="small" color={stage.color} />
                  ) : (
                    <Ionicons name="sparkles" size={16} color={stage.color} />
                  )}
                  <Text style={[styles.aiSceneBtnText, { color: stage.color }]}>
                    {aiLoading
                      ? "Sahne oluşturuluyor..."
                      : "Duyusal sahne üret"}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View
                  style={[styles.aiSceneBox, { borderLeftColor: stage.color }]}
                >
                  <Text style={styles.aiSceneLabel}>✨ Hayal et:</Text>
                  <Text style={styles.aiSceneText}>{aiScene}</Text>
                </View>
              )}
            </View>
          )}

          {/* ──────────────────────────────────────
              AŞAMA 3 — YAZ
          ────────────────────────────────────── */}
          {stage.id === 3 && (
            <View style={styles.stageContent}>
              {/* Örnek cümle */}
              <View
                style={[styles.exampleBox, { borderLeftColor: stage.color }]}
              >
                <Text style={[styles.exampleLabel, { color: stage.color }]}>
                  📖 Örnek:
                </Text>
                <Text style={styles.exampleBoxText}>{currentWord.example}</Text>
                <Text style={styles.exampleBoxTr}>{currentWord.exampleTr}</Text>
              </View>

              <Text style={styles.writeLabel}>
                "{currentWord.word}" kelimesini kullanarak bir şey yaz:
              </Text>

              {/* Input */}
              {(() => {
                const minChars = 3;
                const hasChars = userSentence.trim().length >= minChars;
                const containsWord = userSentence
                  .toLowerCase()
                  .includes(currentWord.word.toLowerCase());
                const status = !hasChars
                  ? "short"
                  : containsWord
                  ? "ok"
                  : "no_word";

                return (
                  <>
                    <TextInput
                      style={[
                        styles.writeInput,
                        sentenceChecked && { borderColor: COLORS.success },
                        !sentenceChecked &&
                          status === "ok" && { borderColor: COLORS.success },
                        !sentenceChecked &&
                          status === "no_word" && { borderColor: "#F9CA24" },
                      ]}
                      value={userSentence}
                      onChangeText={setUserSentence}
                      placeholder={`"${currentWord.word}" kelimesini cümlende kullan...`}
                      placeholderTextColor={COLORS.textMuted}
                      multiline
                      numberOfLines={3}
                      editable={!sentenceChecked}
                    />

                    {/* Anlık geri bildirim */}
                    {!sentenceChecked && userSentence.trim().length > 0 && (
                      <View style={styles.writeFeedback}>
                        {status === "ok" && (
                          <>
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={COLORS.success}
                            />
                            <Text
                              style={[
                                styles.writeFeedbackText,
                                { color: COLORS.success },
                              ]}
                            >
                              "{currentWord.word}" kelimesini kullandın! 👍
                            </Text>
                          </>
                        )}
                        {status === "no_word" && (
                          <>
                            <Ionicons
                              name="warning-outline"
                              size={16}
                              color="#F9CA24"
                            />
                            <Text
                              style={[
                                styles.writeFeedbackText,
                                { color: "#F9CA24" },
                              ]}
                            >
                              "{currentWord.word}" kelimesini eklemeyi unutma!
                            </Text>
                          </>
                        )}
                        {status === "short" && (
                          <>
                            <Ionicons
                              name="pencil-outline"
                              size={16}
                              color={COLORS.textMuted}
                            />
                            <Text
                              style={[
                                styles.writeFeedbackText,
                                { color: COLORS.textMuted },
                              ]}
                            >
                              Biraz daha yaz...
                            </Text>
                          </>
                        )}
                      </View>
                    )}

                    {!sentenceChecked ? (
                      <TouchableOpacity
                        style={[
                          styles.writeConfirmBtn,
                          { backgroundColor: stage.color },
                          !hasChars && { opacity: 0.4 },
                        ]}
                        onPress={() => hasChars && setSentenceCheck(true)}
                        disabled={!hasChars}
                      >
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color="#fff"
                        />
                        <Text style={styles.writeConfirmText}>
                          {status === "ok"
                            ? "Harika, devam et →"
                            : "Yine de devam et →"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.writeCheckedBox}>
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={COLORS.success}
                        />
                        <Text style={styles.writeCheckedText}>
                          {containsWord
                            ? "Mükemmel! Kelimeyi kendi cümlende kullandın."
                            : "Kaydedildi. Bir dahaki sefere kelimeyi ekle!"}
                        </Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>
          )}

          {/* ──────────────────────────────────────
              AŞAMA 4 — BAĞLA (Sesli tekrar)
          ────────────────────────────────────── */}
          {stage.id === 4 && (
            <View style={styles.stageContent}>
              <Text style={styles.connectLabel}>
                Kelimeyi 3 kez sesli söyle, her seferinde butona bas:
              </Text>

              {/* Büyük kelime + pulse */}
              <Animated.View
                style={[
                  styles.bigWordBox,
                  { transform: [{ scale: repeatCount < 3 ? pulseAnim : 1 }] },
                ]}
              >
                <Text style={[styles.bigWord, { color: stage.color }]}>
                  {currentWord.word}
                </Text>
                <Text style={styles.bigWordTr}>{currentWord.translation}</Text>
              </Animated.View>

              {/* Tap noktaları */}
              <View style={styles.tapDots}>
                {[0, 1, 2].map((i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.tapDot,
                      i < repeatCount && {
                        backgroundColor: stage.color,
                        borderColor: stage.color,
                      },
                      i === repeatCount && {
                        borderColor: stage.color,
                        borderWidth: 2.5,
                      },
                    ]}
                    onPress={() => {
                      if (i === repeatCount && repeatCount < 3) {
                        speakWord(currentWord.word);
                        setRepeatCount(repeatCount + 1);
                      }
                    }}
                    disabled={i !== repeatCount || repeatCount >= 3}
                  >
                    {i < repeatCount ? (
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    ) : (
                      <Text
                        style={[
                          styles.tapDotNum,
                          {
                            color:
                              i === repeatCount
                                ? stage.color
                                : COLORS.textMuted,
                          },
                        ]}
                      >
                        {i + 1}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {repeatCount < 3 ? (
                <Text style={styles.tapHint}>
                  {3 - repeatCount} tekrar kaldı — butona bas, kelimeyi yüksek
                  sesle söyle
                </Text>
              ) : (
                <View
                  style={[
                    styles.tapDoneBox,
                    {
                      backgroundColor: stage.color + "20",
                      borderColor: stage.color + "40",
                    },
                  ]}
                >
                  <Text style={[styles.tapDoneText, { color: stage.color }]}>
                    🎉 Harika! 3 kez söyledin, kas hafızana işlendi!
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* ──────────────────────────────────────
              AŞAMA 5 — TEST
          ────────────────────────────────────── */}
          {stage.id === 5 && (
            <View style={styles.stageContent}>
              <Text style={styles.quizQuestion}>
                Bu kelimenin anlamı nedir?
              </Text>

              <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
                <View style={styles.quizOptions}>
                  {quizOptions.map((opt, i) => {
                    let bg = COLORS.backgroundCard;
                    let border = COLORS.border;
                    let color = COLORS.textPrimary;
                    if (quizAnswer) {
                      if (opt.isCorrect) {
                        bg = COLORS.successGlow;
                        border = COLORS.success;
                        color = COLORS.success;
                      } else if (quizAnswer === opt) {
                        bg = COLORS.errorGlow;
                        border = COLORS.error;
                        color = COLORS.error;
                      }
                    }
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[
                          styles.quizOption,
                          { backgroundColor: bg, borderColor: border },
                        ]}
                        onPress={() => handleQuizAnswer(opt)}
                        disabled={!!quizAnswer}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.quizOptionText, { color }]}>
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
                </View>
              </Animated.View>

              {quizAnswer && (
                <View
                  style={[
                    styles.quizFeedback,
                    {
                      borderColor: quizAnswer.isCorrect
                        ? COLORS.success
                        : COLORS.error,
                      backgroundColor: quizAnswer.isCorrect
                        ? COLORS.successGlow
                        : COLORS.errorGlow,
                    },
                  ]}
                >
                  {quizAnswer.isCorrect ? (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.success}
                      />
                      <Text
                        style={[
                          styles.quizFeedbackText,
                          { color: COLORS.success },
                        ]}
                      >
                        Doğru! Sonraki kelimeye geçiliyor...
                      </Text>
                    </>
                  ) : (
                    <>
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={COLORS.error}
                      />
                      <Text
                        style={[
                          styles.quizFeedbackText,
                          { color: COLORS.error },
                        ]}
                      >
                        Yanlış! Doğrusu:{" "}
                        <Text style={{ fontWeight: "800" }}>
                          {currentWord.translation}
                        </Text>
                      </Text>
                    </>
                  )}
                </View>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* ── Alt buton (Aşama 5 hariç) ── */}
      {stage.id !== 5 && (
        <View style={styles.bottomArea}>
          {/* Aşama 1: Bilmiyorum basılmışsa "Sonraki Aşama", basılmamışsa buton yok */}
          {stage.id === 1 ? (
            showMeaning ? (
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: stage.color }]}
                onPress={() => handleNext()}
                activeOpacity={0.85}
              >
                <Text style={styles.nextBtnText}>Sonraki Aşama →</Text>
              </TouchableOpacity>
            ) : null
          ) : (
            <TouchableOpacity
              style={[
                styles.nextBtn,
                { backgroundColor: locked ? COLORS.border : stage.color },
              ]}
              onPress={() => !locked && handleNext()}
              disabled={locked}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.nextBtnText,
                  locked && { color: COLORS.textMuted },
                ]}
              >
                {stage.id === 3 && !sentenceChecked
                  ? "Önce onayla →"
                  : stage.id === 4 && repeatCount < 3
                  ? `${3 - repeatCount} tekrar kaldı`
                  : stageIndex < 4
                  ? "Sonraki Aşama →"
                  : "Sonraki Kelime →"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────
   OTURUM TAMAMLANDI
───────────────────────────────────────── */
function SessionComplete({ results, words, onExit }) {
  const knownCount = results.filter((r) => r.known).length;
  const learnedCount = results.filter((r) => !r.known).length;
  const correct = results.filter((r) => r.wasCorrect && !r.known).length;
  const total = learnedCount || 1;
  const allKnown = learnedCount === 0;
  const score = allKnown ? 100 : Math.round((correct / total) * 100);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const emoji = allKnown
    ? "🧠"
    : score >= 80
    ? "🏆"
    : score >= 60
    ? "⭐"
    : "📚";
  const message = allKnown
    ? "Tüm kelimeleri zaten biliyordun! Havuzdan yeni kelimeler eklenecek."
    : score >= 80
    ? "Mükemmel! Da Vinci metodunu tam uyguladın."
    : score >= 60
    ? "İyi iş! Her tekrar seni güçlendirir."
    : "Devam et! Her hata yeni bir keşif.";

  return (
    <SafeAreaView style={styles.completeContainer}>
      <Animated.View style={[styles.completeContent, { opacity: fadeAnim }]}>
        <Animated.Text
          style={[styles.completeEmoji, { transform: [{ scale: scaleAnim }] }]}
        >
          {emoji}
        </Animated.Text>
        <Text style={styles.completeTitle}>Oturum Tamamlandı!</Text>

        <Animated.View
          style={[styles.scoreCircle, { transform: [{ scale: scaleAnim }] }]}
        >
          <Text style={styles.scoreNum}>{score}</Text>
          <Text style={styles.scorePct}>%</Text>
        </Animated.View>

        <Text style={styles.completeSubtitle}>
          {correct}/{total} doğru
        </Text>

        <View style={styles.completeStats}>
          {[
            { label: "Öğrenilen", value: learnedCount, color: COLORS.accent },
            { label: "Bilinen", value: knownCount, color: COLORS.success },
            { label: "Yanlış", value: total - correct, color: COLORS.error },
          ].map((s, i) => (
            <React.Fragment key={i}>
              {i > 0 && <View style={styles.statDivider} />}
              <View style={styles.completeStat}>
                <Text style={[styles.completeStatVal, { color: s.color }]}>
                  {s.value}
                </Text>
                <Text style={styles.completeStatLbl}>{s.label}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <View style={styles.completeMsg}>
          <Text style={styles.completeMsgText}>{message}</Text>
        </View>

        <TouchableOpacity style={styles.completeBtn} onPress={onExit}>
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentDark || "#5A52D5"]}
            style={styles.completeBtnGrad}
          >
            <Text style={styles.completeBtnText}>Tamamla →</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────
   STYLES
───────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.lg,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.lg },
  goBackBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  goBackText: { color: "#fff", fontWeight: "700" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  exitBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stagePills: { flexDirection: "row", gap: 5, alignItems: "center" },
  stagePill: { height: 6, borderRadius: 3 },
  wordCounter: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    minWidth: 36,
    textAlign: "right",
  },

  // Progress
  progressBg: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: 3 },

  // Stage header
  stageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  stageIcon: { fontSize: 20 },
  stageName: { fontSize: FONT_SIZES.sm, fontWeight: "800" },
  stageDesc: { fontSize: FONT_SIZES.xs, color: COLORS.textMuted },

  // Scroll
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },

  // Kelime kartı
  wordCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
    ...SHADOWS.card,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  wordMain: {
    color: COLORS.textPrimary,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1,
    textAlign: "center",
  },
  speakBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.backgroundCardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  meaningReveal: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  meaningText: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  exampleText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontStyle: "italic",
    textAlign: "center",
  },
  exampleTrText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },

  // Stage content
  stageContent: { gap: SPACING.md },

  // ── Aşama 1 ──
  stageQuestion: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: SPACING.sm,
  },
  knowBtns: { flexDirection: "row", gap: SPACING.md },
  knowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
  },
  knowBtnYes: { backgroundColor: COLORS.success },
  knowBtnNo: { backgroundColor: COLORS.accent },
  knowBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  knowHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
    lineHeight: 18,
  },
  knewItBox: {
    backgroundColor: COLORS.accentGlow || "rgba(108,99,255,0.1)",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.accent + "30",
  },
  knewItText: {
    color: COLORS.accent,
    fontWeight: "600",
    textAlign: "center",
    fontSize: FONT_SIZES.md,
  },

  // ── Aşama 2 ──
  wordImage: { width: "100%", height: 180, borderRadius: RADIUS.xl },
  imagePlaceholder: {
    height: 120,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  imagePlaceholderText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  imagePlaceholderIcon: { fontSize: 40 },
  aiSceneBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: COLORS.backgroundCard,
  },
  aiSceneBtnText: { fontWeight: "600", fontSize: FONT_SIZES.sm },
  aiSceneBox: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderLeftWidth: 3,
  },
  aiSceneLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
  },
  aiSceneText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
    fontStyle: "italic",
  },

  // ── Aşama 3 ──
  exampleBox: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
    borderLeftWidth: 3,
  },
  exampleLabel: { fontSize: FONT_SIZES.xs, fontWeight: "700" },
  exampleBoxText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontStyle: "italic",
    lineHeight: 20,
  },
  exampleBoxTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  writeLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  writeInput: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 80,
    textAlignVertical: "top",
  },
  writeFeedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
  },
  writeFeedbackText: { fontSize: FONT_SIZES.sm, fontWeight: "600", flex: 1 },
  writeConfirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  writeConfirmText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
  writeCheckedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.successGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  writeCheckedText: { color: COLORS.success, fontWeight: "600", flex: 1 },

  // ── Aşama 4 ──
  connectLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    textAlign: "center",
  },
  bigWordBox: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  bigWord: { fontSize: 48, fontWeight: "900", letterSpacing: -1 },
  bigWordTr: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
  },
  tapDots: { flexDirection: "row", justifyContent: "center", gap: SPACING.xl },
  tapDot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  tapDotNum: { fontWeight: "800", fontSize: FONT_SIZES.lg },
  tapHint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
    lineHeight: 18,
  },
  tapDoneBox: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: "center",
  },
  tapDoneText: {
    fontWeight: "600",
    textAlign: "center",
    fontSize: FONT_SIZES.sm,
  },

  // ── Aşama 5 ──
  quizQuestion: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    fontWeight: "600",
  },
  quizOptions: { gap: SPACING.sm },
  quizOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
  },
  quizOptionText: { fontSize: FONT_SIZES.md, fontWeight: "600", flex: 1 },
  quizFeedback: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  quizFeedbackText: { fontWeight: "600", fontSize: FONT_SIZES.sm, flex: 1 },

  // Alt buton
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  nextBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md + 2,
    alignItems: "center",
  },
  nextBtnText: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "700" },

  // Oturum tamamlandı
  completeContainer: { flex: 1, backgroundColor: COLORS.background },
  completeContent: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl * 2,
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
    backgroundColor: COLORS.accentGlow || "rgba(108,99,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  scoreNum: {
    color: COLORS.accent,
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 56,
  },
  scorePct: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    alignSelf: "flex-end",
    paddingBottom: 8,
  },
  completeSubtitle: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  completeStats: { flexDirection: "row", alignItems: "center" },
  completeStat: { alignItems: "center", paddingHorizontal: SPACING.xl, gap: 4 },
  statDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  completeStatVal: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  completeStatLbl: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  completeMsg: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: "100%",
  },
  completeMsgText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
    textAlign: "center",
  },
  completeBtn: { width: "100%", borderRadius: RADIUS.full, overflow: "hidden" },
  completeBtnGrad: { paddingVertical: SPACING.md + 2, alignItems: "center" },
  completeBtnText: {
    color: "#fff",
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
  },
});
