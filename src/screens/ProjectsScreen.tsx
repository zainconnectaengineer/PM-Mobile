import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, ActivityIndicator, Image, Modal,
  TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';
import type { Project } from '../types';

const GRADIENTS = ['#6366F1', '#06B6D4', '#F97316', '#EC4899', '#22C55E'];
const getColor = (name: string) => GRADIENTS[(name?.charCodeAt(0) || 0) % GRADIENTS.length];

export default function ProjectsScreen({ navigation }: any) {
  const { access } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Create project modal
  const [createVisible, setCreateVisible] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', due_date: '' });
  const [createLoading, setCreateLoading] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const api = createApi(access);
      const res = await api.get('/api/pm/projects/');
      const data = res.data as Project[];

      // load members for each project
      await Promise.all(data.map(async (p) => {
        try {
          const memRes = await api.get(`/api/pm/projects/${p.id}/employees/`);
          p.members = memRes.data?.results ?? [];
        } catch { p.members = []; }
      }));

      setProjects(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  // ─── Create Project ───
  const handleCreateProject = async () => {
    if (!createForm.name.trim()) {
      Alert.alert('Error', 'Project title is required.');
      return;
    }
    setCreateLoading(true);
    try {
      const body: any = { name: createForm.name.trim(), description: createForm.description.trim() };
      if (createForm.due_date.trim()) body.due_date = createForm.due_date.trim();
      await createApi(access).post('/api/pm/projects/', body);
      Alert.alert('Success', 'Project created!');
      setCreateVisible(false);
      setCreateForm({ name: '', description: '', due_date: '' });
      load();
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        Alert.alert('Error', msgs);
      } else {
        Alert.alert('Error', 'Failed to create project.');
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const renderProject = ({ item }: { item: Project }) => {
    const color = getColor(item.name);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id, projectName: item.name })}
      >
        <View style={[styles.cardBanner, { backgroundColor: color }]}>
          <Text style={styles.cardBannerText}>{item.name?.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardDesc} numberOfLines={2}>{item.description || 'No description'}</Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.metaText}>{item.members?.length || 0} members</Text>
            </View>
            {item.due_date && (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
                <Text style={styles.metaText}>{new Date(item.due_date).toLocaleDateString()}</Text>
              </View>
            )}
          </View>

          {/* Member avatars */}
          {item.members?.length > 0 && (
            <View style={styles.avatarRow}>
              {item.members.slice(0, 4).map((m, i) => (
                <View key={m.id} style={[styles.avatarSmall, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i }]}>
                  <Text style={styles.avatarSmallText}>{m.user.username.slice(0, 1).toUpperCase()}</Text>
                </View>
              ))}
              {item.members.length > 4 && (
                <View style={[styles.avatarSmall, styles.avatarMore, { marginLeft: -8 }]}>
                  <Text style={styles.avatarMoreText}>+{item.members.length - 4}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* New Project FAB */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => setCreateVisible(true)}
      >
        <Ionicons name="add" size={24} color="#fff" />
      </TouchableOpacity>

      <FlatList
        data={projects}
        renderItem={renderProject}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="folder-open-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No projects yet</Text>
          </View>
        }
      />

      {/* ═══ Create Project Modal ═══ */}
      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>New Project</Text>
                <Text style={styles.modalSubtitle}>Create a new project/workspace.</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="Project title..."
                placeholderTextColor={Colors.textMuted}
                value={createForm.name}
                onChangeText={t => setCreateForm(p => ({ ...p, name: t }))}
              />
              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Project description..."
                placeholderTextColor={Colors.textMuted}
                multiline
                value={createForm.description}
                onChangeText={t => setCreateForm(p => ({ ...p, description: t }))}
              />
              <Text style={styles.fieldLabel}>Due Date (optional)</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
                value={createForm.due_date}
                onChangeText={t => setCreateForm(p => ({ ...p, due_date: t }))}
                keyboardType="numbers-and-punctuation"
              />
              <TouchableOpacity
                style={[styles.primaryBtn, createLoading && { opacity: 0.6 }]}
                onPress={handleCreateProject}
                disabled={createLoading}
                activeOpacity={0.8}
              >
                {createLoading ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.primaryBtnText}>Create Project</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  list: { padding: Spacing.lg, paddingBottom: 100 },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    marginBottom: Spacing.lg, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardBanner: {
    height: 80, alignItems: 'center', justifyContent: 'center',
  },
  cardBannerText: { fontSize: FontSize.display, fontWeight: '800', color: 'rgba(255,255,255,0.3)' },
  cardBody: { padding: Spacing.lg },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 20 },
  cardMeta: { flexDirection: 'row', marginTop: Spacing.md, gap: Spacing.lg },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSize.xs, color: Colors.textMuted },
  avatarRow: { flexDirection: 'row', marginTop: Spacing.md },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarSmallText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  avatarMore: { backgroundColor: Colors.surfaceAlt },
  avatarMoreText: { fontSize: 9, fontWeight: '700', color: Colors.textSecondary },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 100 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },

  // FAB
  fab: {
    position: 'absolute', bottom: 90, right: 20, zIndex: 10,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8,
  },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xl, width: '100%', maxWidth: 400, maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalSubtitle: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
});
