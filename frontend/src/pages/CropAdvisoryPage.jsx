import React from 'react';
import { motion } from 'framer-motion';
import { Sprout, Calendar, Activity, Sparkles, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import WidgetErrorBoundary from '../components/WidgetErrorBoundary';
import { DailyRecommendations } from '../components/intelligence/DailyRecommendations';
import { FarmTimeline } from '../components/intelligence/FarmTimeline';
import { FarmHealthScore2 } from '../components/intelligence/FarmHealthScore2';
import { CropCalendar } from '../components/intelligence/CropCalendar';
import { Badge } from '../components/ui/index';

const CropAdvisoryPage = () => {
  const { t } = useTranslation();
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {t('crop_advisory_page.title', 'Agronomy & Crop Advisory Hub')}
            </h1>
            <Badge variant="success" className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-extrabold flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {t('crop_advisory_page.badge', 'AI Directive')}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('crop_advisory_page.subtitle', 'Prioritized daily AI farming actions, intelligence activity streams, health index metrics & crop lifecycle management for {{farm}}.', { farm: activeFarm?.farm_name || "My Farm" })}
          </p>
        </div>
      </div>

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
