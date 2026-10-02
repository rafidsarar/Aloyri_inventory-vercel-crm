export function relationalDate(value:unknown):string{
  const raw=value instanceof Date?value.toISOString():String(value??'').trim();
  const prefix=raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if(prefix)return prefix;
  const parsed=new Date(raw);
  return Number.isNaN(parsed.getTime())?raw:parsed.toISOString().slice(0,10);
}

export function optionalRelationalDate(value:unknown):string|undefined{
  return value==null||value===''?undefined:relationalDate(value);
}
