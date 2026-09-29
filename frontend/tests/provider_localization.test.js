/**
 * AgriShield B5 H-2 Provider Localization Test Suite
 * Validates 7-language coverage for Equipment Provider Workstation
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { extendedResources } from '../src/i18n/extendedTranslations.js';
import { normalizeLanguage } from '../src/utils/localizationHelper.js';

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B5 H-2 PROVIDER WORKSTATION 7-LANGUAGE VALIDATION SUITE');
console.log('Official Languages: en, te, ta, kn, hi, ml, or');
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

const SUPPORTED = ['en', 'te', 'ta', 'kn', 'hi', 'ml', 'or'];

// 1. Static Key Completeness
it('provider_hub domain exists in all 7 supported languages', () => {
  SUPPORTED.forEach(lang => {
    assert(extendedResources[lang], `Missing language: ${lang}`);
    assert(extendedResources[lang].provider_hub, `Missing provider_hub domain in: ${lang}`);
  });
});

it('All 7 languages have identical provider_hub keys with non-empty translations', () => {
  const enKeys = Object.keys(extendedResources.en.provider_hub);
  assert(enKeys.length >= 100, `Expected at least 100 provider_hub keys, found: ${enKeys.length}`);

  SUPPORTED.forEach(lang => {
    const langKeys = Object.keys(extendedResources[lang].provider_hub);
    assert.strictEqual(langKeys.length, enKeys.length, `Language ${lang} has ${langKeys.length} keys, expected ${enKeys.length}`);
    enKeys.forEach(k => {
      assert(langKeys.includes(k), `Language ${lang} is missing key: provider_hub.${k}`);
      const val = extendedResources[lang].provider_hub[k];
      assert(typeof val === 'string' && val.trim().length > 0, `Language ${lang} has empty translation for provider_hub.${k}`);
    });
  });
});

it('Zero provider keys exist in deprecated/forbidden languages', () => {
  const forbidden = ['mr', 'pa', 'bn', 'ur', 'as', 'gu'];
  forbidden.forEach(lang => {
    if (extendedResources[lang]) {
      const keys = Object.keys(extendedResources[lang]);
      assert(keys.length === 0, `Forbidden language ${lang} must not have translation keys`);
    }
  });
});

// 2. Codebase static scan
it('ProviderDashboardPage.jsx has 0 remaining isTe UI translation ternaries', () => {
  const code = fs.readFileSync(path.resolve('frontend/src/pages/provider/ProviderDashboardPage.jsx'), 'utf-8');
  const matches = code.match(/isTe\s*\?/g) || [];
  assert.strictEqual(matches.length, 0, `Found ${matches.length} remaining "isTe ?" UI translation ternaries in ProviderDashboardPage.jsx`);
});

it('ProviderDashboardPage.jsx passes active language (currentLang) to GoogleMessageReader', () => {
  const code = fs.readFileSync(path.resolve('frontend/src/pages/provider/ProviderDashboardPage.jsx'), 'utf-8');
  assert(code.includes('lang={currentLang}'), 'GoogleMessageReader must receive lang={currentLang}');
  assert(!code.includes("lang={isTe ? 'te' : 'en'}"), 'Binary lang={isTe ? ...} must not remain');
});

// 3. Multi-language resolution verification
it('Resolves provider_hub strings across all 7 regional languages', () => {
  const testKeys = ['machinery_fleet_tab', 'booking_orders_tab', 'earnings_ledger_tab', 'today_status', 'verified_provider'];
  SUPPORTED.forEach(lang => {
    testKeys.forEach(k => {
      const val = extendedResources[lang].provider_hub[k];
      assert(val && val.length > 0, `Failed to resolve ${k} for ${lang}`);
    });
  });
});

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(`TEST RUN COMPLETE: ${passedTests}/${totalTests} PASSED`);
console.log('═══════════════════════════════════════════════════════════════════');

if (passedTests !== totalTests) {
  process.exit(1);
}
