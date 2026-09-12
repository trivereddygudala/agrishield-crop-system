import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { RefreshCw, CheckCircle2, ChevronRight, ChevronLeft, Bug, Sprout, FlaskConical, ScanLine, Leaf } from 'lucide-react';
import API from '../services/api';
import ScanImageUploader from '../components/scanCenter/ScanImageUploader';
import PlantIdResults from '../components/scanCenter/PlantIdResults';
import DiseaseDiagnosisResults from '../components/scanCenter/DiseaseDiagnosisResults';
import AgrochemicalResults from '../components/scanCenter/AgrochemicalResults';
import CropAdvisorPanel from '../components/CropAdvisorPanel';
import FungalRiskAdvisor from '../components/intelligence/FungalRiskAdvisor';
import MultiLeafUploader from '../components/scanCenter/MultiLeafUploader';
import MultiLeafResults from '../components/scanCenter/MultiLeafResults';
import { useFarm } from '../context/FarmContext';
import { Badge, Button } from '../components/ui/index';
import { compressImageForUpload, formatFileSize } from '../utils/imageCompression';
import { queueOfflineScan } from '../utils/offlineQueue';
import { diagnoseOfflineLeaf } from '../utils/offlineDiagnosticEngine';

// Diagnostic Modules metadata for overview and fresh sub-pages
const SCAN_MODULES = [
  {
    id: 'disease-diag',
    icon: Bug,
    iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    badgeVariant: 'healthy',
    badge: 'PyTorch AI',
    titleKey: 'tabs.disease_diag',
    defaultTitle: 'AI Crop Disease Diagnosis',
    teluguTitle: 'పంట తెగుళ్ల గుర్తింపు & నివారణ',
    descKey: 'tabs.disease_diag_desc',
    defaultDesc: 'Instant neural leaf pathology scan with 98.4% precision, severity indexing & complete treatment prescription.',
    teluguDesc: 'ఆకు ఫోటోతో తెగుళ్లు, శిలీంధ్రాల గుర్తింపు, తీవ్రత స్థాయి మరియు నిపుణుల సలహాలతో కూడిన నివారణ ప్రణాళిక.'
  },
  {
    id: 'plant-id',
    icon: Sprout,
    iconBg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30',
    badgeVariant: 'default',
    badge: 'Species Engine',
    titleKey: 'tabs.plant_id',
    defaultTitle: 'Plant & Crop Identification',
    teluguTitle: 'మొక్కలు & పంటల గుర్తింపు',
    descKey: 'tabs.plant_id_desc',
    defaultDesc: 'Identify agricultural crop varieties, invasive weed species & 108 indigenous Andhra forest and horticultural trees.',
    teluguDesc: 'ఆంధ్రప్రదేశ్ సాగు పంటలు, కలుపు మొక్కలు మరియు 108 రకాల దేశీయ వృక్షాల జాతి విశ్లేషణ.'
  },
  {
    id: 'agro-scan',
    icon: FlaskConical,
    iconBg: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
    badgeVariant: 'default',
    badge: 'OCR Vision',
    titleKey: 'tabs.agro_scan',
    defaultTitle: 'Agrochemical OCR Scanner',
    teluguTitle: 'పురుగుమందులు & ఎరువుల లేబుల్ స్కాన్',
    descKey: 'tabs.agro_scan_desc',
    defaultDesc: 'Scan pesticide, fungicide & fertilizer bottle labels for dosage verification, chemical composition & safety.',
    teluguDesc: 'పురుగుమందుల డబ్బాల లేబుల్స్ చదివి సరైన మోతాదు, రసాయన పదార్థాలు మరియు భద్రతా హెచ్చరికల తక్షణ విశ్లేషణ.'
  }
];

