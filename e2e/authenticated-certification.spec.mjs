import { test,expect } from '@playwright/test';

const BASE='http://127.0.0.1:3100';
const PASSWORD=process.env.E2E_PASSWORD||'Aloyri-E2E-Password-2026!';
const roles=['owner','admin','sales','inventory','finance','viewer'];
const email=role=>`e2e-${role}@aloyri.test`;
let serverOrigin=BASE;
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const shift=days=>{const d=new Date(today()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};

async function login(browser,role){
  const context=await browser.newContext({baseURL:BASE});
  const fixtureResponse=await context.request.get('/api/e2e/fixture?role=viewer');
  expect(fixtureResponse.status()).toBe(200);
  const fixture=await fixtureResponse.json();
  serverOrigin=fixture.requestOrigin;
  const response=await context.request.post('/api/auth/login',{
    headers:{Origin:serverOrigin},
    data:{email:email(role),password:PASSWORD}
  });
  const body=await response.json();
  expect(response.status(),role+' real login: '+JSON.stringify(body)).toBe(200);
  const sessionCheck=await context.request.get('/api/auth/sessions');
  expect(sessionCheck.status(),role+' authenticated session').toBe(200);
  return {context,request:context.request};
}
async function api(request,method,path,data){
  return request.fetch(path,{
    method,
    headers:method==='GET'?undefined:{Origin:serverOrigin},
    data
  });
}

test.describe.configure({mode:'serial'});

test('real authenticated RBAC matrix protects reads and writes for every role',async({browser})=>{
  const owner=await login(browser,'owner');
  const inventorySeed=await owner.request.get('/api/inventory-suppliers');expect(inventorySeed.status()).toBe(200);
  const inventoryPayload=await inventorySeed.json();
  const financeSeed=await owner.request.get('/api/finances');expect(financeSeed.status()).toBe(200);
  const financePayload=await financeSeed.json();
  await owner.context.close();

  const readable={
    owner:{orders:200,customers:200,inventory:200,finance:200,team:200,backup:200},
    admin:{orders:200,customers:200,inventory:200,finance:200,team:403,backup:403},
    sales:{orders:200,customers:200,inventory:403,finance:403,team:403,backup:403},
    inventory:{orders:403,customers:403,inventory:200,finance:403,team:403,backup:403},
    finance:{orders:200,customers:200,inventory:200,finance:200,team:403,backup:403},
    viewer:{orders:200,customers:200,inventory:200,finance:200,team:403,backup:403}
  };
  const financeWrite=new Set(['owner','admin','finance']);
  const inventoryWrite=new Set(['owner','admin','inventory']);
  const customerWrite=new Set(['owner','admin','sales']);
  const orderWrite=new Set(['owner','admin','sales']);

  for(const role of roles){
    const s=await login(browser,role);
    expect((await s.request.get('/api/workspace')).status(),role+' workspace').toBe(200);
    expect((await s.request.get('/api/orders')).status(),role+' orders').toBe(readable[role].orders);
    expect((await s.request.get('/api/customers')).status(),role+' customers').toBe(readable[role].customers);
    expect((await s.request.get('/api/inventory-suppliers')).status(),role+' inventory').toBe(readable[role].inventory);
    expect((await s.request.get('/api/finances')).status(),role+' finance').toBe(readable[role].finance);
    expect((await s.request.get('/api/team')).status(),role+' team').toBe(readable[role].team);
    expect((await s.request.get('/api/workspace/backup')).status(),role+' backup').toBe(readable[role].backup);

    const financeWritePayload=financeWrite.has(role)
      ? await s.request.get('/api/finances').then(async response=>{expect(response.status(),role+' finance refresh').toBe(200);return response.json()})
      : financePayload;
    const financeSave=await api(s.request,'PUT','/api/finances',{data:financeWritePayload.data,domainVersion:financeWritePayload.domainVersion});
    expect(financeSave.status(),role+' finance write').toBe(financeWrite.has(role)?200:403);

    const inventoryWritePayload=inventoryWrite.has(role)
      ? await s.request.get('/api/inventory-suppliers').then(async response=>{expect(response.status(),role+' inventory refresh').toBe(200);return response.json()})
      : inventoryPayload;
    const inventorySave=await api(s.request,'PUT','/api/inventory-suppliers',{data:inventoryWritePayload.data,domainVersion:inventoryWritePayload.domainVersion});
    expect(inventorySave.status(),role+' inventory write').toBe(inventoryWrite.has(role)?200:403);

    const customer={
      id:'rbac-customer-'+role,name:'RBAC '+role,phone:'01700000001',address:'Dhaka',city:'Dhaka',
      preference:'',notes:'authenticated certification',consent:true,created:today()
    };
    const customerCreate=await api(s.request,'POST','/api/customers',customer);
    expect(customerCreate.status(),role+' customer create').toBe(customerWrite.has(role)?201:403);

    const order={
      id:'rbac-order-'+role,number:'RBAC-'+role.toUpperCase(),customerId:'customer-1',created:today(),collections:[],
      channel:'Facebook',payment:'bKash',status:'New',
      items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'batch-1',qty:1,unitCost:500}]}],
      discount:0,deliveryCharge:80,courierCost:0,packaging:0,paymentFee:0,returnFee:0,
      settled:false,restocked:false,tracking:'',notes:'authenticated certification'
    };
    const orderCreate=await api(s.request,'POST','/api/orders',order);
    expect(orderCreate.status(),role+' order create').toBe(orderWrite.has(role)?201:403);
    await s.context.close();
  }
});

