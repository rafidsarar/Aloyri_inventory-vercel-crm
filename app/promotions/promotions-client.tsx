'use client';

import { useEffect,useMemo,useState,type FormEvent } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgePercent,
  CalendarDays,
  Check,
  Edit3,
  Plus,
  Save,
  Tag,
  Trash2,
  Truck,
  X
} from 'lucide-react';

type Promotion={
  id:string;
  name:string;
  code:string;
  description:string;
  kind:'percentage'|'fixed';
  value:number;
  minimumSubtotal:number;
  startsAt:string;
  endsAt:string;
  usageLimit:number|null;
  usedCount:number;
  targetType:'all'|'products'|'categories';
  targetIds:string[];
  freeShipping:boolean;
  badgeText:string;
  priority:number;
  active:boolean;
  createdAt:string;
  updatedAt:string;
};

type CatalogProduct={id:string;name:string;brand:string;category:string};

type FormState={
  name:string;
  code:string;
  description:string;
  kind:'percentage'|'fixed';
  value:string;
  minimumSubtotal:string;
  startsAt:string;
  endsAt:string;
  usageLimit:string;
  targetType:'all'|'products'|'categories';
  targetIds:string[];
  freeShipping:boolean;
  badgeText:string;
  priority:string;
  active:boolean;
};

const emptyForm:FormState={
  name:'',
  code:'',
  description:'',
  kind:'percentage',
  value:'10',
  minimumSubtotal:'0',
  startsAt:'',
  endsAt:'',
  usageLimit:'',
  targetType:'all',
  targetIds:[],
  freeShipping:false,
  badgeText:'',
  priority:'0',
  active:true
};

const money=(value:number)=>new Intl.NumberFormat('en-BD',{
  style:'currency',currency:'BDT',maximumFractionDigits:0
}).format(value);

function toLocalInput(value:string){
  if(!value)return '';
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))return '';
  const pad=(n:number)=>String(n).padStart(2,'0');
  return date.getFullYear()+'-'+pad(date.getMonth()+1)+'-'+pad(date.getDate())+'T'+pad(date.getHours())+':'+pad(date.getMinutes());
}

function fromLocalInput(value:string){
  if(!value)return '';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'':date.toISOString();
}

function formFromPromotion(promotion:Promotion):FormState{
  return {
    name:promotion.name,
    code:promotion.code,
    description:promotion.description,
    kind:promotion.kind,
    value:String(promotion.value),
    minimumSubtotal:String(promotion.minimumSubtotal),
    startsAt:toLocalInput(promotion.startsAt),
    endsAt:toLocalInput(promotion.endsAt),
    usageLimit:promotion.usageLimit===null?'':String(promotion.usageLimit),
    targetType:promotion.targetType,
    targetIds:promotion.targetIds,
    freeShipping:promotion.freeShipping,
    badgeText:promotion.badgeText,
    priority:String(promotion.priority),
    active:promotion.active
  };
}

function statusFor(promotion:Promotion){
  if(!promotion.active)return {label:'Inactive',tone:'bg-black/5 text-black/50'};
  const now=Date.now();
  if(promotion.startsAt&&Date.parse(promotion.startsAt)>now)return {label:'Scheduled',tone:'bg-amber-50 text-amber-700'};
  if(promotion.endsAt&&Date.parse(promotion.endsAt)<=now)return {label:'Ended',tone:'bg-black/5 text-black/50'};
  if(promotion.usageLimit!==null&&promotion.usedCount>=promotion.usageLimit)return {label:'Limit reached',tone:'bg-amber-50 text-amber-700'};
  return {label:'Live',tone:'bg-emerald-50 text-emerald-700'};
}

