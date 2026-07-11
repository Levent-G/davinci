import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { useEffect, useRef } from "react";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

if (Platform.OS === "android") {
  Notifications.setNotificationChannelAsync("default", {
    name: "Da Vinci Words",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#6C63FF",
    sound: true,
  });
}

export async function registerForPushNotifications() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus;
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// TEST: 1 dakika | GERÇEK: 60 * 60 * 1000 (1 saat)
const INTERVAL = 1 * 60 * 1000;

// İlk öğrenmeden sonra — 3 tekrar bildirimi planla
export async function scheduleReviewNotifications(wordCount = 5) {
  await cancelAllNotifications();
  const now = new Date();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔄 1. Tekrar Zamanı!",
      body: `${wordCount} kelimeyi hatırlıyor musun?`,
      sound: true,
      data: { type: "review_1" },
    },
    trigger: { type: "date", date: new Date(now.getTime() + 1 * INTERVAL) },
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🧠 2. Tekrar Zamanı!",
      body: "Kelimeleri pekiştirme vakti!",
      sound: true,
      data: { type: "review_2" },
    },
    trigger: { type: "date", date: new Date(now.getTime() + 2 * INTERVAL) },
  });
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "⭐ Son Tekrar!",
      body: "Bugünün son tekrarı!",
      sound: true,
      data: { type: "review_3" },
    },
    trigger: { type: "date", date: new Date(now.getTime() + 3 * INTERVAL) },
  });
}

// 1. tekrar bittikten sonra — 2. ve 3. tekrar bildirimi
export async function scheduleNextReviewNotification(reviewType) {
  await cancelAllNotifications();
  const now = new Date();

  if (reviewType === "review_1") {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "🧠 2. Tekrar Zamanı!",
        body: "Kelimeleri pekiştirme vakti!",
        sound: true,
        data: { type: "review_2" },
      },
      trigger: { type: "date", date: new Date(now.getTime() + 1 * INTERVAL) },
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⭐ Son Tekrar!",
        body: "Bugünün son tekrarı!",
        sound: true,
        data: { type: "review_3" },
      },
      trigger: { type: "date", date: new Date(now.getTime() + 2 * INTERVAL) },
    });
  } else if (reviewType === "review_2") {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⭐ Son Tekrar!",
        body: "Bugünün son tekrarı!",
        sound: true,
        data: { type: "review_3" },
      },
      trigger: { type: "date", date: new Date(now.getTime() + 1 * INTERVAL) },
    });
  } else if (reviewType === "review_3") {
    // Son tekrar bitti — ertesi sabah yeni kelimeler
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "☀️ Günaydın! Yeni kelimeler seni bekliyor",
        body: "Bugün 5 yeni kelime!",
        sound: true,
        data: { type: "new_day" },
      },
      trigger: { type: "date", date: tomorrow },
    });
  }
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

export function useNotificationListener(onNotification) {
  const l1 = useRef();
  const l2 = useRef();
  useEffect(() => {
    l1.current = Notifications.addNotificationReceivedListener((n) =>
      onNotification?.(n)
    );
    l2.current = Notifications.addNotificationResponseReceivedListener((r) =>
      onNotification?.(r.notification)
    );
    return () => {
      Notifications.removeNotificationSubscription(l1.current);
      Notifications.removeNotificationSubscription(l2.current);
    };
  }, []);
}
