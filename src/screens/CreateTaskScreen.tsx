import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import type { ProjectMember } from '../types';

type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

export default function CreateTaskScreen({ route, navigation }: any) {
  const { projectId, projectName } = route.params;
  const { access } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('PENDING');
  const [assignedTo, setAssignedTo] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [showMembers, setShowMembers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const res = await createApi(access).get(`/api/pm/projects/${projectId}/employees/`);
      setMembers(res.data?.results ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Task title is required.');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        status,
      };
      if (assignedTo) payload.assigned_to = assignedTo;
      if (dueDate.trim()) {
        // Validate date format YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
          payload.due_date = dueDate.trim();
        }
      }

      await createApi(access).post(`/api/pm/tasks/project/${projectId}/create/`, payload);
      Alert.alert('Success', 'Task created!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      const d = e.response?.data;
      Alert.alert('Error', d?.detail || d?.title?.[0] || 'Failed to create task.');
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = members.find(m => m.user.id === assignedTo);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.projectLabel}>Creating task in</Text>
        <Text style={styles.projectName}>{projectName}</Text>

        {/* Title */}
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter task title"
          placeholderTextColor={Colors.textMuted}
          value={title}
          onChangeText={setTitle}
        />

        {/* Description */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Describe the task..."
          placeholderTextColor={Colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Status */}
        <Text style={styles.label}>Status</Text>
        <View style={styles.statusRow}>
          {(['PENDING', 'IN_PROGRESS', 'COMPLETED'] as TaskStatus[]).map(s => {
            const active = status === s;
            const labels: Record<TaskStatus, string> = { PENDING: 'Pending', IN_PROGRESS: 'In Progress', COMPLETED: 'Done' };
            const colors: Record<TaskStatus, string> = { PENDING: Colors.warning, IN_PROGRESS: Colors.info, COMPLETED: Colors.success };
            const bgs: Record<TaskStatus, string> = { PENDING: Colors.warningBg, IN_PROGRESS: Colors.infoBg, COMPLETED: Colors.successBg };
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  active && { backgroundColor: bgs[s], borderColor: colors[s] },
                ]}
                onPress={() => setStatus(s)}
              >
                <Text style={[
                  styles.statusChipText,
                  active && { color: colors[s], fontWeight: '700' },
                ]}>{labels[s]}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Assign to */}
        <Text style={styles.label}>Assign to</Text>
        <TouchableOpacity
          style={styles.selectBtn}
          onPress={() => setShowMembers(!showMembers)}
        >
          <Ionicons name="person-outline" size={18} color={Colors.textMuted} />
          <Text style={[styles.selectBtnText, assignedTo ? { color: Colors.text } : undefined]}>
            {selectedMember ? selectedMember.user.username : 'Select member'}
          </Text>
          <Ionicons name={showMembers ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {showMembers && (
          <View style={styles.memberList}>
            {loadingMembers ? (
              <ActivityIndicator color={Colors.primary} style={{ padding: Spacing.md }} />
            ) : (
              <>
                {assignedTo && (
                  <TouchableOpacity
                    style={styles.memberItem}
                    onPress={() => { setAssignedTo(null); setShowMembers(false); }}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={Colors.textMuted} />
                    <Text style={[styles.memberItemText, { color: Colors.textMuted }]}>Unassign</Text>
                  </TouchableOpacity>
                )}
                {members.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.memberItem, assignedTo === m.user.id && styles.memberItemActive]}
                    onPress={() => { setAssignedTo(m.user.id); setShowMembers(false); }}
                  >
                    <View style={styles.memberDot}>
                      <Text style={styles.memberDotText}>{m.user.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.memberItemText}>{m.user.username}</Text>
                    {assignedTo === m.user.id && (
                      <Ionicons name="checkmark" size={18} color={Colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </View>
        )}

        {/* Due date */}
        <Text style={styles.label}>Due Date</Text>
        <View style={styles.inputWithIcon}>
          <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.inputInner}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            value={dueDate}
            onChangeText={setDueDate}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
        </View>

        {/* Create button */}
        <TouchableOpacity
          style={[styles.createBtn, loading && { opacity: 0.6 }]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={styles.createBtnText}>Create Task</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.xl, paddingBottom: 60 },

  projectLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  projectName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primary, marginBottom: Spacing.xxl },

  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm, marginTop: Spacing.lg },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, height: 48,
    fontSize: FontSize.md, color: Colors.text,
  },
  textArea: { height: 100, paddingTop: Spacing.md },

  statusRow: { flexDirection: 'row', gap: Spacing.sm },
  statusChip: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  statusChipText: { fontSize: FontSize.sm, fontWeight: '500', color: Colors.textSecondary },

  selectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, height: 48,
  },
  selectBtnText: { flex: 1, fontSize: FontSize.md, color: Colors.textMuted },

  memberList: {
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border, marginTop: Spacing.xs,
    maxHeight: 220,
  },
  memberItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  memberItemActive: { backgroundColor: Colors.primaryBg },
  memberDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.chart2, alignItems: 'center', justifyContent: 'center',
  },
  memberDotText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  memberItemText: { flex: 1, fontSize: FontSize.md, color: Colors.text },

  inputWithIcon: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.lg, height: 48,
  },
  inputInner: { flex: 1, fontSize: FontSize.md, color: Colors.text },

  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, backgroundColor: Colors.primary,
    height: 52, borderRadius: Radius.md, marginTop: Spacing.xxxl,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  createBtnText: { color: '#fff', fontSize: FontSize.lg, fontWeight: '700' },
});
