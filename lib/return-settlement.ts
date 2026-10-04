import { returnSettlementSchema,stateSchema,validateRelations,type State } from './crm.ts';
export function prepareReturnSettlement(state:State,input:unknown):State{
 const r=returnSettlementSchema.parse(input),prior=state.returnSettlements.find(p=>p.id===r.id);
 if(prior){if(JSON.stringify(prior)!==JSON.stringify(r))throw new Error('Settlement reference already used.');return state;}
 if(state.returnSettlements.some(p=>p.orderId===r.orderId))throw new Error('This return already has a settlement decision.');
 const next=structuredClone(state);next.returnSettlements.push(r);const parsed=stateSchema.parse(next);validateRelations(parsed,{skipOrderNumberUniqueness:true});return parsed;
}
