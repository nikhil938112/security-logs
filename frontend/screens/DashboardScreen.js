// ─── screens/DashboardScreen.js ───────────────────────────────────────────────
// Main Dashboard — KPI cards, threat-level bar chart, and live event feed.
// React Native + react-native-chart-kit
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, Dimensions, Animated,
  ScrollView,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsAPI, authAPI, deleteToken } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;

// ── Theme ─────────────────────────────────────────────────────────────────────
const T = {
  bg:        '#0A0E1A',
  surface:   '#111827',
  surface2:  '#161F2E',
  border:    '#1F2A3D',
  accent:    '#00D4FF',
  text:      '#E2E8F0',
  textMuted: '#64748B',
  success:   '#00E396',
  warning:   '#FFB800',
  danger:    '#FF4560',
  critical:  '#FF2D55',
  high:      '#FF6B35',
  medium:    '#FFB800',
  low:       '#00E396',
  info:      '#00D4FF',
};

// ── Threat level config ───────────────────────────────────────────────────────
const THREAT_CONFIG = {
  CRITICAL:  { color: T.critical, label: 'Critical', bg: '#FF2D5520' },
  HIGH:      { color: T.high,     label: 'High',     bg: '#FF6B3520' },
  MEDIUM:    { color: T.medium,   label: 'Medium',   bg: '#FFB80020' },
  LOW:       { color: T.low,      label: 'Low',      bg: '#00E39620' },
  INFO:      { color: T.info,     label: 'Info',     bg: '#00D4FF20' },
};

const EVENT_TYPE_ICONS = {
  LOGIN_SUCCESS:      '✅',
  LOGIN_FAILURE:      '❌',
  BRUTE_FORCE:        '💀',
  SQL_INJECTION:      '💉',
  XSS_ATTEMPT:        '🕷',
  UNAUTHORIZED_ACCESS:'🚫',
  PORT_SCAN:          '🔍',
  DATA_EXFILTRATION:  '📤',
  MALWARE_DETECTED:   '🦠',
  POLICY_VIOLATION:   '⚠️',
};

// ── Subcomponents ─────────────────────────────────────────────────────────────

/** KPI metric card */
const MetricCard = ({ label, value, sub, color, pulse }) => {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) return;
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1,   duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  return (
    <View style={[styles.metricCard, { borderTopColor: color }]}>
      <View style={styles.metricHeader}>
        <Animated.View style={[styles.metricDot, { backgroundColor: color, opacity: anim }]} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value ?? '—'}</Text>
      {sub ? <Text style={styles.metricSub}>{sub}</Text> : null}
    </View>
  );
};

