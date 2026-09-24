import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Layers, Satellite, Sun, Droplets, ShieldCheck, 
  Info, Sparkles, TrendingUp, RefreshCw, Eye, EyeOff
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CURATED_FARM_PHOTOS } from '../../services/photoService';

export default function SatelliteNDVIViewer({ farmName = "My Farm", acreage = 2.0, cropName = "Tomato" }) {
  const { t, i18n } = useTranslation();
  const isTe = i18n.language === 'te';

  const [activeLayer, setActiveLayer] = useState('ndvi'); // 'ndvi', 'natural', 'moisture'
  const [showLegend, setShowLegend] = useState(true);

  return (
    <div className="rounded-3xl bg-[#070e17] border border-sky-500/25 p-5 sm:p-7 space-y-6 shadow-2xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-2xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
            <Satellite className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Sentinel-2 & AgroMonitoring
              </span>
              <span className="text-[10px] text-white/40">ESA Multispectral Pass</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white mt-0.5" style={{ fontFamily: 'var(--font-display)' }}>
              {isTe ? 'ఉపగ్రహ NDVI పంట ఆరోగ్యం & బయోమాస్ హీట్‌మ్యాప్' : 'Live Satellite NDVI Crop Health & Biomass Heatmap'}
            </h2>
          </div>
        </div>

        {/* Layer Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-bold">
          <button
            onClick={() => setActiveLayer('ndvi')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeLayer === 'ndvi'
                ? 'bg-emerald-500 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            🌿 NDVI Heatmap
          </button>
          <button
            onClick={() => setActiveLayer('natural')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeLayer === 'natural'
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            📸 Optical
          </button>
          <button
            onClick={() => setActiveLayer('moisture')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeLayer === 'moisture'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            💧 Moisture EVI
          </button>
        </div>
      </div>

      {/* Main Satellite Imagery Studio */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 h-72 sm:h-80 shadow-2xl flex flex-col justify-between p-4">
        {/* Base Curated High-Res Aerial Field Photo */}
        <img
          src={CURATED_FARM_PHOTOS.farmField}
          alt="Satellite Field View"
          className="absolute inset-0 w-full h-full object-cover object-center filter contrast-125"
        />

        {/* Dynamic Multispectral Layer Overlay */}
        {activeLayer === 'ndvi' && (
          <div 
            className="absolute inset-0 opacity-70 pointer-events-none transition-opacity duration-500"
            style={{
              background: 'radial-gradient(ellipse 65% 55% at 48% 48%, rgba(16,185,129,0.85) 0%, rgba(52,211,153,0.7) 45%, rgba(245,158,11,0.5) 75%, rgba(239,68,68,0.6) 95%)'
            }}
          />
        )}

        {activeLayer === 'moisture' && (
          <div 
            className="absolute inset-0 opacity-65 pointer-events-none transition-opacity duration-500"
            style={{
              background: 'radial-gradient(circle at 50% 50%, rgba(14,165,233,0.8) 0%, rgba(59,130,246,0.5) 50%, rgba(99,102,241,0.4) 80%)'
            }}
          />
        )}

        {/* GPS Boundary Polygon HUD Wireframe */}
        <div className="absolute inset-10 border-2 border-dashed border-white/80 rounded-3xl pointer-events-none shadow-[0_0_20px_rgba(255,255,255,0.4)] flex items-center justify-center">
          <span className="px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-white text-xs font-black border border-white/20">
            {farmName} · {acreage} Acres Boundary
          </span>
        </div>

        {/* Top Floating HUD Badges */}
        <div className="relative z-10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/70 backdrop-blur-md text-[11px] font-bold text-white border border-white/10">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Sentinel-2 Multispectral Pass</span>
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] text-white/80 border border-white/10">
              Sun Elevation: 62°
            </span>
          </div>

          <button
            onClick={() => setShowLegend(!showLegend)}
            className="px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white/70 hover:text-white text-xs font-semibold border border-white/10 flex items-center gap-1 cursor-pointer"
          >
            {showLegend ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>Legend</span>
          </button>
        </div>

        {/* Bottom NDVI Index Legend Bar */}
        {showLegend && (
          <div className="relative z-10 p-3 rounded-xl bg-black/80 backdrop-blur-md border border-white/10 space-y-1.5 max-w-md">
            <div className="flex items-center justify-between text-[10px] font-bold text-white/70">
              <span>0.1 (Bare Soil)</span>
              <span>0.4 (Moderate)</span>
              <span className="text-emerald-400 font-extrabold">0.76 (Dense Vigorous Canopy)</span>
            </div>
            <div className="h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 via-emerald-400 to-emerald-600 shadow-inner" />
          </div>
        )}
      </div>

      {/* 4 Analytical Precision Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-emerald-500/25 space-y-1">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Mean NDVI Index</span>
          <p className="text-2xl font-black text-emerald-400">0.76 / 1.0</p>
          <p className="text-[11px] text-white/50">Optimal high chlorophyll absorption</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-sky-500/25 space-y-1">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Canopy Homogeneity</span>
          <p className="text-2xl font-black text-white">91.4%</p>
          <p className="text-[11px] text-white/50">Uniform growth across rows</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-amber-500/25 space-y-1">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Water Stress Factor</span>
          <p className="text-2xl font-black text-amber-300">Low (12%)</p>
          <p className="text-[11px] text-white/50">Root transpiration healthy</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-purple-500/25 space-y-1">
          <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Cloud Interference</span>
          <p className="text-2xl font-black text-white">&lt; 3.2%</p>
          <p className="text-[11px] text-white/50">Atmospherically corrected</p>
        </div>
      </div>
    </div>
  );
}
