export type SapsResult={status:'pending'|'finalised'|'not_found'|'unavailable',message:string,finalised_on?:string};
function clean(s:string){return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()}
function digits(s:string){return s.replace(/\D/g,'')}
function dateValue(s:string){let m=/\b(\d{4})[-/](\d{2})[-/](\d{2})\b/.exec(s);let x=m?`${m[1]}-${m[2]}-${m[3]}`:null;if(!x){m=/\b(\d{2})[-/](\d{2})[-/](\d{4})\b/.exec(s);if(m)x=`${m[3]}-${m[2]}-${m[1]}`}if(!x||!/^\d{4}-\d{2}-\d{2}$/.test(x))return null;const d=new Date(x+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===x?x:null}
export function parseSaps(html:string,reference:string,identity:string):SapsResult{
 if(html.length>1500000||/verify you are human|captcha|access denied|request blocked/i.test(clean(html)))return {status:'unavailable',message:'SAPS did not provide a readable result. A manual check is required.'};
 const tables=html.match(/<table\b[^>]*>[\s\S]*?<\/table>/gi)||[];
 for(const table of tables){const rows=[...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>clean(c[1])));let headers:string[]=[];
  for(const cells of rows){if(cells.some(c=>/finali[sz](?:ed|ation)/i.test(c))&&cells.some(c=>/enquiry/i.test(c))){headers=cells;continue}if(!headers.length||cells.length<6)continue;
   const refIndex=headers.findIndex(c=>/enquiry|reference/i.test(c));const idIndex=headers.findIndex(c=>/identity/i.test(c));const birthIndex=headers.findIndex(c=>/birth/i.test(c));const finalIndex=headers.findIndex(c=>/finali[sz]/i.test(c));
   if(refIndex<0||digits(cells[refIndex]||'')!==reference)continue;
   const birth=dateValue(cells[birthIndex]||'');const match=identity.length===13?digits(cells[idIndex]||'')===identity:(birth?.replace(/-/g,'')===identity||digits(cells[birthIndex]||'')===identity);
   if(!match)return {status:'unavailable',message:'The SAPS result did not match the client identifier. Verify the numbers manually.'};
   const final=dateValue(cells[finalIndex]||'');if(final)return {status:'finalised',message:'Matching SAPS enquiry shows a finalised date. This confirms processing status, not the contents of the certificate.',finalised_on:final};
   return {status:'pending',message:'Matching SAPS enquiry found; no valid finalised date was reported.'};
  }
 }
 const text=clean(html);if(/no records to retrieve|no records found/i.test(text))return {status:'not_found',message:'SAPS reported no matching application. Check the enquiry number and client identifier.'};
 return {status:'unavailable',message:'The SAPS page format or response could not be verified. Open SAPS and record a signed manual check with evidence.'};
}
export async function checkSaps(reference:string,identity:string):Promise<SapsResult>{
 if(!/^\d{6,20}$/.test(reference)||! /^(\d{8}|\d{13})$/.test(identity))return {status:'unavailable',message:'A valid enquiry number and ID or date of birth are required.'};
 try{const u=new URL('https://www.saps.gov.za/services/certificate.php');u.searchParams.set('bcref',reference);u.searchParams.set('bcid',identity);const r=await fetch(u,{redirect:'error',headers:{Accept:'text/html','User-Agent':'SGC-VisaServices-PCC-Status/1.0'},signal:AbortSignal.timeout(18000)});if(!r.ok)return {status:'unavailable',message:'SAPS could not be reached ('+r.status+'). No successful result has been assumed.'};return parseSaps(await r.text(),reference,identity)}catch{return {status:'unavailable',message:'SAPS is currently unreachable from the status checker. Use a signed manual check; automatic checks will retry.'}};
}
