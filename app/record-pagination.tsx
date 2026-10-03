'use client';
import { useState } from 'react';
export function useRecordPagination<T>(items:T[],filterKey:string){
 const [position,setPosition]=useState({key:filterKey,page:1}),[size,setSize]=useState(25),pages=Math.max(1,Math.ceil(items.length/size)),page=Math.min(position.key===filterKey?position.page:1,pages);
 return {items:items.slice((page-1)*size,page*size),controls:<nav className="record-pagination" aria-label="Record pages"><span>{items.length?((page-1)*size+1)+'–'+Math.min(page*size,items.length):'0'} of {items.length}</span><label>Rows per page <select aria-label="Rows per page" value={size} onChange={e=>{setSize(Number(e.target.value));setPosition({key:filterKey,page:1})}}>{[25,50,100].map(n=><option key={n}>{n}</option>)}</select></label><button className="btn secondary small" disabled={page<=1} onClick={()=>setPosition({key:filterKey,page:page-1})}>Previous page</button><span>Page {page} of {pages}</span><button className="btn secondary small" disabled={page>=pages} onClick={()=>setPosition({key:filterKey,page:page+1})}>Next page</button></nav>};
}
