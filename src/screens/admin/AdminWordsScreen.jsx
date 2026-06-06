// src/screens/admin/AdminWordsScreen.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  COLORS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  SHADOWS,
} from "../../utils/theme";
import {
  getFirestoreWords,
  addFirestoreWord,
  updateFirestoreWord,
  deleteFirestoreWord,
  updateWordImage,
  seedWordsToFirestore,
} from "../../services/firebase";
import { ALL_WORDS } from "../../data/wordDatabase";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_COLORS = {
  A1: COLORS.levelA1,
  A2: COLORS.levelA2,
  B1: COLORS.levelB1,
  B2: COLORS.levelB2,
  C1: COLORS.levelC1,
  C2: COLORS.levelC2,
};

const EMPTY_FORM = {
  word: "",
  translation: "",
  phonetic: "",
  level: "A1",
  example: "",
  exampleTr: "",
  hint: "",
  memoryTip: "",
  imageUrl: "",
};

export default function AdminWordsScreen({ navigation }) {
  const [words, setWords] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevel] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModal] = useState(false);
  const [editWord, setEditWord] = useState(null); // null = yeni kelime
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [source, setSource] = useState("firestore"); // 'firestore' | 'local'

  useEffect(() => {
    loadWords();
  }, [source]);

  useEffect(() => {
    let result = words;
    if (levelFilter !== "ALL")
      result = result.filter((w) => w.level === levelFilter);
    if (search.trim())
      result = result.filter(
        (w) =>
          w.word.toLowerCase().includes(search.toLowerCase()) ||
          w.translation.toLowerCase().includes(search.toLowerCase())
      );
    setFiltered(result);
  }, [words, search, levelFilter]);

  const loadWords = async () => {
    setLoading(true);
    if (source === "local") {
      setWords(ALL_WORDS);
    } else {
      const fw = await getFirestoreWords();
      setWords(fw.length > 0 ? fw : ALL_WORDS); // fallback to local
    }
    setLoading(false);
  };

  const openAdd = () => {
    setEditWord(null);
    setForm(EMPTY_FORM);
    setModal(true);
  };

  const openEdit = (word) => {
    setEditWord(word);
    setForm({ ...EMPTY_FORM, ...word });
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.word.trim() || !form.translation.trim()) {
      Alert.alert("Hata", "Kelime ve çeviri zorunludur.");
      return;
    }
    setSaving(true);
    try {
      if (editWord) {
        await updateFirestoreWord(editWord.id, form);
        setWords((prev) =>
          prev.map((w) => (w.id === editWord.id ? { ...w, ...form } : w))
        );
        Alert.alert("✅", "Kelime güncellendi.");
      } else {
        const newWord = await addFirestoreWord(form);
        if (newWord) setWords((prev) => [newWord, ...prev]);
        Alert.alert("✅", "Kelime eklendi.");
      }
      setModal(false);
    } catch {
      Alert.alert("Hata", "Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (word) => {
    Alert.alert("Kelimeyi Sil", `"${word.word}" silinsin mi?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await deleteFirestoreWord(word.id);
          setWords((prev) => prev.filter((w) => w.id !== word.id));
        },
      },
    ]);
  };

  const handleImageUrl = async (word) => {
    Alert.prompt
      ? Alert.prompt("Görsel URL", "Yeni görsel URL gir:", async (url) => {
          if (url) {
            await updateWordImage(word.id, url);
            setWords((prev) =>
              prev.map((w) => (w.id === word.id ? { ...w, imageUrl: url } : w))
            );
          }
        })
      : Alert.alert("Görsel URL", "Form alanından güncelleyebilirsin.");
  };

  const renderWord = ({ item }) => (
    <View style={styles.wordCard}>
      <View style={styles.wordCardLeft}>
        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.wordThumb} />
        ) : (
          <View
            style={[
              styles.wordThumbPlaceholder,
              { backgroundColor: LEVEL_COLORS[item.level] + "20" },
            ]}
          >
            <Text style={styles.wordThumbLevel}>{item.level}</Text>
          </View>
        )}
        <View style={styles.wordInfo}>
          <Text style={styles.wordText}>{item.word}</Text>
          <Text style={styles.wordTr}>{item.translation}</Text>
          <View
            style={[
              styles.levelBadge,
              { backgroundColor: LEVEL_COLORS[item.level] + "25" },
            ]}
          >
            <Text
              style={[
                styles.levelBadgeText,
                { color: LEVEL_COLORS[item.level] },
              ]}
            >
              {item.level}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.wordActions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => openEdit(item)}
        >
          <Ionicons name="pencil" size={16} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => handleImageUrl(item)}
        >
          <Ionicons name="image" size={16} color={COLORS.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: COLORS.errorGlow }]}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash" size={16} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

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
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Source toggle */}
      <View style={styles.sourceRow}>
        {["firestore", "local"].map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.sourceChip, source === s && styles.sourceChipActive]}
            onPress={() => setSource(s)}
          >
            <Text
              style={[
                styles.sourceChipText,
                source === s && { color: COLORS.accent },
              ]}
            >
              {s === "firestore" ? "☁️ Firebase" : "📱 Lokal"}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.wordCount}>{filtered.length} kelime</Text>
      </View>

      {/* Seed butonu */}
      {source === "firestore" && words.length === 0 && !loading && (
        <TouchableOpacity
          style={styles.seedBtn}
          onPress={async () => {
            setLoading(true);
            const { ALL_WORDS } = require("../../data/wordDatabase");
            const ok = await seedWordsToFirestore(ALL_WORDS);
            if (ok) {
              Alert.alert("Basarili", "Kelimeler Firebase yüklendi!");
              loadWords();
            } else {
              Alert.alert("Hata", "Yükleme basarisiz.");
              setLoading(false);
            }
          }}
        >
          <Text style={styles.seedBtnText}>Kelimeleri Firebase Yukle</Text>
        </TouchableOpacity>
      )}

      {/* Arama */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Kelime ara..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Seviye filtresi */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.levelRow}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          gap: SPACING.sm,
          alignItems: "center",
        }}
      >
        {["ALL", ...LEVELS].map((l) => (
          <TouchableOpacity
            key={l}
            style={[
              styles.levelChip,
              levelFilter === l && {
                backgroundColor: (LEVEL_COLORS[l] || COLORS.accent) + "25",
                borderColor: LEVEL_COLORS[l] || COLORS.accent,
              },
            ]}
            onPress={() => setLevel(l)}
          >
            <Text
              style={[
                styles.levelChipText,
                levelFilter === l && {
                  color: LEVEL_COLORS[l] || COLORS.accent,
                },
              ]}
            >
              {l}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderWord}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📭</Text>
              <Text style={styles.emptyText}>Kelime bulunamadı</Text>
            </View>
          }
        />
      )}

      {/* Ekle/Düzenle Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editWord ? "Kelimeyi Düzenle" : "Yeni Kelime Ekle"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : (
                <Text style={styles.modalSave}>Kaydet</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Field
              label="Kelime *"
              value={form.word}
              onChange={(v) => setForm((p) => ({ ...p, word: v }))}
              placeholder="Örn: serendipity"
            />
            <Field
              label="Çeviri *"
              value={form.translation}
              onChange={(v) => setForm((p) => ({ ...p, translation: v }))}
              placeholder="güzel tesadüf"
            />
            <Field
              label="Telaffuz"
              value={form.phonetic}
              onChange={(v) => setForm((p) => ({ ...p, phonetic: v }))}
              placeholder="/sɛr.ənˈdɪp.ɪ.ti/"
            />

            {/* Seviye seçici */}
            <Text style={styles.fieldLabel}>Seviye</Text>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: SPACING.sm,
                marginBottom: SPACING.md,
              }}
            >
              {LEVELS.map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[
                    styles.levelChipLarge,
                    form.level === l && {
                      backgroundColor: LEVEL_COLORS[l] + "30",
                      borderColor: LEVEL_COLORS[l],
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setForm((p) => ({ ...p, level: l }))}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.levelChipTextLarge,
                      {
                        color:
                          form.level === l
                            ? LEVEL_COLORS[l]
                            : COLORS.textSecondary,
                      },
                    ]}
                  >
                    {l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Field
              label="Örnek Cümle (EN)"
              value={form.example}
              onChange={(v) => setForm((p) => ({ ...p, example: v }))}
              multiline
            />
            <Field
              label="Örnek Cümle (TR)"
              value={form.exampleTr}
              onChange={(v) => setForm((p) => ({ ...p, exampleTr: v }))}
              multiline
            />
            <Field
              label="İpucu"
              value={form.hint}
              onChange={(v) => setForm((p) => ({ ...p, hint: v }))}
              multiline
            />
            <Field
              label="Hafıza İpucu"
              value={form.memoryTip}
              onChange={(v) => setForm((p) => ({ ...p, memoryTip: v }))}
              multiline
            />
            <Field
              label="Görsel URL"
              value={form.imageUrl}
              onChange={(v) => setForm((p) => ({ ...p, imageUrl: v }))}
              placeholder="https://..."
            />

            {form.imageUrl ? (
              <Image
                source={{ uri: form.imageUrl }}
                style={styles.imagePreview}
                resizeMode="cover"
              />
            ) : null}

            <View style={{ height: SPACING.xxxl }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Field({ label, value, onChange, placeholder, multiline }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          multiline && { minHeight: 72, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        multiline={multiline}
      />
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  sourceChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sourceChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentGlow,
  },
  sourceChipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  wordCount: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    marginLeft: "auto",
  },
  seedBtn: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
  },
  seedBtnText: {
    color: COLORS.accent,
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZES.md },
  levelRow: { flexGrow: 0, marginBottom: SPACING.sm },
  levelChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelChipLarge: {
    width: 72,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelChipTextLarge: { fontWeight: "800", fontSize: FONT_SIZES.md },
  levelChipText: {
    color: COLORS.textSecondary,
    fontWeight: "700",
    fontSize: FONT_SIZES.sm,
  },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },

  wordCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  wordCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  wordThumb: { width: 48, height: 48, borderRadius: RADIUS.md },
  wordThumbPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  wordThumbLevel: { fontWeight: "800", fontSize: FONT_SIZES.xs },
  wordInfo: { flex: 1, gap: 2 },
  wordText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  wordTr: { color: COLORS.accent, fontSize: FONT_SIZES.sm },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  levelBadgeText: { fontSize: 10, fontWeight: "700" },
  wordActions: { flexDirection: "row", gap: SPACING.xs },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.backgroundCardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingTop: SPACING.xxxl, gap: SPACING.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.lg },

  // Modal
  modal: { flex: 1, backgroundColor: COLORS.background },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  modalSave: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  modalContent: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  fieldContainer: { marginBottom: SPACING.md },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    marginBottom: SPACING.xs,
  },
  fieldInput: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  imagePreview: {
    width: "100%",
    height: 160,
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
});
