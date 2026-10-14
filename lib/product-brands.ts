import type { State } from './crm.ts';

export const brandKey=(name:string)=>name.trim().toLowerCase();
export function productBrands(s:Pick<State,'products'|'productBrands'>):string[]{
  const names=new Map<string,string>();
  for(const value of [...(s.productBrands||[]),...s.products.map(p=>p.brand)]){
    const name=value.trim();if(name&&!names.has(brandKey(name)))names.set(brandKey(name),name);
  }
  return [...names.values()];
}
export function normalizeProductBrands(s:State):State{
  const brands=productBrands(s),names=new Map(brands.map(name=>[brandKey(name),name]));
  return {...s,productBrands:brands,products:s.products.map(p=>({...p,brand:names.get(brandKey(p.brand))||''}))};
}
export function saveProductBrand(s:State,name:string,previous?:string):State{
  name=name.trim();if(!name||name.length>160)throw Error('Enter a brand name of up to 160 characters.');
  const next=normalizeProductBrands(structuredClone(s));
  if(previous&&!next.productBrands.includes(previous))throw Error('This brand no longer exists. Reload and try again.');
  if(next.productBrands.some(b=>brandKey(b)===brandKey(name)&&b!==previous))throw Error('This brand already exists.');
  if(previous){next.productBrands=next.productBrands.map(b=>b===previous?name:b);next.products=next.products.map(p=>brandKey(p.brand)===brandKey(previous)?{...p,brand:name}:p);}
  else next.productBrands.push(name);
  return next;
}
export function deleteProductBrand(s:State,name:string):State{
  if(s.products.some(p=>brandKey(p.brand)===brandKey(name)))throw Error('Move products to another brand before deleting this brand.');
  const next=normalizeProductBrands(structuredClone(s));next.productBrands=next.productBrands.filter(b=>brandKey(b)!==brandKey(name));return next;
}
export function validateBrandRemoval(current:State,next:State){
  for(const name of current.productBrands||[])if(!(next.productBrands||[]).some(b=>brandKey(b)===brandKey(name))&&next.products.some(p=>brandKey(p.brand)===brandKey(name)))throw Error('Move products to another brand before deleting this brand.');
}
