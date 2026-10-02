import { test, expect } from '@playwright/test';

const roles={
  owner:{
    label:'Business owner',
    heading:'Run the business from what needs attention now.',
    visible:['Overview','Reports','Alerts','Automation','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups','Activity'],
    hidden:[]
  },
  admin:{
    label:'Admin',
    heading:'Run the business from what needs attention now.',
    visible:['Overview','Reports','Alerts','Automation','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups','Activity'],
    hidden:[]
  },
  sales:{
    label:'Sales employee',
    heading:'Start with customers and orders that need action today.',
    visible:['Overview','Alerts','Orders','Customers','Follow-ups'],
    hidden:['Finances','Inventory','Suppliers','Reports','Automation','Activity']
  },
  inventory:{
    label:'Inventory manager',
    heading:'Protect stock availability and keep purchasing moving.',
    visible:['Overview','Alerts','Inventory','Suppliers'],
    hidden:['Orders','Customers','Finances','Reports','Automation','Activity','Follow-ups']
  },
  finance:{
    label:'Finance manager',
    heading:'Work from collections, payables and account control.',
    visible:['Overview','Alerts','Orders','Inventory','Customers','Suppliers','Finances'],
    hidden:['Reports','Automation','Follow-ups','Activity']
  },
  viewer:{
    label:'View only',
    heading:'Monitor business activity without changing operational records.',
    visible:['Overview','Alerts','Orders','Inventory','Customers','Suppliers','Finances','Follow-ups'],
    hidden:['Reports','Automation','Activity']
  }
};

async function loadRole(page,request,role){
  const response=await request.get('/api/e2e/fixture?role='+role);
  expect(response.ok()).toBeTruthy();
  const fixture=await response.json();
  const json=(data)=>({status:200,contentType:'application/json',body:JSON.stringify(data)});
  await page.route('**/api/workspace',route=>route.fulfill(json(fixture.workspace)));
  await page.route('**/api/customers',route=>route.fulfill(json(fixture.customers)));
  await page.route('**/api/orders',route=>route.fulfill(json(fixture.orders)));
  await page.route('**/api/inventory-suppliers',route=>route.fulfill(json(fixture.inventory)));
  await page.route('**/api/finances',route=>route.fulfill(json(fixture.finance)));
  await page.goto('/e2e');
  await expect(page.getByRole('heading',{name:roles[role].heading})).toBeVisible();
}

for(const [role,expected] of Object.entries(roles)){
  test(role+' workspace exposes only permitted navigation',async({page,request})=>{
    await loadRole(page,request,role);
    await expect(page.getByText(expected.label,{exact:true})).toBeVisible();
    for(const section of expected.visible)
      await expect(page.locator('.app-sidebar .nav-button').filter({hasText:section}).first()).toBeVisible();
    for(const section of expected.hidden)
      await expect(page.locator('.app-sidebar .nav-button').filter({hasText:section})).toHaveCount(0);
  });
}

test('login screen remains usable in a real browser',async({page})=>{
  await page.goto('/login');
  await expect(page.getByRole('heading',{name:'Sign in to ALOYRI'})).toBeVisible();
  await expect(page.getByLabel('Email address')).toBeVisible();
  await expect(page.getByLabel('Password')).toBeVisible();
  await expect(page.getByRole('button',{name:'Sign in'})).toBeEnabled();
});

test('sales workspace fits a phone viewport without horizontal page overflow',async({page,request})=>{
  await page.setViewportSize({width:390,height:844});
  await loadRole(page,request,'sales');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
});
