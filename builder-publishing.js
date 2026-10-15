(function(){
'use strict';
window.sgcInitPublishing=function(sb,saveDraft){
 const target=document.querySelector('#builder .stack');
 const panel=document.createElement('section');panel.className='panel';target.append(panel);
 const title=document.createElement('h2');title.textContent='Publish your website';panel.append(title);
 const info=document.createElement('p');info.className='muted';info.textContent='Publish a saved version for everyone to visit. Later edits stay private until you publish again. An active Website Builder subscription keeps your website available.';panel.append(info);
 const publish=document.createElement('button');publish.className='button';publish.textContent='Publish website';panel.append(publish);
 const unpublish=document.createElement('button');unpublish.className='button soft';unpublish.textContent='Unpublish';unpublish.style.marginLeft='8px';unpublish.hidden=true;panel.append(unpublish);
 const status=document.createElement('p');status.setAttribute('role','status');panel.append(status);
 const publicLink=document.createElement('a');publicLink.target='_blank';publicLink.rel='noopener';publicLink.hidden=true;panel.append(publicLink);
 const subdomain=document.createElement('p');subdomain.className='muted';panel.append(subdomain);
 let busy=false;
 async function call(action){const {data,error}=await sb.functions.invoke('website-publication',{body:{action}});if(error){let message=error.message;try{message=(await error.context.json()).error||message;}catch{}throw Error(message);}if(data?.error)throw Error(data.error);return data;}
 function show(data){window.sgcPublishedWebsite=data;unpublish.hidden=!data.published;publish.textContent=data.published?'Publish latest changes':'Publish website';publicLink.hidden=!data.published;subdomain.textContent='';if(data.published){publicLink.href=data.url;publicLink.textContent='Open published website ↗';status.textContent=data.available?'Published '+new Date(data.publishedAt).toLocaleString()+'.':'Published version saved. Renew Website Builder to make it available again.';subdomain.textContent='SGC address: '+data.subdomainUrl;const message=document.getElementById('share-message');if(message&&!message.dataset.edited)message.value='Visit '+document.getElementById('name').value.trim()+' at '+data.url;}else status.textContent='Your website is not published.';}
 async function run(action){if(busy)return;busy=true;publish.disabled=unpublish.disabled=true;status.textContent=action==='publish'?'Saving and publishing…':'Unpublishing…';try{if(action==='publish')await saveDraft();show(await call(action));}catch(e){status.textContent=e.message;}finally{busy=false;publish.disabled=unpublish.disabled=false;}}
 publish.onclick=()=>run('publish');
 const dialog=document.createElement('dialog');const question=document.createElement('p');question.textContent='Unpublish your website? Visitors will no longer be able to open it. Your design stays saved.';dialog.append(question);const yes=document.createElement('button');yes.className='button';yes.textContent='Yes, unpublish';const no=document.createElement('button');no.className='button soft';no.textContent='No, keep it published';no.style.marginLeft='8px';dialog.append(yes,no);document.body.append(dialog);yes.onclick=()=>{dialog.close();run('unpublish');};no.onclick=()=>dialog.close();unpublish.onclick=()=>dialog.showModal();
 call('status').then(show).catch(e=>{status.textContent='Unable to check publishing status: '+e.message;});
};
})();
