import { database } from '@/db/raw';

export async function ensurePasswordResetSchema(){
  const db=database();
  await db.prepare('CREATE TABLE IF NOT EXISTS crm_password_resets (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at TEXT NOT NULL,created_at TEXT NOT NULL)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS crm_password_resets_user ON crm_password_resets(user_id)').run();
}

export function passwordResetEmailConfigured(){
  return !!(process.env.RESEND_API_KEY&&(process.env.PASSWORD_RESET_FROM_EMAIL||process.env.RESEND_FROM_EMAIL));
}

function escapeHtml(value:string){
  return value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
}

export async function sendPasswordResetEmail(email:string,resetUrl:string){
  const apiKey=process.env.RESEND_API_KEY;
  const from=process.env.PASSWORD_RESET_FROM_EMAIL||process.env.RESEND_FROM_EMAIL;
  if(!apiKey||!from)throw new Error('Password reset email is not configured.');
  const safeUrl=escapeHtml(resetUrl);
  const response=await fetch('https://api.resend.com/emails',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},
    body:JSON.stringify({
      from,
      to:[email],
      subject:'Reset your ALOYRI password',
      text:`A password reset was requested for your ALOYRI account. Open this link within 30 minutes: ${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
      html:`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h2 style="margin:0 0 16px">Reset your ALOYRI password</h2><p>A password reset was requested for your ALOYRI account.</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#111827;color:#fff;text-decoration:none">Reset password</a></p><p>This link expires in 30 minutes and can be used only once.</p><p>If you did not request this, you can ignore this email.</p></div>`,
    }),
  });
  if(!response.ok)throw new Error(`Reset email provider returned ${response.status}.`);
}
