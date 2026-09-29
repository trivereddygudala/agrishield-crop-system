/**
 * AgriShield B5 M-2 Provider Portal Loading States & Error Banners Test Suite
 * Validates loading skeletons, error banners, retry UX, cached data protection,
 * per-booking action mutex, machine action feedback, and 7-language completeness.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';
import { extendedResources } from '../src/i18n/extendedTranslations.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B5 M-2 PROVIDER LOADING STATES & ERROR BANNERS VALIDATION SUITE');
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

const providerDashboardPath = path.resolve(__dirname, '../src/pages/provider/ProviderDashboardPage.jsx');
const providerCode = fs.readFileSync(providerDashboardPath, 'utf8');

const SUPPORTED_LANGUAGES = ['en', 'te', 'ta', 'kn', 'hi', 'ml', 'or'];
const REQUIRED_NEW_KEYS = [
  'loading_fleet',
  'loading_orders',
  'fleet_load_error',
  'orders_load_error',
  'retry_sync',
  'showing_cached_data',
  'no_machinery_listed',
  'no_machinery_listed_desc',
  'machine_update_failed',
  'machine_delete_failed'
];

// 1. Fleet Loading State
it('1. ProviderDashboardPage defines and manages isFleetLoading state', () => {
  assert(providerCode.includes('isFleetLoading'), 'ProviderDashboardPage must define isFleetLoading state');
  assert(providerCode.includes('setIsFleetLoading(true)'), 'Must set isFleetLoading to true on initial or retry fetch');
  assert(providerCode.includes('setIsFleetLoading(false)'), 'Must clear isFleetLoading in finally block');
});

// 2. Booking Loading State
it('2. ProviderDashboardPage defines and manages isBookingsLoading state', () => {
  assert(providerCode.includes('isBookingsLoading'), 'ProviderDashboardPage must define isBookingsLoading state');
  assert(providerCode.includes('setIsBookingsLoading(true)'), 'Must set isBookingsLoading to true on initial or retry fetch');
  assert(providerCode.includes('setIsBookingsLoading(false)'), 'Must clear isBookingsLoading in finally block');
});

// 3. Fleet Error State
it('3. ProviderDashboardPage defines fleetError and captures API failure', () => {
  assert(providerCode.includes('fleetError'), 'ProviderDashboardPage must define fleetError state');
  assert(providerCode.includes('setFleetError('), 'Must set fleetError when GET /fleet fails');
  assert(providerCode.includes('fleet_load_error'), 'Must reference localized fleet_load_error string');
  assert(!providerCode.includes('catch (err) { return; }'), 'Must not have empty silent catch in fetchRemoteFleet');
});

// 4. Booking Error State
it('4. ProviderDashboardPage defines bookingsError and captures API failure', () => {
  assert(providerCode.includes('bookingsError'), 'ProviderDashboardPage must define bookingsError state');
  assert(providerCode.includes('setBookingsError('), 'Must set bookingsError when GET /bookings fails');
  assert(providerCode.includes('orders_load_error'), 'Must reference localized orders_load_error string');
});

// 5. Retry Controls
it('5. Canonical retry controls exist for fleet and bookings with overlap protection', () => {
  assert(providerCode.includes('fetchRemoteFleet(true)'), 'Fleet retry must call canonical fetchRemoteFleet(true)');
  assert(providerCode.includes('fetchProviderBookings(true)'), 'Booking retry must call canonical fetchProviderBookings(true)');
  assert(providerCode.includes('isFleetFetchingRef'), 'Fleet fetch must have in-flight overlap guard');
  assert(providerCode.includes('isBookingsFetchingRef'), 'Booking fetch must have in-flight overlap guard');
  assert(providerCode.includes('retry_sync'), 'Must provide localized retry_sync button text');
});

// 6. Cached-Data Warning Path
it('6. Cached data is preserved on network failure and shows warning chip with retry', () => {
  assert(providerCode.includes('fleetError && cleanFleetList.length > 0'), 'Must check for cached fleet during error');
  assert(providerCode.includes('bookingsError && cleanBookingsList.length > 0'), 'Must check for cached bookings during error');
  assert(providerCode.includes('showing_cached_data'), 'Must render localized showing_cached_data warning');
});

// 7. Empty States Distinct from Loading and Errors
it('7. Empty states are strictly distinct from loading skeletons and error banners', () => {
  assert(providerCode.includes('data-testid="fleet-skeleton-loader"'), 'Must render skeleton loader for fleet');
  assert(providerCode.includes('data-testid="orders-skeleton-loader"'), 'Must render skeleton loader for orders');
  assert(providerCode.includes('data-testid="fleet-error-state"'), 'Must render dedicated error state for fleet');
  assert(providerCode.includes('data-testid="orders-error-state"'), 'Must render dedicated error state for orders');
  assert(providerCode.includes('data-testid="fleet-empty-state"'), 'Must render genuine empty state for fleet');
  assert(providerCode.includes('data-testid="orders-empty-state"'), 'Must render genuine empty state for orders');
  assert(providerCode.includes('no_machinery_listed'), 'Must use localized no_machinery_listed string');
  assert(providerCode.includes('no_bookings_title'), 'Must use localized no_bookings_title string');
});

// 8. Per-Booking Action Mutex
it('8. ProviderDashboardPage enforces per-booking in-flight mutex (updatingBookingId)', () => {
  assert(providerCode.includes('updatingBookingId'), 'Must maintain updatingBookingId state');
  assert(providerCode.includes('if (updatingBookingId === bookingId) return;'), 'Must abort handleUpdateBookingStatus if already updating');
  assert(providerCode.includes('setUpdatingBookingId(bookingId)'), 'Must set updatingBookingId before async status mutation');
  assert(providerCode.includes('setUpdatingBookingId(null)'), 'Must clear updatingBookingId in finally block');
  const disabledCount = (providerCode.match(/disabled=\{updatingBookingId ===/g) || []).length;
  assert(disabledCount >= 4, `Expected at least 4 action buttons protected by updatingBookingId, found ${disabledCount}`);
});

// 9. Machine Mutation Error Feedback
it('9. Machine availability toggle and deletion failures roll back and show user toast', () => {
  assert(providerCode.includes('machine_update_failed'), 'Must notify user with machine_update_failed toast on patch failure');
  assert(providerCode.includes('machine_delete_failed'), 'Must notify user with machine_delete_failed toast on delete failure');
  assert(providerCode.includes('setFleetList(priorFleet)'), 'Must roll back fleet availability state on server sync failure');
});

// 10. 7-Language Completeness for New Keys
it('10. All 10 new translation keys exist and are non-empty across all 7 supported languages', () => {
  SUPPORTED_LANGUAGES.forEach(lang => {
    assert(extendedResources[lang], `Language ${lang} missing from extendedResources`);
    assert(extendedResources[lang].provider_hub, `provider_hub missing in language ${lang}`);
    REQUIRED_NEW_KEYS.forEach(key => {
      const val = extendedResources[lang].provider_hub[key];
      assert(val && typeof val === 'string' && val.trim().length > 0, `Missing/empty key provider_hub.${key} in language ${lang}`);
    });
  });
});

// 11. Zero Binary isTe Translation Ternaries Introduced
it('11. Zero binary isTe translation ternaries in ProviderDashboardPage', () => {
  const isTeTernaries = providerCode.match(/isTe\s*\?\s*['"`]/g) || [];
  assert.strictEqual(isTeTernaries.length, 0, `Found ${isTeTernaries.length} forbidden isTe translation ternaries`);
});

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('═══════════════════════════════════════════════════════════════════\n');

if (totalTests !== passedTests) {
  process.exit(1);
}
