import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { 
  Ruler, ChevronLeft, MapPin, Footprints, Share2, CheckCircle2, 
  Sparkles, Layers, ShieldCheck, Droplets, Sprout, 
  Copy, Check, FileSpreadsheet, RefreshCw, Printer, Info
} from 'lucide-react';
import FieldBoundaryMap, { calculateGeodesicArea, calculatePerimeter, formatAcreage } from '../components/farm/FieldBoundaryMap';

export default function FieldAreaCalculatorPage() {
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const navigate = useNavigate();
  const { activeFarm, saveFarmEdit } = useFarm();

  // State
  const [boundaryPins, setBoundaryPins] = useState(() => activeFarm?.boundary_coordinates || []);
  const [selectedCrop, setSelectedCrop] = useState(activeFarm?.crop_type || 'Tomato');
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fallback Center coordinates
  const centerLat = activeFarm?.latitude || 15.5057;
  const centerLng = activeFarm?.longitude || 80.0499;

  // Real-time calculated Area in 8 Units
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

  // Agronomic Inputs Estimation per Acre
  const inputEstimates = useMemo(() => {
    const acres = areaData.rawAcres || 0;
    if (acres <= 0) {
      return { seeds: '0 kg', pumps: 0, water: '0 L', urea: '0 kg' };
    }

    const cropSeedsPerAcre = {
      Tomato: { seeds: '100 - 150 grams', pumps: 3, water: 4500, urea: 45 },
      Paddy: { seeds: '25 - 30 kg', pumps: 4, water: 12000, urea: 65 },
      Cotton: { seeds: '2 - 3 packets', pumps: 4, water: 6000, urea: 50 },
      Chili: { seeds: '200 - 250 grams', pumps: 4, water: 5000, urea: 55 },
      Maize: { seeds: '8 - 10 kg', pumps: 3, water: 5500, urea: 60 },
      Groundnut: { seeds: '40 - 50 kg', pumps: 3, water: 4000, urea: 35 }
    };

    const rate = cropSeedsPerAcre[selectedCrop] || cropSeedsPerAcre.Tomato;
    return {
      seeds: `${(acres * 1).toFixed(1)}x acre rate (${rate.seeds})`,
      pumps: Math.max(1, Math.round(acres * rate.pumps)),
      water: `${Math.round(acres * rate.water).toLocaleString('en-IN')} L`,
      urea: `${Math.round(acres * rate.urea)} kg`
    };
  }, [areaData.rawAcres, selectedCrop]);

  // Handle Save to Active Farm
  const handleSaveToFarm = async () => {
    if (!activeFarm?.id) {
      alert(isTe ? 'దయచేసి ముందుగా పొలం ప్రొఫైల్‌ను ఎంచుకోండి.' : 'Please select an active farm first.');
      return;
    }
    try {
      await saveFarmEdit(activeFarm.id, {
        farm_size: parseFloat(areaData.acres),
        boundary_coordinates: boundaryPins
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save calculated area:', err);
      alert(isTe ? 'పొలం విస్తీర్ణం సేవ్ చేయడం విఫలమైంది.' : 'Failed to save field area.');
    }
  };

  // WhatsApp Shareable Land Survey Report
  const handleWhatsAppShare = () => {
    const text = isTe
      ? `🌾 *అగ్రిషీల్డ్ - డిజిటల్ భూమి విస్తీర్ణ సర్వే రిపోర్ట్* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *పొలం పేరు:* ${activeFarm?.farm_name || 'రైతు పొలం'}\n` +
        `🌾 *పంట:* ${selectedCrop}\n` +
        `📅 *సర్వే తేదీ:* ${new Date().toLocaleDateString('te-IN')}\n\n` +
        `📏 *విస్తీర్ణ కొలతలు (Land Area):*\n` +
        `• *ఎకరాలు (Acres):* ${areaData.acres} ఎక\n` +
        `• *గుంటలు (Gunthas):* ${areaData.gunthas} గుంటలు\n` +
        `• *సెంట్లు (Cents):* ${areaData.cents} సెంట్లు\n` +
        `• *గజాలు (Sq. Yards):* ${areaData.gajam} గజాలు\n` +
        `• *చదరపు అడుగులు:* ${areaData.sqFeet} Sq.Ft\n` +
        `• *చదరపు మీటర్లు:* ${areaData.sqMeters} m²\n` +
        `• *హెక్టార్లు:* ${areaData.hectares} Ha\n` +
        `• *చుట్టుకొలత (Perimeter):* ${areaData.perimeterMeters} మీటర్లు (${areaData.perimeterFeet} అడుగులు)\n` +
        `• *కార్నర్ పాయింట్స్:* ${boundaryPins.length} పిన్స్\n\n` +
        `🚜 *16L స్ప్రే పంపులు:* ~${inputEstimates.pumps} పంపులు\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _AgriShield AI Smart Farm System ద్వారా కొలవబడింది._`
      : `🌾 *AgriShield - Digital Land Area Survey Report* 🌾\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📍 *Farm Name:* ${activeFarm?.farm_name || 'My Farm'}\n` +
        `🌾 *Crop:* ${selectedCrop}\n` +
        `📅 *Survey Date:* ${new Date().toLocaleDateString()}\n\n` +
        `📏 *Calculated Land Area:*\n` +
        `• *Acres:* ${areaData.acres} Ac\n` +
        `• *Gunthas:* ${areaData.gunthas} Gunthas\n` +
        `• *Cents:* ${areaData.cents} Cents\n` +
        `• *Sq. Yards (Gajam):* ${areaData.gajam} Sq.Yds\n` +
        `• *Sq. Feet:* ${areaData.sqFeet} Sq.Ft\n` +
        `• *Sq. Meters:* ${areaData.sqMeters} m²\n` +
        `• *Hectares:* ${areaData.hectares} Ha\n` +
        `• *Perimeter:* ${areaData.perimeterMeters} m (${areaData.perimeterFeet} ft)\n` +
        `• *Boundary Corners:* ${boundaryPins.length} pins\n\n` +
        `🚜 *16L Knapsack Sprayer Pumps:* ~${inputEstimates.pumps} pumps\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `✨ _Measured accurately via AgriShield GPS Land Survey Tool._`;

    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Copy Survey Summary
  const handleCopySummary = () => {
    const summary = `${areaData.acres} Acres (${areaData.gunthas} Gunthas, ${areaData.cents} Cents, ${areaData.sqMeters} sq.m)`;
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto w-full pb-20">
      {/* ═══════ 1. TOP TITLE & BACK BAR ═══════ */}
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
                {isTe ? 'పొలం విస్తీర్ణ కాలిక్యులేటర్' : 'Field Area Calculator'}
              </h1>
              <span className="hidden xs:inline px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                {isTe ? '1-మీటర్ GPS సర్వే' : '1m GPS Survey'}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {isTe 
                ? 'జీపీఎస్ వాక్ మోడ్ & శాటిలైట్ మ్యాప్ ద్వారా ఖచ్చితమైన ఎకరాలు, గుంటలు, సెంట్లు కొలవండి'
                : 'High-precision GPS perimeter walk & satellite pin land measurement in Acres, Cents & Gunthas'}
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{isTe ? 'వాట్సాప్ షేర్' : 'Share on WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToFarm}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800'
            }`}
          >
            {saveSuccess ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            <span>{saveSuccess ? (isTe ? 'సేవ్ అయింది!' : 'Saved!') : (isTe ? 'నా పొలానికి సేవ్ చేయి' : 'Save to My Farm')}</span>
          </button>
        </div>
      </div>

      {/* ═══════ 2. HIGH-PRECISION MEASURING MAP CONTAINER ═══════ */}
      <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xl overflow-hidden bg-slate-950">
        <FieldBoundaryMap
          centerLat={centerLat}
          centerLng={centerLng}
          farmName={activeFarm?.farm_name || (isTe ? 'సర్వే పొలం' : 'Survey Field')}
          cropName={selectedCrop}
          boundaryCoordinates={boundaryPins}
          onBoundaryChange={(newPins) => {
            setBoundaryPins(newPins);
          }}
          isTelugu={isTe}
          interactive={true}
          height="460px"
        />
      </div>

      {/* ═══════ 3. EIGHT-UNIT REAL-TIME CONVERSION CARDS ═══════ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {/* Acres */}
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
            {isTe ? 'ఎకరాలు' : 'Acres'}
          </p>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
            {areaData.acres}
          </p>
          <span className="text-[9px] text-emerald-600/80 font-bold">Ac</span>
        </div>

        {/* Gunthas */}
        <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-teal-800 dark:text-teal-300">
            {isTe ? 'గుంటలు' : 'Gunthas'}
          </p>
          <p className="text-xl font-black text-teal-700 dark:text-teal-400 mt-1">
            {areaData.gunthas}
          </p>
          <span className="text-[9px] text-teal-600/80 font-bold">1 Ac = 40 Gun</span>
        </div>

        {/* Cents */}
        <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-500/30 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-sky-800 dark:text-sky-300">
            {isTe ? 'సెంట్లు' : 'Cents'}
          </p>
          <p className="text-xl font-black text-sky-700 dark:text-sky-400 mt-1">
            {areaData.cents}
          </p>
          <span className="text-[9px] text-sky-600/80 font-bold">1 Ac = 100 Cents</span>
        </div>

        {/* Gajam / Sq. Yards */}
        <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-500/30 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-800 dark:text-indigo-300">
            {isTe ? 'గజాలు' : 'Sq. Yards'}
          </p>
          <p className="text-lg font-black text-indigo-700 dark:text-indigo-400 mt-1 truncate">
            {areaData.gajam}
          </p>
          <span className="text-[9px] text-indigo-600/80 font-bold">Gajalu</span>
        </div>

        {/* Square Feet */}
        <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-500/30 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-purple-800 dark:text-purple-300">
            {isTe ? 'చదరపు అడుగులు' : 'Sq. Feet'}
          </p>
          <p className="text-lg font-black text-purple-700 dark:text-purple-400 mt-1 truncate">
            {areaData.sqFeet}
          </p>
          <span className="text-[9px] text-purple-600/80 font-bold">ft²</span>
        </div>

        {/* Square Meters */}
        <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-500/30 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300">
            {isTe ? 'చదరపు మీటర్లు' : 'Sq. Meters'}
          </p>
          <p className="text-lg font-black text-amber-700 dark:text-amber-400 mt-1 truncate">
            {areaData.sqMeters}
          </p>
          <span className="text-[9px] text-amber-600/80 font-bold">m²</span>
        </div>

        {/* Hectares */}
        <div className="p-3 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-500/30 text-center">
          <p className="text-[10px] font-black uppercase tracking-wider text-cyan-800 dark:text-cyan-300">
            {isTe ? 'హెక్టార్లు' : 'Hectares'}
          </p>
          <p className="text-xl font-black text-cyan-700 dark:text-cyan-400 mt-1">
            {areaData.hectares}
          </p>
          <span className="text-[9px] text-cyan-600/80 font-bold">Ha</span>
        </div>

        {/* Bigha */}
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

      {/* ═══════ 4. PERIMETER & SURVEY DETAILS + INPUTS ESTIMATOR ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Survey Dimensions & Geometry */}
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Footprints className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              {isTe ? 'పొలం సరిహద్దు & కొలతలు' : 'Boundary Perimeter & Details'}
            </h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'మొత్తం చుట్టుకొలత (Perimeter):' : 'Total Perimeter:'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{areaData.perimeterMeters} m ({areaData.perimeterFeet} ft)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'గుర్తించిన మూల పిన్స్ (Corners):' : 'Boundary Pins:'}</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{boundaryPins.length} {isTe ? 'పిన్స్' : 'points'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50 dark:border-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'సర్వే పద్ధతి:' : 'Survey Mode:'}</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{isTe ? 'జీపీఎస్ వాక్ + శాటిలైట్' : 'GPS Walk + Satellite Pin'}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500 dark:text-slate-400">{isTe ? 'సర్వే స్థితి:' : 'Survey Status:'}</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {boundaryPins.length >= 3 
                  ? (isTe ? '✅ సరిహద్దు పూర్తయింది' : '✅ Closed Polygon') 
                  : (isTe ? '⚠️ కనీసం 3 పిన్స్ అవసరం' : '⚠️ Need at least 3 points')}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopySummary}
            className="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? (isTe ? 'కాపీ అయింది!' : 'Copied!') : (isTe ? 'కొలతల వివరాలు కాపీ చేయి' : 'Copy Area Summary')}</span>
          </button>
        </div>

        {/* Crop Input Planning based on Area */}
        <div className="lg:col-span-2 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                {isTe ? 'విస్తీర్ణ ఆధారిత వ్యవసాయ ప్రణాళిక (Input Calculator)' : 'Area-Based Farm Inputs Estimator'}
              </h3>
            </div>

            {/* Crop Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-bold">{isTe ? 'పంట:' : 'Crop:'}</span>
              <select
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
                className="px-2.5 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer outline-none"
              >
                <option value="Tomato">🍅 Tomato (టమాటా)</option>
                <option value="Paddy">🌾 Paddy / Rice (వరి)</option>
                <option value="Cotton">🌱 Cotton (ప్రత్తి)</option>
                <option value="Chili">🌶️ Chili (మిర్చి)</option>
                <option value="Maize">🌽 Maize (మొక్కజొన్న)</option>
                <option value="Groundnut">🥜 Groundnut (వేరుశనగ)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {/* 1. Seeds */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">{isTe ? 'విత్తనాల అవసరం' : 'Seeds Needed'}</p>
              <p className="text-sm font-black text-slate-900 dark:text-white mt-1">{inputEstimates.seeds}</p>
              <span className="text-[10px] text-emerald-600 font-semibold">{selectedCrop} rate</span>
            </div>

            {/* 2. 16L Spray Pumps */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">{isTe ? '16L స్ప్రే పంపులు' : '16L Spray Pumps'}</p>
              <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1">~{inputEstimates.pumps} {isTe ? 'పంపులు' : 'pumps'}</p>
              <span className="text-[10px] text-slate-400 font-semibold">16L knapsack</span>
            </div>

            {/* 3. Water Volume */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">{isTe ? 'నీటి పరిమాణం' : 'Water Volume'}</p>
              <p className="text-sm font-black text-sky-600 dark:text-sky-400 mt-1">{inputEstimates.water}</p>
              <span className="text-[10px] text-slate-400 font-semibold">Per irrigation cycle</span>
            </div>

            {/* 4. Fertilizer */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-400 uppercase">{isTe ? 'యూరియా మోతాదు' : 'Urea Basal'}</p>
              <p className="text-sm font-black text-amber-600 dark:text-amber-400 mt-1">{inputEstimates.urea}</p>
              <span className="text-[10px] text-slate-400 font-semibold">Basal dressing</span>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>
              {isTe
                ? 'గమనిక: మీ పొలం విస్తీర్ణాన్ని బట్టి ఎరువులు, విత్తనాలు మరియు స్ప్రే మోతాదులను ఖచ్చితంగా వాడటం వల్ల ఖర్చులు 30% వరకు ఆదా అవుతాయి.'
                : 'Pro Tip: Calibrating pesticide dilutions and seeds precisely against measured field acreage saves up to 30% on farming inputs.'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
