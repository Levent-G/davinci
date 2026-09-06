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

// Sabit kimlikler: aynı identifier ile tekrar schedule edilen bir bildirim
// öncekinin yerine geçer (expo-notifications bunu otomatik yapar). Bu iki
// şeyi garanti eder:
//  1) scheduleDailyReminder her app açılışında tekrar çağrılsa bile
//     (App.js'de olduğu gibi) ÇOĞALMAZ — hep aynı tek bildirimi günceller.
//  2) Tekrar (review) bildirimlerini iptal ederken SADECE bu 3 sabit
//     kimliği hedefleyebiliyoruz — cancelAllScheduledNotificationsAsync()
//     kullanmadan, günlük hatırlatıcıyı YOK ETMEDEN sadece tekrar
//     bildirimlerini iptal/yeniden planlayabiliyoruz (bkz. cancelReviewNotifications).
const DAILY_REMINDER_ID = "daily-reminder";
const REVIEW_IDS = ["review-1", "review-2", "review-3"];

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// SADECE tekrar (review) bildirimlerini iptal eder — günlük hatırlatıcı
// (daily-reminder) dokunulmadan kalır. Eskiden ReviewScreen/scheduleAllReviews
// burada cancelAllNotifications() kullanıyordu; bu da her tekrar turunda
// kullanıcının hiç dokunmadığı günlük 00:00 hatırlatıcısını da siliyordu —
// bir sonraki tam uygulama yeniden başlatılana kadar geri gelmiyordu.
export async function cancelReviewNotifications() {
  await Promise.all(
    REVIEW_IDS.map((id) =>
      Notifications.cancelScheduledNotificationAsync(id).catch(() => {})
    )
  );
}

// Tekrar bildirimi — HOUR ms sonra
export async function scheduleReviewNotification(
  wordCount,
  reviewNum,
  delayMs
) {
  await Notifications.scheduleNotificationAsync({
    identifier: REVIEW_IDS[Math.min(Math.max(reviewNum, 1), 3) - 1],
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
  await cancelReviewNotifications();
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
    identifier: DAILY_REMINDER_ID,
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
