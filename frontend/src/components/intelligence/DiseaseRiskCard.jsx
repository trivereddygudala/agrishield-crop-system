import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldCheck, Activity, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, Badge, Skeleton, Progress } from '../ui/index';
import API from '../../services/api';

export const RiskGauge = ({ percentage, level, color }) => {
  const { t } = useTranslation();
  const localizedLevel = t(`dashboard.risk.${(level || '').toLowerCase()}`, level);
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex items-center justify-center w-20 h-20 shrink-0">
        <svg className="transform -rotate-90 w-20 h-20">
          <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-200 dark:text-slate-800" />
          <motion.circle
            initial={{ strokeDashoffset: 200 }}
            animate={{ strokeDashoffset: 200 - (percentage / 100) * 200 }}
            transition={{ duration: 1.0, ease: "easeOut" }}
            cx="40" cy="40" r="32" stroke={color} strokeWidth="8" fill="transparent"
            strokeDasharray={200} strokeLinecap="round"
          />
        </svg>
        <span className="absolute font-black text-sm text-slate-900 dark:text-white">{percentage}%</span>
      </div>
      <div>
        <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
          {t('dashboard.risk.outbreak_risk', 'Pathology Outbreak Risk')}
        </span>
        <h4 className="text-xl font-black" style={{ color }}>
          {t('dashboard.risk.risk_level', '{{level}} Risk Level', { level: localizedLevel })}
        </h4>
      </div>
    </div>
  );
};

export const DiseaseRiskCard = React.memo(({ farmId, cropName = "Tomato" }) => {
  const { t } = useTranslation();
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRisk = async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/intelligence/disease-risk', {
        params: { farm_id: farmId, crop_name: cropName }
      });
      setRiskData(res.data);
    } catch (err) {
      console.warn("Disease risk fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();
  }, [farmId, cropName]);

  if (loading) {
    return <Skeleton className="h-56 rounded-2xl w-full" />;
  }

  if (!riskData) return null;

  return (
    <Card glass className="p-5 sm:p-6 border-slate-200/80 dark:border-slate-800 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base">
            {t('dashboard.risk.title', 'Explainable Disease Risk Forecast')}
          </h3>
        </div>
        <span className="self-start sm:self-auto shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30">
          {t('dashboard.risk.confidence', 'Confidence: {{score}}%', { score: riskData.confidence_score })}
        </span>
      </div>

      <RiskGauge percentage={riskData.risk_percentage} level={riskData.risk_level} color={riskData.risk_color} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
        {riskData.factors_increasing_risk?.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-rose-50/80 dark:bg-slate-900/90 border border-rose-200/80 dark:border-rose-500/30 space-y-1.5 shadow-xs">
            <span className="font-extrabold text-rose-900 dark:text-rose-400 block text-[11px]">
              ⚠️ {t('dashboard.risk.factors', 'Risk Elevating Factors:')}
            </span>
            {riskData.factors_increasing_risk.map((f, i) => (
              <p key={i} className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">• {f}</p>
            ))}
          </div>
        )}

        {riskData.preventive_actions?.length > 0 && (
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-slate-900/90 border border-emerald-200/80 dark:border-emerald-500/30 space-y-1.5 shadow-xs">
            <span className="font-extrabold text-emerald-900 dark:text-emerald-400 block text-[11px]">
              🛡️ {t('dashboard.risk.preventive_protocols', 'Recommended Preventive Protocol:')}
            </span>
            {riskData.preventive_actions.map((a, i) => (
              <p key={i} className="text-slate-700 dark:text-slate-200 font-medium leading-relaxed">• {a}</p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
});

