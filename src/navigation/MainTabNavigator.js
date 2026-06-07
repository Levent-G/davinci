// src/navigation/MainTabNavigator.js
import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, FONT_SIZES } from "../utils/theme";
import HomeScreen from "../screens/HomeScreen";
import LearnScreen from "../screens/LearnScreen";
import StatsScreen from "../screens/StatsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AIRecommendScreen from "../screens/AIRecommendScreen";

const Tab = createBottomTabNavigator();

const TABS = [
  {
    name: "Home",
    label: "Ana Sayfa",
    icon: "home",
    iconOutline: "home-outline",
  },
  { name: "Learn", label: "Öğren", icon: "book", iconOutline: "book-outline" },
  // {
  //   name: "AI",
  //   label: "AI",
  //   icon: "sparkles",
  //   iconOutline: "sparkles-outline",
  //   isSpecial: true,
  // },
  {
    name: "Stats",
    label: "İstatistik",
    icon: "bar-chart",
    iconOutline: "bar-chart-outline",
  },
  {
    name: "Profile",
    label: "Profil",
    icon: "person",
    iconOutline: "person-outline",
  },
];

const SCREENS = {
  Home: HomeScreen,
  Learn: LearnScreen,
  AI: AIRecommendScreen,
  Stats: StatsScreen,
  Profile: ProfileScreen,
};

export default function MainTabNavigator() {
  const insets = useSafeAreaInsets();

  // Android gesture nav bar genellikle 24-48dp — minimum 16 garantile
  // iOS home indicator genellikle 34 — minimum 20 garantile
  const safeBottom = Platform.select({
    ios: Math.max(insets.bottom, 20),
    android: Math.max(insets.bottom, 16),
    default: Math.max(insets.bottom, 16),
  });

  const TAB_ICON_AREA = 52; // ikon + label yüksekliği
  const tabBarHeight = TAB_ICON_AREA + safeBottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.backgroundCard,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          elevation: 20,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.3,
          shadowRadius: 12,
          // KESİN ÇÖZÜM: height + paddingBottom safeBottom ile
          height: tabBarHeight,
          paddingBottom: safeBottom,
          paddingTop: 6,
          // position absolute kaldırıldı — native flow kullan
        },
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarItemStyle: styles.tabItem,
        // React Navigation'ın kendi safe area hesabını KAPAT
        // biz manuel yönetiyoruz
        tabBarSafeAreaInsets: { bottom: 0 },
      }}
    >
      {TABS.map((tab) => (
        <Tab.Screen
          key={tab.name}
          name={tab.name}
          component={SCREENS[tab.name]}
          options={{
            tabBarIcon: ({ color, focused }) =>
              tab.isSpecial ? (
                <View
                  style={[
                    styles.aiIconWrapper,
                    focused && styles.aiIconWrapperActive,
                  ]}
                >
                  <Ionicons
                    name={focused ? tab.icon : tab.iconOutline}
                    size={18}
                    color={focused ? "#fff" : COLORS.accent}
                  />
                </View>
              ) : (
                <View
                  style={[
                    styles.iconWrapper,
                    focused && styles.iconWrapperActive,
                  ]}
                >
                  <Ionicons
                    name={focused ? tab.icon : tab.iconOutline}
                    size={20}
                    color={color}
                  />
                </View>
              ),
            tabBarLabel: ({ color, focused }) =>
              tab.isSpecial ? (
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: focused ? COLORS.accent : COLORS.textMuted,
                      fontSize: 9,
                    },
                  ]}
                >
                  AI
                </Text>
              ) : (
                <Text style={[styles.tabLabel, { color }]}>{tab.label}</Text>
              ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabItem: { paddingTop: 4, gap: 2 },
  iconWrapper: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  iconWrapperActive: { backgroundColor: COLORS.accentGlow },
  aiIconWrapper: {
    width: 36,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: COLORS.accentGlow,
    borderWidth: 1,
    borderColor: COLORS.accent + "40",
  },
  aiIconWrapperActive: { backgroundColor: COLORS.accent },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.1,
    includeFontPadding: false,
  },
});
