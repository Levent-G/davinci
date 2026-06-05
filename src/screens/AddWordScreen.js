// src/screens/AddWordScreen.jsx
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_COLORS = {
  A1: COLORS.levelA1,
  A2: COLORS.levelA2,
  B1: COLORS.levelB1,
  B2: COLORS.levelB2,
  C1: COLORS.levelC1,
  C2: COLORS.levelC2,
};

export default function AddWordScreen({ navigation }) {
  const { actions } = useApp();

  const [form, setForm] = useState({
    word: "",
    translation: "",
    phonetic: "",
    level: "A1",
    example: "",
    exampleTr: "",
    hint: "",
    memoryTip: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.word.trim() || !form.translation.trim()) {
      Alert.alert("Eksik Bilgi", "Kelime ve çevirisi zorunlu alanlardır.");
      return;
    }
    setIsSaving(true);
    try {
      await actions.addCustomWord({
        ...form,
        word: form.word.trim(),
        translation: form.translation.trim(),
        phonetic: form.phonetic.trim() || `/${form.word.toLowerCase()}/`,
        example: form.example.trim() || `I know the word ${form.word}.`,
        exampleTr:
          form.exampleTr.trim() || `${form.word} kelimesini biliyorum.`,
        hint: form.hint.trim(),
        memoryTip: form.memoryTip.trim(),
      });
      Alert.alert("✅ Kaydedildi", `"${form.word}" kelimesi eklendi!`, [
        { text: "Tamam", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Hata", "Kelime kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kelime Ekle</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnText}>Kaydet</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Required Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zorunlu Alanlar</Text>
            <FormInput
              label="İngilizce Kelime *"
              value={form.word}
              onChangeText={(v) => update("word", v)}
              placeholder="Örn: serendipity"
            />
            <FormInput
              label="Türkçe Çeviri *"
              value={form.translation}
              onChangeText={(v) => update("translation", v)}
              placeholder="Örn: güzel tesadüf"
            />
          </View>

          {/* Level */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Seviye</Text>
            <View style={styles.levelRow}>
              {LEVELS.map((lvl) => (
                <TouchableOpacity
                  key={lvl}
                  style={[
                    styles.levelChip,
                    form.level === lvl && {
                      backgroundColor: LEVEL_COLORS[lvl] + "25",
                      borderColor: LEVEL_COLORS[lvl],
                    },
                  ]}
                  onPress={() => update("level", lvl)}
                >
                  <Text
                    style={[
                      styles.levelChipText,
                      form.level === lvl && { color: LEVEL_COLORS[lvl] },
                    ]}
                  >
                    {lvl}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Optional Fields */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ek Bilgiler (İsteğe Bağlı)</Text>
            <FormInput
              label="Telaffuz"
              value={form.phonetic}
              onChangeText={(v) => update("phonetic", v)}
              placeholder="/sɛr.ənˈdɪp.ɪ.ti/"
            />
            <FormInput
              label="Örnek Cümle (İngilizce)"
              value={form.example}
              onChangeText={(v) => update("example", v)}
              placeholder="Finding this app was serendipity."
              multiline
            />
            <FormInput
              label="Örnek Cümle (Türkçe)"
              value={form.exampleTr}
              onChangeText={(v) => update("exampleTr", v)}
              placeholder="Bu uygulamayı bulmak güzel bir tesadüftü."
              multiline
            />
            <FormInput
              label="İpucu"
              value={form.hint}
              onChangeText={(v) => update("hint", v)}
              placeholder="Beklenmedik güzel şeyler bulmak"
              multiline
            />
            <FormInput
              label="Hafıza İpucu"
              value={form.memoryTip}
              onChangeText={(v) => update("memoryTip", v)}
              placeholder="Seren-dipiti: serenatla buluşan ..."
              multiline
            />
          </View>

          {/* Tip */}
          <View style={styles.tipBox}>
            <Text style={styles.tipTitle}>💡 Da Vinci İpucu</Text>
            <Text style={styles.tipText}>
              Hafıza ipucu eklemen, Da Vinci metodunun 3. aşamasında
              (Görselleştirme) bu kelimeyi çok daha etkili öğrenmeni sağlar.
            </Text>
          </View>

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormInput({ label, value, onChangeText, placeholder, multiline }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textMuted}
        multiline={multiline}
        numberOfLines={multiline ? 3 : 1}
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
  closeBtn: {
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
  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },

  scroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.lg },
  section: { marginBottom: SPACING.xl, gap: SPACING.sm },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  fieldContainer: { gap: SPACING.xs },
  fieldLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  input: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: "top" },

  levelRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  levelChip: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  levelChipText: {
    color: COLORS.textSecondary,
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },

  tipBox: {
    backgroundColor: COLORS.accentGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
  },
  tipTitle: {
    color: COLORS.accent,
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
  },
  tipText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
});
