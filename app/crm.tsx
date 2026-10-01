'use client';
/* Final operational polish complete */
/* Production release: management intelligence */
import React,{useDeferredValue,useEffect,useMemo,useRef,useState} from 'react';
import { LayoutDashboard,ShoppingBag,Package,Users,Truck,Wallet,CalendarCheck,Plus,ArrowUpRight,ArrowRight,ChevronRight,ChevronDown,Download,Search,Bell,Check,CheckCircle2,Clock,AlertTriangle,Leaf,RefreshCw,ShieldCheck,Receipt,ArrowDownLeft,Box,Loader2,X,Mail,Phone,MapPin,ExternalLink,TrendingUp,Zap } from 'lucide-react';
import { SidebarProvider,SidebarTrigger } from '@/components/ui/sidebar';
import { Table,TableHeader,TableHead,TableBody,TableRow,TableCell } from '@/components/ui/table';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
import { Sheet,SheetContent,SheetHeader,SheetTitle,SheetDescription } from '@/components/ui/sheet';
import { AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction } from '@/components/ui/alert-dialog';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { AreaChart,Area,CartesianGrid,XAxis,YAxis,Tooltip,ResponsiveContainer } from 'recharts';
import { State,Product,Order,Customer,Task,initialState,uid,today,shiftDate,taka,dateLabel,stock,batchRemaining,stockPosition,metrics,cashflow,subtotal,total,receivable,collectedAmount,orderBalance,orderPaymentStatus,contribution,purchaseOrderValue,purchaseOrderUnits,purchaseOrderReceivedUnits,purchaseOrderOutstandingUnits,purchaseOrderProgress,supplierInsight,applyPurchaseOrderReceipt,automationSignals,statuses,nextStatuses,stateSchema,accountIds,accountNames,accountBalance,type AutomationSettings } from '@/lib/crm';
import { validateRoleRelations, validateWorkspaceChange } from '@/lib/role-data';
import Form,{Choice,Modal} from './forms';
import Invoice from './invoice';
import Team from './team';
import ChangePassword from './change-password';
import Reconciliation from './reconciliation';
import { canManageBusinessSettings, roleCanBackup, roleCanEdit, roleCanPrintInvoice, roleCanManageFinance, roleCanCloseFinance, roleCanExportData, roleCanImport, roleCanInspectReturns, roleCanManageTeam, roleCanReset, type WorkspaceRole } from '@/lib/roles';
import { Avatar, Empty, Nav, OrderProgress, ProductIcon, Stat, Status, navIcons, sections, visibleSections, type View } from './crm-ui';
import AlertsSection,{type AutoAlert} from './crm-sections/alerts';
import ActivitySection from './crm-sections/activity';
import AutomationSection from './crm-sections/automation';
import OverviewSection from './crm-sections/overview';
import CustomersSection from './crm-sections/customers';
import FollowUpsSection from './crm-sections/follow-ups';
import OrdersSection from './crm-sections/orders';
import InventorySection from './crm-sections/inventory';
import SuppliersSection from './crm-sections/suppliers';
import ReportsSection from './crm-sections/reports';
import FinancesSection from './crm-sections/finances';
type GlobalResult={id:string;view:View;title:string;meta:string;query:string;score:number;detail?:{type:'order'|'customer'|'supplier';id:string}};
const modalCollection:Record<Modal['type'],string>={order:'orders',orderEdit:'orders',customer:'customers',task:'tasks',product:'products',category:'productCategories',batch:'batches',stockAdjust:'stockAdjustments',stockHold:'inventoryHolds',supplier:'suppliers',expense:'expenses',cashEntry:'cashEntries',settings:'businessName'};
const titles:Record<View,string>={Overview:'Business overview',Reports:'Management reports',Alerts:'Alert center',Automation:'Automation center',Orders:'Orders',Inventory:'Inventory',Customers:'Customers',Suppliers:'Suppliers',Finances:'Finances', 'Follow-ups':'Follow-ups',Activity:'Activity log'};
const descriptions:Record<View,string>={Overview:'Monitor sales, stock and actions that need attention.',Reports:'Review management performance, customer quality, channels, products and trends.',Alerts:'Automatic business alerts, prioritized for your role.',Automation:'Control safe internal automations and review the signals they are producing.',Orders:'Track fulfillment, delivery and payment from one workspace.',Inventory:'Monitor stock health, batches, expiry and purchasing from one workspace.',Customers:'View contact details, preferences and order history.',Suppliers:'Manage supplier relationships, purchase orders, receiving and sourcing performance.',Finances:'Review sales, expenses, cashflow and collections in BDT.', 'Follow-ups':'Track customer follow-ups and replenishment tasks.',Activity:'Review protected employee and administrator change history.'};
const automationRuleNames:Record<keyof AutomationSettings,string>={
  deliveryFollowUp:'Post-delivery follow-up',
  lowStock:'Low-stock watch',
  expiringStock:'Expiry watch',
  overduePurchaseOrders:'Overdue purchase orders',
  supplierPayments:'Supplier payment due',
  customerCollections:'Customer collection due',
  customerRetention:'Customer inactivity',
  staleOrders:'Stale order watch'
};
const signedTaka=(amount:number)=>amount<0?'− '+taka(-amount):taka(amount);
const isCollectible=(o:Order)=>o.status==='Delivered'||(o.payment!=='COD'&&!['Cancelled','Returned'].includes(o.status));
export default function CRM(){
const [live,setLive]=useState<State>(initialState),[version,setVersion]=useState(0),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[authRequired,setAuthRequired]=useState(false),[busy,setBusy]=useState(false),[view,setView]=useState<View>('Overview'),[query,setQuery]=useState(''),[filter,setFilter]=useState('All'),[globalQuery,setGlobalQuery]=useState(''),[alertFilter,setAlertFilter]=useState<'All'|'Critical'|'Action needed'|'Upcoming'>('All'),[selectedOrderIds,setSelectedOrderIds]=useState<string[]>([]),[selectedCustomerIds,setSelectedCustomerIds]=useState<string[]>([]),[selectedPurchaseOrderIds,setSelectedPurchaseOrderIds]=useState<string[]>([]),[selectedTaskIds,setSelectedTaskIds]=useState<string[]>([]),[inventoryTab,setInventoryTab]=useState('Products'),[inventorySort,setInventorySort]=useState('Stock health'),[financeTab,setFinanceTab]=useState('Overview'),[purchasingTab,setPurchasingTab]=useState<'Purchase orders'|'Suppliers'>('Purchase orders'),[closeMonth,setCloseMonth]=useState(today().slice(0,7)),[reportMonth,setReportMonth]=useState(today().slice(0,7)),[cashRange,setCashRange]=useState('30'),[range,setRange]=useState('7'),[modal,setModal]=useState<Modal|null>(null),[detail,setDetail]=useState<{type:'order'|'customer'|'supplier';id:string}|null>(null),[invoiceId,setInvoiceId]=useState<string|null>(null),[teamOpen,setTeamOpen]=useState(false),[passwordOpen,setPasswordOpen]=useState(false),[memberName,setMemberName]=useState('Rafid'),[role,setRole]=useState<WorkspaceRole>('owner'),[confirm,setConfirm]=useState<{title:string;text:string;action:()=>void;confirmLabel?:string}|null>(null),[paymentDialog,setPaymentDialog]=useState<{kind:'collection'|'supplier';id:string;max:number;label:string}|null>(null),[paymentAmount,setPaymentAmount]=useState(''),[paymentDate,setPaymentDate]=useState(today()),[paymentAccount,setPaymentAccount]=useState<typeof accountIds[number]>('bkash'),[paymentReference,setPaymentReference]=useState(''),[ownerMoneyOpen,setOwnerMoneyOpen]=useState(false),[ownerMoneyKind,setOwnerMoneyKind]=useState<'capital'|'drawing'>('capital'),[ownerMoneyAmount,setOwnerMoneyAmount]=useState(''),[ownerMoneyDate,setOwnerMoneyDate]=useState(today()),[ownerMoneyAccount,setOwnerMoneyAccount]=useState<typeof accountIds[number]>('bank'),[ownerMoneyReference,setOwnerMoneyReference]=useState(''),[auditEvents,setAuditEvents]=useState<{id:string;actor_name:string;role:string;summary:string;sections:string[];created_at:string}[]>([]),[auditQuery,setAuditQuery]=useState(''),[auditSection,setAuditSection]=useState('All'),[auditRole,setAuditRole]=useState('All'),[auditHasMore,setAuditHasMore]=useState(false),[auditLoading,setAuditLoading]=useState(false),[poOpen,setPoOpen]=useState(false),[poSupplier,setPoSupplier]=useState(''),[poExpected,setPoExpected]=useState(shiftDate(14)),[poNotes,setPoNotes]=useState(''),[poLines,setPoLines]=useState<{productId:string;qty:number;unitCost:number}[]>([]),[poReceiveId,setPoReceiveId]=useState<string|null>(null),[poReceiveDate,setPoReceiveDate]=useState(today()),[poReceiveInvoice,setPoReceiveInvoice]=useState(''),[poReceiveDue,setPoReceiveDue]=useState(''),[poReceiveLines,setPoReceiveLines]=useState<{productId:string;qty:number;expiry:string}[]>([]);
const saving=useRef(false),globalSearchRef=useRef<HTMLInputElement|null>(null);const [globalActiveIndex,setGlobalActiveIndex]=useState(0);const s=live;
useEffect(()=>{const mode=s.businessProfile.appearanceMode==='dark'?'dark':'light';document.documentElement.dataset.crmTheme=mode;document.documentElement.classList.toggle('dark',mode==='dark');document.documentElement.style.colorScheme=mode;},[s.businessProfile.appearanceMode]);
const deferredQuery=useDeferredValue(query),deferredGlobalQuery=useDeferredValue(globalQuery);
const m=useMemo(()=>metrics(s),[s]);const flow=useMemo(()=>cashflow(s),[s]);
const customerById=useMemo(()=>new Map(s.customers.map(x=>[x.id,x])),[s.customers]);
const productById=useMemo(()=>new Map(s.products.map(x=>[x.id,x])),[s.products]);
const supplierById=useMemo(()=>new Map(s.suppliers.map(x=>[x.id,x])),[s.suppliers]);
const orderById=useMemo(()=>new Map(s.orders.map(x=>[x.id,x])),[s.orders]);const visibleCash=flow.entries.filter(e=>cashRange==='all'||e.date>=shiftDate(-29));const visibleExternalCash=visibleCash.filter(e=>e.source!=='Transfer');const cashIn=visibleExternalCash.filter(e=>e.kind==='in').reduce((n,e)=>n+e.amount,0);const cashOut=visibleExternalCash.filter(e=>e.kind==='out').reduce((n,e)=>n+e.amount,0);const activeProducts=s.products.filter(p=>p.active);const stockedProducts=activeProducts.filter(p=>stock(s,p.id)>0);const low=activeProducts.filter(p=>s.batches.some(b=>b.productId===p.id)&&stock(s,p.id)<=p.reorderAt);const expiring=s.batches.filter(b=>batchRemaining(s,b)>0&&b.expiry<=shiftDate(90));const due=s.tasks.filter(t=>!t.done&&t.due<=today());const attention=low.length+expiring.length+due.length;
const followUpOpen=s.tasks.filter(t=>!t.done);
const followUpOverdue=followUpOpen.filter(t=>t.due<today());
const followUpToday=followUpOpen.filter(t=>t.due===today());
const followUpUpcoming=followUpOpen.filter(t=>t.due>today()&&t.due<=shiftDate(7));
const followUpCompleted=s.tasks.filter(t=>t.done);
const followUpHigh=followUpOpen.filter(t=>t.priority==='High');
const followUpFocusText=followUpOverdue.length
  ? followUpOverdue.length+' overdue '+(followUpOverdue.length===1?'reminder needs':'reminders need')+' attention.'
  : followUpToday.length
    ? followUpToday.length+' '+(followUpToday.length===1?'reminder is':'reminders are')+' due today.'
    : followUpOpen.length
      ? 'Nothing overdue. Review the next customer conversations when you are ready.'
      : 'You are all caught up. New delivery follow-ups will appear here automatically.';
const followUpPriorityRank:Record<Task['priority'],number>={High:0,Normal:1,Low:2};
const followUpQuery=deferredQuery.trim().toLowerCase();
const followUpRows=useMemo(()=>s.tasks.filter(t=>{
  const customer=customerById.get(t.customerId),order=orderById.get(t.orderId);
  const filterMatch=filter==='All'||filter==='Open'&&!t.done||filter==='Completed'&&t.done||filter==='Overdue'&&!t.done&&t.due<today()||filter==='Today'&&!t.done&&t.due===today()||filter==='Next 7 days'&&!t.done&&t.due>today()&&t.due<=shiftDate(7)||filter==='Follow-up'&&t.kind==='Follow-up'||filter==='Replenishment'&&t.kind==='Replenishment'||filter==='High priority'&&!t.done&&t.priority==='High';
  const searchMatch=!followUpQuery||[t.title,t.kind,t.priority,t.channel,t.notes,customer?.name,customer?.phone,order?.number].some(value=>String(value||'').toLowerCase().includes(followUpQuery));
  return filterMatch&&searchMatch;
}).sort((a,b)=>Number(a.done)-Number(b.done)||a.due.localeCompare(b.due)||followUpPriorityRank[a.priority]-followUpPriorityRank[b.priority]||a.title.localeCompare(b.title)),[s.tasks,customerById,orderById,filter,followUpQuery]);
const inventoryUnits=activeProducts.reduce((n,p)=>n+stock(s,p.id),0);
const inventoryLow=activeProducts.filter(p=>{const qty=stock(s,p.id);return qty>0&&qty<=p.reorderAt});
const inventoryOut=activeProducts.filter(p=>stock(s,p.id)===0);
const inventoryExpiring=s.batches.filter(b=>batchRemaining(s,b)>0&&b.expiry>today()&&b.expiry<=shiftDate(90));
const inventoryExpired=s.batches.filter(b=>batchRemaining(s,b)>0&&b.expiry<=today());
const openPurchaseOrders=s.purchaseOrders.filter(po=>!['Received','Cancelled'].includes(po.status));
const currentInventoryMonth=today().slice(0,7);
const receivedThisMonth=s.batches.filter(b=>b.received.slice(0,7)===currentInventoryMonth);
const receivedUnitsThisMonth=receivedThisMonth.reduce((n,b)=>n+b.qty,0);
const inventoryVelocity=useMemo(()=>{const delivered=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created)>=shiftDate(-29));return s.products.filter(p=>p.active).map(product=>({product,units:delivered.reduce((n,o)=>n+o.items.filter(i=>i.productId===product.id).reduce((x,i)=>x+i.qty,0),0)})).sort((a,b)=>b.units-a.units)},[s]);
const fastestMoving=inventoryVelocity.find(x=>x.units>0);
const slowMovingCount=inventoryVelocity.filter(x=>stock(s,x.product.id)>0&&x.units===0).length;
const inventoryPositions=useMemo(()=>s.products.filter(p=>p.active).map(product=>({product,...stockPosition(s,product.id)})),[s]);
const inventoryPhysicalUnits=inventoryPositions.reduce((n,x)=>n+x.physical,0);
const inventoryReservedUnits=inventoryPositions.reduce((n,x)=>n+x.reserved,0);
const inventoryReturnPendingUnits=inventoryPositions.reduce((n,x)=>n+x.returnedPending,0);
const inventoryBlockedUnits=inventoryPositions.reduce((n,x)=>n+x.blocked,0);
const activeInventoryHolds=s.inventoryHolds.filter(h=>!h.releasedAt);
const pendingReturnOrders=s.orders.filter(o=>o.status==='Returned'&&!o.restocked);
const cancelledInspectionHolds=activeInventoryHolds.filter(h=>h.source==='Cancelled'&&h.type==='Quarantine');
const cancelledInspectionOrderIds=[...new Set(cancelledInspectionHolds.map(h=>h.sourceOrderId).filter((id):id is string=>Boolean(id)))];
const cancelledInspectionGroups=cancelledInspectionOrderIds.map(orderId=>({order:s.orders.find(o=>o.id===orderId),holds:cancelledInspectionHolds.filter(h=>h.sourceOrderId===orderId)}));
const managedInventoryHolds=activeInventoryHolds.filter(h=>!(h.source==='Cancelled'&&h.type==='Quarantine'));
const externalFlow=flow.entries.filter(e=>e.source!=='Transfer'),allCashIn=externalFlow.filter(e=>e.kind==='in').reduce((n,e)=>n+e.amount,0),allCashOut=externalFlow.filter(e=>e.kind==='out').reduce((n,e)=>n+e.amount,0),netCashMovement=allCashIn-allCashOut;
const overduePayables=s.batches.reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0,balance=Math.max(0,amount-b.payments.reduce((x,p)=>x+p.amount,0)-legacy);return n+(balance>.001&&b.dueDate&&b.dueDate<today()?balance:0)},0);
const reconciledAccounts=s.accountOpenings.length,unassignedMovements=flow.entries.filter(e=>!s.accountMatches.some(m=>m.entryId===e.id)).length;
const integrityIssues:{level:'Critical'|'Warning';title:string;detail:string;tab:string}[]=[];
const integrityBalances=accountIds.map(account=>({account,name:accountNames[account],balance:accountBalance(s,account)}));
integrityBalances.forEach(a=>{if(a.balance!==null&&a.balance<-.001)integrityIssues.push({level:'Warning',title:a.name+' has a negative CRM balance',detail:taka(a.balance)+' · check opening balance or missing transactions.',tab:'Reconciliation'})});
if(unassignedMovements)integrityIssues.push({level:'Warning',title:unassignedMovements+' cash movements are not assigned to an account',detail:'Assign Cash, Bank, bKash or Nagad in Accounts & reconciliation.',tab:'Reconciliation'});
const flowIds=new Set(flow.entries.map(e=>e.id));s.accountMatches.filter(m=>!flowIds.has(m.entryId)).forEach(m=>integrityIssues.push({level:'Warning',title:'Orphan account assignment',detail:m.entryId+' no longer matches a cashflow movement.',tab:'Reconciliation'}));
const transferIds=Array.from(new Set(s.cashEntries.map(e=>e.transferId).filter((id):id is string=>Boolean(id))));transferIds.forEach(id=>{const list=s.cashEntries.filter(e=>e.transferId===id);if(list.length!==2||list[0]?.amount!==list[1]?.amount||list[0]?.kind===list[1]?.kind)integrityIssues.push({level:'Critical',title:'Broken account transfer',detail:'Transfer '+id+' does not have one equal cash-in and cash-out pair.',tab:'Cashflow'})});
s.cashEntries.filter(e=>e.reversalOf&&!s.cashEntries.some(x=>x.id===e.reversalOf)).forEach(e=>integrityIssues.push({level:'Warning',title:'Reversal source is missing',detail:e.description,tab:'Cashflow'}));
const reportOrders=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created).slice(0,7)===reportMonth),reportExpenses=s.expenses.filter(e=>e.date.slice(0,7)===reportMonth),reportRevenue=reportOrders.reduce((n,o)=>n+subtotal(o),0),reportDeliveryIncome=reportOrders.reduce((n,o)=>n+o.deliveryCharge,0),reportCogs=reportOrders.reduce((n,o)=>n+o.items.flatMap(i=>i.allocations).reduce((x,a)=>x+a.unitCost*a.qty,0),0),reportGross=reportRevenue-reportCogs,reportFulfillment=reportOrders.reduce((n,o)=>n+o.courierCost+o.packaging+o.paymentFee,0),reportReturns=s.orders.filter(o=>o.status==='Returned'&&(o.returnedAt||o.delivered||o.created).slice(0,7)===reportMonth).reduce((n,o)=>n+(o.restocked?0:o.items.flatMap(i=>i.allocations).reduce((x,a)=>x+a.unitCost*a.qty,0))+o.courierCost+o.returnFee+o.packaging+o.paymentFee,0),reportOpex=reportExpenses.reduce((n,e)=>n+e.amount,0),reportProfit=reportGross+reportDeliveryIncome-reportFulfillment-reportReturns-reportOpex,reportMargin=reportRevenue?reportProfit/reportRevenue*100:0;
const previousMonth=(()=>{const [y,m]=reportMonth.split('-').map(Number);return new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7)})(),previousOrders=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created).slice(0,7)===previousMonth),previousRevenue=previousOrders.reduce((n,o)=>n+subtotal(o),0);
const reportCustomerIds=Array.from(new Set(reportOrders.map(o=>o.customerId))),reportAov=reportOrders.length?reportRevenue/reportOrders.length:0;
const reportNewCustomers=s.customers.filter(customer=>customer.created.slice(0,7)===reportMonth).length;
const reportRepeatCustomers=reportCustomerIds.filter(customerId=>s.orders.some(o=>o.customerId===customerId&&o.status==='Delivered'&&(o.delivered||o.created)<reportMonth+'-01')).length;
const reportRepeatRate=reportCustomerIds.length?reportRepeatCustomers/reportCustomerIds.length*100:0;
const reportReturnedOrders=s.orders.filter(o=>o.status==='Returned'&&(o.returnedAt||o.delivered||o.created).slice(0,7)===reportMonth);
const reportReturnRate=(reportOrders.length+reportReturnedOrders.length)?reportReturnedOrders.length/(reportOrders.length+reportReturnedOrders.length)*100:0;
const reportChannelRows=Array.from(new Set(reportOrders.map(o=>o.channel))).map(channel=>{const orders=reportOrders.filter(o=>o.channel===channel);return {channel,orders:orders.length,revenue:orders.reduce((n,o)=>n+subtotal(o),0)}}).sort((a,b)=>b.revenue-a.revenue);
const reportProductRows=s.products.map(product=>{let units=0,revenue=0;for(const order of reportOrders)for(const item of order.items.filter(i=>i.productId===product.id)){units+=item.qty;revenue+=item.qty*item.price}return {product,units,revenue}}).filter(row=>row.units>0).sort((a,b)=>b.revenue-a.revenue||b.units-a.units).slice(0,6);
const reportProductMax=Math.max(1,...reportProductRows.map(row=>row.revenue));
const reportRevenueDelta=previousRevenue?Math.round((reportRevenue-previousRevenue)/previousRevenue*100):null;
const reportPulse=reportProfit<0?'Needs attention':reportReturnRate>12?'Watch returns':reportRepeatRate>=35?'Healthy retention':'Building momentum';
const reportPulseTone=reportProfit<0||reportReturnRate>12?'warning':reportRepeatRate>=35?'positive':'neutral';
const reportTopChannel=reportChannelRows[0]??null,reportTopProduct=reportProductRows[0]??null,reportWorkingCapital=m.pending-m.unpaidStock;
const reportInsightTone={
  revenue:reportRevenueDelta===null?'neutral':reportRevenueDelta>=0?'positive':'warning',
  retention:reportRepeatRate>=35?'positive':reportRepeatRate>=20?'neutral':'warning',
  operations:reportReturnRate>12||inventoryOut.length>0?'warning':'positive'
};
const reportPurchaseOrders=s.purchaseOrders.filter(po=>po.created.slice(0,7)===reportMonth&&po.status!=='Cancelled'),reportPurchasingValue=reportPurchaseOrders.reduce((n,po)=>n+purchaseOrderValue(po),0);
const reportProductProfitability=s.products.map(product=>{let units=0,revenue=0,cost=0;for(const order of reportOrders)for(const item of order.items.filter(i=>i.productId===product.id)){units+=item.qty;revenue+=item.qty*item.price;cost+=item.allocations.reduce((n,a)=>n+a.qty*a.unitCost,0)}const gross=revenue-cost;return {product,units,revenue,cost,gross,margin:revenue?gross/revenue*100:0}}).filter(row=>row.units>0).sort((a,b)=>b.gross-a.gross||b.revenue-a.revenue).slice(0,8);
const reportCustomerValue=s.customers.map(customer=>{const delivered=s.orders.filter(o=>o.customerId===customer.id&&o.status==='Delivered'),revenue=delivered.reduce((n,o)=>n+subtotal(o),0),last=delivered.map(o=>o.delivered||o.created).sort().at(-1)||'';return {customer,orders:delivered.length,revenue,aov:delivered.length?revenue/delivered.length:0,last}}).filter(row=>row.orders>0).sort((a,b)=>b.revenue-a.revenue||b.orders-a.orders).slice(0,6);
const inventoryAgeingLabels=['0–30 days','31–60 days','61–90 days','90+ days'] as const;
const inventoryAgeDays=(date:string)=>Math.max(0,Math.floor((Date.parse(today()+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000));
const inventoryAgeing=inventoryAgeingLabels.map(label=>{let units=0,value=0;for(const batch of s.batches){const remaining=batchRemaining(s,batch);if(remaining<=0)continue;const days=inventoryAgeDays(batch.received),bucket=days<=30?'0–30 days':days<=60?'31–60 days':days<=90?'61–90 days':'90+ days';if(bucket!==label)continue;units+=remaining;value+=remaining*batch.unitCost}return {label,units,value}});
const inventoryAgeingTotal=inventoryAgeing.reduce((n,row)=>n+row.value,0);
const supplierPerformance=s.suppliers.map(supplier=>{const insight=supplierInsight(s,supplier.id),pos=insight.purchaseOrders.filter(po=>po.status!=='Cancelled'),received=pos.filter(po=>po.status==='Received'),open=pos.filter(po=>!['Received','Cancelled'].includes(po.status)),overdue=insight.overduePurchaseOrders,value=pos.reduce((n,po)=>n+purchaseOrderValue(po),0);return {supplier,orders:pos.length,received:received.length,open:open.length,overdue:overdue.length,value,avgLead:insight.avgLeadDays}}).filter(row=>row.orders>0).sort((a,b)=>b.value-a.value||b.orders-a.orders).slice(0,6);
const reportCollected=reportOrders.reduce((n,o)=>n+Math.min(receivable(o),o.collections.reduce((x,p)=>x+p.amount,0)+(o.settled&&o.collections.length===0?receivable(o):0)),0);
const reportCollectionRate=reportOrders.reduce((n,o)=>n+receivable(o),0)?reportCollected/reportOrders.reduce((n,o)=>n+receivable(o),0)*100:0;
const reportMonths=Array.from(new Set([...s.orders.map(o=>(o.delivered||o.created).slice(0,7)),...s.expenses.map(e=>e.date.slice(0,7)),today().slice(0,7)])).sort().reverse();
const closeEnd=closeMonth+'-31',closeMovements=flow.entries.filter(e=>e.date.slice(0,7)===closeMonth),closeUnassigned=closeMovements.filter(e=>!s.accountMatches.some(m=>m.entryId===e.id)).length,closeMissingAccounts=4-s.accountOpenings.length,closeReceivables=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created).slice(0,7)<=closeMonth).reduce((n,o)=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0;return n+Math.max(0,due-o.collections.filter(p=>p.date<=closeEnd).reduce((x,p)=>x+p.amount,0)-legacy)},0),closePayables=s.batches.filter(b=>b.received.slice(0,7)<=closeMonth).reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0;return n+Math.max(0,amount-b.payments.filter(p=>p.date<=closeEnd).reduce((x,p)=>x+p.amount,0)-legacy)},0),closeRecord=s.financeCloses.find(x=>x.month===closeMonth),closeBlockers=closeUnassigned+closeMissingAccounts+flow.undated;

