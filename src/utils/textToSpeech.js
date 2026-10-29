// src/utils/textToSpeech.js
import * as Speech from "expo-speech";

// DÜZELTME: Daha önce burada, TTS motorunu önceden "ısıtmak" için uygulama
// açılır açılmaz sessiz (volume:0) bir metin (".") konuşturuluyordu. Ama
// volume:0 bazı cihazlarda/durumlarda (özellikle motorun gerçekten "soğuk"
// olduğu ilk çağrıda) güvenilir şekilde uygulanmıyordu — kullanıcı,
// hiçbir şeye dokunmadan, uygulamayı açar açmaz kısa bir ses duyuyordu.
// Bu, "Sesli Dinle" demeden konuşuyor" şikayetine yol açtı. İlk tıklamadaki
// birkaç yüz ms'lik gecikmeyi önlemek, istenmeden ses çıkmasından çok daha
// küçük bir sorun — bu yüzden ısıtma tamamen kaldırıldı. TTS artık SADECE
// kullanıcı "Sesli Dinle"ye bastığında konuşuyor.

// iOS: varsayılan olarak konuşma uygulamanın ses oturumunu kullanır ve
// telefonun SESSİZ modunda (zil anahtarı kapalı) hiç ses çıkmaz. false
// verilince sistem konuşma için ayrı bir ses oturumu açar ve sessiz modda
// da duyulur (Android'de yok sayılır).
const SESSION = { useApplicationAudioSession: false };

// Geriye dönük uyumluluk için tutuluyor (App.js hâlâ çağırıyor) — artık
// bilerek hiçbir şey yapmıyor.
export function warmUpSpeech() {}

export function speakWord(word, language = "en-US") {
  Speech.stop();
  Speech.speak(word, {
    language,
    pitch: 1.0,
    rate: 0.85,
    ...SESSION,
    onError: (e) => console.warn("TTS error:", e),
  });
}

export function speakSentence(sentence, language = "en-US") {
  Speech.stop();
  Speech.speak(sentence, {
    language,
    pitch: 1.0,
    rate: 0.9,
    ...SESSION,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export async function isSpeakingAsync() {
  return await Speech.isSpeakingAsync();
}
