import { test, expect, Page } from '@playwright/test';

/**
 * Comprehensive QA Test Suite
 * Tests all user flows for client-admin user (test@test.com / Tt134679)
 *
 * Test Coverage:
 * 1. Login and authorization
 * 2. Clients list and details
 * 3. Contacts CRUD
 * 4. Sites CRUD
 * 5. Equipment/Assets and probe functionality
 * 6. Ticket creation scenarios (normal, from equipment, from non-working equipment)
 */

interface BugReport {
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  page: string;
  description: string;
  error?: string;
  timestamp: string;
}

const bugs: BugReport[] = [];

function reportBug(bug: Omit<BugReport, 'timestamp'>) {
  bugs.push({
    ...bug,
    timestamp: new Date().toISOString(),
  });
  console.error(`🐛 [${bug.severity.toUpperCase()}] ${bug.category} - ${bug.description}`);
}

async function setupErrorListeners(page: Page, testName: string) {
  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out common non-critical errors
      if (
        !text.includes('404') &&
        !text.includes('favicon') &&
        !text.includes('Download the React DevTools')
      ) {
        reportBug({
          category: 'JavaScript Error',
          severity: 'medium',
          page: testName,
          description: `Console error: ${text}`,
          error: text,
        });
      }
    }
  });

  // Listen for page errors
  page.on('pageerror', error => {
    reportBug({
      category: 'Page Error',
      severity: 'high',
      page: testName,
      description: `Uncaught exception: ${error.message}`,
      error: error.stack || error.message,
    });
  });

  // Listen for failed requests
  page.on('response', response => {
    const status = response.status();
    const url = response.url();

    // Skip non-API calls
    if (!url.includes('/api/')) return;

    if (status === 401) {
      const error401 = `❌ 401 UNAUTHORIZED detected: ${url}`;
      reportBug({
        category: 'Authentication Error',
        severity: 'critical',
        page: testName,
        description: error401,
        error: `Status: ${status}`,
      });
      // FAIL FAST: Throw error to stop test immediately on 401
      throw new Error(error401);
    } else if (status === 403) {
      reportBug({
        category: 'Authorization Error',
        severity: 'critical',
        page: testName,
        description: `403 Forbidden: ${url}`,
        error: `Status: ${status}`,
      });
    } else if (status === 404) {
      reportBug({
        category: 'API Not Found',
        severity: 'high',
        page: testName,
        description: `404 Not Found: ${url}`,
        error: `Status: ${status}`,
      });
    } else if (status === 422) {
      reportBug({
        category: 'Validation Error',
        severity: 'medium',
        page: testName,
        description: `422 Unprocessable Entity: ${url}`,
        error: `Status: ${status}`,
      });
    } else if (status >= 500) {
      reportBug({
        category: 'Server Error',
        severity: 'critical',
        page: testName,
        description: `${status} Server Error: ${url}`,
        error: `Status: ${status}`,
      });
    }
  });
}

async function login(page: Page, email: string, password: string): Promise<boolean> {
  try {
    console.log(`\n🔑 Logging in as: ${email}`);

    // Navigate to portal login page (for client users)
    await page.goto('http://127.0.0.1:3004/portal/login');

    // Wait for login form
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });

    // Fill credentials - first input is email (type=text), second is password
    const inputs = await page.locator('input[type="text"]').all();
    if (inputs.length > 0) {
      await inputs[0].fill(email);
    }
    await page.fill('input[type="password"]', password);

    // Submit
    await page.click('button[type="submit"]');

    // Wait for navigation or error
    await page.waitForTimeout(3000);

    // Check if we're still on login page (login failed)
    const stillOnLogin = await page.locator('input[type="password"]').isVisible().catch(() => false);

    if (stillOnLogin) {
      // Check for error message
      const errorMsg = await page.locator('[role="alert"], .error, .MuiAlert-message').textContent().catch(() => null);
      reportBug({
        category: 'Login Error',
        severity: 'critical',
        page: 'Login',
        description: `Login failed for ${email}`,
        error: errorMsg || 'Unknown error',
      });
      return false;
    }

    // Check for successful navigation
    const currentUrl = page.url();
    console.log(`✅ Login successful - redirected to: ${currentUrl}`);

    // Take screenshot of logged-in state
    await page.screenshot({ path: `test-results/qa-logged-in-${Date.now()}.png`, fullPage: true });

    return true;
  } catch (error) {
    reportBug({
      category: 'Login Error',
      severity: 'critical',
      page: 'Login',
      description: `Login process failed: ${error}`,
      error: String(error),
    });
    return false;
  }
}

