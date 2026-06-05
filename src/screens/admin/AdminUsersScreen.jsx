// src/screens/admin/AdminUsersScreen.jsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { COLORS, FONT_SIZES, SPACING, RADIUS } from "../../utils/theme";
import {
  getAllUsers,
  updateUserSubscription,
  deleteUser,
  saveUser,
} from "../../services/firebase";

const PLAN_COLORS = {
  premium: COLORS.accent,
  trial: "#A29BFE",
  free: COLORS.textMuted,
};
const PLAN_LABELS = { premium: "Premium", trial: "Trial", free: "Ucretsiz" };

export default function AdminUsersScreen({ navigation }) {
  const [users, setUsers] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [planFilter, setPlan] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [refreshing, setRefresh] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    let result = users;
    if (planFilter !== "ALL")
      result = result.filter((u) => u.subscription?.plan === planFilter);
    if (search.trim())
      result = result.filter(
        (u) =>
          u.name?.toLowerCase().includes(search.toLowerCase()) ||
          u.email?.toLowerCase().includes(search.toLowerCase())
      );
    setFiltered(result);
  }, [users, search, planFilter]);

  const loadUsers = async () => {
    setLoading(true);
    const data = await getAllUsers(100);
    setUsers(data);
    setFiltered(data);
    setLoading(false);
  };

  const onRefresh = async () => {
    setRefresh(true);
    await loadUsers();
    setRefresh(false);
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

  const handleDeleteUser = (user) => {
    Alert.alert("Kullanici Sil", `${user.name || "Kullanici"} silinsin mi?`, [
      { text: "Iptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          const ok = await deleteUser(user.id);
          if (ok) {
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            setSelected(null);
          }
        },
      },
    ]);
  };

  const renderUser = ({ item }) => {
    const plan = item.subscription?.plan || "free";
    const planColor = PLAN_COLORS[plan] || COLORS.textMuted;
    const initials = (item.name || "U")
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
    const joinDate = item.createdAt?.toDate
      ? item.createdAt.toDate().toLocaleDateString("tr-TR")
      : item.createdAt || "-";
    const lastActive = item.lastActiveAt?.toDate
      ? item.lastActiveAt.toDate().toLocaleDateString("tr-TR")
      : "-";

    return (
      <TouchableOpacity
        style={styles.userCard}
        onPress={() => setSelected(item)}
        activeOpacity={0.85}
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: planColor + "20",
              borderColor: planColor + "50",
            },
          ]}
        >
          <Text style={[styles.avatarText, { color: planColor }]}>
            {initials}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{item.name || "Isimsiz"}</Text>
            <View
              style={[styles.planBadge, { backgroundColor: planColor + "20" }]}
            >
              <Text style={[styles.planBadgeText, { color: planColor }]}>
                {PLAN_LABELS[plan]}
              </Text>
            </View>
          </View>
          <Text style={styles.userEmail}>{item.email || "E-posta yok"}</Text>
          <View style={styles.userMeta}>
            <Text style={styles.userMetaText}>Katilim: {joinDate}</Text>
            <Text style={styles.userMetaText}>Son: {lastActive}</Text>
          </View>
          <View style={styles.userStats}>
            <Text style={styles.userStat}>
              {item.stats?.totalWordsLearned || 0} kelime
            </Text>
            <Text style={styles.userStat}>
              {item.stats?.streak || 0} gun seri
            </Text>
            <Text style={styles.userStat}>
              {item.stats?.totalSessions || 0} oturum
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.editPlanBtn}
          onPress={() => handleChangePlan(item)}
        >
          <Ionicons
            name="ellipsis-vertical"
            size={18}
            color={COLORS.textMuted}
          />
        </TouchableOpacity>
      </TouchableOpacity>
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
        <Text style={styles.headerTitle}>Kullanicilar</Text>
        <View style={styles.headerRight}>
          <Text style={styles.headerCount}>{filtered.length}</Text>
          <TouchableOpacity onPress={loadUsers} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={18} color={COLORS.accent} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Isim veya e-posta ara..."
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={{
          paddingHorizontal: SPACING.lg,
          gap: SPACING.sm,
          alignItems: "center",
        }}
      >
        {["ALL", "premium", "trial", "free"].map((p) => (
          <TouchableOpacity
            key={p}
            style={[
              styles.filterChip,
              planFilter === p && {
                backgroundColor: (PLAN_COLORS[p] || COLORS.accent) + "25",
                borderColor: PLAN_COLORS[p] || COLORS.accent,
              },
            ]}
            onPress={() => setPlan(p)}
          >
            <Text
              style={[
                styles.filterChipText,
                planFilter === p && { color: PLAN_COLORS[p] || COLORS.accent },
              ]}
            >
              {p === "ALL" ? "Tumuu" : PLAN_LABELS[p]}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator color={COLORS.accent} size="large" />
          <Text style={styles.loadingText}>Kullanicilar yukleniiyor...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>Henuz kullanici yok</Text>
          <Text style={styles.emptySubText}>
            Kullanicilar uygulamayi kullandikca buraya eklenecek
          </Text>
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

      {/* Kullanici Detay Modal */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        {selected && (
          <SafeAreaView style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.detailTitle}>Kullanici Detayi</Text>
              <TouchableOpacity
                onPress={() => {
                  setSelected(null);
                  handleChangePlan(selected);
                }}
              >
                <Text style={styles.detailEdit}>Plan Degistir</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.detailContent}>
              <View style={styles.detailProfile}>
                <View
                  style={[
                    styles.detailAvatar,
                    {
                      backgroundColor:
                        (PLAN_COLORS[selected.subscription?.plan] ||
                          COLORS.textMuted) + "20",
                    },
                  ]}
                >
                  <Text style={styles.detailAvatarText}>
                    {(selected.name || "U")
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)}
                  </Text>
                </View>
                <Text style={styles.detailName}>
                  {selected.name || "Isimsiz"}
                </Text>
                <Text style={styles.detailEmail}>{selected.email || "-"}</Text>
                <View
                  style={[
                    styles.planBadge,
                    {
                      backgroundColor:
                        (PLAN_COLORS[selected.subscription?.plan] ||
                          COLORS.textMuted) + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.planBadgeText,
                      {
                        color:
                          PLAN_COLORS[selected.subscription?.plan] ||
                          COLORS.textMuted,
                      },
                    ]}
                  >
                    {PLAN_LABELS[selected.subscription?.plan || "free"]}
                  </Text>
                </View>
              </View>

              <Text style={styles.detailSectionTitle}>
                Ogrenme Istatistikleri
              </Text>
              <View style={styles.detailStatsGrid}>
                <DetailStat
                  label="Kelime"
                  value={selected.stats?.totalWordsLearned || 0}
                  icon="📚"
                />
                <DetailStat
                  label="Oturum"
                  value={selected.stats?.totalSessions || 0}
                  icon="🎯"
                />
                <DetailStat
                  label="Seri"
                  value={selected.stats?.streak || 0}
                  icon="🔥"
                />
                <DetailStat
                  label="En Uzun"
                  value={selected.stats?.longestStreak || 0}
                  icon="⚡"
                />
              </View>

              <Text style={styles.detailSectionTitle}>Abonelik Bilgisi</Text>
              <View style={styles.detailInfoCard}>
                <InfoRow
                  label="Plan"
                  value={selected.subscription?.plan || "free"}
                />
                <InfoRow
                  label="Premium mi"
                  value={selected.subscription?.isPremium ? "Evet" : "Hayir"}
                />
                <InfoRow
                  label="Katilim Tarihi"
                  value={
                    selected.createdAt?.toDate
                      ? selected.createdAt.toDate().toLocaleDateString("tr-TR")
                      : selected.createdAt || "-"
                  }
                />
                <InfoRow
                  label="Son Aktivite"
                  value={
                    selected.lastActiveAt?.toDate
                      ? selected.lastActiveAt
                          .toDate()
                          .toLocaleDateString("tr-TR")
                      : "-"
                  }
                />
              </View>

              <Text style={styles.detailSectionTitle}>Tercihler</Text>
              <View style={styles.detailInfoCard}>
                <InfoRow
                  label="Tercih Edilen Seviye"
                  value={selected.settings?.preferredLevel || "A1"}
                />
                <InfoRow
                  label="Gunluk Hedef"
                  value={`${selected.settings?.dailyGoal || 10} kelime`}
                />
                <InfoRow
                  label="Oturum Boyutu"
                  value={`${selected.settings?.sessionSize || 5} kelime`}
                />
              </View>

              <TouchableOpacity
                style={styles.deleteUserBtn}
                onPress={() => handleDeleteUser(selected)}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                <Text style={styles.deleteUserText}>Kullanicivi Sil</Text>
              </TouchableOpacity>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

function DetailStat({ label, value, icon }) {
  return (
    <View style={styles.detailStat}>
      <Text style={styles.detailStatIcon}>{icon}</Text>
      <Text style={styles.detailStatValue}>{value}</Text>
      <Text style={styles.detailStatLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  headerCount: {
    color: COLORS.accent,
    fontWeight: "800",
    fontSize: FONT_SIZES.md,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.accentGlow,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: FONT_SIZES.md },
  filterRow: { flexGrow: 0, marginBottom: SPACING.sm },
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
  loadingCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
  },
  loadingText: { color: COLORS.textSecondary, fontSize: FONT_SIZES.md },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.xxl,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubText: {
    color: COLORS.textMuted,
    fontSize: FONT_SIZES.sm,
    textAlign: "center",
  },
  list: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    paddingBottom: SPACING.xxxl,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontWeight: "800", fontSize: FONT_SIZES.md },
  userInfo: { flex: 1, gap: 3 },
  userNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    flexWrap: "wrap",
  },
  userName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: "700",
  },
  planBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  planBadgeText: { fontSize: 10, fontWeight: "700" },
  userEmail: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  userMeta: { flexDirection: "row", gap: SPACING.md },
  userMetaText: { color: COLORS.textMuted, fontSize: 10 },
  userStats: {
    flexDirection: "row",
    gap: SPACING.sm,
    flexWrap: "wrap",
    marginTop: 2,
  },
  userStat: { color: COLORS.textSecondary, fontSize: 10 },
  editPlanBtn: { padding: SPACING.xs },
  detailModal: { flex: 1, backgroundColor: COLORS.background },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: "700",
  },
  detailEdit: { color: COLORS.accent, fontWeight: "700" },
  detailContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xl,
    gap: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  detailProfile: {
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: "800",
    color: COLORS.textPrimary,
  },
  detailName: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
  },
  detailEmail: { color: COLORS.textMuted, fontSize: FONT_SIZES.sm },
  detailSectionTitle: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: SPACING.sm,
  },
  detailStatsGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  detailStat: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  detailStatIcon: { fontSize: 22 },
  detailStatValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.xl,
    fontWeight: "800",
  },
  detailStatLabel: { color: COLORS.textMuted, fontSize: FONT_SIZES.xs },
  detailInfoCard: {
    backgroundColor: COLORS.backgroundCard,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: { color: COLORS.textSecondary, fontSize: FONT_SIZES.sm },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: "600",
  },
  deleteUserBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.errorGlow,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.error + "40",
    marginTop: SPACING.md,
  },
  deleteUserText: {
    color: COLORS.error,
    fontWeight: "700",
    fontSize: FONT_SIZES.md,
  },
});
