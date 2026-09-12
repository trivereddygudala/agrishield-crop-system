/**
 * AgriShield Crop Economics & Yield Loss Estimator Utility
 * Formulates harvest valuation, yield loss percentages, chemical/labor spray costs,
 * and Protection ROI multipliers calibrated to Indian APMC Mandi wholesale prices.
 */

export const CROP_BENCHMARKS = {
  tomato: {
    name: 'Tomato (టమోటా)',
    yieldPerAcre: 120, // quintals
    mandiPrice: 1850,  // ₹ / quintal
    chemicalCost: 550, // ₹ / acre
    laborCost: 300,    // ₹ / acre
  },
  potato: {
    name: 'Potato (బంగాళాదుంప)',
    yieldPerAcre: 100,
    mandiPrice: 1450,
    chemicalCost: 600,
    laborCost: 300,
  },
  pepper: {
    name: 'Chilli / Bell Pepper (మిరప)',
    yieldPerAcre: 30, // dry equivalent quintals
    mandiPrice: 16500,
    chemicalCost: 750,
    laborCost: 350,
  },
  cotton: {
    name: 'Cotton (పత్తి)',
    yieldPerAcre: 12,
    mandiPrice: 7200,
    chemicalCost: 650,
    laborCost: 300,
  },
  rice: {
    name: 'Paddy / Rice (వరి)',
    yieldPerAcre: 28,
    mandiPrice: 2300,
    chemicalCost: 450,
    laborCost: 250,
  },
  corn: {
    name: 'Maize / Corn (మొక్కజొన్న)',
    yieldPerAcre: 35,
    mandiPrice: 2100,
    chemicalCost: 450,
    laborCost: 250,
  },
  onion: {
    name: 'Onion (ఉల్లిపాయ)',
    yieldPerAcre: 110,
    mandiPrice: 1900,
    chemicalCost: 500,
    laborCost: 300,
  }
};

export const SEVERITY_LEVELS = {
  early: {
    id: 'early',
    label: 'Early Stage (ప్రారంభ దశ)',
    badge: 'Minor Spotting',
    lossPct: 10,
    color: 'emerald',
    dailySpreadPct: 1.5
  },
  moderate: {
    id: 'moderate',
    label: 'Moderate Spread (మధ్యస్థ వ్యాప్తి)',
    badge: 'Active Infection',
    lossPct: 32,
    color: 'amber',
    dailySpreadPct: 2.8
  },
  severe: {
    id: 'severe',
    label: 'Severe Infection (తీవ్రమైన సంక్రమణ)',
    badge: 'Critical Threat',
    lossPct: 60,
    color: 'rose',
    dailySpreadPct: 4.5
  },
  critical: {
    id: 'critical',
    label: 'Full Outbreak (మహమ్మారి)',
    badge: 'Emergency Loss',
    lossPct: 82,
    color: 'purple',
    dailySpreadPct: 5.0
  }
};

/**
 * Formats a number to Indian Rupee representation (e.g. ₹1,25,000)
 */
export const formatINR = (amount) => {
  if (amount == null || isNaN(amount)) return '₹0';
  const rounded = Math.round(amount);
  return '₹' + rounded.toLocaleString('en-IN');
};

/**
 * Calculates economic loss, treatment cost, and protection ROI.
 */
export const calculateCropEconomics = ({
  cropName = 'Tomato',
  diseaseName = 'Early Blight',
  severity = 'moderate',
  acres = 1,
  customPrice = null
}) => {
  const normalizedCrop = String(cropName).toLowerCase().trim();
  let benchmark = CROP_BENCHMARKS[normalizedCrop];

  if (!benchmark) {
    for (const key of Object.keys(CROP_BENCHMARKS)) {
      if (normalizedCrop.includes(key) || key.includes(normalizedCrop)) {
        benchmark = CROP_BENCHMARKS[key];
        break;
      }
    }
  }

  if (!benchmark) {
    benchmark = {
      name: cropName,
      yieldPerAcre: 60,
      mandiPrice: 2000,
      chemicalCost: 500,
      laborCost: 300,
    };
  }

  const farmAcres = Math.max(0.1, Number(acres) || 1);
  const price = customPrice ? Number(customPrice) : benchmark.mandiPrice;
  const totalYieldQuintals = Math.round(benchmark.yieldPerAcre * farmAcres * 10) / 10;
  const grossPotentialValue = Math.round(totalYieldQuintals * price);

  const sevKey = String(severity).toLowerCase();
  let stage = SEVERITY_LEVELS.moderate;
  if (sevKey.includes('crit') || sevKey.includes('outbreak')) stage = SEVERITY_LEVELS.critical;
  else if (sevKey.includes('sev') || sevKey.includes('high')) stage = SEVERITY_LEVELS.severe;
  else if (sevKey.includes('earl') || sevKey.includes('low') || sevKey.includes('minor')) stage = SEVERITY_LEVELS.early;

  const yieldLossQuintals = Math.round(totalYieldQuintals * (stage.lossPct / 100) * 10) / 10;
  const projectedLossINR = Math.round(yieldLossQuintals * price);

  const costPerAcre = benchmark.chemicalCost + benchmark.laborCost;
  const totalTreatmentCostINR = Math.round(costPerAcre * farmAcres);

  // Timely treatment salvages ~90% of threatened yield
  const harvestSavedINR = Math.round(projectedLossINR * 0.90);
  const roiMultiplier = totalTreatmentCostINR > 0
    ? Math.round((harvestSavedINR / totalTreatmentCostINR) * 10) / 10
    : 1;

  // 48-Hour delay penalty
  const delay48hLossPct = Math.min(95, stage.lossPct + (stage.dailySpreadPct * 2));
  const delay48hLossINR = Math.round(totalYieldQuintals * (delay48hLossPct / 100) * price);
  const additionalDelayLossINR = Math.max(0, delay48hLossINR - projectedLossINR);

  return {
    cropName: benchmark.name,
    diseaseName,
    stage,
    acres: farmAcres,
    pricePerQuintal: price,
    totalYieldQuintals,
    grossPotentialValue,
    yieldLossPct: stage.lossPct,
    yieldLossQuintals,
    projectedLossINR,
    totalTreatmentCostINR,
    harvestSavedINR,
    roiMultiplier,
    additionalDelayLossINR
  };
};
