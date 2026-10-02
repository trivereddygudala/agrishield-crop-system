/**
 * B12 FRONTEND UI/UX, MOBILE, VISUAL & RUNTIME QUALITY REGRESSION TEST SUITE
 * 
 * Verifies:
 * 1. P0 Mobile drawer occlusion resolution (pathname + query search param trigger).
 * 2. P1 Farm tab state persistence architecture (/farm?tab=... validation & fallback).
 * 3. P1 AI scan state preservation across tab switches (Disease, Plant ID, Agrochemical).
 * 4. P1 Mobile navbar responsive layout & touch target compliance.
 * 5. P2 Farm mobile horizontal tab navigation strip structure.
 * 6. Accessibility label-to-input association compliance.
 * 7. NavbarSceneRenderer performance-aware execution controls.
 * 8. UI element hygiene (PyTorch v2.0 badge restricted to Admin/Tester).
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('===================================================================');
console.log('B12 — FRONTEND UI/UX, MOBILE & RUNTIME QUALITY TEST SUITE');
console.log('===================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${totalTests}. ${name}`);
    console.error(`         ${err.message}`);
    process.exitCode = 1;
  }
}

// Read relevant files
const appPath = path.resolve(__dirname, '../src/App.jsx');
const appLayoutPath = path.resolve(__dirname, '../src/components/AppLayout.jsx');
const farmPagePath = path.resolve(__dirname, '../src/pages/farmer/FarmPage.jsx');
const uploadPagePath = path.resolve(__dirname, '../src/pages/farmer/UploadImagePage.jsx');
const sceneRendererPath = path.resolve(__dirname, '../src/components/animations/NavbarSceneRenderer.jsx');
const calcPagePath = path.resolve(__dirname, '../src/pages/farmer/FieldAreaCalculatorPage.jsx');
const bookingPagePath = path.resolve(__dirname, '../src/pages/farmer/EquipmentBookingPage.jsx');

const appContent = fs.readFileSync(appPath, 'utf8');
const appLayoutContent = fs.readFileSync(appLayoutPath, 'utf8');
const farmPageContent = fs.readFileSync(farmPagePath, 'utf8');
const uploadPageContent = fs.readFileSync(uploadPagePath, 'utf8');
const sceneRendererContent = fs.readFileSync(sceneRendererPath, 'utf8');
const calcPageContent = fs.readFileSync(calcPagePath, 'utf8');
const bookingPageContent = fs.readFileSync(bookingPagePath, 'utf8');

// ──────────────────────────────────────────────────────────────────
// GROUP 1: P0 Mobile Drawer Occlusion
// ──────────────────────────────────────────────────────────────────
runTest('App.jsx watches both location.pathname and location.search to close mobile sidebar', () => {
  assert.ok(
    appContent.includes('[location.pathname, location.search]'),
    'App.jsx must watch both pathname and search parameters to close sidebar'
  );
});

runTest('Sidebar in AppLayout.jsx closes on pathname and search parameter changes', () => {
  assert.ok(
    appLayoutContent.includes('[location.pathname, location.search, setSidebarOpen]'),
    'Sidebar component must react to pathname and query param navigation'
  );
});

runTest('Sidebar closes on Escape key press when open on mobile', () => {
  assert.ok(
    appLayoutContent.includes("e.key === 'Escape' && sidebarOpen && window.innerWidth < 1024"),
    'Sidebar must listen for Escape key to close mobile drawer'
  );
});

// ──────────────────────────────────────────────────────────────────
// GROUP 2: P1 Farm Tab State Preservation & P2 Mobile Strip
// ──────────────────────────────────────────────────────────────────
runTest('FarmPage defines valid farm tabs array including all 9 modules', () => {
  const expectedTabs = [
    'modules', 'my-fields', 'field-setup', 'soil-npk', 'crop-lifecycle',
    'farm-khata', 'farm-intelligence', 'government-schemes', 'whatsapp-diagnosis'
  ];
  expectedTabs.forEach(tab => {
    assert.ok(
      farmPageContent.includes(`'${tab}'`),
      `FarmPage must define and support tab '${tab}'`
    );
  });
});

runTest('FarmPage validates URL search parameter and falls back safely to modules', () => {
  assert.ok(
    farmPageContent.includes("VALID_FARM_TABS.includes(currentTab) ? currentTab : 'modules'") ||
    farmPageContent.includes("VALID_FARM_TABS.includes(urlTab) ? urlTab : 'modules'"),
    'FarmPage must safely fall back to modules for unknown tab queries'
  );
});

runTest('FarmPage updates URL search parameters via setSearchParams without infinite loops', () => {
  assert.ok(
    farmPageContent.includes("next.set('tab', resolved)") ||
    farmPageContent.includes('setSearchParams({ tab: resolved }') ||
    farmPageContent.includes('setSearchParams({ tab }'),
    'FarmPage must push tab to URL search params'
  );
});

runTest('FarmPage includes horizontal scrollable tab strip with smooth scroll refs', () => {
  assert.ok(
    farmPageContent.includes('tabRefs.current[activeTab].scrollIntoView'),
    'FarmPage tab strip must auto-scroll active tab into view'
  );
  assert.ok(
    farmPageContent.includes('overflow-x-auto') && farmPageContent.includes('pointer-events-none'),
    'FarmPage must provide horizontal scroll with visual cues'
  );
});

// ──────────────────────────────────────────────────────────────────
// GROUP 3: P1 AI Scan State Preservation
// ──────────────────────────────────────────────────────────────────
runTest('UploadImagePage scanStore setTabState sanitizes targetKey against valid tabs', () => {
  assert.ok(
    uploadPageContent.includes("validTabs = ['disease-diag', 'plant-id', 'agro-scan']") &&
    uploadPageContent.includes('targetKey'),
    'scanStore.setTabState must sanitize tabId to prevent state pollution'
  );
});

runTest('UploadImagePage uses currentTab instead of activeTab for state mutations', () => {
  // Ensure that handleStartScan, handleFileSelect, etc. use currentTab
  assert.ok(
    uploadPageContent.includes('scanStore.setTabState(currentTab,'),
    'UploadImagePage must use isolated currentTab for tab state updates'
  );
});

runTest('UploadImagePage provides dedicated 3-module direct switcher in sub-page view', () => {
  assert.ok(
    uploadPageContent.includes("handleTabChange('disease-diag')") &&
    uploadPageContent.includes("handleTabChange('plant-id')") &&
    uploadPageContent.includes("handleTabChange('agro-scan')"),
    'UploadImagePage must provide direct 3-module switcher without forcing back to overview'
  );
});

runTest('Farmer-facing error messages sanitize technical exceptions', () => {
  assert.ok(
    uploadPageContent.includes('Unable to analyze the photo right now') &&
    uploadPageContent.includes('Traceback'),
    'Farmer-facing error messages must be sanitized against technical traces'
  );
});

// ──────────────────────────────────────────────────────────────────
// GROUP 4: Mobile Navbar & BottomNav Quality
// ──────────────────────────────────────────────────────────────────
runTest('Navbar contains responsive mobile title truncation to prevent overflow', () => {
  assert.ok(
    appLayoutContent.includes('truncate') && appLayoutContent.includes('max-w-['),
    'Navbar mobile title must have controlled truncation to prevent horizontal overflow'
  );
});

runTest('Navbar notification and user dropdowns are responsively bounded', () => {
  assert.ok(
    appLayoutContent.includes('calc(100vw-24px)') || appLayoutContent.includes('calc(100vw - 24px)'),
    'Dropdowns must be constrained on mobile viewports to prevent overflow at 320px'
  );
});

runTest('BottomNav and Main layout implement safe area insets', () => {
  assert.ok(
    appContent.includes('env(safe-area-inset-bottom') &&
    appLayoutContent.includes('env(safe-area-inset-bottom'),
    'Layout and BottomNav must respect safe area insets'
  );
});

// ──────────────────────────────────────────────────────────────────
// GROUP 5: Transition Flicker & ErrorBoundary
// ──────────────────────────────────────────────────────────────────
runTest('App.jsx removes key from ErrorBoundary to prevent instance destruction on route change', () => {
  assert.ok(
    !appContent.includes('<ErrorBoundary key={location.pathname}'),
    'ErrorBoundary must not remount on every route change'
  );
  assert.ok(
    appContent.includes('<ErrorBoundary locationKey={location.pathname}>'),
    'ErrorBoundary must use locationKey prop to reset errors cleanly'
  );
});

// ──────────────────────────────────────────────────────────────────
// GROUP 6: Accessibility (Label / Input Associations)
// ──────────────────────────────────────────────────────────────────
runTest('FieldAreaCalculatorPage associates labels with input IDs', () => {
  assert.ok(
    calcPageContent.includes('htmlFor="plot-name-input"') &&
    calcPageContent.includes('id="plot-name-input"'),
    'Plot survey input must have explicit htmlFor and id association'
  );
  assert.ok(
    calcPageContent.includes('htmlFor="rect-length-input"') &&
    calcPageContent.includes('id="rect-length-input"'),
    'Rectangle length input must have explicit htmlFor and id association'
  );
  assert.ok(
    calcPageContent.includes('htmlFor="quad-diagonal"') &&
    calcPageContent.includes('id="quad-diagonal"'),
    'Quadrilateral diagonal input must have explicit htmlFor and id association'
  );
});

runTest('EquipmentBookingPage associates labels with input IDs', () => {
  assert.ok(
    bookingPageContent.includes('htmlFor="equipment-search-query"') &&
    bookingPageContent.includes('id="equipment-search-query"'),
    'Equipment search input must have explicit label association'
  );
  assert.ok(
    bookingPageContent.includes('htmlFor="booking-farmer-name"') &&
    bookingPageContent.includes('id="booking-farmer-name"'),
    'Farmer name input must have explicit label association'
  );
  assert.ok(
    bookingPageContent.includes('htmlFor="booking-service-date"') &&
    bookingPageContent.includes('id="booking-service-date"'),
    'Booking date input must have explicit label association'
  );
});

// ──────────────────────────────────────────────────────────────────
// GROUP 7: Performance & Clean UI Policy
// ──────────────────────────────────────────────────────────────────
runTest('NavbarSceneRenderer checks prefers-reduced-motion, document visibility, and mobile display', () => {
  assert.ok(
    sceneRendererContent.includes('prefers-reduced-motion: reduce'),
    'NavbarSceneRenderer must support prefers-reduced-motion'
  );
  assert.ok(
    sceneRendererContent.includes('visibilitychange') &&
    sceneRendererContent.includes('document.hidden'),
    'NavbarSceneRenderer must pause when document is hidden'
  );
  assert.ok(
    sceneRendererContent.includes('window.innerWidth >= 1024'),
    'NavbarSceneRenderer must be disabled on mobile devices'
  );
});

runTest('PyTorch AI v2.0 footer badge is restricted to Admin & Tester roles', () => {
  assert.ok(
    appLayoutContent.includes('(isAdmin || isTester) &&') &&
    appLayoutContent.includes('PyTorch AI'),
    'PyTorch AI badge must not clutter farmer navigation'
  );
});

// ──────────────────────────────────────────────────────────────────
// GROUP 8: B12-C Runtime Quality Enhancements
// ──────────────────────────────────────────────────────────────────
runTest('Mobile drawer locks document body scrolling while open and restores on unmount', () => {
  assert.ok(
    appLayoutContent.includes("document.body.style.overflow = 'hidden'") &&
    appLayoutContent.includes("document.body.style.overflow = prevOverflow"),
    'Sidebar must lock document body scrolling on mobile and restore on close'
  );
});

runTest('Outer AppRoutesWithBoundary passes locationKey to ErrorBoundary for public route recovery', () => {
  assert.ok(
    appContent.includes('AppRoutesWithBoundary') &&
    appContent.includes('<ErrorBoundary locationKey={location.pathname}>'),
    'Outer ErrorBoundary must use locationKey to reset errors on public route changes'
  );
});

runTest('FarmPage preserves unrelated query parameters during tab switching', () => {
  assert.ok(
    farmPageContent.includes('setSearchParams(prev =>') &&
    farmPageContent.includes('next.delete(\'tab\')') &&
    farmPageContent.includes('next.set(\'tab\', resolved)'),
    'FarmPage must use an updater function to keep existing search parameters'
  );
});

runTest('UploadImagePage safely revokes blob object URLs on replacement and clear', () => {
  assert.ok(
    uploadPageContent.includes('safelyRevokeBlobUrl(currentTabState.previewUrl)') &&
    uploadPageContent.includes('URL.revokeObjectURL(url)'),
    'UploadImagePage must safely revoke object URLs when preview is cleared or replaced'
  );
});

console.log('\n===================================================================');
console.log(`B12 RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('===================================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}
