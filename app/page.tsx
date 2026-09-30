import { redirect } from 'next/navigation';
import { getAppUser } from './local-auth';
import CRM from './crm';
import CRMErrorBoundary from './crm-error-boundary';
export const dynamic='force-dynamic';
export default async function Home(){if(!await getAppUser())redirect('/login');return <CRMErrorBoundary><CRM/></CRMErrorBoundary>}