const ageDays=(date:string)=>Math.max(0,Math.floor((Date.parse(today()+'T12:00:00Z')-Date.parse(date+'T12:00:00Z'))/86400000));const ageBucket=(days:number)=>days<=7?'0–7 days':days<=30?'8–30 days':days<=60?'31–60 days':'60+ days';const agingLabels=['0–7 days','8–30 days','31–60 days','60+ days'] as const;
const receivableAging=agingLabels.map(label=>({label,amount:s.orders.filter(isCollectible).reduce((n,o)=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0,balance=Math.max(0,due-o.collections.reduce((x,p)=>x+p.amount,0)-legacy);return n+(balance>.001&&ageBucket(ageDays(o.delivered||o.created))===label?balance:0)},0)}));
const payableAging=agingLabels.map(label=>({label,amount:s.batches.reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0,balance=Math.max(0,amount-b.payments.reduce((x,p)=>x+p.amount,0)-legacy),age=b.dueDate?ageDays(b.dueDate):ageDays(b.received);return n+(balance>.001&&ageBucket(age)===label?balance:0)},0)}));
const configuredBalances=accountIds.map(account=>({account,name:accountNames[account],balance:accountBalance(s,account)})),availableCash=configuredBalances.reduce((n,a)=>n+(a.balance??0),0);
const forecastReceivables=s.orders.filter(isCollectible).reduce((n,o)=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0;return n+Math.max(0,due-o.collections.reduce((x,p)=>x+p.amount,0)-legacy)},0);
const forecastPayables30=s.batches.reduce((n,b)=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0,balance=Math.max(0,amount-b.payments.reduce((x,p)=>x+p.amount,0)-legacy);return n+(balance>.001&&b.dueDate&&b.dueDate<=shiftDate(30)?balance:0)},0);
const recent30=externalFlow.filter(e=>e.date>=shiftDate(-29)),recentCashIn=recent30.filter(e=>e.kind==='in').reduce((n,e)=>n+e.amount,0),recentCashOut=recent30.filter(e=>e.kind==='out').reduce((n,e)=>n+e.amount,0),recentNet=recentCashIn-recentCashOut;
const projected30=availableCash+forecastReceivables-forecastPayables30+recentNet;
const monthlyTrend=Array.from({length:6},(_,idx)=>{const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-(5-idx));const month=d.toISOString().slice(0,7),orders=s.orders.filter(o=>o.status==='Delivered'&&(o.delivered||o.created).slice(0,7)===month),revenue=orders.reduce((n,o)=>n+subtotal(o),0),profit=orders.reduce((n,o)=>n+contribution(o),0)-s.expenses.filter(e=>e.date.slice(0,7)===month).reduce((n,e)=>n+e.amount,0),cash=externalFlow.filter(e=>e.date.slice(0,7)===month).reduce((n,e)=>n+(e.kind==='in'?e.amount:-e.amount),0);return {month,label:new Date(month+'-01T12:00:00Z').toLocaleDateString('en-GB',{month:'short'}),revenue,profit,cash}}),trendMax=Math.max(1,...monthlyTrend.flatMap(x=>[Math.abs(x.revenue),Math.abs(x.profit),Math.abs(x.cash)]));


