// bump-version.js — proje kök dizinine koy
// Kullanım: node bump-version.js
// app.json VE android/app/build.gradle'ı aynı anda günceller

const fs = require("fs");
const path = require("path");

// ── app.json güncelle ──────────────────────────────────────────
const appJsonPath = path.join(__dirname, "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const currentVersion = appJson.expo.version || "1.0.0";
const currentCode = appJson.expo.android?.versionCode || 1;

const newCode = currentCode + 1;
const parts = currentVersion.split(".");
parts[2] = String(parseInt(parts[2] || "0") + 1);
const newVersion = parts.join(".");

appJson.expo.version = newVersion;
if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = newCode;

fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));

// ── build.gradle güncelle ──────────────────────────────────────
const gradlePath = path.join(__dirname, "android", "app", "build.gradle");
let gradle = fs.readFileSync(gradlePath, "utf8");

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${newCode}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);

fs.writeFileSync(gradlePath, gradle);

// ── Sonuç ──────────────────────────────────────────────────────
console.log("✅ Versiyon güncellendi:");
console.log(`   version:     ${currentVersion} → ${newVersion}`);
console.log(`   versionCode: ${currentCode} → ${newCode}`);
console.log("   → app.json ✓");
console.log("   → android/app/build.gradle ✓");
console.log("\n🔨 Şimdi build al:");
console.log("   cd android");
console.log(
  "   .\\gradlew.bat bundleRelease -x lintVitalReportRelease -x lintVitalAnalyzeRelease -x lintVitalRelease"
);
