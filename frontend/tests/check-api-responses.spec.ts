import { test } from '@playwright/test';

test('Check API responses and data', async ({ page }) => {
  const apiErrors: any[] = [];
  const apiResponses: any[] = [];

  // Listen to all API requests
  page.on('response', async response => {
    const url = response.url();

    if (url.includes('/api/')) {
      const status = response.status();
      apiResponses.push({ url, status });

      console.log(`API: ${status} - ${url}`);

      if (status >= 400) {
        let body = '';
        try {
          body = await response.text();
        } catch (e) {
          body = 'Could not read response body';
        }
        apiErrors.push({ url, status, body });
        console.error(`❌ ERROR: ${status} - ${url}`);
        console.error(`   Body: ${body.substring(0, 200)}`);
      }
    }
  });

  // Login
  console.log('\n=== LOGGING IN ===');
  await page.goto('http://127.0.0.1:3004/portal/login');
  await page.waitForTimeout(1000);

  const inputs = await page.locator('input[type="text"]').all();
  if (inputs.length > 0) {
    await inputs[0].fill('test@test.com');
  }
  await page.fill('input[type="password"]', 'Tt134679');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);

  console.log('\n=== CHECKING CLIENTS PAGE ===');
  await page.goto('http://127.0.0.1:3004/portal/clients');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/api-check-clients.png', fullPage: true });

  console.log('\n=== CHECKING ASSETS PAGE ===');
  await page.goto('http://127.0.0.1:3004/portal/assets');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/api-check-assets.png', fullPage: true });

  console.log('\n=== CHECKING TICKETS PAGE ===');
  await page.goto('http://127.0.0.1:3004/portal/tickets');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/api-check-tickets.png', fullPage: true });

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total API calls: ${apiResponses.length}`);
  console.log(`API errors: ${apiErrors.length}`);

  if (apiErrors.length > 0) {
    console.log('\nERROR DETAILS:');
    apiErrors.forEach(err => {
      console.log(`\n${err.status} - ${err.url}`);
      console.log(`Response: ${err.body.substring(0, 500)}`);
    });
  }

  console.log('\nAll API calls:');
  apiResponses.forEach(res => {
    console.log(`  ${res.status} - ${res.url}`);
  });
});
