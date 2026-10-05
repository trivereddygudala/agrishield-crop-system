import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Wind, CloudRain, Package, Check, Clock } from 'lucide-react';
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

          return (
            <div key={item.id} className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 space-y-2">
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
                    invStatus.in_stock
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : invStatus.badge_variant === 'destructive'
                      ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}>
                    <Package className="w-2.5 h-2.5" />
                    <span>{invStatus.badge}</span>
                  </span>
                </div>
              )}

              {item.dosage && (
                <div className="text-[11px] font-medium text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-900/40 px-2.5 py-1 rounded-lg border border-slate-200/40 dark:border-slate-800/60">
                  <span className="font-bold text-slate-700 dark:text-slate-200">Recommended Dosage: </span>
                  {item.dosage}
                </div>
              )}

              {item.reasoning?.length > 0 && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pl-0.5">
                  {item.reasoning.map((r, i) => (
                    <p key={i}>• {r}</p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
});
