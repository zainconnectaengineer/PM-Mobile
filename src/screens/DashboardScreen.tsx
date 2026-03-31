import React, { useCallback, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, Modal, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import type { DashboardStats, OnlineUser, UserStatus } from '../types';

const STATUS_COLORS: Record<UserStatus, string> = {
  available: '#22C55E', busy: '#EF4444', away: '#F59E0B', offline: '#9CA3AF',
};
const STATUS_LABELS: Record<UserStatus, string> = {
  available: 'Available', busy: 'Busy', away: 'Away', offline: 'Offline',
};
const STATUS_ICONS: Record<UserStatus, keyof typeof Ionicons.glyphMap> = {
  available: 'checkmark-circle', busy: 'remove-circle', away: 'time', offline: 'ellipse',
};
const AVATAR_COLORS = ['#6366F1', '#06B6D4', '#F97316', '#EC4899', '#22C55E', '#8B5CF6'];
const SB_H = Platform.OS === 'ios' ? 50 : (StatusBar.currentHeight || 24) + 10;

const formatLastSeen = (lastSeen: string) => {
  if (!lastSeen) return '';
  const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 18) return 'Good Afternoon';
  return 'Good Evening';
};

/* ─── Sub-components ─── */

function QuickStat({ icon, value, label, color, bg }: {
  icon: keyof typeof Ionicons.glyphMap; value: number; label: string; color: string; bg: string;
}) {
  return (
    <View style={[st.quickCard, { backgroundColor: bg }]}>
      <View style={[st.quickIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <Text style={st.quickValue}>{value}</Text>
      <Text style={st.quickLabel}>{label}</Text>
    </View>
  );
}

function StatCard({ icon, label, value, total, accent, bg }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; value: number; total?: number; accent: string; bg: string;
}) {
  return (
    <View style={[st.statCard, { backgroundColor: bg }]}>
      <View style={[st.statIcon, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={18} color="#fff" />
      </View>
      <Text style={st.statValue}>
        {value}{total !== undefined ? <Text style={st.statTotal}>/{total}</Text> : null}
      </Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={st.legendItem}>
      <View style={[st.legendDot, { backgroundColor: color }]} />
      <Text style={st.legendText}>{label}</Text>
    </View>
  );
}

/* ─── Main Component ─── */

export default function DashboardScreen() {
  const { user, access } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [myStatus, setMyStatus] = useState<UserStatus>('available');
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const presenceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const api = createApi(access);
      const [projRes, taskRes, subRes, userRes] = await Promise.all([
        api.get('/api/pm/projects/'),
        api.get('/api/pm/tasks/'),
        api.get('/api/pm/subtasks/'),
        api.get('/api/accounts/users/'),
      ]);
      const projects = projRes.data || [];
      const tasks = taskRes.data || [];
      const subtasks = subRes.data || [];
      const users = userRes.data || [];
      setStats({
        total_projects: projects.length,
        projects_in_progress: projects.length,
        completed_projects: 0,
        total_tasks: tasks.length,
        tasks_pending: tasks.filter((t: any) => t.status === 'PENDING').length,
        tasks_in_progress: tasks.filter((t: any) => t.status === 'IN_PROGRESS').length,
        tasks_completed: tasks.filter((t: any) => t.status === 'COMPLETED').length,
        total_sub_tasks: subtasks.length,
        sub_tasks_pending: subtasks.filter((s: any) => s.status === 'PENDING').length,
        sub_tasks_completed: subtasks.filter((s: any) => s.status === 'COMPLETED').length,
        developers_count: users.length,
      });
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchOnlineUsers = useCallback(async () => {
    try {
      const res = await createApi(access).get('/api/accounts/presence/online/');
      setOnlineUsers((res.data || []).sort((a: OnlineUser, b: OnlineUser) => {
        if (a.is_online && !b.is_online) return -1;
        if (!a.is_online && b.is_online) return 1;
        return a.username.localeCompare(b.username);
      }));
    } catch { /* ignore */ }
  }, [access]);

  const sendHeartbeat = useCallback(async () => {
    try {
      const res = await createApi(access).post('/api/accounts/presence/heartbeat/');
      if (res.data?.status) setMyStatus(res.data.status);
    } catch { /* ignore */ }
  }, [access]);

  const changeStatus = async (status: UserStatus) => {
    try {
      const res = await createApi(access).post('/api/accounts/presence/status/', { status });
      if (res.data?.status) setMyStatus(res.data.status);
    } catch { /* ignore */ }
    setStatusModalVisible(false);
    fetchOnlineUsers();
  };

  useFocusEffect(useCallback(() => {
    load();
    sendHeartbeat();
    fetchOnlineUsers();
    heartbeatRef.current = setInterval(sendHeartbeat, 120000);
    presenceRef.current = setInterval(fetchOnlineUsers, 30000);
    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (presenceRef.current) clearInterval(presenceRef.current);
    };
  }, [access]));

  const onlineCount = onlineUsers.filter(u => u.is_online).length;
  const tasksDone = stats?.tasks_completed ?? 0;
  const tasksTotal = stats?.total_tasks ?? 1;
  const taskPct = tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  if (loading) {
    return <View style={st.loadingWrap}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <ScrollView
      style={st.container}
      contentContainerStyle={st.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
      showsVerticalScrollIndicator={false}
    >
      {/* ───── Hero Header ───── */}
      <View style={st.hero}>
        <View style={st.heroContent}>
          <Text style={st.heroGreet}>{getGreeting()},</Text>
          <Text style={st.heroName}>{user?.username || 'User'} 👋</Text>
          <TouchableOpacity style={st.statusChip} activeOpacity={0.7} onPress={() => setStatusModalVisible(true)}>
            <View style={[st.statusDot, { backgroundColor: STATUS_COLORS[myStatus] }]} />
            <Text style={st.statusChipText}>{STATUS_LABELS[myStatus]}</Text>
            <Ionicons name="chevron-down" size={12} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        </View>
        <View style={st.heroAvatar}>
          <Text style={st.heroAvatarText}>{user?.username?.slice(0, 2).toUpperCase() || 'U'}</Text>
        </View>
      </View>

      {/* ───── Quick Stats Row ───── */}
      <View style={st.quickRow}>
        <QuickStat icon="folder-open" value={stats?.total_projects ?? 0} label="Projects" color="#F97316" bg="#FFF7ED" />
        <QuickStat icon="clipboard" value={stats?.total_tasks ?? 0} label="Tasks" color="#3B82F6" bg="#EFF6FF" />
        <QuickStat icon="people" value={stats?.developers_count ?? 0} label="Team" color="#8B5CF6" bg="#F5F3FF" />
        <QuickStat icon="pulse" value={onlineCount} label="Online" color="#22C55E" bg="#F0FDF4" />
      </View>

      {/* ───── Progress Card ───── */}
      <View style={st.progressCard}>
        <View style={st.progressHeader}>
          <View>
            <Text style={st.progressTitle}>Task Progress</Text>
            <Text style={st.progressSub}>{tasksDone} of {tasksTotal} completed</Text>
          </View>
          <View style={st.progressCircle}>
            <Text style={st.progressPct}>{taskPct}%</Text>
          </View>
        </View>
        <View style={st.progressBarBg}>
          <View style={[st.progressBarFill, { width: `${taskPct}%` }]} />
        </View>
        <View style={st.progressLegend}>
          <LegendDot color={Colors.warning} label={`${stats?.tasks_pending ?? 0} Pending`} />
          <LegendDot color={Colors.info} label={`${stats?.tasks_in_progress ?? 0} Active`} />
          <LegendDot color={Colors.success} label={`${tasksDone} Done`} />
        </View>
      </View>

      {/* ───── Stats Cards ───── */}
      <Text style={st.sectionTitle}>Overview</Text>
      <View style={st.statsGrid}>
        <StatCard icon="hourglass-outline" label="Pending" value={stats?.tasks_pending ?? 0} accent="#F59E0B" bg="#FFFBEB" />
        <StatCard icon="flash-outline" label="In Progress" value={stats?.tasks_in_progress ?? 0} accent="#3B82F6" bg="#EFF6FF" />
        <StatCard icon="checkmark-done-outline" label="Completed" value={stats?.tasks_completed ?? 0} accent="#22C55E" bg="#F0FDF4" />
        <StatCard icon="layers-outline" label="Subtasks" value={stats?.sub_tasks_completed ?? 0} total={stats?.total_sub_tasks ?? 0} accent="#8B5CF6" bg="#F5F3FF" />
      </View>

      {/* ───── Online Users ───── */}
      <View style={st.sectionRow}>
        <Text style={st.sectionTitle}>Team Activity</Text>
        <View style={st.onlineBadge}><Text style={st.onlineBadgeText}>{onlineCount} online</Text></View>
      </View>
      <View style={st.teamCard}>
        {onlineUsers.length === 0 ? (
          <Text style={st.emptyText}>No team members yet</Text>
        ) : (
          onlineUsers.slice(0, 8).map(u => {
            const color = AVATAR_COLORS[u.id % AVATAR_COLORS.length];
            return (
              <View key={u.id} style={st.userRow}>
                <View style={st.avatarWrap}>
                  <View style={[st.userAvatar, { backgroundColor: color }]}>
                    <Text style={st.userAvatarText}>{u.username.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={[st.indicator, { backgroundColor: STATUS_COLORS[u.status] }]} />
                </View>
                <View style={st.userInfo}>
                  <Text style={st.userName} numberOfLines={1}>{u.username}</Text>
                  <Text style={st.userSub}>{u.is_online ? STATUS_LABELS[u.status] : formatLastSeen(u.last_seen)}</Text>
                </View>
                <View style={[st.statusPill, { backgroundColor: STATUS_COLORS[u.status] + '18' }]}>
                  <View style={[st.pillDot, { backgroundColor: STATUS_COLORS[u.status] }]} />
                  <Text style={[st.pillText, { color: STATUS_COLORS[u.status] }]}>
                    {u.is_online ? STATUS_LABELS[u.status] : 'Offline'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
        {onlineUsers.length > 8 && (
          <Text style={st.moreText}>+{onlineUsers.length - 8} more members</Text>
        )}
      </View>

      {/* ───── Status Modal ───── */}
      <Modal visible={statusModalVisible} transparent animationType="fade" onRequestClose={() => setStatusModalVisible(false)}>
        <TouchableOpacity style={st.modalOverlay} activeOpacity={1} onPress={() => setStatusModalVisible(false)}>
          <View style={st.statusModal}>
            <View style={st.modalHandle} />
            <Text style={st.modalTitle}>Set Your Status</Text>
            {(['available', 'busy', 'away', 'offline'] as UserStatus[]).map(s => (
              <TouchableOpacity
                key={s}
                style={[st.statusOpt, myStatus === s && st.statusOptActive]}
                onPress={() => changeStatus(s)}
                activeOpacity={0.7}
              >
                <View style={[st.statusOptIcon, { backgroundColor: STATUS_COLORS[s] + '20' }]}>
                  <Ionicons name={STATUS_ICONS[s]} size={22} color={STATUS_COLORS[s]} />
                </View>
                <Text style={[st.statusOptText, myStatus === s && { fontWeight: '700', color: Colors.text }]}>
                  {STATUS_LABELS[s]}
                </Text>
                {myStatus === s && <Ionicons name="checkmark-circle" size={20} color={Colors.success} style={{ marginLeft: 'auto' }} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

/* ─── Styles ─── */

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 120 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  // Hero
  hero: {
    backgroundColor: Colors.primary,
    paddingTop: SB_H + 8, paddingBottom: 28, paddingHorizontal: 20,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  heroContent: { flex: 1 },
  heroGreet: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.7)', marginBottom: 2 },
  heroName: { fontSize: FontSize.xxl, fontWeight: '800', color: '#fff', marginBottom: 10 },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'flex-start',
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusChipText: { fontSize: FontSize.xs, color: '#fff', fontWeight: '600' },
  heroAvatar: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)',
  },
  heroAvatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.xl },

  // Quick stats
  quickRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: -20, marginBottom: 20 },
  quickCard: {
    flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: Radius.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  quickIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  quickValue: { fontSize: FontSize.lg, fontWeight: '800', color: Colors.text },
  quickLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '600', marginTop: 1 },

  // Progress card
  progressCard: {
    backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: Radius.lg,
    padding: 18, marginBottom: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  progressTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  progressSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  progressCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primaryBg,
    alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: Colors.primary,
  },
  progressPct: { fontSize: FontSize.sm, fontWeight: '800', color: Colors.primary },
  progressBarBg: { height: 8, backgroundColor: Colors.surfaceAlt, borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4, minWidth: 4 },
  progressLegend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: FontSize.xs, color: Colors.textSecondary },

  // Section
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: 12, paddingHorizontal: 16 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16, marginTop: 8 },
  onlineBadge: { backgroundColor: Colors.successBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  onlineBadgeText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  // Stats grid
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginBottom: 24 },
  statCard: { width: '47%', borderRadius: Radius.lg, padding: 16 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  statTotal: { fontSize: FontSize.md, fontWeight: '400', color: Colors.textMuted },
  statLabel: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 4, fontWeight: '500' },

  // Team card
  teamCard: {
    backgroundColor: Colors.surface, marginHorizontal: 16, borderRadius: Radius.lg,
    padding: 16, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
  },
  emptyText: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center', paddingVertical: 20 },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  avatarWrap: { position: 'relative' },
  userAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  userAvatarText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  indicator: { position: 'absolute', bottom: 0, right: 0, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: Colors.surface },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  userSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: '700' },
  moreText: { fontSize: FontSize.xs, color: Colors.primary, fontWeight: '600', textAlign: 'center', paddingTop: 12 },

  // Status modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  statusModal: { backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text, marginBottom: 16 },
  statusOpt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 12, borderRadius: Radius.md, marginBottom: 4 },
  statusOptActive: { backgroundColor: Colors.surfaceAlt },
  statusOptIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusOptText: { fontSize: FontSize.md, color: Colors.textSecondary, fontWeight: '500' },
});
