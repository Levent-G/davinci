import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AppProvider } from "./src/context/AppContext";
import { SubscriptionProvider } from "./src/context/SubscriptionContext";
import RootNavigator from "./src/navigation/RootNavigator";
import {
  registerForPushNotifications,
  scheduleDailyReminder,
  useNotificationListener,
} from "./src/utils/notifications";
import { warmUpSpeech } from "./src/utils/textToSpeech";
import { Storage } from "./src/utils/storage";

export default function App() {
  useEffect(() => {
    // Bildirimleri başlat
    registerForPushNotifications()
      .then(async (status) => {
        if (status !== "granted") return;
        // OS izni "granted" olması, kullanıcının UYGULAMA İÇİNDE
        // (Profil > Bildirimler) bunu açık bıraktığı anlamına gelmez —
        // kapatmış olabilir. Bu kontrol olmadan, kullanıcı bildirimleri
        // kapatsa bile her tam uygulama yeniden başlatmasında günlük
        // hatırlatıcı sessizce tekrar planlanıyordu.
        const settings = await Storage.getSettings();
        if (settings?.notifications !== false) {
          scheduleDailyReminder(0, 0); // Her gece 00:00
        }
      })
      .catch(() => {});

    // TTS motorunu sessizce ısıt — ilk "Sesli Dinle" tıklamasındaki
    // gecikmeyi önler (bkz. src/utils/textToSpeech.js)
    warmUpSpeech();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppProvider>
          <SubscriptionProvider>
            <NavigationContainer>
              <StatusBar style="light" />
              <RootNavigator />
            </NavigationContainer>
          </SubscriptionProvider>
        </AppProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