export default function PromotionsClient({memberName}:{memberName:string}){
  const [promotions,setPromotions]=useState<Promotion[]>([]);
  const [products,setProducts]=useState<CatalogProduct[]>([]);
  const [categories,setCategories]=useState<string[]>([]);
  const [form,setForm]=useState<FormState>(emptyForm);
  const [editingId,setEditingId]=useState<string|null>(null);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');

  async function load(){
    setLoading(true);
    setError('');
    try{
      const response=await fetch('/api/ecommerce-promotions',{cache:'no-store'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not load promotions.');
      setPromotions(Array.isArray(data.promotions)?data.promotions:[]);
      setProducts(Array.isArray(data.products)?data.products:[]);
      setCategories(Array.isArray(data.categories)?data.categories:[]);
    }catch(loadError){
      setError(loadError instanceof Error?loadError.message:'Could not load promotions.');
    }finally{
      setLoading(false);
    }
  }

  useEffect(()=>{void load()},[]);

  const selectedTargets=useMemo(()=>{
    if(form.targetType==='products')return products.filter(product=>form.targetIds.includes(product.id));
    if(form.targetType==='categories')return categories.filter(category=>form.targetIds.includes(category));
    return [];
  },[form.targetIds,form.targetType,products,categories]);

  function setField<K extends keyof FormState>(field:K,value:FormState[K]){
    setForm(current=>({...current,[field]:value}));
    setError('');
    setNotice('');
  }

  function toggleTarget(value:string){
    setForm(current=>({
      ...current,
      targetIds:current.targetIds.includes(value)
        ? current.targetIds.filter(item=>item!==value)
        : [...current.targetIds,value]
    }));
  }

  function reset(){
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setNotice('');
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function payload(current:FormState){
    return {
      name:current.name.trim(),
      code:current.code.trim().toUpperCase(),
      description:current.description.trim(),
      kind:current.kind,
      value:Number(current.value),
      minimumSubtotal:Number(current.minimumSubtotal||0),
      startsAt:fromLocalInput(current.startsAt),
      endsAt:fromLocalInput(current.endsAt),
      usageLimit:current.usageLimit.trim()?Number(current.usageLimit):null,
      targetType:current.targetType,
      targetIds:current.targetType==='all'?[]:current.targetIds,
      freeShipping:current.freeShipping,
      badgeText:current.badgeText.trim(),
      priority:Number(current.priority||0),
      active:current.active
    };
  }

  async function submit(event:FormEvent){
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try{
      const path=editingId?'/api/ecommerce-promotions/'+encodeURIComponent(editingId):'/api/ecommerce-promotions';
      const response=await fetch(path,{
        method:editingId?'PUT':'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(payload(form))
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not save promotion.');
      setNotice(editingId?'Promotion updated.':'Promotion created.');
      setEditingId(null);
      setForm(emptyForm);
      await load();
      window.scrollTo({top:0,behavior:'smooth'});
    }catch(saveError){
      setError(saveError instanceof Error?saveError.message:'Could not save promotion.');
    }finally{
      setSaving(false);
    }
  }

  async function toggleActive(promotion:Promotion){
    setSaving(true);
    setError('');
    try{
      const response=await fetch('/api/ecommerce-promotions/'+encodeURIComponent(promotion.id),{
        method:'PUT',
        headers:{'content-type':'application/json'},
        body:JSON.stringify(payload({...formFromPromotion(promotion),active:!promotion.active}))
      });
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not update promotion.');
      await load();
    }catch(toggleError){
      setError(toggleError instanceof Error?toggleError.message:'Could not update promotion.');
    }finally{
      setSaving(false);
    }
  }

  async function remove(promotion:Promotion){
    if(!window.confirm('Delete “'+promotion.name+'”? Used promotions should be deactivated instead.'))return;
    setSaving(true);
    setError('');
    try{
      const response=await fetch('/api/ecommerce-promotions/'+encodeURIComponent(promotion.id),{method:'DELETE'});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Could not delete promotion.');
      if(editingId===promotion.id)reset();
      await load();
    }catch(deleteError){
      setError(deleteError instanceof Error?deleteError.message:'Could not delete promotion.');
    }finally{
      setSaving(false);
    }
  }

  const input='mt-2 h-11 w-full rounded-xl border border-[#713a35]/15 bg-white px-3 text-sm outline-none focus:border-[#b9725f]/60 focus:ring-2 focus:ring-[#b9725f]/10';
  const label='text-[10px] font-semibold uppercase tracking-[0.16em] text-[#713a35]/55';

  return <main className="min-h-screen bg-[#fffaf7] text-[#321f1c]">
    <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#713a35]/10 pb-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#713a35]/12 bg-white" aria-label="Back to CRM">
            <ArrowLeft size={17}/>
          </Link>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#713a35]/45">Ecommerce</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Promotions</h1>
          </div>
        </div>
        <div className="text-right text-xs text-[#321f1c]/45">
          <p className="font-semibold text-[#321f1c]/65">{memberName}</p>
          <p>Owner/admin campaign controls</p>
        </div>
      </header>

      <section className="grid gap-6 py-7 xl:grid-cols-[430px_1fr]">
        <form onSubmit={submit} className="h-fit rounded-[1.5rem] border border-[#713a35]/10 bg-white p-5 shadow-sm xl:sticky xl:top-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className={label}>{editingId?'Edit campaign':'New campaign'}</p>
              <h2 className="mt-2 text-xl font-semibold">{editingId?'Update promotion':'Create a promotion'}</h2>
            </div>
            {editingId?<button type="button" onClick={reset} className="rounded-full border border-[#713a35]/12 p-2 text-[#713a35]" aria-label="Cancel edit"><X size={16}/></button>:null}
          </div>

          <div className="mt-5 grid gap-4">
            <label><span className={label}>Campaign name</span><input className={input} value={form.name} onChange={e=>setField('name',e.target.value)} required placeholder="October Glow"/></label>
            <label><span className={label}>Coupon code · optional</span><input className={input} value={form.code} onChange={e=>setField('code',e.target.value.toUpperCase())} placeholder="GLOW10"/></label>
            <p className="-mt-2 text-[11px] leading-5 text-[#321f1c]/42">Leave code blank for an automatic promotion.</p>

            <div className="grid grid-cols-2 gap-3">
              <label><span className={label}>Discount type</span><select className={input} value={form.kind} onChange={e=>setField('kind',e.target.value as FormState['kind'])}><option value="percentage">Percentage</option><option value="fixed">Fixed BDT</option></select></label>
              <label><span className={label}>{form.kind==='percentage'?'Percent':'Amount'}</span><input className={input} type="number" min="0" step="0.01" max={form.kind==='percentage'?100:1000000} value={form.value} onChange={e=>setField('value',e.target.value)} required/></label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label><span className={label}>Minimum order</span><input className={input} type="number" min="0" step="1" value={form.minimumSubtotal} onChange={e=>setField('minimumSubtotal',e.target.value)}/></label>
              <label><span className={label}>Usage limit</span><input className={input} type="number" min="1" step="1" value={form.usageLimit} onChange={e=>setField('usageLimit',e.target.value)} placeholder="Unlimited"/></label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label><span className={label}>Starts</span><input className={input} type="datetime-local" value={form.startsAt} onChange={e=>setField('startsAt',e.target.value)}/></label>
              <label><span className={label}>Ends</span><input className={input} type="datetime-local" value={form.endsAt} onChange={e=>setField('endsAt',e.target.value)}/></label>
            </div>

            <label><span className={label}>Applies to</span><select className={input} value={form.targetType} onChange={e=>setForm(current=>({...current,targetType:e.target.value as FormState['targetType'],targetIds:[]}))}><option value="all">All products</option><option value="products">Selected products</option><option value="categories">Selected categories</option></select></label>

            {form.targetType!=='all'?<div className="rounded-xl border border-[#713a35]/10 bg-[#fffaf7] p-3">
              <p className={label}>{form.targetType==='products'?'Choose products':'Choose categories'}</p>
              <div className="mt-3 max-h-48 space-y-2 overflow-auto pr-1">
                {(form.targetType==='products'?products:categories).map(item=>{
                  const value=typeof item==='string'?item:item.id;
                  const title=typeof item==='string'?item:item.brand+' · '+item.name;
                  return <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 text-xs hover:bg-white">
                    <input type="checkbox" className="mt-0.5" checked={form.targetIds.includes(value)} onChange={()=>toggleTarget(value)}/>
                    <span>{title}</span>
                  </label>
                })}
              </div>
              <p className="mt-2 text-[11px] text-[#321f1c]/40">{selectedTargets.length} selected</p>
            </div>:null}

            <label><span className={label}>Storefront badge · optional</span><input className={input} value={form.badgeText} onChange={e=>setField('badgeText',e.target.value)} placeholder="10% off"/></label>
            <label><span className={label}>Description · internal</span><textarea className="mt-2 min-h-20 w-full rounded-xl border border-[#713a35]/15 bg-white px-3 py-3 text-sm outline-none focus:border-[#b9725f]/60" value={form.description} onChange={e=>setField('description',e.target.value)} placeholder="Campaign note for the team"/></label>

            <div className="grid grid-cols-2 gap-3">
              <label><span className={label}>Priority</span><input className={input} type="number" min="-1000" max="1000" value={form.priority} onChange={e=>setField('priority',e.target.value)}/></label>
              <div>
                <span className={label}>Shipping</span>
                <label className="mt-2 flex h-11 items-center gap-3 rounded-xl border border-[#713a35]/15 bg-white px-3 text-sm">
                  <input type="checkbox" checked={form.freeShipping} onChange={e=>setField('freeShipping',e.target.checked)}/>
                  Free shipping
                </label>
              </div>
            </div>

            <label className="flex items-center gap-3 rounded-xl bg-[#f7ebe6] p-3 text-sm">
              <input type="checkbox" checked={form.active} onChange={e=>setField('active',e.target.checked)}/>
              Active campaign
            </label>

            {error?<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">{error}</p>:null}
            {notice?<p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">{notice}</p>:null}

            <button disabled={saving} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#713a35] px-5 text-sm font-semibold text-white disabled:opacity-45">
              {editingId?<Save size={16}/>:<Plus size={16}/>}
              {saving?'Saving…':editingId?'Save changes':'Create promotion'}
            </button>
          </div>
        </form>

        <div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[1.3rem] border border-[#713a35]/10 bg-white p-4">
              <div className="flex items-center justify-between"><span className={label}>Campaigns</span><Tag size={16} className="text-[#713a35]/55"/></div>
              <p className="mt-3 text-3xl font-semibold">{promotions.length}</p>
            </div>
            <div className="rounded-[1.3rem] border border-[#713a35]/10 bg-white p-4">
              <div className="flex items-center justify-between"><span className={label}>Live now</span><BadgePercent size={16} className="text-[#713a35]/55"/></div>
              <p className="mt-3 text-3xl font-semibold">{promotions.filter(p=>statusFor(p).label==='Live').length}</p>
            </div>
            <div className="rounded-[1.3rem] border border-[#713a35]/10 bg-white p-4">
              <div className="flex items-center justify-between"><span className={label}>Redemptions</span><Check size={16} className="text-[#713a35]/55"/></div>
              <p className="mt-3 text-3xl font-semibold">{promotions.reduce((sum,p)=>sum+p.usedCount,0)}</p>
            </div>
          </div>

          <div className="mt-5 rounded-[1.5rem] border border-[#713a35]/10 bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4 border-b border-[#713a35]/10 pb-4">
              <div>
                <p className={label}>Campaign library</p>
                <h2 className="mt-1 text-xl font-semibold">Storefront promotions</h2>
              </div>
              <button type="button" onClick={()=>void load()} className="rounded-full border border-[#713a35]/12 px-4 py-2 text-xs font-semibold text-[#713a35]">Refresh</button>
            </div>

            {loading?<div className="grid gap-3 py-5">{[0,1,2].map(i=><div key={i} className="h-32 animate-pulse rounded-xl bg-[#f5e8e2]"/>)}</div>:
            promotions.length===0?<div className="py-16 text-center"><BadgePercent className="mx-auto text-[#713a35]/30"/><p className="mt-4 text-lg font-semibold">No promotions yet.</p><p className="mt-2 text-sm text-[#321f1c]/45">Create an automatic sale or a coupon from the form.</p></div>:
            <div className="divide-y divide-[#713a35]/10">
              {promotions.map(promotion=>{
                const status=statusFor(promotion);
                const target=promotion.targetType==='all'
                  ? 'All products'
                  : promotion.targetIds.length+' '+(promotion.targetType==='products'?'products':'categories');
                return <article key={promotion.id} className="py-5 first:pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{promotion.name}</h3>
                        <span className={'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] '+status.tone}>{status.label}</span>
                        {promotion.code?<span className="rounded-full bg-[#f7ebe6] px-2.5 py-1 font-mono text-[10px] font-semibold text-[#713a35]">{promotion.code}</span>:<span className="rounded-full bg-[#f7ebe6] px-2.5 py-1 text-[10px] font-semibold text-[#713a35]">Automatic</span>}
                      </div>
                      <p className="mt-2 text-sm text-[#321f1c]/55">{promotion.kind==='percentage'?promotion.value+'% off':money(promotion.value)+' off'} · {target}{promotion.freeShipping?' · Free shipping':''}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-[#321f1c]/42">
                        <span>Minimum {money(promotion.minimumSubtotal)}</span>
                        <span>{promotion.usageLimit===null?promotion.usedCount+' uses':promotion.usedCount+' / '+promotion.usageLimit+' uses'}</span>
                        <span>Priority {promotion.priority}</span>
                        {promotion.startsAt?<span className="inline-flex items-center gap-1"><CalendarDays size={12}/>{new Date(promotion.startsAt).toLocaleString('en-BD')}</span>:null}
                        {promotion.freeShipping?<span className="inline-flex items-center gap-1"><Truck size={12}/>Shipping waived</span>:null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" disabled={saving} onClick={()=>void toggleActive(promotion)} className="rounded-full border border-[#713a35]/12 px-3 py-2 text-xs font-semibold text-[#713a35]">{promotion.active?'Deactivate':'Activate'}</button>
                      <button type="button" onClick={()=>{setEditingId(promotion.id);setForm(formFromPromotion(promotion));setError('');setNotice('');window.scrollTo({top:0,behavior:'smooth'})}} className="rounded-full border border-[#713a35]/12 p-2.5 text-[#713a35]" aria-label={'Edit '+promotion.name}><Edit3 size={15}/></button>
                      <button type="button" disabled={saving||promotion.usedCount>0} onClick={()=>void remove(promotion)} className="rounded-full border border-[#713a35]/12 p-2.5 text-[#713a35] disabled:cursor-not-allowed disabled:opacity-25" aria-label={'Delete '+promotion.name}><Trash2 size={15}/></button>
                    </div>
                  </div>
                  {promotion.description?<p className="mt-3 max-w-3xl text-xs leading-6 text-[#321f1c]/48">{promotion.description}</p>:null}
                </article>
              })}
            </div>}
          </div>
        </div>
      </section>
    </div>
  </main>;
}
