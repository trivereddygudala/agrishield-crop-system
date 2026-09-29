/**
 * AgriShield B6 Phase 6 — Admin Crop Scan Audits Navigation & Discovery Test Suite (B6-P3-01)
 * Validates:
 * 1. Admin overview exposes Crop Scan Audits module card with /history destination.
 * 2. Admin sidebar exposes dedicated Crop Scan Audits link (/history).
 * 3. Non-Admin navigation groups do not receive the Admin-only navigation item.
 * 4. Required translation keys exist across all 7 official regional languages (en, te, ta, kn, hi, ml, or).
 * 5. Zero deprecated languages introduced in extendedTranslations.
 * 6. Zero binary isTe or isTelugu ternaries in AdminPage.
 * 7. Preservation of B6-P1-01, B6-P2-02, and B6-P2-01.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B6 PHASE 6 — ADMIN CROP SCAN AUDITS DISCOVERY (B6-P3-01)');
console.log('═══════════════════════════════════════════════════════════════════\n');

let totalTests = 0;
let passedTests = 0;

async function test(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(`    ${err.message}`);
  }
}

const adminPagePath = path.resolve(__dirname, '../src/pages/admin/AdminPage.jsx');
const appLayoutPath = path.resolve(__dirname, '../src/components/AppLayout.jsx');
const extendedTranslationsPath = path.resolve(__dirname, '../src/i18n/extendedTranslations.js');

const adminCode = fs.readFileSync(adminPagePath, 'utf8');
const appLayoutCode = fs.readFileSync(appLayoutPath, 'utf8');

// 1. Admin overview exposes the Crop Scan Audits entry
await test('Admin overview exposes the Crop Scan Audits module card', () => {
  assert(adminCode.includes("id: 'scans'"), "adminTabs must include module with id 'scans'");
  assert(adminCode.includes("admin.module_scans_title"), "adminTabs must use localized module_scans_title key");
  assert(adminCode.includes("admin.module_scans_desc"), "adminTabs must use localized module_scans_desc key");
  assert(adminCode.includes("admin.scans_badge"), "adminTabs must use localized scans_badge key");
});

// 2. The entry points to /history
await test('Crop Scan Audits entry points and navigates directly to /history', () => {
  assert(adminCode.includes("path: '/history'"), "Scans module must specify path: '/history'");
  assert(adminCode.includes("navigate('/history')"), "AdminPage must support navigating to /history");
});

// 3. Admin sidebar exposes /history
await test('Admin sidebar navigation exposes dedicated /history item', () => {
  assert(appLayoutCode.includes("path: \"/history\""), "Sidebar navGroups must include /history item");
  assert(appLayoutCode.includes("admin.nav_crop_scans"), "Sidebar item must use admin.nav_crop_scans key");
});

// 4. Non-Admin navigation does not receive the Admin-only navigation item
await test('Non-Admin navigation groups do not receive admin.nav_crop_scans item', () => {
  // Extract navGroups definition
  const adminNavMatch = appLayoutCode.match(/const navGroups = isAdmin \? (\[[\s\S]*?\]) : isEquipmentProvider \? (\[[\s\S]*?\]) : isTester \? (\[[\s\S]*?\]) : (\[[\s\S]*?\]);/);
  assert(adminNavMatch, "Must identify navGroups role branching");

  const adminNav = adminNavMatch[1];
  const providerNav = adminNavMatch[2];
  const testerNav = adminNavMatch[3];
  const farmerNav = adminNavMatch[4];

  assert(adminNav.includes("admin.nav_crop_scans"), "Admin nav must include admin.nav_crop_scans");
  assert(!providerNav.includes("admin.nav_crop_scans"), "Provider nav must NOT include admin.nav_crop_scans");
  assert(!testerNav.includes("admin.nav_crop_scans"), "Tester nav must NOT include admin.nav_crop_scans");
  assert(!farmerNav.includes("admin.nav_crop_scans"), "Farmer nav must NOT include admin.nav_crop_scans");
});

// 5. Required translation keys exist across all 7 supported official languages
await test('Required translation keys exist with non-empty values across all 7 supported languages', async () => {
  const mod = await import('../src/i18n/extendedTranslations.js');
  const resources = mod.extendedResources;
  const officialLangs = ['en', 'te', 'ta', 'kn', 'hi', 'ml', 'or'];
  const requiredKeys = ['module_scans_title', 'module_scans_desc', 'nav_crop_scans', 'scans_badge', 'core_modules_title'];

  for (const lang of officialLangs) {
    assert(resources[lang], `Language ${lang} must exist`);
    assert(resources[lang].admin, `Language ${lang} must have 'admin' domain`);
    for (const key of requiredKeys) {
      const val = resources[lang].admin[key];
      assert(typeof val === 'string' && val.trim().length > 0, `Key ${key} in ${lang} must be a non-empty string`);
      assert(!val.includes('Translation for'), `Key ${key} in ${lang} must not be a placeholder`);
    }
  }

  // Exact key parity across all 7 languages
  const enKeys = Object.keys(resources.en.admin).sort();
  for (const lang of officialLangs) {
    const langKeys = Object.keys(resources[lang].admin).sort();
    assert.deepStrictEqual(langKeys, enKeys, `Key set for ${lang} must exactly match en keys`);
  }
});

// 6. No deprecated languages introduced
await test('No deprecated languages exist in extendedTranslations (mr, pa, bn, ur, as, gu)', async () => {
  const mod = await import('../src/i18n/extendedTranslations.js');
  const resources = mod.extendedResources;
  const forbidden = ['mr', 'pa', 'bn', 'ur', 'as', 'gu'];
  for (const lang of forbidden) {
    assert(!resources[lang], `Forbidden language ${lang} must not exist`);
  }
});

// 7. No binary isTe / isTelugu translation ternaries in AdminPage
await test('AdminPage has zero binary isTe or isTelugu translation branching', () => {
  assert(!adminCode.includes('isTe ?'), "Must not introduce isTe ?");
  assert(!adminCode.includes('isTelugu ?'), "Must not introduce isTelugu ?");
});

// 8. Preservation of B6-P1-01 Pagination, B6-P2-02 Broadcast, and B6-P2-01 Localization
await test('Preservation of all previous uncommitted B6 work', () => {
  assert(adminCode.includes('userPage'), "B6-P1-01 userPage must exist");
  assert(adminCode.includes('broadcastHistoryError'), "B6-P2-02 broadcastHistoryError must exist");
  assert(!adminCode.includes("localStorage.getItem('agrishield_broadcast_history')"), "B6-P2-02 no broadcast localStorage fallback");
  assert(adminCode.includes("const { t } = useTranslation();"), "B6-P2-01 useTranslation must exist");
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
