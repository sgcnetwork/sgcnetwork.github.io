(function(){
'use strict';
const host=document.getElementById('sgc-library-downloads'),sb=window.sgcSupabase;if(!host||!sb)return;
const node=(tag,text,parent,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
async function load(){
 const {data:{user},error:authError}=await sb.auth.getUser();if(authError)throw authError;if(!user){host.textContent='Sign in to view your downloads.';return;}
 const {data:files,error}=await sb.from('sgc_product_files').select('id,title,path,kind,product_id').order('title');if(error)throw error;
 host.replaceChildren();if(!files?.length){node('p','Purchased files and included learning materials will appear here when they are available.',host,'muted');return;}
 for(const file of files){const row=node('article',null,host,'row'),info=node('div',null,row);node('strong',file.title||'Learning resource',info);node('p',file.kind||'Download',info,'muted');const button=node('button','Download',row,'btn alt');button.type='button';const status=node('p',null,info,'muted');status.setAttribute('role','status');button.onclick=async()=>{
  button.disabled=true;status.textContent='Preparing your secure download…';let destination;try{destination=window.open('about:blank','_blank');if(destination)destination.opener=null;
   const {data,error}=await sb.storage.from('sgc-products').createSignedUrl(file.path,120);if(error)throw error;
   const url=new URL(data.signedUrl);if(url.protocol!=='https:')throw Error('Invalid download link');
   if(destination){destination.location.replace(url.href);status.textContent='Your download is ready.';}else{const link=node('a','Open your download ↗',status);link.href=url.href;link.target='_blank';link.rel='noopener';}
  }catch(error){destination?.close();status.textContent='Unable to prepare this download. Please refresh and retry.';}finally{button.disabled=false;}
 };
 }
}
load().catch(()=>{host.textContent='Your downloads could not load. Refresh to retry.';});
})();
