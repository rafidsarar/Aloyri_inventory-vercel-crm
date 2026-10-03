import { test,expect } from '@playwright/test';
const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
async function session(browser,role){
 const context=await browser.newContext({baseURL:'http://localhost:3100'});
 const fixture=await (await context.request.get('/api/e2e/fixture?role=viewer')).json();
 const origin=fixture.requestOrigin;
 const login=await context.request.post('/api/auth/login',{headers:{Origin:origin},data:{email:`e2e-${role}@aloyri.test`,password:process.env.E2E_PASSWORD||'Aloyri-E2E-Password-2026!'}});expect(login.status()).toBe(200);
 return {context,request:context.request,origin};
}
test('paid delivered return supports partial and full refund through Finance with safe retries and persistent account deductions',async({browser})=>{
 const owner=await session(browser,'owner');const post=(path,data)=>owner.request.post(path,{headers:{Origin:owner.origin},data});
 const order={id:'refund-e2e-order',number:'REFUND-E2E-1',customerId:'customer-1',created:date(),collections:[],channel:'Website',payment:'Bank',status:'New',items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'batch-1',qty:1,unitCost:500}]}],discount:0,deliveryCharge:0,courierCost:0,packaging:0,paymentFee:0,returnFee:0,settled:false,restocked:false,tracking:'',notes:'refund certification'};
 let res=await post('/api/orders',order);expect(res.status()).toBe(201);let saved=(await res.json()).order;
 res=await post('/api/orders/'+order.id+'/collection',{recordVersion:saved.recordVersion,date:date(),amount:749,reference:'Original customer payment',account:'cash'});expect(res.status()).toBe(200);const collected=await res.json();saved={...collected.order,recordVersion:collected.recordVersions[order.id]};
 for(const status of ['Confirmed','Ready to pack','Packed','Shipped','Out for delivery','Delivered','Returned']){res=await owner.request.put('/api/orders/'+order.id,{headers:{Origin:owner.origin},data:{order:{...saved,status,delivered:['Delivered','Returned'].includes(status)?date():undefined,returnedAt:status==='Returned'?date():undefined},recordVersion:saved.recordVersion}});expect(res.status(),await res.text()).toBe(200);saved=(await res.json()).order;}
 const before=await (await owner.request.get('/api/workspace')).json();
 const originalOrder=before.data.orders.find(o=>o.id===order.id);
 const finance=await session(browser,'finance'),page=await finance.context.newPage();await page.goto('/');
 await expect(page.getByRole('heading',{name:'Work from collections, payables and account control.'})).toBeVisible({timeout:15000});
 await page.locator('.app-sidebar').getByRole('button',{name:'Finances',exact:true}).click();await page.getByRole('tab',{name:'Refunds',exact:true}).click();
 const refundPanel=page.locator('section').filter({has:page.getByRole('heading',{name:'Customer refunds',exact:true})});
 const row=refundPanel.getByRole('row').filter({hasText:'#REFUND-E2E-1'});
 await expect(row).toContainText('Refund due');await expect(row).toContainText('৳749');
 await row.getByRole('button',{name:'Record refund',exact:true}).click();await page.getByLabel('Refund amount').fill('300');await page.getByLabel('Refund reference').fill('REFUND-300');await page.getByLabel('Refund reason').fill('Customer returned product');
 const responsePromise=page.waitForResponse(res=>res.url().endsWith('/api/finances/customer-refunds')&&res.request().method()==='POST');
 const reqPromise=page.waitForRequest(req=>req.url().endsWith('/api/finances/customer-refunds')&&req.method()==='POST');
 await page.getByRole('button',{name:'Record refund payment',exact:true}).click();const posted=(await reqPromise).postDataJSON();const payoutResponse=await responsePromise;expect(payoutResponse.status(),await payoutResponse.text()).toBe(200);await expect(page.getByRole('dialog')).toBeHidden({timeout:20000});
 await expect(row).toContainText('Partially refunded');await expect(row).toContainText('৳449');
 const retry=await finance.request.post('/api/finances/customer-refunds',{headers:{Origin:finance.origin},data:posted});expect(retry.status()).toBe(200);expect((await retry.json()).duplicate).toBe(true);
 await page.reload();await expect(page.getByRole('heading',{name:'Work from collections, payables and account control.'})).toBeVisible({timeout:15000});await page.locator('.app-sidebar').getByRole('button',{name:'Finances',exact:true}).click();await page.getByRole('tab',{name:'Refunds',exact:true}).click();await expect(row).toContainText('৳449');
 await row.getByRole('button',{name:'Record refund',exact:true}).click();await page.getByLabel('Refund reference').fill('REFUND-449');await page.getByLabel('Refund reason').fill('Remaining refund');const finalResponsePromise=page.waitForResponse(res=>res.url().endsWith('/api/finances/customer-refunds')&&res.request().method()==='POST');await page.getByRole('button',{name:'Record refund payment',exact:true}).click();const finalResponse=await finalResponsePromise;expect(finalResponse.status(),await finalResponse.text()).toBe(200);await expect(page.getByRole('dialog')).toBeHidden({timeout:20000});await expect(row).toContainText('Refunded');await expect(row.getByRole('button',{name:'Record refund',exact:true})).toHaveCount(0);
 const after=await (await owner.request.get('/api/workspace')).json();const refunds=after.data.customerRefunds.filter(r=>r.orderId===order.id);expect(refunds).toHaveLength(2);expect(refunds.reduce((n,r)=>n+r.amount,0)).toBe(749);expect(after.data.orders.find(o=>o.id===order.id)).toEqual(originalOrder);expect(after.data.expenses).toEqual(before.data.expenses);expect(refunds.every(r=>after.data.accountMatches.some(m=>m.entryId==='customer-refund-'+r.id&&m.account==='cash'&&!m.matched))).toBe(true);
 await page.getByRole('tab',{name:'Cashflow',exact:true}).click();const cashRows=page.getByRole('row').filter({hasText:'Customer refund'}).filter({hasText:'#REFUND-E2E-1'});await expect(cashRows).toHaveCount(2);
 const backup=await owner.request.get('/api/workspace/backup');expect(backup.status(),await backup.text()).toBe(200);expect((await backup.json()).integrity.counts.customerRefunds).toBe(2);
 const financeData=await (await owner.request.get('/api/finances')).json();const forged=structuredClone(financeData.data);forged.customerRefunds=[];const deletion=await owner.request.put('/api/finances',{headers:{Origin:owner.origin},data:{data:forged,domainVersion:financeData.domainVersion}});expect(deletion.status()).toBe(400);
 for(const role of ['sales','inventory','viewer']){const denied=await session(browser,role);const response=await denied.request.post('/api/finances/customer-refunds',{headers:{Origin:denied.origin},data:posted});expect(response.status()).toBe(403);await denied.context.close();}
 await finance.context.close();await owner.context.close();
});
