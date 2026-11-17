import React, { useState, useEffect } from 'react';
import { Zap, CheckCircle2, RotateCcw } from 'lucide-react';
import {
  subscribeModelDownloadProgress,
  isFullModelCached,
  isAnyModelCached
} from '../../utils/chunkedModelDownloader';

const OfflineStorageModal = React.lazy(() => import('./OfflineStorageModal'));

export const OfflineAiStatusPill = ({ className = '' }) => {
  const [downloadState, setDownloadState] = useState({
    status: 'idle',
    percent: 0,
    bytesLoaded: 0,
    totalBytes: 87012722
  });
  const [isCached, setIsCached] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    // Check initial cache state
    isAnyModelCached().then(cached => setIsCached(cached)).catch(() => {});

    // Subscribe to streaming download updates
    const unsubscribe = subscribeModelDownloadProgress((state) => {
      setDownloadState(state);
      if (state.status === 'cached' || state.percent >= 100) {
        setIsCached(true);
      }
    });

    return () => unsubscribe();
  }, []);

  const isDownloading = downloadState.status === 'downloading';

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        type="button"
        title={
          isDownloading
            ? `Downloading High-Precision 87MB AI Model: ${downloadState.percent}%`
            : isCached
            ? 'Edge AI Ready: 100% Offline & RAM-Only (Zero Render Compute)'
            : 'Edge AI: Tap to View Offline Storage & Model Setup'
        }
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold border transition-all select-none ${
          isDownloading
            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 animate-pulse'
            : isCached
            ? 'bg-emerald-50/80 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
            : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
        } ${className}`}
      >
        {isDownloading ? (
          <>
            <RotateCcw className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="font-mono">{downloadState.percent}%</span>
            <span className="hidden md:inline text-[11px] font-normal text-blue-600/80 dark:text-blue-300/80">
              (87MB AI)
            </span>
          </>
        ) : isCached ? (
          <>
            <Zap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 fill-emerald-500/20 shrink-0" />
            <span className="hidden sm:inline">Edge AI</span>
            <span className="hidden xl:inline text-[10px] uppercase font-bold text-emerald-600/80 dark:text-emerald-400/80">
              (RAM Only)
            </span>
            <span className="sm:hidden">Edge AI</span>
          </>
        ) : (
          <>
            <Zap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="hidden sm:inline">Setup Offline AI</span>
            <span className="sm:hidden">AI Setup</span>
          </>
        )}
      </button>

      {/* Storage and Diagnostic Management Modal */}
      {modalOpen && (
        <React.Suspense fallback={null}>
          <OfflineStorageModal
            isOpen={modalOpen}
            onClose={() => {
              setModalOpen(false);
              isAnyModelCached().then(cached => setIsCached(cached)).catch(() => {});
            }}
          />
        </React.Suspense>
      )}
    </>
  );
};

export default OfflineAiStatusPill;
