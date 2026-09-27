// src/screens/admin/AdminEditWordScreen.jsx
import React, { useState, useEffect } from "react";
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
  Image,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { useApp } from "../../context/AppContext";
import { updateFirestoreWord } from "../../services/firebase";
import { uploadWordImage, deleteWordImageByUrl } from "../../services/uploadImage";
import {
  getWordPhotos,
  addWordPhoto,
  removeWordPhoto,
  setActiveWordPhoto,
} from "../../services/wordPhotos";

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"];
const LEVEL_COLORS = {
  A1: COLORS.levelA1,
  A2: COLORS.levelA2,
  B1: COLORS.levelB1,
  B2: COLORS.levelB2,
  C1: COLORS.levelC1,
  C2: COLORS.levelC2,
};

export default function AdminEditWordScreen({ navigation, route }) {
  const { actions } = useApp();
  const word = route.params?.word;

  const [form, setForm] = useState({
    word: word?.word || "",
    translation: word?.translation || "",
    example: word?.example || "",
    exampleTr: word?.exampleTr || "",
    category: word?.category || "",
    partOfSpeech: word?.partOfSpeech || "",
    level: word?.level || "A1",
  });
  // Kelimenin Firestore'daki KALICI foto havuzu. Boşsa (kelime ilk kez
  // açılıyorsa) Pexels'ten çekilip bir daha hiç sorulmamak üzere Firestore'a
  // yazılır — bkz. services/wordPhotos.js.
  const [photos, setPhotos] = useState(word?.photos || []);
  const [activeUrl, setActiveUrl] = useState(word?.imageUrl || null);
  const [photosLoading, setPhotosLoading] = useState(!word?.photos?.length);
  const [settingOption, setSettingOption] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingUrl, setDeletingUrl] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (word?.photos?.length) return; // zaten Firestore'dan geldi, tekrar çekmeye gerek yok
    (async () => {
      const result = await getWordPhotos(word);
      setPhotos(result.photos);
      setActiveUrl(result.activeUrl);
      setPhotosLoading(false);
    })();
  }, []);

  // wordPhotos.js fonksiyonları güncel photos/imageUrl'e ihtiyaç duyuyor —
  // route.params.word bayatlamış olabileceğinden, o an ekranda gördüğümüz
  // güncel state'ten taze bir kopya oluşturuyoruz.
  const currentWordSnapshot = () => ({
    id: word.id,
    photos,
    imageUrl: activeUrl,
  });

  const handleSelectPhoto = async (url) => {
    if (url === activeUrl) return;
    setSettingOption(true);
    try {
      await setActiveWordPhoto(word.id, url);
      setActiveUrl(url);
      await actions.refreshFirestoreWords();
    } catch (e) {
      Alert.alert("Hata", e?.message || "Fotoğraf ayarlanamadı.");
    } finally {
      setSettingOption(false);
    }
  };

  const handleDeletePhoto = (url) => {
    Alert.alert(
      "Fotoğrafı Kaldır",
      "Bu fotoğraf havuzdan tamamen silinecek. Emin misin?",
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Kaldır",
          style: "destructive",
          onPress: async () => {
            setDeletingUrl(url);
            try {
              const result = await removeWordPhoto(currentWordSnapshot(), url);
              await deleteWordImageByUrl(url).catch(() => {});
              setPhotos(result.photos);
              setActiveUrl(result.activeUrl);
              await actions.refreshFirestoreWords();
            } catch (e) {
              Alert.alert("Hata", e?.message || "Fotoğraf kaldırılamadı.");
            } finally {
              setDeletingUrl(null);
            }
          },
        },
      ]
    );
  };

  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("İzin Gerekli", "Fotoğraf seçmek için galeri izni vermelisin.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled) return;

    setUploadingPhoto(true);
    try {
      // Havuzdaki kaçıncı fotoğraf olacağı, Storage'da benzersiz bir dosya
      // adı üretmek için kullanılıyor (word.id tek başına aynı kelimeye
      // eklenen önceki özel fotoğrafların üzerine yazardı).
      const url = await uploadWordImage(
        result.assets[0].uri,
        `${word.id}_${Date.now()}`
      );
      const updatedPhotos = await addWordPhoto(currentWordSnapshot(), url);
      setPhotos(updatedPhotos);
      setActiveUrl(url);
      await actions.refreshFirestoreWords();
    } catch (e) {
      Alert.alert("Hata", e?.message || "Fotoğraf yüklenemedi.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!form.word.trim() || !form.translation.trim()) {
      Alert.alert("Eksik Bilgi", "Kelime ve çevirisi zorunlu alanlardır.");
      return;
    }
    setIsSaving(true);
    try {
      const ok = await updateFirestoreWord(word.id, form);
      if (!ok) throw new Error();
      await actions.refreshFirestoreWords();
      Alert.alert("✅ Kaydedildi", `"${form.word}" güncellendi!`, [
        { text: "Tamam", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Hata", "Kelime güncellenemedi.");
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
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Kelimeyi Düzenle</Text>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveBtn, isSaving && { opacity: 0.6 }]}
            disabled={isSaving}
          >
            <Text style={styles.saveBtnText}>
              {isSaving ? "Kaydediliyor" : "Kaydet"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Fotoğraf */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Fotoğraf</Text>
            <View style={styles.photoBox}>
              {photosLoading ? (
                <ActivityIndicator color={COLORS.accent} />
              ) : activeUrl ? (
                <Image source={{ uri: activeUrl }} style={styles.photo} />
              ) : (
                <Ionicons
                  name="image-outline"
                  size={40}
                  color={COLORS.textMuted}
                />
              )}
            </View>
            <Text style={styles.photoCaption}>
              {photosLoading
                ? "Bu kelime ilk kez açılıyor, Pexels'ten fotoğraf çekilip kalıcı olarak kaydediliyor..."
                : "Bu kelimenin fotoğraf havuzu — birine dokunarak aktif yapabilir, çöp kutusuyla havuzdan silebilir ya da kendi fotoğrafını ekleyebilirsin."}
            </Text>

            {photos.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.optionsRow}
              >
                {photos.map((url, i) => {
                  const active = activeUrl === url;
                  const deleting = deletingUrl === url;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.optionThumb,
                        active && styles.optionThumbActive,
                      ]}
                      onPress={() => handleSelectPhoto(url)}
                      disabled={settingOption || deleting}
                    >
                      <Image source={{ uri: url }} style={styles.optionImg} />
                      {deleting ? (
                        <View style={styles.optionOverlay}>
                          <ActivityIndicator size="small" color="#fff" />
                        </View>
                      ) : (
                        <>
                          {active && (
                            <View style={styles.optionCheck}>
                              <Ionicons
                                name="checkmark-circle"
                                size={18}
                                color={COLORS.accent}
                              />
                            </View>
                          )}
                          <TouchableOpacity
                            style={styles.optionDelete}
                            onPress={() => handleDeletePhoto(url)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="close" size={12} color="#fff" />
                          </TouchableOpacity>
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.photoBtnRow}>
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={handlePickPhoto}
                disabled={uploadingPhoto}
              >
                {uploadingPhoto ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="images-outline" size={16} color="#fff" />
                    <Text style={styles.photoBtnText}>
                      Galeriden Fotoğraf Ekle
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Zorunlu Alanlar */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Zorunlu Alanlar</Text>
            <FormInput
              label="İngilizce Kelime *"
              value={form.word}
              onChangeText={(v) => update("word", v)}
            />
            <FormInput
              label="Türkçe Çeviri *"
              value={form.translation}
              onChangeText={(v) => update("translation", v)}
            />
          </View>

          {/* Seviye */}
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

          {/* Ek Bilgiler */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Ek Bilgiler</Text>
            <FormInput
              label="Örnek Cümle (İngilizce)"
              value={form.example}
              onChangeText={(v) => update("example", v)}
              multiline
            />
            <FormInput
              label="Örnek Cümle (Türkçe)"
              value={form.exampleTr}
              onChangeText={(v) => update("exampleTr", v)}
              multiline
            />
            <FormInput
              label="Kategori"
              value={form.category}
              onChangeText={(v) => update("category", v)}
            />
            <FormInput
              label="Sözcük Türü"
              value={form.partOfSpeech}
              onChangeText={(v) => update("partOfSpeech", v)}
            />
          </View>

          <View style={{ height: SPACING.xxxl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormInput({ label, value, onChangeText, multiline }) {
  return (
    <View style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChangeText}
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

  photoBox: {
    width: "100%",
    height: 160,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.backgroundCard,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  photo: { width: "100%", height: "100%" },
  photoCaption: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    lineHeight: 16,
  },
  optionsRow: { flexDirection: "row", gap: SPACING.sm },
  optionThumb: {
    width: 70,
    height: 70,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "transparent",
  },
  optionThumbActive: { borderColor: COLORS.accent },
  optionImg: { width: "100%", height: "100%" },
  optionCheck: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.background,
    borderRadius: 10,
  },
  optionDelete: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },

  photoBtnRow: { flexDirection: "row", gap: SPACING.sm },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.accent,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
  },
  photoBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.sm },

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
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },

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
});
