'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Bell, CalendarCheck, ChevronRight, Eye, LayoutDashboard, Package, ShoppingBag, Truck, Users, Wallet } from 'lucide-react';
import { Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import type { Order } from '@/lib/crm';
import { taka } from '@/lib/crm';
import type { WorkspaceRole } from '@/lib/roles';
import { Choice } from '../forms';
import { SectionPanel, WorkspaceSection, type View } from '../crm-ui';

type Props={
  role:WorkspaceRole;
  alertCritical:number;alertAction:number;alertUpcoming:number;
  todayOrderCount:number;todayOrderValue:number;openOrderCount:number;readyToPackOrders:number;outForDeliveryOrders:number;
  pendingCollections:number;pendingCollectionOrders:number;
  inventoryOutCount:number;inventoryLowCount:number;attention:number;purchasingOverdueCount:number;
  followUpOverdueCount:number;followUpTodayCount:number;followUpOpenCount:number;purchasingIncomingUnits:number;
  range:string;setRange:(value:string)=>void;chart:Array<{date:string;sales:number}>;periodSales:number;profit:number;
  inventoryUnits:number;customerCount:number;unpaidStock:number;recentOrders:Order[];orderTable:(orders:Order[])=>ReactNode;
  changeView:(view:View)=>void;setFilter:(value:string)=>void;setFinanceTab:(value:string)=>void;
  setInventoryTab:(value:string)=>void;setPurchasingTab:(value:'Purchase orders'|'Suppliers')=>void;
};
const signedTaka=(amount:number)=>amount<0?'− '+taka(-amount):taka(amount);

function SalesWorkspace(p:Props){
  return <WorkspaceSection>
    <section className="overview-command-hero">
      <div className="overview-command-copy"><span className="orders-eyebrow"><ShoppingBag size={15}/>Sales workspace</span><h2>Start with customers and orders that need action today.</h2><p>Your workspace keeps fulfillment, customer follow-ups and new sales work together without exposing finance or supplier controls.</p></div>
      <div className="overview-command-status"><span className={p.alertCritical?'needs-attention':'clear'}><i/>{p.alertCritical?p.alertCritical+' critical alert'+(p.alertCritical===1?'':'s'):'Sales queue is clear'}</span><button onClick={()=>p.changeView('Alerts')}>Open alert center<ArrowRight size={15}/></button></div>
    </section>
    <div className="overview-priority-grid">
      <button onClick={()=>{p.changeView('Orders');p.setFilter('All')}}><span className="overview-priority-icon"><ShoppingBag size={19}/></span><span><small>Orders today</small><strong>{p.todayOrderCount}</strong><em>{taka(p.todayOrderValue)} order value</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Orders');p.setFilter('Ready to pack')}}><span className="overview-priority-icon"><Package size={19}/></span><span><small>Ready to pack</small><strong>{p.readyToPackOrders}</strong><em>{p.openOrderCount} open orders total</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Follow-ups');p.setFilter(p.followUpOverdueCount?'Overdue':'Today')}}><span className="overview-priority-icon"><CalendarCheck size={19}/></span><span><small>Customer follow-ups</small><strong>{p.followUpOverdueCount||p.followUpTodayCount}</strong><em>{p.followUpOverdueCount?p.followUpOverdueCount+' overdue':p.followUpTodayCount+' due today'}</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Customers')}><span className="overview-priority-icon"><Users size={19}/></span><span><small>Customer base</small><strong>{p.customerCount}</strong><em>Open customer records</em></span><ChevronRight size={16}/></button>
    </div>
    <SectionPanel className="overview-work-queue">
      <div className="panel-heading"><div><h2>Sales work queue</h2><p>Customer and fulfillment work ordered around what needs attention now.</p></div><span className={'overview-work-count '+(p.alertCritical||p.followUpOverdueCount?'active':'')}>{p.alertCritical+p.followUpOverdueCount+p.readyToPackOrders+p.outForDeliveryOrders} signals</span></div>
      <div className="overview-work-grid">
        <button onClick={()=>p.changeView('Alerts')} className={p.alertCritical?'urgent':''}><span className="attention-icon rose"><Bell size={18}/></span><span><strong>{p.alertCritical?p.alertCritical+' critical alerts':'No critical alerts'}</strong><small>{p.alertAction} action-needed · {p.alertUpcoming} upcoming</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{p.changeView('Orders');p.setFilter('Ready to pack')}}><span className="attention-icon amber"><Package size={18}/></span><span><strong>{p.readyToPackOrders} ready to pack</strong><small>Move confirmed customer orders into fulfillment</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{p.changeView('Orders');p.setFilter('Out for delivery')}}><span className="attention-icon blue"><Truck size={18}/></span><span><strong>{p.outForDeliveryOrders} out for delivery</strong><small>Check tracking and delivery handoff</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{p.changeView('Follow-ups');p.setFilter(p.followUpOverdueCount?'Overdue':'Today')}} className={p.followUpOverdueCount?'urgent':''}><span className="attention-icon blue"><CalendarCheck size={18}/></span><span><strong>{p.followUpOverdueCount?p.followUpOverdueCount+' overdue follow-ups':p.followUpTodayCount+' due today'}</strong><small>{p.followUpOpenCount} customer reminders remain open</small></span><ChevronRight size={16}/></button>
      </div>
    </SectionPanel>
    <div className="dashboard-middle overview-insight-grid">
      <SalesTrend {...p}/>
      <SectionPanel className="overview-health-panel"><div className="panel-heading"><div><h2>Sales handoff</h2><p>Fast links for the records used most often during customer work.</p></div></div><div className="overview-health-list">
        <button onClick={()=>p.changeView('Orders')}><span><small>Open order pipeline</small><strong>{p.openOrderCount} orders</strong></span><ChevronRight size={16}/></button>
        <button onClick={()=>p.changeView('Customers')}><span><small>Customer records</small><strong>{p.customerCount} customers</strong></span><ChevronRight size={16}/></button>
        <button onClick={()=>p.changeView('Follow-ups')}><span><small>Open follow-ups</small><strong>{p.followUpOpenCount}</strong></span><ChevronRight size={16}/></button>
      </div></SectionPanel>
    </div>
    <RecentOrders {...p}/>
  </WorkspaceSection>;
}

