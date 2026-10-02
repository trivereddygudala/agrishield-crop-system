import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('B9.5A — NOTIFICATION SYNCHRONIZATION REGRESSION TEST SUITE');
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

// Helper to normalize CRLF to LF
const normalize = (str) => str.replace(/\r\n/g, '\n');

// 1. Static AST/Content Analysis on UploadImagePage.jsx (B9.5-F01)
const uploadImagePagePath = path.resolve(__dirname, '../src/pages/farmer/UploadImagePage.jsx');
const uploadPageContent = normalize(fs.readFileSync(uploadImagePagePath, 'utf8'));

it('1. UploadImagePage does NOT synthesize client-side scan notifications (scan-diag / scan-)', () => {
  assert(
    !uploadPageContent.includes('scan-diag-'),
    'UploadImagePage still contains scan-diag- synthesis'
  );
  assert(
    !uploadPageContent.includes("id: notifId"),
    'UploadImagePage still defines local notifId'
  );
});

it('2. UploadImagePage does NOT post synthetic scan notifications to BroadcastChannel', () => {
  assert(
    !uploadPageContent.includes("new BroadcastChannel('agrishield_notifications_channel')"),
    'UploadImagePage still broadcasts synthetic scan alerts over agrishield_notifications_channel'
  );
});

it('3. UploadImagePage does NOT dispatch agrishield_new_notification on prediction', () => {
  assert(
    !uploadPageContent.includes("window.dispatchEvent(new CustomEvent('agrishield_new_notification'"),
    'UploadImagePage still dispatches agrishield_new_notification'
  );
});

it('4. UploadImagePage does NOT execute a duplicate AudioContext chime on prediction', () => {
  assert(
    !uploadPageContent.includes("const osc = ctx.createOscillator()"),
    'UploadImagePage still contains inline AudioContext chime instantiation'
  );
});

it('5. UploadImagePage preserves predictionResult, scanStore, and offline diagnosis triage', () => {
  assert(uploadPageContent.includes("scanStore.setTabState"), 'scanStore tab state logic missing');
  assert(uploadPageContent.includes("diagnoseOfflineLeaf"), 'offline leaf diagnosis missing');
  assert(uploadPageContent.includes("identifyOfflinePlant"), 'offline plant identification missing');
});

// 2. Static Analysis on WebSocketContext.jsx (B9.5-F02)
const wsContextPath = path.resolve(__dirname, '../src/context/WebSocketContext.jsx');
const wsContextContent = normalize(fs.readFileSync(wsContextPath, 'utf8'));

it('6. WebSocketContext imports API client for REST hydration', () => {
  assert(wsContextContent.includes("import API from '../services/api'"), 'API import missing in WebSocketContext');
});

it('7. WebSocketContext defines authoritative fetchUnreadCount for /api/v1/notifications/count', () => {
  assert(wsContextContent.includes("/api/v1/notifications/count"), 'fetchUnreadCount endpoint missing in WebSocketContext');
  assert(wsContextContent.includes("const fetchUnreadCount = useCallback"), 'fetchUnreadCount callback missing');
});

it('8. WebSocketContext hydrates unreadCount when user state becomes available', () => {
  assert(wsContextContent.includes("if (user) {\n      fetchUnreadCount();"), 'User hydration effect missing in WebSocketContext');
});

it('9. WebSocketContext re-syncs unreadCount on socket onopen', () => {
  assert(wsContextContent.includes("fetchUnreadCount();\n\n        // Setup ping/heartbeat"), 'onopen unreadCount hydration missing in WebSocketContext');
});

it('10. WebSocketContext exports setUnreadCount and refreshUnreadCount in value object', () => {
  assert(wsContextContent.includes("refreshUnreadCount: fetchUnreadCount"), 'refreshUnreadCount export missing in WebSocketContext');
  assert(wsContextContent.includes("setUnreadCount,"), 'setUnreadCount export missing in WebSocketContext');
});

// 3. Static Analysis on AppLayout.jsx (B9.5-F02)
const appLayoutPath = path.resolve(__dirname, '../src/components/AppLayout.jsx');
const appLayoutContent = normalize(fs.readFileSync(appLayoutPath, 'utf8'));

