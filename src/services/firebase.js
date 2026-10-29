// src/services/firebase.js
import { Platform } from "react-native";
import firebase from "@react-native-firebase/app";
import firestore from "@react-native-firebase/firestore";

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA8-ZUZNgf4mv7iLKkN0-uf145-SqqU1JA",
  appId: Platform.select({
    android: "1:502687781194:android:5eb25a8ef17eec847ab1b3",
    default: "1:502687781194:ios:601d7faab28f7cb37ab1b3",
  }),
  projectId: "davinci-d30bc",
  storageBucket: "davinci-d30bc.firebasestorage.app",
  messagingSenderId: "502687781194",
  // RNFB initializeApp bu alanı (Realtime Database kullanılmasa bile)
  // ZORUNLU tutuyor; eksikse çağrı sessizce Promise reddiyle başarısız oluyor.
  databaseURL: "https://davinci-d30bc-default-rtdb.firebaseio.com",
};

// GÜVENLİK AĞI: iOS üretim build'lerinde Firebase'in native otomatik
// başlatması (GoogleService-Info.plist'ten) çalışmayabiliyor ve
// "No Firebase App '[DEFAULT]' has been created" hatası alınıyor. Bu durumda
// varsayılan uygulamayı JS'ten kendimiz başlatıyoruz. `initializeApp` bir
// Promise döndürür (hatası try/catch ile DEĞİL await ile yakalanır) ve native
// taraf bitmeden Firestore'a dokunmamak için mutlaka beklenmelidir.
let initPromise = null;
let lastInitError = null;
export function getLastInitError() {
  return lastInitError;
}

export async function ensureFirebaseReady() {
  if (!initPromise) {
    initPromise = (async () => {
      if (firebase.apps.length) return; // native taraf zaten başlatmış
      try {
        await firebase.initializeApp(FIREBASE_CONFIG);
        lastInitError = null;
      } catch (e) {
        lastInitError = e?.message || String(e);
        console.warn("[firebase] initializeApp başarısız:", lastInitError);
        // native taraf bu arada başlattıysa sorun yok; değilse bir sonraki
        // çağrıda sıfırdan tekrar denensin.
        if (!firebase.apps.length) initPromise = null;
      }
    })();
  }
  await initPromise;
}

// Modül yüklenir yüklenmez başlatma denemesi yap; asıl garanti her
// fonksiyonun başındaki `await ensureFirebaseReady()`.
ensureFirebaseReady();

// Firestore offline persistence aktif et (ilk çağrıda bir kez)
let persistenceEnabled = false;
function getFirestore() {
  if (!persistenceEnabled) {
    persistenceEnabled = true;
    firestore()
      .settings({
        persistence: true,
        cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
      })
      .catch(() => {}); // Zaten ayarlıysa hata vermesin
  }
  return firestore;
}

export const COLLECTIONS = {
  USERS: "users",
  WORDS: "words",
  USER_PROGRESS: "userProgress",
  SESSIONS: "sessions",
  ADMIN: "admin",
};

/* ═══════════════════════════════════════════
   KULLANICI İŞLEMLERİ
═══════════════════════════════════════════ */

export async function getAllUsers(limitCount = 100) {
  try {
    await ensureFirebaseReady();
    const snap = await firestore()
      .collection(COLLECTIONS.USERS)
      .limit(limitCount)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("getAllUsers:", e);
    return [];
  }
}

export async function getUserStats(userId) {
  try {
    await ensureFirebaseReady();
    const snap = await firestore()
      .collection(COLLECTIONS.USER_PROGRESS)
      .doc(userId)
      .get();
    return snap.exists ? snap.data() : null;
  } catch (e) {
    return null;
  }
}

export async function saveUser(userId, data) {
  // Fire and forget - UI'yi bloklamaz
  ensureFirebaseReady()
    .then(() =>
      firestore()
        .collection(COLLECTIONS.USERS)
        .doc(userId)
        .set(
          { ...data, updatedAt: firestore.FieldValue.serverTimestamp() },
          { merge: true }
        )
    )
    .catch((e) => console.warn("saveUser bg:", e.message));
  return true;
}

