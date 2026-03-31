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

type UserItem = {
  id: number;
  username: string;
  email: string;
  roles: string[];
};

type RoleItem = {
  id: number;
  name: string;
};

export default function UsersScreen() {
  const { access } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('');

  // Add User modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', email: '', password: '', cPassword: '' });
  const [showPass, setShowPass] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Assign Role modal state
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [roleUser, setRoleUser] = useState<UserItem | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);

  const load = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        createApi(access).get('/api/accounts/users/'),
        createApi(access).get('/api/accounts/roles/'),
      ]);
      setUsers(usersRes.data || []);
      setRoles(rolesRes.data || []);
    } catch {
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, [access]));

  // ─── Add User ───
  const handleAddUser = async () => {
    const { name, email, password, cPassword } = addForm;
    if (!name.trim() || !email.trim() || !password || !cPassword) {
      Alert.alert('Error', 'All fields are required.');
      return;
    }
    if (password !== cPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setAddLoading(true);
    try {
      await createApi(access).post('/api/accounts/users/', {
        username: name.trim(),
        email: email.trim(),
        password,
      });
      Alert.alert('Success', 'User has been created!');
      setAddModalVisible(false);
      setAddForm({ name: '', email: '', password: '', cPassword: '' });
      load();
    } catch (err: any) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const msgs = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
        Alert.alert('Error', msgs);
      } else {
        Alert.alert('Error', 'Failed to create user.');
      }
    } finally {
      setAddLoading(false);
    }
  };

  // ─── Assign Role ───
  const openRoleModal = (user: UserItem) => {
    setRoleUser(user);
    // Pre-select roles already assigned to user
    const userRoleIds = roles.filter(r => user.roles.includes(r.name)).map(r => r.id);
    setSelectedRoleIds(userRoleIds);
    setRoleModalVisible(true);
  };

  const toggleRole = (roleId: number) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId]
    );
  };

  const handleAssignRoles = async () => {
    if (!roleUser) return;
    setRoleLoading(true);
    try {
      await createApi(access).post(`/api/accounts/users/${roleUser.id}/assign_role/`, {
        roles: selectedRoleIds.map(String),
      });
      Alert.alert('Success', `Roles updated for ${roleUser.username}`);
      setRoleModalVisible(false);
      load();
    } catch (err: any) {
      const data = err.response?.data;
      Alert.alert('Error', data?.error || 'Failed to assign roles.');
    } finally {
      setRoleLoading(false);
    }
  };

  // ─── Delete User ───
  const handleDeleteUser = (user: UserItem) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete "${user.username}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await createApi(access).delete(`/api/accounts/users/${user.id}/`);
              Alert.alert('Deleted', 'User has been deleted.');
              load();
            } catch (err: any) {
              const data = err.response?.data;
              Alert.alert('Error', data?.error || 'Failed to delete user.');
            }
          }
        },
      ]
    );
  };

  // ─── Filtered list ───
  const filteredUsers = filter.trim()
    ? users.filter(u =>
        u.username.toLowerCase().includes(filter.toLowerCase()) ||
        u.email.toLowerCase().includes(filter.toLowerCase())
      )
    : users;

  const COLORS = ['#6366F1', '#06B6D4', '#F97316', '#EC4899', '#22C55E', '#8B5CF6'];

  const renderUser = ({ item }: { item: UserItem }) => {
    const color = COLORS[item.id % COLORS.length];
    return (
      <View style={styles.card}>
        <View style={[styles.avatar, { backgroundColor: color }]}>
          <Text style={styles.avatarText}>{item.username.slice(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{item.username}</Text>
          <Text style={styles.email}>{item.email}</Text>
          {item.roles?.length > 0 && (
            <View style={styles.rolesRow}>
              {item.roles.map((r, i) => (
                <View key={i} style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{r}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openRoleModal(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.deleteBtn]}
            onPress={() => handleDeleteUser(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      {/* Header bar with filter + add button */}
      <View style={styles.headerBar}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter users..."
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
          <Ionicons name="person-add" size={18} color="#fff" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Count */}
      <Text style={styles.countText}>
        Showing {filteredUsers.length} of {users.length} user(s)
      </Text>

      {/* User list */}
      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} colors={[Colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="people-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />

      {/* ═══ Add User Modal ═══ */}
      <Modal visible={addModalVisible} transparent animationType="slide" onRequestClose={() => setAddModalVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add User</Text>
              <TouchableOpacity onPress={() => setAddModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Name */}
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="username..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                value={addForm.name}
                onChangeText={t => setAddForm(p => ({ ...p, name: t }))}
              />
              {/* Email */}
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.fieldInput}
                placeholder="email..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={addForm.email}
                onChangeText={t => setAddForm(p => ({ ...p, email: t }))}
              />
              {/* Password */}
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.passWrap}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="password..."
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPass}
                  value={addForm.password}
                  onChangeText={t => setAddForm(p => ({ ...p, password: t }))}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {/* Confirm Password */}
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View style={styles.passWrap}>
                <TextInput
                  style={[styles.fieldInput, { flex: 1, marginBottom: 0 }]}
                  placeholder="confirm password..."
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPass}
                  value={addForm.cPassword}
                  onChangeText={t => setAddForm(p => ({ ...p, cPassword: t }))}
                />
                <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                  <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Create button */}
              <TouchableOpacity
                style={[styles.primaryBtn, addLoading && { opacity: 0.6 }]}
                onPress={handleAddUser}
                disabled={addLoading}
                activeOpacity={0.8}
              >
                {addLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Create</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Assign Role Modal ═══ */}
      <Modal visible={roleModalVisible} transparent animationType="slide" onRequestClose={() => setRoleModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Assign Role</Text>
                <Text style={styles.modalSubtitle}>
                  Assign roles to {roleUser?.username}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {roles.length === 0 ? (
              <Text style={styles.noRolesText}>No roles available</Text>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                {roles.map(role => {
                  const selected = selectedRoleIds.includes(role.id);
                  return (
                    <TouchableOpacity
                      key={role.id}
                      style={[styles.roleOption, selected && styles.roleOptionSelected]}
                      onPress={() => toggleRole(role.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={selected ? Colors.primary : Colors.textMuted}
                      />
                      <Text style={[styles.roleOptionText, selected && { color: Colors.primary, fontWeight: '600' }]}>
                        {role.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, roleLoading && { opacity: 0.6 }]}
              onPress={handleAssignRoles}
              disabled={roleLoading}
              activeOpacity={0.8}
            >
              {roleLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Save Roles</Text>
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
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg,
    height: 42, borderRadius: Radius.md,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.sm },
  countText: {
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs,
    fontSize: FontSize.xs, color: Colors.textMuted,
  },

  // User card
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    padding: Spacing.lg, marginBottom: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.md },
  info: { flex: 1, marginLeft: Spacing.md },
  name: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  email: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  rolesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: Spacing.xs },
  roleBadge: {
    backgroundColor: Colors.primaryBg, paddingHorizontal: Spacing.sm,
    paddingVertical: 2, borderRadius: Radius.full,
  },
  roleBadgeText: { fontSize: 10, fontWeight: '600', color: Colors.primary },

  // Action buttons on card
  actions: { flexDirection: 'column', gap: Spacing.xs, marginLeft: Spacing.sm },
  actionBtn: {
    width: 36, height: 36, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primaryBg,
  },
  deleteBtn: { backgroundColor: Colors.errorBg },

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
    maxHeight: '85%',
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
  passWrap: {
    flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md,
  },
  eyeBtn: { padding: Spacing.md, marginLeft: -44 },

  // Primary button
  primaryBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center',
    marginTop: Spacing.md,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },

  // Role select
  noRolesText: { color: Colors.textMuted, fontSize: FontSize.md, textAlign: 'center', paddingVertical: Spacing.xl },
  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  roleOptionSelected: { backgroundColor: Colors.primaryBg, borderRadius: Radius.sm },
  roleOptionText: { fontSize: FontSize.md, color: Colors.text },
});
