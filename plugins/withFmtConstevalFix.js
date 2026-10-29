// plugins/withFmtConstevalFix.js
//
// DÜZELTME: GitHub Actions'ın macOS runner'ındaki en güncel Xcode (26.x),
// Firebase/Firestore'un gRPC bağımlılığı üzerinden gelen "fmt" kütüphanesiyle
// derlenirken "consteval function ... is not a constant expression" hatası
// veriyordu (EAS'ın kendi bulut build sunucuları daha eski/sabitlenmiş bir
// Xcode kullandığı için bu sorunu hiç yaşamıyorduk).
//
// 1. DENEME (FMT_CONSTEVAL='' preprocessor tanımı) İŞE YARAMADI.
// 2. DENEME (CLANG_CXX_LANGUAGE_STANDARD=gnu++17, mevcut post_install
//    bloğunun EN BAŞINA enjekte edilerek) İŞE YARAMADI — çünkü aynı blok
//    içinde bizden SONRA çalışan react_native_post_install(...) tüm
//    hedefler için C++ standardını tekrar C++20'ye zorluyor.
// 3. DENEME (ayrı/ikinci bir post_install bloğu eklemek) CocoaPods
//    tarafından TAMAMEN REDDEDİLDİ: "Specifying multiple post_install
//    hooks is unsupported."
//
// ASIL ÇÖZÜM: CocoaPods'ta SADECE TEK bir post_install bloğu olabiliyor —
// o yüzden kendi kodumuzu o TEK bloğun İÇİNE ama EN SONUNA (kapanış
// `end`'inden hemen önce) eklememiz gerekiyor ki react_native_post_install
// dahil bloktaki HER ŞEYDEN sonra çalışıp üzerine yazabilsin. Bunu
// güvenilir yapmak için basit bir Ruby "do/if/end" derinlik sayacıyla
// post_install bloğunun GERÇEK kapanış satırını buluyoruz (iç içe
// bloklar olsa bile).
const { withPodfile } = require("@expo/config-plugins");

const HOOK = `
  # withFmtConstevalFix: fmt hedefinin C++ standardını C++17'ye zorlar —
  # "consteval" C++20'ye özel olduğu için bu kod yolu hiç derlenmez.
  # Bilerek post_install bloğunun EN SONUNA eklendi (react_native_post_
  # install'ın üzerine yazabilmek için).
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'
      end
    end
  end
`;

const BLOCK_OPENERS = /\bdo(\s*\|[^|]*\|)?\s*$/;
const LINE_OPENERS = /^\s*(if|unless|case|class|def|module|begin)\b/;
const LINE_CLOSER = /^\s*end\b/;

function findMatchingEnd(lines, startIndex) {
  // startIndex, "post_install do |installer|" satırının index'i — derinlik 1'den başlar.
  let depth = 1;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (LINE_CLOSER.test(line)) {
      depth -= 1;
      if (depth === 0) return i;
    } else if (BLOCK_OPENERS.test(line) || LINE_OPENERS.test(line)) {
      depth += 1;
    }
  }
  return -1;
}

module.exports = function withFmtConstevalFix(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes("withFmtConstevalFix")) {
      return config; // zaten uygulanmış
    }
    const lines = contents.split("\n");
    const startIndex = lines.findIndex((l) =>
      /post_install\s+do\s*\|installer\|/.test(l)
    );
    if (startIndex === -1) {
      // post_install hiç yoksa normal şekilde ekle (tek blok).
      config.modResults.contents = `${contents}\npost_install do |installer|\n${HOOK}\nend\n`;
      return config;
    }
    const endIndex = findMatchingEnd(lines, startIndex);
    if (endIndex === -1) {
      // Kapanışı güvenle bulamadıysak dokunmadan bırak — derleme hatası
      // riske atmaktan iyidir, bir sonraki iterasyonda tekrar denenir.
      return config;
    }
    lines.splice(endIndex, 0, HOOK);
    config.modResults.contents = lines.join("\n");
    return config;
  });
};
