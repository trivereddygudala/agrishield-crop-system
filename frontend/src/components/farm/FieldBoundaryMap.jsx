import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { 
  Layers, MapPin, Trash2, Plus, RefreshCw, Compass, ShieldAlert, Sparkles, 
  Check, Info, Footprints, Play, Square, Navigation, Crosshair, X, AlertTriangle
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
  height = '480px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const plotsLayersGroupRef = useRef(null);
  const pinsGroupRef = useRef(null);
  const radarGroupRef = useRef(null);
  const nearbyGroupRef = useRef(null);
  const walkLayerGroupRef = useRef(null);

  // Map layer mode: 'hybrid' | 'satellite' | 'street'
  const [mapType, setMapType] = useState('hybrid');
  const [isPinMode, setIsPinMode] = useState(false);

  // Multi-Plot State
  const [plots, setPlots] = useState(() => normalizeIncomingPlots(boundaryCoordinates));
  const [activePlotId, setActivePlotId] = useState(() => plots[0]?.id || 'plot-1');

  // Multi-Plot Computed Acreages
  const [plotsAcreage, setPlotsAcreage] = useState({});
  const [totalAcreage, setTotalAcreage] = useState({ acres: '0.00', hectares: '0.00', rawAcres: 0 });

  // 🚶 Walk Boundary Mode State
  const [isWalkMode, setIsWalkMode] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState(null);
  const [walkDistance, setWalkDistance] = useState(0);
  const [autoDropPins, setAutoDropPins] = useState(true);
  const [lastWalkCoord, setLastWalkCoord] = useState(null);
  const watchIdRef = useRef(null);
  const walkTrailCoordsRef = useRef([]);

  // Sync when incoming boundaryCoordinates change from parent
  useEffect(() => {
    if (boundaryCoordinates && boundaryCoordinates.length > 0) {
      const normalized = normalizeIncomingPlots(boundaryCoordinates);
      setPlots(normalized);
      if (!normalized.some(p => p.id === activePlotId)) {
        setActivePlotId(normalized[0]?.id || 'plot-1');
      }
    }
  }, [boundaryCoordinates]);

  // Recalculate acreages for all plots and sum total
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

    if (onBoundaryChange) {
      onBoundaryChange(plots, formattedTotal);
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
    // maxNativeZoom: 20 prevents 404 tile errors while allowing zoom up to 22
    const hybridLayer = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      subdomains: ['0', '1', '2', '3'],
      maxZoom: 22,
      maxNativeZoom: 20
    }).addTo(map);
    tileLayerRef.current = hybridLayer;

    // Feature Layer Groups
    plotsLayersGroupRef.current = L.layerGroup().addTo(map);
    pinsGroupRef.current = L.layerGroup().addTo(map);
    radarGroupRef.current = L.layerGroup().addTo(map);
    nearbyGroupRef.current = L.layerGroup().addTo(map);
    walkLayerGroupRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Switch Tile Provider
  const switchMapType = (type) => {
    const map = mapInstanceRef.current;
    if (!map) return;
    setMapType(type);

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (type === 'hybrid') {
      // Google Hybrid (Satellite + High-Definition Plot Outlines)
      tileLayerRef.current = L.tileLayer('https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        subdomains: ['0', '1', '2', '3'],
        maxZoom: 22,
        maxNativeZoom: 20
      }).addTo(map);
    } else if (type === 'satellite') {
      // Esri World Imagery (with maxNativeZoom 18 to oversample up to 22 without grey error tiles)
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 22, maxNativeZoom: 18 }
      ).addTo(map);
    } else {
      // OpenStreetMap Street View
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

      setPlots((prev) =>
        prev.map((p) => {
          if (p.id === activePlotId) {
            return { ...p, pins: [...p.pins, newPin] };
          }
          return p;
        })
      );
    };

    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [isPinMode, isWalkMode, activePlotId]);

  // Multi-Plot Plot Management Functions
  const handleAddPlot = () => {
    const nextIdx = plots.length + 1;
    const colorObj = PLOT_COLORS[(nextIdx - 1) % PLOT_COLORS.length];
    const newPlot = {
      id: `plot-${Date.now()}`,
      name: `${isTelugu ? 'పొలం మడి' : 'Plot'} ${nextIdx}`,
      pins: [],
      color: colorObj.stroke
    };
    setPlots((prev) => [...prev, newPlot]);
    setActivePlotId(newPlot.id);
    setIsPinMode(true);
  };

  const handleDeletePlot = (plotId) => {
    if (plots.length <= 1) {
      // Clear pins if only 1 plot remaining
      setPlots([{ id: 'plot-1', name: `${isTelugu ? 'పొలం మడి' : 'Plot'} 1`, pins: [], color: PLOT_COLORS[0].stroke }]);
      return;
    }
    const remaining = plots.filter((p) => p.id !== plotId);
    setPlots(remaining);
    if (activePlotId === plotId) {
      setActivePlotId(remaining[0].id);
    }
  };

  // Add pin by midpoint click (for irregular curves and bunds)
  const handleInsertMidpoint = (plotId, insertIndex, lat, lng) => {
    setPlots((prev) =>
      prev.map((p) => {
        if (p.id === plotId) {
          const newPins = [...p.pins];
          newPins.splice(insertIndex, 0, [roundCoord(lat), roundCoord(lng)]);
          return { ...p, pins: newPins };
        }
        return p;
      })
    );
  };

  // Remove specific pin from active plot
  const handleRemovePin = (plotId, pinIndex) => {
    setPlots((prev) =>
      prev.map((p) => {
        if (p.id === plotId) {
          const newPins = p.pins.filter((_, i) => i !== pinIndex);
          return { ...p, pins: newPins };
        }
        return p;
      })
    );
  };

  // Render All Plots (Active and Inactive) + Drag Pins + Midpoint Inserts
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !plotsLayersGroupRef.current || !pinsGroupRef.current) return;

    plotsLayersGroupRef.current.clearLayers();
    pinsGroupRef.current.clearLayers();

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

    // 2. Render each plot's polygon
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

      // 3. If this is the active plot, render draggable corner pins & midpoint handles
      if (isActive && interactive) {
        plotPins.forEach((pin, index) => {
          const pinIcon = L.divIcon({
            className: `plot-pin-${index}`,
            html: `
              <div style="background: ${plotColor}; color: white; width: 26px; height: 26px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 900; box-shadow: 0 2px 8px rgba(0,0,0,0.35); border: 2px solid white; cursor: grab;">
                ${index + 1}
              </div>
            `,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const marker = L.marker(pin, { icon: pinIcon, draggable: true }).addTo(pinsGroupRef.current);

          // Handle Dragging
          marker.on('dragend', (ev) => {
            const { lat, lng } = ev.target.getLatLng();
            setPlots((prev) =>
              prev.map((p) => {
                if (p.id === plot.id) {
                  const updatedPins = [...p.pins];
                  updatedPins[index] = [roundCoord(lat), roundCoord(lng)];
                  return { ...p, pins: updatedPins };
                }
                return p;
              })
            );
          });

          // Click on pin to show delete option
          marker.bindPopup(`
            <div style="font-family: inherit; padding: 2px; text-align: center;">
              <strong style="font-size: 11px; color: #0f172a;">${plot.name} — Pin #${index + 1}</strong>
              <div style="margin-top: 6px;">
                <button id="del-pin-${index}" style="background: #ef4444; color: white; border: none; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: bold; cursor: pointer;">
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

        // 4. Render Midpoint "+" Handles between adjacent pins for irregular curves & bunds
        if (plotPins.length >= 2) {
          const count = plotPins.length >= 3 ? plotPins.length : plotPins.length - 1;
          for (let i = 0; i < count; i++) {
            const p1 = plotPins[i];
            const p2 = plotPins[(i + 1) % plotPins.length];
            const midLat = (p1[0] + p2[0]) / 2;
            const midLng = (p1[1] + p2[1]) / 2;

            const midIcon = L.divIcon({
              className: 'midpoint-insert-handle',
              html: `
                <div style="background: white; color: ${plotColor}; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 900; box-shadow: 0 1px 4px rgba(0,0,0,0.3); border: 1.5px solid ${plotColor}; cursor: pointer;" title="${isTelugu ? 'మలుపు కోసం పిన్ జోడించండి' : 'Click to insert corner bend point'}">
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
    });
  }, [plots, activePlotId, centerLat, centerLng, farmName, cropName, interactive, plotsAcreage, isTelugu]);

  // Render Radar Rings & Nearby Outbreaks
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !radarGroupRef.current || !nearbyGroupRef.current) return;

    radarGroupRef.current.clearLayers();
    nearbyGroupRef.current.clearLayers();

    if (!showRadarRings) return;

    // 1 km, 3 km, 5 km surveillance rings
    L.circle([centerLat, centerLng], { radius: 1000, color: '#ef4444', weight: 1.5, opacity: 0.5, fillColor: '#ef4444', fillOpacity: 0.04, dashArray: '5, 8' }).addTo(radarGroupRef.current);
    L.circle([centerLat, centerLng], { radius: 3000, color: '#f59e0b', weight: 1.2, opacity: 0.45, fillColor: '#f59e0b', fillOpacity: 0.02, dashArray: '6, 10' }).addTo(radarGroupRef.current);
    L.circle([centerLat, centerLng], { radius: 5000, color: '#3b82f6', weight: 1.0, opacity: 0.35, fillColor: '#3b82f6', fillOpacity: 0.01, dashArray: '8, 12' }).addTo(radarGroupRef.current);

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
        </div>
      `);
    });
  }, [centerLat, centerLng, showRadarRings, nearbyFarms, isTelugu]);

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
    setPlots((prev) =>
      prev.map((p) => (p.id === activePlotId ? { ...p, pins: [] } : p))
    );

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setGpsAccuracy(Math.round(accuracy));
        const currentCoord = [roundCoord(latitude), roundCoord(longitude)];

        // Update Walk Trail & Distance
        if (lastWalkCoord) {
          const stepDist = haversineDistanceMeters(lastWalkCoord[0], lastWalkCoord[1], currentCoord[0], currentCoord[1]);
          if (stepDist > 1.5) { // filter noise
            setWalkDistance((d) => Math.round(d + stepDist));
            walkTrailCoordsRef.current.push(currentCoord);
            drawWalkTrail(walkTrailCoordsRef.current, currentCoord);

            // Auto-drop pin every 10 meters if enabled
            if (autoDropPins && stepDist >= 10) {
              dropCornerPin(currentCoord);
            }
          }
        } else {
          walkTrailCoordsRef.current.push(currentCoord);
          drawWalkTrail(walkTrailCoordsRef.current, currentCoord);
          dropCornerPin(currentCoord); // drop initial starting pin
        }
        setLastWalkCoord(currentCoord);

        // Center map smoothly on walking position
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

    // Dotted Walking Path
    if (trail.length >= 2) {
      L.polyline(trail, {
        color: '#0284c7',
        weight: 3,
        dashArray: '6, 6'
      }).addTo(walkLayerGroupRef.current);
    }

    // Live Walking Location Pulsing Marker
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

    setPlots((prev) =>
      prev.map((p) => {
        if (p.id === activePlotId) {
          // Don't add duplicate if very close
          const exists = p.pins.some(
            (pin) => haversineDistanceMeters(pin[0], pin[1], targetCoord[0], targetCoord[1]) < 2
          );
          if (exists) return p;
          return { ...p, pins: [...p.pins, targetCoord] };
        }
        return p;
      })
    );
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

  const cancelWalkMode = () => {
    finishWalkMode();
  };

  // Auto-Generate Regular/Irregular Boundary Presets
  const handleAutoGenerateBoundary = (corners = 4) => {
    const delta = 0.0014; // ~150 meters
    let box = [];
    if (corners === 4) {
      box = [
        [roundCoord(centerLat + delta), roundCoord(centerLng - delta)],
        [roundCoord(centerLat + delta), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta), roundCoord(centerLng - delta)]
      ];
    } else if (corners === 5) {
      // 5-point irregular plot
      box = [
        [roundCoord(centerLat + delta), roundCoord(centerLng - delta * 0.8)],
        [roundCoord(centerLat + delta * 1.1), roundCoord(centerLng + delta * 0.9)],
        [roundCoord(centerLat), roundCoord(centerLng + delta * 1.2)],
        [roundCoord(centerLat - delta * 1.1), roundCoord(centerLng + delta * 0.5)],
        [roundCoord(centerLat - delta * 0.9), roundCoord(centerLng - delta * 1.1)]
      ];
    } else {
      // 6-point hexagonal plot
      box = [
        [roundCoord(centerLat + delta), roundCoord(centerLng)],
        [roundCoord(centerLat + delta * 0.6), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta * 0.6), roundCoord(centerLng + delta)],
        [roundCoord(centerLat - delta), roundCoord(centerLng)],
        [roundCoord(centerLat - delta * 0.6), roundCoord(centerLng - delta)],
        [roundCoord(centerLat + delta * 0.6), roundCoord(centerLng - delta)]
      ];
    }

    setPlots((prev) =>
      prev.map((p) => (p.id === activePlotId ? { ...p, pins: box } : p))
    );
    setIsPinMode(false);
  };

  const handleClearActivePlot = () => {
    setPlots((prev) =>
      prev.map((p) => (p.id === activePlotId ? { ...p, pins: [] } : p))
    );
    setIsPinMode(false);
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200/90 dark:border-slate-800 shadow-md bg-slate-900">
      {/* ═══════ TOP MULTI-PLOT MANAGEMENT TABS ═══════ */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 z-20 relative">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
            {isTelugu ? 'పొలాలు / మళ్ళు:' : 'Farm Plots:'}
          </span>
          {plots.map((plot, idx) => {
            const isActive = plot.id === activePlotId;
            const plotAc = plotsAcreage[plot.id]?.acres || '0.00';
            return (
              <div key={plot.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setActivePlotId(plot.id);
                    setIsPinMode(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ background: plot.color || PLOT_COLORS[idx % PLOT_COLORS.length].stroke }}
                  />
                  <span>{plot.name}</span>
                  <span className="text-[10px] opacity-80">({plotAc} Ac)</span>
                </button>
                {plots.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeletePlot(plot.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 -ml-1.5 transition-colors"
                    title={isTelugu ? 'మడి తొలగించు' : 'Remove Plot'}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          <button
            type="button"
            onClick={handleAddPlot}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100 transition-all cursor-pointer"
            title={isTelugu ? 'మధ్యలో వేరే పొలం ఉంటే మరొక మడిని జోడించండి' : 'Add separate plot across neighbor land'}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isTelugu ? '+ మరో మడి జోడించు' : '+ Add Plot 2'}</span>
          </button>
        </div>

        {/* Combined Farm Acreage Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-black">
            <span>{isTelugu ? 'మొత్తం పొలం విస్తీర్ణం:' : 'Total Land:'}</span>
            <span className="text-sm font-black">{totalAcreage.acres} {isTelugu ? 'ఎకరాలు' : 'Acres'}</span>
          </div>
        </div>
      </div>

      {/* ═══════ TOOLBAR: MAP MODES, PIN CONTROLS & WALK MODE ═══════ */}
      <div className="absolute top-14 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Tile Provider Switches */}
        <div className="flex items-center gap-1 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200/80 dark:border-slate-800 pointer-events-auto">
          <button
            type="button"
            onClick={() => switchMapType('hybrid')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              mapType === 'hybrid'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
            title="Google Ultra-Zoom Hybrid with Field Boundaries"
          >
            🛰️ {isTelugu ? 'హైబ్రిడ్' : 'Hybrid HD'}
          </button>
          <button
            type="button"
            onClick={() => switchMapType('satellite')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              mapType === 'satellite'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            📡 {isTelugu ? 'ఉపగ్రహం' : 'Satellite'}
          </button>
          <button
            type="button"
            onClick={() => switchMapType('street')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              mapType === 'street'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            🗺️ {isTelugu ? 'రోడ్లు' : 'Street'}
          </button>
        </div>

        {/* Right: Walk Mode, Pin Tool & Auto Boundary */}
        {interactive && !isWalkMode && (
          <div className="flex items-center gap-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200/80 dark:border-slate-800 pointer-events-auto">
            {/* 🚶 WALK MODE CTA */}
            <button
              type="button"
              onClick={startWalkMode}
              className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white shadow-sm transition-all active:scale-[0.97]"
              title={isTelugu ? 'పొలం చుట్టూ నడిచి సరిహద్దు కొలవండి' : 'Walk field perimeter with phone to record boundary'}
            >
              <Footprints className="w-3.5 h-3.5" />
              <span>{isTelugu ? '🚶 వాక్ మోడ్' : '🚶 Walk Mode'}</span>
            </button>

            {/* Tap Pin Mode */}
            <button
              type="button"
              onClick={() => setIsPinMode(!isPinMode)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                isPinMode
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isPinMode ? (isTelugu ? 'మ్యాప్‌ను నొక్కండి...' : 'Click map to pin') : (isTelugu ? '+ పిన్ వేయి' : '+ Add Pin')}</span>
            </button>

            {/* Auto Boundary Box with Presets */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => handleAutoGenerateBoundary(4)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isTelugu ? 'ఆటో' : 'Auto Box'}</span>
              </button>
            </div>

            {/* Clear Plot Pins */}
            {activePlot.pins.length > 0 && (
              <button
                type="button"
                onClick={handleClearActivePlot}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                title={isTelugu ? 'పిన్స్ తొలగించు' : 'Clear plot pins'}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Re-center GPS */}
            <button
              type="button"
              onClick={centerMap}
              className="p-1.5 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors"
              title={isTelugu ? 'కేంద్రానికి వెళ్ళు' : 'Center on field'}
            >
              <Compass className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ═══════ MAP CONTAINER ═══════ */}
      <div ref={mapContainerRef} style={{ height }} className="w-full relative z-0 outline-none" />

      {/* ═══════ 🚶 WALK MODE HUD FLOATING OVERLAY ═══════ */}
      {isWalkMode && (
        <div className="absolute inset-x-3 bottom-14 z-30 pointer-events-auto">
          <div className="p-4 rounded-2xl bg-slate-900/95 text-white backdrop-blur-xl border border-sky-500/40 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                <Footprints className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white">
                    {isTelugu ? `నడక మోడ్ — ${activePlot.name}` : `Walk Mode Active — ${activePlot.name}`}
                  </h4>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                    gpsAccuracy !== null && gpsAccuracy <= 5 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                  }`}>
                    {gpsAccuracy !== null ? `±${gpsAccuracy}m GPS` : 'Acquiring GPS...'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isTelugu
                    ? `నడిచిన దూరం: ${walkDistance} మీటర్లు • పిన్స్: ${activePlot.pins.length} • విస్తీర్ణం: ${plotsAcreage[activePlot.id]?.acres || '0.00'} ఎకరాలు`
                    : `Walked: ${walkDistance}m • Pins: ${activePlot.pins.length} • Current Area: ${plotsAcreage[activePlot.id]?.acres || '0.00'} Acres`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Manual Drop Pin Button */}
              <button
                type="button"
                onClick={() => dropCornerPin()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md active:scale-[0.97]"
              >
                <MapPin className="w-4 h-4" />
                <span>{isTelugu ? '📍 కార్నర్ పిన్ వేయి' : '📍 Drop Corner Pin'}</span>
              </button>

              {/* Finish & Close Boundary */}
              <button
                type="button"
                onClick={finishWalkMode}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-sky-600 hover:bg-sky-700 text-white shadow-md active:scale-[0.97]"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isTelugu ? '🏁 పూర్తి & సేవ్' : '🏁 Finish Walk'}</span>
              </button>

              {/* Cancel Button */}
              <button
                type="button"
                onClick={cancelWalkMode}
                className="px-2.5 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
              >
                {isTelugu ? 'రద్దు' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ FOOTER ACREAGE BAR ═══════ */}
      <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between text-xs gap-2 z-10 relative">
        <div className="flex items-center gap-3">
          <span className="text-slate-600 dark:text-slate-400">
            {isTelugu ? 'మొత్తం పొలం విస్తీర్ణం:' : 'Total Field Area:'}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-sm">
            {totalAcreage.acres} {isTelugu ? 'ఎకరాలు' : 'Acres'}
          </span>
          <span className="text-slate-400">({totalAcreage.hectares} Ha)</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1 font-semibold">
            <Info className="w-3.5 h-3.5 text-sky-500" />
            {isTelugu ? 'మలుపుల వద్ద (+) నొక్కి అదనపు పిన్స్ వేయవచ్చు' : 'Click (+) on boundary lines to add corner bends'}
          </span>
        </div>
      </div>
    </div>
  );
}
