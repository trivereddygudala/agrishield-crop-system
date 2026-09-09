import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertCircle, UploadCloud } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPendingOfflineScans, removeOfflineScan, dataUrlToFile } from '../../utils/offlineQueue';
import API from '../../services/api';

export const OfflineStatusBar = () => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingOfflineScans();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      refreshPendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      refreshPendingCount();
    };

    const handleQueueUpdate = () => {
      refreshPendingCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('agrishield-offline-scans-updated', handleQueueUpdate);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('agrishield-offline-scans-updated', handleQueueUpdate);
    };
  }, [refreshPendingCount]);

  const handleSyncAll = async () => {
    if (!navigator.onLine || isSyncing) return;
    setIsSyncing(true);

    try {
      const pending = await getPendingOfflineScans();
      let syncedCount = 0;

      for (const item of pending) {
        try {
          const file = dataUrlToFile(item.dataUrl, item.fileName);
          const formData = new FormData();
          formData.append('file', file);

          const uploadRes = await API.post('/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          if (uploadRes.data?.filepath) {
            let endpoint = '/api/predict-pytorch';
            let payload = {
              image_path: uploadRes.data.filepath,
              explainer_type: 'gradcam++',
              language: item.language || 'en'
            };

            if (item.tabId === 'plant-id') {
              endpoint = '/api/identify-plant';
            } else if (item.tabId === 'agro-scan') {
              endpoint = '/api/scan-agrochemical';
            } else if (item.cropFilter) {
              payload.crop_filter = item.cropFilter;
            }

            await API.post(endpoint, payload);
            await removeOfflineScan(item.id);
            syncedCount++;
          }
        } catch (itemErr) {
          console.error(`Failed syncing scan item ${item.id}:`, itemErr);
        }
      }

      await refreshPendingCount();
      if (syncedCount > 0) {
        setSyncSuccessMsg(`Successfully synced ${syncedCount} offline field scan(s)!`);
        setTimeout(() => setSyncSuccessMsg(''), 6000);
      }
    } catch (err) {
      console.error('Batch offline sync error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // If online and no pending scans and no success message, render nothing
  if (isOnline && pendingCount === 0 && !syncSuccessMsg) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-16 inset-x-0 z-40 px-3 py-1 flex justify-center pointer-events-none"
      >
        <div className={`pointer-events-auto max-w-lg w-full rounded-2xl p-2.5 px-4 shadow-xl backdrop-blur-md border flex items-center justify-between gap-3 text-xs ${
          !isOnline 
            ? 'bg-amber-950/90 text-amber-200 border-amber-600/40 shadow-amber-900/20'
            : syncSuccessMsg
            ? 'bg-emerald-950/90 text-emerald-200 border-emerald-600/40 shadow-emerald-900/20'
            : 'bg-sky-950/90 text-sky-200 border-sky-600/40 shadow-sky-900/20'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {!isOnline ? (
              <WifiOff className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            ) : syncSuccessMsg ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Wifi className="w-4 h-4 text-sky-400 shrink-0" />
            )}

            <div className="truncate font-medium">
              {!isOnline ? (
                <span>
                  <strong>Field Offline Mode:</strong> {pendingCount > 0 ? `${pendingCount} scan(s) queued` : 'Scans will save locally'}
                </span>
              ) : syncSuccessMsg ? (
                <span className="text-emerald-300 font-bold">{syncSuccessMsg}</span>
              ) : (
                <span>
                  <strong>Connection Restored:</strong> {pendingCount} offline scan(s) ready to sync
                </span>
              )}
            </div>
          </div>

          {isOnline && pendingCount > 0 && (
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OfflineStatusBar;
