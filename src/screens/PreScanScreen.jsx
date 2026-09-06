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
import { hapticLight } from "../utils/haptics";
import { STATUS, DAILY_TARGET, getNewWords } from "../utils/davinciAlgorithm";
import { wasCompleted } from "../utils/sessionBridge";

const { width } = Dimensions.get("window");
const SWIPE_THRESHOLD = width * 0.25;
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
  const { level = "A1", wordsNeeded = DAILY_TARGET } = route.params || {};
  const { state, actions } = useApp();
  const color = LEVEL_COLORS[level] || COLORS.accent;

  // LearnScreen sadece "bu oturumda kaç kelimeye ihtiyaç var" (wordsNeeded)
  // bilgisini gönderiyor, sayaç burada HER ZAMAN 0'dan başlayıp o hedefe
  // kadar sayıyor.
  const SESSION_TARGET = Math.max(wordsNeeded, 1);
  const sessionCountRef = useRef(0);
  const [sessionCount, setSessionCount] = useState(0);

  // Havuz sadece ekran ilk açıldığında BİR KEZ oluşturuluyor.
  const [pool] = useState(() =>
    getNewWords(actions.getAllWords(), state.wordProgress, level, 50)
  );

  const cardIdxRef = useRef(0);
  const swipingRef = useRef(false);
  const isFirstFocus = useRef(true);

  const [displayIdx, setDisplayIdx] = useState(0);
  const [photos, setPhotos] = useState([]);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [photoRefreshed, setPhotoRefreshed] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const imageUri = photos[photoIdx]?.src?.medium || null;

  const pan = useRef(new Animated.ValueXY()).current;

  const loadImage = useCallback(async (word) => {
    setPhotos([]);
    setImgLoading(true);
    try {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(
          word
        )}&per_page=3`,
        { headers: { Authorization: PEXELS_KEY } }
      );
      const data = await res.json();
      if (data.photos?.length > 0) setPhotos(data.photos);
    } catch {
    } finally {
      setImgLoading(false);
    }
  }, []);

  // Kart her değiştiğinde (yeni kelime) fotoğraf yenileme hakkı sıfırlanır.
  const refreshPhoto = () => {
    if (photoRefreshed || photos.length < 2) return;
    setPhotoIdx(1);
    setPhotoRefreshed(true);
  };

  useEffect(() => {
    const word = pool[displayIdx];
    if (word) {
      setPhotoIdx(0);
      setPhotoRefreshed(false);
      loadImage(word.word);
    }
  }, [displayIdx]);

  // LearningSession'dan dönünce
  useFocusEffect(
    useCallback(() => {
      swipingRef.current = false;
      pan.setValue({ x: 0, y: 0 });

      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        wasCompleted(); // temizle
        return;
      }

      const completed = wasCompleted();
      if (completed) {
        const newCount = sessionCountRef.current + 1;
        sessionCountRef.current = newCount;
        setSessionCount(newCount);

        if (newCount >= SESSION_TARGET) {
          // Günün 5 kelimelik hedefi tamamlandı.
          // DÜZELTME: actions.recordSessionComplete hiçbir yerde
          // çağrılmıyordu — bu yüzden StatsScreen'deki "Oturum" KPI'ı ve
          // haftalık/aylık grafik her zaman boş kalıyordu, gerçek kullanım
          // hiç yansımıyordu. wordsLearned=0 veriyoruz çünkü öğrenilen
          // kelime sayısı zaten doKnow() içinde recordWordLearned() ile
          // tek tek sayılıyor — burada tekrar eklersek çift sayım olur.
          actions.recordSessionComplete(0);
          navigation.navigate("MainTabs", { screen: "Learn" });
          return;
        }
      }
      // Sonraki kelimeye geç
      setDisplayIdx(cardIdxRef.current);
    }, [])
  );

  const animateOut = (toX, cb, advanceCard = false) => {
    Animated.timing(pan, {
      toValue: { x: toX, y: 0 },
      duration: 200,
      useNativeDriver: false,
    }).start(() => {
      pan.setValue({ x: 0, y: 0 });
      swipingRef.current = false;
      cb();
      if (advanceCard) setDisplayIdx(cardIdxRef.current);
    });
  };

  const doKnow = () => {
    const word = pool[cardIdxRef.current];
    if (!word) return;
    hapticLight();
    const prevStatus = state.wordProgress[word.id]?.status;
    actions.updateWordProgress(word.id, {
      ...(state.wordProgress[word.id] || {}),
      status: STATUS.KNOWN,
      knownAt: new Date().toISOString(),
    });
    // DÜZELTME: "Biliyorum" ile işaretlenen kelime StatsScreen/HomeScreen
    // tanımına göre (status KNOWN/LEARNED) hemen öğrenilmiş sayılır, ama
    // stats.totalWordsLearned/dailyStats bunu hiç bilmiyordu çünkü
    // recordWordLearned burada hiç çağrılmıyordu (tek çağrı noktası,
    // navigasyonda ULAŞILAMAYAN QuickScanScreen'deydi). pool zaten sadece
    // "new" kelimelerden oluştuğu için prevStatus kontrolü bir güvenlik
    // önlemi.
    if (prevStatus !== STATUS.KNOWN && prevStatus !== STATUS.LEARNED) {
      actions.recordWordLearned();
    }
    cardIdxRef.current += 1;
  };

  const doDontKnow = () => {
    const word = pool[cardIdxRef.current];
    if (!word) return;
    hapticLight();
    actions.updateWordProgress(word.id, {
      ...(state.wordProgress[word.id] || {}),
      status: STATUS.LEARNING,
      startedAt: new Date().toISOString(),
    });
    cardIdxRef.current += 1;
    navigation.navigate("LearningSession", { word, level });
  };

  const onKnow = () => {
    if (swipingRef.current) return;
    swipingRef.current = true;
    animateOut(width * 1.5, doKnow, true);
  };
  const onDontKnow = () => {
    if (swipingRef.current) return;
    swipingRef.current = true;
    animateOut(-width * 1.5, doDontKnow, false);
  };

  const onKnowRef = useRef(onKnow),
    onDontKnowRef = useRef(onDontKnow);
  useEffect(() => {
    onKnowRef.current = onKnow;
    onDontKnowRef.current = onDontKnow;
  });

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

  if (!displayWord)
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Text style={s.emoji}>🎉</Text>
          <Text style={s.title}>Bu seviyedeki tüm kelimeleri gördün!</Text>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: color }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={s.btnTxt}>Geri Dön</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

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
            {sessionCount} / {SESSION_TARGET} öğrenildi
          </Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={s.progressBg}>
        <View
          style={[
            s.progressFill,
            {
              width: `${(sessionCount / SESSION_TARGET) * 100}%`,
              backgroundColor: color,
            },
          ]}
        />
      </View>

      <View style={s.instrRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="arrow-back" size={14} color={COLORS.error} />
          <Text style={[s.instrTxt, { color: COLORS.error }]}>Bilmiyorum</Text>
        </View>
        <Text style={{ color: COLORS.textMuted, fontSize: 11 }}>kaydır</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Text style={[s.instrTxt, { color: COLORS.success }]}>Biliyorum</Text>
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
            <>
              <Image
                source={{ uri: imageUri }}
                style={s.cardImg}
                resizeMode="contain"
              />
              {!photoRefreshed && photos.length > 1 && (
                <TouchableOpacity
                  style={[s.refreshBtn, { borderColor: color + "60" }]}
                  onPress={refreshPhoto}
                >
                  <Ionicons name="refresh" size={14} color={color} />
                  <Text style={[s.refreshBtnTxt, { color }]}>
                    Farklı fotoğraf
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : imgLoading ? (
            <View style={s.cardImgPH}>
              <ActivityIndicator color={color} />
            </View>
          ) : null}
          <View style={[s.tag, { backgroundColor: color + "20" }]}>
            <Text style={[s.tagTxt, { color }]}>
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

      <View style={s.btns} >
        <TouchableOpacity
          style={[
            s.swipeBtn,
            {
              backgroundColor: "rgba(255,80,80,0.1)",
              borderColor: COLORS.error + "60",
            },
          ]}
          onPress={onDontKnow}
        >
          <Ionicons name="close" size={28} color={COLORS.error} />
          <Text style={[s.swipeTxt, { color: COLORS.error }]}>Bilmiyorum</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            s.swipeBtn,
            {
              backgroundColor: "rgba(80,200,120,0.1)",
              borderColor: COLORS.success + "60",
            },
          ]}
          onPress={onKnow}
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
  instrTxt: { fontSize: 12, fontWeight: "700" },
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
  cardImg: {
    width: "100%",
    height: 300,
    borderRadius: 20,
    marginBottom: 4,
    backgroundColor: COLORS.background,
  },
  refreshBtn: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  refreshBtnTxt: { fontSize: FONT_SIZES.xs, fontWeight: "600" },
  cardImgPH: {
    width: "100%",
    height: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  tag: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  tagTxt: { fontSize: 11, fontWeight: "800" },
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
  swipeTxt: { fontWeight: "700", fontSize: FONT_SIZES.sm },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.lg,
    padding: SPACING.xl,
  },
  emoji: { fontSize: 60 },
  title: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
    textAlign: "center",
  },
  btn: {
    paddingHorizontal: 40,
    paddingVertical: SPACING.md + 2,
    borderRadius: RADIUS.full,
  },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: FONT_SIZES.lg },
});
