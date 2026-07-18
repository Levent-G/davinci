import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { STATUS, quizOptions, afterLearning } from "../utils/davinciAlgorithm";
import { useApp } from "../context/AppContext";
import { speakWord } from "../utils/textToSpeech";
import { signal } from "../utils/sessionBridge";

const { width } = Dimensions.get("window");
const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

const STAGES = [
  { id: 0, name: "Merak", icon: "🔍", color: "#F5A623" },
  { id: 1, name: "Duyular", icon: "✨", color: "#A29BFE" },
  { id: 2, name: "Yaz", icon: "⚗️", color: "#4ECDC4" },
  { id: 3, name: "Bağla", icon: "🕸️", color: "#81C784" },
  { id: 4, name: "Test", icon: "⚖️", color: "#E17055" },
];

export default function LearningSessionScreen({ navigation, route }) {
  const { words = [], level = "A1" } = route.params || {};
  const { state, actions } = useApp();
  const allWords = actions.getAllWords();

  const word = words[0]; // PreScan'dan tek kelime gelir

  const [stage, setStage] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [userSentence, setUserSentence] = useState("");
  const [sentenceOk, setSentenceOk] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [quizOpts, setQuizOpts] = useState([]);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [imageUri, setImageUri] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [aiScene, setAiScene] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const stageRef = useRef(0);

  useEffect(() => {
    if (!word) return;
    if (stage === 1) loadImage(word.word);
    if (stage === 4) setQuizOpts(quizOptions(word, allWords));
  }, [stage]);

  const loadImage = async (w) => {
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

  const loadAiScene = async () => {
    if (aiScene || aiLoading) return;
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 150,
          messages: [
            {
              role: "user",
              content: `"${word.word}" kelimesi için tek cümlelik Türkçe duyusal sahne yaz.`,
            },
          ],
        }),
      });
      const data = await res.json();
      setAiScene(data.content?.[0]?.text || null);
    } catch {
    } finally {
      setAiLoading(false);
    }
  };

  const goNext = useCallback(async () => {
    const cur = stageRef.current;
    if (cur < 4) {
      stageRef.current = cur + 1;
      setStage(cur + 1);
      return;
    }
    // Aşama 5 (Test) bitti — kelimeyi kaydet
    if (word) {
      const prog = state.wordProgress[word.id] || {};
      const newProg = afterLearning({
        ...prog,
        startedAt: prog.startedAt || new Date().toISOString(),
      });
      try {
        await actions.updateWordProgress(word.id, newProg);
      } catch {}
    }
    signal(); // PreScan'a bildir
    navigation.goBack();
  }, [word, state.wordProgress]);

  const goNextRef = useRef(goNext);
  useEffect(() => {
    goNextRef.current = goNext;
  });

  const handleQuizAnswer = (opt) => {
    if (quizAnswer) return;
    setQuizAnswer(opt);
    if (!opt.correct) {
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
    setTimeout(() => goNextRef.current(), 1300);
  };

  const canGoNext =
    (stage === 0 && showMeaning) ||
    stage === 1 ||
    (stage === 2 && sentenceOk) ||
    (stage === 3 && repeatCount >= 3);

  const st = STAGES[stage];

  if (!word) return null;

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Çıkış", "Çıkmak istiyor musun?", [
              { text: "İptal", style: "cancel" },
              { text: "Çık", onPress: () => navigation.goBack() },
            ])
          }
          style={s.closeBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={s.pills}>
          {STAGES.map((st2, i) => (
            <View
              key={i}
              style={[
                s.pill,
                {
                  width: i < stage ? 16 : i === stage ? 28 : 8,
                  backgroundColor:
                    i < stage
                      ? st2.color + "80"
                      : i === stage
                      ? st2.color
                      : COLORS.border,
                },
              ]}
            />
          ))}
        </View>
        <Text style={s.stageLabel}>{stage + 1}/5</Text>
      </View>

      {/* Stage header */}
      <View style={[s.stageHeader, { backgroundColor: st.color + "15" }]}>
        <Text style={s.stageIcon}>{st.icon}</Text>
        <Text style={[s.stageName, { color: st.color }]}>
          Aşama {stage + 1} — {st.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Kelime kartı */}
        <View style={s.wordCard}>
          <View style={s.wordRow}>
            <Text style={s.wordText}>{word.word}</Text>
            <TouchableOpacity
              onPress={() => speakWord(word.word)}
              style={s.speakBtn}
            >
              <Ionicons name="volume-high-outline" size={22} color={st.color} />
            </TouchableOpacity>
          </View>
          {showMeaning && (
            <View style={s.meaningBox}>
              <Text style={[s.meaningText, { color: st.color }]}>
                {word.translation}
              </Text>
              {word.example ? (
                <Text style={s.exampleText}>"{word.example}"</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* AŞAMA 1 — MERAK */}
        {stage === 0 && (
          <View style={s.content}>
            {word.example && (
              <View style={[s.exBox, { borderLeftColor: st.color }]}>
                <Text style={[s.exLabel, { color: st.color }]}>
                  📖 Örnek cümle:
                </Text>
                <Text style={s.exText}>{word.example}</Text>
                {word.exampleTr && <Text style={s.exTr}>{word.exampleTr}</Text>}
              </View>
            )}
            {!showMeaning ? (
              <TouchableOpacity
                style={[s.revealBtn, { borderColor: st.color }]}
                onPress={() => setShowMeaning(true)}
              >
                <Ionicons name="eye-outline" size={20} color={st.color} />
                <Text style={[s.revealTxt, { color: st.color }]}>
                  Anlamı Gör
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  s.revealedBox,
                  {
                    backgroundColor: st.color + "12",
                    borderColor: st.color + "40",
                  },
                ]}
              >
                <Text style={[s.revealedMeaning, { color: st.color }]}>
                  {word.translation}
                </Text>
                <Text style={s.revealedHint}>Devam edebilirsin →</Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA 2 — DUYULAR */}
        {stage === 1 && (
          <View style={s.content}>
            {imageUri ? (
              <Image
                source={{ uri: imageUri }}
                style={s.image}
                resizeMode="cover"
              />
            ) : (
              <View style={s.imgPH}>
                {imgLoading ? (
                  <ActivityIndicator color={st.color} />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={40}
                    color={COLORS.textMuted}
                  />
                )}
              </View>
            )}
            {!aiScene ? (
              <TouchableOpacity
                style={[s.aiBtn, { borderColor: st.color + "60" }]}
                onPress={loadAiScene}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <ActivityIndicator size="small" color={st.color} />
                ) : (
                  <Ionicons name="sparkles" size={16} color={st.color} />
                )}
                <Text style={[s.aiBtnTxt, { color: st.color }]}>
                  {aiLoading ? "Yükleniyor..." : "Duyusal sahne üret"}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={[s.aiScene, { borderLeftColor: st.color }]}>
                <Text style={s.aiSceneTxt}>{aiScene}</Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA 3 — YAZ */}
        {stage === 2 &&
          (() => {
            const hasMin = userSentence.trim().length >= 3;
            const hasWord = userSentence
              .toLowerCase()
              .includes(word.word.toLowerCase());
            return (
              <View style={s.content}>
                <Text style={s.writeLabel}>
                  "{word.word}" kelimesiyle bir cümle yaz:
                </Text>
                <TextInput
                  style={[
                    s.input,
                    sentenceOk && { borderColor: COLORS.success },
                  ]}
                  value={userSentence}
                  onChangeText={setUserSentence}
                  placeholder={`"${word.word}" kelimesini kullan...`}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  editable={!sentenceOk}
                />
                {!sentenceOk && userSentence.length > 0 && (
                  <View style={s.feedbackRow}>
                    {hasWord ? (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={COLORS.success}
                        />
                        <Text
                          style={[s.feedbackTxt, { color: COLORS.success }]}
                        >
                          Kelimeyi kullandın!
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="warning-outline"
                          size={16}
                          color="#F9CA24"
                        />
                        <Text style={[s.feedbackTxt, { color: "#F9CA24" }]}>
                          "{word.word}" ekle!
                        </Text>
                      </>
                    )}
                  </View>
                )}
                {!sentenceOk ? (
                  <TouchableOpacity
                    style={[
                      s.confirmBtn,
                      { backgroundColor: st.color },
                      !hasMin && { opacity: 0.4 },
                    ]}
                    onPress={() => hasMin && setSentenceOk(true)}
                    disabled={!hasMin}
                  >
                    <Text style={s.confirmBtnTxt}>
                      {hasWord ? "Harika, devam →" : "Yine de devam →"}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.checkedRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.success}
                    />
                    <Text style={s.checkedTxt}>Kaydedildi!</Text>
                  </View>
                )}
              </View>
            );
          })()}

        {/* AŞAMA 4 — BAĞLA */}
        {stage === 3 && (
          <View style={s.content}>
            <Text style={s.connectLabel}>
              "{word.word}" kelimesini 3 kez sesli söyle:
            </Text>
            <View style={s.bigWordBox}>
              <Text style={[s.bigWord, { color: st.color }]}>{word.word}</Text>
              <Text style={s.bigWordTr}>{word.translation}</Text>
            </View>
            <View style={s.dots}>
              {[0, 1, 2].map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.dot,
                    i < repeatCount && {
                      backgroundColor: st.color,
                      borderColor: st.color,
                    },
                    i === repeatCount && {
                      borderColor: st.color,
                      borderWidth: 2.5,
                    },
                  ]}
                  onPress={() => {
                    if (i === repeatCount && repeatCount < 3) {
                      speakWord(word.word);
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
                            i === repeatCount ? st.color : COLORS.textMuted,
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
                    backgroundColor: st.color + "20",
                    borderColor: st.color + "40",
                  },
                ]}
              >
                <Text style={[s.tapDoneTxt, { color: st.color }]}>
                  🎉 3 kez söyledin!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA 5 — TEST */}
        {stage === 4 && (
          <View style={s.content}>
            <Text style={s.quizQ}>Bu kelimenin anlamı nedir?</Text>
            <Animated.View
              style={[s.options, { transform: [{ translateX: shakeAnim }] }]}
            >
              {quizOpts.map((opt, i) => {
                let bg = COLORS.backgroundCard,
                  border = COLORS.border,
                  color2 = COLORS.textPrimary;
                if (quizAnswer) {
                  if (opt.correct) {
                    bg = "rgba(100,220,150,0.15)";
                    border = COLORS.success;
                    color2 = COLORS.success;
                  } else if (quizAnswer === opt) {
                    bg = "rgba(255,100,100,0.15)";
                    border = COLORS.error;
                    color2 = COLORS.error;
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
                    <Text style={[s.optionTxt, { color: color2 }]}>
                      {opt.word.translation}
                    </Text>
                    {quizAnswer && opt.correct && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.success}
                      />
                    )}
                    {quizAnswer === opt && !opt.correct && (
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
      {stage !== 4 && (
        <View style={s.bottom}>
          <TouchableOpacity
            style={[
              s.nextBtn,
              { backgroundColor: canGoNext ? st.color : COLORS.border },
            ]}
            onPress={() => canGoNext && goNextRef.current()}
            disabled={!canGoNext}
          >
            <Text
              style={[s.nextBtnTxt, !canGoNext && { color: COLORS.textMuted }]}
            >
              {stage === 0 && !showMeaning
                ? "Önce Anlamı Gör"
                : stage === 2 && !sentenceOk
                ? "Önce Onayla"
                : stage === 3 && repeatCount < 3
                ? `${3 - repeatCount} tekrar kaldı`
                : "Sonraki →"}
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
  pills: { flexDirection: "row", gap: 5, alignItems: "center" },
  pill: { height: 6, borderRadius: 3 },
  stageLabel: {
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
  exBox: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
    borderLeftWidth: 3,
  },
  exLabel: { fontSize: FONT_SIZES.xs, fontWeight: "700" },
  exText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontStyle: "italic",
  },
  exTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
  },
  revealTxt: { fontSize: FONT_SIZES.lg, fontWeight: "700" },
  revealedBox: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
  },
  revealedMeaning: { fontSize: FONT_SIZES.xxl + 4, fontWeight: "900" },
  revealedHint: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  image: { width: "100%", height: 330, borderRadius: RADIUS.xl },
  imgPH: {
    height: 140,
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
  aiBtnTxt: { fontWeight: "600", fontSize: FONT_SIZES.sm },
  aiScene: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 3,
  },
  aiSceneTxt: {
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
  feedbackTxt: { fontSize: FONT_SIZES.sm, fontWeight: "600", flex: 1 },
  confirmBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: "center",
  },
  confirmBtnTxt: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(100,220,150,0.15)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  checkedTxt: { color: COLORS.success, fontWeight: "600" },
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
  tapDoneTxt: { fontWeight: "600", fontSize: FONT_SIZES.sm },
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
  optionTxt: { fontSize: FONT_SIZES.md, fontWeight: "600", flex: 1 },
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
  nextBtnTxt: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "700" },
});