function InventoryWorkspace(p:Props){
  return <WorkspaceSection>
    <section className="overview-command-hero">
      <div className="overview-command-copy"><span className="orders-eyebrow"><Package size={15}/>Inventory workspace</span><h2>Protect stock availability and keep purchasing moving.</h2><p>Low stock, incoming purchase orders and inventory exceptions are prioritized here without exposing customer identity or finance controls.</p></div>
      <div className="overview-command-status"><span className={p.alertCritical?'needs-attention':'clear'}><i/>{p.alertCritical?p.alertCritical+' critical alert'+(p.alertCritical===1?'':'s'):'Inventory queue is clear'}</span><button onClick={()=>p.changeView('Alerts')}>Open alert center<ArrowRight size={15}/></button></div>
    </section>
    <div className="overview-priority-grid">
      <button onClick={()=>{p.changeView('Inventory');p.setFilter('Low stock')}}><span className="overview-priority-icon"><AlertTriangle size={19}/></span><span><small>Stock attention</small><strong>{p.inventoryOutCount+p.inventoryLowCount}</strong><em>{p.inventoryOutCount} out · {p.inventoryLowCount} low</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Suppliers');p.setPurchasingTab('Purchase orders');p.setFilter('Sent')}}><span className="overview-priority-icon"><Truck size={19}/></span><span><small>Incoming stock</small><strong>{p.purchasingIncomingUnits}</strong><em>units still expected</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Suppliers');p.setPurchasingTab('Purchase orders');p.setFilter(p.purchasingOverdueCount?'Overdue':'All')}}><span className="overview-priority-icon"><CalendarCheck size={19}/></span><span><small>Overdue purchase orders</small><strong>{p.purchasingOverdueCount}</strong><em>{p.purchasingOverdueCount?'Needs receiving follow-up':'No overdue POs'}</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Inventory');p.setInventoryTab('Products');p.setFilter('All')}}><span className="overview-priority-icon"><Package size={19}/></span><span><small>Available inventory</small><strong>{p.inventoryUnits}</strong><em>sellable units</em></span><ChevronRight size={16}/></button>
    </div>
    <SectionPanel className="overview-work-queue">
      <div className="panel-heading"><div><h2>Inventory work queue</h2><p>Stock and purchasing exceptions that should be handled first.</p></div><span className={'overview-work-count '+(p.alertCritical||p.inventoryOutCount||p.purchasingOverdueCount?'active':'')}>{p.alertCritical+p.inventoryOutCount+p.inventoryLowCount+p.purchasingOverdueCount} signals</span></div>
      <div className="overview-work-grid">
        <button onClick={()=>p.changeView('Alerts')} className={p.alertCritical?'urgent':''}><span className="attention-icon rose"><Bell size={18}/></span><span><strong>{p.alertCritical?p.alertCritical+' critical alerts':'No critical alerts'}</strong><small>{p.alertAction} action-needed · {p.alertUpcoming} upcoming</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{p.changeView('Inventory');p.setFilter('Low stock')}} className={p.inventoryOutCount?'urgent':''}><span className="attention-icon amber"><Package size={18}/></span><span><strong>{p.inventoryOutCount+p.inventoryLowCount} stock issues</strong><small>{p.inventoryOutCount} out · {p.inventoryLowCount} below reorder threshold</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{p.changeView('Suppliers');p.setPurchasingTab('Purchase orders');p.setFilter(p.purchasingOverdueCount?'Overdue':'Sent')}} className={p.purchasingOverdueCount?'urgent':''}><span className="attention-icon amber"><Truck size={18}/></span><span><strong>{p.purchasingOverdueCount?p.purchasingOverdueCount+' overdue purchase orders':'No overdue purchase orders'}</strong><small>{p.purchasingIncomingUnits} units still incoming</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{p.changeView('Inventory');p.setInventoryTab('Batches');p.setFilter('All')}}><span className="attention-icon blue"><CalendarCheck size={18}/></span><span><strong>{p.attention} inventory checks</strong><small>Review stock health, batches and holds & returns</small></span><ChevronRight size={16}/></button>
      </div>
    </SectionPanel>
    <SectionPanel className="overview-health-panel"><div className="panel-heading"><div><h2>Inventory handoff</h2><p>Open the operational areas used most often during receiving and stock control.</p></div></div><div className="overview-health-list">
      <button onClick={()=>{p.changeView('Inventory');p.setInventoryTab('Products')}}><span><small>Products & stock</small><strong>{p.inventoryUnits} units available</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Suppliers');p.setPurchasingTab('Purchase orders')}}><span><small>Purchase orders</small><strong>{p.purchasingIncomingUnits} units incoming</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Suppliers');p.setPurchasingTab('Suppliers')}}><span><small>Supplier records</small><strong>Open supplier directory</strong></span><ChevronRight size={16}/></button>
    </div></SectionPanel>
  </WorkspaceSection>;
}

