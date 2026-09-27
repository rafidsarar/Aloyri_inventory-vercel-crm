import { checkOrigin, clearCookie, revokeSession } from '@/app/local-auth';
export async function POST(request:Request){if(!checkOrigin(request))return Response.json({error:'Invalid request origin.'},{status:403});await revokeSession(request.headers.get('cookie'));return Response.json({ok:true},{headers:{'Set-Cookie':clearCookie(request),'Cache-Control':'no-store'}})}