test('real purchasing, stock, finance, order, concurrency and recovery workflows stay consistent',async({browser})=>{
  const inv=await login(browser,'inventory');
  let inventoryResponse=await inv.request.get('/api/inventory-suppliers');
  let inventory=await inventoryResponse.json();
  const receive=await api(inv.request,'POST','/api/purchase-orders/po-1/receive',{
    received:today(),invoice:'INV-E2E-RECEIVE',dueDate:shift(30),domainVersion:inventory.domainVersion,
    lines:[{productId:'simple-wash',qty:5,expiry:shift(365)}]
  });
  expect(receive.status()).toBe(200);
  const received=await receive.json();
  expect(received.data.purchaseOrders.find(x=>x.id==='po-1').status).toBe('Received');
  expect(received.data.batches.some(x=>x.invoice==='INV-E2E-RECEIVE')).toBeTruthy();
  await inv.context.close();

  const fin=await login(browser,'finance');
  inventoryResponse=await fin.request.get('/api/inventory-suppliers');
  inventory=await inventoryResponse.json();
  const supplierPayment=await api(fin.request,'POST','/api/inventory-batches/batch-1/supplier-payment',{
    date:today(),amount:500,note:'E2E supplier payment',account:'cash',domainVersion:inventory.domainVersion
  });
  expect(supplierPayment.status()).toBe(200);
  const supplierPaymentBody=await supplierPayment.json();
  expect(supplierPaymentBody.batch.payments.length).toBeGreaterThan(0);
  await fin.context.close();

  const owner=await login(browser,'owner');
  const order={
    id:'workflow-order',number:'E2E-WORKFLOW-1',customerId:'customer-1',created:today(),collections:[],
    channel:'Website',payment:'bKash',status:'New',
    items:[{productId:'simple-wash',qty:2,price:749,allocations:[{batchId:'batch-1',qty:2,unitCost:500}]}],
    discount:0,deliveryCharge:80,courierCost:60,packaging:20,paymentFee:10,returnFee:0,
    settled:false,restocked:false,tracking:'',notes:'workflow certification'
  };
  const createdResponse=await api(owner.request,'POST','/api/orders',order);
  expect(createdResponse.status()).toBe(201);
  const created=await createdResponse.json();
  expect(created.order.recordVersion).toBe(0);

  const collection=await api(owner.request,'POST','/api/orders/workflow-order/collection',{
    recordVersion:0,date:today(),amount:100,reference:'E2E collection',account:'cash'
  });
  expect(collection.status()).toBe(200);
  const collected=await collection.json();
  expect(collected.order.collections.some(x=>x.reference==='E2E collection')).toBeTruthy();

  const cancelOrder={
    ...order,id:'cancel-order',number:'E2E-CANCEL-1',items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'batch-1',qty:1,unitCost:500}]}]
  };
  const cancelCreatedResponse=await api(owner.request,'POST','/api/orders',cancelOrder);
  expect(cancelCreatedResponse.status()).toBe(201);
  const cancelCreated=await cancelCreatedResponse.json();
  const cancelUpdate=await api(owner.request,'PUT','/api/orders/cancel-order',{order:{...cancelCreated.order,status:'Cancelled'},recordVersion:0});
  expect(cancelUpdate.status()).toBe(200);

  const staleUpdate=await api(owner.request,'PUT','/api/orders/cancel-order',{order:{...cancelCreated.order,status:'Cancelled'},recordVersion:0});
  expect(staleUpdate.status()).toBe(409);

  const inventoryAfter=await owner.request.get('/api/inventory-suppliers');
  expect(inventoryAfter.status()).toBe(200);
  const inventoryAfterBody=await inventoryAfter.json();
  expect(inventoryAfterBody.data.inventoryHolds.some(x=>x.source==='Cancelled'&&x.sourceOrderId==='cancel-order')).toBeTruthy();

  const backupResponse=await owner.request.get('/api/workspace/backup');
  expect(backupResponse.status()).toBe(200);
  const backup=await backupResponse.json();
  const validate=await api(owner.request,'POST','/api/workspace/backup',{action:'validate',backup});
  expect(validate.status()).toBe(200);
  expect((await validate.json()).valid).toBe(true);
  const recordExport=await api(owner.request,'POST','/api/workspace/backup',{action:'recordExport'});
  expect(recordExport.status()).toBe(200);
  const recovery=await owner.request.get('/api/recovery/status');
  expect(recovery.status()).toBe(200);
  expect((await recovery.json()).status).toBe('ready');
  await owner.context.close();
});

