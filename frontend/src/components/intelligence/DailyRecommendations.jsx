import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Wind, CloudRain, Package, Check, Clock, Droplets, BookOpen, ShieldAlert } from 'lucide-react';
import { Card, Badge, Skeleton } from '../ui/index';
import API from '../../services/api';

export const DailyRecommendations = React.memo(({ farmId, cropName = "Tomato", growthStage = "Vegetative" }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/intelligence/recommendations', {
        params: { farm_id: farmId, crop_name: cropName, growth_stage: growthStage }
      });
      setData(res.data);
    } catch (err) {
      console.warn("Daily recommendations fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [farmId, cropName, growthStage]);

  if (loading) {
    return <Skeleton className="h-52 rounded-2xl w-full" />;
  }

  if (!data?.recommendations) return null;

  return (
    <Card glass className="p-6 border-slate-200/80 dark:border-slate-800 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Prioritized Daily AI Farming Actions</span>
        </div>
        <Badge variant="healthy">{data.recommendations.length} Active Advice</Badge>
      </div>

      <div className="space-y-3">
        {data.recommendations.map((item) => {
          const isDelayed = item.action_delayed;
          const sprayStatus = item.spray_window_status;
          const invStatus = item.inventory_status;
          const safety = item.safety_protocols;
          const farmCalc = item.farm_application_calc;
          const sourceAuth = item.source_authority;

          return (
            <div key={item.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <span className="text-xs font-extrabold text-slate-900 dark:text-slate-100">
                  {item.recommendation}
                </span>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {item.confidence && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      {item.confidence}% Confidence
                    </span>
                  )}
                  {sprayStatus && (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isDelayed
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/50'
                        : sprayStatus === 'Safe Window Open'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-700/50'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {isDelayed ? <CloudRain className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                      <span>{sprayStatus}</span>
                    </span>
                  )}
                </div>
              </div>

              {invStatus && invStatus.badge && (
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                    invStatus.is_expired
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold'
                      : invStatus.in_stock
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : invStatus.badge_variant === 'destructive'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}>
                    {invStatus.is_expired ? <ShieldAlert className="w-2.5 h-2.5" /> : <Package className="w-2.5 h-2.5" />}
                    <span>{invStatus.badge}</span>
                  </span>
                </div>
              )}

              {/* Safety Protocols Bar (Authoritative Data Only) */}
              {safety && (
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-2 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                      Safety Protocols:
                    </span>
                    {safety.preharvest_interval && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                        ⏳ PHI: {safety.preharvest_interval}
                      </span>
                    )}
                    {safety.reentry_interval && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800">
                        🚷 REI: {safety.reentry_interval}
                      </span>
                    )}
                    {safety.toxicity_level && (
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
                        {safety.toxicity_level}
                      </span>
                    )}
                  </div>
                  {safety.protective_equipment && (
                    <div className="text-[10px] text-slate-600 dark:text-slate-300 pl-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">Mandatory PPE: </span>
                      {safety.protective_equipment}
                    </div>
                  )}
                </div>
              )}

              {/* Farm Application Calculation (Authoritative Data Only) */}
              {farmCalc && farmCalc.water_volume_display && farmCalc.required_input_display ? (
                <div className="bg-sky-50/60 dark:bg-sky-950/20 border border-sky-200/50 dark:border-sky-900/30 p-2 rounded-lg text-[10px] text-sky-900 dark:text-sky-300 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex items-center gap-1 font-medium">
                    <Droplets className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                    <span><b>Spray Volume:</b> {farmCalc.water_volume_display} ({farmCalc.farm_size_acres} acres)</span>
                  </span>
                  <span><b>Input Needed:</b> {farmCalc.required_input_display}</span>
                </div>
              ) : (safety?.dosage_per_litre || item.dosage) ? (
                <div className="bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/60 p-2 rounded-lg text-[10px] text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span><b>Application rate:</b> {safety?.dosage_per_litre || item.dosage}</span>
                  {(farmCalc?.farm_size_acres || data?.metadata?.farm_size_acres) && (
                    <span><b>Farm area:</b> {farmCalc?.farm_size_acres || data?.metadata?.farm_size_acres} acres</span>
                  )}
                  <span className="text-slate-500 dark:text-slate-400"><b>Total application volume:</b> Not available</span>
                </div>
              ) : null}

              {item.reasoning?.length > 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pl-0.5">
                  {item.reasoning.map((r, i) => (
                    <p key={i}>• {r}</p>
                  ))}
                </div>
              )}

              {/* Agronomic Authority Attribution */}
              {sourceAuth && (
                <div className="pt-1 border-t border-slate-200/40 dark:border-slate-800/40 flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-500">
                  <BookOpen className="w-2.5 h-2.5 shrink-0" />
                  <span>Source: {sourceAuth}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
});
