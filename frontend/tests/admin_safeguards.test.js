/**
 * AgriShield B6 Phase 9 — Admin Self-Deletion / Self-Demotion Safeguards Test Suite (B6-P7-02)
 * Validates frontend safeguards in AdminPage.jsx preventing admin self-deletion and self-demotion.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('═══════════════════════════════════════════════════════════════════');
console.log('B6 PHASE 9 — ADMIN SAFEGUARDS (B6-P7-02) TEST SUITE');
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

// 1. Identity identification for self
it('AdminPage computes isSelf identity flag for each user row', () => {
  assert(adminPageCode.includes('currentAdminId = user?.id || user?._id'), 'Missing currentAdminId extraction');
  assert(adminPageCode.includes('const isSelf = Boolean('), 'Missing isSelf boolean definition');
  assert(adminPageCode.includes('u.id === currentAdminId || u._id === currentAdminId'), 'Missing ID comparison for self');
});

// 2. Delete button disabled on self row
it('AdminPage disables delete action on the currently authenticated admin row', () => {
  assert(adminPageCode.includes('disabled={isSelf}'), 'Delete button missing disabled={isSelf}');
  assert(adminPageCode.includes('onClick={() => !isSelf && setDeleteUserTarget(u)}'), 'Delete button missing !isSelf click guard');
  assert(adminPageCode.includes('Cannot delete your own active administrator account'), 'Missing clear tooltip warning on self delete button');
});

// 3. Self-deletion prevention in submit handler
it('handleDeleteUserSubmit rejects deleting own active admin account', () => {
  assert(adminPageCode.includes('deleteUserTarget.id === currentAdminId'), 'Missing self ID check in handleDeleteUserSubmit');
  assert(adminPageCode.includes("setError('Cannot delete your own active administrator account.')"), 'Missing self-delete error message in handleDeleteUserSubmit');
});

// 4. Role selector disabled on self row
it('AdminPage disables role selector on the currently authenticated admin row', () => {
  assert(adminPageCode.includes('disabled={updatingId === u.id || isSelf}'), 'Role selector missing disabled check for isSelf');
  assert(adminPageCode.includes('isSelf ? "Cannot demote your own active administrator account"'), 'Missing tooltip for disabled self role selector');
});

// 5. Self-demotion prevention in handleRoleChange
it('handleRoleChange rejects self-demotion attempt', () => {
  assert(adminPageCode.includes('userId === currentAdminId') && adminPageCode.includes("newRole !== 'admin'"), 'Missing self-demotion condition in handleRoleChange');
  assert(adminPageCode.includes("setError('Cannot demote your own active administrator account.')"), 'Missing self-demotion error message in handleRoleChange');
});

// 6. Edit user modal disables role change for self
it('Edit User modal disables role selection when editing own admin account', () => {
  assert(adminPageCode.includes('editingUser && ((editingUser.id === (user?.id || user?._id))'), 'Missing self guard in modal role selector');
  assert(adminPageCode.includes('Cannot demote your own active administrator account'), 'Missing tooltip in modal role selector');
});

// 7. handleEditSubmit rejects self-demotion
it('handleEditSubmit rejects self-demotion attempt', () => {
  assert(adminPageCode.includes('editingUser.id === currentAdminId') && adminPageCode.includes("editForm.role !== 'admin'"), 'Missing self-demotion condition in handleEditSubmit');
});

// 8. Normal management of other users preserved
it('Preserves normal management of other users', () => {
  assert(adminPageCode.includes('openEditModal(u)'), 'Missing edit modal trigger for users');
  assert(adminPageCode.includes('handleRoleChange(u.id, e.target.value)'), 'Missing role change handler call');
  assert(adminPageCode.includes('setDeleteUserTarget(u)'), 'Missing delete target trigger for non-self users');
});

console.log(`\nResults: ${passedTests}/${totalTests} tests passed.`);
if (passedTests !== totalTests) {
  process.exit(1);
}
