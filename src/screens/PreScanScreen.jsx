import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import { speakWord } from "../utils/textToSpeech";
import { scheduleReviewNotifications } from "../utils/notifications";
import { WORD_STATUS } from "../utils/davinciAlgorithm";
import { consumeWordCompleted, setWordCompleted } from "../utils/sessionBridge";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.25;
const SESSION_TARGET = 5;
const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

const LEVEL_COLORS = {
  A1: "#4ECDC4",
  A2: "#45B7D1",
  B1: "#96C93D",
  B2: "#F9CA24",
  C1: "#F0932B",
  C2: "#E17055",
};

export default function PreScanScreen({ navigation, route }) {
  const { level = "A1" } = route.params || {};
  const { state, actions } = useApp();
  const color = LEVEL_COLORS[level] || COLORS.accent;

  // Havuz — bir kez oluştur
  const pool = useMemo(() => {
    return actions
      .getAllWords()
      .filter((w) => {
        if (w.level !== level) return false;
        const p = state.wordProgress[w.id];
        if (!p) return true;
        return (
          p.status !== WORD_STATUS.KNOWN && p.status !== WORD_STATUS.LEARNED
        );
      })
      .sort(() => Math.random() - 0.5);
  }, []); // eslint-disable-line

  const poolIdSet = useMemo(() => new Set(pool.map((w) => w.id)), [pool]);

  // Bugün bu pool'dan aşamaları tamamlanan kelimeler — wordProgress'ten
  const learnedToday = useMemo(() => {
    const todayStr = new Date().toDateString();
    return pool.filter((w) => {
      const p = state.wordProgress[w.id];
      if (!p) return false;
      if (p.status === "known") return false;
      if (!["review_1", "review_2", "learned"].includes(p.status || ""))
        return false;
      return p.startedAt && new Date(p.startedAt).toDateString() === todayStr;
    }).length;
  }, [state.wordProgress]); // pool sabit, wordProgress değişince yeniden hesapla

  // cardIdx: pool'da hangi kelimeyi gösteriyoruz
  // displayIdx: animasyon bitmeden değişmesin (flash önleme)
  const cardIdxRef = useRef(0);
  const swipingRef = useRef(false);
  const isFirstFocus = useRef(true);

  const [displayIdx, setDisplayIdx] = useState(0);
  const [imageUri, setImageUri] = useState(null);
  const [imgLoading, setImgLoading] = useState(false);

  const pan = useRef(new Animated.ValueXY()).current;

  // Görsel yükle
  const loadImage = useCallback(async (word) => {
    setImageUri(null);
    setImgLoading(true);
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          word
        )}&per_page=3`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await res.json();
      if (data.photos?.length > 0) setImageUri(data.photos[0].src.medium);
    } catch {}
    setImgLoading(false);
  }, []);

  useEffect(() => {
    const word = pool[displayIdx];
    if (word) loadImage(word.word);
  }, [displayIdx]);

  // LearningSession'dan dönünce
  useFocusEffect(
    useCallback(() => {
      swipingRef.current = false;
      pan.setValue({ x: 0, y: 0 });

      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }

      // Aşamalar bitti sinyali geldi mi?
      const completed = consumeWordCompleted();

      // Sonraki kelimeye geç
      setDisplayIdx(cardIdxRef.current);

      if (completed) {
        // Bildirim planla — learnedToday useMemo'dan güncellenecek
        scheduleReviewNotifications(SESSION_TARGET).catch(() => {});
      }
    }, [])
  ); // eslint-disable-line

  const animateOut = (toX, cb) => {
    Animated.timing(pan, {
      toValue: { x: toX, y: 0 },
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      swipingRef.current = false;
      cb();
    });
  };

  const doKnow = () => {
    const word = pool[cardIdxRef.current];
    if (!word) return;
    const prog = state.wordProgress[word.id] || {};
    actions.updateWordProgress(word.id, {
      ...prog,
      status: WORD_STATUS.KNOWN,
      masteryLevel: 5,
      knownByUser: true,
      lastReviewDate: new Date().toISOString(),
    });
    cardIdxRef.current += 1;
    setDisplayIdx(cardIdxRef.current);
  };

  const doDontKnow = () => {
    const word = pool[cardIdxRef.current];
    if (!word) return;
    const prog = state.wordProgress[word.id] || {};
    actions.updateWordProgress(word.id, {
      ...prog,
      status: WORD_STATUS.LEARNING,
      startedAt: new Date().toISOString(),
    });
    cardIdxRef.current += 1;
    // displayIdx animasyon callback'inde güncellenir (useFocusEffect'te)
    navigation.navigate("LearningSession", {
      level,
      words: [word],
      mode: "learn",
    });
  };

  const onKnow = () => {
    if (swipingRef.current) return;
    swipingRef.current = true;
    animateOut(width * 1.5, doKnow);
  };

  const onDontKnow = () => {
    if (swipingRef.current) return;
    swipingRef.current = true;
    animateOut(-width * 1.5, doDontKnow);
  };

  const onKnowRef = useRef(onKnow);
  const onDontKnowRef = useRef(onDontKnow);
  useEffect(() => {
    onKnowRef.current = onKnow;
    onDontKnowRef.current = onDontKnow;
  });

  // learnedToday 5 olunca LearnScreen'e git
  useEffect(() => {
    if (learnedToday >= SESSION_TARGET) {
      navigation.navigate("MainTabs", { screen: "Learn" });
    }
  }, [learnedToday]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !swipingRef.current,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, g) => {
        if (swipingRef.current) return;
        if (g.dx > SWIPE_THRESHOLD) onKnowRef.current();
        else if (g.dx < -SWIPE_THRESHOLD) onDontKnowRef.current();
        else
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
          }).start();
      },
    })
  ).current;

  const rotation = pan.x.interpolate({
    inputRange: [-width, width],
    outputRange: ["-15deg", "15deg"],
  });
  const knowOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const dontOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  const displayWord = pool[displayIdx] || null;

  if (!displayWord) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.doneBox}>
          <Text style={s.doneEmoji}>🎉</Text>
          <Text style={s.doneTitle}>Bu seviyedeki tüm kelimeleri gördün!</Text>
          <TouchableOpacity
            style={[s.btn1, { backgroundColor: color }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.btn1Text}>Geri Dön →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={s.closeBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={s.headerTitle}>Bu kelimeyi biliyor musun?</Text>
          <Text style={s.headerSub}>
            {Math.min(learnedToday, SESSION_TARGET)} / {SESSION_TARGET}{" "}
            öğrenildi
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.progressBg}>
        <View
          style={[
            s.progressFill,
            {
              width: `${
                (Math.min(learnedToday, SESSION_TARGET) / SESSION_TARGET) * 100
              }%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      <View style={s.instrRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="arrow-back" size={14} color={COLORS.error} />
          <Text style={[s.instrText, { color: COLORS.error }]}>Bilmiyorum</Text>
        </View>
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>kaydır</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={[s.instrText, { color: COLORS.success }]}>
            Biliyorum
          </Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.success} />
        </View>
      </View>

      <View style={s.cardArea}>
        <Animated.View style={[s.overlayL, { opacity: dontOpacity }]}>
          <Text style={s.overlayTxt}>📚 Bilmiyorum</Text>
        </Animated.View>
        <Animated.View style={[s.overlayR, { opacity: knowOpacity }]}>
          <Text style={s.overlayTxt}>✅ Biliyorum</Text>
        </Animated.View>

        <Animated.View
          style={[
            s.card,
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
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={s.cardImage}
              resizeMode="cover"
            />
          ) : imgLoading ? (
            <View style={s.cardImagePlaceholder}>
              <ActivityIndicator size="small" color={color} />
            </View>
          ) : null}

          <View style={[s.levelTag, { backgroundColor: color + "20" }]}>
            <Text style={[s.levelTagTxt, { color }]}>
              {displayWord.level} • {displayWord.partOfSpeech || "word"}
            </Text>
          </View>
          <Text style={s.word}>{displayWord.word}</Text>
          <View style={s.divider} />
          <Text style={s.translation}>{displayWord.translation}</Text>
          {displayWord.example ? (
            <Text style={s.example} numberOfLines={2}>
              "{displayWord.example}"
            </Text>
          ) : null}
          <TouchableOpacity
            style={[s.speakBtn, { backgroundColor: color + "15" }]}
            onPress={() => speakWord(displayWord.word)}
          >
            <Ionicons name="volume-high-outline" size={18} color={color} />
            <Text style={[s.speakTxt, { color }]}>Sesli Dinle</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <View style={s.btns}>
        <TouchableOpacity
          style={[s.swipeBtn, s.swipeDont]}
          onPress={onDontKnow}
          activeOpacity={0.8}
        >
          <Ionicons name="close" size={28} color={COLORS.error} />
          <Text style={[s.swipeTxt, { color: COLORS.error }]}>Bilmiyorum</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.swipeBtn, s.swipeKnow]}
          onPress={onKnow}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark" size={28} color={COLORS.success} />
          <Text style={[s.swipeTxt, { color: COLORS.success }]}>Biliyorum</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
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
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  headerSub: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  progressBg: { height: 4, backgroundColor: COLORS.border },
  progressFill: { height: 4, borderRadius: 2 },
  instrRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
  },
  instrText: { fontSize: 12, fontWeight: "700" },
  cardArea: { flex: 1, alignItems: "center", justifyContent: "center" },
  overlayL: {
    position: "absolute",
    top: 24,
    left: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.error,
    backgroundColor: "rgba(255,80,80,0.12)",
    zIndex: 10,
  },
  overlayR: {
    position: "absolute",
    top: 24,
    right: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    borderColor: COLORS.success,
    backgroundColor: "rgba(80,200,120,0.12)",
    zIndex: 10,
  },
  overlayTxt: {
    fontWeight: "800",
    fontSize: FONT_SIZES.sm,
    color: COLORS.textPrimary,
  },
  card: {
    width: width - 48,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: 28,
    padding: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
  },
  cardImage: { width: "100%", height: 380, borderRadius: 20, marginBottom: 4 },
  cardImagePlaceholder: {
    width: "100%",
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  levelTag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  levelTagTxt: { fontSize: 11, fontWeight: "800" },
  word: {
    fontSize: 40,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -2,
    textAlign: "center",
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.border,
    borderRadius: 1,
  },
  translation: {
    fontSize: FONT_SIZES.xl,
    fontWeight: "700",
    color: COLORS.textSecondary,
    textAlign: "center",
  },
  example: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 18,
  },
  speakBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  speakTxt: { fontWeight: "700", fontSize: FONT_SIZES.sm },
  btns: {
    flexDirection: "row",
    gap: SPACING.lg,
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.xl,
  },
  swipeBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
  },
  swipeDont: {
    backgroundColor: "rgba(255,80,80,0.1)",
    borderColor: COLORS.error + "60",
  },
  swipeKnow: {
    backgroundColor: "rgba(80,200,120,0.1)",
    borderColor: COLORS.success + "60",
  },
  swipeTxt: { fontWeight: "700", fontSize: FONT_SIZES.sm },
  doneBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  doneEmoji: { fontSize: 60 },
  doneTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
    textAlign: "center",
  },
  btn1: {
    paddingHorizontal: 40,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.full,
  },
  btn1Text: { color: "#fff", fontWeight: "800", fontSize: FONT_SIZES.lg },
});
