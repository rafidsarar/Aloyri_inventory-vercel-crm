const RESET_TTL_MS=30*60*1000;

export const PASSWORD_RESET_TTL_MS=RESET_TTL_MS;
export const passwordResetTokenValid=(token:unknown):token is string=>typeof token==='string'&&/^[a-f0-9]{64}$/.test(token);
export const passwordResetExpiry=(now=Date.now())=>new Date(now+RESET_TTL_MS).toISOString();
export function passwordResetUrl(baseUrl:string,token:string){
  const url=new URL('/reset-password',baseUrl);
  url.searchParams.set('token',token);
  return url.toString();
}
export const passwordResetEmailConfigured=()=>Boolean(process.env.RESEND_API_KEY?.trim()&&process.env.PASSWORD_RESET_FROM_EMAIL?.trim());

const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[char]||char));

export async function sendPasswordResetEmail({to,name,resetUrl}:{to:string;name:string;resetUrl:string}){
  const apiKey=process.env.RESEND_API_KEY?.trim();
  const from=process.env.PASSWORD_RESET_FROM_EMAIL?.trim();
  if(!apiKey||!from)throw new Error('Password reset email is not configured.');
  const safeName=escapeHtml(name||'there');
  const safeUrl=escapeHtml(resetUrl);
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},
    body:JSON.stringify({
      from,
      to:[to],
      subject:'Reset your ALOYRI password',
      text:`Hello ${name||'there'},\n\nUse this link to reset your ALOYRI CRM password. It expires in 30 minutes and can only be used once.\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.\n\nALOYRI\nLet Your Skin Glow.`,
      html:`<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#3e2d28"><h2 style="margin:0 0 16px">Reset your ALOYRI password</h2><p>Hello ${safeName},</p><p>Use the button below to choose a new password for your ALOYRI CRM account. This link expires in <strong>30 minutes</strong> and can only be used once.</p><p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#1b7958;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-weight:600">Reset password</a></p><p style="font-size:13px;color:#73635d">If the button does not work, copy this link into your browser:<br><a href="${safeUrl}" style="color:#1b7958;word-break:break-all">${safeUrl}</a></p><p style="font-size:13px;color:#73635d">If you did not request a password reset, you can ignore this email. Your current password remains unchanged.</p><p style="margin-top:28px"><strong>ALOYRI</strong><br><span style="font-size:12px;color:#73635d">Let Your Skin Glow.</span></p></div>`
    })
  });
  if(!response.ok){
    const providerMessage=(await response.text()).slice(0,300);
    console.error('Password reset email provider error',response.status,providerMessage);
    throw new Error('Password reset email could not be sent.');
  }
}
