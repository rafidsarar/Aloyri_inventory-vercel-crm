import { notFound } from 'next/navigation';
import CRM from '../crm';

export const dynamic='force-dynamic';

export default function E2EWorkspace(){
  if(process.env.E2E_TEST_MODE!=='1')notFound();
  return <CRM/>;
}
