/**
 * AgriShield B6 Phase 5 — Admin Portal 7-Language Complete Localization Test Suite (B6-P2-01)
 * Validates canonical translation hook usage, parity of new admin translation keys across
 * all 7 official regional languages (en, te, ta, kn, hi, ml, or), absence of deprecated languages,
 * preservation of B6-P1-01 pagination and B6-P2-02 broadcast history, and absence of isTe branching.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B6 PHASE 5 — ADMIN PORTAL 7-LANGUAGE LOCALIZATION (B6-P2-01)');
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

const adminPagePath = path.resolve(__dirname, '../src/pages/admin/AdminPage.jsx');
const extendedTranslationsPath = path.resolve(__dirname, '../src/i18n/extendedTranslations.js');

const adminCode = fs.readFileSync(adminPagePath, 'utf8');

// 1. AdminPage uses canonical useTranslation hook
it('AdminPage.jsx imports and initializes canonical useTranslation hook', () => {
  assert(adminCode.includes("import { useTranslation } from 'react-i18next';"), 'Must import useTranslation');
  assert(adminCode.includes('const { t } = useTranslation();'), 'Must initialize t from useTranslation');
});

// 2. Parity across official 7 languages in extendedTranslations
it('New Admin translation domain exists with complete parity across all 7 supported languages', async () => {
  const mod = await import('../src/i18n/extendedTranslations.js');
  const resources = mod.extendedResources;
  const officialLangs = ['en', 'te', 'ta', 'kn', 'hi', 'ml', 'or'];

  for (const lang of officialLangs) {
    assert(resources[lang], `Language ${lang} must exist in extendedResources`);
    assert(resources[lang].admin, `Language ${lang} must have 'admin' domain`);
    const adminKeys = Object.keys(resources[lang].admin);
    assert(adminKeys.length >= 35, `Language ${lang} must have at least 35 admin keys, found ${adminKeys.length}`);

    // All keys must be non-empty strings
    for (const [k, v] of Object.entries(resources[lang].admin)) {
      assert(typeof v === 'string' && v.trim().length > 0, `Key ${k} in ${lang} must be a non-empty string`);
      assert(!v.includes('Translation for'), `Key ${k} in ${lang} must not be a dummy placeholder`);
    }
  }

  // Key parity
  const enKeys = Object.keys(resources.en.admin).sort();
  for (const lang of officialLangs) {
    const langKeys = Object.keys(resources[lang].admin).sort();
    assert.deepStrictEqual(langKeys, enKeys, `Keys for ${lang} must match en keys exactly`);
  }
});

// 3. No deprecated languages in extendedTranslations
it('Zero deprecated languages exist in extendedTranslations (mr, pa, bn, ur, as, gu)', async () => {
  const mod = await import('../src/i18n/extendedTranslations.js');
  const resources = mod.extendedResources;
  const forbidden = ['mr', 'pa', 'bn', 'ur', 'as', 'gu'];
  for (const lang of forbidden) {
    assert(!resources[lang], `Forbidden deprecated language ${lang} must not exist in extendedResources`);
  }
});

// 4. No binary isTe or isTelugu branching introduced in AdminPage
it('AdminPage.jsx has zero isTe or isTelugu binary translation ternaries', () => {
  assert(!adminCode.includes('isTe ?'), 'Must not introduce isTe ? ternary branching');
  assert(!adminCode.includes('isTelugu ?'), 'Must not introduce isTelugu ? ternary branching');
  assert(!adminCode.includes('const isTe ='), 'Must not declare isTe variable');
});

// 5. Preservation of B6-P1-01 Pagination
it('B6-P1-01 user directory pagination state and controls remain intact', () => {
  assert(adminCode.includes('userPage'), 'userPage state must exist');
  assert(adminCode.includes('userPageSize'), 'userPageSize state must exist');
  assert(adminCode.includes('totalUsersCount'), 'totalUsersCount state must exist');
  assert(adminCode.includes('totalPagesCount'), 'totalPagesCount state must exist');
  assert(adminCode.includes('hasMoreUsers'), 'hasMoreUsers state must exist');
  assert(adminCode.includes("t('admin.showing_range'"), 'Showing range must be localized');
  assert(adminCode.includes("t('admin.btn_prev'"), 'Previous button must be localized');
  assert(adminCode.includes("t('admin.btn_next'"), 'Next button must be localized');
  assert(adminCode.includes("t('admin.page_x_of_y'"), 'Page count must be localized');
});

// 6. Preservation of B6-P2-02 Broadcast History Cleanup
it('B6-P2-02 broadcast history cleanup and error state remain intact', () => {
  assert(!adminCode.includes("localStorage.getItem('agrishield_broadcast_history')"), 'Must not reintroduce localStorage broadcast fallback');
  assert(adminCode.includes('broadcastHistoryError'), 'broadcastHistoryError state must be preserved');
  assert(adminCode.includes('Retry Sync'), 'Retry Sync button must be preserved');
  assert(adminCode.includes("t('admin.dispatch_new_broadcast'"), 'Dispatch broadcast label must be localized');
  assert(adminCode.includes("t('admin.broadcast_history'"), 'Broadcast history label must be localized');
});

// 7. Core administrative command center elements use t()
it('AdminPage.jsx command header, metrics, and modules use canonical t() calls', () => {
  assert(adminCode.includes("t('admin.command_center_badge'"), 'Command center badge must use t()');
  assert(adminCode.includes("t('admin.hub_title'"), 'Hub title must use t()');
  assert(adminCode.includes("t('admin.refresh_portal'"), 'Refresh portal must use t()');
  assert(adminCode.includes("t('admin.metric_registered_users'"), 'Registered users metric must use t()');
  assert(adminCode.includes("t('admin.core_modules_title'"), 'Core modules title must use t()');
});

// 8. Admin modals action buttons use t()
it('Admin modal buttons use canonical t() translations', () => {
  assert(adminCode.includes("t('admin.btn_cancel'"), 'Cancel buttons must use t()');
  assert(adminCode.includes("t('admin.btn_save'"), 'Save changes button must use t()');
  assert(adminCode.includes("t('admin.btn_delete'"), 'Delete button must use t()');
  assert(adminCode.includes("t('admin.btn_reset_pwd'"), 'Reset password button must use t()');
  assert(adminCode.includes("t('admin.btn_create_account'"), 'Create account button must use t()');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
