import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { 
  CloudRain, AlertTriangle, ShieldCheck, Droplets, Thermometer, Wind, 
  ChevronRight, Sparkles, CheckCircle2, Info, ArrowUpRight
} from 'lucide-react';
import { Card, Badge, Button } from '../ui/index';
import API from '../../services/api';
import { getFungalRiskData } from '../../utils/regionalLocale';

export default function FungalRiskAdvisor({ compact = false }) {
  const { t, i18n } = useTranslation();
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await API.get('/weather/current');
        if (res.data && res.data.main) {
          setWeatherData({
            temp: Math.round(res.data.main.temp),
            humidity: res.data.main.humidity,
            condition: res.data.weather?.[0]?.main || 'Clouds',
            windSpeed: Math.round(res.data.wind?.speed || 12)
          });
        } else {
          // Default agricultural climate baseline (Monsoon / High Humidity)
          setWeatherData({ temp: 26, humidity: 82, condition: 'Rain', windSpeed: 14 });
        }
      } catch {
        setWeatherData({ temp: 26, humidity: 82, condition: 'Rain', windSpeed: 14 });
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
  }, []);

  const temp = weatherData?.temp ?? 26;
  const humidity = weatherData?.humidity ?? 82;

  // Calculate Fungal Germination Risk (FGI)
  // Spores germinate rapidly when humidity > 75% and temp is 20-28°C
  let riskScore = 0;
  if (humidity >= 85) riskScore += 50;
  else if (humidity >= 75) riskScore += 35;
  else if (humidity >= 65) riskScore += 20;
  else riskScore += 10;

  if (temp >= 21 && temp <= 28) riskScore += 40;
  else if (temp >= 18 && temp <= 32) riskScore += 25;
  else riskScore += 10;

  const isHighRisk = riskScore >= 70;
  const isModerateRisk = riskScore >= 45 && riskScore < 70;
  const currentLang = i18n.language || 'en';
  const advice = getFungalRiskData(isHighRisk, currentLang);

  if (loading) return null;

  if (compact) {
    return (
      <div className={`p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-xs transition-all ${
        isHighRisk 
          ? 'bg-amber-500/10 border-amber-400/40 dark:bg-amber-950/30 dark:border-amber-700/50 text-amber-900 dark:text-amber-200' 
          : 'bg-emerald-500/10 border-emerald-400/30 text-emerald-900 dark:text-emerald-200'
      }`}>
        <div className="flex items-center gap-2.5 truncate">
          <AlertTriangle className={`w-4 h-4 shrink-0 ${isHighRisk ? 'text-amber-500 animate-pulse' : 'text-emerald-500'}`} />
          <div className="truncate">
            <span className="text-xs font-black block truncate">{advice.title}</span>
            <span className="text-[11px] opacity-80 block truncate">{advice.desc}</span>
          </div>
        </div>
        <Badge variant={isHighRisk ? 'glow-amber' : 'glow-emerald'} className="shrink-0 text-[10px] font-black">
          {isHighRisk ? t('advisor.high_risk', 'HIGH RISK') : t('advisor.normal', 'NORMAL')}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={`relative overflow-hidden border shadow-xl transition-all duration-300 ${
      isHighRisk 
        ? 'bg-gradient-to-br from-amber-950/20 via-slate-900 to-slate-950 border-amber-500/30 text-white' 
        : 'bg-gradient-to-br from-emerald-950/20 via-slate-900 to-slate-950 border-emerald-500/30 text-white'
    }`}>
      {/* Background radial glow */}
      <div className={`pointer-events-none absolute -right-16 -top-16 w-60 h-60 rounded-full blur-3xl opacity-20 ${
        isHighRisk ? 'bg-amber-500' : 'bg-emerald-500'
      }`} />

      <div className="p-5 sm:p-6 relative z-10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-3 rounded-2xl border shadow-md shrink-0 ${
              isHighRisk 
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-400 shadow-amber-950/50' 
                : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-400 shadow-emerald-950/50'
            }`}>
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                  {t('advisor.agro_climatic', 'Agro-Climatic Intelligence')}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{t('advisor.forecast_48h', '48-Hr Forecast')}</span>
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                {advice.title}
              </h3>
            </div>
          </div>

          {/* Micro Telemetry Pill */}
          <div className="flex items-center gap-2 shrink-0 bg-black/50 border border-white/10 px-3.5 py-2 rounded-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold pr-2 border-r border-white/10">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span>{temp}°C</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold pr-2 border-r border-white/10">
              <Droplets className="w-3.5 h-3.5 text-sky-400" />
              <span>{humidity}%</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-black text-amber-400">
              <span>{t('advisor.risk', 'Risk')}: {riskScore}%</span>
            </div>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
          {advice.desc}
        </p>

        {/* Vulnerable Crops Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold">{t('advisor.vulnerable_crops', '🌾 Vulnerable Crops:')}</span>
            <span className="font-extrabold text-amber-300">{advice.crops}</span>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{expanded ? t('advisor.hide_details', 'Hide Details') : t('advisor.view_protocol', 'View Action Protocol')}</span>
            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Expanded Protocol Details */}
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-1">
              <span className="text-[11px] font-black text-emerald-400 block uppercase">{t('advisor.biological_prevention', '1. Biological Prevention')}</span>
              <p className="text-xs text-slate-300 leading-normal">{t('advisor.bio_desc', 'Foliar spray of Trichoderma viride (2.5 kg/ha) or Pseudomonas 10g/L during overcast hours.')}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-1">
              <span className="text-[11px] font-black text-sky-400 block uppercase">{t('advisor.field_drainage', '2. Field Drainage')}</span>
              <p className="text-xs text-slate-300 leading-normal">{t('advisor.drainage_desc', 'Clear furrow furcation drains to prevent soil water stagnation around collar roots.')}</p>
            </div>
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 space-y-1">
              <span className="text-[11px] font-black text-amber-400 block uppercase">{t('advisor.chemical_cushion', '3. Chemical Cushion')}</span>
              <p className="text-xs text-slate-300 leading-normal">{t('advisor.chemical_desc', 'If active sporulation occurs, spray Mancozeb 75% WP (2g/L) or Copper Oxychloride.')}</p>
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
