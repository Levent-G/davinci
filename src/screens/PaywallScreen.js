// src/screens/PaywallScreen.jsx
import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS, SHADOWS } from "../utils/theme";
import { useSubscription } from "../context/SubscriptionContext";
import { isPurchasesConfigured } from "../services/purchases";

const { width } = Dimensions.get("window");

const FEATURES = [
  { icon: "♾️", text: "Sınırsız kelime öğrenme", premium: true },
  { icon: "🔄", text: "Aralıklı tekrar algoritması", premium: true },
  { icon: "📊", text: "Detaylı ilerleme istatistikleri", premium: true },
  { icon: "✏️", text: "Özel kelime ekleme", premium: true },
  { icon: "🎯", text: "Kişiselleştirilmiş öğrenme planı", premium: true },
  { icon: "🔔", text: "Akıllı tekrar hatırlatıcıları", premium: true },
];

// RevenueCat'ten teklif çekilemezse (API anahtarı henüz girilmemişse) bu
// sadece GÖRSEL bir yer tutucudur — bu durumda satın alma butonu devre
// dışı kalır, sahte bir "premium" verilmez (bkz. handleSubscribe).
const FALLBACK_PLANS = [
  { id: "monthly", label: "Aylık", price: "—", period: "/ay", savings: null, isPopular: false },
  { id: "yearly", label: "Yıllık", price: "—", period: "/yıl", savings: null, isPopular: true },
];

function packageLabel(pkg) {
  const type = pkg.packageType;
  if (type === "MONTHLY") return "Aylık";
  if (type === "ANNUAL") return "Yıllık";
  if (type === "WEEKLY") return "Haftalık";
  if (type === "LIFETIME") return "Ömür Boyu";
  return pkg.identifier;
}

