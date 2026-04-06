import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types/navigation';
import { api, logoutApi } from '../../api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sidebar from '../../components/Sidebar';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import { moderateScale, responsiveFontSize, verticalScale, scale } from '../../utils/responsive';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

// ─── EXACT SAME SEVERITY MAPS AS WEBSITE ────────────────────────────────────
const smpsAlarmSeverityMap: Record<string, string> = {
  'HIGH_TEMPERATURE': 'Major',
  'FIRE_and_SMOKE': 'Fire',
  'LOW_BATTERY_VOLTAGE': 'Major',
  'MAINS_FAIL': 'Major',
  'DG_ON': 'Major',
  'DG_Failed_to_start': 'Major',
  'SITE_ON_BATTERY': 'Major',
  'EMERGENCY_FAULT': 'Minor',
  'ALTERNATOR_FAULT': 'Minor',
  'DG_OVERLOAD': 'Minor',
  'DG_FUEL_LEVEL_LOW1': 'Minor',
  'DG_FUEL_LEVEL_LOW2': 'Minor',
  'LLOP_FAULT': 'Minor',
  'DG_Failed_to_stop': 'Minor',
  'DOOR_ALARM': 'Minor',
  'reserve': 'Minor',
};

const tpmsAlarmSeverityMap: Record<string, string> = {
  'BB Loop Break': 'Major', 'BB1 DisConnect': 'Major', 'BB2 Disconnect': 'Major',
  'BB3 Disconnect': 'Major', 'BB4 Disconnect': 'Major', 'Extra Alarm': 'Minor',
  'SOBT': 'Minor', 'Rectifier Fail': 'Major', 'RRU Disconnect': 'Major',
  'BTS Open': 'Major', 'RTN Open': 'Major', 'Door-Open': 'Minor',
  'Shelter Loop Break': 'Major', 'Fiber cut': 'Major', 'camera alarm': 'Major',
  'BTS CABLE CUT': 'Major', 'cable loop break': 'Major', 'Motion 1': 'Minor',
  'Motion 2': 'Minor', 'Fiber Cabinet open': 'Major', 'DG Battery Disconnected': 'Major',
  'RTN cabinet open': 'Major', 'airtel odc rack': 'Major', 'idea odc rack': 'Major',
  'Idea BTS Cabinet': 'Major', 'Airtel BTS Cabinet': 'Major', 'Door-Open 2': 'Minor',
  'Solar Voltage Sensing': 'Major', 'Solar Loop Break': 'Major',
  'AC 1 Fail': 'Major', 'AC 2 Fail': 'Major', 'AC 3 Fail': 'Major', 'AC 4 Fail': 'Major',
  'Fire and smoke 1': 'Fire', 'fire and smoke 2': 'Fire',
  'High Temperature': 'Major', 'DC Battery low': 'Major', 'Mains Failed': 'Major',
  'Moter 1 Loop Break': 'Major', 'Moter 2 Loop Break': 'Major', 'DG on Load': 'Minor',
  'Starter Cabinet Open': 'Major', 'Site Battery Low': 'Major', 'DG Common Fault': 'Major',
  'Site On Battery': 'Major', 'BB Cabinet Door Open': 'Major',
  'OAD Shelter Loop Break': 'Major', 'OAD RRU Disconnect': 'Major',
  'OAD BB Cabinet Door Open': 'Minor', 'OAD BTS Open': 'Major',
  'OAD BTS 1 Open': 'Major', 'OAD BTS 2 Open': 'Major',
  'PUMP 1': 'Minor', 'Pump 2': 'Minor', 'Pump 3': 'Minor',
  'B LVD Cut': 'Major', 'L LVD Cut': 'Major', 'Dg door open': 'Minor',
  'DG BATTERY LOOPING': 'Major', 'RF CABLE DISCONNECT': 'Major',
  'Motion 3': 'Minor', 'Motion 4': 'Minor',
  'Vibration sensor 1': 'Minor', 'Vibration sensor2': 'Minor',
  'Servo cabinet open': 'Major', 'Vibration Sensor 3': 'Minor',
  'Vibration sensor 4': 'Minor', 'Vibration sensor 5': 'Minor',
  'mains voltage trip': 'Major', 'DG Faild to start': 'Major', 'DG Faild to OFF': 'Major',
  'Door Open': 'Minor', 'TPMS Battery Low': 'Major', 'Hooter': 'Major',
  'FSMK': 'Major', 'DOPN': 'Minor', 'TPMS Supply Failed': 'Minor',
  'MOTN': 'Major', 'AM MNSF': 'Major', 'BTLV': 'Major',
};

