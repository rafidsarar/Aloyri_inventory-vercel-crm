'use client';

import { useEffect,useState } from 'react';
import { ArrowUpRight, CalendarCheck, CheckCircle2, ChevronRight, Download, Package, Plus, Receipt, RefreshCw, ShieldCheck, ShoppingBag, TrendingUp, Truck, Users, Wallet } from 'lucide-react';
import { Area,AreaChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis } from 'recharts';
import { dateLabel,taka,type Batch,type Order,type Product } from '@/lib/crm';
import type { WorkspaceRole } from '@/lib/roles';
import { canManageBusinessSettings } from '@/lib/roles';
import { Choice } from '../forms';
import { Empty,WorkspaceSection,type View } from '../crm-ui';

type AnyFn=(...args:any[])=>any;
type Ctx={
  reportMonth:string; reportPulseTone:string; reportPulse:string; reportOrders:Order[];
  setReportMonth:(value:string)=>void; reportMonths:string[]; changeView:(view:View)=>void; canExport:boolean;
  exportManagementReport:AnyFn; reportRevenue:number; reportRevenueDelta:number|null; reportProfit:number;
  reportMargin:number; reportAov:number; reportRepeatRate:number; reportRepeatCustomers:number;
  reportCustomerIds:string[]; reportReturnRate:number; reportReturnedOrders:Order[]; reportNewCustomers:number;
  reportInsightTone:{revenue:string;retention:string;operations:string}; inventoryOut:Product[]; inventoryLow:Product[];
  monthlyTrend:any[]; signedTaka:(amount:number)=>string; reportWorkingCapital:number; reportChannelRows:any[];
  reportTopChannel:any|null; reportProductRows:any[]; reportProductMax:number; m:any; reportPurchaseOrders:any[];
  reportPurchasingValue:number; reportTopProduct:any|null; reportProductProfitability:any[]; reportCustomerValue:any[];
  setDetail:AnyFn; inventoryAgeing:any[]; inventoryAgeingTotal:number; supplierPerformance:any[];
  managementActionQueue:any[]; managementControlScore:number; integrityIssues:any[]; unassignedMovements:number;
  automationActiveRules:number; inventoryExpired:Batch[]; projected30:number; reportCollectionRate:number;
  role:WorkspaceRole; openModal:AnyFn;
};
type Props={ctx:Ctx};

