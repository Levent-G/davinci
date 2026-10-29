// src/context/SubscriptionContext.js
import React, { createContext, useContext, useReducer, useEffect, useRef } from "react";
import { Storage } from "../utils/storage";
import { saveUser, updateUserSubscription } from "../services/firebase";
import {
  configurePurchases,
  loginPurchases,
  getCustomerInfo,
  getOfferings as fetchOfferings,
  purchasePackage as purchaseRcPackage,
  restorePurchases as restoreRcPurchases,
  isEntitled,
  addCustomerInfoListener,
} from "../services/purchases";

const SubscriptionContext = createContext(null);

const TRIAL_DAYS = 7;
// DÜZELTME: eskiden 10'du ama öğrenme algoritması (DAILY_TARGET,
// davinciAlgorithm.js) zaten premium/trial kullanıcıyı bile günde ~5
// kelimelik partilerle sınırlıyordu — yani 10'luk ücretsiz limit hiçbir
// zaman devreye girmiyordu (herkes zaten 5'in altındaydı). Artık premium/
// trial "5'lik parti"yi gün içinde art arda tekrarlayabiliyor (bkz.
// LearnScreen.jsx'teki restingCount düzeltmesi), ücretsiz kullanıcı ise
// deneme süresi bitince günde sadece 2 kelimeyle sınırlı — gerçek bir fark
// oluşsun diye.
const FREE_DAILY_LIMIT = 2;

const initialState = {
  plan: "trial",
  trialStartDate: null,
  trialEndsDate: null,
  isActive: true,
  isPremium: false,
  trialDaysLeft: TRIAL_DAYS,
  isTrialExpired: false,
  isLoading: true,
};

