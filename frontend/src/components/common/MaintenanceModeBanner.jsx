import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Wrench, Clock, X, ShieldAlert } from 'lucide-react';
import API from '../../services/api';

// Custom event name for instant cross-tab / cross-component communication
const MAINTENANCE_EVENT = 'agrishield-maintenance-updated';

/**
 * Shared hook to query and subscribe to platform maintenance mode status.
 * Used across AppLayout, ProfilePage, FarmPage, UploadImagePage, etc.
 */
export const useMaintenanceMode = () => {
  const [maintenance, setMaintenance] = useState({
    enabled: false,
    message: '',
    estimated_minutes: 15,
    updated_at: null
  });
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      let res;
      try {
        res = await API.get('/api/maintenance');
      } catch {
        try {
          res = await API.get('/api/v1/maintenance');
        } catch {
          res = await API.get('/api/admin/maintenance');
        }
      }
      if (res.data?.maintenance) {
        setMaintenance(res.data.maintenance);
      }
    } catch (_) {
      // Graceful silence on network retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();

    // 1. Periodic poll every 8 seconds
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStatus();
      }
    }, 8000);

    // 2. Instant local event listener (triggered immediately when Admin toggles button)
    const handleLocalEvent = (e) => {
      if (e.detail) {
        setMaintenance(prev => ({
          ...prev,
          ...(typeof e.detail === 'boolean' ? { enabled: e.detail } : e.detail)
        }));
      } else {
        fetchStatus();
      }
    };
    window.addEventListener(MAINTENANCE_EVENT, handleLocalEvent);
    window.addEventListener('maintenance-updated', handleLocalEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener(MAINTENANCE_EVENT, handleLocalEvent);
      window.removeEventListener('maintenance-updated', handleLocalEvent);
    };
  }, [fetchStatus]);

  return {
    isMaintenanceMode: Boolean(maintenance?.enabled),
    maintenanceMessage: maintenance?.message || 'AgriShield AI is undergoing scheduled cloud maintenance. AI inference and profile edits will resume shortly.',
    estimatedMinutes: maintenance?.estimated_minutes || 15,
    maintenance,
    refreshMaintenance: fetchStatus,
    loading
  };
};

/**
 * Global Top Banner displayed across all farmer & public views when maintenance is engaged.
 */
export const MaintenanceModeBanner = () => {
  const { isMaintenanceMode, maintenanceMessage, estimatedMinutes } = useMaintenanceMode();
  const [collapsed, setCollapsed] = useState(false);

  if (!isMaintenanceMode) return null;

  if (collapsed) {
    return (
      <div className="fixed top-16 right-4 z-50 animate-bounce">
        <button
          onClick={() => setCollapsed(false)}
          className="px-3 py-1.5 rounded-full bg-rose-600 text-white font-black text-[11px] shadow-lg flex items-center gap-1.5 cursor-pointer hover:bg-rose-700"
          title="Click to view maintenance details"
        >
          <Wrench className="w-3.5 h-3.5" />
          <span>Maintenance Active (~{estimatedMinutes}m)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-full bg-gradient-to-r from-rose-600 via-rose-700 to-amber-600 text-white shadow-md z-40 relative transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="p-1.5 rounded-xl bg-white/20 backdrop-blur-md shrink-0 animate-pulse">
            <AlertTriangle className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-black uppercase tracking-wider text-[11px] bg-white/20 px-2 py-0.5 rounded-full">
                Scheduled Maintenance Active
              </span>
              <span className="text-[11px] font-semibold text-rose-100 flex items-center gap-1">
                <Clock className="w-3 h-3 inline" />
                Est. Duration: ~{estimatedMinutes} mins
              </span>
            </div>
            <p className="text-white/90 text-[11px] sm:text-xs truncate font-medium mt-0.5">
              {maintenanceMessage} (Data edits & AI crop scans are temporarily paused to protect data integrity).
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            onClick={() => setCollapsed(true)}
            className="p-1 rounded-lg hover:bg-white/20 text-rose-100 hover:text-white transition-colors cursor-pointer"
            title="Minimize alert banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MaintenanceModeBanner;

