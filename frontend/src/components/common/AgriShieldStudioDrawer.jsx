import React, { useState } from 'react';
import { 
  Sliders, MoveUp, MoveDown, Eye, EyeOff, Sparkles, Wand2, 
  RotateCcw, Save, ShieldCheck, CheckCircle2, UserCheck, X, 
  Layers, FlaskConical, Stethoscope, Sprout, Network, Cpu, 
  ArrowRight, Check, AlertCircle, Info, ChevronRight, HelpCircle,
  Minimize2, Maximize2, Shield, Settings2
} from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { Card, Button, Badge } from '../ui/index';

const TAB_OPTIONS = [
  { id: 'editor', label: '50/50 Human Editor', icon: UserCheck, desc: 'Live diagnosis, dosages & agronomist sign-off' },
  { id: 'layout', label: 'Card Layout & Order', icon: Layers, desc: 'Reorder cards & toggle visibility' },
  { id: 'effects', label: 'Effects Lab', icon: Sparkles, desc: 'Spotlight dimming, slide & glow effects' },
  { id: 'map', label: 'Architecture Map', icon: Network, desc: 'Interactive system workflow & data flow' }
];

const PAGE_CONTEXTS = [
  { id: 'disease-diag', label: 'AI Crop Disease Diagnosis', icon: Stethoscope },
  { id: 'plant-id', label: 'Plant & Weed Identification', icon: Sprout },
  { id: 'agro-scan', label: 'Agrochemical OCR Scanner', icon: FlaskConical },
  { id: 'dashboard', label: 'Farm Dashboard', icon: Layers }
];

const ARCHITECTURE_NODES = [
  {
    id: 'input',
    title: '1. Leaf & Container Image Input',
    type: 'Hardware & Client',
    icon: '📸',
    color: 'border-blue-500/40 bg-blue-950/40 text-blue-300',
    dataOut: 'High-Res RGB Bitmap / Compressed WebP Canvas (<300KB)',
    connectedTo: ['ai_engine'],
    desc: 'Farmer takes a field photo or uploads a pesticide bottle. Preprocessed and compressed client-side in 80ms.'
  },
  {
    id: 'ai_engine',
    title: '2. Dual-AI Diagnostic Engine (50% AI)',
    type: 'Automated Intelligence',
    icon: '🤖',
    color: 'border-purple-500/40 bg-purple-950/40 text-purple-300',
    dataIn: 'Normalized 224x224 Leaf Tensor / Base64 Packaging',
    dataOut: 'Top-1 Disease Class, Neural Heatmap, Raw Confidence (98.4%)',
    connectedTo: ['human_hitl', 'iot_telemetry'],
    desc: 'Local PyTorch ResNet-50 classifies leaf pathology. If confidence is ambiguous, Google Gemini 2.5/Flash performs multimodal consensus.'
  },
  {
    id: 'human_hitl',
    title: '3. Certified Human Agronomist Review (50% Human)',
    type: 'Clinical Expert Sign-Off',
    icon: '👨‍🌾',
    color: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-300 ring-2 ring-emerald-500/30',
    dataIn: 'AI Provisional Diagnosis & Automated Chemical Advice',
    dataOut: 'Calibrated 1L Dilution Rate, Field Notes, Official Seal & Stamp',
    connectedTo: ['prescription_pdf', 'agrochemical_link'],
    desc: 'The user, professor, or certified agronomist inspects the AI finding, adjusts dosages to match local soil conditions, and applies an authentic accreditation seal.'
  },
  {
    id: 'iot_telemetry',
    title: '4. ESP32 Sensor Telemetry & Weather',
    type: 'Edge IoT Infrastructure',
    icon: '📡',
    color: 'border-cyan-500/40 bg-cyan-950/40 text-cyan-300',
    dataOut: 'Soil Moisture %, Canopy Ambient Temp, Relative Humidity',
    connectedTo: ['analytics_risk'],
    desc: 'In-field hardware nodes broadcast environmental metrics every 5 seconds, validating if fungal spore germination thresholds are active.'
  },
  {
    id: 'agrochemical_link',
    title: '5. Agrochemical Verification & Safety',
    type: 'OCR Label Analysis',
    icon: '🧪',
    color: 'border-amber-500/40 bg-amber-950/40 text-amber-300',
    dataIn: 'Diagnosed Pathogen Name & Prescribed Chemical Molecule',
    dataOut: 'Verified Commercial Brand, CIBRC Reg, 1L Dilution & PPE Grid',
    connectedTo: ['prescription_pdf'],
    desc: 'Connects diagnosed diseases directly to certified Indian agricultural products (Mancozeb, Saaf, Contaf Plus, IFFCO Nano DAP).'
  },
  {
    id: 'prescription_pdf',
    title: '6. Dual-Certified Clinical Prescription Slip',
    type: 'Final Output Document',
    icon: '📋',
    color: 'border-emerald-400/50 bg-emerald-950/60 text-emerald-200',
    dataIn: 'Pillar 1: 50% AI Neural Scores | Pillar 2: 50% Human Agronomist Stamp',
    desc: 'Generates an official printable PDF prescription combining neural network metrics and the professor’s / agronomist’s verified signature.'
  }
];

