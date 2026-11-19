/** Phase P03-4 strictly bounded discovery query. All coordinates, filters and viewer IDs are server-only. */
export const MAX_HYDRATION_PAGE = 12;
export function parseDiscoveryQuery(raw:unknown):{mode:'DATING'|'FRIENDSHIP';pageSize:number;cursor?:string}|null{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
  const q=raw as Record<string,unknown>;
  if(Object.keys(q).some(key=>!['mode','pageSize','cursor'].includes(key))||
    !['dating','friendship'].includes(String(q.mode)))return null;
  const size=q.pageSize===undefined?8:Number(q.pageSize);
  if((q.pageSize!==undefined&&(typeof q.pageSize!=='string'||
    !/^(?:[1-9]|1[0-2])$/.test(q.pageSize)))||
    !Number.isSafeInteger(size)||size<1||size>MAX_HYDRATION_PAGE)return null;
  if(q.cursor!==undefined&&(typeof q.cursor!=='string'||
    q.cursor.length<45||q.cursor.length>4096||
    !/^[A-Za-z0-9_-]+$/.test(q.cursor)))return null;
  return {mode:q.mode==='dating'?'DATING':'FRIENDSHIP',pageSize:size,
    ...(typeof q.cursor==='string'?{cursor:q.cursor}:{})};
}
