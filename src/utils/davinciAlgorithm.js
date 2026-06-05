// src/utils/davinciAlgorithm.js
// Gerçek Da Vinci Öğrenme Metodu - Michael Gelb "How to Think Like Leonardo da Vinci"

/**
 * GERÇEK DA VİNCİ 7 PRENSİBİ (Michael Gelb, 1998):
 * 1. Curiosità    — Merak: Sürekli soru sorma, öğrenme iştahı
 * 2. Dimostrazione — Deneyim: Bilgiyi deneyerek test etme
 * 3. Sensazione   — Duyular: 5 duyuyu kullanarak gözlem
 * 4. Sfumato      — Belirsizlik: Paradoksa açık olma
 * 5. Arte/Scienza — Denge: Sol + sağ beyin dengesi
 * 6. Corporalità  — Beden: Zihin-beden bütünlüğü
 * 7. Connessione  — Bağlantı: Her şeyin birbirine bağlılığı
 *
 * UYGULAMADA KULLANILAN 5 PRENSİP:
 * 1. CURIOSITÀ    — Kelimeyle merak uyandır, soru sor
 * 2. SENSAZIONE   — 5 duyu + görsel ile hisset
 * 3. DIMOSTRAZIONE — Cümle kurarak deneyimle
 * 4. CONNESSIONE  — Diğer kavramlarla bağlantı kur
 * 5. ARTE/SCIENZA — Görsel sanat + analitik test dengesi
 */

export const DAVINCI_STAGES = {
  CURIOSITA: {
    id: 1,
    name: "Curiosità",
    turkishName: "Merak",
    latinMeaning: "Sonsuz Merak",
    description: "Kelimeyi keşfet, sorular sor",
    icon: "🔍",
    color: "#F5A623",
    principle: "Curiosità — Sonsuz merak ve öğrenme iştahı",
    instruction:
      "Bu kelime sende ne uyandırıyor? Nerede duymuş olabilirsin? Merakını aç.",
    davinciQuote:
      '"Öğrenme iştahı hiç dinmeyen tek tutkumdur." — Leonardo da Vinci',
    durationMs: 10000,
  },
  SENSAZIONE: {
    id: 2,
    name: "Sensazione",
    turkishName: "Duyular",
    latinMeaning: "Beş Duyuyla Algı",
    description: "Tüm duyularınla hisset + gör",
    icon: "✨",
    color: "#A29BFE",
    principle: "Sensazione — Duyuları kullanarak deneyimi derinleştir",
    instruction: "Bu kelimeyi gör, duy, hisset. Zihninde bir sahne canlandır.",
    davinciQuote: '"Beş duyu ruhun bakanlarıdır." — Leonardo da Vinci',
    durationMs: 15000,
  },
  DIMOSTRAZIONE: {
    id: 3,
    name: "Dimostrazione",
    turkishName: "Deneyim",
    latinMeaning: "Deneyerek Öğrenme",
    description: "Cümle kur, kullanarak test et",
    icon: "⚗️",
    color: "#4ECDC4",
    principle: "Dimostrazione — Bilgiyi deneyerek, hata yaparak öğren",
    instruction: "Bu kelimeyle kendi cümleni kur. Yanlış yap, dene, öğren.",
    davinciQuote: '"Bilgelik deneyimin kızıdır." — Leonardo da Vinci',
    durationMs: 12000,
  },
  CONNESSIONE: {
    id: 4,
    name: "Connessione",
    turkishName: "Bağlantı",
    latinMeaning: "Her Şeyin Birliği",
    description: "Başka kavramlarla ilişkilendir",
    icon: "🕸️",
    color: "#81C784",
    principle: "Connessione — Her şeyin birbiriyle bağlantısını gör",
    instruction:
      "Bu kelimeyi bildiğin 2 kelimeyle bağla. Aralarındaki köprüyü kur.",
    davinciQuote: '"Her şey her şeyle bağlantılıdır." — Leonardo da Vinci',
    durationMs: 10000,
  },
  ARTE_SCIENZA: {
    id: 5,
    name: "Arte/Scienza",
    turkishName: "Sanat & Bilim",
    latinMeaning: "Sol+Sağ Beyin Dengesi",
    description: "Görsel sanat + analitik test",
    icon: "⚖️",
    color: "#E17055",
    principle: "Arte/Scienza — Yaratıcılık ve mantığı dengele",
    instruction:
      "Önce görselle sezgisel bağ kur, sonra zihnini analitik teste hazırla.",
    davinciQuote: '"Resim yapmak bir zihin işidir." — Leonardo da Vinci',
    durationMs: 15000,
  },
};

