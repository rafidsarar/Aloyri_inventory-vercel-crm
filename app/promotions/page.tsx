import { redirect } from 'next/navigation';
import { getAppUser } from '@/app/local-auth';
import PromotionsClient from './promotions-client';

export const dynamic='force-dynamic';

export default async function PromotionsPage(){
  const user=await getAppUser();
  if(!user)redirect('/login');
  if(user.role!=='owner'&&user.role!=='admin')redirect('/');
  return <PromotionsClient memberName={user.displayName}/>;
}
