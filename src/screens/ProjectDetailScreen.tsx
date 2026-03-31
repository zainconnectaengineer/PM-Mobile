import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Alert, Modal, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import type { Project, ProjectMember, Task } from '../types';

const STATUS_CONFIG = {
  PENDING: { color: Colors.warning, bg: Colors.warningBg, icon: 'time-outline' as const, label: 'Pending' },
  IN_PROGRESS: { color: Colors.info, bg: Colors.infoBg, icon: 'flash-outline' as const, label: 'In Progress' },
  COMPLETED: { color: Colors.success, bg: Colors.successBg, icon: 'checkmark-circle' as const, label: 'Done' },
};

export default function ProjectDetailScreen({ route, navigation }: any) {
  const { projectId } = route.params;
  const { access, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const canManage = user?.permissions?.includes('projects.change_project');

  // All users (for add member)
  type UserItem = { id: number; username: string; email: string };
  const [allUsers, setAllUsers] = useState<UserItem[]>([]);

  // Add members modal
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  // Delete project modal
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const api = createApi(access);
      const [projRes, memRes, taskRes, usersRes] = await Promise.all([
        api.get(`/api/pm/projects/${projectId}/`),
        api.get(`/api/pm/projects/${projectId}/employees/`),
        api.get('/api/pm/tasks/'),
        api.get('/api/accounts/users/'),
      ]);
      const proj = projRes.data as Project;
      proj.members = memRes.data?.results || [];
      setProject(proj);
      setTasks((taskRes.data || []).filter((t: Task) => t.project === projectId));
      setAllUsers(usersRes.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load project.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access, projectId]));

  const handleRemoveMember = (member: ProjectMember) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member.user.username} from this project?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            try {
              await createApi(access).delete(`/api/pm/projects/${projectId}/employees/`, {
                data: { user_ids: [member.user.id] },
              });
              setProject(prev => prev ? { ...prev, members: prev.members.filter(m => m.id !== member.id) } : prev);
            } catch (e: any) {
              Alert.alert('Error', e.response?.data?.detail || 'Failed to remove member.');
            }
          },
        },
      ]
    );
  };

  // ─── Add Members ───
  const openAddMember = () => {
    // Pre-select current members
    const currentIds = project?.members.map(m => m.user.id) || [];
    setSelectedUserIds(currentIds);
    setAddMemberVisible(true);
  };

  const toggleUser = (id: number) => {
    setSelectedUserIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAddMembers = async () => {
    setAddMemberLoading(true);
    try {
      await createApi(access).post(`/api/pm/projects/${projectId}/employees/`, {
        user_ids: selectedUserIds.map(String),
        role: 'MEMBER',
      });
      Alert.alert('Success', 'Members updated!');
      setAddMemberVisible(false);
      load();
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        Alert.alert('Error', msgs);
      } else {
        Alert.alert('Error', 'Failed to add members.');
      }
    } finally {
      setAddMemberLoading(false);
    }
  };

  // ─── Delete Project ───
  const handleDeleteProject = async () => {
    if (deleteInput !== 'DELETE') {
      Alert.alert('Error', 'Type DELETE to confirm.');
      return;
    }
    setDeleteLoading(true);
    try {
      await createApi(access).delete(`/api/pm/projects/${projectId}/`);
      Alert.alert('Deleted', 'Project has been deleted.');
      navigation.goBack();
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        Alert.alert('Error', msgs);
      } else {
        Alert.alert('Error', 'Failed to delete project.');
      }
    } finally {
      setDeleteLoading(false);
    }
  };

  if (loading || !project) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const completed = tasks.filter(t => t.status === 'COMPLETED').length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
    >
      {/* Project header */}
      <View style={styles.headerCard}>
        <Text style={styles.projName}>{project.name}</Text>
        <Text style={styles.projDesc}>{project.description || 'No description'}</Text>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>Progress</Text>
            <Text style={styles.progressPct}>{progress}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressSub}>{completed}/{tasks.length} tasks completed</Text>
        </View>
      </View>

      {/* Task stats */}
      <View style={styles.statsRow}>
        {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as const).map(s => {
          const cfg = STATUS_CONFIG[s];
          const count = tasks.filter(t => t.status === s).length;
          return (
            <View key={s} style={[styles.statusChip, { backgroundColor: cfg.bg }]}>
              <Ionicons name={cfg.icon} size={16} color={cfg.color} />
              <Text style={[styles.statusText, { color: cfg.color }]}>{count} {cfg.label}</Text>
            </View>
          );
        })}
      </View>

      {/* Tasks */}
      <View style={styles.taskHeaderRow}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        <TouchableOpacity
          style={styles.addTaskBtn}
          onPress={() => navigation.navigate('CreateTask', { projectId, projectName: project.name })}
        >
          <Ionicons name="add-circle" size={20} color={Colors.primary} />
          <Text style={styles.addTaskText}>Add Task</Text>
        </TouchableOpacity>
      </View>
      {tasks.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="clipboard-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyText}>No tasks yet</Text>
        </View>
      ) : (
        tasks.slice(0, 10).map(task => {
          const cfg = STATUS_CONFIG[task.status];
          return (
            <TouchableOpacity
              key={task.id} style={styles.taskCard} activeOpacity={0.7}
              onPress={() => navigation.navigate('Tasks', {
                screen: 'TaskDetail',
                params: { taskId: task.id, taskTitle: task.title },
              })}
            >
              <View style={styles.taskHeader}>
                <View style={[styles.taskStatus, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={12} color={cfg.color} />
                  <Text style={[styles.taskStatusText, { color: cfg.color }]}>{cfg.label}</Text>
                </View>
                {task.due_date && (
                  <Text style={styles.taskDue}>
                    <Ionicons name="calendar-outline" size={12} color={Colors.textMuted} /> {new Date(task.due_date).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <Text style={styles.taskTitle}>{task.title}</Text>
              {task.description ? <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text> : null}
            </TouchableOpacity>
          );
        })
      )}

      {/* Members */}
      <View style={styles.taskHeaderRow}>
        <Text style={styles.sectionTitle}>Members ({project.members.length})</Text>
        {canManage && (
          <TouchableOpacity style={styles.addTaskBtn} onPress={openAddMember}>
            <Ionicons name="person-add" size={18} color={Colors.primary} />
            <Text style={styles.addTaskText}>Add Members</Text>
          </TouchableOpacity>
        )}
      </View>
      {project.members.map(member => (
        <View key={member.id} style={styles.memberCard}>
          <View style={styles.memberAvatar}>
            <Text style={styles.memberAvatarText}>{member.user.username.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.user.username}</Text>
            <Text style={styles.memberEmail}>{member.user.email}</Text>
          </View>
          {canManage && member.user.id !== project.created_by && (
            <TouchableOpacity onPress={() => handleRemoveMember(member)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={22} color={Colors.error} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {/* Delete Project */}
      {canManage && (
        <TouchableOpacity
          style={styles.deleteProjectBtn}
          activeOpacity={0.8}
          onPress={() => { setDeleteInput(''); setDeleteVisible(true); }}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={styles.deleteProjectText}>Delete Project</Text>
        </TouchableOpacity>
      )}

      <View style={{ height: 60 }} />

      {/* ═══ Add Members Modal ═══ */}
      <Modal visible={addMemberVisible} transparent animationType="slide" onRequestClose={() => setAddMemberVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Members</Text>
                <Text style={styles.modalSubtitle}>Select users to add to this project</Text>
              </View>
              <TouchableOpacity onPress={() => setAddMemberVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Current members (shown at top) */}
            {project.members.length > 0 && (
              <View style={styles.currentMembersWrap}>
                <Text style={styles.currentMembersLabel}>Current Members</Text>
                {project.members.map(m => (
                  <View key={m.id} style={styles.currentMemberRow}>
                    <Text style={styles.currentMemberText}>
                      {m.user.username} <Text style={{ color: Colors.textMuted }}>({m.user.email})</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.currentMembersLabel, { marginTop: Spacing.md }]}>All Users</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 250 }}>
              {allUsers.map(u => {
                const selected = selectedUserIds.includes(u.id);
                return (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.userOption, selected && styles.userOptionSelected]}
                    onPress={() => toggleUser(u.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={selected ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={selected ? Colors.primary : Colors.textMuted}
                    />
                    <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                      <Text style={[styles.userOptionName, selected && { color: Colors.primary, fontWeight: '600' }]}>
                        {u.username}
                      </Text>
                      <Text style={styles.userOptionEmail}>{u.email}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, addMemberLoading && { opacity: 0.6 }]}
              onPress={handleAddMembers}
              disabled={addMemberLoading}
              activeOpacity={0.8}
            >
              {addMemberLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>Add Members</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ═══ Delete Project Modal ═══ */}
      <Modal visible={deleteVisible} transparent animationType="fade" onRequestClose={() => setDeleteVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Delete Project</Text>
                <Text style={styles.modalSubtitle}>This action cannot be undone.</Text>
              </View>
              <TouchableOpacity onPress={() => setDeleteVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.deleteWarning}>
              Type <Text style={{ fontWeight: '800' }}>DELETE</Text> to confirm deletion of this project and all its tasks.
            </Text>
            <TextInput
              style={styles.fieldInput}
              placeholder='Type "DELETE" here...'
              placeholderTextColor={Colors.textMuted}
              value={deleteInput}
              onChangeText={setDeleteInput}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.deleteBtnFull, deleteLoading && { opacity: 0.6 }]}
              onPress={handleDeleteProject}
              disabled={deleteLoading}
              activeOpacity={0.8}
            >
              {deleteLoading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#fff" />
                  <Text style={styles.deleteBtnFullText}>Delete Project</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  headerCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    marginBottom: Spacing.lg,
  },
  projName: { fontSize: FontSize.xl, fontWeight: '800', color: Colors.text },
  projDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  progressWrap: { marginTop: Spacing.xl },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  progressPct: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  progressBar: {
    height: 8, borderRadius: 4, backgroundColor: Colors.surfaceAlt, marginTop: Spacing.sm, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: Colors.primary },
  progressSub: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: Spacing.xs },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xl, flexWrap: 'wrap' },
  statusChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.full,
  },
  statusText: { fontSize: FontSize.xs, fontWeight: '600' },
  sectionTitle: {
    fontSize: FontSize.lg, fontWeight: '700', color: Colors.text,
    marginBottom: Spacing.md, marginTop: Spacing.sm,
  },
  taskCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.lg,
    marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  taskStatus: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.full,
  },
  taskStatusText: { fontSize: FontSize.xs, fontWeight: '600' },
  taskDue: { fontSize: FontSize.xs, color: Colors.textMuted },
  taskTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  taskDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  emptyWrap: { alignItems: 'center', padding: Spacing.xxxl },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.sm },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: Radius.md, padding: Spacing.md, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.chart2,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  memberInfo: { flex: 1, marginLeft: Spacing.md },
  memberName: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  memberEmail: { fontSize: FontSize.xs, color: Colors.textMuted },
  removeBtn: { padding: Spacing.xs },
  taskHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.md, marginTop: Spacing.sm,
  },
  addTaskBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryBg, borderRadius: Radius.full,
  },
  addTaskText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },

  // Delete project button
  deleteProjectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.errorBg, borderRadius: Radius.md,
    paddingVertical: Spacing.md, marginTop: Spacing.xl,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  deleteProjectText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.error },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xl, width: '100%', maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },

  // Current members list
  currentMembersWrap: { marginBottom: Spacing.sm },
  currentMembersLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  currentMemberRow: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: 4,
  },
  currentMemberText: { fontSize: FontSize.sm, color: Colors.text },

  // User select options
  userOption: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  userOptionSelected: { backgroundColor: Colors.primaryBg, borderRadius: Radius.sm },
  userOptionName: { fontSize: FontSize.md, color: Colors.text },
  userOptionEmail: { fontSize: FontSize.xs, color: Colors.textMuted },

  // Primary button
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },

  // Delete modal
  deleteWarning: {
    fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  deleteBtnFull: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.error, borderRadius: Radius.md,
    paddingVertical: Spacing.md,
  },
  deleteBtnFullText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
});
