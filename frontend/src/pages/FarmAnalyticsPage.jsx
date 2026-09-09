import React, { useState, useEffect, Suspense } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import API from '../services/api';
import { 
  DashboardHeader, 
  DateRangeFilter, 
  ExportButtons, 
  KpiCard, 
  QuickInsights, 
  RecentScansTable,
  LoadingAnalytics,
  EmptyAnalytics
} from '../components/analytics';
import { AlertTriangle } from 'lucide-react';

// Lazy loaded charts to improve initial render time
const AnalyticsCharts = React.lazy(() => import('../components/analytics/AnalyticsCharts'));

// Skeleton for the lazy-loaded charts block
const ChartsSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 w-full mt-6">
    <div className="col-span-1 lg:col-span-2 bg-white h-72 rounded-xl border border-slate-200 animate-pulse"></div>
    <div className="bg-white h-72 rounded-xl border border-slate-200 animate-pulse"></div>
    <div className="bg-white h-64 rounded-xl border border-slate-200 animate-pulse"></div>
    <div className="bg-white h-64 rounded-xl border border-slate-200 animate-pulse"></div>
    <div className="bg-white h-64 rounded-xl border border-slate-200 animate-pulse"></div>
  </div>
);

const FarmAnalyticsPage = () => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState('all');
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async (range) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch summary and recent history in parallel
      const [summaryRes, historyRes] = await Promise.all([
        API.get(`/api/analytics/summary?time_range=${range}`),
        API.get(`/api/history?page=1&limit=10`) // history endpoint doesn't strictly filter by timeRange by default, but it returns recent scans
      ]);
      
      setData(summaryRes.data);
      const historyData = historyRes.data;
      setHistory(historyData.predictions || historyData.data || historyData || []);
    } catch (err) {
      console.error("Failed to load farm analytics", err);
      setError("Failed to load analytics data. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(timeRange);
  }, [timeRange]);

  const handleRefresh = () => {
    fetchData(timeRange);
  };

  if (loading && !data) {
    return <LoadingAnalytics />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800 mb-2">
          {t('analytics.something_went_wrong', 'Oops, something went wrong')}
        </h2>
        <p className="text-slate-500 mb-6">{error}</p>
        <button 
          onClick={handleRefresh}
          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {t('analytics.try_again', 'Try Again')}
        </button>
      </div>
    );
  }

  // Check if we have absolutely zero scans ever
  if (data?.counts?.total_scans === 0 && timeRange === 'all') {
    return <EmptyAnalytics />;
  }

  const counts = data?.counts || {};
  const perf = data?.performance || {};

  return (
    <div className="max-w-7xl mx-auto w-full">
      <DashboardHeader 
        metadata={data?.metadata} 
        onRefresh={handleRefresh} 
        isRefreshing={loading} 
      />
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
        <DateRangeFilter selected={timeRange} onChange={setTimeRange} />
        <ExportButtons data={data} history={history} timeRange={timeRange} />
      </div>
      
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        <KpiCard 
          title={t('analytics.kpi_total_scans', 'Total Scans')} 
          value={counts.total_scans || 0} 
          iconName="Activity" 
          colorClass="bg-blue-100 text-blue-600"
          delay={0.1}
        />
        <KpiCard 
          title={t('analytics.kpi_healthy_plants', 'Healthy Plants')} 
          value={counts.healthy_plants || 0} 
          iconName="CheckCircle" 
          colorClass="bg-emerald-100 text-emerald-600"
          delay={0.2}
        />
        <KpiCard 
          title={t('analytics.kpi_diseased_plants', 'Diseased Plants')} 
          value={counts.diseased_plants || 0} 
          iconName="AlertTriangle" 
          colorClass="bg-rose-100 text-rose-600"
          delay={0.3}
        />
        <KpiCard 
          title={t('analytics.kpi_agrochemical_scans', 'Agrochemical Scans')} 
          value={counts.agrochemical_scans || 0} 
          iconName="FlaskConical" 
          colorClass="bg-purple-100 text-purple-600"
          delay={0.4}
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 mb-6">
        {/* Main Charts Area */}
        <div className="lg:col-span-3 space-y-6">
          <Suspense fallback={<ChartsSkeleton />}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <AnalyticsCharts 
                timeSeries={data?.time_series} 
                topCrops={data?.top_crops} 
                topDiseases={data?.top_diseases} 
                topAgrochemicals={data?.top_agrochemicals} 
              />
            </div>
          </Suspense>
        </div>
        
        {/* Sidebar Insights */}
        <div className="lg:col-span-1 space-y-6">
          <QuickInsights insights={data?.insights} />
        </div>
      </div>
      
      {/* Recent Scans Table */}
      <div className="mt-8">
        <RecentScansTable scans={history} />
      </div>
    </div>
  );
};

export default FarmAnalyticsPage;
