import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeUserId,
  getNotificationStorageKeys,
  getUserNotificationCache,
  setUserNotificationCache,
  getUserReadNotificationIds,
  setUserReadNotificationIds,
  getUserDeletedNotificationIds,
  saveUserDeletedNotificationId,
  clearUserNotificationsStorage
} from '../src/utils/notificationStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('B9.5B — NOTIFICATION SYNCHRONIZATION PHASE 2 REGRESSION SUITE');
console.log('===================================================================\n');

let totalTests = 0;
let passedTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

// Mock localStorage for test environment
const mockStorage = new Map();
global.localStorage = {
  getItem: (key) => (mockStorage.has(key) ? mockStorage.get(key) : null),
  setItem: (key, val) => mockStorage.set(key, String(val)),
  removeItem: (key) => mockStorage.delete(key),
  clear: () => mockStorage.clear()
};

// -----------------------------------------------------------------------------
// F06: WebSocket connect() Synchronous Throw & Reconnect Clamp
// -----------------------------------------------------------------------------
it('F06-1: WebSocketContext contains clamp check in synchronous catch(err) block', () => {
  const wsContextPath = path.resolve(__dirname, '../src/context/WebSocketContext.jsx');
  const content = fs.readFileSync(wsContextPath, 'utf8');
  assert(content.includes('reconnectAttemptRef.current >= 5'), 'Clamp check missing in WebSocketContext');
  const catchPos = content.lastIndexOf('} catch (err) {');
  assert(catchPos !== -1, 'catch(err) block missing');
  const catchBlock = content.slice(catchPos, catchPos + 400);
  assert(catchBlock.includes('reconnectAttemptRef.current >= 5'), 'reconnectAttemptRef check missing inside catch(err)');
  assert(catchBlock.includes("setConnectionStatus('offline')"), 'offline fallback missing inside catch(err)');
});

it('F06-2: Simulation: synchronous WebSocket failure clamps at 5 attempts and enters offline state', () => {
  let connectionStatus = 'connecting';
  let reconnectAttempts = 0;
  let scheduledTimeouts = 0;

  function simulateConnect(shouldThrow = true) {
    try {
      if (shouldThrow) {
        throw new Error('SecurityError: WebSocket connection failed synchronously');
      }
      connectionStatus = 'connected';
    } catch (err) {
      connectionStatus = 'error';
      if (reconnectAttempts >= 5) {
        connectionStatus = 'offline';
        return;
      }
      reconnectAttempts++;
      scheduledTimeouts++;
      simulateConnect(shouldThrow);
    }
  }

  simulateConnect(true);
  assert.strictEqual(reconnectAttempts, 5, 'Attempts did not clamp at 5');
  assert.strictEqual(scheduledTimeouts, 5, 'Scheduled timeouts exceeded 5');
  assert.strictEqual(connectionStatus, 'offline', 'Status did not reach offline state');
});

// -----------------------------------------------------------------------------
// F05: Dead newBookingNotification Event Removal
// -----------------------------------------------------------------------------
it('F05-1: newBookingNotification has ZERO active references across codebase', () => {
  const srcDir = path.resolve(__dirname, '../src');
  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const full = path.join(dir, f);
      if (fs.statSync(full).isDirectory()) {
        scanDir(full);
      } else if (f.endsWith('.js') || f.endsWith('.jsx')) {
        const text = fs.readFileSync(full, 'utf8');
        assert(!text.includes('newBookingNotification'), `Dead event found in ${full}`);
      }
    }
  }
  scanDir(srcDir);
});

it('F05-2: Active events agrishield_new_notification and BroadcastChannel remain intact', () => {
  const appLayoutPath = path.resolve(__dirname, '../src/components/AppLayout.jsx');
  const appLayout = fs.readFileSync(appLayoutPath, 'utf8');
  assert(appLayout.includes('agrishield_new_notification'), 'agrishield_new_notification missing in AppLayout');
  assert(appLayout.includes('agrishield_notifications_channel'), 'BroadcastChannel missing in AppLayout');

  const notifPagePath = path.resolve(__dirname, '../src/pages/common/NotificationsPage.jsx');
  const notifPage = fs.readFileSync(notifPagePath, 'utf8');
  assert(notifPage.includes('agrishield_new_notification'), 'agrishield_new_notification missing in NotificationsPage');
});

