(function(){
'use strict';
const shell=document.getElementById('preview-shell'),legacy=document.getElementById('preview');
if(!shell||!legacy)return;
const frame=document.createElement('iframe');frame.id='sgc-storefront-preview';frame.title='Live customer website preview';frame.src='builder-storefront-preview.html?v=unified-1';frame.style.cssText='display:block;width:100%;height:720px;border:0;background:white';
// Keep legacy editor hooks available while every visible preview uses the public renderer.
legacy.hidden=true;shell.append(frame);
let ready=false,scheduled=false;
function snapshot(){
 const p=window.sgcGetBuilderDraft?.()||{};
 const value=id=>document.getElementById(id)?.value||'';
 return {business_name:value('name'),slug:value('slug'),description:value('desc'),font:value('font'),primary_color:p.themePrimary||value('primary'),accent_color:p.themeSecondary||value('accent'),preferences:p,products:(p.productItems||[]).filter(x=>x.active!==false),services:(p.serviceItems||[]).filter(x=>x.active!==false)};
}
function sync(){if(ready)frame.contentWindow.postMessage({type:'sgc-preview-render',site:snapshot()},location.origin);}
window.sgcSyncStorefrontPreview=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;sync();});};
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
 if(event.data?.type==='sgc-preview-ready'){ready=true;sync();}
 if(event.data?.type==='sgc-preview-media-position'){
  const draft=window.sgcGetBuilderDraft?.();if(!draft)return;const coordinate=v=>Math.max(0,Math.min(100,Number(v)||0));draft.homeMediaX=coordinate(event.data.x);draft.homeMediaY=coordinate(event.data.y);
  for(const key of ['homeMediaX','homeMediaY']){const field=document.getElementById('studio-'+key);if(field)field.value=draft[key];}window.sgcRenderFullPreview?.(draft);
 }
});
const render=window.sgcRenderFullPreview;
window.sgcRenderFullPreview=function(p){const result=render?.(p);window.sgcSyncStorefrontPreview();return result;};
for(const id of ['name','slug','desc','font','primary','accent','product','price'])document.getElementById(id)?.addEventListener('input',()=>window.sgcSyncStorefrontPreview());
window.sgcPreviewCatalogueItem=function(kind,item){const s=snapshot(),key=kind==='products'?'products':'services';s[key]=[...s[key].filter(x=>x.id!==item.id),{...item,active:true}];if(ready)frame.contentWindow.postMessage({type:'sgc-preview-render',site:s,route:kind+'/'+encodeURIComponent(item.seoSlug||item.id)},location.origin);};
})();
