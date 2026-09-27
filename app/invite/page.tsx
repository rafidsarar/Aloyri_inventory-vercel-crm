import AuthForm from '../auth-form';
export const dynamic='force-dynamic';
export default async function Invite({searchParams}:{searchParams:Promise<{token?:string}>}){const {token}=await searchParams;return <AuthForm mode="invite" token={token||''}/>}
