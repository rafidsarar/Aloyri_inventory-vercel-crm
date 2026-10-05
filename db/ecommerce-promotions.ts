import { database } from './raw.ts';
import { fixedBusinessName,stateSchema,type State } from '../lib/crm.ts';
import {
  catalogPromotionForProduct,
  ecommercePromotionInputSchema,
  evaluatePromotionQuote,
  normalizePromotionCode,
  type EcommercePromotion,
  type EcommercePromotionInput,
  type EcommercePromotionQuoteInput,
  type PromotionLine
} from '../lib/ecommerce-promotions.ts';

type PromotionRow={
  id:string;
  name:string;
  code:string|null;
  description:string;
  kind:'percentage'|'fixed';
  value:number|string;
  minimum_subtotal:number|string;
  starts_at:string|null;
  ends_at:string|null;
  usage_limit:number|string|null;
  used_count:number|string;
  target_type:'all'|'products'|'categories';
  target_ids_json:string;
  free_shipping:boolean;
  badge_text:string;
  priority:number|string;
  active:boolean;
  created_at:string;
  updated_at:string;
};

function rowToPromotion(row:PromotionRow):EcommercePromotion{
  let targetIds:string[]=[];
  try{
    const parsed=JSON.parse(row.target_ids_json);
    if(Array.isArray(parsed))targetIds=parsed.filter(value=>typeof value==='string');
  }catch{}
  return {
    id:row.id,
    name:row.name,
    code:row.code||'',
    description:row.description||'',
    kind:row.kind,
    value:Number(row.value),
    minimumSubtotal:Number(row.minimum_subtotal),
    startsAt:row.starts_at||'',
    endsAt:row.ends_at||'',
    usageLimit:row.usage_limit===null?null:Number(row.usage_limit),
    usedCount:Number(row.used_count||0),
    targetType:row.target_type,
    targetIds,
    freeShipping:Boolean(row.free_shipping),
    badgeText:row.badge_text||'',
    priority:Number(row.priority||0),
    active:Boolean(row.active),
    createdAt:row.created_at,
    updatedAt:row.updated_at
  };
}

export async function listEcommercePromotions(ownerId:string,includeInactive=true){
  const where=includeInactive?'':' AND p.active=TRUE';
  const rows=await database().prepare(
    `SELECT p.*,
      (SELECT COUNT(*) FROM crm_ecommerce_promotion_redemptions r WHERE r.owner_id=p.owner_id AND r.promotion_id=p.id) AS used_count
     FROM crm_ecommerce_promotions p
     WHERE p.owner_id=?${where}
     ORDER BY p.active DESC,p.priority DESC,p.updated_at DESC`
  ).bind(ownerId).all<PromotionRow>();
  return rows.results.map(rowToPromotion);
}

export async function readPromotionWorkspace(ownerId:string){
  const row=await database().prepare('SELECT data FROM crm_workspaces WHERE owner_id=?')
    .bind(ownerId).first<{data:string}>();
  if(!row)throw new Error('Workspace not found.');
  return fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
}

export async function listPromotionCatalogOptions(ownerId:string){
  const state=await readPromotionWorkspace(ownerId);
  const products=state.products
    .filter(product=>product.active)
    .map(product=>({
      id:product.id,
      name:product.name,
      brand:product.brand,
      category:product.category
    }))
    .sort((a,b)=>a.name.localeCompare(b.name));
  const categories=[...new Set(products.map(product=>product.category))].sort();
  return {products,categories};
}

