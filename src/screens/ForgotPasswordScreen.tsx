import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize } from '../constants/theme';
import axios, { type AxiosError } from 'axios';
import { API_BASE_URL } from '../services/api';

type Step = 'email' | 'otp' | 'reset';

export default function ForgotPasswordScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Please enter your email.'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/accounts/password/forgot/`, { email: email.trim() });
      Alert.alert('Success', 'OTP sent to your email.');
      setStep('otp');
    } catch (error) {
      const err = error as AxiosError<any>;
      const d = err.response?.data;
      Alert.alert('Error', d?.email?.[0] || d?.error || 'Failed to send OTP.');
    } finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) { Alert.alert('Error', 'OTP must be 6 digits.'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/accounts/password/verify-otp/`, { email, otp });
      Alert.alert('Success', 'OTP verified.');
      setStep('reset');
    } catch (error) {
      const err = error as AxiosError<any>;
      Alert.alert('Error', err.response?.data?.error || 'Invalid OTP.');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters.'); return; }
    if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/accounts/password/reset/`, {
        email, otp, new_password: newPassword, confirm_password: confirmPassword,
      });
      Alert.alert('Success', 'Password reset successfully!', [
        { text: 'Login', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      const err = error as AxiosError<any>;
      const d = err.response?.data;
      Alert.alert('Error', d?.error || d?.new_password?.[0] || 'Failed to reset password.');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    setLoading(true);
    try {
      await axios.post(`${API_BASE_URL}/api/accounts/password/forgot/`, { email });
      Alert.alert('Success', 'New OTP sent.');
      setOtp('');
    } catch (error) {
      const err = error as AxiosError<any>;
      Alert.alert('Error', err.response?.data?.error || 'Failed to resend.');
    } finally { setLoading(false); }
  };

  const titles: Record<Step, string> = { email: 'Forgot Password', otp: 'Verify OTP', reset: 'New Password' };
  const descriptions: Record<Step, string> = {
    email: 'Enter your email and we\'ll send a 6-digit OTP.',
    otp: `We sent a code to ${email}`,
    reset: 'Choose a new password for your account.',
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 'otp') { setStep('email'); setOtp(''); }
          else if (step === 'reset') { setStep('otp'); }
          else navigation.goBack();
        }}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>

        {/* Step indicator */}
        <View style={styles.stepsRow}>
          {(['email', 'otp', 'reset'] as Step[]).map((s, i) => (
            <View key={s} style={styles.stepItem}>
              <View style={[styles.stepDot,
                step === s && styles.stepDotActive,
                (['email', 'otp', 'reset'].indexOf(step) > i) && styles.stepDotDone
              ]}>
                {(['email', 'otp', 'reset'].indexOf(step) > i) ? (
                  <Ionicons name="checkmark" size={14} color={Colors.textInverse} />
                ) : (
                  <Text style={[styles.stepNum, step === s && styles.stepNumActive]}>
                    {i + 1}
                  </Text>
                )}
              </View>
              {i < 2 && <View style={[styles.stepLine, (['email', 'otp', 'reset'].indexOf(step) > i) && styles.stepLineDone]} />}
            </View>
          ))}
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>{titles[step]}</Text>
          <Text style={styles.desc}>{descriptions[step]}</Text>

          {step === 'email' && (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="Enter your email"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address" autoCapitalize="none"
                  value={email} onChangeText={setEmail}
                />
              </View>
              <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleSendOtp} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send OTP</Text>}
              </TouchableOpacity>
            </>
          )}

          {step === 'otp' && (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="key-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="000000"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad" maxLength={6}
                  value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, ''))}
                />
              </View>
              <TouchableOpacity style={[styles.btn, (loading || otp.length !== 6) && styles.btnDisabled]}
                onPress={handleVerifyOtp} disabled={loading || otp.length !== 6}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verify OTP</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={loading}>
                <Text style={styles.resendText}>Resend OTP</Text>
              </TouchableOpacity>
            </>
          )}

          {step === 'reset' && (
            <>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="New password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry value={newPassword} onChangeText={setNewPassword}
                />
              </View>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input} placeholder="Confirm password"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword}
                />
              </View>
              <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleResetPassword} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Reset Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, padding: Spacing.xl, paddingTop: 60 },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  stepsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xxxl },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceAlt, borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  stepDotActive: { borderColor: Colors.primary, backgroundColor: Colors.primaryBg },
  stepDotDone: { borderColor: Colors.success, backgroundColor: Colors.success },
  stepNum: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.textMuted },
  stepNumActive: { color: Colors.primary },
  stepLine: { width: 40, height: 2, backgroundColor: Colors.border, marginHorizontal: Spacing.xs },
  stepLineDone: { backgroundColor: Colors.success },
  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    padding: Spacing.xxl,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 4,
  },
  title: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, textAlign: 'center' },
  desc: { fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.xxl, lineHeight: 20 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceAlt, borderRadius: Radius.sm,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, height: 48, marginBottom: Spacing.lg,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.md, color: Colors.text },
  otpInput: { textAlign: 'center', letterSpacing: 8, fontSize: FontSize.xl, fontWeight: '700' },
  btn: {
    backgroundColor: Colors.primary, height: 50, borderRadius: Radius.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: Colors.textInverse, fontSize: FontSize.lg, fontWeight: '700' },
  resendBtn: { alignItems: 'center', marginTop: Spacing.lg },
  resendText: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '500' },
});
