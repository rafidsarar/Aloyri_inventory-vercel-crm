'use client';
import React from 'react';
import { Download, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { State, Order, taka, total } from '@/lib/crm';

export default function Invoice({state,order,onClose}:{state:State;order:Order|null;onClose:()=>void}){
  if(!order)return null;
  const customer=state.customers.find(c=>c.id===order.customerId);
  const productTotal=order.items.reduce((sum,item)=>sum+item.qty*item.price,0);
  const date=new Date(order.created+'T12:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Dhaka'});
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="invoice-dialog">
    <DialogHeader className="invoice-screen-header"><DialogTitle>Invoice for {order.number}</DialogTitle><DialogDescription>Generated from the saved order. Print or save it as a PDF.</DialogDescription></DialogHeader>
    <div className="invoice-page" aria-label={'Invoice '+order.number}>
      <header className="invoice-heading"><div><div className="invoice-brand">{state.businessName}</div><p>Customer invoice · Bangladesh</p></div><div className="invoice-heading-number"><strong>INVOICE</strong><span>INV-{order.number}</span></div></header>
      <div className="invoice-meta"><div><span>Bill to</span><strong>{customer?.name||'Customer'}</strong>{customer?.phone&&<p>{customer.phone}</p>}{customer?.address&&<p>{customer.address}</p>}{customer?.city&&<p>{customer.city}</p>}</div><div><div><span>Invoice date</span><strong>{date}</strong></div><div><span>Order reference</span><strong>{order.number}</strong></div><div><span>Payment method</span><strong>{order.payment}</strong></div></div></div>
      <table className="invoice-items"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{order.items.map((item,index)=>{const product=state.products.find(p=>p.id===item.productId);return <tr key={item.productId+'-'+index}><td><strong>{product?.name||'Product'}</strong><small>{product?.brand}{product?.size?' · '+product.size:''}</small></td><td>{item.qty}</td><td>{taka(item.price)}</td><td>{taka(item.price*item.qty)}</td></tr>})}</tbody></table>
      <div className="invoice-totals"><div><span>Products</span><strong>{taka(productTotal)}</strong></div>{order.discount>0&&<div><span>Discount</span><strong>− {taka(order.discount)}</strong></div>}<div><span>Delivery</span><strong>{taka(order.deliveryCharge)}</strong></div><div className="invoice-grand-total"><span>Grand total (BDT)</span><strong>{taka(total(order))}</strong></div></div>
      <div className="invoice-payment"><strong>{order.status==='Cancelled'?'Order cancelled':order.status==='Returned'?'Order returned':order.settled?'Collection recorded':order.payment==='COD'?'Payment on delivery':'Payment status not confirmed'}</strong><span>{order.settled?'Payment has been marked settled in the CRM.':order.status==='Cancelled'||order.status==='Returned'?'Check the order status before collecting payment.':'This invoice does not confirm that payment was received.'}</span></div>
      <footer className="invoice-footer">Thank you for your order. · {state.businessName}<br/>Issued from Skinventory · {order.number}</footer>
    </div>
    <div className="invoice-actions"><button type="button" className="btn secondary" onClick={onClose}>Close</button><button type="button" className="btn primary" onClick={()=>window.print()}><Printer size={16}/><span>Print / Save PDF</span><Download size={15}/></button></div>
  </DialogContent></Dialog>;
}
