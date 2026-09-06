// src/context/SubscriptionContext.js
import React, { createContext, useContext, useReducer, useEffect } from "react";
import { Storage } from "../utils/storage";
import { saveUser, updateUserSubscription } from "../services/firebase";

const SubscriptionContext = createContext(null);

const TRIAL_DAYS = 7;
const FREE_DAILY_LIMIT = 10;

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
    case "SET_LOADING":
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

export function SubscriptionProvider({ children }) {
  const [state, dispatch] = useReducer(subReducer, initialState);
  const [userId, setUserId] = React.useState(null);

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
      } catch (error) {
        console.error("Subscription load error:", error);
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
    loadSubscription();
  }, []);

  const actions = {
    upgradeToPremium: async () => {
      const updated = {
        plan: "premium",
        isPremium: true,
        upgradedAt: new Date().toISOString(),
      };
      dispatch({ type: "UPGRADE_PREMIUM" });
      await Storage.saveSubscription(updated);

      // Firebase'e kaydet
      try {
        const profile = await Storage.getUserProfile();
        if (profile?.id) {
          await updateUserSubscription(profile.id, "premium");
          await saveUser(profile.id, {
            "subscription.plan": "premium",
            "subscription.isPremium": true,
            "subscription.upgradedAt": new Date().toISOString(),
          });
        }
      } catch (e) {
        console.warn("Firebase subscription update failed:", e.message);
      }
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

    // ProfileScreen'in "Verileri Sıfırla" aksiyonu Storage.clearAll() ile
    // subscription kaydını da AsyncStorage'dan siliyor, ama bu context'in
    // bellekteki state'i (özellikle isPremium) ayrı bir provider'da tutuluyor
    // ve sıfırlanmadan kalırsa premium bir kullanıcı, verileri sıfırladıktan
    // sonra bile ProfileScreen'de "Premium Üye" görünmeye devam eder — halbuki
    // gerçek bir restart'ta Storage boş bulunup taze bir trial oluşturulurdu.
    // Bu aksiyon aynı "taze trial oluştur" mantığını hemen, restart'a gerek
    // kalmadan uygular.
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
