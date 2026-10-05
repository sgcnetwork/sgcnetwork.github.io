(function(){
const sb=()=>window.sgcSupabase;
async function init(){
 if(!sb()){location.href='login.html';return;}
 const {data:{user}}=await sb().auth.getUser(); if(!user){location.href='login.html';return;}
 document.getElementById('email').textContent=user.email||'Authenticated customer';
 const [m,k,c]=await Promise.all([
  sb().from('memberships').select('membership_type,status').eq('user_id',user.id).eq('status','active'),
  sb().from('customer_kits').select('status,amount_paid_zar,total_price_zar,kits(name)').eq('user_id',user.id),
  sb().from('courses').select('id,title,description,membership_required,status,sort_order').eq('status','published').order('sort_order')
 ]);
 const cards=[];
 if(m.data?.some(x=>x.membership_type==='start')) cards.push({title:'SGC Start',copy:'Foundations, practical entrepreneurship and your Start community.',cls:'blush'});
 if(m.data?.some(x=>x.membership_type==='build')) cards.push({title:'SGC Build',copy:'Deeper learning, implementation and Build sessions.',cls:'lav'});
 (k.data||[]).filter(x=>['active','unlocked'].includes(x.status)||Number(x.amount_paid_zar)>=Number(x.total_price_zar)).forEach(x=>cards.push({title:x.kits?.name||'Business Kit',copy:'Your purchased kit learning and resources.',cls:'butter'}));
 document.getElementById('academy-grid').innerHTML=cards.length?cards.map(x=>`<div class="card ${x.cls}"><span class="pill">Unlocked</span><h3>${x.title}</h3><p class="muted">${x.copy}</p></div>`).join(''):'<div class="empty">No active Academy access is linked to this account yet.</div>';
 const hasStart=m.data?.some(x=>x.membership_type==='start'), hasBuild=m.data?.some(x=>x.membership_type==='build');
 const allowed=(c.data||[]).filter(x=>x.membership_required==='start'?(hasStart||hasBuild):x.membership_required==='build'?hasBuild:false);
 document.getElementById('courses').innerHTML=allowed.length?allowed.map(x=>`<div class="row"><div><strong>${x.title}</strong><div class="muted">${x.description||'SGC Academy course'}</div></div><a class="btn soft" href="academy-classroom.html?id=${encodeURIComponent(x.id)}">Enter Academy →</a></div>`).join(''):'<div class="empty">No published courses are available for your current access.</div>';
}
document.getElementById('signout')?.addEventListener('click',async()=>{await sb().auth.signOut();location.href='index.html';}); init();
})();