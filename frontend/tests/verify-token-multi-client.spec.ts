/**
 * Verify Token Contains allowed_client_ids
 * This tests if portal login creates token with multi-client data
 */

import { test, expect } from '@playwright/test';

const PORTAL_USER_EMAIL = 'testadmin@example.com';
const PORTAL_USER_PASSWORD = 'testpass123';

test.describe('Token Structure Verification', () => {

  test('Portal user token should contain allowed_client_ids', async ({ page }) => {
    console.log('=== Verifying Token Structure ===\n');

    // Step 1: Login as portal user
    console.log('Step 1: Login as portal user');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[name="email"], input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(3000);
    await page.waitForLoadState('networkidle');

    const currentUrl = page.url();
    console.log(`After login URL: ${currentUrl}`);

    if (currentUrl.includes('/login')) {
      console.log('❌ Still on login page - login failed');
      return;
    }

    console.log('✅ Login successful\n');

    // Step 2: Get token from localStorage
    console.log('Step 2: Extract and decode JWT token');
    const token = await page.evaluate(() => localStorage.getItem('access_token'));

    if (!token) {
      console.log('❌ No access token found in localStorage');
      return;
    }

    console.log(`Token length: ${token.length} characters`);

    // Decode JWT payload (base64)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('❌ Invalid JWT structure (should have 3 parts)');
      return;
    }

    const payload = JSON.parse(atob(parts[1]));

    console.log('\n=== Token Payload ===');
    console.log(JSON.stringify(payload, null, 2));

    // Step 3: Analyze token fields
    console.log('\n=== Field Analysis ===');

    console.log(`✓ user_type: ${payload.user_type || 'MISSING'}`);
    console.log(`✓ role: ${payload.role || 'MISSING'}`);
    console.log(`✓ client_id (active): ${payload.client_id || 'MISSING'}`);

    // Check for primary_client_id
    if (payload.primary_client_id) {
      console.log(`✅ primary_client_id: ${payload.primary_client_id}`);
    } else {
      console.log(`❌ primary_client_id: MISSING`);
    }

    // Check for allowed_client_ids
    if (payload.allowed_client_ids) {
      console.log(`✅ allowed_client_ids: ${Array.isArray(payload.allowed_client_ids) ? '[array]' : '[not array]'}`);

      if (Array.isArray(payload.allowed_client_ids)) {
        console.log(`   Length: ${payload.allowed_client_ids.length}`);

        if (payload.allowed_client_ids.length > 0) {
          console.log('   Clients:');
          payload.allowed_client_ids.forEach((id: string, idx: number) => {
            console.log(`     ${idx + 1}. ${id}`);
          });

          if (payload.allowed_client_ids.length > 1) {
            console.log(`\n✅ MULTI-CLIENT ACCESS: User has ${payload.allowed_client_ids.length} clients`);
          } else {
            console.log(`\n⚠️ SINGLE-CLIENT: User has only 1 client`);
          }
        } else {
          console.log(`   ⚠️ Array is empty`);
        }
      }
    } else {
      console.log(`❌ allowed_client_ids: MISSING`);
    }

    // Step 4: Call /me endpoint
    console.log('\n=== /me Endpoint Check ===');
    const meResponse = await page.request.get('http://127.0.0.1:3000/api/v1/portal/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log(`/me status: ${meResponse.status()}`);

    if (meResponse.status() === 200) {
      const meData = await meResponse.json();
      console.log('\n/me response:');
      console.log(JSON.stringify(meData, null, 2));

      // Check if /me has allowed_client_ids
      if (meData.allowed_client_ids) {
        console.log(`\n✅ /me has allowed_client_ids: ${meData.allowed_client_ids.length} clients`);
      } else {
        console.log(`\n❌ /me missing allowed_client_ids`);
      }
    } else {
      console.log(`❌ /me failed with status ${meResponse.status()}`);
    }

    // Step 5: Conclusion
    console.log('\n=== DIAGNOSIS ===');

    const hasAllowedClientIds = payload.allowed_client_ids && Array.isArray(payload.allowed_client_ids);
    const hasMultipleClients = hasAllowedClientIds && payload.allowed_client_ids.length > 1;

    if (hasMultipleClients) {
      console.log('✅ Token correctly contains allowed_client_ids with multiple clients');
      console.log('✅ Multi-client access is WORKING as designed');
    } else if (hasAllowedClientIds && payload.allowed_client_ids.length === 1) {
      console.log('⚠️ Token has allowed_client_ids but only 1 client');
      console.log('   This means:');
      console.log('   - DB has multiple clients assigned (we verified this earlier)');
      console.log('   - BUT login endpoint is not populating token correctly');
      console.log('   → FIX NEEDED: portal_auth.py login endpoint');
    } else {
      console.log('❌ Token does NOT contain allowed_client_ids');
      console.log('   This means:');
      console.log('   - DB has multiple clients assigned (we verified this earlier)');
      console.log('   - BUT login endpoint is not populating token at all');
      console.log('   → FIX NEEDED: portal_auth.py login endpoint must query ClientUserClient table');
    }

    console.log('\n=== Test Complete ===');
  });

  test('Compare DB assignments vs token payload', async ({ page, request }) => {
    console.log('=== DB vs Token Comparison ===\n');

    // Login as admin to check DB
    console.log('Step 1: Check DB assignments (as admin)');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill('admin@example.com');
    await page.locator('input[name="password"], input[type="password"]').first().fill('admin123');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(2000);

    const adminToken = await page.evaluate(() => localStorage.getItem('access_token'));

    // Get portal user list
    const usersResponse = await request.get('http://127.0.0.1:3000/api/v1/admin/portal/client-users?page_size=100', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const usersData = await usersResponse.json();
    const testUser = usersData.items.find((u: any) => u.email === PORTAL_USER_EMAIL);

    if (!testUser) {
      console.log(`❌ User ${PORTAL_USER_EMAIL} not found`);
      return;
    }

    console.log(`Found user: ${testUser.email}`);
    console.log(`User ID: ${testUser.id}`);

    // Get assignments from DB
    const assignmentsResponse = await request.get(`http://127.0.0.1:3000/api/v1/admin/portal/client-users/${testUser.id}/clients`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const assignmentsData = await assignmentsResponse.json();
    const dbClientIds = assignmentsData.assigned_client_ids || [];

    console.log(`\nDB assignments: ${dbClientIds.length} clients`);
    dbClientIds.forEach((id: string, idx: number) => {
      console.log(`  ${idx + 1}. ${id}`);
    });

    // Now login as portal user
    console.log('\nStep 2: Login as portal user and get token');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');
    await page.locator('input[name="email"], input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);

    const portalToken = await page.evaluate(() => localStorage.getItem('access_token'));

    if (!portalToken) {
      console.log('❌ No portal token');
      return;
    }

    const parts = portalToken.split('.');
    const payload = JSON.parse(atob(parts[1]));

    const tokenClientIds = payload.allowed_client_ids || [];

    console.log(`\nToken allowed_client_ids: ${tokenClientIds.length} clients`);
    if (tokenClientIds.length > 0) {
      tokenClientIds.forEach((id: string, idx: number) => {
        console.log(`  ${idx + 1}. ${id}`);
      });
    } else {
      console.log('  (empty or missing)');
    }

    // Compare
    console.log('\n=== COMPARISON ===');
    console.log(`DB has: ${dbClientIds.length} clients`);
    console.log(`Token has: ${tokenClientIds.length} clients`);

    if (dbClientIds.length === tokenClientIds.length) {
      console.log('✅ Count matches');

      // Check if all DB clients are in token
      const allMatch = dbClientIds.every((id: string) => tokenClientIds.includes(id));
      if (allMatch) {
        console.log('✅ All DB clients are in token - WORKING CORRECTLY');
      } else {
        console.log('⚠️ Count matches but some clients differ');
      }
    } else {
      console.log('❌ Count MISMATCH');
      console.log(`\nMissing in token: ${dbClientIds.length - tokenClientIds.length} client(s)`);

      console.log('\n→ DIAGNOSIS: Login endpoint is not querying ClientUserClient table');
      console.log('→ FIX NEEDED: backend/app/api/portal_auth.py login endpoint');
    }

    console.log('\n=== Test Complete ===');
  });
});
