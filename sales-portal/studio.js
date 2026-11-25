'use strict';
const config = window.SGC_CONFIG;
const stages = ['New lead','Contact attempted','Contacted','Interested','Discovery completed','Preview requested','Preview in development','Preview sent','Follow-up','Proposal sent','Customer accepted','Awaiting payment','Payment confirmed','Closed successfully','Not interested','Do not contact'];
const previewStages = ['Requested','Awaiting review','Approved','In development','Ready for review','Ready to send','Sent to customer','Revision requested','Accepted','Declined'];
const outcomes = ['Interested','Not interested','Call back later','Already has a website','Interested in upgrading','Wants more information','No answer','Wrong number','Do not contact'];
const discovery = ['What type of business do you operate?','What products or services do you offer?','Do you currently have a website or business management system?','What type of website or system are you looking for?','What challenges are you currently experiencing?','Would you like customers to book appointments online?','Would you like customers to place orders and pay online?','Would you benefit from a financial or administrative dashboard?','What colours represent your business?','What theme, style or overall vibe would you prefer?','Are there any websites you like that we can use as inspiration?','Are there any additional features you require?'];
const leadFields = {name:'Business name',contact:'Contact person',industry:'Industry',location:'Location',email:'Email',phone:'Telephone',whatsapp:'WhatsApp',website:'Website',social:'Social links',source:'Lead source',lawful_basis:'Lawful basis',follow_up:'Follow-up date',notes:'Notes'};
const templates = {
 'Introduction':'Could a website, booking system or business dashboard make things easier for your team?',
 'After our call':'Thank you for speaking with me. I’d be happy to help with the requirements we discussed.',
 'Free preview confirmation':'We’ve received the details for your free preview. Our estimated turnaround is 2–5 days.',
 'Preview delivery':'Your customised preview is ready to view.',
 'Product and pricing proposal':'Here’s the option we discussed. We can confirm the scope and pricing together.',
 'Proposal follow-up':'Have you had a chance to look at the proposal? I’d be happy to answer your questions.',
 'Customer acceptance':'Thank you for confirming you’d like to proceed. We’ll confirm the agreed terms before checkout.',
 'Subscription payment request':'We’ll share your secure authorisation link once it is available.',
 'Customer onboarding':'Welcome to SGC Network. Let us know who should be your main project contact.'
};
const app = document.querySelector('#app');
const nav = document.querySelector('#nav');
const notice = document.querySelector('#notice');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = cents => new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(cents/100);
const safeLink = path => {
  try {
    const url = new URL(path, 'https://sgcnetwork.co.za');
    return url.protocol === 'https:' && (url.hostname === 'sgcnetwork.co.za' || url.hostname.endsWith('.sgcnetwork.co.za')) ? url.href : '#';
  } catch { return '#'; }
};
let token, account, member, products=[], leads=[], commissions=[], previews=[], team=[], audit=[];
let page='Dashboard', activeLead, channel='Call', callStep=0, showDiscovery=false, history=[], preferences=[];
let filters = {};
const admin = () => member?.role === 'admin';
const lead = () => leads.find(item => item.id === activeLead);
const product = id => products.find(item => item.id === id);
const select = (name, options, current) => '<select name="'+esc(name)+'">'+options.map(option => {
  const [value,label] = Array.isArray(option) ? option : [option,option];
  return '<option value="'+esc(value)+'" '+(value === current ? 'selected' : '')+'>'+esc(label)+'</option>';
}).join('')+'</select>';
const input = (name,value,type='text',required=false) => '<input name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required':'')+'>';
const formValues = form => Object.fromEntries(new FormData(form));

