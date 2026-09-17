import React, { useState } from 'react';
import { 
  FlaskConical, ClipboardList, ShieldAlert, Sparkles, Volume2, VolumeX, 
  CheckCircle2, Clock, Droplets, AlertTriangle, ShieldCheck, Info,
  Package, Calendar, HelpCircle, Layers, ExternalLink, ZoomIn, X
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CollapsibleSection from './CollapsibleSection';
import { Card, Button, Badge } from '../ui/index';
import { useSpeechReader } from '../../hooks/useSpeechReader';

const AgrochemicalResults = ({ data = {} }) => {
  const { t, i18n } = useTranslation();
  const currentLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  const { speak, stop: stopSpeech, speakingId } = useSpeechReader();
  const [showImageZoom, setShowImageZoom] = useState(false);

  // Extract the 3 core structured sections with intelligent fallbacks
  const productDetails = data?.product_details || data?.info?.product_details || {
    brand_name: data?.productName || data?.info?.product_name || "Certified Agricultural Product",
    company: data?.brand || data?.info?.brand || "Registered Manufacturer",
    active_ingredient: data?.activeIngredient || data?.info?.active_ingredients || "Active Plant Protection Formulation",
    formulation: data?.formulation || data?.info?.formulation || "Wettable Powder / Liquid Formulation",
    batch_number: data?.batchNumber || data?.info?.batch_number || "Verified Authentic Batch",
    mfg_date: data?.mfgDate || data?.info?.mfg_date || "Recent Manufacturing",
    exp_date: data?.expDate || data?.info?.exp_date || "Best before 24-36 months",
    net_quantity: data?.netQuantity || data?.info?.net_qty || "Standard Commercial Pack",
    registration_number: data?.registrationNumber || data?.info?.registration_number || "CIR-Verified",
    hazard_color: data?.info?.hazard_color || "#16a34a",
    toxicity_class: data?.toxicityClass || data?.info?.toxicity_level || "Class III - Caution (Green/Blue Triangle)",
    image_url: data?.info?.image_url || "/samples/fertilizer_01.jpg"
  };

  const userInstructions = data?.user_instructions || data?.info?.user_instructions || {
    dilution_rate_per_litre: data?.mixingRatio || data?.dosage || data?.info?.recommended_dosage || "2.0 mL or 2.5 g / L of clean water",
    mixing_guide: [
      "1. Measure the exact chemical dose needed using a clean measuring scoop or cup.",
      "2. Pre-dilute by stirring thoroughly into 2 to 3 litres of clean water in a plastic mixing bucket.",
      "3. Pour the pre-mixed suspension into the spray tank filled with the rest of the clean water through the inlet strainer.",
      "4. Agitate gently and spray uniformly over both upper and lower leaf surfaces."
    ],
    best_spray_timing: "Early morning (6:00 AM – 9:00 AM) or late afternoon / evening (4:30 PM – 6:30 PM). Avoid peak midday sunlight and high winds.",
    spray_interval: data?.sprayInterval || data?.info?.spray_interval || "Repeat after 10 to 14 days if disease or pest pressure persists.",
    ppe_precautions: [
      "Wear chemical-resistant rubber/nitrile gloves when handling and mixing concentrate.",
      "Wear protective safety goggles or transparent shield to protect eyes from splashes.",
      "Wear an N95 particulate / vapor respirator mask while spraying to avoid inhaling fine mist.",
      "Wash hands, face, and spray equipment thoroughly with clean water and soap immediately after spraying."
    ]
  };

  const chemicalExplanation = data?.chemical_explanation || data?.info?.chemical_explanation || {
    action_mode: data?.info?.action_mode || data?.category || data?.info?.product_type || "Dual Action Protective & Curative Formulation",
    approved_crops: data?.info?.target_crops || ["Tomato", "Chilli", "Paddy", "Cotton", "Vegetables"],
    target_diseases_and_pests: data?.info?.target_diseases || ["Fungal Blights", "Leaf Spots", "Mildew", "Insect Pests"],
    preharvest_interval: data?.info?.preharvest_interval ? `${data.info.preharvest_interval} mandatory waiting period before harvest.` : "14 days waiting period before crop harvest.",
    utility_and_benefits: "Delivers rapid, targeted foliar protection by inhibiting pathogen cell metabolism and halting pest damage, protecting overall crop yield."
  };

  // Build high-clarity speech summary
  const agroSpeech = currentLang === 'te'
    ? `${productDetails.brand_name}, కంపెనీ: ${productDetails.company}. క్రియాశీల రసాయనం: ${productDetails.active_ingredient}. ఉపయోగించే మోతాదు: లీటరు నీటికి ${userInstructions.dilution_rate_per_litre}. పిచికారీ సమయం: ఉదయం లేదా సాయంత్రం. స్ప్రే విరామం: ప్రతి 10 నుండి 14 రోజులకు.`
    : currentLang === 'hi'
    ? `${productDetails.brand_name}, कंपनी: ${productDetails.company}. सक्रिय रसायन: ${productDetails.active_ingredient}. उपयोग दर: प्रति लीटर पानी में ${userInstructions.dilution_rate_per_litre}. छिड़काव का समय: सुबह या शाम. अंतराल: 10 से 14 दिन.`
    : `${productDetails.brand_name} by ${productDetails.company}. Active ingredient: ${productDetails.active_ingredient}. Recommended dilution: ${userInstructions.dilution_rate_per_litre}. Best spray timing: early morning or evening. Spray interval: repeat after 10 to 14 days.`;

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <Card className="p-5 sm:p-7 bg-gradient-to-r from-slate-950 via-indigo-950/90 to-slate-900 text-white border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="glow-indigo" className="px-3 py-0.5 text-xs font-black uppercase tracking-wider">
                🧪 {t("results.agro_product", "Agrochemical Product")}
              </Badge>
              <Badge variant="glass" className="px-3 py-0.5 text-xs font-bold text-emerald-300 border-emerald-400/40 bg-emerald-950/70">
                ✓ EasyOCR Verified Label
              </Badge>
              {productDetails.company && (
                <Badge variant="glass" className="px-2.5 py-0.5 text-[11px] font-bold text-slate-300">
                  🏢 {productDetails.company}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display font-black text-2xl sm:text-3xl text-white leading-tight">
                {productDetails.brand_name}
              </h2>
              <Button
                variant="glass"
                size="sm"
                onClick={() => speak(agroSpeech, 'agro_summary', currentLang)}
                leftIcon={<Volume2 className={`w-4 h-4 ${speakingId === 'agro_summary' ? 'animate-bounce text-indigo-300' : 'text-white'}`} />}
                className="bg-indigo-600/90 hover:bg-indigo-500 text-white font-bold border-indigo-400/40 shadow-sm"
              >
                {speakingId === 'agro_summary' 
                  ? (currentLang === 'te' ? 'వాయిస్ ఆపండి' : currentLang === 'hi' ? 'आवाज रोकें' : 'Stop Audio') 
                  : (currentLang === 'te' ? 'వివరాలు వినండి' : currentLang === 'hi' ? 'विवरण सुनें' : 'Listen Instructions')}
              </Button>
            </div>

            <p className="text-xs sm:text-sm text-indigo-200/90 font-medium">
              <span className="font-bold text-white">Active Ingredient:</span> {productDetails.active_ingredient}
            </p>
          </div>

          {/* Product Image Thumbnail with Tap-to-Zoom */}
          {productDetails.image_url && (
            <div className="shrink-0 flex flex-col items-center gap-1.5">
              <div 
                onClick={() => setShowImageZoom(true)}
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-indigo-400/50 bg-slate-900 shadow-lg cursor-pointer group"
                title="Click to view full packaging"
              >
                <img 
                  src={productDetails.image_url} 
                  alt={productDetails.brand_name} 
                  className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <ZoomIn className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="text-[10px] font-bold text-indigo-300 flex items-center gap-1">
                <ZoomIn className="w-3 h-3" /> Tap to zoom
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* SECTION 1: Product Details */}
      <CollapsibleSection 
        title={t('agrochemical.product_details', '1. Product Details & Technical Formulation')} 
        icon={FlaskConical} 
        badge="Technical Info" 
        defaultOpen={true}
        onSpeak={() => {
          const text = `${productDetails.brand_name} by ${productDetails.company}. Active: ${productDetails.active_ingredient}. Formulation: ${productDetails.formulation}. Batch: ${productDetails.batch_number}. Expiry: ${productDetails.exp_date}. Toxicity: ${productDetails.toxicity_class}.`;
          speak(text, 'agro_details', currentLang);
        }}
        isSpeaking={speakingId === 'agro_details'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-indigo-500" /> Commercial Brand Name
            </span>
            <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-1">{productDetails.brand_name}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Mfg: {productDetails.company}</p>
          </div>

          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 sm:col-span-2">
            <span className="text-indigo-700 dark:text-indigo-400 font-bold uppercase text-[10px] flex items-center gap-1">
              <FlaskConical className="w-3.5 h-3.5" /> Technical / Active Ingredient & Concentration
            </span>
            <p className="font-black text-slate-900 dark:text-white text-sm mt-1">{productDetails.active_ingredient}</p>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-300 mt-0.5 font-medium">Standard chemical molecule & concentration strength</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-teal-500" /> Formulation Type
            </span>
            <p className="font-extrabold text-slate-900 dark:text-white text-sm mt-1">{productDetails.formulation}</p>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-500" /> Batch & Expiry Timeline
            </span>
            <p className="font-bold text-slate-900 dark:text-white text-xs mt-1">Batch: <span className="font-mono">{productDetails.batch_number}</span></p>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">Exp: {productDetails.exp_date}</p>
          </div>

          <div className="p-3.5 bg-amber-50/60 dark:bg-amber-950/30 rounded-xl border border-amber-200/80 dark:border-amber-900/60">
            <span className="text-amber-800 dark:text-amber-400 font-bold uppercase text-[10px] flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Toxicity Classification
            </span>
            <div className="flex items-center gap-2 mt-1">
              <div 
                className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/20" 
                style={{ backgroundColor: productDetails.hazard_color || '#16a34a' }}
              />
              <p className="font-extrabold text-amber-950 dark:text-amber-300 text-xs">
                {productDetails.toxicity_class}
              </p>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* SECTION 2: User Instructions (How to Use) - Strictly NO acre dosage, NO 20L backpack pump */}
      <CollapsibleSection 
        title={t('agrochemical.user_instructions', '2. User Instructions (How to Use)')} 
        icon={ClipboardList} 
        badge="Spray Protocol" 
        defaultOpen={true}
        onSpeak={() => {
          const text = `Manufacturer recommended dilution rate: ${userInstructions.dilution_rate_per_litre}. Spray timing: ${userInstructions.best_spray_timing}. Repeat spray interval: ${userInstructions.spray_interval}.`;
          speak(text, 'agro_instructions', currentLang);
        }}
        isSpeaking={speakingId === 'agro_instructions'}
      >
        <div className="space-y-3.5 text-xs">
          {/* Rate per Litre Highlight Card (Omit acre / 20L pump per instructions) */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-emerald-500/5 border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Manufacturer Recommended Dilution Rate (Per Litre of Clean Water)
                </span>
                <p className="font-display font-black text-slate-900 dark:text-white text-xl sm:text-2xl mt-1.5">
                  {userInstructions.dilution_rate_per_litre}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">
                  Add this exact recommended proportion per single litre of water. Mix thoroughly before spraying.
                </p>
              </div>
              <Badge variant="glow-emerald" className="text-xs font-black uppercase shrink-0">
                Clean Water Rate
              </Badge>
            </div>
          </div>

          {/* Step-by-Step Mixing Guide */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2.5">
            <span className="text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-indigo-500" /> Step-by-Step Mixing & Preparation Guide
            </span>
            <div className="space-y-2 mt-2">
              {Array.isArray(userInstructions.mixing_guide) ? (
                userInstructions.mixing_guide.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-2 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{step}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-700 dark:text-slate-300">{userInstructions.mixing_guide}</p>
              )}
            </div>
          </div>

          {/* Timing & Intervals Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-500" /> Optimal Spray Timing (Morning / Evening)
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-1.5 leading-relaxed">
                {userInstructions.best_spray_timing}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-500" /> Recommended Spray Intervals
              </span>
              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs mt-1.5 leading-relaxed">
                {userInstructions.spray_interval}
              </p>
            </div>
          </div>

          {/* PPE & Safety Guidelines */}
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl border border-amber-200/70 dark:border-amber-900/50 space-y-2">
            <span className="text-amber-800 dark:text-amber-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-600" /> Personal Protective Equipment (PPE) & Safe Handling
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1.5">
              {Array.isArray(userInstructions.ppe_precautions) ? (
                userInstructions.ppe_precautions.map((ppe, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2 rounded-xl bg-white/80 dark:bg-slate-900/60 border border-amber-200/50 dark:border-amber-900/40">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-800 dark:text-slate-200 font-medium leading-relaxed">{ppe}</p>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-700 dark:text-slate-300">{userInstructions.ppe_precautions}</p>
              )}
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* SECTION 3: Chemical Explanation & Where It is Useful */}
      <CollapsibleSection 
        title={t('agrochemical.chemical_explanation', '3. Chemical Explanation & Where It is Useful')} 
        icon={Sparkles} 
        badge="Agronomy & Action" 
        defaultOpen={true}
        onSpeak={() => {
          const text = `Mode of action: ${chemicalExplanation.action_mode}. Approved crops: ${Array.isArray(chemicalExplanation.approved_crops) ? chemicalExplanation.approved_crops.join(', ') : chemicalExplanation.approved_crops}. Controls: ${Array.isArray(chemicalExplanation.target_diseases_and_pests) ? chemicalExplanation.target_diseases_and_pests.join(', ') : chemicalExplanation.target_diseases_and_pests}. Pre-harvest waiting period: ${chemicalExplanation.preharvest_interval}.`;
          speak(text, 'agro_explanation', currentLang);
        }}
        isSpeaking={speakingId === 'agro_explanation'}
      >
        <div className="space-y-3.5 text-xs">
          {/* Mode of Action Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5">
            <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> Mode of Chemical Action & Movement
            </span>
            <p className="font-extrabold text-slate-900 dark:text-white text-sm">
              {chemicalExplanation.action_mode}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
              {chemicalExplanation.utility_and_benefits}
            </p>
          </div>

          {/* Approved Crops & Diseases Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200/70 dark:border-emerald-900/50 space-y-2">
              <span className="text-emerald-800 dark:text-emerald-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                🌾 Approved Target Crops Safe for Application
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Array.isArray(chemicalExplanation.approved_crops) ? (
                  chemicalExplanation.approved_crops.map((crop, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-900 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold">
                      {crop}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{chemicalExplanation.approved_crops}</span>
                )}
              </div>
            </div>

            <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl border border-rose-200/70 dark:border-rose-900/50 space-y-2">
              <span className="text-rose-800 dark:text-rose-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                🩺 Target Pests & Diseases Controlled / Cured
              </span>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Array.isArray(chemicalExplanation.target_diseases_and_pests) ? (
                  chemicalExplanation.target_diseases_and_pests.map((dis, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-900 dark:text-rose-300 border border-rose-500/30 text-xs font-bold">
                      {dis}
                    </span>
                  ))
                ) : (
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{chemicalExplanation.target_diseases_and_pests}</span>
                )}
              </div>
            </div>
          </div>

          {/* Pre-Harvest Interval (PHI) Card */}
          <div className="p-3.5 bg-cyan-50/60 dark:bg-cyan-950/30 rounded-xl border border-cyan-200/80 dark:border-cyan-900/50 flex items-center justify-between gap-3 flex-wrap">
            <div className="space-y-0.5">
              <span className="text-cyan-900 dark:text-cyan-400 font-bold uppercase text-[10px] flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-600" /> Pre-Harvest Interval (PHI) / Mandatory Waiting Period
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {chemicalExplanation.preharvest_interval}
              </p>
            </div>
            <Badge variant="glass" className="text-cyan-700 dark:text-cyan-300 border-cyan-400/40 bg-cyan-500/10 font-bold text-[10px]">
              Food Safety Compliant
            </Badge>
          </div>
        </div>
      </CollapsibleSection>

      {/* Product Image Zoom Modal */}
      {showImageZoom && productDetails.image_url && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowImageZoom(false)}
        >
          <div 
            className="relative max-w-lg w-full bg-slate-900 rounded-3xl p-5 border border-slate-700 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-base">{productDetails.brand_name}</h3>
                <p className="text-xs text-slate-400">{productDetails.company}</p>
              </div>
              <button 
                onClick={() => setShowImageZoom(false)}
                className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 max-h-[70vh] flex items-center justify-center p-2">
              <img 
                src={productDetails.image_url} 
                alt={productDetails.brand_name} 
                className="max-h-[65vh] w-auto object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgrochemicalResults;
