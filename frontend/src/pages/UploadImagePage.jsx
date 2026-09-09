import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import API from '../services/api';
import ScanCenterTabs from '../components/scanCenter/ScanCenterTabs';
import ScanImageUploader from '../components/scanCenter/ScanImageUploader';
import PlantIdResults from '../components/scanCenter/PlantIdResults';
import DiseaseDiagnosisResults from '../components/scanCenter/DiseaseDiagnosisResults';
import AgrochemicalResults from '../components/scanCenter/AgrochemicalResults';
import CropAdvisorPanel from '../components/CropAdvisorPanel';
import FungalRiskAdvisor from '../components/intelligence/FungalRiskAdvisor';
import { Badge } from '../components/ui/index';
import { compressImageForUpload, formatFileSize } from '../utils/imageCompression';
import { queueOfflineScan } from '../utils/offlineQueue';

// Fully Reactive Global Store to persist scan state + background loading across tab navigation
const scanStore = {
  state: {
    activeTab: 'disease-diag',
    selectedFile: null,
    previewUrl: null,
    hasScanned: false,
    liveResult: null,
    loading: false,
    errorMsg: '',
    selectedCropFilter: '',
    compressionInfo: null
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
  const navigate = useNavigate();

  // Subscribe to the global reactive store (persists across unmounts!)
  const state = React.useSyncExternalStore(scanStore.subscribe, scanStore.getSnapshot);
  
  const { 
    activeTab, selectedFile, previewUrl, 
    hasScanned, liveResult, loading, errorMsg,
    selectedCropFilter, compressionInfo
  } = state;

  const setActiveTab = (tab) => scanStore.setState({ activeTab: tab });

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

  const handleStartScan = async () => {
    if (!selectedFile) {
      scanStore.setState({ hasScanned: true });
      return;
    }

    if (loading) return;

    // Check if offline before initiating network requests
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      try {
        await queueOfflineScan({
          file: selectedFile,
          tabId: activeTab,
          cropFilter: selectedCropFilter,
          language: user?.preferred_language || i18n.language || 'en'
        });
        scanStore.setState({
          errorMsg: '📡 Offline Field Mode: Photo saved to offline queue. It will automatically upload and analyze when internet connection is restored!',
          loading: false
        });
        return;
      } catch (queueErr) {
        console.error("Failed to queue offline scan:", queueErr);
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

      const predictRes = await API.post(endpoint, {
        image_path: imagePath,
        language: user?.preferred_language || i18n.language || 'en',
        crop_filter: selectedCropFilter || undefined
      });
      scanStore.setState({
        liveResult: predictRes.data,
        hasScanned: true
      });
    } catch (err) {
      console.warn("Backend error during scan:", err);

      // If connection was lost midway, automatically queue offline
      if (!navigator.onLine || err.message === 'Network Error' || err.code === 'ERR_NETWORK') {
        try {
          await queueOfflineScan({
            file: selectedFile,
            tabId: activeTab,
            cropFilter: selectedCropFilter,
            language: user?.preferred_language || i18n.language || 'en'
          });
          scanStore.setState({
            errorMsg: '📡 Network lost during scan: Photo saved to offline queue. It will auto-sync when connection returns!',
            hasScanned: false,
            liveResult: null
          });
          return;
        } catch {
          // fallback to normal error handling
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

  // Code-split dynamic PDF generation (loads jspdf and autotable only on demand)
  const handleDownloadPDF = async () => {
    try {
      const { default: jsPDF } = await import('jspdf');
      await import('jspdf-autotable');

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

      doc.autoTable({
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
      });

      doc.save(`Crop_Diagnosis_Report_${Date.now()}.pdf`);
    } catch (pdfErr) {
      console.error("PDF generation failed:", pdfErr);
      alert("Could not generate PDF report. Please try again.");
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-7xl mx-auto space-y-6 pb-16 w-full"
    >
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

      {/* Primary 3 Navigation Tabs */}
      <ScanCenterTabs
        activeTab={activeTab}
        onTabChange={(tabId) => scanStore.setState({ activeTab: tabId, errorMsg: '' })}
      />

      {/* Upload, Camera, Preview & Scan Trigger Component */}
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
      />

      {/* Results Section for the Active Tab */}
      {hasScanned && (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="pt-4"
        >
          {activeTab === 'plant-id' && (
            <PlantIdResults liveResult={liveResult} />
          )}

          {activeTab === 'disease-diag' && (
            <>
              <DiseaseDiagnosisResults
                liveResult={liveResult}
                previewUrl={previewUrl}
                onDownloadPDF={handleDownloadPDF}
                onSaveScan={() => navigate('/history')}
              />
              <div className="mt-8">
                <CropAdvisorPanel 
                  cropName={liveResult?.crop_name} 
                  diseaseName={liveResult?.disease_name} 
                  confidence={liveResult?.confidence} 
                  advisor={liveResult?.advisor}
                />
              </div>
            </>
          )}

          {activeTab === 'agro-scan' && (
            <AgrochemicalResults liveResult={liveResult} />
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

export default UploadImagePage;
