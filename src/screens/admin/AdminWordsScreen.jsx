// src/screens/admin/AdminWordsScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { ALL_WORDS } from "../../data/wordDatabase";
import { seedWordsToFirebase } from "../../services/seedFirebase";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_COLORS = {
  A1: "#4ECDC4",
  A2: "#45B7D1",
  B1: "#96C93D",
  B2: "#F9CA24",
  C1: "#F0932B",
  C2: "#E17055",
};

export default function AdminWordsScreen({ navigation }) {
  const [selectedLevel, setSelectedLevel] = useState("A1");
  const [search, setSearch] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedProgress, setSeedProgress] = useState(0);

  const filtered = ALL_WORDS.filter((w) => {
    const matchLevel = w.level === selectedLevel;
    const matchSearch =
      search.trim() === "" ||
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      w.translation.toLowerCase().includes(search.toLowerCase());
    return matchLevel && matchSearch;
  });

  const handleSeedFirebase = async () => {
    Alert.alert(
      "🔥 Firebase Seed",
      `${ALL_WORDS.length} kelime Firebase'e yüklenecek. Devam?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Yükle",
          onPress: async () => {
            setSeeding(true);
            setSeedProgress(0);
            const result = await seedWordsToFirebase((done, total) => {
              setSeedProgress(Math.round((done / total) * 100));
            });
            setSeeding(false);
            setSeedProgress(0);
            Alert.alert(
              result.success ? "✅ Başarılı!" : "❌ Hata",
              result.success
                ? `${result.count} kelime Firebase'e yüklendi!`
                : result.error
            );
          },
        },
      ]
    );
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
        <Text style={styles.headerTitle}>Kelime Yönetimi</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate("AddWord")}
        >
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Arama */}
      <View style={styles.searchRow}>
        <Ionicons
          name="search"
          size={18}
          color={COLORS.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Kelime ara..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Seviye Seçici — 3x2 grid, büyük butonlar */}
      <View style={styles.levelGrid}>
        {LEVELS.map((lvl) => {
          const active = selectedLevel === lvl;
          const color = LEVEL_COLORS[lvl];
          const count = ALL_WORDS.filter((w) => w.level === lvl).length;
          return (
            <TouchableOpacity
              key={lvl}
              style={[
                styles.levelChip,
                active && { backgroundColor: color, borderColor: color },
                !active && { borderColor: color + "60" },
              ]}
              onPress={() => setSelectedLevel(lvl)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.levelChipLabel,
                  { color: active ? "#fff" : color },
                ]}
              >
                {lvl}
              </Text>
              <Text
                style={[
                  styles.levelChipCount,
                  { color: active ? "#ffffffCC" : color + "AA" },
                ]}
              >
                {count}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Firebase Seed Butonu */}
      {seeding ? (
        <View style={styles.seedingRow}>
          <ActivityIndicator size="small" color={COLORS.accent} />
          <Text style={styles.seedingText}>Yükleniyor... %{seedProgress}</Text>
        </View>
      ) : (
        <TouchableOpacity style={styles.seedBtn} onPress={handleSeedFirebase}>
          <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
          <Text style={styles.seedBtnText}>
            Firebase'e Seed Et ({ALL_WORDS.length})
          </Text>
        </TouchableOpacity>
      )}

      {/* Kelime Listesi */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            {selectedLevel} — {filtered.length} kelime
            {search ? ` (arama: "${search}")` : ""}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.wordCard}>
            <View style={styles.wordCardLeft}>
              <Text style={styles.wordText}>{item.word}</Text>
              <Text style={styles.wordTr}>{item.translation}</Text>
              <Text style={styles.wordExample} numberOfLines={1}>
                {item.example}
              </Text>
            </View>
            <View style={styles.wordCardRight}>
              <View
                style={[
                  styles.posBadge,
                  { backgroundColor: LEVEL_COLORS[item.level] + "20" },
                ]}
              >
                <Text
                  style={[styles.posText, { color: LEVEL_COLORS[item.level] }]}
                >
                  {item.partOfSpeech?.slice(0, 4)}
                </Text>
              </View>
              <Text style={styles.catText}>{item.category}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Kelime bulunamadı</Text>
          </View>
        }
      />
    </SafeAreaView>
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
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  headerCount: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    margin: SPACING.md,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { marginRight: SPACING.sm },
  searchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    paddingVertical: SPACING.md,
  },

  // ── Seviye grid: 3 sütun, büyük butonlar ──
  levelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  levelChip: {
    // her satırda 3 buton: (ekran - 2*pad - 2*gap) / 3
    width: "31%",
    height: 60,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  levelChipLabel: { fontSize: 18, fontWeight: "900" },
  levelChipCount: { fontSize: 11, fontWeight: "600" },

  // Seed butonu
  seedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: "#FF6B35",
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  seedBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  seedingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
  },
  seedingText: { color: COLORS.textSecondary, fontWeight: "600" },

  // Liste
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.xxxl },
  listHeader: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.sm,
    fontWeight: "600",
  },

  wordCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wordCardLeft: { flex: 1, gap: 2 },
  wordText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  wordTr: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  wordExample: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
  },
  wordCardRight: { alignItems: "flex-end", gap: 4 },
  posBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  posText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  catText: { color: COLORS.textMuted, fontSize: 9 },

  emptyBox: { padding: SPACING.xxxl, alignItems: "center" },
  emptyText: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
});
