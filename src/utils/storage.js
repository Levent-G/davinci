// src/utils/storage.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMasteryLevel } from "./davinciAlgorithm";

const KEYS = {
  USER_PROFILE: "@davinci_user_profile",
  WORD_PROGRESS: "@davinci_word_progress",
  CUSTOM_WORDS: "@davinci_custom_words",
  STATS: "@davinci_stats",
  SUBSCRIPTION: "@davinci_subscription",
  ONBOARDING_DONE: "@davinci_onboarding_done",
  SETTINGS: "@davinci_settings",
  DAILY_LIMIT: "@davinci_daily_limit",
  FIRESTORE_WORDS_CACHE: "@davinci_firestore_words_cache",
  COMMUNITY_STATS_CACHE: "@davinci_community_stats_cache",
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

  // NOT (RACE CONDITION DÜZELTMESİ): bu fonksiyon "oku → değiştir → yaz"
  // yapıyor. Farklı kelimeler için art arda (await'siz) çağrılırsa, ikinci
  // çağrının okuması birincinin yazması bitmeden başlayabilir ve birinci
  // güncelleme AsyncStorage'a hiç yazılmadan kaybolabilir (uygulama kapanıp
  // açıldığında o kelimenin ilerlemesi geri gelmez). Bunu önlemek için tüm
  // çağrılar tek bir kuyrukta sıraya koyulup birbiri ardına çalıştırılıyor.
  _writeQueue: Promise.resolve(),
  async updateSingleWordProgress(wordId, update) {
    const run = async () => {
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
    };
    Storage._writeQueue = Storage._writeQueue.then(run, run);
    return Storage._writeQueue;
  },

  // Ortak kelime veritabanında birleştirilen tekrar kayıtların (mergedInto)
  // ilerlemesini ana kayda taşır. İkisinde de ilerleme varsa daha ileride
  // olan kalır. aliases: { eskiId: anaId }. Değişiklik varsa yeni tüm
  // ilerlemeyi, yoksa null döndürür.
  async migrateMergedWords(aliases) {
    const run = async () => {
      try {
        const all = await Storage.getWordProgress();
        let moved = 0;
        for (const [from, to] of Object.entries(aliases)) {
          const p = all[from];
          if (!p) continue;
          if (!all[to] || getMasteryLevel(p) > getMasteryLevel(all[to])) all[to] = p;
          delete all[from];
          moved++;
        }
        if (!moved) return null;
        await Storage.saveWordProgress(all);
        return all;
      } catch {
        return null;
      }
    };
    const job = Storage._writeQueue.then(run, run);
    Storage._writeQueue = job;
    return job;
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
  // DÜZELTME (KRİTİK): kayıt yoksa (ilk açılış) burada o anki zamana göre
  // YENİ bir "7 gün" nesnesi hesaplanıp dönülüyordu ama hiçbir zaman
  // AsyncStorage'a KAYDEDİLMİYORDU. SubscriptionContext.js'deki "kayıt
  // yoksa oluştur ve kalıcı kaydet" bloğu bu yüzden hiç tetiklenmiyordu
  // (sub hep "truthy" geliyordu, asla null değil) — gerçek bir abonelik
  // kaydı diskte hiç oluşmuyordu. Sonuç: her soğuk başlatmada (cold
  // start) deneme süresi o anki zamana göre YENİDEN hesaplanıp hep "7 gün
  // kaldı" gösteriyordu, süre asla gerçekten azalmıyordu. Artık kayıt
  // yoksa null dönüyor — asıl oluşturma/kaydetme işini (ve bunu SADECE
  // bir kez yapmayı) zaten doğru şekilde üstlenen SubscriptionContext'e
  // bırakıyoruz.
  async getSubscription() {
    try {
      const data = await AsyncStorage.getItem(KEYS.SUBSCRIPTION);
      return data ? JSON.parse(data) : null;
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

  // Firestore kelime havuzu önbelleği — kelime havuzu büyüdükçe her
  // uygulama açılışında TÜM kelimeleri yeniden Firestore'dan çekmek hem
  // yavaşlıyor hem Firestore okuma maliyetini (kullanıcı sayısıyla
  // çarpılarak) büyütüyor. İçerik admin tarafından ne sıklıkla
  // değiştiğine göre günde birkaç kez değil, günde SADECE BİR KEZ gerçek
  // bir ağ isteği yapılır — geri kalan açılışlarda bu önbellek kullanılır.
  async getCachedFirestoreWords() {
    try {
      const data = await AsyncStorage.getItem(KEYS.FIRESTORE_WORDS_CACHE);
      if (!data) return null;
      return JSON.parse(data); // { words, fetchedAt }
    } catch {
      return null;
    }
  },

  async saveCachedFirestoreWords(words) {
    try {
      await AsyncStorage.setItem(
        KEYS.FIRESTORE_WORDS_CACHE,
        JSON.stringify({ words, fetchedAt: new Date().toISOString() })
      );
      return true;
    } catch {
      return false;
    }
  },

  // Topluluk ortalaması önbelleği (İstatistikler ekranı) — aynı günlük-bir-kez
  // mantığı: her Stats ekranı açılışında kullanıcı koleksiyonunu taramak
  // yerine günde bir kez gerçek sorgu yapılır.
  async getCachedCommunityStats() {
    try {
      const data = await AsyncStorage.getItem(KEYS.COMMUNITY_STATS_CACHE);
      return data ? JSON.parse(data) : null; // { stats, fetchedAt }
    } catch {
      return null;
    }
  },

  async saveCachedCommunityStats(stats) {
    try {
      await AsyncStorage.setItem(
        KEYS.COMMUNITY_STATS_CACHE,
        JSON.stringify({ stats, fetchedAt: new Date().toISOString() })
      );
      return true;
    } catch {
      return false;
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
