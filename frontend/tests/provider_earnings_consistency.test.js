/**
 * AgriShield B5 L-2 Provider Earnings & Revenue Consistency Test Suite
 * Validates canonical booking cost helper, aggregate earnings vs ledger consistency,
 * preservation of legitimate 0 amounts, data honesty, and absence of fabricated fallbacks.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B5 L-2 PROVIDER EARNINGS & REVENUE CONSISTENCY VALIDATION SUITE');
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

// Extract and dynamically evaluate the exact getBookingCost implementation from source
const helperMatch = providerCode.match(/export const getBookingCost = \((?:booking)?\)\s*=>\s*\{([\s\S]*?)\n\};/);
assert(helperMatch, 'getBookingCost must be exported from ProviderDashboardPage.jsx');
const getBookingCost = new Function('booking', helperMatch[1]);

// 1. Same booking cost in aggregate earnings and ledger
it('1. Same booking cost is used in aggregate earnings and ledger', () => {
  assert(
    providerCode.includes('.reduce((sum, b) => sum + getBookingCost(b), 0)'),
    'totalEarnings must reduce using getBookingCost(b)'
  );
  assert(
    providerCode.includes('getBookingCost(b).toLocaleString('),
    'Completed operations ledger row item must format using getBookingCost(b)'
  );
});

// 2. Missing totalCost does not become 2500
it('2. Missing totalCost does not become 2500', () => {
  const result = getBookingCost({});
  assert.strictEqual(result, 0, `Expected 0 for missing totalCost, got ${result}`);
  assert.notStrictEqual(result, 2500, 'Missing totalCost must NEVER default to 2500');
});

// 3. Missing totalCost does not become 800
it('3. Missing totalCost does not become 800', () => {
  const result = getBookingCost({ title: 'Tractor Service', status: 'completed' });
  assert.strictEqual(result, 0, `Expected 0 for missing totalCost, got ${result}`);
  assert.notStrictEqual(result, 800, 'Missing totalCost must NEVER default to 800');
});

// 4. totalCost = 0 remains 0
it('4. totalCost = 0 remains 0', () => {
  const result = getBookingCost({ totalCost: 0 });
  assert.strictEqual(result, 0, `Expected 0 for totalCost: 0, got ${result}`);
});

// 5. totalCost = "0" remains 0
it('5. totalCost = "0" remains 0', () => {
  const result = getBookingCost({ totalCost: '0' });
  assert.strictEqual(result, 0, `Expected 0 for totalCost: "0", got ${result}`);
});

// 6. Valid totalCost is preserved exactly
it('6. Valid totalCost is preserved exactly', () => {
  assert.strictEqual(getBookingCost({ totalCost: 1850 }), 1850);
  assert.strictEqual(getBookingCost({ totalCost: '3200' }), 3200);
  assert.strictEqual(getBookingCost({ totalCost: 450.5 }), 450.5);
});

// 7. total_cost is handled if it is part of the existing schema
it('7. total_cost is handled if it is part of the existing schema', () => {
  assert.strictEqual(getBookingCost({ total_cost: 2400 }), 2400);
  assert.strictEqual(getBookingCost({ total_cost: '1600' }), 1600);
  assert.strictEqual(getBookingCost({ total_cost: 0 }), 0);
});

// 8. Unknown financial value resolves honestly to 0
it('8. Unknown financial value resolves honestly to 0', () => {
  assert.strictEqual(getBookingCost(null), 0);
  assert.strictEqual(getBookingCost(undefined), 0);
  assert.strictEqual(getBookingCost({ totalCost: null }), 0);
  assert.strictEqual(getBookingCost({ totalCost: undefined }), 0);
  assert.strictEqual(getBookingCost({ totalCost: 'N/A' }), 0);
  assert.strictEqual(getBookingCost({ totalCost: NaN }), 0);
});

// 9. Multiple completed bookings sum consistently
it('9. Multiple completed bookings sum consistently', () => {
  const mockBookings = [
    { id: 'b1', status: 'completed', totalCost: 1200 },
    { id: 'b2', status: 'completed', totalCost: 0 },
    { id: 'b3', status: 'completed' }, // Missing cost -> 0
    { id: 'b4', status: 'completed', totalCost: '1800' },
    { id: 'b5', status: 'completed', ratePerAcre: 500, acres: 3 } // Derived -> 1500
  ];

  const totalEarnings = mockBookings.reduce((sum, b) => sum + getBookingCost(b), 0);
  const rowCosts = mockBookings.map(b => getBookingCost(b));
  const sumOfRows = rowCosts.reduce((a, b) => a + b, 0);

  assert.strictEqual(totalEarnings, 4500, `Expected totalEarnings 4500, got ${totalEarnings}`);
  assert.strictEqual(totalEarnings, sumOfRows, 'totalEarnings must be mathematically identical to sum of row costs');
  assert.deepStrictEqual(rowCosts, [1200, 0, 0, 1800, 1500]);
});

// 10. Orders display uses the same canonical helper
it('10. Orders display uses the same canonical helper', () => {
  assert(
    providerCode.includes('const totalCost = getBookingCost(booking);'),
    'Booking order cards must compute totalCost using getBookingCost(booking)'
  );
});

// 11. No L-2 financial path still contains || 2500
it('11. No L-2 financial path still contains || 2500', () => {
  assert(
    !providerCode.includes('|| 2500'),
    'ProviderDashboardPage.jsx must not contain || 2500 in financial calculations'
  );
});

// 12. No L-2 financial path still contains || 800
it('12. No L-2 financial path still contains || 800', () => {
  assert(
    !providerCode.includes('b.totalCost || 800'),
    'Ledger must not contain b.totalCost || 800'
  );
  assert(
    !providerCode.includes("booking.totalCost || '800'"),
    'Orders must not contain booking.totalCost || \'800\''
  );
  assert(
    !providerCode.includes('booking.totalCost || 800'),
    'Orders must not contain booking.totalCost || 800'
  );
});

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('═══════════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
