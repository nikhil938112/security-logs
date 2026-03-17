// ─── screens/EventDetailScreen.js ────────────────────────────────────────────
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsAPI } from '../services/api';

const T = {
  bg: '#0A0E1A', surface: '#111827', surface2: '#161F2E',
  border: '#1F2A3D', accent: '#00D4FF', text: '#E2E8F0',
  textMuted: '#64748B', success: '#00E396', warning: '#FFB800',
  danger: '#FF4560', critical: '#FF2D55', high: '#FF6B35',
  medium: '#FFB800', low: '#00E396', info: '#00D4FF',
};

const THREAT_CONFIG = {
  CRITICAL: { color: T.critical, bg: '#FF2D5520', label: 'Critical' },
  HIGH:     { color: T.high,     bg: '#FF6B3520', label: 'High' },
  MEDIUM:   { color: T.medium,   bg: '#FFB80020', label: 'Medium' },
  LOW:      { color: T.low,      bg: '#00E39620', label: 'Low' },
  INFO:     { color: T.info,     bg: '#00D4FF20', label: 'Info' },
};

const STATUS_CONFIG = {
  OPEN:            { color: T.danger,  icon: '🔴', label: 'Open' },
  INVESTIGATING:   { color: T.warning, icon: '🟡', label: 'Investigating' },
  RESOLVED:        { color: T.success, icon: '🟢', label: 'Resolved' },
  FALSE_POSITIVE:  { color: T.textMuted, icon: '⚪', label: 'False Positive' },
};

const EVENT_TYPE_ICONS = {
  LOGIN_SUCCESS: '✅', LOGIN_FAILURE: '❌', BRUTE_FORCE: '💀',
  SQL_INJECTION: '💉', XSS_ATTEMPT: '🕷', UNAUTHORIZED_ACCESS: '🚫',
  PORT_SCAN: '🔍', DATA_EXFILTRATION: '📤', MALWARE_DETECTED: '🦠', POLICY_VIOLATION: '⚠️',
};

const InfoRow = ({ label, value, mono, color }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, mono && styles.mono, color && { color }]}>{value || '—'}</Text>
  </View>
);

