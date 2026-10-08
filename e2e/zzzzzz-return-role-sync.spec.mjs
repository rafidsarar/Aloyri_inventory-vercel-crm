import { test,expect } from '@playwright/test';

const BASE='http://localhost:3100';
const PASSWORD=process.env.E2E_PASSWORD||'Aloyri-E2E-Password-2026!';
const roles=['owner','admin','sales','inventory','finance','viewer'];
const inventoryEditors=new Set(['owner','admin','inventory']);
const financeEditors=new Set(['owner','admin','finance']);
const inspectors=['owner','admin','inventory'];
const settlementStaff=['owner','admin','finance'];
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());

async function login(browser,role){
  const context=await browser.newContext({baseURL:BASE});
  const fixture=await context.request.get('/api/e2e/fixture?role=viewer');
  expect(fixture.status()).toBe(200);
  const origin=(await fixture.json()).requestOrigin;
  const response=await context.request.post('/api/auth/login',{
    headers:{Origin:origin},
    data:{email:`e2e-${role}@aloyri.test`,password:PASSWORD}
  });
  expect(response.status(),role+' login').toBe(200);
  return {context,request:context.request,origin};
}
const api=(s,method,path,data)=>s.request.fetch(path,{method,headers:{Origin:s.origin},data});

test('six-role return inspection and settlement authorization survives reordered ledgers and full reloads',async({browser})=>{
  const sessions={};
  try{
    for(const role of roles)sessions[role]=await login(browser,role);
    const owner=sessions.owner;
    const ids=inspectors.map(role=>'role-ledger-order-'+role);
    for(const role of inspectors){
      const id='role-ledger-order-'+role;
      const order={
        id,number:'E2E-ROLE-LEDGER-'+role.toUpperCase(),customerId:'customer-1',
        created:today(),collections:[],channel:'Facebook',payment:'bKash',status:'New',
        items:[{productId:'simple-wash',qty:1,price:749,allocations:[{batchId:'batch-1',qty:1,unitCost:500}]}],
        discount:0,deliveryCharge:80,courierCost:0,packaging:0,paymentFee:0,returnFee:0,
        settled:false,restocked:false,tracking:'',notes:'Return role synchronization test'
      };
      const created=await api(owner,'POST','/api/orders',order);
      expect(created.status(),role+' seed order: '+await created.text()).toBe(201);
    }

    let versions=Object.fromEntries(ids.map(id=>[id,0]));
    for(let step=0;step<6;step++){
      const advanced=await api(owner,'POST','/api/orders/bulk-advance',{
        orders:ids.map(id=>({id,recordVersion:versions[id]}))
      });
      expect(advanced.status(),'fulfillment stage '+step+': '+await advanced.text()).toBe(200);
      const payload=await advanced.json();
      expect(payload.results.every(row=>row.ok),'all seeded orders advance').toBe(true);
      versions={...versions,...payload.recordVersions};
    }

    for(const id of ids){
      const current=await owner.request.get('/api/orders/'+id);
      expect(current.status()).toBe(200);
      const {order}=await current.json();
      expect(order.status).toBe('Delivered');
      const updated=await api(owner,'PUT','/api/orders/'+id,{
        order:{...order,status:'Returned',returnedAt:today(),restocked:false},
        recordVersion:order.recordVersion
      });
      expect(updated.status(),id+' return: '+await updated.text()).toBe(200);
      versions[id]=order.recordVersion+1;
    }

    const inspectionTarget=ids[0];
    for(const role of ['sales','finance','viewer']){
      const forbidden=await api(sessions[role],'POST','/api/orders/'+inspectionTarget+'/inspection',{
        recordVersion:versions[inspectionTarget],outcome:'Sellable'
      });
      expect(forbidden.status(),role+' cannot inspect').toBe(403);
    }

    let finance=await owner.request.get('/api/finances').then(r=>r.json());
    for(const role of ['sales','inventory','viewer']){
      const forbidden=await api(sessions[role],'POST','/api/finances/return-settlements',{
        settlement:{id:'unauthorized-'+role,orderId:ids[0],date:today(),kind:'No refund',amount:0,reason:'Denied'},
        domainVersion:finance.domainVersion
      });
      expect(forbidden.status(),role+' cannot settle').toBe(403);
    }

    for(const role of inspectors){
      const id='role-ledger-order-'+role;
      const inspected=await api(sessions[role],'POST','/api/orders/'+id+'/inspection',{
        recordVersion:versions[id],outcome:'Sellable'
      });
      expect(inspected.status(),role+' may inspect: '+await inspected.text()).toBe(200);
    }

    const settlementIds=['zz-role-ledger-owner','aa-role-ledger-admin','mm-role-ledger-finance'];
    for(let i=0;i<settlementStaff.length;i++){
      const role=settlementStaff[i];
      finance=await sessions[role].request.get('/api/finances').then(r=>r.json());
      const settled=await api(sessions[role],'POST','/api/finances/return-settlements',{
        settlement:{
          id:settlementIds[i],orderId:ids[i],date:today(),kind:'No refund',
          amount:0,reason:'Confirmed no refund for role '+role
        },
        domainVersion:finance.domainVersion
      });
      expect(settled.status(),role+' may settle: '+await settled.text()).toBe(200);
    }

    for(const role of roles){
      const s=sessions[role];
      const inventoryRes=await s.request.get('/api/inventory-suppliers');
      if(inventoryRes.ok()){
        const data=await inventoryRes.json();
        expect(data.data.returnInspections.length).toBeGreaterThanOrEqual(3);
        if(inventoryEditors.has(role)){
          data.data.returnInspections.reverse(); // relational order != workspace order
          data.data.suppliers[0].notes='Authorized inspection-ledger test: '+role;
          const saved=await api(s,'PUT','/api/inventory-suppliers',{data:data.data,domainVersion:data.domainVersion});
          expect(saved.status(),role+' inventory edit after inspections: '+await saved.text()).toBe(200);
        }else{
          const denied=await api(s,'PUT','/api/inventory-suppliers',{data:data.data,domainVersion:data.domainVersion});
          expect(denied.status(),role+' inventory edit denied').toBe(403);
        }
      }else expect(inventoryRes.status(),role+' inventory read denied').toBe(403);

      const financeRes=await s.request.get('/api/finances');
      if(financeRes.ok()){
        const data=await financeRes.json();
        expect(data.data.returnSettlements.some(x=>x.id===settlementIds[0])).toBe(true);
        if(financeEditors.has(role)){
          data.data.returnSettlements.reverse();
          data.data.creditUses.reverse();
          data.data.customerRefunds.reverse();
          data.data.expenses.push({
            id:'e2e-ledger-expense-'+role,category:'Other',date:today(),amount:5,
            notes:'Return history preserved',vendor:'',reference:'',recurring:'none',account:'cash'
          });
          const saved=await api(s,'PUT','/api/finances',{data:data.data,domainVersion:data.domainVersion});
          expect(saved.status(),role+' finance edit after settlements: '+await saved.text()).toBe(200);
        }else{
          const denied=await api(s,'PUT','/api/finances',{data:data.data,domainVersion:data.domainVersion});
          expect(denied.status(),role+' finance edit denied').toBe(403);
        }
      }else expect(financeRes.status(),role+' finance read denied').toBe(403);
    }

    const before=await owner.request.get('/api/finances').then(r=>r.json());
    const tampered=structuredClone(before.data);
    tampered.returnSettlements[0].reason='Edited historical decision';
    const forbiddenFinance=await api(owner,'PUT','/api/finances',{
      data:tampered,domainVersion:before.domainVersion
    });
    expect(forbiddenFinance.status(),'even owner cannot rewrite posted settlement').toBe(400);

    const stock=await owner.request.get('/api/inventory-suppliers').then(r=>r.json());
    const forged=structuredClone(stock.data);
    forged.returnInspections[0].outcome='Damaged';
    const forbiddenStock=await api(owner,'PUT','/api/inventory-suppliers',{
      data:forged,domainVersion:stock.domainVersion
    });
    expect(forbiddenStock.status(),'even owner cannot rewrite inspection history').toBe(400);

    const finalFinance=await owner.request.get('/api/finances').then(r=>r.json());
    const finalInventory=await owner.request.get('/api/inventory-suppliers').then(r=>r.json());
    expect(settlementIds.every(id=>finalFinance.data.returnSettlements.some(r=>r.id===id))).toBe(true);
    expect(finalInventory.data.returnInspections.length).toBeGreaterThanOrEqual(3);
  }finally{
    await Promise.allSettled(Object.values(sessions).map(s=>s.context.close()));
  }
});
