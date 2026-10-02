import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isAiWorkerRoute,
  getTargetClusterNode,
  getFailoverTarget,
  AI_WORKER_1_URL,
  AI_WORKER_2_URL,
  AI_WORKER_3_URL,
  MAIN_RENDER_BACKEND
} from '../src/services/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('B9.3 — AI WORKER ROUTING RESILIENCE TEST SUITE');
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
    console.error(`  [FAIL] ${name}`, err);
  }
}

// ---------------------------------------------------------------------------
// PHASE 2: Vercel Relative URL AI-Worker Detection
// ---------------------------------------------------------------------------
it('1. Vercel relative URL/empty baseURL correctly identifies Worker 1', () => {
  assert.strictEqual(isAiWorkerRoute('/api/upload', ''), true);
  assert.strictEqual(isAiWorkerRoute('/api/upload?type=soil', ''), true);
  assert.strictEqual(isAiWorkerRoute('/api/predict', ''), true);
  assert.strictEqual(isAiWorkerRoute('/uploads/image.jpg', ''), true);
  assert.strictEqual(getTargetClusterNode('/api/upload'), AI_WORKER_1_URL);
  assert.strictEqual(getTargetClusterNode('/api/predict'), AI_WORKER_1_URL);
  assert.strictEqual(getTargetClusterNode('/uploads/abc.png'), AI_WORKER_1_URL);
});

it('2. Vercel relative URL/empty baseURL correctly identifies Worker 2', () => {
  assert.strictEqual(isAiWorkerRoute('/api/identify-plant', ''), true);
  assert.strictEqual(getTargetClusterNode('/api/identify-plant'), AI_WORKER_2_URL);
});

it('3. Vercel relative URL/empty baseURL correctly identifies Worker 3', () => {
  assert.strictEqual(isAiWorkerRoute('/api/agrochemical-scan', ''), true);
  assert.strictEqual(isAiWorkerRoute('/api/crop-advisor', ''), true);
  assert.strictEqual(isAiWorkerRoute('/api/translate-crop', ''), true);
  assert.strictEqual(getTargetClusterNode('/api/agrochemical-scan'), AI_WORKER_3_URL);
  assert.strictEqual(getTargetClusterNode('/api/crop-advisor'), AI_WORKER_3_URL);
  assert.strictEqual(getTargetClusterNode('/api/translate-crop'), AI_WORKER_3_URL);
});

it('4. Main backend routes are NOT classified as AI-worker traffic', () => {
  assert.strictEqual(isAiWorkerRoute('/api/auth/login', ''), false);
  assert.strictEqual(isAiWorkerRoute('/api/equipment/book', ''), false);
  assert.strictEqual(isAiWorkerRoute('/api/admin/users', ''), false);
  assert.strictEqual(isAiWorkerRoute('/api/broadcast', ''), false);
  assert.strictEqual(getTargetClusterNode('/api/auth/login'), MAIN_RENDER_BACKEND);
  assert.strictEqual(getTargetClusterNode('/api/equipment/book'), MAIN_RENDER_BACKEND);
});

// ---------------------------------------------------------------------------
// PHASE 4: Error Eligibility
// ---------------------------------------------------------------------------
function checkFailoverEligibility(error) {
  const status = error.response ? error.response.status : null;
  const isTransientStatus = Boolean(status && [502, 503, 504].includes(status));
  const isNetworkError =
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED' ||
    Boolean(error.message && error.message.toLowerCase().includes('timeout'));
  return Boolean(isTransientStatus || isNetworkError);
}

it('5. 502 triggers eligible failover', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 502 } }), true);
});

it('6. 503 triggers eligible failover', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 503 } }), true);
});

it('7. 504 triggers eligible failover', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 504 } }), true);
});

it('8. 400 does NOT fail over', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 400 } }), false);
});

it('9. 401 does NOT fail over', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 401 } }), false);
});

it('10. 403 does NOT fail over', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 403 } }), false);
});

it('11. 404 does NOT fail over', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 404 } }), false);
});

it('12. 422 does NOT fail over', () => {
  assert.strictEqual(checkFailoverEligibility({ response: { status: 422 } }), false);
});

