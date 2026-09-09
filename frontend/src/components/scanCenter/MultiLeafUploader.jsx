import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Image as ImageIcon, 
  Plus, 
  Trash2, 
  X, 
  UploadCloud, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Sprout, 
  Sparkles, 
  RefreshCw,
  Compass,
  MapPin
} from 'lucide-react';
import { Card, Button, Badge } from '../ui/index';
import { compressImageForUpload } from '../../utils/imageCompression';

const DEFAULT_SAMPLE_LABELS = [
  'North-East Corner',
  'Field Center Plot',
  'South-West Corner',
  'Upper Canopy',
  'Lower Foliage Near Soil'
];

export default function MultiLeafUploader({
  samples = [],
  onAddSample,
  onRemoveSample,
  onClearAll,
  onStartBatchScan,
  loading = false,
  errorMsg = '',
  selectedCropFilter = '',
  onCropFilterChange
}) {
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const [activeSlotIdx, setActiveSlotIdx] = useState(null);

  const handleFilesChosen = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (let i = 0; i < files.length; i++) {
      if (samples.length + i >= 5) break; // Maximum 5 samples
      const file = files[i];
      try {
        const comp = await compressImageForUpload(file);
        const slot = activeSlotIdx !== null ? activeSlotIdx : samples.length;
        const label = DEFAULT_SAMPLE_LABELS[slot] || `Plot Zone #${slot + 1}`;
        
        onAddSample({
          file: comp.file,
          previewUrl: URL.createObjectURL(comp.file),
          label: label,
          id: Date.now() + i
        });
      } catch (err) {
        console.warn("Compression failed for batch file, using original:", err);
        const slot = activeSlotIdx !== null ? activeSlotIdx : samples.length;
        onAddSample({
          file: file,
          previewUrl: URL.createObjectURL(file),
          label: DEFAULT_SAMPLE_LABELS[slot] || `Plot Zone #${slot + 1}`,
          id: Date.now() + i
        });
      }
    }
    setActiveSlotIdx(null);
    e.target.value = '';
  };

  return (
    <Card glass className="p-5 sm:p-6 border-slate-200/80 dark:border-white/10 shadow-xl space-y-5">
      {/* Hidden File & Camera Inputs */}
      <input
        type="file"
        accept="image/*"
        multiple
        ref={fileInputRef}
        onChange={handleFilesChosen}
        className="hidden"
      />
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        onChange={handleFilesChosen}
        className="hidden"
      />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                Multi-Leaf Plot Sampling (2 to 5 Leaves)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sample leaves from different corners of your field to determine the whole-plot infection rate.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={samples.length >= 2 ? "healthy" : "default"} className="px-2.5 py-1 text-xs font-extrabold">
            {samples.length} / 5 Leaves Selected
          </Badge>
          {samples.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Clear all samples"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 5 Sample Slots Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[0, 1, 2, 3, 4].map((idx) => {
          const sample = samples[idx];
          const defaultLabel = DEFAULT_SAMPLE_LABELS[idx];

          if (sample) {
            return (
              <motion.div
                key={sample.id || idx}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-2xl overflow-hidden border-2 border-emerald-500/60 dark:border-emerald-500/40 bg-slate-100 dark:bg-slate-900 aspect-square shadow-md group"
              >
                <img
                  src={sample.previewUrl}
                  alt={sample.label}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-2 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[9px] font-black text-emerald-400 uppercase">
                      #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveSample(idx)}
                      className="p-1 rounded-full bg-black/60 hover:bg-rose-600 text-white transition-colors"
                      title="Remove sample"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="text-[10px] font-bold text-white truncate block">
                    {sample.label || defaultLabel}
                  </span>
                </div>
              </motion.div>
            );
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setActiveSlotIdx(idx);
                cameraInputRef.current?.click();
              }}
              className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/60 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/20 aspect-square p-3 flex flex-col items-center justify-center text-center transition-all group"
            >
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-800 group-hover:bg-emerald-500/20 text-slate-400 group-hover:text-emerald-500 flex items-center justify-center transition-colors mb-1.5">
                <Camera className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-300 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 block truncate w-full">
                + Leaf #{idx + 1}
              </span>
              <span className="text-[8px] text-slate-400 font-semibold block truncate w-full">
                {defaultLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={samples.length >= 5 || loading}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
          >
            <Camera className="w-4 h-4 text-emerald-500" />
            <span>Take Photo</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={samples.length >= 5 || loading}
            className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-40"
          >
            <ImageIcon className="w-4 h-4 text-teal-500" />
            <span>Choose from Gallery</span>
          </button>
        </div>

        {/* Start Diagnostic Analysis Button */}
        <button
          type="button"
          onClick={onStartBatchScan}
          disabled={samples.length < 2 || loading}
          className={`px-5 py-2.5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
            samples.length >= 2 && !loading
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Diagnosing {samples.length} Field Samples...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Analyze Entire Field Plot ({samples.length} Samples)</span>
            </>
          )}
        </button>
      </div>

      {samples.length < 2 && (
        <p className="text-[11px] text-slate-400 text-center font-medium pt-1">
          💡 Please add at least <strong>2 leaf samples</strong> (e.g. one from plot edge and one from plot center) to calculate the field infection percentage.
        </p>
      )}
    </Card>
  );
}
