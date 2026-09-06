// src/navigation/RootNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { View, ActivityIndicator } from "react-native";
import { COLORS } from "../utils/theme";
import { useApp } from "../context/AppContext";
import MainTabNavigator from "./MainTabNavigator";
import AdminNavigator from "./AdminNavigator";
import OnboardingScreen from "../screens/OnboardingScreen";
import LearningSessionScreen from "../screens/LearningSessionScreen";
import PaywallScreen from "../screens/PaywallScreen";
import WordDetailScreen from "../screens/WordDetailScreen";
import AddWordScreen from "../screens/AddWordScreen";
import QuickScanScreen from "../screens/QuickScanScreen";
import ReviewScreen from "../screens/ReviewScreen";
import PreScanScreen from "../screens/PreScanScreen";

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { state } = useApp();

  if (state.isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!state.isOnboardingDone ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen
            name="LearningSession"
            component={LearningSessionScreen}
            options={{ presentation: "modal", gestureEnabled: false }}
          />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ presentation: "modal" }}
          />
          <Stack.Screen name="WordDetail" component={WordDetailScreen} />
          <Stack.Screen name="QuickScan" component={QuickScanScreen} />
          <Stack.Screen name="Review" component={ReviewScreen} />
          <Stack.Screen name="PreScan" component={PreScanScreen} />
          <Stack.Screen
            name="AddWord"
            component={AddWordScreen}
            options={{ presentation: "modal" }}
          />
        </>
      )}
      {/* Onboarding ekranındaki gizli 3-dokunuş de bu rotaya gidiyor,
          bu yüzden onboarding bitmeden de kayıtlı olması gerekiyor. */}
      <Stack.Screen
        name="Admin"
        component={AdminNavigator}
        options={{ presentation: "fullScreenModal", gestureEnabled: false }}
      />
    </Stack.Navigator>
  );
}
