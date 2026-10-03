import { test, expect } from '@playwright/test';

for (const role of ['owner', 'finance']) {
  test(role + ' finance breakdown explains return inventory deductions and excludes restocked returns', async ({ page, request }) => {
    const response = await request.get('/api/e2e/fixture?role=' + role);
    expect(response.ok()).toBeTruthy();
    const fixture = await response.json();
    const state = fixture.workspace.data;
    const date = new Date().toISOString().slice(0, 10);
    const productId = state.products[0].id;
    const order = (id, status, unitCost, restocked = false) => ({
      id, number: id, customerId: 'customer', created: date, delivered: status === 'Delivered' ? date : undefined,
      returnedAt: status === 'Returned' ? date : undefined, status, restocked, channel: 'Facebook', payment: 'COD',
      items: [{ productId, qty: 1, price: 3000, allocations: [{ batchId: id, qty: 1, unitCost }] }],
      collections: [], discount: 0, deliveryCharge: 60, courierCost: 0, packaging: 0, paymentFee: 0,
      returnFee: 0, settled: false, tracking: '', notes: '',
    });
    state.customers = [{ id: 'customer', name: 'Finance test', phone: '', address: '', city: '', preference: '', notes: '', consent: false, created: date }];
    state.orders = [order('delivered', 'Delivered', 500), order('pending-return', 'Returned', 520), order('unrestocked-return', 'Returned', 1015), order('restocked-return', 'Returned', 777, true)];
    Object.assign(state.orders[0], { courierCost: 200, packaging: 100, paymentFee: 28 });
    state.orders[1].courierCost = 700;
    state.orders[2].returnFee = 349;
    state.batches = state.orders.map(o => ({ id: o.id, productId, qty: 2, unitCost: o.items[0].allocations[0].unitCost, expiry: '2099-12-31', received: date, supplierId: '', invoice: o.id, payments: [], paid: false }));
    state.expenses = [{ id: 'expense', category: 'Advertising', amount: 3500, date, notes: '', vendor: '', reference: '', recurring: 'none' }];
    fixture.customers.customers = state.customers.map(c => ({ ...c, recordVersion: 0 }));
    fixture.orders.orders = state.orders.map(o => ({ ...o, recordVersion: 0 }));
    fixture.inventory.data.batches = state.batches;
    fixture.finance.data.expenses = state.expenses;
    for (const [path, data] of Object.entries({ workspace: fixture.workspace, customers: fixture.customers, orders: fixture.orders, 'inventory-suppliers': fixture.inventory, finances: fixture.finance })) {
      await page.route('**/api/' + path, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }));
    }
    await page.goto('/e2e');
    await expect(page.getByRole('heading', { name: role === 'owner' ? 'Run the business from what needs attention now.' : 'Work from collections, payables and account control.' })).toBeVisible();
    await page.locator('.app-sidebar').getByRole('button', { name: 'Finances', exact: true }).click();
    const breakdown = page.locator('.finance-breakdown');
    await expect(breakdown.getByRole('heading', { name: 'Financial breakdown' })).toBeVisible();
    const rows = breakdown.locator('dl > div');
    await expect(rows.filter({ hasText: 'Delivered order contribution' }).locator('dd')).toHaveText('৳2,232');
    await expect(rows.filter({ hasText: 'Failed-delivery costs' }).locator('dd')).toHaveText('− ৳1,049');
    await expect(rows.filter({ hasText: 'Return inventory costs' }).locator('dd')).toHaveText('− ৳1,535');
    await expect(rows.filter({ hasText: 'Recorded operating expenses' }).locator('dd')).toHaveText('− ৳3,500');
    await expect(rows.filter({ hasText: 'Operating result' }).locator('dd')).toHaveText('− ৳3,852');
    await expect(breakdown).toContainText('Restocked returns are excluded.');
  });
}
