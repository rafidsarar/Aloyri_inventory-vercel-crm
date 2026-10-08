import { taka, total, type State, type Order } from './crm.ts';

const esc=(value:unknown)=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/** Shared by the CRM invoice viewer and the customer invoice download. */
export function renderInvoiceBody(state:State,order:Order,defaultLogo='/aloyri-logo.webp'){
  const customer=state.customers.find(row=>row.id===order.customerId);
  const profile=state.businessProfile;
  const date=new Date(order.created+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'});
  const status=order.status==='Cancelled'?'Cancelled':order.status==='Returned'?'Returned':order.settled?'Collection recorded':order.payment==='COD'?'Payment on delivery':'Payment not confirmed';
  const money=(value:number)=>esc(taka(value));
  const rows=order.items.map(item=>{
    const product=state.products.find(row=>row.id===item.productId);
    return `<tr><td><strong>${esc(product?.name||'Product')}</strong><small>${esc([product?.brand,product?.size].filter(Boolean).join(' · '))}</small></td><td>${esc(item.qty)}</td><td>${money(item.price)}</td><td>${money(item.qty*item.price)}</td></tr>`;
  }).join('');
  return `<article class="invoice-page aloyri-invoice" aria-label="ALOYRI invoice ${esc(order.number)}">
<header class="aloyri-masthead"><img src="${esc(profile.logoDataUrl||defaultLogo)}" alt="ALOYRI logo" width="220" height="82"><div><strong>INVOICE</strong><span>INV-${esc(order.number)}</span><small>${esc(date)}</small></div></header>
<div class="aloyri-business"><div>${profile.address?`<span class="invoice-address">${esc(profile.address)}</span>`:''}${[profile.phone,profile.email].filter(Boolean).map(value=>`<span>${esc(value)}</span>`).join('')}${profile.bin?`<span>BIN / VAT: ${esc(profile.bin)}</span>`:''}</div><div><span><b>Order</b> ${esc(order.number)}</span><span><b>Payment</b> ${esc(order.payment)}</span><span><b>Status</b> ${esc(status)}</span></div></div>
<section class="aloyri-bill"><h3>Bill to</h3><div><div><small>Customer</small><strong>${esc(customer?.name||'Customer')}</strong></div><div><small>Phone</small><strong>${esc(customer?.phone||'—')}</strong></div><div><small>Delivery address</small><strong>${esc([customer?.address,customer?.city].filter(Boolean).join(', ')||'—')}</strong></div></div></section>
<section class="aloyri-order"><h3>Items</h3><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table></section>
<div class="aloyri-bottom"><div class="aloyri-totals"><div><span>Subtotal</span><strong>${money(order.items.reduce((sum,item)=>sum+item.qty*item.price,0))}</strong></div>${order.discount>0?`<div><span>Discount</span><strong>− ${money(order.discount)}</strong></div>`:''}<div><span>Delivery</span><strong>${money(order.deliveryCharge)}</strong></div><div class="aloyri-grand"><span>Total</span><strong>${money(total(order))}</strong></div></div>${profile.returnPolicy?`<section class="aloyri-notes"><h3>Returns and exchanges</h3><p>${esc(profile.returnPolicy)}</p></section>`:''}</div>
<footer class="aloyri-footer"><strong>${esc(profile.invoiceFooter||'Thank you for choosing ALOYRI.')}</strong><span>${esc([profile.phone,profile.email].filter(Boolean).join(' · ')||'Let Your Skin Glow.')}</span></footer></article>`;
}
