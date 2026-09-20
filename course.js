(async function(){
const sb=()=>window.sgcSupabase; const id=new URLSearchParams(location.search).get('id');
if(!sb()){location.href='login.html';return;} const {data:{user}}=await sb().auth.getUser(); if(!user){location.href='login.html';return;}
const {data:c}=await sb().from('courses').select('*').eq('id',id).eq('published',true).single();
if(!c){document.getElementById('title').textContent='Course unavailable';return;}
const [m,k]=await Promise.all([sb().from('memberships').select('membership,status').eq('user_id',user.id).eq('status','active'),sb().from('customer_kits').select('status,paid,total,kits(name)').eq('user_id',user.id)]);
const access=(c.access_level==='start'&&m.data?.length)||(c.access_level==='build'&&m.data?.some(x=>x.membership==='build'))||((c.access_level||'').startsWith('kit:')&&k.data?.some(x=>(x.status==='active'||Number(x.paid)>=Number(x.total))&&(x.kits?.name||'').toLowerCase()===(c.access_level||'').slice(4).toLowerCase()));
if(!access){document.getElementById('title').textContent='Access required';document.getElementById('desc').textContent='This course is not included in your current SGC access.';return;}
document.getElementById('title').textContent=c.title;document.getElementById('desc').textContent=c.description||'';
const {data:lessons}=await sb().from('lessons').select('*').eq('course_id',id).eq('published',true).order('position');
document.getElementById('lessons').innerHTML=(lessons||[]).map((l,i)=>`<div class="row"><div><span class="tag">Lesson ${i+1}</span><strong style="display:block;margin-top:6px">${l.title}</strong><div class="muted">${l.body||''}</div></div>${l.video_url?`<a class="btn soft" href="${l.video_url}" target="_blank" rel="noopener">Watch</a>`:''}</div>`).join('')||'<div class="empty">Lessons will appear here when published.</div>';
})();