async function request(path, method='GET', body) {
  const response = await fetch(config.supabaseUrl+path,{
    method, headers:{apikey:config.supabasePublishableKey,...(token ? {Authorization:'Bearer '+token}:{}),
      'Content-Type':'application/json',Prefer:'return=representation'},
    body:body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(()=>null);
  if (!response.ok) throw new Error(data?.msg || data?.message || 'Request failed ('+response.status+')');
  return data;
}
const rows = (table,query='') => request('/rest/v1/sales_'+table+'?'+query);
const patch = (table,id,body) => request('/rest/v1/sales_'+table+'?id=eq.'+encodeURIComponent(id),'PATCH',body);
const insert = (table,body) => request('/rest/v1/sales_'+table,'POST',body);
const rpc = (name,body) => request('/rest/v1/rpc/sales_'+name,'POST',body);
let agreements=[], payments=[], rates, outreach;
async function reload() {
  [products,leads,commissions,previews,team,audit,agreements,payments,rates,outreach] = await Promise.all([
    rows('products','order=name'),rows('leads','order=created_at.desc'),rows('commissions','order=paid_at.desc'),
    rows('previews','order=requested_at.desc'),admin()?rows('team','order=name'):[],admin()?rows('audit','order=occurred_at.desc&limit=100'):[],rows('terms'),admin()?rows('payments','order=verified_at.desc'):[],admin()?rows('rates').then(r=>r[0]):null,rows('outreach_settings','select=enabled,bcc&id=eq.1').then(r=>r[0])
  ]);
}
async function loadLead(id) {
  activeLead=id;
  callStep=0;
  showDiscovery=false;
  [history,preferences]=await Promise.all([rows('activity','lead=eq.'+id+'&order=recorded_at.desc'),rows('preferences','lead=eq.'+id+'&order=id.desc')]);
}
function report(message) {
  notice.textContent=message;
  clearTimeout(report.timer);
  report.timer=setTimeout(()=>{notice.textContent='';},6500);
}
function login() {
  app.innerHTML='<section class="hero panel"><div class="intro"><h1>Sales Studio</h1><p>Manage leads, prepare client previews and track your commissions.</p></div><form id="login" class="panel login"><h2>Sign in</h2><label>Work account email'+input('email','','email',true)+'</label><label>Password'+input('password','','password',true)+'</label><button class="primary">Sign in</button></form></section>';
}
function catalogue() {
  return '<div class="catalogue">'+products.map(p=>'<article class="panel"><img alt="" loading="lazy" src="'+esc(safeLink(p.image))+'"><div class="body"><h3>'+esc(p.name)+'</h3><p><b>'+esc(p.price)+'</b></p><p>'+esc(p.pitch)+'</p><p class="muted">'+esc(p.industries)+' · '+esc(p.features)+'</p><a target="_blank" rel="noopener" href="'+esc(safeLink(p.preview))+'">See example ↗</a></div></article>').join('')+'</div>';
}
function dashboard() {
  const earned = commissions.filter(c=>['Approved','Paid'].includes(c.status)).reduce((sum,c)=>sum+c.amount_cents,0);
  const metrics = [[money(earned),'Total earnings'],[leads.length,'Total leads'],[leads.filter(l=>l.stage==='Closed successfully').length,'Total closed deals']];
  return '<section class="hero panel"><h1>Sales dashboard</h1><p>Welcome, '+esc(member.name)+'.</p><button class="primary" data-page="Lead Generation">Work through leads →</button></section><div class="metrics">'+metrics.map(([value,label])=>'<article class="panel"><strong>'+value+'</strong>'+label+'</article>').join('')+'</div><h2>What SGC Network offers</h2>'+catalogue();
}
function leadEditor(l) {
  const editable=stages;
  if(!editable.includes(l.stage)) editable.push(l.stage);
  return '<form id="lead-edit"><div class="fields">'+Object.entries(leadFields).map(([key,label])=>'<label>'+label+(key==='notes'?'<textarea name="notes">'+esc(l.notes)+'</textarea>':input(key,l[key],key==='follow_up'?'date':key==='email'?'email':'text')).replace('name="name"','name="name" readonly')+'</label>').join('')+
    '<label>Stage'+select('stage',editable,l.stage)+'</label><label>Product'+select('product',[['','Select product'],...products.map(p=>[p.id,p.name])],l.product)+'</label>'+
    '</div><small class="muted">Fields save when you leave them.</small></form>';
}
function privacy(l) {
  return '<details><summary>Consent and contact preferences</summary><p><a target="_blank" rel="noopener" href="/privacy.html">SGC Network privacy notice ↗</a></p>'+
    ['email','whatsapp','telephone'].map(c=>{const p=preferences.find(item=>item.channel===c);return '<p>'+c+' · '+esc(p ? p.permission+' · '+p.recorded_at.slice(0,10)+' · '+p.evidence : 'No permission recorded')+'</p>';}).join('')+
    (l.opted_out?'<p>Do not contact</p>':'<form id="consent"><div class="fields"><label>Channel'+select('channel',['email','whatsapp','telephone'])+'</label><label>Permission'+select('permission',['granted','declined','withdrawn'])+'</label><label>Method'+input('method','','text',true)+'</label><label>Evidence'+input('evidence','','text',true)+'</label></div><button>Record permission</button></form>')+'</details>';
}
function call(l) {
  const script = [
    'Good morning/afternoon. My name is '+member.name+', and I’m calling from SGC Network. Am I speaking to the business owner or the person responsible for managing the business? Is now a convenient time to speak?',
    'We specialise in helping businesses grow through professional websites, online stores, booking systems, payment integrations and business automation. Our goal is to make running your business easier while helping you reach more customers.',
    'Would you be interested in seeing what a customised website or business management system could look like for your business?'
  ];
  return '<p>'+esc(script[callStep])+'</p>'+
    (callStep<2?'<button class="primary" data-call-next>Continue script →</button>':'<div class="actions">'+outcomes.map(outcome=>'<button data-outcome="'+esc(outcome)+'">'+esc(outcome)+'</button>').join('')+'</div>')+
    (showDiscovery?'<hr><h3>Business discovery</h3><form id="discovery">'+discovery.map((q,i)=>'<label>'+q+'<textarea name="'+i+'">'+esc(l.discovery[i])+'</textarea></label>').join('')+'<button>Save discovery</button></form><hr><p>Based on what you’ve shared with me, we’d love to prepare a free customised preview for your business. Our estimated turnaround is 2–5 days. There is no obligation to purchase. May we contact you by email or WhatsApp to share your preview and discuss your requirements further?</p><p>Record their permission under Consent and contact preferences.</p>':'');
}
function outreachAllowed(method) {
  return outreach?.enabled && preferences.find(item=>item.channel===method)?.permission==='granted';
}
let emailKey;
function composer(l) {
  const preview=previews.find(p=>p.lead===l.id&&p.url&&['Ready to send','Sent to customer','Accepted'].includes(p.stage));
  const p=product(l.product);
  const stage=filters.template||Object.keys(templates)[0];
  const body=['Hi '+(l.contact||l.name)+',','I’m '+member.name+' from SGC Network.',templates[stage],p?.pitch,p?'Example: '+safeLink(p.preview):'Portfolio: https://sgcnetwork.co.za/portfolio/',preview?'Your preview: '+safeLink(preview.url):'','https://sgcnetwork.co.za/','Reply if you would prefer us to stop contacting you.'].filter(Boolean).join('\n\n');
  return '<form id="compose"><label>Template'+select('template',Object.keys(templates),stage)+'</label>'+
    (channel==='Email'?'<label>From<input readonly value="'+esc(member.sender)+'"></label><label>To<input readonly value="'+esc(l.email)+'"></label><label>BCC<input readonly value="'+esc(outreach?.bcc||'Requires central mailbox configuration')+'"></label><label>Subject'+input('subject',stage+' · '+l.name)+'</label>':'')+
    '<label>Message<textarea name="body" rows="10">'+esc(body)+'</textarea></label>'+(!outreachAllowed(channel.toLowerCase())?'<p class="muted">Outbound outreach requires compliance approval and current permission for this channel.</p>':'')+'<div class="actions"><button>Save prepared draft</button>'+
    (channel==='Email'&&outreachAllowed('email')&&outreach.bcc&&member.sender&&l.email?'<button class="primary" value="send">Send email</button>':'')+
    (channel==='WhatsApp'&&outreachAllowed('whatsapp')&&l.whatsapp?'<button class="primary" value="open">Open WhatsApp</button>':'')+'</div></form>';
}
function agreement(l) {
  const a=agreements.find(item=>item.id===l.id);
  if(!a && !['Customer accepted','Awaiting payment'].includes(l.stage))return '';
  if(!a)return '<details><summary>Customer agreement</summary><form id="agreement"><label>Package'+input('package_name',product(l.product)?.name,'text',true)+'</label><label>Billing'+select('billing',['Monthly','Once-off'])+'</label><label>Agreed amount (ZAR)<input name="amount" type="number" min=".01" step=".01" required></label><label>Joining fee (ZAR)<input name="joining" type="number" min="0" step=".01" value="0" required></label><label>Agreed terms<textarea name="terms" required></textarea></label><button>Save customer agreement</button></form></details>';
  const records=payments.filter(p=>p.lead===l.id);
  const verify='<form id="verify-payment"><h3>Record a verified payment</h3><p>Verify the payment against the provider statement before recording it. Enter only the eligible subscription or project amount.</p><label>Provider reference'+input('provider_reference','','text',true)+'</label><label>Amount verified (ZAR)<input name="amount" type="number" min=".01" step=".01" required></label><label>Installment<input name="installment" type="number" min="1" step="1" required value="1"></label><label>Verification evidence'+input('evidence_text','','text',true)+'</label><button>Record verified payment</button></form>';
  const reversals=records.filter(p=>p.status==='Verified');
  const reverse=reversals.length?'<form id="reverse-payment"><label>Payment'+select('provider_reference',reversals.map(p=>p.reference))+'</label><label>Reason'+select('reason',['Refunded','Charged back'])+'</label><button>Record reversal</button></form>':'';
  return '<details><summary>Customer agreement and payment</summary><p>'+esc(a.package)+' · '+money(a.amount_cents)+' '+esc(a.frequency)+' · Joining fee '+money(a.joining_cents)+'</p><p>Customer reference '+esc(a.reference)+'</p><p>'+esc(a.agreed_terms)+'</p><p>PayGate checkout awaits merchant setup.</p>'+
    (admin()?verify+records.map(p=>'<p>'+esc(p.reference)+' · '+money(p.amount_cents)+' · '+esc(p.status)+'</p>').join('')+reverse:'')+'</details>';
}
function assignment(l) {
  if(!admin())return '';
  const options=[['','Return to shared queue'],...team.filter(t=>t.active||t.id===l.assignee).map(t=>[t.id,t.name+(t.active?'':' (suspended)')])];
  return '<hr><form id="assignment"><label>Lead assignment'+select('assignee',options,l.assignee||'')+
    '</label><button>Approve assignment change</button></form>';
}
function leadWorkspace() {
  const l=lead();
  const pick=admin()?'':'<button class="primary" data-claim>Pick a new lead →</button>';
  if(!l) return '<h1>Lead Generation</h1><p>No leads are assigned to your workspace.</p>'+(admin()?'<button data-page="Administrator">Manage leads</button>':pick);
  return '<h1>Lead Generation</h1><div class="actions panel"><label>Customer'+select('lead',leads.map(item=>[item.id,item.name]),l.id)+'</label><button data-next>Next assigned lead →</button>'+pick+'</div>'+
    '<div class="split"><section class="panel"><h2>'+esc(l.name)+'</h2>'+leadEditor(l)+assignment(l)+privacy(l)+agreement(l)+
    '<details><summary>Contact history</summary><div class="timeline">'+history.map(item=>'<p><b>'+esc(item.channel)+' · '+esc(item.status)+'</b> · '+esc(item.recorded_at.slice(0,10))+'<br>'+esc(item.detail)+'</p>').join('')+'</div></details></section>'+
    '<section class="panel"><div class="actions">'+['Call','Email','WhatsApp'].map(item=>'<button data-channel="'+item+'" aria-pressed="'+(channel===item)+'">'+item+'</button>').join('')+'</div><hr>'+
    (l.opted_out?'<p>This business has opted out of contact.</p>':channel==='Call'?call(l):composer(l))+
    (l.opted_out?'':'<hr><details><summary>Request a free preview</summary><form id="preview"><label>Product'+select('product',products.map(p=>[p.id,p.name]),l.product)+'</label>'+
    ['Business description','Colours','Theme and style','Required features','Reference websites','Additional requirements'].map(key=>'<label>'+key+'<textarea name="'+key+'"></textarea></label>').join('')+'<button class="primary">Submit preview brief</button></form></details>')+'</section></div>';
}
function pipeline() {
  const visible=leads.filter(l=>(!filters.industry||l.industry===filters.industry)&&(!filters.product||l.product===filters.product)&&(!filters.follow_up||l.follow_up===filters.follow_up)&&(!filters.stage||l.stage===filters.stage));
  return '<h1>Sales pipeline</h1><div class="fields panel"><label>Industry'+select('industry',[['','All industries'],...new Set(leads.map(l=>l.industry).filter(Boolean))],filters.industry)+'</label><label>Product'+select('productFilter',[['','All products'],...products.map(p=>[p.id,p.name])],filters.product)+'</label><label>Follow-up date'+input('follow_up',filters.follow_up,'date')+'</label><label>Stage'+select('stageFilter',[['','All stages'],...stages],filters.stage)+'</label></div><div class="pipeline">'+stages.filter(s=>!filters.stage||s===filters.stage).map(s=>'<section class="lane"><h3>'+s+'</h3>'+visible.filter(l=>l.stage===s).map(l=>'<button data-lead="'+l.id+'">'+esc(l.name)+'</button>').join('')+'</section>').join('')+'</div>';
}
function previewPage() {
  return '<h1>Preview requests</h1>'+(previews.length?previews.map(p=>'<article class="panel"><h3>'+esc(leads.find(l=>l.id===p.lead)?.name)+' · '+esc(product(p.product)?.name)+'</h3><p>'+esc(p.stage)+' · Estimated delivery '+esc(p.due)+'</p><details><summary>View brief</summary>'+Object.entries(p.brief).map(([key,value])=>'<p><b>'+esc(key)+'</b> '+esc(value)+'</p>').join('')+'</details>'+
    (p.url?'<p><a target="_blank" rel="noopener" href="'+esc(safeLink(p.url))+'">Open live preview ↗</a></p>':'')+
    (admin()?'<form data-preview="'+p.id+'"><div class="fields"><label>Stage'+select('stage',previewStages,p.stage)+'</label><label>Live SGC Network URL'+input('url',p.url,'url')+'</label><label>Estimated delivery'+input('due',p.due,'date',true)+'</label></div><button>Update preview</button></form>':'')+'</article>').join(''):'<p>No preview requests yet.</p>');
}
function commissionPage() {
  const totals = Object.groupBy ? Object.groupBy(commissions,c=>c.status) : commissions.reduce((groups,c)=>({...groups,[c.status]:[...(groups[c.status]||[]),c]}),{});
  const months=Array.from({length:6},(_,i)=>{const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-5+i);const key=d.toISOString().slice(0,7);return [key,commissions.filter(c=>c.paid_at.slice(0,7)===key&&c.status!=='Reversed').reduce((a,c)=>a+c.amount_cents,0)];});
  const max=Math.max(1,...months.map(m=>m[1]));
  return '<h1>Commissions</h1><div class="metrics">'+['Pending','Approved','Paid','Reversed'].map(status=>'<article class="panel"><strong>'+money((totals[status]||[]).reduce((a,c)=>a+c.amount_cents,0))+'</strong>'+status+'</article>').join('')+'</div><section class="panel"><h2>Monthly commission</h2><div class="chart">'+months.map(([month,amount])=>'<div><small>'+money(amount)+'</small><i style="height:'+Math.max(4,Math.round(100*amount/max))+'px"></i><small>'+month+'</small></div>').join('')+'</div></section><div class="panel table"><table><thead><tr><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>'+commissions.map(c=>'<tr><td>'+esc(leads.find(l=>l.id===c.lead)?.name||'Customer')+'</td><td>'+esc(c.paid_at.slice(0,10))+'</td><td>'+money(c.amount_cents)+'</td><td>'+esc(c.status)+(admin()&&['Pending','Approved'].includes(c.status)?' <button data-commission="'+c.id+'" data-status="'+(c.status==='Pending'?'Approved':'Paid')+'">'+(c.status==='Pending'?'Approve':'Record payout')+'</button>':'')+'</td></tr>').join('')+'</tbody></table></div>';
}
function adminPage() {
  return '<h1>Administrator</h1><section class="panel"><h2>Lead allocation</h2><p>New uploads go into the shared queue. When a consultant picks a lead, it is assigned to them. Use Lead Generation to approve a reassignment or return a lead to the queue.</p><form id="new-lead"><div class="fields">'+Object.entries(leadFields).slice(0,10).map(([key,label])=>'<label>'+label+input(key,'',key==='email'?'email':'text',key==='name'||key==='source')+'</label>').join('')+'</div><button class="primary">Add lead</button></form><hr><label>Upload CSV with name and source headers<input type="file" name="csv" accept=".csv,text/csv"></label><button data-export>Export leads</button></section>'+
    '<section class="panel"><h2>Consultants</h2><form id="enrol"><div class="fields"><label>Consultant name'+input('display_name','','text',true)+'</label><label>Confirmed work account email'+input('work_email','','email',true)+'</label></div><button>Enrol existing work account</button></form><hr>'+team.map(t=>'<form class="panel" data-team="'+t.id+'"><div class="fields"><label>Name'+input('name',t.name,'text',true)+'</label><label>Sender'+input('sender',t.sender,'email',t.role!=='admin')+'</label><label>Access'+select('active',[['true','Active'],['false','Suspended']],String(t.active))+'</label></div><p>'+esc(t.role)+' · '+leads.filter(l=>l.assignee===t.id).length+' assigned leads</p><button>Update account</button></form>').join('')+'</section>'+
    '<section class="panel"><h2>Catalogue management</h2>'+products.map(p=>'<details><summary>'+esc(p.name)+'</summary><form data-product="'+esc(p.id)+'" class="fields">'+['name','price','pitch','industries','features','preview','image'].map(key=>'<label>'+key+input(key,p[key],'text',true)+'</label>').join('')+'<button>Update product</button></form></details>').join('')+'</section>'+
    (rates?'<section class="panel"><h2>Commission rates</h2><form id="rates"><div class="fields">'+[['first_bps','First monthly payment'],['repeat_bps','Following 11 monthly payments'],['project_bps','Once-off project']].map(([key,label])=>'<label>'+label+' (%)<input name="'+key+'" type="number" required min="0" max="100" step="0.01" value="'+(rates[key]/100)+'"></label>').join('')+'</div><button>Update rates</button></form></section>':'')+
    '<section class="panel"><h2>Audit history</h2>'+audit.map(a=>'<p>'+esc(a.occurred_at.slice(0,16))+' · '+esc(a.entity)+' · '+esc(a.operation)+'</p>').join('')+'</section>';
}
function render() {
  if(!member) {nav.replaceChildren();login();return;}
  const pages=['Dashboard','Lead Generation','Pipeline','Preview Requests','Commissions',...(admin()?['Administrator']:[])];
  nav.innerHTML=pages.map(p=>'<button data-page="'+p+'" '+(p===page?'aria-current="page"':'')+'>'+p+'</button>').join('')+'<button data-signout>Sign out</button>';
  app.innerHTML='<div class="page">'+({'Dashboard':dashboard,'Lead Generation':leadWorkspace,Pipeline:pipeline,'Preview Requests':previewPage,Commissions:commissionPage,Administrator:adminPage}[page])()+'</div>';
}
function parseCSV(source) {
  const rows=[];let row=[], cell='', quoted=false;
  const content=source.replace(/^\uFEFF/,'');
  for(let i=0;i<content.length;i++){
    const char=content[i];
    if(char==='"' && quoted && content[i+1]==='"'){cell+='"';i++;}
    else if(char==='"' && (quoted||!cell)) quoted=!quoted;
    else if(char===','&&!quoted){row.push(cell);cell='';}
    else if((char==='\n'||char==='\r')&&!quoted){row.push(cell);rows.push(row);row=[];cell='';if(char==='\r'&&content[i+1]==='\n')i++;}
    else cell+=char;
  }
  if(quoted) throw new Error('A CSV field has an unclosed quote.');
  if(row.length||cell)rows.push([...row,cell]);
  const headers=rows.shift()?.map(h=>h.trim().toLowerCase())||[];
  if(!headers.includes('name')||!headers.includes('source')) throw new Error('CSV needs name and source headers.');
  const accepted=Object.keys(leadFields).slice(0,10);
  return rows.filter(r=>r.some(Boolean)).map(r=>Object.fromEntries(headers.flatMap((h,i)=>accepted.includes(h)?[[h,r[i]?.trim()||'']]:[])));
}
function exportCsv(){
  const keys=[...Object.keys(leadFields),'stage'];
  const quote=value=>'"'+String(value??'').replace(/^[\s]*[=+@-]|^[\t\r\n]/, m=>"'"+m).replaceAll('"','""')+'"';
  const text=[keys.join(','),...leads.map(l=>keys.map(k=>quote(l[k])).join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='sgc-sales-leads.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
let pending=Promise.resolve();
function run(action) {
  pending=pending.then(action).catch(error=>report(error.message));
}
document.addEventListener('click', event=>{
  const button=event.target.closest('button');
  if(!button)return;
  const data=button.dataset;
  if(!Object.keys(data).length)return;
  if('claim' in data)button.disabled=true;
  run(async()=>{
    if('signout' in data){
      try{await request('/auth/v1/logout','POST');}
      finally{token=account=member=activeLead=null;products=[];leads=[];commissions=[];previews=[];team=[];audit=[];agreements=[];payments=[];rates=null;outreach=null;emailKey=null;history=[];preferences=[];filters={};page='Dashboard';render();}
      return;
    }
    if(data.commission){await patch('commissions',data.commission,{status:data.status});await reload();}
    if(data.page) {page=data.page;if(page==='Lead Generation'&&!lead()&&leads.length)await loadLead(leads[0].id);}
    if(data.lead){await loadLead(data.lead);page='Lead Generation';}
    if('claim' in data){
      try{
        const id=await rpc('claim_lead',{});
        await reload();
        const selected=id||lead()?.id||leads[0]?.id;
        if(selected)await loadLead(selected);
        report(id?'Lead assigned to you.':'No leads are available in the shared queue.');
      }finally{button.disabled=false;}
    }
    if('next' in data)await loadLead(leads[(leads.findIndex(l=>l.id===activeLead)+1)%leads.length].id);
    if(data.channel)channel=data.channel;
    if('callNext' in data)callStep++;
    if(data.outcome){
      const l=lead();
      await insert('activity',{lead:l.id,channel:'call',status:'Outcome recorded',detail:data.outcome});
      showDiscovery=['Interested','Interested in upgrading','Wants more information'].includes(data.outcome);
      const stage=showDiscovery?'Interested':({'Not interested':'Not interested','Do not contact':'Do not contact','Call back later':'Follow-up','Already has a website':'Contacted'}[data.outcome]||'Contact attempted');
      Object.assign(l,(await patch('leads',l.id,{stage}))[0]);
      history=await rows('activity','lead=eq.'+l.id+'&order=recorded_at.desc');
    }
    if('export' in data){exportCsv();return;}
    render();
  });
});
document.addEventListener('change', event=>{
  const el=event.target;
  run(async()=>{
    if(el.form?.id==='lead-edit'&&el.name!=='name'){
      const l=lead();
      const changes={[el.name]:el.value||null};
      Object.assign(l,(await patch('leads',l.id,changes))[0]);
      report('Saved');
      if(el.name==='stage'||el.name==='product')render();
      return;
    }
    if(el.name==='csv'&&el.files[0]){
      const importRows=parseCSV(await el.files[0].text());let saved=0;const failed=[];
      for(const row of importRows){
        try{await insert('leads',row);saved++;}
        catch(error){failed.push(row.name+': '+error.message);}
      }
      await reload();render();
      report(saved+' imported. '+failed.length+' skipped. '+failed.slice(0,3).join(' · '));
    }
    if(el.name==='lead'){await loadLead(el.value);render();}
    const filterName={industry:'industry',productFilter:'product',follow_up:'follow_up',stageFilter:'stage',template:'template'}[el.name];
    if(filterName){filters[filterName]=el.value;render();}
  });
});
document.addEventListener('submit', event=>{
  event.preventDefault();
  const form=event.target;
  const values=formValues(form);
  const action=event.submitter?.value;
  const popup=form.id==='compose'&&action==='open'?window.open('about:blank','_blank'):null;
  if(popup)popup.opener=null;
  run(async()=>{
    if(form.id==='login'){
      const session=await request('/auth/v1/token?grant_type=password','POST',values);
      token=session.access_token;account=session.user;
      try {
        [member]=await rows('team','id=eq.'+account.id);
        if(!member)throw new Error('This account has no active Sales Studio access.');
        await reload();
      } catch(error) { token=account=member=null;throw error; }
    }
    if(form.id==='assignment'){
      const l=lead();
      const assignee=values.assignee||null;
      if(assignee===l.assignee)return;
      await rpc('assign_lead',{lead_id:l.id,expected_assignee:l.assignee,consultant_id:assignee});
    }
    if(form.id==='new-lead')await insert('leads',values);
    if(form.id==='enrol')await rpc('enrol_consultant',values);
    if(form.id==='rates')await patch('rates',1,Object.fromEntries(Object.entries(values).map(([k,v])=>[k,Math.round(Number(v)*100)])));
    if(form.id==='agreement')await rpc('capture_terms',{lead_id:activeLead,package_name:values.package_name,billing:values.billing,amount:Math.round(Number(values.amount)*100),joining:Math.round(Number(values.joining)*100),terms:values.terms});
    if(form.id==='verify-payment')await rpc('verify_payment',{...values,lead_id:activeLead,amount:Math.round(Number(values.amount)*100),installment:Number(values.installment)});
    if(form.id==='reverse-payment')await rpc('reverse_payment',values);
    if(form.id==='consent'){
      await insert('preferences',{...values,lead:activeLead});
      preferences=await rows('preferences','lead=eq.'+activeLead+'&order=id.desc');
    }
    if(form.id==='compose'){
      if(action==='send'){
        const signature=JSON.stringify([activeLead,values.subject,values.body]);
        if(emailKey?.signature!==signature)emailKey={signature,key:crypto.randomUUID()};
        const result=await request('/functions/v1/sales-studio-email','POST',{lead:activeLead,subject:values.subject,body:values.body,key:emailKey.key});
        history=await rows('activity','lead=eq.'+activeLead+'&order=recorded_at.desc');
        report(result.message);
        return;
      }
      if(action==='open'){
        if(!popup)throw new Error('Allow pop-ups to open WhatsApp.');
        try {
          let number=(lead().whatsapp||'').replace(/[^0-9]/g,'');
          if(number.startsWith('00'))number=number.slice(2);
          else if(number.startsWith('0'))number='27'+number.slice(1);
          if(!/^[1-9][0-9]{7,14}$/.test(number))throw new Error('Enter a valid WhatsApp number.');
          const entry=await insert('activity',{lead:activeLead,channel:'whatsapp',status:'Opened',detail:values.body});
          history.unshift(...entry);
          popup.location.href='https://wa.me/'+number+'?text='+encodeURIComponent(values.body);
          report('Opened WhatsApp. Send the message there.');
        } catch(error) { popup.close();throw error; }
        return;
      }
      const entry=await insert('activity',{lead:activeLead,channel:channel.toLowerCase(),status:'Prepared',detail:[values.subject,values.body].filter(Boolean).join('\n')});
      history.unshift(...entry);
      report('Draft saved to contact history');
      return;
    }
    if(form.id==='preview'){
      const {product:productId,...brief}=values;
      await insert('previews',{lead:activeLead,product:productId,brief});
    }
    if(form.id==='discovery')Object.assign(lead(),(await patch('leads',activeLead,{discovery:values,stage:'Discovery completed'}))[0]);
    if(form.dataset.preview)await patch('previews',form.dataset.preview,{...values,url:values.url||null});
    if(form.dataset.product)await patch('products',form.dataset.product,values);
    if(form.dataset.team)await patch('team',form.dataset.team,{...values,sender:values.sender||null,active:values.active==='true'});
    if(form.id!=='login')await reload();
    render();
    report(form.id==='login'?'Signed in':'Saved');
  });
});
render();
