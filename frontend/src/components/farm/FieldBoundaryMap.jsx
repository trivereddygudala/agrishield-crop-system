import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  MapPin, Trash2, Plus, Crosshair, X, Check,
  Maximize2, Undo2, ChevronLeft, Footprints, Play, Pause, AlertCircle, ShieldCheck, Share2
} from 'lucide-react';

// Haversine distance in meters
export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate bearing between two points
function calculateBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

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

// Calculate Perimeter Length in Meters
export function calculatePerimeter(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;
  let totalDist = 0;
  const len = coordinates.length;
  for (let i = 0; i < len; i++) {
    if (len === 2 && i === 1) break; // If only 2 pins, only calculate distance between pin 0 and pin 1
    const p1 = coordinates[i];
    const p2 = coordinates[(i + 1) % len];
    totalDist += haversineDistanceMeters(p1[0], p1[1], p2[0], p2[1]);
  }
  return Math.round(totalDist);
}

// Convert Square Meters to Indian Regional & International Units
export function formatAcreage(sqMeters) {
  const acres = sqMeters * 0.000247105;
  const hectares = sqMeters / 10000;
  const gunthas = acres * 40;
  const cents = acres * 100;
  const sqFeet = sqMeters * 10.7639;
  const gajam = sqMeters * 1.19599; // sq yards
  const bigha = acres * 1.6;

  return {
    acres: acres < 10 ? acres.toFixed(2) : acres.toFixed(1),
    hectares: hectares < 10 ? hectares.toFixed(2) : hectares.toFixed(1),
    gunthas: gunthas < 10 ? gunthas.toFixed(2) : gunthas.toFixed(1),
    cents: cents < 10 ? cents.toFixed(2) : cents.toFixed(1),
    sqMeters: Math.round(sqMeters).toLocaleString('en-IN'),
    sqFeet: Math.round(sqFeet).toLocaleString('en-IN'),
    gajam: Math.round(gajam).toLocaleString('en-IN'),
    bigha: bigha.toFixed(2),
    rawAcres: acres,
    rawSqMeters: sqMeters
  };
}

// Helper: Normalize incoming boundary coordinates into a flat array of pins [[lat, lng], ...]
function normalizeIncomingPins(raw) {
  if (!raw || !Array.isArray(raw) || raw.length === 0) return [];
  if (Array.isArray(raw[0])) return raw;
  if (typeof raw[0] === 'object' && Array.isArray(raw[0].pins)) {
    return raw[0].pins;
  }
  return [];
}

