import assert from 'node:assert/strict';
import { database } from '../db/raw.ts';
import { promotionRedemptionGuardSql } from '../lib/ecommerce-promotion-redemption.ts';

const testDatabaseUrl=process.env.SKINVENTORY_DB_DATABASE_URL||process.env.DATABASE_URL||'';
if(process.env.E2E_LOCAL_POSTGRES!=='1'||!/^postgres(?:ql)?:\/\/(?:[^@]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(testDatabaseUrl))throw new Error('Disposable local PostgreSQL required.');
const db=database(),ownerId='promotion-redemption-regression',promoId='active-fixture',now=new Date().toISOString();
await db.prepare("INSERT INTO crm_ecommerce_promotions(owner_id,id,name,code,kind,value,usage_limit,active,created_at,updated_at) VALUES (?,?,?,'FIXTURE','percentage',10,1,TRUE,?,?)").bind(ownerId,promoId,'Active fixture',now,now).run();
const redemption=(id:string)=>db.prepare(
 "INSERT INTO crm_ecommerce_promotion_redemptions(owner_id,id,promotion_id,order_id,order_number,customer_phone,promotion_code,created_at) SELECT ?,?,?,?,?,'01712345678','FIXTURE',? FROM crm_ecommerce_promotions p WHERE p.owner_id=? AND p.id=? AND (p.usage_limit IS NULL OR (SELECT COUNT(*) FROM crm_ecommerce_promotion_redemptions r WHERE r.owner_id=p.owner_id AND r.promotion_id=p.id)<p.usage_limit) ON CONFLICT(owner_id,order_id) DO NOTHING"
).bind(ownerId,'redemption-'+id,promoId,id,'WEB-FIXTURE-'+id,now,ownerId,promoId);
const guard=(id:string,owner=ownerId)=>db.prepare(promotionRedemptionGuardSql).bind(owner,id,promoId);
await assert.rejects(()=>guard('not-created').run(),/PROMOTION_LIMIT_REACHED/);
await db.batch([redemption('first'),guard('first')]);
let count=await db.prepare('SELECT COUNT(*) AS n FROM crm_ecommerce_promotion_redemptions WHERE owner_id=?').bind(ownerId).first<{n:number|string}>();assert.equal(Number(count!.n),1);
// A replay of an existing redemption remains valid and cannot consume another use.
await db.batch([redemption('first'),guard('first')]);
await assert.rejects(()=>guard('first','another-owner').run(),/PROMOTION_LIMIT_REACHED/);
await assert.rejects(()=>db.batch([
 db.prepare('UPDATE crm_ecommerce_promotions SET name=? WHERE owner_id=? AND id=?').bind('Must roll back',ownerId,promoId),
 redemption('second'),guard('second')
]),/PROMOTION_LIMIT_REACHED/);
const promotion=await db.prepare('SELECT name FROM crm_ecommerce_promotions WHERE owner_id=? AND id=?').bind(ownerId,promoId).first<{name:string}>();assert.equal(promotion!.name,'Active fixture');
count=await db.prepare('SELECT COUNT(*) AS n FROM crm_ecommerce_promotion_redemptions WHERE owner_id=?').bind(ownerId).first<{n:number|string}>();assert.equal(Number(count!.n),1);
await db.prepare('UPDATE crm_ecommerce_promotions SET usage_limit=NULL WHERE owner_id=? AND id=?').bind(ownerId,promoId).run();
await db.batch([redemption('second'),guard('second')]);
count=await db.prepare('SELECT COUNT(*) AS n FROM crm_ecommerce_promotion_redemptions WHERE owner_id=?').bind(ownerId).first<{n:number|string}>();assert.equal(Number(count!.n),2);
console.log('Promotion redemption checks passed: valid acceptance, replay, tenant isolation, usage limit rejection, rollback and unlimited promotions.');
