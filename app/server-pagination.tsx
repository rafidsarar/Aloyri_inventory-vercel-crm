'use client';
import { useEffect,useRef,useState } from 'react';
export type PageInfo={page:number;pageSize:number;total:number;totalPages:number};
/** Request identity and cancellation keep late search responses out of a newer page. */
export function useServerPagination<T>({path,enabled,query='',status='All',customerId='',refresh=0,onLoaded}:{path:string;enabled:boolean;query?:string;status?:string;customerId?:string;refresh?:number;onLoaded?:(data:T)=>void}){
 const filterKey=query+'|'+status+'|'+customerId;
 const [position,setPosition]=useState({key:filterKey,page:1}),[pageSize,setPageSize]=useState(25),[retry,setRetry]=useState(0);
 const page=position.key===filterKey?position.page:1,key=path+'|'+filterKey+'|'+page+'|'+pageSize+'|'+refresh+'|'+retry;
 const callback=useRef(onLoaded);useEffect(()=>{callback.current=onLoaded},[onLoaded]);
 const [result,setResult]=useState<{key:string;data?:T&{pagination?:PageInfo};error?:string}>({key:''});
 useEffect(()=>{
  if(!enabled)return;
  const controller=new AbortController();
  const timer=setTimeout(()=>{const params=new URLSearchParams({page:String(page),pageSize:String(pageSize),q:query,status});if(customerId)params.set('customerId',customerId);
   fetch(path+'?'+params,{cache:'no-store',signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error||'Could not load records.');if(controller.signal.aborted)return;
    if(data.pagination&&page>data.pagination.totalPages){setPosition({key:filterKey,page:data.pagination.totalPages});return;}
    setResult({key,data});callback.current?.(data);
   }).catch(e=>{if(!controller.signal.aborted)setResult({key,error:e instanceof Error?e.message:'Could not load records.'})});
  },query?250:0);
  return()=>{clearTimeout(timer);controller.abort()};
 },[enabled,path,query,status,customerId,page,pageSize,key,filterKey]);
 const current=result.key===key,loading=enabled&&!current,data=current?result.data:undefined,error=current?result.error:undefined;
 const info=data?.pagination||{page,pageSize,total:0,totalPages:1};
 const controls=<nav className="record-pagination" aria-label="Record pages" aria-busy={loading}>
 <span>{info.total?((info.page-1)*info.pageSize+1)+'–'+Math.min(info.page*info.pageSize,info.total):'0'} of {info.total}</span>
 <label>Rows per page <select aria-label="Rows per page" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPosition({key:filterKey,page:1})}}>{[25,50,100].map(n=><option key={n}>{n}</option>)}</select></label>
 <button className="btn secondary small" disabled={loading||page<=1} onClick={()=>setPosition({key:filterKey,page:page-1})}>Previous page</button><span>Page {page} of {info.totalPages}</span>
 <button className="btn secondary small" disabled={loading||page>=info.totalPages} onClick={()=>setPosition({key:filterKey,page:page+1})}>Next page</button>
 </nav>;
 const feedback=error?<div role="alert">{error} <button className="btn secondary small" onClick={()=>setRetry(n=>n+1)}>Retry records</button></div>:loading?<p role="status">Loading records…</p>:null;
 return {data,info,loading,error,controls,feedback};
}
