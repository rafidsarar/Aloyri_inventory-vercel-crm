import { test, expect } from '@playwright/test';

async function loadWorkspace(page, request, role = 'owner') {
  const response = await request.get('/api/e2e/fixture?role=' + role);
  expect(response.ok()).toBeTruthy();
  const fixture = await response.json();
  const data = fixture.workspace.data;
  const date = new Date().toISOString().slice(0, 10);
  const product = data.products[0];
  data.customers = [{ id: 'ui-customer', name: 'UI test customer', phone: '01700000000', city: 'Dhaka', address: 'Dhaka', consent: true, preference: '', notes: '', created: date }];
  data.suppliers = [{ id: 'ui-supplier', name: 'UI test supplier', contact: 'Purchasing', phone: '01800000000', email: '', address: 'Dhaka', leadDays: 7, paymentTermsDays: 30, notes: '', verified: true }];
  data.batches = [{ id: 'ui-batch', productId: product.id, qty: 20, unitCost: 100, expiry: '2099-12-31', received: date, supplierId: 'ui-supplier', invoice: 'UI-001', dueDate: '2099-12-31', payments: [], paid: false }];
  data.orders = [{ id: 'ui-order', number: 'UI-001', customerId: 'ui-customer', created: date, channel: 'Facebook', payment: 'COD', status: 'New', items: [{ productId: product.id, qty: 1, price: product.price, allocations: [{ batchId: 'ui-batch', qty: 1, unitCost: 100 }] }], collections: [], discount: 0, deliveryCharge: 60, courierCost: 0, packaging: 0, paymentFee: 0, returnFee: 0, settled: false, restocked: false, tracking: '', notes: '' }];
  data.tasks = [{ id: 'ui-task', customerId: 'ui-customer', orderId: 'ui-order', title: 'Check customer delivery and skincare preference', due: date, done: false, kind: 'Follow-up', priority: 'Normal', channel: 'WhatsApp', notes: 'UI alignment fixture', completedAt: '' }];
  fixture.customers.customers = data.customers.map(item => ({ ...item, recordVersion: 0 }));
  fixture.orders.orders = data.orders.map(item => ({ ...item, recordVersion: 0 }));
  Object.assign(fixture.inventory.data, { suppliers: data.suppliers, batches: data.batches });
  await page.route('**/api/audit**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [], hasMore: false }) }));
  for (const [path, data] of Object.entries({
    workspace: fixture.workspace, customers: fixture.customers,
    orders: fixture.orders, 'inventory-suppliers': fixture.inventory,
    finances: fixture.finance,
  })) {
    await page.route('**/api/' + path, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(data),
    }));
  }
  await page.goto('/e2e');
  await expect(page.getByRole('heading', { name: 'Business overview', exact: true })).toBeVisible();
  await expect(page.locator('.overview-command-hero')).toBeVisible();
}

async function openSection(page, section) {
  // Both responsive navigation surfaces preserve the same role permissions.
  const navigation = page.viewportSize().width < 768 ? '.mobile-section-nav' : '.app-sidebar';
  await page.locator(navigation).getByRole('button', { name: new RegExp('^' + section + '( \\d+)?$') }).click();
  await expect(page.locator('.breadcrumb strong')).toHaveText(section);
  const heading = { Reports: 'Management reports', Alerts: 'Alert center', Automation: 'Automation center', Activity: 'Activity log' }[section] || section;
  await expect(page.getByRole('heading', { name: heading, exact: true }).first()).toBeVisible();
}

async function assertContained(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(2);
}

