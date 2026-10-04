'use client';
import { createContext,useContext,type ReactNode } from 'react';
import { useServerPagination } from './server-pagination';
import type { SectionKind,SectionOptions } from '@/lib/section-records';
type Context={enabled:boolean;version:number;refresh:number;onStale:()=>void};
const PaginationContext=createContext<Context>({enabled:false,version:0,refresh:0,onStale:()=>{}});
export function SectionPaginationProvider({value,children}:{value:Context;children:ReactNode}){return <PaginationContext.Provider value={value}>{children}</PaginationContext.Provider>}
/** Pages contain identifiers; the complete validated context remains available to financial and stock calculations. */
export function useSectionPage<T>(kind:SectionKind,records:readonly T[],identify:(record:T)=>string,{enabled=true,query='',status='All',options={}}:{enabled?:boolean;query?:string;status?:string;options?:SectionOptions}={}){
 const context=useContext(PaginationContext),active=context.enabled&&enabled,extra:Record<string,string>={kind,expectedVersion:String(context.version)};
 for(const [key,value] of Object.entries(options))if(value!==undefined)extra[key]=value;
 const page=useServerPagination<{ids:string[];version:number}>({path:'/api/record-pages',enabled:active,query,status,extra,refresh:context.refresh,onConflict:context.onStale,label:'Record pages'});
 const byId=new Map(records.map(record=>[identify(record),record]));
 const rows=active?(page.data?.ids||[]).flatMap(id=>{const record=byId.get(id);return record===undefined?[]:[record]}):[...records];
 const controls=active?<>{page.feedback}{page.controls}</>:null;
 return {rows,controls,total:active?page.info.total:records.length,loading:active&&page.loading};
}
