// src/context/AppContext.js
// Firebase + AsyncStorage hibrit yaklaşım
// AsyncStorage: hızlı okuma için lokal cache
// Firebase: gerçek zamanlı sync ve admin panel için

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
} from "react";
import { AppState, Platform } from "react-native";
import { Storage } from "../utils/storage";
import { ALL_WORDS } from "../data/wordDatabase";
import { calculateStreak, STATUS } from "../utils/davinciAlgorithm";
import {
  saveUser,
  saveSession,
  saveUserProgress,
  getFirestoreWords,
  deleteUser as deleteFirestoreUser,
} from "../services/firebase";
import {
  onAuthStateChanged,
  signOutUser,
  deleteAuthAccount,
} from "../services/auth";

const AppContext = createContext(null);

const initialState = {
  // Firebase Authentication kullanıcısı (Google/Apple ile giriş zorunlu).
  // null: henüz bilinmiyor/oturum yok. authLoading bitene kadar RootNavigator
  // bekleme ekranı gösterir, sonra authUser yoksa LoginScreen'e düşer.
  authUser: null,
  authLoading: true,
  user: null,
  wordProgress: {},
  customWords: [],
  firestoreWords: [], // Firebase'den gelen kelimeler
  // DÜZELTME: loadFirestoreWords() arka planda (asenkron) çalışıyor —
  // PreScanScreen gibi ekranlar kelime havuzunu bu tamamlanmadan ÖNCE
  // oluşturursa (ör. yavaş ağda hızlı dokunan kullanıcı), getAllWords()
  // henüz boş firestoreWords için eski/bundled statik veriye düşüyor ve o
  // oturumdaki kelimeler (admin'in yaptığı güncellemeler dahil) BİR DAHA
  // hiç tazelenmiyordu (pool bir kerelik snapshot). wordsReady, ekranların
  // bu fetch bitene kadar beklemesini sağlıyor.
  wordsReady: false,
  stats: {
    totalWordsLearned: 0,
    totalSessions: 0,
    streak: 0,
    longestStreak: 0,
    dailyStats: {},
    weeklyGoal: 50,
  },
  settings: {
    dailyGoal: 10,
    notifications: true,
    soundEnabled: true,
    hapticEnabled: true,
    preferredLevel: "A1",
    sessionSize: 5,
  },
  isLoading: true,
  isOnboardingDone: false,
  dailyWordCount: 0,
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    case "INIT_STATE":
      return { ...state, ...action.payload, isLoading: false };
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_AUTH_USER":
      return { ...state, authUser: action.payload, authLoading: false };
    case "SET_ONBOARDING_DONE":
      return { ...state, isOnboardingDone: true };
    case "SET_FIRESTORE_WORDS":
      return { ...state, firestoreWords: action.payload, wordsReady: true };
    case "SET_WORDS_READY":
      return { ...state, wordsReady: true };
    case "SET_WORD_PROGRESS":
      return {
        ...state,
        wordProgress: { ...state.wordProgress, ...action.payload },
      };
    case "UPDATE_WORD_PROGRESS":
      return {
        ...state,
        wordProgress: {
          ...state.wordProgress,
          [action.payload.wordId]: {
            ...(state.wordProgress[action.payload.wordId] || {}),
            ...action.payload.update,
          },
        },
      };
    case "ADD_CUSTOM_WORD":
      return { ...state, customWords: [...state.customWords, action.payload] };
    case "REMOVE_CUSTOM_WORD":
      return {
        ...state,
        customWords: state.customWords.filter((w) => w.id !== action.payload),
      };
    case "UPDATE_STATS":
      return { ...state, stats: { ...state.stats, ...action.payload } };
    case "UPDATE_SETTINGS":
      return { ...state, settings: { ...state.settings, ...action.payload } };
    case "INCREMENT_DAILY_COUNT":
      return {
        ...state,
        dailyWordCount: state.dailyWordCount + (action.payload || 1),
      };
    // DÜZELTME: ProfileScreen'in "Verileri Sıfırla" aksiyonu eskiden sadece
    // Storage.clearAll() çağırıyordu — AsyncStorage temizleniyordu ama
    // AppContext'in bellekteki state'i (wordProgress, stats, customWords,
    // user, isOnboardingDone...) hiç sıfırlanmıyordu. Kullanıcı "Sıfırlandı"
    // mesajını görüp uygulamada gezinmeye devam ettiğinde tüm eski verileri
    // (öğrenilen kelimeler, istatistikler) görmeye devam ediyordu — uygulamayı
    // manuel kapatıp yeniden açana kadar. Bu aksiyon in-memory state'i de
    // gerçek bir restart'ta ne olacaksa (initialState) aynısına döndürür.
    case "RESET_STATE":
      // authUser/authLoading KORUNUR — "verileri sıfırla" oturumu kapatmaz,
      // sadece yerel öğrenme verisini temizler.
      return {
        ...initialState,
        authUser: state.authUser,
        authLoading: false,
        isLoading: false,
      };
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  // Uygulama arka plandan öne gelince storage'dan progress yenile
  const appStateRef = useRef(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (nextState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active"
      ) {
        // Öne geldi — storage'dan güncel progress'i yükle
        try {
          const saved = await Storage.getWordProgress();
          if (saved) dispatch({ type: "SET_WORD_PROGRESS", payload: saved });
        } catch {}
      }
      appStateRef.current = nextState;
    });
    return () => sub?.remove();
  }, []);
  const [state, dispatch] = useReducer(appReducer, initialState);
  // DÜZELTME (istatistik yarış durumu): recordWordLearned/recordSessionComplete
  // state.stats'i closure'dan okuyup +1 ekleyip dispatch ediyordu. Art arda
  // hızlı çağrıldıklarında (örn. "biliyorum" ile birkaç kelimeyi art arda
  // kaydırmak) her çağrı HENÜZ GÜNCELLENMEMİŞ aynı eski değeri okuyordu —
  // sonuncusu öncekilerin üzerine yazıyor, net sonuç hep "+1" kalıyordu
  // (5 kelime öğrenilse bile). statsRef, her hesaplamadan hemen sonra da
  // güncellenerek aynı an içindeki sıradaki çağrının güncel değeri
  // görmesini garanti ediyor.
  const statsRef = useRef(state.stats);
  useEffect(() => {
    statsRef.current = state.stats;
  }, [state.stats]);

  useEffect(() => {
    async function loadInitialData() {
      try {
        const [
          profile,
          wordProgress,
          customWords,
          stats,
          settings,
          onboardingDone,
          dailyWordCount,
        ] = await Promise.all([
          Storage.getUserProfile(),
          Storage.getWordProgress(),
          Storage.getCustomWords(),
          Storage.getStats(),
          Storage.getSettings(),
          Storage.isOnboardingDone(),
          Storage.getDailyWordCount(),
        ]);

        const currentStreak = calculateStreak(stats);
        const updatedStats = { ...stats, streak: currentStreak };

        dispatch({
          type: "INIT_STATE",
          payload: {
            user: profile,
            wordProgress: wordProgress || {},
            customWords: customWords || [],
            stats: updatedStats,
            settings: settings || initialState.settings,
            isOnboardingDone: onboardingDone,
            dailyWordCount: dailyWordCount || 0,
          },
        });

        // Firebase'den kelimeleri arka planda yükle
        loadFirestoreWords();

        // Kullanıcı varsa aktiviteyi güncelle
        if (profile?.id) {
          saveUser(profile.id, {
            lastActiveAt: new Date(),
            stats: updatedStats,
            settings: settings || initialState.settings,
          }).catch(() => {});
        }
      } catch (error) {
        console.error("AppContext init error:", error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadInitialData();

    // Firebase Authentication oturumunu dinle — giriş zorunlu (bkz.
    // LoginScreen). Cihazda ÖNCEKİ bir hesabın yerel verisi varsa ve şimdi
    // FARKLI bir hesapla giriş yapılmışsa (paylaşımlı cihaz senaryosu),
    // karışmasın diye yerel veriyi temizleyip bu hesap için sıfırdan
    // başlıyoruz.
    const unsubscribeAuth = onAuthStateChanged(async (authUser) => {
      if (authUser) {
        try {
          const localProfile = await Storage.getUserProfile();
          if (localProfile?.id && localProfile.id !== authUser.uid) {
            await Storage.clearAll();
            dispatch({ type: "RESET_STATE" });
          }
        } catch {}
      }
      dispatch({ type: "SET_AUTH_USER", payload: authUser });
    });

    return () => unsubscribeAuth();
  }, []);

  // Firebase'den kelimeleri yükle.
  // DÜZELTME (maliyet/hız): kelime havuzu büyüdükçe her açılışta TÜM
  // kelimeleri yeniden çekmek hem başlangıcı yavaşlatıyor hem Firestore
  // okuma maliyetini kullanıcı sayısıyla çarpılarak büyütüyor. Artık
  // sadece günde bir kez gerçekten ağdan çekiliyor; aradaki açılışlarda
  // cihazdaki önbellek kullanılıyor. forceRefresh=true (admin bir kelimeyi
  // düzenleyip refreshFirestoreWords() çağırdığında) önbelleği atlayıp
  // her zaman taze veri çeker.
  const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
  const loadFirestoreWords = async (forceRefresh = false) => {
    try {
      if (!forceRefresh) {
        const cached = await Storage.getCachedFirestoreWords();
        if (cached?.words?.length > 0) {
          const age = Date.now() - new Date(cached.fetchedAt).getTime();
          dispatch({ type: "SET_FIRESTORE_WORDS", payload: cached.words });
          if (age < CACHE_MAX_AGE_MS) return; // taze, ağa hiç gitme
          // Önbellek bayatlamış: kullanıcı HEMEN kelime görebilsin diye
          // önce eski veriyi gösterdik, şimdi arka planda sessizce
          // tazeleyip (aşağıdaki kod ile) güncelleyeceğiz.
        }
      }
      const words = await getFirestoreWords();
      if (words && words.length > 0) {
        dispatch({ type: "SET_FIRESTORE_WORDS", payload: words });
        await Storage.saveCachedFirestoreWords(words);
      } else {
        // Firestore boş döndüyse de wordsReady'i açıyoruz — yoksa
        // ekranlar Firestore hiç boş dönmeyecekmiş gibi sonsuza kadar
        // bekler, bundled statik veriye hiç geçilemez.
        dispatch({ type: "SET_WORDS_READY" });
      }
    } catch (e) {
      // Firebase yoksa lokal kelimeler kullanılır
      dispatch({ type: "SET_WORDS_READY" });
    }
  };

  const actions = {
    setUser: async (profile) => {
      // Sadece ilk profil oluşturmada (onboarding, henüz state.user yokken)
      // yeni kullanıcı sayılır. state.user zaten varsa bu bir GÜNCELLEME
      // (ör. isim değişikliği) demektir.
      const isNewUser = !state.user;
      const userId = profile.id || `user_${Date.now()}`;
      const profileWithId = { ...profile, id: userId };

      dispatch({ type: "SET_USER", payload: profileWithId });
      await Storage.saveUserProfile(profileWithId);

      // Firebase'e kaydet
      try {
        // "settings" alanını profileWithId'den ayrı tutuyoruz: state.user
        // içindeki settings, onboarding'den beri güncellenmemiş ESKİ bir
        // kopya olabilir (asıl güncel ayarlar state.settings'te tutuluyor ve
        // Firestore'a actions.updateSettings ile ayrıca senkronize ediliyor).
        // Bunu her setUser çağrısında (ör. sadece isim değişikliğinde) da
        // gönderirsek, updateSettings'in daha önce Firestore'a yazdığı güncel
        // ayarları eski değerlerle EZERİZ (admin panelde kullanıcı ayarları
        // yanlış görünür). Yeni kullanıcıda ise henüz başka bir kaynak
        // settings'i yazmadığı için ilk kez burada gönderilmesi doğru.
        const { settings: profileSettings, ...profileWithoutSettings } =
          profileWithId;
        const firebasePayload = {
          ...profileWithoutSettings,
          lastActiveAt: new Date(),
          platform: Platform.OS,
        };
        if (isNewUser && profileSettings) {
          firebasePayload.settings = profileSettings;
        }
        // KRİTİK: subscription/createdAt SADECE yeni kullanıcı oluşturulurken
        // yazılmalı. Eskiden her setUser çağrısında (ör. isim güncelleme)
        // subscription nesnesinin tamamı tekrar yazılıyordu — Firestore'da
        // merge:true, iç içe map alanlarını (subscription gibi) tamamen
        // DEĞİŞTİRİR (birleştirmez). Bu yüzden premium bir kullanıcı sadece
        // ismini değiştirse bile aboneliği "trial"a resetleniyordu.
        if (isNewUser) {
          firebasePayload.createdAt = new Date().toISOString();
          firebasePayload.subscription = {
            plan: "trial",
            trialStartDate: new Date().toISOString(),
            trialEndsDate: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            isPremium: false,
          };
        }
        await saveUser(userId, firebasePayload);
      } catch (e) {
        console.warn("Firebase saveUser failed, using local only:", e.message);
      }
    },

    setOnboardingDone: async () => {
      dispatch({ type: "SET_ONBOARDING_DONE" });
      await Storage.setOnboardingDone();
    },

    signOut: async () => {
      await signOutUser();
      // onAuthStateChanged authUser'ı null yapıp RootNavigator'ı
      // LoginScreen'e döndürecek; yerel veriye burada dokunmuyoruz —
      // aynı hesapla tekrar giriş yapılırsa kaldığı yerden devam eder.
    },

    // App Store Guideline 5.1.1(v): hesap oluşturmayı destekleyen bir
    // uygulama hesabı uygulama içinden silmeyi de desteklemek zorunda.
    deleteAccount: async () => {
      const userId = state.user?.id;
      if (userId) {
        await deleteFirestoreUser(userId).catch(() => {});
      }
      await Storage.clearAll();
      await deleteAuthAccount(); // authUser null olur, RootNavigator LoginScreen'e döner
      dispatch({ type: "RESET_STATE" });
    },

    updateWordProgress: async (wordId, update) => {
      dispatch({ type: "UPDATE_WORD_PROGRESS", payload: { wordId, update } });
      await Storage.updateSingleWordProgress(wordId, update);

      // Firebase'e arka planda kaydet
      const userId = state.user?.id;
      if (userId) {
        saveUserProgress(userId, wordId, update).catch(() => {});
      }
    },

    addCustomWord: async (word) => {
      const newWord = {
        ...word,
        id: `custom_${Date.now()}`,
        isCustom: true,
        level: word.level || "A1",
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: "ADD_CUSTOM_WORD", payload: newWord });
      const updated = [...state.customWords, newWord];
      await Storage.saveCustomWords(updated);
      return newWord;
    },

    removeCustomWord: async (wordId) => {
      dispatch({ type: "REMOVE_CUSTOM_WORD", payload: wordId });
      const updated = state.customWords.filter((w) => w.id !== wordId);
      await Storage.saveCustomWords(updated);
    },

    // Tek kelime öğrenildiğinde çağrılır (biliyorum butonu)
    recordWordLearned: async () => {
      const today = new Date().toDateString();
      const base = statsRef.current;
      const dailyStats = { ...(base.dailyStats || {}) };
      dailyStats[today] = {
        wordsLearned: (dailyStats[today]?.wordsLearned || 0) + 1,
        sessionsCompleted: dailyStats[today]?.sessionsCompleted || 0,
        date: today,
      };
      const newStreak = calculateStreak({ dailyStats });
      const updatedStats = {
        ...base,
        dailyStats,
        totalWordsLearned: (base.totalWordsLearned || 0) + 1,
        streak: newStreak,
        longestStreak: Math.max(base.longestStreak || 0, newStreak),
      };
      statsRef.current = updatedStats;
      dispatch({ type: "UPDATE_STATS", payload: updatedStats });
      await Storage.updateStats(updatedStats);
    },

    recordSessionComplete: async (wordsLearned) => {
      const today = new Date().toDateString();
      const base = statsRef.current;
      const dailyStats = { ...(base.dailyStats || {}) };
      dailyStats[today] = {
        wordsLearned: (dailyStats[today]?.wordsLearned || 0) + wordsLearned,
        sessionsCompleted: (dailyStats[today]?.sessionsCompleted || 0) + 1,
        date: today,
      };

      const newStreak = calculateStreak({ dailyStats });
      const updatedStats = {
        ...base,
        dailyStats,
        totalWordsLearned: base.totalWordsLearned + wordsLearned,
        totalSessions: base.totalSessions + 1,
        streak: newStreak,
        longestStreak: Math.max(base.longestStreak || 0, newStreak),
      };
      statsRef.current = updatedStats;

      dispatch({ type: "UPDATE_STATS", payload: updatedStats });
      dispatch({ type: "INCREMENT_DAILY_COUNT", payload: wordsLearned });
      await Storage.updateStats(updatedStats);
      await Storage.incrementDailyWordCount(wordsLearned);

      // Firebase'e arka planda kaydet
      const userId = state.user?.id;
      if (userId) {
        saveSession(userId, {
          wordsLearned,
          streak: newStreak,
          createdAt: new Date(),
        }).catch(() => {});

        saveUser(userId, {
          lastActiveAt: new Date(),
          stats: updatedStats,
        }).catch(() => {});
      }
    },

    updateSettings: async (newSettings) => {
      dispatch({ type: "UPDATE_SETTINGS", payload: newSettings });
      const merged = { ...state.settings, ...newSettings };
      await Storage.saveSettings(merged);

      // Firebase'e de kaydet
      const userId = state.user?.id;
      if (userId) {
        saveUser(userId, { settings: merged }).catch(() => {});
      }
    },

    // Tüm kelimeleri getir: Firebase > lokal
    getAllWords: () => {
      const fsWords = state.firestoreWords || [];
      const custom = state.customWords || [];
      if (fsWords.length > 0) {
        return [...fsWords, ...custom];
      }
      return [...ALL_WORDS, ...custom];
    },

    getTodayWordCount: () => {
      const today = new Date().toDateString();
      return state.stats?.dailyStats?.[today]?.wordsLearned || 0;
    },

    getUnlearnedWords: (level) => {
      const allWords = actions.getAllWords();
      const pool = level ? allWords.filter((w) => w.level === level) : allWords;
      return pool.filter((w) => {
        const progress = state.wordProgress[w.id];
        return !progress || (progress.masteryLevel || 0) < 5;
      });
    },

    // Firebase kelimelerini yenile
    // forceRefresh=true: admin bir kelimeyi düzenledikten sonra bu
    // çağrılıyor, önbelleği atlayıp her zaman taze veri çekmesi şart —
    // aksi halde admin kendi yaptığı değişikliği göremez.
    refreshFirestoreWords: () => loadFirestoreWords(true),

    // Tüm yerel veriyi sil ve bellekteki state'i de sıfırla (bkz. RESET_STATE
    // yorumu) — böylece kullanıcı "Sıfırlandı" dedikten hemen sonra, uygulamayı
    // yeniden başlatmaya gerek kalmadan onboarding'e döner ve eski
    // istatistik/ilerleme verisi hiçbir ekranda artık görünmez.
    resetAllData: async () => {
      await Storage.clearAll();
      dispatch({ type: "RESET_STATE" });
    },
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return context;
}

export default AppContext;
