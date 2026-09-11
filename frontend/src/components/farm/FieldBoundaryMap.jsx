import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, MapPin, Trash2, Plus, RefreshCw, Compass, ShieldAlert, Sparkles, Check, Info } from 'lucide-react';

// Geodesic Polygon Area Calculation in Square Meters
function calculateGeodesicArea(coordinates) {
  if (!coordinates || coordinates.length < 3) return 0;
  const R = 6378137; // Earth radius in meters (WGS 84)
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
function formatAcreage(sqMeters) {
  const acres = sqMeters * 0.000247105;
  const hectares = sqMeters / 10000;
  return {
    acres: acres < 10 ? acres.toFixed(2) : acres.toFixed(1),
    hectares: hectares < 10 ? hectares.toFixed(2) : hectares.toFixed(1),
    rawAcres: acres
  };
}

export default function FieldBoundaryMap({
  centerLat = 16.5062,
  centerLng = 80.6480,
  farmName = 'My Farm',
  cropName = 'Tomato',
  boundaryCoordinates = [],
  onBoundaryChange,
  nearbyFarms = [],
  showRadarRings = true,
  radarRadius = 5,
  isTelugu = false,
  interactive = true,
  height = '440px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const polygonLayerRef = useRef(null);
  const pinsGroupRef = useRef(null);
  const radarGroupRef = useRef(null);
  const nearbyGroupRef = useRef(null);
  const tileLayerRef = useRef(null);

  const [mapType, setMapType] = useState('satellite'); // 'satellite' | 'street'
  const [pins, setPins] = useState(
    boundaryCoordinates && boundaryCoordinates.length >= 3 
      ? boundaryCoordinates 
      : []
  );
  const [isPinMode, setIsPinMode] = useState(false);
  const [calculatedArea, setCalculatedArea] = useState({ acres: '0.00', hectares: '0.00', rawAcres: 0 });

  // Update acreage when pins change
  useEffect(() => {
    if (pins.length >= 3) {
      const sqMeters = calculateGeodesicArea(pins);
      const formatted = formatAcreage(sqMeters);
      setCalculatedArea(formatted);
      if (onBoundaryChange) {
        onBoundaryChange(pins, formatted);
      }
    } else {
      setCalculatedArea({ acres: '0.00', hectares: '0.00', rawAcres: 0 });
    }
  }, [pins, onBoundaryChange]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 16,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Default: Satellite Layer
    const satLayer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    ).addTo(map);
    tileLayerRef.current = satLayer;

    // Feature Groups
    pinsGroupRef.current = L.layerGroup().addTo(map);
    radarGroupRef.current = L.layerGroup().addTo(map);
    nearbyGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Handle Satellite / Street Switch
  const switchMapType = (type) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setMapType(type);

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (type === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19 }
      ).addTo(map);
    }
  };

  // Center on Farm
  const centerMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && centerLat && centerLng) {
      map.setView([centerLat, centerLng], 16, { animate: true });
    }
  }, [centerLat, centerLng]);

  // Dynamically pan map view when farmer location coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && centerLat && centerLng) {
      map.setView([centerLat, centerLng], map.getZoom() || 16, { animate: true });
    }
  }, [centerLat, centerLng]);

  // Click on Map to add boundary pins
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (!isPinMode) return;
      const { lat, lng } = e.latlng;
      setPins((prev) => [...prev, [roundCoord(lat), roundCoord(lng)]]);
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPinMode]);

  const roundCoord = (val) => parseFloat(val.toFixed(6));

  // Render Boundary Pins & Polygon
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !pinsGroupRef.current) return;

    pinsGroupRef.current.clearLayers();

    // 1. Center Farm Pin
    const farmIcon = L.divIcon({
      className: 'custom-farm-pin',
      html: `
        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(16,185,129,0.5); border: 2.5px solid white; font-size: 16px;">
          🌾
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    L.marker([centerLat, centerLng], { icon: farmIcon })
      .addTo(pinsGroupRef.current)
      .bindPopup(`
        <div style="font-family: inherit; padding: 2px;">
          <strong style="color: #047857; font-size: 13px;">🌾 ${farmName}</strong>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: #475569;">
            ${cropName} • [${centerLat.toFixed(4)}, ${centerLng.toFixed(4)}]
          </p>
        </div>
      `);

    // 2. Corner Boundary Pins
    pins.forEach((pin, index) => {
      const pinLabel = String.fromCharCode(65 + index); // A, B, C, D...
      const cornerIcon = L.divIcon({
        className: 'corner-boundary-pin',
        html: `
          <div style="background: #0284c7; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12px; box-shadow: 0 3px 10px rgba(2,132,199,0.6); border: 2px solid white; cursor: grab;">
            ${pinLabel}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker(pin, {
        icon: cornerIcon,
        draggable: interactive
      }).addTo(pinsGroupRef.current);

      marker.bindTooltip(`Pin ${pinLabel}`, { direction: 'top', offset: [0, -12] });

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setPins((prev) => {
          const updated = [...prev];
          updated[index] = [roundCoord(lat), roundCoord(lng)];
          return updated;
        });
      });
    });

    // 3. Draw Connecting Polygon
    if (pins.length >= 3) {
      if (polygonLayerRef.current) {
        map.removeLayer(polygonLayerRef.current);
      }
      polygonLayerRef.current = L.polygon(pins, {
        color: '#10b981',
        weight: 3,
        opacity: 0.9,
        fillColor: '#34d399',
        fillOpacity: 0.28,
        dashArray: '4, 6'
      }).addTo(pinsGroupRef.current);
    }
  }, [pins, centerLat, centerLng, farmName, cropName, interactive]);

  // Render Radar Rings & Nearby Outbreaks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !radarGroupRef.current || !nearbyGroupRef.current) return;

    radarGroupRef.current.clearLayers();
    nearbyGroupRef.current.clearLayers();

    if (!showRadarRings) return;

    // 1 km ring (immediate spore hazard zone)
    L.circle([centerLat, centerLng], {
      radius: 1000,
      color: '#ef4444',
      weight: 1.5,
      opacity: 0.5,
      fillColor: '#ef4444',
      fillOpacity: 0.04,
      dashArray: '5, 8'
    }).addTo(radarGroupRef.current);

    // 3 km ring (monitoring perimeter)
    L.circle([centerLat, centerLng], {
      radius: 3000,
      color: '#f59e0b',
      weight: 1.2,
      opacity: 0.45,
      fillColor: '#f59e0b',
      fillOpacity: 0.02,
      dashArray: '6, 10'
    }).addTo(radarGroupRef.current);

    // 5 km ring (regional alert horizon)
    L.circle([centerLat, centerLng], {
      radius: 5000,
      color: '#3b82f6',
      weight: 1.0,
      opacity: 0.35,
      fillColor: '#3b82f6',
      fillOpacity: 0.01,
      dashArray: '8, 12'
    }).addTo(radarGroupRef.current);

    // Render Nearby Farmer Pins
    nearbyFarms.forEach((nb) => {
      const isInfected = nb.status === 'Infected';
      const markerColor = isInfected ? '#ef4444' : '#10b981';
      const markerEmoji = isInfected ? '⚠️' : '🌱';

      const nbIcon = L.divIcon({
        className: 'nearby-farm-icon',
        html: `
          <div style="background: ${markerColor}; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; box-shadow: 0 2px 8px ${markerColor}80; border: 2px solid white; cursor: pointer;">
            ${markerEmoji}
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const nbMarker = L.marker([nb.lat, nb.lng], { icon: nbIcon }).addTo(nearbyGroupRef.current);

      nbMarker.bindPopup(`
        <div style="font-family: inherit; min-width: 170px; padding: 2px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 6px;">
            <strong style="font-size: 12px; color: #0f172a;">${nb.farmer_name}</strong>
            <span style="font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 6px; background: ${isInfected ? '#fee2e2' : '#dcfce7'}; color: ${isInfected ? '#b91c1c' : '#15803d'};">
              ${nb.distance_km} km ${nb.bearing || ''}
            </span>
          </div>
          <p style="margin: 0; font-size: 11px; color: #475569;">
            🌾 <strong>${isTelugu ? 'పంట' : 'Crop'}:</strong> ${nb.crop} (${nb.variety || 'Standard'})
          </p>
          <p style="margin: 3px 0 0 0; font-size: 11px; color: ${isInfected ? '#dc2626' : '#16a34a'}; font-weight: 700;">
            ${isInfected ? `🚨 ${nb.disease}` : `✅ ${isTelugu ? 'ఆరోగ్యకరమైనది' : 'Healthy Canopy'}`}
          </p>
          ${isInfected ? `
            <div style="margin-top: 5px; font-size: 10px; background: #fff1f2; color: #be123c; padding: 3px 6px; border-radius: 4px; font-weight: 600;">
              💨 ${isTelugu ? 'గాలి ప్రసరణ రిస్క్' : 'Airborne Spore Risk'}: ${nb.wind_risk || 'Moderate'}
            </div>
          ` : ''}
        </div>
      `);
    });
  }, [centerLat, centerLng, showRadarRings, nearbyFarms, isTelugu]);

  // Seed default 4 corner pins around the center if empty
  const handleAutoGenerateBoundary = () => {
    const delta = 0.0014; // ~150 meters box (~5.5 acres)
    const box = [
      [roundCoord(centerLat + delta), roundCoord(centerLng - delta)],
      [roundCoord(centerLat + delta), roundCoord(centerLng + delta)],
      [roundCoord(centerLat - delta), roundCoord(centerLng + delta)],
      [roundCoord(centerLat - delta), roundCoord(centerLng - delta)]
    ];
    setPins(box);
    setIsPinMode(false);
  };

  const handleClearPins = () => {
    setPins([]);
    setIsPinMode(false);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
      {/* Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => switchMapType('satellite')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mapType === 'satellite'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🛰️ {isTelugu ? 'ఉపగ్రహ వీక్షణ' : 'Satellite'}
          </button>
          <button
            type="button"
            onClick={() => switchMapType('street')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              mapType === 'street'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            🗺️ {isTelugu ? 'రోడ్ల మ్యాప్' : 'Street'}
          </button>
        </div>

        {interactive && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsPinMode(!isPinMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                isPinMode
                  ? 'bg-amber-500 text-white animate-pulse shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              {isPinMode 
                ? (isTelugu ? 'మ్యాప్‌పై క్లిక్ చేయండి' : 'Click Map to Add Pin') 
                : (isTelugu ? 'పిన్ జోడించు' : 'Add Corner Pin')}
            </button>

            {pins.length === 0 ? (
              <button
                type="button"
                onClick={handleAutoGenerateBoundary}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-all"
              >
                ✨ {isTelugu ? 'ఆటో బౌండరీ' : 'Auto Boundary'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleClearPins}
                className="p-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 transition-all"
                title={isTelugu ? 'రీసెట్ చేయండి' : 'Reset Pins'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={centerMap}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100"
              title={isTelugu ? 'కేంద్రానికి వెళ్లండి' : 'Center on Farm'}
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Map Canvas */}
      <div 
        ref={mapContainerRef} 
        style={{ height, width: '100%' }}
        className="z-10 relative cursor-crosshair"
      />

      {/* Dynamic Geodesic Acreage & Corner Pin Summary Bar */}
      <div className="p-3 bg-slate-50 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {isTelugu ? 'లెక్కించిన పొలం విస్తీర్ణం:' : 'Calculated Field Area:'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold text-sm">
              {calculatedArea.acres} {isTelugu ? 'ఎకరాలు' : 'Acres'}
            </span>
            <span className="text-slate-400 font-medium text-[11px]">
              ({calculatedArea.hectares} Ha)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
            {pins.length} {isTelugu ? 'మూల పిన్స్ సెట్ చేయబడ్డాయి' : 'Corner Boundary Pins (Drag to adjust)'}
          </span>

          {pins.length >= 3 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300">
              <Check className="w-3 h-3" /> {isTelugu ? 'జియోడెసిక్ క్లోజ్డ్ పాలీగాన్' : 'Geodesic Polygon'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
