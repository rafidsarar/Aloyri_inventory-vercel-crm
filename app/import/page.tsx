import { redirect } from 'next/navigation';
import { getAppUser } from '../local-auth';
import ImportForm from './upload';
export const dynamic='force-dynamic';
export default async function Import(){const user=await getAppUser();if(!user)redirect('/login');if(user.role!=='owner')redirect('/');return <ImportForm/>}
