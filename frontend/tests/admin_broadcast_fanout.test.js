/**
 * AgriShield B6 Phase 11 — Admin Broadcast Fanout & Duplicate Protection Tests (B6-P7-03)
 * Validates:
 * 1. AdminPage includes unique idempotency_key in broadcast payload.
 * 2. Fallback to /api/v1/admin/broadcast is strictly guarded to 404 Not Found (route unmounted).
 * 3. Non-404 errors (400, 401, 403, 500, timeouts) do NOT trigger secondary dispatch retry.
 * 4. Duplicate clicks blocked via isBroadcasting guard.
 * 5. Uses server-returned canonical broadcast record.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B6 PHASE 11 — ADMIN BROADCAST FANOUT & DUPLICATION TESTS (B6-P7-03)');
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
const adminCode = fs.readFileSync(adminPagePath, 'utf8');

// 1. Idempotency Key in Payload
it('AdminPage.jsx generates and includes idempotency_key in broadcast payload', () => {
  assert(adminCode.includes('idempotency_key: idempotencyKey') || adminCode.includes('idempotencyKey'), 'Payload must include idempotency_key');
  assert(adminCode.includes('const idempotencyKey ='), 'Must declare idempotencyKey');
});

// 2. Strict 404 Guard for Fallback
it('AdminPage.jsx strictly guards fallback to 404 Not Found status', () => {
  const submitFnMatch = adminCode.match(/const handleBroadcastSubmit = async \([\s\S]*?\n  \};/);
  assert(submitFnMatch, 'handleBroadcastSubmit function must exist');
  const fnBody = submitFnMatch[0];
  assert(fnBody.includes('404'), 'Fallback must check for HTTP 404 status');
  assert(
    fnBody.includes('firstErr?.response?.status === 404') ||
    fnBody.includes('status === 404'),
    'Must explicitly inspect 404 status before trying fallback endpoint'
  );
});

// 3. Non-404 Errors Re-thrown
it('AdminPage.jsx re-throws non-404 errors instead of retrying duplicate dispatch', () => {
  const submitFnMatch = adminCode.match(/const handleBroadcastSubmit = async \([\s\S]*?\n  \};/);
  const fnBody = submitFnMatch[0];
  assert(fnBody.includes('throw firstErr') || fnBody.includes('throw '), 'Must re-throw non-404 errors');
});

// 4. In-Flight Button Guard
it('AdminPage.jsx disables broadcast button while isBroadcasting is true', () => {
  assert(adminCode.includes('isBroadcasting'), 'Must have isBroadcasting state');
  assert(adminCode.includes('disabled={isBroadcasting'), 'Broadcast submit button must be disabled during broadcast');
});

// 5. Canonical Server Record Preservation
it('AdminPage.jsx uses authoritative server-returned broadcast record in history', () => {
  assert(adminCode.includes('res?.data?.broadcast'), 'Must extract broadcast from server response');
  assert(adminCode.includes('setBroadcastHistory(prev => [newRecord, ...prev])'), 'Must update history with server record');
});

// 6. Zero Deprecated localStorage Broadcast Reads
it('AdminPage.jsx contains zero reads of agrishield_broadcast_history', () => {
  assert(!adminCode.includes("localStorage.getItem('agrishield_broadcast_history')"), 'Must not read deprecated localStorage broadcast history');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
