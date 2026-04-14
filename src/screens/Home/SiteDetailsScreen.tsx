import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../types/navigation';
import { api } from '../../api';
import AppHeader from '../../components/AppHeader';
import AppIcon from '../../components/AppIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'SiteDetails'>;

const TABS = ['Overview', 'Alarms', 'Technical', 'I&C Details', 'Contacts', 'Parameters'];

export default function SiteDetailsScreen({ route, navigation }: Props) {
  const { imei, siteId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');

  useEffect(() => { fetchDetails(); }, []);

  const fetchDetails = async () => {
    try {
      let activeImei = imei;
      let activeSiteId = siteId;

      if (!activeImei || activeImei === 'N/A' || activeImei === '-' || activeImei === 'undefined') {
        if (activeSiteId) {
          try {
            let searchRes = await api.getSiteStatus({ site_id: activeSiteId }, 1, 1);
            if (!searchRes || !searchRes.sites?.length) {
              searchRes = await api.getSiteStatus({ global_id: activeSiteId }, 1, 1);
            }
            if (searchRes?.sites?.length > 0) {
              activeImei = searchRes.sites[0].imei;
            }
          } catch (err) {
            console.log('IMEI identification failed', err);
          }
        }
      }

      const fetchId = (activeImei && activeImei !== 'N/A') ? activeImei : activeSiteId;
      if (!fetchId) { setLoading(false); return; }

      const res = await api.getSiteDetails(fetchId);
      if (res) {
        const siteData = res.sites?.[0] || res.data?.[0] || res.data || res;
        setData(siteData);
      } else {
        setData(null);
      }
    } catch (e) {
      console.error('Fetch error:', e);
      if (siteId) {
        try {
          const retryRes = await api.getSiteStatus({ site_name: siteId }, 1, 1);
          if (retryRes?.sites?.length > 0) {
            const finalRes = await api.getSiteDetails(retryRes.sites[0].imei);
            setData(finalRes.sites?.[0] || finalRes.data || finalRes);
          }
        } catch (err2) {
          console.log('Retry failed', err2);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#01497C" />
        <Text style={styles.loadingText}>Loading Site Dashboard...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.center}>
        <Icon name="alert-circle" size={40} color="#ccc" />
        <Text style={{ color: '#999', marginTop: 10 }}>No Data Available</Text>
      </View>
    );
  }

  // ─── OVERVIEW ────────────────────────────────────────────────────────────────
  const renderOverview = () => (
    <View style={styles.tabContent}>
      <SectionCard title="Site Information">
        <DetailRow label="Client Type Name" value={data.client_name} label2="State / Circle" value2={data.state_name} />
        <DetailRow label="Site Mobile No." value={data.sim_info?.mobile} label2="Cluster" value2={data.cluster_name} />
        <DetailRow label="SIM Serial No." value={data.sim_info?.serial_no} label2="District" value2={data.district_name} />
        <DetailRow label="GSM IMEI No." value={data.imei} label2="Site Name" value2={data.site_name} />
        <DetailRow label="System Serial No." value={data.system_serial_no} label2="Site Type" value2={data.site_type} />
        <DetailRow label="Global ID" value={data.global_id} label2="Site ID (As Per SMS)" value2={data.site_id} />
        <DetailRow label="System Version Type" value={data.system_version_type} label2="EB Sanction Load" value2="--" />
        <DetailRow label="Installation Date" value={data.installation_date} label2="Device Make & Type" value2="--" />
      </SectionCard>

      <SectionCard title="Additional Info">
        <DetailRow label="AMF Panel Detail" value="Model No." label2="No. of Rectifiers" value2="--" />
        <DetailRow label="No. of Tenants" value="--" label2="Li-ion Battery Detail" value2="--" />
        <DetailRow label="Max EB Voltage" value="--" label2="Min EB Voltage" value2="--" />
        <DetailRow label="AVG EB Voltage" value="--" label2="BMS" value2="No Data" />
        <DetailRow label="VRLA" value="No Data" label2="Commissioning Date" value2="--" />
      </SectionCard>

      <SectionCard title="Channel Configuration">
        <View style={styles.channelGrid}>
          {['ch1', 'ch2', 'ch3', 'ch4', 'ch5'].map((ch, i) => (
            <View key={ch} style={styles.channelBox}>
              <Text style={styles.chLabel}>CH{i + 1}</Text>
              <Text style={styles.chValue}>{data.channels?.[ch] || 'Empty'}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

    </View>
  );

  // ─── ALARMS ──────────────────────────────────────────────────────────────────
  const renderAlarms = () => (
    <View style={styles.tabContent}>
      <SectionCard title="Configured Alarms">
        {data.tpms_alarms?.length > 0
          ? data.tpms_alarms.map((alarm: string, i: number) => (
            <View key={i} style={styles.alarmListRow}>
              <Text style={styles.alarmListTxt}>{alarm}</Text>
              <View style={styles.badgeConfig}><Text style={styles.badgeText}>Configured</Text></View>
            </View>
          ))
          : <EmptyState text="No configured alarms" />}
      </SectionCard>

      <SectionCard title="Real Time Alarm Status">
        {data.current_alarms?.length > 0 ? (
          <View style={styles.alarmListContainer}>
            {data.current_alarms.map((a: any, i: number) => {
              const activeSince = a.active_time_formatted || `${a.hours_active} hrs`;
              const timestamp = a.timestamp ? new Date(a.timestamp).toLocaleString([], {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
              }) : '--';
              
              return (
                <View key={i} style={styles.alarmRowCard}>
                  <View style={styles.alarmCardHead}>
                    <Text style={styles.alarmCardName}>{a.name}</Text>
                    <View style={styles.badgeActive}>
                      <Icon name="alert-circle" size={10} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.badgeText}>ACTIVE</Text>
                    </View>
                  </View>
                  <View style={styles.alarmCardDetails}>
                    <View style={styles.alarmCardInfo}>
                      <Icon name="clock" size={12} color="#64748B" />
                      <Text style={styles.alarmCardInfoTxt}> {activeSince}</Text>
                    </View>
                    <View style={styles.alarmCardInfo}>
                      <Icon name="calendar" size={12} color="#64748B" />
                      <Text style={styles.alarmCardInfoTxt}> {timestamp}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : <EmptyState text="No active alarms" />}
      </SectionCard>

      <SectionCard title="Recently Closed Alarms">
        {data.closed_alarms?.length > 0 ? (
          <View style={styles.alarmListContainer}>
            {data.closed_alarms.map((a: any, i: number) => {
              const duration = a.duration_formatted || '--';
              const start = a.start_time ? new Date(a.start_time).toLocaleString([], {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              }) : '--';
              const end = a.end_time ? new Date(a.end_time).toLocaleString([], {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
              }) : '--';

              return (
                <View key={i} style={styles.alarmRowCard}>
                  <View style={styles.alarmCardHead}>
                    <Text style={styles.alarmCardName}>{a.name}</Text>
                    <View style={styles.badgeClosed}>
                      <Icon name="check-circle" size={10} color="#fff" style={{ marginRight: 4 }} />
                      <Text style={styles.badgeText}>CLOSED</Text>
                    </View>
                  </View>
                  
                  <View style={styles.alarmCardDetails}>
                    <View style={styles.alarmCardInfo}>
                      <Icon name="clock" size={12} color="#64748B" />
                      <Text style={styles.alarmCardInfoTxt}> {duration}</Text>
                    </View>
                  </View>

                  <View style={styles.alarmCardTimeline}>
                    <View style={styles.timelinePoint}>
                      <Text style={styles.timelineLabel}>START</Text>
                      <Text style={styles.timelineVal}>{start}</Text>
                    </View>
                    <Icon name="arrow-right" size={12} color="#CBD5E1" style={{ marginHorizontal: 10 }} />
                    <View style={styles.timelinePoint}>
                      <Text style={styles.timelineLabel}>END</Text>
                      <Text style={styles.timelineVal}>{end}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : <EmptyState text="No closed alarms today" />}
      </SectionCard>
    </View>
  );

  // ─── TECHNICAL ───────────────────────────────────────────────────────────────
  const renderTechnical = () => (
    <View style={styles.tabContent}>
      <View style={styles.capacityRow}>
        <CapCard head="EB Capacity" val="-- kVA" sub="Sanctioned Load" />
        <CapCard head="DG Capacity" val="-- kVA" sub="Generator Power" />
        <CapCard head="BB Capacity" val={data.battery_banks?.bank1 || '--'} sub="Battery Bank" />
      </View>

      <SectionCard title="Mains Details">
        <DetailRow label="Voltage R-Phase (Vac)" value={data.mains_parameters?.voltage_r} label2="Voltage Y-Phase (Vac)" value2={data.mains_parameters?.voltage_y} />
        <DetailRow label="Voltage B-Phase (Vac)" value={data.mains_parameters?.voltage_b} label2="EB Frequency (Hz)" value2={data.mains_parameters?.frequency} />
        <DetailRow label="Current R (A)" value={data.mains_parameters?.current_r} label2="Current Y (A)" value2={data.mains_parameters?.current_y} />
        <DetailRow label="Current B (A)" value={data.mains_parameters?.current_b} label2="Total KW" value2={data.mains_parameters?.total_kw} />
        <DetailRow label="Energy Today (KWH)" value={data.energy_consumption?.today?.mains} label2="Energy Yesterday (KWH)" value2={data.energy_consumption?.yesterday?.mains} />
        <DetailRow label="Cumulative Energy (KWH)" value={data.mains_parameters?.cumulative_energy} label2="Cumulative Run Hours" value2="--" />
      </SectionCard>

      <SectionCard title="DG Parameters">
        <DetailRow label="Voltage R-Phase (Vac)" value={data.dg_parameters?.voltage_r} label2="Voltage Y-Phase (Vac)" value2={data.dg_parameters?.voltage_y} />
        <DetailRow label="Voltage B-Phase (Vac)" value={data.dg_parameters?.voltage_b} label2="DG Frequency (Hz)" value2={data.dg_parameters?.frequency} />
        <DetailRow label="Current R (A)" value={data.dg_parameters?.current_r} label2="Current Y (A)" value2={data.dg_parameters?.current_y} />
        <DetailRow label="Current B (A)" value={data.dg_parameters?.current_b} label2="Total KW" value2={data.dg_parameters?.total_kw} />
        <DetailRow label="Energy Today (KWH)" value={data.energy_consumption?.today?.dg} label2="Energy Yesterday (KWH)" value2={data.energy_consumption?.yesterday?.dg} />
        <DetailRow label="Cumulative Energy (KWH)" value={data.dg_parameters?.cumulative_energy} label2="DG Battery Voltage" value2={data.dg_parameters?.battery_voltage} />
      </SectionCard>

      <SectionCard title="BB / Battery Details">
        <DetailRow label="Battery Voltage (Vdc)" value={data.battery_parameters?.voltage} label2="Battery Current (A)" value2={data.battery_parameters?.current} />
        <DetailRow label="DC Bus Voltage (Vdc)" value={data.current_status?.vdc} label2="HRT" value2={data.current_status?.hrt} />
        <DetailRow label="Voltage Offset" value={data.current_status?.v_offset} label2="Temperature Offset" value2={data.current_status?.t_offset} />
        <DetailRow label="BTLV" value={data.current_status?.btlv} label2="Energy Today (KWH)" value2={data.energy_consumption?.today?.solar} />
      </SectionCard>

      <SectionCard title="Battery Bank Details">
        <View style={styles.tableHeader}>
          <Text style={[styles.thCell, { flex: 1.5 }]}>Bank</Text>
          <Text style={[styles.thCell, { flex: 2 }]}>Capacity</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Voltage</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Current</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Condition</Text>
        </View>
        {['bank1', 'bank2', 'bank3', 'bank4'].map((b, i) => {
          const val = data.battery_banks?.[b];
          if (!val) return null;
          return (
            <View key={b} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
              <Text style={[styles.tdCellBold, { flex: 1.5 }]}>Bank {String.fromCharCode(65 + i)}</Text>
              <Text style={[styles.tdCell, { flex: 2 }]}>{val}</Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>--</Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>--</Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>--</Text>
            </View>
          );
        })}
      </SectionCard>
    </View>
  );

  // ─── I&C DETAILS ─────────────────────────────────────────────────────────────
  const renderMonitoring = () => (
    <View style={styles.tabContent}>
      <SectionCard title="Site Details">
        <StaticRow label="No. Of RRU" value={data.system_details?.no_of_rru} />
        <StaticRow label="No. Of BTS" value={data.system_details?.no_of_bts} />
        <StaticRow label="No. Of Battery Bank" value={data.no_of_battery_bank} />
        <StaticRow label="Door Sensor" value={data.door_sensor == 1 ? 'Available' : 'Not Available'} />
        <StaticRow label="Antenna" value={data.antenna == 1 ? 'Available' : 'Not Available'} />
        <StaticRow label="Hooter" value={data.hooter == 1 ? 'Available' : 'Not Available'} />
        <StaticRow label="SOW Status" value={data.sow_status} />
        <StaticRow label="No. of Hub" value={data.system_details?.hub} />
      </SectionCard>

      <SectionCard title="Real Time Status">
        <StaticRow label="System Status" value={data.status?.includes('Non') ? 'Offline' : 'Online'} />
        <StaticRow label="Communication" value={data.status?.includes('Non') ? 'Inactive' : 'Active'} />
        <StaticRow label="Temperature" value={data.environmental?.room_temperature ? `${data.environmental.room_temperature}°C` : '--'} />
        <StaticRow label="Temperature 2" value={data.environmental?.temperature2 ? `${data.environmental.temperature2}°C` : '--'} />
        <StaticRow label="Door Status" value={data.tpms_alarms?.some((a: string) => a.toLowerCase().includes('door')) ? 'Open' : 'Closed'} />
        <StaticRow label="Power Supply" value={data.load_parameters?.site_mode} />
        <StaticRow label="Aging (Days)" value={data.aging_days} />
      </SectionCard>

      <SectionCard title="TPMS Connectivity">
        <View style={styles.tpmsGrid}>
          <CheckItem label="Battery Bank" active={data.tpms_battery_bank == 1} />
          <CheckItem label="RRU" active={data.tpms_rru == 1} />
          <CheckItem label="BTS" active={data.tpms_bts == 1} />
          <CheckItem label="CABLE" active={data.tpms_cable == 1} />
          <CheckItem label="DG" active={data.tpms_dg == 1} />
        </View>
      </SectionCard>

      <SectionCard title="Shroti Team">
        <StaticRow label="Team Name" value={data.shroti_team?.name} />
        <StaticRow label="Team Mobile" value={data.shroti_team?.mobile} />
      </SectionCard>
    </View>
  );

  // ─── CONTACTS ────────────────────────────────────────────────────────────────
  const renderContacts = () => {
    const contacts = data.contacts || [];
    const escalation = data.escalation || {};
    const technician = data.technician;

    const levelMap: Record<string, number> = {
      'LevelOne': 1, 'LevelTwo': 2, 'LevelThree': 3, 'LevelFour': 4, 'LevelFive': 5
    };

    return (
      <View style={styles.tabContent}>
        <SectionCard title="Site Contact Details">
          {contacts.length > 0
            ? contacts.map((c: any, i: number) => {
              const lvl = levelMap[c.level] || c.order || (i + 1);
              return (
                <View key={i} style={styles.contactRow}>
                  <View style={styles.levelBadge}>
                    <Text style={styles.levelBadgeTxt}>L{lvl}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{c.name || '--'}</Text>
                    <Text style={styles.contactDesig}>{c.designation || ''}</Text>
                    <Text style={styles.contactMobile}>{c.mobile || '--'}</Text>
                  </View>
                </View>
              );
            })
            : <EmptyState text="No contact information available" />}

          {technician && (
            <View>
              <View style={styles.divider} />
              <Text style={styles.subSectionTitle}>Technician</Text>
              <View style={styles.contactRow}>
                <View style={[styles.levelBadge, { backgroundColor: '#2A6F97' }]}>
                  <Icon name="tool" size={14} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{technician.name || '--'}</Text>
                  <Text style={styles.contactMobile}>{technician.mobile || '--'}</Text>
                  {technician.supervisor && (
                    <Text style={styles.contactDesig}>Supervisor: {technician.supervisor}</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </SectionCard>

        <SectionCard title="Escalation Matrix">
          {['l1', 'l2', 'l3', 'l4', 'l5'].some(l => escalation[`${l}_number`])
            ? ['l1', 'l2', 'l3', 'l4', 'l5'].map((l, i) => {
              const name = escalation[`${l}_name`];
              const number = escalation[`${l}_number`];
              if (!number) return null;
              return (
                <View key={l} style={styles.contactRow}>
                  <View style={[styles.levelBadge, { backgroundColor: '#013A63' }]}>
                    <Text style={styles.levelBadgeTxt}>L{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    {name ? <Text style={styles.contactName}>{name}</Text> : null}
                    <Text style={styles.contactMobile}>{number}</Text>
                  </View>
                </View>
              );
            })
            : <EmptyState text="No escalation matrix available" />}
        </SectionCard>
      </View>
    );
  };

  // ─── PARAMETERS ──────────────────────────────────────────────────────────────
  const renderParameters = () => {
    const dailyRunHours = data.daily_run_hours || [];
    const settings = data.settings_parameters || {};
    const load = data.load_parameters || {};
    const energy = data.energy_consumption || {};

    return (
      <View style={styles.tabContent}>
        <SectionCard title="Daily Run Hr. Trend">
          {dailyRunHours.length > 0 ? (() => {
            const day = dailyRunHours[0];
            return (
              <View>
                <StaticRow label="EB Run Hrs." value={day.eb_duration_formatted || `${day.eb_hours}h`} />
                <StaticRow label="DG Run Hrs." value={day.dg_duration_formatted || `${day.dg_hours}h`} />
                <StaticRow label="Battery Run Hrs." value={day.battery_duration_formatted || `${day.battery_hours}h`} />
                <StaticRow label="Mains Fail Hrs." value={day.mains_fail_hours ? `${day.mains_fail_hours}h` : '--'} />
                <StaticRow label="Solar Run Hrs." value={day.solar_hours ? `${day.solar_hours}h` : '--'} />
                <StaticRow label="Solar+EB Run Hrs." value="--" />
                <StaticRow label="Solar+BB Run Hrs." value="--" />
                <StaticRow label="Solar+DG Run Hrs." value="--" />
              </View>
            );
          })() : <EmptyState text="No run hours data available" />}
        </SectionCard>

        <SectionCard title="Load Parameters">
          <StaticRow label="DC Bus Voltage (Vdc)" value={load.dc_bus_voltage} />
          <StaticRow label="Site Mode On" value={load.site_mode} />
          <StaticRow label="System Mode PIU" value={load.system_mode_piu} />
          <StaticRow label="Room Temperature" value={data.environmental?.room_temperature ? `${data.environmental.room_temperature}°C` : '--'} />
          <StaticRow label="Temperature 2" value={data.environmental?.temperature2 ? `${data.environmental.temperature2}°C` : '--'} />
          <StaticRow label="CH1 Current (A)" value={load.ch1_current} />
          <StaticRow label="CH2 Current (A)" value={load.ch2_current} />
          <StaticRow label="CH3 Current (A)" value={load.ch3_current} />
          <StaticRow label="CH4 Current (A)" value={load.ch4_current} />
          <StaticRow label="Solar Energy (KWH)" value={load.solar_energy} />
        </SectionCard>

        <SectionCard title="Setting Parameters">
          <StaticRow label="Battery LVD Trip Setting" value={settings.battery_lvd_trip} />
          <StaticRow label="Load LVD Trip Setting" value={settings.load_lvd_trip} />
          <StaticRow label="Battery Low Alarm Setting" value={settings.battery_low_alarm} />
          <StaticRow label="VRLA AH Setting" value={settings.vrla_ah_setting} />
          <StaticRow label="VRLA Charging Current Setting" value={settings.vrla_charging_current} />
          <StaticRow label="Each LIB Charging Current Setting" value={settings.lib_charging_current} />
        </SectionCard>

        <SectionCard title="OPCO Load Energy Details">
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { flex: 2.5 }]}>Parameter</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>OPCO1</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>OPCO2</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>OPCO3</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>OPCO4</Text>
          </View>
          {[
            { label: 'Load Today (KWH)', v1: load.ch1_energy, v2: load.ch2_energy, v3: load.ch3_energy, v4: load.ch4_energy },
            { label: 'Load Yest. (KWH)', v1: '--', v2: '--', v3: '--', v4: '--' },
            { label: 'Cumulative (KWH)', v1: '--', v2: '--', v3: '--', v4: '--' },
          ].map((row, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
              <Text style={[styles.tdCellBold, { flex: 2.5 }]}>{row.label}</Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>{row.v1 ?? '--'}</Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>{row.v2 ?? '--'}</Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>{row.v3 ?? '--'}</Text>
              <Text style={[styles.tdCell, { flex: 1 }]}>{row.v4 ?? '--'}</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Energy Consumption Summary">
          <View style={styles.tableHeader}>
            <Text style={[styles.thCell, { flex: 2 }]}>Source</Text>
            <Text style={[styles.thCell, { flex: 1.5 }]}>Today (KWH)</Text>
            <Text style={[styles.thCell, { flex: 1.5 }]}>Yest. (KWH)</Text>
          </View>
          {[
            { src: 'Mains / EB', t: energy.today?.mains, y: energy.yesterday?.mains },
            { src: 'DG1', t: energy.today?.dg, y: energy.yesterday?.dg },
            { src: 'DG2', t: energy.today?.dg2, y: energy.yesterday?.dg2 },
            { src: 'Solar', t: energy.today?.solar, y: energy.yesterday?.solar },
            { src: 'Load', t: energy.today?.load, y: energy.yesterday?.load },
          ].map((row, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 0 && styles.tableRowAlt]}>
              <Text style={[styles.tdCellBold, { flex: 2 }]}>{row.src}</Text>
              <Text style={[styles.tdCell, { flex: 1.5 }]}>{row.t ?? '--'}</Text>
              <Text style={[styles.tdCell, { flex: 1.5 }]}>{row.y ?? '--'}</Text>
            </View>
          ))}
        </SectionCard>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppHeader
        title={data.site_name || 'Site Details'}
        subtitle={`${data.global_id || data.site_id || ''} | ${data.status || ''}`}
        leftAction="back"
        onLeftPress={() => navigation.goBack()}
      />

      {/* Tab Bar */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(t => (
            <TouchableOpacity key={t} onPress={() => setActiveTab(t)} style={[styles.tabBtn, activeTab === t && styles.tabActive]}>
              <Text style={[styles.tabTxt, activeTab === t && styles.tabTxtActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'Overview' && renderOverview()}
        {activeTab === 'Alarms' && renderAlarms()}
        {activeTab === 'Technical' && renderTechnical()}
        {activeTab === 'I&C Details' && renderMonitoring()}
        {activeTab === 'Contacts' && renderContacts()}
        {activeTab === 'Parameters' && renderParameters()}
        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── REUSABLE SUB-COMPONENTS ─────────────────────────────────────────────────

const SectionCard = ({ title, children }: { title?: string; children: React.ReactNode }) => (
  <View style={styles.card}>
    {title ? <Text style={styles.cardTitle}>{title}</Text> : null}
    {children}
  </View>
);

const DetailRow = ({ label, value, label2, value2 }: any) => (
  <View style={styles.detailRow}>
    <View style={styles.detailCol}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value != null && value !== '' ? String(value) : '--'}</Text>
    </View>
    {label2 ? (
      <View style={styles.detailCol}>
        <Text style={styles.detailLabel}>{label2}</Text>
        <Text style={styles.detailValue}>{value2 != null && value2 !== '' ? String(value2) : '--'}</Text>
      </View>
    ) : <View style={styles.detailCol} />}
  </View>
);

const StaticRow = ({ label, value }: { label: string; value: any }) => (
  <View style={styles.staticRow}>
    <Text style={styles.staticLabel}>{label}</Text>
    <Text style={styles.staticVal}>{value != null && value !== '' ? String(value) : '--'}</Text>
  </View>
);

const CapCard = ({ head, val, sub }: { head: string; val: string; sub: string }) => (
  <View style={styles.capCard}>
    <Text style={styles.capHead}>{head}</Text>
    <Text style={styles.capVal}>{val}</Text>
    <Text style={styles.capSub}>{sub}</Text>
  </View>
);

const CheckItem = ({ label, active }: { label: string; active: boolean }) => (
  <View style={styles.checkItem}>
    <View style={[styles.checkBox, active && styles.checkBoxOn]}>
      {active && <AppIcon name="check" size={14} color="#fff" />}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
  </View>
);

const EmptyState = ({ text }: { text: string }) => (
  <Text style={styles.emptyText}>{text}</Text>
);

// ─── STYLES ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EBF2FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#EBF2FA' },
  loadingText: { marginTop: 12, color: '#01497C', fontWeight: '600', fontSize: 14 },

  // Status Banner
  statusBanner: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bannerActive: { backgroundColor: '#01497C' },
  bannerNonActive: { backgroundColor: '#7F1D1D' },
  bannerSiteName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  bannerSub: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 2 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  pillActive: { backgroundColor: 'rgba(34,197,94,0.25)' },
  pillNonActive: { backgroundColor: 'rgba(239,68,68,0.25)' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { backgroundColor: '#22C55E' },
  dotNonActive: { backgroundColor: '#EF4444' },
  statusPillTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // Tab Bar
  tabBarWrapper: { backgroundColor: '#fff', elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  tabBarContent: { paddingHorizontal: 8, paddingVertical: 4 },
  tabBtn: { paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 3, borderColor: 'transparent' },
  tabActive: { borderColor: '#01497C' },
  tabTxt: { color: '#888', fontWeight: '600', fontSize: 13 },
  tabTxtActive: { color: '#01497C' },

  // Content
  tabContent: { padding: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 14, elevation: 2, shadowColor: '#01497C', shadowOpacity: 0.07, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#01497C', marginBottom: 14, paddingBottom: 10, borderBottomWidth: 1.5, borderColor: '#E2EBF4' },

  // Detail Rows (two-column)
  detailRow: { flexDirection: 'row', marginBottom: 14, gap: 12 },
  detailCol: { flex: 1 },
  detailLabel: { fontSize: 11, color: '#2A6F97', fontWeight: '700', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
  detailValue: { fontSize: 13, color: '#1C2F3E', fontWeight: '500' },

  // Static Rows (label – value)
  staticRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderColor: '#F0F5FA' },
  staticLabel: { color: '#01497C', fontWeight: '600', fontSize: 13, flex: 1.2 },
  staticVal: { color: '#333', fontSize: 13, flex: 1, textAlign: 'right' },

  // Capacity Cards
  capacityRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  capCard: { flex: 1, backgroundColor: '#01497C', padding: 14, borderRadius: 12, alignItems: 'center' },
  capHead: { color: '#89C2D9', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  capVal: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  capSub: { color: 'rgba(255,255,255,0.7)', fontSize: 9 },

  // Channel Grid
  channelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  channelBox: { width: '47%', backgroundColor: '#F0F7FF', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#D0E8F5' },
  chLabel: { fontSize: 10, color: '#2A6F97', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  chValue: { fontSize: 13, fontWeight: '700', color: '#01497C' },

  // TPMS
  tpmsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 4 },
  checkItem: { flexDirection: 'row', alignItems: 'center', width: '45%', gap: 8 },
  checkBox: { width: 22, height: 22, borderWidth: 2, borderColor: '#CBD5E0', borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkBoxOn: { backgroundColor: '#2e7d32', borderColor: '#2e7d32' },
  checkMark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 13, color: '#334155' },

  // Contacts
  contactRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0F5FA' },
  levelBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#01497C', alignItems: 'center', justifyContent: 'center' },
  levelBadgeTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
  contactName: { fontSize: 14, fontWeight: '700', color: '#1C2F3E' },
  contactDesig: { fontSize: 11, color: '#64748B', marginTop: 2 },
  contactMobile: { fontSize: 13, color: '#2A6F97', fontWeight: '600', marginTop: 2 },
  subSectionTitle: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 4 },
  divider: { height: 1, backgroundColor: '#E2EBF4', marginVertical: 12 },

  // Alarm list rows
  alarmListRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F0F5FA' },
  alarmListTxt: { fontSize: 13, color: '#334155', flex: 1 },

  // Badges
  badgeConfig: { backgroundColor: '#2A6F97', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  badgeActive: { backgroundColor: '#DC2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  badgeClosed: { backgroundColor: '#2E7D32', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Table
  tableHeader: { flexDirection: 'row', backgroundColor: '#EBF2FA', paddingVertical: 8, paddingHorizontal: 4, borderRadius: 6, marginBottom: 2 },
  thCell: { fontSize: 11, fontWeight: '700', color: '#01497C', paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 4, borderBottomWidth: 1, borderColor: '#F0F5FA' },
  tableRowAlt: { backgroundColor: '#FAFCFF' },
  tdCell: { fontSize: 10, color: '#334155', paddingHorizontal: 4 },
  tdCellBold: { fontSize: 10, color: '#01497C', fontWeight: '600', paddingHorizontal: 4 },
  tdCellCenter: { alignItems: 'center', justifyContent: 'center' },

  // Alarm Cards Styling
  alarmListContainer: { gap: 12 },
  alarmRowCard: { 
    backgroundColor: '#F8FAFC', 
    borderRadius: 12, 
    padding: 12, 
    borderWidth: 1, 
    borderColor: '#E2EBF4' 
  },
  alarmCardHead: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  alarmCardName: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#1C2F3E', 
    flex: 1, 
    marginRight: 10 
  },
  alarmCardDetails: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    gap: 15, 
    marginBottom: 8 
  },
  alarmCardInfo: { 
    flexDirection: 'row', 
    alignItems: 'center' 
  },
  alarmCardInfoTxt: { 
    fontSize: 12, 
    color: '#64748B', 
    fontWeight: '600' 
  },
  alarmCardTimeline: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#fff', 
    borderRadius: 8, 
    padding: 8, 
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  timelinePoint: { flex: 1 },
  timelineLabel: { 
    fontSize: 9, 
    color: '#94A3B8', 
    fontWeight: '800', 
    letterSpacing: 0.5, 
    marginBottom: 2 
  },
  timelineVal: { 
    fontSize: 11, 
    color: '#334155', 
    fontWeight: '700' 
  },

  // Empty
  emptyText: { textAlign: 'center', color: '#94A3B8', padding: 20, fontSize: 13, fontStyle: 'italic' },
});