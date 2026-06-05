// src/navigation/AdminNavigator.js
import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import AdminLoginScreen from "../screens/admin/AdminLoginScreen";
import AdminDashboardScreen from "../screens/admin/AdminDashboardScreen";
import AdminWordsScreen from "../screens/admin/AdminWordsScreen";
import AdminUsersScreen from "../screens/admin/AdminUsersScreen";
import AdminSubsScreen from "../screens/admin/AdminSubsScreen";
import AdminAnalyticsScreen from "../screens/admin/AdminAnalyticsScreen";

const Stack = createStackNavigator();

export default function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="AdminWords" component={AdminWordsScreen} />
      <Stack.Screen name="AdminUsers" component={AdminUsersScreen} />
      <Stack.Screen name="AdminSubs" component={AdminSubsScreen} />
      <Stack.Screen name="AdminAnalytics" component={AdminAnalyticsScreen} />
    </Stack.Navigator>
  );
}
