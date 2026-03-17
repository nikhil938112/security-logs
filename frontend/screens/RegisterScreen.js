// ─── screens/RegisterScreen.js ───────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Animated, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { authAPI, saveToken } from '../services/api';

const T = {
  bg: '#0A0E1A', surface: '#111827', border: '#1F2A3D',
  accent: '#00D4FF', text: '#E2E8F0', textMuted: '#64748B',
  danger: '#FF4560', success: '#00E396',
};

export default function RegisterScreen({ navigation }) {
  const [form, setForm]     = useState({ username: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.username.trim() || form.username.length < 3) e.username = 'At least 3 characters';
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Enter a valid email';
    if (form.password.length < 8) e.password = 'Minimum 8 characters';
    if (form.password !== form.confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await authAPI.register(form.username.trim(), form.email.trim().toLowerCase(), form.password);
      await saveToken(res.token);
      navigation.replace('Main');
    } catch (err) {
      Alert.alert('Registration Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { key: 'username', label: 'USERNAME', placeholder: 'analyst_01', icon: '👤', autoCapitalize: 'none' },
    { key: 'email',    label: 'EMAIL',    placeholder: 'you@company.com', icon: '✉', keyboardType: 'email-address', autoCapitalize: 'none' },
    { key: 'password', label: 'PASSWORD', placeholder: 'Min. 8 characters', icon: '🔒', secure: true },
    { key: 'confirm',  label: 'CONFIRM PASSWORD', placeholder: 'Repeat password', icon: '🔑', secure: true },
  ];

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Header */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Request Access</Text>
          <Text style={styles.sub}>Create your SOC analyst account</Text>

          {/* Fields */}
          <View style={styles.card}>
            {fields.map(f => (
              <View key={f.key} style={styles.fieldGroup}>
                <Text style={styles.label}>{f.label}</Text>
                <View style={[styles.inputWrap, errors[f.key] && styles.inputError]}>
                  <Text style={styles.inputIcon}>{f.icon}</Text>
                  <TextInput
                    style={styles.input}
                    value={form[f.key]}
                    onChangeText={v => set(f.key, v)}
                    placeholder={f.placeholder}
                    placeholderTextColor={T.textMuted}
                    keyboardType={f.keyboardType || 'default'}
                    autoCapitalize={f.autoCapitalize || 'none'}
                    secureTextEntry={f.secure && !showPass}
                  />
                  {f.secure && (
                    <TouchableOpacity onPress={() => setShowPass(s => !s)}>
                      <Text style={styles.eyeIcon}>{showPass ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!!errors[f.key] && <Text style={styles.errorText}>{errors[f.key]}</Text>}
              </View>
            ))}

            {/* Password strength indicator */}
            {form.password.length > 0 && (
              <View style={styles.strengthRow}>
                {['Length ≥8', 'Uppercase', 'Number', 'Symbol'].map((rule, i) => {
                  const checks = [form.password.length >= 8, /[A-Z]/.test(form.password), /\d/.test(form.password), /[^a-zA-Z0-9]/.test(form.password)];
                  return (
                    <View key={rule} style={styles.strengthItem}>
                      <Text style={{ color: checks[i] ? T.success : T.textMuted, fontSize: 11 }}>
                        {checks[i] ? '✓' : '○'} {rule}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <ActivityIndicator color={T.bg} /> : <Text style={styles.btnText}>CREATE ACCOUNT →</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.loginLink} onPress={() => navigation.goBack()}>
            <Text style={styles.loginLinkText}>
              Already have access? <Text style={{ color: T.accent }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: T.bg },
  scroll:      { flexGrow: 1, padding: 24 },
  backBtn:     { marginBottom: 16, marginTop: 8 },
  backText:    { color: T.accent, fontSize: 14, fontWeight: '600' },
  title:       { fontSize: 28, fontWeight: '800', color: T.text, marginBottom: 4 },
  sub:         { fontSize: 14, color: T.textMuted, marginBottom: 24 },
  card:        { backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 20 },
  fieldGroup:  { marginBottom: 14 },
  label:       { fontSize: 10, fontWeight: '700', color: T.textMuted, letterSpacing: 1.5, marginBottom: 6 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: T.bg, borderRadius: 10, borderWidth: 1, borderColor: T.border, paddingHorizontal: 14, height: 50 },
  inputError:  { borderColor: T.danger },
  inputIcon:   { fontSize: 15, marginRight: 10 },
  input:       { flex: 1, color: T.text, fontSize: 15 },
  eyeIcon:     { fontSize: 15 },
  errorText:   { color: T.danger, fontSize: 11, marginTop: 4 },
  strengthRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  strengthItem:{ },
  btn:         { backgroundColor: T.accent, borderRadius: 10, height: 52, justifyContent: 'center', alignItems: 'center', marginTop: 4 },
  btnText:     { color: T.bg, fontSize: 14, fontWeight: '800', letterSpacing: 2 },
  loginLink:   { alignItems: 'center', marginTop: 20 },
  loginLinkText: { color: T.textMuted, fontSize: 14 },
});
