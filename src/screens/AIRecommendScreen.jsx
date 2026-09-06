// src/screens/AIRecommendScreen.jsx
// AI destekli kelime önerileri - kullanıcının zayıf noktalarına göre

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { getMasteryLevel } from "../utils/davinciAlgorithm";

export default function AIRecommendScreen({ navigation }) {
  const { state, actions } = useApp();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [recommendations, setRecs] = useState([]);
  const [selectedWords, setSelected] = useState([]);
  const [activeTab, setActiveTab] = useState("recommend"); // recommend | analyze
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const allWords = actions.getAllWords();
  const { wordProgress, stats, settings } = state;

  useEffect(() => {
    analyzeUserProgress();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const analyzeUserProgress = () => {
    // Kullanıcının zayıf noktalarını analiz et
    const categoryPerf = {};
    const levelPerf = {};
    const weakWords = [];
    const strongWords = [];

    allWords.forEach((w) => {
      const p = wordProgress[w.id];
      const m = getMasteryLevel(p || {});
      const cat = w.category || "other";
      const lvl = w.level;

      // Kategori performansı
      if (!categoryPerf[cat])
        categoryPerf[cat] = { total: 0, mastery: 0, wrong: 0 };
      categoryPerf[cat].total++;
      categoryPerf[cat].mastery += m;
      if (p?.incorrectCount > (p?.correctCount || 0)) categoryPerf[cat].wrong++;

      // Seviye performansı
      if (!levelPerf[lvl]) levelPerf[lvl] = { total: 0, mastery: 0 };
      levelPerf[lvl].total++;
      levelPerf[lvl].mastery += m;

      // Zayıf ve güçlü kelimeler
      if (p && m < 2 && (p.incorrectCount || 0) > 0)
        weakWords.push({ ...w, mastery: m, progress: p });
      if (m >= 4) strongWords.push({ ...w, mastery: m });
    });

    // Kategorileri ortalama ustalığa göre sırala
    const catAnalysis = Object.entries(categoryPerf)
      .map(([cat, d]) => ({
        cat,
        total: d.total,
        avgMastery:
          d.total > 0 ? parseFloat((d.mastery / d.total).toFixed(1)) : 0,
        wrongPct: d.total > 0 ? Math.round((d.wrong / d.total) * 100) : 0,
      }))
      .sort((a, b) => a.avgMastery - b.avgMastery);

    // Seviye analizi
    const lvlAnalysis = Object.entries(levelPerf)
      .map(([lvl, d]) => ({
        level: lvl,
        avgMastery:
          d.total > 0 ? parseFloat((d.mastery / d.total).toFixed(1)) : 0,
        total: d.total,
      }))
      .sort((a, b) => a.avgMastery - b.avgMastery);

    setAnalysis({
      weakCategories: catAnalysis.slice(0, 3),
      strongCategories: catAnalysis.slice(-3).reverse(),
      weakLevel: lvlAnalysis[0],
      weakWords: weakWords.slice(0, 10),
      strongWords: strongWords.slice(0, 5),
      totalLearned: strongWords.length,
      needsWork: weakWords.length,
    });
  };

  const generateAIRecommendations = async () => {
    if (!analysis) return;
    setLoading(true);

    try {
      const prompt = buildPrompt();
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const parsed = parseAIResponse(text);
      setRecs(parsed);
    } catch (e) {
      // AI olmadan lokal öneri yap
      generateLocalRecommendations();
    } finally {
      setLoading(false);
    }
  };

  const buildPrompt = () => {
    const weakCats = analysis.weakCategories.map((c) => c.cat).join(", ");
    const weakLvl = analysis.weakLevel?.level || "A1";
    const preferredLevel = settings?.preferredLevel || "A1";

    return `Sen bir İngilizce öğretmenisin. Kullanıcının öğrenme verileri:

- Tercih edilen seviye: ${preferredLevel}
- Zayıf kategoriler: ${weakCats}
- En zayıf seviye: ${weakLvl}
- Toplam öğrenilen kelime: ${analysis.totalLearned}
- Çalışılması gereken kelime: ${analysis.needsWork}
- Aktif çalışma serisi: ${stats.streak || 0} gün

Bu kullanıcı için 5 adet kelime önerisi yap. Her kelime şu formatta olsun:

KELIME: [İngilizce kelime]
ANLAM: [Türkçe anlam]
NEDEN: [Neden bu kelime öneriliyor - kısa açıklama]
ÖRNEK: [Kısa İngilizce cümle]
SEVİYE: [A1/A2/B1/B2/C1/C2]

Sadece yukarıdaki formatta cevap ver, başka açıklama ekleme.`;
  };

  const parseAIResponse = (text) => {
    const blocks = text.split("\n\n").filter((b) => b.includes("KELIME:"));
    return blocks
      .map((block, i) => {
        const lines = block.split("\n");
        const get = (key) => {
          const line = lines.find((l) => l.startsWith(key + ":"));
          return line ? line.replace(key + ":", "").trim() : "";
        };
        return {
          id: `ai_${Date.now()}_${i}`,
          word: get("KELIME"),
          translation: get("ANLAM"),
          reason: get("NEDEN"),
          example: get("ÖRNEK"),
          level: get("SEVİYE") || "B1",
          isAI: true,
        };
      })
      .filter((w) => w.word);
  };

  const generateLocalRecommendations = () => {
    if (!analysis) return;
    // AI yoksa: zayıf kategorilerden kelimeler seç
    const weakCats = analysis.weakCategories.map((c) => c.cat);
    const candidates = allWords
      .filter((w) => {
        const m = getMasteryLevel(wordProgress[w.id] || {});
        return m < 3 && weakCats.includes(w.category || "other");
      })
      .slice(0, 5);

    setRecs(
      candidates.map((w) => ({
        ...w,
        reason: `${w.category} kategorisinde gelişime açık`,
        isAI: false,
      }))
    );
  };

  const toggleWord = (word) => {
    setSelected((prev) =>
      prev.find((w) => w.id === word.id)
        ? prev.filter((w) => w.id !== word.id)
        : [...prev, word]
    );
  };

  const startSessionWithSelected = () => {
    if (selectedWords.length === 0) {
      Alert.alert("Kelime Seç", "En az bir kelime seçmelisin.");
      return;
    }
    navigation.navigate("LearningSession", {
      word: selectedWords[0],
      mode: "learn",
      level: selectedWords[0]?.level || "B1",
    });
  };

  const LEVEL_COLORS = {
    A1: "#4ECDC4",
    A2: "#45B7D1",
    B1: "#96C93D",
    B2: "#F9CA24",
    C1: "#F0932B",
    C2: "#E17055",
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>AI Öğretmenim</Text>
          <Text style={styles.headerSub}>Kişisel kelime önerileri</Text>
        </View>
        <View style={styles.aiBadge}>
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      </View>

      {/* Konuşma pratiği butonu */}
      <TouchableOpacity
        style={styles.conversationBtn}
        onPress={() => navigation.navigate("AIConversation")}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={["#4ECDC4", "#45B7D1"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.conversationGradient}
        >
          <Text style={styles.conversationIcon}>🗣️</Text>
          <View>
            <Text style={styles.conversationTitle}>Konuşma Pratiği</Text>
            <Text style={styles.conversationSub}>Claude ile gerçek sohbet</Text>
          </View>
          <Ionicons
            name="arrow-forward-circle"
            size={24}
            color="#fff"
            style={{ marginLeft: "auto" }}
          />
        </LinearGradient>
      </TouchableOpacity>

      {/* Tab seçici */}
      <View style={styles.tabs}>
        {[
          { id: "recommend", label: "💡 Öneriler" },
          { id: "analyze", label: "📊 Analiz" },
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && styles.tabActive]}
            onPress={() => setActiveTab(t.id)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === t.id && styles.tabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── ÖNERİLER TAB ── */}
        {activeTab === "recommend" && (
          <Animated.View style={{ opacity: fadeAnim, gap: SPACING.lg }}>
            {/* AI Öneri Butonu */}
            <TouchableOpacity
              style={styles.generateBtn}
              onPress={generateAIRecommendations}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[COLORS.accent, "#A29BFE"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.generateGradient}
              >
                {loading ? (
                  <>
                    <ActivityIndicator color="#fff" />
                    <Text style={styles.generateText}>AI analiz ediyor...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.generateIcon}>🤖</Text>
                    <Text style={styles.generateText}>
                      {recommendations.length > 0
                        ? "Yeni Öneriler Al"
                        : "AI Önerileri Al"}
                    </Text>
                    <Ionicons name="sparkles" size={20} color="#fff" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Öneriler yoksa lokal önerileri göster */}
            {recommendations.length === 0 && !loading && (
              <TouchableOpacity
                style={styles.localBtn}
                onPress={generateLocalRecommendations}
              >
                <Ionicons name="list" size={18} color={COLORS.secondary} />
                <Text style={styles.localBtnText}>
                  Hızlı Öneri (AI olmadan)
                </Text>
              </TouchableOpacity>
            )}

            {/* Kelime Kartları */}
            {recommendations.length > 0 && (
              <>
                <View style={styles.recHeader}>
                  <Text style={styles.recTitle}>Önerilen Kelimeler</Text>
                  <Text style={styles.recSub}>
                    {selectedWords.length} kelime seçildi
                  </Text>
                </View>

                {recommendations.map((word, i) => {
                  const isSelected = !!selectedWords.find(
                    (w) => w.id === word.id
                  );
                  const levelColor = LEVEL_COLORS[word.level] || COLORS.accent;
                  return (
                    <TouchableOpacity
                      key={word.id || i}
                      style={[
                        styles.recCard,
                        isSelected && styles.recCardSelected,
                      ]}
                      onPress={() => toggleWord(word)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.recCardTop}>
                        <View style={styles.recCardLeft}>
                          <View
                            style={[
                              styles.recLevelBadge,
                              { backgroundColor: levelColor + "20" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.recLevelText,
                                { color: levelColor },
                              ]}
                            >
                              {word.level}
                            </Text>
                          </View>
                          {word.isAI && (
                            <View style={styles.aiTag}>
                              <Text style={styles.aiTagText}>🤖 AI</Text>
                            </View>
                          )}
                        </View>
                        <View
                          style={[
                            styles.recCheckbox,
                            isSelected && {
                              backgroundColor: COLORS.accent,
                              borderColor: COLORS.accent,
                            },
                          ]}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="#fff" />
                          )}
                        </View>
                      </View>
                      <Text style={styles.recWord}>{word.word}</Text>
                      <Text style={styles.recTranslation}>
                        {word.translation}
                      </Text>
                      {word.reason && (
                        <View style={styles.recReasonBox}>
                          <Ionicons
                            name="bulb-outline"
                            size={13}
                            color={COLORS.accent}
                          />
                          <Text style={styles.recReason}>{word.reason}</Text>
                        </View>
                      )}
                      {word.example && (
                        <Text style={styles.recExample}>"{word.example}"</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Seçilen kelimelerle oturum başlat */}
                {selectedWords.length > 0 && (
                  <TouchableOpacity
                    style={styles.startBtn}
                    onPress={startSessionWithSelected}
                  >
                    <LinearGradient
                      colors={[COLORS.accent, COLORS.accentDark || "#5A52D5"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.startGradient}
                    >
                      <Ionicons name="play-circle" size={24} color="#fff" />
                      <Text style={styles.startText}>
                        {selectedWords.length} Kelimeyi Öğren
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </>
            )}
          </Animated.View>
        )}

        {/* ── ANALİZ TAB ── */}
        {activeTab === "analyze" && analysis && (
          <Animated.View style={{ opacity: fadeAnim, gap: SPACING.lg }}>
            {/* Özet */}
            <View style={styles.analysisSummary}>
              <AnalysisCard
                icon="⚠️"
                value={analysis.needsWork}
                label="Çalışılacak"
                color={COLORS.error}
              />
              <AnalysisCard
                icon="✅"
                value={analysis.totalLearned}
                label="Ustalaşılan"
                color={COLORS.success}
              />
              <AnalysisCard
                icon="🔥"
                value={state.stats.streak || 0}
                label="Günlük Seri"
                color="#F9CA24"
              />
            </View>

            {/* Zayıf Kategoriler */}
            <View style={styles.analysisSection}>
              <Text style={styles.analysisSectionTitle}>
                ⚠️ Güçlendirilmesi Gereken
              </Text>
              {analysis.weakCategories.map((c, i) => (
                <View key={i} style={styles.catAnalysisRow}>
                  <View style={styles.catAnalysisLeft}>
                    <Text style={styles.catAnalysisName}>
                      {c.cat.replace(/_/g, " ")}
                    </Text>
                    <Text style={styles.catAnalysisSub}>
                      {c.total} kelime · Ort. ustalık {c.avgMastery}/5
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.catMasteryBar,
                      { backgroundColor: COLORS.error + "20" },
                    ]}
                  >
                    <View
                      style={[
                        styles.catMasteryFill,
                        {
                          width: `${(c.avgMastery / 5) * 100}%`,
                          backgroundColor: COLORS.error,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.catMasteryPct, { color: COLORS.error }]}>
                    {Math.round((c.avgMastery / 5) * 100)}%
                  </Text>
                </View>
              ))}
            </View>

            {/* Güçlü Kategoriler */}
            <View style={styles.analysisSection}>
              <Text style={styles.analysisSectionTitle}>
                💪 Güçlü Olduğun Alanlar
              </Text>
              {analysis.strongCategories.map((c, i) => (
                <View key={i} style={styles.catAnalysisRow}>
                  <View style={styles.catAnalysisLeft}>
                    <Text style={styles.catAnalysisName}>
                      {c.cat.replace(/_/g, " ")}
                    </Text>
                    <Text style={styles.catAnalysisSub}>
                      {c.total} kelime · Ort. ustalık {c.avgMastery}/5
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.catMasteryBar,
                      { backgroundColor: COLORS.success + "20" },
                    ]}
                  >
                    <View
                      style={[
                        styles.catMasteryFill,
                        {
                          width: `${(c.avgMastery / 5) * 100}%`,
                          backgroundColor: COLORS.success,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.catMasteryPct, { color: COLORS.success }]}
                  >
                    {Math.round((c.avgMastery / 5) * 100)}%
                  </Text>
                </View>
              ))}
            </View>

            {/* Tekrar Gereken Kelimeler */}
            {analysis.weakWords.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={styles.analysisSectionTitle}>
                  🔄 Acil Tekrar Gereken
                </Text>
                <View style={styles.weakWordsList}>
                  {analysis.weakWords.slice(0, 5).map((w, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.weakWordCard}
                      onPress={() =>
                        navigation.navigate("WordDetail", { word: w })
                      }
                    >
                      <View style={styles.weakWordLeft}>
                        <Text style={styles.weakWordText}>{w.word}</Text>
                        <Text style={styles.weakWordTr}>{w.translation}</Text>
                      </View>
                      <View style={styles.weakWordRight}>
                        <Text style={styles.weakWordStats}>
                          ✅{w.progress?.correctCount || 0} ❌
                          {w.progress?.incorrectCount || 0}
                        </Text>
                        <View
                          style={[
                            styles.masteryPill,
                            { backgroundColor: COLORS.error + "20" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.masteryPillText,
                              { color: COLORS.error },
                            ]}
                          >
                            Ustalık {w.mastery}/5
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.practiceWeakBtn}
                  onPress={() => {
                    if (analysis.weakWords.length > 0) {
                      navigation.navigate("LearningSession", {
                        word: analysis.weakWords[0],
                        mode: "review",
                        level: analysis.weakWords[0]?.level || "A1",
                      });
                    }
                  }}
                >
                  <Ionicons
                    name="refresh-circle"
                    size={20}
                    color={COLORS.error}
                  />
                  <Text style={styles.practiceWeakText}>
                    Bu Kelimeleri Tekrar Et
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* AI Öğrenme Tavsiyesi */}
            <View style={styles.aiAdviceCard}>
              <LinearGradient
                colors={[
                  COLORS.accentGlow || "rgba(108,99,255,0.1)",
                  "transparent",
                ]}
                style={styles.aiAdviceGradient}
              >
                <Text style={styles.aiAdviceTitle}>🤖 AI Tavsiyesi</Text>
                <Text style={styles.aiAdviceText}>
                  {analysis.weakWords.length > 5
                    ? `${analysis.weakWords.length} kelimede zorlanıyorsun. Önce "Öneriler" sekmesinden AI önerileri al ve zayıf kategorilere odaklan.`
                    : analysis.needsWork === 0
                    ? "Harika! Tüm kelimelerde iyi ilerliyorsun. Bir üst seviyeye geçmeyi düşün!"
                    : `${
                        analysis.weakCategories[0]?.cat || ""
                      } kategorisine odaklanman önerilir. Günde ${Math.max(
                        5,
                        10 - (stats.streak || 0)
                      )} kelime hedefle.`}
                </Text>
                <TouchableOpacity
                  style={styles.aiAdviceBtn}
                  onPress={() => setActiveTab("recommend")}
                >
                  <Text style={styles.aiAdviceBtnText}>AI Önerilerini Al</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={COLORS.accent}
                  />
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </Animated.View>
        )}

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function AnalysisCard({ icon, value, label, color }) {
  return (
    <View style={[styles.analysisCard, { borderColor: color + "30" }]}>
      <Text style={styles.analysisCardIcon}>{icon}</Text>
      <Text style={[styles.analysisCardValue, { color }]}>{value}</Text>
      <Text style={styles.analysisCardLabel}>{label}</Text>
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
  aiBadge: {
    marginLeft: "auto",
    backgroundColor: COLORS.accentGlow || "rgba(108,99,255,0.15)",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  aiBadgeText: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xs,
    fontWeight: "800",
  },

  tabs: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.sm,
    alignItems: "center",
    borderRadius: RADIUS.md,
  },
  tabActive: {
    backgroundColor: COLORS.backgroundCardLight || COLORS.backgroundCard,
  },
  tabText: {
    color: COLORS.textMuted,
    fontWeight: "600",
    fontSize: FONT_SIZES.sm,
  },
  tabTextActive: { color: COLORS.textPrimary },

  scroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },

  conversationBtn: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  conversationGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  conversationIcon: { fontSize: 28 },
  conversationTitle: {
    color: "#fff",
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  conversationSub: { color: "rgba(255,255,255,0.8)", fontSize: FONT_SIZES.xs },
  generateBtn: { borderRadius: RADIUS.xl, overflow: "hidden" },
  generateGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  generateIcon: { fontSize: 24 },
  generateText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.lg },

  localBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.secondary + "40",
  },
  localBtnText: { color: COLORS.secondary, fontWeight: "600" },

  recHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  recSub: { color: COLORS.accent, fontSize: FONT_SIZES.sm, fontWeight: "600" },

  recCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  recCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentGlow || "rgba(108,99,255,0.08)",
  },
  recCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recCardLeft: { flexDirection: "row", gap: SPACING.xs },
  recLevelBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  recLevelText: { fontSize: FONT_SIZES.xs, fontWeight: "700" },
  aiTag: {
    backgroundColor: COLORS.accent + "20",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  aiTagText: { color: COLORS.accent, fontSize: 10, fontWeight: "600" },
  recCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  recWord: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  recTranslation: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  recReasonBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.xs,
    backgroundColor: COLORS.accent + "10",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  recReason: { color: COLORS.textSecondary, fontSize: FONT_SIZES.xs, flex: 1 },
  recExample: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontStyle: "italic",
  },

  startBtn: { borderRadius: RADIUS.xl, overflow: "hidden" },
  startGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
    padding: SPACING.lg,
  },
  startText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.lg },

  analysisSummary: { flexDirection: "row", gap: SPACING.sm },
  analysisCard: {
    flex: 1,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  analysisCardIcon: { fontSize: 22 },
  analysisCardValue: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  analysisCardLabel: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },

  analysisSection: { gap: SPACING.sm },
  analysisSectionTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },

  catAnalysisRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catAnalysisLeft: { flex: 1 },
  catAnalysisName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  catAnalysisSub: { color: COLORS.textMuted, fontSize: 10 },
  catMasteryBar: { width: 60, height: 6, borderRadius: 3, overflow: "hidden" },
  catMasteryFill: { height: 6, borderRadius: 3 },
  catMasteryPct: {
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
    width: 30,
    textAlign: "right",
  },

  weakWordsList: { gap: SPACING.sm },
  weakWordCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "30",
  },
  weakWordLeft: { gap: 2 },
  weakWordText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  weakWordTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  weakWordRight: { alignItems: "flex-end", gap: 4 },
  weakWordStats: { color: COLORS.textMuted, fontSize: 10 },
  masteryPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  masteryPillText: { fontSize: 10, fontWeight: "600" },

  practiceWeakBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.error + "15",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "40",
  },
  practiceWeakText: { color: COLORS.error, fontWeight: "700" },

  aiAdviceCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.accent + "30",
  },
  aiAdviceGradient: { padding: SPACING.lg, gap: SPACING.md },
  aiAdviceTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  aiAdviceText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  aiAdviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    alignSelf: "flex-start",
  },
  aiAdviceBtnText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.sm,
  },
});
