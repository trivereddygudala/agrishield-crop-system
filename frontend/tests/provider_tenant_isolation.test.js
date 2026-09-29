/**
 * AgriShield B5 M-1 Provider Tenant Isolation & Fleet Fallback Privacy Test Suite
 * Validates storage separation, zero starter fleet leakage, and /fleet endpoint usage.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B5 M-1 PROVIDER TENANT ISOLATION & PRIVACY VALIDATION SUITE');
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
const farmerBookingPath = path.resolve(__dirname, '../src/pages/farmer/EquipmentBookingPage.jsx');

const providerCode = fs.readFileSync(providerDashboardPath, 'utf8');
const farmerCode = fs.readFileSync(farmerBookingPath, 'utf8');

// 1. Starter Fleet Leakage Check
it('ProviderDashboardPage does not import or use CANONICAL_STARTER_FLEET as private fallback', () => {
  assert(!providerCode.includes('CANONICAL_STARTER_FLEET'), 'ProviderDashboardPage must not reference CANONICAL_STARTER_FLEET');
});

// 2. Storage Key Helper
it('ProviderDashboardPage exports getProviderFleetStorageKey helper isolating by provider ID', () => {
  assert(providerCode.includes('getProviderFleetStorageKey'), 'Missing getProviderFleetStorageKey helper');
  assert(providerCode.includes('agrishield_provider_fleet_inventory_${userId}'), 'Storage key must be isolated by userId');
});

// 3. Authenticated Fleet Endpoint Check
it('ProviderDashboardPage fetches fleet using /api/v1/equipment/fleet instead of public /catalog', () => {
  assert(providerCode.includes("API.get('/api/v1/equipment/fleet')"), 'Provider fleet fetch must call /api/v1/equipment/fleet');
  assert(!providerCode.includes("endpoint += `?provider_id="), 'Provider fleet fetch must not use public catalog query params');
  assert(!providerCode.includes("endpoint += `?provider_phone="), 'Provider fleet fetch must not use public catalog phone params');
});

// 4. Farmer Marketplace Separation
it('EquipmentBookingPage does not write global catalog into agrishield_provider_fleet_inventory', () => {
  const writeMatches = farmerCode.match(/localStorage\.setItem\(['"]agrishield_provider_fleet_inventory['"]/g);
  assert(!writeMatches, 'EquipmentBookingPage must not write to agrishield_provider_fleet_inventory');
});

it('EquipmentBookingPage writes global marketplace catalog to agrishield_farmer_catalog_cache', () => {
  assert(farmerCode.includes('agrishield_farmer_catalog_cache'), 'EquipmentBookingPage must use agrishield_farmer_catalog_cache');
});

// 5. Empty Default
it('ProviderDashboardPage initializes empty fleet to [] rather than demo objects', () => {
  assert(providerCode.includes('loadScopedFleet'), 'ProviderDashboardPage must use loadScopedFleet');
  assert(providerCode.includes('return [];'), 'ProviderDashboardPage default return must be []');
});

console.log('\n═══════════════════════════════════════════════════════════════════');
console.log(`TEST RUN COMPLETE: ${passedTests}/${totalTests} PASSED`);
console.log('═══════════════════════════════════════════════════════════════════\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