function ViewerWorkspace(p:Props){
  return <WorkspaceSection>
    <section className="overview-command-hero">
      <div className="overview-command-copy"><span className="orders-eyebrow"><Eye size={15}/>Read-only overview</span><h2>Monitor business activity without changing operational records.</h2><p>Key order, stock and finance signals remain visible while all editing and administrative controls stay disabled.</p></div>
      <div className="overview-command-status"><span className={p.alertCritical?'needs-attention':'clear'}><i/>{p.alertCritical?p.alertCritical+' critical alert'+(p.alertCritical===1?'':'s'):'No critical alerts'}</span><button onClick={()=>p.changeView('Alerts')}>View alerts<ArrowRight size={15}/></button></div>
    </section>
    <div className="overview-priority-grid">
      <button onClick={()=>p.changeView('Orders')}><span className="overview-priority-icon"><ShoppingBag size={19}/></span><span><small>Orders today</small><strong>{p.todayOrderCount}</strong><em>{taka(p.todayOrderValue)} order value</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Inventory')}><span className="overview-priority-icon"><Package size={19}/></span><span><small>Stock attention</small><strong>{p.inventoryOutCount+p.inventoryLowCount}</strong><em>{p.inventoryUnits} units available</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Finances')}><span className="overview-priority-icon"><Wallet size={19}/></span><span><small>Collections pending</small><strong>{taka(p.pendingCollections)}</strong><em>{p.pendingCollectionOrders} orders with balance</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Customers')}><span className="overview-priority-icon"><Users size={19}/></span><span><small>Customer base</small><strong>{p.customerCount}</strong><em>Read-only customer records</em></span><ChevronRight size={16}/></button>
    </div>
    <div className="dashboard-middle overview-insight-grid"><SalesTrend {...p}/><SectionPanel className="overview-health-panel"><div className="panel-heading"><div><h2>Business snapshot</h2><p>Read-only operating context.</p></div></div><div className="overview-health-list">
      <button onClick={()=>p.changeView('Finances')}><span><small>Operating result</small><strong className={p.profit<0?'money-negative':'money-positive'}>{signedTaka(p.profit)}</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Orders')}><span><small>Open fulfillment</small><strong>{p.openOrderCount} orders</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Suppliers')}><span><small>Incoming purchasing</small><strong>{p.purchasingIncomingUnits} units</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Follow-ups')}><span><small>Open follow-ups</small><strong>{p.followUpOpenCount}</strong></span><ChevronRight size={16}/></button>
    </div></SectionPanel></div>
    <RecentOrders {...p}/>
  </WorkspaceSection>;
}

