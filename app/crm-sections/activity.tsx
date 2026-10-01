'use client';

import { Clock, Loader2, Search, ShieldCheck, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import { Avatar, Empty, Status } from '../crm-ui';

export type AuditEvent={
  id:string;
  actor_name:string;
  role:string;
  summary:string;
  sections:string[];
  created_at:string;
};

type Props={
  auditEvents:AuditEvent[];
  filteredAuditEvents:AuditEvent[];
  auditActorCount:number;
  auditLatest?:AuditEvent;
  auditQuery:string;
  auditRole:string;
  auditSection:string;
  auditRoles:string[];
  auditSections:string[];
  auditHasMore:boolean;
  auditLoading:boolean;
  setAuditQuery:(value:string)=>void;
  setAuditRole:(value:string)=>void;
  setAuditSection:(value:string)=>void;
  loadAudit:(reset:boolean)=>Promise<void>;
  auditDate:(value:string)=>string;
  auditTime:(value:string)=>string;
  auditRelative:(value:string)=>string;
};

export default function ActivitySection({
  auditEvents,filteredAuditEvents,auditActorCount,auditLatest,auditQuery,auditRole,auditSection,
  auditRoles,auditSections,auditHasMore,auditLoading,setAuditQuery,setAuditRole,setAuditSection,
  loadAudit,auditDate,auditTime,auditRelative
}:Props){
  return <>
    <section className="activity-hero">
      <div>
        <span className="orders-eyebrow"><ShieldCheck size={15}/>Protected history</span>
        <h2>Activity & audit trail</h2>
        <p>Server-recorded workspace changes are read-only and preserved for accountability.</p>
      </div>
      <div className="activity-hero-meta">
        <span><strong>{auditEvents.length}</strong><small>loaded events</small></span>
        <span><strong>{auditActorCount}</strong><small>team members</small></span>
        <span><strong>{auditLatest?auditRelative(auditLatest.created_at):'—'}</strong><small>latest change</small></span>
      </div>
    </section>
    <section className="panel activity-panel activity-panel-pro">
      <div className="panel-heading">
        <div><h2>Change history</h2><p>Filter by team member role, changed section, or search the recorded summary.</p></div>
        <span className="status">{filteredAuditEvents.length} shown</span>
      </div>
      <div className="activity-toolbar activity-toolbar-pro">
        <div className="search-input">
          <Search size={16}/>
          <Input aria-label="Search activity history" value={auditQuery} onChange={e=>setAuditQuery(e.target.value)} placeholder="Search person, role, action or section…"/>
          {auditQuery&&<button className="search-clear" aria-label="Clear activity search" onClick={()=>setAuditQuery('')}><X size={14}/></button>}
        </div>
        <div className="activity-filter-groups">
          <div><small>Role</small><div className="activity-section-filters">
            <button className={auditRole==='All'?'active':''} onClick={()=>setAuditRole('All')}>All</button>
            {auditRoles.map(role=><button key={role} className={auditRole===role?'active':''} onClick={()=>setAuditRole(role)}>{role}</button>)}
          </div></div>
          <div><small>Section</small><div className="activity-section-filters">
            <button className={auditSection==='All'?'active':''} onClick={()=>setAuditSection('All')}>All</button>
            {auditSections.map(section=><button key={section} className={auditSection===section?'active':''} onClick={()=>setAuditSection(section)}>{section}</button>)}
          </div></div>
        </div>
      </div>
      {filteredAuditEvents.length
        ? <>
            <div className="activity-desktop">
              <Table><TableHeader><TableRow><TableHead>When</TableHead><TableHead>Team member</TableHead><TableHead>Role</TableHead><TableHead>Change</TableHead><TableHead>Areas</TableHead></TableRow></TableHeader>
                <TableBody>{filteredAuditEvents.map(event=><TableRow key={event.id}>
                  <TableCell><strong>{auditDate(event.created_at)}</strong><small className="cell-sub">{auditTime(event.created_at)} · {auditRelative(event.created_at)}</small></TableCell>
                  <TableCell><div className="activity-actor-cell"><Avatar name={event.actor_name}/><span><strong>{event.actor_name}</strong><small>Workspace change</small></span></div></TableCell>
                  <TableCell><Status value={event.role}/></TableCell>
                  <TableCell><strong>{event.summary}</strong></TableCell>
                  <TableCell><div className="activity-section-tags">{event.sections.map(section=><span key={section}>{section}</span>)}</div></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            </div>
            <div className="activity-mobile-list activity-mobile-list-pro">{filteredAuditEvents.map(event=><article key={event.id}>
              <div className="activity-mobile-head"><div className="activity-actor-cell"><Avatar name={event.actor_name}/><span><strong>{event.actor_name}</strong><small>{auditDate(event.created_at)} · {auditTime(event.created_at)}</small></span></div><Status value={event.role}/></div>
              <p>{event.summary}</p>
              <div className="activity-mobile-foot"><div className="activity-section-tags">{event.sections.map(section=><span key={section}>{section}</span>)}</div><small>{auditRelative(event.created_at)}</small></div>
            </article>)}</div>
            {auditHasMore&&<div className="activity-load-more"><button className="btn secondary" disabled={auditLoading} onClick={()=>void loadAudit(false)}>{auditLoading?<Loader2 className="spin" size={15}/>:<Clock size={15}/>}Load older activity</button></div>}
          </>
        : <Empty title={auditEvents.length?'No matching activity':'No activity recorded yet'} text={auditEvents.length?'Clear search, role, or section filters to see more history.':'New workspace changes will appear here automatically.'} action={auditEvents.length?<button className="btn secondary" onClick={()=>{setAuditQuery('');setAuditSection('All');setAuditRole('All')}}>Clear filters</button>:undefined}/>}
    </section>
  </>;
}
