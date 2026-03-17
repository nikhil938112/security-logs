// ─── screens/SettingsScreen.js ────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { authAPI, deleteToken } from '../services/api';

const T = {
  bg: '#0A0E1A', surface: '#111827', border: '#1F2A3D',
  accent: '#00D4FF', text: '#E2E8F0', textMuted: '#64748B',
  success: '#00E396', warning: '#FFB800', danger: '#FF4560',
};

const ROLE_COLORS = { admin: T.danger, analyst: T.warning, viewer: T.accent };

const SettingRow = ({ icon, label, sub, value, onPress, isSwitch, switchValue, onSwitch, danger }) => (
  <TouchableOpacity
    style={styles.settingRow}
    onPress={onPress}
    disabled={isSwitch || !onPress}
    activeOpacity={0.7}
  >
    <View style={styles.settingIconWrap}>
      <Text style={styles.settingIcon}>{icon}</Text>
    </View>
    <View style={styles.settingContent}>
      <Text style={[styles.settingLabel, danger && { color: T.danger }]}>{label}</Text>
      {sub && <Text style={styles.settingSub}>{sub}</Text>}
    </View>
    {isSwitch ? (
      <Switch
        value={switchValue}
        onValueChange={onSwitch}
        trackColor={{ false: T.border, true: T.accent + '80' }}
        thumbColor={switchValue ? T.accent : T.textMuted}
      />
    ) : value ? (
      <Text style={styles.settingValue}>{value}</Text>
    ) : onPress ? (
      <Text style={styles.chevron}>›</Text>
    ) : null}
  </TouchableOpacity>
);

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [user, setUser]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    authAPI.me()
      .then(res => setUser(res.user))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await deleteToken();
            navigation.replace('Auth');
          },
        },
      ]
    );
  };

  const roleColor = user ? (ROLE_COLORS[user.role] || T.accent) : T.accent;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Profile card */}
        <View style={styles.profileCard}>
          {loading ? (
            <ActivityIndicator color={T.accent} />
          ) : user ? (
            <>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{user.username?.[0]?.toUpperCase() || '?'}</Text>
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{user.username}</Text>
                <Text style={styles.profileEmail}>{user.email}</Text>
                <View style={[styles.roleBadge, { backgroundColor: roleColor + '20' }]}>
                  <View style={[styles.roleDot, { backgroundColor: roleColor }]} />
                  <Text style={[styles.roleText, { color: roleColor }]}>{user.role?.toUpperCase()}</Text>
                </View>
              </View>
            </>
          ) : (
            <Text style={{ color: T.textMuted }}>Unable to load profile</Text>
          )}
        </View>

        {/* Account info */}
        {user && (
          <>
            <Text style={styles.groupLabel}>ACCOUNT</Text>
            <View style={styles.group}>
              <SettingRow icon="🆔" label="User ID"   value={user.id?.slice(-8) + '...'} />
              <SettingRow icon="📅" label="Last Login" value={user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'N/A'} />
              <SettingRow icon="🔑" label="Role"       value={user.role} />
            </View>
          </>
        )}

        {/* Preferences */}
        <Text style={styles.groupLabel}>PREFERENCES</Text>
        <View style={styles.group}>
          <SettingRow
            icon="🔔" label="Push Notifications" sub="Critical alerts"
            isSwitch switchValue={notifs} onSwitch={setNotifs}
          />
          <SettingRow
            icon="🔄" label="Auto Refresh" sub="Refresh dashboard every 30s"
            isSwitch switchValue={autoRefresh} onSwitch={setAutoRefresh}
          />
          <SettingRow
            icon="🌙" label="Dark Mode" sub="High-contrast security theme"
            isSwitch switchValue={darkMode} onSwitch={setDarkMode}
          />
        </View>

        {/* Security */}
        <Text style={styles.groupLabel}>SECURITY</Text>
        <View style={styles.group}>
          <SettingRow
            icon="🔐" label="Change Password"
            onPress={() => Alert.alert('Coming Soon', 'Password change will be available in v1.1')}
          />
          <SettingRow
            icon="📱" label="Two-Factor Auth" sub="Not configured"
            onPress={() => Alert.alert('Coming Soon', '2FA setup coming in next release')}
          />
          <SettingRow
            icon="📋" label="Active Sessions"
            onPress={() => Alert.alert('Info', 'Session management coming in next release')}
          />
        </View>

        {/* About */}
        <Text style={styles.groupLabel}>ABOUT</Text>
        <View style={styles.group}>
          <SettingRow icon="ℹ️"  label="Version"    value="1.0.0" />
          <SettingRow icon="📡"  label="API Status"  value="Connected" />
          <SettingRow icon="📜"  label="Licenses"    onPress={() => Alert.alert('Open Source', 'React Native, Expo, Express, MongoDB')} />
        </View>

        {/* Danger zone */}
        <Text style={styles.groupLabel}>ACCOUNT ACTIONS</Text>
        <View style={styles.group}>
          <SettingRow
            icon="🚪" label="Sign Out" danger
            onPress={handleLogout}
          />
        </View>

        <Text style={styles.footer}>
          SecureWatch v1.0.0 — B.Tech CSE Project{'\n'}
          Built with React Native + Node.js + MongoDB
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  topBar: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  pageTitle: { fontSize: 22, fontWeight: '800', color: T.text },
  scroll: { paddingBottom: 48 },

  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, margin: 16, backgroundColor: T.surface, borderRadius: 16, borderWidth: 1, borderColor: T.border, padding: 20 },
  avatarCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: T.accent + '20', borderWidth: 2, borderColor: T.accent, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 24, fontWeight: '800', color: T.accent },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: T.text },
  profileEmail: { fontSize: 13, color: T.textMuted, marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start', marginTop: 8 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },

  groupLabel: { fontSize: 10, fontWeight: '700', color: T.textMuted, letterSpacing: 1.5, paddingHorizontal: 16, marginBottom: 6, marginTop: 8 },
  group: { marginHorizontal: 16, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, overflow: 'hidden', marginBottom: 8 },

  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  settingIconWrap: { width: 32, height: 32, borderRadius: 8, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingIcon: { fontSize: 16 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 15, color: T.text, fontWeight: '500' },
  settingSub: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  settingValue: { fontSize: 13, color: T.textMuted },
  chevron: { fontSize: 20, color: T.textMuted },

  footer: { textAlign: 'center', color: T.textMuted, fontSize: 11, lineHeight: 18, marginTop: 24, paddingHorizontal: 32 },
});
