import { z } from 'zod';
import { database } from './raw.ts';
import {
  createCustomerRecord,
  getCustomerRecord,
  updateCustomerRecord,
  ensureCustomerRecordApiReady,
  type CustomerActor
} from './customer-records.ts';
import { today } from '../lib/crm.ts';
import {
  normalizeBangladeshPhone,
  validBangladeshPhone
} from '../lib/ecommerce-integration.ts';

export const ecommerceCustomerAccountInputSchema=z.object({
  accountId:z.string().regex(/^[a-f0-9]{32}$/),
  email:z.string().trim().toLowerCase().email().max(254),
  name:z.string().trim().min(2).max(120),
  phone:z.string().trim().min(10).max(30),
  address:z.string().trim().max(500).optional().default(''),
  district:z.string().trim().max(80).optional().default(''),
  consent:z.boolean().optional().default(false),
  createdAt:z.string().datetime().optional()
}).strict();

export type EcommerceCustomerAccountInput=z.infer<typeof ecommerceCustomerAccountInputSchema>;

type AccountLinkRow={
  customer_id:string;
  email:string;
  phone:string;
};

async function ensureAccountLinkTable(){
  const db=database();
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS crm_ecommerce_customer_accounts ('+
    'owner_id TEXT NOT NULL, account_id TEXT NOT NULL, customer_id TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,'+
    'PRIMARY KEY (owner_id,account_id))'
  ).run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS crm_ecommerce_customer_email_idx ON crm_ecommerce_customer_accounts(owner_id,email)').run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS crm_ecommerce_customer_phone_idx ON crm_ecommerce_customer_accounts(owner_id,phone)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_ecommerce_customer_customer_idx ON crm_ecommerce_customer_accounts(owner_id,customer_id)').run();
}

function mergeNotes(notes:string,email:string){
  const marker='Website account email: '+email;
  if(notes.includes(marker))return notes;
  return [notes.trim(),marker].filter(Boolean).join('\n').slice(0,2000);
}

export async function upsertEcommerceCustomerAccount(input:{
  ownerId:string;
  account:EcommerceCustomerAccountInput;
  actor:CustomerActor;
}){
  await ensureAccountLinkTable();
  const account=input.account;
  const phone=normalizeBangladeshPhone(account.phone);
  if(!validBangladeshPhone(phone))throw new Error('INVALID_CUSTOMER_PHONE');

  const db=database();
  const prior=await db.prepare(
    'SELECT customer_id,email,phone FROM crm_ecommerce_customer_accounts WHERE owner_id=? AND account_id=?'
  ).bind(input.ownerId,account.accountId).first<AccountLinkRow>();

  const conflictingEmail=await db.prepare(
    'SELECT customer_id,email,phone FROM crm_ecommerce_customer_accounts WHERE owner_id=? AND email=? AND account_id<>?'
  ).bind(input.ownerId,account.email,account.accountId).first<AccountLinkRow>();
  if(conflictingEmail)throw new Error('CUSTOMER_ACCOUNT_EMAIL_CONFLICT');

  const conflictingPhone=await db.prepare(
    'SELECT customer_id,email,phone FROM crm_ecommerce_customer_accounts WHERE owner_id=? AND phone=? AND account_id<>?'
  ).bind(input.ownerId,phone,account.accountId).first<AccountLinkRow>();
  if(conflictingPhone)throw new Error('CUSTOMER_ACCOUNT_PHONE_CONFLICT');

  const ready=await ensureCustomerRecordApiReady(input.ownerId);
  let customerId=prior?.customer_id||'';
  let created=false;

  if(!customerId){
    const existing=ready.state.customers.find(
      customer=>normalizeBangladeshPhone(customer.phone)===phone
    );
    customerId=existing?.id||('web-account-'+account.accountId.slice(0,24));

    if(!existing){
      const result=await createCustomerRecord(input.ownerId,{
        id:customerId,
        name:account.name,
        phone,
        address:account.address,
        city:account.district,
        preference:'Website account',
        notes:mergeNotes('',account.email),
        consent:account.consent,
        created:account.createdAt?.slice(0,10)||today()
      },input.actor);
      customerId=result.customer.id;
      created=true;
    }
  }

  const current=(await getCustomerRecord(input.ownerId,customerId)).customer;
  if(!current)throw new Error('CUSTOMER_LINK_TARGET_MISSING');

  const next={
    id:current.id,
    name:account.name||current.name,
    phone,
    address:account.address||current.address,
    city:account.district||current.city,
    preference:current.preference||'Website account',
    notes:mergeNotes(current.notes||'',account.email),
    consent:current.consent||account.consent,
    created:current.created
  };

  const changed=
    next.name!==current.name||
    next.phone!==current.phone||
    next.address!==current.address||
    next.city!==current.city||
    next.preference!==current.preference||
    next.notes!==current.notes||
    next.consent!==current.consent;

  if(changed){
    await updateCustomerRecord(
      input.ownerId,
      customerId,
      next,
      current.recordVersion,
      input.actor
    );
  }

  const now=new Date().toISOString();
  await db.prepare(
    'INSERT INTO crm_ecommerce_customer_accounts (owner_id,account_id,customer_id,email,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?) '+
    'ON CONFLICT (owner_id,account_id) DO UPDATE SET customer_id=EXCLUDED.customer_id,email=EXCLUDED.email,phone=EXCLUDED.phone,updated_at=EXCLUDED.updated_at'
  ).bind(
    input.ownerId,
    account.accountId,
    customerId,
    account.email,
    phone,
    prior?now:(account.createdAt||now),
    now
  ).run();

  return {
    customerId,
    accountId:account.accountId,
    created,
    linked:true as const
  };
}
