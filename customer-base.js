const demoCustomers=[
 {name:'Amina Jacobs',membership:'Start',kit:'Beauty',total:499,paid:300,status:'layby'},
 {name:'Kyle Naidoo',membership:'Start',kit:'Gaming / RP',total:699,paid:450,status:'layby'},
 {name:'Sarah Daniels',membership:'Build',kit:'Clothing',total:499,paid:499,status:'complete'},
 {name:'Lebo Mokoena',membership:'Start',kit:'Digital Services',total:499,paid:0,status:'active'}
];
function money(n){return 'R'+Number(n).toLocaleString('en-ZA')}
function toast(msg){const el=document.getElementById('toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}
function customerPage(){
 const total=499,paid=300,remaining=total-paid,pct=Math.min(100,Math.round(paid/total*100));
 const bar=document.getElementById('progressBar'); if(bar)bar.style.width=pct+'%';
 const rows=document.getElementById('paymentRows'); if(rows)rows.innerHTML=[['19 Sep 2026','Kit lay-by',150,'Paid'],['05 Oct 2026','Kit lay-by',150,'Paid']].map(x=>`<div class="row"><span>${x[0]}</span><span>${x[1]}</span><span>${money(x[2])}</span><span class="payment-ok">${x[3]}</span></div>`).join('');
 ['paidAmount','remainingAmount'].forEach((id,i)=>{const e=document.getElementById(id);if(e)e.textContent=money(i?remaining:paid)});
 document.getElementById('payBtn')?.addEventListener('click',()=>toast('Payment flow placeholder — connect Paystack backend here.'));
 document.getElementById('nextBtn')?.addEventListener('click',()=>toast('Payment flow placeholder — connect Paystack backend here.'));
 document.getElementById('invoiceBtn')?.addEventListener('click',()=>toast('Invoice centre will load verified invoices from the SGC backend.'));
 document.getElementById('buildBtn')?.addEventListener('click',()=>toast('Build becomes available according to your SGC access rules.'));
 document.getElementById('logoutBtn')?.addEventListener('click',()=>toast('Logout will be handled by the account authentication provider.'));
}
function adminPage(){
 const rows=document.getElementById('customerRows');
 function render(list){rows.innerHTML=list.map((c,i)=>`<div class="row customer-row" data-name="${c.name.toLowerCase()}" data-status="${c.status}"><span><strong>${c.name}</strong></span><span>${c.membership}</span><span>${c.kit} — ${money(c.total)}</span><span>${money(Math.max(0,c.total-c.paid))}</span><span><b class="${c.status==='complete'?'status':'lock'}">${c.status==='complete'?'COMPLETE':c.status==='layby'?'LAY-BY':'ACTIVE'}</b></span></div>`).join('')}
 render(demoCustomers);
 const search=document.getElementById('search'),filter=document.getElementById('statusFilter');
 function filterRows(){const q=(search.value||'').toLowerCase(),s=filter.value;render(demoCustomers.filter(c=>(!q||c.name.toLowerCase().includes(q)||c.kit.toLowerCase().includes(q))&&(s==='all'||c.status===s)))}
 search?.addEventListener('input',filterRows);filter?.addEventListener('change',filterRows);
 document.getElementById('invoiceCustomer')?.addEventListener('click',()=>toast('Live invoice records will come from the backend.'));
 document.getElementById('unlockDemo')?.addEventListener('click',()=>toast('Demo only — real unlocks happen after verified payment events.'));
}
if(location.pathname.endsWith('admin.html'))adminPage();else customerPage();
