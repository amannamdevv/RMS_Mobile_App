import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity,
    ActivityIndicator, RefreshControl, Alert, ScrollView, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import FilterModal from '../../components/FilterModal';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'SiteVitals'>;

// Helper to convert JSON array to CSV string
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

const VITAL_RANGES = [
    { label: 'All', value: 'all', icon: 'list' },
    { label: 'Critical', value: 'critical', icon: 'alert-circle' },
    { label: 'At Risk', value: 'low', icon: 'shield-off' },
    { label: 'Operational', value: 'normal', icon: 'check-circle' },
    { label: 'Normal', value: 'high', icon: 'trending-up' },
    { label: 'NA', value: 'na', icon: 'help-circle' },
    { label: 'Offline', value: 'noncomm', icon: 'wifi-off' },
];

export default function SiteVitalsScreen({ route, navigation }: Props) {
    // Params like 'range' can come from Dashboard navigation
    const { range } = route.params || {};

    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [hasNext, setHasNext] = useState(true);
    const [totalSites, setTotalSites] = useState(0);
    const [rangeLabel, setRangeLabel] = useState('All Sites');
    const [searchQuery, setSearchQuery] = useState('');

    const [activeFilters, setActiveFilters] = useState<any>(range ? { range } : {});
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    // Sync filters if range changes from navigation (Sidebar)
    useEffect(() => {
        if (route.params?.range) {
            setActiveFilters((prev: any) => ({ ...prev, range: route.params?.range }));
        }
    }, [route.params?.range]);

    useEffect(() => {
        fetchData(1, true);
    }, [activeFilters]);

    const fetchData = async (pageNum = 1, isRefresh = false) => {
        if (loading && !isRefresh) return;
        setLoading(true);
        try {
            const res = await api.getSiteVitals(activeFilters, pageNum);

            if (res && res.sites) {
                if (isRefresh) setData(res.sites);
                else setData(prev => [...prev, ...res.sites]);

                setTotalSites(res.total_sites);
                setRangeLabel(res.range_label);
                setHasNext(res.has_next);
                setPage(pageNum);
            }
        } catch (e) {
            console.error("Vitals API Error:", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            // Fetch a comprehensive set for export to respect "Download All"
            const res = await api.getSiteVitals(activeFilters, 1, 10000);
            if (res && res.sites) {
                if (res.sites.length === 0) {
                    Alert.alert("No Data", "There is no data to export with the current filters.");
                    return;
                }
                const csvString = convertToCSV(res.sites);
                const fileName = `Site_Vitals_${new Date().getTime()}.csv`;
                const filePath = `${RNFS.CachesDirectoryPath}/${fileName}`;

                await RNFS.writeFile(filePath, csvString, 'utf8');
                await Share.open({
                    title: 'Export Site Vitals',
                    url: `file://${filePath}`,
                    type: 'text/csv',
                    filename: fileName,
                    showAppsToView: true,
                });
            }
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                Alert.alert("Export Error", "Failed to generate or open export data.");
                console.error(error);
            }
        } finally {
            setExporting(false);
        }
    };

    const getVoltageStyle = (voltage: any) => {
        if (!voltage || voltage === '0.00' || isNaN(parseFloat(voltage))) return { color: '#9e9e9e', label: 'NA' };
        const v = parseFloat(voltage);
        if (v <= 47) return { color: '#f44336', label: `${v.toFixed(2)}V` }; // Critical
        if (v <= 49) return { color: '#ff9800', label: `${v.toFixed(2)}V` }; // Low
        if (v <= 54.5) return { color: '#2196f3', label: `${v.toFixed(2)}V` }; // Operational
        return { color: '#4caf50', label: `${v.toFixed(2)}V` }; // High
    };

    const renderCard = ({ item }: { item: any }) => {
        const vStyle = getVoltageStyle(item.battery_v);

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('SiteDetails', { imei: item.imei, siteId: item.site_id })}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.siteName}>{item.site_name || 'Unnamed Site'}</Text>
                        <Text style={styles.subText}>ID: {item.site_id} | {item.imei}</Text>
                    </View>
                    <View style={[styles.voltageBox, { backgroundColor: vStyle.color + '15' }]}>
                        <Text style={[styles.voltageText, { color: vStyle.color }]}>{vStyle.label}</Text>
                        <Text style={styles.miniLabel}>Battery</Text>
                    </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.infoRow}>
                    <View style={styles.infoCol}>
                        <AppIcon name="map-pin" size={12} color="#666" />
                        <Text style={styles.infoValue}>{item.state_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoCol}>
                        <AppIcon name="grid" size={12} color="#666" />
                        <Text style={styles.infoValue}>{item.dist_name || 'N/A'}</Text>
                    </View>
                    <View style={styles.infoCol}>
                        <AppIcon name="layers" size={12} color="#666" />
                        <Text style={styles.infoValue}>{item.cluster_name || 'N/A'}</Text>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const filteredSites = data.filter(item => 
        (item.site_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (item.site_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.imei || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={{ flex: 1, alignSelf: 'center', width: '100%', maxWidth: 650 }}>
            <AppHeader
                title="Site Vitals"
                subtitle={rangeLabel}
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
                onApply={(f: any) => { setActiveFilters(f); setFilterModalVisible(false); }}
                initialFilters={activeFilters}
            />

            {/* Range Filters */}
            <View style={styles.filterBar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
                    {VITAL_RANGES.map((r) => {
                        const isActive = (activeFilters.range || 'all') === r.value;
                        return (
                            <TouchableOpacity
                                key={r.value}
                                style={[styles.filterPill, isActive && styles.filterPillActive]}
                                onPress={() => setActiveFilters((prev: any) => ({ ...prev, range: r.value }))}
                                activeOpacity={0.7}
                            >
                                <AppIcon
                                    name={r.icon as any}
                                    size={14}
                                    color={isActive ? '#fff' : '#64748b'}
                                    style={{ marginRight: 6 }}
                                />
                                <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                                    {r.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <AppIcon name="search" size={18} color="#64748b" style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search by ID, Name or IMEI..."
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

            <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
                    {totalSites} Sites showing in {rangeLabel}
                </Text>
            </View>

            <FlatList
                data={filteredSites}
                keyExtractor={(item, index) => (item.imei || index).toString()}
                renderItem={renderCard}
                contentContainerStyle={{ padding: 16 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchData(1, true)} />}
                onEndReached={() => hasNext && fetchData(page + 1)}
                onEndReachedThreshold={0.5}
                ListFooterComponent={loading ? <ActivityIndicator size="small" color="#1e3c72" style={{ margin: 20 }} /> : null}
                ListEmptyComponent={
                    !loading && filteredSites.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <AppIcon name="search" size={48} color="#cbd5e1" />
                            <Text style={styles.emptyText}>No Data Found</Text>
                            <Text style={styles.emptySubtitle}>Try searching with different criteria.</Text>
                        </View>
                    ) : null
                }
            />
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#c5d4eeff' },
    backBtn: { paddingRight: 15 },
    headerSub: { color: '#A9D6E5', fontSize: 12 },
    iconBtn: { padding: 8, position: 'relative' },
    activeFilterDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#1e3c72' },

    filterBar: { backgroundColor: '#fff', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
    filterPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#f1f5f9', marginHorizontal: 5, borderWidth: 1, borderColor: '#e2e8f0' },
    filterPillActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
    filterText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
    filterTextActive: { color: '#fff' },

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
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, fontWeight: '700', color: '#334155', marginTop: 12 },
    emptySubtitle: { fontSize: 14, color: '#94a3b8', marginTop: 4 },

    card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    siteName: { fontSize: 15, fontWeight: '700', color: '#1e3c72', marginBottom: 2 },
    subText: { fontSize: 11, color: '#666' },

    voltageBox: { padding: 8, borderRadius: 8, alignItems: 'center', minWidth: 70 },
    voltageText: { fontSize: 16, fontWeight: '800' },
    miniLabel: { fontSize: 9, color: '#666', textTransform: 'uppercase', fontWeight: 'bold' },

    divider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 12 },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
    infoCol: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1 },
    infoValue: { fontSize: 11, color: '#444', fontWeight: '500' },
});