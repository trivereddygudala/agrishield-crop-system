/**
 * AgriShield B6 Phase 2 — Admin User Directory Pagination Test Suite (B6-P1-01)
 * Validates server pagination state, query parameters, skip/limit calculations, and boundary logic.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B6 PHASE 2 — ADMIN USERS DIRECTORY PAGINATION (B6-P1-01) TEST SUITE');
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
const adminPageCode = fs.readFileSync(adminPagePath, 'utf8');

// 1. Pagination State Declarations
it('AdminPage declares userPage, userPageSize, totalUsersCount, and totalPagesCount', () => {
  assert(adminPageCode.includes('const [userPage, setUserPage] = useState(1);'), 'Missing userPage state');
  assert(adminPageCode.includes('const [userPageSize, setUserPageSize] = useState('), 'Missing userPageSize state');
  assert(adminPageCode.includes('const [totalUsersCount, setTotalUsersCount] = useState(0);'), 'Missing totalUsersCount state');
  assert(adminPageCode.includes('const [totalPagesCount, setTotalPagesCount] = useState(1);'), 'Missing totalPagesCount state');
  assert(adminPageCode.includes('const [hasMoreUsers, setHasMoreUsers] = useState(false);'), 'Missing hasMoreUsers state');
});

// 2. Server Query Parameters
it('AdminPage passes skip, limit, page, and search parameters in fetchUsers', () => {
  assert(adminPageCode.includes('skip = (targetPage - 1) * targetLimit;'), 'Missing skip calculation');
  assert(adminPageCode.includes('limit: targetLimit,'), 'Missing limit parameter in query');
  assert(adminPageCode.includes('page: targetPage'), 'Missing page parameter in query');
  assert(adminPageCode.includes('params.search = targetSearch.trim();'), 'Missing search parameter in query');
});

// 3. Pagination Controls UI
it('AdminPage renders Previous, Next, Page Size, and Range indicators', () => {
  assert(adminPageCode.includes('Page {userPage} of {totalPagesCount || 1}'), 'Missing page numbering label');
  assert(adminPageCode.includes('Page size:'), 'Missing page size label');
  assert(adminPageCode.includes('Showing <strong'), 'Missing range indicator');
  assert(adminPageCode.includes('disabled={userPage <= 1 || loading}'), 'Previous button must be disabled on page 1');
  assert(adminPageCode.includes('disabled={userPage >= totalPagesCount || loading || !hasMoreUsers}'), 'Next button must be disabled on last page');
});

// 4. Page Size Options
it('AdminPage provides standard page size choices (25, 50, 100)', () => {
  assert(adminPageCode.includes('<option value={25}>25</option>'), 'Missing 25 page size');
  assert(adminPageCode.includes('<option value={50}>50</option>'), 'Missing 50 page size');
  assert(adminPageCode.includes('<option value={100}>100</option>'), 'Missing 100 page size');
});

// 5. Page Reset on Search or Role Filter Change
it('AdminPage resets userPage to 1 when changing search term or role filter', () => {
  assert(adminPageCode.includes('setSearchTerm(e.target.value);'), 'SearchTerm must update');
  assert(adminPageCode.includes('setUserPage(1);'), 'Page must reset to 1 on input change');
});

// 6. Deletion Boundary Logic
it('AdminPage retreats to previous page if sole user on current page is deleted', () => {
  assert(adminPageCode.includes('if (usersList.length <= 1 && userPage > 1)'), 'Must check if page became empty after delete');
  assert(adminPageCode.includes('const prevPage = userPage - 1;'), 'Must calculate previous page');
  assert(adminPageCode.includes('setUserPage(prevPage);'), 'Must set state to previous page');
});

// 7. Loading and Empty State Distinction
it('AdminPage distinguishes between loading spinner and empty user search results', () => {
  assert(adminPageCode.includes('loading ? ('), 'Must render loading state');
  assert(adminPageCode.includes('Loading registered users...'), 'Must render explicit loading text');
  assert(adminPageCode.includes('filteredUsers.length === 0 ? ('), 'Must render empty state');
  assert(adminPageCode.includes('No registered users match your search criteria.'), 'Must render empty message');
});

// 8. Zero Full-Directory LocalStorage Caching
it('AdminPage does not cache the user directory in browser localStorage', () => {
  assert(!adminPageCode.includes("localStorage.setItem('agrishield_users'"), 'Must not store users in localStorage');
  assert(!adminPageCode.includes("localStorage.setItem('users_list'"), 'Must not store users_list in localStorage');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