// ─── HELPER FUNCTIONS (same logic as website JS) ────────────────────────────

function isNightTime(timestamp: string | null): boolean {
  if (!timestamp) return false;
  const hr = new Date(timestamp).getHours();
  return hr >= 22 || hr < 6;
}

function isDoorAlarm(field: string, name: string): boolean {
  if (field === 'DOOR_ALARM') return true;
  const lower = (name || '').toLowerCase();
  return ['door-open', 'door open', 'dopn', 'door_open'].some(p => lower.includes(p));
}

// ✅ Filter: LLOP_FAULT alarms (same as website)
function isLLOPFaultAlarm(alarm: any): boolean {
  if (alarm.alarm_type !== 'smps') return false;
  const all = [...(alarm.active_alarms || []), ...(alarm.closed_alarms || [])];
  return all.some((a: any) => a.field === 'LLOP_FAULT' || a.name === 'LLOP Fault');
}

// ✅ Filter: MAINS_AVAILABLE alarms (same as website)
function isMainsAvailableAlarm(alarm: any): boolean {
  if (alarm.alarm_name === 'MAINS_AVAILABLE' || alarm.alarm_field === 'MAINS_AVAILABLE') return true;
  const all = [...(alarm.active_alarms || []), ...(alarm.closed_alarms || [])];
  return all.some((a: any) => a.field === 'MAINS_AVAILABLE' || a.name === 'MAINS_AVAILABLE');
}

// ─── EXACT SAME getSeverity LOGIC AS WEBSITE ────────────────────────────────
function getSeverityFromAlarm(alarm: any): string {
  const alarmType = alarm.alarm_type; // 'smps' or 'tpms'
  const timestamp = alarm.created_dt || alarm.create_dt || alarm.start_time || null;

  if (alarmType === 'tpms') {
    const alarmName = alarm.alarm_name || alarm.alarm_desc || '';
    const lower = alarmName.toLowerCase();
    if (lower.includes('fire') || lower.includes('smoke') || lower.includes('fsmk')) return 'Fire';
    if (isDoorAlarm('', alarmName) && isNightTime(timestamp)) return 'NightDoor';
    return tpmsAlarmSeverityMap[alarmName] || 'Minor';
  } else {
    // SMPS
    const activeAlarms = alarm.active_alarms || [];
    const closedAlarms = alarm.closed_alarms || [];
    const allAlarms = [...activeAlarms, ...closedAlarms];

    // Flat structure fallback (FastRealTimeAlarmList style)
    if (allAlarms.length === 0) {
      const field = alarm.alarm_field || alarm.alarm_desc || alarm.alarm_name || 'reserve';
      if (field === 'FIRE_and_SMOKE') return 'Fire';
      if (isDoorAlarm(field, field) && isNightTime(timestamp)) return 'NightDoor';
      return smpsAlarmSeverityMap[field] || 'Minor';
    }

    for (const item of allAlarms) {
      if (item.field === 'FIRE_and_SMOKE') return 'Fire';
      if (isDoorAlarm(item.field, item.name) && isNightTime(timestamp)) return 'NightDoor';
    }

    let highest = 'Minor';
    for (const item of allAlarms) {
      const sev = smpsAlarmSeverityMap[item.field] || 'Minor';
      if (sev === 'Major') highest = 'Major';
    }
    return highest;
  }
}

// ✅ Deduplicate alarms — same key logic as website
function getAlarmUniqueKey(alarm: any): string {
  const siteId = alarm.site_id || '';
  const imei = alarm.imei || '';
  const alarmType = alarm.alarm_type;
  const timestamp = alarm.created_dt || alarm.create_dt || alarm.start_time || '';

  if (alarmType === 'tpms') {
    const alarmName = alarm.alarm_name || '';
    if (alarm.alarm_id) return `tpms-${alarm.alarm_id}`;
    return `tpms-${siteId}-${imei}-${alarmName}-${timestamp}`;
  } else {
    const activeAlarmFields = (alarm.active_alarms || [])
      .map((a: any) => a.field)
      .sort()
      .join(',');
    if (alarm.alarm_status === 'Closed') {
      return `smps-${siteId}-${imei}-${activeAlarmFields}-${timestamp}`;
    }
    return `smps-${siteId}-${imei}-${activeAlarmFields}`;
  }
}

