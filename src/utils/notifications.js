// src/utils/notifications.js
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { useEffect, useRef } from "react";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// İzin iste + token al
export async function registerForPushNotifications() {
  if (!Device.isDevice) return "simulator";
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  return finalStatus;
}

// Tüm bildirimleri iptal et
export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// Öğrenme oturumu sonrası tekrar bildirimleri (3 saat + 8 saat + ertesi sabah)
// TEST_MODE: true yapınca bildirimler 10/20 saniye sonra gelir
const TEST_MODE = false;

export async function scheduleReviewNotifications(wordCount = 5) {
  const now = new Date();

  // 1. Tekrar — 3 saat sonra
  const review1 = new Date(
    now.getTime() + (TEST_MODE ? 10 * 1000 : 3 * 60 * 60 * 1000)
  );
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🔄 Tekrar Zamanı!",
      body: `${wordCount} kelimeyi hatırlıyor musun? Da Vinci sizi çağırıyor...`,
      sound: true,
    },
    trigger: { date: review1 },
  });

  // 2. Tekrar — 8 saat sonra
  const review2 = new Date(
    now.getTime() + (TEST_MODE ? 20 * 1000 : 8 * 60 * 60 * 1000)
  );
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🧠 Akşam Tekrarı",
      body: "Kelimeleri pekiştirme zamanı! Son tekrar...",
      sound: true,
    },
    trigger: { date: review2 },
  });

  // Ertesi sabah hatırlatma
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "☀️ Yeni Gün, Yeni Kelimeler",
      body: "Bugün 5 yeni kelime öğrenmeye hazır mısın?",
      sound: true,
    },
    trigger: { date: tomorrow },
  });
}

// Günlük hatırlatma — saat ve dakika parametreli
export async function scheduleDailyReminder(hour = 20, minute = 0) {
  // Önce eski günlük hatırlatmaları iptal et
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.title?.includes("Da Vinci seni bekliyor")) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🎯 Da Vinci seni bekliyor",
      body: "Bugünkü 5 kelimeni öğrenmek için 5 dakikan var mı?",
      sound: true,
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    },
  });
}

// Hook — bildirime tıklanınca çalışır
export function useNotificationListener(onNotification) {
  const notificationListener = useRef();
  const notificationResponse = useRef();

  useEffect(() => {
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        if (onNotification) onNotification(notification);
      });

    notificationResponse.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        if (onNotification) onNotification(response.notification);
      });

    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
      Notifications.removeNotificationSubscription(
        notificationResponse.current
      );
    };
  }, []);
}
