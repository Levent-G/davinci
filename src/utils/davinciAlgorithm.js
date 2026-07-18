// Da Vinci Algoritması

export const STATUS = {
  NEW: "new", // Hiç görülmemiş
  KNOWN: "known", // Biliyorum dendi
  LEARNING: "learning", // Aşamalarda
  R1: "r1", // 1. tekrar bekliyor
  R2: "r2", // 2. tekrar bekliyor
  R3: "r3", // 3. tekrar bekliyor
  DONE: "done", // Tüm tekrarlar tamam
  RETRY: "retry", // 3 yanlış — tekrar gelecek
};

// TEST: 1 dakika | GERÇEK: 60 * 60 * 1000
export const INTERVAL = 1 * 60 * 1000;
// TEST: 2 dakika | GERÇEK: sonraki gün
export const NEXT_DAY = 2 * 60 * 1000;

export const isToday = (d) =>
  d && new Date(d).toDateString() === new Date().toDateString();
export const isDue = (t) => t && Date.now() >= new Date(t).getTime();

// Bugün öğrenilen (aşamalardan geçen) kelimeler
export const getTodayLearned = (allWords, progress, level) => {
  return allWords.filter((w) => {
    if (level && w.level !== level) return false;
    const p = progress[w.id];
    if (!p) return false;
    const s = p.status;
    return (
      [STATUS.R1, STATUS.R2, STATUS.R3, STATUS.DONE].includes(s) &&
      isToday(p.learnedAt)
    );
  });
};

// Tekrar zamanı gelen kelimeler
export const getReviewWords = (allWords, progress) => {
  return allWords.filter((w) => {
    const p = progress[w.id];
    if (!p) return false;
    return (
      [STATUS.R1, STATUS.R2, STATUS.R3].includes(p.status) &&
      isDue(p.nextReviewAt)
    );
  });
};

// Hangi tekrar tipi
export const getReviewType = (words, progress) => {
  for (const w of words) {
    const s = progress[w.id]?.status;
    if (s === STATUS.R1) return "r1";
    if (s === STATUS.R2) return "r2";
    if (s === STATUS.R3) return "r3";
  }
  return "r1";
};

// Aşama bitti → R1'e geç
export const afterLearning = (prog) => ({
  ...prog,
  status: STATUS.R1,
  learnedAt: new Date().toISOString(),
  nextReviewAt: new Date(Date.now() + INTERVAL).toISOString(),
  wrongCount: 0,
});

// Quiz cevabı → sonraki statü
export const afterQuiz = (prog, isCorrect) => {
  const wrong = (prog.wrongCount || 0) + (isCorrect ? 0 : 1);
  const now = Date.now();
  const s = prog.status;

  // RETRY kelimesi quiz yapıyor — sıfırdan r1→r2→r3 gitsin
  if (s === STATUS.RETRY) {
    return {
      ...prog,
      status: STATUS.R1,
      wrongCount: isCorrect ? 0 : 1,
      nextReviewAt: new Date(now + INTERVAL).toISOString(),
    };
  }
  if (s === STATUS.R1) {
    return {
      ...prog,
      status: STATUS.R2,
      wrongCount: wrong,
      nextReviewAt: new Date(now + INTERVAL).toISOString(),
    };
  }
  if (s === STATUS.R2) {
    return {
      ...prog,
      status: STATUS.R3,
      wrongCount: wrong,
      nextReviewAt: new Date(now + INTERVAL).toISOString(),
    };
  }
  if (s === STATUS.R3) {
    if (wrong >= 3) {
      return {
        ...prog,
        status: STATUS.RETRY,
        wrongCount: wrong,
        nextReviewAt: new Date(now + NEXT_DAY).toISOString(),
      };
    }
    return {
      ...prog,
      status: STATUS.DONE,
      wrongCount: wrong,
      learnedAt: new Date().toISOString(),
      nextReviewAt: new Date(now + NEXT_DAY).toISOString(),
    };
  }
  return prog;
};

// Quiz seçenekleri
export const quizOptions = (word, allWords) => {
  const opts = allWords
    .filter((w) => w.id !== word.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map((w) => ({ word: w, correct: false }));
  return [{ word, correct: true }, ...opts].sort(() => Math.random() - 0.5);
};

// Yeni kelimeler (NEW veya RETRY) — LEARNING, R1, R2, R3, DONE, KNOWN hariç
export const getNewWords = (allWords, progress, level, count = 5) => {
  const activeStatuses = [
    STATUS.KNOWN,
    STATUS.LEARNING,
    STATUS.R1,
    STATUS.R2,
    STATUS.R3,
  ];
  const retry = allWords.filter((w) => {
    if (level && w.level !== level) return false;
    const p = progress[w.id];
    return p?.status === STATUS.RETRY && isDue(p.nextReviewAt);
  });
  const newW = allWords
    .filter((w) => {
      if (level && w.level !== level) return false;
      const p = progress[w.id];
      if (!p) return true;
      if (activeStatuses.includes(p.status)) return false;
      if (p.status === STATUS.RETRY) return false;
      // DONE: nextReviewAt geçmişse yeni kelime olarak sun
      if (p.status === STATUS.DONE) return isDue(p.nextReviewAt);
      return true; // NEW
    })
    .sort(() => Math.random() - 0.5);
  return [...retry, ...newW].slice(0, count);
};

export const getMasteryLevel = (p) => p?.masteryLevel || 0;
export const getMasteryLabel = (l) =>
  ["Yeni", "Başlangıç", "Gelişiyor", "İyi", "Çok İyi", "Uzman"][Math.min(l, 5)];
export const getDailyStats = (allWords, progress) => ({
  totalLearned: allWords.filter((w) =>
    [STATUS.DONE, STATUS.KNOWN].includes(progress[w.id]?.status)
  ).length,
  todayStudied: allWords.filter((w) => isToday(progress[w.id]?.learnedAt))
    .length,
  dueCount: getReviewWords(allWords, progress).length,
});
export const isDueForReview = (p) => isDue(p?.nextReviewAt);
export const getWordStatus = (p) => p?.status || STATUS.NEW;
export const WORD_STATUS = STATUS;
export const getTodayReviewWords = getReviewWords;
export const hasDoneSessionToday = (progress) =>
  Object.values(progress).some((p) => isToday(p?.learnedAt));
export const getNextReviewIn = (progress) => {
  const times = Object.values(progress)
    .filter(
      (p) =>
        [STATUS.R1, STATUS.R2, STATUS.R3].includes(p?.status) && p.nextReviewAt
    )
    .map((p) => new Date(p.nextReviewAt).getTime());
  if (!times.length) return null;
  const diff = Math.min(...times) - Date.now();
  if (diff <= 0) return { hours: 0, minutes: 0, ms: 0 };
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    ms: diff,
  };
};
export const generateQuizOptions = quizOptions;
export const getDailyWords = getNewWords;
export const calculateStreak = () => 0;
export const isToday_ = isToday;

export default {
  STATUS,
  WORD_STATUS,
  INTERVAL,
  NEXT_DAY,
  isToday,
  isDue,
  getTodayLearned,
  getReviewWords,
  getReviewType,
  afterLearning,
  afterQuiz,
  quizOptions,
  getNewWords,
  getMasteryLevel,
  getMasteryLabel,
  getDailyStats,
  isDueForReview,
  getWordStatus,
  getTodayReviewWords,
  hasDoneSessionToday,
  getNextReviewIn,
  generateQuizOptions,
  getDailyWords,
  calculateStreak,
};
