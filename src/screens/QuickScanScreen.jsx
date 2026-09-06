// src/screens/QuickScanScreen.jsx
// Hızlı Tarama — kullanıcı hangi kelimeleri bildiğini işaretler
// Bilinenlere knownByUser:true basılır, bilinmeyenler öğrenme havuzuna girer

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { speakWord } from "../utils/textToSpeech";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.3;

const LEVEL_COLORS = {
  A1: "#4ECDC4",
  A2: "#45B7D1",
  B1: "#96C93D",
  B2: "#F9CA24",
  C1: "#F0932B",
  C2: "#E17055",
};

export default function QuickScanScreen({ navigation, route }) {
  const { words = [], level = "A1" } = route.params || {};
  const { state, actions } = useApp();

  const [index, setIndex] = useState(0);
  const [knownIds, setKnownIds] = useState(new Set());
  const [unknownIds, setUnknownIds] = useState(new Set());
  const [done, setDone] = useState(false);
  const [imageUri, setImageUri] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;
  const rotation = pan.x.interpolate({
    inputRange: [-width, width],
    outputRange: ["-15deg", "15deg"],
  });
  const knowOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
  });
  const learnOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
  });

  const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

  const currentWord = words[index];

  useEffect(() => {
    if (!currentWord) return;
    setImageUri(null);
    setImgLoading(true);
    fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        currentWord.word
      )}&per_page=3&orientation=landscape`,
      { headers: { Authorization: PEXELS_KEY } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.photos?.length > 0) {
          setImageUri(data.photos[0].src.medium);
        }
      })
      .catch(() => {})
      .finally(() => setImgLoading(false));
  }, [index]);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
      useNativeDriver: false,
    }),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dx > SWIPE_THRESHOLD) {
        swipeRight(); // Biliyorum
      } else if (gesture.dx < -SWIPE_THRESHOLD) {
        swipeLeft(); // Öğreneceğim
      } else {
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      }
    },
  });

  const swipeRight = () => {
    // Biliyorum — sağa at
    Animated.timing(pan, {
      toValue: { x: width * 1.5, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      markKnown();
    });
  };

  const swipeLeft = () => {
    // Öğreneceğim — sola at
    Animated.timing(pan, {
      toValue: { x: -width * 1.5, y: 0 },
      duration: 250,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      markUnknown();
    });
  };

  const markKnown = () => {
    setKnownIds((prev) => new Set([...prev, currentWord.id]));
    next();
  };

  const markUnknown = () => {
    setUnknownIds((prev) => new Set([...prev, currentWord.id]));
    next();
  };

  const next = () => {
    if (index >= words.length - 1) {
      setDone(true);
    } else {
      setIndex((i) => i + 1);
    }
  };

  const handleFinish = async () => {
    // Bilinen kelimeleri kaydet
    for (const id of knownIds) {
      const word = words.find((w) => w.id === id);
      if (!word) continue;
      const prog = state.wordProgress[id] || {};
      const wasLearned = (prog.masteryLevel || 0) >= 3;
      await actions.updateWordProgress(id, {
        ...prog,
        correctCount: (prog.correctCount || 0) + 3,
        masteryLevel: 5,
        lastReviewDate: new Date().toISOString(),
        nextReviewDate: new Date(
          Date.now() + 60 * 24 * 60 * 60 * 1000
        ).toISOString(),
        intervalIndex: 5,
        knownByUser: true,
      });
      if (!wasLearned) await actions.recordWordLearned();
    }

    // Öğrenilmesi gereken kelimelerle oturumu başlat
    const toLearn = words.filter((w) => unknownIds.has(w.id));

    navigation.replace("LearningSession", {
      level,
      word: toLearn[0],
      mode: "learn",
    });
  };

  const color = LEVEL_COLORS[level] || COLORS.accent;

  if (done) {
    const knownCount = knownIds.size;
    const unknownCount = unknownIds.size;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.resultContainer}>
          <Text style={styles.resultEmoji}>⚡</Text>
          <Text style={styles.resultTitle}>Tarama Tamamlandı!</Text>

          <View style={styles.resultStats}>
            <View
              style={[
                styles.resultStat,
                { backgroundColor: COLORS.success + "20" },
              ]}
            >
              <Text style={[styles.resultStatNum, { color: COLORS.success }]}>
                {knownCount}
              </Text>
              <Text style={styles.resultStatLabel}>Biliyorsun</Text>
            </View>
            <View
              style={[styles.resultStat, { backgroundColor: color + "20" }]}
            >
              <Text style={[styles.resultStatNum, { color }]}>
                {unknownCount}
              </Text>
              <Text style={styles.resultStatLabel}>Öğreneceksin</Text>
            </View>
          </View>

          <Text style={styles.resultDesc}>
            {knownCount} kelime öğrenilmiş olarak işaretlendi.{"\n"}
            {unknownCount > 0
              ? `Şimdi ${Math.min(
                  unknownCount,
                  5
                )} kelimeyi Da Vinci metoduyla öğrenelim!`
              : "Bu seviyedeki tüm kelimeleri biliyorsun! 🎉"}
          </Text>

          {unknownCount > 0 ? (
            <TouchableOpacity
              style={[styles.finishBtn, { backgroundColor: color }]}
              onPress={handleFinish}
            >
              <Ionicons name="play-circle" size={22} color="#fff" />
              <Text style={styles.finishBtnText}>
                {Math.min(unknownCount, 5)} Kelimeyi Öğren →
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.finishBtn, { backgroundColor: COLORS.success }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.finishBtnText}>Geri Dön →</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!currentWord) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Hızlı Tarama</Text>
          <Text style={styles.headerSub}>
            {index + 1} / {words.length}
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Progress */}
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${(index / words.length) * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      {/* Talimat */}
      <View style={styles.instructions}>
        <View style={styles.instrItem}>
          <Ionicons name="arrow-back" size={16} color={COLORS.error} />
          <Text style={styles.instrText}>Bilmiyorum</Text>
        </View>
        <Text style={styles.instrMiddle}>Kaydır</Text>
        <View style={styles.instrItem}>
          <Text style={styles.instrText}>Biliyorum</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.success} />
        </View>
      </View>

      {/* Kart */}
      <View style={styles.cardArea}>
        {/* "Bilmiyorum" overlay */}
        <Animated.View
          style={[
            styles.overlay,
            styles.overlayLeft,
            { opacity: learnOpacity },
          ]}
        >
          <Text style={styles.overlayText}>📚 Öğreneceğim</Text>
        </Animated.View>

        {/* "Biliyorum" overlay */}
        <Animated.View
          style={[
            styles.overlay,
            styles.overlayRight,
            { opacity: knowOpacity },
          ]}
        >
          <Text style={styles.overlayText}>✅ Biliyorum</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              transform: [
                { translateX: pan.x },
                { translateY: pan.y },
                { rotate: rotation },
              ],
            },
          ]}
          {...panResponder.panHandlers}
        >
          {/* Pexels Görsel */}
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.cardImage}
              resizeMode="cover"
              onError={() => setImageUri(null)}
            />
          ) : imgLoading ? (
            <View style={styles.cardImagePlaceholder}>
              <ActivityIndicator size="small" color={color} />
            </View>
          ) : null}

          <View style={[styles.levelTag, { backgroundColor: color + "20" }]}>
            <Text style={[styles.levelTagText, { color }]}>
              {currentWord.level}
            </Text>
          </View>

          <Text style={styles.cardWord}>{currentWord.word}</Text>
          <Text style={styles.cardPartOfSpeech}>
            {currentWord.partOfSpeech}
          </Text>

          <View style={styles.cardDivider} />

          <Text style={styles.cardTranslation}>{currentWord.translation}</Text>
          <Text style={styles.cardExample}>"{currentWord.example}"</Text>

          <TouchableOpacity
            style={styles.speakBtn}
            onPress={() => speakWord(currentWord.word)}
          >
            <Ionicons name="volume-high-outline" size={20} color={color} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* Butonlar */}
      <View style={styles.btns}>
        <TouchableOpacity
          style={[styles.btn, styles.btnLearn]}
          onPress={swipeLeft}
        >
          <Ionicons name="close" size={28} color={COLORS.error} />
          <Text style={[styles.btnText, { color: COLORS.error }]}>
            Bilmiyorum
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.btnKnow]}
          onPress={swipeRight}
        >
          <Ionicons name="checkmark" size={28} color={COLORS.success} />
          <Text style={[styles.btnText, { color: COLORS.success }]}>
            Biliyorum
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { alignItems: "center" },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  headerSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  progressBg: { height: 3, backgroundColor: COLORS.border },
  progressFill: { height: 3 },

  instructions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  instrItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  instrText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontWeight: "600",
  },
  instrMiddle: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  cardArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  overlay: {
    position: "absolute",
    top: 40,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    zIndex: 10,
    borderWidth: 2,
  },
  overlayLeft: {
    left: SPACING.xl,
    backgroundColor: COLORS.errorGlow,
    borderColor: COLORS.error,
  },
  overlayRight: {
    right: SPACING.xl,
    backgroundColor: COLORS.successGlow,
    borderColor: COLORS.success,
  },
  overlayText: {
    fontSize: FONT_SIZES.md,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },

  cardImage: {
    width: "100%",
    height: 140,
    borderRadius: RADIUS.lg,
    marginBottom: 4,
  },
  cardImagePlaceholder: {
    width: "100%",
    height: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: width - 48,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl * 1.5,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  levelTag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  levelTagText: { fontSize: FONT_SIZES.xs, fontWeight: "800" },
  cardWord: {
    fontSize: 42,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -1,
    textAlign: "center",
  },
  cardPartOfSpeech: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
  },
  cardDivider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 1,
  },
  cardTranslation: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  cardExample: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
  },
  speakBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.backgroundCardLight,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },

  btns: {
    flexDirection: "row",
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
  },
  btnLearn: {
    backgroundColor: COLORS.errorGlow,
    borderColor: COLORS.error + "60",
  },
  btnKnow: {
    backgroundColor: COLORS.successGlow,
    borderColor: COLORS.success + "60",
  },
  btnText: { fontWeight: "700", fontSize: FONT_SIZES.sm },

  // Result
  resultContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  resultEmoji: { fontSize: 64 },
  resultTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  resultStats: { flexDirection: "row", gap: SPACING.lg },
  resultStat: {
    flex: 1,
    alignItems: "center",
    padding: SPACING.lg,
    borderRadius: RADIUS.xl,
    gap: SPACING.sm,
  },
  resultStatNum: { fontSize: 42, fontWeight: "900" },
  resultStatLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  resultDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    lineHeight: 24,
  },
  finishBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.full,
  },
  finishBtnText: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.lg },
});