const automationLive=useMemo(()=>automationSignals(s),[s]);
const automationActiveRules=Object.values(s.automationSettings).filter(rule=>rule.enabled).length;
const automationCritical=automationLive.filter(signal=>signal.level==='Critical').length;
const automationAction=automationLive.filter(signal=>signal.level==='Action needed').length;
const automationUpcoming=automationLive.filter(signal=>signal.level==='Upcoming').length;
const autoAlerts:AutoAlert[]=automationLive.map(signal=>({id:signal.key,level:signal.level,title:signal.title,detail:signal.detail,view:signal.view,role:signal.role}));
s.tasks.filter(t=>!t.done&&t.due<=shiftDate(2)).forEach(t=>autoAlerts.push({id:'task-'+t.id,level:t.due<today()||t.priority==='High'?'Critical':'Upcoming',title:t.title,detail:t.priority+' priority · '+(t.due<today()?'overdue · ':'due ')+dateLabel(t.due),view:'Follow-ups',role:'sales'}));
if(unassignedMovements)autoAlerts.push({id:'reconcile',level:unassignedMovements>5?'Critical':'Action needed',title:'Reconcile '+unassignedMovements+' cash movements',detail:'Assign recorded movements to Cash, Bank, bKash or Nagad.',view:'Finances',role:'finance'});
if(projected30<0)autoAlerts.push({id:'liquidity',level:'Critical',title:'Negative 30-day planning position',detail:'Projected shortfall '+taka(Math.abs(projected30))+' based on current CRM assumptions.',view:'Finances',role:'finance'});
const alertRank:Record<AutoAlert['level'],number>={Critical:0,'Action needed':1,Upcoming:2};const roleAlerts=autoAlerts.filter(a=>role==='owner'||role==='admin'||role==='viewer'||a.role==='all'||(role==='sales'&&a.role==='sales')||(role==='inventory'&&a.role==='inventory')).sort((a,b)=>alertRank[a.level]-alertRank[b.level]);
const alertCritical=roleAlerts.filter(a=>a.level==='Critical').length,alertAction=roleAlerts.filter(a=>a.level==='Action needed').length,alertUpcoming=roleAlerts.filter(a=>a.level==='Upcoming').length;
const shownAlerts=alertFilter==='All'?roleAlerts:roleAlerts.filter(a=>a.level===alertFilter);
const alertFocus=roleAlerts[0];
const alertActionLabel=(alert:AutoAlert)=>alert.view==='Follow-ups'?'Open follow-ups':alert.view==='Finances'?'Open finance':alert.view==='Inventory'?'Open inventory':alert.view==='Suppliers'?'Open purchasing':alert.view==='Orders'?'Open orders':'Open '+alert.view.toLowerCase();
const managementActionQueue=[
  ...(inventoryOut.length?[{id:'stockout',level:'Critical' as const,title:inventoryOut.length+' active '+(inventoryOut.length===1?'product is':'products are')+' out of stock',detail:'Restore availability before demand is lost.',view:'Inventory' as View}]:[]),
  ...(inventoryLow.length?[{id:'lowstock',level:'Action needed' as const,title:inventoryLow.length+' '+(inventoryLow.length===1?'product is':'products are')+' below reorder level',detail:'Review replenishment and open purchase orders.',view:'Inventory' as View}]:[]),
  ...(followUpOverdue.length?[{id:'followups',level:'Action needed' as const,title:followUpOverdue.length+' customer '+(followUpOverdue.length===1?'follow-up is':'follow-ups are')+' overdue',detail:'Protect retention by clearing overdue conversations.',view:'Follow-ups' as View}]:[]),
  ...(overduePayables>0?[{id:'payables',level:'Action needed' as const,title:'Supplier payments overdue',detail:taka(overduePayables)+' is past due.',view:'Finances' as View}]:[]),
  ...(projected30<0?[{id:'cash',level:'Critical' as const,title:'30-day cash position is negative',detail:'Projected gap '+taka(Math.abs(projected30))+'.',view:'Finances' as View}]:[]),
  ...(reportReturnRate>12?[{id:'returns',level:'Action needed' as const,title:'Return rate is elevated',detail:reportReturnRate.toFixed(1)+'% for the selected reporting month.',view:'Orders' as View}]:[]),
  ...(integrityIssues.length?[{id:'integrity',level:'Action needed' as const,title:integrityIssues.length+' control '+(integrityIssues.length===1?'issue needs':'issues need')+' review',detail:'Open Finance → Reconciliation and resolve data-control warnings.',view:'Finances' as View}]:[])
].slice(0,7);
const managementControlScore=Math.max(0,100-Math.min(100,integrityIssues.length*12+unassignedMovements*4+inventoryExpired.length*5+(projected30<0?18:0)));
function openAlert(alert:AutoAlert){
  changeView(alert.view);
  if(alert.view==='Finances'&&alert.id.startsWith('collect-'))setFinanceTab('Collections');
  if(alert.view==='Finances'&&alert.id.startsWith('pay-'))setFinanceTab('Payables');
  if(alert.view==='Finances'&&alert.id==='reconcile')setFinanceTab('Reconciliation');
  if(alert.view==='Finances'&&alert.id==='liquidity')setFinanceTab('Overview');
}
const auditSections=Array.from(new Set(auditEvents.flatMap(e=>e.sections))).sort();
const auditRoles=Array.from(new Set(auditEvents.map(e=>e.role))).sort();
const auditNeedle=auditQuery.trim().toLowerCase();
const filteredAuditEvents=auditEvents.filter(e=>(auditSection==='All'||e.sections.includes(auditSection))&&(auditRole==='All'||e.role===auditRole)&&(!auditNeedle||[e.actor_name,e.role,e.summary,...e.sections].join(' ').toLowerCase().includes(auditNeedle)));
const auditLatest=auditEvents[0];
const auditActorCount=new Set(auditEvents.map(e=>e.actor_name)).size;
const auditDate=(iso:string)=>new Date(iso).toLocaleDateString('en-GB',{timeZone:'Asia/Dhaka',day:'numeric',month:'short',year:'numeric'});
const auditTime=(iso:string)=>new Date(iso).toLocaleTimeString('en-GB',{timeZone:'Asia/Dhaka',hour:'2-digit',minute:'2-digit'});
const auditRelative=(iso:string)=>{const diff=Math.max(0,Date.now()-new Date(iso).getTime()),mins=Math.floor(diff/60000);if(mins<1)return'Just now';if(mins<60)return mins+'m ago';const hours=Math.floor(mins/60);if(hours<24)return hours+'h ago';const days=Math.floor(hours/24);return days<7?days+'d ago':auditDate(iso)};
const canEdit=(key:string)=>roleCanEdit(role,key);
const canFinance=roleCanManageFinance(role);
const canCloseFinance=roleCanCloseFinance(role);
const canExport=roleCanExportData(role);
const canImport=roleCanImport(role);
const canInspectReturns=roleCanInspectReturns(role);
const canTeam=roleCanManageTeam(role);
const canReset=roleCanReset(role);
const canBackup=roleCanBackup(role);
const canPrint=roleCanPrintInvoice(role);
const salesMode=role==='sales';
async function updateAutomationRule<K extends keyof AutomationSettings>(rule:K,patch:Partial<AutomationSettings[K]>){
  if(!canEdit('automationSettings')){toast.error('Only the owner or an admin can change automation rules.');return}
  const next=structuredClone(s);
  Object.assign(next.automationSettings[rule],patch);
  await save(next);
}
async function updateFollowUp(task:Task,patch:Partial<Task>){
  if(!canEdit('tasks')){toast.error('Your role cannot update follow-ups.');return}
  const next=structuredClone(s),record=next.tasks.find(t=>t.id===task.id);if(!record)return;
  Object.assign(record,patch);
  if(patch.done===true)record.completedAt=patch.completedAt||today();
  if(patch.done===false)record.completedAt='';
  await save(next);
}
function deleteFollowUp(task:Task){
  if(!canEdit('tasks')){toast.error('Your role cannot delete follow-ups.');return}
  setConfirm({title:'Delete follow-up?',text:'Remove “'+task.title+'” from the follow-up history? This cannot be undone.',confirmLabel:'Delete',action:()=>{const next=structuredClone(s);next.tasks=next.tasks.filter(t=>t.id!==task.id);void save(next)}});
}
const followUpDueLabel=(task:Task)=>task.done?'Completed':task.due<today()?'Overdue · '+dateLabel(task.due):task.due===today()?'Today':task.due===shiftDate(1)?'Tomorrow':dateLabel(task.due);
const openModal=(record:Modal)=>{if(record.type==='settings'&&!canManageBusinessSettings(role)){toast.error('Only the owner or an admin can access Business settings.');return}if(!canEdit(modalCollection[record.type])){toast.error('Your role cannot edit this section.');return}setModal(record)};
async function loadAudit(reset=false){
  if(auditLoading)return;
  setAuditLoading(true);
  try{
    const offset=reset?0:auditEvents.length;
    const r=await fetch('/api/audit?limit=200&offset='+offset,{cache:'no-store'}),data=await r.json();
    if(!r.ok)throw Error(data.error||'Could not load activity history.');
    setAuditEvents(current=>reset?(data.events||[]):[...current,...(data.events||[]).filter((e:any)=>!current.some(x=>x.id===e.id))]);
    setAuditHasMore(Boolean(data.hasMore));
  }catch(e){toast.error(e instanceof Error?e.message:'Could not load activity history.')}
  finally{setAuditLoading(false)}
}
const changeView=(v:View)=>{if(!visibleSections(role).includes(v))return;setView(v);setQuery('');setFilter('All');setDetail(null);setSelectedOrderIds([]);setSelectedCustomerIds([]);setSelectedPurchaseOrderIds([]);setSelectedTaskIds([]);if(v==='Activity')void loadAudit(true)};
async function loadLive(showErrors=true){setBusy(true);try{const res=await fetch('/api/workspace',{cache:'no-store'});const d:any=await res.json();if(!res.ok){setAuthRequired(res.status===401);throw Error(d.error||'Could not load records.')}setLive(d.data);setVersion(d.version);setRole(['owner','admin','sales','inventory','viewer'].includes(d.role)?d.role:'viewer');if(d.role==='sales')setView('Orders');if(d.role==='inventory')setView('Inventory');if(d.role==='viewer')setView('Overview');setMemberName(d.userName||'Team member');setLoaded(true);setError('');setAuthRequired(false);return true;}catch(e){if(showErrors)setError(e instanceof Error?e.message:'Could not load your workspace.');return false;}finally{setBusy(false)}}
useEffect(()=>{let active=true;fetch('/api/workspace',{cache:'no-store'}).then(async r=>{const d:any=await r.json();if(!active)return;if(r.ok){setLive(d.data);setVersion(d.version);setRole(['owner','admin','sales','inventory','viewer'].includes(d.role)?d.role:'viewer');if(d.role==='sales')setView('Orders');if(d.role==='inventory')setView('Inventory');if(d.role==='viewer')setView('Overview');setMemberName(d.userName||'Team member');setLoaded(true);}else setAuthRequired(r.status===401)}).catch(()=>{});return()=>{active=false}},[]);
async function save(next:State):Promise<boolean>{if(saving.current)return false;try{next=stateSchema.parse(next);if(role==='inventory')validateRoleRelations(next,role);else validateWorkspaceChange(s,next);}catch(e){toast.error(e instanceof Error?e.message:'Please check the values.');return false;}if(!loaded){toast.error('Load your workspace before saving.');return false;}if(Object.keys(s).some(key=>!roleCanEdit(role,key)&&!(role==='inventory'&&key==='orders')&&JSON.stringify(next[key as keyof State])!==JSON.stringify(s[key as keyof State]))){toast.error('Your role cannot change that section.');return false;}saving.current=true;setBusy(true);try{const res=await fetch('/api/workspace',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:next,version})});const d:any=await res.json();if(!res.ok)throw Error(d.error||'Could not save.');setLive(d.data?stateSchema.parse(d.data):next);setVersion(d.version);setError('');toast.success('Changes saved');return true;}catch(e){const message=e instanceof Error?e.message:'Could not save.';setError(message);toast.error(message);return false;}finally{saving.current=false;setBusy(false)}}
async function downloadWorkspaceBackup(){if(!canBackup){toast.error('Only the business owner can create a full backup.');return;}try{const res=await fetch('/api/workspace/backup',{cache:'no-store'}),data=await res.json();if(!res.ok)throw Error(data.error||'Could not create backup.');const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='aloyri-workspace-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast.success('Full workspace backup downloaded.')}catch(e){toast.error(e instanceof Error?e.message:'Could not create backup.')}}
async function restoreWorkspaceBackup(file:File){
  if(!canBackup){toast.error('Only the business owner can restore a full backup.');return;}
  try{
    const backup=JSON.parse(await file.text());
    setBusy(true);
    const validationRes=await fetch('/api/workspace/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'validate',backup})});
    const validation=await validationRes.json();
    if(!validationRes.ok)throw Error(validation.error||'Backup validation failed.');
    const counts=validation.backupWorkspace?.counts||validation.integrity?.counts||{},currentCounts=validation.currentWorkspace?.counts||{};
    const summary=['orders','customers','products','batches','suppliers','tasks'].filter(key=>typeof counts[key]==='number').map(key=>counts[key]+' '+key).join(' · ');
    const changed=['orders','customers','products','batches','suppliers','tasks'].filter(key=>typeof counts[key]==='number'&&typeof currentCounts[key]==='number'&&counts[key]!==currentCounts[key]).map(key=>key+': '+currentCounts[key]+' → '+counts[key]).join(' · ');
    const warningCount=(validation.backupWorkspace?.warnings||validation.integrity?.warnings||[]).length;
    const confirmation=window.prompt('Backup verified'+(summary?' · '+summary:'')+(changed?'\nChanges: '+changed:'')+(warningCount?'\nReview note: '+warningCount+' non-blocking integrity '+(warningCount===1?'warning':'warnings')+' detected in the backup.':'')+'\nA safety snapshot of your current workspace will be created automatically before restore. Employee accounts and login access are not replaced.\nType RESTORE ALOYRI to continue.');
    if(confirmation!=='RESTORE ALOYRI'){toast.error('Restore cancelled.');return}
    const res=await fetch('/api/workspace/backup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restore',confirmation,backup})}),data=await res.json();
    if(!res.ok)throw Error(data.error||'Could not restore backup.');
    await loadLive(false);
    toast.success(data.safetySnapshot?.id?'Verified backup restored. A pre-restore safety snapshot was saved.':'Verified workspace backup restored.');
  }catch(e){toast.error(e instanceof Error?e.message:'Could not validate or restore backup.')}
  finally{setBusy(false)}
}
async function resetWorkspace(){
  if(!canReset){toast.error('Only the business owner can reset CRM data.');return;}
  const confirmation=window.prompt('This permanently clears customers, orders, suppliers, inventory stock, finance records and follow-ups. ALOYRI settings and employee access will remain, but the product catalog will be cleared. Type RESET ALOYRI to continue.');
  if(confirmation===null)return;
  if(confirmation!=='RESET ALOYRI'){toast.error('Reset cancelled. Type RESET ALOYRI exactly to confirm.');return;}
  setBusy(true);
  try{
    const res=await fetch('/api/workspace/reset',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation})});
    const d:any=await res.json();
    if(!res.ok)throw Error(d.error||'Could not reset CRM data.');
    setModal(null);setDetail(null);setInvoiceId(null);setView('Overview');setQuery('');setFilter('All');
    await loadLive(false);
    toast.success('CRM data cleared. Inventory and the product catalog are now empty.');
  }catch(e){toast.error(e instanceof Error?e.message:'Could not reset CRM data.');}
  finally{setBusy(false);}
}
function downloadCsv(filename:string,headers:string[],rows:(string|number)[][]){const esc=(v:string|number)=>'"'+String(v??'').replaceAll('"','""')+'"';const csv='\uFEFF'+[headers,...rows].map(row=>row.map(esc).join(',')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function exportManagementReport(){if(!canExport){toast.error('Only the owner or an admin can export management reports.');return}const rows:(string|number)[][]=[
  ['Reporting month',reportMonth],
  ['Delivered revenue',reportRevenue],
  ['Operating profit',reportProfit],
  ['Operating margin %',reportMargin.toFixed(1)],
  ['Average order value',reportAov],
  ['Repeat customer rate %',reportRepeatRate.toFixed(1)],
  ['Return rate %',reportReturnRate.toFixed(1)],
  ['Collection rate %',reportCollectionRate.toFixed(1)],
  ['New customers',reportNewCustomers],
  ['Inventory value',m.stockValue],
  ['Receivables',m.pending],
  ['Supplier payables',m.unpaidStock],
  ['30-day projected cash',projected30],
  ['Control health score',managementControlScore]
];downloadCsv('aloyri-management-report-'+reportMonth+'.csv',['Metric','Value'],rows);toast.success('Management report downloaded')}
function exportFinance(kind:'pnl'|'cashflow'|'expenses'|'receivables'|'payables'|'ledger'){if(!canExport){toast.error('Only the owner or an admin can export finance reports.');return}
 if(kind==='pnl')return downloadCsv('aloyri-pnl-'+reportMonth+'.csv',['Line item','Amount BDT'],[['Product revenue',reportRevenue],['COGS',-reportCogs],['Gross profit',reportGross],['Delivery income',reportDeliveryIncome],['Fulfillment costs',-reportFulfillment],['Return costs',-reportReturns],['Operating expenses',-reportOpex],['Operating profit',reportProfit]]);
 if(kind==='cashflow')return downloadCsv('aloyri-cashflow-'+reportMonth+'.csv',['Date','Source','Description','Direction','Amount BDT'],externalFlow.filter(e=>e.date.slice(0,7)===reportMonth).map(e=>[e.date,e.source,e.description,e.kind==='in'?'Cash in':'Cash out',e.amount]));
 if(kind==='expenses')return downloadCsv('aloyri-expenses-'+reportMonth+'.csv',['Date','Category','Vendor','Description','Reference','Recurring','Amount BDT'],reportExpenses.map(e=>[e.date,e.category,e.vendor,e.notes,e.reference,e.recurring,e.amount]));
 if(kind==='receivables')return downloadCsv('aloyri-receivables-'+reportMonth+'.csv',['Order','Customer','Delivered','Net receivable','Collected','Balance'],s.orders.filter(o=>o.status==='Delivered').map(o=>{const due=receivable(o),legacy=o.settled&&o.collections.length===0?due:0,collected=o.collections.reduce((n,p)=>n+p.amount,0)+legacy;return [o.number,s.customers.find(x=>x.id===o.customerId)?.name||'',o.delivered||o.created,due,collected,Math.max(0,due-collected)]}).filter(r=>Number(r[5])>.001));
 if(kind==='payables')return downloadCsv('aloyri-payables-'+reportMonth+'.csv',['Supplier','Product','Received','Due date','Invoice','Purchase value','Paid','Balance'],s.batches.map(b=>{const amount=b.qty*b.unitCost,legacy=b.paid&&b.payments.length===0?amount:0,paid=b.payments.reduce((n,p)=>n+p.amount,0)+legacy;return [supplierById.get(b.supplierId)?.name||'',s.products.find(x=>x.id===b.productId)?.name||'',b.received,b.dueDate||'',b.invoice,amount,paid,Math.max(0,amount-paid)]}).filter(r=>Number(r[7])>.001));
 const links=new Map(s.accountMatches.map(m=>[m.entryId,m]));return downloadCsv('aloyri-account-ledger-'+reportMonth+'.csv',['Date','Account','Source','Description','Direction','Amount BDT','Reference'],flow.entries.filter(e=>e.date.slice(0,7)===reportMonth).map(e=>{const m=links.get(e.id);return [e.date,m?accountNames[m.account]:'Unassigned',e.source,e.description,e.kind==='in'?'In':'Out',e.amount,m?.reference||'']}));
}
function openPurchaseOrder(supplierId?:string){if(!canEdit('purchaseOrders')){toast.error('Your role cannot create purchase orders.');return;}if(!s.suppliers.length){toast.error('Add a supplier before creating a purchase order.');return}if(!s.products.length){toast.error('Add a product before creating a purchase order.');return}const supplier=s.suppliers.find(x=>x.id===supplierId)||s.suppliers[0],first=s.products[0];setPoSupplier(supplier.id);setPoExpected(shiftDate(supplier.leadDays??14));setPoNotes('');setPoLines([{productId:first.id,qty:1,unitCost:first.cost||0}]);setPoOpen(true)}
function setPurchaseOrderProduct(index:number,productId:string){if(poLines.some((line,i)=>i!==index&&line.productId===productId)){toast.error('That product is already on this purchase order.');return}const product=s.products.find(p=>p.id===productId);setPoLines(lines=>lines.map((line,i)=>i===index?{...line,productId,unitCost:product?.cost||line.unitCost}:line))}
function addPurchaseOrderItem(){const used=new Set(poLines.map(line=>line.productId));const product=s.products.find(p=>!used.has(p.id));if(!product){toast.error('All products are already on this purchase order.');return}setPoLines(lines=>[...lines,{productId:product.id,qty:1,unitCost:product.cost||0}])}
async function createPurchaseOrder(){if(!canEdit('purchaseOrders')){toast.error('Your role cannot create purchase orders.');return}if(!poSupplier){toast.error('Choose a supplier.');return}if(poExpected<today()){toast.error('Expected delivery cannot be before today.');return}if(!poLines.length||poLines.some(l=>!l.productId||!Number.isInteger(l.qty)||l.qty<1||!Number.isFinite(l.unitCost)||l.unitCost<0)){toast.error('Check the purchase order items.');return}if(new Set(poLines.map(l=>l.productId)).size!==poLines.length){toast.error('Add each product only once on a purchase order.');return}const next=structuredClone(s),seq=next.purchaseOrders.length+1;next.purchaseOrders.push({id:uid(),number:'PO-'+today().replaceAll('-','')+'-'+String(seq).padStart(3,'0'),supplierId:poSupplier,created:today(),expected:poExpected,status:'Draft',notes:poNotes.trim(),items:poLines.map(l=>({...l,receivedQty:0}))});if(await save(next))setPoOpen(false)}
async function setPurchaseOrderStatus(id:string,status:State['purchaseOrders'][number]['status']){if(!canEdit('purchaseOrders')){toast.error('Your role cannot update purchase orders.');return}const next=structuredClone(s),po=next.purchaseOrders.find(p=>p.id===id);if(!po)return;po.status=status;await save(next)}
function openPurchaseOrderReceipt(id:string){if(!canEdit('purchaseOrders')||!canEdit('batches')){toast.error('Your role cannot receive purchase orders into stock.');return}const po=s.purchaseOrders.find(p=>p.id===id);if(!po)return;if(!['Sent','Part received'].includes(po.status)){toast.error('Mark the purchase order sent before receiving stock.');return}const lines=po.items.filter(item=>item.qty>item.receivedQty).map(item=>({productId:item.productId,qty:item.qty-item.receivedQty,expiry:shiftDate(365)}));if(!lines.length){toast.error('Nothing remains to receive on this PO.');return}const supplier=s.suppliers.find(x=>x.id===po.supplierId);setPoReceiveId(id);setPoReceiveDate(today());setPoReceiveInvoice(po.number);setPoReceiveDue(shiftDate(supplier?.paymentTermsDays??30));setPoReceiveLines(lines)}
async function submitPurchaseOrderReceipt(){if(!poReceiveId)return;if(!canEdit('purchaseOrders')||!canEdit('batches')){toast.error('Your role cannot receive purchase orders into stock.');return}try{const next=applyPurchaseOrderReceipt(s,{purchaseOrderId:poReceiveId,received:poReceiveDate,invoice:poReceiveInvoice,dueDate:poReceiveDue||undefined,lines:poReceiveLines});const received=poReceiveLines.reduce((n,line)=>n+line.qty,0);if(await save(next)){setPoReceiveId(null);toast.success(received+' units received into inventory.')}}catch(e){toast.error(e instanceof Error?e.message:'Could not receive this purchase order.')}}
function openOwnerMoney(kind:'capital'|'drawing'){if(!canFinance){toast.error('Only the owner or an admin can post finance movements.');return}setOwnerMoneyKind(kind);setOwnerMoneyAmount('');setOwnerMoneyDate(today());setOwnerMoneyAccount('bank');setOwnerMoneyReference('');setOwnerMoneyOpen(true)}
async function submitOwnerMoney(){if(!canFinance){toast.error('Only the owner or an admin can post finance movements.');return}const amount=Number(ownerMoneyAmount);if(!Number.isFinite(amount)||amount<=0){toast.error('Enter an amount above zero.');return}if(ownerMoneyDate>today()){toast.error('Date cannot be in the future.');return}const opening=s.accountOpenings.find(a=>a.account===ownerMoneyAccount);if(!opening){toast.error('Configure the '+accountNames[ownerMoneyAccount]+' account first.');return}if(ownerMoneyDate<opening.date){toast.error('Date cannot be before the account opening date.');return}const next=structuredClone(s),id=uid();next.cashEntries.push({id,date:ownerMoneyDate,kind:ownerMoneyKind==='capital'?'in':'out',category:ownerMoneyKind==='capital'?'Owner Capital':'Owner Drawings',description:ownerMoneyReference.trim()||(ownerMoneyKind==='capital'?'Owner capital contribution':'Owner withdrawal'),amount});next.accountMatches.push({entryId:'manual-'+id,account:ownerMoneyAccount,matched:true,reference:ownerMoneyReference.trim()||(ownerMoneyKind==='capital'?'Owner capital':'Owner drawings')});if(await save(next)){setOwnerMoneyOpen(false);toast.success((ownerMoneyKind==='capital'?'Owner capital':'Owner drawing')+' posted and reconciled.')}}
function openPaymentDialog(kind:'collection'|'supplier',id:string,max:number,label:string){if(!canFinance){toast.error('Only the owner or an admin can post finance payments.');return}setPaymentDialog({kind,id,max,label});setPaymentAmount(String(Math.round(max)));setPaymentDate(today());setPaymentAccount(kind==='collection'?'bkash':'bank');setPaymentReference('')}
async function submitPayment(){
 if(!paymentDialog)return;if(!canFinance){toast.error('Only the owner or an admin can post finance payments.');return}const amount=Number(paymentAmount);
 if(!Number.isFinite(amount)||amount<=0||amount>paymentDialog.max+.001){toast.error('Enter an amount above zero and no more than '+taka(paymentDialog.max)+'.');return}
 if(!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)||paymentDate>today()){toast.error('Choose a valid payment date that is not in the future.');return}
 const opening=s.accountOpenings.find(a=>a.account===paymentAccount);if(!opening){toast.error('Configure the '+accountNames[paymentAccount]+' opening balance before posting payments to it.');return}
 if(paymentDate<opening.date){toast.error('Payment date cannot be before the '+accountNames[paymentAccount]+' opening date.');return}
 const next=structuredClone(s);
 if(paymentDialog.kind==='collection'){const target=next.orders.find(x=>x.id===paymentDialog.id);if(!target)return;const pid=uid();target.collections.push({id:pid,date:paymentDate,amount,reference:paymentReference.trim()});const due=receivable(target),received=target.collections.reduce((n,p)=>n+p.amount,0);target.settled=received>=due-.001;target.settledAt=target.settled?paymentDate:undefined;next.accountMatches.push({entryId:'order-collection-'+target.id+'-'+pid,account:paymentAccount,matched:true,reference:paymentReference.trim()||'Customer collection'});}
 else{const purchase=next.batches.find(x=>x.id===paymentDialog.id);if(!purchase)return;const pid=uid();purchase.payments.push({id:pid,date:paymentDate,amount,note:paymentReference.trim()});const paidTotal=purchase.payments.reduce((n,p)=>n+p.amount,0);purchase.paid=paidTotal>=purchase.qty*purchase.unitCost-.001;purchase.paidAt=purchase.paid?paymentDate:undefined;next.accountMatches.push({entryId:'batch-payment-'+purchase.id+'-'+pid,account:paymentAccount,matched:true,reference:paymentReference.trim()||'Supplier payment'});}
 if(await save(next)){setPaymentDialog(null);toast.success((paymentDialog.kind==='collection'?'Collection':'Supplier payment')+' posted to '+accountNames[paymentAccount]+' and reconciled.')}
}
function reverseCashEntry(id:string){
  if(!canEdit('cashEntries'))return;
  const entry=s.cashEntries.find(e=>e.id===id);if(!entry)return;
  if(entry.reversalOf||s.cashEntries.some(e=>e.reversalOf===id)){toast.error('This movement is already a reversal or has already been reversed.');return;}
  const reason=window.prompt('Reason for reversing this cash movement?','Correction of incorrectly recorded transaction.');
  if(!reason?.trim()){toast.error('A reversal reason is required.');return;}
  const next=structuredClone(s),rid=uid();next.cashEntries.push({id:rid,date:today(),kind:entry.kind==='in'?'out':'in',category:'Reversal · '+entry.category,description:'Reversal of '+entry.category+' · '+reason.trim(),amount:entry.amount,reversalOf:entry.id,reversalReason:reason.trim()});
  const originalMatch=s.accountMatches.find(m=>m.entryId==='manual-'+entry.id);if(originalMatch)next.accountMatches.push({entryId:'manual-'+rid,account:originalMatch.account,matched:true,reference:'Reversal · '+reason.trim()});
  void save(next);
}
function requestDeleteCategory(name:string){
  if(!canEdit('productCategories')){toast.error('Your role cannot delete categories.');return;}
  if(s.productCategories.length<=1){toast.error('Keep at least one category for your products.');return;}
  if(s.products.some(p=>p.category===name)){toast.error('Move products to another category before deleting this one.');return;}
  setConfirm({title:'Delete category?',text:`Remove ${name} from your category list? This cannot be undone.`,confirmLabel:'Delete',action:()=>{
    const next=structuredClone(s);next.productCategories=next.productCategories.filter(c=>c!==name);void save(next);
  }});
}
function requestDelete(kind:'products'|'customers'|'suppliers',id:string,name:string){
  if(!canEdit(kind)){toast.error('Your role cannot delete this record.');return;}
  if(kind==='products'&&(s.batches.some(b=>b.productId===id)||s.orders.some(o=>o.items.some(i=>i.productId===id))||s.purchaseOrders.some(po=>po.items.some(i=>i.productId===id)))){toast.error('This product has stock or order history. Keep it inactive to preserve those records.');return;}
  if(kind==='customers'&&(s.orders.some(o=>o.customerId===id)||s.tasks.some(t=>t.customerId===id))){toast.error('This customer has orders or follow-ups. Keep the record to preserve that history.');return;}
  if(kind==='suppliers'&&(s.batches.some(b=>b.supplierId===id)||s.purchaseOrders.some(po=>po.supplierId===id))){toast.error('This supplier is linked to purchase or receiving history. Keep the record to preserve that audit trail.');return;}
  const label=kind==='products'?'product':kind==='customers'?'customer':'supplier';
  setConfirm({title:`Delete ${label}?`,text:`Remove ${name} permanently from this workspace? This cannot be undone.`,confirmLabel:'Delete',action:()=>{
    const next=structuredClone(s);
    if(kind==='products')next.products=next.products.filter(p=>p.id!==id);
    if(kind==='customers')next.customers=next.customers.filter(c=>c.id!==id);
    if(kind==='suppliers')next.suppliers=next.suppliers.filter(p=>p.id!==id);
    void save(next).then(ok=>{if(ok)setDetail(null)});
  }});
}
async function updateOrder(o:Order,patch:Partial<Order>){if(!canEdit('orders')&&!canInspectReturns){toast.error('Your role cannot update orders.');return}const next=structuredClone(s);next.orders=next.orders.map(x=>x.id===o.id?{...x,...patch}:x);await save(next)}
async function releaseInventoryHold(id:string){if(!canInspectReturns||!canEdit('inventoryHolds')){toast.error('Your role cannot inspect held stock.');return}const next=structuredClone(s);const hold=next.inventoryHolds.find(h=>h.id===id);if(!hold||hold.releasedAt)return;hold.releasedAt=today();await save(next)}
async function markInventoryHoldDamaged(id:string){if(!canInspectReturns||!canEdit('inventoryHolds')){toast.error('Your role cannot inspect held stock.');return}const next=structuredClone(s);const hold=next.inventoryHolds.find(h=>h.id===id);if(!hold||hold.releasedAt)return;hold.type='Damaged';hold.reason=hold.source==='Cancelled'?'Cancelled stock inspected as damaged':hold.source==='Return'?'Returned stock inspected as damaged':hold.reason;await save(next)}
async function releaseCancelledInspection(orderId:string){if(!canInspectReturns||!canEdit('inventoryHolds')){toast.error('Your role cannot inspect cancelled stock.');return}const next=structuredClone(s);const holds=next.inventoryHolds.filter(h=>h.source==='Cancelled'&&h.sourceOrderId===orderId&&!h.releasedAt&&h.type==='Quarantine');if(!holds.length)return;holds.forEach(h=>{h.releasedAt=today();h.reason='Cancelled stock inspected and cleared for sale'});await save(next)}
async function markCancelledInspectionDamaged(orderId:string){if(!canInspectReturns||!canEdit('inventoryHolds')){toast.error('Your role cannot inspect cancelled stock.');return}const next=structuredClone(s);const holds=next.inventoryHolds.filter(h=>h.source==='Cancelled'&&h.sourceOrderId===orderId&&!h.releasedAt&&h.type==='Quarantine');if(!holds.length)return;holds.forEach(h=>{h.type='Damaged';h.reason='Cancelled stock inspected as damaged'});await save(next)}
async function inspectReturnedOrder(o:Order,outcome:'Sellable'|'Quarantine'|'Damaged'){
  if(!canInspectReturns){toast.error('Your role cannot complete return inspection.');return}
  const next=structuredClone(s),order=next.orders.find(x=>x.id===o.id);
  if(!order||order.status!=='Returned'||order.restocked)return;
  order.restocked=true;
  if(outcome!=='Sellable'){
    const byBatch=new Map<string,number>();
    for(const allocation of order.items.flatMap(i=>i.allocations))byBatch.set(allocation.batchId,(byBatch.get(allocation.batchId)||0)+allocation.qty);
    for(const [batchId,qty] of byBatch){
      const batch=next.batches.find(b=>b.id===batchId);
      if(!batch||batch.expiry<=today())continue;
      if(batchRemaining(next,batch)<qty){toast.error('Returned stock cannot be held safely because the batch no longer has enough available units. Refresh and try again.');return}
      next.inventoryHolds.push({id:uid(),batchId,qty,date:today(),type:outcome,reason:outcome==='Damaged'?'Returned stock inspected as damaged':'Returned stock needs further inspection',source:'Return',sourceOrderId:order.id});
    }
  }
  await save(next);
}
function changeStatus(o:Order,status:Order['status']){if(!canEdit('orders')){toast.error('Your role cannot update order status.');return}if(!nextStatuses(o).includes(status))return;if(status==='Cancelled'){setConfirm({title:'Cancel '+o.number+'?',text:'Reserved products will move into Quarantine for Inventory inspection before they can be sold again. The order stays in your history.',action:()=>{void updateOrder(o,{status})}});return;}if(status==='Returned'){setConfirm({title:'Record return for '+o.number+'?',text:o.status==='Delivered'?'This marks the delivered order as returned. Review refund handling separately in Finance and inspect the products in Inventory → Holds & returns.':'This marks the delivery as returned. The products stay blocked until Inventory completes inspection.',action:()=>{void updateOrder(o,{status,returnedAt:today(),restocked:false})}});return;}void updateOrder(o,{status,...(status==='Delivered'?{delivered:today()}: {})})}
function exportData(){if(!canExport){toast.error('Only the owner or an admin can export business data.');return}const safe=(v:unknown)=>{let t=String(v??'');if(/^[=+@-]/.test(t))t="'"+t;return '"'+t.replaceAll('"','""')+'"'};const rows=[['Order','Date','Customer','Channel','Status','Payment','Product revenue','Customer total','Product cost','Courier','Payment fee','Packaging','Settled']];for(const o of s.orders)rows.push([o.number,o.created,s.customers.find(c=>c.id===o.customerId)?.name||'',o.channel,o.status,o.payment,String(subtotal(o)),String(total(o)),String(o.items.flatMap(i=>i.allocations).reduce((n,a)=>n+a.qty*a.unitCost,0)),String(o.courierCost),String(o.paymentFee),String(o.packaging),o.settled?'Yes':'No']);const blob=new Blob(['\ufeff'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='aloyri-orders-'+today()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast.success('Order report downloaded')}
const chart=Array.from({length:Number(range)},(_,i)=>{const date=shiftDate(i-Number(range)+1);return {date:dateLabel(date),sales:s.orders.filter(o=>o.status==='Delivered'&&o.delivered===date).reduce((n,o)=>n+subtotal(o),0)}});const periodSales=chart.reduce((n,d)=>n+d.sales,0);
const match=(...values:unknown[])=>values.join(' ').toLowerCase().includes(deferredQuery.toLowerCase());
const globalNeedle=deferredGlobalQuery.trim().toLowerCase();
const globalScore=(needle:string,...values:unknown[])=>{const text=values.filter(Boolean).join(' ').toLowerCase(),primary=String(values[0]||'').toLowerCase();if(!text.includes(needle))return -1;if(primary===needle)return 100;if(primary.startsWith(needle))return 80;if(text.split(/\s+/).some(part=>part.startsWith(needle)))return 60;return 40};
const globalResults=useMemo<GlobalResult[]>(()=>{
  if(!globalNeedle)return [];
  const results:GlobalResult[]=[];
  if(visibleSections(role).includes('Orders'))for(const o of s.orders){
    const customer=customerById.get(o.customerId);
    if([o.number,o.tracking,o.channel,o.payment,o.status,customer?.name,customer?.phone].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'order-'+o.id,view:'Orders',title:'#'+o.number,meta:(customer?.name||'Customer')+' · '+o.status,query:o.number,score:globalScore(globalNeedle,o.number,customer?.name,customer?.phone,o.tracking,o.channel,o.payment,o.status),detail:{type:'order',id:o.id}});
  }
  if(visibleSections(role).includes('Customers'))for(const x of s.customers)
    if([x.name,x.phone,x.city,x.preference,x.notes].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'customer-'+x.id,view:'Customers',title:x.name,meta:(x.phone||'No phone')+(x.city?' · '+x.city:''),query:x.name,score:globalScore(globalNeedle,x.name,x.phone,x.city,x.preference,x.notes),detail:{type:'customer',id:x.id}});
  if(visibleSections(role).includes('Inventory')){
    for(const x of s.products)if([x.name,x.brand,x.category,x.size,x.id].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'product-'+x.id,view:'Inventory',title:x.brand+' '+x.name,meta:x.category+' · '+stock(s,x.id)+' available',query:x.name,score:globalScore(globalNeedle,x.name,x.brand,x.category,x.size,x.id)});
    for(const b of s.batches){
      const product=productById.get(b.productId),supplier=supplierById.get(b.supplierId);
      if([b.invoice,b.received,b.expiry,product?.name,product?.brand,supplier?.name].join(' ').toLowerCase().includes(globalNeedle))
        results.push({id:'batch-'+b.id,view:'Inventory',title:b.invoice||product?.name||'Inventory batch',meta:(product?.name||'Product')+' · expires '+dateLabel(b.expiry),query:b.invoice||product?.name||'',score:globalScore(globalNeedle,b.invoice,product?.name,product?.brand,supplier?.name,b.received,b.expiry)});
    }
  }
  if(visibleSections(role).includes('Suppliers')){
    for(const x of s.suppliers)if([x.name,x.contact,x.phone,x.email,x.address,x.notes].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'supplier-'+x.id,view:'Suppliers',title:x.name,meta:x.contact||x.phone||'Supplier',query:x.name,score:globalScore(globalNeedle,x.name,x.contact,x.phone,x.email,x.address,x.notes),detail:{type:'supplier',id:x.id}});
    for(const x of s.purchaseOrders)if([x.number,x.status,x.notes,supplierById.get(x.supplierId)?.name].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'po-'+x.id,view:'Suppliers',title:x.number,meta:'Purchase order · '+x.status,query:x.number,score:globalScore(globalNeedle,x.number,supplierById.get(x.supplierId)?.name,x.status,x.notes)});
  }
  if(visibleSections(role).includes('Follow-ups'))for(const x of s.tasks)
    if([x.title,x.kind,x.priority,x.notes,customerById.get(x.customerId)?.name].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'task-'+x.id,view:'Follow-ups',title:x.title,meta:x.kind+' · '+dateLabel(x.due),query:x.title,score:globalScore(globalNeedle,x.title,customerById.get(x.customerId)?.name,x.kind,x.priority,x.notes)});
  if(visibleSections(role).includes('Finances')){
    for(const x of s.expenses)if([x.category,x.vendor,x.reference,x.notes,x.date].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'expense-'+x.id,view:'Finances',title:x.vendor||x.category,meta:'Expense · '+taka(x.amount)+' · '+dateLabel(x.date),query:x.vendor||x.category,score:globalScore(globalNeedle,x.vendor,x.category,x.reference,x.notes,x.date)});
    for(const x of s.cashEntries)if([x.category,x.description,x.date,x.kind].join(' ').toLowerCase().includes(globalNeedle))
      results.push({id:'cash-'+x.id,view:'Finances',title:x.description||x.category,meta:(x.kind==='in'?'Cash in':'Cash out')+' · '+taka(x.amount),query:x.description||x.category,score:globalScore(globalNeedle,x.description,x.category,x.date,x.kind)});
  }
  return results.sort((a,b)=>b.score-a.score||a.view.localeCompare(b.view)||a.title.localeCompare(b.title)).slice(0,18);
},[globalNeedle,role,s]);
useEffect(()=>{const onKey=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();globalSearchRef.current?.focus();globalSearchRef.current?.select();}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
const globalGroups=useMemo(()=>sections.map(section=>({section,items:globalResults.filter(result=>result.view===section)})).filter(group=>group.items.length),[globalResults]);
function onGlobalSearchKeyDown(event:React.KeyboardEvent<HTMLInputElement>){
  if(!globalQuery)return;
  if(event.key==='ArrowDown'){event.preventDefault();setGlobalActiveIndex(index=>Math.min(globalResults.length-1,index+1))}
  else if(event.key==='ArrowUp'){event.preventDefault();setGlobalActiveIndex(index=>Math.max(0,index-1))}
  else if(event.key==='Enter'&&globalResults[globalActiveIndex]){event.preventDefault();openGlobalResult(globalResults[globalActiveIndex])}
  else if(event.key==='Escape'){event.preventDefault();setGlobalQuery('')}
}
function openGlobalResult(result:GlobalResult){
  setGlobalQuery('');changeView(result.view);setQuery(result.query);
  if(result.view==='Suppliers'&&result.id.startsWith('po-'))setPurchasingTab('Purchase orders');
  if(result.view==='Inventory'&&result.id.startsWith('batch-'))setInventoryTab('Batches');
  if(result.view==='Finances'&&result.id.startsWith('expense-'))setFinanceTab('Expenses');
  if(result.view==='Finances'&&result.id.startsWith('cash-'))setFinanceTab('Cashflow');
  if(result.detail)setDetail(result.detail);
}
const supplierInsights=useMemo(()=>s.suppliers.map((supplier,index)=>({supplier,index,...supplierInsight(s,supplier.id)})),[s]);
const purchasingOpen=s.purchaseOrders.filter(po=>!['Received','Cancelled'].includes(po.status));
const purchasingOverdue=purchasingOpen.filter(po=>['Sent','Part received'].includes(po.status)&&po.expected<today());
const purchasingIncomingUnits=purchasingOpen.reduce((n,po)=>n+purchaseOrderOutstandingUnits(po),0);
const purchasingOpenValue=purchasingOpen.reduce((n,po)=>n+purchaseOrderValue(po),0);
const purchasingPayable=supplierInsights.reduce((n,x)=>n+x.payable,0);
const verifiedSupplierCount=s.suppliers.filter(x=>x.verified).length;
const purchaseOrderRows=useMemo(()=>s.purchaseOrders.filter(po=>{
  const supplier=supplierById.get(po.supplierId),products=po.items.map(i=>productById.get(i.productId)?.name||'');
  const overdue=['Sent','Part received'].includes(po.status)&&po.expected<today();
  const filterMatch=filter==='All'||filter===po.status||filter==='Overdue'&&overdue;
  return filterMatch&&match(po.number,supplier?.name,supplier?.contact,supplier?.phone,po.status,po.notes,...products);
}).sort((a,b)=>{
  const aOver=['Sent','Part received'].includes(a.status)&&a.expected<today(),bOver=['Sent','Part received'].includes(b.status)&&b.expected<today();
  return Number(bOver)-Number(aOver)||a.expected.localeCompare(b.expected)||b.created.localeCompare(a.created);
}),[s.purchaseOrders,supplierById,productById,filter,deferredQuery]);
const supplierRows=useMemo(()=>supplierInsights.filter(x=>match(x.supplier.name,x.supplier.contact,x.supplier.phone,x.supplier.email,x.supplier.address,x.supplier.notes)).sort((a,b)=>b.activePurchaseOrders.length-a.activePurchaseOrders.length||a.supplier.name.localeCompare(b.supplier.name)),[supplierInsights,deferredQuery]);
const inventoryHealthRank:Record<string,number>={Out:0,Critical:1,Low:2,Healthy:3,Inactive:4};
const inventoryProductRows=useMemo(()=>s.products.map(product=>{
  const position=stockPosition(s,product.id);
  const available=position.available;
  const criticalAt=product.reorderAt>0?Math.max(1,Math.ceil(product.reorderAt/2)):0;
  const health=!product.active?'Inactive':available===0?'Out':criticalAt&&available<=criticalAt?'Critical':available<=product.reorderAt?'Low':'Healthy';
  const incomingOrders=openPurchaseOrders.map(po=>({po,remaining:po.items.filter(i=>i.productId===product.id).reduce((n,i)=>n+Math.max(0,i.qty-i.receivedQty),0)})).filter(x=>x.remaining>0).sort((a,b)=>a.po.expected.localeCompare(b.po.expected));
  const incoming=incomingOrders.reduce((n,x)=>n+x.remaining,0);
  const incomingExpected=incomingOrders[0]?.po.expected;
  const liveBatches=s.batches.filter(b=>b.productId===product.id&&b.expiry>today()&&batchRemaining(s,b)>0).sort((a,b)=>a.expiry.localeCompare(b.expiry));
  const earliestExpiry=liveBatches[0]?.expiry;
  const stockValue=liveBatches.reduce((n,b)=>n+Math.max(0,batchRemaining(s,b))*b.unitCost,0);
  const movement30=inventoryVelocity.find(x=>x.product.id===product.id)?.units||0;
  return {product,available,physical:position.physical,reserved:position.reserved,returnedPending:position.returnedPending,blocked:position.blocked,health,incoming,incomingExpected,earliestExpiry,stockValue,movement30};
}),[s,openPurchaseOrders,inventoryVelocity]);
const visibleInventoryProducts=useMemo(()=>inventoryProductRows.filter(row=>match(row.product.name,row.product.brand,row.product.size,row.product.category,row.product.id,row.health)).filter(row=>
  filter==='All'||
  filter==='Low stock'&&['Low','Critical'].includes(row.health)||
  filter==='Critical'&&row.health==='Critical'||
  filter==='Out of stock'&&row.health==='Out'||
  filter==='Healthy'&&row.health==='Healthy'||
  filter==='Inactive'&&row.health==='Inactive'||
  filter==='Reserved'&&row.reserved>0||
  filter==='Return inspection'&&row.returnedPending>0||
  filter==='Blocked'&&row.blocked>0||
  filter==='No movement · 30d'&&row.available>0&&row.movement30===0||
  row.product.category===filter
).sort((a,b)=>{
  if(inventorySort==='Available ↑')return a.available-b.available||a.product.name.localeCompare(b.product.name);
  if(inventorySort==='Available ↓')return b.available-a.available||a.product.name.localeCompare(b.product.name);
  if(inventorySort==='Expiry soonest')return (a.earliestExpiry||'9999-12-31').localeCompare(b.earliestExpiry||'9999-12-31')||a.product.name.localeCompare(b.product.name);
  if(inventorySort==='30d movement')return b.movement30-a.movement30||a.product.name.localeCompare(b.product.name);
  if(inventorySort==='Stock value')return b.stockValue-a.stockValue||a.product.name.localeCompare(b.product.name);
  if(inventorySort==='Name A–Z')return a.product.name.localeCompare(b.product.name);
  return inventoryHealthRank[a.health]-inventoryHealthRank[b.health]||a.available-b.available||a.product.name.localeCompare(b.product.name);
}),[inventoryProductRows,deferredQuery,filter,inventorySort]);
const todayOrders=s.orders.filter(o=>o.created===today()),todayOrderValue=todayOrders.reduce((n,o)=>n+total(o),0),readyToPackOrders=s.orders.filter(o=>o.status==='Ready to pack').length,outForDeliveryOrders=s.orders.filter(o=>o.status==='Out for delivery').length,openOrderCount=s.orders.filter(o=>!['Delivered','Returned','Cancelled'].includes(o.status)).length,pendingCollectionOrders=s.orders.filter(o=>isCollectible(o)&&orderBalance(o)>.001).length,outstandingOrderValue=s.orders.reduce((n,o)=>n+orderBalance(o),0),returnRate=m.delivered?Math.round(s.orders.filter(o=>o.status==='Returned').length/(m.delivered+s.orders.filter(o=>o.status==='Returned').length)*100):0;
const orderStageSequence=[...statuses] as readonly Order['status'][];
const orderQueueSort=(a:Order,b:Order)=>{const stage=orderStageSequence.indexOf(a.status)-orderStageSequence.indexOf(b.status);if(stage)return stage;const terminal=['Delivered','Returned','Cancelled'].includes(a.status);return terminal?b.created.localeCompare(a.created)||b.number.localeCompare(a.number):a.created.localeCompare(b.created)||a.number.localeCompare(b.number)};
const filteredOrders=useMemo(()=>s.orders.filter(o=>filter==='All'||o.status===filter).filter(o=>{const customer=customerById.get(o.customerId);return match(o.number,customer?.name,customer?.phone,customer?.city,o.channel,o.tracking,o.payment,orderPaymentStatus(o))}).sort(orderQueueSort),[s.orders,customerById,filter,deferredQuery]);
const filteredCustomers=useMemo(()=>s.customers.filter(c=>match(c.name,c.phone,c.city,c.preference,c.notes)),[s.customers,deferredQuery]);
async function bulkAdvanceSelectedOrders(){if(!canEdit('orders')||!selectedOrderIds.length)return;const next=structuredClone(s);let changed=0;for(const id of selectedOrderIds){const order=next.orders.find(o=>o.id===id);if(!order)continue;const status=nextStatuses(order).find(x=>!['Cancelled','Returned'].includes(x));if(!status)continue;order.status=status;if(status==='Delivered')order.delivered=today();changed++;}if(!changed){toast.error('None of the selected orders has a safe next step.');return}setConfirm({title:'Advance '+changed+' selected orders?',text:'Each eligible order will move forward by exactly one valid fulfillment step. Cancel and return actions are never applied in bulk.',confirmLabel:'Advance orders',action:()=>{void save(next).then(ok=>{if(ok)setSelectedOrderIds([])})}});}
async function bulkCreateCustomerFollowUps(){if(!canEdit('tasks')||!selectedCustomerIds.length)return;const next=structuredClone(s);let created=0;for(const id of selectedCustomerIds){const customer=next.customers.find(c=>c.id===id);if(!customer||next.tasks.some(t=>t.customerId===id&&!t.done))continue;next.tasks.push({id:uid(),customerId:id,orderId:'',title:'Customer follow-up · '+customer.name,due:shiftDate(7),done:false,kind:'Follow-up',priority:'Normal',channel:'WhatsApp',notes:'Created from bulk customer action.',completedAt:''});created++;}if(!created){toast.error('Every selected customer already has an open follow-up.');return}if(await save(next)){setSelectedCustomerIds([]);toast.success(created+' follow-ups created.');}}
async function bulkSendPurchaseOrders(){if(!canEdit('purchaseOrders')||!selectedPurchaseOrderIds.length)return;const next=structuredClone(s);const eligible=next.purchaseOrders.filter(po=>selectedPurchaseOrderIds.includes(po.id)&&po.status==='Draft');if(!eligible.length){toast.error('Only draft purchase orders can be marked sent in bulk.');return}setConfirm({title:'Mark '+eligible.length+' purchase orders sent?',text:'Only selected Draft purchase orders will move to Sent. Receiving and cancellation still require individual review.',confirmLabel:'Mark sent',action:()=>{eligible.forEach(po=>{po.status='Sent'});void save(next).then(ok=>{if(ok)setSelectedPurchaseOrderIds([])})}})}
async function bulkCompleteFollowUps(){if(!canEdit('tasks')||!selectedTaskIds.length)return;const next=structuredClone(s);const eligible=next.tasks.filter(task=>selectedTaskIds.includes(task.id)&&!task.done);if(!eligible.length){toast.error('The selected follow-ups are already completed.');return}setConfirm({title:'Complete '+eligible.length+' follow-ups?',text:'Selected open reminders will be marked complete today. No customer message will be sent.',confirmLabel:'Complete follow-ups',action:()=>{eligible.forEach(task=>{task.done=true;task.completedAt=today()});void save(next).then(ok=>{if(ok)setSelectedTaskIds([])})}})}
const order=s.orders.find(o=>detail?.type==='order'&&o.id===detail.id);const customer=s.customers.find(c=>detail?.type==='customer'&&c.id===detail.id);const supplier=s.suppliers.find(x=>detail?.type==='supplier'&&x.id===detail.id);const supplierDetail=supplier?supplierInsight(s,supplier.id):null;const receivingPurchaseOrder=s.purchaseOrders.find(po=>po.id===poReceiveId);
function orderTable(list:Order[]){if(!list.length)return <Empty title={query||filter!=='All'?"No matching orders":"No orders yet"} text={query||filter!=='All'?"Clear the search or choose another status to see more orders.":"Add a customer and receive stock to create your first order."} action={query||filter!=='All'?<button className="btn secondary" onClick={()=>{setQuery('');setFilter('All')}}>Clear filters</button>:undefined}/>;
const nextActionLabel=(status:Order['status'])=>({Confirmed:'Confirm','Ready to pack':'Ready to pack',Packed:'Mark packed',Shipped:'Mark shipped','Out for delivery':'Out for delivery',Delivered:'Mark delivered'} as Partial<Record<Order['status'],string>>)[status]||status;
return <><div className="orders-desktop-table"><Table><TableHeader><TableRow>{canEdit('orders')&&<TableHead className="bulk-check-cell"><Checkbox aria-label="Select all shown orders" checked={list.length>0&&list.every(x=>selectedOrderIds.includes(x.id))} onCheckedChange={checked=>setSelectedOrderIds(checked===true?Array.from(new Set([...selectedOrderIds,...list.map(x=>x.id)])):selectedOrderIds.filter(id=>!list.some(x=>x.id===id)))}/></TableHead>}<TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Fulfillment</TableHead><TableHead>Payment</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead><span className="sr-only">Actions</span></TableHead></TableRow></TableHeader><TableBody>{list.map(o=>{const customer=s.customers.find(c=>c.id===o.customerId),balance=orderBalance(o),paymentStatus=orderPaymentStatus(o),units=o.items.reduce((n,i)=>n+i.qty,0),primaryNext=nextStatuses(o).find(status=>!['Cancelled','Returned'].includes(status));return <TableRow key={o.id} className="order-queue-row">{canEdit('orders')&&<TableCell className="bulk-check-cell"><Checkbox aria-label={'Select order '+o.number} checked={selectedOrderIds.includes(o.id)} onCheckedChange={checked=>setSelectedOrderIds(checked===true?[...selectedOrderIds.filter(id=>id!==o.id),o.id]:selectedOrderIds.filter(id=>id!==o.id))}/></TableCell>}<TableCell><button className="order-link" onClick={()=>setDetail({type:'order',id:o.id})}>#{o.number}</button><small className="cell-sub">{dateLabel(o.created)} · {o.channel}</small></TableCell><TableCell><button className="customer-cell order-customer-link" onClick={()=>setDetail({type:'order',id:o.id})}><Avatar name={customer?.name||'Customer'} index={s.customers.indexOf(customer!)}/><span><strong>{customer?.name||'Unknown customer'}</strong><small className="cell-sub">{customer?.phone||customer?.city||'No contact'}</small></span></button></TableCell><TableCell><div className="order-fulfillment-cell"><strong>{units} {units===1?'unit':'units'}</strong><small>{o.items.length} {o.items.length===1?'product':'products'}{o.tracking?' · '+o.tracking:' · Tracking not added'}</small></div></TableCell><TableCell>{salesMode?<><span className="channel">{o.payment}</span><small className="cell-sub">Collections managed by owner/admin</small></>:<><span className={'payment-state '+paymentStatus.toLowerCase().replaceAll(' ','-')}>{paymentStatus}</span><small className="cell-sub">{o.payment}{balance>.001?' · '+taka(balance)+' due':''}</small></>}</TableCell><TableCell className="numeric order-total-cell">{taka(total(o))}</TableCell><TableCell><Status value={o.status}/></TableCell><TableCell><div className="order-row-actions">{canEdit('orders')&&primaryNext&&<button className="order-next-button" disabled={busy} onClick={()=>changeStatus(o,primaryNext)}>{nextActionLabel(primaryNext)}<ArrowRight size={14}/></button>}{canPrint&&<button className="icon-button" aria-label={'Invoice '+o.number} title="View invoice" onClick={()=>setInvoiceId(o.id)}><Receipt size={17}/></button>}<button className="icon-button" aria-label={'Open '+o.number} title="Open order details" onClick={()=>setDetail({type:'order',id:o.id})}><ChevronRight size={18}/></button></div></TableCell></TableRow>})}</TableBody></Table></div><div className="orders-mobile-list">{list.map(o=>{const customer=s.customers.find(c=>c.id===o.customerId),balance=orderBalance(o),paymentStatus=orderPaymentStatus(o),units=o.items.reduce((n,i)=>n+i.qty,0),primaryNext=nextStatuses(o).find(status=>!['Cancelled','Returned'].includes(status));return <article className="order-mobile-card" key={o.id}><button className="order-mobile-main" onClick={()=>setDetail({type:'order',id:o.id})}><div className="order-mobile-top"><span><strong>#{o.number}</strong><small>{dateLabel(o.created)} · {o.channel}</small></span><Status value={o.status}/></div><div className="order-mobile-customer"><Avatar name={customer?.name||'Customer'} index={s.customers.indexOf(customer!)}/><span><strong>{customer?.name||'Unknown customer'}</strong><small>{customer?.phone||customer?.city||'No contact'}</small></span><b>{taka(total(o))}</b></div><div className="order-mobile-meta"><span><Package size={14}/>{units} {units===1?'unit':'units'}</span><span><Truck size={14}/>{o.tracking||'No tracking'}</span>{salesMode?<span className="channel">{o.payment}</span>:<span className={'payment-state '+paymentStatus.toLowerCase().replaceAll(' ','-')}>{paymentStatus}</span>}</div>{!salesMode&&balance>.001&&<div className="order-mobile-due">{taka(balance)} outstanding · {o.payment}</div>}</button><div className="order-mobile-actions">{canEdit('orders')&&<label className="mobile-select-control"><Checkbox aria-label={'Select order '+o.number} checked={selectedOrderIds.includes(o.id)} onCheckedChange={checked=>setSelectedOrderIds(checked===true?[...selectedOrderIds.filter(id=>id!==o.id),o.id]:selectedOrderIds.filter(id=>id!==o.id))}/><span>Select</span></label>}{canEdit('orders')&&primaryNext&&<button className="btn primary" disabled={busy} onClick={()=>changeStatus(o,primaryNext)}>{nextActionLabel(primaryNext)}<ArrowRight size={14}/></button>}{canPrint&&<button className="btn secondary" onClick={()=>setInvoiceId(o.id)}><Receipt size={15}/>Invoice</button>}<button className="btn secondary" onClick={()=>setDetail({type:'order',id:o.id})}>Details<ChevronRight size={15}/></button></div></article>})}</div></>}

return <SidebarProvider style={{'--sidebar-width':'clamp(196px, 20vw, 240px)'} as React.CSSProperties}><Toaster position="bottom-right" theme="light" richColors/><Nav view={view} onView={changeView} openOrders={m.open} memberName={memberName} role={role} onSettings={()=>openModal({type:'settings'})} onPassword={()=>setPasswordOpen(true)} onLogout={async()=>{await fetch('/api/auth/logout',{method:'POST'});window.location.assign('/login')}}/><main className="main-shell"><header className="topbar"><div className="breadcrumb"><SidebarTrigger className="mobile-trigger"/><span>Workspace</span><ChevronRight size={14}/><strong>{view}</strong></div><div className="top-actions"><div className="global-search-shell"><div className="global-search-input"><Search size={16}/><Input ref={globalSearchRef} role="combobox" aria-label="Search the CRM" aria-expanded={Boolean(globalQuery)} aria-controls="global-search-results" aria-autocomplete="list" value={globalQuery} onChange={e=>{setGlobalQuery(e.target.value);setGlobalActiveIndex(0)}} onKeyDown={onGlobalSearchKeyDown} placeholder="Search CRM…"/>{globalQuery?<button aria-label="Clear global search" onClick={()=>{setGlobalQuery('');globalSearchRef.current?.focus()}}><X size={14}/></button>:<kbd>⌘K</kbd>}</div>{globalQuery&&<div className="global-search-results" id="global-search-results" role="listbox">{globalResults.length?<><div className="global-search-summary"><strong>{globalResults.length} result{globalResults.length===1?'':'s'}</strong><span>↑↓ navigate · Enter open · Esc close</span></div>{globalGroups.map(group=><div className="global-search-group" key={group.section}><div className="global-search-group-label">{group.section}</div>{group.items.map(result=>{const resultIndex=globalResults.findIndex(item=>item.id===result.id);return <button key={result.id} role="option" aria-selected={globalActiveIndex===resultIndex} className={globalActiveIndex===resultIndex?'active':''} onMouseEnter={()=>setGlobalActiveIndex(resultIndex)} onClick={()=>openGlobalResult(result)}><span><strong>{result.title}</strong><small>{result.meta}</small></span><ChevronRight size={15}/></button>})}</div>)}</>:<div className="global-search-empty"><Search size={18}/><strong>No matching records</strong><span>Try an order number, customer, product, supplier, phone or reference.</span></div>}</div>}</div><span className="date-chip">{new Date().toLocaleDateString('en-GB',{timeZone:'Asia/Dhaka',day:'numeric',month:'short',year:'numeric'})}</span><button className="notification-button" aria-label={'Open alert center · '+roleAlerts.length+' open'} onClick={()=>changeView('Alerts')}><Bell size={19}/>{roleAlerts.length>0&&<span className="notification-count">{roleAlerts.length>99?'99+':roleAlerts.length}</span>}</button><Avatar name={memberName}/></div></header><nav className="mobile-section-nav" aria-label="CRM sections">{sections.filter(v=>visibleSections(role).includes(v)).map(v=>{const Icon=navIcons[sections.indexOf(v)];return <button type="button" key={v} aria-current={view===v?'page':undefined} onClick={()=>changeView(v)}><Icon size={17} strokeWidth={1.8}/><span>{v}</span></button>})}</nav><div className="mode-banner live"><div><ShieldCheck size={16}/><strong>{(role==='owner'||role==='admin')?'Shared business workspace':'Team workspace'}</strong><span>{busy?'Saving…':role==='viewer'?'View only · records stay with the business':loaded?'Your role controls the sections you can manage.':'Opening your saved business records.'}</span></div><div className="mode-actions">{loaded&&canImport&&<a href="/import" className="text-button">Import records</a>}{loaded&&canTeam&&<button onClick={()=>setTeamOpen(true)}><Users size={15}/>Manage staff</button>}</div></div><div className="page-content"><div className="page-heading"><div><div className="eyebrow">{view==='Overview'?'BUSINESS OVERVIEW':view.toUpperCase()}</div><h1>{titles[view]}</h1><p>{descriptions[view]}</p></div><div className="heading-actions">{view==='Overview'&&<>{canExport&&<button className="btn secondary export-button" onClick={exportData}><Download size={16}/>Export</button>}{canEdit('orders')&&<button className="btn primary" onClick={()=>openModal({type:'order'})}><Plus size={17}/>New order</button>}</>}{view==='Orders'&&canExport&&<button className="btn secondary export-button" onClick={exportData}><Download size={16}/>Export</button>}{view==='Customers'&&canEdit('customers')&&<button className="btn primary" onClick={()=>openModal({type:'customer'})}><Plus size={17}/>Add customer</button>}</div></div>
{error&&<div className="error-banner" role="alert"><AlertTriangle size={18}/><span>{error}</span>{authRequired?<a href="/login" target="_top" className="text-button">Sign in</a>:<button className="text-button" onClick={()=>loadLive()}>Refresh records</button>}</div>}
{!loaded?<section className="panel loading-panel">{busy?<><Skeleton className="h-8 w-60"/><Skeleton className="h-28 w-full"/></>:<Empty title="Start your workspace" text="Add stock, customers and orders to populate your dashboard." action={authRequired?<a className="btn primary" href="/login" target="_top">Sign in</a>:<button className="btn primary" onClick={()=>loadLive()}>Load saved records</button>}/>}</section>:<>
{view==='Activity'&&<ActivitySection
  auditEvents={auditEvents}
  filteredAuditEvents={filteredAuditEvents}
  auditActorCount={auditActorCount}
  auditLatest={auditLatest}
  auditQuery={auditQuery}
  auditRole={auditRole}
  auditSection={auditSection}
  auditRoles={auditRoles}
  auditSections={auditSections}
  auditHasMore={auditHasMore}
  auditLoading={auditLoading}
  setAuditQuery={setAuditQuery}
  setAuditRole={setAuditRole}
  setAuditSection={setAuditSection}
  loadAudit={loadAudit}
  auditDate={auditDate}
  auditTime={auditTime}
  auditRelative={auditRelative}
/>}
{view==='Alerts'&&<AlertsSection
  roleAlerts={roleAlerts}
  shownAlerts={shownAlerts}
  alertFocus={alertFocus}
  alertCritical={alertCritical}
  alertAction={alertAction}
  alertUpcoming={alertUpcoming}
  alertFilter={alertFilter}
  setAlertFilter={setAlertFilter}
  openAlert={openAlert}
  alertActionLabel={alertActionLabel}
/>}
{view==='Automation'&&<AutomationSection
  settings={s.automationSettings}
  busy={busy}
  automationActiveRules={automationActiveRules}
  automationCritical={automationCritical}
  automationAction={automationAction}
  automationUpcoming={automationUpcoming}
  automationLive={automationLive}
  automationRuleNames={automationRuleNames}
  updateAutomationRule={updateAutomationRule}
  changeView={changeView}
  setFinanceTab={setFinanceTab}
/>}
{view==='Overview'&&<OverviewSection
  alertCritical={alertCritical}
  alertAction={alertAction}
  alertUpcoming={alertUpcoming}
  todayOrderCount={todayOrders.length}
  todayOrderValue={todayOrderValue}
  openOrderCount={openOrderCount}
  readyToPackOrders={readyToPackOrders}
  outForDeliveryOrders={outForDeliveryOrders}
  pendingCollections={m.pending}
  pendingCollectionOrders={pendingCollectionOrders}
  inventoryOutCount={inventoryOut.length}
  inventoryLowCount={inventoryLow.length}
  attention={attention}
  purchasingOverdueCount={purchasingOverdue.length}
  followUpOverdueCount={followUpOverdue.length}
  followUpTodayCount={followUpToday.length}
  followUpOpenCount={followUpOpen.length}
  purchasingIncomingUnits={purchasingIncomingUnits}
  range={range}
  setRange={setRange}
  chart={chart}
  periodSales={periodSales}
  profit={m.profit}
  inventoryUnits={inventoryUnits}
  customerCount={s.customers.length}
  unpaidStock={m.unpaidStock}
  recentOrders={filteredOrders.slice(0,5)}
  orderTable={orderTable}
  changeView={changeView}
  setFilter={setFilter}
  setFinanceTab={setFinanceTab}
  setInventoryTab={setInventoryTab}
  setPurchasingTab={setPurchasingTab}
/>}
{view==='Orders'&&<OrdersSection
  openOrderCount={openOrderCount}
  salesMode={salesMode}
  readyToPackOrders={readyToPackOrders}
  outstandingOrderValue={outstandingOrderValue}
  todayOrders={todayOrders}
  todayOrderValue={todayOrderValue}
  canEdit={canEdit}
  openModal={openModal}
  filter={filter}
  setFilter={setFilter}
  orders={s.orders}
  outForDeliveryOrders={outForDeliveryOrders}
  deliveredCount={m.delivered}
  returnRate={returnRate}
  filteredOrders={filteredOrders}
  selectedOrderIds={selectedOrderIds}
  setSelectedOrderIds={setSelectedOrderIds}
  busy={busy}
  bulkAdvanceSelectedOrders={bulkAdvanceSelectedOrders}
  query={query}
  setQuery={setQuery}
  orderTable={orderTable}
/>}
{view==='Inventory'&&<InventorySection ctx={{
  stockedProducts,inventoryUnits,s,canEdit,openModal,setInventoryTab,setFilter,setQuery,m,
  inventoryLow,inventoryOut,inventoryExpiring,openPurchaseOrders,inventoryPhysicalUnits,
  inventoryReservedUnits,inventoryReturnPendingUnits,inventoryBlockedUnits,receivedUnitsThisMonth,
  receivedThisMonth,fastestMoving,slowMovingCount,inventoryExpired,changeView,inventoryTab,
  pendingReturnOrders,cancelledInspectionGroups,managedInventoryHolds,canInspectReturns,query,
  inventorySort,setInventorySort,filter,visibleInventoryProducts,busy,setConfirm,inspectReturnedOrder,
  releaseCancelledInspection,markCancelledInspectionDamaged,markInventoryHoldDamaged,
  releaseInventoryHold,requestDeleteCategory,currentInventoryMonth,match,productById,supplierById,
  role,canFinance,setView,setFinanceTab
}}/>}
{view==='Customers'&&<CustomersSection
  query={query}
  setQuery={setQuery}
  filteredCustomers={filteredCustomers}
  customerCount={s.customers.length}
  selectedCustomerIds={selectedCustomerIds}
  setSelectedCustomerIds={setSelectedCustomerIds}
  canEdit={canEdit}
  busy={busy}
  bulkCreateCustomerFollowUps={bulkCreateCustomerFollowUps}
  orders={s.orders}
  setDetail={setDetail}
  requestDelete={requestDelete}
/>}
{view==='Suppliers'&&<SuppliersSection ctx={{
  purchasingTab,s,canEdit,openPurchaseOrder,openModal,purchasingOpen,purchasingOpenValue,
  purchasingOverdue,purchasingIncomingUnits,canFinance,purchasingPayable,setView,setFinanceTab,
  verifiedSupplierCount,setPurchasingTab,setFilter,setQuery,query,filter,purchaseOrderRows,
  selectedPurchaseOrderIds,setSelectedPurchaseOrderIds,busy,bulkSendPurchaseOrders,
  setPurchaseOrderStatus,openPurchaseOrderReceipt,supplierRows,setDetail
}}/>}
{view==='Reports'&&<ReportsSection ctx={{
  reportMonth,reportPulseTone,reportPulse,reportOrders,setReportMonth,reportMonths,changeView,
  canExport,exportManagementReport,reportRevenue,reportRevenueDelta,reportProfit,reportMargin,
  reportAov,reportRepeatRate,reportRepeatCustomers,reportCustomerIds,reportReturnRate,
  reportReturnedOrders,reportNewCustomers,reportInsightTone,inventoryOut,inventoryLow,monthlyTrend,
  signedTaka,reportWorkingCapital,reportChannelRows,reportTopChannel,reportProductRows,
  reportProductMax,m,reportPurchaseOrders,reportPurchasingValue,reportTopProduct,
  reportProductProfitability,reportCustomerValue,setDetail,inventoryAgeing,inventoryAgeingTotal,
  supplierPerformance,managementActionQueue,managementControlScore,integrityIssues,
  unassignedMovements,automationActiveRules,inventoryExpired,projected30,reportCollectionRate,
  role,openModal
}}/>}
{view==='Finances'&&<FinancesSection ctx={{
  s,busy,canCloseFinance,canEdit,canExport,canFinance,cashRange,closeBlockers,closeMissingAccounts,
  closeMonth,closePayables,closeReceivables,closeRecord,closeUnassigned,allCashIn,allCashOut,
  availableCash,configuredBalances,exportFinance,financeTab,forecastPayables30,forecastReceivables,
  m,memberName,monthlyTrend,netCashMovement,openModal,openOwnerMoney,openPaymentDialog,
  overduePayables,payableAging,previousRevenue,productById,projected30,receivableAging,recentNet,
  reconciledAccounts,reportCogs,reportDeliveryIncome,reportExpenses,reportFulfillment,reportGross,
  reportMargin,reportMonth,reportMonths,reportOpex,reportOrders,reportProfit,reportReturns,
  reportRevenue,reverseCashEntry,save,setCashRange,setCloseMonth,setDetail,setFinanceTab,
  setReportMonth,signedTaka,supplierById,trendMax,unassignedMovements,visibleCash,cashIn,cashOut,
  flow,integrityIssues,isCollectible
}}/>}
{view==='Follow-ups'&&<FollowUpsSection
  focusText={followUpFocusText}
  canEdit={canEdit}
  openModal={openModal}
  filter={filter}
  setFilter={setFilter}
  query={query}
  setQuery={setQuery}
  followUpOpen={followUpOpen}
  followUpOverdue={followUpOverdue}
  followUpToday={followUpToday}
  followUpUpcoming={followUpUpcoming}
  followUpHigh={followUpHigh}
  followUpRows={followUpRows}
  selectedTaskIds={selectedTaskIds}
  setSelectedTaskIds={setSelectedTaskIds}
  tasks={s.tasks}
  busy={busy}
  bulkCompleteFollowUps={bulkCompleteFollowUps}
  customers={s.customers}
  orders={s.orders}
  updateFollowUp={updateFollowUp}
  followUpDueLabel={followUpDueLabel}
  setDetail={setDetail}
  deleteFollowUp={deleteFollowUp}
  changeView={changeView}
/>}
</>}
<footer className="page-footer"><span>ALOYRI <span className="footer-dot">·</span> Let Your Skin Glow.</span><span>All amounts in BDT · Dhaka time</span></footer></div></main>
<Dialog open={!!modal} onOpenChange={open=>{if(!open&&!busy)setModal(null)}}><DialogContent className="record-dialog"><DialogHeader><DialogTitle>{modal?({order:'New order',product:modal.record?'Edit product':'Add product',category:'Add category',customer:modal.record?'Edit customer':'Add customer',supplier:modal.record?'Edit supplier':'Add supplier',batch:'Receive stock',stockAdjust:'Edit available stock',stockHold:'Hold stock',expense:'Record an expense',cashEntry:'Record cash movement',task:modal.record?'Edit follow-up':'Add a follow-up',settings:'Business settings',orderEdit:'Delivery details'} as Record<string,string>)[modal.type]:''}</DialogTitle><DialogDescription>Changes are saved to your private workspace.</DialogDescription></DialogHeader>{modal&&<Form key={modal.type+(modal.record?.id||'')} modal={modal} s={s} busy={busy} onSave={save} onClose={()=>setModal(null)} onCreatedOrder={setInvoiceId} role={role} onReset={resetWorkspace} onBackup={downloadWorkspaceBackup} onRestore={restoreWorkspaceBackup} onOpenTeam={()=>{setModal(null);setTeamOpen(true)}}/>}</DialogContent></Dialog>
<Dialog open={poOpen} onOpenChange={setPoOpen}><DialogContent className="payment-dialog purchase-order-dialog"><DialogHeader><DialogTitle>New purchase order</DialogTitle><DialogDescription>Create a supplier order before stock arrives. Payment is handled separately in Finance after receiving.</DialogDescription></DialogHeader><div className="payment-form"><label><span>Supplier</span><select value={poSupplier} onChange={e=>{const id=e.target.value;setPoSupplier(id);const supplier=s.suppliers.find(x=>x.id===id);setPoExpected(shiftDate(supplier?.leadDays??14))}}>{s.suppliers.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label><span>Expected delivery</span><Input type="date" min={today()} value={poExpected} onChange={e=>setPoExpected(e.target.value)}/></label>{poLines.map((line,index)=><div className="po-line" key={index}><select value={line.productId} onChange={e=>setPurchaseOrderProduct(index,e.target.value)}>{s.products.map(p=><option key={p.id} value={p.id} disabled={poLines.some((other,i)=>i!==index&&other.productId===p.id)}>{p.brand} {p.name}</option>)}</select><Input aria-label="PO quantity" type="number" min="1" value={line.qty} onChange={e=>setPoLines(a=>a.map((x,i)=>i===index?{...x,qty:Number(e.target.value)}:x))}/><Input aria-label="PO unit cost" type="number" min="0" step="0.01" value={line.unitCost} onChange={e=>setPoLines(a=>a.map((x,i)=>i===index?{...x,unitCost:Number(e.target.value)}:x))}/><button className="icon-button" onClick={()=>setPoLines(a=>a.filter((_,i)=>i!==index))}><X size={16}/></button></div>)}<button className="btn secondary po-add-item" disabled={!s.products.some(p=>!poLines.some(line=>line.productId===p.id))} onClick={addPurchaseOrderItem}><Plus size={16}/>Add item</button><label className="po-notes"><span>Notes</span><Input value={poNotes} onChange={e=>setPoNotes(e.target.value)} placeholder="Terms, contact or delivery notes"/></label></div><DialogFooter><button className="btn secondary" onClick={()=>setPoOpen(false)}>Cancel</button><button className="btn primary" disabled={busy} onClick={()=>void createPurchaseOrder()}>Create draft PO</button></DialogFooter></DialogContent></Dialog>
<Dialog open={!!poReceiveId} onOpenChange={open=>{if(!open&&!busy)setPoReceiveId(null)}}><DialogContent className="payment-dialog purchase-receipt-dialog"><DialogHeader><DialogTitle>Receive purchase order</DialogTitle><DialogDescription>{receivingPurchaseOrder?.number||'Purchase order'} · record only what physically arrived. Each received line becomes an inventory batch.</DialogDescription></DialogHeader><div className="receipt-meta-grid"><label><span>Received on</span><Input type="date" max={today()} value={poReceiveDate} onChange={e=>{const date=e.target.value;setPoReceiveDate(date);const supplier=s.suppliers.find(x=>x.id===receivingPurchaseOrder?.supplierId);setPoReceiveDue(date?shiftDate(supplier?.paymentTermsDays??30,date):'')}}/></label><label><span>Invoice / reference</span><Input value={poReceiveInvoice} onChange={e=>setPoReceiveInvoice(e.target.value)} placeholder={receivingPurchaseOrder?.number||'Supplier invoice'}/></label><label><span>Payment due</span><Input type="date" min={poReceiveDate||undefined} value={poReceiveDue} onChange={e=>setPoReceiveDue(e.target.value)}/></label></div><div className="receipt-lines"><div className="receipt-line-head"><span>Product</span><span>Receive now</span><span>Expiry</span></div>{poReceiveLines.map((line,index)=>{const product=s.products.find(p=>p.id===line.productId),item=receivingPurchaseOrder?.items.find(i=>i.productId===line.productId),outstanding=item?item.qty-item.receivedQty:line.qty;return <div className="receipt-line" key={line.productId}><div><strong>{product?.name||'Product'}</strong><small>{outstanding} outstanding · {taka(item?.unitCost||0)} each</small></div><Input aria-label={'Receive '+(product?.name||'product')} type="number" min="0" max={outstanding} step="1" value={line.qty} onChange={e=>setPoReceiveLines(lines=>lines.map((x,i)=>i===index?{...x,qty:Number(e.target.value)}:x))}/><Input aria-label={'Expiry '+(product?.name||'product')} type="date" min={shiftDate(1,poReceiveDate||today())} value={line.expiry} onChange={e=>setPoReceiveLines(lines=>lines.map((x,i)=>i===index?{...x,expiry:e.target.value}:x))}/></div>})}</div><div className="info-strip receipt-info"><Package size={17}/><span>Use 0 for any line that did not arrive. Partial receipts keep the PO open for the remaining quantity.</span></div><DialogFooter><button className="btn secondary" disabled={busy} onClick={()=>setPoReceiveId(null)}>Cancel</button><button className="btn primary" disabled={busy} onClick={()=>void submitPurchaseOrderReceipt()}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Receive stock</button></DialogFooter></DialogContent></Dialog>
<Dialog open={ownerMoneyOpen} onOpenChange={open=>{if(!open&&!busy)setOwnerMoneyOpen(false)}}><DialogContent className="payment-dialog"><DialogHeader><DialogTitle>{ownerMoneyKind==='capital'?'Record owner capital':'Record owner drawing'}</DialogTitle><DialogDescription>{ownerMoneyKind==='capital'?'Money the owner contributes to the business. This increases cash but is not sales income.':'Money withdrawn by the owner. This reduces cash but is not an operating expense.'}</DialogDescription></DialogHeader><div className="payment-form"><label><span>Amount (BDT)</span><Input type="number" min="0.01" step="0.01" value={ownerMoneyAmount} onChange={e=>setOwnerMoneyAmount(e.target.value)}/></label><label><span>Date</span><Input type="date" max={today()} value={ownerMoneyDate} onChange={e=>setOwnerMoneyDate(e.target.value)}/></label><label><span>Account</span><select value={ownerMoneyAccount} onChange={e=>setOwnerMoneyAccount(e.target.value as typeof accountIds[number])}>{accountIds.map(a=><option key={a} value={a}>{accountNames[a]}{accountBalance(s,a)===null?' · not configured':' · '+taka(accountBalance(s,a)!)}</option>)}</select></label><label><span>Reference / note</span><Input value={ownerMoneyReference} onChange={e=>setOwnerMoneyReference(e.target.value)} placeholder="Transfer reference or note"/></label><div className="payment-dialog-actions"><button className="btn secondary" disabled={busy} onClick={()=>setOwnerMoneyOpen(false)}>Cancel</button><button className="btn primary" disabled={busy} onClick={()=>void submitOwnerMoney()}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Post & reconcile</button></div></div></DialogContent></Dialog><Dialog open={!!paymentDialog} onOpenChange={open=>{if(!open&&!busy)setPaymentDialog(null)}}><DialogContent className="payment-dialog"><DialogHeader><DialogTitle>{paymentDialog?.kind==='collection'?'Record customer collection':'Record supplier payment'}</DialogTitle><DialogDescription>{paymentDialog?.label} · maximum {paymentDialog?taka(paymentDialog.max):''}. Saving posts the payment directly to the selected account and marks the cash movement reconciled.</DialogDescription></DialogHeader><div className="payment-form"><label><span>Amount (BDT)</span><Input type="number" min="0.01" step="0.01" value={paymentAmount} onChange={e=>setPaymentAmount(e.target.value)}/></label><label><span>Payment date</span><Input type="date" max={today()} value={paymentDate} onChange={e=>setPaymentDate(e.target.value)}/></label><label><span>Account</span><select value={paymentAccount} onChange={e=>setPaymentAccount(e.target.value as typeof accountIds[number])}>{accountIds.map(a=><option key={a} value={a}>{accountNames[a]}{accountBalance(s,a)===null?' · not configured':' · '+taka(accountBalance(s,a)!)}</option>)}</select></label><label><span>{paymentDialog?.kind==='collection'?'Reference':'Reference / note'}</span><Input value={paymentReference} onChange={e=>setPaymentReference(e.target.value)} placeholder={paymentDialog?.kind==='collection'?'Courier payout, transaction ID, bank reference':'Invoice, transaction ID or payment note'}/></label><div className="payment-dialog-actions"><button className="btn secondary" disabled={busy} onClick={()=>setPaymentDialog(null)}>Cancel</button><button className="btn primary" disabled={busy} onClick={()=>void submitPayment()}>{busy?<Loader2 className="spin" size={16}/>:<Check size={16}/>}Post & reconcile</button></div></div></DialogContent></Dialog><Sheet open={!!detail} onOpenChange={open=>{if(!open)setDetail(null)}}><SheetContent className="detail-sheet"><SheetHeader><SheetTitle>{order?'Order #'+order.number:customer?.name||supplier?.name||'Details'}</SheetTitle><SheetDescription>{order?(salesMode?'Manage fulfillment, tracking and order status.':'Manage fulfillment, costs and collection.'):supplier?'Supplier profile, purchasing history and receiving context.':'Contact details and purchase history.'}</SheetDescription></SheetHeader><div className="detail-body">{order&&<><div className="detail-status"><Status value={order.status}/><span>{dateLabel(order.created)} · {order.channel}</span></div><OrderProgress order={order}/><div className="detail-customer"><Avatar name={s.customers.find(c=>c.id===order.customerId)?.name||'Customer'}/><div><strong>{s.customers.find(c=>c.id===order.customerId)?.name}</strong><p>{s.customers.find(c=>c.id===order.customerId)?.phone||'No phone recorded'}</p><p>{s.customers.find(c=>c.id===order.customerId)?.address}, {s.customers.find(c=>c.id===order.customerId)?.city}</p></div></div><h3>Order items</h3>{order.items.map(i=><div className="detail-item" key={i.productId}><span>{s.products.find(p=>p.id===i.productId)?.name}<small>Qty {i.qty}</small></span><strong>{taka(i.qty*i.price)}</strong></div>)}<dl className="detail-totals"><div><dt>Discount</dt><dd>− {taka(order.discount)}</dd></div><div><dt>Delivery charged</dt><dd>{taka(order.deliveryCharge)}</dd></div><div className="total-row"><dt>Customer total</dt><dd>{taka(total(order))}</dd></div>{canFinance&&<div><dt>Order contribution</dt><dd>{taka(contribution(order))}</dd></div>}</dl>{canFinance&&<p className="form-note">Contribution is counted in your operating result only after delivery.</p>}{salesMode?<div className="order-payment-summary"><div className="order-payment-state"><span>Payment method</span><strong>{order.payment}</strong></div><p className="form-note">Collections and internal payment accounting are managed by the owner or an admin.</p></div>:<div className="order-payment-summary"><div><span>Payment method</span><strong>{order.payment}</strong></div><div><span>Receivable</span><strong>{taka(receivable(order))}</strong></div><div><span>Collected</span><strong>{taka(collectedAmount(order))}</strong></div><div><span>Outstanding</span><strong>{taka(orderBalance(order))}</strong></div><div className="order-payment-state"><span>Payment status</span><strong>{orderPaymentStatus(order)}</strong></div></div>}{order.tracking&&<div className="detail-note"><strong>Tracking reference</strong><p>{order.tracking}</p></div>}{order.notes&&<div className="detail-note"><strong>Notes</strong><p>{order.notes}</p></div>}{canPrint&&<button className="btn primary full" onClick={()=>setInvoiceId(order.id)}><Receipt size={16}/>View invoice · Print / Save PDF</button>}{canEdit('orders')&&<button className="btn secondary full" onClick={()=>openModal({type:'orderEdit',record:order})}>{salesMode?'Edit delivery details':'Edit delivery details & costs'}</button>}{canEdit('orders')&&nextStatuses(order).length>0&&<div className="status-actions"><h3>Next step</h3>{nextStatuses(order).map(status=><button key={status} className={'btn '+(status==='Cancelled'||status==='Returned'?'secondary':'primary')} disabled={busy} onClick={()=>changeStatus(order,status)}>{status==='Cancelled'?'Cancel order':status==='Returned'?'Record return':'Mark '+status.toLowerCase()}<ArrowRight size={15}/></button>)}</div>}{!salesMode&&isCollectible(order)&&<div className="settlement-box"><span>{orderBalance(order)<=.001?'Collection settled':order.payment==='COD'&&order.status!=='Delivered'?'Collection due after delivery':taka(orderBalance(order))+' collection pending'}</span>{orderBalance(order)>.001&&canFinance&&<button className="btn primary" disabled={busy} onClick={()=>{setDetail(null);setView('Finances');setFinanceTab('Collections')}}>Record collection<Check size={16}/></button>}</div>}{order.status==='Returned'&&!order.restocked&&canInspectReturns&&<button className="btn secondary full" disabled={busy} onClick={()=>setConfirm({title:'Return inspected products to stock?',text:'Confirm every item in this return is sealed, undamaged and suitable for resale. Expired batches remain blocked.',action:()=>{void updateOrder(order,{restocked:true})}})}>Inspect & restock return</button>}</>}
{customer&&<><div className="customer-profile"><Avatar name={customer.name}/><strong>{customer.name}</strong><span>{customer.city}</span></div><dl className="contact-details"><div><dt>Phone</dt><dd>{customer.phone||'Not added'}</dd></div><div><dt>Address</dt><dd>{customer.address||'Not added'}</dd></div><div><dt>Preferences</dt><dd>{customer.preference||'Not added'}</dd></div><div><dt>Notes</dt><dd>{customer.notes||'No notes'}</dd></div></dl><Status value={customer.consent?'Opted in':'Not recorded'}/><div className="customer-actions">{canEdit('customers')&&<button className="btn secondary" onClick={()=>openModal({type:'customer',record:customer})}>Edit customer</button>}{canEdit('tasks')&&<button className="btn primary" onClick={()=>openModal({type:'task',customerId:customer.id})}><Plus size={15}/>Follow-up</button>}{canEdit('customers')&&<button className="btn secondary delete-button" disabled={busy} onClick={()=>requestDelete('customers',customer.id,customer.name)}>Delete customer</button>}</div><h3>Purchase history</h3>{s.orders.filter(o=>o.customerId===customer.id).map(o=><button className="customer-order" key={o.id} onClick={()=>setDetail({type:'order',id:o.id})}><span>{o.number}<small>{dateLabel(o.created)}</small></span><Status value={o.status}/><strong>{taka(total(o))}</strong></button>)}{!s.orders.some(o=>o.customerId===customer.id)&&<p className="muted">No orders yet.</p>}{canEdit('orders')&&<button className="btn secondary full" onClick={()=>openModal({type:'order',customerId:customer.id})}><Plus size={16}/>Create an order</button>}</>}
{supplier&&supplierDetail&&<><div className="supplier-detail-profile"><span className="supplier-icon"><Truck size={24}/></span><div><strong>{supplier.name}</strong><span>{supplier.contact||'No contact person'}</span></div><Status value={supplier.verified?'Verified':'Check documents'}/></div><div className="supplier-detail-kpis"><span><small>Purchase orders</small><strong>{supplierDetail.purchaseOrders.length}</strong></span><span><small>Open POs</small><strong>{supplierDetail.activePurchaseOrders.length}</strong></span><span><small>Received value</small><strong>{taka(supplierDetail.receivedValue)}</strong></span><span><small>Avg lead time</small><strong>{supplierDetail.avgLeadDays===null?'—':supplierDetail.avgLeadDays+' days'}</strong></span></div><dl className="contact-details supplier-contact-details"><div><dt>Phone</dt><dd>{supplier.phone||'Not added'}</dd></div><div><dt>Email</dt><dd>{supplier.email||'Not added'}</dd></div><div><dt>Address</dt><dd>{supplier.address||'Not added'}</dd></div><div><dt>Expected lead time</dt><dd>{supplier.leadDays} days</dd></div><div><dt>Payment terms</dt><dd>{supplier.paymentTermsDays} days from receipt</dd></div><div><dt>Sourcing notes</dt><dd>{supplier.notes||'No notes'}</dd></div></dl>{canFinance&&<div className="supplier-payable-summary"><span><small>Received purchase value</small><strong>{taka(supplierDetail.receivedValue)}</strong></span><span><small>Paid</small><strong>{taka(supplierDetail.paidValue)}</strong></span><span><small>Outstanding</small><strong>{taka(supplierDetail.payable)}</strong></span></div>}<div className="customer-actions supplier-detail-actions">{canEdit('purchaseOrders')&&<button className="btn primary" onClick={()=>{setDetail(null);openPurchaseOrder(supplier.id)}}><Plus size={15}/>New PO</button>}{canEdit('suppliers')&&<button className="btn secondary" onClick={()=>openModal({type:'supplier',record:supplier})}>Edit supplier</button>}{canFinance&&supplierDetail.payable>.001&&<button className="btn secondary" onClick={()=>{setDetail(null);setView('Finances');setFinanceTab('Payables')}}>View payables</button>}</div><div className="supplier-detail-section"><div className="supplier-detail-section-heading"><h3>Purchase orders</h3><span>{supplierDetail.activePurchaseOrders.length} open</span></div>{[...supplierDetail.purchaseOrders].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,8).map(po=>{const overdue=['Sent','Part received'].includes(po.status)&&po.expected<today();return <div className="supplier-po-history" key={po.id}><span><strong>{po.number}</strong><small>{dateLabel(po.created)} · expected {dateLabel(po.expected)}</small></span><div><Status value={overdue?'Overdue':po.status}/><strong>{taka(purchaseOrderValue(po))}</strong></div></div>})}{!supplierDetail.purchaseOrders.length&&<p className="muted">No purchase orders recorded for this supplier.</p>}</div><div className="supplier-detail-section"><div className="supplier-detail-section-heading"><h3>Recent receipts</h3><span>{supplierDetail.batches.length} batches</span></div>{[...supplierDetail.batches].sort((a,b)=>b.received.localeCompare(a.received)).slice(0,8).map(batch=><div className="supplier-receipt-history" key={batch.id}><span><strong>{s.products.find(p=>p.id===batch.productId)?.name||'Product'}</strong><small>{batch.invoice||'No invoice'} · received {dateLabel(batch.received)} · expires {dateLabel(batch.expiry)}</small></span><strong>{batch.qty} units · {taka(batch.qty*batch.unitCost)}</strong></div>)}{!supplierDetail.batches.length&&<p className="muted">No stock receipts recorded yet.</p>}</div>{canEdit('suppliers')&&<button className="text-button delete-button supplier-delete-action" disabled={busy} onClick={()=>requestDelete('suppliers',supplier.id,supplier.name)}>Delete supplier record</button>}</>}
</div></SheetContent></Sheet>
<Invoice state={s} order={s.orders.find(o=>o.id===invoiceId)||null} onClose={()=>setInvoiceId(null)}/><Team open={role==='owner'&&teamOpen} onClose={()=>setTeamOpen(false)}/><ChangePassword open={passwordOpen} onClose={()=>setPasswordOpen(false)}/>
<AlertDialog open={!!confirm} onOpenChange={open=>{if(!open)setConfirm(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.text}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction onClick={()=>{confirm?.action();setConfirm(null)}}>{confirm?.confirmLabel||'Confirm'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
</SidebarProvider>}
