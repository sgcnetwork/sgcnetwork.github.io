'use strict';
const API='https://bxpexanyoyubxeqqlggh.supabase.co';
const KEY='sb_publishable_Z0_Y-Bj_G5qw4hMgDbQlgA__jj8rGGq';
const OWNER='df627f92-e256-47eb-8a92-590ee9cf7d59';
const menu=document.querySelector('.menu');
menu.addEventListener('click',()=>{const open=document.querySelector('nav').classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
document.querySelectorAll('nav a').forEach(a=>{if(a.pathname===location.pathname&&!a.hash)a.setAttribute('aria-current','page');a.addEventListener('click',()=>{document.querySelector('nav').classList.remove('open');menu.setAttribute('aria-expanded','false');});});
const form=document.querySelector('#enquiry');
let enquiryId=crypto.randomUUID();
if(form){
 const service=new URLSearchParams(location.search).get('service');
 if([...form.elements.service.options].some(x=>x.value===service))form.elements.service.value=service;
 const params=new URLSearchParams(location.search),requested=params.get('request'),destination=params.get('destination');
 if(destination)form.elements.destination.value=destination.slice(0,100);
 if(requested){const label=document.querySelector('#requested-service');label.hidden=false;label.textContent='Your enquiry: '+requested.slice(0,150);form.elements.message.value='I would like assistance with '+requested.slice(0,150)+'.\n';}
 const date=new Date();form.elements.deadline.min=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(form.elements.website.value)return;
  const button=form.querySelector('button[type=submit]'),status=document.querySelector('#form-status');
  const data=Object.fromEntries(new FormData(form));delete data.website;data.consent=true;data.deadline=data.deadline||null;data.id=enquiryId;data.enquiry_type=(form.elements.service.value===service&&requested?requested:form.elements.service.value).slice(0,150);
  for(const key of ['name','email','phone','destination','message'])data[key]=data[key].trim();
  if(data.name.length<2){status.textContent='Please enter your full name.';return;}
  button.disabled=true;status.textContent='Sending your enquiry…';
  try{
   const r=await fetch(API+'/rest/v1/djp_enquiries',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw new Error('Unable to send');
   const refResponse=await fetch(API+'/rest/v1/rpc/djp_public_reference',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_id:enquiryId}),signal:AbortSignal.timeout(10000)});\n   const leadRef=refResponse.ok?await refResponse.json():null;\n   status.textContent='Enquiry received. Your reference is '+(leadRef||'pending confirmation')+'. DJP can now review your request and contact you using the details provided.';
   form.reset();enquiryId=crypto.randomUUID();
  }catch{status.textContent='We could not confirm your enquiry. Your details are still here. Please try again. If you already submitted, keep this reference: '+enquiryId;}
  finally{button.disabled=false;}
 });
}
let session=null;
const login=document.querySelector('#login');
if(login){
 login.addEventListener('submit',async e=>{
  e.preventDefault();const status=document.querySelector('#login-status'),b=login.querySelector('button');b.disabled=true;status.textContent='Signing in…';
  try{
   const r=await fetch(API+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(login))),signal:AbortSignal.timeout(20000)});
   const data=await r.json();if(!r.ok)throw new Error('Check your email and password, then try again.');
   if(data.user?.id!==OWNER){await fetch(API+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+data.access_token}});throw new Error('This account does not have access to the DJP inbox.');}
   session=data;login.reset();login.hidden=true;document.querySelector('#inbox').hidden=false;await loadInbox();
  }catch(err){status.textContent=err.message||'Sign-in is unavailable. Try again.';}finally{b.disabled=false;}
 });
 document.querySelector('#refresh').addEventListener('click',loadInbox);
 document.querySelector('#logout').addEventListener('click',async()=>{if(session)await fetch(API+'/auth/v1/logout',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token}}).catch(()=>{});session=null;document.querySelector('#enquiries').replaceChildren();document.querySelector('#inbox').hidden=true;login.hidden=false;document.querySelector('#login-status').textContent='Signed out.';});
}
async function loadInbox(){
 const status=document.querySelector('#inbox-status'),list=document.querySelector('#enquiries');status.textContent='Loading enquiries…';
 try{
  const r=await fetch(API+'/rest/v1/djp_enquiries?select=*&order=created_at.desc&limit=200',{headers:{apikey:KEY,Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error('Unable to load the inbox. Your session may have expired; sign out and sign in again.');
  const rows=await r.json();list.replaceChildren();status.textContent=rows.length?`${rows.length} most recent enquiries`:'No enquiries yet.';
  rows.forEach(row=>{
   const el=document.createElement('article');el.className='enquiry-row';
   function add(tag,text){const n=document.createElement(tag);n.textContent=text;el.append(n);return n;}
   add('h3',row.name+' · '+row.service);add('p',row.email+(row.phone?' · '+row.phone:''));add('p','Received '+new Date(row.created_at).toLocaleString('en-ZA')+' · Reference '+(row.lead_number?'DJP NQ'+row.lead_number:row.id));add('p','Country: '+(row.destination||'Not supplied')+' · Deadline: '+(row.deadline||'Not supplied'));add('p',row.message||'No additional message.');
   const label=add('label','Enquiry status'),select=document.createElement('select');for(const value of ['New','Contacted','In progress','Closed']){const o=document.createElement('option');o.textContent=value;o.selected=value===row.status;select.append(o);}label.append(select);
   select.addEventListener('change',async()=>{select.disabled=true;const previous=row.status;try{const response=await fetch(API+'/rest/v1/djp_enquiries?id=eq.'+encodeURIComponent(row.id),{method:'PATCH',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({status:select.value})});if(!response.ok)throw new Error();const changed=await response.json();if(changed.length!==1)throw new Error();row.status=select.value;status.textContent='Enquiry status updated.';}catch{select.value=previous;status.textContent='Could not save the status. Please try again.';}finally{select.disabled=false;}});
   list.append(el);
  });
 }catch(err){status.textContent=err.message;}
}