// ✅ Parse API response — handles all response shapes
function extractAlarmArray(res: any): any[] {
  if (!res) return [];
  if (Array.isArray(res)) return res;
  if (Array.isArray(res.data)) return res.data;
  if (Array.isArray(res.alarms)) return res.alarms;
  if (res.status === 'success') {
    if (Array.isArray(res.data)) return res.data;
    if (res.data && Array.isArray(res.data.alarms)) return res.data.alarms;
    if (Array.isArray(res.alarms)) return res.alarms;
  }
  return [];
}

export default function DashboardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSidebarVisible, setSidebarVisible] = useState(false);
  const [fullname, setFullname] = useState('Administrator');

  const [healthKpi, setHealthKpi] = useState<any>(null);
  const [vitalsCounts, setVitalsCounts] = useState<any>(null);
  const [autoKpi, setAutoKpi] = useState<any>(null);
  const [uptimeKpi, setUptimeKpi] = useState<any>(null);
  const [alarmKpi, setAlarmKpi] = useState({ major: 0, minor: 0, fire: 0, nightDoor: 0 });

  useEffect(() => {
    const loadName = async () => {
      const storedName = await AsyncStorage.getItem('user_fullname');
      if (storedName) setFullname(storedName);
    };
    loadName();
  }, []);

  useFocusEffect(
    useCallback(() => { fetchDashboardData(); }, [])
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Run calls individually so errors don't block each other
      let healthRes: any = null, vitalsRes: any = null, autoRes: any = null;
      let uptimeRes: any = null, smpsRes: any = null, rmsRes: any = null;

      try { healthRes = await api.getSiteHealthCounts({}); } catch(e) { console.log('[ERR] healthRes:', e); }
      try { vitalsRes = await api.getBatteryVitalsCounts({}); } catch(e) { console.log('[ERR] vitalsRes:', e); }
      try { autoRes = await api.getAutomationStatus({}); } catch(e) { console.log('[ERR] autoRes:', e); }
      try { uptimeRes = await api.getUptimeSummary({}); } catch(e) { console.log('[ERR] uptimeRes:', e); }
      try { smpsRes = await api.getSmpsAlarms({}); } catch(e) { console.log('[ERR] smpsRes:', e); }
      try { rmsRes = await api.getRmsAlarms({}); } catch(e) { console.log('[ERR] rmsRes:', e); }

      // ── DEBUG: Print raw API responses ──
      console.log('=== DASHBOARD DEBUG ===');
      console.log('[healthRes]', JSON.stringify(healthRes)?.slice(0, 400));
      console.log('[vitalsRes]', JSON.stringify(vitalsRes)?.slice(0, 400));
      console.log('[autoRes]', JSON.stringify(autoRes)?.slice(0, 400));
      console.log('[uptimeRes]', JSON.stringify(uptimeRes)?.slice(0, 400));
      console.log('[smpsRes]', JSON.stringify(smpsRes)?.slice(0, 200));
      console.log('[rmsRes]', JSON.stringify(rmsRes)?.slice(0, 200));

      // ── Site Health: Safe extraction ──
      if (healthRes) {
        const hData = healthRes.status === 'success' ? (healthRes.data || healthRes) : healthRes;
        console.log('[healthKpi set to]', JSON.stringify(hData)?.slice(0, 300));
        setHealthKpi(hData);
      }

      // ── Battery Vitals: Safe extraction ──
      if (vitalsRes) {
        console.log('[vitalsRes keys]', Object.keys(vitalsRes || {}));
        // getBatteryVitalsCounts already returns battery_analytics directly
        setVitalsCounts(vitalsRes);
        console.log('[vitalsCounts set to]', JSON.stringify(vitalsRes)?.slice(0, 300));
      }

      // ── Automation: Safe extraction ──
      if (autoRes) {
        const aData = autoRes.status === 'success' ? (autoRes.data || autoRes) : autoRes;
        console.log('[autoKpi set to]', JSON.stringify(aData)?.slice(0, 300));
        setAutoKpi(aData);
      }

      // ── Uptime: Robust extraction for state_report and summary ──
      if (uptimeRes) {
        const upMain = uptimeRes.status === 'success' ? (uptimeRes.data || uptimeRes) : uptimeRes;
        const report = upMain.state_report || uptimeRes.state_report || [];
        const summary = upMain.summary || uptimeRes.summary || upMain; 
        console.log('[uptimeKpi summary]', JSON.stringify(summary)?.slice(0, 300));
        console.log('[uptimeKpi report length]', report.length);

        setUptimeKpi({
          ...summary,
          total_met: report.reduce((s: number, r: any) => s + (r.sites_met_sla || 0), 0),
          total_not_met: report.reduce((s: number, r: any) => s + (r.sites_not_met_sla || 0), 0),
        });
      }

      // ── Alarms: tag + extract ──
      const smpsRaw = extractAlarmArray(smpsRes);
      const rmsRaw = extractAlarmArray(rmsRes);

      console.log(`[Alarms] SMPS raw count: ${smpsRaw.length}, TPMS raw count: ${rmsRaw.length}`);

      const smpsTagged = smpsRaw.map((a: any) => ({ ...a, alarm_type: 'smps' }));
      const rmsTagged = rmsRaw.map((a: any) => ({ ...a, alarm_type: 'tpms' }));

      const combined = [...smpsTagged, ...rmsTagged];

      // ✅ Filter out LLOP_FAULT + MAINS_AVAILABLE (same as website)
      const filtered = combined.filter(
        (a: any) => !isLLOPFaultAlarm(a) && !isMainsAvailableAlarm(a)
      );

      console.log(`[Alarms] After filter: ${filtered.length} (removed ${combined.length - filtered.length})`);

      // ✅ Deduplicate (same as website)
      const uniqueMap = new Map<string, any>();
      filtered.forEach((alarm: any) => {
        const key = getAlarmUniqueKey(alarm);
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, alarm);
        } else {
          // Keep the most recent one
          const existing = uniqueMap.get(key);
          const existingTime = new Date(existing.created_dt || existing.create_dt || existing.start_time || 0).getTime();
          const newTime = new Date(alarm.created_dt || alarm.create_dt || alarm.start_time || 0).getTime();
          if (newTime > existingTime) uniqueMap.set(key, alarm);
        }
      });

      const deduped = Array.from(uniqueMap.values());
      console.log(`[Alarms] After dedup: ${deduped.length}`);

      // ✅ Count by severity
      const counts = { major: 0, minor: 0, fire: 0, nightDoor: 0 };
      deduped.forEach((alarm: any) => {
        const sev = getSeverityFromAlarm(alarm);
        if (sev === 'Fire') counts.fire++;
        else if (sev === 'NightDoor') counts.nightDoor++;
        else if (sev === 'Major') counts.major++;
        else counts.minor++;
      });

      console.log(`[Alarms] Final counts → Major:${counts.major} Minor:${counts.minor} Fire:${counts.fire} Night:${counts.nightDoor}`);

      setAlarmKpi(counts);

    } catch (e) {
      console.log('Dashboard Load Error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const renderMiniKPI = (
    label: string, value: any, color: string, screen: string, params?: any
  ) => (
    <TouchableOpacity
      style={styles.miniKpi}
      onPress={() => navigation.navigate(screen as any, params || {})}
    >
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, { color }]}>{value ?? 0}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title="DASHBOARD"
        leftAction="menu"
        onLeftPress={() => setSidebarVisible(true)}
        rightActions={[{ icon: 'refresh-cw', onPress: fetchDashboardData }]}
      />

      <Sidebar
        isVisible={isSidebarVisible}
        onClose={() => setSidebarVisible(false)}
        navigation={navigation}
        fullname={fullname}
        handleLogout={async () => {
          await AsyncStorage.removeItem('user_fullname');
          await logoutApi();
          navigation.replace('Login');
        }}
        activeRoute="Dashboard"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchDashboardData(); }}
          />
        }
      >
        <Text style={styles.sectionTitle}>Real-Time Monitoring</Text>

        {/* 1. SITE HEALTH */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteHealth')}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerLeft}>
              <AppIcon name="heart" size={20} color="#10b981" style={{ marginRight: 10 }} />
              <Text style={styles.cardTitle}>Site Health</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            {renderMiniKPI('UP', healthKpi?.up_sites, '#10b981', 'SiteHealth', { status: 'up' })}
            {renderMiniKPI('DOWN', healthKpi?.down_sites, '#ef4444', 'SiteHealth', { status: 'down' })}
            {renderMiniKPI('NON-COMM', healthKpi?.non_comm_sites, '#f59e0b', 'SiteHealth', { status: 'non_comm' })}
          </View>
        </TouchableOpacity>

        {/* 2. SITE VITALS */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteVitals', { range: 'all' })}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerLeft}>
              <AppIcon name="activity" size={20} color="#3b82f6" style={{ marginRight: 10 }} />
              <Text style={styles.cardTitle}>Site Vitals</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            {renderMiniKPI('Critical', vitalsCounts?.critical?.count ?? vitalsCounts?.critical, '#ed4040', 'SiteVitals', { range: 'critical' })}
            {renderMiniKPI('At Risk', vitalsCounts?.low?.count ?? vitalsCounts?.low, '#014F86', 'SiteVitals', { range: 'low' })}
            {renderMiniKPI('Operational', vitalsCounts?.normal?.count ?? vitalsCounts?.normal, '#2A6F97', 'SiteVitals', { range: 'normal' })}
          </View>
          <View style={{ height: 15 }} />
          <View style={styles.statsRow}>
            {renderMiniKPI('Normal', vitalsCounts?.high?.count ?? vitalsCounts?.high, '#61A5C2', 'SiteVitals', { range: 'high' })}
            {renderMiniKPI('NA', vitalsCounts?.nc?.count ?? vitalsCounts?.nc, '#9e9e9e', 'SiteVitals', { range: 'na' })}
            {renderMiniKPI('Offline', vitalsCounts?.noncomm?.count ?? vitalsCounts?.noncomm, '#ef4444', 'SiteVitals', { range: 'noncomm' })}
          </View>
        </TouchableOpacity>

        {/* 3. SITE OPEN ALARM ANALYTICS */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('LiveAlarms', { severity: 'all' })}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerLeft}>
              <AppIcon name="bell" size={20} color="#ed4040" style={{ marginRight: 10 }} />
              <Text style={styles.cardTitle}>Site Open Alarm Analytics</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            {renderMiniKPI('Major', alarmKpi.major, '#f9a120', 'LiveAlarms', { severity: 'Major' })}
            {renderMiniKPI('Minor', alarmKpi.minor, '#eab308', 'LiveAlarms', { severity: 'Minor' })}
            {renderMiniKPI('Fire', alarmKpi.fire, '#ef4444', 'LiveAlarms', { severity: 'Fire' })}
            {renderMiniKPI('Night', alarmKpi.nightDoor, '#8b5cf6', 'LiveAlarms', { severity: 'NightDoor' })}
          </View>
        </TouchableOpacity>

        {/* 4. UPTIME SUMMARY */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('UptimeReport')}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerLeft}>
              <AppIcon name="trending-up" size={20} color="#01497C" style={{ marginRight: 10 }} />
              <Text style={styles.cardTitle}>Uptime Summary (RMS Data-MTD)</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>States</Text>
              <Text style={[styles.miniValue, { color: '#1e3c72' }]}>{uptimeKpi?.total_states || 0}</Text>
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>SLA Met</Text>
              <Text style={[styles.miniValue, { color: '#4caf50' }]}>{uptimeKpi?.total_met || 0}</Text>
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>SLA Not Met</Text>
              <Text style={[styles.miniValue, { color: '#f44336' }]}>{uptimeKpi?.total_not_met || 0}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 5. SITE AUTOMATION STATUS */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteAutomation')}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.headerLeft}>
              <AppIcon name="cpu" size={20} color="#61A5C2" style={{ marginRight: 10 }} />
              <Text style={styles.cardTitle}>Site Automation Status</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={styles.divider} />
          <View style={styles.statsRow}>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>Automated</Text>
              <Text style={[styles.miniValue, { color: '#61A5C2' }]}>{autoKpi?.under_automation || 0}</Text>
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>Manual</Text>
              <Text style={[styles.miniValue, { color: '#64748b' }]}>{autoKpi?.not_under_automation || 0}</Text>
            </View>
            <View style={styles.miniKpi}>
              <Text style={styles.miniLabel}>Rate</Text>
              <Text style={[styles.miniValue, { color: '#10b981' }]}>{autoKpi?.automation_percentage || 0}%</Text>
            </View>
          </View>
        </TouchableOpacity>

        {loading && <ActivityIndicator color="#1e3c72" style={{ marginVertical: 10 }} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  scrollContent: {
    padding: moderateScale(16),
    maxWidth: 650,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: verticalScale(30),
  },
  sectionTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: '700',
    color: '#1e3c72',
    marginBottom: verticalScale(16),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: verticalScale(16),
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: responsiveFontSize(14), fontWeight: '700', color: '#1e3c72' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: verticalScale(12) },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniKpi: { alignItems: 'center', flex: 1 },
  miniLabel: {
    fontSize: responsiveFontSize(10),
    color: '#888',
    fontWeight: 'bold',
    marginBottom: verticalScale(4),
    textTransform: 'uppercase',
  },
  miniValue: { fontSize: responsiveFontSize(17), fontWeight: '800' },
});