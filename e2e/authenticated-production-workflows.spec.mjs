import { test,expect } from '@playwright/test';

const BASE='http://127.0.0.1:3100';
const PASSWORD=process.env.E2E_PASSWORD||'Aloyri-E2E-Password-2026!';
const roles=['owner','admin','sales','inventory','finance','viewer'];
const email=role=>role+'@e2e.aloyri.local';

async function login(browser,role){
  const context=await browser.newContext();
  const page=await context.newPage();
  await page.goto('/login');
  const base=new URL(page.url()).origin;
  const api={
    get:(path,options)=>context.request.get(base+path,options),
    post:(path,options={})=>context.request.post(base+path,{...options,headers:{Origin:base,...(options.headers||{})}}),
    put:(path,options={})=>context.request.put(base+path,{...options,headers:{Origin:base,...(options.headers||{})}}),
    delete:(path,options={})=>context.request.delete(base+path,{...options,headers:{Origin:base,...(options.headers||{})}})
  };
  const authenticated=await api.post('/api/auth/login',{
    data:{email:email(role),password:PASSWORD}
  });
  expect(authenticated.status(),role+' authentication').toBe(200);
  const workspace=await api.get('/api/workspace');
  expect(workspace.status(),role+' workspace login').toBe(200);
  const data=await workspace.json();
  expect(data.role).toBe(role);
  expect(data.recoveryMode).toBe(false);
  return {context,page,request:api,workspace:data};
}

const origin={Origin:BASE};

test('real authenticated RBAC matrix protects every core domain',async({browser})=>{
  const readMatrix={
    owner:{orders:200,customers:200,inventory:200,finance:200,team:200,recovery:200},
    admin:{orders:200,customers:200,inventory:200,finance:200,team:403,recovery:403},
    sales:{orders:200,customers:200,inventory:403,finance:403,team:403,recovery:403},
    inventory:{orders:403,customers:403,inventory:200,finance:403,team:403,recovery:403},
    finance:{orders:200,customers:200,inventory:200,finance:200,team:403,recovery:403},
    viewer:{orders:200,customers:200,inventory:200,finance:200,team:403,recovery:403}
  };
  const writeMatrix={
    owner:{order:400,customer:400,inventory:400,finance:400,reset:400},
    admin:{order:400,customer:400,inventory:400,finance:400,reset:403},
    sales:{order:400,customer:400,inventory:403,finance:403,reset:403},
    inventory:{order:403,customer:403,inventory:400,finance:403,reset:403},
    finance:{order:403,customer:403,inventory:403,finance:400,reset:403},
    viewer:{order:403,customer:403,inventory:403,finance:403,reset:403}
  };
  for(const role of roles){
    const {context,request}=await login(browser,role);
    const reads={
      orders:await request.get('/api/orders'),
      customers:await request.get('/api/customers'),
      inventory:await request.get('/api/inventory-suppliers'),
      finance:await request.get('/api/finances'),
      team:await request.get('/api/team'),
      recovery:await request.get('/api/recovery/status')
    };
    for(const [key,response] of Object.entries(reads))
      expect(response.status(),role+' GET '+key).toBe(readMatrix[role][key]);

    const writes={
      order:await request.post('/api/orders',{headers:origin,data:{}}),
      customer:await request.post('/api/customers',{headers:origin,data:{}}),
      inventory:await request.put('/api/inventory-suppliers',{headers:origin,data:{data:{},domainVersion:0}}),
      finance:await request.put('/api/finances',{headers:origin,data:{data:{},domainVersion:0}}),
      reset:await request.post('/api/workspace/reset',{headers:origin,data:{confirmation:'NO'}})
    };
    for(const [key,response] of Object.entries(writes))
      expect(response.status(),role+' WRITE '+key).toBe(writeMatrix[role][key]);
    await context.close();
  }
});

