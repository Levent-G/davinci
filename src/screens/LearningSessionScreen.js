// src/screens/LearningSessionScreen.jsx
// Gerçek Da Vinci 5 Prensibi: Curiosità · Sensazione · Dimostrazione · Connessione · Arte/Scienza

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
  getUnsplashSearchUrl,
} from "../utils/davinciAlgorithm";
import { useApp } from "../context/AppContext";
import { speakWord } from "../utils/textToSpeech";

const { width } = Dimensions.get("window");
const STAGES = Object.values(DAVINCI_STAGES);

/* ─────────────────────────────────────────
   ANA EKRAN
───────────────────────────────────────── */
export default function LearningSessionScreen({ navigation, route }) {
  const { words = [], mode = "learn" } = route.params || {};
  const { state, actions } = useApp();

  const [wordIndex, setWordIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [isSessionComplete, setComplete] = useState(false);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizOptions, setQuizOptions] = useState([]);
  const [showMeaning, setShowMeaning] = useState(false);
  const [sessionResults, setResults] = useState([]);
  const [timer, setTimer] = useState(0);
  const [repeatCount, setRepeatCount] = useState(0);
  // Stage 1 — Curiosità
  const [curiosityAnswer, setCuriosity] = useState("");
  // Stage 3 — Dimostrazione
  const [userSentence, setUserSentence] = useState("");
  const [sentenceChecked, setSentenceCheck] = useState(false);
  // Stage 4 — Connessione
  const [connections, setConnections] = useState(["", ""]);
  const [connectDone, setConnectDone] = useState(false);
  // Stage 2 — Sensazione görsel
  const [imageUri, setImageUri] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const currentWord = words[wordIndex];
  const currentStage = STAGES[stageIndex];
  const allWords = actions.getAllWords();
  const totalSteps = words.length * STAGES.length;
  const completedSteps = wordIndex * STAGES.length + stageIndex;
  const progress = completedSteps / totalSteps;

  // ── her yeni kelime/aşamada sıfırla ──
  useEffect(() => {
    if (!currentWord) return;
    animateIn();
    setShowMeaning(false);
    setQuizAnswer(null);
    setRepeatCount(0);
    setCuriosity("");
    setUserSentence("");
    setSentenceCheck(false);
    setConnections(["", ""]);
    setConnectDone(false);
    setImageUri(null);
    setImageError(false);

    if (currentStage.id === 2) loadImage(currentWord.word);
    if (currentStage.id === 5)
      setQuizOptions(generateQuizOptions(currentWord, allWords, 4));

    startTimer();
    return () => clearInterval(timerRef.current);
  }, [wordIndex, stageIndex]);

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const animateIn = () => {
    fadeAnim.setValue(0);
    scaleAnim.setValue(0.92);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const startTimer = () => {
    clearInterval(timerRef.current);
    setTimer(0);
    timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
  };

  // ── Unsplash + Claude fallback görsel yükle ──
  const loadImage = async (word) => {
    setImageLoading(true);
    setImageError(false);
    try {
      // Önce Unsplash dene
      const url = getUnsplashSearchUrl(word);
      setImageUri(url);
    } catch {
      setImageError(true);
    } finally {
      setImageLoading(false);
    }
  };

  // ── Claude API ile görsel prompt üret ──
  const generateAIImagePrompt = async (word) => {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 200,
          messages: [
            {
              role: "user",
              content: `Da Vinci'nin Sensazione prensibi için: "${word}" kelimesini tüm 5 duyuyla tasvir eden 2-3 cümlelik zengin Türkçe bir duyusal sahne yaz. Görme, işitme, dokunma, koku, tat kullan. Sadece sahneyi yaz, başka bir şey yazma.`,
            },
          ],
        }),
      });
      const data = await res.json();
      return data.content?.[0]?.text || null;
    } catch {
      return null;
    }
  };

  const [aiPrompt, setAiPrompt] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const handleGenerateAI = async () => {
    setAiLoading(true);
    const prompt = await generateAIImagePrompt(currentWord.word);
    setAiPrompt(prompt);
    setAiLoading(false);
    // Prompt gelince Unsplash'tan daha spesifik ara
    if (prompt) {
      const keywords = currentWord.word;
      setImageUri(
        `https://source.unsplash.com/400x300/?${encodeURIComponent(keywords)}`
      );
    }
  };

  // ── Sonraki aşamaya geç ──
  const handleNext = async (wasCorrect = true) => {
    clearInterval(timerRef.current);

    if (currentStage.id === 5) {
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

    if (stageIndex < STAGES.length - 1) {
      setStageIndex(stageIndex + 1);
    } else if (wordIndex < words.length - 1) {
      setWordIndex(wordIndex + 1);
      setStageIndex(0);
    } else {
      await actions.recordSessionComplete(words.length);
      setComplete(true);
    }
  };

  const handleQuizAnswer = (option) => {
    if (quizAnswer) return;
    setQuizAnswer(option);
    setTimeout(() => handleNext(option.isCorrect), 1200);
  };

  const handleExit = () => {
    Alert.alert("Oturumu Bitir?", "İlerlemeniz kaydedilmeyecek.", [
      { text: "İptal", style: "cancel" },
      { text: "Çık", style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  // ── Aşama geçiş butonu aktif mi? ──
  const isNextLocked = () => {
    if (currentStage.id === 1) return false; // Curiosità — isteğe bağlı
    if (currentStage.id === 2) return false; // Sensazione — görsel
    if (currentStage.id === 3) return !sentenceChecked; // Dimostrazione — cümle zorunlu
    if (currentStage.id === 4) return repeatCount < 3; // Connessione — bağlantı
    return false;
  };

  const getNextButtonLabel = () => {
    if (currentStage.id === 3 && !sentenceChecked) return "Önce cümle kur →";
    if (currentStage.id === 4 && repeatCount < 3)
      return `${3 - repeatCount} bağlantı kaldı`;
    return stageIndex < STAGES.length - 1
      ? "Sonraki Aşama →"
      : "Sonraki Kelime →";
  };

  if (!currentWord) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Kelime bulunamadı.</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Text style={styles.backBtnText}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isSessionComplete) {
    return (
      <SessionComplete
        results={sessionResults}
        words={words}
        onExit={() => navigation.goBack()}
      />
    );
  }

  const locked = isNextLocked();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleExit} style={styles.exitBtn}>
          <Ionicons name="close" size={22} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.wordCounter}>
          {wordIndex + 1} / {words.length}
        </Text>
        <View style={styles.stageDots}>
          {STAGES.map((s, i) => (
            <View
              key={i}
              style={[
                styles.stageDot,
                {
                  backgroundColor: i <= stageIndex ? s.color : COLORS.border,
                  width: i === stageIndex ? 18 : 6,
                  opacity: i < stageIndex ? 0.4 : 1,
                },
              ]}
            />
          ))}
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBg}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
              backgroundColor: currentStage.color,
            },
          ]}
        />
      </View>

      {/* Stage badge */}
      <View style={styles.stageBadgeRow}>
        <LinearGradient
          colors={[currentStage.color + "25", currentStage.color + "10"]}
          style={[
            styles.stageBadge,
            { borderColor: currentStage.color + "50" },
          ]}
        >
          <Text style={styles.stageBadgeIcon}>{currentStage.icon}</Text>
          <View>
            <Text
              style={[styles.stageBadgeName, { color: currentStage.color }]}
            >
              {currentStage.name}
            </Text>
            <Text style={styles.stageBadgeLatin}>
              {currentStage.latinMeaning}
            </Text>
          </View>
        </LinearGradient>
        <Text style={styles.timerText}>{timer}s</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.card,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          {/* Kelime başlığı */}
          <View style={styles.wordHeaderRow}>
            <Text style={styles.wordMain}>{currentWord.word}</Text>
            <TouchableOpacity
              onPress={() => speakWord(currentWord.word)}
              style={styles.speakBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name="volume-high-outline"
                size={24}
                color={COLORS.secondary}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.phonetic}>{currentWord.phonetic}</Text>

          {/* ── Aşama İçerikleri ── */}
          {currentStage.id === 1 && (
            <CuriositaStage
              word={currentWord}
              answer={curiosityAnswer}
              onAnswer={setCuriosity}
              showMeaning={showMeaning}
              onReveal={() => setShowMeaning(true)}
            />
          )}
          {currentStage.id === 2 && (
            <SensazioneStage
              word={currentWord}
              imageUri={imageUri}
              imageLoading={imageLoading}
              imageError={imageError}
              aiPrompt={aiPrompt}
              aiLoading={aiLoading}
              onReload={() => loadImage(currentWord.word)}
              onGenerateAI={handleGenerateAI}
            />
          )}
          {currentStage.id === 3 && (
            <DimostrazioneStage
              word={currentWord}
              sentence={userSentence}
              onChangeSentence={setUserSentence}
              checked={sentenceChecked}
              onCheck={() => setSentenceCheck(true)}
            />
          )}
          {currentStage.id === 4 && (
            <ConnessioneStage
              word={currentWord}
              connections={connections}
              onChangeConnection={(i, v) => {
                const updated = [...connections];
                updated[i] = v;
                setConnections(updated);
                if (updated.filter((c) => c.trim().length > 1).length >= 2)
                  setConnectDone(true);
                else setConnectDone(false);
              }}
              repeatCount={repeatCount}
              onRepeat={setRepeatCount}
              done={connectDone}
            />
          )}
          {currentStage.id === 5 && (
            <ArteScienzaStage
              word={currentWord}
              quizOptions={quizOptions}
              quizAnswer={quizAnswer}
              onAnswer={handleQuizAnswer}
            />
          )}

          {/* Da Vinci prensibi kutusu */}
          <View
            style={[
              styles.principleBox,
              {
                borderColor: currentStage.color + "40",
                backgroundColor: currentStage.color + "08",
              },
            ]}
          >
            <Text
              style={[styles.principleTitle, { color: currentStage.color }]}
            >
              {currentStage.principle}
            </Text>
            <Text style={styles.principleQuote}>
              {currentStage.davinciQuote}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Sonraki buton (Stage 5 hariç) */}
      {currentStage.id !== 5 && (
        <View style={styles.bottomArea}>
          <TouchableOpacity
            style={[
              styles.nextBtn,
              { backgroundColor: locked ? COLORS.border : currentStage.color },
            ]}
            onPress={() => !locked && handleNext(true)}
            activeOpacity={locked ? 1 : 0.88}
          >
            <Text
              style={[
                styles.nextBtnText,
                locked && { color: COLORS.textMuted },
              ]}
            >
              {getNextButtonLabel()}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

/* ─────────────────────────────────────────
   STAGE 1 — CURIOSITà
   Merak: Kelimeyle ilgili soru sor, anlamı gizle/göster
───────────────────────────────────────── */
function CuriositaStage({ word, answer, onAnswer, showMeaning, onReveal }) {
  const questions = [
    `"${word.word}" seni ne hatırlatıyor?`,
    "Bu kelimeyi daha önce nerede duymuş olabilirsin?",
    "Bu kelimenin hangi duyguyla bağlantısı olabilir?",
  ];

  return (
    <View style={styles.stageContent}>
      {/* Merak soruları */}
      <View style={styles.curiosityQuestions}>
        {questions.map((q, i) => (
          <View key={i} style={styles.curiosityQ}>
            <Text style={styles.curiosityQNum}>{i + 1}</Text>
            <Text style={styles.curiosityQText}>{q}</Text>
          </View>
        ))}
      </View>

      {/* Cevap alanı */}
      <TextInput
        style={styles.curiosityInput}
        value={answer}
        onChangeText={onAnswer}
        placeholder="Aklına gelenleri yaz... (isteğe bağlı)"
        placeholderTextColor={COLORS.textMuted}
        multiline
        numberOfLines={2}
      />

      {/* Anlam aç/gizle */}
      {!showMeaning ? (
        <TouchableOpacity style={styles.revealBtn} onPress={onReveal}>
          <Ionicons name="eye" size={18} color={COLORS.accent} />
          <Text style={styles.revealBtnText}>Anlamı Keşfet</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.meaningReveal}>
          <Text style={styles.meaningRevealLabel}>Anlam:</Text>
          <Text style={styles.meaningRevealText}>{word.translation}</Text>
          {word.hint && (
            <View style={styles.hintRow}>
              <Text style={styles.hintIcon}>💡</Text>
              <Text style={styles.hintText}>{word.hint}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────
   STAGE 2 — SENSAZIONE
   5 Duyu + AI görsel + Unsplash fotoğraf
───────────────────────────────────────── */
function SensazioneStage({
  word,
  imageUri,
  imageLoading,
  imageError,
  aiPrompt,
  aiLoading,
  onReload,
  onGenerateAI,
}) {
  const senses = [
    {
      icon: "👁️",
      label: "Görme",
      prompt: `"${word.word}" nasıl görünür? Rengini, şeklini hayal et.`,
    },
    {
      icon: "👂",
      label: "İşitme",
      prompt: `Bu kelime hangi sesi çağrıştırıyor?`,
    },
    {
      icon: "✋",
      label: "Dokunma",
      prompt: `Bu kavramın dokusu nasıl olurdu? Sert mi, yumuşak mı?`,
    },
    {
      icon: "👃",
      label: "Koku",
      prompt: `Bu kelime hangi kokuyu anlatıyor veya hatırlatıyor?`,
    },
    { icon: "👅", label: "Tat", prompt: `Bu kelime hangi tadı çağrıştırıyor?` },
  ];

  return (
    <View style={styles.stageContent}>
      {/* Görsel alan */}
      <View style={styles.imageContainer}>
        {imageLoading ? (
          <View style={styles.imagePlaceholder}>
            <ActivityIndicator color={COLORS.accent} size="large" />
            <Text style={styles.imageLoadingText}>Görsel yükleniyor...</Text>
          </View>
        ) : imageUri && !imageError ? (
          <View>
            <Image
              source={{ uri: imageUri }}
              style={styles.wordImage}
              resizeMode="cover"
              onError={() => {}}
            />
            <TouchableOpacity style={styles.reloadImageBtn} onPress={onReload}>
              <Ionicons name="refresh" size={14} color={COLORS.textMuted} />
              <Text style={styles.reloadImageText}>Yeni görsel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.imagePlaceholderIcon}>🖼️</Text>
            <Text style={styles.imagePlaceholderText}>Görsel bulunamadı</Text>
            <TouchableOpacity style={styles.reloadImageBtn} onPress={onReload}>
              <Text style={styles.reloadImageText}>Tekrar dene</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* AI duyusal prompt butonu */}
      {!aiPrompt ? (
        <TouchableOpacity
          style={styles.aiPromptBtn}
          onPress={onGenerateAI}
          disabled={aiLoading}
        >
          <LinearGradient
            colors={["#A29BFE", "#6C63FF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.aiPromptGradient}
          >
            {aiLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="sparkles" size={16} color="#fff" />
            )}
            <Text style={styles.aiPromptBtnText}>
              {aiLoading ? "Üretiliyor..." : "AI Duyusal Sahne Üret ✨"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <View style={styles.aiPromptBox}>
          <Text style={styles.aiPromptLabel}>✨ Da Vinci'nin Gözünden:</Text>
          <Text style={styles.aiPromptText}>{aiPrompt}</Text>
        </View>
      )}

      {/* 5 Duyu listesi */}
      <Text style={styles.sensesTitle}>Beş Duyunla Keşfet:</Text>
      <View style={styles.sensesList}>
        {senses.map((s, i) => (
          <View key={i} style={styles.senseRow}>
            <Text style={styles.senseIcon}>{s.icon}</Text>
            <View style={styles.senseInfo}>
              <Text style={styles.senseLabel}>{s.label}</Text>
              <Text style={styles.sensePrompt}>{s.prompt}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.transSmall}>{word.translation}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────
   STAGE 3 — DIMOSTRAZIONE
   Deneyerek öğren: Kendi cümleni kur
───────────────────────────────────────── */
function DimostrazioneStage({
  word,
  sentence,
  onChangeSentence,
  checked,
  onCheck,
}) {
  return (
    <View style={styles.stageContent}>
      {/* Örnek cümle */}
      <View style={styles.exampleBox}>
        <Text style={styles.exampleLabel}>📖 Da Vinci'nin Örneği:</Text>
        <Text style={styles.exampleText}>{word.example}</Text>
        <Text style={styles.exampleTr}>{word.exampleTr}</Text>
      </View>

      {/* Kullanıcı cümlesi */}
      <Text style={styles.dimoLabel}>Şimdi sen yaz — kendi deneyiminle:</Text>
      <TextInput
        style={[styles.sentenceInput, checked && styles.sentenceInputDone]}
        value={sentence}
        onChangeText={onChangeSentence}
        placeholder={`"${word.word}" kelimesini kullanarak bir cümle kur...`}
        placeholderTextColor={COLORS.textMuted}
        multiline
        numberOfLines={3}
        editable={!checked}
      />

      {!checked ? (
        <TouchableOpacity
          style={[
            styles.checkBtn,
            sentence.trim().length < 5 && { opacity: 0.4 },
          ]}
          onPress={() => sentence.trim().length >= 5 && onCheck()}
          disabled={sentence.trim().length < 5}
        >
          <Ionicons name="checkmark-circle" size={18} color="#fff" />
          <Text style={styles.checkBtnText}>Cümleyi Onayla</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.checkedBox}>
          <Ionicons name="checkmark-circle" size={22} color={COLORS.success} />
          <Text style={styles.checkedText}>
            Harika! Deneyimleyerek öğrendin.
          </Text>
        </View>
      )}

      {/* Hafıza ipucu */}
      {word.memoryTip && (
        <View style={styles.memoryBox}>
          <Text style={styles.memoryLabel}>🧠 Hafıza İpucu:</Text>
          <Text style={styles.memoryText}>{word.memoryTip}</Text>
        </View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────
   STAGE 4 — CONNESSIONE
   Bağlantı: 2 kelimeyle bağ kur + 3x sesli tekrar
───────────────────────────────────────── */
function ConnessioneStage({
  word,
  connections,
  onChangeConnection,
  repeatCount,
  onRepeat,
  done,
}) {
  const TARGET = 3;

  return (
    <View style={styles.stageContent}>
      {/* Bağlantı noktaları */}
      <Text style={styles.connLabel}>Bu kelimeyi 2 kavramla bağla:</Text>
      <View style={styles.connMindMap}>
        {/* Merkez kelime */}
        <View style={styles.connCenter}>
          <Text style={styles.connCenterText}>{word.word}</Text>
          <Text style={styles.connCenterTr}>{word.translation}</Text>
        </View>
        {/* Bağlantı çizgileri görsel */}
        <View style={styles.connLines}>
          {connections.map((conn, i) => (
            <View key={i} style={styles.connNodeRow}>
              <View
                style={[
                  styles.connLine,
                  {
                    backgroundColor: i === 0 ? COLORS.secondary : COLORS.accent,
                  },
                ]}
              />
              <TextInput
                style={[
                  styles.connInput,
                  conn.trim().length > 1 && styles.connInputFilled,
                ]}
                value={conn}
                onChangeText={(v) => onChangeConnection(i, v)}
                placeholder={
                  i === 0 ? "Bir kavram (örn: mutluluk)" : "Başka bir kavram"
                }
                placeholderTextColor={COLORS.textMuted}
              />
            </View>
          ))}
        </View>
      </View>

      {done && (
        <View style={styles.connDoneBox}>
          <Text style={styles.connDoneText}>
            🕸️ Bağlantılar kuruldu! Kelime ağına girdi.
          </Text>
        </View>
      )}

      {/* Sesli tekrar */}
      <View style={styles.repeatSection}>
        <Text style={styles.repeatTitle}>
          Şimdi yüksek sesle {TARGET} kez tekrar et:
        </Text>
        <View style={styles.repeatBig}>
          <Text style={styles.repeatWordBig}>{word.word}</Text>
          <Text style={styles.repeatTransBig}>{word.translation}</Text>
        </View>
        <View style={styles.repeatDots}>
          {Array.from({ length: TARGET }).map((_, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.repeatDot,
                i < repeatCount && {
                  backgroundColor: COLORS.success,
                  borderColor: COLORS.success,
                },
              ]}
              onPress={() => onRepeat(Math.min(i + 1, TARGET))}
            >
              {i < repeatCount ? (
                <Ionicons name="checkmark" size={20} color="#fff" />
              ) : (
                <Text style={styles.repeatDotNum}>{i + 1}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
        {repeatCount >= TARGET && (
          <View style={styles.repeatDoneBox}>
            <Text style={styles.repeatDoneText}>🎉 Kaslarını kullandın!</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────
   STAGE 5 — ARTE/SCIENZA
   Sol beyin (analitik quiz) + Sağ beyin (görsel bağ)
───────────────────────────────────────── */
function ArteScienzaStage({ word, quizOptions, quizAnswer, onAnswer }) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const [countdown, setCountdown] = useState(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    if (!quizAnswer) {
      progressAnim.setValue(0);
      feedbackOpacity.setValue(0);
      setCountdown(null);
      clearInterval(countdownRef.current);
      return;
    }
    Animated.timing(feedbackOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    if (quizAnswer.isCorrect) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 1100,
        useNativeDriver: false,
      }).start();
      setCountdown(1);
      countdownRef.current = setInterval(() => {
        setCountdown((p) => {
          if (p <= 0) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return p - 1;
        });
      }, 600);
    } else {
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
    return () => clearInterval(countdownRef.current);
  }, [quizAnswer]);

  return (
    <View style={styles.stageContent}>
      {/* Sol beyin — analitik quiz */}
      <View style={styles.arteScienzaHeader}>
        <View style={styles.brainBadge}>
          <Text style={styles.brainIcon}>🧠</Text>
          <Text style={styles.brainLabel}>Analitik</Text>
        </View>
        <Text style={styles.quizQuestion}>Bu kelimenin anlamı nedir?</Text>
        <View style={styles.brainBadge}>
          <Text style={styles.brainIcon}>🎨</Text>
          <Text style={styles.brainLabel}>Sezgisel</Text>
        </View>
      </View>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
        <View style={styles.quizOptions}>
          {quizOptions.map((option, i) => {
            let bg = COLORS.backgroundCardLight,
              border = COLORS.border,
              color = COLORS.textPrimary;
            if (quizAnswer) {
              if (option.isCorrect) {
                bg = COLORS.successGlow;
                border = COLORS.success;
                color = COLORS.success;
              } else if (quizAnswer === option) {
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
                onPress={() => onAnswer(option)}
                disabled={!!quizAnswer}
                activeOpacity={0.85}
              >
                <Text style={[styles.quizOptionText, { color }]}>
                  {option.word.translation}
                </Text>
                {quizAnswer && option.isCorrect && (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={COLORS.success}
                  />
                )}
                {quizAnswer === option && !option.isCorrect && (
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

      {/* Feedback */}
      {quizAnswer && (
        <Animated.View
          style={[
            styles.feedbackBox,
            {
              opacity: feedbackOpacity,
              borderColor: quizAnswer.isCorrect ? COLORS.success : COLORS.error,
              backgroundColor: quizAnswer.isCorrect
                ? COLORS.successGlow
                : COLORS.errorGlow,
            },
          ]}
        >
          {quizAnswer.isCorrect ? (
            <View style={styles.feedbackInner}>
              <View style={styles.feedbackRow}>
                <Text style={styles.feedbackCorrect}>✅ Doğru!</Text>
                <View style={styles.countdownBadge}>
                  <Text style={styles.countdownText}>{countdown}s</Text>
                </View>
              </View>
              <View style={styles.feedbackProgressBg}>
                <Animated.View
                  style={[
                    styles.feedbackProgressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              </View>
              <Text style={styles.feedbackSub}>
                Sonraki kelimeye geçiliyor...
              </Text>
            </View>
          ) : (
            <View style={styles.feedbackInner}>
              <Text style={styles.feedbackWrong}>❌ Yanlış!</Text>
              <Text style={styles.feedbackAnswer}>
                Doğru cevap:{" "}
                <Text style={{ fontWeight: "800" }}>{word.translation}</Text>
              </Text>
            </View>
          )}
        </Animated.View>
      )}
    </View>
  );
}

/* ─────────────────────────────────────────
   OTURUM TAMAMLANDI
───────────────────────────────────────── */
function SessionComplete({ results, words, onExit }) {
  const correct = results.filter((r) => r.wasCorrect).length;
  const total = results.length || 1;
  const score = Math.round((correct / total) * 100);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();
  }, []);

  const emoji = score >= 80 ? "🏆" : score >= 60 ? "⭐" : "📚";
  const message =
    score >= 80
      ? "🎨 Mükemmel! Beş Da Vinci prensibini tam uyguladın!"
      : score >= 60
      ? "⚗️ İyi iş! Dimostrazione ruhuyla devam et."
      : "🔍 Merakını canlı tut! Her hata yeni bir keşif.";

  return (
    <SafeAreaView style={styles.completeContainer}>
      <Animated.View style={[styles.completeContent, { opacity: fadeAnim }]}>
        <Text style={styles.completeEmoji}>{emoji}</Text>
        <Text style={styles.completeTitle}>Oturum Tamamlandı!</Text>

        <View style={styles.scoreCircle}>
          <Text style={styles.scoreNum}>{score}</Text>
          <Text style={styles.scorePercent}>%</Text>
        </View>

        <Text style={styles.completeSubtitle}>
          {correct}/{total} doğru cevap
        </Text>

        <View style={styles.completeStats}>
          <View style={styles.completeStat}>
            <Text style={styles.completeStatVal}>{words.length}</Text>
            <Text style={styles.completeStatLbl}>Kelime</Text>
          </View>
          <View style={styles.completeStatDivider} />
          <View style={styles.completeStat}>
            <Text style={[styles.completeStatVal, { color: COLORS.success }]}>
              {correct}
            </Text>
            <Text style={styles.completeStatLbl}>Doğru</Text>
          </View>
          <View style={styles.completeStatDivider} />
          <View style={styles.completeStat}>
            <Text style={[styles.completeStatVal, { color: COLORS.error }]}>
              {total - correct}
            </Text>
            <Text style={styles.completeStatLbl}>Yanlış</Text>
          </View>
        </View>

        {/* Da Vinci prensipler özeti */}
        <View style={styles.principlesSummary}>
          <Text style={styles.principlesSummaryTitle}>
            Bugün uyguladıkların:
          </Text>
          {Object.values(DAVINCI_STAGES).map((s) => (
            <View key={s.id} style={styles.principleSummaryRow}>
              <Text style={styles.principleSummaryIcon}>{s.icon}</Text>
              <Text style={[styles.principleSummaryName, { color: s.color }]}>
                {s.name}
              </Text>
              <Text style={styles.principleSummaryDesc}>{s.turkishName}</Text>
            </View>
          ))}
        </View>

        <View style={styles.completeMessageBox}>
          <Text style={styles.completeMessage}>{message}</Text>
        </View>

        <TouchableOpacity
          style={styles.completeBtn}
          onPress={onExit}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentDark]}
            style={styles.completeBtnGradient}
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
  backBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
  },
  backBtnText: { color: "#fff", fontWeight: "700" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  exitBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wordCounter: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  stageDots: { flexDirection: "row", gap: 4, alignItems: "center" },
  stageDot: { height: 6, borderRadius: 3 },

  // Progress
  progressBg: {
    height: 3,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.lg,
    borderRadius: 2,
  },
  progressFill: { height: 3, borderRadius: 2 },

  // Stage badge
  stageBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  stageBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  stageBadgeIcon: { fontSize: 18 },
  stageBadgeName: { fontSize: FONT_SIZES.sm, fontWeight: "800" },
  stageBadgeLatin: {
    fontSize: 10,
    color: COLORS.textMuted,
    fontStyle: "italic",
  },
  timerText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontVariant: ["tabular-nums"],
  },

  // Card
  content: { paddingHorizontal: SPACING.lg, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.card,
  },
  wordHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  speakBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.secondaryGlow || "rgba(79,172,254,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  wordMain: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.display,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -1,
  },
  phonetic: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    fontStyle: "italic",
  },

  stageContent: { gap: SPACING.md },

  // ── Curiosità ──
  curiosityQuestions: { gap: SPACING.sm },
  curiosityQ: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  curiosityQNum: {
    color: COLORS.accent,
    fontWeight: "800",
    fontSize: FONT_SIZES.sm,
    width: 18,
  },
  curiosityQText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    flex: 1,
    lineHeight: 20,
  },
  curiosityInput: {
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 60,
    textAlignVertical: "top",
  },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  revealBtnText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.lg,
  },
  meaningReveal: {
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  meaningRevealLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  meaningRevealText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  hintRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "flex-start" },
  hintIcon: { fontSize: 16 },
  hintText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    flex: 1,
    lineHeight: 20,
  },

  // ── Sensazione ──
  imageContainer: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    backgroundColor: COLORS.backgroundCardLight,
  },
  wordImage: { width: "100%", height: 180, borderRadius: RADIUS.lg },
  imagePlaceholder: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  imagePlaceholderIcon: { fontSize: 36 },
  imagePlaceholderText: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  imageLoadingText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginTop: SPACING.sm,
  },
  reloadImageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: SPACING.sm,
  },
  reloadImageText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  aiPromptBtn: { borderRadius: RADIUS.lg, overflow: "hidden" },
  aiPromptGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  aiPromptBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
  aiPromptBox: {
    backgroundColor: "rgba(162,155,254,0.12)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: "rgba(162,155,254,0.3)",
  },
  aiPromptLabel: {
    color: "#A29BFE",
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
  },
  aiPromptText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
    fontStyle: "italic",
  },
  sensesTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    marginTop: SPACING.sm,
  },
  sensesList: { gap: SPACING.sm },
  senseRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  senseIcon: { fontSize: 20, marginTop: 2 },
  senseInfo: { flex: 1 },
  senseLabel: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
  },
  sensePrompt: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
    lineHeight: 18,
  },
  transSmall: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    textAlign: "center",
  },

  // ── Dimostrazione ──
  exampleBox: {
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  exampleLabel: {
    color: COLORS.secondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
  },
  exampleText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontStyle: "italic",
    lineHeight: 22,
  },
  exampleTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  dimoLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  sentenceInput: {
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    textAlignVertical: "top",
  },
  sentenceInputDone: {
    borderColor: COLORS.success,
    backgroundColor: COLORS.successGlow,
  },
  checkBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.secondary,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
  },
  checkBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  checkedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.successGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  checkedText: { color: COLORS.success, fontWeight: "600", flex: 1 },
  memoryBox: {
    backgroundColor: "rgba(162,155,254,0.1)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderLeftWidth: 3,
    borderLeftColor: "#A29BFE",
  },
  memoryLabel: { color: "#A29BFE", fontSize: FONT_SIZES.xs, fontWeight: "700" },
  memoryText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },

  // ── Connessione ──
  connLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  connMindMap: { gap: SPACING.md },
  connCenter: {
    alignItems: "center",
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
  },
  connCenterText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
  },
  connCenterTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  connLines: { gap: SPACING.sm },
  connNodeRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  connLine: { width: 24, height: 2, borderRadius: 1 },
  connInput: {
    flex: 1,
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  connInputFilled: { borderColor: COLORS.success },
  connDoneBox: {
    backgroundColor: COLORS.secondaryGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.secondary + "40",
  },
  connDoneText: {
    color: COLORS.secondary,
    fontWeight: "600",
    textAlign: "center",
  },
  repeatSection: {
    gap: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  repeatTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    textAlign: "center",
  },
  repeatBig: { alignItems: "center", gap: 4 },
  repeatWordBig: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: "800",
  },
  repeatTransBig: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
  },
  repeatDots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.lg,
  },
  repeatDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundCardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatDotNum: {
    color: COLORS.textSecondary,
    fontWeight: "700",
    fontSize: FONT_SIZES.lg,
  },
  repeatDoneBox: {
    backgroundColor: COLORS.successGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
  },
  repeatDoneText: { color: COLORS.success, fontWeight: "600" },

  // ── Arte/Scienza ──
  arteScienzaHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brainBadge: { alignItems: "center", gap: 2 },
  brainIcon: { fontSize: 22 },
  brainLabel: { color: COLORS.textMuted, fontSize: 10, fontWeight: "600" },
  quizQuestion: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
    flex: 1,
  },
  quizOptions: { gap: SPACING.sm },
  quizOption: {
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  quizOptionText: { fontSize: FONT_SIZES.md, fontWeight: "600", flex: 1 },
  feedbackBox: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    padding: SPACING.md,
    overflow: "hidden",
  },
  feedbackInner: { gap: SPACING.sm },
  feedbackRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  feedbackCorrect: {
    color: COLORS.success,
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
  },
  feedbackWrong: {
    color: COLORS.error,
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
  },
  feedbackAnswer: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  feedbackSub: { color: COLORS.success, fontSize: FONT_SIZES.xs, opacity: 0.8 },
  feedbackProgressBg: {
    height: 6,
    backgroundColor: "rgba(76,175,80,0.2)",
    borderRadius: 3,
    overflow: "hidden",
  },
  feedbackProgressFill: {
    height: 6,
    backgroundColor: COLORS.success,
    borderRadius: 3,
  },
  countdownBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: { color: "#fff", fontWeight: "800", fontSize: FONT_SIZES.sm },

  // Principle box
  principleBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  principleTitle: { fontSize: FONT_SIZES.sm, fontWeight: "700" },
  principleQuote: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
    lineHeight: 18,
  },

  // Next button
  bottomArea: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.background,
  },
  nextBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  nextBtnText: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "700" },

  // Session complete
  completeContainer: { flex: 1, backgroundColor: COLORS.background },
  completeContent: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  completeEmoji: { fontSize: 64, marginBottom: SPACING.sm },
  completeTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
    marginBottom: SPACING.md,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.accentGlow,
    flexDirection: "row",
    marginBottom: SPACING.sm,
  },
  scoreNum: {
    color: COLORS.accent,
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 56,
  },
  scorePercent: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    alignSelf: "flex-end",
    paddingBottom: 8,
  },
  completeSubtitle: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    marginBottom: SPACING.xl,
  },
  completeStats: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.xl,
  },
  completeStat: { alignItems: "center", paddingHorizontal: SPACING.xl, gap: 4 },
  completeStatDivider: { width: 1, height: 40, backgroundColor: COLORS.border },
  completeStatVal: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  completeStatLbl: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  principlesSummary: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    width: "100%",
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  principlesSummaryTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },
  principleSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
  },
  principleSummaryIcon: { fontSize: 18 },
  principleSummaryName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
    width: 100,
  },
  principleSummaryDesc: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    flex: 1,
  },
  completeMessageBox: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: "100%",
  },
  completeMessage: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
    textAlign: "center",
  },
  completeBtn: {
    width: "100%",
    borderRadius: RADIUS.full,
    overflow: "hidden",
    ...SHADOWS.accent,
  },
  completeBtnGradient: { paddingVertical: SPACING.md, alignItems: "center" },
  completeBtnText: {
    color: "#fff",
    fontSize: FONT_SIZES.lg,
    fontWeight: "800",
  },
});
