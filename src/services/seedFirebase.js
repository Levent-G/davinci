// seedFirebase.js
// Bu dosyayı AdminWordsScreen.jsx içindeki seed butonuna bağla
// VEYA doğrudan Node.js ile çalıştır: node seedFirebase.js

import firestore from '@react-native-firebase/firestore';
import ALL_WORDS from '../data/wordDatabase';

export const seedWordsToFirebase = async (onProgress) => {
  const BATCH_SIZE = 499; // Firestore max 500
  const total = ALL_WORDS.length;
  let uploaded = 0;

  try {
    // Önce mevcut kelimeleri sil (isteğe bağlı)
    // const existing = await firestore().collection('words').get();
    // const deleteBatch = firestore().batch();
    // existing.docs.forEach(doc => deleteBatch.delete(doc.ref));
    // await deleteBatch.commit();

    // Batch'ler halinde yükle
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = firestore().batch();
      const chunk = ALL_WORDS.slice(i, i + BATCH_SIZE);

      chunk.forEach((word) => {
        const ref = firestore().collection('words').doc(word.id);
        batch.set(ref, {
          ...word,
          createdAt: firestore.FieldValue.serverTimestamp(),
          masteryLevel: 0,
          timesShown: 0,
          timesCorrect: 0,
        });
      });

      await batch.commit();
      uploaded += chunk.length;

      if (onProgress) {
        onProgress(uploaded, total);
      }
      console.log(`✅ ${uploaded}/${total} kelime yüklendi`);
    }

    console.log('🎉 Tüm kelimeler Firebase\'e yüklendi!');
    return { success: true, count: total };
  } catch (error) {
    console.error('❌ Seed hatası:', error);
    return { success: false, error: error.message };
  }
};