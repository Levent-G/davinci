// src/utils/theme.js

export const COLORS = {
  // Ana renkler - derin gece mavisi + altın vurgu (Da Vinci esintisi)
  background: "#0A0E1A",
  backgroundSecondary: "#111827",
  backgroundCard: "#161D2E",
  backgroundCardLight: "#1E2740",

  // Altın / amber vurgu
  accent: "#F5A623",
  accentLight: "#FFB940",
  accentDark: "#C4841A",
  accentGlow: "rgba(245, 166, 35, 0.15)",

  // İkincil vurgu - teal / turkuaz
  secondary: "#4ECDC4",
  secondaryLight: "#7EDDD7",
  secondaryDark: "#2EA89F",
  secondaryGlow: "rgba(78, 205, 196, 0.15)",

  // Metin renkleri
  textPrimary: "#F0EAD6", // krem beyaz
  textSecondary: "#9BA3BA",
  textMuted: "#5C6480",
  textAccent: "#F5A623",

  // Durum renkleri
  success: "#4CAF50",
  successLight: "#81C784",
  successGlow: "rgba(76, 175, 80, 0.2)",
  error: "#EF5350",
  errorLight: "#EF9A9A",
  errorGlow: "rgba(239, 83, 80, 0.2)",
  warning: "#FFA726",

  // Seviye renkleri
  levelA1: "#4ECDC4",
  levelA2: "#45B7D1",
  levelB1: "#96CEB4",
  levelB2: "#F5A623",
  levelC1: "#E17055",
  levelC2: "#A29BFE",

  // Davinci method adım renkleri
  step1: "#F5A623", // Gözlem
  step2: "#4ECDC4", // Bağlantı
  step3: "#A29BFE", // Görselleştirme
  step4: "#81C784", // Tekrar
  step5: "#E17055", // Test

  // Overlay
  overlay: "rgba(0,0,0,0.6)",
  overlayLight: "rgba(0,0,0,0.3)",

  // Border
  border: "rgba(255,255,255,0.08)",
  borderAccent: "rgba(245, 166, 35, 0.3)",

  // Gradient stops
  gradientStart: "#0A0E1A",
  gradientMid: "#111827",
  gradientEnd: "#0D1526",
};

export const FONTS = {
  // Display font - büyük başlıklar için
  display: "Georgia", // fallback, expo-font ile özel font yüklenebilir
  displayBold: "Georgia",

  // Body font
  body: "System",
  bodyBold: "System",

  // Mono
  mono: "Courier New",
};

export const FONT_SIZES = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 42,
  hero: 56,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  section: 64,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOWS = {
  accent: {
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  secondary: {
    shadowColor: "#4ECDC4",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  soft: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
};

export default {
  COLORS,
  FONTS,
  FONT_SIZES,
  SPACING,
  RADIUS,
  SHADOWS,
};