// -----------------------------------------------------------------------------
// F03: NotificationsPage Active Polling Optimization
// -----------------------------------------------------------------------------
it('F03-1: NotificationsPage gates 30s polling on connectionStatus !== connected', () => {
  const notifPagePath = path.resolve(__dirname, '../src/pages/common/NotificationsPage.jsx');
  const notifPage = fs.readFileSync(notifPagePath, 'utf8');
  assert(notifPage.includes("connectionStatusRef.current !== 'connected'"), 'connectionStatus check missing in poll interval');
  assert(notifPage.includes('30000'), '30000ms fallback interval missing');
  assert(notifPage.includes('clearInterval(pollInterval)'), 'pollInterval cleanup missing');
});

it('F03-2: Simulation: polling skips REST fetch when WebSocket is connected', () => {
  let fetchCount = 0;
  function simulatePoll(visibility, wsStatus) {
    if (visibility === 'visible' && wsStatus !== 'connected') {
      fetchCount++;
    }
  }

  simulatePoll('visible', 'connected');
  assert.strictEqual(fetchCount, 0, 'Fetch occurred while WebSocket was connected');

  simulatePoll('visible', 'offline');
  assert.strictEqual(fetchCount, 1, 'Fetch did not occur while WebSocket was offline');

  simulatePoll('hidden', 'offline');
  assert.strictEqual(fetchCount, 1, 'Fetch occurred while tab was hidden');
});

// -----------------------------------------------------------------------------
// F04: Cross-Tab Logout Synchronization
// -----------------------------------------------------------------------------
it('F04-1: AuthContext registers window storage event listener for token changes', () => {
  const authContextPath = path.resolve(__dirname, '../src/context/AuthContext.jsx');
  const authContext = fs.readFileSync(authContextPath, 'utf8');
  assert(authContext.includes("window.addEventListener('storage', handleStorageEvent)"), 'storage listener missing in AuthContext');
  assert(authContext.includes("window.removeEventListener('storage', handleStorageEvent)"), 'storage cleanup missing in AuthContext');
  assert(authContext.includes("event.key === 'token'"), 'token key check missing in storage listener');
});

it('F04-2: Simulation: cross-tab token removal clears user and token state', () => {
  let state = { token: 'jwt-12345', user: { id: 'farmer-1' } };

  function handleStorageEvent(e) {
    if (e.key === 'token') {
      if (!e.newValue) {
        state.token = null;
        state.user = null;
      } else if (e.newValue !== state.token) {
        state.token = e.newValue;
      }
    }
  }

  handleStorageEvent({ key: 'theme', newValue: 'dark' });
  assert.strictEqual(state.token, 'jwt-12345');

  handleStorageEvent({ key: 'token', newValue: null });
  assert.strictEqual(state.token, null);
  assert.strictEqual(state.user, null);
});

// -----------------------------------------------------------------------------
// F07: User-Namespaced Notification Storage
// -----------------------------------------------------------------------------
it('F07-1: normalizeUserId handles strings, objects with id, _id, or user_id', () => {
  assert.strictEqual(normalizeUserId('user-abc'), 'user-abc');
  assert.strictEqual(normalizeUserId({ id: 'user-1' }), 'user-1');
  assert.strictEqual(normalizeUserId({ _id: 'user-2' }), 'user-2');
  assert.strictEqual(normalizeUserId({ user_id: 'user-3' }), 'user-3');
});

