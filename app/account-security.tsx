'use client';
import React,{useEffect,useState} from 'react';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Laptop,RefreshCw,ShieldCheck,Smartphone,Trash2 } from 'lucide-react';

type Session={id:string;current:boolean;createdAt:string;expiresAt:string;lastSeenAt:string;userAgent:string};

function deviceLabel(ua:string){
  const browser=/Edg\//.test(ua)?'Edge':/Chrome\//.test(ua)?'Chrome':/Firefox\//.test(ua)?'Firefox':/Safari\//.test(ua)?'Safari':'Browser';
  const platform=/Android/i.test(ua)?'Android':/iPhone|iPad/i.test(ua)?'iOS':/Windows/i.test(ua)?'Windows':/Macintosh|Mac OS/i.test(ua)?'macOS':/Linux/i.test(ua)?'Linux':'device';
  return browser+' on '+platform;
}
const date=(value:string)=>new Date(value).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'});

export default function AccountSecurity({open,onClose,onChangePassword}:{open:boolean;onClose:()=>void;onChangePassword:()=>void}){
  const [sessions,setSessions]=useState<Session[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');
  async function load(){setLoading(true);setError('');try{const r=await fetch('/api/auth/sessions',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not load sessions.');setSessions(d.sessions||[])}catch(e){setError(e instanceof Error?e.message:'Could not load sessions.')}finally{setLoading(false)}}
  async function action(body:unknown){setLoading(true);setError('');try{const r=await fetch('/api/auth/sessions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not update sessions.');await load()}catch(e){setError(e instanceof Error?e.message:'Could not update sessions.');setLoading(false)}}
  useEffect(()=>{if(!open)return;let cancelled=false;(async()=>{try{const r=await fetch('/api/auth/sessions',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.error||'Could not load sessions.');if(!cancelled){setSessions(d.sessions||[]);setError('')}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load sessions.')}})();return()=>{cancelled=true}},[open]);
  return <Dialog open={open} onOpenChange={v=>{if(!v&&!loading)onClose()}}>
    <DialogContent className="record-dialog account-security-dialog">
      <DialogHeader><DialogTitle>Account security</DialogTitle><DialogDescription>Review where your account is signed in and end sessions you no longer recognize.</DialogDescription></DialogHeader>
      <div className="account-security-actions">
        <button className="btn secondary" onClick={onChangePassword}><ShieldCheck size={16}/>Change password</button>
        <button className="btn secondary" disabled={loading||sessions.filter(s=>!s.current).length===0} onClick={()=>void action({action:'revokeOthers'})}><Trash2 size={16}/>Sign out other devices</button>
        <button className="icon-button" aria-label="Refresh sessions" disabled={loading} onClick={()=>void load()}><RefreshCw size={16} className={loading?'spin':''}/></button>
      </div>
      {error&&<p role="alert" className="form-error">{error}</p>}
      <div className="session-list">
        {sessions.map(session=><div className="session-row" key={session.id}>
          <span className="session-device">{/Android|iPhone|iPad/i.test(session.userAgent)?<Smartphone size={18}/>:<Laptop size={18}/>}</span>
          <div><strong>{deviceLabel(session.userAgent)}{session.current?' · This device':''}</strong><small>Last active {date(session.lastSeenAt)} · expires {date(session.expiresAt)}</small></div>
          {!session.current&&<button className="text-button delete-button" disabled={loading} onClick={()=>void action({action:'revokeOne',id:session.id})}>Sign out</button>}
        </div>)}
        {!loading&&!sessions.length&&<p className="muted">No active sessions found.</p>}
      </div>
    </DialogContent>
  </Dialog>;
}
