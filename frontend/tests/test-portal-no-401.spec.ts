/**
 * Test: Portal User Should Not Get 401 on Portal Pages
 * Verify portal user uses portal endpoints and doesn't call admin endpoints
 */

import { test, expect } from '@playwright/test';

const PORTAL_USER_EMAIL = 'testadmin@example.com';
const PORTAL_USER_PASSWORD = 'testpass123';

test.describe('Portal User - No 401 Errors', () => {

  test('Portal user login and page load should not trigger 401', async ({ page }) => {
    console.log('=== Testing Portal User Access ===\n');

    const apiCalls: Array<{ method: string; url: string; status: number }> = [];

    // Track all API calls
    page.on('response', response => {
      const url = response.url();
      if (url.includes('/api/v1/')) {
        apiCalls.push({
          method: response.request().method(),
          url,
          status: response.status()
        });
      }
    });

    // Login as portal user
    console.log('Step 1: Login as portal user');
    await page.goto('http://127.0.0.1:3000/portal/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    console.log(`After login URL: ${currentUrl}`);

    // Analyze API calls
    console.log('\n=== API Calls Analysis ===\n');

    const portalCalls = apiCalls.filter(call => call.url.includes('/portal/'));
    const adminCalls = apiCalls.filter(call => call.url.includes('/clients') && !call.url.includes('/portal/'));
    const errors401 = apiCalls.filter(call => call.status === 401);
    const errors403 = apiCalls.filter(call => call.status === 403);

    console.log(`Total API calls: ${apiCalls.length}`);
    console.log(`Portal endpoint calls: ${portalCalls.length}`);
    console.log(`Admin endpoint calls (should be 0): ${adminCalls.length}`);
    console.log(`401 errors (should be 0): ${errors401.length}`);
    console.log(`403 errors (should be 0): ${errors403.length}`);

    console.log('\n=== Portal Endpoints Called ===');
    portalCalls.forEach(call => {
      const emoji = call.status === 200 ? '✅' : '❌';
      console.log(`${emoji} ${call.method} ${call.url} → ${call.status}`);
    });

    if (adminCalls.length > 0) {
      console.log('\n❌ PROBLEM: Admin endpoints called from portal:');
      adminCalls.forEach(call => {
        console.log(`  ${call.method} ${call.url} → ${call.status}`);
      });
    } else {
      console.log('\n✅ Good: No admin endpoints called from portal');
    }

    if (errors401.length > 0) {
      console.log('\n❌ PROBLEM: 401 errors detected:');
      errors401.forEach(call => {
        console.log(`  ${call.method} ${call.url} → ${call.status}`);
      });
    } else {
      console.log('\n✅ Good: No 401 errors');
    }

    // Verify key expectations
    expect(errors401.length).toBe(0); // No 401 errors
    expect(adminCalls.length).toBe(0); // No calls to admin endpoints
    expect(currentUrl).not.toContain('/login'); // Not kicked back to login

    // Verify portal endpoints work
    const portalAuthMe = apiCalls.find(call =>
      call.url.includes('/portal/auth/me') && call.method === 'GET'
    );

    if (portalAuthMe) {
      console.log(`\n✅ /portal/auth/me called: ${portalAuthMe.status}`);
      expect(portalAuthMe.status).toBe(200);
    }

    const portalClients = apiCalls.find(call =>
      call.url.includes('/portal/clients') && call.method === 'GET'
    );

    if (portalClients) {
      console.log(`✅ /portal/clients called: ${portalClients.status}`);
      expect(portalClients.status).toBe(200);
    } else {
      console.log(`⚠️ /portal/clients not called yet (might load later)`);
    }

    await page.screenshot({ path: 'test-results/portal-user-no-401.png', fullPage: true });
    console.log('\n✅ Test complete\n');
  });

  test('Verify portal endpoints exist and return correct data', async ({ page, request }) => {
    console.log('=== Testing Portal Endpoints Directly ===\n');

    // Login to get token
    await page.goto('http://127.0.0.1:3000/portal/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    const token = await page.evaluate(() => localStorage.getItem('access_token'));

    if (!token) {
      throw new Error('No token found after login');
    }

    // Test /portal/clients
    console.log('Testing GET /api/v1/portal/clients');
    const clientsResponse = await request.get('http://127.0.0.1:3000/api/v1/portal/clients', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`Status: ${clientsResponse.status()}`);

    if (clientsResponse.status() === 200) {
      const data = await clientsResponse.json();
      console.log(`✅ Success - Returned ${data.items?.length || 0} clients`);
      console.log(`Total: ${data.total || 0}`);

      if (data.items && data.items.length > 0) {
        console.log('\nClients:');
        data.items.forEach((client: any, idx: number) => {
          const isPrimary = client.is_primary ? '(Primary)' : '';
          console.log(`  ${idx + 1}. ${client.name} ${isPrimary}`);
        });
      }

      expect(data.items).toBeDefined();
      expect(data.total).toBeGreaterThan(0);
    } else {
      console.log(`❌ Failed with status ${clientsResponse.status()}`);
      const errorText = await clientsResponse.text();
      console.log(`Error: ${errorText}`);
    }

    expect(clientsResponse.status()).toBe(200);

    // Test /portal/auth/me
    console.log('\nTesting GET /api/v1/portal/auth/me');
    const meResponse = await request.get('http://127.0.0.1:3000/api/v1/portal/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    console.log(`Status: ${meResponse.status()}`);

    if (meResponse.status() === 200) {
      const userData = await meResponse.json();
      console.log(`✅ User: ${userData.name || userData.email}`);
      console.log(`Role: ${userData.role}`);
      console.log(`Active client: ${userData.client_id}`);
      console.log(`Primary client: ${userData.primary_client_id}`);
      console.log(`Allowed clients: ${userData.allowed_client_ids?.length || 0}`);

      expect(userData.allowed_client_ids).toBeDefined();
    }

    expect(meResponse.status()).toBe(200);

    console.log('\n✅ All portal endpoints working\n');
  });
});
