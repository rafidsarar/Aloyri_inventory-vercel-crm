'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Bell, CheckCircle2, ChevronRight, Package, Plus, Search, ShoppingBag, Truck, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Order } from '@/lib/crm';
import { statuses, taka } from '@/lib/crm';
import { Choice } from '../forms';

type Props={
  openOrderCount:number;
  salesMode:boolean;
  readyToPackOrders:number;
  outstandingOrderValue:number;
  todayOrders:Order[];
  todayOrderValue:number;
  canEdit:(key:string)=>boolean;
  openModal:(record:{type:'order'})=>void;
  filter:string;
  setFilter:(value:string)=>void;
  orders:Order[];
  outForDeliveryOrders:number;
  deliveredCount:number;
  returnRate:number;
  filteredOrders:Order[];
  selectedOrderIds:string[];
  setSelectedOrderIds:(value:string[])=>void;
  busy:boolean;
  bulkAdvanceSelectedOrders:()=>Promise<void>;
  query:string;
  setQuery:(value:string)=>void;
  orderTable:(orders:Order[])=>ReactNode;
};

export default function OrdersSection({
  openOrderCount,salesMode,readyToPackOrders,outstandingOrderValue,todayOrders,todayOrderValue,
  canEdit,openModal,filter,setFilter,orders,outForDeliveryOrders,deliveredCount,returnRate,
  filteredOrders,selectedOrderIds,setSelectedOrderIds,busy,bulkAdvanceSelectedOrders,query,
  setQuery,orderTable
}:Props){
  return <>
    <section className="orders-hero orders-hero-pro">
      <div className="orders-hero-copy">
        <span className="orders-eyebrow"><ShoppingBag size={15}/>Order workflow</span>
        <h2>Fulfill orders faster.</h2><p>Review, advance and track every order from one operational queue.</p>
        <div className="orders-hero-meta"><span><strong>{openOrderCount}</strong> open</span><span><strong>{salesMode?readyToPackOrders:taka(outstandingOrderValue)}</strong> {salesMode?'ready to pack':'outstanding'}</span><span><strong>{todayOrders.length}</strong> today</span></div>
      </div>
      <div className="orders-today orders-today-pro">
        <small>Today&apos;s order value</small><strong>{taka(todayOrderValue)}</strong><span>{todayOrders.length} {todayOrders.length===1?'order':'orders'}</span>
        {canEdit('orders')&&<button className="btn primary" onClick={()=>openModal({type:'order'})}><Plus size={16}/>Create order</button>}
      </div>
    </section>
    <div className="order-kpi-grid order-kpi-grid-pro">
      <button className={filter==='New'?'active':''} onClick={()=>setFilter('New')}><span className="order-kpi-icon"><Bell size={18}/></span><span><small>New</small><strong>{orders.filter(order=>order.status==='New').length}</strong><em>Needs confirmation</em></span><ChevronRight size={16}/></button>
      <button className={filter==='Ready to pack'?'active':''} onClick={()=>setFilter('Ready to pack')}><span className="order-kpi-icon"><Package size={18}/></span><span><small>Ready to pack</small><strong>{readyToPackOrders}</strong><em>Waiting to be packed</em></span><ChevronRight size={16}/></button>
      <button className={filter==='Out for delivery'?'active':''} onClick={()=>setFilter('Out for delivery')}><span className="order-kpi-icon"><Truck size={18}/></span><span><small>Out for delivery</small><strong>{outForDeliveryOrders}</strong><em>With courier</em></span><ChevronRight size={16}/></button>
      <button className={filter==='Delivered'?'active':''} onClick={()=>setFilter('Delivered')}><span className="order-kpi-icon"><CheckCircle2 size={18}/></span><span><small>Delivered</small><strong>{deliveredCount}</strong><em>{returnRate}% return rate</em></span><ChevronRight size={16}/></button>
    </div>
    <section className="panel order-workspace order-workspace-pro">
      <div className="panel-heading order-workspace-heading">
        <div><span className="orders-section-label">FULFILLMENT QUEUE</span><h2>Order pipeline</h2><p>Select a stage, search an order, or move it to the next step directly from the queue.</p></div>
        <div className="order-workspace-count"><strong>{filteredOrders.length}</strong><span>shown</span></div>
      </div>
      <div className="order-stage-shell">
        <button className={'order-all-filter '+(filter==='All'?'active':'')} onClick={()=>setFilter('All')} aria-pressed={filter==='All'}><span>All orders</span><strong>{orders.length}</strong></button>
        <div className="order-stage-scroll-region">
          <div className="order-stage-scroll-hint"><span>Fulfillment stages</span><small>Scroll horizontally to view all statuses →</small></div>
          <div className="order-stage-strip order-stage-strip-pro" tabIndex={0} aria-label="Scrollable fulfillment stages">{statuses.map((stage,index)=><button key={stage} className={filter===stage?'active':''} onClick={()=>setFilter(stage)} aria-pressed={filter===stage}><span className="order-stage-index">{index+1}</span><span className="order-stage-copy"><b>{stage}</b><small>{orders.filter(order=>order.status===stage).length} orders</small></span></button>)}</div>
        </div>
      </div>
      {selectedOrderIds.length>0&&<div className="bulk-action-bar"><span><strong>{selectedOrderIds.length}</strong> orders selected</span><div><button className="btn secondary" onClick={()=>setSelectedOrderIds([])}>Clear</button><button className="btn primary" disabled={busy} onClick={()=>void bulkAdvanceSelectedOrders()}><ArrowRight size={15}/>Advance one step</button></div></div>}
      <div className="order-toolbar-pro">
        <div className="search-input order-search"><Search size={17}/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search order, customer, phone, tracking or payment…" aria-label="Search orders"/>{query&&<button className="search-clear" aria-label="Clear search" onClick={()=>setQuery('')}><X size={15}/></button>}</div>
        <div className="order-toolbar-right"><Choice value={filter} onChange={setFilter} options={['All',...statuses]} label="Order status filter"/><span className="order-result-note">{filteredOrders.length} of {orders.length} orders</span></div>
      </div>
      {orderTable(filteredOrders)}
      <div className="table-footer order-footer-pro"><span>Oldest active orders appear first inside each stage.</span><span>Use Next Step to advance fulfillment.</span></div>
    </section>
  </>;
}
