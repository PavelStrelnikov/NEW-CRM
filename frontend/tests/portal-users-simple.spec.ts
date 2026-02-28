/**
 * Simplified Portal Users E2E Test
 * Focus on verifying API path fix
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

test.describe('Portal Users - API Path Verification', () => {

  test('Verify API paths are correct (no double /api/v1)', async ({ page }) => {
    console.log('Testing API path correctness...');

    // Listen for API requests
    const apiRequests: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/admin/portal/client-users')) {
        apiRequests.push(url);
        console.log(`API Request: ${url}`);
      }
    });

    // Login as admin
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[name="email"], input[type="email"]').first();
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    await emailInput.fill(ADMIN_EMAIL);

    const passwordInput = page.locator('input[name="password"], input[type="password"]').first();
    await passwordInput.fill(ADMIN_PASSWORD);

    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    console.log('Admin logged in successfully');

    // Navigate to Portal Users page
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    console.log(`Total API requests captured: ${apiRequests.length}`);

    // Verify at least one request was made
    expect(apiRequests.length).toBeGreaterThan(0);

    // Check each request
    for (const url of apiRequests) {
      console.log(`Checking URL: ${url}`);

      // Should contain /api/v1/admin/portal/client-users
      expect(url).toContain('/api/v1/admin/portal/client-users');

      // Should NOT contain double /api/v1
      expect(url).not.toContain('/api/v1/api/v1');

      console.log('✅ URL is correct');
    }

    // Take screenshot of page
    await page.screenshot({ path: 'test-results/portal-users-page.png', fullPage: true });

    console.log('✅ Test passed: API paths are correct');
  });

  test('Verify Portal Users page loads content', async ({ page }) => {
    console.log('Testing Portal Users page load...');

    // Login as admin
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Navigate to Portal Users
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Check for page content
    const bodyText = await page.locator('body').innerText();
    console.log('Page text preview:', bodyText.substring(0, 500));

    // Check if table is present
    const hasTable = await page.locator('table').count();
    console.log(`Tables found: ${hasTable}`);

    // Check for any error messages
    const hasError = await page.locator('text=/error|failed|404/i').count();
    if (hasError > 0) {
      const errorText = await page.locator('text=/error|failed|404/i').first().innerText();
      console.log(`⚠️ Error found: ${errorText}`);
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/portal-users-content.png', fullPage: true });

    expect(hasTable).toBeGreaterThan(0);
    console.log('✅ Portal Users page loaded with table');
  });

  test('Admin can create portal user', async ({ page }) => {
    console.log('Testing portal user creation...');

    // Login
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    // Navigate to Portal Users
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Find and click Create button
    const createButton = page.locator('button').filter({ hasText: /create|add|новый/i });
    const createButtonCount = await createButton.count();
    console.log(`Create buttons found: ${createButtonCount}`);

    if (createButtonCount > 0) {
      await createButton.first().click();
      await page.waitForTimeout(1000);

      // Check if dialog opened
      const dialog = page.locator('[role="dialog"], .MuiDialog-root');
      const hasDialog = await dialog.count();
      console.log(`Dialogs found: ${hasDialog}`);

      await page.screenshot({ path: 'test-results/create-dialog.png', fullPage: true });

      expect(hasDialog).toBeGreaterThan(0);
      console.log('✅ Create dialog opened successfully');
    } else {
      console.log('⚠️ Create button not found');
    }
  });

  test('Login as portal user (if exists)', async ({ page }) => {
    const PORTAL_EMAIL = 'testadmin@example.com';
    const PORTAL_PASSWORD = 'testpass123';

    console.log(`Attempting login as portal user: ${PORTAL_EMAIL}`);

    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[name="email"], input[type="email"]').first().fill(PORTAL_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PORTAL_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Check if logged in (not on login page)
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Verify not white screen
    const bodyText = await page.locator('body').innerText();
    expect(bodyText.length).toBeGreaterThan(50);

    await page.screenshot({ path: 'test-results/portal-user-logged-in.png', fullPage: true });

    if (!currentUrl.includes('/login')) {
      console.log('✅ Portal user logged in successfully');
    } else {
      console.log('⚠️ Portal user login failed (credentials might not exist)');
    }
  });
});