export default function ReportsSection({ctx}:Props){
  const [stage4,setStage4]=useState<any>(null);
  const [stage4Error,setStage4Error]=useState('');
  const [stage4Loading,setStage4Loading]=useState(true);
  useEffect(()=>{let active=true;setStage4Loading(true);fetch('/api/operational-intelligence',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load operational intelligence.');if(active){setStage4(data);setStage4Error('')}}).catch(error=>{if(active)setStage4Error(error instanceof Error?error.message:'Could not load operational intelligence.')}).finally(()=>{if(active)setStage4Loading(false)});return()=>{active=false}},[reportMonth]);
  const {
    reportMonth,reportPulseTone,reportPulse,reportOrders,setReportMonth,reportMonths,changeView,
    canExport,exportManagementReport,reportRevenue,reportRevenueDelta,reportProfit,reportMargin,
    reportAov,reportRepeatRate,reportRepeatCustomers,reportCustomerIds,reportReturnRate,
    reportReturnedOrders,reportNewCustomers,reportInsightTone,inventoryOut,inventoryLow,monthlyTrend,
    signedTaka,reportWorkingCapital,reportChannelRows,reportTopChannel,reportProductRows,
    reportProductMax,m,reportPurchaseOrders,reportPurchasingValue,reportTopProduct,
    reportProductProfitability,reportCustomerValue,setDetail,inventoryAgeing,inventoryAgeingTotal,
    supplierPerformance,managementActionQueue,managementControlScore,integrityIssues,
    unassignedMovements,automationActiveRules,inventoryExpired,projected30,reportCollectionRate,
    role,openModal
  }=ctx;
  return <WorkspaceSection className="management-report-page">
<section className="management-report-hero">
  <div className="management-report-hero-copy">
    <span className="management-report-eyebrow"><TrendingUp size={15}/>Management reports</span>
    <h2>Executive performance overview</h2>
    <p>See commercial performance, customer quality, product momentum and operational exposure for the selected month.</p>
    <div className="management-report-meta">
      <span><CalendarCheck size={14}/>{new Date(reportMonth+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}</span>
      <span className={'management-pulse '+reportPulseTone}><span/>{reportPulse}</span>
      <span><Receipt size={14}/>{reportOrders.length} delivered orders</span>
    </div>
  </div>
  <div className="management-report-period">
    <small>Reporting period</small>
    <Choice value={reportMonth} onChange={setReportMonth} label="Report month" options={reportMonths.map(v=>({value:v,label:new Date(v+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'long',year:'numeric'})}))}/>
    <div className="management-report-quick-actions">
      <button onClick={()=>changeView('Orders')}><ShoppingBag size={14}/>Orders</button>
      <button onClick={()=>changeView('Customers')}><Users size={14}/>Customers</button>
      <button onClick={()=>changeView('Finances')}><Wallet size={14}/>Finances</button>
      {canExport&&<button onClick={exportManagementReport}><Download size={14}/>Export</button>}
    </div>
  </div>
</section>

<nav className="management-report-nav" aria-label="Management report sections">
  <button onClick={()=>document.getElementById('management-overview')?.scrollIntoView({behavior:'smooth',block:'start'})}>Overview</button>
  <button onClick={()=>document.getElementById('management-trend')?.scrollIntoView({behavior:'smooth',block:'start'})}>Trend</button>
  <button onClick={()=>document.getElementById('management-products')?.scrollIntoView({behavior:'smooth',block:'start'})}>Products</button>
  <button onClick={()=>document.getElementById('management-signals')?.scrollIntoView({behavior:'smooth',block:'start'})}>Signals</button>
  <button onClick={()=>document.getElementById('management-intelligence')?.scrollIntoView({behavior:'smooth',block:'start'})}>Intelligence</button>
  <button onClick={()=>document.getElementById('management-controls')?.scrollIntoView({behavior:'smooth',block:'start'})}>Controls</button>
</nav>

<section id="management-stage4-control" className="management-intelligence-section">
  <div className="management-section-title">
    <div><span className="management-section-kicker">Stage 4 · Operational intelligence</span><h2>Operational control center</h2><p>Server-calculated management controls, retention signals and scale health from the relational source of truth.</p></div>
    <span className={'management-pulse '+(stage4?.hardening?.ok?'positive':'neutral')}><span/>{stage4Loading?'Refreshing':stage4?.hardening?.ok?'Controls healthy':'Review controls'}</span>
  </div>
  {stage4Error?<div className="info-strip"><ShieldCheck size={17}/><span>{stage4Error}</span></div>:stage4Loading?<div className="panel loading-panel"><p className="muted">Loading operational intelligence…</p></div>:stage4&&<>
    <div className="management-kpi-grid" aria-label="Operational dashboard">
      <button className="management-kpi-card" onClick={()=>changeView('Orders')}><div className="management-kpi-head"><span className="management-kpi-icon"><ShoppingBag size={17}/></span><small>Open orders</small><ChevronRight size={14}/></div><strong>{stage4.dashboard.openOrders}</strong><div className="management-kpi-foot"><span>{stage4.dashboard.dueTasks} follow-ups due</span></div></button>
      <button className="management-kpi-card" onClick={()=>changeView('Inventory')}><div className="management-kpi-head"><span className="management-kpi-icon"><Package size={17}/></span><small>Stock exposure</small><ChevronRight size={14}/></div><strong>{stage4.dashboard.outOfStock}</strong><div className="management-kpi-foot"><span>{stage4.dashboard.lowStock} low-stock items</span></div></button>
      <button className="management-kpi-card" onClick={()=>changeView('Suppliers')}><div className="management-kpi-head"><span className="management-kpi-icon"><Truck size={17}/></span><small>Overdue POs</small><ChevronRight size={14}/></div><strong>{stage4.dashboard.overduePurchaseOrders}</strong><div className="management-kpi-foot"><span>{taka(stage4.dashboard.payables)} payables</span></div></button>
      <button className="management-kpi-card" onClick={()=>changeView('Finances')}><div className="management-kpi-head"><span className="management-kpi-icon"><Wallet size={17}/></span><small>Receivables</small><ChevronRight size={14}/></div><strong>{taka(stage4.dashboard.receivables)}</strong><div className="management-kpi-foot"><span>{stage4.auditControl.issueCount} control issues</span></div></button>
      <button className="management-kpi-card" onClick={()=>changeView('Automation')}><div className="management-kpi-head"><span className="management-kpi-icon"><ShieldCheck size={17}/></span><small>Automation</small><ChevronRight size={14}/></div><strong>{stage4.automation.activeRules}/{stage4.automation.totalRules}</strong><div className="management-kpi-foot"><span>{stage4.automation.critical} critical · {stage4.automation.actionNeeded} action</span></div></button>
      <div className="management-kpi-card"><div className="management-kpi-head"><span className="management-kpi-icon"><TrendingUp size={17}/></span><small>Scale pressure</small></div><strong>{String(stage4.performance.pressure).toUpperCase()}</strong><div className="management-kpi-foot"><span>{stage4.performance.entityCount.toLocaleString()} records · {stage4.performance.calculationMs} ms</span></div></div>
    </div>
    <div className="management-report-grid secondary">
      <section className="panel management-intelligence-card">
        <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Retention & replenishment</span><h2>Customer return queue</h2><p>Customers whose observed purchase cadence suggests they are due or nearly due to buy again.</p></div><button className="management-text-action" onClick={()=>changeView('Follow-ups')}>Follow-ups<ChevronRight size={14}/></button></div>
        {stage4.retention.queue.filter((row:any)=>row.status!=='future').slice(0,6).length?<div className="management-value-list">{stage4.retention.queue.filter((row:any)=>row.status!=='future').slice(0,6).map((row:any)=><button key={row.customerId} onClick={()=>setDetail({type:'customer',id:row.customerId})}><span className="management-rank">{row.status==='overdue'?'!':'•'}</span><span><strong>{row.name}</strong><small>{row.orders} delivered orders · typical gap {row.averageGapDays} days</small></span><strong>{row.predictedNextPurchase}</strong><ChevronRight size={14}/></button>)}</div>:<Empty title="No retention queue" text="No past buyer is currently overdue or due soon based on observed purchase cadence."/>}
      </section>
      <section className="panel management-intelligence-card">
        <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Inventory intelligence</span><h2>Replenishment priorities</h2><p>60-day demand velocity, current stock cover and suggested reorder quantity.</p></div><button className="management-text-action" onClick={()=>changeView('Inventory')}>Inventory<ChevronRight size={14}/></button></div>
        <div className="management-profit-list">{stage4.replenishment.products.filter((row:any)=>row.risk!=='healthy').slice(0,6).map((row:any)=><div className="management-profit-row" key={row.productId}><span><strong>{row.name}</strong><small>{row.available} available · {row.coverDays===null?'No recent velocity':row.coverDays+' days cover'}</small></span><span><strong>{row.suggestedReorderQty} units</strong><small>{row.risk.replace('-', ' ')}</small></span></div>)}</div>
        {!stage4.replenishment.products.some((row:any)=>row.risk!=='healthy')&&<Empty title="Stock cover is healthy" text="No active product currently needs replenishment attention."/>}
      </section>
      <section className="panel management-intelligence-card">
        <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Audit & control center</span><h2>Control health</h2><p>Integrity exceptions and relational authority checks.</p></div><button className="management-text-action" onClick={()=>changeView('Activity')}>Audit log<ChevronRight size={14}/></button></div>
        <div className="management-ageing-list">{stage4.hardening.checks.map((check:any)=><div key={check.key}><span><strong>{check.key.replaceAll('-',' ')}</strong><small>{check.detail}</small></span><strong>{check.ok?'PASS':'REVIEW'}</strong></div>)}</div>
        <div className="management-mini-summary"><span><small>Unassigned movements</small><strong>{stage4.auditControl.controls.unassigned}</strong></span><span><small>Broken transfers</small><strong>{stage4.auditControl.controls.brokenTransfers}</strong></span></div>
      </section>
      <section className="panel management-intelligence-card">
        <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Performance & scale</span><h2>Dataset health</h2><p>Current entity volume and server calculation cost for the intelligence layer.</p></div></div>
        <div className="management-mini-summary"><span><small>Total entities</small><strong>{stage4.performance.entityCount.toLocaleString()}</strong></span><span><small>Approx. state size</small><strong>{(stage4.performance.approximateBytes/1024/1024).toFixed(2)} MB</strong></span></div>
        <div className="management-focus-card"><span>Relational authority</span><strong>{stage4.source.cutover.enabled?'Enabled':'Needs review'}</strong><small>{stage4.source.domainVersions.length} independently versioned core domains · generated {new Date(stage4.generatedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</small></div>
      </section>
    </div>
  </>}
</section>

<section id="management-overview" className="management-kpi-grid" aria-label="Management key performance indicators">
  <button className="management-kpi-card primary" onClick={()=>changeView('Finances')}>
    <div className="management-kpi-head"><span className="management-kpi-icon"><ArrowUpRight size={17}/></span><small>Revenue</small><ChevronRight size={14}/></div>
    <strong>{taka(reportRevenue)}</strong>
    <div className="management-kpi-foot"><span className={reportRevenueDelta===null?'neutral':reportRevenueDelta>=0?'positive':'negative'}>{reportRevenueDelta===null?'No prior-month baseline':(reportRevenueDelta>=0?'+':'')+reportRevenueDelta+'% vs previous month'}</span></div>
  </button>
  <button className="management-kpi-card" onClick={()=>changeView('Finances')}>
    <div className="management-kpi-head"><span className="management-kpi-icon"><Wallet size={17}/></span><small>Operating profit</small><ChevronRight size={14}/></div>
    <strong className={reportProfit<0?'money-negative':'money-positive'}>{signedTaka(reportProfit)}</strong>
    <div className="management-kpi-foot"><span>{reportMargin.toFixed(1)}% operating margin</span></div>
  </button>
  <button className="management-kpi-card" onClick={()=>changeView('Orders')}>
    <div className="management-kpi-head"><span className="management-kpi-icon"><ShoppingBag size={17}/></span><small>Average order</small><ChevronRight size={14}/></div>
    <strong>{taka(reportAov)}</strong>
    <div className="management-kpi-foot"><span>{reportOrders.length} delivered orders</span></div>
  </button>
  <button className="management-kpi-card" onClick={()=>changeView('Customers')}>
    <div className="management-kpi-head"><span className="management-kpi-icon"><Users size={17}/></span><small>Repeat customers</small><ChevronRight size={14}/></div>
    <strong>{reportRepeatRate.toFixed(0)}%</strong>
    <div className="management-kpi-foot"><span>{reportRepeatCustomers} repeat of {reportCustomerIds.length} buyers</span></div>
  </button>
  <button className="management-kpi-card" onClick={()=>changeView('Orders')}>
    <div className="management-kpi-head"><span className="management-kpi-icon"><RefreshCw size={17}/></span><small>Return rate</small><ChevronRight size={14}/></div>
    <strong>{reportReturnRate.toFixed(1)}%</strong>
    <div className="management-kpi-foot"><span>{reportReturnedOrders.length} returned orders</span></div>
  </button>
  <button className="management-kpi-card" onClick={()=>changeView('Customers')}>
    <div className="management-kpi-head"><span className="management-kpi-icon"><Plus size={17}/></span><small>New customers</small><ChevronRight size={14}/></div>
    <strong>{reportNewCustomers}</strong>
    <div className="management-kpi-foot"><span>Profiles created this month</span></div>
  </button>
</section>

<section className="management-executive-strip" aria-label="Executive insights">
  <div className={'management-insight '+reportInsightTone.revenue}><span>Revenue direction</span><strong>{reportRevenueDelta===null?'Baseline building':reportRevenueDelta>=0?'Growing':'Below prior month'}</strong><small>{reportRevenueDelta===null?'More history will improve month-on-month context.':Math.abs(reportRevenueDelta)+'% '+(reportRevenueDelta>=0?'above':'below')+' previous month.'}</small></div>
  <div className={'management-insight '+reportInsightTone.retention}><span>Customer quality</span><strong>{reportRepeatRate>=35?'Strong repeat mix':reportRepeatRate>=20?'Developing retention':'Retention opportunity'}</strong><small>{reportRepeatCustomers} repeat buyers from {reportCustomerIds.length} purchasing customers.</small></div>
  <div className={'management-insight '+reportInsightTone.operations}><span>Operational exposure</span><strong>{reportReturnRate>12?'Returns need review':inventoryOut.length?'Stock-outs need action':'Controls look stable'}</strong><small>{reportReturnRate.toFixed(1)}% returns · {inventoryOut.length} out of stock · {inventoryLow.length} low stock.</small></div>
</section>

<div id="management-trend" className="management-report-grid main">
  <section className="panel management-trend-panel">
    <div className="panel-heading management-panel-heading">
      <div><span className="management-section-kicker">Performance trend</span><h2>Six-month business trend</h2><p>Revenue, operating profit and net cash movement across the latest six months.</p></div>
      <div className="management-chart-legend"><span>Revenue</span><span>Profit</span><span>Net cash</span></div>
    </div>
    <div className="management-chart"><ResponsiveContainer width="100%" height={280}><AreaChart data={monthlyTrend} margin={{top:10,right:8,left:0,bottom:0}}><defs/><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false}/><YAxis width={58} tickFormatter={value=>'৳'+Math.round(Number(value)/1000)+'k'} tickLine={false} axisLine={false}/><Tooltip formatter={(value)=>taka(Number(value))}/><Area type="monotone" dataKey="revenue" name="Revenue" fillOpacity={0.14} strokeWidth={2}/><Area type="monotone" dataKey="profit" name="Operating profit" fillOpacity={0.07} strokeWidth={2}/><Area type="monotone" dataKey="cash" name="Net cash" fillOpacity={0.03} strokeWidth={2}/></AreaChart></ResponsiveContainer></div>
    <div className="management-trend-summary"><span><small>Current revenue</small><strong>{taka(reportRevenue)}</strong></span><span><small>Current profit</small><strong>{signedTaka(reportProfit)}</strong></span><span><small>Working capital gap</small><strong>{signedTaka(reportWorkingCapital)}</strong></span></div>
  </section>

  <section className="panel management-channel-panel">
    <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Sales mix</span><h2>Channel performance</h2><p>Delivered revenue by channel.</p></div><button className="management-text-action" onClick={()=>changeView('Orders')}>View orders<ChevronRight size={14}/></button></div>
    {reportChannelRows.length?<div className="management-ranked-list">{reportChannelRows.map((row,index)=><button key={row.channel} className="management-ranked-row" onClick={()=>changeView('Orders')}><span className="management-rank">{index+1}</span><span className="management-ranked-copy"><strong>{row.channel}</strong><small>{row.orders} orders · {reportRevenue?Math.round(row.revenue/reportRevenue*100):0}% of revenue</small><i aria-hidden="true"><b style={{width:Math.max(4,row.revenue/(reportTopChannel?.revenue||1)*100)+'%'}}/></i></span><strong className="management-ranked-value">{taka(row.revenue)}</strong><ChevronRight size={14}/></button>)}</div>:<Empty title="No delivered sales" text="Channel performance will appear after delivered orders are recorded for this month."/>}
  </section>
</div>

<div className="management-report-grid secondary">
  <section id="management-products" className="panel">
    <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Product momentum</span><h2>Top products</h2><p>Ranked by delivered sales value during the selected month.</p></div><button className="management-text-action" onClick={()=>changeView('Inventory')}>Open inventory<ChevronRight size={14}/></button></div>
    {reportProductRows.length?<div className="management-product-list">{reportProductRows.map((row,index)=><button key={row.product.id} className="management-product-row" onClick={()=>changeView('Inventory')}><span className="management-rank">{index+1}</span><span className="management-product-copy"><strong>{row.product.brand} {row.product.name}</strong><small>{row.units} units sold · {taka(row.revenue)}</small><i aria-hidden="true"><b style={{width:Math.max(5,row.revenue/reportProductMax*100)+'%'}}/></i></span><span className="management-product-share">{reportRevenue?Math.round(row.revenue/reportRevenue*100):0}%</span><ChevronRight size={14}/></button>)}</div>:<Empty title="No product sales yet" text="Top products will appear when delivered orders exist for this month."/>}
  </section>

  <section id="management-signals" className="panel">
    <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Decision support</span><h2>Management signals</h2><p>Current operational context behind the selected month’s result.</p></div></div>
    <div className="management-signal-list">
      <button onClick={()=>changeView('Customers')}><span className="management-signal-icon"><Users size={17}/></span><span><strong>Customer base</strong><small>{reportCustomerIds.length} purchasing · {reportRepeatCustomers} repeat · {reportNewCustomers} new</small></span><span className="management-signal-value">{reportRepeatRate.toFixed(0)}% repeat</span><ChevronRight size={16}/></button>
      <button onClick={()=>changeView('Inventory')}><span className="management-signal-icon"><Package size={17}/></span><span><strong>Inventory exposure</strong><small>{inventoryLow.length} low-stock · {inventoryOut.length} out of stock</small></span><span className="management-signal-value">{taka(m.stockValue)}</span><ChevronRight size={16}/></button>
      <button onClick={()=>changeView('Suppliers')}><span className="management-signal-icon"><Truck size={17}/></span><span><strong>Purchasing activity</strong><small>{reportPurchaseOrders.length} purchase orders created</small></span><span className="management-signal-value">{taka(reportPurchasingValue)}</span><ChevronRight size={16}/></button>
      <button onClick={()=>changeView('Finances')}><span className="management-signal-icon"><Wallet size={17}/></span><span><strong>Working capital</strong><small>{taka(m.pending)} receivables · {taka(m.unpaidStock)} payables</small></span><span className="management-signal-value">{signedTaka(reportWorkingCapital)}</span><ChevronRight size={16}/></button>
    </div>
    <div className="management-focus-card">
      <span>Executive focus</span>
      <strong>{reportProfit<0?'Restore profitability before scaling spend.':reportReturnRate>12?'Reduce return leakage and review fulfillment quality.':inventoryOut.length?'Resolve stock-outs on active demand.':reportRepeatRate<20?'Strengthen repeat purchase and replenishment follow-up.':'Protect profitable growth and retention.'}</strong>
      <small>{reportTopProduct?'Top product: '+reportTopProduct.product.brand+' '+reportTopProduct.product.name+' · '+taka(reportTopProduct.revenue):'Product ranking will appear after delivered sales.'}</small>
    </div>
  </section>
</div>

<section id="management-intelligence" className="management-intelligence-section">
  <div className="management-section-title">
    <div><span className="management-section-kicker">Business intelligence</span><h2>What is creating value—and tying up cash</h2><p>Use profitability, customer value, stock age and supplier performance to decide where management attention should go next.</p></div>
  </div>
  <div className="management-intelligence-grid">
    <section className="panel management-intelligence-card">
      <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Product economics</span><h2>Product profitability</h2><p>Delivered product revenue less allocated inventory cost.</p></div></div>
      {reportProductProfitability.length?<div className="management-profit-list">{reportProductProfitability.map(row=><div className="management-profit-row" key={row.product.id}><span><strong>{row.product.brand} {row.product.name}</strong><small>{row.units} units · {row.margin.toFixed(1)}% gross margin</small></span><span><strong>{taka(row.gross)}</strong><small>{taka(row.revenue)} revenue</small></span></div>)}</div>:<Empty title="No delivered product sales" text="Profitability appears when delivered orders exist for the selected month."/>}
    </section>

    <section className="panel management-intelligence-card">
      <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Customer economics</span><h2>Highest-value customers</h2><p>All-time delivered revenue and repeat-order depth.</p></div></div>
      {reportCustomerValue.length?<div className="management-value-list">{reportCustomerValue.map((row,index)=><button key={row.customer.id} onClick={()=>setDetail({type:'customer',id:row.customer.id})}><span className="management-rank">{index+1}</span><span><strong>{row.customer.name}</strong><small>{row.orders} orders · AOV {taka(row.aov)}{row.last?' · last '+dateLabel(row.last):''}</small></span><strong>{taka(row.revenue)}</strong><ChevronRight size={14}/></button>)}</div>:<Empty title="No customer value history" text="Customer value appears after delivered orders are recorded."/>}
    </section>

    <section className="panel management-intelligence-card">
      <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Working capital</span><h2>Inventory ageing</h2><p>Remaining stock value by time since receipt.</p></div></div>
      <div className="management-ageing-list">{inventoryAgeing.map(row=><div key={row.label}><span><strong>{row.label}</strong><small>{row.units} units</small></span><div className="management-ageing-bar"><i style={{width:(inventoryAgeingTotal?Math.max(2,row.value/inventoryAgeingTotal*100):0)+'%'}}/></div><strong>{taka(row.value)}</strong></div>)}</div>
      <div className="management-mini-summary"><span><small>Total inventory value</small><strong>{taka(inventoryAgeingTotal)}</strong></span><span><small>90+ day stock</small><strong>{taka(inventoryAgeing.find(x=>x.label==='90+ days')?.value||0)}</strong></span></div>
    </section>

    <section className="panel management-intelligence-card">
      <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Supply reliability</span><h2>Supplier performance</h2><p>Purchase activity, overdue orders and observed lead time.</p></div></div>
      {supplierPerformance.length?<div className="management-supplier-list">{supplierPerformance.map(row=><button key={row.supplier.id} onClick={()=>setDetail({type:'supplier',id:row.supplier.id})}><span><strong>{row.supplier.name}</strong><small>{row.orders} POs · {row.received} received · {row.open} open</small></span><span><strong className={row.overdue?'money-negative':''}>{row.overdue?row.overdue+' overdue':'On schedule'}</strong><small>{row.avgLead===null?'Lead time building':row.avgLead+'d avg lead'} · {taka(row.value)}</small></span><ChevronRight size={14}/></button>)}</div>:<Empty title="No supplier performance history" text="Supplier performance appears after purchase orders are created."/>}
    </section>
  </div>
</section>

<section id="management-controls" className="management-controls-grid">
  <section className="panel management-action-panel">
    <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Management action queue</span><h2>What needs intervention</h2><p>Only material exceptions are surfaced here so management can act without scanning every module.</p></div><span className="management-action-count">{managementActionQueue.length}</span></div>
    {managementActionQueue.length?<div className="management-action-list">{managementActionQueue.map(item=><button key={item.id} onClick={()=>changeView(item.view)}><span className={'management-action-level '+(item.level==='Critical'?'critical':'action')}>{item.level}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span><ChevronRight size={16}/></button>)}</div>:<div className="management-all-clear"><CheckCircle2 size={24}/><span><strong>No material management exceptions</strong><small>Current operational signals do not require immediate intervention.</small></span></div>}
  </section>

  <section className="panel management-control-panel">
    <div className="panel-heading management-panel-heading"><div><span className="management-section-kicker">Control health</span><h2>Operating safeguards</h2><p>Data integrity, cash discipline and automation coverage at a glance.</p></div></div>
    <div className="management-control-score"><span><strong>{managementControlScore}</strong><small>/100</small></span><div><strong>{managementControlScore>=90?'Strong controls':managementControlScore>=70?'Review exceptions':'Attention required'}</strong><small>Operational control indicator</small></div></div>
    <div className="management-control-list">
      <button onClick={()=>changeView('Finances')}><span>Workspace integrity</span><strong>{integrityIssues.length?integrityIssues.length+' issues':'Clear'}</strong></button>
      <button onClick={()=>changeView('Finances')}><span>Unassigned cash movements</span><strong>{unassignedMovements}</strong></button>
      <button onClick={()=>changeView('Automation')}><span>Active automation rules</span><strong>{automationActiveRules}</strong></button>
      <button onClick={()=>changeView('Inventory')}><span>Expired stock batches</span><strong>{inventoryExpired.length}</strong></button>
      <button onClick={()=>changeView('Finances')}><span>30-day projected cash</span><strong className={projected30<0?'money-negative':'money-positive'}>{signedTaka(projected30)}</strong></button>
      <button onClick={()=>changeView('Finances')}><span>Selected-month collection rate</span><strong>{reportCollectionRate.toFixed(0)}%</strong></button>
    </div>
    {canManageBusinessSettings(role)&&<button className="btn secondary management-data-button" onClick={()=>openModal({type:'settings'})}><ShieldCheck size={15}/>Open data management</button>}
  </section>
</section>
</WorkspaceSection>;
}
