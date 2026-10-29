// ─── STATUS ───────────────────────────────────────────────
export const STATUS = {
  NEW: "new",
  KNOWN: "known",
  LEARNING: "learning",
  REVIEW: "review",
  LEARNED: "learned",
};
export const WORD_STATUS = STATUS;

// GERÇEK DEĞERLER — tekrar aralığı 2 saatte 1 (HOUR adı korunuyor ama
// değeri 2 saat), gün geçişi 24 saatte 1 (DAY).
// Bu iki sabit HOUR/DAY tüm ekranlarda (LearningSessionScreen,
// ReviewScreen, notifications) TEK kaynaktan (buradan) import edilip
// kullanılıyor — başka hiçbir dosyada ayrıca tanımlı değil, bu yüzden
// senkron bozulma riski yok.
export const HOUR = 2 * 60 * 60 * 1000;
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
const touchedToday = (p) => isToday(p?.startedAt) || isToday(p?.updatedAt);

// ─── 5 AŞAMA BİTTİ ───────────────────────────────────────
// Kelime learning → review, ilk tekrar HOUR sonra (bkz. üstteki sabit)
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
        dayDone: true,
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
      dayDone: true,
    };
  }

  // Devam — bir sonraki tekrar HOUR sonra
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

// Tekrar zamanı gelmiş kelimeler.
// Döngü içindeyken (dayDone: false) 2 saatlik tur bekleme süresi hâlâ
// saate göre (isDue). Ama döngüsü bitip "dinlenmeye" geçmiş (dayDone:
// true, örn. 3 yanlışla ertelenmiş) bir kelime için artık 24 saat
// SAYMIYORUZ — takvim günü değiştiği an (gece yarısı geçince, ne kadar
// saat geçmiş olursa olsun) tekrar hazır sayılıyor. Bkz. getRestingCount.
//
// toleranceMs (varsayılan 0): farklı günlerde/zamanlarda başlamış, birbirine
// hiç katılamamış kelime grupları zamanla bağımsız saatlerde ilerleyebiliyor
// — biri due olup kullanıcı tekrarı bitirdikten az sonra (dakikalar içinde)
// bir başka grup ayrıca due oluyor, art arda ama AYRI tekrar ekranları
// çıkıyordu. toleranceMs > 0 verilince, henüz tam due olmamış ama yakın
// zamanda (örn. 30 dk içinde) due olacak kelimeler de şimdiden dahil
// edilir — aynı oturumda cevaplandıklarında nextReviewAt zaten o anki
// zamana göre yeniden hesaplanacağı için (bkz. afterQuiz) bundan sonra
// doğal olarak senkronize kalırlar. Kapasite/istatistik hesaplarında
// (getBatchInPlayCount, getDailyStats) yanlışlıkla erken sayım olmasın diye
// bu parametre sadece LearnScreen'in "şimdi tekrar göster" çağrısında
// kullanılıyor, varsayılanı 0 (katı) kalıyor.
export const getReviewWords = (allWords, progress, toleranceMs = 0) =>
  allWords.filter((w) => {
    const p = progress[w.id];
    if (p?.status !== STATUS.REVIEW) return false;
    if (p?.dayDone) return !isToday(p.updatedAt);
    if (!p.nextReviewAt) return false;
    return Date.now() + toleranceMs >= new Date(p.nextReviewAt).getTime();
  });
export const getTodayReviewWords = getReviewWords;
// Yakın zamanlı grupları tek oturumda toplamak için kullanılan tolerans.
export const REVIEW_MERGE_TOLERANCE = 30 * 60 * 1000; // 30 dakika

// Bugün "dokunulan" (öğrenmeye başlanan ya da biliyorum denen) yeni
// kelime sayısı — ücretsiz kullanıcının günlük limitini kontrol etmek için.
export const getTodayNewWordsCount = (progress) =>
  Object.values(progress).filter(
    (p) => p && (isToday(p.startedAt) || isToday(p.knownAt))
  ).length;

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
// "Bugün" hiçbir yerde gerçek takvim tarihine göre değil, kelimenin kendi
// durumuna (due / bekliyor / dinleniyor) göre hesaplanıyor. Bu hem test
// modunda (kısa HOUR/DAY) hem gerçek kullanımda doğru çalışır.

// Hâlâ 3 turluk döngüde ama şu an due OLMAYAN (bir sonraki tura kadar
// bekleyen) kelime sayısı
export const getWaitingReviewCount = (progress) =>
  Object.values(progress).filter(
    (p) => p?.status === STATUS.REVIEW && !p?.dayDone && !isDue(p?.nextReviewAt)
  ).length;

