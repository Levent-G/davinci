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
  {
    name: "AI",
    label: "AI",
    icon: "sparkles",
    iconOutline: "sparkles-outline",
    isSpecial: true,
  },
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
  const bottomPad = Math.max(insets.bottom, Platform.OS === "android" ? 8 : 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          { height: 58 + bottomPad, paddingBottom: bottomPad + 4 },
        ],
        tabBarShowLabel: true,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarItemStyle: styles.tabItem,
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
  tabBar: {
    backgroundColor: COLORS.backgroundCard,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    paddingTop: 6,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
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
