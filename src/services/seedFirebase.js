// seedFirebase.js
// Bu dosyayı AdminWordsScreen.jsx içindeki seed butonuna bağla
// VEYA doğrudan Node.js ile çalıştır: node seedFirebase.js

import firestore from '@react-native-firebase/firestore';
import { ALL_WORDS } from '../data/wordDatabase';

export const seedWordsToFirebase = async (onProgress) => {
  const BATCH_SIZE = 499; // Firestore max 500
  const total = ALL_WORDS.length;
  let uploaded = 0;

  try {
    // Batch'ler halinde yükle. merge:true kullanıyoruz — böylece admin
    // panelinden daha önce ayarlanmış bir imageUrl varsa (bkz.
    // AdminEditWordScreen), yeniden seed edildiğinde silinmez.
    for (let i = 0; i < total; i += BATCH_SIZE) {
      const batch = firestore().batch();
      const chunk = ALL_WORDS.slice(i, i + BATCH_SIZE);

      chunk.forEach((word) => {
        const ref = firestore().collection('words').doc(word.id);
        batch.set(
          ref,
          {
            ...word,
            createdAt: firestore.FieldValue.serverTimestamp(),
            masteryLevel: 0,
            timesShown: 0,
            timesCorrect: 0,
          },
          { merge: true }
        );
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
