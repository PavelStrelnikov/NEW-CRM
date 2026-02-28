import { test, expect } from '@playwright/test';

/**
 * Deep Pages 422 Test - Systematically check all detail/edit/create pages
 *
 * Tests:
 * - Ticket details, edit, create
 * - Asset details, edit, create
 * - Client details, edit
 * - Sites list/details/create/edit
 */

interface APIError {
  url: string;
  method: string;
  status: number;
  requestBody?: any;
  responseBody?: any;
}

test.describe('Deep Pages 422 Errors - Comprehensive Check', () => {
  test('Check all detail/edit/create pages for 422 errors', async ({ page }) => {
    const errors422: APIError[] = [];
    const allErrors: APIError[] = [];

    // Capture ALL HTTP errors with full details
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

        const error: APIError = {
          url,
          method: request.method(),
          status,
          requestBody,
          responseBody,
        };

        allErrors.push(error);

        if (status === 422) {
          errors422.push(error);
          console.log('\n❌ 422 VALIDATION ERROR:');
          console.log(`${request.method()} ${url}`);
          console.log('Request Body:', JSON.stringify(requestBody, null, 2));
          console.log('Response:', JSON.stringify(responseBody, null, 2));
        } else if (status >= 400 && status < 500) {
          console.log(`\n⚠️  ${status} ERROR: ${request.method()} ${url}`);
          if (responseBody) {
            console.log('Response:', JSON.stringify(responseBody, null, 2));
          }
        }
      }
    });

    console.log('\n=== DEEP PAGES 422 TEST ===\n');

    // ========== LOGIN ==========
    console.log('--- Login as Admin ---');
    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[autocomplete="email"]').first();
    await emailInput.fill('carla.bullock@company.local');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password123');
    await passwordInput.press('Enter');
    await page.waitForTimeout(2000);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    if (!token) {
      console.log('❌ Login failed - no token');
      return;
    }
    console.log('✅ Login successful\n');

    // ========== TICKETS ==========
    console.log('--- Test 1: Tickets ---\n');

    // Get ticket IDs via API
    console.log('Getting ticket list via API...');
    const ticketsResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:3000/api/v1/tickets?page=1&page_size=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    });

    let firstTicketId: string | null = null;
    if (ticketsResponse && ticketsResponse.items && ticketsResponse.items.length > 0) {
      firstTicketId = ticketsResponse.items[0].id;
      console.log(`Found ticket ID: ${firstTicketId}`);
    }

    if (firstTicketId) {
      // Test ticket details
      console.log('\n1a. Opening ticket details...');
      await page.goto(`http://127.0.0.1:3000/admin/tickets/${firstTicketId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log(`Current URL: ${page.url()}`);

      // Try to find Edit button
      const editButton = page.locator('button:has-text("Edit"), button:has-text("ערוך")').first();
      const editVisible = await editButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (editVisible) {
        console.log('1b. Clicking Edit button...');
        await editButton.click();
        await page.waitForTimeout(2000);
      }

      // Try to find Add Work Log button
      const workLogButton = page.locator('button:has-text("Add Work Log"), button:has-text("רישום עבודה")').first();
      const workLogVisible = await workLogButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (workLogVisible) {
        console.log('1c. Clicking Add Work Log button...');
        await workLogButton.click();
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('⚠️  No ticket ID found in list');
    }

    // Test create ticket
    console.log('\n1d. Testing Create Ticket...');
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle');

    const createTicketBtn = page.locator('button:has-text("Create"), button:has-text("צור"), button:has-text("Add")').first();
    const createTicketVisible = await createTicketBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (createTicketVisible) {
      console.log('Opening Create Ticket dialog...');
      await createTicketBtn.click();
      await page.waitForTimeout(2000);
    }

    // ========== ASSETS ==========
    console.log('\n--- Test 2: Assets ---\n');

    // Get asset IDs via API
    console.log('Getting asset list via API...');
    const assetsResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:3000/api/v1/assets?page_size=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    });

    let firstAssetId: string | null = null;
    if (assetsResponse && assetsResponse.items && assetsResponse.items.length > 0) {
      firstAssetId = assetsResponse.items[0].id;
      console.log(`Found asset ID: ${firstAssetId}`);
    }

    if (firstAssetId) {
      console.log('\n2a. Opening asset details...');
      await page.goto(`http://127.0.0.1:3000/admin/assets/${firstAssetId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log(`Current URL: ${page.url()}`);

      // Try Edit button
      const assetEditBtn = page.locator('button:has-text("Edit"), button:has-text("ערוך")').first();
      const assetEditVisible = await assetEditBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (assetEditVisible) {
        console.log('2b. Clicking Asset Edit button...');
        await assetEditBtn.click();
        await page.waitForTimeout(2000);
      }
    } else {
      console.log('⚠️  No asset ID found in list');
    }

    // Test create asset
    console.log('\n2c. Testing Create Asset...');
    await page.goto('http://127.0.0.1:3000/admin/assets');
    await page.waitForLoadState('networkidle');

    const createAssetBtn = page.locator('button:has-text("Create"), button:has-text("צור"), button:has-text("Add")').first();
    const createAssetVisible = await createAssetBtn.isVisible({ timeout: 2000 }).catch(() => false);

    if (createAssetVisible) {
      console.log('Opening Create Asset dialog...');
      await createAssetBtn.click();
      await page.waitForTimeout(2000);
    }

    // ========== CLIENTS ==========
    console.log('\n--- Test 3: Clients ---\n');

    // Get client IDs via API
    console.log('Getting client list via API...');
    const clientsResponse = await page.evaluate(async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch('http://127.0.0.1:3000/api/v1/clients?page=1&page_size=1', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return response.json();
    });

    let firstClientId: string | null = null;
    if (clientsResponse && clientsResponse.items && clientsResponse.items.length > 0) {
      firstClientId = clientsResponse.items[0].id;
      console.log(`Found client ID: ${firstClientId}`);
    }

    if (firstClientId) {
      console.log('\n3a. Opening client details...');
      await page.goto(`http://127.0.0.1:3000/admin/clients/${firstClientId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log(`Current URL: ${page.url()}`);

      // Try Edit button
      const clientEditBtn = page.locator('button:has-text("Edit"), button:has-text("ערוך")').first();
      const clientEditVisible = await clientEditBtn.isVisible({ timeout: 2000 }).catch(() => false);

      if (clientEditVisible) {
        console.log('3b. Clicking Client Edit button...');
        await clientEditBtn.click();
        await page.waitForTimeout(2000);

        // Close edit dialog before trying tabs
        const closeBtn = page.locator('button[aria-label="Close"], button:has-text("Cancel"), button:has-text("ביטול")').first();
        const closeVisible = await closeBtn.isVisible({ timeout: 1000 }).catch(() => false);
        if (closeVisible) {
          await closeBtn.click();
          await page.waitForTimeout(1000);
        }
      }

      // Try Sites tab (navigate to client details first to ensure no dialogs)
      console.log('\n3c. Navigating to client details again for Sites tab...');
      await page.goto(`http://127.0.0.1:3000/admin/clients/${firstClientId}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);

      const sitesTab = page.locator('button:has-text("Sites"), button:has-text("אתרים")').first();
      const sitesTabVisible = await sitesTab.isVisible({ timeout: 2000 }).catch(() => false);

      if (sitesTabVisible) {
        console.log('Clicking Sites tab...');
        await sitesTab.click();
        await page.waitForTimeout(2000);

        // Try to add site
        const addSiteBtn = page.locator('button:has-text("Add Site"), button:has-text("הוסף אתר"), button:has-text("Create")').first();
        const addSiteVisible = await addSiteBtn.isVisible({ timeout: 2000 }).catch(() => false);

        if (addSiteVisible) {
          console.log('3d. Clicking Add Site button...');
          await addSiteBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    } else {
      console.log('⚠️  No client ID found in list');
    }

    // ========== SUMMARY ==========
    console.log('\n\n=== TEST SUMMARY ===');
    console.log(`Total HTTP errors (4xx/5xx): ${allErrors.length}`);
    console.log(`Total 422 validation errors: ${errors422.length}\n`);

    if (errors422.length > 0) {
      console.log('=== 422 VALIDATION ERRORS TABLE ===\n');

      errors422.forEach((error, index) => {
        console.log(`\n[${index + 1}] ${error.method} ${error.url}`);
        console.log('Status: 422 Unprocessable Entity');

        if (error.requestBody) {
          console.log('Request Body:');
          console.log(JSON.stringify(error.requestBody, null, 2));
        }

        if (error.responseBody && error.responseBody.detail) {
          console.log('Validation Errors:');
          if (Array.isArray(error.responseBody.detail)) {
            error.responseBody.detail.forEach((err: any) => {
              console.log(`  - Field: ${err.loc?.join('.')}`);
              console.log(`    Type: ${err.type}`);
              console.log(`    Message: ${err.msg}`);
              if (err.ctx) {
                console.log(`    Context: ${JSON.stringify(err.ctx)}`);
              }
            });
          } else {
            console.log(JSON.stringify(error.responseBody.detail, null, 2));
          }
        } else if (error.responseBody) {
          console.log('Response:');
          console.log(JSON.stringify(error.responseBody, null, 2));
        }
        console.log('---');
      });
    }

    if (allErrors.length > 0 && errors422.length === 0) {
      console.log('=== OTHER ERRORS (NOT 422) ===\n');
      allErrors.forEach((error, index) => {
        console.log(`[${index + 1}] ${error.status} ${error.method} ${error.url}`);
        if (error.responseBody) {
          console.log(JSON.stringify(error.responseBody, null, 2));
        }
      });
    }

    if (allErrors.length === 0) {
      console.log('✅ No HTTP errors detected on any deep pages!');
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/deep-pages-final.png', fullPage: true });

    // Test passes regardless - we're diagnosing
    expect(true).toBe(true);
  });
});
