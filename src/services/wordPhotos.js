// src/services/wordPhotos.js
// Kelime fotoğraflarını yönetir: her kelime için Firestore'da kalıcı bir
// "photos" havuzu tutulur. Bir kelime için bu havuz boşsa (ilk kez
// görülüyorsa) Pexels'ten 3 fotoğraf çekilip Firestore'a bir daha asla
// tekrar Pexels'e sormamak üzere kaydedilir — hem admin panelinden hem de
// öğrenme/tekrar ekranlarından çağrılan tek, paylaşılan kaynak budur.
import firestore from "@react-native-firebase/firestore";
import { File, Directory, Paths } from "expo-file-system";
import { COLLECTIONS, ensureFirebaseReady } from "./firebase";

const PEXELS_KEY = "Aqz9qqAJP1i5YMNmDzrPIm2TXAV8xnaMKF6KgZu43vBcREZ5sd15GMb9";

async function fetchPexelsPhotos(queryWord, perPage = 3) {
  try {
    const res = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(
        queryWord
      )}&per_page=${perPage}`,
      { headers: { Authorization: PEXELS_KEY } }
    );
    const data = await res.json();
    return (data.photos || []).map((p) => p.src.medium);
  } catch {
    return [];
  }
}

// word.photos doluysa direkt onu döner (Pexels'e hiç sormaz). Boşsa Pexels'ten
// çekip Firestore'a kalıcı olarak yazar, sonra döner. Dönen obje
// { photos, activeUrl } şeklindedir.
export async function getWordPhotos(word) {
  if (word?.photos?.length > 0) {
    return { photos: word.photos, activeUrl: word.imageUrl || word.photos[0] };
  }
  // Elimizdeki kelime kopyası bayat/yerel olabilir (ör. kelimeler Firebase'den
  // yüklenememiş ve yerel listeye düşülmüş): Pexels'ten çekip Firestore'daki
  // (admin'in yüklediği) fotoğrafların ÜSTÜNE YAZMADAN önce gerçek belgeye bak.
  if (word?.id) {
    try {
      await ensureFirebaseReady();
      const snap = await firestore()
        .collection(COLLECTIONS.WORDS)
        .doc(word.id)
        .get();
      const data = snap.exists ? snap.data() : null;
      if (data?.photos?.length > 0) {
        return {
          photos: data.photos,
          activeUrl: data.imageUrl || data.photos[0],
        };
      }
    } catch {
      // okunamadıysa Pexels'e düşeriz
    }
  }
  const fetched = await fetchPexelsPhotos(word.word);
  if (fetched.length > 0 && word?.id) {
    try {
      await ensureFirebaseReady();
      await firestore()
        .collection(COLLECTIONS.WORDS)
        .doc(word.id)
        .set(
          {
            photos: fetched,
            imageUrl: fetched[0],
            photosUpdatedAt: firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch {
      // Yazma başarısız olsa bile (ör. offline) kullanıcı yine de bu
      // oturumda fotoğrafları görebilsin diye devam ediyoruz.
    }
  }
  return { photos: fetched, activeUrl: fetched[0] || null };
}

// ─── YEREL FOTOĞRAF ÖNBELLEĞİ (offline tekrar için) ─────────────────────
// Bir kelime 5 aşamalı öğrenmeyi bitirip tekrar döngüsüne girdiğinde,
// fotoğrafı sadece bir URL olarak değil, cihaza GERÇEKTEN indirilip
// kaydediliyor — böylece tekrar (review) ekranında internet olmasa bile
// fotoğraf görünmeye devam ediyor. Henüz öğrenilmemiş (yeni) kelimeler için
// bu yapılmıyor; onlar için internet gerekiyor (bkz. LearningSessionScreen).
function getLocalPhotoFile(wordId) {
  return new File(Paths.document, "word_photos", `${wordId}.jpg`);
}

export function getLocalCachedPhotoUri(wordId) {
  try {
    const file = getLocalPhotoFile(wordId);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

export async function cacheWordPhotoLocally(wordId, remoteUrl) {
  if (!wordId || !remoteUrl) return null;
  try {
    const file = getLocalPhotoFile(wordId);
    if (file.exists) return file.uri;
    const dir = new Directory(Paths.document, "word_photos");
    if (!dir.exists) dir.create({ idempotent: true, intermediates: true });
    const downloaded = await File.downloadFileAsync(remoteUrl, file, {
      idempotent: true,
    });
    return downloaded.uri;
  } catch {
    // Offline ya da indirme başarısız — sessizce geç, review ekranı
    // uzak URL'e düşmeye devam eder.
    return null;
  }
}

// Havuza yeni bir fotoğraf ekler (admin galeriden yüklediğinde) ve onu aktif yapar.
export async function addWordPhoto(word, url) {
  const photos = [...(word.photos || []), url];
  await ensureFirebaseReady();
  // arrayUnion: iki cihaz aynı anda/ardışık ekleme yaptığında biri
  // diğerinin fotoğraflarını ezmesin diye diziyi baştan yazmıyoruz.
  await firestore()
    .collection(COLLECTIONS.WORDS)
    .doc(word.id)
    .set(
      {
        photos: firestore.FieldValue.arrayUnion(url),
        imageUrl: url,
        photosUpdatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  return photos;
}

// Havuzdan belirli bir fotoğrafı siler. Silinen aktif fotoğrafsa, havuzdaki
// bir sonraki fotoğraf otomatik aktif olur (hiç kalmazsa aktif de temizlenir).
export async function removeWordPhoto(word, url) {
  const photos = (word.photos || []).filter((p) => p !== url);
  const wasActive = word.imageUrl === url;
  const nextActive = wasActive ? photos[0] : word.imageUrl;
  await ensureFirebaseReady();
  await firestore()
    .collection(COLLECTIONS.WORDS)
    .doc(word.id)
    .set(
      {
        photos: firestore.FieldValue.arrayRemove(url),
        imageUrl: nextActive ?? firestore.FieldValue.delete(),
        photosUpdatedAt: firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  return { photos, activeUrl: nextActive || null };
}

// Havuzdaki mevcut bir fotoğrafı "aktif" (uygulamada gösterilen) yapar.
export async function setActiveWordPhoto(wordId, url) {
  await ensureFirebaseReady();
  await firestore()
    .collection(COLLECTIONS.WORDS)
    .doc(wordId)
    .set(
      { imageUrl: url, imageUpdatedAt: firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
}
