'use client';

import { AlertTriangle, ArrowRight, CalendarCheck, Check, ChevronRight, Clock, Leaf, Plus, Search, ShieldCheck, ShoppingBag, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import type { Customer, Order, Task } from '@/lib/crm';
import { shiftDate, today } from '@/lib/crm';
import { ActionBar,Empty,WorkspaceSection } from '../crm-ui';

type Detail={type:'order'|'customer'|'supplier';id:string};

type Props={
  focusText:string;
  canEdit:(key:string)=>boolean;
  openModal:(record:{type:'task';record?:Task})=>void;
  filter:string;
  setFilter:(value:string)=>void;
  query:string;
  setQuery:(value:string)=>void;
  followUpOpen:Task[];
  followUpOverdue:Task[];
  followUpToday:Task[];
  followUpUpcoming:Task[];
  followUpHigh:Task[];
  followUpRows:Task[];
  selectedTaskIds:string[];
  setSelectedTaskIds:(value:string[])=>void;
  tasks:Task[];
  busy:boolean;
  bulkCompleteFollowUps:()=>Promise<void>;
  customers:Customer[];
  orders:Order[];
  updateFollowUp:(task:Task,patch:Partial<Task>)=>Promise<void>;
  followUpDueLabel:(task:Task)=>string;
  setDetail:(detail:Detail)=>void;
  deleteFollowUp:(task:Task)=>void;
  changeView:(view:'Customers')=>void;
};

export default function FollowUpsSection({
  focusText,canEdit,openModal,filter,setFilter,query,setQuery,followUpOpen,followUpOverdue,
  followUpToday,followUpUpcoming,followUpHigh,followUpRows,selectedTaskIds,setSelectedTaskIds,
  tasks,busy,bulkCompleteFollowUps,customers,orders,updateFollowUp,followUpDueLabel,setDetail,
  deleteFollowUp,changeView
}:Props){
  return <WorkspaceSection>
    <section className="followup-header-card">
      <div className="followup-header-copy">
        <span className="orders-eyebrow"><CalendarCheck size={15}/>Customer care</span>
        <h2>Follow-ups</h2><p>{focusText}</p>
        <span className="followup-safe-note"><ShieldCheck size={14}/>Internal reminders only · no customer messages are sent automatically</span>
      </div>
      {canEdit('tasks')&&<button className="btn primary followup-add-button" onClick={()=>openModal({type:'task'})}><Plus size={16}/>Add follow-up</button>}
    </section>
    <div className="followup-kpi-grid">
      <button className={filter==='Open'?'active':''} onClick={()=>{setFilter(filter==='Open'?'All':'Open');setQuery('')}}><span className="followup-kpi-icon"><CalendarCheck size={18}/></span><span><small>Open</small><strong>{followUpOpen.length}</strong><em>Active reminders</em></span></button>
      <button className={filter==='Overdue'?'active danger':''} onClick={()=>{setFilter(filter==='Overdue'?'All':'Overdue');setQuery('')}}><span className="followup-kpi-icon danger"><AlertTriangle size={18}/></span><span><small>Overdue</small><strong>{followUpOverdue.length}</strong><em>Needs attention</em></span></button>
      <button className={filter==='Today'?'active':''} onClick={()=>{setFilter(filter==='Today'?'All':'Today');setQuery('')}}><span className="followup-kpi-icon"><Clock size={18}/></span><span><small>Today</small><strong>{followUpToday.length}</strong><em>Due today</em></span></button>
      <button className={filter==='Next 7 days'?'active':''} onClick={()=>{setFilter(filter==='Next 7 days'?'All':'Next 7 days');setQuery('')}}><span className="followup-kpi-icon"><ChevronRight size={18}/></span><span><small>Next 7 days</small><strong>{followUpUpcoming.length}</strong><em>Coming up</em></span></button>
    </div>
    <div className="followup-grid">
      <section className="panel followup-queue-panel">
        <ActionBar className="followup-toolbar">
          <div className="followup-toolbar-title"><h2>Follow-up queue</h2><p>{followUpRows.length} {followUpRows.length===1?'reminder':'reminders'} shown</p></div>
          <div className="followup-search"><Search size={16}/><Input aria-label="Search follow-ups" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search customer, phone, order or reminder"/></div>
        </ActionBar>
        <div className="followup-filter-strip">
          {['All','Open','Overdue','Today','Next 7 days','High priority','Replenishment','Completed'].map(option=><button key={option} className={'followup-filter-chip '+(filter===option?'active':'')} onClick={()=>setFilter(option)}>{option}{option==='Overdue'&&followUpOverdue.length>0?<span>{followUpOverdue.length}</span>:option==='Today'&&followUpToday.length>0?<span>{followUpToday.length}</span>:option==='High priority'&&followUpHigh.length>0?<span>{followUpHigh.length}</span>:null}</button>)}
        </div>
        {canEdit('tasks')&&followUpRows.length>0&&<div className="bulk-select-strip"><label><Checkbox aria-label="Select all shown follow-ups" checked={followUpRows.every(task=>selectedTaskIds.includes(task.id))} onCheckedChange={checked=>setSelectedTaskIds(checked===true?Array.from(new Set([...selectedTaskIds,...followUpRows.map(task=>task.id)])):selectedTaskIds.filter(id=>!followUpRows.some(task=>task.id===id)))}/><span>Select all shown</span></label>{selectedTaskIds.length>0&&<span>{selectedTaskIds.length} selected</span>}</div>}
        {selectedTaskIds.length>0&&<div className="bulk-action-bar bulk-action-bar-pro followup-bulk-bar"><span><strong>{selectedTaskIds.length}</strong> follow-ups selected<small>{tasks.filter(task=>selectedTaskIds.includes(task.id)&&!task.done).length} open reminders eligible</small></span><div><button className="btn secondary" onClick={()=>setSelectedTaskIds([])}>Clear</button><button className="btn primary" disabled={busy||!tasks.some(task=>selectedTaskIds.includes(task.id)&&!task.done)} onClick={()=>void bulkCompleteFollowUps()}><Check size={15}/>Mark complete</button></div></div>}
        {followUpRows.map(task=>{
          const customer=customers.find(item=>item.id===task.customerId);
          const linkedOrder=orders.find(order=>order.id===task.orderId);
          const dateState=task.done?'done':task.due<today()?'overdue':task.due===today()?'today':'upcoming';
          return <div className={'task-row task-row-pro '+(task.done?'task-done':'')} key={task.id}>
            {canEdit('tasks')&&<label className="task-bulk-select"><Checkbox aria-label={'Select '+task.title} checked={selectedTaskIds.includes(task.id)} onCheckedChange={checked=>setSelectedTaskIds(checked===true?[...selectedTaskIds.filter(id=>id!==task.id),task.id]:selectedTaskIds.filter(id=>id!==task.id))}/><span className="sr-only">Select</span></label>}
            <Checkbox aria-label={'Complete '+task.title} checked={task.done} disabled={busy||!canEdit('tasks')} onCheckedChange={checked=>void updateFollowUp(task,{done:checked===true})}/>
            <div className="task-main">
              <div className="task-heading-line"><span className="task-title task-title-static">{task.title}</span><span className={'task-date '+dateState}>{followUpDueLabel(task)}</span></div>
              <div className="task-links">{customer?<button onClick={()=>setDetail({type:'customer',id:customer.id})}><Users size={13}/>{customer.name}{customer.phone?' · '+customer.phone:''}</button>:<span><Users size={13}/>Business task</span>}{linkedOrder&&<button onClick={()=>setDetail({type:'order',id:linkedOrder.id})}><ShoppingBag size={13}/>#{linkedOrder.number}</button>}</div>
              <div className="task-meta"><span className={'task-priority-dot '+task.priority.toLowerCase()}></span><span>{task.priority} priority</span><span>·</span><span>{task.kind}</span><span>·</span><span>{task.channel}</span></div>
              {task.notes&&<p className="task-notes">{task.notes}</p>}
              {customer&&!customer.consent&&<span className="consent-note">Promotional consent not recorded</span>}
            </div>
            {canEdit('tasks')&&<div className="task-side"><div className="task-actions">{task.done?<button className="btn task-action-button" disabled={busy} onClick={()=>void updateFollowUp(task,{done:false,completedAt:''})}>Reopen</button>:<><button className="btn task-action-button" disabled={busy} onClick={()=>void updateFollowUp(task,{due:shiftDate(7)})}><Clock size={14}/>Snooze 7d</button><button className="btn task-action-button" disabled={busy} onClick={()=>openModal({type:'task',record:task})}>Edit</button></>}<button className="text-button delete-button task-delete-button" disabled={busy} onClick={()=>deleteFollowUp(task)}>Delete</button></div></div>}
          </div>;
        })}
        {!followUpRows.length&&<Empty title={tasks.length?'Nothing in this view':'No follow-ups yet'} text={tasks.length?'Try another filter or clear your search.':'Add a reminder manually, or deliver an order and Aloyri will create a customer-care follow-up for 7 days later.'} action={tasks.length?<button className="btn secondary" onClick={()=>{setFilter('All');setQuery('')}}>Clear filters</button>:undefined}/>}
      </section>
      <aside className="panel followup-guide">
        <span className="care-icon"><Leaf size={24}/></span><h2>Simple workflow</h2><p>Keep each customer conversation focused and easy for the next staff member to continue.</p>
        <ol className="followup-steps"><li><span>1</span><div><strong>Start with urgency</strong><small>Handle overdue and high-priority reminders first.</small></div></li><li><span>2</span><div><strong>Check context</strong><small>Open the customer or order before contacting them.</small></div></li><li><span>3</span><div><strong>Finish the loop</strong><small>Mark it complete, or snooze it if another contact is needed.</small></div></li></ol>
        <div className="followup-guide-note"><strong>Post-delivery automation</strong><small>Delivered orders create one customer-care reminder for 7 days later. Staff still choose when and how to contact the customer.</small></div>
        <button className="btn secondary" onClick={()=>changeView('Customers')}>View customers<ArrowRight size={16}/></button>
      </aside>
    </div>
  </WorkspaceSection>;
}
