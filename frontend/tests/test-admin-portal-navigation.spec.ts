import { test, expect } from '@playwright/test';

/**
 * Comprehensive test for Admin and Portal navigation
 * Verifies that both user types can access their pages without "api.list is not a function" errors
 */

test.describe('Admin Flow - Navigation', () => {
  test('Admin can navigate to all key pages without errors', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    console.log('\n=== Testing Admin Navigation ===\n');

    // Step 1: Login as admin
    console.log('Step 1: Login as admin');
    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.fill('input[type="email"]', 'admin@test.com');
    await page.fill('input[type="password"]', 'admin');
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/admin/**', { timeout: 10000 });
    const currentUrl = page.url();
    console.log(`After login URL: ${currentUrl}`);

    // Step 2: Navigate to Clients page
    console.log('\nStep 2: Navigate to Clients');
    await page.goto('http://127.0.0.1:3000/admin/clients');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    // Check for errors
    const clientsPageErrors = consoleErrors.filter(e =>
      e.includes('api.list is not a function') ||
      e.includes('api.listClients is not a function')
    );
    console.log(`Clients page - Console errors: ${clientsPageErrors.length}`);
    if (clientsPageErrors.length > 0) {
      console.log('❌ Errors found:', clientsPageErrors);
    } else {
      console.log('✅ No api.list errors');
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/admin-clients-page.png', fullPage: true });

    // Step 3: Navigate to Tickets page
    console.log('\nStep 3: Navigate to Tickets');
    consoleErrors.length = 0; // Clear previous errors
    await page.goto('http://127.0.0.1:3000/admin/tickets');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    const ticketsPageErrors = consoleErrors.filter(e =>
      e.includes('api.list is not a function') ||
      e.includes('api.listTickets is not a function')
    );
    console.log(`Tickets page - Console errors: ${ticketsPageErrors.length}`);
    if (ticketsPageErrors.length > 0) {
      console.log('❌ Errors found:', ticketsPageErrors);
    } else {
      console.log('✅ No api.list errors');
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/admin-tickets-page.png', fullPage: true });

    // Step 4: Navigate to Assets page
    console.log('\nStep 4: Navigate to Assets');
    consoleErrors.length = 0;
    await page.goto('http://127.0.0.1:3000/admin/assets');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    const assetsPageErrors = consoleErrors.filter(e =>
      e.includes('api.list is not a function') ||
      e.includes('api.listAssets is not a function')
    );
    console.log(`Assets page - Console errors: ${assetsPageErrors.length}`);
    if (assetsPageErrors.length > 0) {
      console.log('❌ Errors found:', assetsPageErrors);
    } else {
      console.log('✅ No api.list errors');
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/admin-assets-page.png', fullPage: true });

    console.log('\n=== Admin Navigation Test Complete ===\n');

    // Assertions
    expect(clientsPageErrors.length).toBe(0);
    expect(ticketsPageErrors.length).toBe(0);
    expect(assetsPageErrors.length).toBe(0);
  });
});

test.describe('Portal Flow - Navigation', () => {
  test('Portal user can navigate to all accessible pages without errors', async ({ page }) => {
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    console.log('\n=== Testing Portal Navigation ===\n');

    // Step 1: Login as portal user
    console.log('Step 1: Login as portal user');
    await page.goto('http://127.0.0.1:3000/portal/login');
    await page.fill('input[type="email"]', 'testadmin@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('**/portal/**', { timeout: 10000 });
    const currentUrl = page.url();
    console.log(`After login URL: ${currentUrl}`);

    // Step 2: Check Tickets page (should already be here)
    console.log('\nStep 2: Check Portal Tickets');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    const ticketsPageErrors = consoleErrors.filter(e =>
      e.includes('api.list is not a function')
    );
    console.log(`Portal Tickets page - Console errors: ${ticketsPageErrors.length}`);
    if (ticketsPageErrors.length > 0) {
      console.log('❌ Errors found:', ticketsPageErrors);
    } else {
      console.log('✅ No api.list errors');
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/portal-tickets-page.png', fullPage: true });

    // Step 3: Navigate to Assets page
    console.log('\nStep 3: Navigate to Portal Assets');
    consoleErrors.length = 0;
    await page.goto('http://127.0.0.1:3000/portal/assets');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    const assetsPageErrors = consoleErrors.filter(e =>
      e.includes('api.list is not a function')
    );
    console.log(`Portal Assets page - Console errors: ${assetsPageErrors.length}`);
    if (assetsPageErrors.length > 0) {
      console.log('❌ Errors found:', assetsPageErrors);
    } else {
      console.log('✅ No api.list errors');
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/portal-assets-page.png', fullPage: true });

    console.log('\n=== Portal Navigation Test Complete ===\n');

    // Assertions
    expect(ticketsPageErrors.length).toBe(0);
    expect(assetsPageErrors.length).toBe(0);
  });
});
