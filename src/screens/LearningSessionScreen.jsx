import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ScrollView,
  Alert,
  TextInput,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../utils/theme";
import {
  STATUS,
  HOUR,
  DAILY_TARGET,
  generateQuizOptions,
  getInFlightReviewCount,
} from "../utils/davinciAlgorithm";
import { useApp } from "../context/AppContext";
import { useSubscription } from "../context/SubscriptionContext";
import { speakWord } from "../utils/textToSpeech";
import { hapticSuccess, hapticError } from "../utils/haptics";
import { markCompleted } from "../utils/sessionBridge";
import { scheduleAllReviews } from "../utils/notifications";
import * as Notifications from "expo-notifications";
import { getWordPhotos, cacheWordPhotoLocally } from "../services/wordPhotos";

const { width } = Dimensions.get("window");

const STAGES = [
  { id: 0, name: "Merak", icon: "🔍", color: "#F5A623" },
  { id: 1, name: "Duyular", icon: "✨", color: "#A29BFE" },
  { id: 2, name: "Yaz", icon: "⚗️", color: "#4ECDC4" },
  { id: 3, name: "Bağla", icon: "🕸️", color: "#81C784" },
  { id: 4, name: "Test", icon: "⚖️", color: "#E17055" },
];
// "Yaz" (cümle yazma) adımı akıştan kaldırıldı — tamamen silmek yerine
// burada filtreleniyor, geri eklemek istenirse ACTIVE_STAGES = STAGES
// yapmak yeterli (aşağıdaki WRITE_STAGE_ENABLED'ı da true yapmak gerekir).
const ACTIVE_STAGES = STAGES.filter((s) => s.name !== "Yaz");
const WRITE_STAGE_ENABLED = false;

