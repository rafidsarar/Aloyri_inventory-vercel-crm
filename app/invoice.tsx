'use client';
import React from 'react';
import { Download, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { State, Order, taka, total } from '@/lib/crm';

export default function Invoice({state,order,onClose}:{state:State;order:Order|null;onClose:()=>void}){
  if(!order)return null;
  const customer=state.customers.find(c=>c.id===order.customerId);
  const profile=state.businessProfile;
  const productTotal=order.items.reduce((sum,item)=>sum+item.qty*item.price,0);
  const date=new Date(order.created+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'});
  const paymentStatus=order.status==='Cancelled'?'Cancelled':order.status==='Returned'?'Returned':order.settled?'Collection recorded':order.payment==='COD'?'Payment on delivery':'Payment not confirmed';
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="invoice-dialog aloyri-dialog">
    <DialogHeader className="invoice-screen-header"><DialogTitle>Invoice for {order.number}</DialogTitle><DialogDescription>ALOYRI invoice generated from the saved order. Print or save it as a PDF.</DialogDescription></DialogHeader>
    <div className="invoice-page aloyri-invoice" aria-label={'ALOYRI invoice '+order.number}>
      <header className="aloyri-masthead"><img src="/aloyri-logo.webp" alt="ALOYRI — Let Your Skin Glow" width={265} height={100}/><div><strong>INVOICE</strong><span># INV-{order.number}</span><small>Order ID: {order.number}</small></div></header>
      <div className="aloyri-business"><div><strong>ALOYRI</strong><span>Premium Skincare | Let Your Skin Glow.</span>{profile.address&&<span className="invoice-address">{profile.address}</span>}{(profile.phone||profile.email)&&<span>{profile.phone&&<>Phone: {profile.phone}</>}{profile.phone&&profile.email?' | ':''}{profile.email&&<>Email: {profile.email}</>}</span>}{profile.bin&&<span>BIN/VAT: {profile.bin}</span>}</div><div><span>Invoice Date: {date}</span><span>Payment Method: {order.payment}</span><span>Payment Status: {paymentStatus}</span></div></div>
      <section className="aloyri-bill"><h3>BILL TO</h3><div><div><small>CUSTOMER NAME</small><strong>{customer?.name||'Customer'}</strong></div><div><small>PHONE</small><strong>{customer?.phone||'—'}</strong></div><div><small>DELIVERY ADDRESS</small><strong>{[customer?.address,customer?.city].filter(Boolean).join(', ')||'—'}</strong></div></div></section>
      <section className="aloyri-order"><h3>ORDER DETAILS</h3><table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit Price</th><th>Amount</th></tr></thead><tbody>{Array.from({length:Math.max(5,order.items.length)},(_,index)=>{const item=order.items[index],product=item&&state.products.find(p=>p.id===item.productId);return item?<tr key={item.productId+'-'+index}><td>{index+1}</td><td><strong>{product?.name||'Product'}</strong><small>{[product?.brand,product?.size].filter(Boolean).join(' · ')}</small></td><td>{item.qty}</td><td>{taka(item.price)}</td><td>{taka(item.price*item.qty)}</td></tr>:<tr className="aloyri-empty-row" key={'blank-'+index} aria-hidden="true"><td>{index+1}</td><td/><td/><td/><td/></tr>})}</tbody></table></section>
      <div className="aloyri-bottom"><section className="aloyri-notes"><h3>NOTES</h3><p>• All amounts are in Bangladeshi Taka (BDT).</p><p>• Returns and exchanges are subject to ALOYRI’s published return policy.</p><p>• Please keep this invoice for order support and returns.</p></section><div className="aloyri-totals"><div><span>Subtotal</span><strong>{taka(productTotal)}</strong></div><div><span>Discount</span><strong>− {taka(order.discount)}</strong></div><div><span>Delivery</span><strong>{taka(order.deliveryCharge)}</strong></div><div className="aloyri-grand"><span>Grand Total</span><strong>{taka(total(order))}</strong></div></div></div>
      <footer className="aloyri-footer"><strong>Thank you for choosing ALOYRI</strong><span>Let Your Skin Glow.{(profile.phone||profile.email)&&<> | Customer Care: {[profile.phone,profile.email].filter(Boolean).join(' | ')}</>}</span></footer>
    </div>
    <div className="invoice-actions"><button type="button" className="btn secondary" onClick={onClose}>Close</button><button type="button" className="btn primary" onClick={()=>window.print()}><Printer size={16}/><span>Print / Save PDF</span><Download size={15}/></button></div>
  </DialogContent></Dialog>;
}
