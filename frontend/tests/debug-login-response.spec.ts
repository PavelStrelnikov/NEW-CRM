/**
 * Debug: Capture actual login API request/response
 * See what token the backend is creating
 */

import { test, expect } from '@playwright/test';

const PORTAL_USER_EMAIL = 'testadmin@example.com';
const PORTAL_USER_PASSWORD = 'testpass123';

test.describe('Debug Login API', () => {

  test('Capture login request and response body', async ({ page }) => {
    console.log('=== Debug Login API ===\n');

    let loginRequest: any = null;
    let loginResponse: any = null;

    // Intercept login API call
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/portal/auth/login')) {
        console.log('LOGIN REQUEST:');
        console.log(`  URL: ${url}`);
        console.log(`  Method: ${request.method()}`);

        const postData = request.postData();
        if (postData) {
          try {
            const body = JSON.parse(postData);
            console.log(`  Body:`, body);
            loginRequest = body;
          } catch (e) {}
        }
      }
    });

    page.on('response', async response => {
      const url = response.url();
      if (url.includes('/portal/auth/login')) {
        console.log('\nLOGIN RESPONSE:');
        console.log(`  Status: ${response.status()}`);

        if (response.status() === 200) {
          try {
            const body = await response.json();
            console.log(`  Body:`, JSON.stringify(body, null, 2));
            loginResponse = body;

            if (body.access_token) {
              // Decode token
              const parts = body.access_token.split('.');
              if (parts.length === 3) {
                const payload = JSON.parse(atob(parts[1]));
                console.log('\n  Decoded token payload:');
                console.log(JSON.stringify(payload, null, 2));

                console.log('\n  Token fields analysis:');
                console.log(`    user_type: ${payload.user_type || 'MISSING'}`);
                console.log(`    role: ${payload.role || 'MISSING'}`);
                console.log(`    client_id: ${payload.client_id || 'MISSING'}`);
                console.log(`    primary_client_id: ${payload.primary_client_id || 'MISSING'}`);
                console.log(`    allowed_client_ids: ${payload.allowed_client_ids ? `[${payload.allowed_client_ids.length} items]` : 'MISSING'}`);

                if (payload.allowed_client_ids && Array.isArray(payload.allowed_client_ids)) {
                  console.log(`\n  allowed_client_ids details:`);
                  if (payload.allowed_client_ids.length > 0) {
                    payload.allowed_client_ids.forEach((id: string, idx: number) => {
                      console.log(`    ${idx + 1}. ${id}`);
                    });
                  } else {
                    console.log(`    (empty array)`);
                  }
                }
              }
            }
          } catch (e) {
            console.log(`  (Could not parse response body)`);
          }
        } else {
          console.log(`  ERROR: Non-200 status`);
          try {
            const body = await response.json();
            console.log(`  Error body:`, body);
          } catch (e) {}
        }
      }
    });

    // Perform login
    console.log('Initiating login...\n');
    await page.goto('http://127.0.0.1:3000/login');
    await page.waitForLoadState('networkidle');

    await page.locator('input[name="email"], input[type="email"]').first().fill(PORTAL_USER_EMAIL);
    await page.locator('input[name="password"], input[type="password"]').first().fill(PORTAL_USER_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');

    console.log('\n=== Login Complete ===');
    console.log(`Final URL: ${page.url()}`);

    // Verify token in localStorage
    const storedToken = await page.evaluate(() => localStorage.getItem('access_token'));

    if (storedToken) {
      console.log(`\n✅ Token stored in localStorage`);
      console.log(`Length: ${storedToken.length} chars`);

      // Compare with API response token
      if (loginResponse && loginResponse.access_token) {
        if (storedToken === loginResponse.access_token) {
          console.log(`✅ Matches API response token`);
        } else {
          console.log(`⚠️ Different from API response token`);
        }
      }
    } else {
      console.log(`\n❌ No token in localStorage`);
    }

    console.log('\n=== Test Complete ===');
  });

  test('Direct API call to /portal/auth/login', async ({ request }) => {
    console.log('=== Direct API Call Test ===\n');

    const response = await request.post('http://127.0.0.1:3000/api/v1/portal/auth/login', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        email: PORTAL_USER_EMAIL,
        password: PORTAL_USER_PASSWORD
      }
    });

    console.log(`Response status: ${response.status()}`);

    if (response.status() === 200) {
      const body = await response.json();
      console.log('\nResponse body:');
      console.log(JSON.stringify(body, null, 2));

      if (body.access_token) {
        console.log('\nDecoding token...');
        const parts = body.access_token.split('.');

        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

          console.log('\nToken payload:');
          console.log(JSON.stringify(payload, null, 2));

          console.log('\n=== DIAGNOSIS ===');

          if (payload.allowed_client_ids) {
            if (Array.isArray(payload.allowed_client_ids) && payload.allowed_client_ids.length > 0) {
              console.log(`✅ Token HAS allowed_client_ids: ${payload.allowed_client_ids.length} clients`);
              payload.allowed_client_ids.forEach((id: string, idx: number) => {
                console.log(`  ${idx + 1}. ${id}`);
              });
            } else {
              console.log(`⚠️ Token has allowed_client_ids but it's EMPTY array`);
            }
          } else {
            console.log(`❌ Token MISSING allowed_client_ids field`);
          }

          if (payload.primary_client_id) {
            console.log(`✅ Token HAS primary_client_id: ${payload.primary_client_id}`);
          } else {
            console.log(`❌ Token MISSING primary_client_id field`);
          }
        }
      }
    } else {
      console.log(`\n❌ Login failed with status ${response.status()}`);
      const text = await response.text();
      console.log(`Response:`, text);
    }

    console.log('\n=== Test Complete ===');
  });
});
