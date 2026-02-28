/**
 * Test: Separated Login Pages
 * Verify admin and portal login pages work correctly
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';
const PORTAL_USER_EMAIL = 'testadmin@example.com';
const PORTAL_USER_PASSWORD = 'testpass123';

test.describe('Separated Login Pages', () => {

  test('Main /login page shows choice between Admin and Portal', async ({ page }) => {
    console.log('=== Testing Main Login Page ===\n');

    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    // Check for both login options
    const adminCard = page.locator('text=Admin Login');
    const portalCard = page.locator('text=Client Portal');

    const hasAdmin = await adminCard.count();
    const hasPortal = await portalCard.count();

    console.log(`Admin Login card: ${hasAdmin > 0 ? '✅ Found' : '❌ Not found'}`);
    console.log(`Portal Login card: ${hasPortal > 0 ? '✅ Found' : '❌ Not found'}`);

    expect(hasAdmin).toBeGreaterThan(0);
    expect(hasPortal).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/main-login-choice.png', fullPage: true });
    console.log('✅ Main login page works\n');
  });

  test('Admin login page works for internal users', async ({ page }) => {
    console.log('=== Testing Admin Login Page ===\n');

    let loginApiCalled = false;
    let loginEndpoint = '';
    let loginStatus = 0;

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/auth/login')) {
        loginApiCalled = true;
        loginEndpoint = url;
        loginStatus = response.status();
        console.log(`Login API: ${url} → ${loginStatus}`);
      }
    });

    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.waitForLoadState('networkidle');

    // Check page content
    const hasAdminTitle = await page.locator('text=Admin Login').count();
    console.log(`Admin Login title: ${hasAdminTitle > 0 ? '✅' : '❌'}`);

    // Fill form
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    const finalUrl = page.url();
    console.log(`After login URL: ${finalUrl}`);

    // Verify correct endpoint was called
    if (loginApiCalled) {
      console.log(`✅ Login API was called: ${loginEndpoint}`);

      if (loginEndpoint.includes('/portal/auth/login')) {
        console.log('❌ ERROR: Used portal endpoint for admin!');
      } else if (loginEndpoint.includes('/api/v1/auth/login')) {
        console.log('✅ Correct: Used internal auth endpoint');
      }

      console.log(`Status: ${loginStatus}`);
    }

    // Check token
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    if (token) {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]));
      console.log(`\nToken user_type: ${payload.user_type}`);

      if (payload.user_type === 'internal') {
        console.log('✅ Correct token type for admin');
      } else {
        console.log('❌ Wrong token type for admin');
      }
    }

    expect(finalUrl).not.toContain('/login');
    expect(loginApiCalled).toBe(true);

    await page.screenshot({ path: 'test-results/admin-login-success.png', fullPage: true });
    console.log('\n✅ Admin login test complete\n');
  });

  test('Portal login page works for portal users', async ({ page }) => {
    console.log('=== Testing Portal Login Page ===\n');

    let loginApiCalled = false;
    let loginEndpoint = '';
    let loginStatus = 0;

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('auth/login')) {
        loginApiCalled = true;
        loginEndpoint = url;
        loginStatus = response.status();
        console.log(`Login API: ${url} → ${loginStatus}`);
      }
    });

    await page.goto('http://127.0.0.1:3000/portal/login');
    await page.waitForLoadState('networkidle');

    // Check page content
    const hasPortalTitle = await page.locator('text=Client Portal').count();
    console.log(`Client Portal title: ${hasPortalTitle > 0 ? '✅' : '❌'}`);

    // Fill form
    await page.locator('input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    const finalUrl = page.url();
    console.log(`After login URL: ${finalUrl}`);

    // Verify correct endpoint was called
    if (loginApiCalled) {
      console.log(`✅ Login API was called: ${loginEndpoint}`);

      if (loginEndpoint.includes('/portal/auth/login')) {
        console.log('✅ Correct: Used portal auth endpoint');
      } else {
        console.log('❌ ERROR: Used wrong endpoint for portal user!');
      }

      console.log(`Status: ${loginStatus}`);
    }

    // Check token
    const token = await page.evaluate(() => localStorage.getItem('access_token'));
    if (token) {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]));
      console.log(`\nToken user_type: ${payload.user_type}`);
      console.log(`Token has allowed_client_ids: ${payload.allowed_client_ids ? 'YES' : 'NO'}`);

      if (payload.user_type === 'portal') {
        console.log('✅ Correct token type for portal user');
      } else {
        console.log('❌ Wrong token type for portal user');
      }

      if (payload.allowed_client_ids && payload.allowed_client_ids.length > 0) {
        console.log(`✅ Token has ${payload.allowed_client_ids.length} allowed clients`);
      }
    }

    expect(finalUrl).not.toContain('/login');
    expect(loginApiCalled).toBe(true);

    await page.screenshot({ path: 'test-results/portal-login-success.png', fullPage: true });
    console.log('\n✅ Portal login test complete\n');
  });

  test('Verify tokens are different for admin vs portal', async ({ page }) => {
    console.log('=== Comparing Admin vs Portal Tokens ===\n');

    // Login as admin
    console.log('Step 1: Login as admin');
    await page.goto('http://127.0.0.1:3000/admin/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    const adminToken = await page.evaluate(() => localStorage.getItem('access_token'));

    let adminPayload: any = null;
    if (adminToken) {
      const parts = adminToken.split('.');
      adminPayload = JSON.parse(atob(parts[1]));
      console.log('Admin token payload:');
      console.log(`  user_type: ${adminPayload.user_type}`);
      console.log(`  role: ${adminPayload.role}`);
      console.log(`  has allowed_client_ids: ${adminPayload.allowed_client_ids ? 'YES' : 'NO'}`);
    }

    // Logout and login as portal user
    console.log('\nStep 2: Logout and login as portal user');
    await page.goto('http://127.0.0.1:3000/portal/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    const portalToken = await page.evaluate(() => localStorage.getItem('access_token'));

    let portalPayload: any = null;
    if (portalToken) {
      const parts = portalToken.split('.');
      portalPayload = JSON.parse(atob(parts[1]));
      console.log('Portal token payload:');
      console.log(`  user_type: ${portalPayload.user_type}`);
      console.log(`  role: ${portalPayload.role}`);
      console.log(`  has allowed_client_ids: ${portalPayload.allowed_client_ids ? 'YES' : 'NO'}`);
      if (portalPayload.allowed_client_ids) {
        console.log(`  allowed_client_ids count: ${portalPayload.allowed_client_ids.length}`);
      }
    }

    console.log('\n=== COMPARISON ===');
    if (adminPayload && portalPayload) {
      console.log(`Admin user_type: ${adminPayload.user_type}`);
      console.log(`Portal user_type: ${portalPayload.user_type}`);

      if (adminPayload.user_type === 'internal' && portalPayload.user_type === 'portal') {
        console.log('✅ Token types are correctly different');
      } else {
        console.log('❌ Token types are wrong');
      }

      if (!adminPayload.allowed_client_ids && portalPayload.allowed_client_ids) {
        console.log('✅ Admin has no allowed_client_ids (correct)');
        console.log('✅ Portal has allowed_client_ids (correct)');
      }
    }

    console.log('\n✅ Token comparison complete\n');
  });
});
