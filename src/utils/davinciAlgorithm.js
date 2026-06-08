// src/utils/davinciAlgorithm.js

// ── Kelime Durumları ──
export const WORD_STATUS = {
  NEW: "new", // Hiç görülmemiş
  KNOWN: "known", // Biliyorum dendi — havuzdan çıktı
  LEARNING: "learning", // Aşamalardan geçiyor (bugün öğrenildi)
  REVIEW_1: "review_1", // 1. tekrar bekliyor (+3 saat)
  REVIEW_2: "review_2", // 2. tekrar bekliyor (+8 saat)
  LEARNED: "learned", // Tüm tekrarlar tamam — uzun vadeli
  FAILED: "failed", // 3 yanlış — ertesi gün tekrar
};

export const LONG_TERM_INTERVALS = [7, 14, 30, 60, 120];

// ── Yardımcılar ──
export const isToday = (dateStr) => {
  if (!dateStr) return false;
  return new Date(dateStr).toDateString() === new Date().toDateString();
};

export const daysDiff = (d1, d2 = new Date()) => {
  const a = new Date(d1);
  a.setHours(0, 0, 0, 0);
  const b = new Date(d2);
  b.setHours(0, 0, 0, 0);
  return Math.floor((b - a) / 86400000);
};

export const isReviewDue = (p) => {
  if (!p?.nextReviewTime) return false;
  return new Date() >= new Date(p.nextReviewTime);
};

export const getWordStatus = (p) => {
  if (!p) return WORD_STATUS.NEW;
  return p.status || WORD_STATUS.NEW;
};

// ── Mastery (eski sistem uyumlu) ──
export const getMasteryLevel = (p) => {
  if (!p) return 0;
  if (p.masteryLevel !== undefined) return p.masteryLevel;
  const c = p.correctCount || 0;
  if (c >= 10) return 5;
  if (c >= 7) return 4;
  if (c >= 4) return 3;
  if (c >= 2) return 2;
  if (c >= 1) return 1;
  return 0;
};

export const getMasteryLabel = (level) => {
  const labels = ["Yeni", "Başlangıç", "Gelişiyor", "İyi", "Çok İyi", "Uzman"];
  return labels[Math.min(level, 5)] || "Yeni";
};

export const isDueForReview = (p) => isReviewDue(p);

// ── Tekrar sonrası progress hesapla ──
export const calcNextReview = (progress, wasCorrect) => {
  const now = new Date();
  const status = progress.status || WORD_STATUS.NEW;
  const wrong = (progress.todayWrongCount || 0) + (wasCorrect ? 0 : 1);

  if (!wasCorrect && wrong >= 3) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    return {
      ...progress,
      status: WORD_STATUS.FAILED,
      todayWrongCount: wrong,
      nextReviewTime: tomorrow.toISOString(),
    };
  }

  if (!wasCorrect) {
    return { ...progress, todayWrongCount: wrong };
  }

  // Doğru — sonraki aşama
  if (
    status === WORD_STATUS.LEARNING ||
    status === WORD_STATUS.FAILED ||
    status === WORD_STATUS.NEW
  ) {
    const t = new Date(now.getTime() + 3 * 3600000);
    return {
      ...progress,
      status: WORD_STATUS.REVIEW_1,
      nextReviewTime: t.toISOString(),
      todayWrongCount: 0,
    };
  }
  if (status === WORD_STATUS.REVIEW_1) {
    const t = new Date(now.getTime() + 5 * 3600000);
    return {
      ...progress,
      status: WORD_STATUS.REVIEW_2,
      nextReviewTime: t.toISOString(),
      todayWrongCount: 0,
    };
  }
  if (status === WORD_STATUS.REVIEW_2) {
    const idx = progress.longTermIntervalIdx || 0;
    const days = LONG_TERM_INTERVALS[idx] || 7;
    const t = new Date();
    t.setDate(t.getDate() + days);
    t.setHours(8, 0, 0, 0);
    return {
      ...progress,
      status: WORD_STATUS.LEARNED,
      nextReviewTime: t.toISOString(),
      todayWrongCount: 0,
      masteryLevel: 5,
      learnedAt: now.toISOString(),
      longTermIntervalIdx: idx,
    };
  }
  if (status === WORD_STATUS.LEARNED) {
    const idx = Math.min(
      (progress.longTermIntervalIdx || 0) + 1,
      LONG_TERM_INTERVALS.length - 1
    );
    const days = LONG_TERM_INTERVALS[idx];
    const t = new Date();
    t.setDate(t.getDate() + days);
    t.setHours(8, 0, 0, 0);
    return {
      ...progress,
      status: WORD_STATUS.LEARNED,
      nextReviewTime: t.toISOString(),
      longTermIntervalIdx: idx,
    };
  }
  return progress;
};

