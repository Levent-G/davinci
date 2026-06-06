// bump-version.js — proje kök dizinine koy
// Kullanım: node bump-version.js
// Her çalıştırmada versionCode +1, version patch +1 yapar

const fs = require("fs");
const path = require("path");

const appJsonPath = path.join(__dirname, "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const expo = appJson.expo;

// Mevcut değerleri al
const currentVersion = expo.version || "1.0.0"; // "1.0.3"
const currentCode = expo.android?.versionCode || 1; // 3

// versionCode +1
const newCode = currentCode + 1;

// version patch +1  (1.0.3 -> 1.0.4)
const parts = currentVersion.split(".");
parts[2] = String(parseInt(parts[2] || "0") + 1);
const newVersion = parts.join(".");

// Güncelle
expo.version = newVersion;
if (!expo.android) expo.android = {};
expo.android.versionCode = newCode;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

console.log(`✅ Versiyon güncellendi:`);
console.log(`   version:     ${currentVersion} → ${newVersion}`);
console.log(`   versionCode: ${currentCode} → ${newCode}`);
console.log(`\n🔨 Şimdi build al:`);
console.log(
  `   cd android && .\\gradlew.bat bundleRelease -x lintVitalReportRelease -x lintVitalAnalyzeRelease -x lintVitalRelease`
);