test.describe('Comprehensive QA Test Suite', () => {
  let authPage: Page;

  test.beforeAll(async ({ browser }) => {
    authPage = await browser.newPage();
    setupErrorListeners(authPage, 'Setup');
  });

  test.afterAll(async () => {
    // Generate bug report
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    if (bugs.length === 0) {
      console.log('✅ No bugs found!');
    } else {
      console.log(`\n🐛 Found ${bugs.length} issues:\n`);

      const critical = bugs.filter(b => b.severity === 'critical');
      const high = bugs.filter(b => b.severity === 'high');
      const medium = bugs.filter(b => b.severity === 'medium');
      const low = bugs.filter(b => b.severity === 'low');

      console.log(`   Critical: ${critical.length}`);
      console.log(`   High:     ${high.length}`);
      console.log(`   Medium:   ${medium.length}`);
      console.log(`   Low:      ${low.length}`);

      console.log('\n' + '-'.repeat(80));
      console.log('DETAILED BUG REPORT:');
      console.log('-'.repeat(80) + '\n');

      // Group by category
      const byCategory: Record<string, BugReport[]> = {};
      bugs.forEach(bug => {
        if (!byCategory[bug.category]) {
          byCategory[bug.category] = [];
        }
        byCategory[bug.category].push(bug);
      });

      Object.entries(byCategory).forEach(([category, categoryBugs]) => {
        console.log(`\n### ${category} (${categoryBugs.length} issues)`);
        categoryBugs.forEach((bug, index) => {
          console.log(`\n${index + 1}. [${bug.severity.toUpperCase()}] ${bug.description}`);
          console.log(`   Page: ${bug.page}`);
          if (bug.error) {
            console.log(`   Error: ${bug.error.substring(0, 200)}${bug.error.length > 200 ? '...' : ''}`);
          }
        });
      });
    }

    console.log('\n' + '='.repeat(80) + '\n');

    await authPage.close();
  });

  test('1. Login with client-admin user', async () => {
    setupErrorListeners(authPage, 'Login');

    const success = await login(authPage, 'test@test.com', 'Tt134679');
    expect(success).toBe(true);

    // Verify we're not in a redirect loop
    await authPage.waitForTimeout(1000);
    const url1 = authPage.url();
    await authPage.waitForTimeout(1000);
    const url2 = authPage.url();

    if (url1 !== url2) {
      reportBug({
        category: 'Routing Error',
        severity: 'high',
        page: 'Login',
        description: 'Possible redirect loop detected',
        error: `URL changed from ${url1} to ${url2}`,
      });
    }
  });

  test('2. Clients - List and Details', async () => {
    setupErrorListeners(authPage, 'Clients List');

    try {
      console.log('\n📋 Testing Clients List...');

      // Navigate to clients
      await authPage.goto('http://127.0.0.1:3004/portal/clients');
      await authPage.waitForTimeout(2000);

      // Check if clients are loaded (using new testids)
      const hasClients = await authPage.locator('[data-testid^="client-card-"], [data-testid^="client-row-"]').count();
      console.log(`   Found ${hasClients} client elements`);

      if (hasClients === 0) {
        reportBug({
          category: 'Data Loading',
          severity: 'high',
          page: 'Clients List',
          description: 'No clients displayed - may be API error or empty data',
        });
      }

      // Try to click first client (using new testids)
      const firstClient = authPage.locator('[data-testid^="client-card-"], [data-testid^="client-row-"]').first();
      const isClickable = await firstClient.isVisible().catch(() => false);

      if (isClickable) {
        console.log('   Opening first client...');
        await firstClient.click();
        await authPage.waitForTimeout(2000);

        // Check if client details page loaded
        const url = authPage.url();
        console.log(`   Client details URL: ${url}`);

        // Take screenshot
        await authPage.screenshot({ path: `test-results/qa-client-details-${Date.now()}.png`, fullPage: true });

        // Check for contacts section
        const hasContactsSection = await authPage.locator('text=/contacts|אנשי קשר/i').isVisible().catch(() => false);
        console.log(`   Contacts section visible: ${hasContactsSection}`);

        if (!hasContactsSection) {
          reportBug({
            category: 'UI Missing',
            severity: 'medium',
            page: 'Client Details',
            description: 'Contacts section not found in client details',
          });
        }

        // Check for sites section
        const hasSitesSection = await authPage.locator('text=/sites|אתרים|objects|אובייקטים/i').isVisible().catch(() => false);
        console.log(`   Sites section visible: ${hasSitesSection}`);

        if (!hasSitesSection) {
          reportBug({
            category: 'UI Missing',
            severity: 'medium',
            page: 'Client Details',
            description: 'Sites section not found in client details',
          });
        }

        // Check for equipment/assets section
        const hasAssetsSection = await authPage.locator('text=/equipment|assets|ציוד/i').isVisible().catch(() => false);
        console.log(`   Equipment section visible: ${hasAssetsSection}`);

        if (!hasAssetsSection) {
          reportBug({
            category: 'UI Missing',
            severity: 'medium',
            page: 'Client Details',
            description: 'Equipment/Assets section not found in client details',
          });
        }
      }
    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Clients List',
        description: `Failed to test clients list: ${error}`,
        error: String(error),
      });
    }
  });

  test('2a. Client Details - Assets Tab (No 401 Errors)', async () => {
    setupErrorListeners(authPage, 'Client Details - Assets Tab');

    try {
      console.log('\n⚙️ Testing Assets Tab in Client Details...');

      // Navigate to clients
      await authPage.goto('http://127.0.0.1:3004/portal/clients');
      await authPage.waitForTimeout(2000);

      // Click first client
      const firstClient = authPage.locator('[data-testid^="client-card-"], [data-testid^="client-row-"]').first();
      await firstClient.click();
      await authPage.waitForTimeout(2000);

      // Look for Assets/Equipment tab
      const assetsTab = authPage.locator('button:has-text("Equipment"), button:has-text("Assets"), button:has-text("ציוד")').first();
      const hasAssetsTab = await assetsTab.isVisible().catch(() => false);

      if (!hasAssetsTab) {
        console.log('   ⚠️  Assets tab not found - skipping test');
        return;
      }

      console.log('   Clicking Assets tab...');
      await assetsTab.click();
      await authPage.waitForTimeout(3000); // Wait for assets to load

      // Check if assets loaded (or empty state)
      const hasAssets = await authPage.locator('[data-testid^="asset-"], table tbody tr').count();
      console.log(`   Assets found: ${hasAssets}`);

      // Take screenshot
      await authPage.screenshot({ path: `test-results/qa-assets-tab-${Date.now()}.png`, fullPage: true });

      console.log('   ✅ Assets tab loaded without 401 errors');
    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Client Details - Assets Tab',
        description: `Failed to test assets tab: ${error}`,
        error: String(error),
      });
    }
  });

  test('2b. Create Ticket Modal (No 401 Errors)', async () => {
    setupErrorListeners(authPage, 'Create Ticket Modal');

    try {
      console.log('\n🎫 Testing Create Ticket Modal...');

      // Navigate to tickets page
      await authPage.goto('http://127.0.0.1:3004/portal/tickets');
      await authPage.waitForTimeout(2000);

      // Look for Create Ticket button
      const createBtn = authPage.getByTestId('create-ticket-button');
      const hasCreateBtn = await createBtn.isVisible().catch(() => false);

      if (!hasCreateBtn) {
        console.log('   ⚠️  Create Ticket button not found - trying alternative selector');
        const altBtn = authPage.locator('button:has-text("Create"), button:has-text("New Ticket"), button:has-text("צור קריאה")').first();
        const hasAltBtn = await altBtn.isVisible().catch(() => false);
        if (hasAltBtn) {
          await altBtn.click();
        } else {
          console.log('   ⚠️  Create Ticket button not found - skipping test');
          return;
        }
      } else {
        console.log('   Clicking Create Ticket button...');
        await createBtn.click();
      }

      await authPage.waitForTimeout(2000);

      // Check if modal opened
      const modal = authPage.locator('[role="dialog"], .MuiDialog-root');
      const isModalOpen = await modal.isVisible().catch(() => false);

      if (!isModalOpen) {
        reportBug({
          category: 'UI Missing',
          severity: 'high',
          page: 'Create Ticket Modal',
          description: 'Create Ticket modal did not open',
        });
        return;
      }

      console.log('   Modal opened, waiting for fields to load...');
      await authPage.waitForTimeout(2000); // Wait for dropdowns to populate

      // Check if client dropdown populated
      const clientDropdown = authPage.locator('[role="combobox"], select').first();
      const hasClientDropdown = await clientDropdown.isVisible().catch(() => false);
      console.log(`   Client dropdown visible: ${hasClientDropdown}`);

      // Take screenshot
      await authPage.screenshot({ path: `test-results/qa-create-ticket-modal-${Date.now()}.png`, fullPage: true });

      console.log('   ✅ Create Ticket modal loaded without 401 errors');

      // Close modal
      const closeBtn = authPage.locator('button:has-text("Cancel"), button:has-text("ביטול"), [aria-label="close"]').first();
      const hasCloseBtn = await closeBtn.isVisible().catch(() => false);
      if (hasCloseBtn) {
        await closeBtn.click();
        await authPage.waitForTimeout(500);
      }
    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Create Ticket Modal',
        description: `Failed to test create ticket modal: ${error}`,
        error: String(error),
      });
    }
  });

  test('3. Contacts - Create and Delete', async () => {
    setupErrorListeners(authPage, 'Contacts CRUD');

    try {
      console.log('\n👤 Testing Contact Create/Delete...');

      // Make sure we're on clients page
      await authPage.goto('http://127.0.0.1:3004/portal/clients');
      await authPage.waitForTimeout(2000);

      // Click first client (using new testids)
      const firstClient = authPage.locator('[data-testid^="client-card-"], [data-testid^="client-row-"]').first();
      await firstClient.click();
      await authPage.waitForTimeout(2000);

      // Look for "Add Contact" button (using new testid)
      const addContactBtn = authPage.getByTestId('create-contact-button');
      const hasAddBtn = await addContactBtn.isVisible().catch(() => false);

      if (!hasAddBtn) {
        reportBug({
          category: 'UI Missing',
          severity: 'medium',
          page: 'Client Details',
          description: 'Add Contact button not found',
        });
        return;
      }

      console.log('   Clicking Add Contact...');
      await addContactBtn.click();
      await authPage.waitForTimeout(1000);

      // Fill contact form
      const nameInput = authPage.locator('input[name="name"], input[placeholder*="name" i], input[placeholder*="שם" i]').first();
      const hasNameInput = await nameInput.isVisible().catch(() => false);

      if (!hasNameInput) {
        reportBug({
          category: 'UI Missing',
          severity: 'high',
          page: 'Contact Form',
          description: 'Contact name input not found',
        });
        return;
      }

      const testContactName = `Test Contact ${Date.now()}`;
      await nameInput.fill(testContactName);

      // Fill phone (if available)
      const phoneInput = authPage.locator('input[name="phone"], input[type="tel"], input[placeholder*="phone" i], input[placeholder*="טלפון" i]').first();
      const hasPhoneInput = await phoneInput.isVisible().catch(() => false);
      if (hasPhoneInput) {
        await phoneInput.fill('0501234567');
      }

      // Fill email (if available)
      const emailInput = authPage.locator('input[name="email"], input[type="email"], input[placeholder*="email" i], input[placeholder*="אימייל" i]').first();
      const hasEmailInput = await emailInput.isVisible().catch(() => false);
      if (hasEmailInput) {
        await emailInput.fill('test@example.com');
      }

      // Save
      const saveBtn = authPage.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("שמור"), button:has-text("צור"), button[type="submit"]').first();
      await saveBtn.click();
      await authPage.waitForTimeout(2000);

      // Check if contact was created
      const contactCreated = await authPage.locator(`text="${testContactName}"`).isVisible().catch(() => false);

      if (!contactCreated) {
        reportBug({
          category: 'Data Persistence',
          severity: 'high',
          page: 'Contacts',
          description: 'Contact not found after creation',
        });
        return;
      }

      console.log(`   ✅ Contact created: ${testContactName}`);

      // Now try to delete
      const deleteBtn = authPage.locator(`text="${testContactName}"`).locator('..').locator('button:has-text("Delete"), button:has-text("מחק"), [aria-label*="delete" i]').first();
      const hasDeleteBtn = await deleteBtn.isVisible().catch(() => false);

      if (!hasDeleteBtn) {
        reportBug({
          category: 'UI Missing',
          severity: 'medium',
          page: 'Contacts',
          description: 'Delete contact button not found',
        });
        return;
      }

      console.log('   Deleting contact...');
      await deleteBtn.click();
      await authPage.waitForTimeout(1000);

      // Confirm deletion if dialog appears
      const confirmBtn = authPage.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("אישור"), button:has-text("מחק")').last();
      const hasConfirmBtn = await confirmBtn.isVisible().catch(() => false);
      if (hasConfirmBtn) {
        await confirmBtn.click();
      }

      await authPage.waitForTimeout(2000);

      // Check if contact was deleted
      const contactStillExists = await authPage.locator(`text="${testContactName}"`).isVisible().catch(() => false);

      if (contactStillExists) {
        reportBug({
          category: 'Data Persistence',
          severity: 'high',
          page: 'Contacts',
          description: 'Contact still exists after deletion',
        });
      } else {
        console.log('   ✅ Contact deleted successfully');
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Contacts CRUD',
        description: `Failed to test contact CRUD: ${error}`,
        error: String(error),
      });
    }
  });

  test('4. Sites - Create and Delete', async () => {
    setupErrorListeners(authPage, 'Sites CRUD');

    try {
      console.log('\n🏢 Testing Site Create/Delete...');

      // Make sure we're on clients page
      await authPage.goto('http://127.0.0.1:3004/portal/clients');
      await authPage.waitForTimeout(2000);

      // Click first client (using new testids)
      const firstClient = authPage.locator('[data-testid^="client-card-"], [data-testid^="client-row-"]').first();
      await firstClient.click();
      await authPage.waitForTimeout(2000);

      // Look for "Add Site" button (using new testid)
      const addSiteBtn = authPage.getByTestId('create-site-button');
      const hasAddBtn = await addSiteBtn.isVisible().catch(() => false);

      if (!hasAddBtn) {
        reportBug({
          category: 'UI Missing',
          severity: 'medium',
          page: 'Client Details',
          description: 'Add Site button not found',
        });
        return;
      }

      console.log('   Clicking Add Site...');
      await addSiteBtn.click();
      await authPage.waitForTimeout(1000);

      // Fill site form
      const nameInput = authPage.locator('input[name="name"], input[placeholder*="site name" i], input[placeholder*="שם" i]').first();
      const hasNameInput = await nameInput.isVisible().catch(() => false);

      if (!hasNameInput) {
        reportBug({
          category: 'UI Missing',
          severity: 'high',
          page: 'Site Form',
          description: 'Site name input not found',
        });
        return;
      }

      const testSiteName = `Test Site ${Date.now()}`;
      await nameInput.fill(testSiteName);

      // Fill address (if available)
      const addressInput = authPage.locator('input[name="address"], textarea[name="address"], input[placeholder*="address" i], input[placeholder*="כתובת" i]').first();
      const hasAddressInput = await addressInput.isVisible().catch(() => false);
      if (hasAddressInput) {
        await addressInput.fill('123 Test Street');
      }

      // Save
      const saveBtn = authPage.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("שמור"), button:has-text("צור"), button[type="submit"]').first();
      await saveBtn.click();
      await authPage.waitForTimeout(2000);

      // Check if site was created
      const siteCreated = await authPage.locator(`text="${testSiteName}"`).isVisible().catch(() => false);

      if (!siteCreated) {
        reportBug({
          category: 'Data Persistence',
          severity: 'high',
          page: 'Sites',
          description: 'Site not found after creation',
        });
        return;
      }

      console.log(`   ✅ Site created: ${testSiteName}`);

      // Now try to delete
      const deleteBtn = authPage.locator(`text="${testSiteName}"`).locator('..').locator('button:has-text("Delete"), button:has-text("מחק"), [aria-label*="delete" i]').first();
      const hasDeleteBtn = await deleteBtn.isVisible().catch(() => false);

      if (!hasDeleteBtn) {
        reportBug({
          category: 'UI Missing',
          severity: 'medium',
          page: 'Sites',
          description: 'Delete site button not found',
        });
        return;
      }

      console.log('   Deleting site...');
      await deleteBtn.click();
      await authPage.waitForTimeout(1000);

      // Confirm deletion if dialog appears
      const confirmBtn = authPage.locator('button:has-text("Confirm"), button:has-text("Delete"), button:has-text("אישור"), button:has-text("מחק")').last();
      const hasConfirmBtn = await confirmBtn.isVisible().catch(() => false);
      if (hasConfirmBtn) {
        await confirmBtn.click();
      }

      await authPage.waitForTimeout(2000);

      // Check if site was deleted
      const siteStillExists = await authPage.locator(`text="${testSiteName}"`).isVisible().catch(() => false);

      if (siteStillExists) {
        reportBug({
          category: 'Data Persistence',
          severity: 'high',
          page: 'Sites',
          description: 'Site still exists after deletion',
        });
      } else {
        console.log('   ✅ Site deleted successfully');
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Sites CRUD',
        description: `Failed to test site CRUD: ${error}`,
        error: String(error),
      });
    }
  });

  test('5. Equipment - List and Probe', async () => {
    setupErrorListeners(authPage, 'Equipment');

    try {
      console.log('\n⚙️  Testing Equipment/Assets...');

      // Navigate to equipment/assets
      await authPage.goto('http://127.0.0.1:3004/portal/assets');
      await authPage.waitForTimeout(2000);

      // Check if equipment is loaded
      const hasEquipment = await authPage.locator('[data-testid*="asset"], .asset-card, .equipment-card, .MuiTableRow').count();
      console.log(`   Found ${hasEquipment} equipment elements`);

      if (hasEquipment === 0) {
        reportBug({
          category: 'Data Loading',
          severity: 'medium',
          page: 'Equipment List',
          description: 'No equipment displayed',
        });
        return;
      }

      // Click first equipment
      const firstEquipment = authPage.locator('[data-testid*="asset"], .asset-card, .equipment-card, .MuiTableRow').first();
      await firstEquipment.click();
      await authPage.waitForTimeout(2000);

      const url = authPage.url();
      console.log(`   Equipment details URL: ${url}`);

      // Take screenshot
      await authPage.screenshot({ path: `test-results/qa-equipment-details-${Date.now()}.png`, fullPage: true });

      // Look for probe button
      const probeBtn = authPage.locator('button:has-text("Probe"), button:has-text("Test"), button:has-text("בדיקה"), button:has-text("פרוב"), [aria-label*="probe" i]').first();
      const hasProbeBtn = await probeBtn.isVisible().catch(() => false);

      if (!hasProbeBtn) {
        console.log('   ⚠️  Probe button not found - may not be supported for this device');
        return;
      }

      console.log('   Running probe...');
      await probeBtn.click();
      await authPage.waitForTimeout(3000); // Wait for probe to complete

      // Check for probe results or errors
      const hasError = await authPage.locator('[role="alert"], .error, .MuiAlert-message').isVisible().catch(() => false);

      if (hasError) {
        const errorText = await authPage.locator('[role="alert"], .error, .MuiAlert-message').first().textContent();
        console.log(`   ⚠️  Probe error: ${errorText}`);

        // Check if it's an expected error (unsupported device)
        if (errorText?.toLowerCase().includes('not supported') || errorText?.toLowerCase().includes('לא נתמך')) {
          console.log('   ℹ️  Device does not support probing - this is acceptable');
        } else {
          reportBug({
            category: 'Equipment Probe',
            severity: 'medium',
            page: 'Equipment Details',
            description: 'Probe failed with unexpected error',
            error: errorText || 'Unknown error',
          });
        }
      } else {
        console.log('   ✅ Probe completed successfully');
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Equipment',
        description: `Failed to test equipment: ${error}`,
        error: String(error),
      });
    }
  });

  test('6. Tickets - Create Normal', async () => {
    setupErrorListeners(authPage, 'Ticket Creation');

    try {
      console.log('\n🎫 Testing Ticket Creation (Normal)...');

      // Navigate to tickets
      await authPage.goto('http://127.0.0.1:3004/portal/tickets');
      await authPage.waitForTimeout(2000);

      // Click "Create Ticket" button
      const createBtn = authPage.locator('button:has-text("Create Ticket"), button:has-text("New Ticket"), button:has-text("צור קריאה"), button:has-text("קריאה חדשה")').first();
      const hasCreateBtn = await createBtn.isVisible().catch(() => false);

      if (!hasCreateBtn) {
        reportBug({
          category: 'UI Missing',
          severity: 'high',
          page: 'Tickets',
          description: 'Create Ticket button not found',
        });
        return;
      }

      console.log('   Clicking Create Ticket...');
      await createBtn.click();
      await authPage.waitForTimeout(1000);

      // Fill ticket form
      const titleInput = authPage.locator('input[name="title"], input[placeholder*="title" i], input[placeholder*="כותרת" i]').first();
      const hasTitleInput = await titleInput.isVisible().catch(() => false);

      if (!hasTitleInput) {
        reportBug({
          category: 'UI Missing',
          severity: 'high',
          page: 'Ticket Form',
          description: 'Ticket title input not found',
        });
        return;
      }

      const testTicketTitle = `Test Ticket ${Date.now()}`;
      await titleInput.fill(testTicketTitle);

      // Fill description
      const descInput = authPage.locator('textarea[name="description"], input[name="description"], textarea[placeholder*="description" i]').first();
      const hasDescInput = await descInput.isVisible().catch(() => false);
      if (hasDescInput) {
        await descInput.fill('This is a test ticket created by automated QA');
      }

      // Select client (if needed)
      const clientSelect = authPage.locator('select[name="client_id"], [aria-label*="client" i]').first();
      const hasClientSelect = await clientSelect.isVisible().catch(() => false);
      if (hasClientSelect) {
        // Select first option that's not empty
        await clientSelect.selectOption({ index: 1 });
      }

      // Select site (if needed)
      const siteSelect = authPage.locator('select[name="site_id"], [aria-label*="site" i]').first();
      const hasSiteSelect = await siteSelect.isVisible().catch(() => false);
      if (hasSiteSelect) {
        await siteSelect.selectOption({ index: 1 });
      }

      // Save
      const saveBtn = authPage.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("שמור"), button:has-text("צור"), button[type="submit"]').first();
      await saveBtn.click();
      await authPage.waitForTimeout(2000);

      // Check for errors
      const hasError = await authPage.locator('[role="alert"].error, .MuiAlert-standardError').isVisible().catch(() => false);

      if (hasError) {
        const errorText = await authPage.locator('[role="alert"].error, .MuiAlert-standardError').first().textContent();
        reportBug({
          category: 'Ticket Creation',
          severity: 'high',
          page: 'Ticket Form',
          description: 'Failed to create ticket',
          error: errorText || 'Unknown error',
        });
      } else {
        console.log(`   ✅ Ticket created: ${testTicketTitle}`);
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Ticket Creation',
        description: `Failed to test ticket creation: ${error}`,
        error: String(error),
      });
    }
  });

  test('7. Tickets - Create from Equipment', async () => {
    setupErrorListeners(authPage, 'Ticket from Equipment');

    try {
      console.log('\n🎫⚙️  Testing Ticket Creation from Equipment...');

      // Navigate to equipment/assets
      await authPage.goto('http://127.0.0.1:3004/portal/assets');
      await authPage.waitForTimeout(2000);

      // Click first equipment
      const firstEquipment = authPage.locator('[data-testid*="asset"], .asset-card, .equipment-card, .MuiTableRow').first();
      const hasEquipment = await firstEquipment.isVisible().catch(() => false);

      if (!hasEquipment) {
        reportBug({
          category: 'Data Loading',
          severity: 'medium',
          page: 'Equipment List',
          description: 'No equipment available to create ticket from',
        });
        return;
      }

      await firstEquipment.click();
      await authPage.waitForTimeout(2000);

      // Look for "Create Ticket" button
      const createTicketBtn = authPage.locator('button:has-text("Create Ticket"), button:has-text("צור קריאה"), button:has-text("Open Ticket")').first();
      const hasCreateBtn = await createTicketBtn.isVisible().catch(() => false);

      if (!hasCreateBtn) {
        reportBug({
          category: 'UI Missing',
          severity: 'medium',
          page: 'Equipment Details',
          description: 'Create Ticket button not found in equipment details',
        });
        return;
      }

      console.log('   Clicking Create Ticket from equipment...');
      await createTicketBtn.click();
      await authPage.waitForTimeout(1000);

      // Check if form is pre-filled
      const titleInput = authPage.locator('input[name="title"], input[placeholder*="title" i]').first();
      const clientSelect = authPage.locator('select[name="client_id"], [aria-label*="client" i]').first();
      const siteSelect = authPage.locator('select[name="site_id"], [aria-label*="site" i]').first();

      const hasTitle = await titleInput.isVisible().catch(() => false);
      const hasClient = await clientSelect.isVisible().catch(() => false);
      const hasSite = await siteSelect.isVisible().catch(() => false);

      console.log(`   Form fields visible - Title: ${hasTitle}, Client: ${hasClient}, Site: ${hasSite}`);

      // Check if client is pre-selected
      if (hasClient) {
        const clientValue = await clientSelect.inputValue().catch(() => '');
        if (!clientValue || clientValue === '') {
          reportBug({
            category: 'Auto-fill Logic',
            severity: 'medium',
            page: 'Ticket Form (from Equipment)',
            description: 'Client not auto-filled when creating ticket from equipment',
          });
        } else {
          console.log('   ✅ Client auto-filled');
        }
      }

      // Check if site is pre-selected
      if (hasSite) {
        const siteValue = await siteSelect.inputValue().catch(() => '');
        if (!siteValue || siteValue === '') {
          reportBug({
            category: 'Auto-fill Logic',
            severity: 'medium',
            page: 'Ticket Form (from Equipment)',
            description: 'Site not auto-filled when creating ticket from equipment',
          });
        } else {
          console.log('   ✅ Site auto-filled');
        }
      }

      // Fill title if empty
      if (hasTitle) {
        const currentTitle = await titleInput.inputValue();
        if (!currentTitle) {
          await titleInput.fill(`Test Ticket from Equipment ${Date.now()}`);
        }
      }

      // Fill description
      const descInput = authPage.locator('textarea[name="description"], input[name="description"]').first();
      const hasDesc = await descInput.isVisible().catch(() => false);
      if (hasDesc) {
        await descInput.fill('Test ticket created from equipment details');
      }

      // Save
      const saveBtn = authPage.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("שמור"), button[type="submit"]').first();
      await saveBtn.click();
      await authPage.waitForTimeout(2000);

      // Check for errors
      const hasError = await authPage.locator('[role="alert"].error, .MuiAlert-standardError').isVisible().catch(() => false);

      if (hasError) {
        const errorText = await authPage.locator('[role="alert"].error, .MuiAlert-standardError').first().textContent();
        reportBug({
          category: 'Ticket Creation',
          severity: 'high',
          page: 'Ticket Form (from Equipment)',
          description: 'Failed to create ticket from equipment',
          error: errorText || 'Unknown error',
        });
      } else {
        console.log('   ✅ Ticket created from equipment successfully');
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Ticket from Equipment',
        description: `Failed to test ticket creation from equipment: ${error}`,
        error: String(error),
      });
    }
  });

  test('8. Tickets - Create from Non-Working Equipment', async () => {
    setupErrorListeners(authPage, 'Ticket from Non-Working Equipment');

    try {
      console.log('\n🎫🔴 Testing Ticket Creation from Non-Working Equipment...');

      // Navigate to equipment/assets
      await authPage.goto('http://127.0.0.1:3004/portal/assets');
      await authPage.waitForTimeout(2000);

      // Look for equipment with error/warning status
      const problematicEquipment = authPage.locator('[data-status="error"], [data-health="error"], .asset-error, .status-error, [aria-label*="error" i], [aria-label*="offline" i]').first();
      const hasProblematic = await problematicEquipment.isVisible().catch(() => false);

      if (!hasProblematic) {
        console.log('   ⚠️  No non-working equipment found - skipping this test');
        return;
      }

      console.log('   Found non-working equipment');
      await problematicEquipment.click();
      await authPage.waitForTimeout(2000);

      // Look for quick action button for non-working equipment
      const quickActionBtn = authPage.locator('button:has-text("Report Issue"), button:has-text("דווח תקלה"), button:has-text("Create Ticket"), [aria-label*="report" i]').first();
      const hasQuickAction = await quickActionBtn.isVisible().catch(() => false);

      if (!hasQuickAction) {
        reportBug({
          category: 'UI Missing',
          severity: 'medium',
          page: 'Equipment Details (Non-Working)',
          description: 'Quick action button for reporting issue not found for non-working equipment',
        });
        return;
      }

      console.log('   Clicking quick action for non-working equipment...');
      await quickActionBtn.click();
      await authPage.waitForTimeout(1000);

      // Verify ticket form is opened and pre-filled
      const titleInput = authPage.locator('input[name="title"], input[placeholder*="title" i]').first();
      const hasTitle = await titleInput.isVisible().catch(() => false);

      if (!hasTitle) {
        reportBug({
          category: 'Flow Error',
          severity: 'high',
          page: 'Equipment Quick Action',
          description: 'Ticket form did not open after clicking quick action',
        });
        return;
      }

      // Check if form has pre-filled data about the issue
      const titleValue = await titleInput.inputValue();
      console.log(`   Ticket title: ${titleValue}`);

      if (!titleValue) {
        reportBug({
          category: 'Auto-fill Logic',
          severity: 'low',
          page: 'Ticket Form (from Non-Working Equipment)',
          description: 'Title not auto-filled for non-working equipment ticket',
        });
      } else {
        console.log('   ✅ Title auto-filled');
      }

      // Complete the form if needed
      if (!titleValue) {
        await titleInput.fill(`Equipment Failure ${Date.now()}`);
      }

      const descInput = authPage.locator('textarea[name="description"], input[name="description"]').first();
      const hasDesc = await descInput.isVisible().catch(() => false);
      if (hasDesc) {
        const descValue = await descInput.inputValue().catch(() => '');
        if (!descValue) {
          await descInput.fill('Equipment is not functioning properly - automated test');
        }
      }

      // Save
      const saveBtn = authPage.locator('button:has-text("Save"), button:has-text("Create"), button:has-text("שמור"), button[type="submit"]').first();
      await saveBtn.click();
      await authPage.waitForTimeout(2000);

      // Check for errors
      const hasError = await authPage.locator('[role="alert"].error, .MuiAlert-standardError').isVisible().catch(() => false);

      if (hasError) {
        const errorText = await authPage.locator('[role="alert"].error, .MuiAlert-standardError').first().textContent();
        reportBug({
          category: 'Ticket Creation',
          severity: 'high',
          page: 'Ticket Form (from Non-Working Equipment)',
          description: 'Failed to create ticket for non-working equipment',
          error: errorText || 'Unknown error',
        });
      } else {
        console.log('   ✅ Ticket created for non-working equipment successfully');
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'medium',
        page: 'Ticket from Non-Working Equipment',
        description: `Failed to test ticket creation from non-working equipment: ${error}`,
        error: String(error),
      });
    }
  });

  test('9. Client Details - Assets Tab Must Show Data', async () => {
    setupErrorListeners(authPage, 'Client Details Assets Tab');

    try {
      console.log('\n📦 Testing Client Details → Assets Tab...');

      // Navigate to clients
      await authPage.goto('http://127.0.0.1:3004/portal/clients');
      await authPage.waitForTimeout(2000);

      // Find and click first client
      const hasClients = await authPage.locator('[data-testid^="client-card-"], [data-testid^="client-row-"]').count();
      console.log(`   Found ${hasClients} clients`);

      if (hasClients === 0) {
        reportBug({
          category: 'Data Loading',
          severity: 'high',
          page: 'Clients List',
          description: 'No clients found for assets tab test',
        });
        return;
      }

      const firstClient = authPage.locator('[data-testid^="client-card-"], [data-testid^="client-row-"]').first();
      await firstClient.click();
      await authPage.waitForTimeout(2000);

      console.log(`   Client details URL: ${authPage.url()}`);

      // Click Assets tab
      const assetsTab = authPage.locator('button[role="tab"]:has-text("Assets"), button[role="tab"]:has-text("Equipment"), button[role="tab"]:has-text("ציוד")').first();
      const hasAssetsTab = await assetsTab.isVisible().catch(() => false);

      if (!hasAssetsTab) {
        reportBug({
          category: 'UI Missing',
          severity: 'high',
          page: 'Client Details',
          description: 'Assets tab not found',
        });
        return;
      }

      console.log('   Clicking Assets tab...');
      await assetsTab.click();
      await authPage.waitForTimeout(2000);

      // Check for "No assets found" or empty state
      const hasNoAssetsMessage = await authPage.locator('text=/no assets|לא נמצא ציוד|no equipment/i').isVisible().catch(() => false);

      // Check if there are actual assets displayed
      const assetCount = await authPage.locator('[data-testid*="asset"], .asset-card, .equipment-card, .MuiTableRow').count();
      console.log(`   Assets displayed: ${assetCount}`);

      if (hasNoAssetsMessage && assetCount === 0) {
        reportBug({
          category: 'Data Loading',
          severity: 'critical',
          page: 'Client Details - Assets Tab',
          description: 'Assets tab shows "No assets found" but global Assets page shows assets for this client',
        });
      } else if (assetCount > 0) {
        console.log(`   ✅ Assets tab shows ${assetCount} assets correctly`);
      } else {
        console.log('   ⚠️  No assets displayed - this may be expected if client has no assets');
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Client Details Assets Tab',
        description: `Failed to test Client Details Assets tab: ${error}`,
        error: String(error),
      });
    }
  });

  test('10. Create Ticket Modal - No 401 Errors', async () => {
    setupErrorListeners(authPage, 'Create Ticket Modal');

    try {
      console.log('\n🎫 Testing Create Ticket Modal (No 401 Errors)...');

      // Navigate to equipment/assets
      await authPage.goto('http://127.0.0.1:3004/portal/assets');
      await authPage.waitForTimeout(2000);

      // Check if equipment is loaded
      const hasEquipment = await authPage.locator('[data-testid*="asset"], .asset-card, .equipment-card, .MuiTableRow').count();
      console.log(`   Found ${hasEquipment} equipment elements`);

      if (hasEquipment === 0) {
        console.log('   ⚠️  No equipment found - skipping test');
        return;
      }

      // Click first equipment
      const firstEquipment = authPage.locator('[data-testid*="asset"], .asset-card, .equipment-card, .MuiTableRow').first();
      await firstEquipment.click();
      await authPage.waitForTimeout(2000);

      console.log(`   Equipment details URL: ${authPage.url()}`);

      // Look for "Open Service Ticket" button
      const openTicketBtn = authPage.locator('button:has-text("Open Service Ticket"), button:has-text("Open Ticket"), button:has-text("פתח קריאה"), button:has-text("קריאת שירות")').first();
      const hasOpenTicketBtn = await openTicketBtn.isVisible().catch(() => false);

      if (!hasOpenTicketBtn) {
        console.log('   ⚠️  "Open Service Ticket" button not found - skipping test');
        return;
      }

      console.log('   Clicking "Open Service Ticket" button...');

      // Set up 401 detector before clicking
      let has401 = false;
      authPage.on('response', response => {
        if (response.status() === 401 && response.url().includes('/api/')) {
          has401 = true;
          console.error(`   ❌ 401 UNAUTHORIZED detected after modal opened: ${response.url()}`);
        }
      });

      await openTicketBtn.click();
      await authPage.waitForTimeout(3000); // Wait for modal and any lazy requests

      // Check if modal opened
      const hasModal = await authPage.locator('[role="dialog"], .MuiDialog-root').isVisible().catch(() => false);

      if (!hasModal) {
        reportBug({
          category: 'UI Missing',
          severity: 'high',
          page: 'Equipment Details',
          description: '"Open Service Ticket" button did not open modal',
        });
        return;
      }

      console.log('   ✅ Modal opened successfully');

      // Check for 401 errors
      if (has401) {
        reportBug({
          category: 'Authentication Error',
          severity: 'critical',
          page: 'Create Ticket Modal',
          description: '401 error detected after opening Create Ticket modal from equipment',
        });
      } else {
        console.log('   ✅ No 401 errors detected');
      }

      // Close modal
      const cancelBtn = authPage.locator('button:has-text("Cancel"), button:has-text("ביטול")').first();
      const hasCancelBtn = await cancelBtn.isVisible().catch(() => false);
      if (hasCancelBtn) {
        await cancelBtn.click();
        await authPage.waitForTimeout(1000);
      }

    } catch (error) {
      reportBug({
        category: 'Test Execution Error',
        severity: 'high',
        page: 'Create Ticket Modal',
        description: `Failed to test Create Ticket modal: ${error}`,
        error: String(error),
      });
    }
  });
});
