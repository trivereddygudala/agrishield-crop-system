import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sprout, Calendar, Activity, Sparkles, ShieldCheck, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import FungalRiskAdvisor from '../components/intelligence/FungalRiskAdvisor';
import PathogenWeatherRadar from '../components/intelligence/PathogenWeatherRadar';
import CropYieldLossEstimator from '../components/intelligence/CropYieldLossEstimator';
import { DailyRecommendations } from '../components/intelligence/DailyRecommendations';
import { FarmTimeline } from '../components/intelligence/FarmTimeline';
import { FarmHealthScore2 } from '../components/intelligence/FarmHealthScore2';
import { CropCalendar } from '../components/intelligence/CropCalendar';
import { Badge } from '../components/ui/index';

const CropAdvisoryPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isTe = i18n?.language === 'te';
  const { activeFarm } = useFarm();

  const farmId = activeFarm?.id || 1;
  const cropName = activeFarm?.crop_type || 'Tomato';
  const growthStage = activeFarm?.growth_stage || 'Vegetative';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 w-full pb-12"
    >
      {/* Back to Field Navigation Button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => navigate('/farm')}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-700 dark:hover:text-emerald-300 text-xs sm:text-sm font-bold shadow-xs transition-all active:scale-95 group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          <span>{isTe ? '← పొలం పేజీకి తిరిగి వెళ్ళు' : '← Back to Field'}</span>
        </button>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('crop_advisory_page.title', 'Agro-Weather & Spore Advisory Hub')}
            </h1>
            <Badge variant="success" className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {t('crop_advisory_page.badge', 'AI Directive')}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('crop_advisory_page.subtitle', 'Prioritized daily AI farming actions, microclimate fungal spore risk & crop lifecycle management for {{farm}}.', { farm: activeFarm?.farm_name || "My Farm" })}
          </p>
        </div>
      </div>

      {/* Hyperlocal Weather & Pathogen Outbreak Forecast Radar (Software OpenWeather + Hardware Dual-Stream) */}
      <WidgetErrorBoundary name="Pathogen Weather Outbreak Radar">
        <PathogenWeatherRadar 
          cropName={cropName} 
          farmId={farmId}
          lat={activeFarm?.latitude || 16.5062}
          lon={activeFarm?.longitude || 80.6480}
        />
      </WidgetErrorBoundary>

      {/* AI Crop Yield Loss & Economic Estimator (₹ per acre) */}
      <WidgetErrorBoundary name="AI Crop Yield Loss Estimator">
        <CropYieldLossEstimator 
          cropName={cropName}
          diseaseName={`${cropName} Blight / Leaf Spot`}
          initialAcres={activeFarm?.total_area || 1.0}
        />
      </WidgetErrorBoundary>

      {/* Agro-Weather & Spore Germination Risk */}
      <WidgetErrorBoundary name="Fungal Spore Risk Advisory">
        <FungalRiskAdvisor />
      </WidgetErrorBoundary>

      {/* 1. Top Section: Daily AI Recommendations & Farm Health Score */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <WidgetErrorBoundary name="Daily AI Recommendations">
            <DailyRecommendations farmId={farmId} cropName={cropName} growthStage={growthStage} />
          </WidgetErrorBoundary>
        </div>

        <div>
          <WidgetErrorBoundary name="Farm Health Score Breakdown">
            <FarmHealthScore2 farmId={farmId} />
          </WidgetErrorBoundary>
        </div>
      </div>

      {/* 2. Middle Section: Farm Activity Timeline */}
      <div className="w-full">
        <WidgetErrorBoundary name="Farm Activity Timeline">
          <FarmTimeline farmId={farmId} />
        </WidgetErrorBoundary>
      </div>

      {/* 2. Crop Lifecycle Calendar & Milestones */}
      <WidgetErrorBoundary name="Crop Lifecycle Calendar">
        <CropCalendar cropName={cropName} growthStage={growthStage} />
      </WidgetErrorBoundary>
    </motion.div>
  );
};

export default CropAdvisoryPage;