test('customer optimistic concurrency and delete path work through authenticated API',async({browser})=>{
  const sales=await login(browser,'sales');
  const customer={id:'versioned-customer',name:'Versioned Customer',phone:'01900000000',address:'Dhaka',city:'Dhaka',preference:'',notes:'v1',consent:true,created:today()};
  const create=await api(sales.request,'POST','/api/customers',customer);expect(create.status()).toBe(201);
  const created=await create.json();expect(created.customer.recordVersion).toBe(0);
  const update=await api(sales.request,'PUT','/api/customers/versioned-customer',{customer:{...customer,notes:'v2'},recordVersion:0});
  expect(update.status()).toBe(200);
  const stale=await api(sales.request,'PUT','/api/customers/versioned-customer',{customer:{...customer,notes:'stale'},recordVersion:0});
  expect(stale.status()).toBe(409);
  const del=await api(sales.request,'DELETE','/api/customers/versioned-customer',{recordVersion:1});
  expect(del.status()).toBe(200);
  await sales.context.close();
});

test('real session revocation invalidates another authenticated browser',async({browser})=>{
  const first=await login(browser,'owner');
  const second=await login(browser,'owner');
  const sessionsResponse=await first.request.get('/api/auth/sessions');
  expect(sessionsResponse.status()).toBe(200);
  const sessions=await sessionsResponse.json();
  expect(sessions.sessions.length).toBeGreaterThanOrEqual(2);
  const revoke=await api(first.request,'POST','/api/auth/sessions',{action:'revokeOthers'});
  expect(revoke.status()).toBe(200);
  expect((await second.request.get('/api/workspace')).status()).toBe(401);
  expect((await first.request.get('/api/workspace')).status()).toBe(200);
  await first.context.close();
  await second.context.close();
});
