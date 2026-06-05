// src/screens/AIConversationScreen.jsx
// Claude ile kelime pratiği - öğrenilen kelimeleri kullanarak sohbet

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { getMasteryLevel } from "../utils/davinciAlgorithm";
import { speakWord } from "../utils/textToSpeech";

const SCENARIOS = [
  {
    id: "daily",
    icon: "☕",
    title: "Günlük Sohbet",
    desc: "Sabah rutini, hava, günlük hayat",
    color: "#4ECDC4",
  },
  {
    id: "travel",
    icon: "✈️",
    title: "Seyahat",
    desc: "Otel, restoran, yol tarifi",
    color: "#45B7D1",
  },
  {
    id: "work",
    icon: "💼",
    title: "İş Hayatı",
    desc: "Toplantı, e-posta, iş görüşmesi",
    color: "#96C93D",
  },
  {
    id: "shopping",
    icon: "🛍️",
    title: "Alışveriş",
    desc: "Fiyat sorma, ürün seçimi",
    color: "#F9CA24",
  },
  {
    id: "custom",
    icon: "🎯",
    title: "Serbest Sohbet",
    desc: "İstediğin konuda konuş",
    color: COLORS.accent,
  },
];

export default function AIConversationScreen({ navigation }) {
  const { state, actions } = useApp();
  const [scenario, setScenario] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usedWords, setUsedWords] = useState([]);
  const [sessionStats, setStats] = useState({
    messages: 0,
    wordsUsed: 0,
    corrections: 0,
  });
  const [showWordHints, setShowHints] = useState(false);
  const [sessionDone, setDone] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Kullanıcının öğrendiği kelimeler - yoksa tüm kelimelerden al
  const allW = actions.getAllWords();
  const learned = allW.filter((w) => {
    const m = getMasteryLevel(state.wordProgress[w.id] || {});
    return m >= 2;
  });
  const learnedWords = (learned.length >= 5 ? learned : allW).slice(0, 30);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const startScenario = async (sc) => {
    setScenario(sc);
    setMessages([]);
    setLoading(true);

    const wordList = learnedWords
      .slice(0, 10)
      .map((w) => w.word)
      .join(", ");
    const systemContext = buildSystemPrompt(sc, wordList);

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: systemContext,
          messages: [{ role: "user", content: "Merhaba! Başlayalım." }],
        }),
      });
      const data = await res.json();
      const aiText = data.content?.[0]?.text || "Merhaba! Konuşmaya hazırım.";
      setMessages([{ role: "assistant", text: aiText, timestamp: new Date() }]);
    } catch (e) {
      setMessages([
        {
          role: "assistant",
          text: `Merhaba! ${sc.title} konusunda konuşalım. Nasılsın?`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const buildSystemPrompt = (sc, wordList) => {
    const level = state.settings?.preferredLevel || "B1";
    return `Sen bir İngilizce konuşma partnerisin. Türk kullanıcıyla ${sc.title} senaryosunda pratik yapıyorsunuz.

KURALLAR:
1. Her zaman İngilizce konuş
2. Kullanıcı seviyesi: ${level} — buna uygun konuş
3. Kullanıcı bu kelimeleri öğrendi, konuşmada kullanmasını teşvik et: ${wordList}
4. Eğer kullanıcı yanlış yaparsa, nazikçe düzelt ve doğrusunu göster
5. Her mesajın sonuna [💡 Ipucu: ...] formatında kullanabileceği bir kelime öner
6. Kısa ve doğal cevaplar ver (2-3 cümle)
7. Senaryo: ${sc.desc}
8. Kullanıcı Türkçe yazarsa, İngilizce çevirisini ver ve devam et

Başlangıç: Kullanıcıyı sıcak karşıla ve senaryoya giriş yap.`;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");

    // Kullanılan kelimeleri tespit et
    const newUsedWords = learnedWords.filter(
      (w) =>
        userMsg.toLowerCase().includes(w.word.toLowerCase()) &&
        !usedWords.find((u) => u.id === w.id)
    );
    if (newUsedWords.length > 0) {
      setUsedWords((prev) => [...prev, ...newUsedWords]);
      setStats((prev) => ({
        ...prev,
        wordsUsed: prev.wordsUsed + newUsedWords.length,
      }));
    }

    const newMessages = [
      ...messages,
      {
        role: "user",
        text: userMsg,
        timestamp: new Date(),
        usedWords: newUsedWords,
      },
    ];
    setMessages(newMessages);
    setStats((prev) => ({ ...prev, messages: prev.messages + 1 }));
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.text,
      }));

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(
            scenario,
            learnedWords
              .slice(0, 10)
              .map((w) => w.word)
              .join(", ")
          ),
          messages: apiMessages,
        }),
      });

      const data = await res.json();
      const aiText = data.content?.[0]?.text || "I see! Tell me more.";

      // Düzeltme var mı tespit et
      const hasCorrection =
        aiText.includes("correction") ||
        aiText.includes("should be") ||
        aiText.includes("Actually") ||
        aiText.includes("you mean");
      if (hasCorrection)
        setStats((prev) => ({ ...prev, corrections: prev.corrections + 1 }));

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: aiText,
          timestamp: new Date(),
          hasCorrection,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: "Sorry, I had a connection issue. Let's continue! What were you saying?",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const endSession = () => {
    setDone(true);
  };

  // ── SENARYO SEÇİM EKRANI ────────────────────────────────────────────────
  if (!scenario) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>AI Konuşma</Text>
            <Text style={styles.headerSub}>Pratik yap ve geliş</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scenarioScroll}>
          <Animated.View style={{ opacity: fadeAnim }}>
            <View style={styles.scenarioHero}>
              <Text style={styles.scenarioHeroIcon}>🗣️</Text>
              <Text style={styles.scenarioHeroTitle}>Konuşma Pratiği</Text>
              <Text style={styles.scenarioHeroDesc}>
                Öğrendiğin {learnedWords.length} kelimeyi gerçek sohbette kullan
              </Text>
            </View>

            {/* Öğrenilen kelimeler özeti */}
            {learnedWords.length > 0 && (
              <View style={styles.wordPreview}>
                <Text style={styles.wordPreviewTitle}>
                  Kullanabileceğin kelimeler:
                </Text>
                <View style={styles.wordChips}>
                  {learnedWords.slice(0, 8).map((w, i) => (
                    <View key={i} style={styles.wordChip}>
                      <Text style={styles.wordChipText}>{w.word}</Text>
                    </View>
                  ))}
                  {learnedWords.length > 8 && (
                    <View style={styles.wordChip}>
                      <Text style={styles.wordChipText}>
                        +{learnedWords.length - 8}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            <Text style={styles.scenarioLabel}>Senaryo Seç</Text>
            {SCENARIOS.map((sc) => (
              <TouchableOpacity
                key={sc.id}
                style={[styles.scenarioCard, { borderColor: sc.color + "40" }]}
                onPress={() => startScenario(sc)}
                activeOpacity={0.85}
              >
                <View
                  style={[
                    styles.scenarioIcon,
                    { backgroundColor: sc.color + "20" },
                  ]}
                >
                  <Text style={styles.scenarioIconText}>{sc.icon}</Text>
                </View>
                <View style={styles.scenarioInfo}>
                  <Text style={styles.scenarioTitle}>{sc.title}</Text>
                  <Text style={styles.scenarioDesc}>{sc.desc}</Text>
                </View>
                <Ionicons
                  name="arrow-forward-circle"
                  size={24}
                  color={sc.color}
                />
              </TouchableOpacity>
            ))}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── OTURUM SONU ─────────────────────────────────────────────────────────
  if (sessionDone) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.doneScroll}>
          <Text style={styles.doneIcon}>🎉</Text>
          <Text style={styles.doneTitle}>Harika Konuşma!</Text>
          <Text style={styles.doneSub}>İşte performansın:</Text>

          <View style={styles.doneStats}>
            <DoneStat
              icon="💬"
              value={sessionStats.messages}
              label="Mesaj"
              color={COLORS.accent}
            />
            <DoneStat
              icon="📚"
              value={sessionStats.wordsUsed}
              label="Kelime Kullandın"
              color={COLORS.success}
            />
            <DoneStat
              icon="✏️"
              value={sessionStats.corrections}
              label="Düzeltme"
              color="#F9CA24"
            />
          </View>

          {usedWords.length > 0 && (
            <View style={styles.usedWordsSection}>
              <Text style={styles.usedWordsTitle}>
                Kullandığın Kelimeler 🌟
              </Text>
              <View style={styles.usedWordsList}>
                {usedWords.map((w, i) => (
                  <View key={i} style={styles.usedWordBadge}>
                    <Text style={styles.usedWordText}>{w.word}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.doneButtons}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => {
                setScenario(null);
                setDone(false);
                setMessages([]);
                setUsedWords([]);
                setStats({ messages: 0, wordsUsed: 0, corrections: 0 });
              }}
            >
              <Ionicons name="refresh" size={20} color={COLORS.accent} />
              <Text style={styles.doneBtnText}>Yeni Sohbet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneBtn, { backgroundColor: COLORS.accent }]}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="home" size={20} color="#fff" />
              <Text style={[styles.doneBtnText, { color: "#fff" }]}>
                Ana Sayfa
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── SOHBET EKRANI ───────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.chatHeader}>
        <TouchableOpacity
          onPress={() => setScenario(null)}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View
          style={[
            styles.scenarioBadge,
            { backgroundColor: scenario.color + "20" },
          ]}
        >
          <Text style={styles.scenarioBadgeIcon}>{scenario.icon}</Text>
          <Text style={[styles.scenarioBadgeText, { color: scenario.color }]}>
            {scenario.title}
          </Text>
        </View>
        <View style={styles.chatStats}>
          <Text style={styles.chatStatsText}>📚 {sessionStats.wordsUsed}</Text>
        </View>
        <TouchableOpacity onPress={endSession} style={styles.endBtn}>
          <Text style={styles.endBtnText}>Bitir</Text>
        </TouchableOpacity>
      </View>

      {/* Kelime ipuçları */}
      <TouchableOpacity
        style={styles.hintToggle}
        onPress={() => setShowHints(!showWordHints)}
      >
        <Ionicons
          name={showWordHints ? "chevron-up" : "bulb-outline"}
          size={16}
          color={COLORS.accent}
        />
        <Text style={styles.hintToggleText}>
          {showWordHints ? "Gizle" : `${learnedWords.length} kelime ipucu`}
        </Text>
      </TouchableOpacity>
      {showWordHints && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.hintsRow}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            gap: SPACING.xs,
          }}
        >
          {learnedWords.slice(0, 12).map((w, i) => (
            <TouchableOpacity
              key={i}
              style={[
                styles.hintChip,
                usedWords.find((u) => u.id === w.id) && styles.hintChipUsed,
              ]}
              onPress={() =>
                setInput((prev) => prev + (prev ? " " : "") + w.word)
              }
            >
              <Text style={styles.hintChipText}>{w.word}</Text>
              {usedWords.find((u) => u.id === w.id) && (
                <Ionicons name="checkmark" size={10} color={COLORS.success} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Mesajlar */}
      <ScrollView
        ref={scrollRef}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} onSpeak={speakWord} />
        ))}
        {loading && (
          <View style={styles.typingBubble}>
            <ActivityIndicator size="small" color={COLORS.accent} />
            <Text style={styles.typingText}>yazıyor...</Text>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="İngilizce yaz..."
            placeholderTextColor={COLORS.textMuted}
            multiline
            maxLength={300}
            onSubmitEditing={sendMessage}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || loading) && styles.sendBtnDisabled,
            ]}
            onPress={sendMessage}
            disabled={!input.trim() || loading}
          >
            <Ionicons
              name="send"
              size={20}
              color={input.trim() && !loading ? "#fff" : COLORS.textMuted}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ msg, onSpeak }) {
  const isUser = msg.role === "user";
  // AI ipucunu ayır
  const tipMatch = msg.text.match(/\[💡[^\]]*\]/);
  const mainText = msg.text.replace(/\[💡[^\]]*\]/g, "").trim();
  const tip = tipMatch ? tipMatch[0] : null;

  return (
    <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowAI]}>
      {!isUser && (
        <View style={styles.aiAvatar}>
          <Text style={styles.aiAvatarText}>🤖</Text>
        </View>
      )}
      <View
        style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}
      >
        <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
          {mainText}
        </Text>
        {tip && (
          <View style={styles.tipBox}>
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        )}
        {msg.usedWords?.length > 0 && (
          <View style={styles.usedWordRow}>
            {msg.usedWords.map((w, i) => (
              <View key={i} style={styles.usedWordMini}>
                <Text style={styles.usedWordMiniText}>✅ {w.word}</Text>
              </View>
            ))}
          </View>
        )}
        {!isUser && (
          <TouchableOpacity
            style={styles.speakMsgBtn}
            onPress={() => onSpeak(mainText.split(".")[0])}
          >
            <Ionicons
              name="volume-medium-outline"
              size={14}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

function DoneStat({ icon, value, label, color }) {
  return (
    <View style={[styles.doneStat, { borderColor: color + "30" }]}>
      <Text style={styles.doneStatIcon}>{icon}</Text>
      <Text style={[styles.doneStatValue, { color }]}>{value}</Text>
      <Text style={styles.doneStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  headerSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  scenarioScroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xxxl,
  },
  scenarioHero: {
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.xl,
  },
  scenarioHeroIcon: { fontSize: 56 },
  scenarioHeroTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  scenarioHeroDesc: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
  },

  wordPreview: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wordPreviewTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.sm,
  },
  wordChips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  wordChip: {
    backgroundColor: COLORS.accentGlow || "rgba(108,99,255,0.15)",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  wordChipText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },

  scenarioLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: SPACING.md,
  },
  scenarioCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1,
  },
  scenarioIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  scenarioIconText: { fontSize: 24 },
  scenarioInfo: { flex: 1 },
  scenarioTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  scenarioDesc: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },

  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  scenarioBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    flex: 1,
  },
  scenarioBadgeIcon: { fontSize: 16 },
  scenarioBadgeText: { fontSize: FONT_SIZES.sm, fontWeight: "700" },
  chatStats: {},
  chatStatsText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  endBtn: {
    backgroundColor: COLORS.error + "20",
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  endBtnText: {
    color: COLORS.error,
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
  },

  hintToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 6,
  },
  hintToggleText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  hintsRow: { flexGrow: 0, maxHeight: 40 },
  hintChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  hintChipUsed: {
    borderColor: COLORS.success + "60",
    backgroundColor: COLORS.success + "15",
  },
  hintChipText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs },

  messageList: { flex: 1 },
  messageContent: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: SPACING.md,
  },

  msgRow: { flexDirection: "row", gap: SPACING.sm, maxWidth: "100%" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowAI: { justifyContent: "flex-start", alignItems: "flex-end" },
  aiAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accentGlow || "rgba(108,99,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  aiAvatarText: { fontSize: 16 },

  bubble: {
    maxWidth: "80%",
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    gap: 6,
  },
  bubbleUser: { backgroundColor: COLORS.accent, borderBottomRightRadius: 4 },
  bubbleAI: {
    backgroundColor: COLORS.backgroundCard,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bubbleText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    lineHeight: 22,
  },
  bubbleTextUser: { color: "#fff" },

  tipBox: {
    backgroundColor: "rgba(108,99,255,0.12)",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  tipText: { color: COLORS.accent, fontSize: FONT_SIZES.xs },
  usedWordRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  usedWordMini: {
    backgroundColor: COLORS.success + "20",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  usedWordMiniText: { color: COLORS.success, fontSize: 10 },
  speakMsgBtn: { alignSelf: "flex-end", padding: 4 },

  typingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typingText: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  inputRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
  sendBtnDisabled: { backgroundColor: COLORS.backgroundCard },

  doneScroll: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
    alignItems: "center",
    gap: SPACING.lg,
  },
  doneIcon: { fontSize: 72 },
  doneTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: "800",
  },
  doneSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  doneStats: { flexDirection: "row", gap: SPACING.sm, width: "100%" },
  doneStat: {
    flex: 1,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  doneStatIcon: { fontSize: 22 },
  doneStatValue: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  doneStatLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },
  usedWordsSection: { width: "100%", gap: SPACING.sm },
  usedWordsTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  usedWordsList: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  usedWordBadge: {
    backgroundColor: COLORS.success + "20",
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.success + "40",
  },
  usedWordText: {
    color: COLORS.success,
    fontWeight: "700",
    fontSize: FONT_SIZES.sm,
  },
  doneButtons: { flexDirection: "row", gap: SPACING.sm, width: "100%" },
  doneBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  doneBtnText: { color: COLORS.textPrimary, fontWeight: "700" },
});
