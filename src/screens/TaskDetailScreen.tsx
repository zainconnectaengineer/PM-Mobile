import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import type { Task, SubTask, ChildTask, Phase, ProjectMember } from '../types';

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
  const [phase, setPhase] = useState<Phase | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingSubtask, setUpdatingSubtask] = useState<number | null>(null);
  const [showAddChildTask, setShowAddChildTask] = useState(false);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [newChildDesc, setNewChildDesc] = useState('');
  const [creatingChildTask, setCreatingChildTask] = useState(false);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');
  const [newSubDesc, setNewSubDesc] = useState('');
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [showCollabPicker, setShowCollabPicker] = useState<number | null>(null);
  const [addingCollab, setAddingCollab] = useState(false);
  const [removingCollab, setRemovingCollab] = useState<number | null>(null);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const res = await createApi(access).get(`/api/pm/tasks/${taskId}/`);
      const taskData = res.data as Task;
      setTask(taskData);
      // Fetch project members for helper management
      if (taskData.project) {
        try {
          const memRes = await createApi(access).get(`/api/pm/projects/${taskData.project}/employees/`);
          setProjectMembers(memRes.data?.results ?? []);
        } catch {}
      }
      // Fetch phase name if task has a phase
      if (taskData.phase && taskData.project) {
        try {
          const phaseRes = await createApi(access).get(`/api/pm/projects/${taskData.project}/phases/${taskData.phase}/`);
          setPhase(phaseRes.data);
        } catch { setPhase(null); }
      } else {
        setPhase(null);
      }
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

  const handleCreateSubtask = async () => {
    if (!newSubTitle.trim()) {
      Alert.alert('Error', 'Title is required.');
      return;
    }
    setCreatingSubtask(true);
    try {
      const payload: any = { task: taskId, title: newSubTitle.trim() };
      if (newSubDesc.trim()) payload.description = newSubDesc.trim();
      await createApi(access).post('/api/pm/subtasks/', payload);
      setNewSubTitle('');
      setNewSubDesc('');
      setShowAddSubtask(false);
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.title?.[0] || 'Failed to create checklist item.');
    } finally {
      setCreatingSubtask(false);
    }
  };

  const handleCreateChildTask = async () => {
    if (!newChildTitle.trim() || !task) return;
    setCreatingChildTask(true);
    try {
      await createApi(access).post(`/api/pm/tasks/project/${task.project}/create/`, {
        title: newChildTitle.trim(),
        description: newChildDesc.trim(),
        status: 'PENDING',
        parent_task: taskId,
      });
      setNewChildTitle('');
      setNewChildDesc('');
      setShowAddChildTask(false);
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.title?.[0] || 'Failed to create sub task.');
    } finally {
      setCreatingChildTask(false);
    }
  };

  const handleAddCollaborator = async (childTaskId: number, userId: number) => {
    setAddingCollab(true);
    try {
      await createApi(access).post(`/api/pm/tasks/${childTaskId}/helpers/`, { helper_ids: [userId] });
      setShowCollabPicker(null);
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to add collaborator.');
    } finally {
      setAddingCollab(false);
    }
  };

  const handleRemoveCollaborator = async (childTaskId: number, userId: number) => {
    setRemovingCollab(userId);
    try {
      await createApi(access).post(`/api/pm/tasks/${childTaskId}/helpers/remove/`, { helper_id: userId });
      await load(true);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.detail || 'Failed to remove collaborator.');
    } finally {
      setRemovingCollab(null);
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
  const checklistCompleted = task.subtasks?.filter(s => s.status === 'COMPLETED').length ?? 0;
  const checklistTotal = task.subtasks?.length ?? 0;
  const childCompleted = task.child_tasks?.filter(c => c.status === 'COMPLETED').length ?? 0;
  const childTotal = task.child_tasks?.length ?? 0;
  const totalItems = checklistTotal + childTotal;
  const totalDone = checklistCompleted + childCompleted;
  const overallProgress = totalItems ? Math.round((totalDone / totalItems) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
    >
      {/* Status badge + Task ID */}
      <View style={styles.headerRow}>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon} size={16} color={cfg.color} />
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
        <View style={styles.taskIdBadge}>
          <Text style={styles.taskIdText}>#{task.id}</Text>
        </View>
      </View>

      {/* Phase badge */}
      {phase && (
        <View style={styles.phaseBadge}>
          <Ionicons name="flag-outline" size={13} color={Colors.chart3} />
          <Text style={styles.phaseText}>{phase.name}</Text>
        </View>
      )}

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

      {/* Overall Progress */}
      {totalItems > 0 && (
        <View style={styles.overallProgressWrap}>
          <View style={styles.overallProgressHeader}>
            <Text style={styles.overallProgressLabel}>OVERALL PROGRESS</Text>
            <Text style={styles.overallProgressPct}>{overallProgress}%</Text>
          </View>
          <View style={styles.subProgressBar}>
            <View style={[styles.subProgressFill, { width: `${overallProgress}%`, backgroundColor: Colors.primary }]} />
          </View>
          <View style={styles.overallProgressStats}>
            {childTotal > 0 && <Text style={styles.overallProgressStat}>{childCompleted}/{childTotal} sub tasks done</Text>}
            {checklistTotal > 0 && <Text style={styles.overallProgressStat}>{checklistCompleted}/{checklistTotal} checklist done</Text>}
          </View>
        </View>
      )}

      {/* ═══ Sub Tasks (Child Tasks) ═══ */}
      <View style={styles.subtaskHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <View style={[styles.sectionIcon, { backgroundColor: Colors.primaryBg }]}>
            <Ionicons name="layers-outline" size={16} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.sectionTitleInline}>Sub Tasks</Text>
            <Text style={styles.sectionCount}>{childTotal} item{childTotal !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addSubBtn}
          onPress={() => setShowAddChildTask(!showAddChildTask)}
        >
          <Ionicons name={showAddChildTask ? 'close' : 'add'} size={18} color={Colors.primary} />
          <Text style={styles.addSubBtnText}>{showAddChildTask ? 'Cancel' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      {showAddChildTask && (
        <View style={styles.addSubForm}>
          <TextInput
            style={styles.addSubInput}
            placeholder="What needs to be done?"
            placeholderTextColor={Colors.textMuted}
            value={newChildTitle}
            onChangeText={setNewChildTitle}
          />
          <TextInput
            style={[styles.addSubInput, { height: 50 }]}
            placeholder="Add a brief description (optional)"
            placeholderTextColor={Colors.textMuted}
            value={newChildDesc}
            onChangeText={setNewChildDesc}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.addSubActions}>
            <TouchableOpacity onPress={() => { setShowAddChildTask(false); setNewChildTitle(''); setNewChildDesc(''); }}>
              <Text style={styles.addSubCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addSubCreate, creatingChildTask && { opacity: 0.6 }]}
              onPress={handleCreateChildTask}
              disabled={creatingChildTask}
            >
              {creatingChildTask ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addSubCreateText}>Create Sub Task</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {childTotal === 0 && !showAddChildTask ? (
        <View style={styles.emptySubWrap}>
          <Ionicons name="layers-outline" size={32} color={Colors.textMuted} style={{ opacity: 0.4 }} />
          <Text style={styles.emptySubText}>No sub tasks yet</Text>
          <Text style={[styles.emptySubText, { fontSize: FontSize.xs }]}>Break this task into smaller pieces</Text>
        </View>
      ) : (
        task.child_tasks?.map(ct => {
          const ctCfg = STATUS_CONFIG[ct.status];
          const existingIds = ct.collaborators?.map(c => c.id) ?? [];
          const availableMembers = projectMembers.filter(m => !existingIds.includes(m.user.id));
          return (
            <View key={ct.id} style={styles.childTaskCard}>
              <View style={styles.childTaskHeader}>
                <View style={[styles.childTaskStatus, { backgroundColor: ctCfg.bg }]}>
                  <Ionicons name={ctCfg.icon} size={12} color={ctCfg.color} />
                  <Text style={[styles.childTaskStatusText, { color: ctCfg.color }]}>{ctCfg.label}</Text>
                </View>
                <TouchableOpacity onPress={() => navigation.push('TaskDetail', { taskId: ct.id, taskTitle: ct.title })}>
                  <Text style={styles.childTaskId}>#{ct.id} →</Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.childTaskTitle, ct.status === 'COMPLETED' && { textDecorationLine: 'line-through', color: Colors.textMuted }]}>{ct.title}</Text>
              {ct.description ? <Text style={{ fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 }}>{ct.description}</Text> : null}

              {/* Collaborators */}
              <View style={styles.collabRow}>
                {ct.collaborators?.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.collabChip}
                    onPress={() => Alert.alert('Remove Collaborator', `Remove ${c.username}?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => handleRemoveCollaborator(ct.id, c.id) },
                    ])}
                    disabled={removingCollab === c.id}
                  >
                    <Ionicons name="person" size={10} color={Colors.primary} />
                    <Text style={styles.collabChipText}>{c.username}</Text>
                    {removingCollab === c.id ? (
                      <ActivityIndicator size={8} color={Colors.primary} />
                    ) : (
                      <Ionicons name="close" size={10} color={Colors.primary} style={{ opacity: 0.5 }} />
                    )}
                  </TouchableOpacity>
                ))}
                {availableMembers.length > 0 && (
                  <TouchableOpacity
                    style={styles.addCollabBtn}
                    onPress={() => setShowCollabPicker(showCollabPicker === ct.id ? null : ct.id)}
                  >
                    <Ionicons name="person-add-outline" size={10} color={Colors.textMuted} />
                    <Text style={styles.addCollabText}>Collaborator</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Collaborator picker dropdown */}
              {showCollabPicker === ct.id && (
                <View style={styles.collabPicker}>
                  <Text style={styles.collabPickerTitle}>Add collaborator</Text>
                  {availableMembers.map(m => (
                    <TouchableOpacity
                      key={m.user.id}
                      style={styles.collabPickerItem}
                      onPress={() => handleAddCollaborator(ct.id, m.user.id)}
                      disabled={addingCollab}
                    >
                      <View style={styles.collabPickerAvatar}>
                        <Text style={styles.collabPickerAvatarText}>{m.user.username.slice(0, 2).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.collabPickerName}>{m.user.username}</Text>
                    </TouchableOpacity>
                  ))}
                  {addingCollab && <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.sm }} />}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* ═══ Checklist (SubTask model) ═══ */}
      <View style={[styles.subtaskHeader, { marginTop: Spacing.lg }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
          <View style={[styles.sectionIcon, { backgroundColor: Colors.successBg }]}>
            <Ionicons name="checkbox-outline" size={16} color={Colors.success} />
          </View>
          <View>
            <Text style={styles.sectionTitleInline}>Checklist</Text>
            <Text style={styles.sectionCount}>
              {checklistTotal > 0 ? `${checklistCompleted}/${checklistTotal} completed` : 'No items'}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.addSubBtn}
          onPress={() => setShowAddSubtask(!showAddSubtask)}
        >
          <Ionicons name={showAddSubtask ? 'close' : 'add'} size={18} color={Colors.primary} />
          <Text style={styles.addSubBtnText}>{showAddSubtask ? 'Cancel' : 'Add'}</Text>
        </TouchableOpacity>
      </View>

      {checklistTotal > 0 && (
        <View style={styles.subProgressWrap}>
          <View style={styles.subProgressBar}>
            <View style={[styles.subProgressFill, { width: `${checklistTotal ? Math.round((checklistCompleted / checklistTotal) * 100) : 0}%` }]} />
          </View>
        </View>
      )}

      {showAddSubtask && (
        <View style={styles.addSubForm}>
          <TextInput
            style={styles.addSubInput}
            placeholder="Add an item..."
            placeholderTextColor={Colors.textMuted}
            value={newSubTitle}
            onChangeText={setNewSubTitle}
          />
          <View style={styles.addSubActions}>
            <TouchableOpacity onPress={() => { setShowAddSubtask(false); setNewSubTitle(''); setNewSubDesc(''); }}>
              <Text style={styles.addSubCancel}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addSubCreate, creatingSubtask && { opacity: 0.6 }]}
              onPress={handleCreateSubtask}
              disabled={creatingSubtask}
            >
              {creatingSubtask ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.addSubCreateText}>Add Item</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {checklistTotal === 0 && !showAddSubtask ? (
        <View style={styles.emptySubWrap}>
          <Text style={styles.emptySubText}>No items yet</Text>
        </View>
      ) : (
        task.subtasks?.map(sub => {
          const sc = STATUS_CONFIG[sub.status];
          const isCompleted = sub.status === 'COMPLETED';
          return (
            <TouchableOpacity
              key={sub.id}
              style={styles.checklistCard}
              activeOpacity={0.7}
              onPress={() => handleSubtaskStatusChange(sub)}
              disabled={updatingSubtask === sub.id}
            >
              <View style={[styles.checklistBox, isCompleted && styles.checklistBoxDone]}>
                {isCompleted && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.checklistTitle, isCompleted && styles.checklistTitleDone]}>{sub.title}</Text>
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
    flexDirection: 'row', alignItems: 'center',
    gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: Radius.full,
  },
  statusText: { fontSize: FontSize.sm, fontWeight: '700' },
  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  taskIdBadge: {
    backgroundColor: Colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: Radius.full,
  },
  taskIdText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.textSecondary },
  phaseBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: Radius.full, alignSelf: 'flex-start', marginBottom: Spacing.md,
  },
  phaseText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.chart3 },

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

  // Overall Progress
  overallProgressWrap: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg,
    marginTop: Spacing.lg, marginBottom: Spacing.sm,
  },
  overallProgressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  overallProgressLabel: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted, letterSpacing: 0.5 },
  overallProgressPct: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  overallProgressStats: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
  overallProgressStat: { fontSize: FontSize.xs, color: Colors.textMuted },

  subProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  subProgressBar: {
    flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.surfaceAlt, overflow: 'hidden',
  },
  subProgressFill: { height: '100%', borderRadius: 3, backgroundColor: Colors.success },

  // Section headers
  sectionIcon: {
    width: 28, height: 28, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  sectionTitleInline: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.text },
  sectionCount: { fontSize: 11, color: Colors.textMuted },

  emptySubWrap: { padding: Spacing.xl, alignItems: 'center', gap: 4 },
  emptySubText: { fontSize: FontSize.sm, color: Colors.textMuted },

  subtaskHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md, marginTop: Spacing.md,
  },
  addSubBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryBg, borderRadius: Radius.full,
  },
  addSubBtnText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  addSubForm: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg,
    marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.primary + '40',
  },
  addSubInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, height: 44,
    fontSize: FontSize.md, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.sm,
  },
  addSubActions: {
    flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  addSubCancel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textSecondary },
  addSubCreate: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  addSubCreateText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },

  // Child tasks (Sub Tasks)
  childTaskCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  childTaskHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  childTaskStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full,
  },
  childTaskStatusText: { fontSize: 10, fontWeight: '600' },
  childTaskId: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.primary },
  childTaskTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },

  // Collaborators
  collabRow: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: Spacing.sm,
  },
  collabChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primaryBg, borderRadius: Radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  collabChipText: { fontSize: 10, fontWeight: '600', color: Colors.primary },
  addCollabBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.textMuted + '50',
    borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  addCollabText: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
  collabPicker: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    padding: Spacing.sm, marginTop: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  collabPickerTitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, marginBottom: Spacing.xs },
  collabPickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs,
  },
  collabPickerAvatar: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: Colors.primaryBg, alignItems: 'center', justifyContent: 'center',
  },
  collabPickerAvatarText: { fontSize: 9, fontWeight: '700', color: Colors.primary },
  collabPickerName: { fontSize: FontSize.sm, color: Colors.text },

  // Checklist
  checklistCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginBottom: 4,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  checklistBox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.md,
  },
  checklistBoxDone: {
    backgroundColor: Colors.success, borderColor: Colors.success,
  },
  checklistTitle: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  checklistTitleDone: { textDecorationLine: 'line-through', color: Colors.textMuted },
});
