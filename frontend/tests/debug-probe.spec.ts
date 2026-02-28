import { test, expect } from '@playwright/test';

test.describe('DEBUG: Probe Device request analysis', () => {
  test('capture and log exact request body sent to backend', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    // Capture network requests
    page.on('request', request => {
      if (request.url().includes('/hikvision/probe')) {
        console.log('\n========== PROBE REQUEST CAPTURED ==========');
        console.log('URL:', request.url());
        console.log('Method:', request.method());
        console.log('Headers:', JSON.stringify(request.headers(), null, 2));
        console.log('PostData:', request.postData());
        console.log('=============================================\n');
      }
    });

    page.on('response', response => {
      if (response.url().includes('/hikvision/probe')) {
        console.log('\n========== PROBE RESPONSE CAPTURED ==========');
        console.log('URL:', response.url());
        console.log('Status:', response.status());
        response.text().then(body => {
          console.log('Body:', body);
        });
        console.log('==============================================\n');
      }
    });

    // Login first
    await page.goto('http://localhost:5173/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('[TEST] Logged in successfully');

    // Navigate to assets
    await page.click('text=Assets');
    await page.waitForURL('**/assets', { timeout: 10000 });
    console.log('[TEST] On assets page');

    // Click "Add Asset" button
    await page.click('button:has-text("Add")');
    console.log('[TEST] Clicked Add button');

    // Wait for dialog to open
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    console.log('[TEST] Dialog opened');

    // Select client (first available)
    await page.click('[data-testid="client-select"]');
    await page.click('[role="option"]:first-child');
    console.log('[TEST] Selected client');

    // Wait a bit for sites to load
    await page.waitForTimeout(500);

    // Select site (first available)
    await page.click('[data-testid="site-select"]');
    await page.click('[role="option"]:first-child');
    console.log('[TEST] Selected site');

    // Select NVR type
    await page.click('[data-testid="asset-type-select"]');
    await page.click('[role="option"]:has-text("NVR")');
    console.log('[TEST] Selected NVR type');

    // Wait for NVR-specific fields to appear
    await page.waitForTimeout(1000);

    // Fill in WAN IP
    const wanIpField = page.locator('input[name="wan_public_ip"]');
    await wanIpField.fill('213.57.74.60');
    console.log('[TEST] Filled WAN IP');

    // Fill in service port
    const servicePortField = page.locator('input[name="wan_service_port"]');
    await servicePortField.fill('8008');
    console.log('[TEST] Filled service port');

    // Fill in web port
    const webPortField = page.locator('input[name="wan_http_port"]');
    await webPortField.fill('8080');
    console.log('[TEST] Filled web port');

    // Fill in password
    const passwordField = page.locator('input[name="device_password"]');
    await passwordField.fill('Karkum#9a!');
    console.log('[TEST] Filled password');

    // Log the form state before clicking probe
    console.log('\n[TEST] ===== FORM STATE BEFORE PROBE =====');
    console.log('[TEST] WAN IP value:', await wanIpField.inputValue());
    console.log('[TEST] Service Port value:', await servicePortField.inputValue());
    console.log('[TEST] Web Port value:', await webPortField.inputValue());
    console.log('[TEST] Password filled:', (await passwordField.inputValue()).length > 0);
    console.log('[TEST] ========================================\n');

    // Click Probe Device button
    const probeButton = page.locator('button:has-text("Probe")');
    console.log('[TEST] About to click Probe button...');
    await probeButton.click();
    console.log('[TEST] Clicked Probe button');

    // Wait for the request or dialog
    await page.waitForTimeout(5000);

    // Check for any errors on page
    const errorText = await page.locator('.MuiAlert-message').textContent().catch(() => null);
    if (errorText) {
      console.log('[TEST] Error displayed:', errorText);
    }

    console.log('[TEST] Test completed');
  });
});
