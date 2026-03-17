// ─── screens/AnalyticsScreen.js ───────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
  Dimensions, TouchableOpacity,
} from 'react-native';
import { BarChart, PieChart, LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { eventsAPI } from '../services/api';

const { width: SCREEN_W } = Dimensions.get('window');
const CHART_W = SCREEN_W - 48;

const T = {
  bg: '#0A0E1A', surface: '#111827', border: '#1F2A3D',
  accent: '#00D4FF', text: '#E2E8F0', textMuted: '#64748B',
  success: '#00E396', warning: '#FFB800', danger: '#FF4560',
  critical: '#FF2D55', high: '#FF6B35', medium: '#FFB800', low: '#00E396',
};

const chartConfig = {
  backgroundColor: 'transparent',
  backgroundGradientFrom: T.surface,
  backgroundGradientTo: T.surface,
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(0, 212, 255, ${opacity})`,
  labelColor: () => T.textMuted,
  propsForBackgroundLines: { stroke: T.border, strokeWidth: 0.5 },
};

const SectionCard = ({ title, sub, children, loading }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {sub && <Text style={styles.cardSub}>{sub}</Text>}
    </View>
    {loading ? (
      <View style={styles.chartLoader}><ActivityIndicator color={T.accent} /></View>
    ) : children}
  </View>
);

export default function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const [data, setData]     = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays]     = useState(7);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [chartRes, summaryRes] = await Promise.all([
          eventsAPI.getThreatLevelChart(days),
          eventsAPI.getSummary(),
        ]);
        setData(chartRes.data);
        setSummary(summaryRes.data);
      } catch (err) {
        console.warn('Analytics load error:', err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [days]);

  // Build bar chart: one bar per day, stacked total
  const buildBarData = () => {
    if (!data) return null;
    const DISPLAY = Math.min(days, 7);
    const labels = data.labels.slice(-DISPLAY).map(d => d.slice(5));
    const totals = data.labels.slice(-DISPLAY).map((_, i) => {
      const idx = data.labels.length - DISPLAY + i;
      return Object.values(data.datasets).reduce((sum, arr) => sum + (arr[idx] || 0), 0);
    });
    return { labels, datasets: [{ data: totals }] };
  };

  // Build pie chart: by threat level totals
  const buildPieData = () => {
    if (!data?.totals) return null;
    const palette = { CRITICAL: T.critical, HIGH: T.high, MEDIUM: T.medium, LOW: T.low, INFO: T.accent };
    return Object.entries(data.totals)
      .filter(([, v]) => v > 0)
      .map(([level, count]) => ({
        name: level,
        population: count,
        color: palette[level],
        legendFontColor: T.textMuted,
        legendFontSize: 11,
      }));
  };

  // Build line chart: CRITICAL trend over days
  const buildLineData = () => {
    if (!data) return null;
    const DISPLAY = Math.min(days, 7);
    const labels = data.labels.slice(-DISPLAY).map(d => d.slice(5));
    const critical = data.labels.slice(-DISPLAY).map((_, i) => {
      const idx = data.labels.length - DISPLAY + i;
      return data.datasets.CRITICAL[idx] || 0;
    });
    const high = data.labels.slice(-DISPLAY).map((_, i) => {
      const idx = data.labels.length - DISPLAY + i;
      return data.datasets.HIGH[idx] || 0;
    });
    return {
      labels,
      datasets: [
        { data: critical, color: () => T.critical, strokeWidth: 2 },
        { data: high,     color: () => T.high,     strokeWidth: 2 },
      ],
      legend: ['Critical', 'High'],
    };
  };

  const barData  = buildBarData();
  const pieData  = buildPieData();
  const lineData = buildLineData();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.pageTitle}>Analytics</Text>
        <View style={styles.daySelector}>
          {[7, 14, 30].map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.dayBtn, days === d && styles.dayBtnActive]}
              onPress={() => setDays(d)}
            >
              <Text style={[styles.dayBtnText, days === d && styles.dayBtnTextActive]}>{d}d</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top source IPs */}
        {summary && (
          <SectionCard title="Top Attacker IPs" sub="By event count">
            {summary.topSourceIPs.map((item, i) => (
              <View key={item.ip} style={styles.rankRow}>
                <View style={[styles.rankBadge, { backgroundColor: i === 0 ? T.danger + '30' : T.border }]}>
                  <Text style={[styles.rankNum, { color: i === 0 ? T.danger : T.textMuted }]}>#{i + 1}</Text>
                </View>
                <Text style={styles.rankIP}>{item.ip}</Text>
                <View style={styles.rankBar}>
                  <View style={[styles.rankBarFill, {
                    width: `${(item.count / summary.topSourceIPs[0].count) * 100}%`,
                    backgroundColor: i === 0 ? T.danger : T.accent,
                  }]} />
                </View>
                <Text style={styles.rankCount}>{item.count}</Text>
              </View>
            ))}
          </SectionCard>
        )}

        {/* Bar chart: daily totals */}
        <SectionCard title="Daily Event Volume" sub={`Last ${days} days`} loading={loading && !barData}>
          {barData && (
            <BarChart
              data={barData}
              width={CHART_W}
              height={180}
              fromZero
              showValuesOnTopOfBars
              withInnerLines={false}
              chartConfig={chartConfig}
              style={{ borderRadius: 8, marginLeft: -8 }}
            />
          )}
        </SectionCard>

        {/* Line chart: critical vs high trend */}
        <SectionCard title="Critical & High Trend" sub="Daily breakdown" loading={loading && !lineData}>
          {lineData && (
            <LineChart
              data={lineData}
              width={CHART_W}
              height={180}
              fromZero
              withDots
              withInnerLines={false}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => `rgba(255, 45, 85, ${opacity})`,
              }}
              style={{ borderRadius: 8, marginLeft: -8 }}
            />
          )}
        </SectionCard>

        {/* Pie chart: threat distribution */}
        <SectionCard title="Threat Distribution" sub="By severity level" loading={loading && !pieData}>
          {pieData && pieData.length > 0 && (
            <PieChart
              data={pieData}
              width={CHART_W}
              height={180}
              chartConfig={chartConfig}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              center={[10, 0]}
              absolute
            />
          )}
        </SectionCard>

        {/* Event type breakdown */}
        {summary && (
          <SectionCard title="Event Types" sub="All time">
            {summary.eventTypeCounts.map((item, i) => (
              <View key={item.type} style={styles.typeRow}>
                <Text style={styles.typeLabel} numberOfLines={1}>{item.type.replace(/_/g, ' ')}</Text>
                <View style={styles.typeBarWrap}>
                  <View style={[styles.typeBarFill, {
                    width: `${(item.count / summary.eventTypeCounts[0].count) * 100}%`,
                    backgroundColor: i < 3 ? T.danger : T.accent,
                  }]} />
                </View>
                <Text style={styles.typeCount}>{item.count}</Text>
              </View>
            ))}
          </SectionCard>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: T.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: T.border },
  pageTitle: { fontSize: 22, fontWeight: '800', color: T.text },
  daySelector: { flexDirection: 'row', gap: 6 },
  dayBtn: { paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: T.border, borderRadius: 20 },
  dayBtnActive: { backgroundColor: T.accent, borderColor: T.accent },
  dayBtnText: { fontSize: 12, color: T.textMuted, fontWeight: '600' },
  dayBtnTextActive: { color: T.bg },
  scroll: { padding: 16, paddingBottom: 32 },

  card: { backgroundColor: T.surface, borderRadius: 12, borderWidth: 1, borderColor: T.border, padding: 16, marginBottom: 16 },
  cardHeader: { marginBottom: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: T.text },
  cardSub: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  chartLoader: { height: 180, justifyContent: 'center', alignItems: 'center' },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  rankBadge: { width: 28, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  rankNum: { fontSize: 11, fontWeight: '800' },
  rankIP: { width: 110, fontSize: 12, color: T.text, fontFamily: 'monospace' },
  rankBar: { flex: 1, height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden' },
  rankBarFill: { height: '100%', borderRadius: 3 },
  rankCount: { width: 30, textAlign: 'right', fontSize: 12, color: T.textMuted, fontWeight: '600' },

  typeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  typeLabel: { width: 130, fontSize: 11, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  typeBarWrap: { flex: 1, height: 6, backgroundColor: T.border, borderRadius: 3, overflow: 'hidden' },
  typeBarFill: { height: '100%', borderRadius: 3 },
  typeCount: { width: 28, textAlign: 'right', fontSize: 12, color: T.text, fontWeight: '700' },
});