function subReducer(state, action) {
  switch (action.type) {
    case "INIT_SUBSCRIPTION":
      return { ...state, ...action.payload, isLoading: false };
    case "UPGRADE_PREMIUM":
      return { ...state, plan: "premium", isPremium: true, isLoading: false };
    case "SET_PREMIUM_FROM_STORE":
      // RevenueCat, App Store/Play Store'daki GERÇEK abonelik durumunu
      // bildiriyor — yerel trial mantığından bağımsız, her zaman öncelikli.
      return action.payload
        ? { ...state, plan: "premium", isPremium: true }
        : state.plan === "premium" && !state.isPremiumFromLocalUpgrade
        ? { ...state, isPremium: false, plan: state.isTrialExpired ? "free" : "trial" }
        : state;
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function SubscriptionProvider({ children }) {
  const [state, dispatch] = useReducer(subReducer, initialState);
  const [userId, setUserId] = React.useState(null);
  const listenerCleanupRef = useRef(null);

  useEffect(() => {
    async function loadSubscription() {
      try {
        let sub = await Storage.getSubscription();
        const profile = await Storage.getUserProfile();
        if (profile?.id) setUserId(profile.id);

        if (!sub) {
          const now = new Date();
          const trialEnd = new Date(
            now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000
          );
          sub = {
            plan: "trial",
            trialStartDate: now.toISOString(),
            trialEndsDate: trialEnd.toISOString(),
            isActive: true,
            isPremium: false,
          };
          await Storage.saveSubscription(sub);
        }

        const now = new Date();
        const trialEnd = new Date(sub.trialEndsDate);
        const diffMs = trialEnd - now;
        const trialDaysLeft = Math.max(
          0,
          Math.ceil(diffMs / (1000 * 60 * 60 * 24))
        );
        const isPremium = sub.isPremium === true || sub.plan === "premium";
        const isTrialExpired =
          now > trialEnd && sub.plan === "trial" && !isPremium;

        let resolvedPlan = sub.plan;
        if (isPremium) resolvedPlan = "premium";
        else if (isTrialExpired) resolvedPlan = "free";

        // DÜZELTME: deneme süresi bitince "free"e geçiş SADECE yerel
        // state'te hesaplanıyordu — Firestore'daki subscription.plan hiç
        // güncellenmiyordu. Uygulama içindeki gerçek davranış (kelime
        // limiti vb.) doğru çalışıyordu ama admin panelindeki kullanıcı
        // listesi her zaman "Trial" gösteriyordu çünkü doğrudan
        // Firestore'dan okuyor. Artık bu geçiş tespit edildiğinde hem
        // yerelde hem Firestore'da kalıcı olarak işaretleniyor.
        if (resolvedPlan === "free" && sub.plan !== "free") {
          await Storage.saveSubscription({ ...sub, plan: "free" });
          if (profile?.id) {
            saveUser(profile.id, { "subscription.plan": "free" }).catch(
              () => {}
            );
          }
        }

        dispatch({
          type: "INIT_SUBSCRIPTION",
          payload: {
            ...sub,
            trialDaysLeft,
            isTrialExpired,
            isPremium,
            plan: resolvedPlan,
          },
        });

        // RevenueCat'i başlat ve GERÇEK mağaza abonelik durumunu kontrol et.
        // API anahtarı henüz girilmediyse (bkz. services/purchases.js) bu
        // no-op olur ve yerel trial/premium mantığı olduğu gibi çalışmaya
        // devam eder.
        configurePurchases(profile?.id);
        if (profile?.id) await loginPurchases(profile.id);
        const customerInfo = await getCustomerInfo();
        if (customerInfo) {
          dispatch({
            type: "SET_PREMIUM_FROM_STORE",
            payload: isEntitled(customerInfo),
          });
        }
        listenerCleanupRef.current = addCustomerInfoListener((info) => {
          dispatch({ type: "SET_PREMIUM_FROM_STORE", payload: isEntitled(info) });
        });
      } catch (error) {
        console.error("Subscription load error:", error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadSubscription();
    return () => listenerCleanupRef.current?.();
  }, []);

  const actions = {
    // Gerçek mağaza teklifleri (fiyat, süre) — PaywallScreen bunları
    // gösterip kullanıcının seçtiği paketi actions.purchase'a geçirir.
    getOfferings: fetchOfferings,

    purchase: async (pkg) => {
      const granted = await purchaseRcPackage(pkg);
      if (granted) {
        dispatch({ type: "UPGRADE_PREMIUM" });
        await Storage.saveSubscription({
          plan: "premium",
          isPremium: true,
          upgradedAt: new Date().toISOString(),
        });
        try {
          if (userId) {
            await updateUserSubscription(userId, "premium");
            await saveUser(userId, {
              "subscription.plan": "premium",
              "subscription.isPremium": true,
              "subscription.upgradedAt": new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn("Firebase subscription update failed:", e.message);
        }
      }
      return granted;
    },

    restore: async () => {
      const granted = await restoreRcPurchases();
      if (granted) {
        dispatch({ type: "UPGRADE_PREMIUM" });
        await Storage.saveSubscription({
          plan: "premium",
          isPremium: true,
          restoredAt: new Date().toISOString(),
        });
      }
      return granted;
    },

    canLearnWord: (todayCount) => {
      if (state.isPremium) return true;
      if (state.plan === "trial" && !state.isTrialExpired) return true;
      return todayCount < FREE_DAILY_LIMIT;
    },

    getRemainingFreeWords: (todayCount) => {
      if (state.isPremium) return Infinity;
      if (state.plan === "trial" && !state.isTrialExpired) return Infinity;
      return Math.max(0, FREE_DAILY_LIMIT - todayCount);
    },

    getTrialStatus: () => ({
      isOnTrial: state.plan === "trial" && !state.isTrialExpired,
      daysLeft: state.trialDaysLeft,
      isExpired: state.isTrialExpired,
    }),

    // ProfileScreen'in "Verileri Sıfırla" aksiyonu yerel trial kaydını
    // sıfırlar. Kullanıcının GERÇEK bir mağaza aboneliği varsa (RevenueCat),
    // hemen ardından yapılan customerInfo kontrolü bunu tekrar tespit edip
    // isPremium'u geri getirir — gerçek bir ödeme bu şekilde iptal edilmiş
    // olmaz, sadece yerel deneme süresi sayacı sıfırlanır.
    resetSubscription: async () => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
      const fresh = {
        plan: "trial",
        trialStartDate: now.toISOString(),
        trialEndsDate: trialEnd.toISOString(),
        isActive: true,
        isPremium: false,
      };
      await Storage.saveSubscription(fresh);
      dispatch({
        type: "INIT_SUBSCRIPTION",
        payload: {
          ...fresh,
          trialDaysLeft: TRIAL_DAYS,
          isTrialExpired: false,
        },
      });
      const customerInfo = await getCustomerInfo();
      if (customerInfo && isEntitled(customerInfo)) {
        dispatch({ type: "SET_PREMIUM_FROM_STORE", payload: true });
      }
    },
  };

  return (
    <SubscriptionContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context)
    throw new Error("useSubscription must be used inside SubscriptionProvider");
  return context;
}

export default SubscriptionContext;
