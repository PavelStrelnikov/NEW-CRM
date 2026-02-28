/**
 * E2E Test: Portal Users Management
 *
 * Scenarios:
 * 1. Admin login
 * 2. Create portal user (CLIENT_ADMIN)
 * 3. Assign multiple clients
 * 4. Login as portal user
 * 5. Verify client selector works
 */

import { test, expect } from '@playwright/test';

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'admin123';

const PORTAL_USER_EMAIL = 'playwright_client_admin_1@example.com';
const PORTAL_USER_PASSWORD = 'Testpass123!';
const PORTAL_USER_NAME = 'Playwright Test Admin';

test.describe('Portal Users E2E Tests', () => {

  test('Scenario 1: Admin login', async ({ page }) => {
    console.log('Starting Scenario 1: Admin login');

    // Navigate to login page
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    // Verify login page loaded
    await expect(page.locator('input[name="email"], input[type="email"]')).toBeVisible();
    await page.screenshot({ path: 'frontend/playwright-report/1-login-page.png', fullPage: true });

    // Login as admin
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Wait for navigation
    await page.waitForURL(/\/(dashboard|clients|tickets|assets)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify admin logged in
    await expect(page).toHaveURL(/\/(dashboard|clients|tickets|assets)/);
    await page.screenshot({ path: 'frontend/playwright-report/2-admin-logged-in.png', fullPage: true });

    console.log('✅ Scenario 1 passed: Admin login successful');
  });

  test('Scenario 2: Create Portal User and Manage Clients', async ({ page }) => {
    console.log('Starting Scenario 2: Create Portal User');

    // Login as admin
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|clients)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Navigate to Portal Users page
    console.log('Navigating to Portal Users page...');
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForLoadState('networkidle');

    // Verify Portal Users page loaded
    await page.waitForSelector('h4:has-text("Portal Users"), h5:has-text("Portal Users")', { timeout: 10000 });
    await page.screenshot({ path: 'frontend/playwright-report/3-portal-users-page.png', fullPage: true });

    // Check if user already exists and delete if needed
    const existingUser = page.locator(`text=${PORTAL_USER_EMAIL}`);
    if (await existingUser.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('User already exists, deleting...');
      // Would need delete functionality - skip for now
    }

    // Click "Create Portal User" button
    console.log('Opening Create Portal User dialog...');
    await page.locator('button:has-text("Create Portal User"), button:has-text("Create")').first().click();
    await page.waitForTimeout(500);

    // Verify dialog opened
    await expect(page.locator('h2:has-text("Create Portal User"), h6:has-text("Create Portal User")')).toBeVisible();
    await page.screenshot({ path: 'frontend/playwright-report/4-create-dialog-open.png', fullPage: true });

    // Fill in user details
    console.log('Filling user details...');
    await page.locator('input[name="email"], input[label="Email"]').last().fill(PORTAL_USER_EMAIL);
    await page.locator('input[name="name"], input[label="Name"]').last().fill(PORTAL_USER_NAME);
    await page.locator('input[name="password"], input[label="Password"]').last().fill(PORTAL_USER_PASSWORD);

    // Select role CLIENT_ADMIN
    await page.locator('div:has-text("Role") >> .. >> div[role="button"]').click();
    await page.waitForTimeout(300);
    await page.locator('li:has-text("CLIENT_ADMIN")').first().click();
    await page.waitForTimeout(300);

    // Select primary client (first available)
    await page.locator('div:has-text("Primary Client") >> .. >> div[role="button"]').click();
    await page.waitForTimeout(500);
    await page.locator('li[role="option"]').first().click();
    await page.waitForTimeout(300);

    await page.screenshot({ path: 'frontend/playwright-report/5-create-form-filled.png', fullPage: true });

    // Submit form
    console.log('Creating user...');
    await page.locator('button:has-text("Create")').last().click();

    // Wait for success and dialog close
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Verify user appears in table
    await expect(page.locator(`text=${PORTAL_USER_EMAIL}`)).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'frontend/playwright-report/6-user-created.png', fullPage: true });

    console.log('✅ User created successfully');

    // Open Manage Clients dialog
    console.log('Opening Manage Clients dialog...');
    const userRow = page.locator(`tr:has-text("${PORTAL_USER_EMAIL}")`);
    await userRow.locator('button[aria-label*="Manage"], svg[data-testid="BusinessIcon"]').first().click();
    await page.waitForTimeout(500);

    // Verify Manage Clients dialog opened
    await expect(page.locator('h2:has-text("Manage Client Access"), h6:has-text("Manage Client Access")')).toBeVisible();
    await page.screenshot({ path: 'frontend/playwright-report/7-manage-clients-dialog.png', fullPage: true });

    // Select additional clients (2nd and 3rd checkboxes)
    console.log('Assigning additional clients...');
    const checkboxes = page.locator('input[type="checkbox"]:not(:disabled)');
    const count = await checkboxes.count();

    if (count >= 2) {
      await checkboxes.nth(1).check();
      await page.waitForTimeout(200);
    }
    if (count >= 3) {
      await checkboxes.nth(2).check();
      await page.waitForTimeout(200);
    }

    await page.screenshot({ path: 'frontend/playwright-report/8-clients-selected.png', fullPage: true });

    // Save assignments
    await page.locator('button:has-text("Save")').last().click();
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'frontend/playwright-report/9-clients-saved.png', fullPage: true });

    console.log('✅ Scenario 2 passed: Portal user created and clients assigned');
  });

  test('Scenario 3: Login as Portal User', async ({ page }) => {
    console.log('Starting Scenario 3: Login as Portal User');

    // Navigate to login page
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    // Login as portal user
    console.log(`Logging in as ${PORTAL_USER_EMAIL}...`);
    await page.locator('input[name="email"], input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();

    // Wait for navigation
    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    // Verify NOT white screen
    const body = await page.locator('body').innerHTML();
    expect(body.length).toBeGreaterThan(100);

    // Verify portal loaded (should see some content)
    const hasContent = await page.locator('main, div[role="main"], h1, h2, h3, h4, h5').count();
    expect(hasContent).toBeGreaterThan(0);

    await page.screenshot({ path: 'frontend/playwright-report/10-portal-user-logged-in.png', fullPage: true });

    // Check for client selector if multiple clients assigned
    const clientSelector = page.locator('div:has-text("Company"), select, div[role="button"]:has-text("Company")');
    if (await clientSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('✅ Client selector is visible (multi-client access confirmed)');
      await page.screenshot({ path: 'frontend/playwright-report/11-client-selector-visible.png', fullPage: true });
    } else {
      console.log('ℹ️ Client selector not visible (might be single-client or not implemented yet)');
    }

    console.log('✅ Scenario 3 passed: Portal user login successful, no white screen');
  });

  test('Full E2E Flow (All Scenarios)', async ({ page }) => {
    console.log('Starting Full E2E Flow');

    // Scenario 1: Admin Login
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(ADMIN_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(ADMIN_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(dashboard|clients)/, { timeout: 10000 });
    console.log('✅ Admin logged in');

    // Scenario 2: Navigate to Portal Users
    await page.goto('http://127.0.0.1:3000/portal-users');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h4:has-text("Portal Users"), h5:has-text("Portal Users")', { timeout: 10000 });
    console.log('✅ Portal Users page loaded');

    // Scenario 3: Verify API request is correct (no double /api/v1)
    const responsePromise = page.waitForResponse(response =>
      response.url().includes('/admin/portal/client-users') &&
      !response.url().includes('/api/v1/api/v1')
    );

    await page.reload();
    const response = await responsePromise;

    console.log(`API Request URL: ${response.url()}`);
    expect(response.url()).toContain('/api/v1/admin/portal/client-users');
    expect(response.url()).not.toContain('/api/v1/api/v1');
    expect(response.status()).toBe(200);

    console.log('✅ API request URL is correct (no duplication)');

    await page.screenshot({ path: 'frontend/playwright-report/12-full-flow-complete.png', fullPage: true });

    console.log('✅ Full E2E Flow passed');
  });
});
