import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import axios, { type AxiosError } from 'axios';
import { API_BASE_URL } from '../services/api';

export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both username and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/accounts/token/`, {
        username: username.trim(),
        password,
      });
      await login({
        access: res.data.access,
        refresh: res.data.refresh,
        user: res.data.user,
      });
    } catch (error) {
      const err = error as AxiosError<any>;
      const data = err.response?.data;
      if (data?.detail) Alert.alert('Login Failed', data.detail);
      else if (data?.username) Alert.alert('Error', `Username: ${data.username}`);
      else if (data?.password) Alert.alert('Error', `Password: ${data.password}`);
      else Alert.alert('Error', 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <Ionicons name="rocket" size={36} color={Colors.textInverse} />
          </View>
          <Text style={styles.brandName}>Connecta AI</Text>
          <Text style={styles.brandSub}>PROJECT PORTAL</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Welcome Back</Text>
          <Text style={styles.cardDesc}>
            Login to your account and manage your projects on the go.
          </Text>

          {/* Username */}
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Enter your username"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              placeholder="Enter your password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry={!showPass}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
              <Ionicons name={showPass ? 'eye-outline' : 'eye-off-outline'} size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Forgot Password */}
          <TouchableOpacity
            onPress={() => navigation.navigate('ForgotPassword')}
            style={styles.forgotRow}
          >
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={Colors.textInverse} />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>© 2026 Connecta</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  header: { alignItems: 'center', marginBottom: Spacing.xxxl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  brandName: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.primary },
  brandSub: { fontSize: FontSize.xs, color: Colors.textMuted, letterSpacing: 2, marginTop: 2 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xxl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 4,
  },
  cardTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  cardDesc: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xxl,
    lineHeight: 20,
  },
  label: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.sm, borderWidth: 1, borderColor: Colors.border,
    marginBottom: Spacing.lg, paddingHorizontal: Spacing.md,
    height: 48,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  eyeBtn: { padding: Spacing.xs },
  forgotRow: { alignItems: 'flex-end', marginBottom: Spacing.xl },
  forgotText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '500' },
  loginBtn: {
    backgroundColor: Colors.primary,
    height: 50, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  loginBtnDisabled: { opacity: 0.7 },
  loginBtnText: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: '700' },
  footer: { textAlign: 'center', color: Colors.textMuted, fontSize: FontSize.xs, marginTop: Spacing.xxl },
});
