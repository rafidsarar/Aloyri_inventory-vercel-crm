import PasswordRecoveryForm from '../password-recovery-form';
export const dynamic='force-dynamic';
export default async function ResetPassword({searchParams}:{searchParams:Promise<{token?:string|string[]}>}){
  const params=await searchParams;
  const token=Array.isArray(params.token)?params.token[0]||'':params.token||'';
  return <PasswordRecoveryForm mode="reset" token={token}/>
}
