import React, { useState, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthProvider } from './context/AuthContext';
import { FarmProvider } from './context/FarmContext';
import { WebSocketProvider } from './context/WebSocketContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import { Sidebar, Navbar, BottomNav, Footer, Skeleton, ToastProvider } from './components/AppLayout';

// Pages — eagerly loaded (critical path)
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import NotFoundPage from './pages/NotFoundPage';
import FarmPage from './pages/FarmPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

import DashboardPage from './pages/DashboardPage';
import UploadImagePage from './pages/UploadImagePage';
import PredictionResultPage from './pages/PredictionResultPage';
import DevicesPage from './pages/DevicesPage';
import SDCardPage from './pages/SDCardPage';
import NotificationsPage from './pages/NotificationsPage';
import ReportsPage from './pages/ReportsPage';
import FarmAnalyticsPage from './pages/FarmAnalyticsPage';
import CropAdvisoryPage from './pages/CropAdvisoryPage';
import MarketPricesPage from './pages/MarketPricesPage';
import ServerErrorPage from './pages/ServerErrorPage';
import NodeControlPage from './pages/NodeControlPage';
import MorePage from './pages/MorePage';

// Pages — lazily loaded (heavy pages)
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AIAssistantPage = lazy(() => import('./pages/AIAssistantPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

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
    <div className="min-h-screen pt-16 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-200">
      {/* Top Navbar */}
      <Navbar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      
      <div className="flex flex-1">
        {/* Left Navigation Sidebar */}
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        
        {/* Main Content Area — full width on mobile (sidebar is overlay), indent only on lg+ */}
        <main
          className={`flex-1 w-full min-w-0 ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'} transition-all duration-300 min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-x-hidden`}
          role="main"
        >
          <div className={isAssistant ? 'p-0 h-[calc(100dvh-4rem)] flex flex-col flex-1 min-h-0 overflow-hidden' : 'p-3 sm:p-6 lg:p-8 pb-28 lg:pb-8 w-full flex-1'}>
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <motion.div
                  key={location.pathname}
                  initial={{ opacity: 0, y: 16, scale: 0.995 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className={`w-full ${isAssistant ? 'h-full flex-1 flex flex-col min-h-0' : ''}`}
                >
                  <Outlet />
                </motion.div>
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

import { useColorTheme } from './hooks/useColorTheme';

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
                    <Route path="/farm-settings" element={<Navigate to="/farm" replace />} />
                    <Route path="/farm-info" element={<Navigate to="/farm" replace />} />
                    <Route path="/crop-advisory" element={<CropAdvisoryPage />} />
                    <Route path="/market" element={<MarketPricesPage />} />
                    <Route path="/crop-prices" element={<Navigate to="/market" replace />} />
                    <Route path="/upload" element={<UploadImagePage />} />
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
                    <Route path="/admin" element={<AdminPage />} />
                    <Route path="/admin/*" element={<AdminPage />} />
                    <Route path="/admin-panel" element={<Navigate to="/admin" replace />} />
                    <Route path="/scan" element={<Navigate to="/upload" replace />} />
                    <Route path="/ai-scan" element={<Navigate to="/upload" replace />} />
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
