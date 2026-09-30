'use client';
import React from 'react';

export default class CRMErrorBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error,info:React.ErrorInfo){console.error('ALOYRI CRM client render failed',error,info.componentStack);}
  render(){
    if(!this.state.failed)return this.props.children;
    return <main className="auth-layout"><section className="auth-card"><div className="auth-brand"><img src="/aloyri-logo.webp" alt="ALOYRI — Let Your Skin Glow"/></div><h1>ALOYRI needs a refresh</h1><p>A browser-side screen failed to render. Your saved business records are unchanged.</p><button className="btn primary full" onClick={()=>window.location.reload()}>Reload CRM</button><button className="btn secondary full" onClick={()=>this.setState({failed:false})}>Try again</button></section></main>;
  }
}
