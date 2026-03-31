import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import type { Task, SubTask } from '../types';

const STATUS_CONFIG: Record<string, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  PENDING: { color: Colors.warning, bg: Colors.warningBg, icon: 'time-outline', label: 'Pending' },
  IN_PROGRESS: { color: Colors.info, bg: Colors.infoBg, icon: 'flash-outline', label: 'In Progress' },
  COMPLETED: { color: Colors.success, bg: Colors.successBg, icon: 'checkmark-circle', label: 'Done' },
};

const STATUS_ORDER: Array<Task['status']> = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

export default function TaskDetailScreen({ route, navigation }: any) {
  const { taskId } = route.params;
  const { access, user } = useAuth();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingSubtask, setUpdatingSubtask] = useState<number | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await createApi(access).get(`/api/pm/tasks/${taskId}/`);
      setTask(res.data);
    } catch {
      Alert.alert('Error', 'Failed to load task.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access, taskId]));

  const handleStatusChange = async (newStatus: Task['status']) => {
    if (!task || task.status === newStatus || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      const res = await createApi(access).patch(`/api/pm/tasks/${taskId}/`, { status: newStatus });
      setTask(res.data);
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSubtaskStatusChange = async (subtask: SubTask) => {
    const nextStatus = STATUS_ORDER[(STATUS_ORDER.indexOf(subtask.status) + 1) % STATUS_ORDER.length];
    setUpdatingSubtask(subtask.id);
    try {
      await createApi(access).patch(`/api/pm/subtasks/${subtask.id}/`, { status: nextStatus });
      await load(true);
    } catch {
      Alert.alert('Error', 'Failed to update subtask.');
    } finally {
      setUpdatingSubtask(null);
    }
  };

  if (loading || !task) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const cfg = STATUS_CONFIG[task.status];
  const completedSubs = task.subtasks?.filter(s => s.status === 'COMPLETED').length ?? 0;
  const totalSubs = task.subtasks?.length ?? 0;
  const subProgress = totalSubs ? Math.round((completedSubs / totalSubs) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
    >
      {/* Status badge */}
      <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
        <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>

      {/* Title & description */}
      <Text style={styles.title}>{task.title}</Text>
      {task.description ? (
        <Text style={styles.desc}>{task.description}</Text>
      ) : null}

      {/* Meta info */}
      <View style={styles.metaCard}>
        {task.assigned_to && (
          <View style={styles.metaRow}>
            <Ionicons name="person-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>Assigned to</Text>
            <Text style={styles.metaValue}>User #{task.assigned_to}</Text>
          </View>
        )}
        {task.start_from && (
          <View style={styles.metaRow}>
            <Ionicons name="play-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>Start Date</Text>
            <Text style={styles.metaValue}>{new Date(task.start_from).toLocaleDateString()}</Text>
          </View>
        )}
        {task.due_date && (
          <View style={styles.metaRow}>
            <Ionicons name="calendar-outline" size={16} color={Colors.textMuted} />
            <Text style={styles.metaLabel}>Due Date</Text>
            <Text style={styles.metaValue}>{new Date(task.due_date).toLocaleDateString()}</Text>
          </View>
        )}
        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={16} color={Colors.textMuted} />
          <Text style={styles.metaLabel}>Created</Text>
          <Text style={styles.metaValue}>{new Date(task.created_at).toLocaleDateString()}</Text>
        </View>
      </View>

      {/* Change status */}
      <Text style={styles.sectionTitle}>Update Status</Text>
      <View style={styles.statusRow}>
        {STATUS_ORDER.map(s => {
          const sc = STATUS_CONFIG[s];
          const active = task.status === s;
          return (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusOption,
                active && { backgroundColor: sc.bg, borderColor: sc.color },
              ]}
              onPress={() => handleStatusChange(s)}
              disabled={updatingStatus}
            >
              <Ionicons name={sc.icon} size={16} color={active ? sc.color : Colors.textMuted} />
              <Text style={[
                styles.statusOptionText,
                active && { color: sc.color, fontWeight: '700' },
              ]}>{sc.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {updatingStatus && <ActivityIndicator style={{ marginTop: Spacing.sm }} color={Colors.primary} />}

      {/* Helpers */}
      {task.helpers?.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Helpers ({task.helpers.length})</Text>
          <View style={styles.helpersRow}>
            {task.helpers.map(h => (
              <View key={h.id} style={styles.helperChip}>
                <View style={styles.helperAvatar}>
                  <Text style={styles.helperAvatarText}>{h.username.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={styles.helperName}>{h.username}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Subtasks */}
      <Text style={styles.sectionTitle}>
        Subtasks {totalSubs > 0 ? `(${completedSubs}/${totalSubs})` : ''}
      </Text>

      {totalSubs > 0 && (
        <View style={styles.subProgressWrap}>
          <View style={styles.subProgressBar}>
            <View style={[styles.subProgressFill, { width: `${subProgress}%` }]} />
          </View>
          <Text style={styles.subProgressText}>{subProgress}%</Text>
        </View>
      )}

      {totalSubs === 0 ? (
        <View style={styles.emptySubWrap}>
          <Text style={styles.emptySubText}>No subtasks</Text>
        </View>
      ) : (
        task.subtasks.map(sub => {
          const sc = STATUS_CONFIG[sub.status];
          return (
            <TouchableOpacity
              key={sub.id}
              style={styles.subtaskCard}
              activeOpacity={0.7}
              onPress={() => handleSubtaskStatusChange(sub)}
              disabled={updatingSubtask === sub.id}
            >
              <View style={[styles.subtaskCheck, { borderColor: sc.color }]}>
                {sub.status === 'COMPLETED' ? (
                  <Ionicons name="checkmark" size={14} color={Colors.success} />
                ) : sub.status === 'IN_PROGRESS' ? (
                  <View style={styles.subtaskInProgress} />
                ) : null}
              </View>
              <View style={styles.subtaskInfo}>
                <Text style={[
                  styles.subtaskTitle,
                  sub.status === 'COMPLETED' && styles.subtaskTitleDone,
                ]}>{sub.title}</Text>
                {sub.description ? (
                  <Text style={styles.subtaskDesc} numberOfLines={1}>{sub.description}</Text>
                ) : null}
              </View>
              <View style={[styles.subtaskBadge, { backgroundColor: sc.bg }]}>
                <Text style={[styles.subtaskBadgeText, { color: sc.color }]}>{sc.label}</Text>
              </View>
              {updatingSubtask === sub.id && (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginLeft: 8 }} />
              )}
            </TouchableOpacity>
          );
        })
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, marginBottom: Spacing.md,
  },
  statusText: { fontSize: FontSize.sm, fontWeight: '700' },

  title: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text, marginBottom: Spacing.sm },
  desc: { fontSize: FontSize.md, color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },

  metaCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
    marginBottom: Spacing.lg,
  },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  metaLabel: { fontSize: FontSize.sm, color: Colors.textMuted, flex: 1 },
  metaValue: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },

  sectionTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.text,
    marginBottom: Spacing.md, marginTop: Spacing.md,
  },

  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  statusOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4, paddingVertical: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statusOptionText: { fontSize: FontSize.xs, fontWeight: '500', color: Colors.textSecondary },

  helpersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  helperChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  helperAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.chart3, alignItems: 'center', justifyContent: 'center',
  },
  helperAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  helperName: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.text },

  subProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  subProgressBar: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.surfaceAlt, overflow: 'hidden',
  },
  subProgressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },
  subProgressText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.success },

  emptySubWrap: { padding: Spacing.xl, alignItems: 'center' },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted },

  subtaskCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  subtaskCheck: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
    marginRight: Spacing.md,
  },
  subtaskInProgress: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.info,
  },
  subtaskInfo: { flex: 1 },
  subtaskTitle: { fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  subtaskTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
  subtaskDesc: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  subtaskBadge: {
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full,
    marginLeft: Spacing.sm,
  },
  subtaskBadgeText: { fontSize: 10, fontWeight: '600' },
});
