// ─── STATUS ───────────────────────────────────────────────
export const STATUS = {
  NEW: "new",
  KNOWN: "known",
  LEARNING: "learning",
  REVIEW: "review",
  LEARNED: "learned",
};
export const WORD_STATUS = STATUS;

// GERÇEK DEĞERLER — test modu kapatıldı.
// Tekrarlar artık 1 saatte 1 (HOUR), gün geçişi 24 saatte 1 (DAY).
// Bu iki sabit HOUR/DAY tüm ekranlarda (LearningSessionScreen,
// ReviewScreen, notifications) TEK kaynaktan (buradan) import edilip
// kullanılıyor — başka hiçbir dosyada ayrıca tanımlı değil, bu yüzden
// senkron bozulma riski yok.
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * 60 * 60 * 1000;

// Günlük hedef: bir günde tamamlanması gereken kelime sayısı
// (hem yeni öğrenilen hem de tekrar edilip bugün sonuçlanan kelimeler dahil)
export const DAILY_TARGET = 5;

// ─── YARDIMCILAR ─────────────────────────────────────────
export const isToday = (d) =>
  !!d && new Date(d).toDateString() === new Date().toDateString();
export const isDue = (t) => !!t && Date.now() >= new Date(t).getTime();
export const getStatus = (p) => p?.status || STATUS.NEW;
export const getWordStatus = getStatus;
export const isDueForReview = (p) => isDue(p?.nextReviewAt);

// Bir progress kaydının "bugün dokunuldu mu" olduğunu tek yerden kontrol et.
// DÜZELTME: eskiden sadece startedAt kontrol ediliyordu; ama tekrar (quiz)
// sırasında startedAt hiç güncellenmiyor, bu yüzden "bugün" tespiti
// ikinci ve sonraki günlerde hep yanlış çıkıyordu. updatedAt eklendi.
const touchedToday = (p) => isToday(p?.startedAt) || isToday(p?.updatedAt);

// ─── 5 AŞAMA BİTTİ ───────────────────────────────────────
// Kelime learning → review, ilk tekrar 1 saat sonra
export const afterLearning = (prog) => ({
  ...prog,
  status: STATUS.REVIEW,
  reviewsDone: 0,
  wrongTotal: 0,
  dayDone: false,
  startedAt: prog.startedAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nextReviewAt: new Date(Date.now() + HOUR).toISOString(),
});

// ─── QUIZ CEVABI ─────────────────────────────────────────
// Her tekrarda reviewsDone++, 3'te karar ver
export const afterQuiz = (prog, isCorrect) => {
  const reviewsDone = (prog.reviewsDone || 0) + 1;
  const wrongTotal = (prog.wrongTotal || 0) + (isCorrect ? 0 : 1);
  const now = new Date().toISOString();

  if (reviewsDone >= 3) {
    if (wrongTotal >= 3) {
      // 3 yanlış → ertesi gün baştan (nextReviewAt = DAY sonrası)
      return {
        ...prog,
        status: STATUS.REVIEW,
        reviewsDone: 0,
        wrongTotal: 0,
        updatedAt: now,
        nextReviewAt: new Date(Date.now() + DAY).toISOString(),
        dayDone: true, // bu kelimenin bugünkü işi bitti (yarına ertelendi)
      };
    }
    // Öğrenildi!
    return {
      ...prog,
      status: STATUS.LEARNED,
      reviewsDone: 3,
      wrongTotal,
      updatedAt: now,
      learnedAt: now,
      nextReviewAt: new Date(Date.now() + DAY).toISOString(),
      dayDone: true, // bu kelimenin bugünkü işi bitti (öğrenildi)
    };
  }

  // Devam — bir sonraki tekrar 1 saat sonra
  // DÜZELTME (KRİTİK): Bu dal eskiden dayDone alanını hiç sıfırlamıyordu.
  // ...prog spread edildiği için, kelime önceki bir döngüde dayDone:true
  // olmuşsa (örn. dün 3 yanlış yapıp yarına ertelenmişse), bugün 1.
  // turunu daha yeni bitirmişken bile dayDone hâlâ true kalıyordu. Bu da
  // "kelime bugün tamamen bitti" sanılmasına ve daha 3 tur bitmeden
  // "Yarın seni bekliyorum" ekranının erken tetiklenmesine yol açıyordu.
  return {
    ...prog,
    status: STATUS.REVIEW,
    reviewsDone,
    wrongTotal,
    dayDone: false,
    updatedAt: now,
    nextReviewAt: new Date(Date.now() + HOUR).toISOString(),
  };
};

