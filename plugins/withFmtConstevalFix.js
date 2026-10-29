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
//    bloğunun EN BAŞINA enjekte edilerek) DE İŞE YARAMADI — çünkü aynı
//    post_install bloğu içinde bizim ayarımızdan SONRA çalışan React
//    Native'in kendi `react_native_post_install(...)` çağrısı, TÜM pod
//    hedefleri için (fmt dahil) C++ standardını tekrar C++20'ye
//    zorluyor ve bizim ayarımızın üzerine yazıyordu.
//
// ASIL ÇÖZÜM: Kendi ayarımızı, mevcut post_install bloğunun İÇİNE enjekte
// etmek yerine, dosyanın EN SONUNA tamamen AYRI, YENİ bir
// `post_install do |installer| ... end` bloğu olarak ekliyoruz. CocoaPods
// birden fazla post_install hook'unu KAYIT SIRASINA göre çalıştırır — en
// sonda tanımlanan blok her zaman EN SON çalışır, yani react_native_post_
// install'ın (ve başka her şeyin) üzerine güvenle yazabiliyoruz.
const { withPodfile } = require("@expo/config-plugins");

const FOOTER = `
# withFmtConstevalFix: fmt hedefinin C++ standardını C++17'ye zorlar —
# "consteval" C++20'ye özel olduğu için bu kod yolu hiç derlenmez.
# Ayrı/sonda bir post_install bloğu olarak EN SON çalışır, react-native'in
# kendi post_install'ının üzerine yazar.
post_install do |installer|
  installer.pods_project.targets.each do |target|
    if target.name == 'fmt'
      target.build_configurations.each do |config|
        config.build_settings['CLANG_CXX_LANGUAGE_STANDARD'] = 'gnu++17'
      end
    end
  end
end
`;

module.exports = function withFmtConstevalFix(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    if (contents.includes("withFmtConstevalFix")) {
      return config; // zaten uygulanmış
    }
    config.modResults.contents = `${contents}\n${FOOTER}`;
    return config;
  });
};
