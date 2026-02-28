import { test, expect } from '@playwright/test';

test.describe('E2E Login Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Suppress 404 errors from missing resources
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('404')) {
        // Ignore 404s for now
        return;
      }
    });
  });

  test('A) Admin login and dashboard access', async ({ page }) => {
    console.log('Step 1: Opening login page...');
    await page.goto('http://127.0.0.1:3000');

    // Wait for login page
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });

    console.log('Step 2: Filling admin credentials...');
    // Enter admin credentials (assuming default admin exists)
    await page.fill('input[type="email"]', 'admin@example.com');
    await page.fill('input[type="password"]', 'admin123');

    console.log('Step 3: Clicking login button...');
    await page.click('button[type="submit"]');

    // Wait for navigation (should redirect to dashboard or similar)
    console.log('Step 4: Waiting for dashboard...');
    await page.waitForURL(/\/(dashboard|clients|tickets)/, { timeout: 10000 });

    // Check that we're logged in (look for common UI elements)
    const isLoggedIn = await page.locator('header, nav, [role="navigation"]').count() > 0;
    expect(isLoggedIn).toBeTruthy();

    console.log('Step 5: Taking screenshot...');
    await page.screenshot({ path: 'test-results/admin_logged_in.png', fullPage: true });

    console.log('✅ Admin login successful!');
    console.log('Current URL:', page.url());
  });

  test('B) CLIENT_ADMIN portal login and data access', async ({ page }) => {
    console.log('Step 1: Opening login page...');
    await page.goto('http://127.0.0.1:3000');

    // Wait for login page
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });

    console.log('Step 2: Filling CLIENT_ADMIN credentials...');
    await page.fill('input[type="email"]', 'testadmin@example.com');
    await page.fill('input[type="password"]', 'testpass123');

    console.log('Step 3: Clicking login button...');
    await page.click('button[type="submit"]');

    // Wait for navigation
    console.log('Step 4: Waiting for portal to load...');
    try {
      await page.waitForURL(/\/(dashboard|clients|tickets)/, { timeout: 10000 });

      // Check that we're logged in
      const hasHeader = await page.locator('header').count() > 0;
      const hasNav = await page.locator('nav, [role="navigation"]').count() > 0;

      console.log('Header found:', hasHeader);
      console.log('Navigation found:', hasNav);

      expect(hasHeader || hasNav).toBeTruthy();

      console.log('Step 5: Checking for client selector (multi-client CLIENT_ADMIN)...');
      // Check if ClientSelector is visible (if multi-client)
      const hasClientSelector = await page.locator('select, [role="combobox"]').count() > 0;
      console.log('Client selector found:', hasClientSelector);

      console.log('Step 6: Taking screenshot...');
      await page.screenshot({ path: 'test-results/client_admin_logged_in.png', fullPage: true });

      console.log('✅ CLIENT_ADMIN login successful!');
      console.log('Current URL:', page.url());
    } catch (error) {
      // If login failed, check if we're still on login page
      const stillOnLogin = await page.locator('input[type="email"]').count() > 0;
      if (stillOnLogin) {
        // Check for error messages
        const errorText = await page.locator('[role="alert"], .error, .MuiAlert-message').textContent();
        console.error('❌ Login failed - still on login page');
        console.error('Error message:', errorText || 'No error message displayed');

        // Take screenshot of failed login
        await page.screenshot({ path: 'test-results/client_admin_login_failed.png', fullPage: true });

        throw new Error(`LOGIN FAILED: ${errorText || 'User not found or incorrect credentials'}`);
      } else {
        // Some other error
        console.error('❌ Unknown error during login');
        await page.screenshot({ path: 'test-results/client_admin_error.png', fullPage: true });
        throw error;
      }
    }
  });

  test('C) Login page UI elements', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');

    // Wait for login page
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });

    // Check all expected elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    // Check for logo or app title
    const hasTitle = await page.locator('h1, h2, h3, h4, h5, h6').count() > 0;
    expect(hasTitle).toBeTruthy();

    await page.screenshot({ path: 'test-results/login_page_ui.png', fullPage: true });
    console.log('✅ Login page UI elements verified');
  });
});
