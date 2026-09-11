import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Layers, MapPin, Trash2, Plus, RefreshCw, Compass, ShieldAlert, Sparkles, 
  Check, Info, Footprints, Play, Square, Navigation, Crosshair, X, AlertTriangle,
  Maximize2, Minimize2, RotateCw, RotateCcw, Undo2, Redo2, ChevronDown, CheckCircle2, ChevronLeft
} from 'lucide-react';

// Plot Palette Colors (high contrast, distinct for fragmented multi-plots)
export const PLOT_COLORS = [
  { stroke: '#10b981', fill: '#10b981', name: 'Emerald', label: 'Plot 1' },
  { stroke: '#0284c7', fill: '#0284c7', name: 'Sky Blue', label: 'Plot 2' },
  { stroke: '#8b5cf6', fill: '#8b5cf6', name: 'Violet', label: 'Plot 3' },
  { stroke: '#f59e0b', fill: '#f59e0b', name: 'Amber', label: 'Plot 4' },
  { stroke: '#ec4899', fill: '#ec4899', name: 'Rose', label: 'Plot 5' }
];

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

// Haversine distance in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Normalize incoming boundary coordinates into multi-plot structure
function normalizeIncomingPlots(raw) {
  if (!raw || raw.length === 0) {
    return [{ id: 'plot-1', name: 'Plot 1', pins: [], color: PLOT_COLORS[0].stroke }];
  }
  // If array of plot objects already: [{ id, name, pins: [...] }]
  if (typeof raw[0] === 'object' && !Array.isArray(raw[0]) && raw[0].pins) {
    return raw.map((p, idx) => ({
      id: p.id || `plot-${idx + 1}`,
      name: p.name || `Plot ${idx + 1}`,
      pins: Array.isArray(p.pins) ? p.pins : [],
      color: p.color || PLOT_COLORS[idx % PLOT_COLORS.length].stroke
    }));
  }
  // If legacy flat array of points [[lat, lng], ...]:
  if (Array.isArray(raw[0])) {
    return [{ id: 'plot-1', name: 'Plot 1', pins: raw, color: PLOT_COLORS[0].stroke }];
  }
  return [{ id: 'plot-1', name: 'Plot 1', pins: [], color: PLOT_COLORS[0].stroke }];
}