// ─── QUIZ SEÇENEKLERİ ────────────────────────────────────
export const generateQuizOptions = (word, allWords, count = 4) => {
  const others = allWords
    .filter((w) => w.id !== word.id)
    .sort(() => Math.random() - 0.5)
    .slice(0, count - 1)
    .map((w) => ({ word: w, isCorrect: false }));
  return [{ word, isCorrect: true }, ...others].sort(() => Math.random() - 0.5);
};
export const quizOptions = generateQuizOptions;

// ─── SORGULAR ────────────────────────────────────────────

// Tekrar zamanı gelmiş kelimeler
export const getReviewWords = (allWords, progress) =>
  allWords.filter((w) => {
    const p = progress[w.id];
    return p?.status === STATUS.REVIEW && isDue(p.nextReviewAt);
  });
export const getTodayReviewWords = getReviewWords;

// Yeni kelimeler (hiç görülmemiş)
export const getNewWords = (allWords, progress, level, count = 5) =>
  allWords
    .filter((w) => {
      if (level && w.level !== level) return false;
      const s = progress[w.id]?.status;
      return !s || s === STATUS.NEW;
    })
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
export const getDailyWords = getNewWords;

// Bugün öğrenme başladı mı (geriye dönük uyumluluk için tutuldu;
// artık gating mantığında kullanılmıyor)
export const hasDoneSessionToday = (progress) =>
  Object.values(progress).some(
    (p) =>
      [STATUS.REVIEW, STATUS.LEARNED].includes(p?.status) && touchedToday(p)
  );

// ─── GÜNLÜK PARTİ (BATCH) TAKİBİ — TAKVİM TARİHİNDEN BAĞIMSIZ ───────────
// DÜZELTME (KRİTİK): Eskiden "bugün" gerçek takvim tarihine (isToday) göre
// hesaplanıyordu. Ama test sabitleriyle (HOUR=1dk, DAY=2dk) test ederken
// "Gün 1" ve "Gün 2" aynı gerçek takvim günü içinde geçiyor — bu yüzden
// Gün 1'de biten 5 kelime hâlâ "bugün" sayılıp, Gün 2'de siz daha 1 tekrar
// bile yapmadan "Yarın seni bekliyorum" ekranı yanlışlıkla tetikleniyordu.
// Artık hiçbir yerde gerçek tarihe bakılmıyor; sadece kelimenin kendi
// durumuna (due / bekliyor / dinleniyor) bakılıyor. Bu hem test modunda
// hem gerçek kullanımda (HOUR=1sa, DAY=24sa) doğru çalışır.

// Hâlâ 3 turluk döngüde ama şu an due OLMAYAN (bir sonraki tura kadar
// bekleyen) kelime sayısı
export const getWaitingReviewCount = (progress) =>
  Object.values(progress).filter(
    (p) => p?.status === STATUS.REVIEW && !p?.dayDone && !isDue(p?.nextReviewAt)
  ).length;

// Döngüsü tamamlanıp (öğrenildi ya da 3 yanlışla ertelendi) şu an
// "dinlenme" süresinde olan (henüz tekrar zamanı gelmemiş) kelime sayısı
export const getRestingCount = (progress) =>
  Object.values(progress).filter(
    (p) =>
      p?.dayDone &&
      !isDue(p?.nextReviewAt) &&
      (p?.status === STATUS.REVIEW || p?.status === STATUS.LEARNED)
  ).length;

