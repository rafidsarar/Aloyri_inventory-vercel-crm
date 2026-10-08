import assert from 'node:assert/strict';
import test from 'node:test';
import { initialState, type State } from '../lib/crm.ts';
import { buildCustomerInvoice } from '../db/ecommerce-order-invoice.ts';
import { renderInvoiceBody } from '../lib/invoice-document.ts';
function trackingState(channel:'Website'|'Facebook'='Website'):State{
  const state=initialState();
  state.customers.push({
    id:'customer-1',
    name:'Customer Name',
    phone:'+8801712345678',
    address:'Private home address',
    city:'Dhaka',
    preference:'Website',
    notes:'Internal customer note',
    consent:false,
    created:'2026-10-01'
  });
  state.orders.push({
    id:'order-1',
    number:'WEB-20261001-ABC123',
    customerId:'customer-1',
    created:'2026-10-01',
    delivered:undefined,
    returnedAt:undefined,
    settledAt:undefined,
    collections:[],
    channel,
    payment:'COD',
    status:'Shipped',
    items:[{
      productId:'cosrx',
      qty:2,
      price:580,
      allocations:[{batchId:'secret-batch',qty:2,unitCost:400}]
    }],
    discount:50,
    deliveryCharge:80,
    courierCost:65,
    packaging:20,
    paymentFee:5,
    returnFee:0,
    settled:false,
    restocked:false,
    tracking:'STEADFAST-123456',
    notes:'Internal order note that must never be exposed'
  });
  return state;
}

test('customer invoice uses the same CRM invoice and includes only customer invoice data',()=>{
 const state=trackingState();
 state.businessProfile.invoiceFooter='Saved CRM footer';
 state.businessProfile.returnPolicy='Saved CRM policy';
 const invoice=buildCustomerInvoice(state,'WEB-20261001-ABC123','01712345678','data:image/webp;base64,AA==');
 assert.ok(invoice);
 assert.ok(invoice.html.includes(renderInvoiceBody(state,state.orders[0],'data:image/webp;base64,AA==')));
 for(const value of ['INV-WEB-20261001-ABC123','Private home address','Saved CRM footer','Saved CRM policy','Payment on delivery'])assert.ok(invoice.html.includes(value));
 for(const value of ['secret-batch','Internal customer note','Internal order note','unitCost','courierCost'])assert.ok(!invoice.html.includes(value));
 assert.equal(buildCustomerInvoice(state,'WEB-20261001-ABC123','01812345678',''),null);
 assert.equal(buildCustomerInvoice(trackingState('Facebook'),'WEB-20261001-ABC123','01712345678',''),null);
});
test('CRM invoice escapes customer and business content and reflects recorded payment',()=>{
 const state=trackingState();
 state.customers[0].name='<script>alert("x")</script>';
 state.businessProfile.invoiceFooter='<img src=x onerror=alert(1)>';
 state.orders[0].settled=true;
 const html=buildCustomerInvoice(state,'WEB-20261001-ABC123','01712345678','data:image/webp;base64,AA==')!.html;
 assert.ok(html.includes('&lt;script&gt;'));
 assert.ok(!html.includes('<script>'));
 assert.ok(!html.includes('<img src=x'));
 assert.ok(html.includes('Collection recorded'));
 state.orders[0].status='Cancelled';
 assert.ok(renderInvoiceBody(state,state.orders[0]).includes('<b>Status</b> Cancelled'));
});

test('PDF downloads contain a genuine embedded-font invoice and paginate long orders',async()=>{
 const {renderInvoicePdf}=await import('../lib/invoice-pdf.ts');
 const {readFile}=await import('node:fs/promises');
 const state=trackingState();
 state.customers[0].name='রাফিদ / Customer Name';
 const logo='data:image/webp;base64,'+(await readFile('public/aloyri-logo.webp')).toString('base64');
 const pdf=await renderInvoicePdf(state,state.orders[0],logo);
 assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
 assert.ok(pdf.toString('latin1').includes('/FontFile2'));
 assert.equal((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length,1);
 state.orders[0].items=Array.from({length:50},()=>({...state.orders[0].items[0]}));
 const long=await renderInvoicePdf(state,state.orders[0],logo);
 assert.ok((long.toString('latin1').match(/\/Type \/Page\b/g)||[]).length>1);
});
