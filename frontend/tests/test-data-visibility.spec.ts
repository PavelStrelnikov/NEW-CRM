import { test, expect } from '@playwright/test';

/**
 * Test to diagnose why pages show no data despite successful login
 */

test.describe('Data Visibility Diagnosis', () => {
  test('Check if API returns data and if it renders', async ({ page }) => {
    const apiCalls: any[] = [];
    const consoleMessages: any[] = [];
    const pageErrors: any[] = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        console.log(`❌ Console Error: ${msg.text()}`);
      }
    });

    // Capture page errors
    page.on('pageerror', error => {
      pageErrors.push(error.message);
      console.log(`❌ Page Error: ${error.message}`);
    });

    // Intercept all API calls (including login)
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/')) {
        const status = response.status();
        let body = null;

        try {
          body = await response.json();
        } catch (e) {
          try {
            body = await response.text();
          } catch (e2) {}
        }

        apiCalls.push({
          url,
          method: response.request().method(),
          status,
          body
        });

        console.log(`\n${response.request().method()} ${url} → ${status}`);
        if (status === 200 && body && typeof body === 'object') {
          if (body.items) {
            console.log(`  → Returned ${body.items.length} items (total: ${body.total})`);
          } else if (Array.isArray(body)) {
            console.log(`  → Returned array with ${body.length} items`);
          }
        }
      }
    });

    // Login as admin
    console.log('\n=== LOGIN ===');
    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Take screenshot of login page
    await page.screenshot({ path: 'test-results/login-page-before.png', fullPage: true });

    // Fill email field (now type="text" with autoComplete="email")
    const emailInput = page.locator('input[autocomplete="email"]').first();
    const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Email input visible: ${emailVisible}`);

    if (!emailVisible) {
      console.log('⚠️  Email input not found! Page might not have loaded properly.');
      await page.screenshot({ path: 'test-results/login-page-error.png', fullPage: true });
      return;
    }

    await emailInput.fill('carla.bullock@company.local');
    const passwordInput = page.locator('input[type="password"]');
    await passwordInput.fill('password123');
    await page.screenshot({ path: 'test-results/login-page-filled.png', fullPage: true });

    // Press Enter to submit (more natural than clicking button)
    console.log('Pressing Enter to submit form...');
    await passwordInput.press('Enter');
    await page.waitForTimeout(3000);

    const afterLoginUrl = page.url();
    console.log(`After login URL: ${afterLoginUrl}`);

    // Check if token is stored
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    console.log(`Token stored: ${token ? 'Yes (' + token.substring(0, 20) + '...)' : 'No'}`);

    // Check if user is stored
    const user = await page.evaluate(() => localStorage.getItem('user'));
    console.log(`User stored: ${user ? 'Yes' : 'No'}`);

    console.log('\n=== CLIENTS PAGE ===');
    await page.goto('http://127.0.0.1:3000/admin/clients');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check DOM for table rows
    const clientRows = await page.locator('tbody tr').count();
    console.log(`\nClients in DOM: ${clientRows} rows`);

    // Check if there's a "no data" message
    const noDataText = await page.locator('text=/no.*data|empty|נתונים/i').count();
    if (noDataText > 0) {
      console.log('⚠️  "No data" message visible');
    }

    console.log('\n=== TICKETS PAGE ===');
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const ticketRows = await page.locator('tbody tr').count();
    console.log(`\nTickets in DOM: ${ticketRows} rows`);

    console.log('\n=== ASSETS PAGE ===');
    await page.goto('http://127.0.0.1:3000/admin/assets');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const assetRows = await page.locator('tbody tr').count();
    console.log(`\nAssets in DOM: ${assetRows} rows`);

    // Summary
    console.log('\n=== SUMMARY ===');
    console.log(`Total API calls: ${apiCalls.length}`);

    const dataApis = apiCalls.filter(c =>
      c.url.includes('/clients') ||
      c.url.includes('/tickets') ||
      c.url.includes('/assets')
    );

    console.log('\nData API calls:');
    dataApis.forEach(call => {
      const itemCount = call.body?.items?.length || call.body?.length || 0;
      const total = call.body?.total || 'N/A';
      console.log(`  ${call.method} ${call.url.split('/api/v1/')[1]} → ${call.status} (${itemCount} items, total: ${total})`);
    });

    console.log(`\nDOM rendering:`);
    console.log(`  Clients: ${clientRows} rows`);
    console.log(`  Tickets: ${ticketRows} rows`);
    console.log(`  Assets: ${assetRows} rows`);

    console.log(`\n=== ERRORS ===`);
    console.log(`Console errors: ${consoleMessages.filter(m => m.type === 'error').length}`);
    console.log(`Page errors: ${pageErrors.length}`);

    if (pageErrors.length > 0) {
      console.log('\nPage Errors:');
      pageErrors.forEach(err => console.log(`  - ${err}`));
    }

    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      console.log('\nConsole Errors:');
      consoleErrors.slice(0, 10).forEach(err => console.log(`  - ${err.text}`));
    }

    // Take screenshots
    await page.screenshot({ path: 'test-results/clients-page.png', fullPage: true });
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/tickets-page.png', fullPage: true });
    await page.goto('http://127.0.0.1:3000/admin/assets');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/assets-page.png', fullPage: true });

    expect(true).toBe(true);
  });
});
