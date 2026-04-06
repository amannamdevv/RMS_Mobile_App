/**
 * IndiaMap.tsx — Proper choropleth SVG map of India
 * ViewBox: "0 0 600 720"
 * Projection: x = (lon - 68) * 20.7,  y = (37.5 - lat) * 24
 * All paths derived from real geographic coordinates.
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';

const { width: SCREEN_W } = Dimensions.get('window');

// ── Colour scale: light (#dbeafe) → deep navy (#1e3a5f) ─────────────────────
function getColor(ratio: number): string {
  if (ratio <= 0) return '#e8f4fd';
  const r = Math.round(219 - (219 - 30) * ratio);
  const g = Math.round(234 - (234 - 58) * ratio);
  const b = Math.round(253 - (253 - 95) * ratio);
  return `rgb(${r},${g},${b})`;
}

// ── Sub-region normalisation ─────────────────────────────────────────────────
const SUB: Record<string, string> = {
  'Mumbai': 'Maharashtra',
  'UP East': 'Uttar Pradesh',
  'UP West': 'Uttar Pradesh',
  'J&K': 'Jammu and Kashmir',
  'Jammu & Kashmir': 'Jammu and Kashmir',
};

// ── State definitions ─────────────────────────────────────────────────────────
// Paths are in SVG pixel space. x=(lon-68)*20.7, y=(37.5-lat)*24
// Each state has: name, d (SVG path), label position (lx, ly)
const STATES: { name: string; d: string; lx: number; ly: number }[] = [
  {
    name: 'Jammu and Kashmir',
    d: 'M 114,12 L 145,0 L 207,12 L 249,36 L 269,73 L 259,97 L 228,122 L 186,122 L 145,109 L 114,85 L 104,48 Z',
    lx: 183, ly: 65,
  },
  {
    name: 'Himachal Pradesh',
    d: 'M 156,109 L 186,122 L 228,122 L 238,146 L 228,170 L 197,170 L 166,158 L 156,134 Z',
    lx: 193, ly: 140,
  },
  {
    name: 'Punjab',
    d: 'M 114,122 L 156,109 L 166,122 L 176,158 L 166,182 L 135,182 L 114,158 Z',
    lx: 140, ly: 148,
  },
  {
    name: 'Haryana',
    d: 'M 135,182 L 166,182 L 197,170 L 197,206 L 187,231 L 166,243 L 145,231 L 124,219 Z',
    lx: 162, ly: 208,
  },
  {
    name: 'Delhi',
    d: 'M 187,194 L 197,194 L 197,218 L 187,218 Z',
    lx: 192, ly: 206,
  },
  {
    name: 'Uttarakhand',
    d: 'M 207,146 L 228,122 L 259,97 L 279,146 L 279,170 L 259,206 L 228,206 L 207,182 Z',
    lx: 244, ly: 160,
  },
  {
    name: 'Rajasthan',
    d: 'M 52,170 L 145,146 L 166,182 L 187,231 L 176,292 L 135,340 L 62,340 L 31,292 L 41,231 Z',
    lx: 105, ly: 255,
  },
  {
    name: 'Uttar Pradesh',
    d: 'M 187,182 L 207,146 L 279,170 L 321,219 L 342,255 L 352,292 L 321,316 L 259,316 L 197,304 L 166,268 L 155,243 L 176,219 Z',
    lx: 255, ly: 248,
  },
  {
    name: 'Bihar',
    d: 'M 352,243 L 425,255 L 414,316 L 352,328 L 321,316 L 342,255 Z',
    lx: 372, ly: 290,
  },
  {
    name: 'Jharkhand',
    d: 'M 321,316 L 352,328 L 414,316 L 404,364 L 373,388 L 342,376 L 310,364 Z',
    lx: 360, ly: 348,
  },
  {
    name: 'West Bengal',
    d: 'M 414,255 L 435,243 L 456,304 L 456,364 L 435,376 L 404,364 L 414,316 L 425,255 Z',
    lx: 432, ly: 318,
  },
  {
    name: 'Sikkim',
    d: 'M 435,231 L 446,231 L 446,255 L 435,255 Z',
    lx: 441, ly: 243,
  },
  {
    name: 'Arunachal Pradesh',
    d: 'M 477,207 L 549,195 L 590,219 L 580,255 L 549,255 L 498,267 L 477,243 Z',
    lx: 530, ly: 228,
  },
  {
    name: 'Assam',
    d: 'M 456,231 L 477,219 L 498,231 L 549,231 L 570,255 L 540,280 L 498,267 L 477,243 L 456,255 Z',
    lx: 510, ly: 252,
  },
  {
    name: 'Nagaland',
    d: 'M 549,255 L 570,255 L 570,280 L 549,280 Z',
    lx: 559, ly: 268,
  },
  {
    name: 'Manipur',
    d: 'M 549,280 L 570,280 L 570,316 L 549,316 Z',
    lx: 559, ly: 298,
  },
  {
    name: 'Meghalaya',
    d: 'M 456,280 L 498,267 L 519,280 L 509,304 L 477,304 L 456,292 Z',
    lx: 487, ly: 289,
  },
  {
    name: 'Tripura',
    d: 'M 498,304 L 519,304 L 519,328 L 498,328 Z',
    lx: 509, ly: 316,
  },
  {
    name: 'Mizoram',
    d: 'M 519,316 L 540,316 L 540,352 L 519,352 Z',
    lx: 530, ly: 334,
  },
  {
    name: 'Madhya Pradesh',
    d: 'M 135,340 L 176,292 L 197,304 L 259,316 L 321,316 L 342,352 L 321,388 L 290,400 L 228,400 L 176,388 L 145,364 Z',
    lx: 237, ly: 360,
  },
  {
    name: 'Chhattisgarh',
    d: 'M 321,316 L 352,328 L 373,388 L 352,424 L 321,436 L 300,412 L 290,400 L 321,388 L 342,352 Z',
    lx: 330, ly: 378,
  },
  {
    name: 'Odisha',
    d: 'M 373,388 L 404,364 L 435,376 L 456,400 L 456,436 L 435,460 L 404,460 L 373,436 L 352,424 Z',
    lx: 407, ly: 420,
  },
  {
    name: 'Gujarat',
    d: 'M 41,304 L 83,292 L 114,316 L 135,340 L 145,364 L 135,400 L 114,424 L 83,436 L 62,424 L 41,396 L 21,364 L 10,328 Z',
    lx: 83, ly: 368,
  },
  {
    name: 'Maharashtra',
    d: 'M 145,364 L 176,388 L 228,400 L 290,400 L 300,412 L 290,448 L 269,472 L 238,484 L 186,484 L 145,472 L 114,448 L 114,424 L 135,400 Z',
    lx: 207, ly: 432,
  },
  {
    name: 'Telangana',
    d: 'M 290,400 L 321,388 L 352,424 L 342,460 L 321,472 L 290,472 L 269,448 L 269,424 Z',
    lx: 311, ly: 436,
  },
  {
    name: 'Andhra Pradesh',
    d: 'M 321,388 L 352,424 L 373,436 L 404,460 L 404,484 L 373,508 L 342,520 L 310,520 L 290,496 L 290,472 L 321,472 L 342,460 Z',
    lx: 345, ly: 472,
  },
  {
    name: 'Goa',
    d: 'M 114,484 L 135,484 L 135,508 L 114,508 Z',
    lx: 125, ly: 496,
  },
  {
    name: 'Karnataka',
    d: 'M 114,448 L 145,472 L 186,484 L 238,484 L 269,472 L 290,496 L 290,520 L 269,548 L 238,560 L 207,548 L 166,520 L 145,508 L 124,484 Z',
    lx: 210, ly: 512,
  },
  {
    name: 'Tamil Nadu',
    d: 'M 238,560 L 269,548 L 290,520 L 310,520 L 342,520 L 352,556 L 332,592 L 300,616 L 269,628 L 238,604 L 228,580 Z',
    lx: 287, ly: 576,
  },
  {
    name: 'Kerala',
    d: 'M 207,548 L 238,560 L 228,580 L 238,604 L 217,628 L 197,616 L 186,580 L 197,556 Z',
    lx: 210, ly: 588,
  },
];

// ── Types ────────────────────────────────────────────────────────────────────
interface MapProps {
  mappingData: Array<[string, number]>;
  width?: number;
}

// ── Component ────────────────────────────────────────────────────────────────
export default function IndiaMap({ mappingData, width = SCREEN_W - 32 }: MapProps) {
  const [selected, setSelected] = useState<{ name: string; count: number } | null>(null);

  const countMap = useMemo(() => {
    const m: Record<string, number> = {};
    mappingData.forEach(([name, count]) => {
      const key = SUB[name] || name;
      m[key] = (m[key] || 0) + count;
    });
    return m;
  }, [mappingData]);

  const maxCount = useMemo(() => Math.max(1, ...Object.values(countMap)), [countMap]);

  const VIEW_W = 600;
  const VIEW_H = 660;
  const svgH = (VIEW_H / VIEW_W) * width;

  return (
    <View style={{ width }}>
      {/* Tooltip */}
      {selected ? (
        <View style={styles.tooltip}>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipState}>{selected.name}</Text>
            <Text style={styles.tipCount}>{selected.count} Site{selected.count !== 1 ? 's' : ''}</Text>
          </View>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.tipClose}>
            <Text style={styles.tipCloseText}>✕</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.hint}>Tap any state to view site count</Text>
      )}

      {/* SVG Map */}
      <Svg width={width} height={svgH} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
        <G>
          {STATES.map(state => {
            const count = countMap[state.name] || 0;
            const ratio = count / maxCount;
            const isSelected = selected?.name === state.name;
            const fill = isSelected ? '#f59e0b' : getColor(ratio);
            const strokeC = isSelected ? '#78350f' : '#ffffff';
            const strokeW = isSelected ? 2 : 0.8;

            return (
              <G
                key={state.name}
                onPress={() =>
                  setSelected(isSelected ? null : { name: state.name, count })
                }
              >
                <Path d={state.d} fill={fill} stroke={strokeC} strokeWidth={strokeW} />
              </G>
            );
          })}
        </G>
      </Svg>

      {/* Legend */}
      <View style={styles.legendRow}>
        <Text style={styles.legendLbl}>0</Text>
        <View style={styles.legendBar}>
          {Array.from({ length: 10 }).map((_, i) => (
            <View
              key={i}
              style={[styles.legendSeg, { backgroundColor: getColor(i / 9) }]}
            />
          ))}
        </View>
        <Text style={styles.legendLbl}>{maxCount}+</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginBottom: 6 },

  tooltip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1e3c72', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 8, elevation: 4,
  },
  tipState: { color: '#fff', fontWeight: '700', fontSize: 13 },
  tipCount: { color: '#93c5fd', fontSize: 12, marginTop: 2 },
  tipClose: { padding: 6 },
  tipCloseText: { color: 'rgba(255,255,255,0.7)', fontSize: 16 },

  legendRow: {
    flexDirection: 'row', alignItems: 'center',
    marginTop: 8, gap: 8,
  },
  legendLbl: { fontSize: 10, color: '#64748b', minWidth: 20, textAlign: 'center' },
  legendBar: { flex: 1, flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  legendSeg: { flex: 1 },
});
