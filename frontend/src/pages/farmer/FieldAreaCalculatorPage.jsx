import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Ruler, ChevronLeft, MapPin, Footprints, Share2, 
  Copy, Check, Trash2, Maximize2, Compass, Layers, Info,
  Search, Calculator, Square, Triangle, ShieldCheck,
  FileText, Download, ChevronUp, ChevronDown, RotateCcw
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
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  // Mobile Bottom Drawer State
  const [mobileDrawerExpanded, setMobileDrawerExpanded] = useState(false);

  // Live GPS Center coordinates
  const [centerLat, setCenterLat] = useState(15.5057);
  const [centerLng, setCenterLng] = useState(80.0499);
  const [gpsAcquired, setGpsAcquired] = useState(false);

  // Location / Village / GPS Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

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
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCenterLat(pos.coords.latitude);
          setCenterLng(pos.coords.longitude);
          setGpsAcquired(true);
        },
        (err) => {
          console.log('Using default AP-TS coordinates for land calculator:', err);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
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

  // Location / Village / Coordinates Search Handler
  const handleLocationSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setSearchError('');

    const query = searchQuery.trim();
    const latLngMatch = query.match(/^([-+]?\d{1,2}\.\d+)[,\s]+([-+]?\d{1,3}\.\d+)$/);
    if (latLngMatch) {
      const lat = parseFloat(latLngMatch[1]);
      const lng = parseFloat(latLngMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setCenterLat(lat);
        setCenterLng(lng);
        setSearchLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Andhra Pradesh, India')}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setCenterLat(parseFloat(data[0].lat));
        setCenterLng(parseFloat(data[0].lon));
      } else {
        const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data2 = await res2.json();
        if (data2 && data2.length > 0) {
          setCenterLat(parseFloat(data2[0].lat));
          setCenterLng(parseFloat(data2[0].lon));
        } else {
          setSearchError(isTe ? 'స్థలం కనుగొనబడలేదు. సరైన గ్రామం పేరు లేదా GPS కోఆర్డినేట్స్ ఇవ్వండి.' : 'Location not found. Try village name or lat,lng coordinates.');
        }
      }
    } catch {
      setSearchError(isTe ? 'శోధన విఫలమైంది. దయచేసి ఇంటర్నెట్ సరిచూడండి.' : 'Search failed. Please check internet connection.');
    } finally {
      setSearchLoading(false);
    }
  };

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
        `📏 *ఖచ్చితమైన కొలతలు (Exact Measured Area):*\n` +
        `• *ఎకరాలు (Acres):* ${area.acres} ఎక\n` +
        `• *గుంటలు (Gunthas):* ${area.gunthas} గుంటలు\n` +
        `• *సెంట్లు (Cents):* ${area.cents} సెంట్లు\n` +
        `• *గజాలు (Sq. Yards):* ${area.gajam} గజాలు\n` +
        `• *చదరపు అడుగులు:* ${area.sqFeet} Sq.Ft\n` +
        `• *చదరపు మీటర్లు:* ${area.sqMeters} m²\n` +
        `• *హెక్టార్లు:* ${area.hectares} Ha\n` +
        `• *బీఘా:* ${area.bigha} Bigha\n\n` +
        `📐 *చుట్టుకొలత (Perimeter):*\n` +
        `• మొత్తం: ${area.perimeterMeters} మీటర్లు (${area.perimeterFeet} అడుగులు)\n` +
        (isSat ? `• కార్నర్ పిన్స్: ${boundaryPins.length} పాయింట్స్\n` : '') +
        (segmentsText ? `\n🧱 *ప్రతి సరిహద్దు పొడవు (Borders):*\n${segmentsText}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _AgriShield హై-ప్రెసిషన్ GPS ల్యాండ్ కాలిక్యులేటర్ ద్వారా లెక్కించబడింది._`
      : `🌾 *Digital Land Area Survey Report* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Land / Plot:* ${plotName || 'Land Survey'}\n` +
        `📐 *Survey Method:* ${isSat ? 'Satellite GPS Map Survey (WGS-84 Precision)' : `Tape Dimension Survey (${dimensionShape.toUpperCase()})`}\n` +
        `📅 *Survey Date:* ${new Date().toLocaleDateString()}\n\n` +
        `📏 *Calculated Land Area:*\n` +
        `• *Acres:* ${area.acres} Ac\n` +
        `• *Gunthas:* ${area.gunthas} Gunthas\n` +
        `• *Cents:* ${area.cents} Cents\n` +
        `• *Sq. Yards (Gajam):* ${area.gajam} Sq.Yds\n` +
        `• *Sq. Feet:* ${area.sqFeet} Sq.Ft\n` +
        `• *Sq. Meters:* ${area.sqMeters} m²\n` +
        `• *Hectares:* ${area.hectares} Ha\n` +
        `• *Bigha:* ${area.bigha} Bigha\n\n` +
        `📐 *Boundary Perimeter:*\n` +
        `• Total: ${area.perimeterMeters} m (${area.perimeterFeet} ft)\n` +
        (isSat ? `• Corner Pins: ${boundaryPins.length} points\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _Measured accurately via AgriShield High-Precision Land Area Calculator._`;

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

  // Dedicated Full-screen Studio View
  if (isStudioOpen) {
    return (
      <FieldBoundaryMap
        centerLat={centerLat}
        centerLng={centerLng}
        farmName={plotName}
        boundaryCoordinates={boundaryPins}
        onBoundaryChange={(newPins) => setBoundaryPins(newPins)}
        isTelugu={isTe}
        interactive={true}
        isDedicated={true}
        mode="calculator"
        onShare={handleWhatsAppShare}
        onBack={() => setIsStudioOpen(false)}
        backLabel={isTe ? '← వెనుకకు' : '← Back'}
      />
    );
  }

  // ═══════ RENDER DYNAMIC SVG PATWARI GEOMETRY CANVAS ═══════
  const renderPatwariGeometrySVG = () => {
    if (dimensionShape === 'rectangle') {
      const L = parseFloat(rectLength) || 100;
      const W = parseFloat(rectWidth) || 60;
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-2xl border border-slate-800 shadow-inner">
          <svg viewBox="0 0 320 200" className="w-full max-w-[280px] h-40">
            <rect x="50" y="30" width="220" height="130" fill="rgba(16, 185, 129, 0.2)" stroke="#10b981" strokeWidth="2.5" rx="6" />
            {/* Length Dimension Arrow */}
            <line x1="50" y1="18" x2="270" y2="18" stroke="#38bdf8" strokeWidth="1.5" markerStart="url(#arrow)" markerEnd="url(#arrow)" />
            <text x="160" y="14" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
              L: {rectLength ? `${rectLength} ${dimensionUnit}` : `Length (${dimensionUnit})`}
            </text>
            {/* Width Dimension Arrow */}
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
            {/* Side Labels */}
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
            {/* Diagonal Splitting Line */}
            <line x1="45" y1="40" x2="285" y2="170" stroke="#f43f5e" strokeWidth="2" strokeDasharray="5,4" />
            {/* Labels */}
            <text x="150" y="22" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">A: {quadSideA || 'A'}</text>
            <text x="288" y="105" fill="#f59e0b" fontSize="10" fontWeight="bold" textAnchor="middle">B: {quadSideB || 'B'}</text>
            <text x="160" y="180" fill="#a78bfa" fontSize="10" fontWeight="bold" textAnchor="middle">C: {quadSideC || 'C'}</text>
            <text x="20" y="100" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">D: {quadSideD || 'D'}</text>
            <text x="165" y="105" fill="#f43f5e" fontSize="10" fontWeight="900" textAnchor="middle" transform="rotate(28, 165, 105)">
              Diag: {quadDiagonal || 'Diagonal'}
            </text>
            {/* Triangle 1 & 2 markers */}
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

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* ═════════════════════════════════════════════════════════════════════
          LEFT / DESKTOP CONTROL DOCK & SURVEY TELEMETRY CONSOLE (420px)
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="w-full lg:w-[440px] xl:w-[480px] shrink-0 lg:h-[calc(100vh-4rem)] lg:overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-4 lg:p-5 space-y-4">
        
        {/* Navigation & Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => navigate('/more')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <ChevronLeft className="w-4 h-4 stroke-[3]" />
            <span>{t('field_calculator.back_to_more', isTe ? '← ఇతర సేవలు' : '← Back')}</span>
          </button>

          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            WGS-84 Precision
          </span>
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {t('field_calculator.title', isTe ? 'భూమి విస్తీర్ణ కాలిక్యులేటర్' : 'Field Area Calculator')}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isTe ? 'ఖచ్చితమైన సర్వే & సరిహద్దు లెక్కింపు' : 'Cadastral land geometry & boundary survey'}
              </p>
            </div>
          </div>
        </div>

        {/* Survey Mode Switcher: Satellite vs Tape Dimensions */}
        <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setSurveyTool('satellite')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              surveyTool === 'satellite'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{isTe ? '🛰️ శాటిలైట్ GPS' : '🛰️ Satellite & GPS'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSurveyTool('dimensions')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              surveyTool === 'dimensions'
                ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>{isTe ? '📐 టేపు కొలతలు' : '📐 Tape / Chain'}</span>
          </button>
        </div>

        {/* Plot Name Input */}
        <div className="space-y-1">
          <label htmlFor="plot-name-input" className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
            {isTe ? 'పొలం / సర్వే పేరు:' : 'Plot / Survey Name:'}
          </label>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
            <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
            <input
              id="plot-name-input"
              type="text"
              value={plotName}
              onChange={(e) => setPlotName(e.target.value)}
              placeholder="e.g., North Plot or Survey No. 42"
              className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
            />
          </div>
        </div>

        {/* Location Search Bar (Satellite Mode) */}
        {surveyTool === 'satellite' && (
          <form onSubmit={handleLocationSearch} className="space-y-1">
            <label htmlFor="loc-search-input" className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
              {isTe ? 'గ్రామం లేదా GPS ద్వారా వెతకండి:' : 'Search Village or GPS Coordinates:'}
            </label>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <Search className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <input
                id="loc-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isTe ? 'గ్రామం లేదా 15.5057, 80.0499' : 'Village name or 15.5057, 80.0499'}
                className="flex-1 bg-transparent text-xs font-bold text-slate-900 dark:text-white outline-none"
              />
              <button
                type="submit"
                disabled={searchLoading}
                className="px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shrink-0"
              >
                {searchLoading ? '...' : (isTe ? 'వెతుకు' : 'Find')}
              </button>
            </div>
            {searchError && <p className="text-[10px] font-bold text-rose-500">{searchError}</p>}
          </form>
        )}

        {/* ═══════ REAL-TIME MEASURED AREA HERO CARD ═══════ */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border-2 border-emerald-500/30 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              {isTe ? 'ప్రస్తుత విస్తీర్ణం (Measured Area)' : 'Live Measured Area'}
            </span>
            {surveyTool === 'satellite' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-600 text-white">
                📍 {boundaryPins.length} {isTe ? 'రాళ్లు' : 'Pins'}
              </span>
            )}
          </div>
          
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
              {activeAreaData.acres}
            </span>
            <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-300">
              {isTe ? 'ఎకరాలు' : 'Acres'}
            </span>
            <span className="text-sm font-bold text-teal-600 dark:text-teal-400">
              ({activeAreaData.cents} {isTe ? 'సెంట్లు' : 'Cents'})
            </span>
          </div>

          <div className="pt-2 border-t border-emerald-500/20 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>📏 {isTe ? 'చుట్టుకొలత:' : 'Perimeter:'}</span>
            <span className="font-black text-slate-900 dark:text-white">
              {activeAreaData.perimeterMeters} m ({activeAreaData.perimeterFeet} ft)
            </span>
          </div>
        </div>

        {/* ═══════ 8 STANDARD REGIONAL UNITS DIAL ═══════ */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isTe ? '8 ప్రామాణిక యూనిట్లు' : '8 Standard Units'}</span>
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

        {/* ═══════ IF TAPE/DIMENSIONS MODE: FORM INPUTS & PATWARI SVG ═══════ */}
        {surveyTool === 'dimensions' && (
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            {/* Shape Select */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setDimensionShape('rectangle')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  dimensionShape === 'rectangle' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Square className="w-3 h-3" />
                <span>{isTe ? 'చతురస్రం' : 'Rectangle'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDimensionShape('quadrilateral')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  dimensionShape === 'quadrilateral' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{isTe ? '4 భుజాలు' : '4-Sided'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDimensionShape('triangle')}
                className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  dimensionShape === 'triangle' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Triangle className="w-3 h-3" />
                <span>{isTe ? 'త్రిభుజం' : 'Triangle'}</span>
              </button>
            </div>

            {/* Measurement Unit Selector */}
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-500">{isTe ? 'కొలత యూనిట్:' : 'Unit:'}</span>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
                {['feet', 'meters', 'yards', 'links'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setDimensionUnit(u)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold capitalize transition-all cursor-pointer ${
                      dimensionUnit === u ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            {/* Shape-specific inputs */}
            {dimensionShape === 'rectangle' && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  step="any"
                  value={rectLength}
                  onChange={(e) => setRectLength(e.target.value)}
                  placeholder={`Length (${dimensionUnit})`}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  step="any"
                  value={rectWidth}
                  onChange={(e) => setRectWidth(e.target.value)}
                  placeholder={`Width (${dimensionUnit})`}
                  className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {dimensionShape === 'quadrilateral' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    step="any"
                    value={quadSideA}
                    onChange={(e) => setQuadSideA(e.target.value)}
                    placeholder={`Side A (${dimensionUnit})`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="number"
                    step="any"
                    value={quadSideB}
                    onChange={(e) => setQuadSideB(e.target.value)}
                    placeholder={`Side B (${dimensionUnit})`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="number"
                    step="any"
                    value={quadSideC}
                    onChange={(e) => setQuadSideC(e.target.value)}
                    placeholder={`Side C (${dimensionUnit})`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    type="number"
                    step="any"
                    value={quadSideD}
                    onChange={(e) => setQuadSideD(e.target.value)}
                    placeholder={`Side D (${dimensionUnit})`}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <input
                  type="number"
                  step="any"
                  value={quadDiagonal}
                  onChange={(e) => setQuadDiagonal(e.target.value)}
                  placeholder={`Center Diagonal (${dimensionUnit}) [Recommended]`}
                  className="w-full px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {dimensionShape === 'triangle' && (
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  step="any"
                  value={triSideA}
                  onChange={(e) => setTriSideA(e.target.value)}
                  placeholder="Side A"
                  className="px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  step="any"
                  value={triSideB}
                  onChange={(e) => setTriSideB(e.target.value)}
                  placeholder="Side B"
                  className="px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  type="number"
                  step="any"
                  value={triSideC}
                  onChange={(e) => setTriSideC(e.target.value)}
                  placeholder="Side C"
                  className="px-2 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            )}

            {/* Dynamic SVG Patwari Geometry Preview */}
            {renderPatwariGeometrySVG()}
          </div>
        )}

        {/* ═══════ SATELLITE SIDE SEGMENTS (Borders Table) ═══════ */}
        {surveyTool === 'satellite' && sideSegments.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>{isTe ? 'సరిహద్దు భుజాలు:' : 'Border Segments:'}</span>
              <span>{sideSegments.length} {isTe ? 'భుజాలు' : 'Sides'}</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
              {sideSegments.map((seg, idx) => (
                <div key={idx} className="p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between text-[10px]">
                  <span className="font-black text-emerald-600 dark:text-emerald-400">Side {seg.side}</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200">{seg.meters}m ({seg.feet}ft)</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══════ EXPORT ACTIONS SUITE ═══════ */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
            {isTe ? 'అధికారిక డాక్యుమెంటేషన్ & ఎగుమతులు' : 'Official Exports & Deeds'}
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
              <span>{isTe ? 'సర్వే డీడ్ (PDF)' : 'Survey Deed (PDF)'}</span>
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isTe ? 'వాట్సాప్ రిపోర్ట్' : 'WhatsApp'}</span>
            </button>

            {surveyTool === 'satellite' && (
              <>
                <button
                  type="button"
                  onClick={handleExportKML}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                >
                  <Download className="w-3 h-3 text-emerald-600" />
                  <span>Google Earth (.kml)</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportGeoJSON}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-[11px] font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer"
                >
                  <Download className="w-3 h-3 text-teal-600" />
                  <span>GIS (.geojson)</span>
                </button>
              </>
            )}
          </div>

          {surveyTool === 'satellite' && boundaryPins.length > 0 && (
            <button
              type="button"
              onClick={handleResetSurvey}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-[11px] font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{isTe ? 'అన్ని పిన్స్ క్లియర్ చేయి' : 'Reset All Pins'}</span>
            </button>
          )}
        </div>

      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          RIGHT / INTERACTIVE GIS VIEWPORT (Full Screen / Dual-Pane Map)
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 relative h-[600px] lg:h-[calc(100vh-4rem)] bg-slate-950">
        
        {/* Floating Top Bar on Map (Full Screen trigger & GPS center status) */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsStudioOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-slate-900/90 hover:bg-slate-900 text-white backdrop-blur-md border border-slate-700 shadow-lg cursor-pointer transition-all active:scale-95"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isTe ? 'పూర్తి స్క్రీన్' : 'Full Screen'}</span>
          </button>
        </div>

        {/* Map Viewport */}
        <div className="w-full h-full">
          <FieldBoundaryMap
            centerLat={centerLat}
            centerLng={centerLng}
            farmName={plotName}
            boundaryCoordinates={boundaryPins}
            onBoundaryChange={(newPins) => setBoundaryPins(newPins)}
            onExpand={() => setIsStudioOpen(true)}
            isTelugu={isTe}
            interactive={true}
            mode="calculator"
            onShare={handleWhatsAppShare}
            height="100%"
          />
        </div>

        {/* Mobile Floating Area Badge (Visible on Mobile) */}
        <div className="lg:hidden absolute bottom-4 left-3 right-3 z-[1000] p-3 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-800 text-white shadow-2xl flex items-center justify-between">
          <div>
            <p className="text-[10px] text-emerald-400 font-bold uppercase">{plotName}</p>
            <p className="text-lg font-black text-white">
              {activeAreaData.acres} Ac <span className="text-xs text-teal-300">({activeAreaData.cents} Cents)</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPDF}
              className="p-2 rounded-xl bg-slate-800 text-emerald-400 border border-slate-700"
              title="PDF Deed"
            >
              <FileText className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 text-white shadow-sm"
            >
              {isTe ? 'వాట్సాప్' : 'Share'}
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
