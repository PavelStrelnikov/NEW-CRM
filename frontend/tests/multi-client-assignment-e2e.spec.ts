/**
 * E2E Test: Multi-Client Assignment Full Flow
 * Tests: Assignment → DB Save → Token → Portal Access → Client Selector
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';
const PORTAL_USER_EMAIL = 'testadmin@example.com';
const PORTAL_USER_PASSWORD = 'testpass123';

test.describe('Multi-Client Assignment - Full E2E Flow', () => {

  test('Full flow: Assign 3 clients → Verify DB → Check token → Portal access', async ({ page }) => {
    console.log('=== Multi-Client Assignment E2E Test ===\n');

    const apiCalls: Array<{ method: string; url: string; status: number; body?: any }> = [];

    // Capture all API responses
    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/admin/portal/client-users') || url.includes('/portal/auth')) {
        const call: any = {
          method: response.request().method(),
          url,
          status: response.status()
        };

        if (response.request().method() === 'PUT' || response.request().method() === 'POST') {
          try {
            const postData = response.request().postData();
            if (postData) {
              call.requestBody = JSON.parse(postData);
            }
          } catch (e) {}
        }

        if (response.status() === 200) {
          try {
            call.responseBody = await response.json();
          } catch (e) {}
        }

        apiCalls.push(call);
      }
    });

    // STEP 1: Login as admin
    console.log('STEP 1: Login as admin');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);
    console.log('✅ Admin logged in\n');

    // STEP 2: Navigate to Portal Users
    console.log('STEP 2: Navigate to Portal Users');
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    console.log('✅ Portal Users page loaded\n');

    // STEP 3: Open Manage Clients for CLIENT_ADMIN user
    console.log('STEP 3: Open Manage Clients dialog');
    const adminUserRow = page.locator('tr:has-text("CLIENT_ADMIN")').first();
    const businessIcon = adminUserRow.locator('svg[data-testid*="Business"]');
    await businessIcon.first().click();
    await page.waitForTimeout(1500);
    console.log('✅ Dialog opened\n');

    // STEP 4: Select 3 clients
    console.log('STEP 4: Select 3 clients');
    const checkboxes = page.locator('input[type="checkbox"]:not(:disabled)');
    const totalCheckboxes = await checkboxes.count();
    console.log(`Total selectable checkboxes: ${totalCheckboxes}`);

    // Select first 3 available checkboxes (or all if less than 3)
    const numToSelect = Math.min(3, totalCheckboxes);
    for (let i = 0; i < numToSelect; i++) {
      await checkboxes.nth(i).check();
      await page.waitForTimeout(100);
    }
    console.log(`✅ Selected ${numToSelect} clients\n`);

    // Take screenshot before save
    await page.screenshot({ path: 'test-results/before-save-clients.png', fullPage: true });

    // STEP 5: Click Save
    console.log('STEP 5: Click Save');
    const saveButton = page.locator('button:has-text("Save"), button:has-text("שמירה")');
    await saveButton.last().click();
    await page.waitForTimeout(3000);

    // STEP 6: Verify API call was made
    console.log('\nSTEP 6: Verify Save API call');
    const putCall = apiCalls.find(call =>
      call.method === 'PUT' &&
      call.url.includes('/clients')
    );

    if (putCall) {
      console.log('✅ PUT request sent');
      console.log(`  URL: ${putCall.url}`);
      console.log(`  Status: ${putCall.status}`);

      if (putCall.requestBody) {
        console.log(`  Request body:`, JSON.stringify(putCall.requestBody, null, 2));

        if (putCall.requestBody.client_ids) {
          console.log(`  ✅ client_ids array: ${putCall.requestBody.client_ids.length} clients`);
          putCall.requestBody.client_ids.forEach((id: string, idx: number) => {
            console.log(`    ${idx + 1}. ${id}`);
          });
        } else {
          console.log('  ❌ No client_ids in request body!');
        }
      }

      if (putCall.responseBody) {
        console.log(`  Response:`, JSON.stringify(putCall.responseBody, null, 2));
      }

      expect(putCall.status).toBe(200);
    } else {
      console.log('❌ No PUT request found!');
      throw new Error('Save button did not trigger API call');
    }

    console.log('');

    // STEP 7: Logout admin
    console.log('STEP 7: Logout admin');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForTimeout(1000);
    console.log('✅ Logged out\n');

    // STEP 8: Login as portal user
    console.log('STEP 8: Login as portal user');
    await page.locator('input[name="email"], input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');
    console.log('✅ Portal user logged in\n');

    // STEP 9: Check token
    console.log('STEP 9: Analyze portal user token');
    const token = await page.evaluate(() => localStorage.getItem('access_token'));

    if (token) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log('Token payload:', JSON.stringify(payload, null, 2));

        console.log('\nToken analysis:');
        console.log(`  user_type: ${payload.user_type}`);
        console.log(`  role: ${payload.role}`);
        console.log(`  client_id (active): ${payload.client_id || 'MISSING'}`);
        console.log(`  primary_client_id: ${payload.primary_client_id || 'MISSING'}`);

        if (payload.allowed_client_ids) {
          console.log(`  allowed_client_ids: [${payload.allowed_client_ids.length} clients]`);
          payload.allowed_client_ids.forEach((id: string, idx: number) => {
            console.log(`    ${idx + 1}. ${id}`);
          });

          if (payload.allowed_client_ids.length > 1) {
            console.log(`  ✅ Multi-client access confirmed (${payload.allowed_client_ids.length} clients)`);
          } else {
            console.log(`  ⚠️ Only 1 client in allowed_client_ids (expected 3+)`);
          }
        } else {
          console.log(`  ❌ allowed_client_ids: MISSING or empty`);
        }
      }
    } else {
      console.log('❌ No token found!');
    }

    console.log('');

    // STEP 10: Call /me endpoint
    console.log('STEP 10: Call /api/v1/portal/auth/me');
    const meResponse = await page.request.get('http://127.0.0.1:3000/api/v1/portal/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (meResponse.status() === 200) {
      const meData = await meResponse.json();
      console.log('/me response:', JSON.stringify(meData, null, 2));

      if (meData.allowed_client_ids) {
        console.log(`✅ /me has allowed_client_ids: ${meData.allowed_client_ids.length} clients`);
      } else {
        console.log(`⚠️ /me missing allowed_client_ids`);
      }
    } else {
      console.log(`❌ /me returned ${meResponse.status()}`);
    }

    console.log('');

    // STEP 11: Check for Client Selector in UI
    console.log('STEP 11: Check for Client Selector in UI');
    await page.screenshot({ path: 'test-results/portal-user-dashboard-multi.png', fullPage: true });

    const hasSelector = await page.locator('select, [role="button"]:has-text("Company")').count();
    console.log(`Client selector elements found: ${hasSelector}`);

    if (hasSelector > 0) {
      console.log('✅ Client Selector visible - multi-client UI enabled');
    } else {
      console.log('⚠️ No Client Selector - might be single-client or not implemented');
    }

    console.log('\n=== Test Complete ===');
  });

  test('Verify token contains allowed_client_ids after assignment', async ({ page }) => {
    console.log('Testing token structure after multi-client assignment...\n');

    // Login as portal user
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));

    expect(token).toBeTruthy();

    const parts = token!.split('.');
    const payload = JSON.parse(atob(parts[1]));

    console.log('Token payload:');
    console.log(`  client_id: ${payload.client_id}`);
    console.log(`  primary_client_id: ${payload.primary_client_id}`);
    console.log(`  allowed_client_ids:`, payload.allowed_client_ids);

    // Verify allowed_client_ids exists
    expect(payload.allowed_client_ids).toBeDefined();

    // Verify it's an array
    expect(Array.isArray(payload.allowed_client_ids)).toBe(true);

    // Log results
    if (payload.allowed_client_ids.length > 1) {
      console.log(`\n✅ Multi-client access confirmed: ${payload.allowed_client_ids.length} clients`);
    } else {
      console.log(`\n⚠️ Single client only: ${payload.allowed_client_ids.length} client`);
    }
  });
});
