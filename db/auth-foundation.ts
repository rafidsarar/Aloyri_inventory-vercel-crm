import { database } from './raw.ts';

let ready:Promise<void>|null=null;

export function ensureWorkspaceRoleConstraint(){
  if(!ready){
    ready=(async()=>{
      const db=database();
      await db.batch([
        db.prepare('ALTER TABLE crm_users DROP CONSTRAINT IF EXISTS crm_users_role_check'),
        db.prepare("ALTER TABLE crm_users ADD CONSTRAINT crm_users_role_check CHECK (role IN ('owner','admin','sales','inventory','finance','viewer'))")
      ]);
    })().catch(error=>{
      ready=null;
      throw error;
    });
  }
  return ready;
}
