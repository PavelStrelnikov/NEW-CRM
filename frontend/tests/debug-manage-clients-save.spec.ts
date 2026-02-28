/**
 * Debug Test: Why Save Button is Disabled
 * Investigate checkbox clicks and state changes
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

test.describe('Debug: Manage Clients Save Button', () => {

  test('Investigate Save button state after checkbox clicks', async ({ page }) => {
    console.log('=== Debugging Save Button State ===\n');

    // Login as admin
    console.log('Step 1: Login as admin');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    console.log('✅ Logged in\n');

    // Navigate to Portal Users
    console.log('Step 2: Navigate to Portal Users');
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    console.log('✅ Portal Users loaded\n');

    // Open Manage Clients dialog
    console.log('Step 3: Open Manage Clients dialog');
    const adminUserRow = page.locator('tr:has-text("CLIENT_ADMIN")').first();
    const hasRow = await adminUserRow.count();

    if (hasRow === 0) {
      console.log('❌ No CLIENT_ADMIN users found');
      return;
    }

    const businessIcon = adminUserRow.locator('svg[data-testid*="Business"]');
    await businessIcon.first().click();
    await page.waitForTimeout(2000);
    console.log('✅ Dialog opened\n');

    // Check initial state
    console.log('Step 4: Check initial Save button state');
    const saveButton = page.locator('button').filter({ hasText: /save|שמירה/i });
    const saveButtonCount = await saveButton.count();
    console.log(`Save buttons found: ${saveButtonCount}`);

    if (saveButtonCount > 0) {
      const isDisabled = await saveButton.first().isDisabled();
      console.log(`Initial Save button state: ${isDisabled ? 'DISABLED' : 'ENABLED'}`);
    } else {
      console.log('❌ No Save button found!');
      await page.screenshot({ path: 'test-results/no-save-button.png', fullPage: true });
      return;
    }

    // Get all checkboxes
    console.log('\nStep 5: Analyze checkboxes');
    const allCheckboxes = page.locator('input[type="checkbox"]');
    const totalCheckboxes = await allCheckboxes.count();
    console.log(`Total checkboxes: ${totalCheckboxes}`);

    // Check which are checked/disabled
    for (let i = 0; i < totalCheckboxes; i++) {
      const checkbox = allCheckboxes.nth(i);
      const isChecked = await checkbox.isChecked();
      const isDisabled = await checkbox.isDisabled();
      const parent = checkbox.locator('xpath=ancestor::label | xpath=ancestor::div[contains(@class, "MuiFormControlLabel")]');
      const labelText = await parent.first().textContent().catch(() => 'unknown');

      console.log(`  Checkbox ${i + 1}: ${isChecked ? '☑' : '☐'} ${isDisabled ? '(disabled)' : '(enabled)'} - ${labelText?.substring(0, 30)}`);
    }

    // Take screenshot before changes
    await page.screenshot({ path: 'test-results/before-clicking-checkboxes.png', fullPage: true });

    // Try to click first 3 unchecked, enabled checkboxes
    console.log('\nStep 6: Click checkboxes to change selection');
    let clickedCount = 0;

    for (let i = 0; i < totalCheckboxes && clickedCount < 3; i++) {
      const checkbox = allCheckboxes.nth(i);
      const isDisabled = await checkbox.isDisabled();

      if (!isDisabled) {
        const wasChecked = await checkbox.isChecked();

        console.log(`\nClicking checkbox ${i + 1} (currently: ${wasChecked ? 'checked' : 'unchecked'})`);

        // Click the checkbox
        await checkbox.click({ force: true });
        await page.waitForTimeout(300);

        // Verify it changed
        const nowChecked = await checkbox.isChecked();
        console.log(`  After click: ${nowChecked ? 'checked' : 'unchecked'}`);

        if (wasChecked !== nowChecked) {
          console.log(`  ✅ State changed: ${wasChecked ? 'checked → unchecked' : 'unchecked → checked'}`);
          clickedCount++;
        } else {
          console.log(`  ⚠️ State did NOT change`);
        }

        // Check Save button state after each click
        const saveDisabled = await saveButton.first().isDisabled();
        console.log(`  Save button after click: ${saveDisabled ? 'DISABLED' : 'ENABLED'}`);
      }
    }

    console.log(`\nTotal checkboxes toggled: ${clickedCount}`);

    // Take screenshot after changes
    await page.screenshot({ path: 'test-results/after-clicking-checkboxes.png', fullPage: true });

    // Final Save button state
    console.log('\nStep 7: Final Save button state');
    const finalDisabled = await saveButton.first().isDisabled();
    console.log(`Save button: ${finalDisabled ? 'DISABLED ❌' : 'ENABLED ✅'}`);

    if (!finalDisabled) {
      console.log('\n✅ Save button is ENABLED - can proceed to click');

      // Try to click it
      console.log('Attempting to click Save...');
      await saveButton.first().click();
      await page.waitForTimeout(2000);
      console.log('✅ Save clicked');
    } else {
      console.log('\n❌ Save button still DISABLED after changes');
      console.log('Possible reasons:');
      console.log('  1. No actual changes detected by hasChanges()');
      console.log('  2. Checkbox clicks not updating React state');
      console.log('  3. Primary client must be included check failing');
      console.log('  4. IsLoading or isSaving flag stuck');
    }

    console.log('\n=== Debug Complete ===');
  });

  test('Check current assignments for CLIENT_ADMIN user', async ({ page }) => {
    console.log('Checking current client assignments...\n');

    // Login as admin
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));

    // Get list of portal users
    const usersResponse = await page.request.get('http://127.0.0.1:3000/api/v1/admin/portal/client-users?page_size=100', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (usersResponse.status() === 200) {
      const usersData = await usersResponse.json();
      const clientAdmins = usersData.items.filter((u: any) => u.role === 'CLIENT_ADMIN');

      console.log(`Found ${clientAdmins.length} CLIENT_ADMIN user(s)\n`);

      for (const user of clientAdmins) {
        console.log(`User: ${user.email} (${user.name})`);
        console.log(`  ID: ${user.id}`);
        console.log(`  Primary Client ID: ${user.client_id}`);
        console.log(`  Primary Client Name: ${user.client_name || 'N/A'}`);

        // Get client assignments
        const assignmentsResponse = await page.request.get(`http://127.0.0.1:3000/api/v1/admin/portal/client-users/${user.id}/clients`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (assignmentsResponse.status() === 200) {
          const assignmentsData = await assignmentsResponse.json();
          console.log(`  Current assignments:`);

          if (assignmentsData.assigned_client_ids && assignmentsData.assigned_client_ids.length > 0) {
            console.log(`    Total: ${assignmentsData.assigned_client_ids.length} client(s)`);
            assignmentsData.assigned_client_ids.forEach((id: string, idx: number) => {
              console.log(`    ${idx + 1}. ${id}`);
            });

            if (assignmentsData.assigned_client_ids.length > 1) {
              console.log(`  ✅ Multi-client user (${assignmentsData.assigned_client_ids.length} clients)`);
            } else {
              console.log(`  ⚠️ Single-client user (only primary)`);
            }
          } else {
            console.log(`    ⚠️ No assignments found (or empty array)`);
          }
        } else {
          console.log(`  ❌ Failed to get assignments: ${assignmentsResponse.status()}`);
        }

        console.log('');
      }
    } else {
      console.log(`❌ Failed to get portal users: ${usersResponse.status()}`);
    }
  });
});
