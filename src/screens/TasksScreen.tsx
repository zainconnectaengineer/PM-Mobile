import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import type { Task } from '../types';

const STATUS_CONFIG = {
  PENDING: { color: Colors.warning, bg: Colors.warningBg, icon: 'time-outline' as const, label: 'Pending' },
  IN_PROGRESS: { color: Colors.info, bg: Colors.infoBg, icon: 'flash-outline' as const, label: 'In Progress' },
  COMPLETED: { color: Colors.success, bg: Colors.successBg, icon: 'checkmark-circle' as const, label: 'Done' },
};

type Filter = 'ALL' | 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export default function TasksScreen({ navigation }: any) {
  const { access } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await createApi(access).get('/api/pm/tasks/');
      setTasks(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  const filtered = filter === 'ALL' ? tasks : tasks.filter(t => t.status === filter);

  const renderTask = ({ item }: { item: Task }) => {
    const cfg = STATUS_CONFIG[item.status];
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => navigation.push('TaskDetail', { taskId: item.id, taskTitle: item.title })}
        style={styles.card}
      >
        <View style={styles.cardTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <View style={styles.taskIdBadge}>
              <Text style={styles.taskIdText}>#{item.id}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={12} color={cfg.color} />
              <Text style={[styles.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
          </View>
          {item.due_date && (
            <View style={styles.dueBadge}>
              <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.dueText}>{new Date(item.due_date).toLocaleDateString()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.taskTitle}>{item.title}</Text>
        {item.parent_task && (
          <View style={styles.parentBadge}>
            <Ionicons name="git-branch-outline" size={12} color={Colors.textSecondary} />
            <Text style={styles.parentText}>Child task</Text>
          </View>
        )}
        {item.description ? (
          <Text style={styles.taskDesc} numberOfLines={2}>{item.description}</Text>
        ) : null}
        <View style={styles.cardBottom}>
          {item.subtasks?.length > 0 && (
            <View style={styles.subtaskBadge}>
              <Ionicons name="layers-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.subtaskText}>
                {item.subtasks.filter(s => s.status === 'COMPLETED').length}/{item.subtasks.length} subtasks
              </Text>
            </View>
          )}
          {item.child_tasks?.length > 0 && (
            <View style={styles.subtaskBadge}>
              <Ionicons name="git-branch-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.subtaskText}>{item.child_tasks.length} child tasks</Text>
            </View>
          )}
          {item.helpers?.length > 0 && (
            <View style={styles.helperRow}>
              {item.helpers.slice(0, 3).map((h, i) => (
                <View key={h.id} style={[styles.helperDot, { marginLeft: i === 0 ? 0 : -6 }]}>
                  <Text style={styles.helperDotText}>{h.username.charAt(0).toUpperCase()}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.loadingWrap}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['ALL', 'PENDING', 'IN_PROGRESS', 'COMPLETED'] as Filter[]).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'ALL' ? 'All' : STATUS_CONFIG[f].label}
            </Text>
            {f !== 'ALL' && (
              <View style={[styles.filterCount, filter === f && styles.filterCountActive]}>
                <Text style={[styles.filterCountText, filter === f && styles.filterCountTextActive]}>
                  {tasks.filter(t => t.status === f).length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        renderItem={renderTask}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="clipboard-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No tasks found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  filterRow: {
    flexDirection: 'row', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary },
  filterTextActive: { color: Colors.textInverse },
  filterCount: {
    backgroundColor: Colors.surfaceAlt, borderRadius: 10,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  filterCountActive: { backgroundColor: 'rgba(255,255,255,0.25)' },
  filterCountText: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary },
  filterCountTextActive: { color: Colors.textInverse },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.full,
  },
  statusLabel: { fontSize: FontSize.xs, fontWeight: '600' },
  dueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dueText: { fontSize: FontSize.xs, color: Colors.textMuted },
  taskTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  taskIdBadge: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  taskIdText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textSecondary },
  parentBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
  },
  parentText: { fontSize: FontSize.xs, color: Colors.textSecondary },
  taskDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md },
  subtaskBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subtaskText: { fontSize: FontSize.xs, color: Colors.textMuted },
  helperRow: { flexDirection: 'row' },
  helperDot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.chart3, borderWidth: 2, borderColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  helperDotText: { fontSize: 8, fontWeight: '700', color: '#fff' },
  emptyWrap: { alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },
});
