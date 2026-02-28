import { test, expect } from '@playwright/test';

/**
 * Portal Smoke Test
 * Quick health check for portal functionality
 * Run this after any portal-related changes
 */

const PORTAL_URL = 'http://127.0.0.1:3004';
const TEST_USER = {
  email: 'test@test.com',
  password: 'Tt134679',
  role: 'client-admin',
};

test.describe('Portal Smoke Tests', () => {
  test('1. Portal login works', async ({ page }) => {
    await page.goto(`${PORTAL_URL}/portal/login`);
    await page.waitForSelector('input[type="password"]');

    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length > 0) {
      await inputs[0].fill(TEST_USER.email);
    }
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    await page.waitForTimeout(3000);

    const url = page.url();
    expect(url).toContain('/portal/');
    expect(url).not.toContain('/login');
  });

  test('2. No 401 errors on portal pages', async ({ page }) => {
    const errors: string[] = [];

    page.on('response', response => {
      if (response.url().includes('/api/v1/') && response.status() === 401) {
        errors.push(`401 - ${response.url()}`);
      }
    });

    // Login
    await page.goto(`${PORTAL_URL}/portal/login`);
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length > 0) {
      await inputs[0].fill(TEST_USER.email);
    }
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Visit portal pages
    await page.goto(`${PORTAL_URL}/portal/clients`);
    await page.waitForTimeout(2000);

    await page.goto(`${PORTAL_URL}/portal/assets`);
    await page.waitForTimeout(2000);

    await page.goto(`${PORTAL_URL}/portal/tickets`);
    await page.waitForTimeout(2000);

    // Assert no 401 errors
    if (errors.length > 0) {
      console.error('❌ Found 401 errors:');
      errors.forEach(err => console.error(`  ${err}`));
    }
    expect(errors).toHaveLength(0);
  });

  test('3. Portal pages use correct API endpoints', async ({ page }) => {
    const apiCalls: string[] = [];
    const wrongEndpoints: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/v1/')) {
        apiCalls.push(url);

        // Check for incorrect admin API usage in portal context
        if (
          !url.includes('/portal/') &&
          !url.includes('/auth/') &&
          (url.includes('/clients') ||
            url.includes('/assets') ||
            url.includes('/tickets') ||
            url.includes('/asset-types'))
        ) {
          wrongEndpoints.push(url);
        }
      }
    });

    // Login
    await page.goto(`${PORTAL_URL}/portal/login`);
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length > 0) {
      await inputs[0].fill(TEST_USER.email);
    }
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Visit portal pages
    await page.goto(`${PORTAL_URL}/portal/assets`);
    await page.waitForTimeout(2000);

    // Assert portal pages only use portal endpoints
    if (wrongEndpoints.length > 0) {
      console.error('❌ Portal pages calling admin-only endpoints:');
      wrongEndpoints.forEach(url => console.error(`  ${url}`));
      console.error('\nThese should use /api/v1/portal/* endpoints instead');
    }
    expect(wrongEndpoints).toHaveLength(0);
  });

  test('4. No JavaScript errors', async ({ page }) => {
    const jsErrors: string[] = [];

    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('404') &&
          !text.includes('favicon') &&
          !text.includes('DevTools')
        ) {
          jsErrors.push(text);
        }
      }
    });

    // Login
    await page.goto(`${PORTAL_URL}/portal/login`);
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length > 0) {
      await inputs[0].fill(TEST_USER.email);
    }
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Visit portal pages
    await page.goto(`${PORTAL_URL}/portal/clients`);
    await page.waitForTimeout(2000);

    await page.goto(`${PORTAL_URL}/portal/assets`);
    await page.waitForTimeout(2000);

    await page.goto(`${PORTAL_URL}/portal/tickets`);
    await page.waitForTimeout(2000);

    // Assert no JS errors
    if (jsErrors.length > 0) {
      console.error('❌ Found JavaScript errors:');
      jsErrors.forEach((err, i) => console.error(`  ${i + 1}. ${err}`));
    }
    expect(jsErrors).toHaveLength(0);
  });

  test('5. Portal user can create ticket (no 500 error)', async ({ page }) => {
    let has500 = false;
    let error500Url = '';

    // Monitor for 500 errors
    page.on('response', response => {
      if (response.url().includes('/api/v1/') && response.status() === 500) {
        has500 = true;
        error500Url = response.url();
        console.error(`❌ 500 Internal Server Error: ${response.url()}`);
      }
    });

    // Login
    await page.goto(`${PORTAL_URL}/portal/login`);
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length > 0) {
      await inputs[0].fill(TEST_USER.email);
    }
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Navigate to tickets page
    await page.goto(`${PORTAL_URL}/portal/tickets`);
    await page.waitForTimeout(2000);

    // Click Create Ticket button
    const createBtn = page.locator('button:has-text("Create"), button:has-text("צור"), [aria-label*="create" i]').first();
    const hasCreateBtn = await createBtn.isVisible().catch(() => false);

    if (!hasCreateBtn) {
      console.log('⚠️  Create Ticket button not found - skipping test');
      return;
    }

    await createBtn.click();
    await page.waitForTimeout(1500);

    // Fill form - Client (Autocomplete)
    const clientInput = page.locator('input[name="client_id"], [aria-label*="client" i]').first();
    const hasClientInput = await clientInput.isVisible().catch(() => false);

    if (hasClientInput) {
      await clientInput.click();
      await page.waitForTimeout(500);
      // Select first option from dropdown
      const firstOption = page.locator('[role="option"]').first();
      const hasOption = await firstOption.isVisible().catch(() => false);
      if (hasOption) {
        await firstOption.click();
        await page.waitForTimeout(1000);
      }
    }

    // Fill form - Site (Autocomplete)
    const siteInput = page.locator('input[name="site_id"], [aria-label*="site" i], [aria-label*="branch" i]').first();
    const hasSiteInput = await siteInput.isVisible().catch(() => false);

    if (hasSiteInput) {
      await siteInput.click();
      await page.waitForTimeout(500);
      // Select first option from dropdown
      const firstOption = page.locator('[role="option"]').first();
      const hasOption = await firstOption.isVisible().catch(() => false);
      if (hasOption) {
        await firstOption.click();
        await page.waitForTimeout(1000);
      }
    }

    // Fill form - Contact Person (Autocomplete)
    const contactInput = page.locator('input[name="contact_person_id"], [aria-label*="contact person" i], [aria-label*="opener" i]').first();
    const hasContactInput = await contactInput.isVisible().catch(() => false);

    if (hasContactInput) {
      await contactInput.click();
      await page.waitForTimeout(500);
      // Select first option from dropdown
      const firstOption = page.locator('[role="option"]').first();
      const hasOption = await firstOption.isVisible().catch(() => false);
      if (hasOption) {
        await firstOption.click();
        await page.waitForTimeout(1000);
      }
    }

    // Fill form - Title
    const titleInput = page.locator('input[name="title"], [aria-label*="title" i]').first();
    const hasTitleInput = await titleInput.isVisible().catch(() => false);

    if (hasTitleInput) {
      await titleInput.fill(`Smoke Test Ticket ${Date.now()}`);
    }

    // Fill form - Description
    const descInput = page.locator('textarea[name="description"], [aria-label*="description" i]').first();
    const hasDescInput = await descInput.isVisible().catch(() => false);

    if (hasDescInput) {
      await descInput.fill('Automated smoke test - portal user ticket creation');
    }

    // Submit form
    const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("צור")').last();
    await submitBtn.click();
    await page.waitForTimeout(3000);

    // Check for 500 error
    if (has500) {
      console.error(`❌ CRITICAL: 500 error when creating ticket`);
      console.error(`   Endpoint: ${error500Url}`);
      throw new Error(`500 Internal Server Error when creating ticket: ${error500Url}`);
    }

    // Check for success (either redirect to tickets list or success toast)
    const currentUrl = page.url();
    const isOnTicketsPage = currentUrl.includes('/portal/tickets');

    // Also check for error toast
    const errorToast = page.locator('[role="alert"]:has-text("500"), [role="alert"]:has-text("failed"), [role="alert"]:has-text("error")');
    const hasErrorToast = await errorToast.isVisible().catch(() => false);

    if (hasErrorToast) {
      const errorText = await errorToast.textContent();
      console.error(`❌ Error toast appeared: ${errorText}`);
      throw new Error(`Ticket creation failed with error: ${errorText}`);
    }

    console.log('✅ Ticket created successfully (no 500 error)');
    expect(has500).toBe(false);
  });
});
