import { customerRefundSchema,refundBalance,stateSchema,validateRelations,type State } from './crm.ts';
import type { WorkspaceRole } from './roles.ts';

/** Prepare one immutable payout; the caller persists it atomically with its account movement. */
export function prepareCustomerRefund(state:State,input:unknown,role:WorkspaceRole):State {
 if(!['owner','admin','finance'].includes(role))throw new Error('FINANCE_FORBIDDEN');
 const refund=customerRefundSchema.parse(input);
 const prior=state.customerRefunds.find(r=>r.id===refund.id);
 if(prior){if(JSON.stringify(prior)!==JSON.stringify(refund))throw new Error('Refund reference was already used for another payment.');return state;}
 const order=state.orders.find(o=>o.id===refund.orderId);
 if(!order||order.status!=='Returned')throw new Error('Choose a returned order.');
 if(refund.amount>refundBalance(state,order)+.001)throw new Error('Refund amount exceeds the remaining customer refund balance.');
 if(state.financeCloses.some(c=>c.month===refund.date.slice(0,7)))throw new Error('Refund date is in a closed month.');
 const next=structuredClone(state);
 next.customerRefunds.push(refund);
 next.accountMatches.push({entryId:'customer-refund-'+refund.id,account:refund.account,matched:false,reference:refund.reference});
 const parsed=stateSchema.parse(next);validateRelations(parsed,{skipOrderNumberUniqueness:true});return parsed;
}
