(()=>{
 if(new URLSearchParams(location.search).get('page')!=='treatments')return;
 const base='https://bxpexanyoyubxeqqlggh.supabase.co',key='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ4cGV4YW55b3l1YnhlcXFsZ2doIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk4NDQ5NTYsImV4cCI6MjEwNTQyMDk1Nn0.H4ce_CCaDtL52jcZuw5114d-Tr1DDWvSzCbHlybDqjo';
 const el=id=>document.getElementById(id),dialog=el('booking'),msg=el('booking-message');
 let selected=null,reference=null,bookingToken=null,email=null,generation=0,submitting=false,receipt=null;
 async function api(body){const r=await fetch(base+'/functions/v1/cfhp-bookings',{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw Error(data.error||'Unable to complete booking');return data}
 function auth(action){return {action,id:reference,bookingToken,email}}
 function remember(){sessionStorage.setItem('cfhp-pending-booking',JSON.stringify({selected,reference,bookingToken,email,receipt}));resume.hidden=false;}
 function renderReceipt(data){
  receipt=data;el('booking-form').hidden=true;el('booking-payment').hidden=false;el('booking-title').textContent=data.service;
  el('payment-amount').textContent='Amount due: R'+Number(data.amount).toFixed(2);
  el('payment-reference').textContent='Booking reference: '+data.id;
  el('payment-when').textContent=new Date(data.start).toLocaleString('en-ZA',{timeZone:'Africa/Johannesburg'})+' (South African time)';
  el('eft-instructions').hidden=data.paymentMethod!=='eft';el('stitch-instructions').hidden=data.paymentMethod!=='stitch';
  el('eft-reference').textContent=data.eft.reference;
  const awaiting=data.status==='awaiting_payment'&&data.paymentStatus!=='paid';
  el('stitch-create').hidden=!awaiting||data.paymentMethod!=='stitch'||!!data.checkoutUrl;
  el('stitch-link').hidden=!awaiting||data.paymentMethod!=='stitch'||!data.checkoutUrl;
  if(data.checkoutUrl)el('stitch-link').href=data.checkoutUrl;
  el('payment-hold').textContent=awaiting?'Your unpaid slot is held until '+new Date(data.holdExpires).toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit'})+'. Pay immediately and ask the business to verify it before the hold expires.':'';
  const messages={awaiting_payment:'Awaiting payment. CFHP must verify payment and accept your appointment before an invitation is sent.',awaiting_acceptance:'Payment received. Awaiting CFHP acceptance. Your invitation will follow after acceptance.',pending_calendar:'Payment verified and appointment accepted. The Google Calendar invitation is being prepared.',confirmed:'Appointment accepted. Your Google Calendar invitation has been sent.',expired:'Your unpaid slot hold has expired. Contact CFHP before paying, or start a new booking.',payment_review:'Payment received, but this appointment needs review. Please contact CFHP to arrange the time or a refund.',cancelled:'This appointment has been cancelled.',failed:'This appointment could not be completed. Please contact CFHP.'};
  el('payment-status').textContent=messages[data.status]||data.status;remember();
 }
 const resume=document.createElement('button');resume.type='button';resume.className='button';resume.textContent='View pending appointment / payment';resume.hidden=true;el('service-list').before(resume);
 resume.onclick=async()=>{msg.textContent='';dialog.showModal();try{renderReceipt(await api(auth('status')))}catch(e){el('payment-status').textContent=e.message}};
 try{const saved=JSON.parse(sessionStorage.getItem('cfhp-pending-booking')||'null');if(saved?.reference&&saved?.bookingToken){({selected,reference,bookingToken,email,receipt}=saved);resume.hidden=false;}}catch{}
 el('dialog-link').addEventListener('click',e=>{const idx=e.currentTarget.dataset.service;if(idx===undefined)return;e.preventDefault();el('details').close();selected=Number(idx);reference=null;bookingToken=null;receipt=null;el('booking-title').textContent=el('dialog-title').textContent;el('booking-form').reset();el('booking-form').hidden=false;el('booking-payment').hidden=true;el('booking-date').disabled=false;el('booking-time').disabled=false;el('booking-date').value='';el('booking-time').replaceChildren(new Option('Choose a date first',''));el('booking-submit').disabled=false;msg.textContent='';dialog.showModal()});
 el('booking-close').onclick=()=>{if(!submitting)dialog.close()};
 el('booking-date').min=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Johannesburg',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 el('booking-date').addEventListener('change',async()=>{const version=++generation;reference=null;bookingToken=null;el('booking-time').replaceChildren(new Option('Checking availability…',''));el('booking-time').disabled=true;msg.textContent='';try{const data=await api({action:'availability',service:selected,date:el('booking-date').value});if(version!==generation)return;el('booking-time').replaceChildren(new Option(data.slots.length?'Select a time':'No appointments available',''));for(const start of data.slots)el('booking-time').add(new Option(new Date(start).toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hour12:false}),start));}catch(e){if(version===generation){el('booking-time').replaceChildren(new Option('Unavailable',''));msg.textContent=e.message}}finally{if(version===generation)el('booking-time').disabled=false}});
 el('booking-time').onchange=()=>{reference=null;bookingToken=null};
 el('booking-form').onsubmit=async e=>{e.preventDefault();if(submitting)return;if(!el('booking-time').value){msg.textContent='Choose an available time.';return}submitting=true;el('booking-submit').disabled=true;msg.textContent='Reserving your appointment…';reference=reference||crypto.randomUUID();bookingToken=bookingToken||crypto.randomUUID();email=el('booking-email').value.trim().toLowerCase();try{const data=await api({...auth('book'),service:selected,start:el('booking-time').value,name:el('booking-name').value,phone:el('booking-phone').value,paymentMethod:el('booking-payment-method').value,consent:el('booking-consent').checked});renderReceipt(data);msg.textContent='';}catch(e){msg.textContent=e.message}finally{submitting=false;el('booking-submit').disabled=false}};
 el('payment-check').onclick=async()=>{const b=el('payment-check');b.disabled=true;try{renderReceipt(await api(auth('status')))}catch(e){el('payment-status').textContent=e.message}finally{b.disabled=false}};
 el('stitch-create').onclick=async()=>{const b=el('stitch-create');b.disabled=true;el('payment-status').textContent='Preparing your secure Stitch payment…';try{renderReceipt(await api(auth('checkout')))}catch(e){el('payment-status').textContent=e.message}finally{b.disabled=false}};
 dialog.addEventListener('close',()=>{generation++});
})();
