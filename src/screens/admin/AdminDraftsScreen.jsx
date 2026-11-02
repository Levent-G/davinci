// src/screens/admin/AdminDraftsScreen.jsx
// Toplu içe aktarılan, onay bekleyen kelimeler (Firestore `wordDrafts`).
// Onaylanan kelime ortak `words` koleksiyonuna taşınır ve tüm projelerde
// görünür hale gelir; silinen taslak hiçbir yere eklenmez.
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { useApp } from "../../context/AppContext";
import {
  getWordDrafts,
  approveWordDrafts,
  deleteWordDraft,
  updateWordDraft,
} from "../../services/firebase";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_COLORS = {
  A1: "#4ECDC4",
  A2: "#45B7D1",
  B1: "#96C93D",
  B2: "#F9CA24",
  C1: "#F0932B",
  C2: "#E17055",
};

export default function AdminDraftsScreen({ navigation }) {
  const { actions } = useApp();
  const [drafts, setDrafts] = useState(null);
  const [level, setLevel] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const list = await getWordDrafts();
    setDrafts(list);
    if (list?.length && !level) {
      setLevel(LEVELS.find((l) => list.some((d) => d.level === l)) || null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const visible = (drafts || [])
    .filter((d) => !level || d.level === level)
    .sort((a, b) => a.word.localeCompare(b.word));

  const approve = async (list) => {
    setBusy(true);
    const ok = await approveWordDrafts(list);
    setBusy(false);
    if (!ok) {
      Alert.alert("Hata", "Onaylanamadı. Bağlantını ve yetkini kontrol et.");
      return;
    }
    const ids = new Set(list.map((d) => d.id));
    setDrafts((ds) => ds.filter((d) => !ids.has(d.id)));
    actions.refreshFirestoreWords();
  };

  const approveAll = () => {
    if (!visible.length) return;
    Alert.alert(
      "Hepsini onayla",
      `${level || "Tüm"} seviyesindeki ${visible.length} kelime bütün uygulamalarda yayınlanacak.`,
      [
        { text: "Vazgeç", style: "cancel" },
        { text: "Onayla", onPress: () => approve(visible) },
      ]
    );
  };

  const remove = (d) => {
    Alert.alert("Taslağı sil", `"${d.word}" eklenmeyecek.`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          if (await deleteWordDraft(d.id)) {
            setDrafts((ds) => ds.filter((x) => x.id !== d.id));
          }
        },
      },
    ]);
  };

  const saveField = async (d, field, value) => {
    const v = value.trim();
    if (!v || v === d[field]) return;
    const updates = { [field]: v };
    if (field === "translation") {
      // parantez içindeki virgülde bölme: "gerilim (film, roman)"
      updates.meanings = v.split(/,\s*(?![^()]*\))/).filter(Boolean);
    }
    if (await updateWordDraft(d.id, updates)) {
      setDrafts((ds) => ds.map((x) => (x.id === d.id ? { ...x, ...updates } : x)));
    }
  };

  const renderItem = ({ item: d }) => (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.word}>{d.word}</Text>
        <View style={[styles.badge, { backgroundColor: LEVEL_COLORS[d.level] }]}>
          <Text style={styles.badgeText}>{d.level}</Text>
        </View>
        {d.ipa ? <Text style={styles.ipa}>/{d.ipa}/</Text> : null}
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => remove(d)} style={styles.iconBtn}>
          <Ionicons name="trash-outline" size={18} color={COLORS.textMuted} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => approve([d])}
          style={[styles.iconBtn, styles.okBtn]}
          disabled={busy}
        >
          <Ionicons name="checkmark" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <TextInput
        style={styles.trInput}
        defaultValue={d.translation}
        onEndEditing={(e) => saveField(d, "translation", e.nativeEvent.text)}
        placeholder="Türkçe"
        placeholderTextColor={COLORS.textMuted}
      />
      <Text style={styles.example}>{d.example}</Text>
      <TextInput
        style={styles.exampleTr}
        defaultValue={d.exampleTr}
        onEndEditing={(e) => saveField(d, "exampleTr", e.nativeEvent.text)}
        multiline
        placeholderTextColor={COLORS.textMuted}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Taslak Kelimeler</Text>
        <Text style={styles.count}>{drafts ? drafts.length : ""}</Text>
      </View>

      <View style={styles.levels}>
        {LEVELS.map((l) => {
          const n = (drafts || []).filter((d) => d.level === l).length;
          return (
            <TouchableOpacity
              key={l}
              onPress={() => setLevel(l)}
              style={[styles.levelChip, level === l && { backgroundColor: LEVEL_COLORS[l] }]}
            >
              <Text style={[styles.levelText, level === l && styles.levelTextOn]}>
                {l} {n ? `(${n})` : ""}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {drafts === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : drafts.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.empty}>Onay bekleyen kelime yok.</Text>
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.allBtn} onPress={approveAll} disabled={busy || !visible.length}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.allText}>
                {level} seviyesindeki {visible.length} kelimeyi onayla
              </Text>
            )}
          </TouchableOpacity>
          <FlatList
            data={visible}
            keyExtractor={(d) => d.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: SPACING.md, paddingBottom: SPACING.xxxl }}
            keyboardShouldPersistTaps="handled"
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  title: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: "700", flex: 1 },
  count: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
  levels: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, paddingHorizontal: SPACING.md },
  levelChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.backgroundCard,
  },
  levelText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, fontWeight: "600" },
  levelTextOn: { color: "#fff" },
  allBtn: {
    margin: SPACING.md,
    marginBottom: 0,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  allText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  card: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  word: { color: COLORS.textPrimary, fontSize: FONT_SIZES.lg, fontWeight: "700" },
  badge: { borderRadius: RADIUS.sm, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: "#fff", fontSize: FONT_SIZES.xs, fontWeight: "700" },
  ipa: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  iconBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  okBtn: { backgroundColor: COLORS.accent },
  trInput: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 4,
    marginTop: SPACING.xs,
  },
  example: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm, marginTop: SPACING.sm },
  exampleTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm, paddingVertical: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
});
