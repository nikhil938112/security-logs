// ─── screens/LoginScreen.js ───────────────────────────────────────────────────
// Secure login screen with JWT authentication.
// Dark cybersecurity aesthetic with animated elements.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { authAPI, saveToken } from '../services/api';

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:        '#0A0E1A',
  surface:   '#111827',
  border:    '#1F2A3D',
  accent:    '#00D4FF',
  accentDim: '#00D4FF22',
  danger:    '#FF4560',
  text:      '#E2E8F0',
  textMuted: '#64748B',
  success:   '#00E396',
};

// ── Animated scan line ────────────────────────────────────────────────────────
const ScanLine = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 2200, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute', left: 0, right: 0, height: 1,
        backgroundColor: T.accent, opacity: 0.3,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 280] }) }],
      }}
    />
  );
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [errors, setErrors]     = useState({});

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  const validate = () => {
    const e = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = 'Enter a valid email';
    if (!password) e.password = 'Password is required';
    else if (password.length < 6) e.password = 'Password too short';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.login(email.trim().toLowerCase(), password);
      await saveToken(res.token);
      // Navigate replaces the stack — user can't go back to login
      navigation.replace('Main');
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Invalid credentials.', [{ text: 'OK' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Header ── */}
        <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoContainer}>
            <ScanLine />
            <Text style={styles.logoSymbol}>⬡</Text>
            <Text style={styles.logoText}>SECURE<Text style={{ color: T.accent }}>WATCH</Text></Text>
            <Text style={styles.logoSub}>Security Operations Center</Text>
          </View>

          {/* Status badges */}
          <View style={styles.statusRow}>
            {['MONITORING', 'PROTECTED', 'v1.0'].map((label) => (
              <View key={label} style={styles.badge}>
                <View style={[styles.dot, { backgroundColor: T.success }]} />
                <Text style={styles.badgeText}>{label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* ── Form card ── */}
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Text style={styles.cardTitle}>Operator Login</Text>
          <Text style={styles.cardSub}>Authorised personnel only</Text>

          {/* Email */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={[styles.inputWrap, errors.email && styles.inputError]}>
              <Text style={styles.inputIcon}>✉</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
                placeholder="analyst@company.com"
                placeholderTextColor={T.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            {!!errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
          </View>

          {/* Password */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>PASSWORD</Text>
            <View style={[styles.inputWrap, errors.password && styles.inputError]}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
                placeholder="Enter your password"
                placeholderTextColor={T.textMuted}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
            {!!errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={T.bg} />
            ) : (
              <Text style={styles.loginBtnText}>AUTHENTICATE →</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerLinkText}>
              No account?{' '}
              <Text style={{ color: T.accent }}>Request Access</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* ── Footer ── */}
        <Text style={styles.footer}>
          🔐 All sessions are encrypted and logged
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: T.bg },
  scroll:        { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header:        { alignItems: 'center', marginBottom: 32 },
  logoContainer: {
    width: '100%', alignItems: 'center', paddingVertical: 24,
    borderWidth: 1, borderColor: T.border, borderRadius: 12,
    backgroundColor: T.surface, overflow: 'hidden', marginBottom: 16,
  },
  logoSymbol:    { fontSize: 36, color: T.accent, marginBottom: 8 },
  logoText:      { fontSize: 28, fontWeight: '800', color: T.text, letterSpacing: 4 },
  logoSub:       { fontSize: 11, color: T.textMuted, letterSpacing: 3, marginTop: 4 },
  statusRow:     { flexDirection: 'row', gap: 8 },
  badge:         {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: T.surface, borderRadius: 20,
    borderWidth: 1, borderColor: T.border,
  },
  dot:           { width: 6, height: 6, borderRadius: 3 },
  badgeText:     { fontSize: 10, color: T.textMuted, fontWeight: '600', letterSpacing: 1 },
  card:          {
    backgroundColor: T.surface, borderRadius: 16,
    borderWidth: 1, borderColor: T.border, padding: 24,
  },
  cardTitle:     { fontSize: 22, fontWeight: '700', color: T.text, marginBottom: 4 },
  cardSub:       { fontSize: 13, color: T.textMuted, marginBottom: 24 },
  fieldGroup:    { marginBottom: 16 },
  label:         { fontSize: 10, fontWeight: '700', color: T.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  inputWrap:     {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: T.bg, borderRadius: 10,
    borderWidth: 1, borderColor: T.border,
    paddingHorizontal: 14, height: 52,
  },
  inputError:    { borderColor: T.danger },
  inputIcon:     { fontSize: 16, marginRight: 10 },
  input:         { flex: 1, color: T.text, fontSize: 15 },
  eyeBtn:        { padding: 4 },
  eyeIcon:       { fontSize: 16 },
  errorText:     { color: T.danger, fontSize: 12, marginTop: 4 },
  loginBtn:      {
    backgroundColor: T.accent, borderRadius: 10, height: 52,
    justifyContent: 'center', alignItems: 'center', marginTop: 8,
  },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText:  { color: T.bg, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  registerLink:  { alignItems: 'center', marginTop: 16 },
  registerLinkText: { color: T.textMuted, fontSize: 14 },
  footer:        { textAlign: 'center', color: T.textMuted, fontSize: 11, marginTop: 24 },
});
