'use client';

import type { ReactNode } from 'react';
import { useRecordPagination } from '../record-pagination';
import { CalendarCheck, ChevronRight, Search } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import type { Customer, Order } from '@/lib/crm';
import { subtotal, taka } from '@/lib/crm';
import { ActionBar, Avatar, Empty, SectionPanel, Status, WorkspaceSection } from '../crm-ui';

type Detail={type:'order'|'customer'|'supplier';id:string};

type Props={
  serverPage?:{rows:Customer[];total:number;controls:ReactNode;feedback:ReactNode;loading:boolean;orderStats:Record<string,{orders:number;deliveredSpend:number}>};
  query:string;
  setQuery:(value:string)=>void;
  filteredCustomers:Customer[];
  customerCount:number;
  selectedCustomerIds:string[];
  setSelectedCustomerIds:(value:string[])=>void;
  canEdit:(key:string)=>boolean;
  busy:boolean;
  bulkCreateCustomerFollowUps:()=>Promise<void>;
  orders:Order[];
  setDetail:(detail:Detail)=>void;
  requestDelete:(kind:'products'|'customers'|'suppliers',id:string,name:string)=>void;
};

export default function CustomersSection({
  query,setQuery,filteredCustomers,customerCount,selectedCustomerIds,setSelectedCustomerIds,
  canEdit,busy,bulkCreateCustomerFollowUps,orders,setDetail,requestDelete,serverPage
}:Props){
  const pagination=useRecordPagination(filteredCustomers,query);const shownCustomers=serverPage?.rows??pagination.items;
  return <WorkspaceSection><SectionPanel className="customer-workspace">
    <ActionBar className="table-toolbar">
      <div className="search-input"><Search size={17}/><Input aria-label="Search customers" placeholder="Search name, phone or city…" value={query} onChange={e=>setQuery(e.target.value)}/></div>
      <span className="muted">{serverPage?.total??filteredCustomers.length} of {customerCount} customers</span>
    </ActionBar>
    {selectedCustomerIds.length>0&&<div className="bulk-action-bar">
      <span><strong>{selectedCustomerIds.length}</strong> customers selected</span>
      <div><button className="btn secondary" onClick={()=>setSelectedCustomerIds([])}>Clear</button>{canEdit('tasks')&&<button className="btn primary" disabled={busy} onClick={()=>void bulkCreateCustomerFollowUps()}><CalendarCheck size={15}/>Create follow-ups</button>}</div>
    </div>}
    {serverPage?.feedback}
    {serverPage?.loading?null:customerCount
      ? <>
          <div className="customers-desktop"><Table><TableHeader><TableRow>
            {canEdit('tasks')&&<TableHead className="bulk-check-cell"><Checkbox aria-label="Select all shown customers" checked={filteredCustomers.length>0&&shownCustomers.every(customer=>selectedCustomerIds.includes(customer.id))} onCheckedChange={checked=>setSelectedCustomerIds(checked===true?Array.from(new Set([...selectedCustomerIds,...shownCustomers.map(customer=>customer.id)])):selectedCustomerIds.filter(id=>!shownCustomers.some(customer=>customer.id===id)))}/></TableHead>}
            <TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead>Orders</TableHead><TableHead>Delivered spend</TableHead><TableHead>Follow-up consent</TableHead><TableHead/>
          </TableRow></TableHeader><TableBody>{shownCustomers.map((customer,index)=>{
            const customerOrders=orders.filter(order=>order.customerId===customer.id);
            const stats=serverPage?.orderStats[customer.id];
            return <TableRow key={customer.id}>
              {canEdit('tasks')&&<TableCell className="bulk-check-cell"><Checkbox aria-label={'Select customer '+customer.name} checked={selectedCustomerIds.includes(customer.id)} onCheckedChange={checked=>setSelectedCustomerIds(checked===true?[...selectedCustomerIds.filter(id=>id!==customer.id),customer.id]:selectedCustomerIds.filter(id=>id!==customer.id))}/></TableCell>}
              <TableCell><button className="customer-cell" onClick={()=>setDetail({type:'customer',id:customer.id})}><Avatar name={customer.name} index={index}/><span><strong>{customer.name}</strong><small className="cell-sub">{customer.city}</small></span></button></TableCell>
              <TableCell>{customer.phone||'—'}</TableCell>
              <TableCell>{stats?.orders??customerOrders.length}</TableCell>
              <TableCell className="numeric">{taka(stats?.deliveredSpend??customerOrders.filter(order=>order.status==='Delivered').reduce((sum,order)=>sum+subtotal(order),0))}</TableCell>
              <TableCell><Status value={customer.consent?'Opted in':'Not recorded'}/></TableCell>
              <TableCell><div className="product-actions"><button className="icon-button" aria-label={'Open '+customer.name} onClick={()=>setDetail({type:'customer',id:customer.id})}><ChevronRight size={18}/></button>{canEdit('customers')&&<button className="text-button delete-button" disabled={busy} aria-label={'Delete customer '+customer.name} onClick={()=>requestDelete('customers',customer.id,customer.name)}>Delete</button>}</div></TableCell>
            </TableRow>;
          })}</TableBody></Table></div>
          <div className="customers-mobile-list">{shownCustomers.map((customer,index)=>{
            const customerOrders=orders.filter(order=>order.customerId===customer.id);
            const stats=serverPage?.orderStats[customer.id];
            const deliveredSpend=customerOrders.filter(order=>order.status==='Delivered').reduce((sum,order)=>sum+subtotal(order),0);
            return <article className="customer-mobile-card" key={customer.id}>
              <button className="customer-mobile-main" onClick={()=>setDetail({type:'customer',id:customer.id})}>
                <div className="customer-mobile-head"><Avatar name={customer.name} index={index}/><span><strong>{customer.name}</strong><small>{customer.phone||customer.city||'No contact details'}</small></span><ChevronRight size={17}/></div>
                <div className="customer-mobile-kpis"><span><small>Orders</small><strong>{stats?.orders??customerOrders.length}</strong></span><span><small>Delivered spend</small><strong>{taka(stats?.deliveredSpend??deliveredSpend)}</strong></span><span><small>Consent</small><Status value={customer.consent?'Opted in':'Not recorded'}/></span></div>
              </button>
              {canEdit('tasks')&&<label className="mobile-select-control customer-mobile-select"><Checkbox aria-label={'Select customer '+customer.name} checked={selectedCustomerIds.includes(customer.id)} onCheckedChange={checked=>setSelectedCustomerIds(checked===true?[...selectedCustomerIds.filter(id=>id!==customer.id),customer.id]:selectedCustomerIds.filter(id=>id!==customer.id))}/><span>Select for bulk action</span></label>}
            </article>;
          })}</div>
        </>
      : <Empty title="No customers yet" text="Save their contact details and preferences, then create an order."/>}
  {serverPage?.controls??pagination.controls}</SectionPanel></WorkspaceSection>;
}

