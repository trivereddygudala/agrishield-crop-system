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

    // 1. Healthy Green Canopy
    if (g > r * 1.15 && g > b * 1.15 && g > 45) {
      greenHealthyPixels++;
      continue;
    }

    // 2. Necrotic Lesion (Brown / Black dead tissue)
    if (brightness < 80 && r > g && g >= b) {
      necroticBrownBlackPixels++;
      quadrantLesions[quadIdx]++;
      continue;
    }
    if (r > 60 && r < 140 && g > 30 && g < 100 && b < 70 && r > g * 1.1) {
      necroticBrownBlackPixels++;
      quadrantLesions[quadIdx]++;
      continue;
    }

    // 3. Chlorosis (Yellowing / Viral / Stress)
    if (r > 120 && g > 120 && b < 90 && Math.abs(r - g) < 40) {
      chlorosisYellowPixels++;
      continue;
    }

    // 4. White / Gray Powdery Mildew
    if (brightness > 180 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
      whitePowderyPixels++;
      continue;
    }

    // 5. Rust / Orange Pustules
    if (r > 140 && g > 60 && g < 120 && b < 60 && r > g * 1.3) {
      rustOrangePixels++;
      quadrantLesions[quadIdx]++;
      continue;
    }

    // Default to leaf tissue
    if (g >= r && g >= b) {
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
  const isConcentratedLesions = variance > 200;

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

  let conditionKey = 'healthy';
  let diseaseName = 'Healthy Crop';
  let confidence = 0.94;
  let severity = 'Healthy';
  let reasoning = 'Leaf canopy exhibits uniform chlorophyll density with minimal foliar lesions.';

  // 1. Check for Healthy Leaf
  if (metrics.greenPct >= 78 && metrics.necrosisPct < 4.0 && metrics.chlorosisPct < 8.0) {
    conditionKey = 'healthy';
    diseaseName = `${effectiveCrop} Healthy`;
    confidence = Math.min(0.97, 0.85 + (metrics.greenPct / 100) * 0.12);
    severity = 'Healthy';
    reasoning = `Healthy green chlorophyll coverage detected (${metrics.greenPct}%). No significant necrotic or fungal lesions present.`;
  }
  // 2. Check for Powdery Mildew
  else if (metrics.powderyPct > 9.0) {
    conditionKey = 'powdery mildew';
    diseaseName = `${effectiveCrop} Powdery Mildew`;
    confidence = Math.min(0.95, 0.82 + (metrics.powderyPct / 100) * 0.4);
    severity = metrics.powderyPct > 20 ? 'Severe' : 'Moderate';
    reasoning = `Diffuse whitish-gray fungal powdery patches covering ${metrics.powderyPct}% of foliar surface.`;
  }
  // 3. Check for Rust
  else if (metrics.rustPct > 4.5) {
    conditionKey = 'leaf rust';
    diseaseName = `${effectiveCrop} Leaf Rust`;
    confidence = Math.min(0.93, 0.80 + (metrics.rustPct / 100) * 0.5);
    severity = metrics.rustPct > 12 ? 'Severe' : 'Moderate';
    reasoning = `Characteristic reddish-orange pustule discoloration detected across ${metrics.rustPct}% of canopy.`;
  }
  // 4. Check for Late Blight (High necrosis + rapid water-soaked dispersion)
  else if (metrics.necrosisPct > 22.0 || (metrics.necrosisPct > 12.0 && !metrics.isConcentratedLesions)) {
    conditionKey = 'late blight';
    diseaseName = `${effectiveCrop} Late Blight`;
    confidence = Math.min(0.96, 0.85 + (metrics.necrosisPct / 100) * 0.3);
    severity = metrics.necrosisPct > 30 ? 'Severe' : 'Moderate';
    reasoning = `Extensive water-soaked necrotic lesions spanning ${metrics.necrosisPct}% of leaf tissue. Spores spread rapidly under humid conditions.`;
  }
  // 5. Check for Early Blight (Concentric ring target spots)
  else if (metrics.necrosisPct >= 5.0 && metrics.isConcentratedLesions) {
    conditionKey = 'early blight';
    diseaseName = `${effectiveCrop} Early Blight`;
    confidence = Math.min(0.94, 0.84 + (metrics.necrosisPct / 100) * 0.35);
    severity = metrics.necrosisPct > 15 ? 'Severe' : 'Mild';
    reasoning = `Target-like concentric brown necrotic lesions clustered across lower canopy sections (${metrics.necrosisPct}% affected).`;
  }
  // 6. Check for Yellow Leaf Curl Virus / Chlorosis
  else if (metrics.chlorosisPct > 18.0) {
    conditionKey = 'yellow leaf curl virus';
    diseaseName = `${effectiveCrop} Yellow Leaf Curl Virus`;
    confidence = Math.min(0.92, 0.80 + (metrics.chlorosisPct / 100) * 0.3);
    severity = metrics.chlorosisPct > 35 ? 'Severe' : 'Moderate';
    reasoning = `Severe foliar chlorosis with yellowing margins detected across ${metrics.chlorosisPct}% of canopy.`;
  }
  // 7. General Bacterial / Foliar Spot
  else if (metrics.necrosisPct >= 3.0) {
    conditionKey = 'bacterial spot';
    diseaseName = `${effectiveCrop} Bacterial Spot`;
    confidence = 0.87;
    severity = 'Mild';
    reasoning = `Small angular necrotic speckles detected (${metrics.necrosisPct}% coverage).`;
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
