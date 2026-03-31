import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  ActivityIndicator, TouchableOpacity, Alert, Modal,
  TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';

type PermissionItem = { id: number; codename: string; name: string };
type Role = { id: number; name: string; permissions: PermissionItem[] };

export default function RolesScreen() {
  const { access } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermissionItem[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');

  // Add Role modal
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addRoleName, setAddRoleName] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Edit Role modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editRoleName, setEditRoleName] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Permissions modal
  const [permModalVisible, setPermModalVisible] = useState(false);
  const [permRole, setPermRole] = useState<Role | null>(null);
  const [selectedPermIds, setSelectedPermIds] = useState<number[]>([]);
  const [permLoading, setPermLoading] = useState(false);
  const [permSearch, setPermSearch] = useState('');

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [rolesRes, permRes] = await Promise.all([
        createApi(access).get('/api/accounts/roles/'),
        createApi(access).get('/api/accounts/permissions/'),
      ]);
      setRoles(rolesRes.data || []);
      setAllPermissions(permRes.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load roles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  // ─── Add Role ───
  const handleAddRole = async () => {
    if (!addRoleName.trim()) {
      Alert.alert('Error', 'Role name is required.');
      return;
    }
    setAddLoading(true);
    try {
      await createApi(access).post('/api/accounts/roles/', { name: addRoleName.trim() });
      Alert.alert('Success', 'Role added successfully!');
      setAddModalVisible(false);
      setAddRoleName('');
      load();
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        Alert.alert('Error', msgs);
      } else {
        Alert.alert('Error', 'Failed to add role.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Edit Role ───
  const openEditModal = (role: Role) => {
    setEditRole(role);
    setEditRoleName(role.name);
    setEditModalVisible(true);
  };

  const handleEditRole = async () => {
    if (!editRole || !editRoleName.trim()) return;
    setEditLoading(true);
    try {
      await createApi(access).patch(`/api/accounts/roles/${editRole.id}/`, { name: editRoleName.trim() });
      Alert.alert('Success', 'Role updated!');
      setEditModalVisible(false);
      load();
    } catch {
      Alert.alert('Error', 'Failed to update role.');
    } finally {
      setEditLoading(false);
    }
  };

  // ─── Set Permissions ───
  const openPermModal = (role: Role) => {
    setPermRole(role);
    setSelectedPermIds(role.permissions.map(p => p.id));
    setPermSearch('');
    setPermModalVisible(true);
  };

  const togglePerm = (id: number) => {
    setSelectedPermIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSetPermissions = async () => {
    if (!permRole) return;
    setPermLoading(true);
    try {
      await createApi(access).post(
        `/api/accounts/roles/${permRole.id}/set_permissions/`,
        { permissions: selectedPermIds }
      );
      Alert.alert('Success', 'Permissions updated!');
      setPermModalVisible(false);
      load();
    } catch {
      Alert.alert('Error', 'Failed to update permissions.');
    } finally {
      setPermLoading(false);
    }
  };

  // ─── Delete Role ───
  const handleDeleteRole = (role: Role) => {
    Alert.alert(
      'Delete Role',
      `Are you sure you want to delete "${role.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await createApi(access).delete(`/api/accounts/roles/${role.id}/`);
              Alert.alert('Deleted', 'Role has been deleted.');
              load();
            } catch (err: any) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete role.');
            }
          }
        },
      ]
    );
  };

  // ─── Filtered ───
  const filteredRoles = filter.trim()
    ? roles.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()))
    : roles;

  const filteredPerms = permSearch.trim()
    ? allPermissions.filter(p =>
        p.name.toLowerCase().includes(permSearch.toLowerCase()) ||
        p.codename.toLowerCase().includes(permSearch.toLowerCase())
      )
    : allPermissions;

  const ROLE_COLORS: Record<string, string> = {
    Admin: '#EF4444', Manager: '#F97316', Developer: '#3B82F6', Designer: '#8B5CF6',
  };

  const renderRole = ({ item }: { item: Role }) => {
    const isOpen = expanded === item.id;
    const color = ROLE_COLORS[item.name] || Colors.chart2;
    return (
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.roleHeader}
          activeOpacity={0.7}
          onPress={() => setExpanded(isOpen ? null : item.id)}
        >
          <View style={[styles.roleIcon, { backgroundColor: color + '20' }]}>
            <Ionicons name="shield-checkmark" size={20} color={color} />
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleName}>{item.name}</Text>
            <Text style={styles.permCount}>{item.permissions.length} permissions</Text>
          </View>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Expanded permissions */}
        {isOpen && (
          <View style={styles.permList}>
            {item.permissions.length === 0 ? (
              <Text style={styles.noPerm}>No permissions assigned</Text>
            ) : (
              item.permissions.map(p => (
                <View key={p.id} style={styles.permItem}>
                  <Ionicons name="key-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.permName}>{p.name}</Text>
                </View>
              ))
            )}

            {/* Action bar inside expanded card */}
            <View style={styles.cardActions}>
              <TouchableOpacity style={styles.cardActionBtn} onPress={() => openEditModal(item)}>
                <Ionicons name="create-outline" size={16} color={Colors.info} />
                <Text style={[styles.cardActionText, { color: Colors.info }]}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardActionBtn} onPress={() => openPermModal(item)}>
                <Ionicons name="key-outline" size={16} color={Colors.chart3} />
                <Text style={[styles.cardActionText, { color: Colors.chart3 }]}>Permissions</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleDeleteRole(item)}>
                <Ionicons name="trash-outline" size={16} color={Colors.error} />
                <Text style={[styles.cardActionText, { color: Colors.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter roles..."
            placeholderTextColor={Colors.textMuted}
            value={filter}
            onChangeText={setFilter}
            autoCapitalize="none"
          />
          {filter.length > 0 && (
            <TouchableOpacity onPress={() => setFilter('')}>
              <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>
        Showing {filteredRoles.length} of {roles.length} role(s)
      </Text>

      {/* Role list */}
      <FlatList
        data={filteredRoles}
        renderItem={renderRole}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="shield-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No roles found</Text>
          </View>
        }
      />

      {/* ═══ Add Role Modal ═══ */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Role</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Role Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Enter role name..."
              placeholderTextColor={Colors.textMuted}
              value={addRoleName}
              onChangeText={setAddRoleName}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, addLoading && { opacity: 0.6 }]}
              onPress={handleAddRole}
              disabled={addLoading}
              activeOpacity={0.8}
            >
              {addLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>Add Role</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Edit Role Modal ═══ */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Role</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.fieldLabel}>Role Name</Text>
            <TextInput
              style={styles.fieldInput}
              placeholder="Role name..."
              placeholderTextColor={Colors.textMuted}
              value={editRoleName}
              onChangeText={setEditRoleName}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.primaryBtn, editLoading && { opacity: 0.6 }]}
              onPress={handleEditRole}
              disabled={editLoading}
              activeOpacity={0.8}
            >
              {editLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Permissions Modal ═══ */}
      <Modal visible={permModalVisible} transparent animationType="slide" onRequestClose={() => setPermModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Permissions</Text>
                <Text style={styles.modalSubtitle}>
                  Set permissions for {permRole?.name}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPermModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Permission search */}
            <View style={styles.permSearchWrap}>
              <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.permSearchInput}
                placeholder="Search permissions..."
                placeholderTextColor={Colors.textMuted}
                value={permSearch}
                onChangeText={setPermSearch}
                autoCapitalize="none"
              />
              {permSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPermSearch('')}>
                  <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.selectedCountText}>
              {selectedPermIds.length} selected of {allPermissions.length} permissions
            </Text>

            {allPermissions.length === 0 ? (
              <Text style={styles.noPermsText}>No permissions available</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredPerms.map(p => {
                  const selected = selectedPermIds.includes(p.id);
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.permOption, selected && styles.permOptionSelected]}
                      onPress={() => togglePerm(p.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={selected ? Colors.primary : Colors.textMuted}
                      />
                      <View style={styles.permOptionInfo}>
                        <Text style={[styles.permOptionName, selected && { color: Colors.primary, fontWeight: '600' }]}>
                          {p.name}
                        </Text>
                        <Text style={styles.permOptionCode}>{p.codename}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, permLoading && { opacity: 0.6 }]}
              onPress={handleSetPermissions}
              disabled={permLoading}
              activeOpacity={0.8}
            >
              {permLoading ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.primaryBtnText}>Save Permissions</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

  // Header bar
  headerBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs,
  },
  searchWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, height: 42,
    borderWidth: 1, borderColor: Colors.border,
  },
  searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: FontSize.md, color: Colors.text },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg,
    height: 42, borderRadius: Radius.md,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  countText: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
    fontSize: FontSize.xs, color: Colors.textMuted,
  },

  // Role card
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    marginBottom: Spacing.md, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  roleHeader: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg,
  },
  roleIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  roleInfo: { flex: 1, marginLeft: Spacing.md },
  roleName: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  permCount: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  permList: {
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    paddingTop: Spacing.md,
  },
  permItem: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  permName: { fontSize: FontSize.sm, color: Colors.textSecondary },
  noPerm: { fontSize: FontSize.sm, color: Colors.textMuted, fontStyle: 'italic' },

  // Card action buttons
  cardActions: {
    flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.md,
    paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  cardActionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: Spacing.xs, paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm, backgroundColor: Colors.surfaceAlt,
  },
  cardActionText: { fontSize: FontSize.xs, fontWeight: '600' },

  // Empty state
  emptyWrap: { alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: FontSize.md, color: Colors.textMuted, marginTop: Spacing.md },

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

  // Form fields
  fieldLabel: {
    fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs,
  },
  fieldInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    fontSize: FontSize.md, color: Colors.text,
    borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.md,
  },

  // Primary button
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },

  // Permissions modal
  permSearchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md, height: 38, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.border,
  },
  permSearchInput: { flex: 1, marginLeft: Spacing.xs, fontSize: FontSize.sm, color: Colors.text },
  selectedCountText: {
    fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: Spacing.sm,
  },
  noPermsText: { color: Colors.textMuted, fontSize: FontSize.md, textAlign: 'center', paddingVertical: Spacing.xl },
  permOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.xs,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  permOptionSelected: { backgroundColor: Colors.primaryBg, borderRadius: Radius.sm },
  permOptionInfo: { flex: 1 },
  permOptionName: { fontSize: FontSize.sm, color: Colors.text },
  permOptionCode: { fontSize: FontSize.xs, color: Colors.textMuted },
});
