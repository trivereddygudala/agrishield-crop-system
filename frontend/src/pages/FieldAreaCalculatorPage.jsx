import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Ruler, ChevronLeft, MapPin, Footprints, Share2, 
  Copy, Check, Trash2, Maximize2, Compass, Layers, Info
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

  // State: General Land Survey (Independent of crop or farm registration)
  const [plotName, setPlotName] = useState(() => isTe ? 'భూమి సర్వే' : 'Land / Plot Survey');
  const [boundaryPins, setBoundaryPins] = useState([]);
  const [copied, setCopied] = useState(false);
  const [isStudioOpen, setIsStudioOpen] = useState(false);

  // Live GPS Center coordinates (automatically acquired or fallback)
  const [centerLat, setCenterLat] = useState(15.5057);
  const [centerLng, setCenterLng] = useState(80.0499);
  const [gpsAcquired, setGpsAcquired] = useState(false);

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

  // Real-time calculated Area in 8 Regional & International Units
  const areaData = useMemo(() => {
    const sqM = calculateGeodesicArea(boundaryPins);
    const perimeterM = calculatePerimeter(boundaryPins);
    const formatted = formatAcreage(sqM);
    return {
      ...formatted,
      perimeterMeters: perimeterM,
      perimeterFeet: Math.round(perimeterM * 3.28084)
    };
  }, [boundaryPins]);

  // Real-time calculation of each boundary side / fence line length
  const sideSegments = useMemo(() => {
    if (!boundaryPins || boundaryPins.length < 2) return [];
    const segments = [];
    const len = boundaryPins.length;
    for (let i = 0; i < len; i++) {
      if (len === 2 && i === 1) break; // Only 1 segment if 2 pins
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

  // Clean WhatsApp Land Survey Report (No crop or registration baggage)
  const handleWhatsAppShare = () => {
    const segmentsText = sideSegments.length > 0
      ? sideSegments.map((s) => `• సైడ్ ${s.side}: ${s.meters}m (${s.feet} ft)`).join('\n')
      : '';

    const segmentsTextEn = sideSegments.length > 0
      ? sideSegments.map((s) => `• Side ${s.side}: ${s.meters}m (${s.feet} ft)`).join('\n')
      : '';

    const text = isTe
      ? `🌾 *డిజిటల్ భూమి విస్తీర్ణ సర్వే రిపోర్ట్* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *భూమి / స్థలం:* ${plotName || 'భూమి సర్వే'}\n` +
        `📅 *సర్వే తేదీ:* ${new Date().toLocaleDateString('te-IN')}\n\n` +
        `📏 *ఖచ్చితమైన కొలతలు (Land Area):*\n` +
        `• *ఎకరాలు (Acres):* ${areaData.acres} ఎక\n` +
        `• *గుంటలు (Gunthas):* ${areaData.gunthas} గుంటలు\n` +
        `• *సెంట్లు (Cents):* ${areaData.cents} సెంట్లు\n` +
        `• *గజాలు (Sq. Yards):* ${areaData.gajam} గజాలు\n` +
        `• *చదరపు అడుగులు:* ${areaData.sqFeet} Sq.Ft\n` +
        `• *చదరపు మీటర్లు:* ${areaData.sqMeters} m²\n` +
        `• *హెక్టార్లు:* ${areaData.hectares} Ha\n` +
        `• *బీఘా:* ${areaData.bigha} Bigha\n\n` +
        `📐 *చుట్టుకొలత (Perimeter):*\n` +
        `• మొత్తం: ${areaData.perimeterMeters} మీటర్లు (${areaData.perimeterFeet} అడుగులు)\n` +
        `• మూల పిన్స్: ${boundaryPins.length} పాయింట్స్\n` +
        (segmentsText ? `\n🧱 *ప్రతి సరిహద్దు పొడవు (Borders):*\n${segmentsText}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _AgriShield GPS ల్యాండ్ కాలిక్యులేటర్ ద్వారా కొలవబడింది._`
      : `🌾 *Digital Land Area Survey Report* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Land / Plot:* ${plotName || 'Land Survey'}\n` +
        `📅 *Survey Date:* ${new Date().toLocaleDateString()}\n\n` +
        `📏 *Calculated Land Area:*\n` +
        `• *Acres:* ${areaData.acres} Ac\n` +
        `• *Gunthas:* ${areaData.gunthas} Gunthas\n` +
        `• *Cents:* ${areaData.cents} Cents\n` +
        `• *Sq. Yards (Gajam):* ${areaData.gajam} Sq.Yds\n` +
        `• *Sq. Feet:* ${areaData.sqFeet} Sq.Ft\n` +
        `• *Sq. Meters:* ${areaData.sqMeters} m²\n` +
        `• *Hectares:* ${areaData.hectares} Ha\n` +
        `• *Bigha:* ${areaData.bigha} Bigha\n\n` +
        `📐 *Boundary Perimeter:*\n` +
        `• Total: ${areaData.perimeterMeters} m (${areaData.perimeterFeet} ft)\n` +
        `• Corner Pins: ${boundaryPins.length} points\n` +
        (segmentsTextEn ? `\n🧱 *Border Side Lengths:*\n${segmentsTextEn}\n` : '') +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _Measured accurately via AgriShield GPS Land Area Calculator._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    const summary = `${plotName}: ${areaData.acres} Acres (${areaData.gunthas} Gunthas, ${areaData.cents} Cents, ${areaData.gajam} Sq.Yards, ${areaData.sqMeters} m²) - Perimeter: ${areaData.perimeterMeters}m`;
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

  // Dedicated Full-screen Studio View (renders via portal, 100% viewport locked, no movement)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/more')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer active:scale-95 shrink-0"
          >
            <ChevronLeft className="w-4 h-4 stroke-[3]" />
            <span>{isTe ? '← ఇతర సేవలు' : '← Back to More'}</span>
          </button>

          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Ruler className="w-5 h-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {isTe ? 'భూమి విస్తీర్ణ కాలిక్యులేటర్' : 'Field Area Calculator'}
              </h1>
              <span className="hidden xs:inline px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                {isTe ? 'సార్వత్రిక భూమి కొలత' : 'General Land Measure'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isTe 
                ? 'ఏ పొలం లేదా స్థలానికైనా శాటిలైట్ పిన్స్ లేదా వాక్ మోడ్ ద్వారా విస్తీర్ణం లెక్కించండి'
                : 'Measure any field, plot or land area with satellite pins or high-precision GPS perimeter walk'}
            </p>
          </div>
        </div>

        {/* Top Actions: Fullscreen & WhatsApp Share */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setIsStudioOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 transition-all active:scale-95 cursor-pointer shadow-sm"
            title={isTe ? 'పూర్తి స్క్రీన్ తెరవండి' : 'Open Fullscreen Map'}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>{isTe ? 'పూర్తి స్క్రీన్ మ్యాప్' : 'Full-Screen Map'}</span>
          </button>

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

      {/* ═══════ 2. PLOT NAME INPUT (CUSTOMIZABLE BY FARMER) ═══════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-2 flex-1">
          <Compass className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
            {isTe ? 'సర్వే స్థలం పేరు:' : 'Plot / Survey Name:'}
          </span>
          <input
            type="text"
            value={plotName}
            onChange={(e) => setPlotName(e.target.value)}
            placeholder={isTe ? 'ఉదా: ఉత్తర పొలం లేదా సర్వే నం. 42' : 'e.g., North Plot or Survey No. 42'}
            className="flex-1 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {boundaryPins.length > 0 && (
          <button
            type="button"
            onClick={handleResetSurvey}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors cursor-pointer self-end sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isTe ? 'కొలతలు క్లియర్ చేయి' : 'Reset Pins'}</span>
          </button>
        )}
      </div>

      {/* ═══════ 2.5 REAL-TIME MEASURED AREA BANNER (IMMEDIATELY VISIBLE ON SCREEN) ═══════ */}
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
                {areaData.acres} {isTe ? 'ఎకరాలు' : 'Acres'}
              </span>
              <span className="text-sm sm:text-base font-extrabold text-teal-600 dark:text-teal-400">
                ({areaData.cents} {isTe ? 'సెంట్లు' : 'Cents'})
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            {areaData.gunthas} {isTe ? 'గుంటలు' : 'Gunthas'}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            {areaData.gajam} {isTe ? 'గజాలు (Sq.Yds)' : 'Sq.Yds (Gajam)'}
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 shadow-xs">
            📏 {areaData.perimeterMeters}m ({areaData.perimeterFeet} ft)
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white shadow-xs">
            📍 {boundaryPins.length} {isTe ? 'మూలలు' : 'Corners'}
          </span>
        </div>
      </div>

      {/* ═══════ 3. MEASURING MAP CONTAINER (OVERSCROLL LOCKED, TOUCH NONE) ═══════ */}
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

      {/* ═══════ 4. EIGHT-UNIT REAL-TIME CONVERSION CARDS ═══════ */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isTe ? 'విస్తీర్ణ కొలతలు (8 యూనిట్లు)' : 'Land Area in 8 Standard Units'}</span>
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
              {areaData.acres}
            </p>
            <span className="text-[9px] text-emerald-600/80 font-bold">Acres</span>
          </div>

          {/* 2. Gunthas */}
          <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">
              {isTe ? 'గుంటలు' : 'Gunthas'}
            </p>
            <p className="text-xl font-black text-teal-700 dark:text-teal-400 mt-1">
              {areaData.gunthas}
            </p>
            <span className="text-[9px] text-teal-600/80 font-bold">1 Ac = 40 Gun</span>
          </div>

          {/* 3. Cents */}
          <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300">
              {isTe ? 'సెంట్లు' : 'Cents'}
            </p>
            <p className="text-xl font-black text-sky-700 dark:text-sky-400 mt-1">
              {areaData.cents}
            </p>
            <span className="text-[9px] text-sky-600/80 font-bold">1 Ac = 100 Cents</span>
          </div>

          {/* 4. Gajam / Sq. Yards */}
          <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
              {isTe ? 'గజాలు' : 'Sq. Yards'}
            </p>
            <p className="text-lg font-black text-indigo-700 dark:text-indigo-400 mt-1 truncate">
              {areaData.gajam}
            </p>
            <span className="text-[9px] text-indigo-600/80 font-bold">Gajalu</span>
          </div>

          {/* 5. Square Feet */}
          <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">
              {isTe ? 'చదరపు అడుగులు' : 'Sq. Feet'}
            </p>
            <p className="text-lg font-black text-purple-700 dark:text-purple-400 mt-1 truncate">
              {areaData.sqFeet}
            </p>
            <span className="text-[9px] text-purple-600/80 font-bold">ft²</span>
          </div>

          {/* 6. Square Meters */}
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
              {isTe ? 'చదరపు మీటర్లు' : 'Sq. Meters'}
            </p>
            <p className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1 truncate">
              {areaData.sqMeters}
            </p>
            <span className="text-[9px] text-amber-600/80 font-bold">m²</span>
          </div>

          {/* 7. Hectares */}
          <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
              {isTe ? 'హెక్టార్లు' : 'Hectares'}
            </p>
            <p className="text-xl font-black text-cyan-700 dark:text-cyan-400 mt-1">
              {areaData.hectares}
            </p>
            <span className="text-[9px] text-cyan-600/80 font-bold">Ha</span>
          </div>

          {/* 8. Bigha */}
          <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-500/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-800 dark:text-rose-300">
              {isTe ? 'బీఘా' : 'Bigha'}
            </p>
            <p className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1">
              {areaData.bigha}
            </p>
            <span className="text-[9px] text-rose-600/80 font-bold">Bigha</span>
          </div>
        </div>
      </div>

      {/* ═══════ 5. PERIMETER & BORDER SEGMENT LENGTHS ═══════ */}
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
                {areaData.perimeterMeters} m ({areaData.perimeterFeet} ft)
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'గుర్తించిన మూలలు (Corners):' : 'Boundary Pins:'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {boundaryPins.length} {isTe ? 'పిన్స్' : 'points'}
              </span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'సర్వే మోడ్:' : 'Survey Mode:'}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {isTe ? 'జీపీఎస్ వాక్ + శాటిలైట్ పిన్' : 'GPS Walk + Satellite Pin'}
              </span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'సర్వే స్థితి:' : 'Survey Status:'}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {boundaryPins.length >= 3 
                  ? (isTe ? '✅ సరిహద్దు పూర్తయింది' : '✅ Closed Polygon') 
                  : (isTe ? '⚠️ కనీసం 3 పిన్స్ అవసరం' : '⚠️ Need at least 3 points')}
              </span>
            </div>
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
              {sideSegments.length} {isTe ? 'సరిహద్దులు' : 'Sides'}
            </span>
          </div>

          {sideSegments.length > 0 ? (
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
          )}
        </div>
      </div>

      {/* Helpful Farmer Guidance Alert */}
      <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-900 dark:text-emerald-300 flex items-center gap-2.5">
        <Info className="w-4 h-4 shrink-0 text-emerald-600" />
        <span>
          {isTe
            ? 'చిట్కా: మీ భూమి చుట్టూ ఉన్న సరిహద్దు రాళ్ల వద్ద నడిచి "కార్నర్ పిన్ వేయి" నొక్కడం ద్వారా 1-మీటర్ ఖచ్చితత్వంతో విస్తీర్ణాన్ని పొందవచ్చు.'
            : 'Tip: For pinpoint accuracy, walk around your boundary stones with your phone and use "Walk Mode" to measure the exact field size.'}
        </span>
      </div>
    </div>
  );
}
