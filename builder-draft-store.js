(function(root){
'use strict';
const copy=v=>JSON.parse(JSON.stringify(v));
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function merge(base,local,remote){
 const result=copy(remote||{}),conflicts=[];
 for(const key of new Set([...Object.keys(base||{}),...Object.keys(local||{})])){
  if(equal(base?.[key],local?.[key]))continue;
  if(!equal(base?.[key],remote?.[key])&&!equal(local?.[key],remote?.[key])){conflicts.push(key);continue;}
  if(Object.hasOwn(local,key))result[key]=copy(local[key]);else delete result[key];
 }
 if(conflicts.length)throw Error('This website changed in another editor. Reload before saving these sections: '+conflicts.join(', ')+'. Your draft is still on this device.');
 return result;
}
function create({client,userId,site,onSaved}){
 let baseline=copy(site?.builder_preferences||{}),record=site||null,queue=Promise.resolve();
 const fields={name:'business_name',slug:'slug',desc:'description',font:'font',primary:'primary_color',accent:'accent_color',product:'product_name',price:'product_price'};
 function save(preferences){
  const next=copy(preferences),base=copy(baseline);
  const operation=async()=>{
   // Compare a fresh row and use updated_at as a lease. A concurrent write cannot silently win.
   const {data:latest,error:readError}=await client.from('sgc_student_websites').select('*').eq('user_id',userId).maybeSingle();
   if(readError)throw readError;
   const combined=merge(base,next,latest?.builder_preferences||{});
   const row={user_id:userId,builder_preferences:combined,updated_at:new Date().toISOString()};
   for(const [key,column] of Object.entries(fields))if(combined._site?.[key]!=null)row[column]=key==='price'?Number(combined._site[key])||0:combined._site[key];
   let query;
   if(latest)query=client.from('sgc_student_websites').update(row).eq('user_id',userId).eq('updated_at',latest.updated_at);
   else query=client.from('sgc_student_websites').insert(row);
   const {data:saved,error}=await query.select('*').maybeSingle();
   if(error)throw error;
   if(!saved)throw Error('Another editor saved at the same time. Your draft is safe; save again to reconcile the changes.');
   baseline=copy(combined);record=saved;onSaved?.(copy(combined),saved);return copy(combined);
  };
  const task=queue.then(operation);queue=task.catch(()=>{});return task;
 }
 return {save,getRecord:()=>record};
}
const api={merge,create};if(typeof module==='object'&&module.exports)module.exports=api;else root.SgcBuilderDraft=api;
})(typeof window==='object'?window:globalThis);
