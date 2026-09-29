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
  const printInvoice=()=>{
    const source=document.querySelector<HTMLElement>('.invoice-viewer .aloyri-invoice');
    if(!source)return;
    const frame=document.createElement('iframe');
    frame.setAttribute('aria-hidden','true');
    frame.style.position='fixed';frame.style.right='0';frame.style.bottom='0';frame.style.width='0';frame.style.height='0';frame.style.border='0';
    document.body.appendChild(frame);
    const doc=frame.contentDocument;
    if(!doc){frame.remove();return;}
    const clone=source.cloneNode(true) as HTMLElement;
    const originals=[source,...Array.from(source.querySelectorAll<HTMLElement>('*'))];
    const copies=[clone,...Array.from(clone.querySelectorAll<HTMLElement>('*'))];
    originals.forEach((node,index)=>{
      const target=copies[index];if(!target)return;
      const computed=window.getComputedStyle(node);
      for(const property of Array.from(computed))target.style.setProperty(property,computed.getPropertyValue(property),computed.getPropertyPriority(property));
    });
    clone.style.width=source.getBoundingClientRect().width+'px';clone.style.maxWidth='100%';clone.style.margin='0 auto';clone.style.boxShadow='none';clone.style.transform='none';
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><title>ALOYRI Invoice</title><style>@page{size:A4 portrait;margin:10mm}html,body{margin:0;padding:0;background:#fff}body{display:flex;justify-content:center}*{box-sizing:border-box}</style></head><body></body></html>');
    doc.close();
    doc.body.appendChild(clone);
    const images=Array.from(doc.images);
    Promise.all(images.map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve();}))).then(()=>{
      frame.contentWindow?.focus();frame.contentWindow?.print();window.setTimeout(()=>frame.remove(),1500);
    });
  };
  const invoiceBody=<article className="invoice-page aloyri-invoice" aria-label={'ALOYRI invoice '+order.number}>
      <header className="aloyri-masthead">
        <img src={profile.logoDataUrl||'/aloyri-logo.webp'} alt="ALOYRI logo" width={220} height={82}/>
        <div><strong>INVOICE</strong><span>INV-{order.number}</span><small>{date}</small></div>
      </header>
      <div className="aloyri-business">
        <div>{profile.address&&<span className="invoice-address">{profile.address}</span>}{profile.phone&&<span>{profile.phone}</span>}{profile.email&&<span>{profile.email}</span>}{profile.bin&&<span>BIN / VAT: {profile.bin}</span>}</div>
        <div><span><b>Order</b> {order.number}</span><span><b>Payment</b> {order.payment}</span><span><b>Status</b> {paymentStatus}</span></div>
      </div>
      <section className="aloyri-bill"><h3>Bill to</h3><div><div><small>Customer</small><strong>{customer?.name||'Customer'}</strong></div><div><small>Phone</small><strong>{customer?.phone||'—'}</strong></div><div><small>Delivery address</small><strong>{[customer?.address,customer?.city].filter(Boolean).join(', ')||'—'}</strong></div></div></section>
      <section className="aloyri-order"><h3>Items</h3><table><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{order.items.map((item,index)=>{const product=state.products.find(p=>p.id===item.productId);return <tr key={item.productId+'-'+index}><td><strong>{product?.name||'Product'}</strong><small>{[product?.brand,product?.size].filter(Boolean).join(' · ')}</small></td><td>{item.qty}</td><td>{taka(item.price)}</td><td>{taka(item.price*item.qty)}</td></tr>})}</tbody></table></section>
      <div className="aloyri-bottom">
        <div className="aloyri-totals"><div><span>Subtotal</span><strong>{taka(productTotal)}</strong></div>{order.discount>0&&<div><span>Discount</span><strong>− {taka(order.discount)}</strong></div>}<div><span>Delivery</span><strong>{taka(order.deliveryCharge)}</strong></div><div className="aloyri-grand"><span>Total</span><strong>{taka(total(order))}</strong></div></div>
        {profile.returnPolicy&&<section className="aloyri-notes"><h3>Returns and exchanges</h3><p>{profile.returnPolicy}</p></section>}
      </div>
      <footer className="aloyri-footer"><strong>{profile.invoiceFooter||'Thank you for choosing ALOYRI.'}</strong><span>{[profile.phone,profile.email].filter(Boolean).join(' · ')||'Let Your Skin Glow.'}</span></footer>
    </article>;
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="invoice-dialog aloyri-dialog">
    <DialogHeader className="invoice-screen-header"><DialogTitle>Invoice for {order.number}</DialogTitle><DialogDescription>ALOYRI invoice generated from the saved order. Print or save it as a PDF.</DialogDescription></DialogHeader>
    <div className="invoice-viewer">{invoiceBody}</div>
    <div className="invoice-actions"><button type="button" className="btn secondary" onClick={onClose}>Close</button><button type="button" className="btn primary" onClick={printInvoice}><Printer size={16}/><span>Print / Save PDF</span><Download size={15}/></button></div>
  </DialogContent></Dialog>;
}
