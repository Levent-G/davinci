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
import { AppState } from "react-native";
import { Storage } from "../utils/storage";
import { ALL_WORDS } from "../data/wordDatabase";
import { calculateStreak } from "../utils/davinciAlgorithm";
import {
  saveUser,
  saveSession,
  saveUserProgress,
  getFirestoreWords,
} from "../services/firebase";

const AppContext = createContext(null);

const initialState = {
  user: null,
  wordProgress: {},
  customWords: [],
  firestoreWords: [], // Firebase'den gelen kelimeler
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
    case "SET_ONBOARDING_DONE":
      return { ...state, isOnboardingDone: true };
    case "SET_FIRESTORE_WORDS":
      return { ...state, firestoreWords: action.payload };
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
  }, []);

  // Firebase'den kelimeleri yükle
  const loadFirestoreWords = async () => {
    try {
      const words = await getFirestoreWords();
      if (words && words.length > 0) {
        dispatch({ type: "SET_FIRESTORE_WORDS", payload: words });
      }
    } catch (e) {
      // Firebase yoksa lokal kelimeler kullanılır
    }
  };

  const actions = {
    setUser: async (profile) => {
      const userId = profile.id || `user_${Date.now()}`;
      const profileWithId = { ...profile, id: userId };

      dispatch({ type: "SET_USER", payload: profileWithId });
      await Storage.saveUserProfile(profileWithId);

      // Firebase'e kaydet
      try {
        await saveUser(userId, {
          ...profileWithId,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date(),
          platform: "android",
          subscription: {
            plan: "trial",
            trialStartDate: new Date().toISOString(),
            trialEndsDate: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            isPremium: false,
          },
        });
      } catch (e) {
        console.warn("Firebase saveUser failed, using local only:", e.message);
      }
    },

    setOnboardingDone: async () => {
      dispatch({ type: "SET_ONBOARDING_DONE" });
      await Storage.setOnboardingDone();
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
      const dailyStats = { ...(state.stats.dailyStats || {}) };
      dailyStats[today] = {
        wordsLearned: (dailyStats[today]?.wordsLearned || 0) + 1,
        sessionsCompleted: dailyStats[today]?.sessionsCompleted || 0,
        date: today,
      };
      const newStreak = calculateStreak({ dailyStats });
      const updatedStats = {
        ...state.stats,
        dailyStats,
        totalWordsLearned: (state.stats.totalWordsLearned || 0) + 1,
        streak: newStreak,
        longestStreak: Math.max(state.stats.longestStreak || 0, newStreak),
      };
      dispatch({ type: "UPDATE_STATS", payload: updatedStats });
      await Storage.updateStats(updatedStats);
    },

    recordSessionComplete: async (wordsLearned) => {
      const today = new Date().toDateString();
      const dailyStats = { ...(state.stats.dailyStats || {}) };
      dailyStats[today] = {
        wordsLearned: (dailyStats[today]?.wordsLearned || 0) + wordsLearned,
        sessionsCompleted: (dailyStats[today]?.sessionsCompleted || 0) + 1,
        date: today,
      };

      const newStreak = calculateStreak({ dailyStats });
      const updatedStats = {
        ...state.stats,
        dailyStats,
        totalWordsLearned: state.stats.totalWordsLearned + wordsLearned,
        totalSessions: state.stats.totalSessions + 1,
        streak: newStreak,
        longestStreak: Math.max(state.stats.longestStreak || 0, newStreak),
      };

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
    refreshFirestoreWords: loadFirestoreWords,
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