export default function LearningSessionScreen({ navigation, route }) {
  const { word, level = "A1" } = route.params || {};
  const { state, actions } = useApp();
  const { state: subState } = useSubscription();
  const hasPremiumAccess =
    subState.isPremium || (subState.plan === "trial" && !subState.isTrialExpired);
  const allWords = actions.getAllWords();
  const insets = useSafeAreaInsets();
  // Android'in alt gezinme çubuğu (3 tuş ya da jest çubuğu) edge-to-edge
  // modda içeriğin üstüne biner — SafeAreaView'ın otomatik padding'i her
  // cihazda güvenilir olmadığı için (aynı sorun MainTabNavigator'da da
  // yaşanmıştı) burada da insets manuel ekleniyor.
  const safeBottom = Platform.select({
    ios: Math.max(insets.bottom, 20),
    android: Math.max(insets.bottom, 16),
    default: Math.max(insets.bottom, 16),
  });

  const [stage, setStage] = useState(0);
  const [showMeaning, setShowMeaning] = useState(false);
  const [sentence, setSentence] = useState("");
  const [sentenceOk, setSentenceOk] = useState(false);
  const [repeatCount, setRepeatCount] = useState(0);
  const [quizOpts, setQuizOpts] = useState([]);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [photos, setPhotos] = useState([]); // Kelimenin Firebase'deki kalıcı foto havuzu (URL dizisi)
  const [photoIdx, setPhotoIdx] = useState(0);
  const [photoRefreshed, setPhotoRefreshed] = useState(false);
  const [imgLoading, setImgLoading] = useState(false);
  const imageUri = photos[photoIdx] || null;

  const stageRef = useRef(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!word) return;
    if (stage === 1) loadImage();
    if (stage === ACTIVE_STAGES.length - 1)
      setQuizOpts(generateQuizOptions(word, allWords));
  }, [stage]);

  // Önce kelimenin Firebase'deki kalıcı foto havuzuna bakar (admin panelinden
  // ya da başka bir kullanıcının cihazından daha önce dolduysa Pexels'e hiç
  // sorulmaz); havuz boşsa (bu kelime ilk kez görülüyorsa) Pexels'ten çekip
  // bir daha hiç sorulmamak üzere Firebase'e kalıcı olarak kaydeder.
  const loadImage = async () => {
    setImgLoading(true);
    try {
      const result = await getWordPhotos(word);
      setPhotos(result.photos);
      const idx = result.activeUrl ? result.photos.indexOf(result.activeUrl) : 0;
      setPhotoIdx(idx >= 0 ? idx : 0);
    } catch {
    } finally {
      setImgLoading(false);
    }
  };

  // Kelimeyi ilk gördüğünde, fotoğraf beğenilmezse SADECE BİR KEZ havuzdaki
  // bir sonraki fotoğrafa geçilebilir (zaten çekilmiş, ekstra ağ isteği yok).
  const refreshPhoto = () => {
    if (photoRefreshed || photos.length < 2) return;
    const nextIdx = (photoIdx + 1) % photos.length;
    setPhotoIdx(nextIdx);
    setPhotoRefreshed(true);
    // Seçilen fotoğrafı kelimenin ilerleme kaydına yazıyoruz — tekrar
    // ekranı ve diğer ekranlar kendi Pexels sorgusunu atıp her zaman ilk
    // sonucu göstermek yerine bunu kullanacak.
    if (word) {
      actions.updateWordProgress(word.id, {
        ...(state.wordProgress[word.id] || {}),
        photoUri: photos[nextIdx],
      });
    }
  };

  const goNext = useCallback(async () => {
    const cur = stageRef.current;
    if (cur < ACTIVE_STAGES.length - 1) {
      stageRef.current = cur + 1;
      setStage(cur + 1);
      return;
    }
    // Son aşama bitti — kelimeyi kaydet
    if (word) {
      const prog = state.wordProgress[word.id] || {};
      // DÜZELTME (istenen davranış): kelime 5 aşamayı bitirir bitirmez TEK
      // BAŞINA tekrar döngüsüne girmiyor artık — günün 5 kelimelik partisi
      // TAMAMEN bitene kadar "hazır bekliyor" (readyForReview) durumunda
      // kalıyor; status hâlâ LEARNING olduğu için getReviewWords/
      // getWaitingReviewCount gibi sorgulara hiç girmiyor, kullanıcı tek
      // kelime yapıp çıkarsa tekrar/bildirim gelmiyor. Parti (5 kelime)
      // tamamlanınca hepsi AŞAĞIDA AYNI ANDA, senkron olarak tekrar
      // döngüsüne giriyor.
      const readyProg = {
        ...prog,
        status: STATUS.LEARNING,
        readyForReview: true,
        startedAt: prog.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Kelime öğrenmeyi bitirdi — fotoğrafı cihaza indirip önbelleğe al
      // ki tekrar ekranı internet olmasa bile çalışsın. Fire-and-forget:
      // navigasyonu bloklamıyor, offline'da sessizce başarısız olup uzak
      // URL'e düşüyor.
      if (imageUri) cacheWordPhotoLocally(word.id, imageUri);
      let mergedProgress = state.wordProgress;
      try {
        await actions.updateWordProgress(word.id, readyProg);
        mergedProgress = { ...state.wordProgress, [word.id]: readyProg };
      } catch {}

      try {
        const readyEntries = Object.entries(mergedProgress).filter(
          ([, p]) => p?.status === STATUS.LEARNING && p?.readyForReview
        );
        console.log(
          `[review-notif] readyForReview=${readyEntries.length}/${DAILY_TARGET}`
        );
        if (readyEntries.length >= DAILY_TARGET) {
          // Parti tamamlandı — hepsini AYNI ANDA (tek bir ortak zamana)
          // tekrar döngüsüne sokuyoruz.
          const dueAt = new Date(Date.now() + HOUR).toISOString();
          const nowIso = new Date().toISOString();
          await Promise.all(
            readyEntries.map(([id, p]) =>
              actions.updateWordProgress(id, {
                ...p,
                status: STATUS.REVIEW,
                readyForReview: false,
                reviewsDone: 0,
                wrongTotal: 0,
                dayDone: false,
                nextReviewAt: dueAt,
                updatedAt: nowIso,
              })
            )
          );
          readyEntries.forEach(([id, p]) => {
            mergedProgress[id] = {
              ...p,
              status: STATUS.REVIEW,
              readyForReview: false,
              reviewsDone: 0,
              wrongTotal: 0,
              dayDone: false,
              nextReviewAt: dueAt,
              updatedAt: nowIso,
            };
          });

          const pendingCount = getInFlightReviewCount(mergedProgress);
          await scheduleAllReviews(pendingCount, HOUR);
          const scheduled =
            await Notifications.getAllScheduledNotificationsAsync();
          console.log(
            `[review-notif] parti tamamlandı, scheduled OK, pendingCount=${pendingCount}, total scheduled=${scheduled.length}`,
            scheduled.map((s) => s.identifier)
          );
        }
      } catch (e) {
        console.log("[review-notif] HATA:", e?.message || e);
      }
    }
    markCompleted();
    navigation.goBack();
  }, [word, state.wordProgress]);

  const goNextRef = useRef(goNext);
  useEffect(() => {
    goNextRef.current = goNext;
  });

  const handleQuizAnswer = (opt) => {
    if (quizAnswer) return;
    setQuizAnswer(opt);
    if (opt.isCorrect) {
      hapticSuccess();
    } else {
      hapticError();
    }
    if (!opt.isCorrect) {
      Animated.sequence([
        Animated.timing(shakeAnim, {
          toValue: 10,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -10,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: -6,
          duration: 60,
          useNativeDriver: true,
        }),
        Animated.timing(shakeAnim, {
          toValue: 0,
          duration: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
    setTimeout(() => goNextRef.current(), 1300);
  };

  const canNext =
    (stage === 0 && showMeaning) ||
    stage === 1 ||
    (stage === 2 && repeatCount >= 3);

  const st = ACTIVE_STAGES[stage];
  if (!word) return null;

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Çıkış", "Aşamadan çıkmak istediğine emin misin?", [
              { text: "İptal", style: "cancel" },
              {
                text: "Çık",
                onPress: () => {
                  // Kullanıcı 5-aşamalı öğrenmeden yarıda çıkarsa kelime
                  // "new"e geri alınıyor, tekrar öğrenme havuzuna dönüyor.
                  if (word) {
                    actions.updateWordProgress(word.id, {
                      ...(state.wordProgress[word.id] || {}),
                      status: STATUS.NEW,
                    });
                  }
                  navigation.goBack();
                },
              },
            ])
          }
          style={s.closeBtn}
        >
          <Ionicons name="close" size={20} color={COLORS.textSecondary} />
        </TouchableOpacity>
        <View style={s.pills}>
          {ACTIVE_STAGES.map((st2, i) => (
            <View
              key={i}
              style={[
                s.pill,
                {
                  width: i < stage ? 16 : i === stage ? 28 : 8,
                  backgroundColor: i <= stage ? st2.color : COLORS.border,
                },
              ]}
            />
          ))}
        </View>
        <Text style={s.stageLbl}>{stage + 1}/{ACTIVE_STAGES.length}</Text>
      </View>

      <View style={[s.stageHdr, { backgroundColor: st.color + "15" }]}>
        <Text style={s.stageIcon}>{st.icon}</Text>
        <Text style={[s.stageName, { color: st.color }]}>
          Aşama {stage + 1} — {st.name}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.wordCard}>
          <View style={s.wordRow}>
            <Text style={s.wordTxt}>{word.word}</Text>
            <TouchableOpacity
              onPress={() => speakWord(word.word)}
              style={s.speakBtn}
            >
              <Ionicons name="volume-high-outline" size={22} color={st.color} />
            </TouchableOpacity>
          </View>
          {showMeaning && stage !== ACTIVE_STAGES.length - 1 && (
            <View style={s.meaningBox}>
              <Text style={[s.meaningTxt, { color: st.color }]}>
                {word.translation}
              </Text>
              {word.example ? (
                <Text style={s.exTxt}>"{word.example}"</Text>
              ) : null}
            </View>
          )}
        </View>

        {/* AŞAMA 1 — MERAK */}
        {stage === 0 && (
          <View style={s.content}>
            {word.example && (
              <View style={[s.exBox, { borderLeftColor: st.color }]}>
                <Text style={[s.exLabel, { color: st.color }]}>📖 Örnek:</Text>
                <Text style={s.exBoxTxt}>{word.example}</Text>
                {word.exampleTr && (
                  <Text style={s.exBoxTr}>{word.exampleTr}</Text>
                )}
              </View>
            )}
            {!showMeaning ? (
              <TouchableOpacity
                style={[s.revealBtn, { borderColor: st.color }]}
                onPress={() => setShowMeaning(true)}
              >
                <Ionicons name="eye-outline" size={20} color={st.color} />
                <Text style={[s.revealTxt, { color: st.color }]}>
                  Anlamı Gör
                </Text>
              </TouchableOpacity>
            ) : (
              <View
                style={[
                  s.revealedBox,
                  {
                    backgroundColor: st.color + "12",
                    borderColor: st.color + "40",
                  },
                ]}
              >
                <Text style={[s.revealedMeaning, { color: st.color }]}>
                  {word.translation}
                </Text>
                <Text style={s.revealedHint}>Devam edebilirsin →</Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA 2 — DUYULAR */}
        {stage === 1 && (
          <View style={s.content}>
            {imageUri ? (
              <>
                <Image
                  source={{ uri: imageUri }}
                  style={s.image}
                  resizeMode="contain"
                />
                {!photoRefreshed && photos.length > 1 && (
                  <TouchableOpacity
                    style={[s.refreshBtn, { borderColor: st.color + "60" }]}
                    onPress={() =>
                      hasPremiumAccess
                        ? refreshPhoto()
                        : navigation.navigate("Paywall")
                    }
                  >
                    <Ionicons
                      name={hasPremiumAccess ? "refresh" : "lock-closed"}
                      size={14}
                      color={st.color}
                    />
                    <Text style={[s.refreshBtnTxt, { color: st.color }]}>
                      Farklı fotoğraf{!hasPremiumAccess ? " (Premium)" : ""}
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={s.imgPH}>
                {imgLoading ? (
                  <ActivityIndicator color={st.color} />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={40}
                    color={COLORS.textMuted}
                  />
                )}
              </View>
            )}
            <View style={[s.aiBtn, s.aiBtnDisabled]}>
              <Ionicons name="sparkles" size={16} color={COLORS.textMuted} />
              <Text style={[s.aiBtnTxt, { color: COLORS.textMuted }]}>
                Duyusal sahne üret (şu an kullanılamıyor)
              </Text>
            </View>
          </View>
        )}

        {/* AŞAMA — YAZ (akıştan kaldırıldı, bkz. WRITE_STAGE_ENABLED) */}
        {WRITE_STAGE_ENABLED &&
          (() => {
            // Kelimenin kendisi 3 karakterden kısaysa (örn. "no"), minimum
            // uzunluk şartı kelimeyi yazmayı imkansız hale getirmesin.
            const minLen = Math.min(3, word.word.length);
            const hasMin = sentence.trim().length >= minLen;
            const hasWord = sentence
              .toLowerCase()
              .includes(word.word.toLowerCase());
            // Kelime mutlaka cümlede geçmeli — hem minimum uzunluk hem de
            // kelimenin kendisi olmadan devam edilemez.
            const canConfirm = hasMin && hasWord;
            return (
              <View style={s.content}>
                <Text style={s.writeLabel}>
                  "{word.word}" kelimesiyle bir cümle yaz:
                </Text>
                <TextInput
                  style={[
                    s.input,
                    sentenceOk && { borderColor: COLORS.success },
                  ]}
                  value={sentence}
                  onChangeText={setSentence}
                  placeholder={`"${word.word}" kelimesini kullan...`}
                  placeholderTextColor={COLORS.textMuted}
                  multiline
                  editable={!sentenceOk}
                />
                {!sentenceOk && sentence.length > 0 && (
                  <View style={s.feedbackRow}>
                    {hasWord ? (
                      <>
                        <Ionicons
                          name="checkmark-circle"
                          size={16}
                          color={COLORS.success}
                        />
                        <Text
                          style={[s.feedbackTxt, { color: COLORS.success }]}
                        >
                          Kelimeyi kullandın!
                        </Text>
                      </>
                    ) : (
                      <>
                        <Ionicons
                          name="warning-outline"
                          size={16}
                          color="#F9CA24"
                        />
                        <Text style={[s.feedbackTxt, { color: "#F9CA24" }]}>
                          "{word.word}" ekle!
                        </Text>
                      </>
                    )}
                  </View>
                )}
                {!sentenceOk ? (
                  <TouchableOpacity
                    style={[
                      s.confirmBtn,
                      { backgroundColor: st.color },
                      !canConfirm && { opacity: 0.4 },
                    ]}
                    onPress={() => canConfirm && setSentenceOk(true)}
                    disabled={!canConfirm}
                  >
                    <Text style={s.confirmBtnTxt}>
                      {canConfirm
                        ? "Harika, devam →"
                        : hasMin
                        ? `"${word.word}" kelimesini ekle`
                        : `En az ${minLen} karakter yaz`}
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <View style={s.checkedRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.success}
                    />
                    <Text style={s.checkedTxt}>Kaydedildi!</Text>
                  </View>
                )}
              </View>
            );
          })()}

        {/* AŞAMA — BAĞLA */}
        {stage === 2 && (
          <View style={s.content}>
            <Text style={s.connectLabel}>
              "{word.word}" kelimesini 3 kez sesli söyle:
            </Text>
            <View style={s.bigWordBox}>
              <Text style={[s.bigWord, { color: st.color }]}>{word.word}</Text>
              <Text style={s.bigWordTr}>{word.translation}</Text>
            </View>
            <View style={s.dots}>
              {[0, 1, 2].map((i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    s.dot,
                    i < repeatCount && {
                      backgroundColor: st.color,
                      borderColor: st.color,
                    },
                    i === repeatCount && {
                      borderColor: st.color,
                      borderWidth: 2.5,
                    },
                  ]}
                  onPress={() => {
                    if (i === repeatCount && repeatCount < 3) {
                      speakWord(word.word);
                      setRepeatCount((r) => r + 1);
                    }
                  }}
                  disabled={i !== repeatCount || repeatCount >= 3}
                >
                  {i < repeatCount ? (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  ) : (
                    <Text
                      style={[
                        s.dotNum,
                        {
                          color:
                            i === repeatCount ? st.color : COLORS.textMuted,
                        },
                      ]}
                    >
                      {i + 1}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
            {repeatCount >= 3 && (
              <View
                style={[
                  s.tapDone,
                  {
                    backgroundColor: st.color + "20",
                    borderColor: st.color + "40",
                  },
                ]}
              >
                <Text style={[s.tapDoneTxt, { color: st.color }]}>
                  🎉 3 kez söyledin!
                </Text>
              </View>
            )}
          </View>
        )}

        {/* AŞAMA — TEST */}
        {stage === 3 && (
          <View style={s.content}>
            <Text style={s.quizQ}>Bu kelimenin anlamı nedir?</Text>
            <Animated.View
              style={[s.opts, { transform: [{ translateX: shakeAnim }] }]}
            >
              {quizOpts.map((opt, i) => {
                let bg = COLORS.backgroundCard,
                  border = COLORS.border,
                  col = COLORS.textPrimary;
                if (quizAnswer) {
                  if (opt.isCorrect) {
                    bg = "rgba(100,220,150,0.15)";
                    border = COLORS.success;
                    col = COLORS.success;
                  } else if (quizAnswer === opt) {
                    bg = "rgba(255,100,100,0.15)";
                    border = COLORS.error;
                    col = COLORS.error;
                  }
                }
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      s.opt,
                      { backgroundColor: bg, borderColor: border },
                    ]}
                    onPress={() => handleQuizAnswer(opt)}
                    disabled={!!quizAnswer}
                  >
                    <Text style={[s.optTxt, { color: col }]}>
                      {opt.word.translation}
                    </Text>
                    {quizAnswer && opt.isCorrect && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.success}
                      />
                    )}
                    {quizAnswer === opt && !opt.isCorrect && (
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={COLORS.error}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </Animated.View>
          </View>
        )}
      </ScrollView>

      {stage !== ACTIVE_STAGES.length - 1 && (
        <View style={[s.bottom, { paddingBottom: SPACING.xl + safeBottom }]}>
          <TouchableOpacity
            style={[
              s.nextBtn,
              { backgroundColor: canNext ? st.color : COLORS.border },
            ]}
            onPress={() => canNext && goNextRef.current()}
            disabled={!canNext}
          >
            <Text
              style={[s.nextBtnTxt, !canNext && { color: COLORS.textMuted }]}
            >
              {stage === 0 && !showMeaning
                ? "Önce Anlamı Gör"
                : stage === 2 && repeatCount < 3
                ? `${3 - repeatCount} tekrar kaldı`
                : "Sonraki →"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pills: { flexDirection: "row", gap: 5, alignItems: "center" },
  pill: { height: 6, borderRadius: 3 },
  stageLbl: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  stageHdr: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  stageIcon: { fontSize: 18 },
  stageName: { fontSize: FONT_SIZES.sm, fontWeight: "800" },
  scroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: 100,
  },
  wordCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.lg,
  },
  wordRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  wordTxt: {
    fontSize: 42,
    fontWeight: "900",
    color: COLORS.textPrimary,
    letterSpacing: -1,
    textAlign: "center",
  },
  speakBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  meaningBox: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  meaningTxt: { fontSize: FONT_SIZES.xxl, fontWeight: "800" },
  exTxt: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontStyle: "italic",
    textAlign: "center",
  },
  content: { gap: SPACING.md },
  exBox: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
    borderLeftWidth: 3,
  },
  exLabel: { fontSize: FONT_SIZES.xs, fontWeight: "700" },
  exBoxTxt: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontStyle: "italic",
  },
  exBoxTr: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  revealBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.lg,
    borderRadius: RADIUS.xl,
    borderWidth: 2,
  },
  revealTxt: { fontSize: FONT_SIZES.lg, fontWeight: "700" },
  revealedBox: {
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    padding: SPACING.xl,
    alignItems: "center",
    gap: SPACING.sm,
  },
  revealedMeaning: { fontSize: FONT_SIZES.xxl + 4, fontWeight: "900" },
  revealedHint: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  image: {
    width: "100%",
    height: 340,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.backgroundCard,
  },
  refreshBtn: {
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  refreshBtnTxt: { fontSize: FONT_SIZES.xs, fontWeight: "600" },
  imgPH: {
    height: 140,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    backgroundColor: COLORS.backgroundCard,
  },
  aiBtnTxt: { fontWeight: "600", fontSize: FONT_SIZES.sm },
  aiBtnDisabled: { opacity: 0.5 },
  writeLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  input: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    minHeight: 80,
    textAlignVertical: "top",
  },
  feedbackRow: { flexDirection: "row", alignItems: "center", gap: SPACING.xs },
  feedbackTxt: { fontSize: FONT_SIZES.sm, fontWeight: "600", flex: 1 },
  confirmBtn: {
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.full,
    alignItems: "center",
  },
  confirmBtnTxt: { color: "#fff", fontWeight: "700", fontSize: FONT_SIZES.md },
  checkedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: "rgba(100,220,150,0.15)",
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  checkedTxt: { color: COLORS.success, fontWeight: "600" },
  connectLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
    textAlign: "center",
  },
  bigWordBox: {
    alignItems: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  bigWord: { fontSize: 48, fontWeight: "900", letterSpacing: -1 },
  bigWordTr: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "600",
  },
  dots: { flexDirection: "row", justifyContent: "center", gap: SPACING.xl },
  dot: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: COLORS.border,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  dotNum: { fontWeight: "800", fontSize: FONT_SIZES.lg },
  tapDone: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    alignItems: "center",
  },
  tapDoneTxt: { fontWeight: "600", fontSize: FONT_SIZES.sm },
  quizQ: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    fontWeight: "600",
    textAlign: "center",
  },
  opts: { gap: SPACING.sm },
  opt: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
  },
  optTxt: { fontSize: FONT_SIZES.md, fontWeight: "600", flex: 1 },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  nextBtn: {
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.md + 2,
    alignItems: "center",
  },
  nextBtnTxt: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "700" },
});
