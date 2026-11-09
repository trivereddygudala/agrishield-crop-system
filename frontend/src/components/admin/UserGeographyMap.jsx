import React, { useState, useEffect, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps';
import { Users, MapPin, TrendingUp, Globe, RefreshCw, Info, ChevronUp, ChevronDown, Layers, Flame, Radio, Cpu, Sparkles } from 'lucide-react';
import API from '../../services/api';

// India GeoJSON served locally from public folder (avoids CDN dependency)
const INDIA_TOPO_URL = '/india-states.json';

// Approximate center coordinates for each Indian state
const STATE_COORDS = {
  'Andhra Pradesh':     [79.74, 15.91],
  'Telangana':          [79.01, 17.98],
  'Tamil Nadu':         [78.65, 11.12],
  'Karnataka':          [75.71, 14.96],
  'Kerala':             [76.27, 10.85],
  'Maharashtra':        [75.71, 19.75],
  'Gujarat':            [71.59, 22.25],
  'Rajasthan':          [74.21, 27.02],
  'Uttar Pradesh':      [80.94, 26.84],
  'Madhya Pradesh':     [78.65, 23.47],
  'Punjab':             [75.34, 31.14],
  'Haryana':            [76.08, 29.05],
  'Bihar':              [85.31, 25.09],
  'West Bengal':        [87.85, 22.98],
  'Odisha':             [85.09, 20.94],
  'Assam':              [92.93, 26.20],
  'Jharkhand':          [85.27, 23.61],
  'Chhattisgarh':       [81.86, 21.27],
  'Uttarakhand':        [79.01, 30.06],
  'Himachal Pradesh':   [77.17, 31.89],
  'Goa':                [74.01, 15.29],
  'Tripura':            [91.98, 23.94],
  'Manipur':            [93.90, 24.66],
  'Meghalaya':          [91.36, 25.46],
  'Nagaland':           [94.56, 26.15],
  'Arunachal Pradesh':  [94.72, 28.21],
  'Mizoram':            [92.93, 23.16],
  'Sikkim':             [88.51, 27.53],
};

export default function UserGeographyMap() {
  const [geoData, setGeoData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredState, setHoveredState] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [sortOrder, setSortOrder] = useState('desc');
  const [position, setPosition] = useState({ coordinates: [82, 22], zoom: 1 });
  const [activeMapLayer, setActiveMapLayer] = useState('farmers'); // 'farmers' | 'outbreaks' | 'iot'
  const [selectedDistrict, setSelectedDistrict] = useState(null);

  const districtAgroData = [
    { name: "Guntur (AP)", crops: "Chilli, Cotton, Tobacco", farmers: 840, outbreaks: "Chilli Leaf Curl (High)", iotNodes: 8, status: "Active Alert", riskColor: "rose" },
    { name: "Prakasam (AP)", crops: "Tobacco, Bengal Gram, Chilli", farmers: 520, outbreaks: "Downy Mildew (Moderate)", iotNodes: 5, status: "Normal", riskColor: "emerald" },
    { name: "East Godavari (AP)", crops: "Paddy / Rice, Coconut, Banana", farmers: 610, outbreaks: "Bacterial Leaf Blight (Watch)", iotNodes: 4, status: "Watchlist", riskColor: "amber" },
    { name: "West Godavari (AP)", crops: "Paddy, Oil Palm, Sugarcane", farmers: 430, outbreaks: "Stem Rot (Low)", iotNodes: 3, status: "Normal", riskColor: "emerald" },
    { name: "Warangal (TS)", crops: "Cotton, Chilli, Maize", farmers: 490, outbreaks: "Bollworm & Wilt (Moderate)", iotNodes: 4, status: "Watchlist", riskColor: "amber" }
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [geoRes, userRes] = await Promise.all([
        fetch(INDIA_TOPO_URL).then(r => r.json()),
        API.get('/api/admin/user-geography'),
      ]);
      setGeoData(geoRes);
      setUserData(userRes.data);
    } catch (err) {
      setError('Failed to load map data. Check your internet connection.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const stateCountMap = React.useMemo(() => {
    if (!userData?.locations) return {};
    return Object.fromEntries(userData.locations.map(l => [l.state, l.count]));
  }, [userData]);

  const maxCount = React.useMemo(() => {
    if (!userData?.locations?.length) return 1;
    return Math.max(...userData.locations.map(l => l.count));
  }, [userData]);

  // Bubble radius scaled to count
  const getRadius = (count) => {
    const min = 6, max = 28;
    return min + ((count / maxCount) * (max - min));
  };

  // Color intensity based on count
  const getBubbleColor = (count) => {
    if (count >= maxCount * 0.8) return '#10b981'; // emerald-500
    if (count >= maxCount * 0.5) return '#34d399'; // emerald-400
    if (count >= maxCount * 0.2) return '#6ee7b7'; // emerald-300
    return '#a7f3d0'; // emerald-200
  };

  const sortedLocations = React.useMemo(() => {
    if (!userData?.locations) return [];
    return [...userData.locations].sort((a, b) =>
      sortOrder === 'desc' ? b.count - a.count : a.count - b.count
    );
  }, [userData, sortOrder]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Loading user geography data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-3 text-center">
        <Info className="w-10 h-10 text-rose-400" />
        <p className="text-sm font-semibold text-rose-500">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition-colors">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Registered', value: userData?.total_users ?? 0, icon: Users, color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
          { label: 'Located Users', value: userData?.located_users ?? 0, icon: MapPin, color: 'text-sky-600 bg-sky-50 dark:bg-sky-950/40' },
          { label: 'States Covered', value: userData?.locations?.length ?? 0, icon: Globe, color: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
          { label: 'No Location Set', value: userData?.unlocated_users ?? 0, icon: TrendingUp, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-extrabold text-slate-900 dark:text-slate-100">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Map + Legend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* India SVG Map */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-500" />
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">India — User Distribution</h3>
            </div>

            {/* Layer Switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
              <button
                onClick={() => setActiveMapLayer('farmers')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeMapLayer === 'farmers' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Farmers
              </button>
              <button
                onClick={() => setActiveMapLayer('outbreaks')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeMapLayer === 'outbreaks' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Flame className="w-3 h-3" />
                <span>Outbreaks</span>
              </button>
              <button
                onClick={() => setActiveMapLayer('iot')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  activeMapLayer === 'iot' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Radio className="w-3 h-3" />
                <span>IoT Nodes</span>
              </button>

              <button
                onClick={fetchData}
                className="p-1 rounded-lg text-slate-400 hover:text-emerald-600 transition-colors ml-1"
                title="Refresh Map"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="relative w-full" style={{ height: '420px' }}>
            {geoData && (
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{ scale: 900, center: [82, 22] }}
                style={{ width: '100%', height: '100%' }}
              >
                <ZoomableGroup
                  center={position.coordinates}
                  zoom={position.zoom}
                  onMoveEnd={setPosition}
                  minZoom={0.8}
                  maxZoom={4}
                >
                  <Geographies geography={geoData}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const stateName = geo.properties.ST_NM || geo.properties.name || '';
                        const count = stateCountMap[stateName] || 0;
                        const isHovered = hoveredState === stateName;

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            onMouseEnter={(e) => {
                              setHoveredState(stateName);
                              setTooltipPos({ x: e.clientX, y: e.clientY });
                            }}
                            onMouseLeave={() => setHoveredState(null)}
                            style={{
                              default: {
                                fill: count > 0
                                  ? `rgba(16, 185, 129, ${0.1 + (count / maxCount) * 0.4})`
                                  : '#f1f5f9',
                                stroke: '#cbd5e1',
                                strokeWidth: 0.5,
                                outline: 'none',
                              },
                              hover: {
                                fill: count > 0 ? 'rgba(16, 185, 129, 0.6)' : '#e2e8f0',
                                stroke: '#10b981',
                                strokeWidth: 1,
                                outline: 'none',
                                cursor: 'pointer',
                              },
                              pressed: { outline: 'none' },
                            }}
                          />
                        );
                      })
                    }
                  </Geographies>

                  {/* Bubble Markers */}
                  {userData?.locations?.map(({ state, count }) => {
                    const coords = STATE_COORDS[state];
                    if (!coords) return null;
                    const r = getRadius(count);
                    const color = getBubbleColor(count);
                    const isHov = hoveredState === state;

                    return (
                      <Marker key={state} coordinates={coords}>
                        <circle
                          r={isHov ? r + 3 : r}
                          fill={color}
                          fillOpacity={0.85}
                          stroke="#fff"
                          strokeWidth={1.5}
                          style={{ cursor: 'pointer', transition: 'r 0.2s ease' }}
                          onMouseEnter={(e) => {
                            setHoveredState(state);
                            setTooltipPos({ x: e.clientX, y: e.clientY });
                          }}
                          onMouseLeave={() => setHoveredState(null)}
                        />
                        {count > 0 && r > 12 && (
                          <text
                            textAnchor="middle"
                            dy="0.35em"
                            fontSize={r > 18 ? 9 : 7}
                            fontWeight="700"
                            fill="#065f46"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            {count}
                          </text>
                        )}
                      </Marker>
                    );
                  })}
                </ZoomableGroup>
              </ComposableMap>
            )}

            {/* Tooltip */}
            {hoveredState && stateCountMap[hoveredState] !== undefined && (
              <div
                className="fixed z-50 pointer-events-none px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-xl border border-slate-700"
                style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 40 }}
              >
                <p className="text-emerald-400">{hoveredState}</p>
                <p>{stateCountMap[hoveredState] ?? 0} registered user{(stateCountMap[hoveredState] ?? 0) !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>

          {/* Zoom hint */}
          <p className="text-[10px] text-slate-400 text-center mt-2">Scroll to zoom · Drag to pan · Hover for details</p>
        </div>

        {/* State Leaderboard */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-500" />
              State Breakdown
            </h3>
            <button
              onClick={() => setSortOrder(s => s === 'desc' ? 'asc' : 'desc')}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
            >
              {sortOrder === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
              {sortOrder === 'desc' ? 'Most First' : 'Least First'}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-96">
            {sortedLocations.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No location data yet. Users need to set their farm location.
              </div>
            ) : (
              sortedLocations.map(({ state, count }, idx) => {
                const pct = Math.round((count / (userData?.located_users || 1)) * 100);
                return (
                  <div
                    key={state}
                    className={`p-2.5 rounded-xl border transition-all cursor-default ${hoveredState === state ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : 'border-slate-100 dark:border-slate-800 hover:border-emerald-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                    onMouseEnter={() => setHoveredState(state)}
                    onMouseLeave={() => setHoveredState(null)}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold text-slate-400 w-4">#{idx + 1}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{state}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">{count}</span>
                        <span className="text-[10px] text-slate-400">({pct}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Unlocated users note */}
          {userData?.unlocated_users > 0 && (
            <div className="mt-3 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40">
              <p className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                ⚠️ {userData.unlocated_users} user{userData.unlocated_users !== 1 ? 's' : ''} have no location set in their profile.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── AP & Telangana District Agricultural Clusters Deck ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
              Andhra Pradesh & Telangana Farming Zone Clusters
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-400">
            District drilldown & local crop pathology monitors
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {districtAgroData.map((d, i) => (
            <div
              key={i}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                selectedDistrict === d.name
                  ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30'
                  : 'border-slate-200/80 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-800/40 hover:border-emerald-300'
              }`}
              onClick={() => setSelectedDistrict(selectedDistrict === d.name ? null : d.name)}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-black text-slate-900 dark:text-white text-xs">{d.name}</span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                  d.riskColor === 'rose'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse'
                    : d.riskColor === 'amber'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                }`}>
                  {d.status}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium truncate mb-2">
                Crops: {d.crops}
              </div>
              <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-[10px] font-mono text-slate-400">
                <span>{d.farmers} Farmers</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{d.iotNodes} IoT Nodes</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
