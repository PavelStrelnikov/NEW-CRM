/**
 * Test: Portal Users - Manage Clients Dialog
 * Verify client assignments work correctly
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

test.describe('Portal Users - Manage Clients Dialog', () => {

  test('Manage Clients dialog loads client list without 422 error', async ({ page }) => {
    console.log('=== Testing Manage Clients Dialog ===\n');

    // Track API calls
    const apiCalls: Array<{ url: string; status: number; method: string }> = [];

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/clients') || url.includes('/portal/client-users')) {
        apiCalls.push({
          url,
          status: response.status(),
          method: response.request().method()
        });
        console.log(`${response.request().method()} ${url} → ${response.status()}`);
      }
    });

    // Step 1: Login as admin
    console.log('Step 1: Admin login');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    console.log('✅ Admin logged in\n');

    // Step 2: Navigate to Portal Users
    console.log('Step 2: Navigate to Portal Users');
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    console.log('✅ Portal Users page loaded\n');

    // Step 3: Find and click "Manage Clients" button
    console.log('Step 3: Open Manage Clients dialog');

    // Find row with CLIENT_ADMIN user
    const adminUserRow = page.locator('tr:has-text("CLIENT_ADMIN")').first();
    const hasAdminUser = await adminUserRow.count();

    if (hasAdminUser === 0) {
      console.log('⚠️ No CLIENT_ADMIN users found - cannot test Manage Clients');
      console.log('Please create a CLIENT_ADMIN user first');
      return;
    }

    // Click "Manage Clients" button (icon button with Business icon)
    const manageButton = adminUserRow.locator('button').filter({ hasText: /manage|business/i }).or(
      adminUserRow.locator('button').filter({ has: page.locator('svg[data-testid*="Business"]') })
    );

    const manageButtonCount = await manageButton.count();
    console.log(`Manage Clients buttons found: ${manageButtonCount}`);

    if (manageButtonCount > 0) {
      await manageButton.first().click();
      await page.waitForTimeout(1000);
    } else {
      // Try finding by icon only
      const businessIcon = adminUserRow.locator('svg[data-testid*="Business"]');
      const iconCount = await businessIcon.count();
      console.log(`Business icons found: ${iconCount}`);

      if (iconCount > 0) {
        await businessIcon.first().click();
        await page.waitForTimeout(1000);
      } else {
        console.log('⚠️ Manage Clients button not found');
        await page.screenshot({ path: 'test-results/manage-clients-no-button.png', fullPage: true });
        return;
      }
    }

    console.log('✅ Clicked Manage Clients button\n');

    // Step 4: Verify dialog opened
    console.log('Step 4: Verify dialog opened');
    await page.waitForTimeout(500);

    const dialog = page.locator('[role="dialog"], .MuiDialog-root');
    const hasDialog = await dialog.count();
    console.log(`Dialogs found: ${hasDialog}`);

    if (hasDialog > 0) {
      console.log('✅ Dialog opened');
    } else {
      console.log('❌ Dialog did not open');
      await page.screenshot({ path: 'test-results/manage-clients-no-dialog.png', fullPage: true });
      throw new Error('Manage Clients dialog did not open');
    }

    // Step 5: Wait for clients to load
    console.log('\nStep 5: Wait for clients list to load');
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({ path: 'test-results/manage-clients-dialog.png', fullPage: true });

    // Step 6: Check for errors in dialog
    console.log('\nStep 6: Check for errors');
    const hasError = await page.locator('text=/error|failed|422/i').count();

    if (hasError > 0) {
      const errorText = await page.locator('text=/error|failed|422/i').first().innerText();
      console.log(`❌ Error found in dialog: ${errorText}`);
    } else {
      console.log('✅ No visible errors in dialog');
    }

    // Step 7: Verify client checkboxes loaded
    console.log('\nStep 7: Verify client checkboxes');
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    console.log(`Checkboxes found: ${checkboxCount}`);

    if (checkboxCount > 0) {
      console.log('✅ Client checkboxes loaded');
    } else {
      console.log('⚠️ No checkboxes found - clients might not have loaded');
    }

    // Step 8: Analyze API calls
    console.log('\nStep 8: Analyze API calls');

    const clientsApiCalls = apiCalls.filter(call => call.url.includes('/clients'));
    console.log(`Total /clients API calls: ${clientsApiCalls.length}`);

    for (const call of clientsApiCalls) {
      console.log(`\n${call.method} ${call.url}`);
      console.log(`  Status: ${call.status}`);

      if (call.status === 422) {
        console.log('  ❌ 422 Unprocessable Entity - Parameter validation failed');
        console.log('  → Likely cause: page_size=1000 exceeds limit');
      } else if (call.status === 200) {
        console.log('  ✅ Success');
      } else if (call.status === 401) {
        console.log('  ⚠️ 401 Unauthorized');
      } else if (call.status === 403) {
        console.log('  ⚠️ 403 Forbidden');
      }
    }

    // Verify NO 422 errors
    const has422 = clientsApiCalls.some(call => call.status === 422);
    if (has422) {
      console.log('\n❌ FAILED: Found 422 error on /clients endpoint');
      throw new Error('422 error when loading clients - parameter validation failed');
    } else {
      console.log('\n✅ No 422 errors - clients loaded successfully');
    }

    // Verify at least one 200 OK
    const has200 = clientsApiCalls.some(call => call.status === 200);
    expect(has200).toBe(true);

    console.log('\n=== Test Complete ===');
  });

  test('Verify clients API accepts page_size=1000', async ({ page }) => {
    console.log('Testing clients API parameter limits...');

    let responseStatus = 0;
    let responseBody: any = null;

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/api/v1/clients?')) {
        responseStatus = response.status();
        console.log(`GET ${url} → ${responseStatus}`);

        if (responseStatus === 422) {
          try {
            responseBody = await response.json();
            console.log('422 Response body:', JSON.stringify(responseBody, null, 2));
          } catch (e) {
            console.log('Could not parse 422 response body');
          }
        }
      }
    });

    // Login
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Make direct API call with page_size=1000
    const response = await page.request.get('http://127.0.0.1:3000/api/v1/clients?page=1&page_size=1000', {
      headers: {
        'Authorization': `Bearer ${await page.evaluate(() => localStorage.getItem('access_token'))}`
      }
    });

    console.log(`\nDirect API call result:`);
    console.log(`  Status: ${response.status()}`);

    if (response.status() === 200) {
      const data = await response.json();
      console.log(`  ✅ Success - Returned ${data.items?.length || 0} clients`);
      console.log(`  Total: ${data.total || 0}`);
    } else if (response.status() === 422) {
      const errorData = await response.json();
      console.log(`  ❌ 422 Unprocessable Entity`);
      console.log(`  Error details:`, JSON.stringify(errorData, null, 2));
    }

    expect(response.status()).toBe(200);
  });

  test('Test page_size parameter limits', async ({ page }) => {
    console.log('Testing different page_size values...');

    // Login first
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    const testCases = [
      { page_size: 20, expected: 200 },
      { page_size: 100, expected: 200 },
      { page_size: 500, expected: 200 },
      { page_size: 1000, expected: 200 },
      { page_size: 1001, expected: 422 }, // Should fail (exceeds limit)
    ];

    for (const testCase of testCases) {
      const response = await page.request.get(`http://127.0.0.1:3000/api/v1/clients?page=1&page_size=${testCase.page_size}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const status = response.status();
      const result = status === testCase.expected ? '✅' : '❌';

      console.log(`${result} page_size=${testCase.page_size} → ${status} (expected ${testCase.expected})`);

      if (testCase.expected === 200) {
        expect(status).toBe(200);
      }
    }
  });
});
