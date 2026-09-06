// src/services/firebase.js
import firebase from "@react-native-firebase/app";
import firestore from "@react-native-firebase/firestore";

// GÜVENLİK AĞI: iOS'ta useFrameworks:"static" ile derlenen build'lerde
// Firebase'in native otomatik başlatması (GoogleService-Info.plist'ten)
// bazen çalışmıyor ve "No Firebase App '[DEFAULT]' has been created"
// hatası alınıyor. Native başlatma zaten olduysa bu no-op, olmadıysa
// burada elle (JS'den) başlatıyoruz.
try {
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyA8-ZUZNgf4mv7iLKkN0-uf145-SqqU1JA",
      appId: "1:502687781194:ios:601d7faab28f7cb37ab1b3",
      projectId: "davinci-d30bc",
      storageBucket: "davinci-d30bc.firebasestorage.app",
      messagingSenderId: "502687781194",
    });
  }
} catch {
  // Native taraf zaten başlatmış olabilir (ör. "app already exists") —
  // bu durumda uygulamanın çökmesini engellemek için hatayı yutuyoruz.
}

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

export const ADMIN_PIN = "1453";

/* ═══════════════════════════════════════════
   KULLANICI İŞLEMLERİ
═══════════════════════════════════════════ */

export async function getAllUsers(limitCount = 100) {
  try {
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
  firestore()
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .set(
      { ...data, updatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true }
    )
    .catch((e) => console.warn("saveUser bg:", e.message));
  return true;
}

export async function updateUserSubscription(userId, plan) {
  try {
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
    await firestore().collection(COLLECTIONS.USERS).doc(userId).delete();
    return true;
  } catch (e) {
    return false;
  }
}

/* ═══════════════════════════════════════════
   KELİME İŞLEMLERİ
═══════════════════════════════════════════ */

export async function getFirestoreWords(level = null) {
  try {
    let ref = firestore().collection(COLLECTIONS.WORDS);
    if (level) ref = ref.where("level", "==", level);
    // Cache'den önce oku (offline support)
    const snap = await ref.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("getFirestoreWords:", e);
    return [];
  }
}

export async function addFirestoreWord(wordData) {
  try {
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
    await firestore()
      .collection(COLLECTIONS.WORDS)
      .doc(wordId)
      .update({
        ...updates,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    return true;
  } catch (e) {
    return false;
  }
}

export async function deleteFirestoreWord(wordId) {
  try {
    await firestore().collection(COLLECTIONS.WORDS).doc(wordId).delete();
    return true;
  } catch (e) {
    return false;
  }
}

export async function updateWordImage(wordId, imageUrl) {
  try {
    await firestore()
      .collection(COLLECTIONS.WORDS)
      .doc(wordId)
      .update({
        imageUrl,
        imageUpdatedAt: firestore.FieldValue.serverTimestamp(),
      });
    return true;
  } catch (e) {
    return false;
  }
}

export async function seedWordsToFirestore(words) {
  try {
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
  firestore()
    .collection(COLLECTIONS.SESSIONS)
    .add({
      userId,
      ...sessionData,
      createdAt: firestore.FieldValue.serverTimestamp(),
    })
    .catch((e) => console.warn("saveSession bg:", e.message));
  return true;
}

export async function saveUserProgress(userId, wordId, progressData) {
  // Fire and forget - UI'yi bloklamaz
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
    .catch((e) => console.warn("saveProgress bg:", e.message));
  return true;
}

/* ═══════════════════════════════════════════
   ANALİTİK
═══════════════════════════════════════════ */

export async function getAppAnalytics() {
  try {
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

    // Sessions sayisi - basit get
    let sessionsCount = 0;
    try {
      const sessionsSnap = await firestore()
        .collection(COLLECTIONS.SESSIONS)
        .orderBy("createdAt", "desc")
        .limit(200)
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

/* ═══════════════════════════════════════════
   ADMIN AUTH
═══════════════════════════════════════════ */

export async function verifyAdminPin(pin) {
  try {
    const snap = await firestore()
      .collection(COLLECTIONS.ADMIN)
      .doc("config")
      .get();
    if (snap.exists && snap.data().pin) {
      return snap.data().pin === pin;
    }
    return pin === ADMIN_PIN;
  } catch {
    return pin === ADMIN_PIN;
  }
}

export async function updateAdminPin(newPin) {
  try {
    await firestore()
      .collection(COLLECTIONS.ADMIN)
      .doc("config")
      .set({ pin: newPin }, { merge: true });
    return true;
  } catch {
    return false;
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
  getWeeklySessionData,
  verifyAdminPin,
  updateAdminPin,
  COLLECTIONS,
};
