import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.117.3';
import services from './services.json' with {type:'json'};
import {context,slots} from './calendar.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const checked=(r:any)=>{if(r.error)throw Error(r.error.message||'Booking data unavailable');return r.data};
const origins=new Set(['https://cfhp.sgcnetwork.co.za','https://sgcnetwork.co.za']);
function summary(b:any){
 const status=b.status==='awaiting_payment'&&Date.parse(b.hold_expires_at)<=Date.now()?'expired':b.status;
 const time=new Date(b.starts_at).toLocaleTimeString('en-ZA',{timeZone:'Africa/Johannesburg',hour:'2-digit',minute:'2-digit',hour12:false});
 return {id:b.id,status,paymentStatus:b.payment_status,paymentMethod:b.payment_method,amount:Number(b.amount_zar),service:b.service_name,start:b.starts_at,holdExpires:b.hold_expires_at,
 eft:{bank:'FNB (First National Bank)',account:'62210314770',branch:'250655',reference:b.customer_name+' '+time},
 checkoutUrl:b.stitch_checkout_url||null};
}
async function checkout(booking:any){
 if(booking.payment_method!=='stitch')throw Error('This booking uses bank transfer');
 if(booking.payment_status==='paid')return summary(booking);
 if(booking.status!=='awaiting_payment'||Date.parse(booking.hold_expires_at)<=Date.now())throw Error('Your unpaid slot hold expired. Please choose another appointment before paying.');
 if(booking.stitch_checkout_url)return summary(booking);
 const clientId=Deno.env.get('STITCH_CLIENT_ID'),clientSecret=Deno.env.get('STITCH_CLIENT_SECRET');
 if(!clientId||!clientSecret)throw Error('Online payment is unavailable. Please contact the business.');
 const claim=checked(await db.from('cfhp_bookings').update({checkout_started_at:new Date().toISOString()}).eq('id',booking.id).is('checkout_started_at',null).select('id').maybeSingle());
 if(!claim)throw Error('A payment link is already being prepared. Check booking status or contact the business before retrying.');
 const tokenR=await fetch('https://express.stitch.money/api/v1/token',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,clientSecret,scope:'client_paymentrequest'}),signal:AbortSignal.timeout(25000)});
 const token=await tokenR.json();if(!tokenR.ok||!token?.data?.accessToken)throw Error('Online payment could not start. Contact the business for help.');
 const merchantReference='C-'+booking.id;
 const r=await fetch('https://express.stitch.money/api/v1/payment-links',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.data.accessToken},body:JSON.stringify({amount:Math.round(Number(booking.amount_zar)*100),payerName:booking.customer_name,merchantReference,payerEmailAddress:booking.customer_email,collectDeliveryDetails:false,skipCheckoutPage:false}),signal:AbortSignal.timeout(25000)});
 const data=await r.json(),payment=data?.data?.payment;
 if(!r.ok||!payment?.link||!payment?.id)throw Error('Online payment link could not be created. Contact the business before retrying.');
 const target=new URL(payment.link);if(target.protocol!=='https:'||!(target.hostname==='stitch.money'||target.hostname.endsWith('.stitch.money')))throw Error('Payment link could not be verified.');
 checked(await db.from('sgc_stitch_transactions').insert({merchant_reference:merchantReference,stitch_payment_id:String(payment.id),customer_name:booking.customer_name,customer_email:booking.customer_email,product_id:'cfhp-booking:'+booking.id,product_name:'CFHP appointment — '+booking.service_name,amount_zar:booking.amount_zar,billing:'once',checkout_url:target.href,status:'pending'}));
 checked(await db.from('cfhp_bookings').update({stitch_checkout_url:target.href}).eq('id',booking.id));
 return {...summary(booking),checkoutUrl:target.href};
}
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'',headers={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://cfhp.sgcnetwork.co.za','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({error:'POST required'},405);
 try{
 if(origin&&!origins.has(origin))return reply({error:'Origin not allowed'},403);
 const raw=await req.text();if(raw.length>8000)return reply({error:'Request too large'},413);
 const b=JSON.parse(raw);
 if(b.action==='availability'){const service=services[b.service];if(!service||!Number.isInteger(b.service))throw Error('Choose a treatment');return reply({slots:await slots(await context(),b.date,service.minutes)});}
 if(!['book','status','checkout'].includes(b.action))throw Error('Unknown action');
 const email=String(b.email||'').trim().toLowerCase();if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Enter a valid email address');
 if(typeof b.bookingToken!=='string'||!/^[0-9a-f-]{36}$/i.test(b.bookingToken)||!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(b.id))throw Error('Invalid booking session');
 const guestHash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(b.bookingToken)))].map(n=>n.toString(16).padStart(2,'0')).join('');
 let booking=checked(await db.from('cfhp_bookings').select('*').eq('id',b.id).eq('guest_token_hash',guestHash).eq('customer_email',email).maybeSingle());
 if(b.action!=='book'){if(!booking)throw Error('Booking not found');return reply(b.action==='checkout'?await checkout(booking):summary(booking));}
 if(booking)return reply(summary(booking));
 const service=services[b.service];if(!service||!Number.isInteger(b.service))throw Error('Choose a treatment');
 if(b.consent!==true)throw Error('Please agree to share your booking details with the business');
 const name=String(b.name||'').trim(),phone=String(b.phone||'').trim().replace(/[ ()-]/g,'');
 const method=b.paymentMethod||'eft';if(!['eft','stitch'].includes(method))throw Error('Select bank transfer or Stitch. Cash payments are not accepted.');
 if(name.length<2||name.length>100||!/^\+?[\d]{7,20}$/.test(phone))throw Error('Enter your full name and phone number');
 const day=new Date(Date.parse(b.start)+7200000).toISOString().slice(0,10);
 if(!(await slots(await context(),day,service.minutes)).includes(b.start))throw Error('That appointment is no longer available');
 booking=checked(await db.rpc('cfhp_reserve',{p_data:{id:b.id,customer_email:email,guest_token_hash:guestHash,service_name:service.name,duration_minutes:service.minutes,amount_zar:service.price,customer_name:name,phone,starts_at:b.start,ends_at:new Date(Date.parse(b.start)+service.minutes*60000).toISOString(),payment_method:method}}));
 return reply(summary(booking));
 }catch(e){return reply({error:e instanceof Error?e.message:'Booking unavailable. Please try again.'},400)}
});
