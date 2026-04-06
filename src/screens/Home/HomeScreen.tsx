import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, logoutApi } from '../../api';
import { useFocusEffect } from '@react-navigation/native';
import Sidebar from '../../components/Sidebar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';
import { moderateScale, responsiveFontSize, verticalScale, scale } from '../../utils/responsive';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good Morning', icon: 'sun', color: '#f59e0b' };
  if (hour < 17) return { text: 'Good Afternoon', icon: 'sun', color: '#fb923c' };
  if (hour < 21) return { text: 'Good Evening', icon: 'moon', color: '#818cf8' };
  return { text: 'Good Night', icon: 'moon', color: '#6366f1' };
};

const renderMiniKPI = (label: string, value: any, color: string) => {
  const displayValue = typeof value === 'object' && value !== null && 'count' in value ? value.count : value;
  return (
    <View style={styles.miniKpi}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={[styles.miniValue, { color }]}>{displayValue ?? 0}</Text>
    </View>
  );
};

export default function HomeScreen({ navigation, route }: any) {
  const [fullname, setFullname] = useState('Administrator');
  const [siteKpi, setSiteKpi] = useState<any>({ total_sites: 0, active_sites: 0, non_active_sites: 0 });
  const [runningKpi, setRunningKpi] = useState<any>({ total_soeb: 0, total_sodg: 0, total_sobt: 0 });
  const [distKpi, setDistKpi] = useState<any>({ bsc: 0, hub: 0, indoor: 0, outdoor: 0, eb: 0, dg: 0, rtt: 0, rtp: 0, gbt: 0, 'small-cell': 0 });
  const [offlineKpi, setOfflineKpi] = useState<any>({ total_non_comm: 0, aging_buckets: {} });
  const [loading, setLoading] = useState(false);
  const [isSidebarVisible, setSidebarVisible] = useState(false);

  useEffect(() => {
    const manageFullname = async () => {
      const paramName = route?.params?.fullname;
      if (paramName && paramName !== 'User') {
        await AsyncStorage.setItem('user_fullname', paramName);
        setFullname(paramName);
      } else {
        const storedName = await AsyncStorage.getItem('user_fullname');
        if (storedName) setFullname(storedName);
      }
    };
    manageFullname();
  }, [route?.params?.fullname]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboardData();
    }, [])
  );

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        api.getSiteStatus({}),
        api.getSiteRunningStatus({}),
        api.getSiteDistributionCounts({}),
        api.getNonCommAging({}),
        api.getDgPresence({}),
        api.getEbPresence({}),
      ]);

      const [siteRes, runningRes, distRes, offlineRes, dgRes, ebRes] = results;

      if (siteRes) {
        const raw = siteRes.status === 'success'
          ? (siteRes.data?.kpi || siteRes.kpi || siteRes.data || siteRes)
          : (siteRes.kpi || siteRes.data || siteRes);
        setSiteKpi({
          total_sites: raw.total_sites ?? raw.total ?? raw.total_site ?? raw.count ?? 0,
          active_sites: raw.active_sites ?? raw.up_sites ?? raw.up ?? raw.active ?? 0,
          non_active_sites: raw.non_active_sites ?? raw.down_sites ?? raw.down ?? raw.non_active ?? raw.offline ?? 0
        });
      }

      if (runningRes) {
        const raw = runningRes.counts || (runningRes.status === 'success' ? (runningRes.data?.counts || runningRes.data) : runningRes);
        setRunningKpi({
          total_soeb: raw.total_soeb ?? raw.soeb ?? raw.eb ?? 0,
          total_sodg: raw.total_sodg ?? raw.sodg ?? raw.dg ?? 0,
          total_sobt: raw.total_sobt ?? raw.sobt ?? raw.bt ?? 0
        });
      }

      let distRaw = distRes.counts || (distRes.status === 'success' ? (distRes.data?.counts || distRes.data) : (distRes.data || distRes));
      let mergedDist: any = {};
      if (distRaw && typeof distRaw === 'object' && !Array.isArray(distRaw)) {
        Object.values(distRaw).forEach(val => {
          if (val && typeof val === 'object' && !Array.isArray(val)) mergedDist = { ...mergedDist, ...val };
        });
        mergedDist = { ...mergedDist, ...distRaw };
      }
      if (Array.isArray(distRaw)) {
        distRaw.forEach(item => {
          const key = (item.site_type || item.type || item.label || '').toLowerCase().replace(/[\s-]/g, '_');
          if (key) mergedDist[key] = item.count ?? item.value ?? 0;
        });
      }
      mergedDist = {
        ...mergedDist,
        bsc: mergedDist.bsc ?? 0,
        hub: mergedDist.hub ?? 0,
        indoor: mergedDist.indoor ?? 0,
        outdoor: mergedDist.outdoor ?? 0,
        rtt: mergedDist.rtt ?? 0,
        rtp: mergedDist.rtp ?? 0,
        gbt: mergedDist.gbt ?? 0,
        small_cell: mergedDist.small_cell ?? mergedDist['small-cell'] ?? 0,
      };
      if (dgRes) {
        const dgRaw = dgRes.counts || (dgRes.status === 'success' ? (dgRes.data?.counts || dgRes.data) : (dgRes.data || dgRes));
        mergedDist.dg = dgRaw.dg_sites ?? dgRaw.dg ?? dgRaw.total_dg ?? dgRaw.dg_count ?? 0;
      }
      if (ebRes) {
        const ebRaw = ebRes.counts || (ebRes.status === 'success' ? (ebRes.data?.counts || ebRes.data) : (ebRes.data || ebRes));
        mergedDist.eb = ebRaw.eb_sites ?? ebRaw.eb ?? ebRaw.total_eb ?? ebRaw.eb_count ?? 0;
      }
      setDistKpi(mergedDist);

      if (offlineRes) {
        const offData = offlineRes.status === 'success' ? (offlineRes.data || offlineRes) : offlineRes;
        setOfflineKpi(offData);
      }
    } catch (error) {
      console.log('Dashboard Data Fetch Error', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('user_fullname');
    await logoutApi();
    navigation.replace('Login');
  };

  const MetricCard = ({ label, value, icon, color, siteType, title }: any) => (
    <TouchableOpacity
      style={styles.smallCard}
      onPress={() => navigation.navigate('SiteTypeDetails', { siteType, title, filters: {} })}
    >
      <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
        <AppIcon name={icon} size={20} color={color} />
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardValue}>{value || 0}</Text>
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <AppIcon name="chevron-right" size={18} color="#1e3c72" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader title="Home" leftAction="menu" onLeftPress={() => setSidebarVisible(true)} />
      <Sidebar isVisible={isSidebarVisible} onClose={() => setSidebarVisible(false)} navigation={navigation} fullname={fullname} handleLogout={handleLogout} activeRoute="Home" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 1. Site Status */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteStatus')}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="activity" size={20} color="#1e3c72" style={{ marginRight: 8 }} />
              <Text style={styles.cardHeader}>Site Status</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={styles.statsRow}>
            {renderMiniKPI('Total', siteKpi?.total_sites, '#1e3c72')}
            {renderMiniKPI('Active', siteKpi?.active_sites, '#10b981')}
            {renderMiniKPI('NON-ACTIVE', siteKpi?.non_active_sites, '#ef4444')}
          </View>
        </TouchableOpacity>

        {/* 2. Non-Comm Sites Aging */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('NonCommSites')}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="wifi-off" size={20} color="#dc2626" style={{ marginRight: 8 }} />
              <Text style={styles.cardHeader}>Non-Comm Sites Aging</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={[styles.statsRow, { marginBottom: 15 }]}>
            {renderMiniKPI('Total', offlineKpi?.total_non_comm, '#dc2626')}
            {renderMiniKPI('0-7 Days', offlineKpi?.aging_buckets?.['0-7 days'], '#ca8a04')}
            {renderMiniKPI('8-30 Days', offlineKpi?.aging_buckets?.['8-30 days'], '#ea580c')}
          </View>
          <View style={styles.statsRow}>
            {renderMiniKPI('31-60 Days', offlineKpi?.aging_buckets?.['31-60 days'], '#dc2626')}
            {renderMiniKPI('61-90 Days', offlineKpi?.aging_buckets?.['61-90 days'], '#991b1b')}
            {renderMiniKPI('90+ Days', offlineKpi?.aging_buckets?.['90+ days'], '#7f1d1d')}
          </View>
        </TouchableOpacity>

        {/* 3. Total BSC & Hub Sites */}
        <View style={styles.row}>
          <MetricCard label="BSC" value={distKpi.bsc} icon="layers" color="#0ea5e9" siteType="bsc" title="BSC Sites" />
          <MetricCard label="Hub" value={distKpi.hub} icon="server" color="#3b82f6" siteType="hub" title="Hub Sites" />
        </View>

        {/* 4. Site Running Status */}
        <TouchableOpacity style={styles.mainCard} onPress={() => navigation.navigate('SiteRunningStatus')}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="play-circle" size={20} color="#1e3c72" style={{ marginRight: 8 }} />
              <Text style={styles.cardHeader}>Site Running Status</Text>
            </View>
            <AppIcon name="chevron-right" size={20} color="#1e3c72" />
          </View>
          <View style={styles.statsRow}>
            {renderMiniKPI('SOEB', runningKpi?.total_soeb, '#10b981')}
            {renderMiniKPI('SODG', runningKpi?.total_sodg, '#f59e0b')}
            {renderMiniKPI('SOBT', runningKpi?.total_sobt, '#3b82f6')}
          </View>
        </TouchableOpacity>

        {/* 5 & 6. DG & EB Presence Status */}
        <View style={styles.row}>
          <MetricCard label="DG" value={distKpi.dg} icon="cpu" color="#f59e0b" siteType="dg" title="DG Presence Status" />
          <MetricCard label="EB" value={distKpi.eb} icon="zap" color="#10b981" siteType="eb" title="EB Presence Status" />
        </View>

        {/* 7. Site Indoor / Outdoor */}
        <View style={styles.row}>
          <MetricCard label="Indoor" value={distKpi.indoor} icon="home" color="#8b5cf6" siteType="indoor" title="Indoor Sites" />
          <MetricCard label="Outdoor" value={distKpi.outdoor} icon="sun" color="#ec4899" siteType="outdoor" title="Outdoor Sites" />
        </View>

        {/* 8. Site Type Distribution */}
        <Text style={styles.sectionTitle}>Site Type Distribution</Text>
        <View style={styles.grid}>
          {[
            { key: 'rtt', label: 'RTT', color: '#0ea5e9', icon: 'radio' },
            { key: 'rtp', label: 'RTP', color: '#3b82f6', icon: 'radio' },
            { key: 'gbt', label: 'GBT', color: '#6366f1', icon: 'radio' },
            { key: 'small-cell', label: 'Small Cell', color: '#8b5cf6', icon: 'radio' },
          ].map((item) => (
            <TouchableOpacity key={item.key} style={[styles.gridItem, { borderColor: item.color + '30' }]} onPress={() => navigation.navigate('SiteTypeDetails', { siteType: item.key, title: item.label + ' Sites', filters: {} })}>
              <View style={[styles.gridIcon, { backgroundColor: item.color + '10' }]}>
                <AppIcon name={item.icon as any} size={16} color={item.color} />
              </View>
              <Text style={[styles.gridValue, { color: item.color }]}>{distKpi[item.key.replace('-', '_')] || distKpi[item.key] || 0}</Text>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#c5d4eeff' },
  scrollContent: {
    padding: moderateScale(16),
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: verticalScale(30)
  },
  mainCard: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    marginBottom: verticalScale(16),
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: verticalScale(8),
    marginBottom: verticalScale(12)
  },
  cardHeader: { fontSize: responsiveFontSize(16), fontWeight: '700', color: '#1e3c72' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  miniKpi: { alignItems: 'center', flex: 1 },
  miniLabel: { fontSize: responsiveFontSize(11), color: '#888', fontWeight: 'bold', marginBottom: verticalScale(4), textTransform: 'uppercase' },
  miniValue: { fontSize: responsiveFontSize(18), fontWeight: '800' },
  row: { flexDirection: 'row', gap: moderateScale(12), marginBottom: verticalScale(12) },
  smallCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    padding: moderateScale(14),
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2
  },
  iconBox: {
    width: scale(38),
    height: scale(38),
    borderRadius: moderateScale(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: moderateScale(12)
  },
  cardInfo: { flex: 1 },
  cardValue: { fontSize: responsiveFontSize(18), fontWeight: '800', color: '#1e3c72' },
  cardLabel: { fontSize: responsiveFontSize(11), color: '#666', fontWeight: '600', textTransform: 'uppercase' },
  sectionTitle: {
    fontSize: responsiveFontSize(16),
    fontWeight: '700',
    color: '#1e3c72',
    marginTop: verticalScale(10),
    marginBottom: verticalScale(14),
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: moderateScale(12) },
  gridItem: {
    width: '48.2%',
    backgroundColor: '#fff',
    borderRadius: moderateScale(12),
    padding: moderateScale(16),
    borderWidth: 1.5,
    alignItems: 'center',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2
  },
  gridIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: verticalScale(10)
  },
  gridValue: { fontSize: responsiveFontSize(20), fontWeight: '800', marginBottom: verticalScale(2) },
  gridLabel: { fontSize: responsiveFontSize(11), fontWeight: '700', color: '#888', textTransform: 'uppercase' }
});