/**
 * AgriShield B6 Phase 4 — Admin Broadcast History & Cache Cleanup Test Suite (B6-P2-02)
 * Validates removal of obsolete localStorage fallback, introduction of explicit error/retry UX,
 * eradication of fake notification synthesis, and logout cleanup.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B6 PHASE 4 — ADMIN BROADCAST HISTORY / CACHE CLEANUP (B6-P2-02)');
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
const notificationsPagePath = path.resolve(__dirname, '../src/pages/common/NotificationsPage.jsx');
const authContextPath = path.resolve(__dirname, '../src/context/AuthContext.jsx');

const adminCode = fs.readFileSync(adminPagePath, 'utf8');
const notifCode = fs.readFileSync(notificationsPagePath, 'utf8');
const authCode = fs.readFileSync(authContextPath, 'utf8');

// 1. AdminPage does not read agrishield_broadcast_history
it('AdminPage.jsx contains zero reads of agrishield_broadcast_history', () => {
  assert(!adminCode.includes("localStorage.getItem('agrishield_broadcast_history')"), 'AdminPage must not read agrishield_broadcast_history from localStorage');
});

// 2. AdminPage does not fall back to browser localStorage on history API failure
it('AdminPage.jsx does not write or read localStorage in fetchBroadcastHistory catch block', () => {
  const fetchFnMatch = adminCode.match(/const fetchBroadcastHistory = async \(\) => {([\s\S]*?)};/);
  assert(fetchFnMatch, 'fetchBroadcastHistory function must exist');
  const fnBody = fetchFnMatch[1];
  assert(!fnBody.includes('localStorage'), 'fetchBroadcastHistory must not interact with localStorage');
});

// 3. broadcastHistoryError state exists
it('AdminPage.jsx declares and uses broadcastHistoryError state', () => {
  assert(adminCode.includes('const [broadcastHistoryError, setBroadcastHistoryError] = useState(null);'), 'Missing broadcastHistoryError state');
  assert(adminCode.includes('setBroadcastHistoryError(errMsg);'), 'Missing setBroadcastHistoryError on failure');
  assert(adminCode.includes('setBroadcastHistoryError(null);'), 'Missing setBroadcastHistoryError(null) on success/reset');
});

// 4. Retry control exists and calls canonical fetchBroadcastHistory
it('AdminPage.jsx renders Retry Sync button calling fetchBroadcastHistory', () => {
  assert(adminCode.includes('onClick={fetchBroadcastHistory}'), 'Retry button must invoke fetchBroadcastHistory');
  assert(adminCode.includes('Retry Sync'), 'Retry button label must be present');
});

// 5. Existing in-memory broadcast history preserved on failure
it('fetchBroadcastHistory preserves existing in-memory history when API fails', () => {
  const fetchFnMatch = adminCode.match(/const fetchBroadcastHistory = async \(\) => {([\s\S]*?)};/);
  const fnBody = fetchFnMatch[1];
  // Catch block should not clear setBroadcastHistory([]) or overwrite with fake seed
  const catchBlock = fnBody.split('catch (e) {')[1] || '';
  assert(!catchBlock.includes('setBroadcastHistory([])'), 'Catch block must not wipe existing in-memory data');
  assert(!catchBlock.includes('setBroadcastHistory(JSON.parse'), 'Catch block must not load mock data');
});

// 6. NotificationsPage no longer consumes agrishield_broadcast_history
it('NotificationsPage.jsx contains zero occurrences of agrishield_broadcast_history', () => {
  assert(!notifCode.includes('agrishield_broadcast_history'), 'NotificationsPage must not reference agrishield_broadcast_history');
});

// 7. AuthContext logout removes legacy key
it('AuthContext.jsx purges agrishield_broadcast_history upon logout', () => {
  assert(authCode.includes("localStorage.removeItem('agrishield_broadcast_history');"), 'AuthContext must clean up agrishield_broadcast_history on logout');
});

// 8. No user-scoped legacy key created
it('Zero files introduce user-scoped agrishield_broadcast_history_<userId>', () => {
  assert(!adminCode.includes('agrishield_broadcast_history_'), 'Must not introduce user-scoped broadcast history key in AdminPage');
  assert(!notifCode.includes('agrishield_broadcast_history_'), 'Must not introduce user-scoped broadcast history key in NotificationsPage');
});

// 9. Server history endpoint preserved
it('AdminPage.jsx targets authoritative MongoDB endpoints (/api/admin/broadcast/history or /api/v1/admin/broadcast/history)', () => {
  assert(adminCode.includes('/api/admin/broadcast/history') || adminCode.includes('/api/v1/admin/broadcast/history'), 'Must query backend broadcast history API');
});

// 10. Distinct loading state and empty state
it('AdminPage.jsx distinguishes loading state, error banner, and empty history state', () => {
  assert(adminCode.includes('broadcastHistoryLoading && broadcastHistory.length === 0'), 'Must render loading view when empty and loading');
  assert(adminCode.includes('No Broadcasts Dispatched Yet'), 'Must render genuine empty state when 0 broadcasts exist');
  assert(adminCode.includes('broadcastHistoryError && ('), 'Must render error banner');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
