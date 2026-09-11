import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, AlertCircle, X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPendingOfflineScans, removeOfflineScan, clearAllOfflineScans, dataUrlToFile } from '../../utils/offlineQueue';
import API from '../../services/api';
import OfflineSyncDrawer from './OfflineSyncDrawer';

export const OfflineStatusBar = () => {
  const { t } = useTranslation();
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [pendingCount, setPendingCount] = useState(0);
  const [prevCount, setPrevCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [syncErrorMsg, setSyncErrorMsg] = useState('');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      const pending = await getPendingOfflineScans();
      setPendingCount(pending.length);
    } catch {
      setPendingCount(0);
    }
  }, []);

  // Re-display notification whenever new scans are added to queue
  useEffect(() => {
    if (pendingCount > prevCount) {
      setIsDismissed(false);
    }
    setPrevCount(pendingCount);
  }, [pendingCount, prevCount]);

  useEffect(() => {
    refreshPendingCount();

    const handleOnline = () => {
      setIsOnline(true);
      setIsDismissed(false);
      refreshPendingCount();
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsDismissed(false);
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
    setSyncErrorMsg('');

    try {
      const pending = await getPendingOfflineScans();
      if (!pending || pending.length === 0) {
        setIsSyncing(false);
        return;
      }

      let syncedCount = 0;
      let hasFailedItem = false;

      for (const item of pending) {
        try {
          const file = dataUrlToFile(item.dataUrl, item.fileName);
          const formData = new FormData();
          formData.append('file', file);

          const uploadRes = await API.post('/api/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          // Check all possible return keys: image_path, filepath, file_path
          const uploadedPath = uploadRes.data?.image_path || uploadRes.data?.filepath || uploadRes.data?.file_path;

          if (uploadedPath) {
            let endpoint = '/api/predict';
            let payload = {
              image_path: uploadedPath,
              explainer_type: 'gradcam++',
              language: item.language || 'en'
            };

            if (item.tabId === 'plant-id') {
              endpoint = '/api/identify-plant';
            } else if (item.tabId === 'agro-scan') {
              endpoint = '/api/agrochemical-scan';
            } else if (item.cropFilter) {
              payload.crop_filter = item.cropFilter;
            }

            await API.post(endpoint, payload);
            await removeOfflineScan(item.id);
            syncedCount++;
          } else {
            console.error(`Upload succeeded but no image_path returned for item ${item.id}`, uploadRes.data);
            hasFailedItem = true;
          }
        } catch (itemErr) {
          console.error(`Failed syncing scan item ${item.id}:`, itemErr);
          const status = itemErr.response?.status;
          if (status === 400 || status === 422) {
            // Unprocessable or invalid format
            hasFailedItem = true;
          }
        }
      }

      await refreshPendingCount();

      if (syncedCount > 0) {
        setSyncSuccessMsg(t('offline.sync_success', `Successfully synced ${syncedCount} offline field scan(s)!`, { count: syncedCount }));
        // Notify History & Dashboard pages to refresh live data
        window.dispatchEvent(new CustomEvent('agrishield-sync-completed', { detail: { syncedCount } }));
        setTimeout(() => setSyncSuccessMsg(''), 6000);
      } else if (hasFailedItem) {
        setSyncErrorMsg(t('offline.sync_failed', 'Could not process offline scan. Image may be unreadable or corrupt.'));
      }
    } catch (err) {
      console.error('Batch offline sync error:', err);
      setSyncErrorMsg('Network error during sync. Please try again.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDiscardAll = async () => {
    try {
      await clearAllOfflineScans();
      await refreshPendingCount();
      setSyncErrorMsg('');
      setIsDismissed(true);
    } catch (e) {
      console.error('Error clearing queue:', e);
    }
  };

  // If online and no pending scans and no notifications, render nothing
  if (isOnline && pendingCount === 0 && !syncSuccessMsg && !syncErrorMsg) {
    return null;
  }

  return (
    <AnimatePresence>
      {!isDismissed && (
        <div className="fixed top-16 inset-x-0 z-40 px-3 py-1.5 flex justify-center pointer-events-none">
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.7}
            onDragEnd={(e, info) => {
              // Dismiss if swiped up or flicked with sufficient offset/velocity
              if (
                info.offset.y < -20 ||
                Math.abs(info.offset.x) > 70 ||
                info.velocity.y < -200 ||
                Math.abs(info.velocity.x) > 300
              ) {
                setIsDismissed(true);
              }
            }}
            initial={{ opacity: 0, y: -30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className={`pointer-events-auto max-w-lg w-full rounded-2xl p-2.5 px-3.5 shadow-2xl backdrop-blur-md border flex flex-col gap-1.5 text-xs select-none touch-pan-x cursor-grab active:cursor-grabbing ${
              !isOnline
                ? 'bg-amber-100 text-amber-950 border-amber-300 shadow-amber-900/10 dark:bg-amber-950/95 dark:text-amber-200 dark:border-amber-600/50 dark:shadow-amber-950/30'
                : syncSuccessMsg
                ? 'bg-emerald-100 text-emerald-950 border-emerald-300 shadow-emerald-900/10 dark:bg-emerald-950/95 dark:text-emerald-200 dark:border-emerald-600/50 dark:shadow-emerald-950/30'
                : syncErrorMsg
                ? 'bg-rose-100 text-rose-950 border-rose-300 shadow-rose-900/10 dark:bg-rose-950/95 dark:text-rose-200 dark:border-rose-600/50 dark:shadow-rose-950/30'
                : 'bg-sky-100 text-sky-950 border-sky-300 shadow-sky-900/10 dark:bg-sky-950/95 dark:text-sky-200 dark:border-sky-600/50 dark:shadow-sky-950/30'
            }`}
          >
            {/* Draggable indicator bar for tactile touch affordance */}
            <div className="w-8 h-1 bg-black/15 hover:bg-black/25 dark:bg-white/25 dark:hover:bg-white/40 rounded-full mx-auto -mt-0.5 transition-colors" />

            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {!isOnline ? (
                  <WifiOff className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                ) : syncSuccessMsg ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : syncErrorMsg ? (
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                ) : (
                  <Wifi className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                )}

                <div 
                  onClick={() => pendingCount > 0 && setIsDrawerOpen(true)}
                  className={`truncate font-semibold text-[11.5px] ${pendingCount > 0 ? 'cursor-pointer hover:underline' : ''}`}
                  title={pendingCount > 0 ? "Click to view offline scans tray" : ""}
                >
                  {!isOnline ? (
                    <span>
                      <strong className="font-black">{t('offline.field_offline_mode', 'Field Offline Mode:')}</strong>{' '}
                      {pendingCount > 0 ? t('offline.scans_queued', '{{count}} scan(s) queued', { count: pendingCount }) : t('offline.save_locally', 'Scans will save locally')}
                    </span>
                  ) : syncSuccessMsg ? (
                    <span className="text-emerald-800 dark:text-emerald-300 font-bold">{syncSuccessMsg}</span>
                  ) : syncErrorMsg ? (
                    <span className="text-rose-800 dark:text-rose-300 font-bold">{syncErrorMsg}</span>
                  ) : (
                    <span>
                      <strong className="font-black">{t('offline.connection_restored', 'Connection Restored:')}</strong> {t('offline.scans_ready', '{{count}} offline scan(s) ready to sync', { count: pendingCount })}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsDrawerOpen(true)}
                    className="px-2 py-1 rounded-xl bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 active:scale-95 font-bold text-[11px] transition-all cursor-pointer"
                  >
                    Tray ({pendingCount})
                  </button>
                )}

                {isOnline && pendingCount > 0 && !syncSuccessMsg && (
                  <button
                    type="button"
                    onClick={handleSyncAll}
                    disabled={isSyncing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-[11px] shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? t('offline.syncing', 'Syncing...') : t('offline.sync_now', 'Sync Now')}</span>
                  </button>
                )}

                {/* If error occurred, provide Discard button */}
                {syncErrorMsg && pendingCount > 0 && (
                  <button
                    type="button"
                    onClick={handleDiscardAll}
                    title={t('offline.discard', 'Discard pending queue')}
                    className="flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-200 dark:bg-rose-500/20 hover:bg-rose-300 dark:hover:bg-rose-500/30 text-rose-900 dark:text-rose-200 text-[10.5px] font-bold border border-rose-300 dark:border-rose-500/30 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3 text-rose-700 dark:text-rose-300" />
                    <span>{t('offline.discard', 'Discard')}</span>
                  </button>
                )}

                {/* 1-Tap Slide/Dismiss X Button */}
                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  title={t('offline.dismiss', 'Dismiss banner')}
                  className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/20 active:scale-90 text-slate-600 dark:text-white/70 hover:text-slate-900 dark:hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Offline Scans Management Drawer */}
      <OfflineSyncDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </AnimatePresence>
  );
};

export default OfflineStatusBar;
