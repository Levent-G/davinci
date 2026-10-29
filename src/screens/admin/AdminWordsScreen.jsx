// src/screens/admin/AdminWordsScreen.jsx
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
import { ALL_WORDS } from "../../data/wordDatabase";
import { useApp } from "../../context/AppContext";
import {
  getFirestoreWords,
  getLastWordsError,
  getLastInitError,
  deleteFirestoreWord,
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

export default function AdminWordsScreen({ navigation }) {
  const { state, actions } = useApp();
  const [selectedLevel, setSelectedLevel] = useState("A1");
  const [search, setSearch] = useState("");
  const [onlyMissingPhoto, setOnlyMissingPhoto] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Bir kelimeyi düzenleyip geri dönüldüğünde (fotoğraf ekleme/kaldırma dahil)
  // liste her zaman Firebase'deki en güncel veriyi göstersin diye, ekran her
  // odaklandığında (focus) taze veri çekiyoruz — context'teki fire-and-forget
  // yenilemeye güvenmek yerine garantili bir tazeleme.
  useFocusEffect(
    useCallback(() => {
      actions.refreshFirestoreWords();
    }, [])
  );

  // Firebase'e seed edildiyse oradaki (admin'in düzenlemiş olabileceği,
  // fotoğraflı) sürüm kullanılır — yoksa uygulamayla birlikte paketlenen
  // yerel liste (bkz. AppContext.getAllWords ile aynı öncelik).
  const fromFirestore = !!state.firestoreWords?.length;
  const words = fromFirestore ? state.firestoreWords : ALL_WORDS;

  const handleRetry = async () => {
    setRetrying(true);
    const list = await getFirestoreWords();
    setRetrying(false);
    if (list.length > 0) {
      await actions.refreshFirestoreWords();
      Alert.alert("Yüklendi", `${list.length} kelime Firebase'den alındı.`);
    } else {
      const initErr = getLastInitError();
      Alert.alert(
        "Firebase'den kelime alınamadı",
        `${getLastWordsError() || "Sunucu boş sonuç döndürdü."}${
          initErr ? `\n\nBaşlatma hatası: ${initErr}` : ""
        }`
      );
    }
  };
  const handleDelete = (item) => {
    Alert.alert(
      "Kelimeyi Sil",
      `"${item.word}" kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: async () => {
            const ok = await deleteFirestoreWord(item.id);
            if (ok) {
              await actions.refreshFirestoreWords();
            } else {
              Alert.alert("Hata", "Kelime silinemedi, tekrar dene.");
            }
          },
        },
      ]
    );
  };

  const levelWords = words.filter((w) => w.level === selectedLevel);
  const photographedCount = levelWords.filter((w) => w.imageUrl).length;

  const filtered = levelWords.filter((w) => {
    const matchSearch =
      search.trim() === "" ||
      w.word.toLowerCase().includes(search.toLowerCase()) ||
      w.translation.toLowerCase().includes(search.toLowerCase());
    const matchPhoto = !onlyMissingPhoto || !w.imageUrl;
    return matchSearch && matchPhoto;
  });

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

      {/* Fotoğrafsız kelimeleri hızlıca bulma filtresi */}
      <TouchableOpacity
        style={[
          styles.photoFilterChip,
          onlyMissingPhoto && styles.photoFilterChipActive,
        ]}
        onPress={() => setOnlyMissingPhoto((v) => !v)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={onlyMissingPhoto ? "checkbox" : "square-outline"}
          size={16}
          color={onlyMissingPhoto ? COLORS.accent : COLORS.textMuted}
        />
        <Text
          style={[
            styles.photoFilterText,
            onlyMissingPhoto && { color: COLORS.accent },
          ]}
        >
          Sadece özel fotoğrafı olmayanları göster
        </Text>
      </TouchableOpacity>

      {!fromFirestore && (
        <TouchableOpacity
          style={styles.warnBanner}
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.8}
        >
          {retrying ? (
            <ActivityIndicator size="small" color={COLORS.warning} />
          ) : (
            <Ionicons name="cloud-offline-outline" size={16} color={COLORS.warning} />
          )}
          <Text style={styles.warnBannerText}>
            Kelimeler Firebase'den yüklenemedi, yerel liste gösteriliyor
            (yüklenen fotoğraflar görünmez). Dokunarak tekrar dene.
          </Text>
        </TouchableOpacity>
      )}

      {/* Seviye Seçici — 3x2 grid, büyük butonlar */}
      <View style={styles.levelGrid}>
        {LEVELS.map((lvl) => {
          const active = selectedLevel === lvl;
          const color = LEVEL_COLORS[lvl];
          const count = words.filter((w) => w.level === lvl).length;
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

      {/* Kelime Listesi */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            {selectedLevel} — {filtered.length} kelime · {photographedCount}/
            {levelWords.length} fotoğraflı
            {search ? ` (arama: "${search}")` : ""}
          </Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.wordCard}
            activeOpacity={0.7}
            onPress={() => navigation.navigate("AdminEditWord", { word: item })}
          >
            <View style={styles.wordCardLeft}>
              <View style={styles.wordTitleRow}>
                <Text style={styles.wordText}>{item.word}</Text>
                {item.imageUrl && (
                  <Ionicons name="image" size={13} color={COLORS.accent} />
                )}
              </View>
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
            <TouchableOpacity
              style={styles.deleteBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => handleDelete(item)}
            >
              <Ionicons
                name="trash-outline"
                size={18}
                color={COLORS.error}
              />
            </TouchableOpacity>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={COLORS.textMuted}
            />
          </TouchableOpacity>
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

  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.warning + "80",
    backgroundColor: COLORS.warning + "15",
  },
  warnBannerText: { flex: 1, color: COLORS.warning, fontSize: FONT_SIZES.xs },
  photoFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photoFilterChipActive: { borderColor: COLORS.accent + "60" },
  photoFilterText: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },

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
    gap: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  wordCardLeft: { flex: 1, gap: 2 },
  wordTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
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
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.errorGlow,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyBox: { padding: SPACING.xxxl, alignItems: "center" },
  emptyText: { color: COLORS.textMuted, fontSize: FONT_SIZES.md },
});