export default function EventDetailScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { event: initialEvent } = route.params;
  const [event, setEvent]   = useState(initialEvent);
  const [updating, setUpdating] = useState(false);

  const cfg = THREAT_CONFIG[event.threatLevel] || THREAT_CONFIG.INFO;
  const statusCfg = STATUS_CONFIG[event.status] || STATUS_CONFIG.OPEN;
  const ts = new Date(event.createdAt);

  const updateStatus = async (newStatus) => {
    Alert.alert(
      'Update Status',
      `Mark this event as "${STATUS_CONFIG[newStatus]?.label}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            try {
              const res = await eventsAPI.updateStatus(event._id, newStatus);
              setEvent(res.data);
            } catch (err) {
              Alert.alert('Error', err.message);
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  const handleShare = () => {
    Share.share({
      message: `[SecureWatch Alert]\nType: ${event.eventType}\nThreat: ${event.threatLevel}\nSource IP: ${event.sourceIP}\nTime: ${ts.toLocaleString()}\nStatus: ${event.status}`,
      title: 'Security Event Report',
    });
  };

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Events</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareText}>Share ↑</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Event type hero */}
        <View style={[styles.heroCard, { borderLeftColor: cfg.color }]}>
          <Text style={styles.heroIcon}>{EVENT_TYPE_ICONS[event.eventType] || '🔔'}</Text>
          <View style={styles.heroContent}>
            <Text style={styles.heroType}>{event.eventType.replace(/_/g, ' ')}</Text>
            <View style={styles.heroRow}>
              <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: statusCfg.color + '22' }]}>
                <Text style={styles.statusEmoji}>{statusCfg.icon}</Text>
                <Text style={[styles.badgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
              </View>
            </View>
          </View>
          {/* Threat score arc */}
          <View style={[styles.scoreCircle, { borderColor: cfg.color }]}>
            <Text style={[styles.scoreValue, { color: cfg.color }]}>{event.threatScore ?? '?'}</Text>
            <Text style={styles.scoreLabel}>score</Text>
          </View>
        </View>

        {/* Network info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Network Details</Text>
          <View style={styles.card}>
            <InfoRow label="Source IP"      value={event.sourceIP}      mono />
            <InfoRow label="Destination IP" value={event.destinationIP} mono />
            <InfoRow label="Port"           value={event.port?.toString()} mono />
            <InfoRow label="Protocol"       value={event.protocol} />
            <InfoRow label="User Agent"     value={event.userAgent} />
            <InfoRow label="Request Path"   value={event.requestPath}   mono />
            <InfoRow label="Status Code"    value={event.statusCode?.toString()} color={event.statusCode >= 400 ? T.danger : T.success} />
          </View>
        </View>

        {/* User info */}
        {(event.username || event.userId) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>👤 User Context</Text>
            <View style={styles.card}>
              <InfoRow label="Username" value={event.username} />
              <InfoRow label="User ID"  value={event.userId?.toString() || event.userId} mono />
            </View>
          </View>
        )}

        {/* Geo info */}
        {event.geo?.country && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📍 Geolocation</Text>
            <View style={styles.card}>
              <InfoRow label="Country" value={event.geo.country} />
              <InfoRow label="City"    value={event.geo.city} />
              <InfoRow label="Coordinates" value={`${event.geo.lat ?? '?'}, ${event.geo.lon ?? '?'}`} mono />
            </View>
          </View>
        )}

        {/* Event metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Event Metadata</Text>
          <View style={styles.card}>
            <InfoRow label="Event ID"   value={event._id} mono />
            <InfoRow label="Created"    value={ts.toLocaleString()} />
            <InfoRow label="Updated"    value={new Date(event.updatedAt).toLocaleString()} />
            <InfoRow label="Resolved By" value={event.resolvedBy?.username} />
            <InfoRow label="Resolved At" value={event.resolvedAt ? new Date(event.resolvedAt).toLocaleString() : null} />
            {event.tags?.length > 0 && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tags</Text>
                <View style={styles.tagRow}>
                  {event.tags.map(tag => (
                    <View key={tag} style={styles.tag}>
                      <Text style={styles.tagText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {event.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Description</Text>
            <View style={styles.card}>
              <Text style={styles.descriptionText}>{event.description}</Text>
            </View>
          </View>
        )}

        {/* Status actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚡ Update Status</Text>
          <View style={styles.actionGrid}>
            {Object.entries(STATUS_CONFIG)
              .filter(([s]) => s !== event.status)
              .map(([status, cfg]) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.actionBtn, { borderColor: cfg.color + '60' }]}
                  onPress={() => updateStatus(status)}
                  disabled={updating}
                  activeOpacity={0.7}
                >
                  {updating ? (
                    <ActivityIndicator color={cfg.color} size="small" />
                  ) : (
                    <>
                      <Text style={styles.actionIcon}>{cfg.icon}</Text>
                      <Text style={[styles.actionText, { color: cfg.color }]}>{cfg.label}</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 32 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  backBtn: { padding: 4 },
  backText: { color: T.accent, fontSize: 15, fontWeight: '600' },
  shareBtn: { padding: 4 },
  shareText: { color: T.textMuted, fontSize: 13 },

  heroCard: { margin: 16, backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, borderLeftWidth: 4, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { fontSize: 36 },
  heroContent: { flex: 1 },
  heroType: { fontSize: 17, fontWeight: '700', color: T.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroRow: { flexDirection: 'row', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  statusEmoji: { fontSize: 10 },
  scoreCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  scoreValue: { fontSize: 18, fontWeight: '800' },
  scoreLabel: { fontSize: 9, color: T.textMuted, fontWeight: '600' },

  section: { marginHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 13, color: T.textMuted, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  card: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, overflow: 'hidden' },

  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 12, borderBottomWidth: 1, borderBottomColor: T.border },
  infoLabel: { fontSize: 12, color: T.textMuted, flex: 1, fontWeight: '500' },
  infoValue: { fontSize: 13, color: T.text, flex: 2, textAlign: 'right' },
  mono: { fontFamily: 'monospace', fontSize: 12 },
  tagRow: { flex: 2, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 4 },
  tag: { backgroundColor: T.surface2, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, borderWidth: 1, borderColor: T.border },
  tagText: { fontSize: 11, color: T.accent },
  descriptionText: { color: T.text, fontSize: 14, lineHeight: 22, padding: 14 },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionBtn: { flex: 1, minWidth: 140, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: T.surface, borderWidth: 1, borderRadius: 10, padding: 14 },
  actionIcon: { fontSize: 16 },
  actionText: { fontSize: 13, fontWeight: '700' },
});
