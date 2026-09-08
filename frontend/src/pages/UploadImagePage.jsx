import React, { useState } from 'react';
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
import { Badge } from '../components/ui/index';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
    selectedCropFilter
  } = state;

  const setActiveTab = (tab) => scanStore.setState({ activeTab: tab });

  const validateFile = (file) => {
    if (!file) return false;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      scanStore.setState({ errorMsg: 'Invalid file format. Please select a JPG, JPEG, or PNG image.' });
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      scanStore.setState({ errorMsg: 'File size exceeds 10MB limit. Please select a smaller photo.' });
      return false;
    }
    return true;
  };

  const handleFileSelect = (file) => {
    if (validateFile(file)) {
      scanStore.setState({
        selectedFile: file,
        previewUrl: URL.createObjectURL(file),
        errorMsg: '',
        hasScanned: false
      });
    }
  };

  const clearSelection = () => {
    scanStore.setState({
        selectedFile: null,
        previewUrl: null,
        errorMsg: '',
        hasScanned: false,
        liveResult: null
    });
  };

  const loadSampleImage = async () => {
    scanStore.setState({ errorMsg: '' });
    try {
      const response = await fetch('/test_leaf.jpg');
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      const file = new File([blob], 'sample_crop_leaf.jpg', { type: 'image/jpeg' });
      scanStore.setState({
        selectedFile: file,
        previewUrl: URL.createObjectURL(file),
        hasScanned: false
      });
    } catch {
      scanStore.setState({ errorMsg: 'Failed to load sample image.' });
    }
  };

  const compressImage = (file) => {
    return new Promise((resolve) => {
      if (!file || !['image/jpeg', 'image/png', 'image/jpg'].includes(file.type) || file.size < 400 * 1024) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_DIM = 1024;
          if (width > height) {
            if (width > MAX_DIM) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            }
          } else {
            if (height > MAX_DIM) {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            if (blob) {
              const compressed = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressed);
            } else {
              resolve(file);
            }
          }, 'image/jpeg', 0.78);
        };
        img.onerror = () => resolve(file);
      };
      reader.onerror = () => resolve(file);
    });
  };

  const handleStartScan = async () => {
    if (!selectedFile) {
      scanStore.setState({ hasScanned: true });
      return;
    }

    if (loading) return;

    scanStore.setState({ loading: true, errorMsg: 'Compressing and preparing image...' });

    let fileToUpload = selectedFile;
    try {
      fileToUpload = await compressImage(selectedFile);
    } catch (compressErr) {
      console.warn("Client compression failed, uploading original:", compressErr);
    }

    scanStore.setState({ errorMsg: '' });

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

  const handleDownloadPDF = () => {
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

    const disease = liveResult?.disease_name || 'Tomato Early Blight';
    const crop = liveResult?.crop_name || 'Tomato';
    const confidence = liveResult?.confidence ? (liveResult.confidence * 100).toFixed(1) + '%' : '99.4%';

    (doc).autoTable({
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
  };

    return (
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-7xl mx-auto space-y-6 pb-16 w-full"
      >
        {/* Title Header */}
        <div className="flex flex-col gap-1 pb-4 border-b border-slate-200/80 dark:border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-black uppercase tracking-wider">
              {t('scan_page.vision_engine', 'Multi-Modal Vision Engine')}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {t('nav.scan_crop', 'AI Scan Center')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-white/40 mt-1">
            {t('scan_page.subtitle', 'Intelligent multi-modal crop diagnostics, species identification & agrochemical OCR scanner.')}
          </p>
        </div>
  
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
          onFileSelect={handleFileSelect}
          onClear={clearSelection}
          onStartScan={handleStartScan}
          onLoadSample={loadSampleImage}
          loading={loading}
          errorMsg={errorMsg}
          liveResult={liveResult}
          selectedCropFilter={selectedCropFilter}
          onCropFilterChange={(crop) => scanStore.setState({ selectedCropFilter: crop })}
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
                  onDownloadPDF={handleDownloadPDF}
                  onSaveScan={() => navigate('/history')}
                />
                {liveResult?.advisor && (
                  <div className="mt-6">
                    <CropAdvisorPanel advisor={liveResult.advisor} />
                  </div>
                )}
              </>
            )}
  
            {activeTab === 'agro-scan' && (
              <AgrochemicalResults data={liveResult || undefined} />
            )}
          </motion.div>
        )}
      </motion.div>
    );
  };
  
  export default UploadImagePage;
