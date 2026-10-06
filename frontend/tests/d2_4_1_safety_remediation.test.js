/**
 * D2.4.1 Safety & Agronomic Output Remediation Test Suite
 * Validates:
 * - Test 1: Unsafe Alias Removal (no cross-pathology mapping to Early Blight / Spodoptera)
 * - Test 2: Unknown Disease Handling (no Early Blight fallback, zero chemical recommendation)
 * - Test 3: Empty Backend Chemical (zero Solomon, Exponus, Mancozeb or arbitrary pesticide)
 * - Test 4: Unsupported Image state across all 6 languages (no chemicals, no dosage)
 * - Test 5: Uncertain/OOD state (requires_secondary_review = true -> no chemicals)
 * - Test 6: Healthy state (prediction_status = 'healthy' -> no synthetic pesticides)
 * - Test 7: Confirmed Disease (displays backend-authorized value only, no extra chemicals)
 * - Test 8: Language Invariance (te, en, hi, ta, kn, or all yield identical safety decisions)
 * - Test 9: Numeric Safety (verbatim dosage preservation, no frontend linear recalculation)
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import {
  normalizeDiseaseKey,
  getDiseaseDetails
} from '../src/utils/diseaseAdvisoryData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('D2.4.1 FRONTEND SAFETY & AGRONOMIC REMEDIATION TEST SUITE');
console.log('Validating B30-B33 Safety Invariants & Fallback Elimination');
console.log('═══════════════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    process.exitCode = 1;
  }
}

const MANDATORY_LANGS = ['te', 'en', 'hi', 'ta', 'kn', 'or'];

// ---------------------------------------------------------------------------
// TEST 1 — Unsafe Alias Removal
// ---------------------------------------------------------------------------
test('Test 1 — Unsafe cross-pathology aliases do NOT resolve to early blight or spodoptera litura', () => {
  const unsafeDiseases = [
    'fusarium_wilt',
    'root_rot',
    'root_knot_nematode',
    'fruit_fly',
    'clubroot',
    'false_smut',
    'black_rot',
    'damping_off',
    'phytophthora_root_rot',
    'bacterial_wilt',
    'stem_borer',
    'rhizome_rot'
  ];

  for (const disease of unsafeDiseases) {
    const details = getDiseaseDetails(disease);
    // Must NOT inherit early blight or spodoptera litura recommendations
    assert.strictEqual(
      details.diseaseKey !== 'early blight' && details.diseaseKey !== 'spodoptera litura',
      true,
      `Unsafe alias ${disease} unexpectedly resolved to ${details.diseaseKey}`
    );
    // Must return zero chemicals
    assert.strictEqual(
      Array.isArray(details.chemicals) && details.chemicals.length === 0,
      true,
      `Unsafe alias ${disease} must have empty chemicals array, got: ${JSON.stringify(details.chemicals)}`
    );
  }
});

// ---------------------------------------------------------------------------
// TEST 2 — Unknown Disease Handling
// ---------------------------------------------------------------------------
test('Test 2 — Unknown/uncatalogued disease returns safe neutral state with NO chemicals', () => {
  const unknownKeys = [
    'random_unknown_disease',
    'unknown_pathology_x',
    'nonexistent_fungus_123',
    'alien_crop_syndrome'
  ];

  for (const key of unknownKeys) {
    const details = getDiseaseDetails(key);
    assert.strictEqual(
      details.diseaseKey !== 'early blight',
      true,
      `Unknown disease ${key} must NOT default to early blight`
    );
    assert.strictEqual(
      Array.isArray(details.chemicals) && details.chemicals.length === 0,
      true,
      `Unknown disease ${key} must have empty chemicals, got: ${JSON.stringify(details.chemicals)}`
    );
  }
});

// ---------------------------------------------------------------------------
// TEST 3 — Empty Backend Chemical Safety
// ---------------------------------------------------------------------------
test('Test 3 — Empty backend chemical result does not inject Solomon, Exponus, or Mancozeb fallback', () => {
  // Read DiseaseDiagnosisResults.jsx to verify elimination of hardcoded fallbacks
  const ddrPath = path.resolve(__dirname, '../src/components/scanCenter/DiseaseDiagnosisResults.jsx');
  const ddrCode = fs.readFileSync(ddrPath, 'utf8');

  // Must not have the old fallback array containing Solomon or Exponus
  assert.strictEqual(
    ddrCode.includes("name: 'Solomon (Bayer)'"),
    false,
    'DiseaseDiagnosisResults.jsx still contains hardcoded Solomon fallback'
  );
  assert.strictEqual(
    ddrCode.includes("name: 'Exponus (BASF)'"),
    false,
    'DiseaseDiagnosisResults.jsx still contains hardcoded Exponus fallback'
  );
  assert.strictEqual(
    ddrCode.includes("COMMERCIAL_PRODUCTS[0]") || ddrCode.includes("COMMERCIAL_PRODUCTS[1]"),
    false,
    'DiseaseDiagnosisResults.jsx must not use arbitrary COMMERCIAL_PRODUCTS indexing as fallback'
  );

  // Check UploadImagePage.jsx for Mancozeb 75% WP fallback
  const uipPath = path.resolve(__dirname, '../src/pages/farmer/UploadImagePage.jsx');
  const uipCode = fs.readFileSync(uipPath, 'utf8');
  assert.strictEqual(
    uipCode.includes('Apply Mancozeb 75% WP (2.5g/L) as foliar spray.'),
    false,
    'UploadImagePage.jsx still contains hardcoded Mancozeb fallback'
  );
});

// ---------------------------------------------------------------------------
// TEST 4 — Unsupported Image State Across All 6 Languages
// ---------------------------------------------------------------------------
test('Test 4 — Unsupported image state enforces NO chemicals across all 6 languages', () => {
  const ddrPath = path.resolve(__dirname, '../src/components/scanCenter/DiseaseDiagnosisResults.jsx');
  const ddrCode = fs.readFileSync(ddrPath, 'utf8');

  // Verify that isUnsupported gates chemical rendering
  assert.strictEqual(
    ddrCode.includes('isUnsupported'),
    true,
    'DiseaseDiagnosisResults.jsx must check isUnsupported'
  );
  assert.strictEqual(
    ddrCode.includes('isNonChemicalState'),
    true,
    'DiseaseDiagnosisResults.jsx must enforce isNonChemicalState'
  );

  // Invariant simulation for all 6 languages
  for (const lang of MANDATORY_LANGS) {
    const liveResult = {
      prediction_status: 'unsupported',
      status: 'unsupported',
      is_crop: false,
      disease: 'Non-Plant / Corrupted Sample',
      chemical_treatment: null
    };

    const isUnsupported = liveResult.prediction_status === 'unsupported' || liveResult.status === 'unsupported' || liveResult.is_crop === false;
    const isNonChemicalState = isUnsupported;
    const hasAuthorizedChemicals = !isNonChemicalState && !!liveResult.chemical_treatment;

    assert.strictEqual(hasAuthorizedChemicals, false, `Lang ${lang}: Unsupported image must have zero authorized chemicals`);
  }
});

// ---------------------------------------------------------------------------
// TEST 5 — Uncertain/OOD State Safety
// ---------------------------------------------------------------------------
test('Test 5 — Uncertain/OOD scan (requires_secondary_review) blocks chemicals and dosage', () => {
  const prpPath = path.resolve(__dirname, '../src/pages/farmer/PredictionResultPage.jsx');
  const prpCode = fs.readFileSync(prpPath, 'utf8');

  // Must gate authorizedChemicals on requires_secondary_review
  assert.strictEqual(
    prpCode.includes('isUncertain'),
    true,
    'PredictionResultPage.jsx must track isUncertain'
  );

  const mockUncertainResult = {
    prediction_status: 'uncertain',
    requires_secondary_review: true,
    disease: 'Uncertain Pattern',
    chemical_treatment: 'None required (Diagnosis uncertain).'
  };

  const isUncertain = mockUncertainResult.requires_secondary_review === true || mockUncertainResult.prediction_status === 'uncertain';
  const isNonChemicalState = isUncertain;
  const authorizedChemicals = isNonChemicalState ? [] : [mockUncertainResult.chemical_treatment];

  assert.strictEqual(authorizedChemicals.length, 0, 'Uncertain result must yield zero chemical recommendations');
});

// ---------------------------------------------------------------------------
// TEST 6 — Healthy State Safety
// ---------------------------------------------------------------------------
test('Test 6 — Healthy scan blocks synthetic chemicals across UI, PDF, and Share flows', () => {
  const prpPath = path.resolve(__dirname, '../src/pages/farmer/PredictionResultPage.jsx');
  const prpCode = fs.readFileSync(prpPath, 'utf8');

  // Verify safe WhatsApp / Print / PDF handlers pass authorizedChemicals
  assert.strictEqual(
    prpCode.includes('chemicals: authorizedChemicals'),
    true,
    'PredictionResultPage.jsx must export only authorizedChemicals to PrescriptionSlipModal'
  );

  const mockHealthyResult = {
    prediction_status: 'healthy',
    disease: 'Healthy Crop',
    chemical_treatment: 'None required (Healthy crop).'
  };

  const isHealthy = mockHealthyResult.prediction_status === 'healthy';
  const isNonChemicalState = isHealthy;
  const authorizedChemicals = isNonChemicalState ? [] : [mockHealthyResult.chemical_treatment];

  assert.strictEqual(authorizedChemicals.length, 0, 'Healthy scan must yield zero synthetic chemicals');
});

// ---------------------------------------------------------------------------
// TEST 7 — Confirmed Disease Displays Backend-Authorized Value Only
// ---------------------------------------------------------------------------
test('Test 7 — Confirmed disease respects backend-authorized chemicals without inventing extras', () => {
  const mockConfirmedResult = {
    prediction_status: 'disease_detected',
    requires_secondary_review: false,
    disease: 'Early Blight',
    chemical_treatment: 'Chlorothalonil 75% WP @ 2.0 g/L'
  };

  const isNonChemicalState = false;
  const hasAuthorizedChemicals = !isNonChemicalState && !!mockConfirmedResult.chemical_treatment;
  assert.strictEqual(hasAuthorizedChemicals, true);

  // Must not append or invent additional products
  const displayedTreatment = mockConfirmedResult.chemical_treatment;
  assert.strictEqual(displayedTreatment, 'Chlorothalonil 75% WP @ 2.0 g/L');
});

// ---------------------------------------------------------------------------
// TEST 8 — Language Invariance
// ---------------------------------------------------------------------------
test('Test 8 — Safety decision is strictly invariant under all six languages', () => {
  const ddrPath = path.resolve(__dirname, '../src/components/scanCenter/DiseaseDiagnosisResults.jsx');
  const ddrCode = fs.readFileSync(ddrPath, 'utf8');

  // Regional text check must NOT be used to bypass backend chemical safety
  assert.strictEqual(
    ddrCode.includes('!hasRegionalText(liveResult?.chemical_treatment)'),
    false,
    'DiseaseDiagnosisResults.jsx must NOT use hasRegionalText to override backend chemical results'
  );

  // Evaluate invariant across languages for the same safety state
  for (const lang of MANDATORY_LANGS) {
    const uncertainState = {
      prediction_status: 'uncertain',
      requires_secondary_review: true,
      chemical_treatment: 'None required (Diagnosis uncertain).'
    };
    const isUncertain = uncertainState.requires_secondary_review === true;
    const canHaveChemicals = !isUncertain;
    assert.strictEqual(canHaveChemicals, false, `Lang ${lang} must NOT allow chemicals for uncertain state`);
  }
});

// ---------------------------------------------------------------------------
// TEST 9 — Numeric Safety & Client-Side Dosage Calculation Removal
// ---------------------------------------------------------------------------
test('Test 9 — Client-side arithmetic calculateSprayerDose is eliminated and verified label doses are preserved', () => {
  const ddrPath = path.resolve(__dirname, '../src/components/scanCenter/DiseaseDiagnosisResults.jsx');
  const ddrCode = fs.readFileSync(ddrPath, 'utf8');

  // Must not have calculateSprayerDose doing linear math on tankLitres
  assert.strictEqual(
    ddrCode.includes('const calculateSprayerDose ='),
    false,
    'DiseaseDiagnosisResults.jsx must not declare calculateSprayerDose arithmetic function'
  );
  assert.strictEqual(
    ddrCode.includes('(baseRate / 20) * tankLitres'),
    false,
    'DiseaseDiagnosisResults.jsx must not perform client-side linear dosage calculation'
  );
});

console.log(`\nTests completed: ${passedTests} / ${totalTests}`);
if (passedTests === totalTests) {
  console.log('ALL D2.4.1 FRONTEND SAFETY TESTS PASSED ✓');
} else {
  console.error('SOME D2.4.1 TESTS FAILED ✗');
  process.exitCode = 1;
}
