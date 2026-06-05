// src/screens/admin/AdminSubsScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import { getAllUsers, updateUserSubscription } from "../../services/firebase";

const PLAN_COLORS = {
  premium: COLORS.accent,
  trial: "#A29BFE",
  free: COLORS.textMuted,
};
const PLAN_LABELS = { premium: "Premium", trial: "Trial", free: "Ucretsiz" };

export default function AdminSubsScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefresh] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await getAllUsers(100);
    setUsers(data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefresh(true);
    await loadData();
    setRefresh(false);
  };

  const filtered =
    filter === "ALL"
      ? users
      : users.filter((u) => u.subscription?.plan === filter);

  const stats = {
    total: users.length,
    premium: users.filter((u) => u.subscription?.plan === "premium").length,
    trial: users.filter((u) => u.subscription?.plan === "trial").length,
    free: users.filter(
      (u) => !u.subscription?.plan || u.subscription?.plan === "free"
    ).length,
  };

  const handleChangePlan = (user) => {
    Alert.alert("Plan Degistir", `${user.name || "Kullanici"} icin plan sec:`, [
      {
        text: "Premium Yap",
        onPress: async () => {
          const ok = await updateUserSubscription(user.id, "premium");
          if (ok) {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === user.id
                  ? {
                      ...u,
                      subscription: {
                        ...u.subscription,
                        plan: "premium",
                        isPremium: true,
                      },
                    }
                  : u
              )
            );
            Alert.alert("Basarili", "Plan guncellendi.");
          }
        },
      },
      {
        text: "Trial Yap",
        onPress: async () => {
          await updateUserSubscription(user.id, "trial");
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id
                ? { ...u, subscription: { ...u.subscription, plan: "trial" } }
                : u
            )
          );
        },
      },
      {
        text: "Ucretsiz Yap",
        onPress: async () => {
          await updateUserSubscription(user.id, "free");
          setUsers((prev) =>
            prev.map((u) =>
              u.id === user.id
                ? { ...u, subscription: { ...u.subscription, plan: "free" } }
                : u
            )
          );
        },
      },
      { text: "Iptal", style: "cancel" },
    ]);
  };

  const renderUser = ({ item }) => {
    const plan = item.subscription?.plan || "free";
    const color = PLAN_COLORS[plan] || COLORS.textMuted;
    const initials = (item.name || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const joinDate = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString("tr-TR")
      : item.createdAt || "-";

    return (
      <View style={styles.subCard}>
        <View style={[styles.subAvatar, { backgroundColor: color + "20" }]}>
          <Text style={[styles.subAvatarText, { color }]}>{initials}</Text>
        </View>
        <View style={styles.subInfo}>
          <Text style={styles.subName}>{item.name || "Isimsiz"}</Text>
          <Text style={styles.subEmail}>{item.email || "-"}</Text>
          <View style={[styles.planBadge, { backgroundColor: color + "20" }]}>
            <Text style={[styles.planBadgeText, { color }]}>
              {PLAN_LABELS[plan]}
            </Text>
          </View>
          <Text style={styles.subDate}>Katilim: {joinDate}</Text>
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => handleChangePlan(item)}
        >
          <Ionicons name="create-outline" size={20} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Abonelikler</Text>
        <TouchableOpacity onPress={loadData} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color={COLORS.accent} />
        </TouchableOpacity>
      </View>

      {/* Ozet kartlar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statsScroll}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          gap: SPACING.sm,
          paddingVertical: SPACING.sm,
        }}
      >
        <StatCard label="Toplam" value={stats.total} color={COLORS.secondary} />
        <StatCard label="Premium" value={stats.premium} color={COLORS.accent} />
        <StatCard label="Trial" value={stats.trial} color="#A29BFE" />
        <StatCard
          label="Ucretsiz"
          value={stats.free}
          color={COLORS.textMuted}
        />
        <StatCard
          label="Tahmini Gelir"
          value={`${stats.premium * 99}TL`}
          color={COLORS.success}
        />
      </ScrollView>

      {/* Filtreler */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          gap: SPACING.sm,
          alignItems: "center",
        }}
      >
        {["ALL", "premium", "trial", "free"].map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.filterChip,
              filter === f && {
                backgroundColor: (PLAN_COLORS[f] || COLORS.accent) + "25",
                borderColor: PLAN_COLORS[f] || COLORS.accent,
              },
            ]}
            onPress={() => setFilter(f)}
          >
            <Text
              style={[
                styles.filterChipText,
                filter === f && { color: PLAN_COLORS[f] || COLORS.accent },
              ]}
            >
              {f === "ALL" ? "Tuumu" : PLAN_LABELS[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>💳</Text>
          <Text style={styles.emptyText}>Kullanici bulunamadi</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={[styles.statCard, { borderColor: color + "30" }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundCard,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  statsScroll: { flexGrow: 0 },
  statCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    minWidth: 90,
  },
  statValue: { fontSize: FONT_SIZES.xl, fontWeight: "800" },
  statLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  filterScroll: { flexGrow: 0, marginBottom: SPACING.sm },
  filterChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipText: {
    color: COLORS.textSecondary,
    fontWeight: "600",
    fontSize: FONT_SIZES.sm,
  },
  loadingCenter: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.lg },
  list: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  subAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  subAvatarText: { fontWeight: "800", fontSize: FONT_SIZES.lg },
  subInfo: { flex: 1, gap: 3 },
  subName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  subEmail: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  planBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  planBadgeText: { fontSize: 10, fontWeight: "700" },
  subDate: { color: COLORS.textMuted, fontSize: 10 },
  editBtn: { padding: SPACING.sm },
});