export default function FieldBoundaryMap({
  centerLat = 15.5057,
  centerLng = 80.0499,
  farmName = 'My Farm',
  cropName = '',
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
  isDedicated = false,
  mode = 'farm',
  onShare = null
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const boundaryLayerGroupRef = useRef(null);
  const pinsGroupRef = useRef(null);
  const radarGroupRef = useRef(null);
  const walkLayerGroupRef = useRef(null);

  // Sync tracking to prevent infinite update loops
  const isUserActionRef = useRef(false);

  // 1. Single Field Boundary Pins: [[lat, lng], ...]
  const [pins, setPins] = useState(() => normalizeIncomingPins(boundaryCoordinates));

  // 2. Map Layer: 'hybrid' (Google Satellite) or 'street' (OpenStreetMap)
  const [mapType, setMapType] = useState('hybrid');

  // 3. Pin Dropping Mode
  const [isPinMode, setIsPinMode] = useState(false);

  // 4. Fullscreen Studio Toggle
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 5. Undo History Stack
  const [history, setHistory] = useState(() => [normalizeIncomingPins(boundaryCoordinates)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // ═══════ 6. HIGH-PRECISION GPS WALKING SURVEY MODE ═══════
  const [isWalkMode, setIsWalkMode] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null); // accuracy in meters (e.g. 1.8m)
  const [walkDistance, setWalkDistance] = useState(0);   // total meters walked
  const [liveLocation, setLiveLocation] = useState(null); // [lat, lng]
  const watchIdRef = useRef(null);
  const walkTrailRef = useRef([]); // continuous high-res coordinates
  const lastLoggedCoordRef = useRef(null);
  const recentGpsBufferRef = useRef([]); // for moving-average smoothing
  const lastBearingRef = useRef(null);

  // Coordinate rounding helper
  const roundCoord = (val) => parseFloat(Number(val).toFixed(6));

  // Push pins to undo history
  const pushToHistory = useCallback((newPins) => {
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, [...newPins]];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Compute live acreage for the single field
  const area = useMemo(() => {
    const sqM = calculateGeodesicArea(pins);
    const perimeterM = calculatePerimeter(pins);
    const formatted = formatAcreage(sqM);
    return {
      ...formatted,
      perimeterMeters: perimeterM,
      perimeterFeet: Math.round(perimeterM * 3.28084)
    };
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
      const perimeterM = calculatePerimeter(updatedPins);
      const formatted = formatAcreage(sqM);
      onBoundaryChange(updatedPins, {
        ...formatted,
        perimeterMeters: perimeterM,
        perimeterFeet: Math.round(perimeterM * 3.28084)
      });
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
    walkLayerGroupRef.current = L.layerGroup().addTo(map);

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
      if (!isPinMode || !interactive || isWalkMode) return;
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
  }, [isPinMode, interactive, isWalkMode, pushToHistory, notifyChange]);

  // ═══════ HIGH-PRECISION GPS WALKING SURVEY IMPLEMENTATION ═══════
  const startWalkMode = () => {
    if (!navigator.geolocation) {
      alert(isTelugu ? 'మీ ఫోన్‌లో GPS సపోర్ట్ లేదు.' : 'GPS Geolocation is not supported on your device.');
      return;
    }

    setIsWalkMode(true);
    setIsWalking(true);
    setIsPinMode(false);
    setWalkDistance(0);
    walkTrailRef.current = [];
    lastLoggedCoordRef.current = null;
    recentGpsBufferRef.current = [];
    lastBearingRef.current = null;

    if (walkLayerGroupRef.current) {
      walkLayerGroupRef.current.clearLayers();
    }

    // High accuracy Geolocation Watch
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy * 10) / 10);

        // Quality Gate: Filter out loose GPS drift fixes (> 9m)
        if (accuracy > 9) return;

        // Moving Average Buffer for Sub-Meter Jitter Reduction
        recentGpsBufferRef.current.push([latitude, longitude]);
        if (recentGpsBufferRef.current.length > 3) {
          recentGpsBufferRef.current.shift();
        }

        const avgLat = recentGpsBufferRef.current.reduce((acc, c) => acc + c[0], 0) / recentGpsBufferRef.current.length;
        const avgLng = recentGpsBufferRef.current.reduce((acc, c) => acc + c[1], 0) / recentGpsBufferRef.current.length;
        const smoothCoord = [roundCoord(avgLat), roundCoord(avgLng)];

        setLiveLocation(smoothCoord);

        // Update live walk trail
        const last = lastLoggedCoordRef.current;
        if (last) {
          const stepDist = haversineDistanceMeters(last[0], last[1], smoothCoord[0], smoothCoord[1]);
          
          // Only log point if moved more than 2.5 meters
          if (stepDist >= 2.5) {
            setWalkDistance((prev) => Math.round(prev + stepDist));
            walkTrailRef.current.push(smoothCoord);
            lastLoggedCoordRef.current = smoothCoord;

            // Auto-corner bend detection (bearing turn > 28 degrees)
            if (walkTrailRef.current.length >= 3) {
              const p1 = walkTrailRef.current[walkTrailRef.current.length - 3];
              const p2 = walkTrailRef.current[walkTrailRef.current.length - 2];
              const currentBearing = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
              const newBearing = calculateBearing(p2[0], p2[1], smoothCoord[0], smoothCoord[1]);
              const diff = Math.abs(currentBearing - newBearing);
              const turnAngle = diff > 180 ? 360 - diff : diff;

              if (turnAngle >= 28 && stepDist >= 4) {
                // Auto drop corner pin on turn
                addWalkPin(smoothCoord);
              }
            }

            drawWalkHUDTrail(walkTrailRef.current, smoothCoord, accuracy);
          } else {
            drawWalkHUDTrail(walkTrailRef.current, smoothCoord, accuracy);
          }
        } else {
          // First point: drop initial starting corner pin
          walkTrailRef.current.push(smoothCoord);
          lastLoggedCoordRef.current = smoothCoord;
          addWalkPin(smoothCoord);
          drawWalkHUDTrail(walkTrailRef.current, smoothCoord, accuracy);
        }

        // Keep map centered on walking farmer
        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(smoothCoord);
        }
      },
      (err) => {
        console.warn('GPS Walking Survey error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 12000
      }
    );
  };

  // Helper to append a pin during walk survey
  const addWalkPin = (coord) => {
    isUserActionRef.current = true;
    setPins((prev) => {
      // Prevent duplicate points within 2 meters
      const exists = prev.some((p) => haversineDistanceMeters(p[0], p[1], coord[0], coord[1]) < 2);
      if (exists) return prev;
      const next = [...prev, coord];
      pushToHistory(next);
      notifyChange(next);
      return next;
    });
  };

  // Manual High-Precision Corner Drop (Farmer taps at physical corner stone)
  const handleDropManualCorner = () => {
    if (!liveLocation) return;
    addWalkPin(liveLocation);
  };

  // Draw Walk Trail & High Accuracy Live Puck on Map
  const drawWalkHUDTrail = (trail, livePoint, acc) => {
    const map = mapInstanceRef.current;
    if (!map || !walkLayerGroupRef.current) return;

    walkLayerGroupRef.current.clearLayers();

    // 1. Continuous High-Visibility Walking Trail
    if (trail.length >= 2) {
      L.polyline(trail, {
        color: '#0284c7',
        weight: 3.5,
        dashArray: '6, 6'
      }).addTo(walkLayerGroupRef.current);
    }

    // 2. High-Accuracy Live Location Puck with Pulsing Accuracy Ring
    if (livePoint) {
      // Precision circle representing GPS accuracy in meters
      if (acc && acc <= 10) {
        L.circle(livePoint, {
          radius: acc,
          color: '#0284c7',
          fillColor: '#0284c7',
          fillOpacity: 0.15,
          weight: 1.5
        }).addTo(walkLayerGroupRef.current);
      }

      const puckIcon = L.divIcon({
        className: 'gps-live-puck',
        html: `
          <div style="position: relative; width: 26px; height: 26px;">
            <div style="position: absolute; inset: 0; border-radius: 50%; background: #0284c7; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; top: 4px; left: 4px; width: 18px; height: 18px; border-radius: 50%; background: #0284c7; border: 3px solid white; box-shadow: 0 0 12px rgba(2,132,199,0.9);"></div>
          </div>
        `,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      L.marker(livePoint, { icon: puckIcon }).addTo(walkLayerGroupRef.current);
    }
  };

  // Finish Walk Survey & Lock In Measured Boundary
  const finishWalkMode = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (walkLayerGroupRef.current) {
      walkLayerGroupRef.current.clearLayers();
    }
    setIsWalkMode(false);
    setIsWalking(false);
    setLiveLocation(null);
  };

  // Cancel Walk Survey
  const cancelWalkMode = () => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (walkLayerGroupRef.current) {
      walkLayerGroupRef.current.clearLayers();
    }
    setIsWalkMode(false);
    setIsWalking(false);
    setLiveLocation(null);
  };

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
    setIsPinMode(true);
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
            ${cropName ? `${cropName} • ` : ''}${area.acres} ${isTelugu ? 'ఎకరాలు' : 'Acres'}
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

        const marker = L.marker(pin, { icon: pinIcon, draggable: !isWalkMode }).addTo(pinsGroupRef.current);

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
      const ringDistances = [1000, 3000, 5000];
      ringDistances.forEach((radiusMeters) => {
        L.circle([centerLat, centerLng], {
          radius: radiusMeters,
          color: '#0284c7',
          weight: 1.2,
          dashArray: '4, 6',
          fill: false
        }).addTo(radarGroupRef.current);
      });

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
  }, [pins, centerLat, centerLng, farmName, cropName, interactive, isTelugu, showRadarRings, nearbyFarms, area.acres, isWalkMode]);

  const isFullScreenView = isFullscreen || isDedicated;

  // Lock body scroll when in fullscreen mode to eliminate background window scrolling
  useEffect(() => {
    if (isFullScreenView && typeof document !== 'undefined') {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isFullScreenView]);

  const handleBackNavigation = () => {
    if (onBack) {
      onBack();
    } else {
      setIsFullscreen(false);
    }
  };

  const mapContent = (
    <div
      className={
        isFullScreenView
          ? 'fixed inset-0 z-[99999] w-screen h-screen h-[100dvh] max-h-[100dvh] bg-slate-950 flex flex-col overflow-hidden overscroll-none touch-none select-none'
          : 'relative w-full max-w-full min-w-0 flex flex-col rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md bg-slate-900 overflow-hidden'
      }
      style={{
        height: isFullScreenView ? '100dvh' : height,
        maxHeight: isFullScreenView ? '100dvh' : height
      }}
    >
      {/* ═══════ 1. TOP HEADER BAR: SINGLE, CLEAN, FIXED 56px HEIGHT (NO OVERLAPS) ═══════ */}
      <div className={`h-14 shrink-0 px-3 py-2 flex items-center justify-between gap-1.5 z-30 min-w-0 max-w-full ${
        isFullScreenView
          ? 'bg-slate-900 text-white border-b border-slate-800 shadow-md'
          : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800'
      }`}>
        {/* Left: ONLY ONE Prominent Back Button + Title Badge */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {(isFullScreenView || onBack) && (
            <button
              type="button"
              onClick={handleBackNavigation}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
              title={isTelugu ? 'వెనుకకు' : 'Back'}
            >
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
              <span className="font-extrabold truncate max-w-[100px] xs:max-w-[130px]">
                {backLabel || (isTelugu ? '← వెనుకకు' : '← Back')}
              </span>
            </button>
          )}

          {/* Title Badge: Differentiates Calculator Mode from Farm Sector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-xs font-bold shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="truncate max-w-[120px] xs:max-w-[160px] text-slate-900 dark:text-white font-black">
              {mode === 'calculator' 
                ? (farmName ? `📐 ${farmName}` : (isTelugu ? '📐 భూమి సర్వే' : '📐 Land Survey'))
                : farmName}
            </span>
            {mode !== 'calculator' && (
              <span className="text-emerald-600 dark:text-emerald-400 font-extrabold ml-0.5">
                🌾 {area.acres} {isTelugu ? 'ఎక' : 'Ac'}
              </span>
            )}
          </div>
        </div>

        {/* Right: Satellite/Street Toggle & Action Button */}
        <div className="flex items-center gap-1.5 shrink-0">
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

          {/* Mode-Gated Action Button: No confusing "Save" in Calculator Mode */}
          {mode === 'calculator' ? (
            isFullScreenView && onShare ? (
              <button
                type="button"
                onClick={onShare}
                className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                title={isTelugu ? 'వాట్సాప్ ద్వారా షేర్ చేయండి' : 'Share via WhatsApp'}
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="font-extrabold">{isTelugu ? 'షేర్' : 'Share'}</span>
              </button>
            ) : null
          ) : isFullScreenView ? (
            <button
              type="button"
              onClick={handleBackNavigation}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
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
              title={isTelugu ? 'పూర్తి స్క్రీన్ మ్యాప్ తెరవండి' : 'Open Full-Screen Map'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span className="font-bold">{isTelugu ? 'మ్యాప్ తెరవండి' : 'Open Map'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══════ 2. MAP CANVAS AREA: ZERO OVERFLOW, ABSOLUTE LEAFLET CONTAINER ═══════ */}
      <div className="flex-1 w-full relative z-0 min-h-0 overflow-hidden touch-none">
        {/* 📐 PROMINENT FLOATING LIVE AREA MEASUREMENT HUD (ALWAYS VISIBLE & PROMINENT ON SCREEN) */}
        {interactive && !isWalkMode && (
          <div className="absolute top-2.5 inset-x-2.5 sm:inset-x-8 z-20 pointer-events-none flex justify-center">
            <div className="pointer-events-auto w-full max-w-md bg-slate-900/95 text-white backdrop-blur-xl px-3.5 py-2 rounded-2xl border border-emerald-500/50 shadow-2xl flex flex-col gap-1 transition-all">
              {pins.length >= 3 ? (
                <>
                  <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-lg sm:text-2xl font-black text-emerald-400 tracking-tight">
                        {area.acres} {isTelugu ? 'ఎకరాలు' : 'Acres'}
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-teal-300">
                        ({area.cents} {isTelugu ? 'సెంట్లు' : 'Cents'})
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-black text-emerald-300/90">
                        {area.gunthas} {isTelugu ? 'గుంటలు' : 'Gunthas'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-300 font-semibold pt-0.5">
                    <span className="flex items-center gap-1">
                      📏 <strong className="text-white">{area.perimeterMeters}m</strong> ({area.perimeterFeet} ft)
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      📐 <strong className="text-white">{area.gajam}</strong> {isTelugu ? 'గజాలు' : 'Gajam'}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      📍 <strong className="text-emerald-400">{pins.length}</strong> {isTelugu ? 'పిన్స్' : 'Pins'}
                    </span>
                  </div>
                </>
              ) : pins.length === 2 ? (
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <span className="text-xs font-bold text-amber-300">
                      📍 2 {isTelugu ? 'పిన్స్' : 'pins'} • 📏 {area.perimeterMeters}m ({area.perimeterFeet} ft)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-300">
                    {isTelugu ? 'విస్తీర్ణం కోసం మరో 1 పిన్ వేయండి' : 'Add 1 more pin for area'}
                  </span>
                </div>
              ) : pins.length === 1 ? (
                <div className="flex items-center gap-2 py-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span className="text-xs font-bold text-emerald-300">
                    📍 1 {isTelugu ? 'వ పిన్ నమోదయింది — తదుపరి మూల తాకండి' : 'pin dropped — Tap next corner of field'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 py-0.5">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    📍 {isTelugu ? 'క్రింద "+ పిన్ వేయి" లేదా "వాక్ మోడ్" తాకండి' : 'Tap "+ Add Pin" or "Walk Mode" below'}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 shrink-0">
                    {isTelugu ? '100% ఖచ్చితం' : 'Pinpoint GPS'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 🚶 Pinpoint GPS Walking HUD Floating Overlay */}
        {isWalkMode && (
          <div className="absolute inset-x-3 top-2.5 z-30 pointer-events-auto max-w-lg mx-auto">
            <div className="p-3 rounded-2xl bg-slate-900/95 text-white backdrop-blur-xl border border-sky-500/50 shadow-2xl flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                    <Footprints className="w-4 h-4 animate-bounce" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                      <span>{isTelugu ? 'జీపీఎస్ వాకింగ్ సర్వే' : 'Pinpoint GPS Walk Survey'}</span>
                      <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">1m Accuracy</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 font-medium">
                      {walkDistance}m {isTelugu ? 'నడిచారు' : 'walked'} • {pins.length} {isTelugu ? 'కార్నర్స్' : 'corners'} • 🌾 {area.acres} {isTelugu ? 'ఎకరాలు' : 'Acres'} ({area.cents} {isTelugu ? 'సెంట్లు' : 'Cents'})
                    </p>
                  </div>
                </div>

                {/* GPS Accuracy Indicator */}
                <div className={`px-2 py-1 rounded-xl text-[10px] font-black flex items-center gap-1 border ${
                  gpsAccuracy !== null && gpsAccuracy <= 3
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : gpsAccuracy !== null && gpsAccuracy <= 6
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                }`}>
                  <ShieldCheck className="w-3 h-3" />
                  <span>{gpsAccuracy !== null ? `±${gpsAccuracy}m GPS` : 'Acquiring GPS...'}</span>
                </div>
              </div>

              {/* Quick Action Buttons in Walk Mode */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleDropManualCorner}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{isTelugu ? '📍 కార్నర్ పిన్ వేయి' : 'Drop Corner Pin'}</span>
                </button>

                <button
                  type="button"
                  onClick={finishWalkMode}
                  className="flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{isTelugu ? 'సర్వే ముగించు' : 'Finish'}</span>
                </button>

                <button
                  type="button"
                  onClick={cancelWalkMode}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  title={isTelugu ? 'రద్దు చేయి' : 'Cancel'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Leaflet Map Canvas - strictly fills 100% of the flex-1 area without 1px overflow */}
        <div
          ref={mapContainerRef}
          className="w-full h-full relative z-0 outline-none overflow-hidden touch-none"
        />

        {/* Simple Farmer Action Dock (Bottom Center of Map) */}
        {interactive && !isWalkMode && (
          <div className="absolute bottom-4 sm:bottom-6 inset-x-3 z-30 flex justify-center pointer-events-none pb-safe">
            <div className="flex items-center gap-2 bg-slate-900/95 text-white backdrop-blur-xl p-1.5 rounded-2xl shadow-2xl border border-slate-700/80 pointer-events-auto">
              {/* 1. Add Pin Toggle Button */}
              <button
                type="button"
                onClick={() => setIsPinMode(!isPinMode)}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
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

              {/* 2. Pinpoint GPS Walk Mode Button */}
              <button
                type="button"
                onClick={startWalkMode}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-all active:scale-95 cursor-pointer"
                title={isTelugu ? 'నడక ద్వారా పొలం కొలవండి (1 మీటర్ ఖచ్చితత్వం)' : 'Walk field perimeter (1m accuracy)'}
              >
                <Footprints className="w-4 h-4" />
                <span>{isTelugu ? 'వాక్ మోడ్' : 'Walk Mode'}</span>
              </button>

              {/* 3. Undo Last Pin */}
              <button
                type="button"
                onClick={handleUndo}
                disabled={historyIndex <= 0 || pins.length === 0}
                className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                title={isTelugu ? 'చివరి పిన్ రద్దు చేయి' : 'Undo last pin'}
              >
                <Undo2 className="w-4 h-4" />
                <span className="hidden xs:inline">{isTelugu ? 'రద్దు' : 'Undo'}</span>
              </button>

              {/* 4. Clear All Pins */}
              {pins.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAllPins}
                  className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-slate-800 transition-colors cursor-pointer"
                  title={isTelugu ? 'అన్ని పిన్స్ తొలగించండి' : 'Clear all pins'}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden xs:inline">{isTelugu ? 'తీసివేయి' : 'Clear'}</span>
                </button>
              )}

              {/* 5. Recenter Map on Farm */}
              <button
                type="button"
                onClick={centerMap}
                className="flex items-center gap-1 px-2.5 py-2.5 rounded-xl text-xs font-bold text-emerald-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer"
                title={isTelugu ? 'నా పొలం కేంద్రం' : 'Center on farm'}
              >
                <Crosshair className="w-4 h-4" />
                <span className="hidden sm:inline">{isTelugu ? 'నా పొలం' : 'My Farm'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (isFullScreenView && typeof document !== 'undefined') {
    return createPortal(mapContent, document.body);
  }

  return mapContent;
}
