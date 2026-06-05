// src/utils/notifications.js
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications() {
  if (!Device.isDevice) return null;
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("davinci", {
      name: "Da Vinci Hatırlatmaları",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#6C63FF",
    });
  }
  return finalStatus;
}

export async function scheduleDailyReminder(hour = 20, minute = 0) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🎨 Da Vinci seni bekliyor!",
      body: "Bugünkü kelimelerini öğrenme vakti geldi.",
      data: { screen: "Learn" },
      channelId: "davinci",
    },
    trigger: { hour, minute, repeats: true },
  });
}

export async function scheduleReviewReminder(dueCount) {
  if (dueCount <= 0) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔄 ${dueCount} kelime tekrar bekliyor`,
      body: "Spaced repetition zamanı! Kelimeleri tekrar et.",
      data: { screen: "Learn" },
      channelId: "davinci",
    },
    trigger: { seconds: 5 },
  });
}

export async function sendStreakNotification(streak) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🔥 ${streak} günlük seri!`,
      body: "Harika gidiyorsun! Serinı korumayı unutma.",
      channelId: "davinci",
    },
    trigger: null,
  });
}

export async function cancelAllNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export function useNotificationListener(callback) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
