import { test,expect } from '@playwright/test';

const BASE=process.env.LIVE_CRM_URL||'https://aloyriinventory-vercel-crm.vercel.app';
const headings={
  owner:'Run the business from what needs attention now.',
  admin:'Run the business from what needs attention now.',
  sales:'Start with customers and orders that need action today.',
  inventory:'Protect stock availability and keep purchasing moving.',
  finance:'Work from collections, payables and account control.',
  viewer:'Monitor business activity without changing operational records.'
};

const nav=async(page,name)=>{
  await page.locator('.app-sidebar .nav-button').filter({hasText:name}).first().click();
  await page.waitForTimeout(250);
};
const login=async(page,role,reset=false)=>{
  const q=reset?'?action=reset&role='+role:'?role='+role;
  await page.goto(BASE+'/api/internal/live-usability-audit'+q,{waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:headings[role]})).toBeVisible({timeout:30000});
};
const consoleGuard=page=>{
  const errors=[];
  page.on('pageerror',error=>errors.push('pageerror: '+error.message));
  page.on('console',msg=>{if(msg.type()==='error'&&!/favicon/i.test(msg.text()))errors.push('console: '+msg.text())});
  return ()=>expect(errors,errors.join('\n')).toEqual([]);
};
const noOverflow=async page=>{
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
};

test.describe.configure({mode:'serial'});

test('owner daily oversight: reports, alerts, automation control and audit history',async({page})=>{
  const clean=consoleGuard(page);
  await login(page,'owner');
  await noOverflow(page);

  await nav(page,'Reports');
  await expect(page.getByRole('heading',{name:'Executive performance overview'})).toBeVisible();

  await nav(page,'Alerts');
  await expect(page.getByRole('heading',{name:'Daily business brief'})).toBeVisible();

  await nav(page,'Automation');
  await expect(page.getByRole('heading',{name:'Automation Center'}).first()).toBeVisible();
  const toggle=page.getByRole('button',{name:'Toggle low-stock watch'});
  const before=await toggle.getAttribute('aria-pressed');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed',before==='true'?'false':'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed',before||'true');

  await nav(page,'Activity');
  await expect(page.getByRole('heading',{name:'Activity & audit trail'})).toBeVisible();
  await expect(page.getByLabel('Search activity history')).toBeVisible();
  clean();
  console.log('AUDIT_RESULT owner PASS reports alerts automation activity');
});

test('admin daily coordination: cross-functional queues and management actions are usable',async({page})=>{
  const clean=consoleGuard(page);
  await login(page,'admin');
  await nav(page,'Orders');
  await expect(page.getByRole('heading',{name:'Fulfill orders faster.'})).toBeVisible();
  await page.getByRole('button',{name:'Create order'}).click();
  await expect(page.getByRole('heading',{name:'New order'})).toBeVisible();
  await page.getByRole('button',{name:'Cancel'}).click();

  await nav(page,'Inventory');
  await expect(page.getByRole('heading',{name:'Control stock before it becomes a problem.'})).toBeVisible();
  await page.getByRole('button',{name:'Receive stock'}).first().click();
  await expect(page.getByRole('heading',{name:'Receive stock'})).toBeVisible();
  await page.getByRole('button',{name:'Cancel'}).click();

  await nav(page,'Finances');
  await expect(page.getByRole('heading',{name:'Know where the money is—and what needs attention.'})).toBeVisible();
  await page.getByRole('tab',{name:'Expenses'}).click();
  await page.getByRole('button',{name:'Record expense'}).click();
  await expect(page.getByRole('heading',{name:'Record an expense'})).toBeVisible();
  await page.getByRole('button',{name:'Cancel'}).click();

  await nav(page,'Reports');
  await expect(page.getByRole('heading',{name:'Executive performance overview'})).toBeVisible();
  clean();
  console.log('AUDIT_RESULT admin PASS cross-functional queues and actions');
});

test('sales daily workflow: create customer/order, progress order, create and complete follow-up',async({page})=>{
  const clean=consoleGuard(page);
  await login(page,'sales');

  await nav(page,'Orders');
  await page.getByRole('button',{name:'Create order'}).click();
  await expect(page.getByRole('heading',{name:'New order'})).toBeVisible();
  await page.getByRole('tab',{name:'New customer'}).click();
  await page.getByLabel('New customer name').fill('Live Audit Sales Customer');
  await page.getByLabel('New customer mobile').fill('01722222222');
  await page.getByLabel('New customer city').fill('Dhaka');
  await page.getByLabel('New customer delivery address').fill('Dhanmondi, Dhaka');
  await page.getByRole('button',{name:'Create order'}).click();
  await expect(page.getByRole('button',{name:/View invoice · Print \/ Save PDF/})).toBeVisible({timeout:30000});
  await expect(page.getByRole('button',{name:'Mark confirmed'})).toBeVisible();
  await page.getByRole('button',{name:'Mark confirmed'}).click();
  await expect(page.getByText('Confirmed',{exact:true}).first()).toBeVisible({timeout:30000});

  await nav(page,'Follow-ups');
  await expect(page.getByRole('heading',{name:'Follow-ups'})).toBeVisible();
  await page.getByRole('button',{name:'Add follow-up'}).click();
  await page.getByLabel('title').fill('Live audit sales follow-up');
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByText('Live audit sales follow-up',{exact:true})).toBeVisible({timeout:30000});
  await page.getByRole('checkbox',{name:'Complete Live audit sales follow-up'}).check();
  await expect(page.getByText('Completed',{exact:true}).first()).toBeVisible({timeout:30000});

  await nav(page,'Customers');
  await page.getByLabel('Search customers').fill('Live Audit Sales Customer');
  await expect(page.getByText('Live Audit Sales Customer',{exact:true}).first()).toBeVisible();
  clean();
  console.log('AUDIT_RESULT sales PASS order creation progression follow-up customer lookup');
});

