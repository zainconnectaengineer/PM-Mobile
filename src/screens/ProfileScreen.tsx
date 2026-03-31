import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { createApi } from '../services/api';

export default function ProfileScreen() {
  const { user, access, logout } = useAuth();
  const [showChangePass, setShowChangePass] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPass) { Alert.alert('Error', 'Enter current password.'); return; }
    if (newPass.length < 8) { Alert.alert('Error', 'New password must be at least 8 characters.'); return; }
    if (newPass !== confirmPass) { Alert.alert('Error', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      await createApi(access).post('/api/accounts/password/change/', {
        current_password: currentPass,
        new_password: newPass,
        confirm_password: confirmPass,
      });
      Alert.alert('Success', 'Password changed successfully!');
      setShowChangePass(false);
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (e: any) {
      const d = e.response?.data;
      Alert.alert('Error', d?.current_password || d?.new_password?.[0] || 'Failed to change password.');
    } finally { setLoading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar + Info */}
      <View style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{user?.username?.slice(0, 2).toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.userName}>{user?.username}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
        {user?.roles?.length ? (
          <View style={styles.roleBadge}>
            <Ionicons name="shield-checkmark-outline" size={14} color={Colors.primary} />
            <Text style={styles.roleText}>{user.roles[0]}</Text>
          </View>
        ) : null}
      </View>

      {/* Menu items */}
      <View style={styles.menuCard}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setShowChangePass(!showChangePass)}>
          <View style={[styles.menuIconWrap, { backgroundColor: Colors.infoBg }]}>
            <Ionicons name="key-outline" size={18} color={Colors.info} />
          </View>
          <Text style={styles.menuLabel}>Change Password</Text>
          <Ionicons name={showChangePass ? 'chevron-up' : 'chevron-forward'} size={18} color={Colors.textMuted} />
        </TouchableOpacity>

        {showChangePass && (
          <View style={styles.changePassForm}>
            <TextInput
              style={styles.passInput} placeholder="Current password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry value={currentPass} onChangeText={setCurrentPass}
            />
            <TextInput
              style={styles.passInput} placeholder="New password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry value={newPass} onChangeText={setNewPass}
            />
            <TextInput
              style={styles.passInput} placeholder="Confirm new password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry value={confirmPass} onChangeText={setConfirmPass}
            />
            <TouchableOpacity
              style={[styles.changeBtn, loading && { opacity: 0.6 }]}
              onPress={handleChangePassword} disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.changeBtnText}>Update Password</Text>}
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.menuDivider} />

        <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
          <View style={[styles.menuIconWrap, { backgroundColor: Colors.errorBg }]}>
            <Ionicons name="log-out-outline" size={18} color={Colors.error} />
          </View>
          <Text style={[styles.menuLabel, { color: Colors.error }]}>Logout</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.error} />
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Connecta AI v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: 100 },
  profileCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xxl, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    marginBottom: Spacing.xl,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: FontSize.xxl },
  userName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  userEmail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: Spacing.xs },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: Spacing.md, backgroundColor: Colors.primaryBg,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: Radius.full,
  },
  roleText: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.primary },
  menuCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md,
  },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  menuLabel: { flex: 1, fontSize: FontSize.md, fontWeight: '500', color: Colors.text },
  menuDivider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.lg },
  changePassForm: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
  passInput: {
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 44,
    fontSize: FontSize.md, color: Colors.text, marginBottom: Spacing.sm,
  },
  changeBtn: {
    backgroundColor: Colors.primary, height: 44, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs,
  },
  changeBtnText: { color: '#fff', fontWeight: '700', fontSize: FontSize.md },
  version: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.xxl },
});
