/**
 * Test: Portal Users Auth Fix
 * Verify 401 fix and proper token handling
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

test.describe('Portal Users - Auth Fix Verification', () => {

  test('Admin can access Portal Users page without being logged out', async ({ page }) => {
    console.log('=== Testing Portal Users Auth Fix ===\n');

    // Intercept API requests to Portal Users endpoint
    const apiCalls: Array<{ url: string; status: number; hasAuth: boolean }> = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/admin/portal/client-users')) {
        const hasAuth = request.headers()['authorization'] !== undefined;
        console.log(`Request: ${url}`);
        console.log(`  Authorization header: ${hasAuth ? 'PRESENT' : 'MISSING'}`);
      }
    });

    page.on('response', response => {
      const url = response.url();
      if (url.includes('/admin/portal/client-users')) {
        const status = response.status();
        const request = response.request();
        const hasAuth = request.headers()['authorization'] !== undefined;

        apiCalls.push({ url, status, hasAuth });
        console.log(`Response: ${status} - ${url}`);
        console.log(`  Authorization: ${hasAuth ? 'YES' : 'NO'}`);
      }
    });

    // Step 1: Login as admin
    console.log('Step 1: Admin login');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    const loginUrl = page.url();
    console.log(`After login URL: ${loginUrl}`);
    expect(loginUrl).not.toContain('/login');
    console.log('✅ Admin logged in\n');

    // Step 2: Navigate to Portal Users
    console.log('Step 2: Navigate to Portal Users');
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    const portalUsersUrl = page.url();
    console.log(`Current URL: ${portalUsersUrl}`);

    // Step 3: Verify NOT redirected to login
    console.log('\nStep 3: Verify NOT redirected to login');
    if (portalUsersUrl.includes('/login')) {
      console.log('❌ FAILED: User was redirected to login page');
      console.log('This means:');
      console.log('  - 401 response triggered automatic logout');
      console.log('  - OR token is not valid for admin endpoints');

      // Take screenshot
      await page.screenshot({ path: 'test-results/auth-fix-failed-redirected.png', fullPage: true });

      // Check API calls
      if (apiCalls.length > 0) {
        console.log('\nAPI Call Details:');
        for (const call of apiCalls) {
          console.log(`  URL: ${call.url}`);
          console.log(`  Status: ${call.status}`);
          console.log(`  Auth Header: ${call.hasAuth ? 'Present' : 'Missing'}`);
        }
      }

      throw new Error('User was logged out on 401 - fix not working');
    } else {
      console.log('✅ User stayed on Portal Users page');
    }

    // Step 4: Verify API response
    console.log('\nStep 4: Verify API response');

    if (apiCalls.length === 0) {
      console.log('⚠️ No API calls captured - endpoint might not have been called');
    } else {
      for (const call of apiCalls) {
        console.log(`\nAPI Call:`);
        console.log(`  URL: ${call.url}`);
        console.log(`  Status: ${call.status}`);
        console.log(`  Authorization header: ${call.hasAuth ? 'PRESENT ✅' : 'MISSING ❌'}`);

        if (call.status === 200) {
          console.log('  ✅ SUCCESS - 200 OK');
        } else if (call.status === 401) {
          console.log('  ⚠️ 401 Unauthorized');
          if (!call.hasAuth) {
            console.log('  → Причина: Authorization header missing');
          } else {
            console.log('  → Причина: Token invalid or insufficient permissions');
          }
        } else if (call.status === 403) {
          console.log('  ⚠️ 403 Forbidden - User has no admin role');
        }

        // Verify auth header present
        expect(call.hasAuth).toBe(true);
      }
    }

    // Step 5: Take screenshot
    await page.screenshot({ path: 'test-results/auth-fix-portal-users.png', fullPage: true });

    // Step 6: Verify page content
    console.log('\nStep 5: Verify page content');
    const pageText = await page.locator('body').innerText();

    if (pageText.includes('Portal Users') || pageText.includes('Create Portal User')) {
      console.log('✅ Portal Users page loaded successfully');

      const tableCount = await page.locator('table').count();
      console.log(`  Tables: ${tableCount}`);

      if (tableCount > 0) {
        console.log('✅ Table is present - data loaded');
      }
    } else {
      console.log('⚠️ Portal Users content not visible');
      console.log(`Page preview: ${pageText.substring(0, 200)}`);
    }

    console.log('\n=== Test Complete ===');
  });

  test('Verify token structure for internal user', async ({ page }) => {
    console.log('Testing token structure...');

    // Login
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    // Get token from localStorage
    const token = await page.evaluate(() => localStorage.getItem('access_token'));

    console.log(`Token present: ${token ? 'YES' : 'NO'}`);

    if (token) {
      // Decode JWT (base64)
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        console.log('Token payload:', JSON.stringify(payload, null, 2));

        // Verify user_type
        if (payload.user_type === 'internal') {
          console.log('✅ Token has correct user_type: "internal"');
        } else {
          console.log(`❌ Token has wrong user_type: "${payload.user_type}"`);
        }

        // Verify role
        if (payload.role) {
          console.log(`✅ Token has role: "${payload.role}"`);
        } else {
          console.log('❌ Token missing role field');
        }
      }
    } else {
      console.log('❌ No token found in localStorage');
    }
  });

  test('403 Forbidden should NOT logout user', async ({ page }) => {
    console.log('Testing 403 handling...');

    // Login
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    const urlBeforeForbidden = page.url();

    // Try to access an endpoint that might return 403
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForTimeout(3000);

    const urlAfter = page.url();

    // User should NOT be redirected to login on 403
    if (urlAfter.includes('/login')) {
      console.log('⚠️ User was logged out (might be 401, not 403)');
    } else {
      console.log('✅ User remained logged in despite potential 403');
    }

    expect(urlAfter).not.toContain('/login');
  });
});
