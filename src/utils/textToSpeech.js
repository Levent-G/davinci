// src/utils/textToSpeech.js
import * as Speech from "expo-speech";

// DÜZELTME: TTS motoru (özellikle iOS/Android native sentezleyici) ilk kez
// çağrıldığında sesleri/motoru yükleyip hazırlıyor — bu yükleme birkaç yüz
// ms ile birkaç saniye arası sürebiliyor. Bu gecikme kullanıcı ilk kez
// "Sesli Dinle"ye bastığında yaşanıyordu (motor henüz "soğuk"). Sonraki
// çağrılarda motor bellekte hazır kaldığı için gecikme olmuyordu.
//
// Çözüm: uygulama açılır açılmaz, kullanıcı hiçbir şeye dokunmadan, sessiz
// (volume: 0) ve neredeyse boş bir metinle bir kez konuşma motorunu
// "ısıtıyoruz". Gerçek gecikme burada, kullanıcı fark etmeden tüketiliyor;
// kullanıcının ilk gerçek tıklaması artık hızlı çalışıyor.
let warmedUp = false;

// iOS: varsayılan olarak konuşma uygulamanın ses oturumunu kullanır ve
// telefonun SESSİZ modunda (zil anahtarı kapalı) hiç ses çıkmaz. false
// verilince sistem konuşma için ayrı bir ses oturumu açar ve sessiz modda
// da duyulur (Android'de yok sayılır).
const SESSION = { useApplicationAudioSession: false };

export function warmUpSpeech(language = "en-US") {
  if (warmedUp) return;
  warmedUp = true;
  try {
    // NOT: burada ...SESSION (useApplicationAudioSession:false) KASITLI
    // OLARAK kullanılmıyor. Bu, sistemin konuşma için ayrı bir ses oturumu
    // açmasını sağlıyor — ki sessiz moddaki gerçek "Sesli Dinle" çağrılarında
    // istediğimiz tam da bu. Ama bu ısıtma çağrısı volume:0 ile duyulmaz
    // olmalıydı; ayrı oturumla birlikte kullanılınca sessiz modda bile kısa,
    // anlaşılmaz bir ses duyulmaya başladı. Isıtma sesinin duyulmasına hiç
    // gerek olmadığı için burada varsayılan (uygulamanın kendi) oturumu
    // kullanıyoruz — volume:0 orada güvenilir şekilde sessiz kalıyor.
    Speech.speak(".", {
      language,
      pitch: 1.0,
      rate: 1.0,
      volume: 0, // duyulmasın
      onError: () => {}, // ısınma sırasında hata sessizce yutulur
    });
  } catch {
    // ısınma denemesi başarısız olsa bile normal akışı etkilemesin
  }
}

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
