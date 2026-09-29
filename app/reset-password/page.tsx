import PasswordRecovery from '../password-recovery';
export const dynamic='force-dynamic';
export default async function ResetPassword({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <PasswordRecovery mode="reset" token={token||''}/>}
