/* SGC member guide. Tutorial preferences never grant account access. */
(()=>{
 'use strict';
 const VERSION=1, KEY='sgc_member_guide', OPT='sgc_tutorials_enabled';
 const steps=[
  {page:'dashboard.html',target:'a[href="shop.html"]',title:'First step: click Shop',text:'Start by exploring the shop. Click Shop above, or use the button below.',event:'click',next:'Open Shop'},
  {page:'shop.html',target:'#category-menu',title:'Choose a category',text:'Open Explore the shop and choose a category, such as Business Kits. The available categories appear here.',event:'change'},
  {page:'shop.html',target:'#catalogue',title:'This is your store',text:'Browse the products in this category. Open a product to see its details. Products and learning material have their own access requirements.'},
  {page:'shop.html',target:'a[href="dashboard.html"]',title:'Back to My SGC',text:'My SGC is your personal dashboard. Click My SGC at the top to return.',event:'click',next:'Open My SGC'},
  {page:'dashboard.html',target:'.hero-card',title:'Your personal dashboard',text:'Find your membership, purchases and Academy access here. Your own account determines what you can open.'},
  {page:'dashboard.html',target:'a[href="community.html"]',title:'Meet your community',text:'Click Community to find conversations, encouragement and people working on their next step.',event:'click',next:'Open Community'},
  {page:'community.html',target:'#group',title:'Your connected community',text:'On the left, Choose a community shows the space you are currently viewing. Its description tells you what the space is about.'},
  {page:'community.html',target:'#category',title:'Filter your communities',text:'Use this menu to switch between FAQs & assistance, niche communities and the general community. Then choose a space below.',event:'change'},
  {page:'community.html',target:'#group',title:'Choose a space to access',text:'Every SGC user can join any community. Choose a space, then click Join to see its threads. Your joined spaces are marked Joined.',event:'change'},
  {page:'community.html',target:'#feed',title:'Join the conversation',text:'Browse posts, open comment threads, react to updates and share encouragement. Use the post box when available to start your own conversation.'},
  {page:'community.html',target:'.sticky',title:'Your quote for the day',text:'A little inspiration lives here. Come back to see the quote for the day.'},
  {page:'community.html',target:'#suggest-form',title:'Suggest a quote to be featured',text:'Share a quote and its author here. SGC reviews suggestions and may feature yours as a quote for the day. You can submit it later; this guide will not send anything for you.'},
  {page:'community.html',target:'a[href="academy.html"]',title:'Step inside Academy',text:'Click Academy above to explore your classroom.',event:'click',next:'Open Academy'},
  {page:'academy.html',target:'#learn',title:'Choose Learn',text:'Learn opens your available Academy lessons. Click it to return to the classroom.',event:'click'},
  {page:'academy.html',target:'.academy-appearance',interaction:'.academy-appearance button',title:'Choose your classroom theme',text:'Choose Light for the soft pastel classroom, or Dark & gold for the classic SGC look. You can switch whenever you like.',event:'click'},
  {page:'academy.html',target:'#module-select',title:'Choose a module',text:'Open this dropdown and choose a module. The lesson list below changes to show that module. Locked learning still follows your account access.',event:'change'},
  {page:'academy.html',target:'#lesson-list',interaction:'#lesson-list button',title:'Start your module',text:'Click an available lesson to begin your module. If your account has no lessons yet, you can skip this step and return after access is granted.',event:'click'},
  {page:'academy.html',target:'#video',title:'Watch and learn',text:'Watch the teaching here when a video is included. Use the lesson notes and resources to work through the material at your own pace.'},
  {page:'academy.html',target:'#notes-panel',title:'Save your own notes',text:'Write your personal notes and choose Save notes. Your saved learning record can be found later in My Library.'},
  {page:'academy.html',target:'.reflection',title:'Complete a quiz when included',text:'When a lesson includes a quiz, answer and submit it before continuing. If there is no quiz, continue learning. Review submitted answers later in Quiz Results.'},
  {page:'academy.html',target:'a[href="dashboard.html"]',title:'Find your personal library',text:'Return to My SGC to see the learning records and resources you have collected.',event:'click',next:'Open My SGC'},
  {page:'dashboard.html',target:'#library-nav',title:'Open My Library',text:'Click My library in the top menu. Your meetings, kits, quiz results and learning portfolio live together here.',event:'click'},
  {page:'dashboard.html',hash:'#my-library',target:'.library-sidebar',title:'Everything in its place',text:'Use these library sections to revisit meetings, purchased kits, submitted quiz results and your saved portfolio. You are ready to explore SGC!',next:'Finish guide'}
 ];
 let client,user,state,key,panel,spot,launcher,progress,title,copy,hint,next,back,skip,all,close,actions,extra;
 let timer,startedAt=0,scrolledFor=-1,busy=false,mode='guide',writeQueue=Promise.resolve();
 const page=()=>location.pathname.split('/').pop()||'index.html';
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(label,fn,cls)=>{const n=node('button',label,cls);n.type='button';n.onclick=fn;return n;};
 const defaults=()=>({version:VERSION,step:0,status:'new',enabled:true,updated_at:0});
 const valid=s=>s&&s.version===VERSION&&Number.isInteger(s.step)&&s.step>=0&&s.step<steps.length&&['new','active','paused','skipped','complete','disabled'].includes(s.status)&&typeof s.enabled==='boolean';
 function localRead(){try{const s=JSON.parse(localStorage.getItem(key)||'null');return valid(s)?s:null;}catch{return null;}}
 function localWrite(){try{localStorage.setItem(key,JSON.stringify(state));}catch{}}
 function sync(){
  const snapshot={...state};
  writeQueue=writeQueue.catch(()=>{}).then(async()=>{
   const r=await client.auth.updateUser({data:{[KEY]:snapshot,[OPT]:snapshot.enabled}});
   if(r.error)throw r.error;
  });
  // Local progress remains available when the account connection is offline.
  writeQueue.catch(()=>{});return writeQueue;
 }
 function save(patch){state={...state,...patch,updated_at:Date.now()};localWrite();sync();}
 function hide(){panel.hidden=true;spot.hidden=true;launcher.hidden=false;}
 function pause(){save({status:state.status==='new'?'skipped':'paused'});hide();}
 function disable(){save({status:'disabled',enabled:false});hide();}
 function showSettings(){
  mode='settings';
  spot.hidden=true;panel.hidden=false;panel.classList.add('sgc-guide-welcome');
  progress.textContent='YOUR SGC GUIDE';title.textContent='Explore at your own pace.';copy.textContent='Resume your walkthrough, start again, or choose whether tutorials appear automatically.';hint.textContent='';
  actions.replaceChildren();extra.replaceChildren();
  if(state.status==='paused'||state.status==='active')actions.append(button('Resume guide',()=>{save({status:'active',enabled:true});openStep();},'sgc-guide-primary'));
  actions.append(button('Restart guide',()=>{save({step:0,status:'active',enabled:true});openStep();},'sgc-guide-primary'));
  const label=node('label',undefined,'sgc-guide-setting'),check=node('input');check.type='checkbox';check.checked=state.enabled;
  check.onchange=()=>{save({enabled:check.checked,status:check.checked?'skipped':'disabled'});};
  label.append(check,node('span','Allow automatic tutorials'));extra.append(label);actions.append(button('Close',hide,'sgc-guide-secondary'));
 }
 function welcome(){
  mode='welcome';
  panel.hidden=false;spot.hidden=true;panel.classList.add('sgc-guide-welcome');launcher.hidden=true;
  progress.textContent='YOUR FIRST STEPS';title.textContent='Welcome to SGC Network';
  copy.textContent='Let us show you around, one step at a time. Explore the shop, your dashboard, Community, Academy and My Library.';
  hint.textContent='You can skip a step, close the guide or turn off all tutorials whenever you like.';
  actions.replaceChildren(button('Start guided tutorial',()=>{save({status:'active',step:0,enabled:true});openStep();},'sgc-guide-primary'),button('Skip this tutorial',()=>{save({status:'skipped'});hide();},'sgc-guide-secondary'));
  extra.replaceChildren(button('Skip all tutorials',disable,'sgc-guide-text'));close.focus({preventScroll:true});
 }
 function complete(){mode='complete';save({status:'complete'});spot.hidden=true;panel.hidden=false;panel.classList.add('sgc-guide-welcome');progress.textContent='GUIDE COMPLETE';title.textContent='Your next chapter starts here.';copy.textContent='You are ready to explore. The SGC guide button is always here if you want another walkthrough.';hint.textContent='';actions.replaceChildren(button('Start exploring',hide,'sgc-guide-primary'));extra.replaceChildren();}
 function advance(native=false){
  if(busy||state.status!=='active')return;
  busy=true;
  if(state.step===steps.length-1){complete();busy=false;return;}
  save({step:state.step+1});scrolledFor=-1;
  if(native){setTimeout(()=>{busy=false;render();},100);return;}
  busy=false;openStep();
 }
 function openStep(){
  const s=steps[state.step];
  if(page()!==s.page){location.assign(s.page+(s.hash||''));return;}
  if(s.hash&&location.hash!==s.hash)location.hash=s.hash;
  render();
 }
 function showControls(){
  actions.replaceChildren(back,skip,next);extra.replaceChildren(all);
  back.disabled=state.step===0;next.textContent=steps[state.step].next||'Next step';
 }
 function render(){
  if(state.status!=='active'){spot.hidden=true;return;}
  const s=steps[state.step];mode='guide';panel.hidden=false;panel.classList.remove('sgc-guide-welcome');launcher.hidden=true;
  progress.textContent='STEP '+(state.step+1)+' OF '+steps.length;title.textContent=s.title;copy.textContent=s.text;hint.textContent='';
  showControls();startedAt=Date.now();
  if(page()!==s.page){hint.textContent='Continue this step on '+({'dashboard.html':'My SGC','shop.html':'Shop','community.html':'Community','academy.html':'Academy'}[s.page]||'the next page')+'.';next.textContent='Continue guide';spot.hidden=true;return;}
  locate();
 }
 function visible(n){return n&&n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden';}
 function locate(){
  if(!state||state.status!=='active'||panel.hidden||page()!==steps[state.step].page)return;
  const s=steps[state.step],target=document.querySelector(s.target);
  if(!visible(target)){
   spot.hidden=true;
   if(Date.now()-startedAt>8000)hint.textContent='This area is not available yet or is still loading. You can skip this step and return later.';
   return;
  }
  if(scrolledFor!==state.step){scrolledFor=state.step;target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center',inline:'nearest'});}
  const r=target.getBoundingClientRect();
  const top=Math.max(4,r.top-7),left=Math.max(4,r.left-7),right=Math.min(innerWidth-4,r.right+7),bottom=Math.min(innerHeight-4,r.bottom+7);
  if(right<=left||bottom<=top){spot.hidden=true;return;}
  spot.hidden=false;Object.assign(spot.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
  // Keep the tutorial card away from the highlighted control when possible.
  const card=panel.getBoundingClientRect(),overlap=left<card.right&&right>card.left&&top<card.bottom&&bottom>card.top;
  panel.classList.toggle('sgc-guide-top',overlap&&top>innerHeight/2);
  hint.textContent='Click the highlighted area, or use Next step to continue.';
 }
 function interacted(e){
  if(!state||state.status!=='active'||panel.hidden||panel.contains(e.target))return;
  const s=steps[state.step];if(page()!==s.page||s.event!==e.type)return;
  const match=e.target.closest(s.interaction||s.target);if(!match)return;
  if(e.type==='change'&&!e.target.value)return;
  advance(true);
 }
 function makeUI(){
  spot=node('div',undefined,'sgc-guide-spot');spot.hidden=true;spot.setAttribute('aria-hidden','true');
  launcher=button('SGC guide',showSettings,'sgc-guide-launcher');launcher.setAttribute('aria-label','Open or restart your SGC guide');
  panel=node('section',undefined,'sgc-guide-panel');panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','false');panel.setAttribute('aria-labelledby','sgc-guide-title');
  progress=node('div','','sgc-guide-progress');title=node('h2','','sgc-guide-title');title.id='sgc-guide-title';copy=node('p','','sgc-guide-copy');hint=node('p','','sgc-guide-hint');hint.setAttribute('aria-live','polite');
  close=button('×',()=>{if(mode==='guide'||mode==='welcome')pause();else hide();},'sgc-guide-close');close.setAttribute('aria-label','Close tutorial');
  actions=node('div',undefined,'sgc-guide-actions');extra=node('div',undefined,'sgc-guide-extra');
  back=button('Back',()=>{save({step:Math.max(0,state.step-1)});scrolledFor=-1;openStep();},'sgc-guide-secondary');
  skip=button('Skip step',()=>advance(),'sgc-guide-secondary');next=button('Next step',()=>{if(page()!==steps[state.step].page)openStep();else advance();},'sgc-guide-primary');
  all=button('Skip all tutorials',disable,'sgc-guide-text');
  panel.append(close,progress,title,copy,hint,actions,extra);document.body.append(spot,panel,launcher);
  // Auto-hide only the floating shortcut after ten seconds on every member page.
  // Never interrupt a tutorial or settings panel that the member opened.
  window.setTimeout(()=>{
    if(!launcher)return;
    // Keep a guide the member is actively reading open; hide only its floating shortcut.
    launcher.hidden=true;
    launcher.style.setProperty('display','none','important');
    const communityDismiss=document.getElementById('sgc-guide-dismiss-community');
    if(communityDismiss)communityDismiss.hidden=true;
  },10000);

  document.addEventListener('click',interacted,true);document.addEventListener('change',interacted,true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){if(mode==='guide'||mode==='welcome')pause();else hide();}});
  window.addEventListener('scroll',locate,{passive:true});window.addEventListener('resize',locate);
  timer=setInterval(locate,450);
 }
 async function init(){
  client=window.sgcSupabase||(typeof sb!=='undefined'?sb:null);if(!client)return;
  const session=await client.auth.getSession();if(!session.data?.session)return;
  const auth=await client.auth.getUser();user=auth.data?.user;if(!user)return;
  key='sgc-guide:'+user.id;const remote=user.user_metadata?.[KEY],local=localRead();
  state=valid(remote)?{...remote}:defaults();
  if(local&&local.updated_at>state.updated_at)state={...local};
  if(user.user_metadata?.[OPT]===false&&(!local||local.updated_at<=(remote?.updated_at||0)))state={...state,enabled:false,status:'disabled'};
  localWrite();if(local&&local.updated_at>(remote?.updated_at||0))sync();
  makeUI();
  if(state.enabled&&state.status==='new')welcome();else if(state.enabled&&state.status==='active')render();
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){clearInterval(timer);panel.remove();spot.remove();launcher.remove();state=null;}});
 }
 init().catch(()=>{});
})();