// Aralıklı tekrar (Spaced Repetition) - Ebbinghaus Forgetting Curve tabanlı
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60]; // günler

export function calculateNextReview(wordProgress) {
  const {
    correctCount = 0,
    incorrectCount = 0,
    intervalIndex = 0,
  } = wordProgress;
  const easeFactor = Math.max(
    1.3,
    2.5 - incorrectCount * 0.15 + correctCount * 0.1
  );
  const nextIntervalDays =
    REVIEW_INTERVALS[Math.min(intervalIndex, REVIEW_INTERVALS.length - 1)];
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + nextIntervalDays);
  return {
    nextReviewDate: nextReviewDate.toISOString(),
    easeFactor: parseFloat(easeFactor.toFixed(2)),
    nextIntervalIndex: Math.min(intervalIndex + 1, REVIEW_INTERVALS.length - 1),
  };
}

export function isDueForReview(wordProgress) {
  if (!wordProgress.nextReviewDate) return true;
  return new Date() >= new Date(wordProgress.nextReviewDate);
}

export function getMasteryLevel(wordProgress) {
  const {
    correctCount = 0,
    incorrectCount = 0,
    intervalIndex = 0,
  } = wordProgress;
  const totalAttempts = correctCount + incorrectCount;
  if (totalAttempts === 0) return 0;
  const accuracy = correctCount / totalAttempts;
  const masteryScore =
    accuracy * 0.6 + (intervalIndex / REVIEW_INTERVALS.length) * 0.4;
  if (masteryScore >= 0.9) return 5;
  if (masteryScore >= 0.7) return 4;
  if (masteryScore >= 0.5) return 3;
  if (masteryScore >= 0.3) return 2;
  return 1;
}

export function getMasteryLabel(level) {
  const labels = {
    0: "Yeni",
    1: "Başlangıç",
    2: "Öğreniliyor",
    3: "Orta",
    4: "İyi",
    5: "Ustalaşıldı",
  };
  return labels[level] || "Yeni";
}

export function generateQuizOptions(targetWord, allWords, count = 4) {
  const sameLevel = allWords.filter(
    (w) => w.id !== targetWord.id && w.level === targetWord.level
  );
  const others = allWords.filter(
    (w) => w.id !== targetWord.id && w.level !== targetWord.level
  );
  const pool = [
    ...sameLevel.sort(() => Math.random() - 0.5).slice(0, count - 1),
    ...others.sort(() => Math.random() - 0.5),
  ].slice(0, count - 1);
  return [
    { word: targetWord, isCorrect: true },
    ...pool.map((w) => ({ word: w, isCorrect: false })),
  ].sort(() => Math.random() - 0.5);
}

export function createLearningSession(words, sessionSize = 5) {
  return [...words]
    .sort(() => Math.random() - 0.5)
    .slice(0, sessionSize)
    .map((word) => ({
      word,
      currentStage: 1,
      stagesCompleted: [],
      startedAt: new Date().toISOString(),
      responses: [],
    }));
}

export function getDailyGoalProgress(stats) {
  const today = new Date().toDateString();
  return stats.dailyStats?.[today] || { wordsLearned: 0, sessionsCompleted: 0 };
}

