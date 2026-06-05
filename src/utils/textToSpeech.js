// src/utils/textToSpeech.js
import * as Speech from "expo-speech";

export function speakWord(word, language = "en-US") {
  Speech.stop();
  Speech.speak(word, {
    language,
    pitch: 1.0,
    rate: 0.85,
    onError: (e) => console.warn("TTS error:", e),
  });
}

export function speakSentence(sentence, language = "en-US") {
  Speech.stop();
  Speech.speak(sentence, {
    language,
    pitch: 1.0,
    rate: 0.9,
  });
}

export function stopSpeaking() {
  Speech.stop();
}

export async function isSpeakingAsync() {
  return await Speech.isSpeakingAsync();
}
