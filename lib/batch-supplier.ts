import type { State } from './crm.ts';
import { roleCanEdit, type WorkspaceRole } from './roles.ts';

/** Change receipt provenance without recreating stock or touching payments. */
export function linkBatchSupplier(state:State,batchId:string,input:{supplierId:string;invoice:string},role:WorkspaceRole):State {
  if(!roleCanEdit(role,'batches'))throw Error('Your role cannot link batch suppliers.');
  const batch=state.batches.find(b=>b.id===batchId);
  if(!batch)throw Error('Inventory batch not found. Refresh and try again.');
  if(!state.suppliers.some(s=>s.id===input.supplierId))throw Error('Choose a saved supplier.');
  const invoice=input.invoice.trim();
  if(!invoice||invoice.length>500)throw Error('Enter an invoice or purchase reference of up to 500 characters.');
  const next=structuredClone(state),target=next.batches.find(b=>b.id===batchId)!;
  target.supplierId=input.supplierId;
  target.invoice=invoice;
  return next;
}
