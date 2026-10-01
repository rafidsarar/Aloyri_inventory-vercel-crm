'use client';

import type { ReactNode } from 'react';
import {
  ArrowUpRight,
  Bell,
  Box,
  CalendarCheck,
  Check,
  Droplets,
  LayoutDashboard,
  Leaf,
  LogOut,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sun,
  TrendingUp,
  Truck,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { Order } from '@/lib/crm';
import {
  canManageBusinessSettings,
  roleCanViewSection,
  roleLabels,
  type WorkspaceRole,
} from '@/lib/roles';

export const sections=[
  'Overview','Reports','Alerts','Automation','Orders','Inventory',
  'Customers','Suppliers','Finances','Follow-ups','Activity'
] as const;

export type View=typeof sections[number];

export const navIcons:LucideIcon[]=[
  LayoutDashboard,TrendingUp,Bell,Zap,ShoppingBag,Package,
  Users,Truck,Wallet,CalendarCheck,ShieldCheck
];

export const visibleSections=(role:WorkspaceRole):View[]=>
  sections.filter(section=>roleCanViewSection(role,section));

export function Status({value}:{value:string}){
  return <span className={'status '+value.toLowerCase().replaceAll(' ','-')}>{value}</span>;
}

export function Avatar({name,index=0}:{name:string;index?:number}){
  return <span className={'avatar color-'+index%5}>
    {name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase()}
  </span>;
}

export function ProductIcon({category}:{category:string}){
  const Icon=category==='Sunscreen'?Sun:category==='Cleanser'?Droplets:Leaf;
  return <span className={'product-icon '+category.toLowerCase()}>
    <Icon size={21} strokeWidth={1.6}/>
  </span>;
}

export function Empty({title,text,action}:{title:string;text:string;action?:ReactNode}){
  return <div className="empty-state">
    <Box size={28}/><h3>{title}</h3><p>{text}</p>{action}
  </div>;
}

type NavProps={
  view:View;
  onView:(view:View)=>void;
  openOrders:number;
  onSettings:()=>void;
  onPassword:()=>void;
  onLogout:()=>void;
  memberName:string;
  role:WorkspaceRole;
};

export function Nav({view,onView,openOrders,onSettings,onPassword,onLogout,memberName,role}:NavProps){
  const {setOpenMobile}=useSidebar();
  return <Sidebar className="app-sidebar">
    <SidebarHeader>
      <div className="brand"><img src="/aloyri-logo.webp" alt="ALOYRI — Let Your Skin Glow" /></div>
      <div className="workspace-switch">
        <span className="workspace-icon"><ShoppingBag size={18}/></span>
        <div><strong>ALOYRI workspace</strong><small>Bangladesh · BDT</small></div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>WORKSPACE</SidebarGroupLabel>
        <SidebarMenu>
          {sections.map((section,index)=>{
            const Icon=navIcons[index];
            return visibleSections(role).includes(section)
              ? <SidebarMenuItem key={section}>
                  <SidebarMenuButton
                    className="nav-button"
                    isActive={view===section}
                    onClick={()=>{onView(section);setOpenMobile(false)}}
                  >
                    <Icon/><span>{section}</span>
                    {section==='Orders'&&openOrders>0&&<span className="nav-count">{openOrders}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              : null;
          })}
        </SidebarMenu>
      </SidebarGroup>
      <div className="sidebar-tip">
        <div className="tip-icon"><Leaf size={19}/></div>
        <strong>Built to grow with you</strong>
        <p>Start small. Keep your stock fresh and your customers close.</p>
        <span>YOUR SKINCARE BUSINESS</span>
      </div>
    </SidebarContent>
    <SidebarFooter>
      {canManageBusinessSettings(role)&&
        <SidebarMenuButton className="nav-button" onClick={onSettings}>
          <Settings/><span>Business settings</span>
        </SidebarMenuButton>}
      <div className="profile">
        <Avatar name={memberName}/>
        <div><strong>{memberName}</strong><small>{roleLabels[role]}</small></div>
        <button className="profile-logout" title="Change password" aria-label="Change password" onClick={onPassword}>
          <Settings size={18}/>
        </button>
        <button className="profile-logout" title="Sign out" aria-label="Sign out" onClick={onLogout}>
          <LogOut size={18}/>
        </button>
      </div>
    </SidebarFooter>
  </Sidebar>;
}

export function Stat({label,value,detail,icon:Icon,green=false}:{
  label:string;
  value:string;
  detail:string;
  icon:LucideIcon;
  green?:boolean;
}){
  return <div className={'stat-card '+(green?'featured':'')}>
    <div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={19}/></span></div>
    <strong>{value}</strong>
    <div className="stat-bottom">{green?<ArrowUpRight size={14}/>:<span className="small-line"/>}{detail}</div>
  </div>;
}

const fulfillmentStatuses=['New','Confirmed','Ready to pack','Packed','Shipped','Out for delivery','Delivered'] as const;

export function OrderProgress({order}:{order:Order}){
  const current=order.status==='Returned'
    ? (order.delivered?fulfillmentStatuses.indexOf('Delivered'):fulfillmentStatuses.indexOf('Out for delivery'))
    : fulfillmentStatuses.indexOf(order.status as typeof fulfillmentStatuses[number]);

  return <div className="order-progress" aria-label="Order fulfillment progress">
    {fulfillmentStatuses.map((status,index)=>
      <div key={status} className={'order-progress-step '+(current>=index?'done ':'')+(order.status===status?'current':'')}>
        <span>{current>index?<Check size={12}/>:index+1}</span><small>{status}</small>
      </div>
    )}
    {(order.status==='Returned'||order.status==='Cancelled')&&
      <div className={'order-progress-final '+order.status.toLowerCase()}><Status value={order.status}/></div>}
  </div>;
}
