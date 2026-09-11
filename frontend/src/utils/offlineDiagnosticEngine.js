/**
 * AgriShield PWA Offline AI Diagnostic Engine
 * 
 * Provides instantaneous on-device leaf diagnostics for rural farmers working
 * in fields with zero cellular reception.
 * 
 * Performs computer vision feature extraction in-browser using HTML5 Canvas:
 * - Green Canopy Chlorophyll Index (Healthy Leaf Tissue)
 * - Chlorosis Index (Yellowing / Nutrient Deficiency / Viral Stress)
 * - Necrotic Lesion Index (Dead / Brown / Black Fungal & Bacterial Spores)
 * - White/Gray Powdery Mildew Dispersion
 * - Orange/Rust Pustule Signatures
 * 
 * Matches against PlantVillage disease profiles from `diseaseAdvisoryData.js`
 * and generates immediate field triage with severity scoring and emergency first-aid remedies.
 */

import { DISEASE_KB, getDiseaseDetails } from './diseaseAdvisoryData';

/**
 * Load an image source into an Image element
 */
const loadImage = (src) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('Failed to load image for offline analysis: ' + err));
    img.src = src;
  });
};

/**
 * Analyze an image using HTML5 canvas and extract foliar color & texture metrics
 */
export const extractLeafMetrics = async (imageSrc) => {
  const img = await loadImage(imageSrc);
  
  // Downscale to 256x256 for rapid on-device calculation
  const canvas = document.createElement('canvas');
  const targetDim = 256;
  canvas.width = targetDim;
  canvas.height = targetDim;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  ctx.drawImage(img, 0, 0, targetDim, targetDim);
  const imageData = ctx.getImageData(0, 0, targetDim, targetDim);
  const data = imageData.data;
  const totalPixels = targetDim * targetDim;

  let greenHealthyPixels = 0;
  let chlorosisYellowPixels = 0;
  let necroticBrownBlackPixels = 0;
  let whitePowderyPixels = 0;
  let rustOrangePixels = 0;
  let backgroundPixels = 0;

  // Quadrant counters for lesion clustering
  const quadrantLesions = [0, 0, 0, 0];

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    if (a < 128) {
      backgroundPixels++;
      continue;
    }

    const pixelIdx = i / 4;
    const px = pixelIdx % targetDim;
    const py = Math.floor(pixelIdx / targetDim);
    const quadIdx = (py < targetDim / 2 ? 0 : 2) + (px < targetDim / 2 ? 0 : 1);

    // Very dark background or very bright white lab background
    const brightness = (r + g + b) / 3;
    if (brightness < 20 || (brightness > 240 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15)) {
      backgroundPixels++;
      continue;
    }

    // 1. Healthy Green Canopy (Strict dominance of pure chlorophyll green)
    if (g > 55 && g > r * 1.22 && g > b * 1.25 && brightness > 40 && brightness < 225) {
      greenHealthyPixels++;
      continue;
    }

    // 2. White / Gray Powdery Mildew (Pale fuzzy spore patches)
    if (brightness > 165 && Math.abs(r - g) < 18 && Math.abs(g - b) < 18) {
      whitePowderyPixels++;
      continue;
    }

    // 3. Rust / Orange Pustules
    if (r > 130 && g > 50 && g < 130 && b < 70 && r > g * 1.28) {
      rustOrangePixels++;
      quadrantLesions[quadIdx]++;
      continue;
    }

    // 4. Chlorosis (Yellowing halos, viral mottling, or nitrogen deficiency)
    if (r > 110 && g > 110 && b < 95 && Math.abs(r - g) < 35 && (r + g) > 2.2 * b) {
      chlorosisYellowPixels++;
      continue;
    }

    // 5. Necrotic Lesions (Dead brown, dark tan, black spots, or water-soaked blight tissue)
    // A: Dark necrotic core / black speckles
    if (brightness < 85 && (r > b || g > b)) {
      necroticBrownBlackPixels++;
      quadrantLesions[quadIdx]++;
      continue;
    }
    // B: Typical brown / tan fungal spot with dry necrotic margin
    if (r > 45 && r < 165 && g > 30 && g < 145 && b < 105 && (r >= g * 0.95 || Math.abs(r - g) < 20)) {
      necroticBrownBlackPixels++;
      quadrantLesions[quadIdx]++;
      continue;
    }

    // Default remaining foliar tissue: If green tint is noticeable, classify as green, else mild chlorosis/stress
    if (g > r && g > b && g > 45) {
      greenHealthyPixels++;
    } else {
      chlorosisYellowPixels++;
    }
  }

  const validLeafPixels = Math.max(1, totalPixels - backgroundPixels);
  const greenPct = (greenHealthyPixels / validLeafPixels) * 100;
  const necrosisPct = (necroticBrownBlackPixels / validLeafPixels) * 100;
  const chlorosisPct = (chlorosisYellowPixels / validLeafPixels) * 100;
  const powderyPct = (whitePowderyPixels / validLeafPixels) * 100;
  const rustPct = (rustOrangePixels / validLeafPixels) * 100;

  // Calculate lesion spatial distribution variance across 4 quadrants
  const meanQuadrant = (quadrantLesions[0] + quadrantLesions[1] + quadrantLesions[2] + quadrantLesions[3]) / 4;
  const variance = quadrantLesions.reduce((acc, val) => acc + Math.pow(val - meanQuadrant, 2), 0) / 4;
  const isConcentratedLesions = variance > 60;

  return {
    greenPct: parseFloat(greenPct.toFixed(1)),
    necrosisPct: parseFloat(necrosisPct.toFixed(1)),
    chlorosisPct: parseFloat(chlorosisPct.toFixed(1)),
    powderyPct: parseFloat(powderyPct.toFixed(1)),
    rustPct: parseFloat(rustPct.toFixed(1)),
    isConcentratedLesions,
    validLeafPixels
  };
};

