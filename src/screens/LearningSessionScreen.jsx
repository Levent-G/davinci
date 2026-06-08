// LearningSessionScreen — 5 aşama, PreScan modunda goBack
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import {
  generateQuizOptions,
  calcNextReview,
  WORD_STATUS,
} from "../utils/davinciAlgorithm";
import { useApp } from "../context/AppContext";
import { speakWord } from "../utils/textToSpeech";
import { setWordCompleted } from "../utils/sessionBridge";
import { scheduleReviewNotifications } from "../utils/notifications";

const { width } = Dimensions.get("window");
const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

const STAGE_CONFIG = [
  { id: 1, name: "Merak", icon: "🔍", color: "#F5A623" },
  { id: 2, name: "Duyular", icon: "✨", color: "#A29BFE" },
  { id: 3, name: "Yaz", icon: "⚗️", color: "#4ECDC4" },
  { id: 4, name: "Bağla", icon: "🕸️", color: "#81C784" },
  { id: 5, name: "Test", icon: "⚖️", color: "#E17055" },
];

export default function LearningSessionScreen({ navigation, route }) {
  const { words = [], mode = "learn" } = route.params || {};
  const { state, actions } = useApp();
  const allWords = actions.getAllWords();

  // PreScan'dan mı geldi? (tek kelime)
  const isPreScan = words.length === 1;

  const [wordIndex, setWordIndex] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [done, setDone] = useState(false);

  // Aşama state
  const [showMeaning, setShowMeaning] = useState(false);
  const [userSentence, setUserSentence] = useState("");
  const [sentenceChecked, setSentenceChecked] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizOptions, setQuizOptions] = useState([]);
  const [imageUri, setImageUri] = useState(null);
  const [aiScene, setAiScene] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const currentWord = words[wordIndex];
  const stage = STAGE_CONFIG[stageIndex];

  useEffect(() => {
    if (!currentWord) return;
    resetStage();
    if (stageIndex === 1) loadImage(currentWord.word);
    if (stageIndex === 4)
      setQuizOptions(generateQuizOptions(currentWord, allWords, 4));
  }, [wordIndex, stageIndex]);

  const resetStage = () => {
    setShowMeaning(false);
    setUserSentence("");
    setSentenceChecked(false);
    setRepeatCount(0);
    setQuizAnswer(null);
    setAiScene(null);
    setImageUri(null);
  };

  const loadImage = async (word) => {
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          word
        )}&per_page=3`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await res.json();
      if (data.photos?.length > 0) setImageUri(data.photos[0].src.medium);
    } catch {}
  };

  const loadAiScene = async () => {
    if (aiScene || aiLoading || !currentWord) return;
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
              content: `"${currentWord.word}" kelimesi için tek cümlelik Türkçe duyusal sahne yaz.`,
            },
          ],
        }),
      });
      const data = await res.json();
      setAiScene(data.content?.[0]?.text || null);
    } catch {}
    setAiLoading(false);
  };

  const goNext = async () => {
    if (stageIndex < 4) {
      // Sonraki aşama
      setStageIndex(stageIndex + 1);
    } else if (wordIndex < words.length - 1) {
      // Sonraki kelime
      setWordIndex(wordIndex + 1);
      setStageIndex(0);
    } else {
      // Kelime tamamlandı — progress güncelle
      if (currentWord) {
        const prog = state.wordProgress[currentWord.id] || {};
        const newProg = calcNextReview(
          {
            ...prog,
            status: WORD_STATUS.LEARNING,
            startedAt: prog.startedAt || new Date().toISOString(),
          },
          true
        );
        try {
          await actions.updateWordProgress(currentWord.id, {
            ...prog,
            ...newProg,
            startedAt: prog.startedAt || new Date().toISOString(),
          });
        } catch {}
      }

      // Tüm kelimeler bitti
      if (isPreScan) {
        try {
          await actions.recordWordLearned?.();
        } catch {}
        setWordCompleted();
        // Bugün kaç kelime tamamlandı kontrol et
        const todayStr = new Date().toDateString();
        const completedToday =
          actions.getAllWords().filter((w) => {
            const p = state.wordProgress[w.id];
            if (!p) return false;
            if (p.status === "known") return false;
            if (!["review_1", "review_2", "learned"].includes(p.status || ""))
              return false;
            return (
              p.startedAt && new Date(p.startedAt).toDateString() === todayStr
            );
          }).length + 1; // +1 çünkü bu kelime henüz dispatch edilmedi
        if (completedToday >= 5) {
          navigation.navigate("MainTabs", { screen: "Learn" });
        } else {
          navigation.goBack();
        }
      } else {
        // Normal mod — tamamlandı ekranı
        try {
          await actions.recordSessionComplete(words.length);
        } catch {}
        try {
          await scheduleReviewNotifications(words.length);
        } catch {}
        setDone(true);
      }
    }
  };

  const handleQuizAnswer = (opt) => {
    if (quizAnswer) return;
    setQuizAnswer(opt);
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
    setTimeout(() => goNext(), 1300);
  };

  const handleExit = () => {
    Alert.alert("Çıkış", "Aşamadan çıkmak istediğine emin misin?", [
      { text: "İptal", style: "cancel" },
      { text: "Çık", style: "destructive", onPress: () => navigation.goBack() },
    ]);
  };

  // Tamamlandı ekranı (sadece normal mod)
  if (done) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.doneBox}>
          <Text style={s.doneEmoji}>🏆</Text>
          <Text style={s.doneTitle}>Tebrikler!</Text>
          <Text style={s.doneSub}>{words.length} kelimeyi öğrendin.</Text>
          <TouchableOpacity
            style={s.doneBtn}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.doneBtnText}>Tamam →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentWord) return null;

  const isLocked =
    (stageIndex === 0 && !showMeaning) ||
    (stageIndex === 2 && !sentenceChecked) ||
    (stageIndex === 3 && repeatCount < 3) ||
    stageIndex === 4;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleExit} style={s.closeBtn}>
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={s.stagePills}>
          {STAGE_CONFIG.map((st, i) => (
            <View
              key={st.id}
              style={[
                s.pill,
                i < stageIndex && {
                  backgroundColor: st.color + "80",
                  width: 16,
                },
                i === stageIndex && { backgroundColor: st.color, width: 28 },
                i > stageIndex && { backgroundColor: COLORS.border, width: 8 },
              ]}
            />
          ))}
        </View>
        <Text style={s.counter}>
          {wordIndex + 1}/{words.length}
        </Text>
      </View>

      {/* Stage header */}
      <View style={[s.stageHeader, { backgroundColor: stage.color + "15" }]}>
        <Text style={s.stageIcon}>{stage.icon}</Text>
        <Text style={[s.stageName, { color: stage.color }]}>
          Aşama {stage.id} — {stage.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Kelime kartı */}
        <View style={s.wordCard}>
          <View style={s.wordRow}>
            <Text style={s.wordText}>{currentWord.word}</Text>
            <TouchableOpacity
              onPress={() => speakWord(currentWord.word)}
              style={s.speakBtn}
            >
              <Ionicons
                name="volume-high-outline"
                size={22}
                color={stage.color}
              />
            </TouchableOpacity>
          </View>
          {showMeaning && (
            <View style={s.meaningBox}>
              <Text style={[s.meaningText, { color: stage.color }]}>
                {currentWord.translation}
              </Text>
              <Text style={s.exampleText}>"{currentWord.example}"</Text>
            </View>
          )}
        </View>

        {/* AŞAMA 1 — MERAK */}
        {stageIndex === 0 && (
          <View style={s.content}>
            {currentWord.example && (
              <View style={[s.exampleBox, { borderLeftColor: stage.color }]}>
                <Text style={[s.exampleLabel, { color: stage.color }]}>
                  📖 Örnek:
                </Text>
                <Text style={s.exampleBoxText}>{currentWord.example}</Text>
                {currentWord.exampleTr && (
                  <Text style={s.exampleBoxTr}>{currentWord.exampleTr}</Text>
                )}
              </View>
            )}
            {!showMeaning ? (
              <TouchableOpacity
                style={[s.revealBtn, { borderColor: stage.color }]}
                onPress={() => setShowMeaning(true)}
              >
                <Ionicons name="eye-outline" size={20} color={stage.color} />
                <Text style={[s.revealText, { color: stage.color }]}>
                  Anlamı Gör
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  s.revealedBox,
                  {
                    backgroundColor: stage.color + "12",
                    borderColor: stage.color + "40",
                  },
                ]}
              >
                <Text style={[s.revealedMeaning, { color: stage.color }]}>
                  {currentWord.translation}
                </Text>
                <Text style={s.revealedHint}>Anlamı gördün — devam et</Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA 2 — DUYULAR */}
        {stageIndex === 1 && (
          <View style={s.content}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={s.image}
                resizeMode="cover"
              />
            ) : (
              <View style={s.imagePlaceholder}>
                <ActivityIndicator size="small" color={stage.color} />
              </View>
            )}
            {!aiScene ? (
              <TouchableOpacity
                style={[s.aiBtn, { borderColor: stage.color + "60" }]}
                onPress={loadAiScene}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={stage.color} />
                ) : (
                  <Ionicons name="sparkles" size={16} color={stage.color} />
                )}
                <Text style={[s.aiBtnText, { color: stage.color }]}>
                  {aiLoading ? "Yükleniyor..." : "Duyusal sahne üret"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[s.aiScene, { borderLeftColor: stage.color }]}>
                <Text style={s.aiSceneText}>{aiScene}</Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA 3 — YAZ */}
        {stageIndex === 2 &&
          (() => {
            const hasMin = userSentence.trim().length >= 3;
            const hasWord = userSentence
              .toLowerCase()
              .includes(currentWord.word.toLowerCase());
            const status = !hasMin ? "short" : hasWord ? "ok" : "noword";
            return (
              <View style={s.content}>
                {currentWord.example && (
                  <View
                    style={[s.exampleBox, { borderLeftColor: stage.color }]}
                  >
                    <Text style={[s.exampleLabel, { color: stage.color }]}>
                      📖 Örnek:
                    </Text>
                    <Text style={s.exampleBoxText}>{currentWord.example}</Text>
                  </View>
                )}
                <Text style={s.writeLabel}>
                  "{currentWord.word}" kelimesiyle bir şey yaz:
                </Text>
                <TextInput
                  style={[
                    s.input,
                    !sentenceChecked &&
                      status === "ok" && { borderColor: COLORS.success },
                    !sentenceChecked &&
                      status === "noword" && { borderColor: "#F9CA24" },
                    sentenceChecked && { borderColor: COLORS.success },
                  ]}
                  value={userSentence}
                  onChangeText={setUserSentence}
                  placeholder={`"${currentWord.word}" kelimesini kullan...`}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  editable={!sentenceChecked}
                />
                {!sentenceChecked && userSentence.length > 0 && (
                  <View style={s.feedbackRow}>
                    {status === "ok" && (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={COLORS.success}
                        />
                        <Text
                          style={[s.feedbackText, { color: COLORS.success }]}
                        >
                          Kelimeyi kullandın!
                        </Text>
                      </>
                    )}
                    {status === "noword" && (
                      <>
                        <Ionicons
                          name="warning-outline"
                          size={16}
                          color="#F9CA24"
                        />
                        <Text style={[s.feedbackText, { color: "#F9CA24" }]}>
                          "{currentWord.word}" ekle!
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
                          style={[s.feedbackText, { color: COLORS.textMuted }]}
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
                      s.confirmBtn,
                      { backgroundColor: stage.color },
                      !hasMin && { opacity: 0.4 },
                    ]}
                    onPress={() => hasMin && setSentenceChecked(true)}
                    disabled={!hasMin}
                  >
                    <Text style={s.confirmBtnText}>
                      {status === "ok"
                        ? "Harika, devam et →"
                        : "Yine de devam et →"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.checkedRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.success}
                    />
                    <Text style={s.checkedText}>
                      {hasWord ? "Mükemmel!" : "Kaydedildi."}
                    </Text>
                  </View>
                )}
              </View>
            );
          })()}

        {/* AŞAMA 4 — BAĞLA */}
        {stageIndex === 3 && (
          <View style={s.content}>
            <Text style={s.connectLabel}>Kelimeyi 3 kez sesli söyle:</Text>
            <View style={s.bigWordBox}>
              <Text style={[s.bigWord, { color: stage.color }]}>
                {currentWord.word}
              </Text>
              <Text style={s.bigWordTr}>{currentWord.translation}</Text>
            </View>
            <View style={s.dots}>
              {[0, 1, 2].map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.dot,
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
                      setRepeatCount((r) => r + 1);
                    }
                  }}
                  disabled={i !== repeatCount || repeatCount >= 3}
                >
                  {i < repeatCount ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : (
                    <Text
                      style={[
                        s.dotNum,
                        {
                          color:
                            i === repeatCount ? stage.color : COLORS.textMuted,
                        },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {repeatCount >= 3 && (
              <View
                style={[
                  s.tapDone,
                  {
                    backgroundColor: stage.color + "20",
                    borderColor: stage.color + "40",
                  },
                ]}
              >
                <Text style={[s.tapDoneText, { color: stage.color }]}>
                  🎉 3 kez söyledin!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA 5 — TEST */}
        {stageIndex === 4 && (
          <View style={s.content}>
            <Text style={s.quizQ}>Bu kelimenin anlamı nedir?</Text>
            <Animated.View
              style={[s.options, { transform: [{ translateX: shakeAnim }] }]}
            >
              {quizOptions.map((opt, i) => {
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
                    onPress={() => handleQuizAnswer(opt)}
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
          </View>
        )}
      </ScrollView>

      {/* Alt buton (Aşama 5 hariç) */}
      {stageIndex !== 4 && (
        <View style={s.bottom}>
          <TouchableOpacity
            style={[
              s.nextBtn,
              { backgroundColor: isLocked ? COLORS.border : stage.color },
            ]}
            onPress={() => !isLocked && goNext()}
            disabled={isLocked}
          >
            <Text
              style={[s.nextBtnText, isLocked && { color: COLORS.textMuted }]}
            >
              {stageIndex === 0 && !showMeaning
                ? "Önce Anlamı Gör"
                : stageIndex === 2 && !sentenceChecked
                ? "Önce Onayla"
                : stageIndex === 3 && repeatCount < 3
                ? `${3 - repeatCount} tekrar kaldı`
                : wordIndex < words.length - 1 || stageIndex < 4
                ? "Sonraki →"
                : "Tamamla →"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  pill: { height: 6, borderRadius: 3 },
  counter: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  stageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  stageIcon: { fontSize: 18 },
  stageName: { fontSize: FONT_SIZES.sm, fontWeight: "800" },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  wordCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  wordText: {
    fontSize: 42,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -1,
    textAlign: "center",
  },
  speakBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  meaningBox: {
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
  content: { gap: SPACING.md },
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
  },
  exampleBoxTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
  },
  revealText: { fontSize: FONT_SIZES.lg, fontWeight: "700" },
  revealedBox: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
  },
  revealedMeaning: { fontSize: FONT_SIZES.xxl + 4, fontWeight: "900" },
  revealedHint: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  image: { width: "100%", height: 180, borderRadius: RADIUS.xl },
  imagePlaceholder: {
    height: 120,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: COLORS.backgroundCard,
  },
  aiBtnText: { fontWeight: "600", fontSize: FONT_SIZES.sm },
  aiScene: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 3,
  },
  aiSceneText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontStyle: "italic",
    lineHeight: 24,
  },
  writeLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  input: {
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
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  feedbackText: { fontSize: FONT_SIZES.sm, fontWeight: "600", flex: 1 },
  confirmBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: "center",
  },
  confirmBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(100,220,150,0.15)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  checkedText: { color: COLORS.success, fontWeight: "600" },
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
  dots: { flexDirection: "row", justifyContent: "center", gap: SPACING.xl },
  dot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  dotNum: { fontWeight: "800", fontSize: FONT_SIZES.lg },
  tapDone: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: "center",
  },
  tapDoneText: { fontWeight: "600", fontSize: FONT_SIZES.sm },
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
  bottom: {
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
  doneBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.lg,
  },
  doneEmoji: { fontSize: 64 },
  doneTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  doneSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  doneBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 40,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.full,
  },
  doneBtnText: { color: "#fff", fontWeight: "800", fontSize: FONT_SIZES.lg },
});