test('inventory daily workflow: receive a real PO, review stock, place and review a hold',async({page})=>{
  const clean=consoleGuard(page);
  await login(page,'inventory');

  await nav(page,'Suppliers');
  await expect(page.getByRole('heading',{name:'Suppliers & purchasing'})).toBeVisible();
  await expect(page.getByText('AUD-PO-1001',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Receive'}).click();
  await expect(page.getByRole('heading',{name:'Receive purchase order'})).toBeVisible();
  await page.getByRole('button',{name:'Receive stock'}).click();
  await expect(page.getByText('Received',{exact:true}).first()).toBeVisible({timeout:30000});

  await nav(page,'Inventory');
  await expect(page.getByRole('heading',{name:'Control stock before it becomes a problem.'})).toBeVisible();
  await page.getByRole('tab',{name:'Holds & returns'}).click();
  await page.getByRole('button',{name:'Hold stock'}).click();
  await expect(page.getByRole('heading',{name:'Hold stock'})).toBeVisible();
  await page.getByLabel('Inventory hold reason').fill('Live usability audit hold');
  await page.getByRole('button',{name:'Block stock'}).click();
  await expect(page.getByText('Live usability audit hold',{exact:true})).toBeVisible({timeout:30000});

  await page.setViewportSize({width:390,height:844});
  await page.reload({waitUntil:'networkidle'});
  await expect(page.getByRole('heading',{name:headings.inventory})).toBeVisible();
  await noOverflow(page);
  clean();
  console.log('AUDIT_RESULT inventory PASS PO receipt stock hold mobile');
});

test('finance daily workflow: collect receivable, pay supplier, record expense and review cashflow',async({page})=>{
  const clean=consoleGuard(page);
  await login(page,'finance');

  await nav(page,'Finances');
  await expect(page.getByRole('heading',{name:'Know where the money is—and what needs attention.'})).toBeVisible();

  await page.getByRole('tab',{name:'Collections'}).click();
  await expect(page.getByText('AUD-1001',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Record collection'}).first().click();
  await expect(page.getByRole('heading',{name:'Record customer collection'})).toBeVisible();
  await page.locator('.payment-dialog input').filter({has:page.locator('')}).count().catch(()=>0);
  await page.getByRole('button',{name:'Post & reconcile'}).click();
  await expect(page.getByText('Collections are up to date')).toBeVisible({timeout:30000});

  await page.getByRole('tab',{name:'Payables'}).click();
  await page.getByRole('button',{name:'Record payment'}).first().click();
  await expect(page.getByRole('heading',{name:'Record supplier payment'})).toBeVisible();
  await page.getByRole('button',{name:'Post & reconcile'}).click();
  await expect(page.getByText('No supplier payments due')).toBeVisible({timeout:30000});

  await page.getByRole('tab',{name:'Expenses'}).click();
  await page.getByRole('button',{name:'Record expense'}).click();
  await page.getByLabel('amount').fill('250');
  await page.getByLabel('vendor').fill('Live Audit Vendor');
  await page.getByLabel('notes').fill('Live usability audit operating expense');
  await page.getByRole('button',{name:'Save changes'}).click();
  await expect(page.getByText('Live Audit Vendor',{exact:true})).toBeVisible({timeout:30000});

  await page.getByRole('tab',{name:'Cashflow'}).click();
  await expect(page.getByRole('heading',{name:'Money received and paid'})).toBeVisible();
  clean();
  console.log('AUDIT_RESULT finance PASS collection supplier payment expense cashflow');
});

test('viewer daily review: operational drill-downs work without accidental edit affordances',async({page})=>{
  const clean=consoleGuard(page);
  await login(page,'viewer');

  for(const section of ['Orders','Inventory','Customers','Suppliers','Finances','Follow-ups']){
    await nav(page,section);
    await noOverflow(page);
  }
  await nav(page,'Orders');
  await page.getByLabel('Search orders').fill('AUD-');
  await expect(page.getByText('AUD-1001',{exact:true}).first()).toBeVisible();
  await expect(page.getByRole('button',{name:'Create order'})).toHaveCount(0);

  await nav(page,'Inventory');
  await expect(page.getByRole('button',{name:'Receive stock'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Hold stock'})).toHaveCount(0);

  await nav(page,'Follow-ups');
  await expect(page.getByRole('button',{name:'Add follow-up'})).toHaveCount(0);
  clean();
  console.log('AUDIT_RESULT viewer PASS read-only operational review');
});
