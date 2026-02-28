import { test, expect } from '@playwright/test';

test.describe('Frontend White Screen Diagnosis', () => {
  test('should diagnose white screen issue', async ({ page }) => {
    // Listen for console errors
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: Error[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Listen for failed requests
    const failedRequests: string[] = [];
    page.on('requestfailed', request => {
      failedRequests.push(`${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
    });

    console.log('Opening http://127.0.0.1:3000...');

    try {
      await page.goto('http://127.0.0.1:3000', {
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });

      // Wait a bit for React to render
      await page.waitForTimeout(2000);

      // Take screenshot
      await page.screenshot({ path: 'test-results/white-screen-diagnosis.png', fullPage: true });

      // Check if page is actually white (no content)
      const bodyText = await page.locator('body').textContent();
      const hasVisibleContent = bodyText && bodyText.trim().length > 0;

      // Try to find common elements
      const hasRoot = await page.locator('#root').count() > 0;
      const hasLoginForm = await page.locator('form').count() > 0;
      const hasAnyButton = await page.locator('button').count() > 0;
      const hasAnyInput = await page.locator('input').count() > 0;

      // Get page HTML for debugging
      const html = await page.content();

      console.log('\n=== DIAGNOSIS RESULTS ===');
      console.log('URL:', page.url());
      console.log('Has visible content:', hasVisibleContent);
      console.log('Has #root element:', hasRoot);
      console.log('Has login form:', hasLoginForm);
      console.log('Has any buttons:', hasAnyButton);
      console.log('Has any inputs:', hasAnyInput);
      console.log('\n=== CONSOLE ERRORS ===');
      console.log(consoleErrors.length > 0 ? consoleErrors.join('\n') : 'None');
      console.log('\n=== PAGE ERRORS ===');
      console.log(pageErrors.length > 0 ? pageErrors.map(e => e.message).join('\n') : 'None');
      console.log('\n=== FAILED REQUESTS ===');
      console.log(failedRequests.length > 0 ? failedRequests.join('\n') : 'None');
      console.log('\n=== CONSOLE WARNINGS ===');
      console.log(consoleWarnings.slice(0, 5).join('\n')); // First 5 warnings

      // If we have errors, fail the test with details
      if (consoleErrors.length > 0 || pageErrors.length > 0) {
        throw new Error(`Page has errors!\nConsole: ${consoleErrors.join('\n')}\nPage: ${pageErrors.map(e => e.message).join('\n')}`);
      }

      // If no visible content, fail
      if (!hasVisibleContent) {
        throw new Error('WHITE SCREEN: No visible content on page!');
      }

      console.log('\n✅ Page loaded successfully, no white screen detected');
    } catch (error) {
      console.error('\n❌ ERROR:', error);
      throw error;
    }
  });

  test('should load login page', async ({ page }) => {
    await page.goto('http://127.0.0.1:3000');

    // Wait for login page to load
    await page.waitForSelector('input[type="email"]', { timeout: 5000 });
    await page.waitForSelector('input[type="password"]', { timeout: 5000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/login-page.png', fullPage: true });

    // Check for login form elements
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const loginButton = page.locator('button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(loginButton).toBeVisible();

    console.log('✅ Login page loaded successfully');
  });
});
