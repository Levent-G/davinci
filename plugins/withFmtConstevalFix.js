// plugins/withFmtConstevalFix.js
//
// DÜZELTME: GitHub Actions'ın macOS runner'ındaki en güncel Xcode (26.x),
// Firebase/Firestore'un gRPC bağımlılığı üzerinden gelen "fmt" kütüphanesiyle
// derlenirken "consteval function ... is not a constant expression" hatası
// veriyordu (EAS'ın kendi bulut build sunucuları daha eski/sabitlenmiş bir
// Xcode kullandığı için bu sorunu hiç yaşamıyorduk).
//
// İLK DENEME (GCC_PREPROCESSOR_DEFINITIONS ile FMT_CONSTEVAL='' tanımlamak)
// İŞE YARAMADI — demek ki fmt'nin asıl kontrol ettiği makro bu değilmiş.
//
// ASIL ÇÖZÜM: "consteval" zaten C++20'ye özel bir anahtar kelime — fmt
// kütüphanesi, derleyicinin C++20 (ve üstü) modunda olup olmadığını
// kontrol edip ancak o zaman consteval tabanlı derleme-zamanı format
// string doğrulamasını devreye sokuyor. SADECE "fmt" pod hedefinin C++
// standardını C++17'ye zorlayarak, bu kod yolu hiç derlenmiyor —
// fmt kendi iç mantığıyla (feature-test makroları üzerinden) otomatik
// olarak eski/consteval-olmayan moda düşüyor. Bu, kütüphanenin iç
// makro isimlerini bilmeye gerek bırakmayan, derleyici seviyesinde
// daha güvenilir bir çözüm.
const { withPodfile } = require("@expo/config-plugins");

const HOOK = `
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'
        config.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
      end
    end
  end
`;

module.exports = function withFmtConstevalFix(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes("CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'")) {
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