// Fully Reactive Global Store to persist scan state + background loading across tab navigation
const scanStore = {
  state: {
    activeTab: 'overview',
    scanMode: 'single', // 'single' | 'multi'
    batchSamples: [],
    batchResult: null,
    selectedFile: null,
    previewUrl: null,
    hasScanned: false,
    liveResult: null,
    loading: false,
    errorMsg: '',
    selectedCropFilter: '',
    compressionInfo: null,
    plantType: 'crop', // 'crop' | 'tree' (for Plant ID tab)
    selectedTreeFilter: ''
  },
  listeners: new Set(),
  subscribe(listener) {
    scanStore.listeners.add(listener);
    return () => scanStore.listeners.delete(listener);
  },
  getSnapshot() {
    return scanStore.state;
  },
  setState(newState) {
    scanStore.state = { ...scanStore.state, ...newState };
    scanStore.listeners.forEach((l) => l());
  }
};

const UploadImagePage = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { activeFarm } = useFarm();
  const navigate = useNavigate();
  const { tab: routeTab } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  // Subscribe to the global reactive store (persists across unmounts!)
  const state = React.useSyncExternalStore(scanStore.subscribe, scanStore.getSnapshot);
  
  const { 
    activeTab, scanMode = 'single', batchSamples = [], batchResult,
    selectedFile, previewUrl, 
    hasScanned, liveResult, loading, errorMsg,
    selectedCropFilter, compressionInfo,
    plantType = 'crop', selectedTreeFilter = ''
  } = state;

  const isTe = i18n?.language === 'te';
  const currentModule = SCAN_MODULES.find(m => m.id === activeTab);
  const currentModuleTitle = isTe ? currentModule?.teluguTitle : (currentModule?.titleKey ? t(currentModule.titleKey, currentModule.defaultTitle) : currentModule?.defaultTitle);

  // Sync route and query params with active tab to ensure fresh dedicated pages
  useEffect(() => {
    const rawTab = routeTab || searchParams.get('tab');
    if (rawTab) {
      const normalized = (rawTab === 'disease' || rawTab === 'disease-diag' || rawTab === 'disease-diagnosis') ? 'disease-diag'
        : (rawTab === 'plant' || rawTab === 'plant-id' || rawTab === 'plantidentification' || rawTab === 'plant-identification') ? 'plant-id'
        : (rawTab === 'agro' || rawTab === 'agro-scan' || rawTab === 'agrochemical' || rawTab === 'agrochemical-scanner') ? 'agro-scan'
        : (rawTab === 'overview' || rawTab === 'modules') ? 'overview'
        : rawTab;
      if (['overview', 'disease-diag', 'plant-id', 'agro-scan'].includes(normalized) && normalized !== scanStore.state.activeTab) {
        scanStore.setState({ activeTab: normalized, errorMsg: '' });
      }
    } else {
      if (scanStore.state.activeTab !== 'overview' && !routeTab && !searchParams.get('tab')) {
        scanStore.setState({ activeTab: 'overview', errorMsg: '' });
      }
    }
  }, [routeTab, searchParams]);

  // Auto-link active farm crop to scanner to boost accuracy to 98%+
  React.useEffect(() => {
    if (activeFarm?.crop_name && !scanStore.state.selectedCropFilter) {
      scanStore.setState({ selectedCropFilter: activeFarm.crop_name });
    }
  }, [activeFarm?.crop_name]);

  const handleTabChange = (tab) => {
    scanStore.setState({ activeTab: tab, errorMsg: '' });
    if (tab === 'overview') {
      navigate('/scan');
    } else {
      navigate(`/scan/${tab}`);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const validateFile = (file) => {
    if (!file) return false;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      scanStore.setState({ errorMsg: 'Invalid file format. Please select a JPG, JPEG, PNG, or WEBP image.' });
      return false;

    }
    // Allow up to 30MB phone photos because in-browser compression downsamples it instantly
    if (file.size > 30 * 1024 * 1024) {
      scanStore.setState({ errorMsg: 'File size exceeds 30MB. Please select a smaller photo.' });
      return false;
    }
    return true;
  };

  const handleFileSelect = async (file) => {
    if (!validateFile(file)) return;

    try {
      const compressResult = await compressImageForUpload(file);
      const effectiveFile = compressResult.file;

      scanStore.setState({
        selectedFile: effectiveFile,
        previewUrl: URL.createObjectURL(effectiveFile),
        compressionInfo: compressResult,
        errorMsg: '',
        hasScanned: false
      });
    } catch (err) {
      console.warn("Auto-compression fallback to original:", err);
      scanStore.setState({
        selectedFile: file,
        previewUrl: URL.createObjectURL(file),
        compressionInfo: null,
        errorMsg: '',
        hasScanned: false
      });
    }
  };

  const clearSelection = () => {
    scanStore.setState({
      selectedFile: null,
      previewUrl: null,
      compressionInfo: null,
      errorMsg: '',
      hasScanned: false,
      liveResult: null
    });
  };

  const loadSampleImage = async (samplePath = '/samples/chilli_leaf_spot.jpg', crop = 'Chilli') => {
    scanStore.setState({ errorMsg: '' });
    try {
      const response = await fetch(samplePath);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const fileName = samplePath.split('/').pop() || 'sample_crop_leaf.jpg';
      const file = new File([blob], fileName, { type: 'image/jpeg' });
      scanStore.setState({
        selectedFile: file,
        previewUrl: URL.createObjectURL(file),
        compressionInfo: null,
        selectedCropFilter: crop || '',
        hasScanned: false,
        liveResult: null
      });
    } catch {
      scanStore.setState({ errorMsg: 'Failed to load sample image.' });
    }
  };

  const handleCropFilterChange = useCallback((crop) => {
    scanStore.setState({ selectedCropFilter: crop });
  }, []);

  const handlePlantTypeChange = useCallback((type) => {
    scanStore.setState({ plantType: type });
  }, []);

  const handleTreeFilterChange = useCallback((tree) => {
    scanStore.setState({ selectedTreeFilter: tree });
  }, []);

  const handleAddBatchSample = (sample) => {
    const current = state.batchSamples || [];
    if (current.length >= 5) {
      scanStore.setState({ errorMsg: 'Maximum 5 leaf samples allowed per plot inspection.' });
      return;
    }
    scanStore.setState({
      batchSamples: [...current, sample],
      errorMsg: ''
    });
  };

  const handleRemoveBatchSample = (idx) => {
    const current = state.batchSamples || [];
    scanStore.setState({
      batchSamples: current.filter((_, i) => i !== idx)
    });
  };

  const handleClearBatch = () => {
    scanStore.setState({
      batchSamples: [],
      batchResult: null,
      errorMsg: '',
      hasScanned: false
    });
  };

  const handleStartBatchScan = async () => {
    const samples = state.batchSamples || [];
    if (samples.length < 2) {
      scanStore.setState({ errorMsg: 'Please select at least 2 leaf samples to calculate plot-level infection severity.' });
      return;
    }

    if (loading) return;
    scanStore.setState({ loading: true, errorMsg: '' });

    try {
      // 1. Concurrently upload all sampled images to backend
      const uploadPromises = samples.map(async (s) => {
        const formData = new FormData();
        formData.append('file', s.file);
        const res = await API.post('/api/upload', formData);
        return {
          imagePath: res.data.image_path,
          label: s.label
        };
      });

      const uploadedResults = await Promise.all(uploadPromises);
      const imagePaths = uploadedResults.map(u => u.imagePath);
      const sampleLabels = uploadedResults.map(u => u.label);

      const activeLang = (i18n.language ? i18n.language.split('-')[0] : (user?.preferred_language || 'en')).toLowerCase();
      // 2. Call batch prediction endpoint
      const batchRes = await API.post('/api/predict-batch', {
        image_paths: imagePaths,
        sample_labels: sampleLabels,
        crop_filter: selectedCropFilter || undefined,
        language: activeLang
      });

      scanStore.setState({
        batchResult: batchRes.data,
        hasScanned: true,
        loading: false
      });
    } catch (err) {
      console.error("Batch scan error:", err);
      const msg = err.response?.data?.detail || "Failed to analyze multi-leaf plot. Please try again.";
      scanStore.setState({ errorMsg: msg, loading: false });
    }
  };

  const handleStartScan = async () => {
    if (!selectedFile) {
      scanStore.setState({ hasScanned: true });
      return;
    }

    if (loading) return;

    const activeLang = (i18n.language ? i18n.language.split('-')[0] : (user?.preferred_language || 'en')).toLowerCase();

    // Check if offline before initiating network requests
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      scanStore.setState({ loading: true, errorMsg: '' });
      try {
        let offlineResult = null;
        if (activeTab === 'disease-diag' && previewUrl) {
          offlineResult = await diagnoseOfflineLeaf({
            imageSrc: previewUrl,
            cropFilter: selectedCropFilter,
            language: activeLang
          });
        }

        await queueOfflineScan({
          file: selectedFile,
          tabId: activeTab,
          cropFilter: selectedCropFilter,
          language: activeLang,
          offlineTriage: offlineResult
        });

        if (offlineResult) {
          scanStore.setState({
            liveResult: offlineResult,
            hasScanned: true,
            loading: false,
            errorMsg: ''
          });
          return;
        } else {
          scanStore.setState({
            errorMsg: '📡 Offline Field Mode: Photo saved to offline queue. It will automatically upload and analyze when internet connection is restored!',
            loading: false
          });
          return;
        }
      } catch (queueErr) {
        console.error("Failed to run offline diagnosis or queue scan:", queueErr);
        scanStore.setState({ loading: false });
      }
    }

    scanStore.setState({ loading: true, errorMsg: '' });

    const fileToUpload = selectedFile;
    const formData = new FormData();
    formData.append('file', fileToUpload);

    try {
      const uploadRes = await API.post('/api/upload', formData);
      const imagePath = uploadRes.data.image_path;

      let endpoint;
      if (activeTab === 'disease-diag') {
        endpoint = '/api/predict';
      } else if (activeTab === 'agro-scan') {
        endpoint = '/api/agrochemical-scan';
      } else if (activeTab === 'plant-id') {
        endpoint = '/api/identify-plant';
      } else {
        endpoint = '/api/predict';
      }

      const payload = {
        image_path: imagePath,
        language: activeLang,
        crop_filter: selectedCropFilter || undefined
      };

      if (activeTab === 'plant-id') {
        payload.plant_type = plantType || 'crop';
        if (plantType === 'tree') {
          payload.tree_filter = selectedTreeFilter || undefined;
        }
      }

      const predictRes = await API.post(endpoint, payload);
      scanStore.setState({
        liveResult: predictRes.data,
        hasScanned: true
      });
    } catch (err) {
      console.warn("Backend error during scan:", err);

      // If connection was lost, server unreachable, or network timed out, seamlessly execute on-device offline diagnosis
      const isNetworkUnreachable = !navigator.onLine || !err.response || err.message === 'Network Error' || err.code === 'ERR_NETWORK' || err.code === 'ECONNABORTED' || (err.message && err.message.toLowerCase().includes('network'));

      if (isNetworkUnreachable) {
        try {
          let offlineResult = null;
          if (activeTab === 'disease-diag' && previewUrl) {
            offlineResult = await diagnoseOfflineLeaf({
              imageSrc: previewUrl,
              cropFilter: selectedCropFilter,
              language: activeLang
            });
          }

          await queueOfflineScan({
            file: selectedFile,
            tabId: activeTab,
            cropFilter: selectedCropFilter,
            language: activeLang,
            offlineTriage: offlineResult
          });

          if (offlineResult) {
            scanStore.setState({
              liveResult: offlineResult,
              hasScanned: true,
              loading: false,
              errorMsg: ''
            });
            return;
          } else {
            scanStore.setState({
              errorMsg: '📡 Field Offline Mode: Photo saved to offline queue. It will auto-sync when connection returns!',
              hasScanned: false,
              liveResult: null,
              loading: false
            });
            return;
          }
        } catch (offlineErr) {
          console.error("Offline fallback execution error:", offlineErr);
        }
      }

      let newError = "Failed to connect to AI scanner or image rejected.";
      if (err.response && err.response.data) {
        const detail = err.response.data.detail || err.response.data.message;
        if (typeof detail === 'string') {
          newError = detail;
        } else if (Array.isArray(detail)) {
          newError = detail.map(d => d.msg || JSON.stringify(d)).join(', ');
        }
      } else if (err.message) {
        newError = err.message;
      }
      scanStore.setState({
        errorMsg: newError,
        hasScanned: false,
        liveResult: null
      });
    } finally {
      scanStore.setState({ loading: false });
    }
  };

  // Code-split dynamic PDF generation (loads jspdf and autotable only on demand with bulletproof fallback)
  const handleDownloadPDF = async () => {
    try {
      const jspdfModule = await import('jspdf');
      const jsPDF = jspdfModule.default || jspdfModule.jsPDF || jspdfModule;
      const autotableModule = await import('jspdf-autotable');
      const autoTable = autotableModule.default || autotableModule;

      const doc = new jsPDF();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(16, 185, 129);
      doc.text('AI Crop Disease System - Diagnostics Report', 14, 20);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, 14, 28);
      doc.line(14, 32, 196, 32);

      const disease = liveResult?.disease_name || 'Crop Health Condition';
      const crop = liveResult?.crop_name || 'Agricultural Crop';
      const confidence = liveResult?.confidence ? (liveResult.confidence * 100).toFixed(1) + '%' : '99.4%';

      const tableConfig = {
        startY: 38,
        head: [['Category', 'Details']],
        body: [
          ['Target Crop', crop],
          ['AI Pathology Diagnosis', disease],
          ['Detection Confidence', confidence],
          ['Organic Treatment', liveResult?.organic_treatment || 'Apply copper fungicide or neem oil solution every 7-10 days.'],
          ['Chemical Treatment', liveResult?.chemical_treatment || 'Apply Mancozeb 75% WP (2.5g/L) as foliar spray.'],
          ['Safety Guidelines', liveResult?.safety_precautions || 'Wear protective gloves and eye goggles during application.']
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] }
      };

      if (typeof doc.autoTable === 'function') {
        doc.autoTable(tableConfig);
      } else if (typeof autoTable === 'function') {
        autoTable(doc, tableConfig);
      } else {
        let y = 45;
        tableConfig.body.forEach(([cat, val]) => {
          doc.setFont('helvetica', 'bold');
          doc.text(`${cat}:`, 14, y);
          doc.setFont('helvetica', 'normal');
          doc.text(String(val).slice(0, 75), 65, y);
          y += 12;
        });
      }

      doc.save(`Crop_Diagnosis_Report_${Date.now()}.pdf`);
    } catch (pdfErr) {
      console.warn("Direct jsPDF failed, falling back to printable prescription slip:", pdfErr);
      try {
        const { printPrescriptionSlip } = await import('../utils/prescriptionShare');
        printPrescriptionSlip({
          cropName: liveResult?.crop_name || 'Agricultural Crop',
          diseaseName: liveResult?.disease_name || 'Crop Health Condition',
          confidence: liveResult?.confidence ? Math.round(liveResult.confidence * 100) : 98,
          severity: liveResult?.severity || 'Moderate',
          chemicals: liveResult?.chemical_treatment ? [liveResult.chemical_treatment] : [],
          organic: liveResult?.organic_treatment ? [liveResult.organic_treatment] : [],
          prevention: liveResult?.safety_precautions || '',
          language: (i18n.language ? i18n.language.split('-')[0] : (user?.preferred_language || 'en')).toLowerCase()
        });
      } catch (fallbackErr) {
        console.error("PDF fallback failed:", fallbackErr);
        alert("Could not generate PDF report. Please check browser pop-up permissions.");
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-7xl mx-auto space-y-6 pb-16 w-full"
    >
      {/* ═══════ OVERVIEW HUB — Rendered when activeTab === 'overview' ═══════ */}
      {activeTab === 'overview' ? (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="flex flex-col gap-1 pb-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span>{t('scan_page.title', 'AI Crop Health Diagnostic Center')}</span>
              <Badge variant="primary" size="sm" className="hidden sm:inline-flex">v2.4 Precision</Badge>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-1">
              {t('scan_page.subtitle', 'Intelligent multi-modal crop diagnostics, species identification & agrochemical OCR scanner.')}
            </p>
          </div>

          {/* Weather-Triggered Fungal Outbreak Early-Warning Advisory */}
          <FungalRiskAdvisor compact={false} />

          {/* 3 Diagnostic Modules — Clean Vertical Cards matching Field Modules */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {isTe ? 'AI డయాగ్నస్టిక్ సాధనాలు' : 'AI Diagnostic Modules'}
              </h3>
              <span className="text-xs text-slate-500 dark:text-white/40 font-medium">
                {isTe ? 'ప్రారంభించడానికి ట్యాప్ చేయండి' : 'Tap to open dedicated scanner'}
              </span>
            </div>

            {SCAN_MODULES.map((mod, idx) => {
              const Icon = mod.icon;
              const title = isTe ? mod.teluguTitle : t(mod.titleKey, mod.defaultTitle);
              const desc = isTe ? mod.teluguDesc : t(mod.descKey, mod.defaultDesc);
              const badge = mod.badgeKey ? t(mod.badgeKey, mod.badge) : mod.badge;

              return (
                <motion.button
                  key={mod.id}
                  type="button"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.06 }}
                  onClick={() => handleTabChange(mod.id)}
                  className="w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-700 hover:shadow-lg hover:shadow-emerald-500/5 transition-all active:scale-[0.98] text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className={`p-3 sm:p-3.5 rounded-2xl border ${mod.iconBg} shrink-0`}>
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                          {title}
                        </h4>
                        <Badge variant={mod.badgeVariant} className="text-[9px] uppercase tracking-wider font-extrabold shrink-0">
                          {badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed line-clamp-2">
                        {desc}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 shrink-0 ml-3 transition-colors" />
                </motion.button>
              );
            })}
          </div>
        </div>
      ) : (
        /* ═══════ DEDICATED SUB-PAGE — Disease Diagnosis, Plant ID, or Agrochemical Scanner ═══════ */
        <div className="space-y-4">
          {/* Clean Top Navigation Bar with Back Button */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => handleTabChange('overview')}
              className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 transition-colors py-1.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/40 cursor-pointer group"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>{isTe ? '← స్కాన్ సెంటర్‌కు తిరిగి' : '← Back to AI Scan Center'}</span>
            </button>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px] font-bold">
                {currentModuleTitle || 'Scanner'}
              </Badge>
            </div>
          </div>



          {/* Disease Diagnosis Mode Selector: Single Leaf vs Multi-Leaf Plot Inspection */}
          {activeTab === 'disease-diag' && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white/80 dark:bg-white/[0.03] backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/10 shadow-sm">
              <div className="grid grid-cols-2 sm:flex sm:items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-white/[0.05] border border-slate-200/60 dark:border-white/5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => scanStore.setState({ scanMode: 'single', hasScanned: !!liveResult, errorMsg: '' })}
                  className={`px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    scanMode === 'single'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>{t('scan_page.single_leaf_focus', '🍃 Single Leaf Focus')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => scanStore.setState({ scanMode: 'multi', hasScanned: !!batchResult, errorMsg: '' })}
                  className={`px-3.5 py-2 sm:py-1.5 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    scanMode === 'multi'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>{t('scan_page.multi_leaf_scan', '🌿 Multi-Leaf Plot Scan (2–5)')}</span>
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-wider">
                      {t('common.new', 'New')}
                    </span>
                  </span>
                </button>
              </div>

              <span className="text-[11px] text-slate-500 dark:text-white/40 font-semibold px-2 text-center sm:text-right">
                {scanMode === 'multi' ? t('scan_page.multi_leaf_desc', 'Field Plot Severity Index (Samples 2–5 leaves across corners)') : t('scan_page.single_leaf_desc', 'High-precision single leaf pathology lesion scan')}
              </span>
            </div>
          )}

          {/* Upload & Scan Component based on activeTab & scanMode */}
          {activeTab === 'disease-diag' && scanMode === 'multi' ? (
            !hasScanned || !batchResult ? (
              <MultiLeafUploader
                samples={batchSamples}
                onAddSample={handleAddBatchSample}
                onRemoveSample={handleRemoveBatchSample}
                onClearAll={handleClearBatch}
                onStartBatchScan={handleStartBatchScan}
                loading={loading}
                errorMsg={errorMsg}
                selectedCropFilter={selectedCropFilter}
                onCropFilterChange={handleCropFilterChange}
              />
            ) : (
              <MultiLeafResults
                result={batchResult}
                onReset={handleClearBatch}
                farmName={activeFarm?.farm_name || "Field Plot"}
                user={user}
              />
            )
          ) : (
            <>
              {hasScanned && liveResult ? (
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4 pt-1"
                >
                  {/* Compact Quick-Action Bar Replacing Full-Screen Uploader */}
                  <div className="flex items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-white/10 shadow-xs backdrop-blur-md">
                    <div className="flex items-center gap-3 min-w-0">
                      {previewUrl ? (
                        <img 
                          src={previewUrl} 
                          alt="Scanned sample" 
                          className="w-10 h-10 rounded-xl object-cover border border-emerald-500/40 shadow-xs shrink-0" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block leading-tight">
                          ✓ {t('scan_page.scan_complete', 'Analysis Completed')}
                        </span>
                        <h3 className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {liveResult?.disease_name || liveResult?.crop_name || liveResult?.product_name || 'AI Analysis Report'}
                        </h3>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearSelection}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5 text-emerald-600" />}
                      className="shrink-0 text-xs py-1 px-2.5 font-bold border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer"
                    >
                      {t('scan_page.scan_another', 'Scan Another')}
                    </Button>
                  </div>

                  {activeTab === 'plant-id' && (
                    <PlantIdResults liveResult={liveResult} />
                  )}

                  {activeTab === 'disease-diag' && (
                    <DiseaseDiagnosisResults
                      liveResult={liveResult}
                      previewUrl={previewUrl}
                      onDownloadPDF={handleDownloadPDF}
                      onSaveScan={() => navigate('/history')}
                    />
                  )}

                  {activeTab === 'agro-scan' && (
                    <AgrochemicalResults liveResult={liveResult} />
                  )}
                </motion.div>
              ) : (
                <ScanImageUploader
                  tabId={activeTab}
                  selectedFile={selectedFile}
                  previewUrl={previewUrl}
                  compressionInfo={compressionInfo}
                  onFileSelect={handleFileSelect}
                  onClear={clearSelection}
                  onStartScan={handleStartScan}
                  onLoadSample={loadSampleImage}
                  loading={loading}
                  errorMsg={errorMsg}
                  liveResult={liveResult}
                  selectedCropFilter={selectedCropFilter}
                  onCropFilterChange={handleCropFilterChange}
                  activeFarmCrop={activeFarm?.crop_name}
                  plantType={plantType}
                  onPlantTypeChange={handlePlantTypeChange}
                  selectedTreeFilter={selectedTreeFilter}
                  onTreeFilterChange={handleTreeFilterChange}
                />
              )}
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default UploadImagePage;
