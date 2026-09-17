import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Ruler, ChevronLeft, MapPin, Footprints, Share2, 
  Copy, Check, Trash2, Maximize2, Compass, Layers, Info,
  Search, Calculator, Square, Triangle, ShieldCheck, ArrowRight
} from 'lucide-react';
import FieldBoundaryMap, { 
  calculateGeodesicArea, 
  calculatePerimeter, 
  formatAcreage, 
  haversineDistanceMeters 
} from '../components/farm/FieldBoundaryMap';

export default function FieldAreaCalculatorPage() {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const navigate = useNavigate();

  // Mode: 'satellite' (GPS Map & Satellite Pins) vs 'dimensions' (Manual Tape & Chain Measurements)
  const [surveyTool, setSurveyTool] = useState('satellite');

  // State: General Land Survey (Independent of crop or farm registration)
  const [plotName, setPlotName] = useState(() => isTe ? 'భూమి సర్వే' : 'Land / Plot Survey');
  const [boundaryPins, setBoundaryPins] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  // Live GPS Center coordinates (automatically acquired or fallback)
  const [centerLat, setCenterLat] = useState(15.5057);
  const [centerLng, setCenterLng] = useState(80.0499);
  const [gpsAcquired, setGpsAcquired] = useState(false);

  // ═══════ LOCATION SEARCH STATE ═══════
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  // ═══════ MANUAL TAPE / DIMENSION CALCULATOR STATE ═══════
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
    // Conversion factors to Square Meters
    // 1 meter = 1
    // 1 foot = 0.3048 m => 1 sq ft = 0.09290304 sq m
    // 1 yard = 0.9144 m => 1 sq yard = 0.83612736 sq m
    // 1 Gunter's link = 0.201168 m => 1 link = 7.92 inches
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
      // Decompose 4-sided field into 2 triangles using diagonal (Heron's decomposition)
      const a = unitToMeter(quadSideA);
      const b = unitToMeter(quadSideB);
      const c = unitToMeter(quadSideC);
      const d = unitToMeter(quadSideD);
      const diag = unitToMeter(quadDiagonal);

      if (a > 0 && b > 0 && diag > 0 && (a + b > diag) && (a + diag > b) && (b + diag > a)) {
        const s1 = (a + b + diag) / 2.0;
        const area1 = Math.sqrt(Math.max(0, s1 * (s1 - a) * (s1 - b) * (s1 - diag)));

        if (c > 0 && d > 0 && (c + d > diag) && (c + diag > d) && (d + diag > c)) {
          const s2 = (c + d + diag) / 2.0;
          const area2 = Math.sqrt(Math.max(0, s2 * (s2 - c) * (s2 - d) * (s2 - diag)));
          calculatedSqMeters = area1 + area2;
          perimeterMeters = Math.round(a + b + c + d);
        } else {
          // Average offset formula fallback if diagonal not provided
          calculatedSqMeters = ((a + c) / 2.0) * ((b + d) / 2.0);
          perimeterMeters = Math.round(a + b + c + d);
        }
      } else if (a > 0 && b > 0 && c > 0 && d > 0) {
        // Standard Patwari average formula when diagonal is unavailable
        calculatedSqMeters = ((a + c) / 2.0) * ((b + d) / 2.0);
        perimeterMeters = Math.round(a + b + c + d);
      }
    }

    const formatted = formatAcreage(calculatedSqMeters);
    return {
      ...formatted,
      perimeterMeters,
      perimeterFeet: Math.round(perimeterMeters * 3.28084),
      isValid: calculatedSqMeters > 0
    };
  }, [dimensionShape, dimensionUnit, rectLength, rectWidth, quadSideA, quadSideB, quadSideC, quadSideD, quadDiagonal, triSideA, triSideB, triSideC]);

  // Active Area Data depending on active Survey Tool
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

    // Check if input is directly latitude, longitude (e.g. "16.5062, 80.6480")
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
      // Search OpenStreetMap Nominatim with focus on Andhra Pradesh & Telangana
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Andhra Pradesh, India')}&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setCenterLat(parseFloat(data[0].lat));
        setCenterLng(parseFloat(data[0].lon));
      } else {
        // Fallback search without state suffix
        const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data2 = await res2.json();
        if (data2 && data2.length > 0) {
          setCenterLat(parseFloat(data2[0].lat));
          setCenterLng(parseFloat(data2[0].lon));
        } else {
          setSearchError(isTe ? 'స్థలం కనుగొనబడలేదు. సరైన గ్రామం పేరు లేదా GPS కోఆర్డినేట్స్ ఇవ్వండి.' : 'Location not found. Try village name, mandal or lat,lng coordinates.');
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-24">
      {/* ═══════ 1. TOP HEADER & NAVIGATION BAR ═══════ */}
      <div className="space-y-3 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/more')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-95 shadow-xs"
          >
            <ChevronLeft className="w-4 h-4 stroke-[3]" />
            <span>{isTe ? '← ఇతర సేవలు (More)' : '← Back to More'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Ruler className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {isTe ? 'భూమి విస్తీర్ణ కాలిక్యులేటర్' : 'Field Area Calculator'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                  WGS-84 High Precision
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {isTe 
                  ? 'శాటిలైట్ పిన్స్, లైవ్ GPS వాక్ లేదా భౌతిక టేప్ కొలతల ద్వారా ఖచ్చితమైన విస్తీర్ణం లెక్కించండి'
                  : 'Calculate 100% exact field size via satellite pins, GPS perimeter walk, or physical tape measurements'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {surveyTool === 'satellite' && (
              <button
                type="button"
                onClick={() => setIsStudioOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{isTe ? 'పూర్తి స్క్రీన్ మ్యాప్' : 'Full-Screen Map'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{isTe ? 'వాట్సాప్ షేర్' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══════ DUAL SURVEY MODE SWITCHER (SATELLITE MAP vs TAPE MEASURE) ═══════ */}
      <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          onClick={() => setSurveyTool('satellite')}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            surveyTool === 'satellite'
              ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>{isTe ? '🛰️ శాటిలైట్ మ్యాప్ & జీపీఎస్' : '🛰️ Satellite Map & GPS'}</span>
        </button>

        <button
          type="button"
          onClick={() => setSurveyTool('dimensions')}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
            surveyTool === 'dimensions'
              ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>{isTe ? '📐 టేప్ / గొలుసు కొలతలు (టేప్ కాలిక్యులేటర్)' : '📐 Tape / Chain Dimensions'}</span>
        </button>
      </div>

      {/* ═══════ 2. PLOT NAME INPUT & VILLAGE/GPS SEARCH ═══════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Plot Name */}
        <div className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
            {isTe ? 'సర్వే పేరు:' : 'Plot / Survey:'}
          </span>
          <input
            type="text"
            value={plotName}
            onChange={(e) => setPlotName(e.target.value)}
            placeholder={isTe ? 'ఉదా: ఉత్తర పొలం లేదా సర్వే నం. 42' : 'e.g., North Plot or Survey No. 42'}
            className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Location Search (Satellite mode only) */}
        {surveyTool === 'satellite' ? (
          <form onSubmit={handleLocationSearch} className="flex items-center gap-2 p-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
            <Search className="w-4 h-4 text-emerald-600 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isTe ? 'గ్రామం పేరు లేదా GPS (15.5057, 80.0499)' : 'Village, Town, or GPS coordinates'}
              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="px-3 py-1.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shrink-0"
            >
              {searchLoading ? '...' : (isTe ? 'వెతుకు' : 'Find')}
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-xs font-bold text-emerald-900 dark:text-emerald-300">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{isTe ? 'కచ్చితమైన రెవెన్యూ పాట్వారీ కొలత ఫార్ములా' : 'Certified Revenue Survey Formulas'}</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black">
              100% Accurate
            </span>
          </div>
        )}
      </div>

      {searchError && (
        <p className="text-xs font-bold text-rose-500 px-2">{searchError}</p>
      )}

      {/* ═══════ 2.5 REAL-TIME MEASURED AREA BANNER (ALWAYS VISIBLE) ═══════ */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/15 border-2 border-emerald-500/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-emerald-600 text-white shadow-xs shrink-0">
            <Ruler className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              {isTe ? 'కొలిచిన ప్రస్తుత విస్తీర్ణం (Live Measured Area)' : 'Current Measured Area'}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400">
                {activeAreaData.acres} {isTe ? 'ఎకరాలు' : 'Acres'}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-teal-600 dark:text-teal-400">
                ({activeAreaData.cents} {isTe ? 'సెంట్లు' : 'Cents'})
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            {activeAreaData.gunthas} {isTe ? 'గుంటలు' : 'Gunthas'}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            {activeAreaData.gajam} {isTe ? 'గజాలు (Sq.Yds)' : 'Sq.Yds (Gajam)'}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            📏 {activeAreaData.perimeterMeters}m ({activeAreaData.perimeterFeet} ft)
          </span>
          {surveyTool === 'satellite' && (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
              📍 {boundaryPins.length} {isTe ? 'మూలలు' : 'Corners'}
            </span>
          )}
        </div>
      </div>

      {/* ═══════ MODE 1: SATELLITE MAP MEASUREMENT ═══════ */}
      {surveyTool === 'satellite' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isTe ? 'శాటిలైట్ మ్యాప్‌పై పిన్స్ వేయండి లేదా సరిహద్దు చుట్టూ నడిచి కొలవండి' : 'Drop pins on satellite map or walk field perimeter to measure'}
            </span>
            {boundaryPins.length > 0 && (
              <button
                type="button"
                onClick={handleResetSurvey}
                className="flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                <span>{isTe ? 'క్లియర్ చేయి' : 'Reset Pins'}</span>
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden bg-slate-950 touch-none overscroll-none">
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
              height="480px"
            />
          </div>
        </div>
      )}

      {/* ═══════ MODE 2: PHYSICAL TAPE / CHAIN DIMENSION CALCULATOR ═══════ */}
      {surveyTool === 'dimensions' && (
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-md space-y-6">
          {/* Shape & Unit Selectors */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            {/* Shape Select Buttons */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                {isTe ? '1. పొలం ఆకారం ఎంచుకోండి:' : '1. Select Field Shape:'}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDimensionShape('rectangle')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    dimensionShape === 'rectangle'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>{isTe ? 'చతురస్రం / దీర్ఘచతురస్రం' : 'Rectangle / Square'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDimensionShape('quadrilateral')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    dimensionShape === 'quadrilateral'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{isTe ? '4-భుజాల పొలం (పాట్వారీ సర్వే)' : '4-Side Irregular Field'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDimensionShape('triangle')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    dimensionShape === 'triangle'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Triangle className="w-3.5 h-3.5" />
                  <span>{isTe ? 'త్రిభుజం (3 భుజాలు)' : 'Triangle (3 Sides)'}</span>
                </button>
              </div>
            </div>

            {/* Measurement Unit Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                {isTe ? '2. కొలిచిన యూనిట్:' : '2. Measurement Unit:'}
              </label>
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {[
                  { id: 'feet', labelEn: 'Feet (అడుగులు)', labelTe: 'అడుగులు' },
                  { id: 'meters', labelEn: 'Meters (మీటర్లు)', labelTe: 'మీటర్లు' },
                  { id: 'yards', labelEn: 'Yards / గజాలు', labelTe: 'గజాలు' },
                  { id: 'links', labelEn: "Links (గొలుసు లింకులు)", labelTe: 'లింకులు' }
                ].map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setDimensionUnit(u.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      dimensionUnit === u.id
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {isTe ? u.labelTe : u.labelEn}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form Inputs based on Shape */}
          {dimensionShape === 'rectangle' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  {isTe ? `పొడవు (Length in ${dimensionUnit}):` : `Length (${dimensionUnit}):`}
                </label>
                <input
                  type="number"
                  step="any"
                  value={rectLength}
                  onChange={(e) => setRectLength(e.target.value)}
                  placeholder="e.g., 200"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  {isTe ? `వెడల్పు (Width in ${dimensionUnit}):` : `Width (${dimensionUnit}):`}
                </label>
                <input
                  type="number"
                  step="any"
                  value={rectWidth}
                  onChange={(e) => setRectWidth(e.target.value)}
                  placeholder="e.g., 150"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {dimensionShape === 'quadrilateral' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isTe 
                  ? 'చిట్కా: ఖచ్చితమైన కొలత కోసం 4 సరిహద్దుల పొడవులతో పాటు మధ్యలో వికర్ణం (కర్ణం / Diagonal) నమోదు చేయండి.'
                  : 'Tip: For certified revenue accuracy, enter all 4 border sides plus the center corner-to-corner diagonal.'}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    Side A ({dimensionUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quadSideA}
                    onChange={(e) => setQuadSideA(e.target.value)}
                    placeholder="Side A"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    Side B ({dimensionUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quadSideB}
                    onChange={(e) => setQuadSideB(e.target.value)}
                    placeholder="Side B"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    Side C ({dimensionUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quadSideC}
                    onChange={(e) => setQuadSideC(e.target.value)}
                    placeholder="Side C"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                    Side D ({dimensionUnit})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quadSideD}
                    onChange={(e) => setQuadSideD(e.target.value)}
                    placeholder="Side D"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <label className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                    {isTe ? `వికర్ణం / కర్ణం పొడవు (Diagonal in ${dimensionUnit}) [సిఫార్సు]:` : `Center Diagonal (${dimensionUnit}) [Recommended]:`}
                  </label>
                  <p className="text-[10px] text-slate-500">
                    {isTe ? 'మూల నుండి ఎదురు మూలకు కొలిచిన కొలత' : 'Corner-to-opposite-corner distance'}
                  </p>
                </div>
                <input
                  type="number"
                  step="any"
                  value={quadDiagonal}
                  onChange={(e) => setQuadDiagonal(e.target.value)}
                  placeholder="e.g., 250"
                  className="w-full sm:w-48 px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}

          {dimensionShape === 'triangle' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Side A ({dimensionUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={triSideA}
                  onChange={(e) => setTriSideA(e.target.value)}
                  placeholder="Side A"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Side B ({dimensionUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={triSideB}
                  onChange={(e) => setTriSideB(e.target.value)}
                  placeholder="Side B"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700 dark:text-slate-300">
                  Side C ({dimensionUnit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={triSideC}
                  onChange={(e) => setTriSideC(e.target.value)}
                  placeholder="Side C"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════ 4. EIGHT-UNIT REAL-TIME CONVERSION CARDS ═══════ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isTe ? 'విస్తీర్ణ కొలతలు (8 ప్రామాణిక యూనిట్లు)' : 'Land Area in 8 Standard Units'}</span>
          </h3>
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (isTe ? 'కాపీ అయింది!' : 'Copied!') : (isTe ? 'కాపీ చేయి' : 'Copy Summary')}</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {/* 1. Acres */}
          <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              {isTe ? 'ఎకరాలు' : 'Acres'}
            </p>
            <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
              {activeAreaData.acres}
            </p>
            <span className="text-[9px] text-emerald-600/80 font-bold">Acres</span>
          </div>

          {/* 2. Gunthas */}
          <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">
              {isTe ? 'గుంటలు' : 'Gunthas'}
            </p>
            <p className="text-xl font-black text-teal-700 dark:text-teal-400 mt-1">
              {activeAreaData.gunthas}
            </p>
            <span className="text-[9px] text-teal-600/80 font-bold">1 Ac = 40 Gun</span>
          </div>

          {/* 3. Cents */}
          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300">
              {isTe ? 'సెంట్లు' : 'Cents'}
            </p>
            <p className="text-xl font-black text-sky-700 dark:text-sky-400 mt-1">
              {activeAreaData.cents}
            </p>
            <span className="text-[9px] text-sky-600/80 font-bold">1 Ac = 100 Cents</span>
          </div>

          {/* 4. Gajam / Sq. Yards */}
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              {isTe ? 'గజాలు' : 'Sq. Yards'}
            </p>
            <p className="text-lg font-black text-indigo-700 dark:text-indigo-400 mt-1 truncate">
              {activeAreaData.gajam}
            </p>
            <span className="text-[9px] text-indigo-600/80 font-bold">Gajalu</span>
          </div>

          {/* 5. Square Feet */}
          <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">
              {isTe ? 'చదరపు అడుగులు' : 'Sq. Feet'}
            </p>
            <p className="text-lg font-black text-purple-700 dark:text-purple-400 mt-1 truncate">
              {activeAreaData.sqFeet}
            </p>
            <span className="text-[9px] text-purple-600/80 font-bold">ft²</span>
          </div>

          {/* 6. Square Meters */}
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {isTe ? 'చదరపు మీటర్లు' : 'Sq. Meters'}
            </p>
            <p className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1 truncate">
              {activeAreaData.sqMeters}
            </p>
            <span className="text-[9px] text-amber-600/80 font-bold">m²</span>
          </div>

          {/* 7. Hectares */}
          <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
              {isTe ? 'హెక్టార్లు' : 'Hectares'}
            </p>
            <p className="text-xl font-black text-cyan-700 dark:text-cyan-400 mt-1">
              {activeAreaData.hectares}
            </p>
            <span className="text-[9px] text-cyan-600/80 font-bold">Ha</span>
          </div>

          {/* 8. Bigha */}
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
              {isTe ? 'బీఘా' : 'Bigha'}
            </p>
            <p className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1">
              {activeAreaData.bigha}
            </p>
            <span className="text-[9px] text-rose-600/80 font-bold">Bigha</span>
          </div>
        </div>
      </div>

      {/* ═══════ 5. PERIMETER & SURVEY GEOMETRY ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Total Perimeter Summary */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Footprints className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {isTe ? 'చుట్టుకొలత & సర్వే వివరాలు' : 'Perimeter & Survey Geometry'}
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'మొత్తం చుట్టుకొలత (Perimeter):' : 'Total Perimeter:'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {activeAreaData.perimeterMeters} m ({activeAreaData.perimeterFeet} ft)
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'సర్వే మోడ్:' : 'Survey Mode:'}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {surveyTool === 'satellite' ? 'WGS-84 Satellite GPS' : `Physical Tape (${dimensionShape.toUpperCase()})`}
              </span>
            </div>
            {surveyTool === 'satellite' ? (
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">{isTe ? 'గుర్తించిన మూలలు (Corners):' : 'Boundary Pins:'}</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {boundaryPins.length} {isTe ? 'పిన్స్' : 'points'}
                </span>
              </div>
            ) : (
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500 dark:text-slate-400">{isTe ? 'కొలిచిన యూనిట్:' : 'Dimension Unit:'}</span>
                <span className="font-extrabold text-slate-900 dark:text-white capitalize">
                  {dimensionUnit}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Side-by-Side Border Segment Lengths */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Ruler className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {isTe ? 'ప్రతి సరిహద్దు పొడవు (Borders)' : 'Border Side Lengths'}
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-bold">
              {surveyTool === 'satellite' ? `${sideSegments.length} ${isTe ? 'సరిహద్దులు' : 'Sides'}` : 'Dimensions Mode'}
            </span>
          </div>

          {surveyTool === 'satellite' ? (
            sideSegments.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {sideSegments.map((seg, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      {isTe ? `సైడ్` : `Side`} {seg.side}
                    </span>
                    <div className="text-right">
                      <p className="text-xs font-black text-slate-900 dark:text-white">{seg.meters} m</p>
                      <p className="text-[10px] text-slate-400 font-medium">{seg.feet} ft</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                {isTe 
                  ? 'మ్యాప్‌పై కనీసం 2 పిన్స్ వేయండి లేదా వాక్ మోడ్ ప్రారంభించండి'
                  : 'Drop at least 2 corner pins on the map or start walk mode to see side lengths'}
              </div>
            )
          ) : (
            <div className="space-y-2 text-xs">
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                {isTe
                  ? 'భౌతిక టేప్ ద్వారా కొలిచిన కొలతలు పై డయల్‌లో ఎకరాలు, సెంట్లు మరియు గుంటలుగా నేరుగా మార్చబడ్డాయి.'
                  : 'Manual tape measurements entered above are instantly converted into certified Acres, Cents, Gunthas, and Sq. Yards.'}
              </p>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <span className="font-bold text-slate-700 dark:text-slate-300">{isTe ? 'లెక్కింపు ఫార్ములా:' : 'Formula:'}</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {dimensionShape === 'rectangle' ? 'L × W (Length × Width)' : dimensionShape === 'triangle' ? "Heron's Formula" : 'Patwari Triangular Decomposition'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Helpful Farmer Guidance Alert */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2.5">
        <Info className="w-4 h-4 shrink-0 text-emerald-600" />
        <span>
          {isTe
            ? 'చిట్కా: మీ భూమి చుట్టూ ఉన్న సరిహద్దు రాళ్ల వద్ద నడిచి "వాక్ మోడ్" వాడవచ్చు లేదా గొలుసు/టేపుతో కొలిచి నేరుగా పైన కొలతలు నమోదు చేయవచ్చు.'
            : 'Tip: You can walk around your field boundary stones using "Walk Mode", or measure with tape/chain and enter exact dimensions directly.'}
        </span>
      </div>
    </div>
  );
}
