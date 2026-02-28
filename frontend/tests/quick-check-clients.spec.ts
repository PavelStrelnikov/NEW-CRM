import { test } from '@playwright/test';

test('Quick check - are clients visible?', async ({ page }) => {
  // Login
  await page.goto('http://127.0.0.1:3004/portal/login');
  await page.waitForTimeout(1000);

  const inputs = await page.locator('input[type="text"]').all();
  if (inputs.length > 0) {
    await inputs[0].fill('test@test.com');
  }
  await page.fill('input[type="password"]', 'Tt134679');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  // Go to clients page
  await page.goto('http://127.0.0.1:3004/portal/clients');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'test-results/quick-clients-check.png', fullPage: true });

  // Check for client elements
  const clientCards = await page.locator('[data-testid*="client"], .client-card, .MuiTableRow').count();
  const clientText = await page.locator('body').textContent();

  console.log('\n=== CLIENT PAGE CHECK ===');
  console.log(`Client elements found: ${clientCards}`);
  console.log(`Page contains "Davis LLC": ${clientText?.includes('Davis LLC')}`);
  console.log(`Page contains "Clark Inc": ${clientText?.includes('Clark Inc')}`);
  console.log(`Page contains "Cortez-Carter": ${clientText?.includes('Cortez-Carter')}`);
  console.log(`Page text length: ${clientText?.length}`);
});
