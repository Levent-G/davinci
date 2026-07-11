// davinciAlgorithm.js — Tam sistem

export const WORD_STATUS = {
  NEW: "new", // Hiç görülmemiş
  KNOWN: "known", // Biliyorum dendi
  LEARNING: "learning", // 5 aşama yapılıyor
  REVIEW_1: "review_1", // 1. tekrar (+1 saat)
  REVIEW_2: "review_2", // 2. tekrar (+2 saat)
  REVIEW_3: "review_3", // 3. tekrar (+3 saat)
  LEARNED: "learned", // Tüm tekrarlar tamam
  FAILED: "failed", // 2 yanlış — ertesi gün tekrar
};

export const isToday = (d) =>
  d && new Date(d).toDateString() === new Date().toDateString();

export const getWordStatus = (p) => p?.status || WORD_STATUS.NEW;

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

export const getMasteryLabel = (l) =>
  ["Yeni", "Başlangıç", "Gelişiyor", "İyi", "Çok İyi", "Uzman"][
    Math.min(l, 5)
  ] || "Yeni";

export const isDueForReview = (p) => {
  if (!p?.nextReviewTime) return false;
  return new Date() >= new Date(p.nextReviewTime);
};

// Tekrar sonrası progress hesapla
export const calcNextReview = (prog, wasCorrect) => {
  const now = new Date();
  const status = prog.status || WORD_STATUS.NEW;
  const wrongs = (prog.todayWrongCount || 0) + (wasCorrect ? 0 : 1);

  if (!wasCorrect) {
    if (wrongs >= 2) {
      // 2 yanlış — ertesi gün 09:00'da tekrar
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      return {
        ...prog,
        status: WORD_STATUS.FAILED,
        todayWrongCount: wrongs,
        nextReviewTime: tomorrow.toISOString(),
      };
    }
    return { ...prog, todayWrongCount: wrongs };
  }

  // Doğru — sonraki aşama
  const INTERVAL = 60 * 60 * 1000; // 1 saat

  if (
    [WORD_STATUS.LEARNING, WORD_STATUS.FAILED, WORD_STATUS.NEW].includes(status)
  ) {
    return {
      ...prog,
      status: WORD_STATUS.REVIEW_1,
      todayWrongCount: 0,
      nextReviewTime: new Date(now.getTime() + INTERVAL).toISOString(),
      review1StartedAt: null,
    };
  }
  if (status === WORD_STATUS.REVIEW_1) {
    return {
      ...prog,
      status: WORD_STATUS.REVIEW_2,
      todayWrongCount: 0,
      nextReviewTime: new Date(now.getTime() + INTERVAL).toISOString(),
      review1StartedAt: now.toISOString(),
    };
  }
  if (status === WORD_STATUS.REVIEW_2) {
    return {
      ...prog,
      status: WORD_STATUS.REVIEW_3,
      todayWrongCount: 0,
      nextReviewTime: new Date(now.getTime() + INTERVAL).toISOString(),
      review2StartedAt: now.toISOString(),
    };
  }
  if (status === WORD_STATUS.REVIEW_3) {
    // Tüm tekrarlar tamam — öğrenildi! Ertesi gün 09:00'da uzun vadeli tekrar
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return {
      ...prog,
      status: WORD_STATUS.LEARNED,
      todayWrongCount: 0,
      masteryLevel: 5,
      learnedAt: now.toISOString(),
      nextReviewTime: next.toISOString(),
    };
  }
  if (status === WORD_STATUS.LEARNED) {
    const next = new Date();
    next.setDate(next.getDate() + 14);
    next.setHours(8, 0, 0, 0);
    return { ...prog, todayWrongCount: 0, nextReviewTime: next.toISOString() };
  }
  return prog;
};

// Günlük yeni kelimeler
export const getDailyWords = (
  allWords,
  wordProgress,
  count = 5,
  level = null
) => {
  const filtered = allWords.filter((w) => {
    if (level && w.level !== level) return false;
    const p = wordProgress[w.id];
    const st = p?.status || WORD_STATUS.NEW;
    if (st === WORD_STATUS.KNOWN) return false;
    if (st === WORD_STATUS.LEARNED) return false;
    if (st === WORD_STATUS.REVIEW_1) return false;
    if (st === WORD_STATUS.REVIEW_2) return false;
    if (st === WORD_STATUS.REVIEW_3) return false;
    if (st === WORD_STATUS.LEARNING && isToday(p?.startedAt)) return false;
    return true;
  });
  const failed = filtered.filter(
    (w) => wordProgress[w.id]?.status === WORD_STATUS.FAILED
  );
  const newW = filtered
    .filter(
      (w) =>
        !wordProgress[w.id] || wordProgress[w.id]?.status === WORD_STATUS.NEW
    )
    .sort(() => Math.random() - 0.5);
  return [...failed, ...newW].slice(0, count);
};

// Quiz seçenekleri
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

// Bugün tekrar bekleyen kelimeler
export const getTodayReviewWords = (allWords, wordProgress) => {
  return allWords.filter((w) => {
    const p = wordProgress[w.id];
    if (!p) return false;
    const s = p.status || "new";
    return (
      [
        WORD_STATUS.REVIEW_1,
        WORD_STATUS.REVIEW_2,
        WORD_STATUS.REVIEW_3,
      ].includes(s) && isDueForReview(p)
    );
  });
};

// Review type belirle
export const getReviewType = (wordProgress, words) => {
  for (const w of words) {
    const s = wordProgress[w.id]?.status;
    if (s === WORD_STATUS.REVIEW_1) return "review_1";
    if (s === WORD_STATUS.REVIEW_2) return "review_2";
    if (s === WORD_STATUS.REVIEW_3) return "review_3";
  }
  return "review_1";
};

// Bugün öğrenme yapıldı mı
export const hasDoneSessionToday = (wordProgress) => {
  return Object.values(wordProgress).some(
    (p) =>
      [
        WORD_STATUS.REVIEW_1,
        WORD_STATUS.REVIEW_2,
        WORD_STATUS.REVIEW_3,
      ].includes(p.status) && isToday(p.startedAt)
  );
};

// Kaç dakika sonra tekrar
export const getNextReviewIn = (wordProgress) => {
  const times = Object.values(wordProgress)
    .filter(
      (p) =>
        [
          WORD_STATUS.REVIEW_1,
          WORD_STATUS.REVIEW_2,
          WORD_STATUS.REVIEW_3,
        ].includes(p.status) && p.nextReviewTime
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

// Günlük istatistikler
export const getDailyStats = (allWords, wordProgress) => {
  const todayStudied = allWords.filter((w) =>
    isToday(wordProgress[w.id]?.startedAt)
  ).length;
  const dueCount = getTodayReviewWords(allWords, wordProgress).length;
  const totalLearned = allWords.filter((w) => {
    const s = wordProgress[w.id]?.status;
    return s === WORD_STATUS.LEARNED || s === WORD_STATUS.KNOWN;
  }).length;
  return { todayStudied, dueCount, totalLearned };
};

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

export default {
  WORD_STATUS,
  isToday,
  getWordStatus,
  getMasteryLevel,
  getMasteryLabel,
  isDueForReview,
  calcNextReview,
  generateQuizOptions,
  getTodayReviewWords,
  getReviewType,
  hasDoneSessionToday,
  getNextReviewIn,
  getDailyStats,
  calculateStreak,
};