it('F07-2: getNotificationStorageKeys produces isolated keys per user ID', () => {
  const keys1 = getNotificationStorageKeys('user-A');
  const keys2 = getNotificationStorageKeys('user-B');
  assert.strictEqual(keys1.cacheKey, 'agrishield_user_notifications_user-A');
  assert.strictEqual(keys2.cacheKey, 'agrishield_user_notifications_user-B');
  assert.notStrictEqual(keys1.cacheKey, keys2.cacheKey);
  assert.strictEqual(keys1.readIdsKey, 'agrishield_read_notification_ids_user-A');
  assert.strictEqual(keys1.deletedIdsKey, 'agrishield_deleted_notification_ids_user-A');
});

it('F07-3: Notification cache is strictly isolated between User A and User B', () => {
  mockStorage.clear();
  const userA = { id: 'farmer_alice' };
  const userB = { id: 'provider_bob' };

  setUserNotificationCache(userA, [{ id: 'notif_alice_1', title: 'Crop Scan Ready' }]);
  setUserNotificationCache(userB, [{ id: 'notif_bob_1', title: 'New Tractor Order' }]);

  const aliceNotifs = getUserNotificationCache(userA);
  const bobNotifs = getUserNotificationCache(userB);

  assert.strictEqual(aliceNotifs.length, 1);
  assert.strictEqual(aliceNotifs[0].id, 'notif_alice_1');
  assert.strictEqual(bobNotifs.length, 1);
  assert.strictEqual(bobNotifs[0].id, 'notif_bob_1');
  assert(!aliceNotifs.some(n => n.id === 'notif_bob_1'), 'Alice can see Bob notifications');
  assert(!bobNotifs.some(n => n.id === 'notif_alice_1'), 'Bob can see Alice notifications');
});

it('F07-4: Read IDs and Deleted IDs are isolated between users', () => {
  mockStorage.clear();
  const userA = { id: 'user_A' };
  const userB = { id: 'user_B' };

  setUserReadNotificationIds(userA, ['notif_100']);
  saveUserDeletedNotificationId(userA, 'notif_200');

  const readA = getUserReadNotificationIds(userA);
  const readB = getUserReadNotificationIds(userB);
  assert(readA.has('notif_100'), 'User A missing read ID');
  assert(!readB.has('notif_100'), 'User B contaminated with User A read ID');

  const delA = getUserDeletedNotificationIds(userA);
  const delB = getUserDeletedNotificationIds(userB);
  assert(delA.has('notif_200'), 'User A missing deleted ID');
  assert(!delB.has('notif_200'), 'User B contaminated with User A deleted ID');
});

it('F07-5: clearUserNotificationsStorage purges user cache and legacy unscoped keys', () => {
  mockStorage.clear();
  const user = { id: 'user_logout_test' };
  setUserNotificationCache(user, [{ id: 'item_1' }]);
  mockStorage.set('agrishield_user_notifications', '[{"id":"legacy"}]');
  mockStorage.set('agrishield_read_notification_ids', '["legacy"]');

  clearUserNotificationsStorage(user);
  assert.strictEqual(getUserNotificationCache(user).length, 0);
  assert.strictEqual(localStorage.getItem('agrishield_user_notifications'), null);
  assert.strictEqual(localStorage.getItem('agrishield_read_notification_ids'), null);
});

// -----------------------------------------------------------------------------
// B9.5A Regression Protection
// -----------------------------------------------------------------------------
it('B9.5A Guard: AppLayout preserves useWebSocket initialization order (TDZ safe)', () => {
  const appLayoutPath = path.resolve(__dirname, '../src/components/AppLayout.jsx');
  const code = fs.readFileSync(appLayoutPath, 'utf8');
  const wsIdx = code.indexOf('const { connectionStatus, lastMessageTime, lastTelemetry, deviceStatusMap, unreadCount, setUnreadCount, refreshUnreadCount, latestAlert } = useWebSocket();');
  const fetchIdx = code.indexOf('const fetchUnreadCount = useCallback');
  assert(wsIdx !== -1, 'useWebSocket missing');
  assert(fetchIdx !== -1, 'fetchUnreadCount missing');
  assert(wsIdx < fetchIdx, 'TDZ ordering violation');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
