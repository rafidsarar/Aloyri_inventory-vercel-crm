import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState,stateSchema,fixedBusinessName,validateRelations } from '../lib/crm.ts';
import { productBrands,normalizeProductBrands,saveProductBrand,deleteProductBrand } from '../lib/product-brands.ts';
import { applyRoleChanges,visibleState,validateWorkspaceChange } from '../lib/role-data.ts';
import type { WorkspaceRole } from '../lib/roles.ts';

test('legacy brands migrate without losing products, prices or quantities',()=>{
 const {productBrands:_brands,...legacy}=initialState();void _brands;
 legacy.products=[{...legacy.products[0],brand:' COSRX '},{...legacy.products[0],id:'second',brand:'cosrx'},{...legacy.products[0],id:'third',brand:''}];
 const migrated=fixedBusinessName(stateSchema.parse(legacy));
 assert.deepEqual(migrated.productBrands,['COSRX']);assert.deepEqual(migrated.products.map(p=>p.brand),['COSRX','COSRX','']);
 for(let i=0;i<3;i++)assert.deepEqual({...migrated.products[i],brand:legacy.products[i].brand},legacy.products[i]);
 assert.deepEqual(normalizeProductBrands(migrated),migrated);
});
test('unused brands persist; rename updates all assignments; used deletion is blocked',()=>{
 let s=normalizeProductBrands(initialState());s=saveProductBrand(s,'Unused');
 assert.ok(fixedBusinessName(stateSchema.parse(JSON.parse(JSON.stringify(s)))).productBrands.includes('Unused'));
 const before=s.products.map(p=>({...p})),old=s.products[0].brand;
 s=saveProductBrand(s,'Renamed',old);assert.equal(s.products[0].brand,'Renamed');
 assert.deepEqual(s.products.map((p,i)=>({...p,brand:before[i].brand})),before);
 assert.throws(()=>deleteProductBrand(s,'renamed'),/Move products/);
 const illegal=structuredClone(s);illegal.productBrands=illegal.productBrands.filter(b=>b!=='Renamed');
 assert.throws(()=>applyRoleChanges(s,illegal,'owner'),/Move products/);
 assert.throws(()=>validateWorkspaceChange(s,illegal),/Move products/);
 s=deleteProductBrand(s,'Unused');assert.ok(!productBrands(s).includes('Unused'));
 assert.throws(()=>saveProductBrand(s,' renamed '),/already exists/);
 assert.throws(()=>saveProductBrand(s,' '),/Enter a brand/);
 const duplicate=structuredClone(s);duplicate.productBrands.push('renamed');assert.throws(()=>validateRelations(duplicate),/unique/);
});
for(const role of ['owner','admin','inventory','sales','finance','viewer'] as WorkspaceRole[]){
 test(`brand changes enforce ${role} permissions`,()=>{
  const s=normalizeProductBrands(initialState()),visible=visibleState(s,role),next=saveProductBrand(visible,'Role brand');
  if(['owner','admin','inventory'].includes(role))assert.ok(applyRoleChanges(s,next,role).productBrands.includes('Role brand'));
  else assert.throws(()=>applyRoleChanges(s,next,role),/role cannot change/);
 });
}


test('brand IDs stay stable across a CRM rename and survive workspace serialization',()=>{
  let state=normalizeProductBrands(initialState());
  const original='Simple',initialId=state.productBrandIds['simple'];
  assert.ok(initialId);
  state=saveProductBrand(state,'Simple Skincare',original);
  assert.equal(state.productBrandIds['simple'],undefined);
  assert.equal(state.productBrandIds['simple skincare'],initialId);
  const restored=fixedBusinessName(stateSchema.parse(JSON.parse(JSON.stringify(state))));
  assert.equal(restored.productBrandIds['simple skincare'],initialId);
  state=saveProductBrand(restored,'Independent Label');
  assert.ok(state.productBrandIds['independent label']);
  state=deleteProductBrand(state,'Independent Label');
  assert.equal(state.productBrandIds['independent label'],undefined);
});
test('legacy workspaces produce deterministic public-safe brand IDs',()=>{
  const state=initialState();
  delete (state as any).productBrandIds;
  const first=normalizeProductBrands(stateSchema.parse(state));
  const second=normalizeProductBrands(stateSchema.parse(state));
  assert.deepEqual(first.productBrandIds,second.productBrandIds);
  assert.equal(Object.keys(first.productBrandIds).length,first.productBrands.length);
});
