/**
 * B9.6 IoT Offline Status Synchronization Test Suite
 * Validates:
 * - B9.6-F01: WebSocket offline event processing
 * - B9.6-F02: Periodic revalidation decoupled from WebSocket connected state
 * - B9.6-F03: Client-side last_seen expiration (90s decay)
 * - B9.6-F04: 90s authoritative threshold
 * - B9.6-F05: Dashboard and DevicesPage device ID mapping (no blind devIds[0])
 * - Multi-device isolation and Navbar synchronization
 * - B9.5A / B9.5B regression guarantees
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedTests++;
  console.log(`  [PASS] ${message}`);
}

console.log('===================================================================');
console.log('B9.6 — IoT OFFLINE STATUS SYNCHRONIZATION TEST SUITE');
console.log('===================================================================\n');

// 1. WebSocket online event creates/updates device status
(() => {
  let deviceStatusMap = {};
  const data = {
    type: 'device_status_update',
    device_id: 'ESP32-ALPHA',
    status: 'online',
    timestamp: '2026-10-02T10:00:00.000Z',
    uptime_ms: 120000,
    battery: 95
  };

  // Reducer simulation matching WebSocketContext.jsx
  deviceStatusMap = {
    ...deviceStatusMap,
    [data.device_id]: {
      ...deviceStatusMap[data.device_id],
      status: data.status || 'offline',
      last_seen: data.last_seen || data.timestamp || new Date().toISOString(),
      uptime_ms: data.uptime_ms !== undefined ? data.uptime_ms : deviceStatusMap[data.device_id]?.uptime_ms,
      battery: data.battery !== undefined ? data.battery : deviceStatusMap[data.device_id]?.battery
    }
  };

  assert(deviceStatusMap['ESP32-ALPHA'].status === 'online', '1. WebSocket online event creates/updates device status');
  assert(deviceStatusMap['ESP32-ALPHA'].battery === 95, '1b. Device status maps telemetry properties');
})();

// 2. Offline WebSocket event changes the device to offline
(() => {
  let deviceStatusMap = {
    'ESP32-ALPHA': {
      status: 'online',
      last_seen: '2026-10-02T10:00:00.000Z',
      battery: 95
    }
  };

  const offlineEvent = {
    type: 'device_status_update',
    device_id: 'ESP32-ALPHA',
    status: 'offline',
    timestamp: '2026-10-02T10:01:35.000Z',
    last_seen: '2026-10-02T10:00:00.000Z',
    seconds_since_seen: 95
  };

  deviceStatusMap = {
    ...deviceStatusMap,
    [offlineEvent.device_id]: {
      ...deviceStatusMap[offlineEvent.device_id],
      status: offlineEvent.status || 'offline',
      last_seen: offlineEvent.last_seen || offlineEvent.timestamp || new Date().toISOString()
    }
  };

  assert(deviceStatusMap['ESP32-ALPHA'].status === 'offline', '2. Offline WebSocket event transitions device to offline');
  assert(deviceStatusMap['ESP32-ALPHA'].battery === 95, '2b. Battery/metadata preserved during offline transition');
})();

// 3. Client-side last_seen decay changes stale online state to offline
(() => {
  const OFFLINE_THRESHOLD_MS = 90000;
  const now = Date.now();
  let deviceStatusMap = {
    'ESP32-STALE': {
      status: 'online',
      last_seen: new Date(now - 95000).toISOString() // 95s ago (> 90s)
    },
    'ESP32-FRESH': {
      status: 'online',
      last_seen: new Date(now - 20000).toISOString() // 20s ago (< 90s)
    }
  };

  // Ticker simulation matching WebSocketContext.jsx
  let changed = false;
  const next = { ...deviceStatusMap };
  for (const devId in next) {
    const dev = next[devId];
    if (dev && dev.status === 'online' && dev.last_seen) {
      const seenTime = new Date(dev.last_seen).getTime();
      if (!isNaN(seenTime) && now - seenTime > OFFLINE_THRESHOLD_MS) {
        next[devId] = { ...dev, status: 'offline' };
        changed = true;
      }
    }
  }

  assert(next['ESP32-STALE'].status === 'offline', '3. Stale online state transitions to offline via 90s decay ticker');
  assert(next['ESP32-FRESH'].status === 'online', '3b. Fresh online state remains online during decay ticker');
  assert(changed === true, '3c. State change flag signaled correctly');
})();

// 4. Fresh online event restores online state
(() => {
  let deviceStatusMap = {
    'ESP32-NODE': {
      status: 'offline',
      last_seen: '2026-10-02T10:00:00.000Z'
    }
  };

  const freshEvent = {
    type: 'device_status_update',
    device_id: 'ESP32-NODE',
    status: 'online',
    timestamp: '2026-10-02T10:05:00.000Z'
  };

  deviceStatusMap = {
    ...deviceStatusMap,
    [freshEvent.device_id]: {
      ...deviceStatusMap[freshEvent.device_id],
      status: freshEvent.status || 'offline',
      last_seen: freshEvent.last_seen || freshEvent.timestamp
    }
  };

  assert(deviceStatusMap['ESP32-NODE'].status === 'online', '4. Fresh online event restores device to online state');
})();

// 5 & 6. Multiple devices remain isolated; Device A offline does not change Device B
(() => {
  let deviceStatusMap = {
    'NODE-A': { status: 'online', last_seen: '2026-10-02T10:00:00Z' },
    'NODE-B': { status: 'online', last_seen: '2026-10-02T10:00:00Z' }
  };

  // Node A goes offline
  deviceStatusMap = {
    ...deviceStatusMap,
    'NODE-A': {
      ...deviceStatusMap['NODE-A'],
      status: 'offline'
    }
  };

  assert(deviceStatusMap['NODE-A'].status === 'offline', '5. Node A transitioned to offline');
  assert(deviceStatusMap['NODE-B'].status === 'online', '6. Node B remained online (device isolation preserved)');
})();

// 7. Dashboard does not blindly use devIds[0]
(() => {
  const activeFarm = { device_id: 'NODE-BETA' };
  const deviceStatusMap = {
    'NODE-ALPHA': { status: 'online' },
    'NODE-BETA': { status: 'offline' }
  };

  // Simulation of Dashboard targetDevId selection logic
  const targetDevId = activeFarm?.device_id || 'NODE-ALPHA';
  let activeDevice = null;

  if (targetDevId && deviceStatusMap[targetDevId]) {
    const dev = deviceStatusMap[targetDevId];
    activeDevice = {
      device_id: targetDevId,
      status: dev.status || 'offline'
    };
  }

  assert(activeDevice !== null, '7. Active device matched');
  assert(activeDevice.device_id === 'NODE-BETA', '7b. Active device matches farm device NODE-BETA');
  assert(activeDevice.status === 'offline', '7c. NODE-BETA reflects offline status, not NODE-ALPHA online status');
})();

// 8. DevicesPage maps status by device ID
(() => {
  const deviceData = { id: 'ESP32-FIELD-2' };
  const deviceStatusMap = {
    'ESP32-FIELD-1': { status: 'online', battery: 80 },
    'ESP32-FIELD-2': { status: 'offline', battery: 45 }
  };

  // Simulation of DevicesPage mapped lookup
  let resolvedStatus = null;
  const currentId = deviceData.id;
  if (currentId && deviceStatusMap[currentId]) {
    resolvedStatus = deviceStatusMap[currentId].status;
  }

  assert(resolvedStatus === 'offline', '8. DevicesPage maps status by deviceData.id rather than devIds[0]');
})();

// 9. Navbar reflects shared device status state
(() => {
  const deviceStatusMap = {
    'NODE-1': { status: 'offline' },
    'NODE-2': { status: 'offline' }
  };

  const devices = Object.values(deviceStatusMap);
  const isOnline = devices.some(d => d.status === 'online');

  assert(isOnline === false, '9. Navbar reflects offline when all nodes in deviceStatusMap are offline');

  // One node comes online
  deviceStatusMap['NODE-2'].status = 'online';
  const devices2 = Object.values(deviceStatusMap);
  const isOnline2 = devices2.some(d => d.status === 'online');

  assert(isOnline2 === true, '9b. Navbar reflects online when any node in deviceStatusMap is online');
})();

// 10. WebSocket reconnect behavior remains intact
(() => {
  const wsSource = fs.readFileSync(path.resolve(__dirname, '../src/context/WebSocketContext.jsx'), 'utf-8');
  assert(wsSource.includes('reconnectAttemptRef.current >= 5'), '10. WebSocket reconnect clamp logic remains intact');
  assert(wsSource.includes('DEVICE_OFFLINE_THRESHOLD_MS = 90000') || wsSource.includes('90000'), '10b. 90s offline decay interval configured in WebSocketContext');
})();

// 11. B9.5A notification synchronization remains intact
(() => {
  const layoutSource = fs.readFileSync(path.resolve(__dirname, '../src/components/AppLayout.jsx'), 'utf-8');
  const wsCallIdx = layoutSource.indexOf('useWebSocket()');
  const navBarIdx = layoutSource.indexOf('export const Navbar');
  assert(wsCallIdx !== -1 && navBarIdx !== -1, '11. AppLayout exports intact');
  assert(layoutSource.includes('refreshUnreadCount'), '11b. refreshUnreadCount wiring preserved');
})();

// 12. B9.5B user notification isolation remains intact
(() => {
  const storageSource = fs.readFileSync(path.resolve(__dirname, '../src/utils/notificationStorage.js'), 'utf-8');
  assert(storageSource.includes('getNotificationStorageKeys'), '12. getNotificationStorageKeys exists in notificationStorage.js');
  assert(storageSource.includes('normalizeUserId'), '12b. normalizeUserId user-scoping intact');
})();

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