// Şu an döngüde olan (REVIEW && !dayDone) tüm kelimeler — due olsun ya da
// olmasın. Bildirimde "kaç kelime" yazacağını hesaplamak için kullanılır.
export const getInFlightReviewCount = (progress) =>
  Object.values(progress).filter(
    (p) => p?.status === STATUS.REVIEW && !p?.dayDone
  ).length;

// Şu anki "parti"de (batch) kullanılan toplam slot sayısı: şu an due
// olanlar + hâlâ döngüde olup due olmayanlar + dinlenenler.
export const getBatchInPlayCount = (
  allWords,
  progress,
  target = DAILY_TARGET
) =>
  Math.min(
    getReviewWords(allWords, progress).length +
      getWaitingReviewCount(progress) +
      getRestingCount(progress),
    target
  );

// ─── GRUP (BATCH) ZAMAN SENKRONİZASYONU ─────────────────────────────────
// DÜZELTME (KRİTİK): Eskiden her kelimenin nextReviewAt'i tamamen bağımsız
// hesaplanıyordu (kendi tamamlanma anından +HOUR). Bu yüzden dünden kalan
// kelimeler ile bugün yeni öğrenilen kelimeler farklı anlarda "due"
// oluyor, tekrarlar "1 kelime geldi, bitince biraz sonra 3 kelime daha
// geldi" şeklinde parça parça, tutarsız görünüyordu.
// Artık bir kelime döngüye her katıldığında (yeni öğrenildiğinde ya da bir
// tekrar turunu bitirip bir sonrakini beklemeye başladığında), o an
// döngüde olan DİĞER kelimelerin (henüz due olmamış, gelecekte planlı)
// EN ERKEN zamanına hizalanıyor. Böylece bütün "günlük 5" grubu ortak tek
// bir zamanlamada ilerliyor — 1. tekrar hepsi için aynı anda açılıyor,
// 2. ve 3. tekrar da öyle.
export const getGroupNextReviewAt = (progress, excludeId) => {
  const times = Object.entries(progress)
    .filter(
      ([id, p]) =>
        id !== excludeId &&
        p?.status === STATUS.REVIEW &&
        !p?.dayDone &&
        p?.nextReviewAt &&
        !isDue(p.nextReviewAt) // sadece henüz due OLMAMIŞ (gelecekteki) zamanlar geçerli
    )
    .map(([, p]) => new Date(p.nextReviewAt).getTime());
  return times.length ? Math.min(...times) : null;
};

// DÜZELTME (KRİTİK): Bir kelime 3. turunu bitirip döngüden çıktığında
// (öğrenildi ya da yarına ertelendi — dayDone:true), o kelimenin
// "dinlenme" bitiş zamanı (nextReviewAt=+DAY) eskiden tamamen bağımsız
// hesaplanıyordu — o anda hangi saniyede cevaplandıysa o saniyeye göre.
// Aynı gündeki 5 kelime sırayla cevaplandığı için (her biri arasında
// birkaç saniyelik quiz-animasyon gecikmesi var), bu küçük fark test
// modunda (DAY=2dk gibi kısa) bazı kelimelerin "yarın"ı diğerlerinden
// önce gelmesine yol açıyordu — "hepsini doğru yaptım ama ertesi gün
// '2 kelime daha' dedi" şikayetinin sebebi tam olarak buydu (3 kelime
// zaten süresi geçip düşmüştü, 2'si henüz dinleniyordu). Şimdi bu geçiş
// de gruba hizalanıyor — grupta zaten dinlenen (dayDone:true, henüz due
// olmamış) başka kelime varsa, bu kelime de aynı zamana katılıyor.
export const getGroupRestingAt = (progress, excludeId) => {
  const times = Object.entries(progress)
    .filter(
      ([id, p]) =>
        id !== excludeId &&
        p?.dayDone &&
        p?.nextReviewAt &&
        !isDue(p.nextReviewAt) &&
        (p?.status === STATUS.REVIEW || p?.status === STATUS.LEARNED)
    )
    .map(([, p]) => new Date(p.nextReviewAt).getTime());
  return times.length ? Math.min(...times) : null;
};

