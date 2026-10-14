import type { State } from './crm.ts';

/** Case insensitive matching is for names only; IDs remain unchanged on rename. */
export const brandKey=(name:string)=>name.trim().toLocaleLowerCase('en');
export const legacyBrandId=(name:string)=>'crm-brand-'+encodeURIComponent(brandKey(name));

export function productBrands(s:Pick<State,'products'|'productBrands'>):string[]{
  const names=new Map<string,string>();
  for(const value of [...(s.productBrands||[]),...s.products.map(p=>p.brand)]){
    const name=value.trim();
    if(name&&!names.has(brandKey(name)))names.set(brandKey(name),name);
  }
  return [...names.values()];
}
export function normalizeProductBrands(s:State):State{
  const brands=productBrands(s),names=new Map(brands.map(name=>[brandKey(name),name]));
  const existing=s.productBrandIds||{};
  const ids:Record<string,string>={};
  for(const name of brands){
    const key=brandKey(name);
    ids[key]=existing[key]||legacyBrandId(name);
  }
  return {...s,productBrands:brands,productBrandIds:ids,products:s.products.map(p=>({...p,brand:names.get(brandKey(p.brand))||''}))};
}
export function saveProductBrand(s:State,name:string,previous?:string):State{
  name=name.trim();
  if(!name||name.length>160)throw Error('Enter a brand name of up to 160 characters.');
  const next=normalizeProductBrands(structuredClone(s));
  if(previous&&!next.productBrands.includes(previous))throw Error('This brand no longer exists. Reload and try again.');
  if(next.productBrands.some(b=>brandKey(b)===brandKey(name)&&b!==previous))throw Error('This brand already exists.');
  if(previous){
    const oldKey=brandKey(previous),newKey=brandKey(name);
    const id=next.productBrandIds[oldKey];
    next.productBrands=next.productBrands.map(b=>b===previous?name:b);
    next.products=next.products.map(p=>brandKey(p.brand)===oldKey?{...p,brand:name}:p);
    delete next.productBrandIds[oldKey];
    next.productBrandIds[newKey]=id;
  }else next.productBrands.push(name);
  return normalizeProductBrands(next);
}
export function deleteProductBrand(s:State,name:string):State{
  if(s.products.some(p=>brandKey(p.brand)===brandKey(name)))throw Error('Move products to another brand before deleting this brand.');
  const next=normalizeProductBrands(structuredClone(s));
  next.productBrands=next.productBrands.filter(b=>brandKey(b)!==brandKey(name));
  delete next.productBrandIds[brandKey(name)];
  return next;
}
export function validateBrandRemoval(current:State,next:State){
  for(const name of current.productBrands||[])
    if(!(next.productBrands||[]).some(b=>brandKey(b)===brandKey(name))&&next.products.some(p=>brandKey(p.brand)===brandKey(name)))
      throw Error('Move products to another brand before deleting this brand.');
}