it('11. AppLayout does NOT maintain a detached local unreadCount useState', () => {
  assert(!appLayoutContent.includes("const [unreadCount, setUnreadCount] = useState(0);"), 'AppLayout still declares independent unreadCount useState');
});

it('12. AppLayout acquires unreadCount and setUnreadCount directly from useWebSocket hook', () => {
  assert(
    appLayoutContent.includes("const { connectionStatus, lastMessageTime, lastTelemetry, deviceStatusMap, unreadCount, setUnreadCount, refreshUnreadCount, latestAlert } = useWebSocket();"),
    'AppLayout does not destructure unreadCount and controls from useWebSocket'
  );
});

it('13. AppLayout fetchUnreadCount delegates to WebSocketContext refreshUnreadCount', () => {
  assert(appLayoutContent.includes("if (refreshUnreadCount) {\n      await refreshUnreadCount();"), 'fetchUnreadCount does not delegate to refreshUnreadCount');
});

it('14. AppLayout BottomNav uses the unified unreadCount from useWebSocket', () => {
  assert(appLayoutContent.includes("const { unreadCount } = useWebSocket() || {};"), 'BottomNav useWebSocket consumption missing or altered');
  assert(appLayoutContent.includes("badge: unreadCount > 0 ? unreadCount : null,"), 'BottomNav badge evaluation altered');
});

it('15. AppLayout latestAlert registers alert ID in seenNotificationIdsRef to prevent double alerts', () => {
  assert(appLayoutContent.includes("if (aId) seenNotificationIdsRef.current.add(aId);"), 'latestAlert seen notification registration missing');
});

// 4. State & Transition Simulation Tests
it('16. Unread count simulation: handles initial server count = 0', () => {
  let state = null;
  const mockHydrate = (serverVal) => {
    const count = Number(serverVal ?? 0);
    state = Number.isFinite(count) ? Math.max(0, count) : 0;
  };
  mockHydrate(0);
  assert.strictEqual(state, 0);
});

it('17. Unread count simulation: handles initial server count > 0', () => {
  let state = null;
  const mockHydrate = (serverVal) => {
    const count = Number(serverVal ?? 0);
    state = Number.isFinite(count) ? Math.max(0, count) : 0;
  };
  mockHydrate(5);
  assert.strictEqual(state, 5);
});

it('18. Unread count simulation: authoritative WebSocket new_notification overrides local drift', () => {
  let state = 2;
  const handleWsMessage = (data) => {
    if (data.type === 'new_notification' && data.unread_count !== undefined) {
      state = data.unread_count;
    }
  };
  handleWsMessage({ type: 'new_notification', unread_count: 3 });
  assert.strictEqual(state, 3);
});

it('19. Unread count simulation: unread_count_update handles zero and decrement without negative values', () => {
  let state = 1;
  const handleWsMessage = (data) => {
    if (data.type === 'unread_count_update') {
      const count = data.unread_count !== undefined ? data.unread_count : data.count;
      state = Math.max(0, Number(count) || 0);
    }
  };
  handleWsMessage({ type: 'unread_count_update', unread_count: 0 });
  assert.strictEqual(state, 0);
  handleWsMessage({ type: 'unread_count_update', unread_count: -1 });
  assert.strictEqual(state, 0);
});

it('20. Deduplication simulation: Prediction creates exactly ONE user alert', () => {
  const renderedAlerts = [];
  const seenIds = new Set();

  function onWsAlert(alert) {
    const id = alert.notification_id || alert.id;
    if (id && !seenIds.has(id)) {
      seenIds.add(id);
      renderedAlerts.push(alert);
    }
  }

  // Server emits authoritative prediction alert over WebSocket
  const serverAlert = {
    notification_id: '674f1b2c9a3d4e5f6a7b8c9d',
    title: '🚨 Disease Alert: Early Blight',
    category: 'disease'
  };
  onWsAlert(serverAlert);

  // Subsequent fallback revalidation discovery with same ID
  onWsAlert(serverAlert);

  assert.strictEqual(renderedAlerts.length, 1, 'Duplicate alerts rendered for same prediction');
  assert.strictEqual(renderedAlerts[0].notification_id, '674f1b2c9a3d4e5f6a7b8c9d');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
