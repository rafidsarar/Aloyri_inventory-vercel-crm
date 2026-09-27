import { redirect } from 'next/navigation';
import { getAppUser } from './local-auth';
import CRM from './crm';
export const dynamic='force-dynamic';
export default async function Home(){if(!await getAppUser())redirect('/login');return <CRM/>}