// Bir kelimenin taze hesaplanmış progress'ini (prog) gruba hizalar:
//  - hâlâ döngüdeyse (REVIEW && !dayDone) → döngüdeki diğer kelimelerin
//    ortak "bir sonraki tur" zamanına
//  - döngüsü yeni bittiyse (dayDone:true) → zaten dinlenen diğer
//    kelimelerin ortak "dinlenme bitişi" zamanına
// Grupta eşleşen başka kelime yoksa, kelimenin kendi zamanı aynen kalır.
export const alignToGroup = (prog, progress, wordId) => {
  if (!prog) return prog;
  if (prog.status === STATUS.REVIEW && !prog.dayDone) {
    const groupTime = getGroupNextReviewAt(progress, wordId);
    if (groupTime == null) return prog;
    return { ...prog, nextReviewAt: new Date(groupTime).toISOString() };
  }
  if (
    prog.dayDone &&
    (prog.status === STATUS.REVIEW || prog.status === STATUS.LEARNED)
  ) {
    const groupTime = getGroupRestingAt(progress, wordId);
    if (groupTime == null) return prog;
    return { ...prog, nextReviewAt: new Date(groupTime).toISOString() };
  }
  return prog;
};

// Sonraki tekrar ne zaman (dayDone olanları sayma — onlar ertesi gün)
export const getNextReviewIn = (progress) => {
  const pending = Object.values(progress)
    .filter(
      (p) =>
        p?.status === STATUS.REVIEW &&
        p.nextReviewAt &&
        !isDue(p.nextReviewAt) &&
        !p.dayDone
    )
    .map((p) => new Date(p.nextReviewAt).getTime());
  if (!pending.length) return null;
  const diff = Math.min(...pending) - Date.now();
  return {
    hours: Math.floor(diff / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    ms: diff,
  };
};

// Tekrar tipi
export const getReviewType = (words, progress) => {
  const done = words.map((w) => progress[w.id]?.reviewsDone || 0);
  const avg = done.length
    ? Math.round(done.reduce((a, b) => a + b, 0) / done.length)
    : 0;
  return avg === 0 ? "r1" : avg === 1 ? "r2" : "r3";
};

// İstatistikler
export const getDailyStats = (allWords, progress) => ({
  totalLearned: allWords.filter(
    (w) => progress[w.id]?.status === STATUS.LEARNED
  ).length,
  totalKnown: allWords.filter((w) => progress[w.id]?.status === STATUS.KNOWN)
    .length,
  todayStudied: allWords.filter((w) => touchedToday(progress[w.id])).length,
  dueCount: getReviewWords(allWords, progress).length,
});

export const getMasteryLevel = (p) => {
  const s = p?.status;
  if (s === STATUS.LEARNED) return 5;
  if (s === STATUS.REVIEW) return 2 + (p.reviewsDone || 0);
  if (s === STATUS.KNOWN) return 4;
  return 0;
};
export const getMasteryLabel = (l) =>
  ["Yeni", "Başlangıç", "Gelişiyor", "İyi", "Çok İyi", "Uzman"][Math.min(l, 5)];
export const calculateStreak = () => 0;

export default {
  STATUS,
  WORD_STATUS,
  HOUR,
  DAY,
  DAILY_TARGET,
  isToday,
  isDue,
  getStatus,
  getWordStatus,
  isDueForReview,
  afterLearning,
  afterQuiz,
  generateQuizOptions,
  quizOptions,
  getReviewWords,
  getTodayReviewWords,
  getNewWords,
  getDailyWords,
  hasDoneSessionToday,
  getWaitingReviewCount,
  getRestingCount,
  getInFlightReviewCount,
  getBatchInPlayCount,
  getGroupNextReviewAt,
  getGroupRestingAt,
  alignToGroup,
  getNextReviewIn,
  getReviewType,
  getDailyStats,
  getMasteryLevel,
  getMasteryLabel,
  calculateStreak,
};
