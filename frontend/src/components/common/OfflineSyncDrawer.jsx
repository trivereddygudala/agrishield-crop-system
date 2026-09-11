import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, RefreshCw, Trash2, CheckCircle2, AlertTriangle, 
  ExternalLink, Leaf, Eye, ShieldCheck, Sprout, Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  getPendingOfflineScans, 
  removeOfflineScan, 
  clearAllOfflineScans, 
  dataUrlToFile 
} from '../../utils/offlineQueue';
import API from '../../services/api';

export const OfflineSyncDrawer = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingId, setSyncingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const loadScans = async () => {
    try {
      const items = await getPendingOfflineScans();
      setScans(items);
    } catch (e) {
      console.error('Failed to load pending offline scans:', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadScans();
    }
    const handleUpdate = () => loadScans();
    window.addEventListener('agrishield-offline-scans-updated', handleUpdate);
    return () => window.removeEventListener('agrishield-offline-scans-updated', handleUpdate);
  }, [isOpen]);

  const handleSyncItem = async (item) => {
    if (!navigator.onLine) {
      setStatusMessage('⚠️ Device is offline. Reconnect to internet to sync.');
      return;
    }
    setSyncingId(item.id);
    try {
      const file = dataUrlToFile(item.dataUrl, item.fileName);
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await API.post('/api/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      const uploadedPath = uploadRes.data?.image_path || uploadRes.data?.filepath || uploadRes.data?.file_path;

      if (uploadedPath) {
        let endpoint = '/api/predict';
        let payload = {
          image_path: uploadedPath,
          explainer_type: 'gradcam++',
          language: item.language || i18n.language || 'en'
        };

        if (item.tabId === 'plant-id') endpoint = '/api/identify-plant';
        else if (item.tabId === 'agro-scan') endpoint = '/api/agrochemical-scan';
        else if (item.cropFilter) payload.crop_filter = item.cropFilter;

        const predRes = await API.post(endpoint, payload);
        await removeOfflineScan(item.id);
        await loadScans();

        setStatusMessage(`✓ Synced ${item.cropFilter || 'crop'} scan successfully!`);
        window.dispatchEvent(new CustomEvent('agrishield-sync-completed', { detail: { syncedCount: 1 } }));

        // Navigate to result if desired
        navigate('/result', {
          state: {
            imagePath: uploadedPath,
            previewUrl: item.dataUrl,
            initialResult: predRes.data
          }
        });
        onClose();
      }
    } catch (err) {
      console.error('Failed to sync item:', err);
      setStatusMessage('❌ Cloud sync failed. Check server status.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    if (!navigator.onLine || scans.length === 0) return;
    setIsSyncing(true);
    let successCount = 0;

    for (const item of scans) {
      try {
        const file = dataUrlToFile(item.dataUrl, item.fileName);
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await API.post('/api/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const uploadedPath = uploadRes.data?.image_path || uploadRes.data?.filepath || uploadRes.data?.file_path;
        if (uploadedPath) {
          const payload = {
            image_path: uploadedPath,
            explainer_type: 'gradcam++',
            language: item.language || 'en'
          };
          if (item.cropFilter) payload.crop_filter = item.cropFilter;
          await API.post('/api/predict', payload);
          await removeOfflineScan(item.id);
          successCount++;
        }
      } catch (e) {
        console.error('Batch sync item error:', e);
      }
    }

    await loadScans();
    setIsSyncing(false);
    setStatusMessage(`✓ Completed batch sync: ${successCount} scan(s) uploaded!`);
    window.dispatchEvent(new CustomEvent('agrishield-sync-completed', { detail: { syncedCount: successCount } }));
  };

  const handleViewTriage = (item) => {
    if (item.offlineTriage) {
      navigate('/result', {
        state: {
          previewUrl: item.dataUrl,
          offlineTriage: item.offlineTriage,
          isOfflineScan: true
        }
      });
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Slide-over Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md bg-slate-900 text-slate-100 shadow-2xl border-l border-slate-800 flex flex-col"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Leaf className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Offline Field Scans</h3>
                  <p className="text-xs text-slate-400">
                    {scans.length} {scans.length === 1 ? 'scan saved locally' : 'scans saved locally'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status Message */}
            {statusMessage && (
              <div className="px-4 py-2 bg-emerald-950/50 border-b border-emerald-800/40 text-emerald-300 text-xs font-semibold flex items-center justify-between">
                <span>{statusMessage}</span>
                <button type="button" onClick={() => setStatusMessage('')} className="text-emerald-400 hover:text-white">✕</button>
              </div>
            )}

            {/* Content List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {scans.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-400">Queue is Clear</p>
                  <p className="text-xs max-w-xs">All field photographs have been synchronized with the cloud model.</p>
                </div>
              ) : (
                scans.map((item) => {
                  const triage = item.offlineTriage;
                  const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col gap-2.5"
                    >
                      <div className="flex items-start gap-3">
                        <img
                          src={item.dataUrl}
                          alt="Field scan"
                          className="w-16 h-16 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-emerald-400 truncate">
                              {triage ? triage.disease_name : item.cropFilter || 'Field Scan'}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" /> {dateStr}
                            </span>
                          </div>

                          {triage && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                triage.severity === 'Severe' 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  : triage.severity === 'Moderate'
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}>
                                {triage.severity}
                              </span>
                              <span className="text-slate-400 text-[10px]">
                                {(triage.confidence * 100).toFixed(0)}% AI Triage
                              </span>
                              {triage.metrics && (
                                <span className="text-slate-500 text-[10px]">
                                  • {triage.metrics.necrosisPct}% Lesion
                                </span>
                              )}
                            </div>
                          )}

                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
                            {triage?.organic_treatment || 'Waiting for network connection to run PyTorch deep learning.'}
                          </p>
                        </div>
                      </div>

                      {/* Action Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-xs">
                        {triage ? (
                          <button
                            type="button"
                            onClick={() => handleViewTriage(item)}
                            className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-bold"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Triage Report
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500">Unprocessed</span>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSyncItem(item)}
                            disabled={syncingId === item.id || !navigator.onLine}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] disabled:opacity-40 transition-colors"
                          >
                            <RefreshCw className={`w-3 h-3 ${syncingId === item.id ? 'animate-spin' : ''}`} />
                            {syncingId === item.id ? 'Syncing...' : 'Sync Now'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await removeOfflineScan(item.id);
                              await loadScans();
                            }}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {scans.length > 0 && (
              <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Discard all offline field scans?')) {
                      await clearAllOfflineScans();
                      await loadScans();
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 text-xs font-bold transition-colors"
                >
                  Clear Queue
                </button>

                <button
                  type="button"
                  onClick={handleSyncAll}
                  disabled={isSyncing || !navigator.onLine}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-950 disabled:opacity-40 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Syncing All...' : `Sync All (${scans.length})`}
                </button>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default OfflineSyncDrawer;