const AgriShieldStudioDrawer = () => {
  const {
    isDrawerOpen,
    closeDrawer,
    openDrawer,
    activeDrawerTab,
    setActiveDrawerTab,
    activePageTab,
    setActivePageTab,
    cardOrders,
    moveCard,
    toggleCardVisibility,
    resetTabOrder,
    cardOverrides,
    setCardOverride,
    clearCardOverrides,
    effectsConfig,
    updateEffectsConfig,
    agronomistProfile,
    updateAgronomistProfile,
    resetAllToDefaults
  } = useStudio();

  const [selectedNode, setSelectedNode] = useState(ARCHITECTURE_NODES[2]); // Default to Human HITL node
  const [saveToast, setSaveToast] = useState(false);

  const currentTabCardList = cardOrders[activePageTab] || [];

  // Temporary local state for editor tab inputs
  const currentOverrides = cardOverrides[activePageTab] || {};

  const handleSaveEditor = () => {
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  return (
    <>
      {/* Persistent Floating Studio Controller Button */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 print:hidden">
        <button
          onClick={() => openDrawer('editor', activePageTab)}
          className="group relative flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 text-white font-extrabold text-xs sm:text-sm shadow-2xl shadow-emerald-950/60 border border-emerald-400/40 hover:scale-105 active:scale-95 transition-all cursor-pointer backdrop-blur-md"
          title="Open AgriShield Studio: 50% AI + 50% Human Agronomist Editor & Visual Customizer"
        >
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-300"></span>
          </span>
          <Sliders className="w-4 h-4 text-emerald-200 group-hover:rotate-45 transition-transform" />
          <span className="tracking-wide">AgriShield Studio</span>
          <span className="hidden md:inline px-2 py-0.5 rounded-full bg-black/30 border border-white/20 text-[10px] font-mono text-emerald-200">
            50% AI + 50% Human
          </span>
        </button>
      </div>

      {/* Slide-out Off-Canvas Studio Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-300 print:hidden">
          <div 
            className="w-full max-w-2xl bg-slate-950 text-white h-full shadow-2xl border-l border-emerald-500/30 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 shadow-md">
                  <Sliders className="w-5 h-5 font-black" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                    AgriShield Studio
                    <Badge variant="glow-emerald" className="text-[10px] font-bold">
                      50% AI + 50% Human
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Live In-Website Editor, Card Reordering, Visual Effects & Architecture Map
                  </p>
                </div>
              </div>

              <button
                onClick={closeDrawer}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-4 p-2 bg-slate-900/90 border-b border-slate-800 text-xs shrink-0">
              {TAB_OPTIONS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeDrawerTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveDrawerTab(tab.id)}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl font-bold transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-gradient-to-b from-emerald-500/20 to-teal-500/10 text-emerald-300 border border-emerald-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="text-[11px] text-center line-clamp-1">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Context Selector Bar (Shows active page tab) */}
            {activeDrawerTab !== 'map' && (
              <div className="px-4 py-2.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-emerald-400" /> Active Tab:
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {PAGE_CONTEXTS.map(ctx => {
                    const Icon = ctx.icon;
                    const isSelected = activePageTab === ctx.id;
                    return (
                      <button
                        key={ctx.id}
                        onClick={() => setActivePageTab(ctx.id)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 shadow-sm shadow-emerald-500/20'
                            : 'bg-slate-800/70 hover:bg-slate-700/80 text-slate-300 border border-slate-700/60'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{ctx.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Main Drawer Body Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              
              {/* TAB 1: 50% AI + 50% HUMAN AGRONOMIST EDITOR */}
              {activeDrawerTab === 'editor' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  {/* Banner explaining 50/50 Human-in-the-Loop */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/70 via-slate-900 to-indigo-950/70 border border-emerald-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> Collaborative Agronomic Intelligence
                      </span>
                      <Badge variant="glow-emerald" className="text-[10px]">
                        50% AI + 50% Human
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      AI handles the rapid provisional pattern recognition. Certified human agronomists, professors, and farm managers review the results, calibrate dilution rates, and authorize clinical treatment prescriptions before field application.
                    </p>
                  </div>

                  {/* Certified Agronomist Credentials Box */}
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-emerald-400" /> Human Agronomist / Reviewer Credentials
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Reviewer / Professor Name</label>
                        <input
                          type="text"
                          value={agronomistProfile.name}
                          onChange={(e) => updateAgronomistProfile({ name: e.target.value })}
                          placeholder="e.g. Prof. Dr. K. Ramesh, Ph.D."
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Professional Title</label>
                        <input
                          type="text"
                          value={agronomistProfile.title}
                          onChange={(e) => updateAgronomistProfile({ title: e.target.value })}
                          placeholder="e.g. Senior Agronomist & ICAR Reviewer"
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">University / Organization</label>
                        <input
                          type="text"
                          value={agronomistProfile.institution}
                          onChange={(e) => updateAgronomistProfile({ institution: e.target.value })}
                          placeholder="e.g. State Agricultural University & ICAR-KVK"
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">Accreditation / Registration No.</label>
                        <input
                          type="text"
                          value={agronomistProfile.certId}
                          onChange={(e) => updateAgronomistProfile({ certId: e.target.value })}
                          placeholder="e.g. ICAR-AP-AGR-2026-8841"
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Diagnostic Content Overrides Form */}
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Wand2 className="w-4 h-4 text-indigo-400" /> Live Content Override for {PAGE_CONTEXTS.find(c => c.id === activePageTab)?.label}
                      </h3>
                      <button
                        onClick={() => clearCardOverrides(activePageTab)}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Reset Page Overrides
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      {/* Crop / Botanical Subject */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Diagnosed Crop / Specimen Name (Override)
                        </label>
                        <input
                          type="text"
                          value={currentOverrides.crop_name || ''}
                          onChange={(e) => setCardOverride(activePageTab, 'crop_name', e.target.value)}
                          placeholder="Default: Automated AI Crop Detection"
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>

                      {/* Disease / Product Name */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Pathology Condition / Disease Name (Override)
                        </label>
                        <input
                          type="text"
                          value={currentOverrides.disease_name || ''}
                          onChange={(e) => setCardOverride(activePageTab, 'disease_name', e.target.value)}
                          placeholder="Default: Automated AI Pathogen Diagnosis"
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>

                      {/* Chemical Prescription & Exact 1L Dilution */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Calibrated Chemical Prescription & 1L Dilution Rate (Override)
                        </label>
                        <input
                          type="text"
                          value={currentOverrides.chemical_treatment || ''}
                          onChange={(e) => setCardOverride(activePageTab, 'chemical_treatment', e.target.value)}
                          placeholder="e.g. Mancozeb 75% WP @ 2.0 g / L of clean water or Saaf @ 1.5 g / L"
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold focus:outline-none focus:border-emerald-500 text-xs"
                        />
                      </div>

                      {/* Organic / Cultural Treatment */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Organic Remedies & Botanical Cultural Practices (Override)
                        </label>
                        <textarea
                          rows={2}
                          value={currentOverrides.organic_treatment || ''}
                          onChange={(e) => setCardOverride(activePageTab, 'organic_treatment', e.target.value)}
                          placeholder="e.g. Spray 5% Neem Seed Kernel Extract (NSKE) or Trichoderma viride @ 5g/L."
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-emerald-500 text-xs leading-relaxed"
                        />
                      </div>

                      {/* Agronomist Field Notes */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-400 mb-1">
                          Agronomist Clinical Field Notes & Farmer Instructions
                        </label>
                        <textarea
                          rows={2}
                          value={currentOverrides.agronomist_notes || ''}
                          onChange={(e) => setCardOverride(activePageTab, 'agronomist_notes', e.target.value)}
                          placeholder="e.g. Verified by Dr. Ramesh. Avoid spraying if rain is expected within 3 hours. Repeat after 12 days."
                          className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white font-medium focus:outline-none focus:border-emerald-500 text-xs leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <Button
                        onClick={handleSaveEditor}
                        leftIcon={<Save className="w-4 h-4" />}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/50"
                      >
                        {saveToast ? '✓ Saved & Applied to Live Site' : '💾 Save & Certify Human Override'}
                      </Button>

                      {saveToast && (
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 animate-pulse">
                          <CheckCircle2 className="w-4 h-4" /> Live site updated!
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: CARD LAYOUT & ORDER MANAGER */}
              {activeDrawerTab === 'layout' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-indigo-400" /> Card Arrangement for {PAGE_CONTEXTS.find(c => c.id === activePageTab)?.label}
                      </h3>
                      <button
                        onClick={() => resetTabOrder(activePageTab)}
                        className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Default Order
                      </button>
                    </div>
                    <p className="text-xs text-slate-400">
                      Use the Up and Down buttons to change the order cards appear on the page. Use the eye icon to show or hide any card.
                    </p>
                  </div>

                  {/* Card Ordering List */}
                  <div className="space-y-2.5">
                    {currentTabCardList.map((card, idx) => (
                      <div 
                        key={card.key}
                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          card.visible 
                            ? 'bg-slate-900/90 border-slate-800 text-white shadow-md' 
                            : 'bg-slate-950 border-slate-900 text-slate-500 opacity-60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-slate-800 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-extrabold text-slate-200">{card.label}</p>
                            <p className="text-[10px] font-mono text-slate-500">ID: {card.key}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Move Up */}
                          <button
                            onClick={() => moveCard(activePageTab, card.key, 'up')}
                            disabled={idx === 0}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors"
                            title="Move Card Up"
                          >
                            <MoveUp className="w-3.5 h-3.5" />
                          </button>

                          {/* Move Down */}
                          <button
                            onClick={() => moveCard(activePageTab, card.key, 'down')}
                            disabled={idx === currentTabCardList.length - 1}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 transition-colors"
                            title="Move Card Down"
                          >
                            <MoveDown className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Visibility */}
                          <button
                            onClick={() => toggleCardVisibility(activePageTab, card.key)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              card.visible 
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' 
                                : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                            }`}
                            title={card.visible ? "Hide Card" : "Show Card"}
                          >
                            {card.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: VISUAL & ANIMATION EFFECTS LAB */}
              {activeDrawerTab === 'effects' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                    <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" /> Interactive Visual & Animation Controls
                    </h3>
                    <p className="text-xs text-slate-400">
                      Fine-tune aesthetic spotlight dimming, smooth sliding transitions, and ambient luminescence across all cards.
                    </p>
                  </div>

                  {/* Effects Toggles */}
                  <div className="space-y-3">
                    {/* Spotlight Dim Effect */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <span>💡</span> Spotlight Dimming Effect
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Hovering or focusing on any card dims background cards by 40%, spotlighting the active card with glassmorphism and green edge glow.
                        </p>
                      </div>
                      <button
                        onClick={() => updateEffectsConfig({ spotlightDim: !effectsConfig.spotlightDim })}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                          effectsConfig.spotlightDim ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          effectsConfig.spotlightDim ? 'right-1' : 'left-1'
                        }`} />
                      </button>
                    </div>

                    {/* Sliding Entrance Transitions */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <span>🎞️</span> Sliding Card Entrance Animations
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Applies smooth directional slide-in animations when cards load or when switching tabs.
                        </p>
                      </div>
                      <button
                        onClick={() => updateEffectsConfig({ slidingEffects: !effectsConfig.slidingEffects })}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                          effectsConfig.slidingEffects ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          effectsConfig.slidingEffects ? 'right-1' : 'left-1'
                        }`} />
                      </button>
                    </div>

                    {/* Ambient Card Glow */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <span>✨</span> Radiant Glassmorphism & Edge Luminescence
                        </p>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Adds aesthetic ambient borders, neon drop-shadows, and modern frosted glass textures to all cards.
                        </p>
                      </div>
                      <button
                        onClick={() => updateEffectsConfig({ cardGlow: !effectsConfig.cardGlow })}
                        className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                          effectsConfig.cardGlow ? 'bg-emerald-500' : 'bg-slate-700'
                        }`}
                      >
                        <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                          effectsConfig.cardGlow ? 'right-1' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Live Playground Box */}
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Interactive Live Effects Preview (Hover over cards below):
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className={`p-4 rounded-xl bg-slate-900 border border-slate-800 transition-all cursor-pointer ${
                        effectsConfig.spotlightDim ? 'hover:scale-105 hover:border-emerald-400/80 hover:shadow-xl hover:shadow-emerald-500/20' : ''
                      }`}>
                        <p className="text-xs font-bold text-emerald-400">Card A (Preview)</p>
                        <p className="text-[11px] text-slate-400 mt-1">Hover over me to see spotlight focus.</p>
                      </div>
                      <div className={`p-4 rounded-xl bg-slate-900 border border-slate-800 transition-all cursor-pointer ${
                        effectsConfig.spotlightDim ? 'hover:scale-105 hover:border-indigo-400/80 hover:shadow-xl hover:shadow-indigo-500/20' : ''
                      }`}>
                        <p className="text-xs font-bold text-indigo-400">Card B (Preview)</p>
                        <p className="text-[11px] text-slate-400 mt-1">Watch other cards respond smoothly.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: INTERACTIVE ARCHITECTURE & DATA FLOW MAP */}
              {activeDrawerTab === 'map' && (
                <div className="space-y-5 animate-in fade-in duration-200">
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Network className="w-4 h-4 text-emerald-400" /> AgriShield System Architecture & Data Flow
                      </h3>
                      <Badge variant="glass" className="text-[10px] text-indigo-300">
                        Interactive Inspector
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-medium">
                      Demonstrates to evaluators and professors how leaf camera scans, deep learning neural networks, IoT telemetry, human agronomists, and agrochemical records interconnect in real time.
                    </p>
                  </div>

                  {/* Clickable Pipeline Nodes */}
                  <div className="space-y-2.5">
                    {ARCHITECTURE_NODES.map(node => {
                      const isSelected = selectedNode?.id === node.id;
                      return (
                        <div
                          key={node.id}
                          onClick={() => setSelectedNode(node)}
                          className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                            isSelected 
                              ? `${node.color} scale-[1.01] shadow-lg` 
                              : 'bg-slate-900/70 border-slate-800/80 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg">{node.icon}</span>
                              <div>
                                <p className="text-xs font-extrabold text-white">{node.title}</p>
                                <p className="text-[10px] text-slate-400 font-medium">{node.type}</p>
                              </div>
                            </div>
                            <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'rotate-90 text-white' : 'text-slate-500'}`} />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inspector Panel for Selected Node */}
                  {selectedNode && (
                    <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 shadow-xl space-y-3 animate-in fade-in duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                          <span>{selectedNode.icon}</span> {selectedNode.title}
                        </span>
                        <Badge variant="glass" className="text-[10px] font-bold text-slate-300">
                          {selectedNode.type}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-200 font-medium leading-relaxed">
                        {selectedNode.desc}
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                        {selectedNode.dataIn && (
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-slate-500 block mb-0.5">Input Data:</span>
                            <span className="font-mono text-slate-300">{selectedNode.dataIn}</span>
                          </div>
                        )}
                        {selectedNode.dataOut && (
                          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                            <span className="text-[10px] font-bold uppercase text-emerald-400 block mb-0.5">Output Data:</span>
                            <span className="font-mono text-emerald-300">{selectedNode.dataOut}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between shrink-0">
              <button
                onClick={resetAllToDefaults}
                className="text-xs font-bold text-slate-500 hover:text-rose-400 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset All Studio Settings
              </button>

              <Button
                variant="glass"
                size="sm"
                onClick={closeDrawer}
                className="font-bold text-xs"
              >
                Close Studio
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AgriShieldStudioDrawer;
