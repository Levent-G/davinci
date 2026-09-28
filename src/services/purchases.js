// src/services/purchases.js
// RevenueCat entegrasyonu — gerçek App Store / Google Play satın alımları.
//
// KURULUM (mağazaya göndermeden önce mutlaka yapılmalı):
// 1) https://app.revenuecat.com üzerinde ücretsiz bir hesap açın.
// 2) Projenize iOS (App Store Connect) ve Android (Google Play Console)
//    uygulamalarınızı bağlayın.
// 3) App Store Connect'te ve Play Console'da gerçek abonelik ürünlerini
//    oluşturun (ör. "davinci_monthly", "davinci_yearly") ve bunları
//    RevenueCat'te bir "Offering" içindeki "Package"lara bağlayın.
// 4) RevenueCat Dashboard > Project Settings > API Keys'ten iOS ve Android
//    genel (public) API anahtarlarını alıp aşağıdaki REVENUECAT_API_KEYS
//    içine yapıştırın.
// 5) Dashboard > Entitlements kısmında "premium" adında bir entitlement
//    oluşturup yukarıdaki ürünlere bağlayın (PREMIUM_ENTITLEMENT_ID ile
//    aynı isimde olmalı, farklıysa burada da güncelleyin).
import { Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";

const REVENUECAT_API_KEYS = {
  ios: "appl_HyTPvolabaOczfGscjFZQmtwhEw",
  android: "goog_KgrlNAWEYQsbwKPDqwFCIFFlldO",
};

export const PREMIUM_ENTITLEMENT_ID = "premium";

let configured = false;
let lastConfigureError = null;
let lastOfferingsError = null;
let lastOfferingsDebug = null;

function hasRealApiKey() {
  const key = Platform.select(REVENUECAT_API_KEYS);
  return !!key && !key.startsWith("REPLACE_");
}

export function configurePurchases(appUserId) {
  if (configured) return;
  if (!hasRealApiKey()) {
    lastConfigureError = "no_api_key";
    console.warn(
      "[purchases] RevenueCat API anahtarı ayarlanmamış — src/services/purchases.js içine gerçek anahtarı ekleyin. Şimdilik satın alma özelliği devre dışı."
    );
    return;
  }
  try {
    Purchases.setLogLevel(LOG_LEVEL.WARN);
    Purchases.configure({
      apiKey: Platform.select(REVENUECAT_API_KEYS),
      appUserID: appUserId || undefined,
    });
    configured = true;
    lastConfigureError = null;
  } catch (e) {
    lastConfigureError = e.message;
    console.warn("[purchases] configure failed:", e.message);
  }
}

export function isPurchasesConfigured() {
  return configured;
}

// Metro'ya bağlı bir dev-client olmadan (TestFlight üzerinden) bile gerçek
// hatayı görebilmek için — PaywallScreen offerings boş dönerse bunu
// Alert ile gösterir.
export function getPurchasesDiagnostics() {
  return {
    platform: Platform.OS,
    hasApiKey: hasRealApiKey(),
    configured,
    lastConfigureError,
    lastOfferingsError,
    lastOfferingsDebug,
  };
}

// Kullanıcı giriş/oturum kimliği belli olduğunda (onboarding sonrası)
// RevenueCat kullanıcı kimliğini uygulamanın kendi userId'siyle eşler —
// böylece admin panelindeki kullanıcı ile RevenueCat'teki abone eşleşir.
export async function loginPurchases(appUserId) {
  if (!configured || !appUserId) return null;
  try {
    const { customerInfo } = await Purchases.logIn(appUserId);
    return customerInfo;
  } catch (e) {
    console.warn("[purchases] login failed:", e.message);
    return null;
  }
}

export async function getOfferings() {
  if (!configured) {
    lastOfferingsError = lastConfigureError || "not_configured";
    return null;
  }
  try {
    const offerings = await Purchases.getOfferings();
    const allIds = Object.keys(offerings.all || {});
    lastOfferingsDebug = {
      allOfferingsIds: allIds,
      hasCurrent: !!offerings.current,
      currentPackagesCount: offerings.current?.availablePackages?.length || 0,
    };
    if (!offerings.current) {
      lastOfferingsError =
        allIds.length === 0
          ? "RevenueCat'te hiç Offering yok (Dashboard > Offerings'te bir Offering oluşturup 'Current' yapman gerekiyor)"
          : `Offering(lar) var (${allIds.join(", ")}) ama hiçbiri 'Current' işaretli değil`;
    } else if (!offerings.current.availablePackages?.length) {
      lastOfferingsError = `Current offering ('${offerings.current.identifier}') içinde Package yok`;
    } else {
      lastOfferingsError = null;
    }
    return offerings.current || null;
  } catch (e) {
    lastOfferingsError = `${e.code ? e.code + ": " : ""}${e.message}`;
    console.warn("[purchases] getOfferings failed:", e.message);
    return null;
  }
}

export async function getCustomerInfo() {
  if (!configured) return null;
  try {
    return await Purchases.getCustomerInfo();
  } catch (e) {
    return null;
  }
}

export function isEntitled(customerInfo) {
  return !!customerInfo?.entitlements?.active?.[PREMIUM_ENTITLEMENT_ID];
}

export async function purchasePackage(pkg) {
  if (!configured) {
    throw new Error(
      "Satın alma sistemi henüz yapılandırılmadı (RevenueCat API anahtarı eksik)."
    );
  }
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return isEntitled(customerInfo);
}

export async function restorePurchases() {
  if (!configured) return false;
  const customerInfo = await Purchases.restorePurchases();
  return isEntitled(customerInfo);
}

export function addCustomerInfoListener(cb) {
  if (!configured) return () => {};
  Purchases.addCustomerInfoUpdateListener(cb);
  return () => Purchases.removeCustomerInfoUpdateListener(cb);
}
