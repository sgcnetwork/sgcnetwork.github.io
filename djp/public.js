'use strict';
const API='https://bxpexanyoyubxeqqlggh.supabase.co';
const KEY='sb_publishable_Z0_Y-Bj_G5qw4hMgDbQlgA__jj8rGGq';
const OWNER='df627f92-e256-47eb-8a92-590ee9cf7d59';
const menu=document.querySelector('.menu');
menu.addEventListener('click',()=>{const open=document.querySelector('nav').classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
document.querySelectorAll('nav a').forEach(a=>{if(a.pathname===location.pathname&&!a.hash)a.setAttribute('aria-current','page');a.addEventListener('click',()=>{document.querySelector('nav').classList.remove('open');menu.setAttribute('aria-expanded','false');});});
const form=document.querySelector('#enquiry');
let enquiryId=crypto.randomUUID();
// Record a Contact conversion only after the enquiry has been accepted.
const djpTrackedEnquiries=new Set();
function djpTrackContactConversion(id){
 const key='djp_contact_conversion_'+id;
 if(djpTrackedEnquiries.has(id))return;
 try{if(sessionStorage.getItem(key))return;}catch{}
 if(typeof window.gtag!=='function')return;
 try{
  window.gtag('event','ads_conversion_Contact_Us_1',{});
  djpTrackedEnquiries.add(id);
  try{sessionStorage.setItem(key,'1');}catch{}
 }catch{} // Measurement must never interrupt an enquiry.
}

const SERVICE_CATEGORIES={"SA visas":"Visa expediting","Waivers":"Visa expediting","Appeals":"Visa expediting","FBI USA clearance":"Police clearance certificate","ZIM clearance":"Police clearance certificate","DHA documents":"Document expediting","USA visa":"Visa expediting","UK visa":"Visa expediting","Schengen visa":"Visa expediting"};
if(form){
 const service=new URLSearchParams(location.search).get('service');
 if([...form.elements.service.options].some(x=>x.value===service))form.elements.service.value=service;
 const params=new URLSearchParams(location.search),requested=params.get('request'),destination=params.get('destination');
 if(destination)form.elements.destination.value=destination.slice(0,100);
 if(requested&&[...form.elements.service.options].some(x=>x.value===requested))form.elements.service.value=requested;
 if(requested){const label=document.querySelector('#requested-service');label.hidden=false;label.textContent='Your enquiry: '+requested.slice(0,150);form.elements.message.value='I would like assistance with '+requested.slice(0,150)+'.\n';}
 const date=new Date();form.elements.deadline.min=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
 form.addEventListener('submit',async e=>{
  e.preventDefault();if(form.elements.website.value)return;
  const button=form.querySelector('button[type=submit]'),status=document.querySelector('#form-status');
  const data=Object.fromEntries(new FormData(form));delete data.website;data.consent=true;data.deadline=data.deadline||null;data.id=enquiryId;data.enquiry_type=(form.elements.service.value===service&&requested?requested:form.elements.service.value).slice(0,150);
  data.service=SERVICE_CATEGORIES[data.service]||data.service;
  for(const key of ['name','email','phone','destination','message'])data[key]=data[key].trim();
  if(data.name.length<2){status.textContent='Please enter your full name.';return;}
  button.disabled=true;status.textContent='Sending your enquiry…';
  try{
   const r=await fetch(API+'/rest/v1/djp_enquiries',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(data),signal:AbortSignal.timeout(20000)});
   if(!r.ok)throw new Error('Unable to send');
   djpTrackContactConversion(enquiryId);
   const refResponse=await fetch(API+'/rest/v1/rpc/djp_public_reference',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({p_id:enquiryId}),signal:AbortSignal.timeout(10000)});
   const leadRef=refResponse.ok?await refResponse.json():null;
   status.textContent='Enquiry received. Your reference is '+(leadRef||'pending confirmation')+'. DJP can now review your request and contact you using the details provided.';
   form.reset();enquiryId=crypto.randomUUID();
  }catch{status.textContent='We could not confirm your enquiry. Your details are still here. Please try again. If you already submitted, keep this reference: '+enquiryId;}
  finally{button.disabled=false;}
 });
}
const nav=document.querySelector('nav');
if(nav){
 nav.querySelectorAll('.nav-dropdown').forEach((dropdown,index)=>{
  dropdown.setAttribute('name','djp-service-navigation');
  dropdown.addEventListener('click',event=>{
   if(event.target.closest('summary')){
    const opening=!dropdown.open;
    nav.querySelectorAll('.nav-dropdown').forEach(other=>{if(other!==dropdown)other.open=false;});
    try{sessionStorage.setItem('djp-open-service-menu',opening?String(index):'');}catch{}
   }
  });
  dropdown.addEventListener('toggle',()=>{
   if(dropdown.open)nav.querySelectorAll('.nav-dropdown').forEach(other=>{if(other!==dropdown)other.open=false;});
  });
 });
 try{
  const saved=sessionStorage.getItem('djp-open-service-menu');
  if(saved!==null&&saved!==''){const d=nav.querySelectorAll('.nav-dropdown')[Number(saved)];if(d)d.open=true;}
 }catch{}
 nav.addEventListener('keydown',event=>{if(event.key==='Escape'){nav.querySelectorAll('.nav-dropdown').forEach(d=>d.open=false);try{sessionStorage.removeItem('djp-open-service-menu');}catch{}}});
}
