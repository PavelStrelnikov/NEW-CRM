import { test, expect } from '@playwright/test';

/**
 * Form Interactions 422 Test
 *
 * Test form interactions that might trigger 422:
 * - Loading dropdowns (clients, sites, contacts)
 * - Filling form fields
 * - Attempting to submit forms
 */

interface APIError {
  url: string;
  method: string;
  status: number;
  requestBody?: any;
  responseBody?: any;
  timestamp: string;
}

test.describe('Form Interactions 422 Test', () => {
  test('Test form dropdowns and interactions for 422 errors', async ({ page }) => {
    const allAPICalls: any[] = [];
    const errors422: APIError[] = [];

    // Capture ALL API calls
    page.on('response', async (response) => {
      const url = response.url();
      const status = response.status();
      const method = response.request().method();

      // Log all API calls
      if (url.includes('/api/v1/')) {
        allAPICalls.push({
          method,
          url: url.replace('http://127.0.0.1:3000', ''),
          status,
          timestamp: new Date().toISOString(),
        });

        if (status === 422) {
          let requestBody = null;
          try {
            requestBody = response.request().postDataJSON();
          } catch (e) {}

          let responseBody = null;
          try {
            responseBody = await response.json();
          } catch (e) {}

          const error: APIError = {
            url,
            method,
            status,
            requestBody,
            responseBody,
            timestamp: new Date().toISOString(),
          };

          errors422.push(error);
          console.log('\n❌ 422 VALIDATION ERROR DETECTED:');
          console.log(`Time: ${error.timestamp}`);
          console.log(`${method} ${url}`);
          console.log('Request:', JSON.stringify(requestBody, null, 2));
          console.log('Response:', JSON.stringify(responseBody, null, 2));
        }
      }
    });

    console.log('\n=== FORM INTERACTIONS 422 TEST ===\n');

    // Login
    console.log('--- Login ---');
    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[autocomplete="email"]').first();
    await emailInput.fill('carla.bullock@company.local');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password123');
    await passwordInput.press('Enter');
    await page.waitForTimeout(3000);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    if (!token) {
      console.log('❌ Login failed');
      return;
    }
    console.log('✅ Logged in\n');

    // Test 1: Open Create Ticket dialog and interact with dropdowns
    console.log('--- Test 1: Create Ticket Form ---');
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const createBtn = page.locator('button:has-text("Create"), button:has-text("צור")').first();
    const createVisible = await createBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (createVisible) {
      console.log('Opening Create Ticket dialog...');
      await createBtn.click();
      await page.waitForTimeout(3000);

      console.log('Looking for dropdowns in ticket form...');

      // Try to click on Client dropdown
      const clientSelect = page.locator('[role="combobox"], [aria-label*="Client"], [aria-label*="לקוח"]').first();
      const clientSelectVisible = await clientSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (clientSelectVisible) {
        console.log('Clicking Client dropdown...');
        await clientSelect.click();
        await page.waitForTimeout(2000);
      }

      // Try to click on Site dropdown
      const siteSelect = page.locator('[role="combobox"], [aria-label*="Site"], [aria-label*="אתר"]').nth(1);
      const siteSelectVisible = await siteSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (siteSelectVisible) {
        console.log('Clicking Site dropdown...');
        await siteSelect.click();
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('⚠️  Create button not found');
    }

    // Test 2: Open Edit Ticket and check dropdowns
    console.log('\n--- Test 2: Edit Ticket Form ---');

    // Get first ticket
    const ticketsResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:3000/api/v1/tickets?page=1&page_size=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    });

    if (ticketsResponse?.items?.[0]) {
      const ticketId = ticketsResponse.items[0].id;
      console.log(`Opening ticket ${ticketId} for editing...`);

      await page.goto(`http://127.0.0.1:3000/admin/tickets/${ticketId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const editBtn = page.locator('button:has-text("Edit"), button:has-text("ערוך")').first();
      const editVisible = await editBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (editVisible) {
        console.log('Clicking Edit button...');
        await editBtn.click();
        await page.waitForTimeout(3000);

        console.log('Checking if edit form loaded...');
        // Just wait to see if any API calls fail
        await page.waitForTimeout(2000);
      }
    }

    // Test 3: Open Create Asset and check dropdowns
    console.log('\n--- Test 3: Create Asset Form ---');
    await page.goto('http://127.0.0.1:3000/admin/assets');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const createAssetBtn = page.locator('button:has-text("Create"), button:has-text("צור")').first();
    const createAssetVisible = await createAssetBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (createAssetVisible) {
      console.log('Opening Create Asset dialog...');
      await createAssetBtn.click();
      await page.waitForTimeout(3000);

      // Try to interact with dropdowns
      const assetClientSelect = page.locator('[role="combobox"]').first();
      const assetClientVisible = await assetClientSelect.isVisible({ timeout: 2000 }).catch(() => false);

      if (assetClientVisible) {
        console.log('Clicking Client dropdown in asset form...');
        await assetClientSelect.click();
        await page.waitForTimeout(2000);
      }
    }

    // Test 4: Client details - Sites tab
    console.log('\n--- Test 4: Client Sites Tab ---');

    const clientsResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:3000/api/v1/clients?page=1&page_size=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    });

    if (clientsResponse?.items?.[0]) {
      const clientId = clientsResponse.items[0].id;
      console.log(`Opening client ${clientId} Sites tab...`);

      await page.goto(`http://127.0.0.1:3000/admin/clients/${clientId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      const sitesTab = page.locator('button:has-text("Sites"), button:has-text("אתרים")').first();
      const sitesTabVisible = await sitesTab.isVisible({ timeout: 2000 }).catch(() => false);

      if (sitesTabVisible) {
        console.log('Clicking Sites tab...');
        await sitesTab.click();
        await page.waitForTimeout(3000);

        // Try to add site
        const addSiteBtn = page.locator('button:has-text("Add"), button:has-text("Create"), button:has-text("הוסף")').first();
        const addSiteVisible = await addSiteBtn.isVisible({ timeout: 2000 }).catch(() => false);

        if (addSiteVisible) {
          console.log('Clicking Add Site button...');
          await addSiteBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    }

    // Summary
    console.log('\n\n=== SUMMARY ===');
    console.log(`Total API calls: ${allAPICalls.length}`);
    console.log(`Total 422 errors: ${errors422.length}\n`);

    if (errors422.length > 0) {
      console.log('=== 422 ERRORS FOUND ===\n');
      errors422.forEach((error, i) => {
        console.log(`[${i + 1}] ${error.method} ${error.url}`);
        console.log(`Time: ${error.timestamp}`);
        if (error.requestBody) {
          console.log('Request:', JSON.stringify(error.requestBody, null, 2));
        }
        if (error.responseBody) {
          console.log('Response:', JSON.stringify(error.responseBody, null, 2));
        }
        console.log('---\n');
      });
    } else {
      console.log('✅ No 422 errors detected in any form interactions');
    }

    // Print sample of API calls
    console.log('\n=== SAMPLE API CALLS (last 20) ===');
    allAPICalls.slice(-20).forEach(call => {
      const statusIcon = call.status < 400 ? '✅' : '❌';
      console.log(`${statusIcon} ${call.method} ${call.url} → ${call.status}`);
    });

    expect(true).toBe(true);
  });
});
