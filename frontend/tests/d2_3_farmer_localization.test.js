/**
 * D2.3 Farmer Six-Language UI Localization Test Suite
 * Validates the elimination of binary Telugu/English UI fallbacks,
 * six-language dictionary completeness, Odia typography/TTS safety,
 * Equipment Booking localization, AI safety UI labels, and notification templates.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { resources } from '../src/i18n/translations.js';
import { extendedResources } from '../src/i18n/extendedTranslations.js';
import { translateNotification } from '../src/utils/notificationTranslator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('D2.3 FARMER SIX-LANGUAGE UI LOCALIZATION TEST SUITE');
console.log('Target Languages: te, en, hi, ta, kn, or');
console.log('═══════════════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

const MANDATORY_LANGS = ['te', 'en', 'hi', 'ta', 'kn', 'or'];

// Helper to look up a key across resources (standard translation namespace) and extendedResources
function lookupKey(lang, namespace, key) {
  if (extendedResources[lang]?.[namespace]?.[key]) {
    return extendedResources[lang][namespace][key];
  }
  if (resources[lang]?.translation?.[namespace]?.[key]) {
    return resources[lang].translation[namespace][key];
  }
  if (resources[lang]?.[namespace]?.[key]) {
    return resources[lang][namespace][key];
  }
  return null;
}

function lookupNamespace(lang, namespace) {
  return extendedResources[lang]?.[namespace] ||
         resources[lang]?.translation?.[namespace] ||
         resources[lang]?.[namespace];
}

// ── Test 1: Language switching representation ──
it('Test 1 — Language switching: All six mandatory languages exist in resources and extendedResources', () => {
  MANDATORY_LANGS.forEach(lang => {
    assert(resources[lang], `resources missing mandatory language: ${lang}`);
    assert(extendedResources[lang], `extendedResources missing mandatory language: ${lang}`);
  });
});

// ── Test 2: Dictionary completeness ──
it('Test 2 — Dictionary completeness: Newly introduced UI namespaces exist across all six languages', () => {
  const namespaces = ['ai_safety', 'advisor', 'dashboard', 'equipment_hub', 'more', 'support_page'];
  MANDATORY_LANGS.forEach(lang => {
    namespaces.forEach(ns => {
      const exists = lookupNamespace(lang, ns);
      assert(exists, `Language ${lang} missing namespace: ${ns}`);
    });
  });
});

// ── Test 3: Equipment Booking localization ──
it('Test 3 — Equipment Booking: Representative booking keys localize in all six languages', () => {
  const sampleKeys = [
    'category_all', 'category_tractors', 'category_sprayers',
    'book_now', 'confirm_booking', 'active_bookings'
  ];
  MANDATORY_LANGS.forEach(lang => {
    sampleKeys.forEach(k => {
      const val = lookupKey(lang, 'equipment_hub', k);
      assert(val, `Language ${lang} missing equipment_hub.${k}`);
    });
  });
});

// ── Test 4: Dashboard KPI & Quick tools localization ──
it('Test 4 — Dashboard: KPI and smart action labels localize in all six languages', () => {
  MANDATORY_LANGS.forEach(lang => {
    const kpiActive = lookupKey(lang, 'dashboard', 'kpi')?.active_crop_label ||
                      lookupNamespace(lang, 'dashboard')?.kpi?.active_crop_label;
    const kpiLeaf = lookupKey(lang, 'dashboard', 'kpi')?.leaf_scans_label ||
                    lookupNamespace(lang, 'dashboard')?.kpi?.leaf_scans_label;
    const tabToday = lookupKey(lang, 'dashboard', 'smart_actions')?.tabs_today ||
                     lookupNamespace(lang, 'dashboard')?.smart_actions?.tabs_today;

    assert(kpiActive, `Language ${lang} missing dashboard.kpi.active_crop_label`);
    assert(kpiLeaf, `Language ${lang} missing dashboard.kpi.leaf_scans_label`);
    assert(tabToday, `Language ${lang} missing dashboard.smart_actions.tabs_today`);
  });
});

// ── Test 5: AI Safety states ──
it('Test 5 — AI safety states: All 6 required prediction state labels exist', () => {
  const states = [
    'healthy',
    'confirmed_disease',
    'uncertain',
    'image_unsuitable',
    'unsupported',
    'secondary_review_required'
  ];
  MANDATORY_LANGS.forEach(lang => {
    states.forEach(st => {
      const val = lookupKey(lang, 'ai_safety', st);
      assert(val, `Language ${lang} missing ai_safety.${st}`);
    });
  });
});

// ── Test 6: Notification templates ──
it('Test 6 — Notification templates: Known categories localize without mutating dynamic values', () => {
  // Test soil moisture template with dynamic percent
  const notifTe = translateNotification('Soil Moisture Critical', 'Field sensor reports soil moisture dropped below 22.5%.', 'te');
  assert(notifTe.title.includes('నేల తేమ'), `Expected Telugu soil title, got: ${notifTe.title}`);
  assert(notifTe.message.includes('22.5%'), `Dynamic percent missing in localized message: ${notifTe.message}`);

  // Test Odia notification
  const notifOr = translateNotification('Soil Moisture Critical', 'Field sensor reports soil moisture dropped below 22.5%.', 'or');
  assert(notifOr.title.includes('ମାଟି'), `Expected Odia soil title, got: ${notifOr.title}`);
  assert(notifOr.message.includes('22.5%'), `Dynamic percent missing in Odia message: ${notifOr.message}`);
});

// ── Test 7: Odia typography and TTS safety ──
it('Test 7 — Odia typography & TTS: CSS includes Noto Sans Oriya and TTS blocks wrong-language fallback', () => {
  const css = fs.readFileSync(path.join(__dirname, '../src/index.css'), 'utf-8');
  assert(css.includes('Noto Sans Oriya'), 'index.css missing Noto Sans Oriya font');
  assert(css.includes('font-odia'), 'index.css missing font-odia class');

  const speechReader = fs.readFileSync(path.join(__dirname, '../src/hooks/useSpeechReader.js'), 'utf-8');
  assert(speechReader.includes("primaryCode === 'or'"), 'useSpeechReader.js missing Odia language check');
  assert(speechReader.includes('agrishield-toast'), 'useSpeechReader.js missing Odia voice safeguard toast');
});

// ── Test 8: Zero binary UI ternaries in approved D2.3 files ──
it('Test 8 — No binary UI fallback: 0 remaining isTe / isTelugu ternaries in approved files', () => {
  const APPROVED_FILES = [
    "../src/index.css",
    "../src/hooks/useSpeechReader.js",
    "../src/i18n/translations.js",
    "../src/i18n/extendedTranslations.js",
    "../src/pages/farmer/EquipmentBookingPage.jsx",
    "../src/pages/farmer/FarmPage.jsx",
    "../src/pages/common/HelpSupportPage.jsx",
    "../src/components/farm/SmartFarmerActionCenter.jsx",
    "../src/components/intelligence/FieldIntelligenceWidget.jsx",
    "../src/components/intelligence/PathogenWeatherRadar.jsx",
    "../src/components/scanCenter/DiseaseDiagnosisResults.jsx",
    "../src/pages/farmer/DashboardPage.jsx",
    "../src/pages/farmer/UploadImagePage.jsx",
    "../src/pages/farmer/PredictionResultPage.jsx",
    "../src/pages/common/MorePage.jsx",
    "../src/pages/common/ProfilePage.jsx",
    "../src/pages/common/SettingsPage.jsx",
    "../src/utils/notificationTranslator.js"
  ];

  APPROVED_FILES.forEach(relPath => {
    const fullPath = path.join(__dirname, relPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const isTeMatches = content.match(/\bisTe\b/g) || [];
    const isTeluguMatches = content.match(/\bisTelugu\b/g) || [];
    assert(isTeMatches.length === 0, `${relPath} still contains ${isTeMatches.length} isTe occurrences`);
    assert(isTeluguMatches.length === 0, `${relPath} still contains ${isTeluguMatches.length} isTelugu occurrences`);
  });
});

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(`D2.3 TEST RUN COMPLETE: ${passedTests}/${totalTests} PASSED`);
console.log('═══════════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
