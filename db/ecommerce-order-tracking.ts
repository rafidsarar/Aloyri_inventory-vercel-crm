import { database } from './raw.ts';
import {
  fixedBusinessName,
  stateSchema,
  subtotal,
  total,
  validateRelations,
  type Order,
  type State
} from '../lib/crm.ts';
import { normalizeBangladeshPhone } from '../lib/ecommerce-integration.ts';

type WorkspaceRow={data:string};

export type PublicTrackingItem={
  name:string;
  brand:string;
  size:string;
  qty:number;
  unitPrice:number;
};

export type PublicOrderTracking={
  orderNumber:string;
  created:string;
  status:Order['status'];
  paymentMethod:Order['payment'];
  items:PublicTrackingItem[];
  productsSubtotal:number;
  discount:number;
  deliveryCharge:number;
  total:number;
  trackingReference:string;
  deliveredDate:string;
  returnedDate:string;
};

function roundMoney(value:number){
  return Math.round(value*100)/100;
}

export function buildPublicTrackingView(
  state:State,
  orderNumber:string,
  phone:string
):PublicOrderTracking|null{
  const normalizedPhone=normalizeBangladeshPhone(phone);
  const normalizedOrder=orderNumber.trim().toLowerCase();

  const order=state.orders.find(candidate=>
    candidate.channel==='Website' &&
    candidate.number.trim().toLowerCase()===normalizedOrder
  );
  if(!order)return null;

  const customer=state.customers.find(candidate=>candidate.id===order.customerId);
  if(!customer || normalizeBangladeshPhone(customer.phone)!==normalizedPhone)return null;

  const items=order.items.map(item=>{
    const product=state.products.find(candidate=>candidate.id===item.productId);
    return {
      name:product?.name||'Skincare product',
      brand:product?.brand||'',
      size:product?.size||'',
      qty:item.qty,
      unitPrice:roundMoney(item.price)
    };
  });

  return {
    orderNumber:order.number,
    created:order.created,
    status:order.status,
    paymentMethod:order.payment,
    items,
    productsSubtotal:roundMoney(subtotal(order)+order.discount),
    discount:roundMoney(order.discount),
    deliveryCharge:roundMoney(order.deliveryCharge),
    total:roundMoney(total(order)),
    trackingReference:order.tracking.trim(),
    deliveredDate:order.delivered||'',
    returnedDate:order.returnedAt||''
  };
}

export async function readEcommerceOrderTracking(
  ownerId:string,
  orderNumber:string,
  phone:string
){
  const row=await database().prepare(
    'SELECT data FROM crm_workspaces WHERE owner_id=?'
  ).bind(ownerId).first<WorkspaceRow>();
  if(!row)throw new Error('Workspace not found.');

  const state=fixedBusinessName(stateSchema.parse(JSON.parse(row.data)));
  validateRelations(state,{skipOrderNumberUniqueness:true});

  return buildPublicTrackingView(state,orderNumber,phone);
}
