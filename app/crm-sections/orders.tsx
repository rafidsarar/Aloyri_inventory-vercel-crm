'use client';

import { useRecordPagination } from '../record-pagination';
import { useEffect,useState,type ReactNode } from 'react';
import { ArrowRight, Bell, CheckCircle2, ChevronRight, Package, Plus, RotateCcw, Search, ShoppingBag, Truck, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { Order } from '@/lib/crm';
import { statuses, taka } from '@/lib/crm';
import { toast } from 'sonner';
import { Choice } from '../forms';
import { ActionBar, SectionPanel, WorkspaceSection } from '../crm-ui';


type ReturnRequest={
  id:string;
  orderId:string;
  orderNumber:string;
  requestStatus:'Requested'|'Reviewing'|'Approved'|'Rejected'|'Resolved';
  reason:string;
  condition:string;
  preferredResolution:string;
  customerNote:string;
  items:{line:number;productId:string;name:string;brand:string;size:string;qty:number}[];
  staffNote:string;
  createdAt:string;
  updatedAt:string;
  resolvedAt:string;
};

type Props={
  serverPage?:{rows:Order[];total:number;controls:ReactNode;feedback:ReactNode;loading:boolean;stats:{total:number;todayOrderCount:number;statusCounts:Record<string,number>}};
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
  setQuery,orderTable,serverPage
}:Props){
  const [returnRequests,setReturnRequests]=useState<ReturnRequest[]>([]);
  const [returnRequestsLoading,setReturnRequestsLoading]=useState(true);
  const [returnRequestBusy,setReturnRequestBusy]=useState('');

  async function loadReturnRequests(){
    setReturnRequestsLoading(true);
    try{
      const response=await fetch('/api/return-requests',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Could not load website return requests.');
      setReturnRequests(Array.isArray(data.requests)?data.requests:[]);
    }catch(error){
      toast.error(error instanceof Error?error.message:'Could not load website return requests.');
    }finally{
      setReturnRequestsLoading(false);
    }
  }

  useEffect(()=>{void loadReturnRequests()},[]);

  async function updateReturnRequest(request:ReturnRequest,status:ReturnRequest['requestStatus']){
    if(returnRequestBusy)return;
    setReturnRequestBusy(request.id);
    try{
      const response=await fetch('/api/return-requests',{
        method:'PATCH',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:request.id,status,staffNote:request.staffNote||''})
      });
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Could not update return request.');
      setReturnRequests(current=>current.map(item=>item.id===request.id?data.request:item));
      toast.success('Return request updated.');
    }catch(error){
      toast.error(error instanceof Error?error.message:'Could not update return request.');
    }finally{
      setReturnRequestBusy('');
    }
  }

  function findReturnOrder(request:ReturnRequest){
    setFilter('All');
    setQuery(request.orderNumber);
  }

  const activeReturnRequests=returnRequests.filter(request=>!['Rejected','Resolved'].includes(request.requestStatus));
  const pagination=useRecordPagination(filteredOrders,query+"|"+filter);
  const matchedCount=serverPage?.total??filteredOrders.length,allCount=serverPage?.stats.total??orders.length,todayCount=serverPage?.stats.todayOrderCount??todayOrders.length;
  const statusCount=(status:string)=>serverPage?.stats.statusCounts[status]??orders.filter(o=>o.status===status).length;
  return <WorkspaceSection>
    <section className="orders-hero orders-hero-pro">
      <div className="orders-hero-copy">
        <span className="orders-eyebrow"><ShoppingBag size={15}/>Order workflow</span>
        <h2>Fulfill orders faster.</h2><p>Review, advance and track every order from one operational queue.</p>
        <div className="orders-hero-meta"><span><strong>{openOrderCount}</strong> open</span><span><strong>{salesMode?readyToPackOrders:taka(outstandingOrderValue)}</strong> {salesMode?'ready to pack':'outstanding'}</span><span><strong>{todayCount}</strong> today</span></div>
      </div>
      <div className="orders-today orders-today-pro">
        <small>Today&apos;s order value</small><strong>{taka(todayOrderValue)}</strong><span>{todayCount} {todayCount===1?'order':'orders'}</span>
        {canEdit('orders')&&<button className="btn primary" onClick={()=>openModal({type:'order'})}><Plus size={16}/>Create order</button>}
      </div>
    </section>
    <div className="order-kpi-grid order-kpi-grid-pro">
      <button className={filter==='New'?'active':''} onClick={()=>setFilter('New')}><span className="order-kpi-icon"><Bell size={18}/></span><span><small>New</small><strong>{statusCount('New')}</strong><em>Needs confirmation</em></span><ChevronRight size={16}/></button>
      <button className={filter==='Ready to pack'?'active':''} onClick={()=>setFilter('Ready to pack')}><span className="order-kpi-icon"><Package size={18}/></span><span><small>Ready to pack</small><strong>{readyToPackOrders}</strong><em>Waiting to be packed</em></span><ChevronRight size={16}/></button>
      <button className={filter==='Out for delivery'?'active':''} onClick={()=>setFilter('Out for delivery')}><span className="order-kpi-icon"><Truck size={18}/></span><span><small>Out for delivery</small><strong>{outForDeliveryOrders}</strong><em>With courier</em></span><ChevronRight size={16}/></button>
      <button className={filter==='Delivered'?'active':''} onClick={()=>setFilter('Delivered')}><span className="order-kpi-icon"><CheckCircle2 size={18}/></span><span><small>Delivered</small><strong>{deliveredCount}</strong><em>{returnRate}% return rate</em></span><ChevronRight size={16}/></button>
    </div>
    <SectionPanel className="order-workspace order-workspace-pro">
      <div className="panel-heading order-workspace-heading">
        <div><span className="orders-section-label">WEBSITE RETURNS</span><h2>Customer return requests</h2><p>Review customer requests here first. Approval does not refund money, mark stock as returned, or restock anything.</p></div>
        <div className="order-workspace-count"><strong>{activeReturnRequests.length}</strong><span>open</span></div>
      </div>
      {returnRequestsLoading?<p className="muted">Loading website return requests…</p>:returnRequests.length===0?
        <div className="table-footer"><span>No website return requests yet.</span><span>New requests will appear here after a customer verifies a delivered website order.</span></div>:
        <div className="grid gap-3">
          {returnRequests.slice(0,12).map(request=><article key={request.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2"><strong>#{request.orderNumber}</strong><span className="status-pill">{request.requestStatus}</span></div>
                <p className="mt-1 text-sm muted">{request.reason} · {request.condition} · Customer prefers {request.preferredResolution}</p>
                <p className="mt-2 text-sm">{request.items.map(item=>(item.brand?item.brand+' ':'')+item.name+' × '+item.qty).join(' · ')}</p>
                {request.customerNote&&<p className="mt-2 text-sm muted">Customer note: {request.customerNote}</p>}
                <p className="mt-2 text-xs muted">Submitted {new Date(request.createdAt).toLocaleString('en-GB',{timeZone:'Asia/Dhaka'})}</p>
              </div>
              <button className="btn secondary small" onClick={()=>findReturnOrder(request)}><Search size={14}/>Find order</button>
            </div>
            <label className="mt-3 block text-sm">
              <span className="text-xs font-medium muted">Internal review note</span>
              <textarea
                value={request.staffNote}
                maxLength={2000}
                rows={2}
                onChange={event=>setReturnRequests(current=>current.map(item=>item.id===request.id?{...item,staffNote:event.target.value}:item))}
                placeholder="Add staff-only context for the return review…"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              {request.requestStatus==='Requested'&&<button className="btn secondary small" disabled={returnRequestBusy===request.id} onClick={()=>void updateReturnRequest(request,'Reviewing')}>Start review</button>}
              {!['Approved','Rejected','Resolved'].includes(request.requestStatus)&&<>
                <button className="btn secondary small" disabled={returnRequestBusy===request.id} onClick={()=>void updateReturnRequest(request,'Approved')}><CheckCircle2 size={14}/>Approve request</button>
                <button className="btn secondary small" disabled={returnRequestBusy===request.id} onClick={()=>void updateReturnRequest(request,'Rejected')}><X size={14}/>Reject</button>
              </>}
              {request.requestStatus==='Approved'&&<button className="btn secondary small" disabled={returnRequestBusy===request.id} onClick={()=>void updateReturnRequest(request,'Resolved')}><RotateCcw size={14}/>Mark reviewed / resolved</button>}
            </div>
            {request.requestStatus==='Approved'&&<p className="mt-3 text-xs muted">Next: when the returned parcel is physically received, move the order through the existing Returned workflow. Inventory inspection and Finance settlement remain separate protected actions.</p>}
          </article>)}
        </div>}
    </SectionPanel>

    <SectionPanel className="order-workspace order-workspace-pro">
      <div className="panel-heading order-workspace-heading">
        <div><span className="orders-section-label">FULFILLMENT QUEUE</span><h2>Order pipeline</h2><p>Select a stage, search an order, or move it to the next step directly from the queue.</p></div>
        <div className="order-workspace-count"><strong>{matchedCount}</strong><span>shown</span></div>
      </div>
      <div className="order-stage-shell">
        <button className={'order-all-filter '+(filter==='All'?'active':'')} onClick={()=>setFilter('All')} aria-pressed={filter==='All'}><span>All orders</span><strong>{allCount}</strong></button>
        <div className="order-stage-scroll-region">
          <div className="order-stage-scroll-hint"><span>Fulfillment stages</span><small>Scroll horizontally to view all statuses →</small></div>
          <div className="order-stage-strip order-stage-strip-pro" tabIndex={0} aria-label="Scrollable fulfillment stages">{statuses.map((stage,index)=><button key={stage} className={filter===stage?'active':''} onClick={()=>setFilter(stage)} aria-pressed={filter===stage}><span className="order-stage-index">{index+1}</span><span className="order-stage-copy"><b>{stage}</b><small>{statusCount(stage)} orders</small></span></button>)}</div>
        </div>
      </div>
      {selectedOrderIds.length>0&&<div className="bulk-action-bar"><span><strong>{selectedOrderIds.length}</strong> orders selected</span><div><button className="btn secondary" onClick={()=>setSelectedOrderIds([])}>Clear</button><button className="btn primary" disabled={busy} onClick={()=>void bulkAdvanceSelectedOrders()}><ArrowRight size={15}/>Advance one step</button></div></div>}
      <ActionBar className="order-toolbar-pro">
        <div className="search-input order-search"><Search size={17}/><Input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search order, customer, phone, tracking or payment…" aria-label="Search orders"/>{query&&<button className="search-clear" aria-label="Clear search" onClick={()=>setQuery('')}><X size={15}/></button>}</div>
        <div className="order-toolbar-right"><Choice value={filter} onChange={setFilter} options={['All',...statuses]} label="Order status filter"/><span className="order-result-note">{matchedCount} of {allCount} orders</span></div>
      </ActionBar>
      {serverPage?.feedback}{(!serverPage||!serverPage.loading)&&orderTable(serverPage?.rows??pagination.items)}{serverPage?.controls??pagination.controls}
      <div className="table-footer order-footer-pro"><span>Oldest active orders appear first inside each stage.</span><span>Use Next Step to advance fulfillment.</span></div>
    </SectionPanel>
  </WorkspaceSection>;
}

