'use client';

import { AlertTriangle, ArrowRight, Bell, CalendarCheck, CheckCircle2, ChevronRight, Clock, Mail, Package, Receipt, ShieldCheck, ShoppingBag, Truck, Users, Wallet, Zap } from 'lucide-react';
import type { AutomationSettings, AutomationSignal } from '@/lib/crm';
import { Choice } from '../forms';
import { Empty, WorkspaceSection, type View } from '../crm-ui';

type Props={
  settings:AutomationSettings;
  busy:boolean;
  automationActiveRules:number;
  automationCritical:number;
  automationAction:number;
  automationUpcoming:number;
  automationLive:AutomationSignal[];
  automationRuleNames:Record<keyof AutomationSettings,string>;
  updateAutomationRule:<K extends keyof AutomationSettings>(rule:K,patch:Partial<AutomationSettings[K]>)=>Promise<void>;
  changeView:(view:View)=>void;
  setFinanceTab:(value:string)=>void;
};

export default function AutomationSection({
  settings,busy,automationActiveRules,automationCritical,automationAction,automationUpcoming,
  automationLive,automationRuleNames,updateAutomationRule,changeView,setFinanceTab
}:Props){
  return <WorkspaceSection>
    <section className="automation-hero">
      <div><span className="orders-eyebrow"><Zap size={15}/>Safe operations automation</span><h2>Automation Center</h2><p>Let Aloyri surface work automatically while keeping payments, stock receiving, order status changes and customer messaging under staff control.</p></div>
      <span className="automation-live-badge"><i/>Live from CRM data</span>
    </section>
    <div className="automation-kpi-grid">
      <div><span className="automation-kpi-icon"><Zap size={18}/></span><span><small>Active rules</small><strong>{automationActiveRules}/8</strong><em>Rules currently enabled</em></span></div>
      <div><span className="automation-kpi-icon danger"><AlertTriangle size={18}/></span><span><small>Critical</small><strong>{automationCritical}</strong><em>Needs prompt attention</em></span></div>
      <div><span className="automation-kpi-icon"><Bell size={18}/></span><span><small>Action needed</small><strong>{automationAction}</strong><em>Work ready to complete</em></span></div>
      <div><span className="automation-kpi-icon"><Clock size={18}/></span><span><small>Upcoming</small><strong>{automationUpcoming}</strong><em>Early warnings</em></span></div>
    </div>
    <div className="automation-layout">
      <section className="panel automation-rules-panel">
        <div className="panel-heading"><div><h2>Automation rules</h2><p>Owner and Admin can change these rules. Alerts update immediately from live workspace records.</p></div></div>
        <div className="automation-rules-grid">
          <article className={'automation-rule-card '+(settings.deliveryFollowUp.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><CalendarCheck size={18}/></span><div><strong>Post-delivery follow-up</strong><small>Creates one internal customer-care reminder after a new delivery.</small></div><button className={'automation-toggle '+(settings.deliveryFollowUp.enabled?'on':'')} aria-label="Toggle post-delivery follow-up" aria-pressed={settings.deliveryFollowUp.enabled} disabled={busy} onClick={()=>void updateAutomationRule('deliveryFollowUp',{enabled:!settings.deliveryFollowUp.enabled})}><span/></button></div>
            <div className="automation-rule-config"><span><b>Action</b><em>Creates Follow-up record</em></span><Choice value={String(settings.deliveryFollowUp.delayDays)} onChange={v=>void updateAutomationRule('deliveryFollowUp',{delayDays:Number(v)})} options={[{value:'3',label:'3 days'},{value:'5',label:'5 days'},{value:'7',label:'7 days'},{value:'10',label:'10 days'},{value:'14',label:'14 days'}]} label="Follow-up delay"/></div>
          </article>
          <article className={'automation-rule-card '+(settings.lowStock.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><Package size={18}/></span><div><strong>Low-stock watch</strong><small>Flags products at or below their reorder threshold with a suggested quantity.</small></div><button className={'automation-toggle '+(settings.lowStock.enabled?'on':'')} aria-label="Toggle low-stock watch" aria-pressed={settings.lowStock.enabled} disabled={busy} onClick={()=>void updateAutomationRule('lowStock',{enabled:!settings.lowStock.enabled})}><span/></button></div>
            <div className="automation-rule-static"><b>Signal only</b><span>Inventory remains manual</span></div>
          </article>
          <article className={'automation-rule-card '+(settings.expiringStock.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><Clock size={18}/></span><div><strong>Expiry watch</strong><small>Surfaces batches approaching expiry while stock is still physically available.</small></div><button className={'automation-toggle '+(settings.expiringStock.enabled?'on':'')} aria-label="Toggle expiry watch" aria-pressed={settings.expiringStock.enabled} disabled={busy} onClick={()=>void updateAutomationRule('expiringStock',{enabled:!settings.expiringStock.enabled})}><span/></button></div>
            <div className="automation-rule-config"><span><b>Warning window</b><em>Before batch expiry</em></span><Choice value={String(settings.expiringStock.daysBefore)} onChange={v=>void updateAutomationRule('expiringStock',{daysBefore:Number(v)})} options={[{value:'30',label:'30 days'},{value:'60',label:'60 days'},{value:'90',label:'90 days'},{value:'120',label:'120 days'},{value:'180',label:'180 days'}]} label="Expiry warning window"/></div>
          </article>
          <article className={'automation-rule-card '+(settings.overduePurchaseOrders.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><Truck size={18}/></span><div><strong>Overdue purchase orders</strong><small>Flags sent or partially received POs after their expected date.</small></div><button className={'automation-toggle '+(settings.overduePurchaseOrders.enabled?'on':'')} aria-label="Toggle overdue purchase orders" aria-pressed={settings.overduePurchaseOrders.enabled} disabled={busy} onClick={()=>void updateAutomationRule('overduePurchaseOrders',{enabled:!settings.overduePurchaseOrders.enabled})}><span/></button></div>
            <div className="automation-rule-static"><b>Signal only</b><span>Supplier contact stays manual</span></div>
          </article>
          <article className={'automation-rule-card '+(settings.supplierPayments.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><Wallet size={18}/></span><div><strong>Supplier payment due</strong><small>Warns Finance before unpaid received-stock balances reach their due date.</small></div><button className={'automation-toggle '+(settings.supplierPayments.enabled?'on':'')} aria-label="Toggle supplier payment alerts" aria-pressed={settings.supplierPayments.enabled} disabled={busy} onClick={()=>void updateAutomationRule('supplierPayments',{enabled:!settings.supplierPayments.enabled})}><span/></button></div>
            <div className="automation-rule-config"><span><b>Warning window</b><em>Before payment due</em></span><Choice value={String(settings.supplierPayments.daysBefore)} onChange={v=>void updateAutomationRule('supplierPayments',{daysBefore:Number(v)})} options={[{value:'0',label:'Due date'},{value:'3',label:'3 days'},{value:'7',label:'7 days'},{value:'14',label:'14 days'},{value:'30',label:'30 days'}]} label="Supplier payment warning"/></div>
          </article>
          <article className={'automation-rule-card '+(settings.customerCollections.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><Receipt size={18}/></span><div><strong>Customer collection due</strong><small>Flags delivered orders that still have an outstanding customer/courier balance.</small></div><button className={'automation-toggle '+(settings.customerCollections.enabled?'on':'')} aria-label="Toggle customer collection alerts" aria-pressed={settings.customerCollections.enabled} disabled={busy} onClick={()=>void updateAutomationRule('customerCollections',{enabled:!settings.customerCollections.enabled})}><span/></button></div>
            <div className="automation-rule-config"><span><b>Grace period</b><em>After delivery</em></span><Choice value={String(settings.customerCollections.graceDays)} onChange={v=>void updateAutomationRule('customerCollections',{graceDays:Number(v)})} options={[{value:'0',label:'Immediate'},{value:'1',label:'1 day'},{value:'2',label:'2 days'},{value:'3',label:'3 days'},{value:'7',label:'7 days'}]} label="Collection grace period"/></div>
          </article>
          <article className={'automation-rule-card '+(settings.customerRetention.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><Users size={18}/></span><div><strong>Customer inactivity</strong><small>Surfaces past buyers with no active order or open care follow-up.</small></div><button className={'automation-toggle '+(settings.customerRetention.enabled?'on':'')} aria-label="Toggle customer inactivity alerts" aria-pressed={settings.customerRetention.enabled} disabled={busy} onClick={()=>void updateAutomationRule('customerRetention',{enabled:!settings.customerRetention.enabled})}><span/></button></div>
            <div className="automation-rule-config"><span><b>Inactive after</b><em>Since last delivery</em></span><Choice value={String(settings.customerRetention.inactivityDays)} onChange={v=>void updateAutomationRule('customerRetention',{inactivityDays:Number(v)})} options={[{value:'60',label:'60 days'},{value:'90',label:'90 days'},{value:'120',label:'120 days'},{value:'180',label:'180 days'}]} label="Customer inactivity period"/></div>
          </article>
          <article className={'automation-rule-card '+(settings.staleOrders.enabled?'enabled':'')}>
            <div className="automation-rule-head"><span className="automation-rule-icon"><ShoppingBag size={18}/></span><div><strong>Stale order watch</strong><small>Flags non-terminal orders that have remained open too long.</small></div><button className={'automation-toggle '+(settings.staleOrders.enabled?'on':'')} aria-label="Toggle stale order alerts" aria-pressed={settings.staleOrders.enabled} disabled={busy} onClick={()=>void updateAutomationRule('staleOrders',{enabled:!settings.staleOrders.enabled})}><span/></button></div>
            <div className="automation-rule-config"><span><b>Alert after</b><em>Since order creation</em></span><Choice value={String(settings.staleOrders.daysOpen)} onChange={v=>void updateAutomationRule('staleOrders',{daysOpen:Number(v)})} options={[{value:'1',label:'1 day'},{value:'2',label:'2 days'},{value:'3',label:'3 days'},{value:'5',label:'5 days'},{value:'7',label:'7 days'}]} label="Stale order period"/></div>
          </article>
        </div>
      </section>
      <aside className="panel automation-safety">
        <span className="care-icon"><ShieldCheck size={24}/></span><h2>Automation boundaries</h2><p>Aloyri automates reminders and business signals, not irreversible operational actions.</p>
        <div><CheckCircle2 size={16}/><span><strong>Automatic</strong><small>Post-delivery follow-up creation</small></span></div>
        <div><ShieldCheck size={16}/><span><strong>Staff-controlled</strong><small>Payments, stock receiving, PO sending and order status changes</small></span></div>
        <div><Mail size={16}/><span><strong>No automatic messages</strong><small>Customer and supplier contact always requires a person</small></span></div>
        <div className="automation-safety-note">Rules are evaluated from the current CRM data. When the underlying issue is resolved, its signal disappears automatically.</div>
      </aside>
    </div>
    <section className="panel automation-signals">
      <div className="panel-heading"><div><h2>Live automation signals</h2><p>{automationLive.length} current {automationLive.length===1?'signal':'signals'} across operations, customers and finance.</p></div><button className="text-button" onClick={()=>changeView('Alerts')}>Open alert center<ArrowRight size={15}/></button></div>
      {automationLive.length
        ? <div className="automation-list">{automationLive.map(signal=><button key={signal.key} className="automation-alert" onClick={()=>{changeView(signal.view);if(signal.view==='Finances'&&signal.rule==='customerCollections')setFinanceTab('Collections');if(signal.view==='Finances'&&signal.rule==='supplierPayments')setFinanceTab('Payables')}}><span className={'alert-level '+signal.level.toLowerCase().replace(' ','-')}>{signal.level}</span><span><strong>{signal.title}</strong><small>{automationRuleNames[signal.rule]} · {signal.detail}</small></span><ChevronRight size={17}/></button>)}</div>
        : <Empty title="No automation signals" text="All enabled rules are clear right now."/>}
    </section>
  </WorkspaceSection>;
}
