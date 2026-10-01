'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, Bell, CalendarCheck, ChevronRight, LayoutDashboard, Package, ShoppingBag, Truck, Wallet } from 'lucide-react';
import { Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import type { Order } from '@/lib/crm';
import { taka } from '@/lib/crm';
import { Choice } from '../forms';
import { SectionPanel, WorkspaceSection, type View } from '../crm-ui';

type Props={
  alertCritical:number;
  alertAction:number;
  alertUpcoming:number;
  todayOrderCount:number;
  todayOrderValue:number;
  openOrderCount:number;
  readyToPackOrders:number;
  outForDeliveryOrders:number;
  pendingCollections:number;
  pendingCollectionOrders:number;
  inventoryOutCount:number;
  inventoryLowCount:number;
  attention:number;
  purchasingOverdueCount:number;
  followUpOverdueCount:number;
  followUpTodayCount:number;
  followUpOpenCount:number;
  purchasingIncomingUnits:number;
  range:string;
  setRange:(value:string)=>void;
  chart:Array<{date:string;sales:number}>;
  periodSales:number;
  profit:number;
  inventoryUnits:number;
  customerCount:number;
  unpaidStock:number;
  recentOrders:Order[];
  orderTable:(orders:Order[])=>ReactNode;
  changeView:(view:View)=>void;
  setFilter:(value:string)=>void;
  setFinanceTab:(value:string)=>void;
  setInventoryTab:(value:string)=>void;
  setPurchasingTab:(value:'Purchase orders'|'Suppliers')=>void;
};

const signedTaka=(amount:number)=>amount<0?'− '+taka(-amount):taka(amount);

export default function OverviewSection({
  alertCritical,alertAction,alertUpcoming,todayOrderCount,todayOrderValue,openOrderCount,
  readyToPackOrders,outForDeliveryOrders,pendingCollections,pendingCollectionOrders,
  inventoryOutCount,inventoryLowCount,attention,purchasingOverdueCount,followUpOverdueCount,
  followUpTodayCount,followUpOpenCount,purchasingIncomingUnits,range,setRange,chart,periodSales,
  profit,inventoryUnits,customerCount,unpaidStock,recentOrders,orderTable,changeView,setFilter,
  setFinanceTab,setInventoryTab,setPurchasingTab
}:Props){
  return <WorkspaceSection>
    <section className="overview-command-hero">
      <div className="overview-command-copy"><span className="orders-eyebrow"><LayoutDashboard size={15}/>Today&apos;s operations</span><h2>Run the business from what needs attention now.</h2><p>Orders, money, stock and customer work are prioritized here. Detailed analysis stays in the specialist sections.</p></div>
      <div className="overview-command-status"><span className={alertCritical?'needs-attention':'clear'}><i/>{alertCritical?alertCritical+' critical '+(alertCritical===1?'alert':'alerts'):'No critical alerts'}</span><button onClick={()=>changeView('Alerts')}>Open alert center<ArrowRight size={15}/></button></div>
    </section>
    <div className="overview-priority-grid">
      <button onClick={()=>{changeView('Orders');setFilter('All')}}><span className="overview-priority-icon"><ShoppingBag size={19}/></span><span><small>Orders today</small><strong>{todayOrderCount}</strong><em>{taka(todayOrderValue)} order value</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{changeView('Orders');setFilter('All')}}><span className="overview-priority-icon"><Package size={19}/></span><span><small>Open fulfillment</small><strong>{openOrderCount}</strong><em>{readyToPackOrders} ready to pack · {outForDeliveryOrders} out for delivery</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{changeView('Finances');setFinanceTab('Collections')}}><span className="overview-priority-icon"><Wallet size={19}/></span><span><small>Collections pending</small><strong>{taka(pendingCollections)}</strong><em>{pendingCollectionOrders} orders with balance</em></span><ChevronRight size={16}/></button>
      <button onClick={()=>{changeView('Inventory');setFilter('Low stock')}}><span className="overview-priority-icon"><AlertTriangle size={19}/></span><span><small>Stock attention</small><strong>{inventoryOutCount+inventoryLowCount}</strong><em>{inventoryOutCount} out · {inventoryLowCount} low</em></span><ChevronRight size={16}/></button>
    </div>
    <SectionPanel className="overview-work-queue">
      <div className="panel-heading"><div><h2>Work queue</h2><p>Exceptions that can change today&apos;s operation.</p></div><span className={'overview-work-count '+(alertCritical||attention||purchasingOverdueCount?'active':'')}>{alertCritical+attention+purchasingOverdueCount} signals</span></div>
      <div className="overview-work-grid">
        <button onClick={()=>changeView('Alerts')} className={alertCritical?'urgent':''}><span className="attention-icon rose"><Bell size={18}/></span><span><strong>{alertCritical?alertCritical+' critical '+(alertCritical===1?'alert':'alerts'):'No critical alerts'}</strong><small>{alertAction} action-needed · {alertUpcoming} upcoming</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{changeView('Inventory');setFilter('Low stock')}} className={inventoryOutCount?'urgent':''}><span className="attention-icon amber"><Package size={18}/></span><span><strong>{inventoryOutCount+inventoryLowCount} stock issues</strong><small>{inventoryOutCount} out of stock · {inventoryLowCount} below reorder threshold</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{changeView('Follow-ups');setFilter(followUpOverdueCount?'Overdue':'Today')}} className={followUpOverdueCount?'urgent':''}><span className="attention-icon blue"><CalendarCheck size={18}/></span><span><strong>{followUpOverdueCount?followUpOverdueCount+' overdue follow-ups':followUpTodayCount+' follow-ups due today'}</strong><small>{followUpOpenCount} open customer reminders</small></span><ChevronRight size={16}/></button>
        <button onClick={()=>{changeView('Suppliers');setPurchasingTab('Purchase orders');setFilter(purchasingOverdueCount?'Overdue':'Sent')}} className={purchasingOverdueCount?'urgent':''}><span className="attention-icon amber"><Truck size={18}/></span><span><strong>{purchasingOverdueCount?purchasingOverdueCount+' overdue purchase orders':'No overdue purchase orders'}</strong><small>{purchasingIncomingUnits} units still incoming</small></span><ChevronRight size={16}/></button>
      </div>
    </SectionPanel>
    <div className="dashboard-middle overview-insight-grid">
      <SectionPanel className="sales-panel">
        <div className="panel-heading"><div><h2>Sales trend</h2><p>Delivered product revenue for operating context</p></div><Choice value={range} onChange={setRange} label="Sales chart period" options={[{value:'7',label:'Last 7 days'},{value:'30',label:'Last 30 days'}]}/></div>
        <div className="chart-total"><strong>{taka(periodSales)}</strong><span><i className="legend-dot green"/>Product revenue</span></div>
        <div className="sales-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{top:10,right:10,left:-15,bottom:0}}><defs><linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#a76556" stopOpacity={.2}/><stop offset="100%" stopColor="#a76556" stopOpacity={.01}/></linearGradient></defs><CartesianGrid vertical={false} stroke="#eee2dc" strokeDasharray="4 4"/><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill:'#816e66',fontSize:12}} minTickGap={28} dy={10}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#816e66',fontSize:12}} tickFormatter={value=>Number(value)>=1000?(Number(value)/1000)+'k':String(value)}/><Tooltip formatter={value=>[taka(Number(value)),'Sales']} contentStyle={{borderRadius:10,border:'1px solid #e9dcd5',fontSize:14}}/><Area type="monotone" dataKey="sales" stroke="#9f5949" strokeWidth={2.5} fill="url(#sales-fill)"/></AreaChart></ResponsiveContainer></div>
      </SectionPanel>
      <SectionPanel className="overview-health-panel">
        <div className="panel-heading"><div><h2>Business health</h2><p>Compact management context without duplicating the work queue.</p></div></div>
        <div className="overview-health-list">
          <button onClick={()=>{changeView('Finances');setFinanceTab('Overview')}}><span><small>Operating result</small><strong className={profit<0?'money-negative':'money-positive'}>{signedTaka(profit)}</strong></span><ChevronRight size={16}/></button>
          <button onClick={()=>{changeView('Inventory');setInventoryTab('Products');setFilter('All')}}><span><small>Available inventory</small><strong>{inventoryUnits} units</strong></span><ChevronRight size={16}/></button>
          <button onClick={()=>changeView('Customers')}><span><small>Customer base</small><strong>{customerCount}</strong></span><ChevronRight size={16}/></button>
          <button onClick={()=>{changeView('Finances');setFinanceTab('Payables')}}><span><small>Supplier payables</small><strong>{taka(unpaidStock)}</strong></span><ChevronRight size={16}/></button>
        </div>
      </SectionPanel>
    </div>
    <div className="dashboard-bottom"><SectionPanel className="orders-panel"><div className="panel-heading"><div><h2>Recent orders</h2><p>Latest five records for a quick handoff check</p></div><button className="text-button" onClick={()=>changeView('Orders')}>Open order pipeline<ArrowRight size={15}/></button></div>{orderTable(recentOrders)}</SectionPanel></div>
  </WorkspaceSection>;
}
