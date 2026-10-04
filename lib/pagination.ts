export type PageRequest={page:number;pageSize:number;q:string;status:string;customerId?:string};
export function parsePageRequest(url:string):PageRequest|undefined{const p=new URL(url).searchParams;if(!['page','pageSize','q','status','customerId'].some(key=>p.has(key)))return undefined;const page=Number(p.get('page')||1),pageSize=Number(p.get('pageSize')||50),q=(p.get('q')||'').trim(),status=p.get('status')||'All',customerId=p.get('customerId')||undefined;if(!Number.isInteger(page)||page<1||page>10000||!Number.isInteger(pageSize)||pageSize<1||pageSize>200||q.length>100||status.length>50||customerId&&customerId.length>120)throw new Error('Invalid pagination.');return {page,pageSize,q,status,...(customerId?{customerId}:{})};}
export function pageMetadata(request:PageRequest,total:number){return {page:request.page,pageSize:request.pageSize,total,totalPages:Math.max(1,Math.ceil(total/request.pageSize))};}

export const defaultPageRequest=()=>({page:1,pageSize:25,q:'',status:'All'});
export const literalLike=(q:string)=>'%'+q.replace(/[\\%_]/g,'\\$&')+'%';