export async function updateUserSubscription(userId, plan) {
  try {
    await ensureFirebaseReady();
    await firestore()
      .collection(COLLECTIONS.USERS)
      .doc(userId)
      .update({
        "subscription.plan": plan,
        "subscription.isPremium": plan === "premium",
        "subscription.updatedAt": firestore.FieldValue.serverTimestamp(),
      });
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteUser(userId) {
  try {
    await ensureFirebaseReady();
    await firestore().collection(COLLECTIONS.USERS).doc(userId).delete();
    return true;
  } catch (e) {
    return false;
  }
}

/* ═══════════════════════════════════════════
   KELİME İŞLEMLERİ
═══════════════════════════════════════════ */

let lastWordsError = null;
export function getLastWordsError() {
  return lastWordsError;
}

// Admin panelinden yapılan bir düzenlemeden hemen sonra eski (cache'deki)
// veriyi göstermemek için önce doğrudan sunucudan okuyoruz; sunucuya
// ulaşılamazsa (ağ/zaman aşımı) yerel önbelleğe düşüyoruz.
async function fetchWordsQuery(ref) {
  try {
    return await ref.get({ source: "server" });
  } catch {
    return await ref.get();
  }
}

// ~5600 belgeyi tek büyük istekle çekmek yerine seviye seviye (6 küçük
// sorgu, paralel) çekiyoruz — tek büyük okuma bazı cihazlarda zaman
// aşımına düşüp sessizce boş liste döndürüyordu.
export async function getFirestoreWords(level = null) {
  try {
    await ensureFirebaseReady();
    const col = firestore().collection(COLLECTIONS.WORDS);
    const levels = level ? [level] : ["A1", "A2", "B1", "B2", "C1", "C2"];
    const snaps = await Promise.all(
      levels.map((lvl) => fetchWordsQuery(col.where("level", "==", lvl)))
    );
    lastWordsError = null;
    return snaps.flatMap((snap) =>
      snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    );
  } catch (e) {
    lastWordsError = e?.message || String(e);
    console.error("getFirestoreWords:", e);
    return [];
  }
}

export async function addFirestoreWord(wordData) {
  try {
    await ensureFirebaseReady();
    const ref = await firestore()
      .collection(COLLECTIONS.WORDS)
      .add({
        ...wordData,
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        source: "admin",
      });
    return { id: ref.id, ...wordData };
  } catch (e) {
    return null;
  }
}

export async function updateFirestoreWord(wordId, updates) {
  try {
    // set + merge kullanıyoruz (update değil): kelime henüz seed edilmemişse
    // bile (doc yoksa) admin ekranından yapılan düzenleme kaybolmaz.
    await ensureFirebaseReady();
    await firestore()
      .collection(COLLECTIONS.WORDS)
      .doc(wordId)
      .set(
        {
          ...updates,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteFirestoreWord(wordId) {
  try {
    await ensureFirebaseReady();
    await firestore().collection(COLLECTIONS.WORDS).doc(wordId).delete();
    return true;
  } catch (e) {
    return false;
  }
}

export async function updateWordImage(wordId, imageUrl) {
  try {
    // set + merge (update değil): kelime henüz Firestore'a seed edilmemişse
    // bile (doc yoksa) admin panelinden fotoğraf ayarlamak başarısız olmaz.
    // imageUrl kaldırılıyorsa (null) alanı gerçekten siliyoruz (FieldValue.delete)
    // — düz null değeri bırakmıyoruz ki "özel fotoğraf var mı" kontrolleri
    // (word.imageUrl) her yerde tutarlı çalışsın.
    await ensureFirebaseReady();
    await firestore()
      .collection(COLLECTIONS.WORDS)
      .doc(wordId)
      .set(
        {
          imageUrl: imageUrl ?? firestore.FieldValue.delete(),
          imageUpdatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    return true;
  } catch (e) {
    return false;
  }
}

export async function seedWordsToFirestore(words) {
  try {
    await ensureFirebaseReady();
    const batch = firestore().batch();
    words.forEach((word) => {
      const ref = firestore().collection(COLLECTIONS.WORDS).doc(word.id);
      batch.set(
        ref,
        {
          ...word,
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          source: "seed",
        },
        { merge: true }
      );
    });
    await batch.commit();
    return true;
  } catch (e) {
    console.error("seedWords:", e);
    return false;
  }
}

/* ═══════════════════════════════════════════
   OTURUM & İLERLEME
═══════════════════════════════════════════ */

export async function saveSession(userId, sessionData) {
  // Fire and forget - UI'yi bloklamaz
  ensureFirebaseReady()
    .then(() =>
      firestore()
        .collection(COLLECTIONS.SESSIONS)
        .add({
          userId,
          ...sessionData,
          createdAt: firestore.FieldValue.serverTimestamp(),
        })
    )
    .catch((e) => console.warn("saveSession bg:", e.message));
  return true;
}

export async function saveUserProgress(userId, wordId, progressData) {
  // Fire and forget - UI'yi bloklamaz
  ensureFirebaseReady()
    .then(() =>
      firestore()
        .collection(COLLECTIONS.USER_PROGRESS)
        .doc(`${userId}_${wordId}`)
        .set(
          {
            userId,
            wordId,
            ...progressData,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
    )
    .catch((e) => console.warn("saveProgress bg:", e.message));
  return true;
}

/* ═══════════════════════════════════════════
   ANALİTİK
═══════════════════════════════════════════ */

// Normal kullanıcıların İstatistikler ekranında "topluluk ortalaması"
// gösterebilmesi için — en fazla 300 kullanıcılık bir örneklemden basit
// ortalamalar çıkarır. Tüm kullanıcı koleksiyonunu taramadığı (limit'li)
// ve çağıran taraf (StatsScreen) günlük önbelleklediği için maliyeti
// düşük tutuyoruz.
export async function getCommunityAverages() {
  try {
    await ensureFirebaseReady();
    const snap = await firestore().collection(COLLECTIONS.USERS).limit(300).get();
    const users = snap.docs.map((d) => d.data());
    const n = users.length;
    if (n === 0) return null;
    const sum = (fn) => users.reduce((s, u) => s + (fn(u) || 0), 0);
    return {
      sampleSize: n,
      avgWordsLearned: Math.round(sum((u) => u.stats?.totalWordsLearned) / n),
      avgStreak: Math.round(sum((u) => u.stats?.streak) / n),
      avgSessions: Math.round(sum((u) => u.stats?.totalSessions) / n),
    };
  } catch (e) {
    return null;
  }
}

export async function getAppAnalytics() {
  try {
    await ensureFirebaseReady();
    const [usersSnap, wordsSnap] = await Promise.all([
      firestore().collection(COLLECTIONS.USERS).get(),
      firestore().collection(COLLECTIONS.WORDS).get(),
    ]);

    const users = usersSnap.docs.map((d) => d.data());
    const premiumCount = users.filter(
      (u) => u.subscription?.plan === "premium"
    ).length;
    const trialCount = users.filter(
      (u) => u.subscription?.plan === "trial"
    ).length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const activeToday = users.filter((u) => {
      const last = u.lastActiveAt?.toDate?.();
      return last && last >= today;
    }).length;

    // DÜZELTME: eskiden tarih filtresi olmadan "en son 200 kayıt"
    // sayılıyordu — ekranda "30 Günlük Oturum" yazsa da gösterilen sayı
    // gerçekte 30 güne bağlı değildi (200'den az oturum varsa tüm zamanları
    // kapsıyordu, 200'den fazlaysa 30 günden daha kısa bir pencereyi
    // kapsayabiliyordu). Artık gerçekten son 30 günü filtreliyor.
    let sessionsCount = 0;
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      const sessionsSnap = await firestore()
        .collection(COLLECTIONS.SESSIONS)
        .where("createdAt", ">=", thirtyDaysAgo)
        .get();
      sessionsCount = sessionsSnap.size;
    } catch (e) {}

    return {
      totalUsers: usersSnap.size,
      premiumUsers: premiumCount,
      trialUsers: trialCount,
      freeUsers: usersSnap.size - premiumCount - trialCount,
      totalWords: wordsSnap.size,
      sessions30d: sessionsCount,
      activeToday,
      conversionRate:
        usersSnap.size > 0
          ? ((premiumCount / usersSnap.size) * 100).toFixed(1)
          : "0.0",
    };
  } catch (e) {
    console.error("getAppAnalytics:", e);
    return {
      totalUsers: 0,
      premiumUsers: 0,
      trialUsers: 0,
      freeUsers: 0,
      totalWords: 0,
      sessions30d: 0,
      activeToday: 0,
      conversionRate: "0.0",
    };
  }
}

export async function getWeeklySessionData() {
  try {
    await ensureFirebaseReady();
    // 7 ayrı sorgu yerine tek sorguda son 7 günü çek
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const snap = await firestore()
      .collection(COLLECTIONS.SESSIONS)
      .where("createdAt", ">=", sevenDaysAgo)
      .orderBy("createdAt", "desc")
      .limit(500)
      .get();

    // Günlere göre grupla
    const dayCounts = {};
    snap.docs.forEach((d) => {
      const date = d.data().createdAt?.toDate?.();
      if (date) {
        const key = date.toDateString();
        dayCounts[key] = (dayCounts[key] || 0) + 1;
      }
    });

    // Son 7 günü oluştur
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      data.push({
        label: ["Paz", "Pzt", "Sal", "Car", "Per", "Cum", "Cmt"][d.getDay()],
        count: dayCounts[d.toDateString()] || 0,
        date: d.toDateString(),
      });
    }
    return data;
  } catch (e) {
    return ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"].map((l) => ({
      label: l,
      count: 0,
      date: "",
    }));
  }
}

export default {
  getAllUsers,
  getUserStats,
  saveUser,
  updateUserSubscription,
  deleteUser,
  getFirestoreWords,
  addFirestoreWord,
  updateFirestoreWord,
  deleteFirestoreWord,
  updateWordImage,
  seedWordsToFirestore,
  saveSession,
  saveUserProgress,
  getAppAnalytics,
  getCommunityAverages,
  getWeeklySessionData,
  COLLECTIONS,
};