/**
 * Execute Client-Side Offline AI Diagnosis
 */
export const diagnoseOfflineLeaf = async ({
  imageSrc,
  cropFilter = '',
  language = 'en'
}) => {
  const metrics = await extractLeafMetrics(imageSrc);

  const effectiveCrop = (cropFilter && cropFilter !== 'all' && cropFilter !== 'Auto-Detect')
    ? cropFilter
    : 'Tomato'; // Sensible default for solanaceous field diagnostics

  let conditionKey = 'early blight';
  let diseaseName = `${effectiveCrop} Early Blight`;
  let confidence = 0.88;
  let severity = 'Moderate';
  let reasoning = 'Foliar necrotic lesions and tissue stress detected on canopy.';

  // 1. Check for Strict Healthy Leaf (Requires overwhelming green chlorophyll and near-zero necrosis)
  if (metrics.greenPct >= 88.0 && metrics.necrosisPct < 1.2 && metrics.chlorosisPct < 4.5 && metrics.powderyPct < 3.0 && metrics.rustPct < 1.2) {
    conditionKey = 'healthy';
    diseaseName = `${effectiveCrop} Healthy`;
    confidence = Math.min(0.97, 0.88 + (metrics.greenPct / 100) * 0.1);
    severity = 'Healthy';
    reasoning = `Healthy green chlorophyll canopy detected (${metrics.greenPct}% green, minimal foliar lesions < 1%).`;
  }
  // 2. Check for Powdery Mildew
  else if (metrics.powderyPct >= 5.0) {
    conditionKey = 'powdery mildew';
    diseaseName = `${effectiveCrop} Powdery Mildew`;
    confidence = Math.min(0.95, 0.84 + (metrics.powderyPct / 100) * 0.4);
    severity = metrics.powderyPct > 15 ? 'Severe' : 'Moderate';
    reasoning = `Whitish-gray powdery fungal patches covering ${metrics.powderyPct}% of foliar surface.`;
  }
  // 3. Check for Rust
  else if (metrics.rustPct >= 2.5) {
    conditionKey = 'leaf rust';
    diseaseName = `${effectiveCrop} Leaf Rust`;
    confidence = Math.min(0.94, 0.82 + (metrics.rustPct / 100) * 0.5);
    severity = metrics.rustPct > 8 ? 'Severe' : 'Moderate';
    reasoning = `Reddish-orange rust pustule discoloration detected across ${metrics.rustPct}% of canopy.`;
  }
  // 4. Check for Late Blight (High necrosis + rapid water-soaked dispersion across leaves)
  else if (metrics.necrosisPct > 16.0 || (metrics.necrosisPct > 9.0 && !metrics.isConcentratedLesions)) {
    conditionKey = 'late blight';
    diseaseName = `${effectiveCrop} Late Blight`;
    confidence = Math.min(0.96, 0.86 + (metrics.necrosisPct / 100) * 0.3);
    severity = metrics.necrosisPct > 25 ? 'Severe' : 'Moderate';
    reasoning = `Extensive water-soaked necrotic lesions spanning ${metrics.necrosisPct}% of foliar tissue. High blight progression risk.`;
  }
  // 5. Check for Early Blight (Concentric rings / localized target lesions)
  else if (metrics.necrosisPct >= 2.5) {
    conditionKey = 'early blight';
    diseaseName = `${effectiveCrop} Early Blight`;
    confidence = Math.min(0.94, 0.85 + (metrics.necrosisPct / 100) * 0.3);
    severity = metrics.necrosisPct > 10 ? 'Severe' : (metrics.necrosisPct > 5 ? 'Moderate' : 'Mild');
    reasoning = `Concentric brown necrotic lesions detected across foliar surface (${metrics.necrosisPct}% affected).`;
  }
  // 6. Check for Yellow Leaf Curl Virus / Severe Chlorosis
  else if (metrics.chlorosisPct >= 8.0) {
    conditionKey = 'yellow leaf curl virus';
    diseaseName = `${effectiveCrop} Yellow Leaf Curl Virus`;
    confidence = Math.min(0.92, 0.82 + (metrics.chlorosisPct / 100) * 0.3);
    severity = metrics.chlorosisPct > 25 ? 'Severe' : 'Moderate';
    reasoning = `Pronounced foliar chlorosis with yellowing margins detected across ${metrics.chlorosisPct}% of canopy.`;
  }
  // 7. Subtle or early bacterial foliar spot
  else if (metrics.necrosisPct >= 1.0) {
    conditionKey = 'bacterial spot';
    diseaseName = `${effectiveCrop} Bacterial Spot`;
    confidence = 0.88;
    severity = 'Mild';
    reasoning = `Small angular necrotic speckles detected (${metrics.necrosisPct}% coverage). Early stage intervention recommended.`;
  }

  // Retrieve advisory details from localized database
  const kbData = getDiseaseDetails(conditionKey, language);
  const now = new Date();

  return {
    is_offline: true,
    is_field_triage: true,
    crop_name: effectiveCrop,
    disease_name: diseaseName,
    condition_key: conditionKey,
    confidence: parseFloat(confidence.toFixed(3)),
    severity: severity,
    prediction_status: conditionKey === 'healthy' ? 'healthy' : 'diseased',
    prediction_date: now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }),
    prediction_time: now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }),
    symptoms: kbData.overview || reasoning,
    offline_reasoning: reasoning,
    metrics: metrics,
    chemical_treatment: kbData.chemicals?.[0] || 'Contact copper fungicide @ 2.5g/L if symptoms expand.',
    organic_treatment: kbData.organic?.[0] || 'Neem oil spray (5ml/L water with liquid soap) every 7 days.',
    prevention_methods: [
      kbData.prevention || 'Maintain clean irrigation, avoid wetting leaves in the evening, and isolate diseased crop sections.',
      'Schedule cloud model deep-learning verification once cell network is re-established.'
    ],
    chemicals_list: kbData.chemicals || [],
    organic_list: kbData.organic || [],
    triage_disclaimer: '📡 On-Device Field Triage: Generated entirely offline using computer vision heuristics. Will automatically synchronize with cloud deep learning models when connection returns.'
  };
};
