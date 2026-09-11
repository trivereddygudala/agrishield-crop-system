import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon, 
  ShieldCheck, 
  Share2, 
  FileText, 
  RefreshCw, 
  Droplets, 
  Layers, 
  TrendingUp,
  Wind,
  Sprout,
  Bug,
  MapPin,
  ExternalLink
} from 'lucide-react';
import { Card, Badge, Button } from '../ui/index';
import { printPrescriptionSlip } from '../../utils/prescriptionShare';
import { getLocalizedSeverity } from '../../utils/regionalLocale';

export default function MultiLeafResults({ result, onReset, farmName = "My Farm Plot", user }) {
  const { t, i18n } = useTranslation();
  const [selectedAcres, setSelectedAcres] = useState(1.0);

  if (!result) return null;

  const {
    total_samples = 0,
    healthy_count = 0,
    infected_count = 0,
    plot_infection_rate = 0,
    severity_level = 'Unknown',
    dominant_crop = 'Crop',
    dominant_disease = 'Healthy Crop',
    directive = '',
    directive_type = 'healthy',
    samples = []
  } = result;

  // Compute knapsack pump calculations for the plot
  const pumpsNeeded = Math.round(selectedAcres * 10);
  const chemVolume = Math.round(selectedAcres * 250);
  const approxCost = Math.round(selectedAcres * 320);

  const handleDownloadPrescription = () => {
    const isHealthyPlot = infected_count === 0;
    
    printPrescriptionSlip({
      cropName: dominant_crop.toUpperCase(),
      diseaseName: isHealthyPlot ? 'FIELD HEALTHY (ZERO INFECTION)' : dominant_disease.toUpperCase(),
      confidence: 96,
      severity: severity_level,
      chemicals: isHealthyPlot ? [
        'No chemical fungicides required.',
        'Apply 19:19:19 NPK foliar nourishment (5g/L)'
      ] : [
        'Mancozeb 75% WP @ 2.5g/L (40g per 16L pump)',
        'Azoxystrobin 18.2% + Difenoconazole 11.4% SC @ 1ml/L (16ml per 16L pump)'
      ],
      organic: [
        'Neem Oil (10,000 PPM) @ 3ml/L (50ml per 16L pump)',
        'Trichoderma viride bio-fungicide soil/foliar application'
      ],
      prevention: `Field Plot Infection Rate: ${plot_infection_rate}%. ${directive}`,
      acres: selectedAcres,
      farmerName: user?.name || 'Farmer',
      farmLocation: user?.district || 'Andhra Pradesh',
      language: (i18n.language || 'en').split('-')[0]
    });
  };

  const handleWhatsAppShare = () => {
    const currentLang = i18n.language || 'en';
    const text = `🌾 *${t('share.batch_title', 'AgriShield Field Plot Diagnostic Report')}*:\n` +
      `• ${t('share.plot', 'Plot')}: ${farmName}\n` +
      `• ${t('share.crop', 'Crop')}: ${dominant_crop}\n` +
      `• ${t('share.samples_analyzed', 'Samples Analyzed')}: ${total_samples} ${t('share.leaves', 'leaves')}\n` +
      `• ${t('share.infection_rate', 'Plot Infection Rate')}: ${plot_infection_rate}% (${infected_count} ${t('share.infected', 'infected')}, ${healthy_count} ${t('share.healthy', 'healthy')})\n` +
      `• ${t('share.dominant_issue', 'Dominant Issue')}: ${dominant_disease}\n` +
      `• ${t('share.action_directive', 'Action Directive')}: ${directive}\n\n` +
      `(${t('share.generated_via', 'Generated via AgriShield AI Multi-Leaf Plot Scanner')})`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  };

  const getSeverityBadgeClass = () => {
    if (directive_type === 'healthy') return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';
    if (directive_type === 'warning') return 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30';
    if (directive_type === 'moderate') return 'bg-orange-500/15 text-orange-800 dark:text-orange-300 border-orange-500/30';
    return 'bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 w-full max-w-6xl mx-auto"
    >
      {/* ── 1. TOP HEADER & INFECTION GAUGE HERO ── */}
      <Card glass className="p-5 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl overflow-hidden relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-xs">
                🌾 {t('batch_scan.uploader_title', 'Multi-Leaf Plot Scan')}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider border ${getSeverityBadgeClass()}`}>
                {getLocalizedSeverity(severity_level, i18n.language)}
              </span>
            </div>
            
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {t('batch_scan.results_title', 'Field Plot Health & Infection Severity Index')}
            </h2>
            
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('batch_scan.results_desc', 'Aggregated diagnosis across {{count}} field sampling zones for {{crop}}.', { count: total_samples, crop: dominant_crop })}
            </p>
          </div>

          {/* Aggregate Severity Progress Bar & Gauge */}
          <div className="flex items-center gap-5 bg-slate-50 dark:bg-slate-900/80 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shrink-0">
            <div className="relative flex items-center justify-center w-20 h-20">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-200 dark:text-slate-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={
                    plot_infection_rate === 0 ? 'text-emerald-500' :
                    plot_infection_rate <= 30 ? 'text-amber-500' :
                    plot_infection_rate <= 60 ? 'text-orange-500' : 'text-rose-500'
                  }
                  strokeDasharray={`${plot_infection_rate}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-lg font-black text-slate-900 dark:text-slate-100 block leading-tight">
                  {plot_infection_rate}%
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wide block">
                  {t('batch_scan.infection_rate', 'Infection')}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="font-bold text-slate-700 dark:text-slate-300">{t('batch_scan.healthy_samples', 'Healthy Samples:')}</span>
                <strong className="text-emerald-600 dark:text-emerald-400">{healthy_count} / {total_samples}</strong>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="font-bold text-slate-700 dark:text-slate-300">{t('batch_scan.infected_samples', 'Infected Samples:')}</span>
                <strong className="text-rose-600 dark:text-rose-400">{infected_count} / {total_samples}</strong>
              </div>
              <div className="text-[11px] text-slate-400 pt-0.5">
                {t('batch_scan.dominant', 'Dominant:')} <strong className="text-slate-700 dark:text-slate-200">{dominant_disease}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. ACTION DIRECTIVE BANNER ── */}
        <div className={`mt-5 p-4 rounded-2xl border ${
          directive_type === 'healthy' ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700/60 text-emerald-950 dark:text-emerald-100' :
          directive_type === 'warning' ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700/60 text-amber-950 dark:text-amber-100' :
          directive_type === 'moderate' ? 'bg-orange-50/90 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700/60 text-orange-950 dark:text-orange-100' :
          'bg-rose-50/90 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700/60 text-rose-950 dark:text-rose-100'
        }`}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/80 dark:bg-black/30 shadow-2xs shrink-0">
              {directive_type === 'healthy' ? <ShieldCheck className="w-5 h-5 text-emerald-600" /> :
               directive_type === 'warning' ? <AlertTriangle className="w-5 h-5 text-amber-600" /> :
               <AlertOctagon className="w-5 h-5 text-rose-600" />}
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider opacity-75 block">
                {t('batch_scan.directive_title', 'AgriShield Agronomist Directive')}
              </span>
              <p className="text-xs sm:text-sm font-extrabold leading-relaxed">
                {directive}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-semibold opacity-90 pt-1">
                <Wind className="w-3.5 h-3.5 shrink-0" />
                <span>{t('batch_scan.weather_safety', '4-Hour Weather Safety: Spray 6-9 AM or 4:30-6:30 PM. Ensure 4 hours of dry weather post-spray.')}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* ── 3. INDIVIDUAL LEAF SAMPLES GALLERY ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-slate-100">
              {t('batch_scan.individual_diagnoses', 'Individual Sampling Zone Diagnoses ({{count}} Leaves)', { count: samples.length })}
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-semibold">
            {t('batch_scan.plot_breakdown', 'Plot Breakdown')}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {samples.map((s, idx) => {
            const isHealthy = s.is_healthy;
            const imgSrc = s.image_path ? `/${s.image_path.replace(/^\/+/, '')}` : null;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`p-4 rounded-2xl border bg-white dark:bg-[#1a1a1a] shadow-md transition-all flex flex-col justify-between space-y-3 ${
                  isHealthy 
                    ? 'border-emerald-300/80 dark:border-emerald-800/60 hover:border-emerald-500' 
                    : 'border-rose-300/80 dark:border-rose-800/60 hover:border-rose-500'
                }`}
              >
                <div>
                  {/* Image & Sample Tag */}
                  <div className="relative rounded-xl overflow-hidden mb-3 bg-slate-100 dark:bg-slate-900 h-36 border border-slate-200 dark:border-slate-800">
                    {imgSrc ? (
                      <img src={imgSrc} alt={s.label} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Bug className="w-8 h-8" />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-[10px] font-black tracking-wide">
                      {s.label || `${t('batch_scan.zone', 'Zone #{{index}}', { index: s.sample_index })}`}
                    </span>
                    <span className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wide backdrop-blur-md ${
                      isHealthy ? 'bg-emerald-600/90 text-white' : 'bg-rose-600/90 text-white'
                    }`}>
                      {isHealthy ? `✓ ${t('batch_scan.healthy', 'Healthy')}` : `⚠️ ${t('batch_scan.diseased', 'Diseased')}`}
                    </span>
                  </div>

                  {/* Diagnosis Details */}
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                        {s.crop_name} — {s.disease_name}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        {s.confidence}%
                      </span>
                    </div>

                    {s.localized_disease_name && s.localized_disease_name !== s.disease_name && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 block">
                        {s.localized_disease_name}
                      </span>
                    )}

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 pt-1">
                      <strong>{t('batch_scan.prescription_label', 'Prescription:')}</strong> {s.treatment}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-semibold">
                  <span>{t('batch_scan.severity', 'Severity:')} <strong className={isHealthy ? 'text-emerald-500' : 'text-amber-500'}>{getLocalizedSeverity(s.severity, i18n.language)}</strong></span>
                  <span>{t('batch_scan.zone', 'Zone #{{index}}', { index: s.sample_index })}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── 4. UNIFIED 1-TAP PRESCRIPTION & TANK CALCULATOR ── */}
      <Card glass className="p-5 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block">
              {t('batch_scan.calc_title', 'Field Plot Spray Calibration')}
            </span>
            <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
              {t('batch_scan.calc_subtitle', 'Acreage Knapsack Pump Calculator & Digital Slip')}
            </h4>
          </div>

          {/* Acreage Selector */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#1f1f1f] p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
            <span className="text-slate-400 px-1 text-[11px]">{t('batch_scan.acreage', 'Acreage:')}</span>
            {[0.5, 1.0, 2.0, 5.0].map((ac) => (
              <button
                key={ac}
                type="button"
                onClick={() => setSelectedAcres(ac)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedAcres === ac
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {ac} {t('batch_scan.acres_unit', 'Ac')}
              </button>
            ))}
          </div>
        </div>

        {/* Calculated Volume Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('batch_scan.total_pumps', 'Total 16L Pumps')}</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              {pumpsNeeded} {t('batch_scan.spray_tanks', 'Spray Tanks')}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('batch_scan.medicine_needed', 'Medicine Needed')}</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              ~{chemVolume} ml / g
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <span className="text-[10px] font-black uppercase text-slate-400 block">{t('batch_scan.estimated_cost', 'Estimated Cost')}</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
              ~₹{approxCost}
            </span>
          </div>
        </div>

        {/* Action Buttons: Download Slip, WhatsApp, Re-scan */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t('batch_scan.scan_another', 'Scan Another Field Plot')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{t('batch_scan.whatsapp_dealer', 'WhatsApp Dealer')}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPrescription}
              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-teal-700/20 transition-all active:scale-95 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{t('batch_scan.prescription_slip', '📄 Field Prescription Slip')}</span>
            </button>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
