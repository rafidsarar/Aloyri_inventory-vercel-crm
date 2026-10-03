import { fixedBusinessName,stateSchema,validateRelations,type State } from './crm.ts';

export type DataIntegrityReport={
  changedPaths:string[];
  invalidPaths:string[];
};

const dateOnly=/^\d{4}-\d{2}-\d{2}$/;

function canonicalDate(value:unknown,path:string,optional:boolean,report:DataIntegrityReport){
  if(value==null||value===''){
    if(optional)return undefined;
    report.invalidPaths.push(path);
    return value;
  }
  const raw=value instanceof Date?value.toISOString():String(value).trim();
  let canonical=raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if(!canonical){
    const parsed=new Date(raw);
    if(!Number.isNaN(parsed.getTime()))canonical=parsed.toISOString().slice(0,10);
  }
  if(!canonical||!dateOnly.test(canonical)||Number.isNaN(Date.parse(canonical+'T00:00:00Z'))||new Date(canonical+'T00:00:00Z').toISOString().slice(0,10)!==canonical){
    report.invalidPaths.push(path);
    return value;
  }
  if(raw!==canonical)report.changedPaths.push(path);
  return canonical;
}

function setDate(target:any,key:string,path:string,optional:boolean,report:DataIntegrityReport){
  if(!target||typeof target!=='object')return;
  const next=canonicalDate(target[key],path,optional,report);
  if(next===undefined){if(key in target&&target[key]!==undefined)report.changedPaths.push(path);delete target[key]}
  else target[key]=next;
}

export function canonicalizeLegacyState(input:unknown){
  const raw=structuredClone((input&&typeof input==='object')?input:{}) as any;
  const report:DataIntegrityReport={changedPaths:[],invalidPaths:[]};
  const each=(name:string,fn:(row:any,index:number)=>void)=>{
    const rows=raw[name];
    if(Array.isArray(rows))rows.forEach(fn);
  };

  each('customers',(x,i)=>setDate(x,'created',`customers[${i}].created`,false,report));
  each('purchaseOrders',(x,i)=>{
    setDate(x,'created',`purchaseOrders[${i}].created`,false,report);
    setDate(x,'expected',`purchaseOrders[${i}].expected`,false,report);
  });
  each('batches',(x,i)=>{
    setDate(x,'expiry',`batches[${i}].expiry`,false,report);
    setDate(x,'received',`batches[${i}].received`,false,report);
    setDate(x,'dueDate',`batches[${i}].dueDate`,true,report);
    setDate(x,'paidAt',`batches[${i}].paidAt`,true,report);
    if(Array.isArray(x?.payments))x.payments.forEach((p:any,j:number)=>setDate(p,'date',`batches[${i}].payments[${j}].date`,false,report));
  });
  each('stockAdjustments',(x,i)=>setDate(x,'date',`stockAdjustments[${i}].date`,false,report));
  each('inventoryHolds',(x,i)=>{
    setDate(x,'date',`inventoryHolds[${i}].date`,false,report);
    setDate(x,'releasedAt',`inventoryHolds[${i}].releasedAt`,true,report);
  });
  each('orders',(x,i)=>{
    setDate(x,'created',`orders[${i}].created`,false,report);
    setDate(x,'delivered',`orders[${i}].delivered`,true,report);
    setDate(x,'returnedAt',`orders[${i}].returnedAt`,true,report);
    setDate(x,'settledAt',`orders[${i}].settledAt`,true,report);
    if(Array.isArray(x?.collections))x.collections.forEach((p:any,j:number)=>setDate(p,'date',`orders[${i}].collections[${j}].date`,false,report));
  });
  each('expenses',(x,i)=>setDate(x,'date',`expenses[${i}].date`,false,report));
  each('cashEntries',(x,i)=>setDate(x,'date',`cashEntries[${i}].date`,false,report));
  each('accountOpenings',(x,i)=>{
    setDate(x,'date',`accountOpenings[${i}].date`,false,report);
    setDate(x,'statementDate',`accountOpenings[${i}].statementDate`,true,report);
  });
  each('customerRefunds',(x,i)=>setDate(x,'date',`customerRefunds[${i}].date`,false,report));
  each('financeCloses',(x,i)=>setDate(x,'closedAt',`financeCloses[${i}].closedAt`,false,report));
  each('tasks',(x,i)=>{
    setDate(x,'due',`tasks[${i}].due`,false,report);
    if(x?.completedAt!=='')setDate(x,'completedAt',`tasks[${i}].completedAt`,true,report);
  });

  if(report.invalidPaths.length)throw new Error('Unparseable legacy date fields: '+report.invalidPaths.join(', '));
  const state=fixedBusinessName(stateSchema.parse(raw));
  validateRelations(state,{skipOrderNumberUniqueness:true});
  return {state,report};
}

export function assertCanonicalState(input:unknown):State{
  const {state,report}=canonicalizeLegacyState(input);
  if(report.changedPaths.length)throw new Error('Workspace still contains non-canonical date values: '+report.changedPaths.join(', '));
  return state;
}

