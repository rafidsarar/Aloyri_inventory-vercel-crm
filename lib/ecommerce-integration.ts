import { z } from 'zod';
import { database } from '@/db/raw';

const enc=new TextEncoder();
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');

export const ecommerceOrderInputSchema=z.object({
  externalOrderId:z.string().trim().min(8).max(100).regex(/^[A-Za-z0-9_-]+$/),
  customer:z.object({
    name:z.string().trim().min(2).max(200),
    phone:z.string().trim().min(10).max(30),
    address:z.string().trim().min(8).max(1000),
    district:z.string().trim().min(2).max(100),
    area:z.string().trim().min(2).max(200),
    landmark:z.string().trim().max(300).optional().default(''),
    notes:z.string().trim().max(700).optional().default('')
  }).strict(),
  items:z.array(z.object({
    productId:z.string().trim().min(1).max(100),
    qty:z.number().int().min(1).max(100)
  }).strict()).min(1).max(50),
  deliveryZone:z.enum(['inside-dhaka','outside-dhaka']),
  paymentMethod:z.enum(['COD','bKash','Nagad'])
}).strict();

export type EcommerceOrderInput=z.infer<typeof ecommerceOrderInputSchema>;

export function normalizeBangladeshPhone(value:string){
  const compact=value.trim().replace(/[\s()-]/g,'');
  if(/^01[3-9]\d{8}$/.test(compact))return compact;
  if(/^8801[3-9]\d{8}$/.test(compact))return '0'+compact.slice(3);
  if(/^\+8801[3-9]\d{8}$/.test(compact))return '0'+compact.slice(4);
  return compact;
}

export function validBangladeshPhone(value:string){
  return /^01[3-9]\d{8}$/.test(normalizeBangladeshPhone(value));
}

export async function sha256Hex(value:string){
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',enc.encode(value))));
}

export async function hmacSha256Hex(secret:string,value:string){
  const key=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC',key,enc.encode(value))));
}

function constantTimeHexEqual(left:string,right:string){
  const a=left.toLowerCase(),b=right.toLowerCase();
  let diff=a.length^b.length;
  const length=Math.max(a.length,b.length);
  for(let i=0;i<length;i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);
  return diff===0;
}

export async function verifyEcommerceSignature(input:{
  method:string;
  path:string;
  integrationId:string;
  timestamp:string;
  nonce:string;
  idempotencyKey:string;
  body:string;
  signature:string;
}){
  const configuredId=(process.env.ECOMMERCE_INTEGRATION_ID||'').trim();
  const secret=process.env.ECOMMERCE_INTEGRATION_SECRET||'';
  if(!configuredId||!secret)throw new Error('INTEGRATION_NOT_CONFIGURED');
  if(input.integrationId!==configuredId)throw new Error('INTEGRATION_AUTH_FAILED');
  if(!/^\d{10,13}$/.test(input.timestamp))throw new Error('INTEGRATION_AUTH_FAILED');
  const numeric=Number(input.timestamp),seconds=input.timestamp.length===13?Math.floor(numeric/1000):numeric;
  if(!Number.isFinite(seconds)||Math.abs(Math.floor(Date.now()/1000)-seconds)>300)throw new Error('INTEGRATION_TIMESTAMP_EXPIRED');
  if(!/^[A-Za-z0-9_-]{8,120}$/.test(input.nonce))throw new Error('INTEGRATION_AUTH_FAILED');
  if(!/^[A-Za-z0-9:_-]{8,160}$/.test(input.idempotencyKey))throw new Error('INTEGRATION_AUTH_FAILED');
  if(!/^[a-fA-F0-9]{64}$/.test(input.signature))throw new Error('INTEGRATION_AUTH_FAILED');
  const bodyHash=await sha256Hex(input.body);
  const canonical=[
    input.method.toUpperCase(),
    input.path,
    input.integrationId,
    input.timestamp,
    input.nonce,
    input.idempotencyKey,
    bodyHash
  ].join('\n');
  const expected=await hmacSha256Hex(secret,canonical);
  if(!constantTimeHexEqual(expected,input.signature))throw new Error('INTEGRATION_AUTH_FAILED');
  return {bodyHash};
}

export async function resolveEcommerceOwnerId(){
  const configured=(process.env.ECOMMERCE_OWNER_ID||'').trim();
  if(configured)return configured;
  const rows=await database().prepare(
    "SELECT DISTINCT owner_id FROM crm_users WHERE role='owner' AND active=1 ORDER BY owner_id LIMIT 2"
  ).all<{owner_id:string}>();
  if(rows.results.length!==1)throw new Error('ECOMMERCE_WORKSPACE_NOT_CONFIGURED');
  return rows.results[0].owner_id;
}

export async function consumeEcommerceNonce(integrationId:string,nonce:string){
  const db=database(),now=new Date(),createdAt=now.toISOString(),expiresAt=new Date(now.getTime()+10*60*1000).toISOString();
  await db.prepare('DELETE FROM crm_ecommerce_nonces WHERE expires_at<=?').bind(createdAt).run();
  try{
    await db.prepare('INSERT INTO crm_ecommerce_nonces (integration_id,nonce,expires_at,created_at) VALUES (?,?,?,?)')
      .bind(integrationId,nonce,expiresAt,createdAt).run();
  }catch{
    throw new Error('INTEGRATION_REPLAYED_REQUEST');
  }
}

export function ecommerceDeliveryCharge(zone:EcommerceOrderInput['deliveryZone']){
  const key=zone==='inside-dhaka'?'ECOMMERCE_DELIVERY_DHAKA_BDT':'ECOMMERCE_DELIVERY_OUTSIDE_DHAKA_BDT';
  const raw=(process.env[key]||'').trim();
  if(!/^\d+(?:\.\d{1,2})?$/.test(raw))throw new Error('DELIVERY_RATE_NOT_CONFIGURED');
  const value=Number(raw);
  if(!Number.isFinite(value)||value<0||value>100000)throw new Error('DELIVERY_RATE_NOT_CONFIGURED');
  return value;
}

export async function enforceEcommerceRateLimit(ownerId:string,integrationId:string){
  const since=new Date(Date.now()-60_000).toISOString();
  const row=await database().prepare(
    'SELECT COUNT(*) AS n FROM crm_ecommerce_requests WHERE owner_id=? AND integration_id=? AND created_at>=?'
  ).bind(ownerId,integrationId,since).first<{n:number|string}>();
  if(Number(row?.n||0)>=60)throw new Error('INTEGRATION_RATE_LIMITED');
}
