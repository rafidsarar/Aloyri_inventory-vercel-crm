'use client';
import React,{useEffect,useState} from 'react';
import { Input } from '@/components/ui/input';
import { passwordResetTokenValid } from '@/lib/password-reset';

export default function PasswordRecoveryForm({mode,token=''}:{mode:'forgot'|'reset';token?:string}){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(mode==='reset'&&token&&typeof window!=='undefined')window.history.replaceState({},'',window.location.pathname)},[mode,token]);

  async function submit(e:React.FormEvent){
    e.preventDefault();setError('');setMessage('');
    if(mode==='reset'){
      if(!passwordResetTokenValid(token)){setError('This reset link is invalid. Request a new password reset email.');return}
      if(password.length<12||password.length>128){setError('New password must be 12–128 characters.');return}
      if(password!==confirm){setError('Passwords do not match.');return}
    }
    setBusy(true);
    try{
      const response=await fetch(mode==='forgot'?'/api/auth/forgot':'/api/auth/reset',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(mode==='forgot'?{email}:{token,password})
      });
      const data:any=await response.json();
      if(!response.ok)throw Error(data.error||'Could not complete the request.');
      setMessage(data.message||'Done.');
      if(mode==='forgot')setEmail('');
      else{setPassword('');setConfirm('')}
    }catch(err){setError(err instanceof Error?err.message:'Please try again.')}finally{setBusy(false)}
  }

  const invalidReset=mode==='reset'&&!passwordResetTokenValid(token);
  return <main className="auth-layout"><section className="auth-card">
    <div className="auth-brand"><img src="/aloyri-logo.webp" alt="ALOYRI — Let Your Skin Glow" /></div>
    <h1>{mode==='forgot'?'Forgot your password?':'Choose a new password'}</h1>
    <p>{mode==='forgot'?'Enter the email used for your ALOYRI CRM account. If the account is active, we will email a secure reset link.':'Create a new password for your ALOYRI CRM account. Reset links expire after 30 minutes and work only once.'}</p>
    {message?<div className="auth-success" role="status"><strong>{mode==='forgot'?'Check your email':'Password updated'}</strong><span>{message}</span></div>:
    <form onSubmit={submit}>
      {mode==='forgot'?<label>Email address<Input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>:<>
        <label>New password<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={invalidReset} value={password} onChange={e=>setPassword(e.target.value)}/></label>
        <label>Confirm new password<Input type="password" autoComplete="new-password" minLength={12} maxLength={128} required disabled={invalidReset} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
      </>}
      {invalidReset&&<p className="form-error" role="alert">This reset link is missing or invalid. Request a new one from the sign-in page.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button className="btn primary full" disabled={busy||invalidReset}>{busy?'Please wait…':mode==='forgot'?'Send reset link':'Reset password'}</button>
    </form>}
    <div className="auth-link-row">{mode==='reset'&&invalidReset?<a href="/forgot-password">Request a new reset link</a>:<a href="/login">Back to sign in</a>}</div>
  </section></main>
}