export default function FieldBoundaryMap({
  centerLat = 15.5057,
  centerLng = 80.0499,
  farmName = 'My Farm',
  cropName = 'Tomato',
  boundaryCoordinates = [],
  onBoundaryChange,
  nearbyFarms = [],
  showRadarRings = true,
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
  const plotsLayersGroupRef = useRef(null);
  const pinsGroupRef = useRef(null);
  const segmentsGroupRef = useRef(null);
  const radarGroupRef = useRef(null);
  const nearbyGroupRef = useRef(null);
  const walkLayerGroupRef = useRef(null);

  // Sync Loop & Ping-Pong Prevention Refs
  const lastSyncedStringRef = useRef('');
  const isUserActionRef = useRef(false);

  // Map layer mode: 'hybrid' | 'satellite' | 'street'
  const [mapType, setMapType] = useState('hybrid');
  const [isPinMode, setIsPinMode] = useState(false);

  // ⛶ Fullscreen Studio Mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 🧭 Map Rotation (Degrees 0 - 360)
  const [rotationAngle, setRotationAngle] = useState(0);

  // Multi-Plot State
  const [plots, setPlots] = useState(() => normalizeIncomingPlots(boundaryCoordinates));
  const [activePlotId, setActivePlotId] = useState(() => plots[0]?.id || 'plot-1');
  const [showPlotDrawer, setShowPlotDrawer] = useState(false);
  const [selectedPinIndex, setSelectedPinIndex] = useState(null);

  // Multi-Plot Computed Acreages
  const [plotsAcreage, setPlotsAcreage] = useState({});
  const [totalAcreage, setTotalAcreage] = useState({ acres: '0.00', hectares: '0.00', rawAcres: 0 });

  // ↩️ Undo / ↪️ Redo Stack
  const [history, setHistory] = useState(() => [normalizeIncomingPlots(boundaryCoordinates)]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // 🚶 Walk Boundary Mode State
  const [isWalkMode, setIsWalkMode] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [walkDistance, setWalkDistance] = useState(0);
  const [autoDropPins, setAutoDropPins] = useState(true);
  const [lastWalkCoord, setLastWalkCoord] = useState(null);
  const watchIdRef = useRef(null);
  const walkTrailCoordsRef = useRef([]);

  // Push to Undo History
  const pushToHistory = useCallback((newPlots) => {
    setHistory((prev) => {
      const upToCurrent = prev.slice(0, historyIndex + 1);
      return [...upToCurrent, JSON.parse(JSON.stringify(newPlots))];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  // Undo Handler
  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      const targetState = JSON.parse(JSON.stringify(history[newIdx]));
      isUserActionRef.current = true;
      setHistoryIndex(newIdx);
      setPlots(targetState);
      setSelectedPinIndex(null);
    }
  };

  // Redo Handler
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      const targetState = JSON.parse(JSON.stringify(history[newIdx]));
      isUserActionRef.current = true;
      setHistoryIndex(newIdx);
      setPlots(targetState);
      setSelectedPinIndex(null);
    }
  };

  // Safe external prop sync: only sync if external data actually changed and NOT in a loop
  useEffect(() => {
    if (!boundaryCoordinates) return;
    const serialized = JSON.stringify(boundaryCoordinates);
    if (serialized === lastSyncedStringRef.current) {
      return; // Skip: already synced, prevent loop
    }

    lastSyncedStringRef.current = serialized;
    const normalized = normalizeIncomingPlots(boundaryCoordinates);
    setPlots(normalized);
    if (!normalized.some(p => p.id === activePlotId)) {
      setActivePlotId(normalized[0]?.id || 'plot-1');
    }
  }, [boundaryCoordinates]);

  // Recalculate acreages for all plots and notify parent safely
  useEffect(() => {
    const acreages = {};
    let totalSqMeters = 0;

    plots.forEach((plot) => {
      if (plot.pins && plot.pins.length >= 3) {
        const sqM = calculateGeodesicArea(plot.pins);
        acreages[plot.id] = formatAcreage(sqM);
        totalSqMeters += sqM;
      } else {
        acreages[plot.id] = { acres: '0.00', hectares: '0.00', rawAcres: 0 };
      }
    });

    const formattedTotal = formatAcreage(totalSqMeters);
    setPlotsAcreage(acreages);
    setTotalAcreage(formattedTotal);

    // Only notify parent if this update originated from user interaction
    if (isUserActionRef.current) {
      lastSyncedStringRef.current = JSON.stringify(plots);
      isUserActionRef.current = false;
      if (onBoundaryChange) {
        onBoundaryChange(plots, formattedTotal);
      }
    }
  }, [plots, onBoundaryChange]);

  // Initialize Leaflet Map with Ultra-Zoom (Max Zoom 22 with oversampling)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: 17,
      minZoom: 3,
      maxZoom: 22,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Ultra-Zoom Hybrid Satellite Layer (Google Hybrid: satellite + roads/boundaries)
    const hybridLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 22,
      maxNativeZoom: 20
    }).addTo(map);
    tileLayerRef.current = hybridLayer;

    // Feature Layer Groups
    plotsLayersGroupRef.current = L.layerGroup().addTo(map);
    pinsGroupRef.current = L.layerGroup().addTo(map);
    segmentsGroupRef.current = L.layerGroup().addTo(map);
    radarGroupRef.current = L.layerGroup().addTo(map);
    nearbyGroupRef.current = L.layerGroup().addTo(map);
    walkLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Invalidate map size when fullscreen toggles or dimensions change
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 150);
    }
  }, [isFullscreen, isDedicated, height]);

  // Handle container resizing smoothly
  useEffect(() => {
    if (!mapContainerRef.current || !window.ResizeObserver) return;
    const ro = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });
    ro.observe(mapContainerRef.current);
    return () => ro.disconnect();
  }, []);

  // Apply Rotation to Leaflet Map Pane
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const pane = mapContainerRef.current.querySelector('.leaflet-map-pane');
    if (pane) {
      pane.style.transform = `rotate(${rotationAngle}deg)`;
      pane.style.transition = 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)';
    }
  }, [rotationAngle]);

  const handleRotateStep = (delta) => {
    setRotationAngle((prev) => (prev + delta + 360) % 360);
  };

  const handleResetNorth = () => {
    setRotationAngle(0);
  };

  // Switch Tile Provider
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
    } else if (type === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 22, maxNativeZoom: 18 }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 22,
        maxNativeZoom: 19
      }).addTo(map);
    }
  };

  // Center on Farmer Location
  const centerMap = useCallback(() => {
    const map = mapInstanceRef.current;
    if (map && centerLat && centerLng) {
      map.setView([centerLat, centerLng], 17, { animate: true });
    }
  }, [centerLat, centerLng]);

  // Dynamically re-center map view when farmer coordinates change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (map && centerLat && centerLng) {
      map.setView([centerLat, centerLng], map.getZoom() || 17, { animate: true });
    }
  }, [centerLat, centerLng]);

  const roundCoord = (val) => parseFloat(val.toFixed(6));

  // Active Plot Helper
  const activePlot = plots.find((p) => p.id === activePlotId) || plots[0];

  // Click on Map to add boundary pins for active plot
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handleMapClick = (e) => {
      if (!isPinMode || isWalkMode) return;
      const { lat, lng } = e.latlng;
      const newPin = [roundCoord(lat), roundCoord(lng)];

      isUserActionRef.current = true;
      setPlots((prev) => {
        const next = prev.map((p) => {
          if (p.id === activePlotId) {
            return { ...p, pins: [...p.pins, newPin] };
          }
          return p;
        });
        pushToHistory(next);
        return next;
      });
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPinMode, isWalkMode, activePlotId, pushToHistory]);

  // Multi-Plot Plot Management Functions
  const handleAddPlot = () => {
    const nextIdx = plots.length + 1;
    const colorObj = PLOT_COLORS[(nextIdx - 1) % PLOT_COLORS.length];
    const newPlot = {
      id: `plot-${Date.now()}`,
      name: `${isTelugu ? 'మడి' : 'Plot'} ${nextIdx}`,
      pins: [],
      color: colorObj.stroke
    };

    isUserActionRef.current = true;
    const nextPlots = [...plots, newPlot];
    setPlots(nextPlots);
    pushToHistory(nextPlots);
    setActivePlotId(newPlot.id);
    setIsPinMode(true);
    setShowPlotDrawer(false);
  };

  const handleDeletePlot = (plotId) => {
    isUserActionRef.current = true;
    if (plots.length <= 1) {
      const reset = [{ id: 'plot-1', name: `${isTelugu ? 'మడి' : 'Plot'} 1`, pins: [], color: PLOT_COLORS[0].stroke }];
      setPlots(reset);
      pushToHistory(reset);
      return;
    }
    const remaining = plots.filter((p) => p.id !== plotId);
    setPlots(remaining);
    pushToHistory(remaining);
    if (activePlotId === plotId) {
      setActivePlotId(remaining[0].id);
    }
  };

  // Add pin by midpoint click (for irregular curves and bunds)
  const handleInsertMidpoint = (plotId, insertIndex, lat, lng) => {
    isUserActionRef.current = true;
    setPlots((prev) => {
      const next = prev.map((p) => {
        if (p.id === plotId) {
          const newPins = [...p.pins];
          newPins.splice(insertIndex, 0, [roundCoord(lat), roundCoord(lng)]);
          return { ...p, pins: newPins };
        }
        return p;
      });
      pushToHistory(next);
      return next;
    });
  };

  // Remove specific pin from active plot
  const handleRemovePin = (plotId, pinIndex) => {
    isUserActionRef.current = true;
    setPlots((prev) => {
      const next = prev.map((p) => {
        if (p.id === plotId) {
          const newPins = p.pins.filter((_, i) => i !== pinIndex);
          return { ...p, pins: newPins };
        }
        return p;
      });
      pushToHistory(next);
      return next;
    });
    setSelectedPinIndex(null);
  };

  // Render All Plots + Draggable Pins + Midpoints + Side Measurements in Meters
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !plotsLayersGroupRef.current || !pinsGroupRef.current || !segmentsGroupRef.current) return;

    plotsLayersGroupRef.current.clearLayers();
    pinsGroupRef.current.clearLayers();
    segmentsGroupRef.current.clearLayers();

    // 1. Center Farm Pin
    const farmIcon = L.divIcon({
      className: 'custom-farm-pin',
      html: `
        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(16,185,129,0.5); border: 2.5px solid white; font-size: 16px;">
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

    // 2. Render each plot's polygon and boundary pins
    plots.forEach((plot) => {
      const isActive = plot.id === activePlotId;
      const plotPins = plot.pins || [];
      const plotColor = plot.color || '#10b981';

      if (plotPins.length >= 3) {
        // Draw Polygon
        const poly = L.polygon(plotPins, {
          color: plotColor,
          weight: isActive ? 2.5 : 1.8,
          dashArray: isActive ? '5, 5' : undefined,
          fillColor: plotColor,
          fillOpacity: isActive ? 0.28 : 0.16
        }).addTo(plotsLayersGroupRef.current);

        const plotAcres = plotsAcreage[plot.id]?.acres || '0.00';
        poly.bindPopup(`
          <div style="font-family: inherit; padding: 4px;">
            <strong style="color: ${plotColor}; font-size: 13px;">🌾 ${plot.name}</strong>
            <p style="margin: 3px 0 0 0; font-size: 11px; color: #1e293b; font-weight: bold;">
              ${isTelugu ? 'విస్తీర్ణం:' : 'Area:'} ${plotAcres} ${isTelugu ? 'ఎకరాలు' : 'Acres'}
            </p>
            <p style="margin: 2px 0 0 0; font-size: 10px; color: #64748b;">
              ${plotPins.length} ${isTelugu ? 'కార్నర్ పిన్స్' : 'Boundary Pins'}
            </p>
          </div>
        `);
      } else if (plotPins.length === 2) {
        // Line between 2 pins
        L.polyline(plotPins, {
          color: plotColor,
          weight: 2,
          dashArray: '4, 6'
        }).addTo(plotsLayersGroupRef.current);
      }

      // 3. Render side segment lengths (meters) for all connected lines in active plot
      if (isActive && plotPins.length >= 2) {
        const segCount = plotPins.length >= 3 ? plotPins.length : plotPins.length - 1;
        for (let i = 0; i < segCount; i++) {
          const p1 = plotPins[i];
          const p2 = plotPins[(i + 1) % plotPins.length];
          const distM = Math.round(haversineDistanceMeters(p1[0], p1[1], p2[0], p2[1]));
          const midLat = (p1[0] + p2[0]) / 2;
          const midLng = (p1[1] + p2[1]) / 2;

          // Side Measurement Badge
          const distIcon = L.divIcon({
            className: 'side-dist-badge',
            html: `
              <div style="background: rgba(15, 23, 42, 0.85); color: #f8fafc; padding: 1px 5px; border-radius: 6px; font-size: 9px; font-weight: 800; border: 1px solid rgba(255,255,255,0.3); box-shadow: 0 1px 3px rgba(0,0,0,0.4); white-space: nowrap;">
                ${distM}m
              </div>
            `,
            iconSize: [36, 16],
            iconAnchor: [18, 8]
          });
          L.marker([midLat, midLng], { icon: distIcon, interactive: false }).addTo(segmentsGroupRef.current);

          // Interactive Midpoint (+) Insert Handle
          if (interactive) {
            const midIcon = L.divIcon({
              className: 'midpoint-insert-handle',
              html: `
                <div style="background: white; color: ${plotColor}; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; box-shadow: 0 1px 4px rgba(0,0,0,0.35); border: 1.5px solid ${plotColor}; cursor: pointer;" title="${isTelugu ? 'మలుపు కోసం పిన్ జోడించండి' : 'Click to insert corner bend point'}">
                  +
                </div>
              `,
              iconSize: [18, 18],
              iconAnchor: [9, 9]
            });

            const midMarker = L.marker([midLat, midLng], { icon: midIcon }).addTo(pinsGroupRef.current);
            midMarker.on('click', () => {
              handleInsertMidpoint(plot.id, i + 1, midLat, midLng);
            });
          }
        }
      }

      // 4. If this is the active plot, render corner pins
      if (isActive && interactive) {
        plotPins.forEach((pin, index) => {
          const isSelected = selectedPinIndex === index;
          const pinIcon = L.divIcon({
            className: `plot-pin-${index}`,
            html: `
              <div style="background: ${plotColor}; color: white; width: ${isSelected ? '32px' : '26px'}; height: ${isSelected ? '32px' : '26px'}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: ${isSelected ? '13px' : '11px'}; font-weight: 900; box-shadow: 0 2px 10px rgba(0,0,0,0.4); border: ${isSelected ? '3px solid #facc15' : '2px solid white'}; cursor: grab; transition: all 0.2s;">
                ${index + 1}
              </div>
            `,
            iconSize: [isSelected ? 32 : 26, isSelected ? 32 : 26],
            iconAnchor: [isSelected ? 16 : 13, isSelected ? 16 : 13]
          });

          const marker = L.marker(pin, { icon: pinIcon, draggable: true }).addTo(pinsGroupRef.current);

          // Select pin on click
          marker.on('click', () => {
            setSelectedPinIndex(index);
          });

          // Handle Dragging
          marker.on('dragend', (ev) => {
            const { lat, lng } = ev.target.getLatLng();
            isUserActionRef.current = true;
            setPlots((prev) => {
              const next = prev.map((p) => {
                if (p.id === plot.id) {
                  const updatedPins = [...p.pins];
                  updatedPins[index] = [roundCoord(lat), roundCoord(lng)];
                  return { ...p, pins: updatedPins };
                }
                return p;
              });
              pushToHistory(next);
              return next;
            });
          });

          // Popup with pin details & delete button
          marker.bindPopup(`
            <div style="font-family: inherit; padding: 2px; text-align: center;">
              <strong style="font-size: 11px; color: #0f172a;">${plot.name} — Pin #${index + 1}</strong>
              <div style="margin-top: 6px;">
                <button id="del-pin-${index}" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer;">
                  🗑️ ${isTelugu ? 'పిన్ తొలగించు' : 'Delete Pin'}
                </button>
              </div>
            </div>
          `);

          marker.on('popupopen', () => {
            const btn = document.getElementById(`del-pin-${index}`);
            if (btn) {
              btn.onclick = () => {
                handleRemovePin(plot.id, index);
                map.closePopup();
              };
            }
          });
        });
      }
    });
  }, [plots, activePlotId, centerLat, centerLng, farmName, cropName, interactive, plotsAcreage, isTelugu, selectedPinIndex]);

  // 🚶 LIVE GPS WALK MODE IMPLEMENTATION
  const startWalkMode = () => {
    if (!navigator.geolocation) {
      alert(isTelugu ? 'మీ బ్రౌజర్‌లో GPS సపోర్ట్ లేదు.' : 'Geolocation is not supported by your device.');
      return;
    }
    setIsWalkMode(true);
    setIsWalking(true);
    setWalkDistance(0);
    walkTrailCoordsRef.current = [];

    // Clear active plot pins so farmer can walk clean perimeter
    isUserActionRef.current = true;
    setPlots((prev) => {
      const next = prev.map((p) => (p.id === activePlotId ? { ...p, pins: [] } : p));
      pushToHistory(next);
      return next;
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        const currentCoord = [roundCoord(latitude), roundCoord(longitude)];

        if (lastWalkCoord) {
          const stepDist = haversineDistanceMeters(lastWalkCoord[0], lastWalkCoord[1], currentCoord[0], currentCoord[1]);
          if (stepDist > 1.5) {
            setWalkDistance((d) => Math.round(d + stepDist));
            walkTrailCoordsRef.current.push(currentCoord);
            drawWalkTrail(walkTrailCoordsRef.current, currentCoord);

            if (autoDropPins && stepDist >= 10) {
              dropCornerPin(currentCoord);
            }
          }
        } else {
          walkTrailCoordsRef.current.push(currentCoord);
          drawWalkTrail(walkTrailCoordsRef.current, currentCoord);
          dropCornerPin(currentCoord);
        }
        setLastWalkCoord(currentCoord);

        if (mapInstanceRef.current) {
          mapInstanceRef.current.panTo(currentCoord);
        }
      },
      (err) => {
        console.warn('Walk GPS error:', err);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 1000 }
    );
  };

  const drawWalkTrail = (trail, livePoint) => {
    const map = mapInstanceRef.current;
    if (!map || !walkLayerGroupRef.current) return;
    walkLayerGroupRef.current.clearLayers();

    if (trail.length >= 2) {
      L.polyline(trail, {
        color: '#0284c7',
        weight: 3,
        dashArray: '6, 6'
      }).addTo(walkLayerGroupRef.current);
    }

    if (livePoint) {
      const liveIcon = L.divIcon({
        className: 'live-walk-dot',
        html: `
          <div style="position: relative; width: 22px; height: 22px;">
            <div style="position: absolute; width: 22px; height: 22px; border-radius: 50%; background: #0284c7; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; top: 4px; left: 4px; width: 14px; height: 14px; border-radius: 50%; background: #0284c7; border: 2.5px solid white; box-shadow: 0 0 10px rgba(2,132,199,0.8);"></div>
          </div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });
      L.marker(livePoint, { icon: liveIcon }).addTo(walkLayerGroupRef.current);
    }
  };

  const dropCornerPin = (coord) => {
    const targetCoord = coord || lastWalkCoord;
    if (!targetCoord) return;

    isUserActionRef.current = true;
    setPlots((prev) => {
      const next = prev.map((p) => {
        if (p.id === activePlotId) {
          const exists = p.pins.some(
            (pin) => haversineDistanceMeters(pin[0], pin[1], targetCoord[0], targetCoord[1]) < 2
          );
          if (exists) return p;
          return { ...p, pins: [...p.pins, targetCoord] };
        }
        return p;
      });
      pushToHistory(next);
      return next;
    });
  };

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
    setLastWalkCoord(null);
  };

  // Auto-Generate Regular/Irregular Boundary Presets
  const handleAutoGenerateBoundary = (corners = 4) => {
    const delta = 0.0014;
    let box = [];
    if (corners === 4) {
      box = [
        [roundCoord(centerLat + delta), roundCoord(centerLng - delta)],
        [roundCoord(centerLat + delta), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta), roundCoord(centerLng - delta)]
      ];
    } else if (corners === 5) {
      box = [
        [roundCoord(centerLat + delta), roundCoord(centerLng - delta * 0.8)],
        [roundCoord(centerLat + delta * 1.1), roundCoord(centerLng + delta * 0.9)],
        [roundCoord(centerLat), roundCoord(centerLng + delta * 1.2)],
        [roundCoord(centerLat - delta * 1.1), roundCoord(centerLng + delta * 0.5)],
        [roundCoord(centerLat - delta * 0.9), roundCoord(centerLng - delta * 1.1)]
      ];
    } else {
      box = [
        [roundCoord(centerLat + delta), roundCoord(centerLng)],
        [roundCoord(centerLat + delta * 0.6), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta * 0.6), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta), roundCoord(centerLng)],
        [roundCoord(centerLat - delta * 0.6), roundCoord(centerLng - delta)],
        [roundCoord(centerLat + delta * 0.6), roundCoord(centerLng - delta)]
      ];
    }

    isUserActionRef.current = true;
    setPlots((prev) => {
      const next = prev.map((p) => (p.id === activePlotId ? { ...p, pins: box } : p));
      pushToHistory(next);
      return next;
    });
    setIsPinMode(false);
  };

  const handleClearActivePlot = () => {
    isUserActionRef.current = true;
    setPlots((prev) => {
      const next = prev.map((p) => (p.id === activePlotId ? { ...p, pins: [] } : p));
      pushToHistory(next);
      return next;
    });
    setIsPinMode(false);
    setSelectedPinIndex(null);
  };

  return (
    <div
      className={`relative overflow-hidden transition-all duration-300 w-full max-w-full min-w-0 ${
        isFullscreen
          ? 'fixed inset-0 z-[9999] w-screen h-screen bg-slate-950 flex flex-col'
          : isDedicated
          ? 'w-full h-full rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md bg-slate-900 flex flex-col'
          : 'rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md bg-slate-900 flex flex-col'
      }`}
    >
      {/* ═══════ 1. SLEEK COMPACT TOP BAR ═══════ */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-2.5 py-2 flex items-center justify-between gap-1.5 z-20 shrink-0 min-w-0 max-w-full">
        {/* Left: Optional Back button & Plot Selector Pill */}
        <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800 hover:bg-emerald-100 transition-all cursor-pointer shrink-0 shadow-xs active:scale-95"
            >
              <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span className="text-[11px] font-bold truncate max-w-[110px]">{backLabel || (isTelugu ? 'తిరిగి' : 'Back')}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPlotDrawer(!showPlotDrawer)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200/80 dark:border-slate-700 cursor-pointer shadow-xs shrink-0"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: activePlot.color || PLOT_COLORS[0].stroke }}
            />
            <span className="truncate max-w-[65px] xs:max-w-[90px]">{activePlot.name}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
              ({plotsAcreage[activePlot.id]?.acres || '0.00'} Ac)
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 ml-0.5 shrink-0" />
          </button>

          {/* Quick Plot Switch Buttons (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {plots.map((plot, idx) => (
              <button
                key={plot.id}
                type="button"
                onClick={() => {
                  setActivePlotId(plot.id);
                  setIsPinMode(false);
                  setSelectedPinIndex(null);
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  plot.id === activePlotId
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                P{idx + 1}
              </button>
            ))}
          </div>
        </div>

        {/* Center / Right: Total Acreage Badge & Studio Toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[11px] font-black shrink-0">
            <span className="hidden sm:inline">{isTelugu ? 'మొత్తం:' : 'Total:'}</span>
            <span>{totalAcreage.acres} {isTelugu ? 'ఎక' : 'Ac'}</span>
          </div>

          {/* ⛶ Fullscreen / Studio Toggle Button */}
          <button
            type="button"
            onClick={() => {
              if (onExpand) {
                onExpand();
              } else {
                setIsFullscreen(!isFullscreen);
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer ${
              isFullscreen
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 shadow-xs'
            }`}
            title={isFullscreen ? (isTelugu ? 'స్టూడియో ముగించు' : 'Exit Studio') : (isTelugu ? 'పూర్తి స్క్రీన్ స్టూడియో' : 'Full-Screen Studio')}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="text-[11px] font-bold">{isFullscreen ? (isTelugu ? 'మూసివేయి' : 'Exit') : (isTelugu ? 'స్టూడియో' : 'Studio')}</span>
          </button>
        </div>
      </div>

      {/* ═══════ PLOT MANAGEMENT DRAWER / POPOVER ═══════ */}
      {showPlotDrawer && (
        <div className="absolute top-12 left-3 z-30 w-72 p-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 space-y-2 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              {isTelugu ? 'పొలాలు / మళ్ళు' : 'Farm Plots'}
            </span>
            <button
              type="button"
              onClick={() => setShowPlotDrawer(false)}
              className="p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {plots.map((plot, idx) => {
              const isActive = plot.id === activePlotId;
              const ac = plotsAcreage[plot.id]?.acres || '0.00';
              return (
                <div
                  key={plot.id}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/60 shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActivePlotId(plot.id);
                      setIsPinMode(false);
                      setSelectedPinIndex(null);
                      setShowPlotDrawer(false);
                    }}
                    className="flex items-center gap-2 text-left flex-1"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ background: plot.color || PLOT_COLORS[idx % PLOT_COLORS.length].stroke }}
                    />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                        {plot.name} {isActive && <span className="text-[10px] text-emerald-600 font-extrabold">• Active</span>}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {ac} {isTelugu ? 'ఎకరాలు' : 'Acres'} • {plot.pins.length} {isTelugu ? 'పిన్స్' : 'Pins'}
                      </p>
                    </div>
                  </button>

                  {plots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeletePlot(plot.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors"
                      title={isTelugu ? 'మడి తొలగించు' : 'Delete Plot'}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleAddPlot}
            className="w-full py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isTelugu ? 'మరో మడి జోడించు (Plot 2)' : 'Add Separate Plot'}</span>
          </button>
        </div>
      )}

      {/* ═══════ FLOATING COMPASS & ROTATION HEAD (TOP RIGHT OVERLAY) ═══════ */}
      <div className="absolute top-13 right-2 z-20 flex flex-col items-end gap-1 pointer-events-auto">
        {/* Compass Needle (Click resets directly to True North) */}
        <button
          type="button"
          onClick={handleResetNorth}
          className="w-8 h-8 rounded-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-md border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:text-emerald-600 transition-transform cursor-pointer group"
          title={isTelugu ? 'ఉత్తర దిశకు రీసెట్ చేయండి (True North)' : 'Reset rotation to True North (0°)'}
        >
          <Compass
            className="w-4 h-4 text-rose-500 transition-transform duration-300"
            style={{ transform: `rotate(${-rotationAngle}deg)` }}
          />
        </button>

        {/* Rotate +45° / -45° Buttons */}
        <div className="flex items-center gap-0.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-800 text-[10px]">
          <button
            type="button"
            onClick={() => handleRotateStep(-45)}
            className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            title="Rotate Left 45°"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          <span className="font-mono font-bold px-0.5 text-slate-700 dark:text-slate-300 min-w-[24px] text-center text-[10px]">
            {rotationAngle}°
          </span>
          <button
            type="button"
            onClick={() => handleRotateStep(45)}
            className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100"
            title="Rotate Right 45°"
          >
            <RotateCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* ═══════ FLOATING TILE LAYER SWITCHER (TOP LEFT OVERLAY) ═══════ */}
      <div className="absolute top-13 left-2 z-20 pointer-events-auto">
        <div className="flex items-center gap-0.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-md border border-slate-200/80 dark:border-slate-800 text-xs">
          <button
            type="button"
            onClick={() => switchMapType('hybrid')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
              mapType === 'hybrid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Google Ultra-Zoom Hybrid with Field Boundaries"
          >
            🛰️ HD
          </button>
          <button
            type="button"
            onClick={() => switchMapType('satellite')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
              mapType === 'satellite'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            📡 Sat
          </button>
          <button
            type="button"
            onClick={() => switchMapType('street')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all ${
              mapType === 'street'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            🗺️ Map
          </button>
        </div>
      </div>

      {/* ═══════ SELECTED PIN ACTION CHIP (FLOATING OVERLAY) ═══════ */}
      {selectedPinIndex !== null && activePlot.pins[selectedPinIndex] && (
        <div className="absolute top-26 left-3 z-20 pointer-events-auto animate-in fade-in slide-in-from-left-2 duration-150">
          <div className="p-2 rounded-xl bg-slate-900/95 text-white backdrop-blur-md border border-amber-400/40 shadow-xl flex items-center gap-2 text-xs">
            <span className="font-bold text-amber-300">
              📍 {activePlot.name} — Pin #{selectedPinIndex + 1}
            </span>
            <button
              type="button"
              onClick={() => handleRemovePin(activePlot.id, selectedPinIndex)}
              className="px-2 py-0.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] transition-all"
            >
              🗑️ {isTelugu ? 'తీసివేయి' : 'Delete'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedPinIndex(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ═══════ MAP CONTAINER ═══════ */}
      <div
        ref={mapContainerRef}
        style={{ height: isFullscreen ? '100%' : height }}
        className="w-full relative z-0 flex-1 outline-none"
      />

      {/* ═══════ 🚶 WALK MODE HUD FLOATING OVERLAY ═══════ */}
      {isWalkMode && (
        <div className="absolute inset-x-3 bottom-16 z-30 pointer-events-auto">
          <div className="p-3.5 rounded-2xl bg-slate-900/95 text-white backdrop-blur-xl border border-sky-500/40 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Footprints className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-white">
                    {isTelugu ? `నడక మోడ్ — ${activePlot.name}` : `Walk Mode — ${activePlot.name}`}
                  </h4>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                    gpsAccuracy !== null && gpsAccuracy <= 5 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {gpsAccuracy !== null ? `±${gpsAccuracy}m GPS` : 'Acquiring GPS...'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {isTelugu
                    ? `${walkDistance} మీ నడిచారు • ${activePlot.pins.length} పిన్స్ • ${plotsAcreage[activePlot.id]?.acres || '0.00'} ఎకరా`
                    : `Walked: ${walkDistance}m • Pins: ${activePlot.pins.length} • Area: ${plotsAcreage[activePlot.id]?.acres || '0.00'} Ac`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => dropCornerPin()}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-[0.97]"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>{isTelugu ? 'కార్నర్ పిన్' : 'Drop Pin'}</span>
              </button>
              <button
                type="button"
                onClick={finishWalkMode}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-md active:scale-[0.97]"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>{isTelugu ? 'పూర్తి' : 'Finish'}</span>
              </button>
              <button
                type="button"
                onClick={finishWalkMode}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ 2. BOTTOM FLOATING THUMB DOCK (CLEAN & NON-BLOCKING) ═══════ */}
      {interactive && !isWalkMode && (
        <div className="absolute bottom-2 inset-x-1.5 sm:inset-x-2 z-20 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1 pointer-events-none">
          {/* Left Controls: Pin Tool & Walk Mode */}
          <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 pointer-events-auto">
            <button
              type="button"
              onClick={startWalkMode}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-gradient-to-r from-sky-600 to-teal-600 text-white shadow-sm transition-all active:scale-[0.97]"
              title={isTelugu ? 'నడక మోడ్' : 'Walk Field Boundary'}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">{isTelugu ? 'వాక్ మోడ్' : 'Walk'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPinMode(!isPinMode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                isPinMode
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 shadow-sm'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPinMode ? (isTelugu ? 'నొక్కండి...' : 'Click map') : (isTelugu ? '+ పిన్' : '+ Pin')}</span>
            </button>

            <button
              type="button"
              onClick={() => handleAutoGenerateBoundary(4)}
              className="flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              title="Auto 4-Corner Box"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Auto</span>
            </button>
          </div>

          {/* Right Controls: Undo / Redo / Clear / Center */}
          <div className="flex items-center gap-0.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 pointer-events-auto">
            {/* ↩️ Undo Pin */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              className="p-1.5 sm:p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
              title={isTelugu ? 'రద్దు చేయి (Undo)' : 'Undo last pin change'}
            >
              <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* ↪️ Redo Pin */}
            <button
              type="button"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-1.5 sm:p-2 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none transition-all"
              title={isTelugu ? 'మళ్ళీ చేయి (Redo)' : 'Redo pin change'}
            >
              <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Clear Active Plot Pins */}
            {activePlot.pins.length > 0 && (
              <button
                type="button"
                onClick={handleClearActivePlot}
                className="p-1.5 sm:p-2 rounded-xl text-slate-400 hover:text-rose-600 transition-colors"
                title={isTelugu ? 'ఈ మడి పిన్స్ తొలగించు' : 'Clear active plot'}
              >
                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Center on Field */}
            <button
              type="button"
              onClick={centerMap}
              className="p-1.5 sm:p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-emerald-600 transition-colors"
              title={isTelugu ? 'పొలం కేంద్రం' : 'Center on farm'}
            >
              <Crosshair className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
