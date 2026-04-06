import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ScrollView, 
  Platform, ActivityIndicator 
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Feather';
import { api } from '../api';
import { moderateScale, responsiveFontSize, verticalScale, scale } from '../utils/responsive';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: any) => void;
  initialFilters?: any;
}

const FilterModal = ({ visible, onClose, onApply, initialFilters = {} }: FilterModalProps) => {
  const [states, setStates] = useState<any[]>([]);
  const [districts, setDistricts] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  
  // Metadata for dropdowns
  const [customers, setCustomers] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [siteStatuses, setSiteStatuses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [subCategories, setSubCategories] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);

  // Selection States
  const [selectedState, setSelectedState] = useState(initialFilters?.state_id || '');
  const [selectedDistrict, setSelectedDistrict] = useState(initialFilters?.district_id || '');
  const [selectedCluster, setSelectedCluster] = useState(initialFilters?.cluster_id || '');
  
  const [searchType, setSearchType] = useState(initialFilters?.search_type || '');
  const [siteId, setSiteId] = useState(initialFilters?.site_id || '');
  const [imei, setImei] = useState(initialFilters?.imei || '');
  const [globalId, setGlobalId] = useState(initialFilters?.global_id || '');
  const [siteName, setSiteName] = useState(initialFilters?.site_name || '');
  
  // New Fields
  const [alarmType, setAlarmType] = useState(initialFilters?.alarm_t || 'all');
  const [selectedCustomer, setSelectedCustomer] = useState(initialFilters?.customer_id || '');
  const [selectedOperator, setSelectedOperator] = useState(initialFilters?.operator_id || '');
  const [selectedStatus, setSelectedStatus] = useState(initialFilters?.site_status || '');
  const [selectedCategory, setSelectedCategory] = useState(initialFilters?.site_category || '');
  const [selectedSubCategory, setSelectedSubCategory] = useState(initialFilters?.site_sub_category || '');
  const [customerSiteId, setCustomerSiteId] = useState(initialFilters?.customer_site_id || '');
  const [selectedTechnician, setSelectedTechnician] = useState(initialFilters?.technician_id || '');
  const [selectedTenant, setSelectedTenant] = useState(initialFilters?.tenant_id || '');
  const [selectedSiteType, setSelectedSiteType] = useState(initialFilters?.site_type || '');
  const [selectedSiteOn, setSelectedSiteOn] = useState(initialFilters?.site_on || '');

  const [fromDate, setFromDate] = useState<Date | null>(initialFilters?.date_from ? new Date(initialFilters.date_from) : null);
  const [toDate, setToDate] = useState<Date | null>(initialFilters?.date_to ? new Date(initialFilters.date_to) : null);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadAllMetadata();
      if (initialFilters?.state_id) loadDistricts(initialFilters.state_id);
      if (initialFilters?.district_id) loadClusters(initialFilters.district_id);
    }
  }, [visible]);

  const loadAllMetadata = async () => {
    try {
      setLoading(true);
      const [st, cust, op, stat, cat, sub, tech, ten] = await Promise.all([
        api.getStates(),
        api.getMetadata('customer'),
        api.getMetadata('operator'),
        api.getMetadata('status'),
        api.getMetadata('category'),
        api.getMetadata('sub_category'),
        api.getMetadata('technician'),
        api.getMetadata('tenant'),
      ]);

      if (st.status === 'success') setStates(st.data);
      if (cust.status === 'success') setCustomers(cust.data);
      if (op.status === 'success') setOperators(op.data);
      if (stat.status === 'success') setSiteStatuses(stat.data);
      if (cat.status === 'success') setCategories(cat.data);
      if (sub.status === 'success') setSubCategories(sub.data);
      if (tech.status === 'success') setTechnicians(tech.data);
      if (ten.status === 'success') setTenants(ten.data);
    } catch (error) { 
      console.error('Error loading metadata:', error); 
    } finally { 
      setLoading(false); 
    }
  };

  const loadDistricts = async (state_id: string) => {
    if (!state_id) { setDistricts([]); return; }
    try {
      const response = await api.getDistricts(state_id);
      if (response.status === 'success') setDistricts(response.data);
    } catch (error) { console.error('Error loading districts:', error); }
  };

  const loadClusters = async (district_id: string) => {
    if (!district_id) { setClusters([]); return; }
    try {
      const response = await api.getClusters(district_id);
      if (response.status === 'success') setClusters(response.data);
    } catch (error) { console.error('Error loading clusters:', error); }
  };

  const handleStateChange = (state_id: string) => {
    setSelectedState(state_id); 
    setSelectedDistrict(''); 
    setSelectedCluster('');
    setDistricts([]); 
    setClusters([]);
    if (state_id) {
      loadDistricts(state_id);
    }
  };

  const handleDistrictChange = (district_id: string) => {
    setSelectedDistrict(district_id); 
    setSelectedCluster(''); 
    setClusters([]);
    if (district_id) {
      loadClusters(district_id);
    }
  };

  const handleSearchTypeChange = (type: string) => {
    setSearchType(type);
    if (type !== 'site_id') setSiteId('');
    if (type !== 'imei') setImei('');
    if (type !== 'global_id') setGlobalId('');
    if (type !== 'site_name') setSiteName('');
  };

  const handleApply = () => {
    const filters = {
      state_id: selectedState, district_id: selectedDistrict, cluster_id: selectedCluster,
      search_type: searchType, site_id: siteId, imei: imei, global_id: globalId, site_name: siteName,
      alarm_t: alarmType,
      customer_id: selectedCustomer,
      operator_id: selectedOperator,
      site_status: selectedStatus,
      site_category: selectedCategory,
      site_sub_category: selectedSubCategory,
      customer_site_id: customerSiteId,
      technician_id: selectedTechnician,
      tenant_id: selectedTenant,
      site_type: selectedSiteType,
      site_on: selectedSiteOn,
      date_from: fromDate ? fromDate.toISOString().split('T')[0] : '',
      date_to: toDate ? toDate.toISOString().split('T')[0] : '',
    };
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    setSelectedState(''); setSelectedDistrict(''); setSelectedCluster('');
    setSearchType(''); setSiteId(''); setImei(''); setGlobalId(''); setSiteName('');
    setAlarmType('all'); setSelectedCustomer(''); setSelectedOperator('');
    setSelectedStatus(''); setSelectedCategory(''); setSelectedSubCategory('');
    setCustomerSiteId(''); setSelectedTechnician(''); setSelectedTenant('');
    setSelectedSiteType(''); setSelectedSiteOn('');
    setFromDate(null); setToDate(null); setDistricts([]); setClusters([]);
    onApply({});
    onClose();
  };

  const RenderChipList = ({ data, selectedId, onSelect, idKey, nameKey, label }: any) => (
    <View style={styles.filterGroup}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <TouchableOpacity style={[styles.chip, !selectedId && styles.chipActive]} onPress={() => onSelect('')}>
          <Text style={[styles.chipText, !selectedId && styles.chipTextActive]}>All</Text>
        </TouchableOpacity>
        {data.map((item: any) => (
          <TouchableOpacity 
            key={item[idKey]} 
            style={[styles.chip, selectedId === item[idKey] && styles.chipActive]} 
            onPress={() => onSelect(item[idKey])}
          >
            <Text style={[styles.chipText, selectedId === item[idKey] && styles.chipTextActive]}>{item[nameKey]}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Options</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={20} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2189e5" />
                <Text style={styles.loadingText}>Loading filters...</Text>
              </View>
            ) : (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📍 Location</Text>
                  <RenderChipList data={states} selectedId={selectedState} onSelect={handleStateChange} idKey="state_id" nameKey="state_name" label="State" />
                  {selectedState && districts.length > 0 && (
                    <RenderChipList data={districts} selectedId={selectedDistrict} onSelect={handleDistrictChange} idKey="district_id" nameKey="district_name" label="District" />
                  )}
                  {selectedDistrict && clusters.length > 0 && (
                    <RenderChipList data={clusters} selectedId={selectedCluster} onSelect={(id: string) => setSelectedCluster(id)} idKey="cluster_id" nameKey="cluster_name" label="Cluster" />
                  )}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🔍 Search Site</Text>
                  <View style={styles.searchTypeContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {[
                        { type: 'site_id', label: 'Site ID' },
                        { type: 'imei', label: 'IMEI' },
                        { type: 'global_id', label: 'Global ID' },
                        { type: 'site_name', label: 'Site Name' }
                      ].map(({ type, label }) => (
                        <TouchableOpacity key={type} style={[styles.searchTypeChip, searchType === type && styles.searchTypeChipActive]} onPress={() => handleSearchTypeChange(type)}>
                          <Text style={[styles.searchTypeText, searchType === type && styles.searchTypeTextActive]}>{label}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  {searchType === 'site_id' && <TextInput style={styles.input} placeholder="Enter Site ID" value={siteId} onChangeText={setSiteId} placeholderTextColor="#94a3b8" />}
                  {searchType === 'imei' && <TextInput style={styles.input} placeholder="Enter IMEI" value={imei} onChangeText={setImei} keyboardType="numeric" placeholderTextColor="#94a3b8" />}
                  {searchType === 'global_id' && <TextInput style={styles.input} placeholder="Enter Global ID" value={globalId} onChangeText={setGlobalId} placeholderTextColor="#94a3b8" />}
                  {searchType === 'site_name' && <TextInput style={styles.input} placeholder="Enter Site Name" value={siteName} onChangeText={setSiteName} placeholderTextColor="#94a3b8" />}
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>⚙️ Entity & Alarm</Text>
                  <View style={styles.filterGroup}>
                    <Text style={styles.label}>Alarm Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {[{v:'all',l:'All'},{v:'smps',l:'SMPS'},{v:'tpms',l:'RMS'}].map(item => (
                        <TouchableOpacity key={item.v} style={[styles.chip, alarmType === item.v && styles.chipActive]} onPress={() => setAlarmType(item.v)}>
                           <Text style={[styles.chipText, alarmType === item.v && styles.chipTextActive]}>{item.l}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <RenderChipList data={customers} selectedId={selectedCustomer} onSelect={setSelectedCustomer} idKey="id" nameKey="name" label="Customer" />
                  <RenderChipList data={operators} selectedId={selectedOperator} onSelect={setSelectedOperator} idKey="id" nameKey="name" label="Operator" />
                  <RenderChipList data={siteStatuses} selectedId={selectedStatus} onSelect={setSelectedStatus} idKey="id" nameKey="name" label="Site Status" />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🏷️ Categories</Text>
                  <RenderChipList data={categories} selectedId={selectedCategory} onSelect={setSelectedCategory} idKey="id" nameKey="name" label="Category" />
                  <RenderChipList data={subCategories} selectedId={selectedSubCategory} onSelect={setSelectedSubCategory} idKey="id" nameKey="name" label="Sub Category" />
                  <View style={styles.filterGroup}>
                    <Text style={styles.label}>Customer Site ID</Text>
                    <TextInput style={styles.input} placeholder="Enter Customer Site ID" value={customerSiteId} onChangeText={setCustomerSiteId} placeholderTextColor="#94a3b8" />
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>👤 Assignments</Text>
                  <RenderChipList data={technicians} selectedId={selectedTechnician} onSelect={setSelectedTechnician} idKey="id" nameKey="name" label="Technician" />
                  <RenderChipList data={tenants} selectedId={selectedTenant} onSelect={setSelectedTenant} idKey="id" nameKey="name" label="Tenant" />
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🏗️ Site Properties</Text>
                  <View style={styles.filterGroup}>
                    <Text style={styles.label}>Site Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {[{v:'',l:'All'},{v:'indoor',l:'Indoor'},{v:'outdoor',l:'Outdoor'}].map(item => (
                        <TouchableOpacity key={item.v} style={[styles.chip, selectedSiteType === item.v && styles.chipActive]} onPress={() => setSelectedSiteType(item.v)}>
                           <Text style={[styles.chipText, selectedSiteType === item.v && styles.chipTextActive]}>{item.l || 'All'}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={styles.filterGroup}>
                    <Text style={styles.label}>Site On</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                      {['dg', 'non-dg', 'eb', 'non-eb', 'bb', 'non-bb', 'solar', 'non-solar'].map(v => (
                        <TouchableOpacity key={v} style={[styles.chip, selectedSiteOn === v && styles.chipActive]} onPress={() => setSelectedSiteOn(selectedSiteOn === v ? '' : v)}>
                           <Text style={[styles.chipText, selectedSiteOn === v && styles.chipTextActive]}>{v.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>📅 Date Range</Text>
                  <View style={styles.dateRow}>
                    <View style={styles.dateGroup}>
                      <Text style={styles.label}>From</Text>
                      <TouchableOpacity style={styles.dateButton} onPress={() => setShowFromPicker(true)}>
                        <Text style={styles.dateButtonText}>{fromDate ? fromDate.toLocaleDateString() : 'Set Start'}</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.dateGroup}>
                      <Text style={styles.label}>To</Text>
                      <TouchableOpacity style={styles.dateButton} onPress={() => setShowToPicker(true)}>
                        <Text style={styles.dateButtonText}>{toDate ? toDate.toLocaleDateString() : 'Set End'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {showFromPicker && (
                    <DateTimePicker value={fromDate || new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, selectedDate) => { setShowFromPicker(false); if (selectedDate) setFromDate(selectedDate); }} />
                  )}
                  {showToPicker && (
                    <DateTimePicker value={toDate || new Date()} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(event, selectedDate) => { setShowToPicker(false); if (selectedDate) setToDate(selectedDate); }} />
                  )}
                </View>
              </>
            )}
            <View style={{height: 40}} />
          </ScrollView>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
              <Text style={styles.resetButtonText}>Reset All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
  modalContent: { 
    backgroundColor: '#fff', 
    borderTopLeftRadius: moderateScale(30), 
    borderTopRightRadius: moderateScale(30), 
    maxHeight: '90%', 
    paddingBottom: verticalScale(10) 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: moderateScale(20), 
    borderBottomWidth: 1, 
    borderBottomColor: '#f1f5f9' 
  },
  modalTitle: { fontSize: responsiveFontSize(22), fontWeight: '800', color: '#1e3c72' },
  closeButton: { padding: moderateScale(8), backgroundColor: '#f1f5f9', borderRadius: moderateScale(20) },
  scrollContent: { paddingHorizontal: moderateScale(20), paddingTop: verticalScale(20) },
  loadingContainer: { padding: moderateScale(60), alignItems: 'center' },
  loadingText: { marginTop: verticalScale(15), fontSize: responsiveFontSize(14), color: '#64748b' },
  section: { marginBottom: verticalScale(30), backgroundColor: '#fff' },
  sectionTitle: { fontSize: responsiveFontSize(18), fontWeight: '800', color: '#1e3c72', marginBottom: verticalScale(15), letterSpacing: 0.5 },
  filterGroup: { marginBottom: verticalScale(20) },
  label: { fontSize: responsiveFontSize(13), fontWeight: '700', color: '#64748b', marginBottom: verticalScale(10), textTransform: 'uppercase' },
  chip: { 
    paddingHorizontal: moderateScale(16), 
    paddingVertical: verticalScale(10), 
    borderRadius: moderateScale(25), 
    backgroundColor: '#f8fafc', 
    marginRight: moderateScale(10), 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  chipActive: { backgroundColor: '#1e3c72', borderColor: '#1e3c72' },
  chipText: { fontSize: responsiveFontSize(14), color: '#475569', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  searchTypeContainer: { marginBottom: verticalScale(15) },
  searchTypeChip: { 
    paddingHorizontal: moderateScale(16), 
    paddingVertical: verticalScale(10), 
    borderRadius: moderateScale(25), 
    backgroundColor: '#f1f5f9', 
    marginRight: moderateScale(8), 
    borderWidth: 1, 
    borderColor: '#e2e8f0' 
  },
  searchTypeChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  searchTypeText: { fontSize: responsiveFontSize(14), color: '#475569', fontWeight: '600' },
  searchTypeTextActive: { color: '#fff' },
  input: { 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: moderateScale(12), 
    padding: moderateScale(14), 
    fontSize: responsiveFontSize(16), 
    color: '#1e293b', 
    backgroundColor: '#f8fafc' 
  },
  dateRow: { flexDirection: 'row', gap: moderateScale(15) }, 
  dateGroup: { flex: 1 },
  dateButton: { 
    borderWidth: 1, 
    borderColor: '#e2e8f0', 
    borderRadius: moderateScale(12), 
    padding: moderateScale(14), 
    backgroundColor: '#f8fafc', 
    alignItems: 'center' 
  },
  dateButtonText: { fontSize: responsiveFontSize(14), color: '#1e293b', fontWeight: '700' },
  actionButtons: { 
    flexDirection: 'row', 
    padding: moderateScale(20), 
    gap: moderateScale(15), 
    borderTopWidth: 1, 
    borderTopColor: '#f1f5f9' 
  },
  resetButton: { 
    flex: 1, 
    padding: verticalScale(16), 
    borderRadius: moderateScale(12), 
    backgroundColor: '#f1f5f9', 
    alignItems: 'center' 
  },
  resetButtonText: { fontSize: responsiveFontSize(16), fontWeight: '700', color: '#64748b' },
  applyButton: { 
    flex: 2, 
    padding: verticalScale(16), 
    borderRadius: moderateScale(12), 
    backgroundColor: '#1e3c72', 
    alignItems: 'center', 
    shadowColor: '#1e3c72', 
    shadowOffset: { width: 0, height: 4 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 8, 
    elevation: 4 
  },
  applyButtonText: { fontSize: responsiveFontSize(16), fontWeight: '800', color: '#fff' }
});

export default FilterModal;