function SalesTrend(p:Props){
  return <SectionPanel className="sales-panel"><div className="panel-heading"><div><h2>Sales trend</h2><p>Delivered product revenue for operating context</p></div><Choice value={p.range} onChange={p.setRange} label="Sales chart period" options={[{value:'7',label:'Last 7 days'},{value:'30',label:'Last 30 days'}]}/></div><div className="chart-total"><strong>{taka(p.periodSales)}</strong><span><i className="legend-dot green"/>Product revenue</span></div><div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={p.chart} margin={{top:10,right:10,left:-15,bottom:0}}><defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a76556" stopOpacity={.2}/><stop offset="100%" stopColor="#a76556" stopOpacity={.01}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#eee2dc" strokeDasharray="4 4"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'#816e66',fontSize:12}} minTickGap={28} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#816e66',fontSize:12}} tickFormatter={value=>Number(value)>=1000?(Number(value)/1000)+'k':String(value)}/><Tooltip formatter={value=>[taka(Number(value)),'Sales']} contentStyle={{borderRadius:10,border:'1px solid #e9dcd5',fontSize:14}}/><Area type="monotone" dataKey="sales" stroke="#9f5949" strokeWidth={2.5} fill="url(#sales-fill)"/></AreaChart></ResponsiveContainer></div></SectionPanel>;
}
function RecentOrders(p:Props){return <div className="dashboard-bottom"><SectionPanel className="orders-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Latest five records for a quick handoff check</p></div><button className="text-button" onClick={()=>p.changeView('Orders')}>Open order pipeline<ArrowRight size={15}/></button></div>{p.orderTable(p.recentOrders)}</SectionPanel></div>}

export default function OverviewSection(p:Props){
  if(p.role==='sales')return <SalesWorkspace {...p}/>;
  if(p.role==='inventory')return <InventoryWorkspace {...p}/>;
  if(p.role==='viewer')return <ViewerWorkspace {...p}/>;
  return <WorkspaceSection>
    <section className="overview-command-hero"><div className="overview-command-copy"><span className="orders-eyebrow"><LayoutDashboard size={15}/>Today&apos;s operations</span><h2>Run the business from what needs attention now.</h2><p>Orders, money, stock and customer work are prioritized here. Detailed analysis stays in the specialist sections.</p></div><div className="overview-command-status"><span className={p.alertCritical?'needs-attention':'clear'}><i/>{p.alertCritical?p.alertCritical+' critical '+(p.alertCritical===1?'alert':'alerts'):'No critical alerts'}</span><button onClick={()=>p.changeView('Alerts')}>Open alert center<ArrowRight size={15}/></button></div></section>
    <div className="overview-priority-grid">
      <button onClick={()=>{p.changeView('Orders');p.setFilter('All')}}><span className="overview-priority-icon"><ShoppingBag size={19}/></span><span><small>Orders today</small><strong>{p.todayOrderCount}</strong><em>{taka(p.todayOrderValue)} order value</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Orders');p.setFilter('All')}}><span className="overview-priority-icon"><Package size={19}/></span><span><small>Open fulfillment</small><strong>{p.openOrderCount}</strong><em>{p.readyToPackOrders} ready to pack · {p.outForDeliveryOrders} out for delivery</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Finances');p.setFinanceTab('Collections')}}><span className="overview-priority-icon"><Wallet size={19}/></span><span><small>Collections pending</small><strong>{taka(p.pendingCollections)}</strong><em>{p.pendingCollectionOrders} orders with balance</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Inventory');p.setFilter('Low stock')}}><span className="overview-priority-icon"><AlertTriangle size={19}/></span><span><small>Stock attention</small><strong>{p.inventoryOutCount+p.inventoryLowCount}</strong><em>{p.inventoryOutCount} out · {p.inventoryLowCount} low</em></span><ChevronRight size={16}/></button>
    </div>
    <SectionPanel className="overview-work-queue"><div className="panel-heading"><div><h2>Work queue</h2><p>Exceptions that can change today&apos;s operation.</p></div><span className={'overview-work-count '+(p.alertCritical||p.attention||p.purchasingOverdueCount?'active':'')}>{p.alertCritical+p.attention+p.purchasingOverdueCount} signals</span></div><div className="overview-work-grid">
      <button onClick={()=>p.changeView('Alerts')} className={p.alertCritical?'urgent':''}><span className="attention-icon rose"><Bell size={18}/></span><span><strong>{p.alertCritical?p.alertCritical+' critical '+(p.alertCritical===1?'alert':'alerts'):'No critical alerts'}</strong><small>{p.alertAction} action-needed · {p.alertUpcoming} upcoming</small></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Inventory');p.setFilter('Low stock')}} className={p.inventoryOutCount?'urgent':''}><span className="attention-icon amber"><Package size={18}/></span><span><strong>{p.inventoryOutCount+p.inventoryLowCount} stock issues</strong><small>{p.inventoryOutCount} out of stock · {p.inventoryLowCount} below reorder threshold</small></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Follow-ups');p.setFilter(p.followUpOverdueCount?'Overdue':'Today')}} className={p.followUpOverdueCount?'urgent':''}><span className="attention-icon blue"><CalendarCheck size={18}/></span><span><strong>{p.followUpOverdueCount?p.followUpOverdueCount+' overdue follow-ups':p.followUpTodayCount+' follow-ups due today'}</strong><small>{p.followUpOpenCount} open customer reminders</small></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Suppliers');p.setPurchasingTab('Purchase orders');p.setFilter(p.purchasingOverdueCount?'Overdue':'Sent')}} className={p.purchasingOverdueCount?'urgent':''}><span className="attention-icon amber"><Truck size={18}/></span><span><strong>{p.purchasingOverdueCount?p.purchasingOverdueCount+' overdue purchase orders':'No overdue purchase orders'}</strong><small>{p.purchasingIncomingUnits} units still incoming</small></span><ChevronRight size={16}/></button>
    </div></SectionPanel>
    <div className="dashboard-middle overview-insight-grid"><SalesTrend {...p}/><SectionPanel className="overview-health-panel"><div className="panel-heading"><div><h2>Business health</h2><p>Compact management context without duplicating the work queue.</p></div></div><div className="overview-health-list">
      <button onClick={()=>{p.changeView('Finances');p.setFinanceTab('Overview')}}><span><small>Operating result</small><strong className={p.profit<0?'money-negative':'money-positive'}>{signedTaka(p.profit)}</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Inventory');p.setInventoryTab('Products');p.setFilter('All')}}><span><small>Available inventory</small><strong>{p.inventoryUnits} units</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>p.changeView('Customers')}><span><small>Customer base</small><strong>{p.customerCount}</strong></span><ChevronRight size={16}/></button>
      <button onClick={()=>{p.changeView('Finances');p.setFinanceTab('Payables')}}><span><small>Supplier payables</small><strong>{taka(p.unpaidStock)}</strong></span><ChevronRight size={16}/></button>
    </div></SectionPanel></div>
    <RecentOrders {...p}/>
  </WorkspaceSection>;
}