export function calculateStreak(stats) {
  if (!stats.dailyStats) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (stats.dailyStats[d.toDateString()]?.wordsLearned > 0) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// Unsplash arama URL'si (API key gerektirmez, demo endpoint)
export function getUnsplashSearchUrl(word) {
  return `https://source.unsplash.com/400x300/?${encodeURIComponent(
    word
  )},concept,abstract`;
}

export default {
  DAVINCI_STAGES,
  REVIEW_INTERVALS,
  calculateNextReview,
  isDueForReview,
  getMasteryLevel,
  getMasteryLabel,
  generateQuizOptions,
  createLearningSession,
  getDailyGoalProgress,
  calculateStreak,
  getUnsplashSearchUrl,
};

/**
 * GÜNLÜK KELİME SİSTEMİ
 * Öncelik sırası:
 * 1. Tekrar zamanı gelmiş kelimeler (spaced repetition)
 * 2. Hiç görülmemiş yeni kelimeler
 * 3. Düşük ustalık seviyesindeki kelimeler
 */
export function getDailyWords(
  allWords,
  wordProgress,
  sessionSize = 5,
  preferredLevel = null
) {
  const now = new Date();

  // 1. Tekrar zamanı gelmiş kelimeler
  const dueWords = allWords.filter((w) => {
    const p = wordProgress[w.id];
    if (!p?.nextReviewDate) return false;
    return new Date(p.nextReviewDate) <= now;
  });

  // 2. Hiç görülmemiş yeni kelimeler
  const unseenWords = allWords.filter((w) => {
    const p = wordProgress[w.id];
    return !p || p.correctCount === undefined;
  });

  // Seviye tercihine göre sırala
  const sortByLevel = (words) => {
    if (!preferredLevel) return words;
    return [
      ...words.filter((w) => w.level === preferredLevel),
      ...words.filter((w) => w.level !== preferredLevel),
    ];
  };

  // 3. Düşük ustalık seviyesindeki kelimeler
  const lowMasteryWords = allWords.filter((w) => {
    const p = wordProgress[w.id];
    if (!p) return false;
    const mastery = getMasteryLevel(p);
    return mastery > 0 && mastery < 3;
  });

  // Havuzları birleştir
  const pool = [...dueWords, ...sortByLevel(unseenWords), ...lowMasteryWords];

  // Tekrarları kaldır
  const seen = new Set();
  const unique = pool.filter((w) => {
    if (seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });

  // Yeterli kelime yoksa tüm havuzdan rastgele doldur
  if (unique.length < sessionSize) {
    const remaining = allWords.filter((w) => !seen.has(w.id));
    unique.push(...remaining.sort(() => Math.random() - 0.5));
  }

  return unique.slice(0, sessionSize);
}

// Bugün zaten çalışılan kelimeleri filtrele
export function filterTodayStudied(words, wordProgress) {
  const today = new Date().toDateString();
  return words.filter((w) => {
    const p = wordProgress[w.id];
    if (!p?.lastReviewDate) return true;
    return new Date(p.lastReviewDate).toDateString() !== today;
  });
}

// Günlük özet istatistik
export function getDailyStats(allWords, wordProgress) {
  const today = new Date().toDateString();
  const todayStudied = allWords.filter((w) => {
    const p = wordProgress[w.id];
    return (
      p?.lastReviewDate && new Date(p.lastReviewDate).toDateString() === today
    );
  }).length;

  const dueCount = allWords.filter((w) => {
    const p = wordProgress[w.id];
    if (!p?.nextReviewDate) return false;
    return new Date(p.nextReviewDate) <= new Date();
  }).length;

  const newCount = allWords.filter((w) => !wordProgress[w.id]).length;
  const masteredCount = allWords.filter(
    (w) => getMasteryLevel(wordProgress[w.id] || {}) >= 4
  ).length;

  return { todayStudied, dueCount, newCount, masteredCount };
}