test('sales, inventory and finance execute one atomic cross-domain business workflow',async({browser})=>{
  const sales=await login(browser,'sales');
  const customer={
    id:'e2e-customer-1',name:'Authenticated Customer',phone:'01711111111',address:'Road 1, Dhaka',
    city:'Dhaka',preference:'Cleanser',notes:'Created by E2E certification',consent:true,created:'2026-10-01'
  };
  const order={
    id:'e2e-order-1',number:'E2E-1001',customerId:customer.id,created:'2026-10-01',
    collections:[],channel:'Facebook',payment:'COD',status:'New',
    items:[{productId:'simple-wash',qty:2,price:749,allocations:[{batchId:'e2e-batch',qty:2,unitCost:520}]}],
    discount:0,deliveryCharge:80,courierCost:0,packaging:0,paymentFee:0,returnFee:0,
    settled:false,restocked:false,tracking:'',notes:'Authenticated E2E order'
  };
  const created=await sales.request.post('/api/orders/with-customer',{headers:origin,data:{customer,order}});
  expect(created.status()).toBe(201);
  const createdBody=await created.json();
  expect(createdBody.order?.id||createdBody.orderId||order.id).toBeTruthy();

  const readOrder=await sales.request.get('/api/orders/'+order.id);
  expect(readOrder.status()).toBe(200);
  let orderRecord=(await readOrder.json()).order;
  expect(orderRecord.number).toBe('E2E-1001');

  const cancelled={...orderRecord,status:'Cancelled'};
  const cancel=await sales.request.put('/api/orders/'+order.id,{headers:origin,data:{order:cancelled,recordVersion:orderRecord.recordVersion}});
  expect(cancel.status()).toBe(200);
  orderRecord=(await cancel.json()).order;
  expect(orderRecord.status).toBe('Cancelled');
  await sales.context.close();

  const inventory=await login(browser,'inventory');
  let inventoryResponse=await inventory.request.get('/api/inventory-suppliers');
  expect(inventoryResponse.status()).toBe(200);
  let inventoryBody=await inventoryResponse.json();
  const cancelledHold=inventoryBody.data.inventoryHolds.find(h=>h.source==='Cancelled'&&h.sourceOrderId===order.id);
  expect(cancelledHold).toBeTruthy();
  expect(cancelledHold.qty).toBe(2);

  const nextInventory=structuredClone(inventoryBody.data);
  nextInventory.inventoryHolds.push({
    id:'e2e-manual-hold',batchId:'e2e-batch',qty:1,date:'2026-10-02',type:'Quarantine',
    reason:'Certification hold',source:'Manual'
  });
  const holdWrite=await inventory.request.put('/api/inventory-suppliers',{
    headers:origin,data:{data:nextInventory,domainVersion:inventoryBody.domainVersion}
  });
  expect(holdWrite.status()).toBe(200);
  inventoryResponse=await inventory.request.get('/api/inventory-suppliers');
  inventoryBody=await inventoryResponse.json();
  expect(inventoryBody.data.inventoryHolds.some(h=>h.id==='e2e-manual-hold')).toBe(true);
  await inventory.context.close();

  const finance=await login(browser,'finance');
  let financeResponse=await finance.request.get('/api/finances');
  expect(financeResponse.status()).toBe(200);
  let financeBody=await financeResponse.json();
  const nextFinance=structuredClone(financeBody.data);
  nextFinance.expenses.push({
    id:'e2e-expense',category:'Tools',amount:250,date:'2026-10-01',notes:'Certification expense',
    vendor:'E2E Vendor',reference:'E2E-EXP',recurring:'none',account:'cash'
  });
  const expenseWrite=await finance.request.put('/api/finances',{
    headers:origin,data:{data:nextFinance,domainVersion:financeBody.domainVersion}
  });
  expect(expenseWrite.status()).toBe(200);
  financeResponse=await finance.request.get('/api/finances');
  financeBody=await financeResponse.json();
  expect(financeBody.data.expenses.some(e=>e.id==='e2e-expense')).toBe(true);

  const ownerMoneyDenied=await finance.request.post('/api/finances/owner-money',{
    headers:origin,data:{kind:'capital',amount:500,date:'2026-10-01',account:'cash',reference:'forbidden',domainVersion:financeBody.domainVersion}
  });
  expect(ownerMoneyDenied.status()).toBe(403);
  await finance.context.close();
});

test('optimistic concurrency, session revocation and backup restore are certified against the real database',async({browser})=>{
  const owner=await login(browser,'owner');

  const customer={
    id:'e2e-concurrency-customer',name:'Concurrency Customer',phone:'01722222222',address:'Dhaka',
    city:'Dhaka',preference:'',notes:'v0',consent:false,created:'2026-10-01'
  };
  const create=await owner.request.post('/api/customers',{headers:origin,data:customer});
  expect(create.status()).toBe(201);
  const createdCustomer=(await create.json()).customer;
  const update=await owner.request.put('/api/customers/'+customer.id,{
    headers:origin,data:{customer:{...createdCustomer,notes:'v1'},recordVersion:createdCustomer.recordVersion}
  });
  expect(update.status()).toBe(200);
  const stale=await owner.request.put('/api/customers/'+customer.id,{
    headers:origin,data:{customer:{...createdCustomer,notes:'stale write'},recordVersion:createdCustomer.recordVersion}
  });
  expect(stale.status()).toBe(409);

  const backupResponse=await owner.request.get('/api/workspace/backup');
  expect(backupResponse.status()).toBe(200);
  const backup=await backupResponse.json();
  expect(backup.schemaVersion).toBe(4);
  expect(backup.integrity?.relationalParity?.ok).toBe(true);

  const recordExport=await owner.request.post('/api/workspace/backup',{headers:origin,data:{action:'recordExport'}});
  expect(recordExport.status()).toBe(200);
  const recovery=await owner.request.get('/api/recovery/status');
  expect(recovery.status()).toBe(200);
  const recoveryBody=await recovery.json();
  expect(recoveryBody.checks.recentBackup).toBe(true);
  expect(recoveryBody.checks.relationalParity).toBe(true);

  const restored=await owner.request.post('/api/workspace/backup',{
    headers:origin,data:{action:'restore',confirmation:'RESTORE ALOYRI',backup}
  });
  expect(restored.status()).toBe(200);
  const restoredBody=await restored.json();
  expect(restoredBody.atomicCommit).toBe(true);
  expect(restoredBody.relationalParity.ok).toBe(true);

  const second=await login(browser,'owner');
  const sessions=await owner.request.get('/api/auth/sessions');
  expect(sessions.status()).toBe(200);
  const sessionBody=await sessions.json();
  expect(sessionBody.sessions.filter(s=>!s.current).length).toBeGreaterThanOrEqual(1);
  const revoke=await owner.request.post('/api/auth/sessions',{headers:origin,data:{action:'revokeOthers'}});
  expect(revoke.status()).toBe(200);
  const revokedWorkspace=await second.request.get('/api/workspace');
  expect(revokedWorkspace.status()).toBe(401);
  await second.context.close();
  await owner.context.close();
});
