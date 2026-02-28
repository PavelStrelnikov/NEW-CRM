import { test, expect } from '@playwright/test';

/**
 * Deep Actions Test - Try to trigger 422 errors by performing actions
 */

interface APIError {
  url: string;
  method: string;
  status: number;
  request?: any;
  response?: any;
}

test.describe('Admin Deep Actions - Forms and Edits', () => {
  test('Try to open forms and perform edits to find 422 errors', async ({ page, context }) => {
    const errors422: APIError[] = [];
    const allErrors: APIError[] = [];

    // Capture network errors
    page.on('response', async (response) => {
      const status = response.status();

      if (status >= 400) {
        const url = response.url();
        const request = response.request();

        let requestBody = null;
        try {
          requestBody = request.postDataJSON();
        } catch (e) {
          const postData = request.postData();
          if (postData) {
            try {
              requestBody = JSON.parse(postData);
            } catch (e2) {
              requestBody = postData;
            }
          }
        }

        let responseBody = null;
        try {
          responseBody = await response.json();
        } catch (e) {
          try {
            responseBody = await response.text();
          } catch (e2) {}
        }

        const error = {
          url,
          method: request.method(),
          status: response.status(),
          request: {
            url: request.url(),
            method: request.method(),
            postData: requestBody,
          },
          response: responseBody,
        };

        allErrors.push(error);

        if (status === 422) {
          errors422.push(error);
          console.log('\n❌ 422 VALIDATION ERROR:');
          console.log(`${request.method()} ${url}`);
          console.log('Request:', JSON.stringify(requestBody, null, 2));
          console.log('Response:', JSON.stringify(responseBody, null, 2));
        } else if (status >= 400 && status < 500) {
          console.log(`\n⚠️  ${status} ERROR: ${request.method()} ${url}`);
          console.log('Response:', JSON.stringify(responseBody, null, 2));
        }
      }
    });

    console.log('\n=== Testing Admin Forms and Actions ===\n');

    // Login
    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[autocomplete="email"]').first();
    await emailInput.fill('carla.bullock@company.local');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password123');
    // Press Enter to submit (clicking button doesn't work in Playwright)
    await passwordInput.press('Enter');
    await page.waitForTimeout(2000);

    // Test 1: Try to create a new ticket
    console.log('\n--- Test 1: Open "Create Ticket" form ---');
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle');

    // Look for "Create" button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('Clicking create button...');
      await createButton.click();
      await page.waitForTimeout(1000);
      console.log('Create dialog should be open');
    } else {
      console.log('No create button found');
    }

    // Test 2: Try to open ticket details
    console.log('\n--- Test 2: Open Ticket Details ---');
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle');

    // Get all ticket rows
    const ticketRows = page.locator('tbody tr, div[role="button"]');
    const count = await ticketRows.count();
    console.log(`Found ${count} tickets`);

    if (count > 0) {
      console.log('Clicking first ticket...');
      await ticketRows.first().click();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);

      // Check if we're on detail page
      if (currentUrl.includes('/tickets/')) {
        console.log('✅ Opened ticket details');

        // Try to find edit button
        const editButton = page.locator('button:has-text("Edit")').first();
        if (await editButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Found edit button, clicking...');
          await editButton.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // Test 3: Try to open asset details
    console.log('\n--- Test 3: Open Asset Details ---');
    await page.goto('http://127.0.0.1:3000/admin/assets');
    await page.waitForLoadState('networkidle');

    const assetRows = page.locator('tbody tr, div[role="button"]');
    const assetCount = await assetRows.count();
    console.log(`Found ${assetCount} assets`);

    if (assetCount > 0) {
      console.log('Clicking first asset...');
      await assetRows.first().click();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);
    }

    // Test 4: Try to open client details
    console.log('\n--- Test 4: Open Client Details ---');
    await page.goto('http://127.0.0.1:3000/admin/clients');
    await page.waitForLoadState('networkidle');

    const clientRows = page.locator('tbody tr, div[role="button"]');
    const clientCount = await clientRows.count();
    console.log(`Found ${clientCount} clients`);

    if (clientCount > 0) {
      console.log('Clicking first client...');
      await clientRows.first().click();
      await page.waitForTimeout(2000);

      const currentUrl = page.url();
      console.log(`Current URL: ${currentUrl}`);

      if (currentUrl.includes('/clients/')) {
        console.log('✅ Opened client details');

        // Try to open sites tab
        const sitesTab = page.locator('button:has-text("Sites"), button:has-text("אתרים")').first();
        if (await sitesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('Clicking sites tab...');
          await sitesTab.click();
          await page.waitForTimeout(1000);
        }
      }
    }

    // Print all errors summary
    console.log('\n=== ALL ERRORS SUMMARY ===');
    console.log(`Total 4xx/5xx errors: ${allErrors.length}`);
    console.log(`Total 422 errors: ${errors422.length}\n`);

    if (errors422.length > 0) {
      console.log('=== 422 VALIDATION ERRORS ===');
      errors422.forEach((error, index) => {
        console.log(`\n[${index + 1}] ${error.method} ${error.url}`);
        console.log('Request:', error.request?.postData);
        console.log('Response:', error.response);
      });
    }

    if (allErrors.length > 0 && errors422.length === 0) {
      console.log('=== OTHER ERRORS (NOT 422) ===');
      allErrors.forEach((error, index) => {
        console.log(`\n[${index + 1}] ${error.status} ${error.method} ${error.url}`);
        console.log('Response:', error.response);
      });
    }

    if (allErrors.length === 0) {
      console.log('✅ No errors detected!');
    }

    // Take screenshot of final state
    await page.screenshot({ path: 'test-results/422-diagnosis-final.png', fullPage: true });

    // Test passes regardless (we're diagnosing)
    expect(true).toBe(true);
  });
});
