import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

type Props = NativeStackScreenProps<RootStackParamList, 'LiveAlarms'>;

// Helper to convert JSON array to CSV string
const convertToCSV = (objArray: any[]) => {
    if (!objArray || objArray.length === 0) return '';

    // Extract all unique headers from all objects
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

export default function LiveAlarmsScreen({ route, navigation }: Props) {
    const { severity: initialSeverity } = route.params || {};

    const [alarms, setAlarms] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [severityFilter, setSeverityFilter] = useState(initialSeverity || 'all');
    const [activeFilters, setActiveFilters] = useState({});
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const getSeverity = (alarm: any) => {
        const desc = (alarm.alarm_desc || alarm.alarm_name || '').toUpperCase();
        const start = alarm.start_time || alarm.create_dt || '';
        const hr = start ? new Date(start).getHours() : 12;

        if (desc.includes('FIRE') || desc.includes('SMOKE') || desc.includes('FSMK')) return 'Fire';
        if (desc.includes('DOOR') && (hr >= 22 || hr < 6)) return 'NightDoor';
        if (desc.includes('MAINS') || desc.includes('BATTERY') || desc.includes('DG') || desc.includes('TEMP')) return 'Major';
        return 'Minor';
    };

    const fetchAllAlarms = async (showLoading = false) => {
        if (showLoading && !refreshing) setLoading(true);
        try {
            const [smpsRes, rmsRes] = await Promise.all([
                api.getSmpsAlarms(activeFilters),
                api.getRmsAlarms(activeFilters)
            ]);

            const smpsData = Array.isArray(smpsRes) ? smpsRes : smpsRes.data || [];
            const rmsData = Array.isArray(rmsRes) ? rmsRes : (rmsRes.status === 'success' ? rmsRes.data : []);
            let combined = [...smpsData, ...rmsData];

            // Client-side severity and status filtering
            combined = combined.filter((a) => {
                const severity = getSeverity(a);
                const status = a.alarm_status || (a.end_time ? 'Closed' : 'Open');

                if (severityFilter === 'Open' || severityFilter === 'Closed') {
                    if (status !== severityFilter) return false;
                } else if (severityFilter !== 'all') {
                    if (severity !== severityFilter) return false;
                }
                return true;
            });

            combined.sort((a, b) => new Date(b.start_time || b.create_dt || 0).getTime() - new Date(a.start_time || a.create_dt || 0).getTime());
            setAlarms(combined);
        } catch (e) {
            console.error('Alarm Fetch Error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchAllAlarms(true);
    }, [activeFilters, severityFilter]);

    useEffect(() => {
        if (route.params?.severity) {
            setSeverityFilter(route.params.severity);
        }
    }, [route.params?.severity]);

    const handleExport = async () => {
        setExporting(true);
        try {
            // Fetch a larger set specifically for export to respect "Download All"
            const [smpsRes, rmsRes] = await Promise.all([
                api.getSmpsAlarms(activeFilters, 1000),
                api.getRmsAlarms(activeFilters, 1000)
            ]);

            const smpsData = Array.isArray(smpsRes) ? smpsRes : smpsRes.data || [];
            const rmsData = Array.isArray(rmsRes) ? rmsRes : (rmsRes.status === 'success' ? rmsRes.data : []);
            let combined = [...smpsData, ...rmsData];

            // Client-side severity filtering (same logic as display)
            combined = combined.filter((a) => {
                const severity = getSeverity(a);
                const status = a.alarm_status || (a.end_time ? 'Closed' : 'Open');

                if (severityFilter === 'Open' || severityFilter === 'Closed') {
                    if (status !== severityFilter) return false;
                } else if (severityFilter !== 'all') {
                    if (severity !== severityFilter) return false;
                }
                return true;
            });

            if (combined.length === 0) {
                Alert.alert("No Data", "No alarms found with current filters.");
                return;
            }

            const csvString = convertToCSV(combined);
            const fileName = `Live_Alarms_${new Date().getTime()}.csv`;
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
                Alert.alert("Export Error", "Failed to generate or open export data.");
                console.error(error);
            }
        } finally {
            setExporting(false);
        }
    };

    const renderAlarmCard = ({ item }: { item: any }) => {
        const status = item.alarm_status || (item.end_time ? 'Closed' : 'Open');
        const severity = getSeverity(item);
        const colors: any = { Fire: '#ef4444', NightDoor: '#8b5cf6', Major: '#f59e0b', Minor: '#eab308' };

        return (
            <TouchableOpacity
                style={[styles.card, { borderLeftColor: colors[severity] || '#94a3b8' }]}
                onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.siteName} numberOfLines={1}>{item.site_name || 'Unnamed Site'}</Text>
                        <Text style={styles.siteId}>{item.global_id || item.site_id || item.imei}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: status === 'Open' ? '#fee2e2' : '#dcfce7' }]}>
                        <Text style={[styles.badgeText, { color: status === 'Open' ? '#ef4444' : '#22c55e' }]}>
                            {status === 'Open' ? 'ACTIVE' : 'CLOSED'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.alarmDesc} numberOfLines={2}>{item.alarm_desc || item.alarm_name}</Text>

                <View style={styles.infoRow}>
                    <View style={styles.infoBox}><AppIcon name="zap" size={12} color="#64748b" /><Text style={styles.infoText}> {item.site_running_status || 'N/A'}</Text></View>
                    <View style={styles.infoBox}><AppIcon name="clock" size={12} color="#64748b" /><Text style={styles.infoText}> {item.active_time_formatted || 'Active'}</Text></View>
                    <View style={[styles.infoBox, { borderRightWidth: 0 }]}><AppIcon name="activity" size={12} color="#1e3c72" /><Text style={[styles.infoText, { fontWeight: '700', color: '#1e3c72' }]}> {item.start_volt ? `${parseFloat(item.start_volt).toFixed(2)}V` : 'N/A'}</Text></View>
                </View>

                <View style={styles.cardFooter}>
                    <Text style={styles.footerTime}>Started: {new Date(item.start_time || item.create_dt || 0).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</Text>
                </View>
            </TouchableOpacity>
        );
    };

    const filteredAlarms = useMemo(() => {
        return alarms.filter(item => 
            (item.site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (item.site_id || item.imei || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.alarm_desc || item.alarm_name || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [alarms, searchQuery]);

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
                <AppHeader
                    title="Alarms Feed"
                    subtitle={`Live Monitoring (${alarms.length})`}
                    leftAction="back"
                    onLeftPress={() => navigation.goBack()}
                    rightActions={[
                        { icon: exporting ? 'loader' : 'download', onPress: handleExport },
                        { icon: 'filter', onPress: () => setFilterModalVisible(true), badge: Object.keys(activeFilters).length > 0 },
                    ]}
                />

                <FilterModal
                    visible={filterModalVisible}
                    onClose={() => setFilterModalVisible(false)}
                    onApply={(f) => { setActiveFilters(f); setFilterModalVisible(false); }}
                    initialFilters={activeFilters}
                />

                <View style={styles.filterWrapper}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
                        {['all', 'Open', 'Closed', 'Major', 'Minor', 'Fire', 'NightDoor'].map((f) => (
                            <TouchableOpacity key={f} style={[styles.filterBtn, severityFilter === f && styles.filterBtnActive]} onPress={() => setSeverityFilter(f)}>
                                <Text style={[styles.filterBtnText, severityFilter === f && { color: '#fff' }]}>{f === 'all' ? 'All Alarms' : f === 'Open' ? 'Active' : f}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by ID, Name or Alert..."
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

                {loading && !refreshing ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color="#1e3c72" />
                        <Text style={styles.loadingText}>Fetching Alarms...</Text>
                    </View>
                ) : (
                    <FlatList
                        data={filteredAlarms}
                        keyExtractor={(_, index) => index.toString()}
                        renderItem={renderAlarmCard}
                        contentContainerStyle={{ padding: 12 }}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAllAlarms(true); }} />}
                        ListEmptyComponent={
                            !loading && filteredAlarms.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <AppIcon name="search" size={48} color="#cbd5e1" />
                                    <Text style={styles.emptyText}>No Data Found</Text>
                                    <Text style={styles.emptySubtitle}>Try searching with different criteria.</Text>
                                </View>
                            ) : null
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    backBtn: { marginRight: 8 },
    headerSub: { color: '#94a3b8', fontSize: 12 },
    iconBtn: { padding: 8, position: 'relative' },
    activeFilterDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },

    filterWrapper: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    filterBar: { padding: 12, gap: 8 },
    filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
    filterBtnActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
    filterBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },

    searchContainer: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        height: 48,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#1e293b',
        height: '100%',
        padding: 0,
    },
    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
    emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },

    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderLeftWidth: 5, elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    siteName: { fontSize: 15, fontWeight: '800', color: '#1e293b' },
    siteId: { fontSize: 11, color: '#64748b' },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: '900' },
    alarmDesc: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 12, lineHeight: 20 },
    infoRow: { flexDirection: 'row', backgroundColor: '#f8fafc', borderRadius: 8, padding: 10, marginBottom: 8 },
    infoBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRightWidth: 1, borderRightColor: '#e2e8f0', justifyContent: 'center', gap: 4 },
    infoText: { fontSize: 11, color: '#475569', fontWeight: '500' },
    cardFooter: { marginTop: 4 },
    footerTime: { fontSize: 10, color: '#94a3b8', fontStyle: 'italic' },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
    loadingText: { marginTop: 15, fontSize: 14, color: '#64748b' },
});