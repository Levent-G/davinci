import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useEffect, useRef } from "react";
import { INTERVAL } from "./davinciAlgorithm";

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

// Tekrar bildirimi — reviewNum: 1, 2, 3
export async function scheduleReview(reviewNum, wordCount) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔄 ${reviewNum}. Tekrar Zamanı!`,
      body: `${wordCount} kelime seni bekliyor...`,
      sound: true,
      data: { reviewNum },
    },
    trigger: { type: "date", date: new Date(Date.now() + INTERVAL) },
  });
}

// Sonraki gün bildirimi
export async function scheduleNextDay() {
  const { NEXT_DAY } = require("./davinciAlgorithm");
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "☀️ Yeni Gün!",
      body: "Bugün kelimelerini öğrenmeye devam et!",
      sound: true,
    },
    trigger: { type: "date", date: new Date(Date.now() + NEXT_DAY) },
  });
}

// Eski sistem uyumluluğu
export async function scheduleReviewNotifications(count) {
  await cancelAllNotifications();
  await scheduleReview(1, count);
}
export async function scheduleNextReviewNotification(type) {
  await cancelAllNotifications();
  if (type === "r1") await scheduleReview(2, 5);
  else if (type === "r2") await scheduleReview(3, 5);
  else if (type === "r3") await scheduleNextDay();
}
export async function scheduleDailyReminder(h = 20, m = 0) {}

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