for (const width of [390, 650, 768, 1440]) {
  test('operational UI alignment at ' + width + 'px', async ({ page, request }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await loadWorkspace(page, request);
    await assertContained(page);
    if (width < 768) {
      const actions = await page.locator('.mode-actions > a, .mode-actions > button').evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().y));
      expect(Math.max(...actions) - Math.min(...actions)).toBeLessThanOrEqual(1);
    }
    for (const section of ['Orders', 'Customers', 'Suppliers', 'Inventory', 'Finances', 'Follow-ups', 'Alerts', 'Automation', 'Activity']) {
      await openSection(page, section);
      await assertContained(page);
      for (const checkbox of await page.locator('[data-slot="checkbox"]:visible').all()) {
        const size = await checkbox.boundingBox();
        expect(Math.abs(size.width - size.height)).toBeLessThanOrEqual(1);
        expect(size.height).toBeLessThanOrEqual(24);
      }
      for (const list of await page.locator('[role="tablist"]:visible').all()) {
        const fits = await list.evaluate(el => el.scrollHeight <= el.clientHeight + 1);
        expect(fits, section + ' tabs should have no vertical overflow').toBeTruthy();
      }
      if (section === 'Automation') {
        for (const toggle of await page.locator('.automation-toggle').all()) {
          const box = await toggle.boundingBox();
          expect(box.width).toBeGreaterThan(box.height);
          expect(box.height).toBeLessThanOrEqual(24);
        }
      }
      if (section === 'Activity') {
        const search = await page.getByRole('textbox', { name: 'Search activity history' }).boundingBox();
        const filters = await page.locator('.activity-filter-groups').boundingBox();
        expect(filters.y).toBeGreaterThanOrEqual(search.y + search.height - 1);
        for (const button of await page.locator('.activity-section-filters button').all()) {
          const box = await button.boundingBox();
          expect(box.width).toBeGreaterThan(20);
          const strip = await button.evaluate(el => el.parentElement.getBoundingClientRect().width);
          expect(strip).toBeGreaterThanOrEqual(box.width - 1);
        }
      }
      if (section === 'Orders') {
        for (const card of await page.locator('.order-kpi-grid-pro > button').all()) {
          const label = await card.locator('small').boundingBox();
          const value = await card.locator('strong').boundingBox();
          const detail = await card.locator('em').boundingBox();
          expect(value.y).toBeGreaterThanOrEqual(label.y + label.height - 1);
          expect(detail.y).toBeGreaterThanOrEqual(value.y + value.height - 1);
          if (width > 600) {
            const arrow = await card.locator(':scope > svg').boundingBox();
            expect(arrow.x).toBeGreaterThan(value.x + value.width - 1);
          }
        }
      }
      if ((width === 390 || width === 1440) && ['Orders', 'Follow-ups', 'Activity'].includes(section)) {
        await page.screenshot({ path: testInfo.outputPath(section.toLowerCase() + '.png'), fullPage: true });
      }
      if (section === 'Follow-ups') {
        const row = page.locator('.task-row-pro').first();
        await expect(row).toBeVisible();
        const controls = await row.locator('.task-controls').boundingBox();
        const main = await row.locator('.task-main').boundingBox();
        const side = await row.locator('.task-side').boundingBox();
        expect(main.x).toBeGreaterThanOrEqual(controls.x + controls.width);
        expect(main.width).toBeGreaterThan(width < 768 ? 180 : 220);
        if (width <= 1100) expect(side.y).toBeGreaterThanOrEqual(main.y + main.height - 1);
        else expect(side.x).toBeGreaterThanOrEqual(main.x + main.width - 1);
        const select = row.getByRole('checkbox', { name: /^Select / });
        await select.check();
        await expect(page.locator('.followup-bulk-bar')).toBeVisible();
        await select.uncheck();
        await expect(page.locator('.followup-bulk-bar')).toHaveCount(0);
      }
      if (section === 'Suppliers') {
        await page.getByRole('button', { name: 'New purchase order', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'New purchase order' });
        await expect(dialog).toBeVisible();
        if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath('purchase-order.png') });
        const first = dialog.locator('.po-line').first();
        await expect(first.getByLabel('PO product 1')).toBeVisible();
        await expect(first.getByText('Quantity', { exact: true })).toBeVisible();
        await expect(first.getByText('Unit cost (BDT)', { exact: true })).toBeVisible();
        const boxes = await first.locator('select, input, button').evaluateAll(nodes => nodes.map(el => {
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, height: r.height };
        }));
        expect(Math.max(...boxes.map(b => b.height)) - Math.min(...boxes.map(b => b.height))).toBeLessThanOrEqual(1);
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          expect(a.right <= b.x + 1 || b.right <= a.x + 1 || a.bottom <= b.y + 1 || b.bottom <= a.y + 1).toBeTruthy();
        }
        const dialogBox = await dialog.boundingBox();
        expect(dialogBox.x).toBeGreaterThanOrEqual(0);
        expect(dialogBox.x + dialogBox.width).toBeLessThanOrEqual(width + 1);
        await dialog.getByRole('button', { name: 'Add item', exact: true }).click();
        await expect(dialog.locator('.po-line')).toHaveCount(2);
        await dialog.getByRole('button', { name: 'Remove purchase item 2', exact: true }).click();
        await expect(dialog.locator('.po-line')).toHaveCount(1);
        await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(dialog).toHaveCount(0);
      }
    }
    if (width < 768) await page.getByRole('button', { name: 'Toggle Sidebar', exact: true }).click();
    await page.getByRole('button', { name: 'Business settings', exact: true }).click();
    const settings = page.getByRole('dialog', { name: 'Business settings', exact: true });
    await expect(settings).toBeVisible();
    expect(await settings.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
    const bounds = await settings.boundingBox();
    for (const field of await settings.locator('.record-form input:visible, .form-actions button:visible').all()) {
      const box = await field.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width - 10);
    }
    if (width === 390 || width === 1440) await page.screenshot({ path: testInfo.outputPath('settings.png') });
    await settings.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(settings).toHaveCount(0);
  });
}

test('read-only follow-ups keep text in the main column without editing actions', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await loadWorkspace(page, request, 'viewer');
  await openSection(page, 'Follow-ups');
  const row = page.locator('.task-row-pro').first();
  await expect(row).toBeVisible();
  await expect(row.locator('.task-bulk-select, .task-side')).toHaveCount(0);
  await expect(row.getByRole('checkbox', { name: /^Complete / })).toBeDisabled();
  expect((await row.locator('.task-main').boundingBox()).width).toBeGreaterThan(220);
});
