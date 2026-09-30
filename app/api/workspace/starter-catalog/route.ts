import { getAppUser, checkOrigin } from '@/app/local-auth';
import { AccessDenied, resolveWorkspace } from '@/app/team-access';
import { database } from '@/db/raw';
import { fixedBusinessName, stateSchema, validateRelations } from '@/lib/crm';
import { roleCanLoadStarterCatalog } from '@/lib/roles';

export const dynamic='force-dynamic';
const response=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});

const products=[
{id:'bd26-simple-wash',name:'Kind To Skin Refreshing Facial Wash Gel',brand:'Simple',size:'150ml',category:'Cleanser',price:749,cost:520,targetQty:8,reorderAt:3,replenishDays:60,active:true},
{id:'bd26-simple-light',name:'Kind To Skin Hydrating Light Moisturiser',brand:'Simple',size:'125ml',category:'Moisturizer',price:749,cost:520,targetQty:8,reorderAt:3,replenishDays:60,active:true},
{id:'bd26-cosrx-salicylic',name:'Salicylic Acid Daily Gentle Cleanser',brand:'COSRX',size:'150ml',category:'Cleanser',price:1149,cost:800,targetQty:6,reorderAt:2,replenishDays:60,active:true},
{id:'bd26-cosrx-patch',name:'Acne Pimple Master Patch',brand:'COSRX',size:'24 patches',category:'Acne Care',price:339,cost:235,targetQty:10,reorderAt:4,replenishDays:30,active:true},
{id:'bd26-ordinary-niacinamide',name:'Niacinamide 10% + Zinc 1%',brand:'The Ordinary',size:'30ml',category:'Serum',price:1099,cost:770,targetQty:6,reorderAt:2,replenishDays:60,active:true},
{id:'bd26-neutrogena-hydro',name:'Hydro Boost Water Gel',brand:'Neutrogena',size:'50ml',category:'Moisturizer',price:1450,cost:1015,targetQty:5,reorderAt:2,replenishDays:60,active:true},
{id:'bd26-boj-relief-sun',name:'Relief Sun Rice + Probiotics SPF50+ PA++++',brand:'Beauty of Joseon',size:'50ml',category:'Sunscreen',price:1390,cost:970,targetQty:6,reorderAt:2,replenishDays:45,active:true},
{id:'bd26-cosrx-snail',name:'Advanced Snail 96 Mucin Power Essence',brand:'COSRX',size:'100ml',category:'Essence',price:1550,cost:1085,targetQty:5,reorderAt:2,replenishDays:60,active:true},
{id:'bd26-cerave-cream',name:'Moisturizing Cream Normal to Dry Skin',brand:'CeraVe',size:'56ml',category:'Moisturizer',price:1465,cost:1025,targetQty:5,reorderAt:2,replenishDays:60,active:true},
{id:'bd26-cetaphil-cleanser',name:'Gentle Skin Cleanser Normal to Dry Skin',brand:'Cetaphil',size:'59ml',category:'Cleanser',price:835,cost:585,targetQty:6,reorderAt:2,replenishDays:60,active:true}
];

export async function POST(request:Request){
 try{
  const user=await getAppUser(); if(!user)return response({error:'Please sign in first.'},401);
  if(!checkOrigin(request))return response({error:'Invalid request origin.'},403);
  const {ownerId,role}=await resolveWorkspace(user); if(!roleCanLoadStarterCatalog(role))return response({error:'Your role cannot load the starter catalog.'},403);
  const db=database(); const row=await db.prepare('SELECT data,version FROM crm_workspaces WHERE owner_id = ?').bind(ownerId).first<{data:string;version:number}>();
  if(!row)return response({error:'Workspace not found.'},404);
  const current=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  if(current.products.length)return response({ok:true,skipped:true,reason:'Inventory already contains products.'});
  const categories=[...new Set([...current.productCategories,...products.map(p=>p.category)])];
  const next={...current,products,productCategories:categories};
  validateRelations(next);
  const result=await db.prepare('UPDATE crm_workspaces SET data = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND version = ?').bind(JSON.stringify(next),new Date().toISOString(),ownerId,row.version).run();
  if(!result.meta.changes)return response({error:'Workspace changed while loading products. Refresh and try again.'},409);
  return response({ok:true,version:row.version+1,count:products.length});
 }catch(e){if(e instanceof AccessDenied)return response({error:e.message},403);console.error('Starter catalog load failed',e);return response({error:'Could not load the starter catalog.'},503)}
}
