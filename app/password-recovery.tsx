'use client';
import React,{useState} from 'react';
import { Input } from '@/components/ui/input';

export default function PasswordRecovery({mode,token=''}:{mode:'request'|'reset';token?:string}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setMessage('');
    if(mode==='reset'&&password!==confirm){setError('Passwords do not match.');return}
    setBusy(true);
    try{
      const response=await fetch(mode==='request'?'/api/auth/forgot-password':'/api/auth/reset-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(mode==='request'?{email}:{token,password})});
      const data:any=await response.json();
      if(!response.ok)throw Error(data.error||'Could not complete password recovery.');
      setMessage(mode==='request'?(data.message||'If an account exists, a reset link has been sent.'):'Your password has been updated. You can sign in now.');
    }catch(e){setError(e instanceof Error?e.message:'Please try again.')}finally{setBusy(false)}
  }
  if(mode==='reset'&&!token)return <main className="auth-layout"><section className="auth-card"><div className="auth-brand"><img src="/aloyri-logo.webp" alt="ALOYRI — Let Your Skin Glow" /></div><h1>Reset link missing</h1><p>Request a new password reset link from the sign-in page.</p><a href="/forgot-password">Request reset link</a></section></main>;
  if(message)return <main className="auth-layout"><section className="auth-card"><div className="auth-brand"><img src="/aloyri-logo.webp" alt="ALOYRI — Let Your Skin Glow" /></div><h1>{mode==='request'?'Check your email':'Password updated'}</h1><p>{message}</p><a href="/login">{mode==='request'?'Back to sign in':'Sign in to ALOYRI'}</a></section></main>;
  return <main className="auth-layout"><section className="auth-card"><div className="auth-brand"><img src="/aloyri-logo.webp" alt="ALOYRI — Let Your Skin Glow" /></div><h1>{mode==='request'?'Forgot password?':'Create a new password'}</h1><p>{mode==='request'?'Enter your account email. We will send a secure reset link if the account is active.':'Choose a new password for your ALOYRI account. Reset links expire after 30 minutes.'}</p><form onSubmit={submit}>{mode==='request'?<label>Email address<Input type="email" autoComplete="email" maxLength={254} required value={email} onChange={e=>setEmail(e.target.value)}/></label>:<><label>New password<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={password} onChange={e=>setPassword(e.target.value)}/></label><label>Confirm new password<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} required value={confirm} onChange={e=>setConfirm(e.target.value)}/></label></>}{error&&<p className="form-error" role="alert">{error}</p>}<button className="btn primary full" disabled={busy}>{busy?'Please wait…':mode==='request'?'Send reset link':'Reset password'}</button></form><a href="/login">Back to sign in</a></section></main>
}