// ── Bugün için öğrenme havuzu ──
export const getDailyWords = (
  allWords,
  wordProgress,
  count = 5,
  level = null
) => {
  const filtered = allWords.filter((w) => {
    if (level && w.level !== level) return false;
    const p = wordProgress[w.id];
    const st = getWordStatus(p);
    // Bilinen veya öğrenilmiş gelmesin
    if (st === WORD_STATUS.KNOWN) return false;
    if (st === WORD_STATUS.LEARNED) return false;
    // Bugün zaten aşamalardan geçmiş gelmesin
    if (st === WORD_STATUS.LEARNING && isToday(p?.startedAt)) return false;
    if (st === WORD_STATUS.REVIEW_1) return false;
    if (st === WORD_STATUS.REVIEW_2) return false;
    // Başarısız olan önce gelsin (ertesi gün)
    return true;
  });

  // FAILED önce, sonra NEW — karıştır
  const failed = filtered.filter(
    (w) => getWordStatus(wordProgress[w.id]) === WORD_STATUS.FAILED
  );
  const newW = filtered
    .filter((w) => getWordStatus(wordProgress[w.id]) === WORD_STATUS.NEW)
    .sort(() => Math.random() - 0.5);

  return [...failed, ...newW].slice(0, count);
};

// ── Bugün tekrar bekleyen kelimeler ──
export const getTodayReviewWords = (allWords, wordProgress) => {
  return allWords.filter((w) => {
    const p = wordProgress[w.id];
    const st = getWordStatus(p);
    return (
      (st === WORD_STATUS.REVIEW_1 || st === WORD_STATUS.REVIEW_2) &&
      isReviewDue(p)
    );
  });
};

// ── Bugün öğrenme yapıldı mı? ──
export const hasDoneSessionToday = (wordProgress) => {
  return Object.values(wordProgress).some(
    (p) =>
      (p.status === WORD_STATUS.LEARNING ||
        p.status === WORD_STATUS.REVIEW_1 ||
        p.status === WORD_STATUS.REVIEW_2) &&
      isToday(p.startedAt)
  );
};

// ── Kaç saat/dakika sonra tekrar? ──
export const getNextReviewIn = (wordProgress) => {
  const times = Object.values(wordProgress)
    .filter(
      (p) =>
        (p.status === WORD_STATUS.REVIEW_1 ||
          p.status === WORD_STATUS.REVIEW_2) &&
        p.nextReviewTime
    )
    .map((p) => new Date(p.nextReviewTime).getTime());
  if (!times.length) return null;
  const diff = Math.min(...times) - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, ms: 0 };
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    ms: diff,
  };
};

// ── Quiz seçenekleri ──
export const generateQuizOptions = (target, allWords, count = 4) => {
  const distractors = allWords
    .filter((w) => w.id !== target.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, count - 1)
    .map((w) => ({ word: w, isCorrect: false }));
  return [{ word: target, isCorrect: true }, ...distractors].sort(
    () => Math.random() - 0.5
  );
};

// ── Günlük istatistikler ──
export const getDailyStats = (allWords, wordProgress) => {
  const today = new Date().toDateString();
  const todayStudied = allWords.filter((w) => {
    const p = wordProgress[w.id];
    return p?.startedAt && new Date(p.startedAt).toDateString() === today;
  }).length;
  const dueCount = getTodayReviewWords(allWords, wordProgress).length;
  const totalLearned = allWords.filter((w) => {
    const s = getWordStatus(wordProgress[w.id]);
    return s === WORD_STATUS.LEARNED || s === WORD_STATUS.KNOWN;
  }).length;
  return { todayStudied, dueCount, totalLearned };
};

// ── Streak ──
export const calculateStreak = (stats) => {
  if (!stats?.dailyStats) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (stats.dailyStats[d.toDateString()]?.wordsLearned > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
};

export const getUnsplashSearchUrl = (word) =>
  `https://source.unsplash.com/400x300/?${encodeURIComponent(word)}`;

export default {
  WORD_STATUS,
  LONG_TERM_INTERVALS,
  isToday,
  daysDiff,
  isReviewDue,
  getWordStatus,
  getMasteryLevel,
  getMasteryLabel,
  isDueForReview,
  calcNextReview,
  getDailyWords,
  getTodayReviewWords,
  hasDoneSessionToday,
  getNextReviewIn,
  generateQuizOptions,
  getDailyStats,
  calculateStreak,
};
