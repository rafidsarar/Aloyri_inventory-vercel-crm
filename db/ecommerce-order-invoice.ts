import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { database } from './raw.ts';
import { fixedBusinessName, stateSchema, validateRelations, type State } from '../lib/crm.ts';
import { buildPublicTrackingView } from './ecommerce-order-tracking.ts';
import { renderInvoiceBody } from '../lib/invoice-document.ts';
import { renderInvoicePdf } from '../lib/invoice-pdf.ts';
import { invoiceStyles } from '../lib/invoice-styles.ts';

export function buildCustomerInvoice(state:State,orderNumber:string,phone:string,logo:string){
  const tracking=buildPublicTrackingView(state,orderNumber,phone);
  if(!tracking)return null;
  const order=state.orders.find(row=>row.number===tracking.orderNumber && row.channel==='Website');
  if(!order)return null;
  return {orderNumber:order.number,html:`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>ALOYRI Invoice</title><style>:root{--font-sans:Arial,sans-serif}*{box-sizing:border-box}body{margin:0;background:#fff}.invoice-page{max-width:790px;margin:0 auto}${invoiceStyles}@page{size:A4 portrait;margin:10mm}@media print{.aloyri-invoice{padding:0}.aloyri-order tr,.aloyri-totals{break-inside:avoid}}</style></head><body>${renderInvoiceBody(state,order,logo)}</body></html>`};
}

export async function readEcommerceOrderInvoice(ownerId:string,orderNumber:string,phone:string,format?:'pdf'){
  const row=await database().prepare('SELECT data FROM crm_workspaces WHERE owner_id=?').bind(ownerId).first<{data:string}>();
  if(!row)throw new Error('Workspace not found.');
  const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  validateRelations(state,{skipOrderNumberUniqueness:true});
  // Embed the logo so the downloaded invoice works offline without customer browser storage.
  const logo=state.businessProfile.logoDataUrl||'data:image/webp;base64,'+(await readFile(path.join(process.cwd(),'public/aloyri-logo.webp'))).toString('base64');
  const invoice=buildCustomerInvoice(state,orderNumber,phone,logo);
  if(!invoice)return null;
  if(format!=='pdf')return invoice;
  const order=state.orders.find(row=>row.number===invoice.orderNumber && row.channel==='Website')!;
  const pdf=await renderInvoicePdf(state,order,logo);
  return {...invoice,pdfBase64:pdf.toString('base64')};
}
