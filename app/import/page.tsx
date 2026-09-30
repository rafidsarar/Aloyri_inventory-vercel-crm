import { redirect } from 'next/navigation';
import { getAppUser } from '../local-auth';
import ImportForm from './upload';
import { roleCanImport } from '@/lib/roles';
export const dynamic='force-dynamic';
export default async function Import(){const user=await getAppUser();if(!user)redirect('/login');if(!roleCanImport(user.role))redirect('/');return <ImportForm/>}
