// plugins/withFmtConstevalFix.js
//
// DÜZELTME: GitHub Actions'ın macOS runner'ındaki en güncel Xcode (26.x),
// Firebase/Firestore'un gRPC bağımlılığı üzerinden gelen "fmt" kütüphanesiyle
// derlenirken "consteval function ... is not a constant expression" hatası
// veriyordu. Bu, fmt'nin C++20 `consteval` tabanlı derleme-zamanı format
// string doğrulamasıyla, Xcode 26'nın daha sıkı Clang sürümü arasındaki
// bilinen bir uyumsuzluk (EAS'ın kendi bulut build sunucuları daha eski/
// sabitlenmiş bir Xcode kullandığı için bu sorunu hiç yaşamıyorduk).
//
// Çözüm: fmt'nin "FMT_CONSTEVAL" makrosunu BOŞ olarak önceden tanımlayarak
// (derleyici ön işlemci tanımı ile) consteval kontrolünü devre dışı
// bırakıyoruz — fmt kütüphanesinin kendisi bu makroyu "#ifndef" ile
// koşullu tanımladığı için, önceden boş tanımlamak onu normal bir
// constexpr/hiçbir şeye düşürüyor ve derleme hatası ortadan kalkıyor.
// Bu SADECE "fmt" pod hedefine uygulanıyor, başka hiçbir şeyi etkilemiyor.
const { withPodfile } = require("@expo/config-plugins");

const HOOK = `
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |config|
        defs = config.build_settings['GCC_PREPROCESSOR_DEFINITIONS']
        defs = ['$(inherited)'] if defs.nil?
        defs = [defs] if defs.is_a?(String)
        defs << 'FMT_CONSTEVAL='
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] = defs
      end
    end
  end
`;

module.exports = function withFmtConstevalFix(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes("FMT_CONSTEVAL")) {
      return config; // zaten uygulanmış
    }
    if (contents.includes("post_install do |installer|")) {
      config.modResults.contents = contents.replace(
        "post_install do |installer|",
        `post_install do |installer|\n${HOOK}`
      );
    } else {
      config.modResults.contents = `${contents}\npost_install do |installer|\n${HOOK}\nend\n`;
    }
    return config;
  });
};
