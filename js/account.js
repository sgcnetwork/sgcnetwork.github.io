(function(){
  const sb=()=>window.sgcSupabase;
  async function init(){
    if(!sb()){ location.href='login.html'; return; }
    const {data:{user}}=await sb().auth.getUser();
    if(!user){location.href='login.html';return;}
    document.getElementById('email').textContent=user.email||'Signed-in customer';
    const [m,k]=await Promise.all([
      sb().from('memberships').select('*').eq('user_id',user.id).eq('status','active').order('started_at',{ascending:false}).limit(1),
      sb().from('customer_kits').select('id,total,paid,status,kits(name,price)').eq('user_id',user.id).order('created_at',{ascending:false})
    ]);
    if(m.data&&m.data[0]){
      const type=m.data[0].membership;
      document.getElementById('membership-title').textContent='SGC '+(type==='start'?'Start':'Build')+' — Active';
      document.getElementById('membership-copy').textContent='Your membership is active. Your eligible Academy areas can be accessed from the Academy.';
    }
    const list=document.getElementById('kits-list');
    if(k.data?.length){
      list.innerHTML=k.data.map(x=>{
        const total=Number(x.total||0), paid=Number(x.paid||0), pct=total?Math.min(100,Math.round(paid/total*100)):0, name=x.kits?.name||'Business Kit', remaining=Math.max(0,total-paid);
        return `<div class="row"><div><strong>${name}</strong><div class="muted">R${paid.toFixed(2)} paid · R${remaining.toFixed(2)} remaining</div><div class="progress" style="width:min(420px,55vw);margin-top:10px"><span style="width:${pct}%"></span></div></div><div style="text-align:right"><span class="tag">${x.status}</span><br><a class="btn soft" href="payments.html">Manage payment</a></div></div>`;
      }).join('');
      document.getElementById('kit-title').textContent=k.data[0].kits?.name||'Business Kit';
      document.getElementById('kit-copy').textContent='Your latest kit is shown in your purchase list below.';
    } else list.innerHTML='<div class="empty">No Business Kits are linked to your account yet.</div>';
  }
  document.getElementById('signout')?.addEventListener('click',async()=>{await sb().auth.signOut();location.href='index.html';});
  init();
})();