// Hosted Supabase injects modern server keys; retain compatibility with legacy runtimes.
/** @param {(name: string) => string | undefined} getEnv @returns {string} */
export function resolveAdminKey(getEnv){
 const modern=getEnv('SUPABASE_SECRET_KEYS');
 if(modern){
  try{const keys=JSON.parse(modern);const preferred=keys.default;if(typeof preferred==='string'&&preferred.startsWith('sb_secret_'))return preferred;
   const candidate=Object.values(keys).find(v=>typeof v==='string'&&v.startsWith('sb_secret_'));if(typeof candidate==='string')return candidate;
  }catch{}
 }
 const legacy=getEnv('SUPABASE_SERVICE_ROLE_KEY');
 if(legacy)return legacy;
 throw Error('Server credentials are not available in this runtime.');
}