/** Individual event row */
const EventRow = ({ item, onPress }) => {
  const cfg = THREAT_CONFIG[item.threatLevel] || THREAT_CONFIG.INFO;
  const ts  = new Date(item.createdAt);

  return (
    <TouchableOpacity style={styles.eventRow} onPress={() => onPress(item)} activeOpacity={0.7}>
      {/* Left accent */}
      <View style={[styles.eventAccent, { backgroundColor: cfg.color }]} />

      {/* Icon */}
      <View style={[styles.eventIconWrap, { backgroundColor: cfg.bg }]}>
        <Text style={styles.eventIcon}>{EVENT_TYPE_ICONS[item.eventType] || '🔔'}</Text>
      </View>

      {/* Content */}
      <View style={styles.eventContent}>
        <View style={styles.eventTopRow}>
          <Text style={styles.eventType} numberOfLines={1}>
            {item.eventType.replace(/_/g, ' ')}
          </Text>
          <View style={[styles.threatBadge, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.threatBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>
        <Text style={styles.eventIP}>{item.sourceIP}</Text>
        <View style={styles.eventBottomRow}>
          <Text style={styles.eventTime}>
            {ts.toLocaleDateString()} {ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={[styles.statusDot, {
            backgroundColor: item.status === 'OPEN' ? T.danger
              : item.status === 'INVESTIGATING' ? T.warning : T.success,
          }]} />
          <Text style={styles.eventStatus}>{item.status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  const [user, setUser]               = useState(null);
  const [events, setEvents]           = useState([]);
  const [summary, setSummary]         = useState(null);
  const [chartData, setChartData]     = useState(null);
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [chartDays, setChartDays]     = useState(7);
  const [filter, setFilter]           = useState('ALL');
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const FILTERS = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

  // ── Data fetching ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const params = { page: 1, limit: 20 };
      if (filter !== 'ALL') params.threatLevel = filter;

      const [userData, summaryData, chartDataRes, eventsData] = await Promise.all([
        authAPI.me(),
        eventsAPI.getSummary(),
        eventsAPI.getThreatLevelChart(chartDays),
        eventsAPI.getEvents(params),
      ]);

      setUser(userData.user);
      setSummary(summaryData.data);
      setEvents(eventsData.data);
      setHasMore(eventsData.pagination.hasNext);
      setPage(1);
      buildChart(chartDataRes.data);
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, chartDays]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Chart builder ────────────────────────────────────────────────────────────
  const buildChart = (data) => {
    if (!data?.labels) return;
    // Show last 7 labels only on small screen for readability
    const DISPLAY = 7;
    const labels  = data.labels.slice(-DISPLAY).map((d) => d.slice(5)); // MM-DD
    const totals  = data.labels.slice(-DISPLAY).map((_, i) => {
      const idx = data.labels.length - DISPLAY + i;
      return (data.datasets.CRITICAL[idx] || 0)
           + (data.datasets.HIGH[idx]     || 0)
           + (data.datasets.MEDIUM[idx]   || 0)
           + (data.datasets.LOW[idx]      || 0)
           + (data.datasets.INFO[idx]     || 0);
    });

    setChartData({
      labels,
      datasets: [{ data: totals, colors: totals.map((v) => () => v > 10 ? T.critical : v > 5 ? T.warning : T.success) }],
      raw: data,
    });
  };

  // ── Load more (pagination) ───────────────────────────────────────────────────
  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params   = { page: nextPage, limit: 20 };
      if (filter !== 'ALL') params.threatLevel = filter;
      const res = await eventsAPI.getEvents(params);
      setEvents((prev) => [...prev, ...res.data]);
      setHasMore(res.pagination.hasNext);
      setPage(nextPage);
    } catch (err) {
      console.warn('Load more error:', err.message);
    } finally {
      setLoadingMore(false);
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await deleteToken();
    navigation.replace('Auth');
  };

  // ── Render helpers ────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <View>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={styles.greeting}>
            {user ? `Welcome, ${user.username}` : 'Security Operations'}
          </Text>
          <Text style={styles.greetingSub}>
            {user?.role?.toUpperCase() || 'ANALYST'} · Live Feed
          </Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>LOGOUT</Text>
        </TouchableOpacity>
      </View>

      {/* KPI cards */}
      {summary && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.metricRow}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
          <MetricCard label="Events Today" value={summary.totalEventsToday} color={T.accent} />
          <MetricCard
            label="Open Critical" value={summary.openCriticalAlerts}
            color={T.danger} pulse={summary.openCriticalAlerts > 0}
            sub="Needs attention"
          />
          <MetricCard
            label="Top Source IP"
            value={summary.topSourceIPs?.[0]?.ip || 'N/A'}
            sub={`${summary.topSourceIPs?.[0]?.count || 0} events`}
            color={T.warning}
          />
          <MetricCard
            label="Top Event Type"
            value={summary.eventTypeCounts?.[0]?.type?.replace(/_/g, ' ') || 'N/A'}
            sub={`${summary.eventTypeCounts?.[0]?.count || 0} total`}
            color={T.high}
          />
        </ScrollView>
      )}

      {/* Chart */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={styles.sectionTitle}>Threat Activity</Text>
            <Text style={styles.sectionSub}>Total events per day</Text>
          </View>
          {/* Day selector */}
          <View style={styles.daySelector}>
            {[7, 14, 30].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.dayBtn, chartDays === d && styles.dayBtnActive]}
                onPress={() => setChartDays(d)}
              >
                <Text style={[styles.dayBtnText, chartDays === d && styles.dayBtnTextActive]}>
                  {d}d
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {chartData ? (
          <BarChart
            data={chartData}
            width={CHART_W}
            height={180}
            fromZero
            showValuesOnTopOfBars
            withInnerLines={false}
            withCustomBarColorFromData
            flatColor
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: T.surface,
              backgroundGradientTo: T.surface,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 212, 255, ${opacity})`,
              labelColor: () => T.textMuted,
              style: { borderRadius: 8 },
              propsForBackgroundLines: { stroke: T.border, strokeWidth: 0.5 },
            }}
            style={{ borderRadius: 8, marginLeft: -4 }}
          />
        ) : (
          <View style={styles.chartPlaceholder}>
            <ActivityIndicator color={T.accent} />
          </View>
        )}

        {/* Threat level legend */}
        {chartData?.raw && (
          <View style={styles.legend}>
            {Object.entries(THREAT_CONFIG).map(([level, cfg]) => (
              <View key={level} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
                <Text style={styles.legendText}>{cfg.label}: {chartData.raw.totals[level]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, filter === f && styles.filterPillActive]}
              onPress={() => setFilter(f)}
            >
              {f !== 'ALL' && (
                <View style={[styles.filterDot, { backgroundColor: THREAT_CONFIG[f]?.color }]} />
              )}
              <Text style={[styles.filterPillText, filter === f && styles.filterPillTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <Text style={styles.sectionTitle2}>
        {events.length} Security Events
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={T.accent} />
        <Text style={styles.loadingText}>Loading threat data...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <FlatList
        data={events}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <EventRow item={item} onPress={(e) => navigation.navigate('EventDetail', { event: e })} />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 32 }}>🛡</Text>
            <Text style={styles.emptyText}>No events found</Text>
            <Text style={styles.emptySubText}>All systems operating normally</Text>
          </View>
        }
        ListFooterComponent={
          loadingMore ? (
            <View style={{ padding: 16 }}>
              <ActivityIndicator color={T.accent} />
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchAll(true)}
            tintColor={T.accent}
            colors={[T.accent]}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: T.bg },
  listContent:     { paddingBottom: 32 },
  loadingScreen:   { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: T.bg },
  loadingText:     { color: T.textMuted, marginTop: 12, fontSize: 14 },

  // Top bar
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: T.border,
  },
  greeting:        { fontSize: 20, fontWeight: '700', color: T.text },
  greetingSub:     { fontSize: 11, color: T.textMuted, marginTop: 2, letterSpacing: 1 },
  logoutBtn:       {
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: T.border, borderRadius: 6,
  },
  logoutText:      { color: T.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1 },

  // Metric cards
  metricRow:       { marginVertical: 16 },
  metricCard:      {
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, borderTopWidth: 3,
    padding: 12, width: 140,
  },
  metricHeader:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  metricDot:       { width: 6, height: 6, borderRadius: 3 },
  metricLabel:     { fontSize: 10, color: T.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  metricValue:     { fontSize: 20, fontWeight: '800' },
  metricSub:       { fontSize: 11, color: T.textMuted, marginTop: 2 },

  // Chart
  chartCard:       {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, padding: 16,
  },
  chartHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  sectionTitle:    { fontSize: 16, fontWeight: '700', color: T.text },
  sectionSub:      { fontSize: 12, color: T.textMuted, marginTop: 2 },
  chartPlaceholder:{ height: 180, justifyContent: 'center', alignItems: 'center' },
  daySelector:     { flexDirection: 'row', gap: 4 },
  dayBtn:          {
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: T.border, borderRadius: 20,
  },
  dayBtnActive:    { backgroundColor: T.accent, borderColor: T.accent },
  dayBtnText:      { fontSize: 11, color: T.textMuted, fontWeight: '600' },
  dayBtnTextActive:{ color: T.bg },
  legend:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  legendItem:      { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:       { width: 8, height: 8, borderRadius: 4 },
  legendText:      { fontSize: 11, color: T.textMuted },

  // Filters
  filterRow:       { paddingHorizontal: 16, marginBottom: 12 },
  filterPill:      {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: T.border, borderRadius: 20,
    marginRight: 8, backgroundColor: T.surface,
  },
  filterPillActive:{ backgroundColor: T.accent, borderColor: T.accent },
  filterDot:       { width: 6, height: 6, borderRadius: 3 },
  filterPillText:  { fontSize: 12, color: T.textMuted, fontWeight: '600' },
  filterPillTextActive: { color: T.bg },
  sectionTitle2:   { fontSize: 13, color: T.textMuted, paddingHorizontal: 16, marginBottom: 8, letterSpacing: 0.5 },

  // Event rows
  eventRow:        {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: T.surface, borderRadius: 12,
    borderWidth: 1, borderColor: T.border, overflow: 'hidden',
  },
  eventAccent:     { width: 3, alignSelf: 'stretch' },
  eventIconWrap:   {
    width: 44, height: 44, borderRadius: 8, margin: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  eventIcon:       { fontSize: 20 },
  eventContent:    { flex: 1, paddingRight: 12, paddingVertical: 10 },
  eventTopRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  eventType:       { fontSize: 13, fontWeight: '700', color: T.text, flex: 1 },
  threatBadge:     { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 8 },
  threatBadgeText: { fontSize: 10, fontWeight: '700' },
  eventIP:         { fontSize: 12, color: T.textMuted, fontFamily: 'monospace', marginBottom: 4 },
  eventBottomRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventTime:       { fontSize: 11, color: T.textMuted, flex: 1 },
  statusDot:       { width: 6, height: 6, borderRadius: 3 },
  eventStatus:     { fontSize: 10, color: T.textMuted, fontWeight: '600' },

  // Empty state
  emptyState:      { alignItems: 'center', paddingTop: 60 },
  emptyText:       { fontSize: 18, fontWeight: '700', color: T.text, marginTop: 12 },
  emptySubText:    { fontSize: 14, color: T.textMuted, marginTop: 4 },
});