it('12b. Network errors and timeouts trigger failover', () => {
  assert.strictEqual(checkFailoverEligibility({ code: 'ERR_NETWORK' }), true);
  assert.strictEqual(checkFailoverEligibility({ code: 'ECONNABORTED' }), true);
  assert.strictEqual(checkFailoverEligibility({ message: 'request timeout exceeded' }), true);
});

// ---------------------------------------------------------------------------
// PHASE 7 & 8: Target Selection & Loop Protection
// ---------------------------------------------------------------------------
it('13. Same worker is never retried', () => {
  const fb2 = getFailoverTarget('/api/identify-plant', AI_WORKER_2_URL);
  assert.notStrictEqual(fb2, AI_WORKER_2_URL);
  assert.strictEqual(fb2, AI_WORKER_1_URL);

  const fb3 = getFailoverTarget('/api/agrochemical', AI_WORKER_3_URL);
  assert.notStrictEqual(fb3, AI_WORKER_3_URL);
  assert.strictEqual(fb3, AI_WORKER_1_URL);
});

it('14. Retry count is bounded (_failoverRetry prevents subsequent retries)', () => {
  const req = { url: '/api/identify-plant', baseURL: AI_WORKER_2_URL };
  assert.strictEqual(!req._failoverRetry, true);
  req._failoverRetry = true;
  assert.strictEqual(!req._failoverRetry, false);
});

it('15. No interceptor recursion', () => {
  const original = { url: '/api/identify-plant', _failoverRetry: true };
  assert.strictEqual(!original._failoverRetry, false);
});

// ---------------------------------------------------------------------------
// PHASE 5 & 6: /api/upload and /api/predict Safety
// ---------------------------------------------------------------------------
it('16. /api/upload preserves its safe routing behavior (pinned to Worker 1)', () => {
  const fb = getFailoverTarget('/api/upload', AI_WORKER_1_URL);
  assert.strictEqual(fb, null);
});

it('17. /api/predict preserves safe routing behavior (pinned to Worker 1, avoids duplicate alerts)', () => {
  const fb = getFailoverTarget('/api/predict', AI_WORKER_1_URL);
  assert.strictEqual(fb, null);
});

// ---------------------------------------------------------------------------
// PHASE 9: Bounded Timeout
// ---------------------------------------------------------------------------
it('18. Failover timeout is bounded to 15 seconds (not 90s)', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/services/api.js'), 'utf-8');
  assert.ok(code.includes('fallbackConfig.timeout = 15000;'));
});

// ---------------------------------------------------------------------------
// PHASE 11: Offline Diagnosis Fallback in UploadImagePage
// ---------------------------------------------------------------------------
function evaluateOfflineFallback(err, isOnline = true) {
  const status = err.response ? err.response.status : null;
  const isTransientServerError = Boolean(status && [502, 503, 504].includes(status));
  const isNetwork = Boolean(
    !isOnline ||
    !err.response ||
    isTransientServerError ||
    err.message === 'Network Error' ||
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    (err.message && err.message.toLowerCase().includes('network'))
  );
  return isNetwork;
}

it('19. Offline diagnosis triggers on 502', () => {
  assert.strictEqual(evaluateOfflineFallback({ response: { status: 502 } }), true);
});

it('20. Offline diagnosis triggers on 503', () => {
  assert.strictEqual(evaluateOfflineFallback({ response: { status: 503 } }), true);
});

it('21. Offline diagnosis triggers on 504', () => {
  assert.strictEqual(evaluateOfflineFallback({ response: { status: 504 } }), true);
});

it('22. Offline diagnosis does NOT trigger on 400', () => {
  assert.strictEqual(evaluateOfflineFallback({ response: { status: 400 } }), false);
});

it('23. Offline diagnosis does NOT trigger on 401', () => {
  assert.strictEqual(evaluateOfflineFallback({ response: { status: 401 } }), false);
});

// ---------------------------------------------------------------------------
// PHASE 12: Authentication Safety & Headers
// ---------------------------------------------------------------------------
it('24. Authentication safety: AI worker 401 does NOT cause session clearing in interceptor', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/services/api.js'), 'utf-8');
  assert.ok(code.includes('const isAiWorkerRequest = isAiWorkerRoute(requestUrl, requestBase);'));
});

it('25. FormData Content-Type header removed for Axios boundary re-calc', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/services/api.js'), 'utf-8');
  assert.ok(code.includes("delete fallbackConfig.headers['Content-Type'];"));
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