export default function PaywallScreen({ navigation }) {
  const { state: subState, actions: subActions } = useSubscription();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const [offeringPackages, setOfferingPackages] = React.useState(null); // null = yüklenmedi, [] = teklif yok
  const [selectedPkg, setSelectedPkg] = React.useState(null);
  const [purchasing, setPurchasing] = React.useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 70,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    (async () => {
      const offering = await subActions.getOfferings();
      const pkgs = offering?.availablePackages || [];
      setOfferingPackages(pkgs);
      const annual = pkgs.find((p) => p.packageType === "ANNUAL");
      setSelectedPkg(annual || pkgs[0] || null);
    })();
  }, []);

  const plans = offeringPackages?.length
    ? offeringPackages.map((pkg) => ({
        id: pkg.identifier,
        label: packageLabel(pkg),
        price: pkg.product.priceString,
        period: pkg.packageType === "MONTHLY" ? "/ay" : pkg.packageType === "ANNUAL" ? "/yıl" : "",
        savings: pkg.packageType === "ANNUAL" ? "En avantajlı" : null,
        isPopular: pkg.packageType === "ANNUAL",
        pkg,
      }))
    : FALLBACK_PLANS;

  const canPurchase = isPurchasesConfigured() && !!selectedPkg;

  const handleSubscribe = () => {
    if (!canPurchase) {
      Alert.alert(
        "Satın Alma Şu An Kullanılamıyor",
        "Abonelik sistemi henüz mağaza tarafında yapılandırılmadı. Lütfen daha sonra tekrar deneyin."
      );
      return;
    }
    const plan = plans.find((p) => p.pkg === selectedPkg);
    Alert.alert(
      "Premium'a Geç",
      `${plan?.label || ""} ${plan?.price || ""}${
        plan?.period || ""
      } planına abone olmak istediğinden emin misin?`,
      [
        { text: "İptal", style: "cancel" },
        {
          text: "Devam Et",
          onPress: async () => {
            setPurchasing(true);
            try {
              const granted = await subActions.purchase(selectedPkg);
              if (granted) {
                Alert.alert(
                  "Premium Aktif!",
                  "Premium üyeliğin aktif edildi. Sınırsız öğrenmenin tadını çıkar!",
                  [{ text: "Harika!", onPress: () => navigation.goBack() }]
                );
              }
            } catch (e) {
              if (!e?.userCancelled) {
                Alert.alert("Satın Alma Başarısız", e?.message || "Bir şeyler ters gitti.");
              }
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

  const handleRestore = async () => {
    try {
      const granted = await subActions.restore();
      Alert.alert(
        granted ? "Geri Yüklendi!" : "Satın Alım Bulunamadı",
        granted
          ? "Premium üyeliğin geri yüklendi."
          : "Bu hesaba bağlı aktif bir satın alım bulunamadı."
      );
    } catch (e) {
      Alert.alert("Hata", e?.message || "Geri yükleme sırasında bir sorun oluştu.");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Close */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="close" size={22} color={COLORS.textSecondary} />
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero */}
        <Animated.View
          style={[
            styles.hero,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.heroIconWrapper}>
            <LinearGradient
              colors={[COLORS.accent, COLORS.accentDark]}
              style={styles.heroIconGradient}
            >
              <Text style={styles.heroIcon}>✨</Text>
            </LinearGradient>
          </View>
          <Text style={styles.heroTitle}>Da Vinci Premium</Text>
          <Text style={styles.heroSubtitle}>
            {subState.isTrialExpired
              ? "Deneme süren bitti, öğrenmeye devam etmek için premium'a geç"
              : `${subState.trialDaysLeft} günlük deneme sürüyor — Premium'un tüm özelliklerine bak`}
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View style={[styles.featuresSection, { opacity: fadeAnim }]}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <View style={styles.featureIconBox}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={styles.featureText}>{f.text}</Text>
              <Ionicons
                name="checkmark-circle"
                size={20}
                color={COLORS.success}
              />
            </View>
          ))}
        </Animated.View>

        {/* Plans */}
        <Animated.View style={[styles.plansSection, { opacity: fadeAnim }]}>
          <Text style={styles.plansTitle}>Plan Seç</Text>
          {offeringPackages === null ? (
            <ActivityIndicator color={COLORS.accent} style={{ marginVertical: SPACING.lg }} />
          ) : (
            plans.map((plan) => (
              <TouchableOpacity
                key={plan.id}
                style={[
                  styles.planCard,
                  selectedPkg === plan.pkg && styles.planCardSelected,
                  plan.isPopular && styles.planCardPopular,
                ]}
                onPress={() => plan.pkg && setSelectedPkg(plan.pkg)}
                activeOpacity={0.85}
                disabled={!plan.pkg}
              >
                {plan.isPopular && (
                  <View style={styles.popularBadge}>
                    <Text style={styles.popularBadgeText}>En Çok Seçilen</Text>
                  </View>
                )}
                <View style={styles.planRow}>
                  <View
                    style={[
                      styles.planRadio,
                      selectedPkg === plan.pkg && styles.planRadioSelected,
                    ]}
                  >
                    {selectedPkg === plan.pkg && (
                      <View style={styles.planRadioDot} />
                    )}
                  </View>
                  <View style={styles.planInfo}>
                    <Text style={styles.planLabel}>{plan.label}</Text>
                    {plan.savings && (
                      <Text style={styles.planSavings}>{plan.savings}</Text>
                    )}
                  </View>
                  <View style={styles.planPriceCol}>
                    <Text
                      style={[
                        styles.planPrice,
                        selectedPkg === plan.pkg && { color: COLORS.accent },
                      ]}
                    >
                      {plan.price}
                    </Text>
                    <Text style={styles.planPeriod}>{plan.period}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
          {offeringPackages?.length === 0 && (
            <Text style={styles.finePrint}>
              Şu an aktif bir abonelik planı bulunamadı. Lütfen daha sonra tekrar dene.
            </Text>
          )}
        </Animated.View>

        {/* Subscribe Button */}
        <TouchableOpacity
          style={[styles.subscribeButton, (!canPurchase || purchasing) && { opacity: 0.5 }]}
          onPress={handleSubscribe}
          activeOpacity={0.9}
          disabled={purchasing}
        >
          <LinearGradient
            colors={[COLORS.accent, COLORS.accentDark]}
            style={styles.subscribeGradient}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.subscribeText}>Premium'a Geç →</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Fine print */}
        <Text style={styles.finePrint}>
          İstediğin zaman iptal edebilirsin. Ödeme App Store / Google Play
          üzerinden gerçekleşir.
        </Text>

        <TouchableOpacity onPress={handleRestore} style={styles.restoreButton}>
          <Text style={styles.restoreText}>Satın Alımı Geri Yükle</Text>
        </TouchableOpacity>

        <View style={{ height: SPACING.xxxl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  closeButton: {
    position: "absolute",
    top: 56,
    right: SPACING.lg,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  scroll: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.xxl },

  hero: { alignItems: "center", gap: SPACING.md, paddingBottom: SPACING.xl },
  heroIconWrapper: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOWS.accent,
  },
  heroIconGradient: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.xl,
  },
  heroIcon: { fontSize: 40 },
  heroTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxxl,
    fontWeight: "800",
    textAlign: "center",
  },
  heroSubtitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
    textAlign: "center",
    lineHeight: 24,
  },

  featuresSection: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  featureIconBox: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.backgroundCardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  featureIcon: { fontSize: 18 },
  featureText: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZES.md },

  plansSection: { marginBottom: SPACING.xl },
  plansTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    marginBottom: SPACING.md,
  },
  planCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: "visible",
  },
  planCardSelected: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentGlow,
  },
  planCardPopular: { borderColor: COLORS.accent + "60" },
  popularBadge: {
    position: "absolute",
    top: -12,
    left: SPACING.lg,
    backgroundColor: COLORS.accent,
    paddingHorizontal: SPACING.md,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  popularBadgeText: {
    color: "#fff",
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
  },
  planRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  planRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  planRadioSelected: { borderColor: COLORS.accent },
  planRadioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.accent,
  },
  planInfo: { flex: 1 },
  planLabel: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  planSavings: {
    color: COLORS.success,
    fontSize: FONT_SIZES.xs,
    fontWeight: "700",
    backgroundColor: COLORS.successGlow,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  planPriceCol: { alignItems: "flex-end" },
  planPrice: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
  },
  planPeriod: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },

  subscribeButton: {
    borderRadius: RADIUS.full,
    overflow: "hidden",
    ...SHADOWS.accent,
    marginBottom: SPACING.lg,
  },
  subscribeGradient: { paddingVertical: SPACING.lg, alignItems: "center" },
  subscribeText: { color: "#fff", fontSize: FONT_SIZES.lg, fontWeight: "800" },

  finePrint: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.xs,
    textAlign: "center",
    lineHeight: 18,
  },
  restoreButton: { alignItems: "center", paddingVertical: SPACING.md },
  restoreText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textDecoration: "underline",
  },
});