export async function createEcommercePromotion(ownerId:string,input:unknown){
  const promotion=ecommercePromotionInputSchema.parse(input);
  const now=new Date().toISOString();
  const id='promo-'+crypto.randomUUID();
  const code=normalizePromotionCode(promotion.code);
  const targetIds=[...new Set(promotion.targetIds)];
  try{
    await database().prepare(
      'INSERT INTO crm_ecommerce_promotions (owner_id,id,name,code,description,kind,value,minimum_subtotal,starts_at,ends_at,usage_limit,target_type,target_ids_json,free_shipping,badge_text,priority,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    ).bind(
      ownerId,id,promotion.name,code||null,promotion.description,promotion.kind,promotion.value,
      promotion.minimumSubtotal,promotion.startsAt||null,promotion.endsAt||null,promotion.usageLimit,
      promotion.targetType,JSON.stringify(targetIds),promotion.freeShipping,promotion.badgeText,
      promotion.priority,promotion.active,now,now
    ).run();
  }catch(error){
    if(String(error).toLowerCase().includes('unique'))throw new Error('PROMOTION_CODE_EXISTS');
    throw error;
  }
  return (await listEcommercePromotions(ownerId,true)).find(item=>item.id===id)!;
}

export async function updateEcommercePromotion(ownerId:string,id:string,input:unknown){
  const promotion=ecommercePromotionInputSchema.parse(input);
  const code=normalizePromotionCode(promotion.code);
  const targetIds=[...new Set(promotion.targetIds)];
  const now=new Date().toISOString();
  try{
    const result=await database().prepare(
      'UPDATE crm_ecommerce_promotions SET name=?,code=?,description=?,kind=?,value=?,minimum_subtotal=?,starts_at=?,ends_at=?,usage_limit=?,target_type=?,target_ids_json=?,free_shipping=?,badge_text=?,priority=?,active=?,updated_at=? WHERE owner_id=? AND id=?'
    ).bind(
      promotion.name,code||null,promotion.description,promotion.kind,promotion.value,
      promotion.minimumSubtotal,promotion.startsAt||null,promotion.endsAt||null,promotion.usageLimit,
      promotion.targetType,JSON.stringify(targetIds),promotion.freeShipping,promotion.badgeText,
      promotion.priority,promotion.active,now,ownerId,id
    ).run();
    if(!result.meta.changes)throw new Error('PROMOTION_NOT_FOUND');
  }catch(error){
    if(String(error).toLowerCase().includes('unique'))throw new Error('PROMOTION_CODE_EXISTS');
    throw error;
  }
  return (await listEcommercePromotions(ownerId,true)).find(item=>item.id===id)!;
}

export async function deleteEcommercePromotion(ownerId:string,id:string){
  const used=await database().prepare(
    'SELECT COUNT(*) AS n FROM crm_ecommerce_promotion_redemptions WHERE owner_id=? AND promotion_id=?'
  ).bind(ownerId,id).first<{n:number|string}>();
  if(Number(used?.n||0)>0)throw new Error('PROMOTION_HAS_HISTORY');
  const result=await database().prepare(
    'DELETE FROM crm_ecommerce_promotions WHERE owner_id=? AND id=?'
  ).bind(ownerId,id).run();
  if(!result.meta.changes)throw new Error('PROMOTION_NOT_FOUND');
}

export function buildPromotionLines(state:State,items:EcommercePromotionQuoteInput['items']){
  const combined=new Map<string,number>();
  for(const item of items)combined.set(item.productId,(combined.get(item.productId)||0)+item.qty);
  const lines:PromotionLine[]=[];
  for(const [productId,qty] of combined){
    const product=state.products.find(candidate=>candidate.id===productId);
    if(!product||!product.active)throw new Error('PRODUCT_UNAVAILABLE:'+productId);
    lines.push({
      productId,
      category:product.category,
      qty,
      price:product.price
    });
  }
  return lines;
}

export async function quoteEcommercePromotion(input:{
  ownerId:string;
  state:State;
  items:EcommercePromotionQuoteInput['items'];
  deliveryCharge:number;
  code?:string;
}){
  const promotions=await listEcommercePromotions(input.ownerId,true);
  return evaluatePromotionQuote({
    promotions,
    lines:buildPromotionLines(input.state,input.items),
    deliveryCharge:input.deliveryCharge,
    code:input.code
  });
}

export async function catalogPromotionMap(ownerId:string,state:State){
  const promotions=await listEcommercePromotions(ownerId,true);
  return new Map(state.products.map(product=>[
    product.id,
    catalogPromotionForProduct(promotions,{
      id:product.id,
      category:product.category,
      price:product.price
    })
  ]));
}
