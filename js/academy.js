(function(){
const sb=()=>window.sgcSupabase;
async function init(){
 if(!sb()){location.href='login.html';return;}
 const {data:{user}}=await sb().auth.getUser();
 if(!user){location.href='login.html';return;}
 document.getElementById('email').textContent=user.email||'Authenticated customer';
 const [m,k,c]=await Promise.all([
  sb().from('memberships').select('membership,status').eq('user_id',user.id).eq('status','active'),
  sb().from('customer_kits').select('status,paid,total,kits(name)').eq('user_id',user.id),
  sb().from('courses').select('id,title,description,access_level').eq('published',true).order('created_at',{ascending:true})
 ]);
 const cards=[];
 if(m.data?.some(x=>x.membership==='start')) cards.push({title:'SGC Start',copy:'Foundations, practical entrepreneurship and your Start community.',href:'start.html',cls:'blush'});
 if(m.data?.some(x=>x.membership==='build')) cards.push({title:'SGC Build',copy:'Deeper learning, implementation and Build sessions.',href:'build.html',cls:'lav'});
 (k.data||[]).filter(x=>x.status==='active'||Number(x.paid)>=Number(x.total)).forEach(x=>cards.push({title:x.kits?.name||'Business Kit',copy:'Your purchased kit learning and resources.',href:'kits.html',cls:'butter'}));
 document.getElementById('academy-grid').innerHTML=cards.length?cards.map(x=>`<div class="card ${x.cls}"><span class="pill">Unlocked</span><h3>${x.title}</h3><p class="muted">${x.copy}</p><a class="btn" href="${x.href}">Open →</a></div>`).join(''):'<div class="empty">Your Academy is ready, but no active SGC access is linked to this account yet. Purchase a membership or Business Kit to unlock your learning area.</div>';
 const allowed = coursesForUser(c.data||[],m.data||[],k.data||[]);
 const box=document.getElementById('courses');
 box.innerHTML=allowed.length?allowed.map(x=>`<div class="row"><div><strong>${x.title}</strong><div class="muted">${x.description||'SGC Academy course'}</div></div><a class="btn soft" href="course.html?id=${encodeURIComponent(x.id)}">Open course</a></div>`).join(''):'<div class="empty">No published courses are available for your current access.</div>';
}
function coursesForUser(courses,memberships,kits){
 const hasStart=memberships.some(x=>x.membership==='start'), hasBuild=memberships.some(x=>x.membership==='build');
 const kitNames=kits.filter(x=>x.status==='active'||Number(x.paid)>=Number(x.total)).map(x=>(x.kits?.name||'').toLowerCase());
 return courses.filter(c=>{
   const a=(c.access_level||'start').toLowerCase();
   if(a==='start') return hasStart||hasBuild;
   if(a==='build') return hasBuild;
   if(a.startsWith('kit:')) return kitNames.includes(a.slice(4));
   return false;
 });
}
document.getElementById('signout')?.addEventListener('click',async()=>{await sb().auth.signOut();location.href='index.html';});
init();
})();