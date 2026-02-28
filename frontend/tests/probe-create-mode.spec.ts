import { test, expect } from '@playwright/test';

test.describe('Probe Device in CREATE mode', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for navigation to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('should send correct data when probing new NVR device', async ({ page }) => {
    // Navigate to assets
    await page.click('text=Assets');
    await page.waitForURL('**/assets');

    // Click "Add Asset" button
    await page.click('button:has-text("Add")');

    // Wait for dialog to open
    await page.waitForSelector('[role="dialog"]');

    // Select client (first available)
    await page.click('[data-testid="client-select"]');
    await page.click('[role="option"]:first-child');

    // Select site (first available)
    await page.click('[data-testid="site-select"]');
    await page.click('[role="option"]:first-child');

    // Select NVR type
    await page.click('[data-testid="asset-type-select"]');
    await page.click('[role="option"]:has-text("NVR")');

    // Fill in WAN IP
    await page.fill('input[name="wan_public_ip"]', '213.57.74.60');

    // Fill in service port
    await page.fill('input[name="wan_service_port"]', '8008');

    // Fill in web port
    await page.fill('input[name="wan_http_port"]', '8080');

    // Fill in password
    await page.fill('input[name="device_password"]', 'Karkum#9a!');

    // Intercept API call to see what's being sent
    const probePromise = page.waitForRequest(req =>
      req.url().includes('/hikvision/probe') && req.method() === 'POST'
    );

    // Click Probe Device button
    await page.click('button:has-text("Probe")');

    // Wait for API request
    const probeRequest = await probePromise;
    const requestBody = probeRequest.postDataJSON();

    console.log('Probe request body:', JSON.stringify(requestBody, null, 2));

    // Verify request body has correct values
    expect(requestBody.host).toBe('213.57.74.60');
    expect(requestBody.port).toBe(8008);
    expect(requestBody.web_port).toBe(8080);
    expect(requestBody.username).toBe('admin');
    expect(requestBody.password).toBe('Karkum#9a!');
    expect(typeof requestBody.port).toBe('number');
    expect(typeof requestBody.web_port).toBe('number');
  });

  test('should show error dialog for missing fields', async ({ page }) => {
    // Navigate to assets
    await page.click('text=Assets');
    await page.waitForURL('**/assets');

    // Click "Add Asset" button
    await page.click('button:has-text("Add")');

    // Wait for dialog to open
    await page.waitForSelector('[role="dialog"]');

    // Select client
    await page.click('[data-testid="client-select"]');
    await page.click('[role="option"]:first-child');

    // Select site
    await page.click('[data-testid="site-select"]');
    await page.click('[role="option"]:first-child');

    // Select NVR type
    await page.click('[data-testid="asset-type-select"]');
    await page.click('[role="option"]:has-text("NVR")');

    // Don't fill IP or password - try to probe
    await page.click('button:has-text("Probe")');

    // Should show validation error
    await expect(page.locator('text=Missing required fields')).toBeVisible({ timeout: 5000 });
  });
});
