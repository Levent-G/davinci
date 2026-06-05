// src/utils/storage.js
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS = {
  USER_PROFILE: "@davinci_user_profile",
  WORD_PROGRESS: "@davinci_word_progress",
  CUSTOM_WORDS: "@davinci_custom_words",
  STATS: "@davinci_stats",
  SUBSCRIPTION: "@davinci_subscription",
  ONBOARDING_DONE: "@davinci_onboarding_done",
  SETTINGS: "@davinci_settings",
  DAILY_LIMIT: "@davinci_daily_limit",
};

export const Storage = {
  // Kullanıcı profili
  async getUserProfile() {
    try {
      const data = await AsyncStorage.getItem(KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  async saveUserProfile(profile) {
    try {
      await AsyncStorage.setItem(KEYS.USER_PROFILE, JSON.stringify(profile));
      return true;
    } catch {
      return false;
    }
  },

  // Kelime ilerleme takibi
  async getWordProgress() {
    try {
      const data = await AsyncStorage.getItem(KEYS.WORD_PROGRESS);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  async saveWordProgress(progress) {
    try {
      await AsyncStorage.setItem(KEYS.WORD_PROGRESS, JSON.stringify(progress));
      return true;
    } catch {
      return false;
    }
  },

  async updateSingleWordProgress(wordId, update) {
    try {
      const all = await Storage.getWordProgress();
      all[wordId] = {
        ...(all[wordId] || {}),
        ...update,
        updatedAt: new Date().toISOString(),
      };
      return Storage.saveWordProgress(all);
    } catch {
      return false;
    }
  },

  // Özel kelimeler
  async getCustomWords() {
    try {
      const data = await AsyncStorage.getItem(KEYS.CUSTOM_WORDS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  async saveCustomWords(words) {
    try {
      await AsyncStorage.setItem(KEYS.CUSTOM_WORDS, JSON.stringify(words));
      return true;
    } catch {
      return false;
    }
  },

  async addCustomWord(word) {
    try {
      const existing = await Storage.getCustomWords();
      const updated = [
        ...existing,
        {
          ...word,
          id: `custom_${Date.now()}`,
          isCustom: true,
          createdAt: new Date().toISOString(),
        },
      ];
      return Storage.saveCustomWords(updated);
    } catch {
      return false;
    }
  },

  // İstatistikler
  async getStats() {
    try {
      const data = await AsyncStorage.getItem(KEYS.STATS);
      return data
        ? JSON.parse(data)
        : {
            totalWordsLearned: 0,
            totalSessions: 0,
            streak: 0,
            longestStreak: 0,
            dailyStats: {},
            weeklyGoal: 50,
          };
    } catch {
      return {
        totalWordsLearned: 0,
        totalSessions: 0,
        streak: 0,
        longestStreak: 0,
        dailyStats: {},
        weeklyGoal: 50,
      };
    }
  },

  async updateStats(update) {
    try {
      const current = await Storage.getStats();
      const updated = { ...current, ...update };
      await AsyncStorage.setItem(KEYS.STATS, JSON.stringify(updated));
      return updated;
    } catch {
      return null;
    }
  },

  async recordDailyActivity(wordsCount) {
    try {
      const stats = await Storage.getStats();
      const today = new Date().toDateString();
      const dailyStats = stats.dailyStats || {};
      dailyStats[today] = {
        wordsLearned: (dailyStats[today]?.wordsLearned || 0) + wordsCount,
        sessionsCompleted: (dailyStats[today]?.sessionsCompleted || 0) + 1,
        date: today,
      };
      return Storage.updateStats({
        dailyStats,
        totalWordsLearned: stats.totalWordsLearned + wordsCount,
        totalSessions: stats.totalSessions + 1,
      });
    } catch {
      return false;
    }
  },

  // Abonelik
  async getSubscription() {
    try {
      const data = await AsyncStorage.getItem(KEYS.SUBSCRIPTION);
      return data
        ? JSON.parse(data)
        : {
            plan: "trial",
            trialStartDate: new Date().toISOString(),
            trialEndsDate: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            isActive: true,
            isPremium: false,
          };
    } catch {
      return null;
    }
  },

  async saveSubscription(sub) {
    try {
      await AsyncStorage.setItem(KEYS.SUBSCRIPTION, JSON.stringify(sub));
      return true;
    } catch {
      return false;
    }
  },

  // Onboarding
  async isOnboardingDone() {
    try {
      const data = await AsyncStorage.getItem(KEYS.ONBOARDING_DONE);
      return data === "true";
    } catch {
      return false;
    }
  },

  async setOnboardingDone() {
    try {
      await AsyncStorage.setItem(KEYS.ONBOARDING_DONE, "true");
      return true;
    } catch {
      return false;
    }
  },

  // Ayarlar
  async getSettings() {
    try {
      const data = await AsyncStorage.getItem(KEYS.SETTINGS);
      return data
        ? JSON.parse(data)
        : {
            dailyGoal: 10,
            notifications: true,
            soundEnabled: true,
            hapticEnabled: true,
            preferredLevel: "A1",
            sessionSize: 5,
          };
    } catch {
      return {
        dailyGoal: 10,
        notifications: true,
        soundEnabled: true,
        hapticEnabled: true,
        preferredLevel: "A1",
        sessionSize: 5,
      };
    }
  },

  async saveSettings(settings) {
    try {
      await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  },

  // Günlük limit takibi
  async getDailyWordCount() {
    try {
      const today = new Date().toDateString();
      const data = await AsyncStorage.getItem(KEYS.DAILY_LIMIT);
      const parsed = data ? JSON.parse(data) : {};
      if (parsed.date !== today) return 0;
      return parsed.count || 0;
    } catch {
      return 0;
    }
  },

  async incrementDailyWordCount(amount = 1) {
    try {
      const today = new Date().toDateString();
      const current = await Storage.getDailyWordCount();
      await AsyncStorage.setItem(
        KEYS.DAILY_LIMIT,
        JSON.stringify({ date: today, count: current + amount })
      );
      return current + amount;
    } catch {
      return 0;
    }
  },

  // Tümünü sil (debug / reset)
  async clearAll() {
    try {
      await AsyncStorage.multiRemove(Object.values(KEYS));
      return true;
    } catch {
      return false;
    }
  },
};

export default Storage;
