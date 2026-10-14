import { test,expect } from '@playwright/test';
const password=process.env.E2E_PASSWORD||'Aloyri-E2E-Password-2026!';
async function login(browser,role){
 const context=await browser.newContext({baseURL:'http://localhost:3100'});
 const fixture=await (await context.request.get('/api/e2e/fixture')).json();
 const headers={Origin:fixture.requestOrigin};
 const res=await context.request.post('/api/auth/login',{headers,data:{email:`e2e-${role}@aloyri.test`,password}});
 expect(res.status()).toBe(200);return {context,request:context.request,headers};
}
test('brand registry survives reload and rename, rejects used deletion and stale writes',async({browser})=>{
 const {context,request,headers}=await login(browser,'owner');
 const read=async()=>{const r=await request.get('/api/inventory-suppliers');expect(r.status()).toBe(200);return r.json()};
 const save=body=>request.put('/api/inventory-suppliers',{headers,data:body});
 let original=await read(),data=structuredClone(original.data);
 const name='Brand integration '+Date.now(),renamed=name+' renamed';data.productBrands.push(name);
 let res=await save({data,domainVersion:original.domainVersion});expect(res.status(),await res.text()).toBe(200);
 let current=await read();expect(current.data.productBrands).toContain(name);
 res=await save({data,domainVersion:original.domainVersion});expect(res.status()).toBe(409);
 data=structuredClone(current.data);const productId=data.products[0].id,oldBrand=data.products[0].brand;data.products[0].brand=name;
 res=await save({data,domainVersion:current.domainVersion});expect(res.status(),await res.text()).toBe(200);
 current=await read();data=structuredClone(current.data);data.productBrands=data.productBrands.filter(b=>b!==name);
 res=await save({data,domainVersion:current.domainVersion});expect(res.ok()).toBe(false);expect(await res.text()).toContain('Move products');
 data=structuredClone(current.data);data.productBrands=data.productBrands.map(b=>b===name?renamed:b);data.products=data.products.map(p=>p.brand===name?{...p,brand:renamed}:p);
 res=await save({data,domainVersion:current.domainVersion});expect(res.status(),await res.text()).toBe(200);
 current=await read();expect(current.data.products.find(p=>p.id===productId).brand).toBe(renamed);
 // Restore only the test's brand edits, preserving all other records.
 data=structuredClone(current.data);data.products.find(p=>p.id===productId).brand=oldBrand;data.productBrands=data.productBrands.filter(b=>b!==renamed);
 res=await save({data,domainVersion:current.domainVersion});expect(res.status(),await res.text()).toBe(200);
 expect((await read()).data.productBrands).not.toContain(renamed);await context.close();
});
for(const role of ['owner','admin','inventory','sales','finance','viewer'])test(`brand API permissions: ${role}`,async({browser})=>{
 const {context,request,headers}=await login(browser,role);
 const response=await request.get('/api/inventory-suppliers');
 if(role==='sales'){expect(response.status()).toBe(403);expect((await request.put('/api/inventory-suppliers',{headers,data:{data:{productBrands:['Forbidden']},domainVersion:0}})).status()).toBe(403);}
 else{
  expect(response.status()).toBe(200);const current=await response.json(),data=structuredClone(current.data),name='Role brand '+role;data.productBrands.push(name);
  const result=await request.put('/api/inventory-suppliers',{headers,data:{data,domainVersion:current.domainVersion}});
  if(['owner','admin','inventory'].includes(role)){
   expect(result.status(),await result.text()).toBe(200);
   const saved=await (await request.get('/api/inventory-suppliers')).json();expect(saved.data.productBrands).toContain(name);
   saved.data.productBrands=saved.data.productBrands.filter(b=>b!==name);
   expect((await request.put('/api/inventory-suppliers',{headers,data:{data:saved.data,domainVersion:saved.domainVersion}})).status()).toBe(200);
  }else expect(result.status()).toBe(403);
 }
 await context.close();
});
test('Brands UI creates, searches, renames and removes an unused brand',async({browser})=>{
 const {context}=await login(browser,'owner');const page=await context.newPage();await page.goto('/');
 await page.getByRole('button',{name:'Inventory',exact:true}).first().click();await page.getByRole('tab',{name:'Brands',exact:true}).click();
 const name='UI brand '+Date.now();await page.getByRole('button',{name:'Add brand',exact:true}).click();await page.getByLabel('Brand name',{exact:true}).fill(name);
 await page.getByRole('dialog').getByRole('button',{name:/Save/}).click();await expect(page.getByRole('dialog')).toBeHidden();
 await page.getByLabel('Search inventory brands').fill(name);const row=page.getByRole('row').filter({hasText:name});await expect(row).toBeVisible();
 await row.getByRole('button',{name:'Rename',exact:true}).click();await page.getByLabel('Brand name',{exact:true}).fill(name+' renamed');await page.getByRole('dialog').getByRole('button',{name:/Save/}).click();await expect(page.getByRole('dialog')).toBeHidden();
 const renamed=page.getByRole('row').filter({hasText:name+' renamed'});await expect(renamed).toBeVisible();await renamed.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('alertdialog').getByRole('button',{name:/Confirm|Delete/}).click();await expect(renamed).toBeHidden();await context.close();
});
test('Add Product can select and quickly create a persisted brand',async({browser})=>{
 const {context,request,headers}=await login(browser,'owner');const page=await context.newPage();await page.goto('/');
 await page.getByRole('button',{name:'Inventory',exact:true}).first().click();await page.getByRole('button',{name:'Add product',exact:true}).first().click();
 const dialog=page.getByRole('dialog'),name='Brand product '+Date.now(),brand='Quick brand '+Date.now();
 await dialog.getByLabel('name',{exact:true}).fill(name);
 await dialog.getByLabel('New brand name',{exact:true}).fill(brand);await dialog.getByRole('button',{name:'Use new brand',exact:true}).click();
 await expect(dialog.getByRole('combobox',{name:'Product brand',exact:true})).toContainText(brand);
 await dialog.getByRole('button',{name:'Save changes',exact:true}).click();await expect(dialog).toBeHidden();
 await page.reload();const current=await (await request.get('/api/inventory-suppliers')).json();
 expect(current.data.productBrands).toContain(brand);expect(current.data.products.find(p=>p.name===name).brand).toBe(brand);
 current.data.products=current.data.products.filter(p=>p.name!==name);current.data.productBrands=current.data.productBrands.filter(b=>b!==brand);
 const result=await request.put('/api/inventory-suppliers',{headers,data:{data:current.data,domainVersion:current.domainVersion}});expect(result.status(),await result.text()).toBe(200);await context.close();
});
