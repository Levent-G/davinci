import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useEffect, useRef } from "react";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Da Vinci Words",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    sound: true,
  });
}

export async function registerForPushNotifications() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Tekrar bildirimi — HOUR ms sonra
export async function scheduleReviewNotification(
  wordCount,
  reviewNum,
  delayMs
) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔄 ${reviewNum}. Tekrar Zamanı!`,
      body: `${wordCount} kelimeyi hatırlıyor musun?`,
      sound: true,
      data: { reviewNum },
    },
    trigger: { type: "date", date: new Date(Date.now() + delayMs) },
  });
}

// İlk öğrenmeden sonra 3 tekrar planla
export async function scheduleAllReviews(wordCount, hourMs) {
  await cancelAllNotifications();
  for (let i = 1; i <= 3; i++) {
    await scheduleReviewNotification(wordCount, i, hourMs * i);
  }
}

// Sonraki tekrar bildirimi
export async function scheduleNextReview(wordCount, reviewCount, hourMs) {
  if (reviewCount >= 3) return; // 3 tekrar tamam
  await scheduleReviewNotification(wordCount, reviewCount + 1, hourMs);
}

// Günlük hatırlatma
export async function scheduleDailyReminder(hour = 20, minute = 0) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🎯 Da Vinci seni bekliyor",
      body: "Bugünkü 5 kelimeni öğrenmek için 5 dakikan var mı?",
      sound: true,
    },
    trigger: { type: "daily", hour, minute },
  });
}

// Eski uyumlu
export const scheduleReviewNotifications = (count) =>
  scheduleAllReviews(count, 60 * 60 * 1000);
export const scheduleNextReviewNotification = () => {};

export function useNotificationListener(cb) {
  const l1 = useRef(),
    l2 = useRef();
  useEffect(() => {
    l1.current = Notifications.addNotificationReceivedListener((n) => cb?.(n));
    l2.current = Notifications.addNotificationResponseReceivedListener((r) =>
      cb?.(r.notification)
    );
    return () => {
      Notifications.removeNotificationSubscription(l1.current);
      Notifications.removeNotificationSubscription(l2.current);
    };
  }, []);
}
