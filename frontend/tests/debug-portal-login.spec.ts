import { test } from '@playwright/test';

test('Debug portal login', async ({ page }) => {
  console.log('Opening portal login...');
  await page.goto('http://127.0.0.1:3004/portal/login');

  // Wait a bit
  await page.waitForTimeout(2000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-portal-login.png', fullPage: true });

  // Check current URL
  console.log('Current URL:', page.url());

  // Check page content
  const allText = await page.locator('body').textContent();
  console.log('Page text:', allText);

  // Look for login form fields
  console.log('\nLooking for login form fields...');

  const inputs = await page.locator('input').all();
  console.log(`Found ${inputs.length} inputs`);

  for (let i = 0; i < inputs.length; i++) {
    const type = await inputs[i].getAttribute('type');
    const name = await inputs[i].getAttribute('name');
    const placeholder = await inputs[i].getAttribute('placeholder');
    console.log(`  Input ${i}: type=${type}, name=${name}, placeholder=${placeholder}`);
  }

  // Try to fill the form
  console.log('\nAttempting to fill login form...');

  // Try different selectors for email
  const emailInput = page.locator('input[name="email"]').first();
  const hasEmail = await emailInput.isVisible().catch(() => false);
  console.log('Email input visible:', hasEmail);

  if (hasEmail) {
    await emailInput.fill('test@test.com');
    console.log('Filled email');
  }

  // Try to find password input
  const passwordInput = page.locator('input[type="password"]').first();
  const hasPassword = await passwordInput.isVisible().catch(() => false);
  console.log('Password input visible:', hasPassword);

  if (hasPassword) {
    await passwordInput.fill('Tt134679');
    console.log('Filled password');
  }

  // Take screenshot after filling
  await page.screenshot({ path: 'test-results/debug-portal-login-filled.png', fullPage: true });

  // Find and click login button
  const loginBtn = page.locator('button[type="submit"]').first();
  const hasButton = await loginBtn.isVisible().catch(() => false);
  console.log('Login button visible:', hasButton);

  if (hasButton) {
    console.log('Clicking login button...');
    await loginBtn.click();
    await page.waitForTimeout(3000);

    const newUrl = page.url();
    console.log('After login URL:', newUrl);

    // Take screenshot after login
    await page.screenshot({ path: 'test-results/debug-portal-after-login.png', fullPage: true });

    // Check if we're still on login page
    const stillOnLogin = await page.locator('input[name="email"]').isVisible().catch(() => false);
    console.log('Still on login page:', stillOnLogin);

    if (stillOnLogin) {
      // Look for error message
      const alerts = await page.locator('[role="alert"], .error, .MuiAlert-message').all();
      console.log(`Found ${alerts.length} alerts`);
      for (let i = 0; i < alerts.length; i++) {
        const text = await alerts[i].textContent();
        console.log(`  Alert ${i}: ${text}`);
      }
    }
  }
});
