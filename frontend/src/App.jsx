import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import { WebSocketProvider } from './context/WebSocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import { Sidebar, Navbar, BottomNav, Footer, Skeleton, ToastProvider } from './components/AppLayout';
import OfflineStatusBar from './components/common/OfflineStatusBar';
import { useColorTheme } from './hooks/useColorTheme';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Critical-path authentication pages — loaded eagerly for instant first-paint
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import ServerErrorPage from './pages/ServerErrorPage';

// Lazily loaded pages (with auto-recovery on new deployment chunk hash mismatch)
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'));
const UploadImagePage = lazyWithRetry(() => import('./pages/UploadImagePage'));
const PredictionResultPage = lazyWithRetry(() => import('./pages/PredictionResultPage'));
const HistoryPage = lazyWithRetry(() => import('./pages/HistoryPage'));
const AdminPage = lazyWithRetry(() => import('./pages/AdminPage'));
const AIAssistantPage = lazyWithRetry(() => import('./pages/AIAssistantPage'));
const AnalyticsPage = lazyWithRetry(() => import('./pages/AnalyticsPage'));
const FarmPage = lazyWithRetry(() => import('./pages/FarmPage'));
const ProfilePage = lazyWithRetry(() => import('./pages/ProfilePage'));
const SettingsPage = lazyWithRetry(() => import('./pages/SettingsPage'));
const DevicesPage = lazyWithRetry(() => import('./pages/DevicesPage'));
const SDCardPage = lazyWithRetry(() => import('./pages/SDCardPage'));
const NotificationsPage = lazyWithRetry(() => import('./pages/NotificationsPage'));
const ReportsPage = lazyWithRetry(() => import('./pages/ReportsPage'));
const FarmAnalyticsPage = lazyWithRetry(() => import('./pages/FarmAnalyticsPage'));
const CropAdvisoryPage = lazyWithRetry(() => import('./pages/CropAdvisoryPage'));
const MarketPricesPage = lazyWithRetry(() => import('./pages/MarketPricesPage'));
const NodeControlPage = lazyWithRetry(() => import('./pages/NodeControlPage'));
const MorePage = lazyWithRetry(() => import('./pages/MorePage'));
const LanguagesPage = lazyWithRetry(() => import('./pages/LanguagesPage'));
const FieldAreaCalculatorPage = lazyWithRetry(() => import('./pages/FieldAreaCalculatorPage'));
const HelpSupportPage = lazyWithRetry(() => import('./pages/HelpSupportPage'));

// Layout wrapper for internal dashboard views
const DashboardLayout = () => {
  const location = useLocation();
  const isAssistant = location.pathname === '/assistant';

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1024 : false;
  });

  React.useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  React.useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname]);

  return (
    <div className="min-h-screen pt-16 bg-slate-100/90 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Floating Offline Status & Auto-Sync Bar */}
      <OfflineStatusBar />

      {/* Top Navbar */}
      <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex flex-1">
        {/* Left Navigation Sidebar */}
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        {/* Main Content Area — full width on mobile (sidebar is overlay), indent only on lg+ */}
        <main
          className={`flex-1 w-full min-w-0 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'} transition-all duration-300 ${isAssistant ? 'h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-4rem)] max-h-[calc(100dvh-8rem)] lg:max-h-[calc(100dvh-4rem)] overflow-hidden flex flex-col' : 'min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-x-hidden'}`}
          role="main"
        >
          <div className={isAssistant ? 'p-0 h-full max-h-full flex flex-col flex-1 min-h-0 overflow-hidden' : 'p-3 sm:p-6 lg:p-8 pb-28 lg:pb-8 w-full flex-1'}>
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16, ease: 'easeOut' }}
                    className={`w-full ${isAssistant ? 'h-full max-h-full flex-1 flex flex-col min-h-0 overflow-hidden' : ''}`}
                  >
                    <Outlet />
                  </motion.div>
                </AnimatePresence>
              </Suspense>
            </ErrorBoundary>
          </div>
          {!isAssistant && <Footer />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
};

function ThemeInitializer({ children }) {
  useColorTheme(); // Initialize site-wide theme on html tag inside AuthProvider context
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <ThemeInitializer>
        <FarmProvider>
          <WebSocketProvider>
            <ToastProvider>
              <BrowserRouter>
              <ErrorBoundary>
                <Routes>
                  {/* Public Views */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />

                  {/* Authenticated Dashboard Views */}
                  <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/more" element={<MorePage />} />
                    <Route path="/node-control" element={<NodeControlPage />} />
                    <Route path="/farm" element={<FarmPage />} />
                    <Route path="/field-calculator" element={<FieldAreaCalculatorPage />} />
                    <Route path="/area-calculator" element={<Navigate to="/field-calculator" replace />} />
                    <Route path="/farm-settings" element={<Navigate to="/farm" replace />} />
                    <Route path="/farm-info" element={<Navigate to="/farm" replace />} />
                    <Route path="/crop-advisory" element={<CropAdvisoryPage />} />
                    <Route path="/market" element={<MarketPricesPage />} />
                    <Route path="/crop-prices" element={<Navigate to="/market" replace />} />
                    <Route path="/upload" element={<UploadImagePage />} />
                    <Route path="/upload/:tab" element={<UploadImagePage />} />
                    <Route path="/result" element={<PredictionResultPage />} />
                    <Route path="/history" element={<HistoryPage />} />
                    <Route path="/devices" element={<DevicesPage />} />
                    <Route path="/device" element={<Navigate to="/devices" replace />} />
                    <Route path="/sdcard" element={<SDCardPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/reports" element={<ReportsPage />} />
                    <Route path="/assistant" element={<AIAssistantPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/telemetry" element={<Navigate to="/analytics" replace />} />
                    <Route path="/farm-analytics" element={<FarmAnalyticsPage />} />
                    <Route path="/profile" element={<ProfilePage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/languages" element={<LanguagesPage />} />
                    <Route path="/language" element={<Navigate to="/languages" replace />} />
                    <Route path="/support" element={<HelpSupportPage />} />
                    <Route path="/help" element={<Navigate to="/support" replace />} />
                    <Route path="/helpdesk" element={<Navigate to="/support" replace />} />
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/*" element={<AdminPage />} />
                    <Route path="/scan" element={<UploadImagePage />} />
                    <Route path="/scan/:tab" element={<UploadImagePage />} />
                    <Route path="/ai-scan" element={<UploadImagePage />} />
                    <Route path="/ai-scan/:tab" element={<UploadImagePage />} />
                  </Route>

                  {/* Error Pages */}
                  <Route path="/error" element={<ServerErrorPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </ErrorBoundary>
              </BrowserRouter>
            </ToastProvider>
          </WebSocketProvider>
        </FarmProvider>
      </ThemeInitializer>
    </AuthProvider>
  );
}

export default App;
