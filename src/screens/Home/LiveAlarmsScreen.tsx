import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, ScrollView, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

// ✅ Import shared utilities
import {
    getSeverity, getAlarmName, getAlarmStatus, getAlarmKey,
    shouldFilterOut, normaliseAndMerge, smpsAlarmFieldMapping,
    calcAlarmKpi
} from '../../utils/alarmUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveAlarms'>;

// ─────────────────────────────────────────────
// CSV helper
// ─────────────────────────────────────────────
const convertToCSV = (objArray: any[]) => {
    if (!objArray || objArray.length === 0) return '';
    const allHeadersSet = new Set<string>();
    objArray.forEach(obj => Object.keys(obj).forEach(key => allHeadersSet.add(key)));
    const headers = Array.from(allHeadersSet);
    const csvRows = [headers.join(',')];
    for (const row of objArray) {
        const values = headers.map(header => {
            const val = row[header] !== null && row[header] !== undefined ? String(row[header]) : '';
            return `"${val.replace(/"/g, '""')}"`;
        });
        csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
};

// ─────────────────────────────────────────────
// SMPS alarm field → human-readable name
// (mirrors backend alarm_field_mapping)
// ─────────────────────────────────────────────
// Helper functions removed — now using imports from ../../utils/alarmUtils

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export default function LiveAlarmsScreen({ route, navigation }: Props) {
    const { severity: initialSeverity } = (route.params as any) || {};

    const [alarms, setAlarms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [severityFilter, setSeverityFilter] = useState<string>(initialSeverity || 'all');
    const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ─── Fetch ────────────────────────────────
    const fetchAllAlarms = useCallback(
        async (showLoading = false) => {
            if (showLoading && !refreshing) setLoading(true);
            try {
                const [smpsRes, rmsRes] = await Promise.all([
                    api.getSmpsAlarms(activeFilters).catch(() => []),
                    api.getRmsAlarms(activeFilters).catch(() => []),
                ]);

                // ── Merge, Normalise & Dedup via Shared Utility ──
                const merged = normaliseAndMerge(smpsRes, rmsRes);
                setAlarms(merged);
            } catch (e) {
                console.error('Alarm Fetch Error:', e);
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [activeFilters, refreshing]
    );

    // ─── Effects ──────────────────────────────
    useEffect(() => {
        fetchAllAlarms(true);
        intervalRef.current = setInterval(() => fetchAllAlarms(false), 30000);
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [activeFilters]);

    useEffect(() => {
        if ((route.params as any)?.severity) {
            setSeverityFilter((route.params as any).severity);
        }
    }, [(route.params as any)?.severity]);

    // ─── Client-side filter ───────────────────
    const filteredAlarms = useMemo(() => {
        return alarms.filter(alarm => {
            const severity = getSeverity(alarm);
            const status = getAlarmStatus(alarm);

            // Severity / status filter
            if (severityFilter !== 'all') {
                if (severityFilter === 'Open' && status !== 'Open') return false;
                if (severityFilter === 'Closed' && status !== 'Closed') return false;
                if (!['Open', 'Closed'].includes(severityFilter) && severity !== severityFilter) return false;
            }

            // Search query
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const name = (alarm.alarm_name || alarm.alarm_desc || '').toLowerCase();
                const site = (alarm.site_name || '').toLowerCase();
                const id = (alarm.global_id || alarm.globel_id || alarm.site_id || alarm.imei || '').toLowerCase();
                if (!name.includes(q) && !site.includes(q) && !id.includes(q)) return false;
            }

            return true;
        });
    }, [alarms, severityFilter, searchQuery]);

    // ─── KPI counts ───────────────────────────
    const kpiCounts = useMemo(() => calcAlarmKpi(alarms), [alarms]);

    // ─── Export ───────────────────────────────
    const handleExport = async () => {
        setExporting(true);
        try {
            const exportRows = filteredAlarms.map(alarm => ({
                'Global ID': alarm.global_id || alarm.globel_id || 'N/A',
                'Site Name': alarm.site_name || 'N/A',
                'Alarm': getAlarmName(alarm),
                'Severity': getSeverity(alarm),
                'Status': getAlarmStatus(alarm),
                'Site Status': alarm.site_running_status || 'N/A',
                'Active Time': alarm.active_time_formatted || 'N/A',
                'Start Time': alarm.start_time || alarm.create_dt || 'N/A',
                'End Time': alarm.end_time || 'N/A',
                'Alarm Type': alarm._alarmSource === 'tpms' ? 'RMS' : (alarm.source_table || 'SMPS'),
                'Device Make': alarm.device_make || 'N/A',
                'Start Volt': alarm.start_volt != null ? `${parseFloat(alarm.start_volt).toFixed(2)}V` : 'N/A',
                'End Volt': alarm.end_volt != null ? `${parseFloat(alarm.end_volt).toFixed(2)}V` : 'N/A',
            }));

            if (exportRows.length === 0) {
                Alert.alert('No Data', 'No alarms found with current filters.');
                return;
            }

            const csvString = convertToCSV(exportRows);
            const fileName = `Live_Alarms_${Date.now()}.csv`;
            const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;
            await RNFS.writeFile(filePath, csvString, 'utf8');
            await Share.open({
                title: 'Export Live Alarms',
                url: `file://${filePath}`,
                type: 'text/csv',
                filename: fileName,
                showAppsToView: true,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert('Export Error', 'Failed to generate export file.');
                console.error(error);
            }
        } finally {
            setExporting(false);
        }
    };

    // ─── Render card ──────────────────────────
    // ─── Render card ──────────────────────────
    const renderAlarmCard = ({ item }: { item: any }) => {
        const status = getAlarmStatus(item);
        const severity = getSeverity(item);
        const alarmName = getAlarmName(item);
        const globalId = item.global_id || item.globel_id || item.site_id || item.imei || 'N/A';
        const siteStatus = item.site_running_status || 'N/A';
        const alarmType = item._alarmSource === 'tpms' ? 'RMS' : (item.alarm_type || item.type || 'SMPS');
        const deviceMake = item.device_make || item.make || 'N/A';

        const startVolt = item.start_volt != null ? `${parseFloat(item.start_volt).toFixed(2)}V` : 'N/A';
        const endVolt = item.end_volt != null ? `${parseFloat(item.end_volt).toFixed(2)}V` : 'N/A';

        const severityColors: Record<string, string> = {
            Fire: '#ef4444',
            NightDoor: '#8b5cf6',
            Major: '#f59e0b',
            Minor: '#eab308',
        };
        const borderColor = severityColors[severity] || '#94a3b8';

        const formatDate = (ts: any) => {
            if (!ts || ts === '—' || ts === 'None') return '—';
            const d = new Date(ts);
            // If it's a valid date, format it nicely
            if (!isNaN(d.getTime())) {
                return d.toLocaleString([], {
                    hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', year: 'numeric'
                });
            }
            // If it's already a string (like "4/11/2026 05:21 PM"), return it as is
            return String(ts);
        };

        const siteStatusColor = siteStatus === 'SOEB' ? '#10b981' : siteStatus === 'SODG' ? '#f59e0b' : siteStatus === 'SOBT' ? '#ef4444' : '#64748b';

        return (
            <TouchableOpacity
                style={[styles.card, { borderLeftColor: borderColor }]}
                onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
                activeOpacity={0.85}
            >
                {/* Header: Site & Global ID */}
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.siteName}>{item.site_name || 'Unnamed Site'}</Text>
                        <Text style={styles.siteId}>Global ID: {globalId}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: status === 'Open' ? '#fee2e2' : '#dcfce7' }]}>
                        <Text style={[styles.badgeText, { color: status === 'Open' ? '#ef4444' : '#22c55e' }]}>
                            {status === 'Open' ? 'ACTIVE' : 'CLOSED'}
                        </Text>
                    </View>
                </View>

                {/* Alarm Name & Severity */}
                <View style={styles.alarmTitleRow}>
                    <Text style={styles.alarmDesc} numberOfLines={2}>{alarmName}</Text>
                    <Text style={[styles.sevText, { color: borderColor }]}>{severity.toUpperCase()}</Text>
                </View>

                {/* Grid-like Data Rows */}
                <View style={styles.metadataContainer}>
                    {/* Row 1: Site Status, Active Time, Device Make */}
                    <View style={styles.metaRow}>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>Site Status</Text>
                            <Text style={[styles.metaValue, { color: siteStatusColor }]}>{siteStatus}</Text>
                        </View>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>Active Time</Text>
                            <Text style={styles.metaValue}>{item.active_time_formatted || '—'}</Text>
                        </View>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>Device Make</Text>
                            <Text style={styles.metaValue}>{deviceMake}</Text>
                        </View>
                    </View>

                    {/* Row 2: Voltages & Type */}
                    <View style={styles.metaRow}>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>Start Volt</Text>
                            <Text style={[styles.metaValue, { color: '#1e3c72' }]}>{startVolt}</Text>
                        </View>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>End Volt</Text>
                            <Text style={[styles.metaValue, { color: '#64748b' }]}>{endVolt}</Text>
                        </View>
                        <View style={styles.metaCol}>
                            <Text style={styles.metaLabel}>Alarm Type</Text>
                            <Text style={styles.metaValue}>{alarmType}</Text>
                        </View>
                    </View>

                    {/* Row 3: Timestamps */}
                    <View style={[styles.metaRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                        <View style={[styles.metaCol, { flex: 2 }]}>
                            <Text style={styles.metaLabel}>Start Time</Text>
                            <Text style={styles.metaValue}>{formatDate(item.start_time_display || item.start_time || item.create_dt || item.created_dt)}</Text>
                        </View>
                        <View style={[styles.metaCol, { flex: 2 }]}>
                            <Text style={styles.metaLabel}>End Time</Text>
                            <Text style={styles.metaValue}>{formatDate(item.end_time_display || item.end_time)}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    // ─── KPI pill ─────────────────────────────
    const KpiPill = ({
        label,
        count,
        filter,
        color,
    }: {
        label: string;
        count: number;
        filter: string;
        color: string;
    }) => (
        <TouchableOpacity
            style={[
                styles.kpiPill,
                severityFilter === filter && { borderColor: color, backgroundColor: color + '18' },
            ]}
            onPress={() => setSeverityFilter(filter)}
        >
            <Text style={[styles.kpiCount, { color }]}>{count}</Text>
            <Text style={styles.kpiLabel}>{label}</Text>
        </TouchableOpacity>
    );

    // ─── Render ───────────────────────────────
    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="Alarms Feed"
                    subtitle={`Live Monitoring (${filteredAlarms.length})`}
                    leftAction="back"
                    onLeftPress={() => navigation.goBack()}
                    rightActions={[
                        { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                        {
                            icon: 'filter',
                            onPress: () => setFilterModalVisible(true),
                            badge: Object.keys(activeFilters).length > 0,
                        },
                    ]}
                />

                <FilterModal
                    visible={filterModalVisible}
                    onClose={() => setFilterModalVisible(false)}
                    onApply={f => {
                        setActiveFilters(f);
                        setFilterModalVisible(false);
                    }}
                    initialFilters={activeFilters}
                />



                {/* Filter bar */}
                <View style={styles.filterWrapper}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.filterBar}
                    >
                        {[
                            { key: 'all', label: 'All Alarms' },
                            { key: 'Open', label: 'Active' },
                            { key: 'Closed', label: 'Closed' },
                            { key: 'Major', label: 'Major' },
                            { key: 'Minor', label: 'Minor' },
                            { key: 'Fire', label: 'Fire & Smoke' },
                            { key: 'NightDoor', label: 'Night Door' },
                        ].map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[
                                    styles.filterBtn,
                                    severityFilter === f.key && styles.filterBtnActive,
                                ]}
                                onPress={() => setSeverityFilter(f.key)}
                            >
                                <Text
                                    style={[
                                        styles.filterBtnText,
                                        severityFilter === f.key && { color: '#fff' },
                                    ]}
                                >
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Search bar */}
                <View style={styles.searchContainer}>
                    <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search site, ID or alarm…"
                        placeholderTextColor="#94a3b8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <AppIcon name="x" size={18} color="#64748b" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* List */}
                {loading && !refreshing ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#1e3c72" />
                        <Text style={styles.loadingText}>Fetching Alarms…</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredAlarms}
                        keyExtractor={(_, index) => index.toString()}
                        renderItem={renderAlarmCard}
                        contentContainerStyle={{ padding: 12, paddingBottom: 30 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    fetchAllAlarms(true);
                                }}
                            />
                        }
                        ListEmptyComponent={
                            !loading ? (
                                <View style={styles.emptyContainer}>
                                    <AppIcon name="bell-off" size={48} color="#cbd5e1" />
                                    <Text style={styles.emptyText}>No Alarms Found</Text>
                                    <Text style={styles.emptySubtitle}>
                                        Try changing the filter or refreshing.
                                    </Text>
                                </View>
                            ) : null
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4ee' },

    kpiStrip: {
        flexDirection: 'row',
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#fff',
        gap: 6,
        flexWrap: 'wrap',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    kpiPill: {
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        backgroundColor: '#f8fafc',
        minWidth: 52,
    },
    kpiCount: { fontSize: 18, fontWeight: '800' },
    kpiLabel: { fontSize: 9, color: '#64748b', fontWeight: '600', marginTop: 1 },

    filterWrapper: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    filterBar: { padding: 10, gap: 8 },
    filterBtn: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    filterBtnActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
    filterBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },

    searchContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 14,
        marginTop: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 2,
        height: 46,
    },
    searchIcon: { marginRight: 8 },
    searchInput: { flex: 1, fontSize: 14, color: '#1e293b', height: '100%', padding: 0 },

    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderLeftWidth: 5,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    siteName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
    siteId: { fontSize: 11, color: '#64748b', marginTop: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: '900' },

    alarmTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    alarmDesc: { flex: 1, fontSize: 13, fontWeight: '800', color: '#1e293b', lineHeight: 18, marginRight: 10 },
    sevText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

    metadataContainer: { backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, gap: 10 },
    metaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8 },
    metaCol: { flex: 1, gap: 2 },
    metaLabel: { fontSize: 9, color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' },
    metaValue: { fontSize: 11, color: '#334155', fontWeight: '700' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 80 },
    loadingText: { marginTop: 12, fontSize: 14, color: '#64748b' },

    emptyContainer: { alignItems: 'center', marginTop: 80 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
    emptySubtitle: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
});