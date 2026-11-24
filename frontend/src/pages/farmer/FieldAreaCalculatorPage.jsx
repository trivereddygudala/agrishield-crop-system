import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Ruler, ChevronLeft, MapPin, Share2, 
  Copy, Check, Trash2, Layers, Search, Calculator, 
  Square, Triangle, FileText, Download, X,
  Maximize2, ArrowLeft
} from 'lucide-react';
import FieldBoundaryMap, { 
  calculateGeodesicArea, 
  calculatePerimeter, 
  formatAcreage, 
  haversineDistanceMeters 
} from '../../components/farm/FieldBoundaryMap';
import {
  generateLandSurveyPDF,
  exportToKML,
  exportToGeoJSON
} from '../../utils/landDeedGenerator';

export default function FieldAreaCalculatorPage() {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n?.language || 'en').split('-')[0].toLowerCase();
  const isTe = currentLang === 'te';
  const navigate = useNavigate();

  // Mode: 'satellite' (GIS Map & GPS Walk) vs 'dimensions' (Manual Tape & Chain Measurements)
  const [surveyTool, setSurveyTool] = useState('satellite');

  // General Land Survey State
  const [plotName, setPlotName] = useState(() => isTe ? 'భూమి సర్వే' : 'Land / Plot Survey');
  const [boundaryPins, setBoundaryPins] = useState([]);
  const [copied, setCopied] = useState(false);

  // Drawer / Bottom Sheet State
  const [showDrawer, setShowDrawer] = useState(false);

  // Live GPS Center coordinates
  const [centerLat, setCenterLat] = useState(15.5057);
  const [centerLng, setCenterLng] = useState(80.0499);
  const [initialUserLocation, setInitialUserLocation] = useState(null);
  const [initialGpsAccuracy, setInitialGpsAccuracy] = useState(null);

  // ═══════ MANUAL TAPE / CHAIN DIMENSION CALCULATOR STATE ═══════
  const [dimensionShape, setDimensionShape] = useState('rectangle'); // 'rectangle' | 'quadrilateral' | 'triangle'
  const [dimensionUnit, setDimensionUnit] = useState('feet'); // 'feet' | 'meters' | 'yards' | 'links'

  // Rectangle / Square inputs
  const [rectLength, setRectLength] = useState('');
  const [rectWidth, setRectWidth] = useState('');

  // 4-Sided Irregular Quadrilateral (with diagonal)
  const [quadSideA, setQuadSideA] = useState('');
  const [quadSideB, setQuadSideB] = useState('');
  const [quadSideC, setQuadSideC] = useState('');
  const [quadSideD, setQuadSideD] = useState('');
  const [quadDiagonal, setQuadDiagonal] = useState('');

  // Triangle inputs (Heron's Formula)
  const [triSideA, setTriSideA] = useState('');
  const [triSideB, setTriSideB] = useState('');
  const [triSideC, setTriSideC] = useState('');

  useEffect(() => {
    let resolved = false;

    const applyLocation = (lat, lng, acc) => {
      if (resolved) return;
      resolved = true;
      setCenterLat(lat);
      setCenterLng(lng);
      setInitialUserLocation([lat, lng]);
      setInitialGpsAccuracy(acc);
    };

    // 1. Hardware Geolocation Attempt
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = parseFloat(Number(pos.coords.latitude).toFixed(6));
          const lng = parseFloat(Number(pos.coords.longitude).toFixed(6));
          applyLocation(lat, lng, Math.round(pos.coords.accuracy || 10));
        },
        () => {
          // Hardware GPS failed -> Instant IP Geolocation Fallback
          fetch('https://ipwho.is/')
            .then((r) => r.json())
            .then((d) => {
              if (d && d.success && d.latitude && d.longitude) {
                applyLocation(
                  parseFloat(Number(d.latitude).toFixed(6)),
                  parseFloat(Number(d.longitude).toFixed(6)),
                  1500
                );
              }
            })
            .catch(() => {
              fetch('https://freeipapi.com/api/json')
                .then((r) => r.json())
                .then((d2) => {
                  if (d2 && d2.latitude && d2.longitude) {
                    applyLocation(
                      parseFloat(Number(d2.latitude).toFixed(6)),
                      parseFloat(Number(d2.longitude).toFixed(6)),
                      1500
                    );
                  }
                })
                .catch(() => {});
            });
        },
        { timeout: 8000, enableHighAccuracy: true, maximumAge: 60000 }
      );
    } else {
      // Direct IP Geolocation if geolocation is missing
      fetch('https://ipwho.is/')
        .then((r) => r.json())
        .then((d) => {
          if (d && d.success && d.latitude && d.longitude) {
            applyLocation(
              parseFloat(Number(d.latitude).toFixed(6)),
              parseFloat(Number(d.longitude).toFixed(6)),
              1500
            );
          }
        })
        .catch(() => {});
    }
  }, []);

  // ═══════ SATELLITE AREA CALCULATION (WGS-84 GEODESIC) ═══════
  const satelliteAreaData = useMemo(() => {
    const sqM = calculateGeodesicArea(boundaryPins);
    const perimeterM = calculatePerimeter(boundaryPins);
    const formatted = formatAcreage(sqM);
    return {
      ...formatted,
      perimeterMeters: perimeterM,
      perimeterFeet: Math.round(perimeterM * 3.28084)
    };
  }, [boundaryPins]);

  // ═══════ PHYSICAL DIMENSION AREA CALCULATION ═══════
  const dimensionAreaData = useMemo(() => {
    const unitToMeter = (val) => {
      const num = parseFloat(val) || 0;
      if (dimensionUnit === 'meters') return num;
      if (dimensionUnit === 'feet') return num * 0.3048;
      if (dimensionUnit === 'yards') return num * 0.9144;
      if (dimensionUnit === 'links') return num * 0.201168;
      return num;
    };

    let calculatedSqMeters = 0;
    let perimeterMeters = 0;
    let triangle1Area = 0;
    let triangle2Area = 0;

    if (dimensionShape === 'rectangle') {
      const L = unitToMeter(rectLength);
      const W = unitToMeter(rectWidth);
      if (L > 0 && W > 0) {
        calculatedSqMeters = L * W;
        perimeterMeters = Math.round(2 * (L + W));
      }
    } else if (dimensionShape === 'triangle') {
      const a = unitToMeter(triSideA);
      const b = unitToMeter(triSideB);
      const c = unitToMeter(triSideC);
      if (a > 0 && b > 0 && c > 0 && (a + b > c) && (a + c > b) && (b + c > a)) {
        const s = (a + b + c) / 2.0;
        calculatedSqMeters = Math.sqrt(Math.max(0, s * (s - a) * (s - b) * (s - c)));
        perimeterMeters = Math.round(a + b + c);
      }
    } else if (dimensionShape === 'quadrilateral') {
      const a = unitToMeter(quadSideA);
      const b = unitToMeter(quadSideB);
      const c = unitToMeter(quadSideC);
      const d = unitToMeter(quadSideD);
      const diag = unitToMeter(quadDiagonal);

      if (a > 0 && b > 0 && diag > 0 && (a + b > diag) && (a + diag > b) && (b + diag > a)) {
        const s1 = (a + b + diag) / 2.0;
        triangle1Area = Math.sqrt(Math.max(0, s1 * (s1 - a) * (s1 - b) * (s1 - diag)));

        if (c > 0 && d > 0 && (c + d > diag) && (c + diag > d) && (d + diag > c)) {
          const s2 = (c + d + diag) / 2.0;
          triangle2Area = Math.sqrt(Math.max(0, s2 * (s2 - c) * (s2 - d) * (s2 - diag)));
          calculatedSqMeters = triangle1Area + triangle2Area;
          perimeterMeters = Math.round(a + b + c + d);
        } else {
          calculatedSqMeters = ((a + c) / 2.0) * ((b + d) / 2.0);
          perimeterMeters = Math.round(a + b + c + d);
        }
      } else if (a > 0 && b > 0 && c > 0 && d > 0) {
        calculatedSqMeters = ((a + c) / 2.0) * ((b + d) / 2.0);
        perimeterMeters = Math.round(a + b + c + d);
      }
    }

    const formatted = formatAcreage(calculatedSqMeters);
    return {
      ...formatted,
      perimeterMeters,
      perimeterFeet: Math.round(perimeterMeters * 3.28084),
      isValid: calculatedSqMeters > 0,
      triangle1Area: Math.round(triangle1Area),
      triangle2Area: Math.round(triangle2Area)
    };
  }, [dimensionShape, dimensionUnit, rectLength, rectWidth, quadSideA, quadSideB, quadSideC, quadSideD, quadDiagonal, triSideA, triSideB, triSideC]);

  const activeAreaData = surveyTool === 'satellite' ? satelliteAreaData : dimensionAreaData;

  // Real-time calculation of each boundary side / fence line length in Satellite mode
  const sideSegments = useMemo(() => {
    if (!boundaryPins || boundaryPins.length < 2) return [];
    const segments = [];
    const len = boundaryPins.length;
    for (let i = 0; i < len; i++) {
      if (len === 2 && i === 1) break;
      const p1 = boundaryPins[i];
      const p2 = boundaryPins[(i + 1) % len];
      const meters = Math.round(haversineDistanceMeters(p1[0], p1[1], p2[0], p2[1]));
      const feet = Math.round(meters * 3.28084);
      segments.push({
        side: `${i + 1} ➔ ${(i + 1) % len === 0 ? 1 : i + 2}`,
        meters,
        feet
      });
    }
    return segments;
  }, [boundaryPins]);

  // WhatsApp Land Survey Report
  const handleWhatsAppShare = () => {
    const area = activeAreaData;
    const isSat = surveyTool === 'satellite';
    const segmentsText = (isSat && sideSegments.length > 0)
      ? sideSegments.map((s) => `• సైడ్ ${s.side}: ${s.meters}m (${s.feet} ft)`).join('\n')
      : '';

    const text = isTe
      ? `🌾 *డిజిటల్ భూమి విస్తీర్ణ సర్వే రిపోర్ట్* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *భూమి / స్థలం:* ${plotName || 'భూమి సర్వే'}\n` +
        `📐 *సర్వే పద్ధతి:* ${isSat ? 'శాటిలైట్ జీపీఎస్ సర్వే (WGS-84)' : `భౌతిక కొలతలు (${dimensionShape.toUpperCase()})`}\n` +
        `📅 *సర్వే తేదీ:* ${new Date().toLocaleDateString('te-IN')}\n\n` +
        `📏 *ఖచ్చితమైన కొలతలు:*\n` +
        `• *ఎకరాలు:* ${area.acres} ఎక (${area.cents} సెంట్లు)\n` +
        `• *గుంటలు:* ${area.gunthas} గుంటలు\n` +
        `• *గజాలు:* ${area.gajam} గజాలు\n` +
        `• *చదరపు అడుగులు:* ${area.sqFeet} Sq.Ft\n` +
        `• *చదరపు మీటర్లు:* ${area.sqMeters} m²\n\n` +
        `📐 *చుట్టుకొలత:* ${area.perimeterMeters} మీటర్లు (${area.perimeterFeet} అడుగులు)\n` +
        (isSat ? `• కార్నర్ పిన్స్: ${boundaryPins.length} పాయింట్స్\n` : '') +
        (segmentsText ? `\n🧱 *సరిహద్దులు:*\n${segmentsText}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _AgriShield హై-ప్రెసిషన్ GPS ల్యాండ్ కాలిక్యులేటర్._`
      : `🌾 *Digital Land Area Survey Report* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Land / Plot:* ${plotName || 'Land Survey'}\n` +
        `📐 *Survey Method:* ${isSat ? 'Satellite GPS Map Survey (WGS-84)' : `Tape Dimension Survey (${dimensionShape.toUpperCase()})`}\n` +
        `📅 *Survey Date:* ${new Date().toLocaleDateString()}\n\n` +
        `📏 *Calculated Land Area:*\n` +
        `• *Acres:* ${area.acres} Ac (${area.cents} Cents)\n` +
        `• *Gunthas:* ${area.gunthas} Gunthas\n` +
        `• *Sq. Yards (Gajam):* ${area.gajam} Sq.Yds\n` +
        `• *Sq. Feet:* ${area.sqFeet} Sq.Ft\n` +
        `• *Sq. Meters:* ${area.sqMeters} m²\n\n` +
        `📐 *Perimeter:* ${area.perimeterMeters} m (${area.perimeterFeet} ft)\n` +
        (isSat ? `• Corner Pins: ${boundaryPins.length} points\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _Measured via AgriShield High-Precision Land Area Calculator._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    const area = activeAreaData;
    const summary = `${plotName}: ${area.acres} Acres (${area.cents} Cents, ${area.gunthas} Gunthas, ${area.gajam} Sq.Yards, ${area.sqMeters} m²) - Perimeter: ${area.perimeterMeters}m`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear all pins
  const handleResetSurvey = () => {
    if (boundaryPins.length === 0) return;
    if (window.confirm(isTe ? 'అన్ని పిన్స్‌ను తొలగించి కొత్త సర్వే ప్రారంభించాలా?' : 'Clear all pins and start fresh survey?')) {
      setBoundaryPins([]);
    }
  };

  // Export Survey Handlers
  const handleExportPDF = () => {
    generateLandSurveyPDF({
      plotName,
      area: activeAreaData,
      perimeterMeters: activeAreaData.perimeterMeters,
      perimeterFeet: activeAreaData.perimeterFeet,
      coordinates: surveyTool === 'satellite' ? boundaryPins : [],
      surveyMethod: surveyTool === 'satellite' ? 'WGS-84 Geodesic Satellite Survey' : `Cadastral Tape Survey (${dimensionShape.toUpperCase()})`,
      isTelugu: isTe
    });
  };

  const handleExportKML = () => {
    if (boundaryPins.length < 3) {
      alert(isTe ? 'KML ఎగుమతి చేయడానికి కనీసం 3 బౌండరీ పిన్స్ అవసరం.' : 'At least 3 boundary pins are required to export KML.');
      return;
    }
    exportToKML({
      plotName,
      coordinates: boundaryPins,
      area: activeAreaData
    });
  };

  const handleExportGeoJSON = () => {
    if (boundaryPins.length < 3) {
      alert(isTe ? 'GeoJSON ఎగుమతి చేయడానికి కనీసం 3 బౌండరీ పిన్స్ అవసరం.' : 'At least 3 boundary pins are required to export GeoJSON.');
      return;
    }
    exportToGeoJSON({
      plotName,
      coordinates: boundaryPins,
      area: activeAreaData,
      perimeterMeters: activeAreaData.perimeterMeters
    });
  };

  // ═══════ RENDER DYNAMIC SVG PATWARI GEOMETRY CANVAS ═══════
  const renderPatwariGeometrySVG = () => {
    if (dimensionShape === 'rectangle') {
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
          <svg viewBox="0 0 320 200" className="w-full max-w-[280px] h-40">
            <rect x="50" y="30" width="220" height="130" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2.5" rx="6" />
            <line x1="50" y1="18" x2="270" y2="18" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="160" y="14" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
              L: {rectLength ? `${rectLength} ${dimensionUnit}` : `Length (${dimensionUnit})`}
            </text>
            <line x1="28" y1="30" x2="28" y2="160" stroke="#f59e0b" strokeWidth="1.5" />
            <text x="24" y="100" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="end" dominantBaseline="middle">
              W: {rectWidth ? `${rectWidth} ${dimensionUnit}` : `Width`}
            </text>
            <text x="160" y="100" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
              Area: {dimensionAreaData.acres} Ac
            </text>
          </svg>
          <span className="text-[10px] text-slate-400 font-bold mt-1">
            Standard Patwari Rectangular Geometry (L × W)
          </span>
        </div>
      );
    } else if (dimensionShape === 'triangle') {
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
          <svg viewBox="0 0 320 200" className="w-full max-w-[280px] h-40">
            <polygon points="160,25 280,165 40,165" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" />
            <text x="90" y="90" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">A: {triSideA || 'Side A'}</text>
            <text x="230" y="90" fill="#f59e0b" fontSize="11" fontWeight="bold" textAnchor="middle">B: {triSideB || 'Side B'}</text>
            <text x="160" y="182" fill="#a78bfa" fontSize="11" fontWeight="bold" textAnchor="middle">C: {triSideC || 'Side C'}</text>
            <text x="160" y="125" fill="#ffffff" fontSize="13" fontWeight="900" textAnchor="middle">
              {dimensionAreaData.acres} Ac
            </text>
          </svg>
          <span className="text-[10px] text-slate-400 font-bold mt-1">
            Heron's Formula: √[s(s-a)(s-b)(s-c)]
          </span>
        </div>
      );
    } else if (dimensionShape === 'quadrilateral') {
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
          <svg viewBox="0 0 320 210" className="w-full max-w-[280px] h-44">
            <polygon points="45,40 260,30 285,170 30,155" fill="rgba(16, 185, 129, 0.15)" stroke="#10b981" strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="45" y1="40" x2="285" y2="170" stroke="#f43f5e" strokeWidth="2" strokeDasharray="5,4" />
            <text x="150" y="22" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">A: {quadSideA || 'A'}</text>
            <text x="288" y="105" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">B: {quadSideB || 'B'}</text>
            <text x="160" y="180" fill="#a78bfa" fontSize="10" fontWeight="bold" textAnchor="middle">C: {quadSideC || 'C'}</text>
            <text x="20" y="100" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">D: {quadSideD || 'D'}</text>
            <text x="165" y="105" fill="#f43f5e" fontSize="10" fontWeight="900" textAnchor="middle" transform="rotate(28, 165, 105)">
              Diag: {quadDiagonal || 'Diagonal'}
            </text>
            <text x="180" y="75" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="bold">△ 1</text>
            <text x="95" y="130" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="bold">△ 2</text>
          </svg>
          <span className="text-[10px] text-slate-400 font-bold mt-1">
            Revenue Patwari Decomposition: △1 + △2
          </span>
        </div>
      );
    }
    return null;
  };

  // ════════════════════════════════════════════════════════════════════════
  // MODE 1: SATELLITE MAP (FULL VIEWPORT FIRST - THE ACTUAL MAP IS 100%)
  // ════════════════════════════════════════════════════════════════════════
  if (surveyTool === 'satellite') {
    return (
      <div 
        className="relative w-full flex-1 h-[calc(100dvh-4.5rem)] lg:h-[calc(100dvh-4rem)] min-h-[480px] bg-slate-950 overflow-hidden select-none flex flex-col"
        style={{
          height: 'calc(100dvh - 4.5rem)',
          minHeight: '480px'
        }}
      >
        
        {/* Unified Full-Viewport Map Canvas with Integrated Controls */}
        <FieldBoundaryMap
          centerLat={centerLat}
          centerLng={centerLng}
          initialUserLocation={initialUserLocation}
          initialGpsAccuracy={initialGpsAccuracy}
          farmName={plotName}
          boundaryCoordinates={boundaryPins}
          onBoundaryChange={(newPins) => setBoundaryPins(newPins)}
          isTelugu={isTe}
          interactive={true}
          mode="calculator"
          height="100%"
          onBack={() => navigate('/more')}
          onSwitchToTape={() => setSurveyTool('dimensions')}
          onOpen8Units={() => setShowDrawer(true)}
          onExportPDF={handleExportPDF}
          onShare={handleWhatsAppShare}
          onSearchLocation={(lat, lng) => {
            setCenterLat(lat);
            setCenterLng(lng);
          }}
        />

        {/* BOTTOM DRAWER (MODAL SHEET FOR 8 UNITS & FULL GIS EXPORTS) */}
        {showDrawer && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200">
              
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {plotName} - {isTe ? 'సర్వే విస్తీర్ణ కొలతలు' : 'Certified Land Survey'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      WGS-84 Geodetic Datum • {boundaryPins.length} {isTe ? 'కార్నర్ రాళ్లు' : 'Pins'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDrawer(false)}
                  className="p-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
                
                {/* Live Area Hero */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      {isTe ? 'ప్రస్తుత విస్తీర్ణం' : 'Total Field Area'}
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400">
                        {activeAreaData.acres}
                      </span>
                      <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                        {isTe ? 'ఎకరాలు' : 'Acres'}
                      </span>
                      <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
                        ({activeAreaData.cents} {isTe ? 'సెంట్లు' : 'Cents'})
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{isTe ? 'చుట్టుకొలత' : 'Perimeter'}</span>
                    <p className="text-sm font-black text-slate-900 dark:text-white">
                      {activeAreaData.perimeterMeters} m
                    </p>
                    <span className="text-[10px] text-slate-400 font-medium">({activeAreaData.perimeterFeet} ft)</span>
                  </div>
                </div>

                {/* 8 Units Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                      {isTe ? '8 ప్రామాణిక యూనిట్లలో విస్తీర్ణం' : 'Land Area in 8 Standard Units'}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySummary}
                      className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? (isTe ? 'కాపీ అయింది!' : 'Copied!') : (isTe ? 'కాపీ' : 'Copy')}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'ఎకరాలు' : 'Acres'}</p>
                      <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{activeAreaData.acres}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'గుంటలు' : 'Gunthas'}</p>
                      <p className="text-xs font-black text-teal-600 dark:text-teal-400">{activeAreaData.gunthas}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'సెంట్లు' : 'Cents'}</p>
                      <p className="text-xs font-black text-sky-600 dark:text-sky-400">{activeAreaData.cents}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'గజాలు' : 'Sq.Yds'}</p>
                      <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{activeAreaData.gajam}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Sq.Ft</p>
                      <p className="text-xs font-black text-purple-600 dark:text-purple-400 truncate">{activeAreaData.sqFeet}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">m²</p>
                      <p className="text-xs font-black text-amber-600 dark:text-amber-400 truncate">{activeAreaData.sqMeters}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Ha</p>
                      <p className="text-xs font-black text-cyan-600 dark:text-cyan-400">{activeAreaData.hectares}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-center">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Bigha</p>
                      <p className="text-xs font-black text-rose-600 dark:text-rose-400">{activeAreaData.bigha}</p>
                    </div>
                  </div>
                </div>

                {/* Border Segments */}
                {sideSegments.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-500">
                      {isTe ? 'ప్రతి సరిహద్దు పొడవు:' : 'Border Fence Segments:'}
                    </span>
                    <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {sideSegments.map((seg, idx) => (
                        <div key={idx} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                          <span className="font-black text-emerald-600 dark:text-emerald-400">Side {seg.side}</span>
                          <span className="font-extrabold text-slate-800 dark:text-slate-200">{seg.meters}m ({seg.feet}ft)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Export Action Buttons */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handleExportPDF}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <FileText className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
                      <span>{isTe ? 'సర్వే డీడ్ (PDF)' : 'Survey Deed (PDF)'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleWhatsAppShare}
                      className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer active:scale-95"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportKML}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Google Earth (.kml)</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportGeoJSON}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-teal-600" />
                      <span>GIS (.geojson)</span>
                    </button>
                  </div>

                  {boundaryPins.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDrawer(false);
                        handleResetSurvey();
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer mt-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{isTe ? 'అన్ని పిన్స్ తొలగించు' : 'Clear All Pins'}</span>
                    </button>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // MODE 2: TAPE & CHAIN DIMENSIONS CALCULATOR (CLEAN FOCUSED WORKSPACE)
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto w-full p-4 sm:p-6 space-y-5 pb-24 text-slate-900 dark:text-slate-100">
      
      {/* Top Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setSurveyTool('satellite')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
        >
          <MapPin className="w-4 h-4 text-emerald-600" />
          <span>{isTe ? '← శాటిలైట్ మ్యాప్‌కు వెళ్ళు' : '← Back to Satellite Map'}</span>
        </button>

        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
          Patwari Cadastral Mode
        </span>
      </div>

      {/* Title */}
      <div className="space-y-1">
        <h1 className="text-xl font-black text-slate-900 dark:text-white">
          {isTe ? '📐 టేపు & గొలుసు కొలతల కాలిక్యులేటర్' : '📐 Tape & Chain Dimension Calculator'}
        </h1>
        <p className="text-xs text-slate-500">
          {isTe ? 'భౌతిక సరిహద్దు కొలతలను నమోదు చేసి ఖచ్చితమైన విస్తీర్ణం లెక్కించండి' : 'Enter physical fence dimensions to calculate exact revenue acreage'}
        </p>
      </div>

      {/* Main Card */}
      <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        
        {/* Shape Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-black text-slate-700 dark:text-slate-300">
            {isTe ? '1. పొలం ఆకారం ఎంచుకోండి:' : '1. Select Field Shape:'}
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDimensionShape('rectangle')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                dimensionShape === 'rectangle' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>{isTe ? 'చతురస్రం' : 'Rectangle'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDimensionShape('quadrilateral')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                dimensionShape === 'quadrilateral' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isTe ? '4 భుజాల పొలం' : '4-Sided'}</span>
            </button>
            <button
              type="button"
              onClick={() => setDimensionShape('triangle')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                dimensionShape === 'triangle' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Triangle className="w-3.5 h-3.5" />
              <span>{isTe ? 'త్రిభుజం' : 'Triangle'}</span>
            </button>
          </div>
        </div>

        {/* Unit Select */}
        <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-slate-500">{isTe ? 'కొలత యూనిట్:' : 'Measurement Unit:'}</span>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {['feet', 'meters', 'yards', 'links'].map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDimensionUnit(u)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  dimensionUnit === u ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* Input Fields */}
        {dimensionShape === 'rectangle' && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500">Length ({dimensionUnit})</label>
              <input
                type="number"
                step="any"
                value={rectLength}
                onChange={(e) => setRectLength(e.target.value)}
                placeholder="e.g. 200"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-500">Width ({dimensionUnit})</label>
              <input
                type="number"
                step="any"
                value={rectWidth}
                onChange={(e) => setRectWidth(e.target.value)}
                placeholder="e.g. 150"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        )}

        {dimensionShape === 'quadrilateral' && (
          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                type="number"
                step="any"
                value={quadSideA}
                onChange={(e) => setQuadSideA(e.target.value)}
                placeholder={`Side A (${dimensionUnit})`}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                step="any"
                value={quadSideB}
                onChange={(e) => setQuadSideB(e.target.value)}
                placeholder={`Side B (${dimensionUnit})`}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                step="any"
                value={quadSideC}
                onChange={(e) => setQuadSideC(e.target.value)}
                placeholder={`Side C (${dimensionUnit})`}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <input
                type="number"
                step="any"
                value={quadSideD}
                onChange={(e) => setQuadSideD(e.target.value)}
                placeholder={`Side D (${dimensionUnit})`}
                className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <input
              type="number"
              step="any"
              value={quadDiagonal}
              onChange={(e) => setQuadDiagonal(e.target.value)}
              placeholder={`Center Diagonal (${dimensionUnit}) [Recommended for Patwari Accuracy]`}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}

        {dimensionShape === 'triangle' && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <input
              type="number"
              step="any"
              value={triSideA}
              onChange={(e) => setTriSideA(e.target.value)}
              placeholder={`Side A (${dimensionUnit})`}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              type="number"
              step="any"
              value={triSideB}
              onChange={(e) => setTriSideB(e.target.value)}
              placeholder={`Side B (${dimensionUnit})`}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <input
              type="number"
              step="any"
              value={triSideC}
              onChange={(e) => setTriSideC(e.target.value)}
              placeholder={`Side C (${dimensionUnit})`}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        )}

        {/* Dynamic SVG Visual Preview */}
        {renderPatwariGeometrySVG()}
      </div>

      {/* Real-time Measured Area Hero Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border border-emerald-500/30 flex items-center justify-between">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            {isTe ? 'లెక్కించిన విస్తీర్ణం' : 'Calculated Area'}
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400">
              {activeAreaData.acres}
            </span>
            <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
              {isTe ? 'ఎకరాలు' : 'Acres'}
            </span>
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400">
              ({activeAreaData.cents} {isTe ? 'సెంట్లు' : 'Cents'})
            </span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-bold text-slate-400 uppercase">{isTe ? 'చుట్టుకొలత' : 'Perimeter'}</span>
          <p className="text-sm font-black text-slate-900 dark:text-white">
            {activeAreaData.perimeterMeters} m
          </p>
          <span className="text-[10px] text-slate-400 font-medium">({activeAreaData.perimeterFeet} ft)</span>
        </div>
      </div>

      {/* 8 Units Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {isTe ? '8 ప్రామాణిక యూనిట్లలో విస్తీర్ణం' : 'Land Area in 8 Standard Units'}
          </span>
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? (isTe ? 'కాపీ అయింది!' : 'Copied!') : (isTe ? 'కాపీ' : 'Copy')}</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'ఎకరాలు' : 'Acres'}</p>
            <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{activeAreaData.acres}</p>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'గుంటలు' : 'Gunthas'}</p>
            <p className="text-xs font-black text-teal-600 dark:text-teal-400">{activeAreaData.gunthas}</p>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'సెంట్లు' : 'Cents'}</p>
            <p className="text-xs font-black text-sky-600 dark:text-sky-400">{activeAreaData.cents}</p>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">{isTe ? 'గజాలు' : 'Sq.Yds'}</p>
            <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">{activeAreaData.gajam}</p>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Sq.Ft</p>
            <p className="text-xs font-black text-purple-600 dark:text-purple-400 truncate">{activeAreaData.sqFeet}</p>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">m²</p>
            <p className="text-xs font-black text-amber-600 dark:text-amber-400 truncate">{activeAreaData.sqMeters}</p>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Ha</p>
            <p className="text-xs font-black text-cyan-600 dark:text-cyan-400">{activeAreaData.hectares}</p>
          </div>
          <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <p className="text-[9px] font-bold text-slate-400 uppercase">Bigha</p>
            <p className="text-xs font-black text-rose-600 dark:text-rose-400">{activeAreaData.bigha}</p>
          </div>
        </div>
      </div>

      {/* Export & Share buttons */}
      <div className="grid grid-cols-2 gap-2 pt-2">
        <button
          type="button"
          onClick={handleExportPDF}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <FileText className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
          <span>{isTe ? 'సర్వే పత్రం (PDF)' : 'Survey Deed (PDF)'}</span>
        </button>

        <button
          type="button"
          onClick={handleWhatsAppShare}
          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer active:scale-95"
        >
          <Share2 className="w-4 h-4" />
          <span>WhatsApp</span>
        </button>
      </div>

    </div>
  );
}
