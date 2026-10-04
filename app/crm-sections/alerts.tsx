'use client';

import { AlertTriangle, ArrowRight, Bell, CheckCircle2, ChevronRight, Clock, ShieldCheck } from 'lucide-react';
import { Empty, Stat, WorkspaceSection, type View } from '../crm-ui';

export type AutoAlert={
  id:string;
  level:'Critical'|'Action needed'|'Upcoming';
  title:string;
  detail:string;
  view:View;
  role:'all'|'finance'|'sales'|'inventory';
};

type AlertFilter='All'|'Critical'|'Action needed'|'Upcoming';

type Props={
  roleAlerts:AutoAlert[];
  totalAlerts?:number;
  shownAlerts:AutoAlert[];
  alertFocus?:AutoAlert;
  alertCritical:number;
  alertAction:number;
  alertUpcoming:number;
  alertFilter:AlertFilter;
  setAlertFilter:(value:AlertFilter)=>void;
  openAlert:(alert:AutoAlert)=>void;
  alertActionLabel:(alert:AutoAlert)=>string;
};

export default function AlertsSection({
  roleAlerts,
  totalAlerts=roleAlerts.length,
  shownAlerts,
  alertFocus,
  alertCritical,
  alertAction,
  alertUpcoming,
  alertFilter,
  setAlertFilter,
  openAlert,
  alertActionLabel,
}:Props){
  return <WorkspaceSection>
    <section className="panel alert-brief alert-brief-pro">
      <div className="panel-heading">
        <div>
          <span className="alerts-eyebrow"><Bell size={14}/>Operational attention</span>
          <h2>Daily business brief</h2>
          <p>Live exceptions generated from your CRM records. They clear automatically when the underlying issue is resolved.</p>
        </div>
        <span className={'alert-open-pill '+(alertCritical?'critical':'')}>{roleAlerts.length} open</span>
      </div>

      {alertFocus
        ? <button className={'alert-focus-card '+alertFocus.level.toLowerCase().replace(' ','-')} onClick={()=>openAlert(alertFocus)}>
            <span className="alert-focus-icon">
              {alertFocus.level==='Critical'
                ? <AlertTriangle size={19}/>
                : alertFocus.level==='Action needed'
                  ? <Bell size={19}/>
                  : <Clock size={19}/>}
            </span>
            <span className="alert-focus-copy">
              <small>Highest priority · {alertFocus.view}</small>
              <strong>{alertFocus.title}</strong>
              <p>{alertFocus.detail}</p>
            </span>
            <span className="alert-focus-action">{alertActionLabel(alertFocus)}<ArrowRight size={15}/></span>
          </button>
        : <div className="alert-all-clear">
            <CheckCircle2 size={20}/>
            <span><strong>No open alerts</strong><small>Your role has no operational exceptions requiring attention.</small></span>
          </div>}

      <div className="stat-grid alert-stats">
        <Stat label="Critical" value={String(alertCritical)} detail="Needs prompt attention" icon={AlertTriangle}/>
        <Stat label="Action needed" value={String(alertAction)} detail="Work to complete" icon={Bell}/>
        <Stat label="Upcoming" value={String(alertUpcoming)} detail="Due soon" icon={Clock}/>
        <Stat label="Open alerts" value={String(totalAlerts)} detail="Filtered for your role" icon={ShieldCheck} green/>
      </div>
    </section>

    <section className="panel alert-center-panel">
      <div className="panel-heading">
        <div>
          <h2>Action center</h2>
          <p>Each alert points to the workspace where the underlying issue can be reviewed or resolved.</p>
        </div>
        <span className="muted">{shownAlerts.length} shown</span>
      </div>

      <div className="alert-filter-strip" aria-label="Filter alerts by priority">
        {(['All','Critical','Action needed','Upcoming'] as const).map(level=>
          <button
            key={level}
            aria-pressed={alertFilter===level}
            className={alertFilter===level?'active':''}
            onClick={()=>setAlertFilter(level)}
          >
            {level}
            <span>{level==='All'?roleAlerts.length:roleAlerts.filter(alert=>alert.level===level).length}</span>
          </button>
        )}
      </div>

      {shownAlerts.length
        ? <div className="automation-list alert-action-list">
            {shownAlerts.map(alert=>
              <button key={alert.id} className="automation-alert alert-action-row" onClick={()=>openAlert(alert)}>
                <span className={'alert-level '+alert.level.toLowerCase().replace(' ','-')}>{alert.level}</span>
                <span className="alert-action-copy">
                  <span className="alert-section-label">{alert.view}</span>
                  <strong>{alert.title}</strong>
                  <small>{alert.detail}</small>
                </span>
                <span className="alert-row-action">{alertActionLabel(alert)}<ChevronRight size={16}/></span>
              </button>
            )}
          </div>
        : <Empty
            title={roleAlerts.length?'No alerts in this priority':'Everything is clear'}
            text={roleAlerts.length
              ? 'Choose another priority to review the remaining alerts.'
              : 'No automated alerts need attention for your role right now.'}
            action={roleAlerts.length
              ? <button className="btn secondary" onClick={()=>setAlertFilter('All')}>Show all alerts</button>
              : undefined}
          />}
    </section>
  </WorkspaceSection>;
}

