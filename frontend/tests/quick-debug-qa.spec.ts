import { test, expect } from '@playwright/test';

test('Quick debug - check login page', async ({ page }) => {
  console.log('Opening page...');
  await page.goto('http://127.0.0.1:3004');

  // Wait a bit
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-homepage.png', fullPage: true });

  // Check current URL
  console.log('Current URL:', page.url());

  // Check page title
  const title = await page.title();
  console.log('Page title:', title);

  // Check for any visible elements
  const body = await page.locator('body').innerHTML();
  console.log('Body HTML length:', body.length);

  // Look for login form
  const hasEmailInput = await page.locator('input[type="email"]').count();
  console.log('Email inputs found:', hasEmailInput);

  const hasPasswordInput = await page.locator('input[type="password"]').count();
  console.log('Password inputs found:', hasPasswordInput);

  // Check if this is an admin login or portal login
  const hasAdminText = await page.locator('text=/admin/i').count();
  const hasPortalText = await page.locator('text=/portal/i').count();

  console.log('Admin text found:', hasAdminText);
  console.log('Portal text found:', hasPortalText);

  // Check for any buttons
  const buttons = await page.locator('button').count();
  console.log('Buttons found:', buttons);

  // Get all text content
  const allText = await page.locator('body').textContent();
  console.log('Page text:', allText?.substring(0, 500));
});