// Aynı kelimeler (sadece sayı değil) — LearnScreen'deki "Devam Et"
// butonunun bu kelimelerin beklemesini atlayıp şimdi due yapması için.
export const getWaitingReviewWords = (allWords, progress) =>
  allWords.filter((w) => {
    const p = progress[w.id];
    return p?.status === STATUS.REVIEW && !p?.dayDone && !isDue(p?.nextReviewAt);
  });

// 5 aşamayı bitirip "hazır bekleyen" (ama günün 5'lik partisi henüz
// tamamlanmadığı için tekrar döngüsüne SENKRON olarak henüz girmemiş)
// kelime sayısı. LearnScreen'in günlük kota hesabına dahil edilmeli —
// yoksa kullanıcı 3 kelime yapıp "Öğren"e tekrar basınca kota hâlâ dolu
// görünmediği için 5 kelime DAHA istenir (partiyi 5 yerine 8'e çıkarır).
export const getReadyForReviewCount = (progress) =>
  Object.values(progress).filter(
    (p) => p?.status === STATUS.LEARNING && p?.readyForReview
  ).length;

// Döngüsü tamamlanıp (öğrenildi ya da 3 yanlışla ertelendi) şu an
// "dinlenme" süresinde olan kelime sayısı. TAKVİM GÜNÜNE göre: kelime
// tamamlandığı takvim günü içindeyse hâlâ dinleniyor sayılır; takvim
// günü değiştiği an (gece yarısı geçince) dinlenmesi biter — 24 saat
// dolmasını beklemeye gerek yok.
export const getRestingCount = (progress) =>
  Object.values(progress).filter(
    (p) =>
      p?.dayDone &&
      isToday(p?.updatedAt) &&
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
// Bir kelime döngüye her katıldığında (yeni öğrenildiğinde ya da bir
// tekrar turunu bitirip bir sonrakini beklemeye başladığında), o an
// döngüde olan DİĞER kelimelerin (henüz due olmamış, gelecekte planlı)
// EN ERKEN zamanına hizalanıyor. Böylece bütün "günlük 5" grubu ortak tek
// bir zamanlamada ilerliyor.
//
// Bu fonksiyon SADECE "devam eden" turlar (quiz cevaplanırken, reviewsDone
// zaten >=1) için kullanılıyor. Kasıtlı olarak sadece henüz due OLMAMIŞ
// (gelecekteki) zamanlara bakıyor: bir tur işlenirken, henüz sırası
// gelmemiş diğer kelimelerin nextReviewAt'i o anki (eski, zaten due olmuş)
// turun tetikleme zamanını taşır — bunu bir sonraki tur için referans
// almak yanlış olurdu (kelimeyi geçmişe/yanlış zamana hizalardı).
export const getGroupNextReviewAt = (progress, excludeId) => {
  const times = Object.entries(progress)
    .filter(
      ([id, p]) =>
        id !== excludeId &&
        p?.status === STATUS.REVIEW &&
        !p?.dayDone &&
        p?.nextReviewAt &&
        !isDue(p.nextReviewAt)
    )
    .map(([, p]) => new Date(p.nextReviewAt).getTime());
  return times.length ? Math.min(...times) : null;
};

// DÜZELTME (KRİTİK — GÜN İÇİ SENKRON BUGU):
// Eskiden bir kelime DÖNGÜYE İLK KEZ KATILDIĞINDA (5 aşamalı öğrenmeyi yeni
// bitirdiğinde) da yukarıdaki getGroupNextReviewAt kullanılıyordu — yani
// SADECE henüz due olmamış (bekleyen) diğer kelimelere bakılıyordu.
//
// SORUN (test edip doğrulandı): dünden kalıp bugün tekrar edilen kelimeler
// (örn. 2 kelime) ile aynı gün yeni öğrenilen kelimeler (örn. 3 kelime)
// arasında, 5 aşamalı öğrenme gerçek zamanda dakikalarca sürebiliyor. Bu
// süre içinde dünkü kelimelerin "bir sonraki tekrar" zamanı geçip due
// olabiliyor. Yeni kelime öğrenmeyi bitirip gruba katılmaya çalıştığında,
// artık due olmuş bu kelimeler getGroupNextReviewAt'in "!isDue" filtresi
// yüzünden GÖRÜNMÜYORDU — hiçbir eşleşme bulunamıyor, yeni kelime kendi
// bağımsız (dünkülerden farklı) saatine göre planlanıyordu. Sonuç:
// "günlük 5" grubu ikiye bölünüyor, dünkü/bugünkü kelimelerin tekrarları
// ayrı ayrı zamanlarda tetikleniyordu (kullanıcının bildirdiği bug —
// simülasyonla doğrulandı).
//
// ÇÖZÜM: kelime döngüye YENİ katılıyorsa (reviewsDone === 0, yani daha hiç
// tekrar yapmadı), önce bekleyen (due olmamış) bir grup aranır; öyle bir
// grup yoksa ama halihazırda DUE OLMUŞ (tekrar sırası gelmiş ama henüz
// cevaplanmamış) bir grup varsa, yeni kelime de HEMEN onlarla aynı due
// zamana hizalanır — yani o da hemen due olur ve aynı tekrar oturumuna
// dahil olur. Devam eden turlarda (reviewsDone >= 1) bu fonksiyon
// KULLANILMAZ; onlar için eski, katı (sadece bekleyenlere bakan) mantık
// aynen korunur — böylece tur-içi işleme sırasında yanlışlıkla geçmiş/
// tetikleyici zamana hizalanma riski oluşmaz (regresyon testiyle
// doğrulandı).
export const getGroupJoinAnchor = (progress, excludeId) => {
  const entries = Object.entries(progress).filter(
    ([id, p]) =>
      id !== excludeId &&
      p?.status === STATUS.REVIEW &&
      !p?.dayDone &&
      p?.nextReviewAt
  );
  if (!entries.length) return null;
  const waiting = entries.filter(([, p]) => !isDue(p.nextReviewAt));
  const pool = waiting.length ? waiting : entries; // bekleyen yoksa due olan gruba katıl
  return Math.min(...pool.map(([, p]) => new Date(p.nextReviewAt).getTime()));
};

// Döngüsü tamamlanıp (öğrenildi ya da 3 yanlışla ertelendi) şu an
// "dinlenme"de olan diğer kelimelerin ortak dinlenme bitiş zamanı.
export const getGroupRestingAt = (progress, excludeId) => {
  const times = Object.entries(progress)
    .filter(
      ([id, p]) =>
        id !== excludeId &&
        p?.dayDone &&
        p?.nextReviewAt &&
        isToday(p.updatedAt) &&
        (p?.status === STATUS.REVIEW || p?.status === STATUS.LEARNED)
    )
    .map(([, p]) => new Date(p.nextReviewAt).getTime());
  return times.length ? Math.min(...times) : null;
};

// Bir kelimenin taze hesaplanmış progress'ini (prog) gruba hizalar:
//  - döngüye YENİ katılıyorsa (reviewsDone === 0, öğrenmeden yeni çıktı)
//    → getGroupJoinAnchor: bekleyen bir grup varsa ona, yoksa hâlihazırda
//    due olmuş bir gruba (hemen due olacak şekilde) hizalanır. [DÜZELTİLDİ]
//  - hâlâ döngüdeyse ve devam ediyorsa (REVIEW && !dayDone, reviewsDone>=1)
//    → döngüdeki diğer kelimelerin ortak "bir sonraki tur" (bekleyen)
//    zamanına.
//  - döngüsü yeni bittiyse (dayDone:true) → zaten dinlenen diğer
//    kelimelerin ortak "dinlenme bitişi" zamanına.
// Grupta eşleşen başka kelime yoksa, kelimenin kendi zamanı aynen kalır.
export const alignToGroup = (prog, progress, wordId) => {
  if (!prog) return prog;
  if (prog.status === STATUS.REVIEW && !prog.dayDone) {
    if (prog.reviewsDone === 0) {
      const anchor = getGroupJoinAnchor(progress, wordId);
      if (anchor == null) return prog;
      return { ...prog, nextReviewAt: new Date(anchor).toISOString() };
    }
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

// Kaç gündür arka arkaya kelime öğrenilmiş (bugün dahil, geriye doğru
// kesintisiz sayılır). stats.dailyStats her günün wordsLearned sayısını
// tutar — bugünden geriye doğru gidip ilk boş/0 günde durur.
// NOT: Daha önce burası hatalı şekilde `() => 0` olarak sabitlenmişti
// (bir test/debug denemesinin kalıntısı), bu yüzden streak özelliği
// tamamen kırıktı — hiçbir zaman 0'ın üstüne çıkmıyordu.
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
  REVIEW_MERGE_TOLERANCE,
  getTodayNewWordsCount,
  getNewWords,
  getDailyWords,
  hasDoneSessionToday,
  getWaitingReviewCount,
  getWaitingReviewWords,
  getReadyForReviewCount,
  getRestingCount,
  getInFlightReviewCount,
  getBatchInPlayCount,
  getGroupNextReviewAt,
  getGroupJoinAnchor,
  getGroupRestingAt,
  alignToGroup,
  getNextReviewIn,
  getReviewType,
  getDailyStats,
  getMasteryLevel,
  getMasteryLabel,
  calculateStreak,
};
