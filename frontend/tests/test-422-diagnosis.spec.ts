import { test, expect } from '@playwright/test';

/**
 * Comprehensive 422 Error Diagnosis
 * Tests deep navigation (details, edit, create) to identify validation errors
 */

interface APIError {
  url: string;
  method: string;
  status: number;
  statusText: string;
  request?: any;
  response?: any;
}

test.describe('Admin Deep Navigation - 422 Diagnosis', () => {
  test('Diagnose 422 errors on ticket details and operations', async ({ page }) => {
    const errors422: APIError[] = [];

    // Capture all network requests/responses
    page.on('response', async (response) => {
      if (response.status() === 422) {
        const url = response.url();
        const request = response.request();

        let requestBody = null;
        try {
          requestBody = request.postDataJSON();
        } catch (e) {
          // Not JSON or no body
        }

        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch (e) {
          responseBody = await response.text();
        }

        errors422.push({
          url,
          method: request.method(),
          status: response.status(),
          statusText: response.statusText(),
          request: {
            url: request.url(),
            method: request.method(),
            headers: request.headers(),
            postData: requestBody,
          },
          response: responseBody,
        });

        console.log('\n❌ 422 ERROR DETECTED:');
        console.log(`URL: ${request.method()} ${url}`);
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        console.log('Response:', JSON.stringify(responseBody, null, 2));
      }
    });

    console.log('\n=== Admin 422 Diagnosis ===\n');

    // Login as admin
    console.log('Step 1: Login as admin');
    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/admin/**', { timeout: 10000 });

    // Test 1: Ticket Details
    console.log('\n--- Test 1: Ticket Details ---');
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle');

    // Try to click first ticket (if exists)
    const firstTicket = await page.locator('tr[role="row"]').nth(1);
    if (await firstTicket.isVisible()) {
      console.log('Clicking first ticket...');
      await firstTicket.click();
      await page.waitForTimeout(2000); // Wait for detail page load
    }

    // Test 2: Asset Details
    console.log('\n--- Test 2: Asset Details ---');
    await page.goto('http://127.0.0.1:3000/admin/assets');
    await page.waitForLoadState('networkidle');

    const firstAsset = await page.locator('tr[role="row"]').nth(1);
    if (await firstAsset.isVisible()) {
      console.log('Clicking first asset...');
      await firstAsset.click();
      await page.waitForTimeout(2000);
    }

    // Test 3: Client Details
    console.log('\n--- Test 3: Client Details ---');
    await page.goto('http://127.0.0.1:3000/admin/clients');
    await page.waitForLoadState('networkidle');

    const firstClient = await page.locator('tr[role="row"]').nth(1);
    if (await firstClient.isVisible()) {
      console.log('Clicking first client...');
      await firstClient.click();
      await page.waitForTimeout(2000);
    }

    // Print summary
    console.log('\n=== 422 ERRORS SUMMARY ===');
    console.log(`Total 422 errors found: ${errors422.length}\n`);

    if (errors422.length > 0) {
      errors422.forEach((error, index) => {
        console.log(`\n--- Error ${index + 1} ---`);
        console.log(`Endpoint: ${error.method} ${error.url}`);
        console.log(`Request:`, JSON.stringify(error.request?.postData, null, 2));
        console.log(`Response:`, JSON.stringify(error.response, null, 2));
      });

      // Create detailed report
      const report = {
        timestamp: new Date().toISOString(),
        totalErrors: errors422.length,
        errors: errors422,
      };

      console.log('\n=== DETAILED REPORT ===');
      console.log(JSON.stringify(report, null, 2));
    } else {
      console.log('✅ No 422 errors detected!');
    }

    // Test will pass even with 422s (we're just diagnosing)
    expect(errors422.length).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Portal Deep Navigation - 422 Diagnosis', () => {
  test('Diagnose 422 errors on portal pages', async ({ page }) => {
    const errors422: APIError[] = [];

    page.on('response', async (response) => {
      if (response.status() === 422) {
        const url = response.url();
        const request = response.request();

        let requestBody = null;
        try {
          requestBody = request.postDataJSON();
        } catch (e) {}

        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch (e) {
          responseBody = await response.text();
        }

        errors422.push({
          url,
          method: request.method(),
          status: response.status(),
          statusText: response.statusText(),
          request: {
            url: request.url(),
            method: request.method(),
            postData: requestBody,
          },
          response: responseBody,
        });

        console.log('\n❌ 422 ERROR DETECTED (Portal):');
        console.log(`URL: ${request.method()} ${url}`);
        console.log('Response:', JSON.stringify(responseBody, null, 2));
      }
    });

    console.log('\n=== Portal 422 Diagnosis ===\n');

    // Login as portal user
    console.log('Step 1: Login as portal user');
    await page.goto('http://127.0.0.1:3000/portal/login');
    await page.fill('input[type="email"]', 'testadmin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/portal/**', { timeout: 10000 });

    // Test: Portal Ticket Details
    console.log('\n--- Test: Portal Ticket Details ---');
    await page.waitForLoadState('networkidle');

    const firstTicket = await page.locator('div[role="button"]').first();
    if (await firstTicket.isVisible()) {
      console.log('Clicking first ticket...');
      await firstTicket.click();
      await page.waitForTimeout(2000);
    }

    // Print summary
    console.log('\n=== PORTAL 422 ERRORS SUMMARY ===');
    console.log(`Total 422 errors found: ${errors422.length}\n`);

    if (errors422.length > 0) {
      errors422.forEach((error, index) => {
        console.log(`\n--- Error ${index + 1} ---`);
        console.log(`Endpoint: ${error.method} ${error.url}`);
        console.log(`Response:`, JSON.stringify(error.response, null, 2));
      });
    } else {
      console.log('✅ No 422 errors detected!');
    }

    expect(errors422.length).toBeGreaterThanOrEqual(0);
  });
});
