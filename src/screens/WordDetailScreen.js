// src/screens/WordDetailScreen.jsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { speakWord } from "../utils/textToSpeech";
import {
  getMasteryLevel,
  getMasteryLabel,
  DAVINCI_STAGES,
} from "../utils/davinciAlgorithm";

const LEVEL_COLORS = {
  A1: COLORS.levelA1,
  A2: COLORS.levelA2,
  B1: COLORS.levelB1,
  B2: COLORS.levelB2,
  C1: COLORS.levelC1,
  C2: COLORS.levelC2,
};

export default function WordDetailScreen({ navigation, route }) {
  const { word } = route.params;
  const { state, actions } = useApp();
  const progress = state.wordProgress[word.id] || {};
  const mastery = getMasteryLevel(progress);
  const masteryColor =
    mastery >= 4
      ? COLORS.success
      : mastery >= 2
      ? COLORS.accent
      : COLORS.textMuted;

  const handleDeleteCustomWord = () => {
    Alert.alert(
      "Kelimeyi Sil",
      `"${word.word}" kelimesini silmek istiyor musun?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            await actions.removeCustomWord(word.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handlePractice = () => {
    navigation.navigate("LearningSession", {
      words: [word],
      mode: "practice",
    });
  };

  const stages = Object.values(DAVINCI_STAGES);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kelime Detayı</Text>
        {word.isCustom && (
          <TouchableOpacity
            onPress={handleDeleteCustomWord}
            style={styles.deleteBtn}
          >
            <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Card */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardTop}>
            <View
              style={[
                styles.levelBadge,
                { backgroundColor: LEVEL_COLORS[word.level] + "25" },
              ]}
            >
              <Text
                style={[
                  styles.levelBadgeText,
                  { color: LEVEL_COLORS[word.level] },
                ]}
              >
                {word.level}
              </Text>
            </View>
            {word.isCustom && (
              <View style={styles.customBadge}>
                <Text style={styles.customBadgeText}>Özel Kelime</Text>
              </View>
            )}
          </View>

          <View style={styles.wordTitleRow}>
            <Text style={styles.wordText}>{word.word}</Text>
            <TouchableOpacity
              onPress={() => speakWord(word.word)}
              style={styles.speakBtn}
            >
              <Ionicons
                name="volume-high-outline"
                size={24}
                color={COLORS.secondary}
              />
            </TouchableOpacity>
          </View>
          <Text style={styles.phonetic}>{word.phonetic || ""}</Text>
          <Text
            style={[styles.translation, { color: LEVEL_COLORS[word.level] }]}
          >
            {word.translation}
          </Text>

          {word.hint && (
            <View style={styles.hintBox}>
              <Text style={styles.hintLabel}>💡 İpucu</Text>
              <Text style={styles.hintText}>{word.hint}</Text>
            </View>
          )}
        </View>

        {/* Mastery */}
        <View style={styles.masteryCard}>
          <View style={styles.masteryRow}>
            <Text style={styles.masteryLabel}>Ustalık Seviyesi</Text>
            <Text style={[styles.masteryValue, { color: masteryColor }]}>
              {getMasteryLabel(mastery)}
            </Text>
          </View>
          <View style={styles.masteryBarBg}>
            <View
              style={[
                styles.masteryBarFill,
                {
                  width: `${(mastery / 5) * 100}%`,
                  backgroundColor: masteryColor,
                },
              ]}
            />
          </View>
          <View style={styles.masteryStats}>
            <StatItem
              label="Doğru"
              value={progress.correctCount || 0}
              color={COLORS.success}
            />
            <StatItem
              label="Yanlış"
              value={progress.incorrectCount || 0}
              color={COLORS.error}
            />
            <StatItem
              label="Tekrar"
              value={progress.intervalIndex || 0}
              color={COLORS.accent}
            />
          </View>
          {progress.nextReviewDate && (
            <Text style={styles.nextReview}>
              Sonraki tekrar:{" "}
              {new Date(progress.nextReviewDate).toLocaleDateString("tr-TR")}
            </Text>
          )}
        </View>

        {/* Example */}
        <View style={styles.exampleCard}>
          <Text style={styles.cardTitle}>📝 Örnek Cümle</Text>
          <Text style={styles.exampleText}>{word.example}</Text>
          <Text style={styles.exampleTranslation}>{word.exampleTr}</Text>
        </View>

        {/* Memory Tip */}
        {word.memoryTip && (
          <View style={styles.memoryCard}>
            <Text style={styles.cardTitle}>🧠 Hafıza İpucu</Text>
            <Text style={styles.memoryText}>{word.memoryTip}</Text>
          </View>
        )}

        {/* Da Vinci stages reminder */}
        <View style={styles.stagesCard}>
          <Text style={styles.cardTitle}>🎨 Da Vinci Aşamaları</Text>
          <View style={styles.stagesList}>
            {stages.map((stage) => (
              <View key={stage.id} style={styles.stageRow}>
                <Text style={styles.stageIcon}>{stage.icon}</Text>
                <Text style={[styles.stageName, { color: stage.color }]}>
                  {stage.turkishName}
                </Text>
                <Text style={styles.stageInstr}>{stage.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Practice Button */}
        <TouchableOpacity
          style={styles.practiceButton}
          onPress={handlePractice}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentDark]}
            style={styles.practiceGradient}
          >
            <Ionicons name="play" size={18} color="#fff" />
            <Text style={styles.practiceButtonText}>Bu Kelimeyi Çalış</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatItem({ label, value, color }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.errorGlow,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.error + "40",
  },
  scroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },

  mainCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    ...SHADOWS.card,
  },
  mainCardTop: {
    flexDirection: "row",
    gap: SPACING.sm,
    alignSelf: "flex-start",
  },
  levelBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  levelBadgeText: { fontSize: FONT_SIZES.sm, fontWeight: "800" },
  customBadge: {
    backgroundColor: COLORS.secondaryGlow,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  customBadgeText: {
    color: COLORS.secondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  wordText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.display,
    fontWeight: "800",
    letterSpacing: -1,
  },
  phonetic: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.md,
    fontStyle: "italic",
  },
  translation: { fontSize: FONT_SIZES.xxl, fontWeight: "700" },
  hintBox: {
    backgroundColor: COLORS.backgroundCardLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    width: "100%",
    gap: 4,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
  },
  hintLabel: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  hintText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },

  masteryCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  masteryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  masteryLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  masteryValue: { fontSize: FONT_SIZES.md, fontWeight: "700" },
  masteryBarBg: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  masteryBarFill: { height: 8, borderRadius: 4 },
  masteryStats: { flexDirection: "row", justifyContent: "space-around" },
  statItem: { alignItems: "center", gap: 2 },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: "800" },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  nextReview: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
  },

  exampleCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.secondary,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  exampleText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
    fontStyle: "italic",
  },
  exampleTranslation: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },

  memoryCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 3,
    borderLeftColor: "#A29BFE",
  },
  memoryText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    lineHeight: 24,
  },

  stagesCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stagesList: { gap: SPACING.sm },
  stageRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  stageIcon: { fontSize: 18 },
  stageName: { fontSize: FONT_SIZES.sm, fontWeight: "700", width: 80 },
  stageInstr: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs, flex: 1 },

  practiceButton: {
    borderRadius: RADIUS.full,
    overflow: "hidden",
    ...SHADOWS.accent,
  },
  practiceGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  practiceButtonText: {
    color: "#fff",
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
});
