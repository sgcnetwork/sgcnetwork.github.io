(()=>{
 let client,user,timer,pending=false;
 const nav=document.querySelector('a[href="community.html"]')||document.getElementById('connect');
 if(!nav)return;
 const badge=document.createElement('span');badge.className='sgc-community-badge';badge.hidden=true;nav.append(badge);
 const toggle=document.createElement('button');toggle.type='button';toggle.className='sgc-notification-toggle';toggle.textContent='♧';toggle.setAttribute('aria-label','Community notifications');toggle.setAttribute('aria-expanded','false');nav.after(toggle);
 const panel=document.createElement('section');panel.className='sgc-notifications';panel.hidden=true;panel.setAttribute('aria-label','Community notifications');
 const heading=document.createElement('h3');heading.textContent='Community updates';
 const list=document.createElement('div'),status=document.createElement('p');
 const read=document.createElement('button');read.type='button';read.textContent='Mark all as read';
 panel.append(heading,list,status,read);document.body.append(panel);
 let rows=[];
 async function load(mark=false){
  if(!client||!user||pending)return;pending=true;
  try{const r=await client.rpc('sgc_community_notifications',{p_read:mark});if(r.error)throw r.error;rows=r.data||[];badge.hidden=!rows.length;const direct=rows.filter(n=>n.direct_reply).length;badge.textContent=(direct?'@ ':'')+rows.length;toggle.textContent=direct?'@':'♧';toggle.setAttribute('aria-label',rows.length+' new community updates'+(direct?', '+direct+' replies to you':''));list.replaceChildren();
   for(const row of rows){const link=document.createElement('a');link.textContent=(row.direct_reply?'@ ':'')+row.title;link.href='community.html?group='+encodeURIComponent(row.group_id)+'&post='+encodeURIComponent(row.post_id);const date=document.createElement('small');date.textContent=new Date(row.created_at).toLocaleString('en-ZA');link.append(date);list.append(link);}
   status.textContent=rows.length?'':'You’re all caught up.';read.disabled=!rows.length;
  }catch{status.textContent='Notifications could not load. Try again.';}finally{pending=false;}
 }
 toggle.onclick=()=>{panel.hidden=!panel.hidden;toggle.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)load();};
 read.onclick=()=>load(true);
 document.addEventListener('click',e=>{if(!panel.contains(e.target)&&!toggle.contains(e.target)){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){panel.hidden=true;toggle.setAttribute('aria-expanded','false');}});
 async function start(){
  client=window.sgcSupabase||window.supabase?.createClient('https://bxpexanyoyubxeqqlggh.supabase.co','sb_publishable_Z0_Y-Bj_G5qw4hMgDbQlgA__jj8rGGq');
  if(!client)return;const auth=await client.auth.getUser();user=auth.data.user;if(!user){toggle.hidden=true;return;}
  await load();timer=setInterval(()=>{if(!document.hidden)load();},30000);
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearInterval(timer);badge.hidden=true;toggle.hidden=true;panel.hidden=true;user=null;}});
 }
 start().catch(()=>toggle.hidden=true);
})();