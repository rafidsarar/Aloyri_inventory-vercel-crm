'use client';
import React from 'react';
import { renderInvoiceBody } from '@/lib/invoice-document';
import { Download, Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { State, Order } from '@/lib/crm';

export default function Invoice({state,order,onClose}:{state:State;order:Order|null;onClose:()=>void}){
  if(!order)return null;
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
  return <Dialog open onOpenChange={open=>{if(!open)onClose()}}><DialogContent className="invoice-dialog aloyri-dialog">
    <DialogHeader className="invoice-screen-header"><DialogTitle>Invoice for {order.number}</DialogTitle><DialogDescription>ALOYRI invoice generated from the saved order. Print or save it as a PDF.</DialogDescription></DialogHeader>
    <div className="invoice-viewer" dangerouslySetInnerHTML={{__html:renderInvoiceBody(state,order)}}/>
    <div className="invoice-actions"><button type="button" className="btn secondary" onClick={onClose}>Close</button><button type="button" className="btn primary" onClick={printInvoice}><Printer size={16}/><span>Print / Save PDF</span><Download size={15}/></button></div>
  </DialogContent></Dialog>;
}
