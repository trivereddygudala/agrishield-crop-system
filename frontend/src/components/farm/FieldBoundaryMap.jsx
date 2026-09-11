import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, Trash2, Plus, Crosshair, X, Check,
  Maximize2, Undo2, ChevronLeft, Satellite, Map as MapIcon, Info
} from 'lucide-react';

// Geodesic Polygon Area Calculation in Square Meters (WGS 84 ellipsoid)
export function calculateGeodesicArea(coordinates) {
  if (!coordinates || coordinates.length < 3) return 0;
  const R = 6378137; // Earth radius in meters
  let area = 0;
  const len = coordinates.length;

  for (let i = 0; i < len; i++) {
    const p1 = coordinates[i];
    const p2 = coordinates[(i + 1) % len];

    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const lon1 = (p1[1] * Math.PI) / 180;
    const lon2 = (p2[1] * Math.PI) / 180;

    area += (lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  area = Math.abs((area * R * R) / 4.0);
  return area;
}

// Convert Square Meters to Acres and Hectares
export function formatAcreage(sqMeters) {
  const acres = sqMeters * 0.000247105;
  const hectares = sqMeters / 10000;
  return {
    acres: acres < 10 ? acres.toFixed(2) : acres.toFixed(1),
    hectares: hectares < 10 ? hectares.toFixed(2) : hectares.toFixed(1),
    rawAcres: acres
  };
}

// Helper: Normalize incoming boundary coordinates into a flat array of pins [[lat, lng], ...]
function normalizeIncomingPins(raw) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  // If already array of coordinate pairs: [[lat, lng], ...]
  if (Array.isArray(raw[0])) return raw;
  // If legacy multi-plot structure: [{ pins: [[lat, lng], ...] }]
  if (typeof raw[0] === 'object' && Array.isArray(raw[0].pins)) {
    return raw[0].pins;
  }
  return [];
}

export default function FieldBoundaryMap({
  centerLat = 15.5057,
  centerLng = 80.0499,
  farmName = 'My Farm',
  cropName = 'Tomato',
  boundaryCoordinates = [],
  onBoundaryChange,
  nearbyFarms = [],
  showRadarRings = false,
  radarRadius = 5,
  isTelugu = false,
  interactive = true,
  height = '420px',
  onExpand,
  onBack,
  backLabel,
  isDedicated = false
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const boundaryLayerGroupRef = useRef(null);
  const pinsGroupRef = useRef(null);
  const radarGroupRef = useRef(null);

  // Sync tracking to prevent infinite update loops
  const isUserActionRef = useRef(false);

  // 1. Single Field Boundary Pins: [[lat, lng], ...]
  const [pins, setPins] = useState(() => normalizeIncomingPins(boundaryCoordinates));

  // 2. Map Layer: 'hybrid' (Google Satellite) or 'street' (OpenStreetMap)
  const [mapType, setMapType] = useState('hybrid');

  // 3. Pin Dropping Mode
  const [isPinMode, setIsPinMode] = useState(false);

  // 4. Fullscreen Studio Toggle (for inline preview instances)
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 5. Undo History Stack
  const [history, setHistory] = useState(() => [normalizeIncomingPins(boundaryCoordinates)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Push pins to undo history
  const pushToHistory = useCallback((newPins) => {
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, [...newPins]];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Coordinate rounding helper
  const roundCoord = (val) => parseFloat(Number(val).toFixed(6));

  // Compute live acreage for the single field
  const area = React.useMemo(() => {
    const sqM = calculateGeodesicArea(pins);
    return formatAcreage(sqM);
  }, [pins]);

  // Sync with incoming boundaryCoordinates from parent
  useEffect(() => {
    if (isUserActionRef.current) {
      isUserActionRef.current = false;
      return;
    }
    const incoming = normalizeIncomingPins(boundaryCoordinates);
    setPins(incoming);
    setHistory([incoming]);
    setHistoryIndex(0);
  }, [boundaryCoordinates]);

  // Notify parent component whenever pins change
  const notifyChange = useCallback((updatedPins) => {
    if (onBoundaryChange) {
      const sqM = calculateGeodesicArea(updatedPins);
      const formatted = formatAcreage(sqM);
      onBoundaryChange(updatedPins, formatted);
    }
  }, [onBoundaryChange]);

  // ═══════ INITIALIZE LEAFLET MAP ═══════
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 17,
      zoomControl: false,
      attributionControl: false
    });

    // Zoom controls placed unobtrusively at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Google Ultra-Zoom Hybrid Satellite Layer
    const hybridLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 22,
      maxNativeZoom: 20
    }).addTo(map);
    tileLayerRef.current = hybridLayer;

    // Feature Layers
    boundaryLayerGroupRef.current = L.layerGroup().addTo(map);
    pinsGroupRef.current = L.layerGroup().addTo(map);
    radarGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate map size on layout changes
  useEffect(() => {
    const invalidate = () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    };
    const t1 = setTimeout(invalidate, 100);
    const t2 = setTimeout(invalidate, 300);
    window.addEventListener('resize', invalidate);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', invalidate);
    };
  }, [isFullscreen, isDedicated, height]);

  // Center map on farm location
  const centerMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && centerLat && centerLng) {
      map.setView([centerLat, centerLng], 17, { animate: true });
    }
  }, [centerLat, centerLng]);

  // Re-center if center coordinates change from parent
  useEffect(() => {
    centerMap();
  }, [centerLat, centerLng, centerMap]);

  // Switch Tile Provider: Satellite vs Street Map
  const switchMapType = (type) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setMapType(type);

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (type === 'hybrid') {
      tileLayerRef.current = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 22,
        maxNativeZoom: 20
      }).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        maxNativeZoom: 19
      }).addTo(map);
    }
  };

  // ═══════ TAP MAP TO DROP CORNER PINS ═══════
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (!isPinMode || !interactive) return;
      const { lat, lng } = e.latlng;
      const newPin = [roundCoord(lat), roundCoord(lng)];

      isUserActionRef.current = true;
      setPins((prev) => {
        const next = [...prev, newPin];
        pushToHistory(next);
        notifyChange(next);
        return next;
      });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPinMode, interactive, pushToHistory, notifyChange]);

  // ═══════ PIN MANAGEMENT ACTIONS ═══════
  const handleUndo = () => {
    if (historyIndex > 0) {
      const targetIndex = historyIndex - 1;
      const targetPins = history[targetIndex];
      isUserActionRef.current = true;
      setPins(targetPins);
      setHistoryIndex(targetIndex);
      notifyChange(targetPins);
    }
  };

  const handleClearAllPins = () => {
    if (pins.length === 0) return;
    isUserActionRef.current = true;
    const emptyPins = [];
    setPins(emptyPins);
    pushToHistory(emptyPins);
    notifyChange(emptyPins);
    setIsPinMode(true); // Automatically activate pin mode so farmer can tap right away
  };

  const handleRemoveSinglePin = (indexToRemove) => {
    isUserActionRef.current = true;
    setPins((prev) => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      pushToHistory(next);
      notifyChange(next);
      return next;
    });
  };

  // ═══════ RENDER FARM CENTER, POLYGON & PINS ═══════
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !boundaryLayerGroupRef.current || !pinsGroupRef.current) return;

    boundaryLayerGroupRef.current.clearLayers();
    pinsGroupRef.current.clearLayers();

    // 1. Center Farm Pin
    const farmCenterIcon = L.divIcon({
      className: 'custom-farm-center-pin',
      html: `
        <div style="background: linear-gradient(135deg, #10b981, #047857); color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16,185,129,0.5); border: 2.5px solid white; font-size: 16px;">
          🌾
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });

    L.marker([centerLat, centerLng], { icon: farmCenterIcon })
      .addTo(pinsGroupRef.current)
      .bindPopup(`
        <div style="font-family: inherit; padding: 4px; text-align: center;">
          <strong style="color: #047857; font-size: 13px;">🌾 ${farmName}</strong>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #475569; font-weight: bold;">
            ${cropName} • ${area.acres} ${isTelugu ? 'ఎకరాలు' : 'Acres'}
          </p>
        </div>
      `);

    // 2. Draw Connected Boundary Polygon (if 3+ pins) or Line (if 2 pins)
    if (pins.length >= 3) {
      L.polygon(pins, {
        color: '#10b981',
        weight: 3,
        fillColor: '#10b981',
        fillOpacity: 0.28
      }).addTo(boundaryLayerGroupRef.current);
    } else if (pins.length === 2) {
      L.polyline(pins, {
        color: '#10b981',
        weight: 3,
        dashArray: '6, 6'
      }).addTo(boundaryLayerGroupRef.current);
    }

    // 3. Render Corner Pins (Numbered 1, 2, 3...)
    if (interactive) {
      pins.forEach((pin, index) => {
        const pinIcon = L.divIcon({
          className: `farmer-pin-${index}`,
          html: `
            <div style="background: #10b981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; box-shadow: 0 2px 8px rgba(0,0,0,0.4); border: 2.5px solid white; cursor: grab; transition: transform 0.15s;">
              ${index + 1}
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });

        const marker = L.marker(pin, { icon: pinIcon, draggable: true }).addTo(pinsGroupRef.current);

        // Allow dragging corner pins to fine-tune boundaries
        marker.on('dragend', (ev) => {
          const { lat, lng } = ev.target.getLatLng();
          isUserActionRef.current = true;
          setPins((prev) => {
            const next = [...prev];
            next[index] = [roundCoord(lat), roundCoord(lng)];
            pushToHistory(next);
            notifyChange(next);
            return next;
          });
        });

        // Popup to delete pin if needed
        marker.bindPopup(`
          <div style="font-family: inherit; padding: 2px; text-align: center;">
            <strong style="font-size: 11px; color: #0f172a;">${isTelugu ? `మూల పిన్ #${index + 1}` : `Corner Pin #${index + 1}`}</strong>
            <div style="margin-top: 6px;">
              <button id="btn-del-pin-${index}" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: bold; cursor: pointer;">
                🗑️ ${isTelugu ? 'ఈ పిన్ తీసివేయి' : 'Delete Pin'}
              </button>
            </div>
          </div>
        `);

        marker.on('popupopen', () => {
          const btn = document.getElementById(`btn-del-pin-${index}`);
          if (btn) {
            btn.onclick = () => {
              handleRemoveSinglePin(index);
              map.closePopup();
            };
          }
        });
      });
    }

    // 4. Render Radar Rings and Nearby Farms (for Disease Radar mode)
    if (showRadarRings && radarGroupRef.current) {
      radarGroupRef.current.clearLayers();
      const ringDistances = [1000, 3000, 5000]; // 1km, 3km, 5km
      ringDistances.forEach((radiusMeters) => {
        L.circle([centerLat, centerLng], {
          radius: radiusMeters,
          color: '#0284c7',
          weight: 1.2,
          dashArray: '4, 6',
          fill: false
        }).addTo(radarGroupRef.current);
      });

      // Render Nearby Neighbor Farms
      if (Array.isArray(nearbyFarms)) {
        nearbyFarms.forEach((f) => {
          if (!f.lat || !f.lng) return;
          const isInfected = f.status === 'infected';
          const neighborIcon = L.divIcon({
            className: 'nearby-farm-pin',
            html: `
              <div style="background: ${isInfected ? '#ef4444' : '#10b981'}; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; box-shadow: 0 2px 6px rgba(0,0,0,0.35); border: 2px solid white;">
                ${isInfected ? '⚠️' : '🌿'}
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          L.marker([f.lat, f.lng], { icon: neighborIcon })
            .addTo(radarGroupRef.current)
            .bindPopup(`
              <div style="font-family: inherit; padding: 3px;">
                <strong style="color: #0f172a; font-size: 12px;">${f.name || 'Neighbor Farm'}</strong>
                <p style="margin: 2px 0 0 0; font-size: 10px; color: ${isInfected ? '#dc2626' : '#16a34a'}; font-weight: bold;">
                  ${f.crop || 'Crop'} • ${isInfected ? (isTelugu ? 'వ్యాధి సోకింది' : 'Infected') : (isTelugu ? 'ఆరోగ్యంగా ఉంది' : 'Healthy')}
                </p>
              </div>
            `);
        });
      }
    }
  }, [pins, centerLat, centerLng, farmName, cropName, interactive, isTelugu, showRadarRings, nearbyFarms, area.acres]);

  // Determine if full-screen or dedicated mode is active
  const isFullScreenView = isFullscreen || isDedicated;

  // Handle Back Navigation
  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      setIsFullscreen(false);
    }
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-200 w-full max-w-full min-w-0 ${
        isFullScreenView
          ? 'fixed inset-0 z-[9999] w-screen h-[100dvh] bg-slate-950 flex flex-col'
          : 'rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md bg-slate-900 flex flex-col'
      }`}
      style={{
        height: isFullScreenView ? '100dvh' : height,
        minHeight: isFullScreenView ? '100dvh' : height
      }}
    >
      {/* ═══════ 1. TOP HEADER BAR: CLEAN, BIG & IMPOSSIBLE TO MISS ═══════ */}
      <div className={`border-b px-3 py-2.5 flex items-center justify-between gap-2 z-30 shrink-0 min-w-0 max-w-full ${
        isFullScreenView
          ? 'bg-slate-900 text-white border-slate-800 shadow-md'
          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800'
      }`}>
        {/* Left: Prominent Back Button (in Studio or Preview with onBack) */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {(isFullScreenView || onBack) ? (
            <button
              type="button"
              onClick={handleBackNavigation}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
              <span className="font-extrabold truncate max-w-[160px]">
                {backLabel || (isTelugu ? '← వెనుకకు' : '← Back')}
              </span>
            </button>
          ) : null}

          {/* Farm Name & Area Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate max-w-[90px] xs:max-w-[130px] text-slate-900 dark:text-white">
              {farmName}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-extrabold ml-1">
              🌾 {area.acres} {isTelugu ? 'ఎక' : 'Ac'}
            </span>
          </div>
        </div>

        {/* Right: Satellite/Street Toggle & Save/Expand Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Map Layer Switcher: Satellite vs Normal */}
          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => switchMapType('hybrid')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                mapType === 'hybrid'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isTelugu ? 'శాటిలైట్ మ్యాప్' : 'Satellite Map'}
            >
              🛰️ Sat
            </button>
            <button
              type="button"
              onClick={() => switchMapType('street')}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                mapType === 'street'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isTelugu ? 'వీధి మ్యాప్' : 'Street Map'}
            >
              🗺️ Map
            </button>
          </div>

          {/* Action Button: Save & Finish (in Studio) OR Open Full-Screen (in Preview) */}
          {isFullScreenView ? (
            <button
              type="button"
              onClick={handleBackNavigation}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
              title={isTelugu ? 'సరిహద్దు భద్రపరచి ముగించండి' : 'Save boundary and return'}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span className="font-extrabold">{isTelugu ? 'సేవ్ చేయి' : 'Save'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (onExpand) {
                  onExpand();
                } else {
                  setIsFullscreen(true);
                }
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all shrink-0 cursor-pointer active:scale-95"
              title={isTelugu ? 'పూర్తి స్క్రీన్ తెరవండి' : 'Open Full-Screen Studio'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="font-bold">{isTelugu ? 'స్టూడియో' : 'Studio'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════ 2. PERSISTENT FLOATING BACK BUTTON (CANNOT BE MISSED) ═══════ */}
      {isFullScreenView && (
        <button
          type="button"
          onClick={handleBackNavigation}
          className="absolute top-14 left-3 z-[1000] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer border border-emerald-400/50"
        >
          <ChevronLeft className="w-4 h-4 stroke-[3]" />
          <span>{isTelugu ? '← వెనుకకు' : '← Back'}</span>
        </button>
      )}

      {/* ═══════ 3. FRIENDLY FARMER GUIDANCE BANNER (TOP CENTER) ═══════ */}
      {interactive && (
        <div className="absolute top-14 inset-x-0 z-20 flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto bg-slate-900/90 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-700 shadow-xl text-xs flex items-center gap-2 max-w-sm text-center">
            {isPinMode ? (
              <span className="font-bold text-emerald-300 animate-pulse">
                📍 {isTelugu ? 'మ్యాప్‌పై మీ పొలం మూలలను తాకండి' : 'Tap the corners of your field on the map'}
              </span>
            ) : pins.length >= 3 ? (
              <span className="font-bold text-slate-100">
                🌾 {isTelugu ? `విస్తీర్ణం: ${area.acres} ఎకరాలు (${pins.length} మూలలు)` : `Area: ${area.acres} Acres (${pins.length} corners)`}
              </span>
            ) : (
              <span className="text-slate-300">
                ℹ️ {isTelugu ? 'క్రింద "+ పిన్ వేయి" నొక్కి మూలలను గుర్తించండి' : 'Tap "+ Add Pin" below to mark field corners'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ═══════ 4. MAP CANVAS CONTAINER ═══════ */}
      <div
        ref={mapContainerRef}
        style={{ height: '100%', minHeight: '100%' }}
        className="w-full relative z-0 flex-1 outline-none min-h-0"
      />

      {/* ═══════ 5. SIMPLE FARMER ACTION DOCK (BOTTOM CENTER) ═══════ */}
      {interactive && (
        <div className="absolute bottom-4 sm:bottom-6 inset-x-3 z-30 flex justify-center pointer-events-none pb-safe">
          <div className="flex items-center gap-2 bg-slate-900/95 text-white backdrop-blur-xl p-1.5 rounded-2xl shadow-2xl border border-slate-700/80 pointer-events-auto">
            {/* 1. Add Pin Toggle Button */}
            <button
              type="button"
              onClick={() => setIsPinMode(!isPinMode)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                isPinMode
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-md animate-pulse'
                  : 'bg-emerald-600/80 hover:bg-emerald-600 text-white shadow-xs'
              }`}
            >
              <MapPin className="w-4 h-4" />
              <span>
                {isPinMode
                  ? (isTelugu ? 'తాకండి...' : 'Tap Map...')
                  : (isTelugu ? '+ పిన్ వేయి' : '+ Add Pin')}
              </span>
            </button>

            {/* 2. Undo Last Pin */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0 || pins.length === 0}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
              title={isTelugu ? 'చివరి పిన్ రద్దు చేయి' : 'Undo last pin'}
            >
              <Undo2 className="w-4 h-4" />
              <span className="hidden xs:inline">{isTelugu ? 'రద్దు' : 'Undo'}</span>
            </button>

            {/* 3. Clear All Pins */}
            {pins.length > 0 && (
              <button
                type="button"
                onClick={handleClearAllPins}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
                title={isTelugu ? 'అన్ని పిన్స్ తొలగించండి' : 'Clear all pins'}
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden xs:inline">{isTelugu ? 'తీసివేయి' : 'Clear'}</span>
              </button>
            )}

            {/* 4. Recenter Map on Farm */}
            <button
              type="button"
              onClick={centerMap}
              className="flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer"
              title={isTelugu ? 'నా పొలం కేంద్రం' : 'Center on farm'}
            >
              <Crosshair className="w-4 h-4" />
              <span className="hidden sm:inline">{isTelugu ? 'నా పొలం' : 'My Farm'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
