import type {Env} from './types';

export type StaffRoleSettings={
 admin_role_id:string|null;
 moderator_role_id:string|null;
 manager_role_id:string|null;
 moderator_role_ids:string|null;
 manager_role_ids:string|null;
};

export function roleIds(serialized:string|null|undefined,legacy:string|null|undefined):string[]{
 if(serialized){
  try{
   const values=JSON.parse(serialized) as unknown;
   if(Array.isArray(values))return [...new Set(values.filter((value):value is string=>typeof value==='string'&&value.length>0))];
  }catch{ /* Keep pre-migration single-role settings usable. */ }
 }
 return legacy?[legacy]:[];
}

export function withStaffRoles(env:Env,settings:StaffRoleSettings|null):Env{
 if(!settings)return env;
 const moderatorRoles=roleIds(settings.moderator_role_ids,settings.moderator_role_id);
 const managerRoles=roleIds(settings.manager_role_ids,settings.manager_role_id);
 return {
  ...env,
  ...(settings.admin_role_id?{ADMIN_ROLE_ID:settings.admin_role_id}:{}),
  MODERATOR_ROLE_IDS:JSON.stringify(moderatorRoles.length||settings.moderator_role_id!==null?moderatorRoles:roleIds(env.MODERATOR_ROLE_IDS,env.MODERATOR_ROLE_ID)),
  MANAGER_ROLE_IDS:JSON.stringify(managerRoles.length||settings.manager_role_id!==null?managerRoles:roleIds(env.MANAGER_ROLE_IDS,env.MANAGER_ROLE_ID))
 };
}
