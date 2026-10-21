/* Shared editable Business Services elements. Embedded into the public renderer. */
(function(root){'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url=v=>{try{const u=new URL(v,location.origin);return ['https:','http:','mailto:','tel:'].includes(u.protocol)?u.href:''}catch{return ''}};
const num=(v,min,max,fallback)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):fallback));
const colour=(v,f)=>/^#[0-9a-f]{3,8}$/i.test(v||'')?v:f;
function defaults(type){return {id:crypto.randomUUID(),type,title:({'Text':'Tell your story','Button':'Get in touch','FAQ':'Frequently asked questions','Testimonial':'Your client’s name','Team Member':'Meet our team','Pricing Table':'Choose your plan','Social Icons':'Follow us','Form':'Send message'}[type]||'New '+type),body:'Add your content here.',url:'',active:true,style:{},items:type==='FAQ'?[{title:'How can we help?',body:'Add a helpful answer.'}]:type==='Team Member'?[{title:'Team member',body:'Role and introduction',image:'',url:''}]:type==='Pricing Table'?[{title:'Starter',body:'Describe what is included',price:'R299',button:'Get started',url:''}]:type==='Social Icons'?[{title:'Instagram',url:'https://instagram.com/'}]:type==='Form'?[{title:'Name',type:'text',required:true},{title:'Email',type:'email',required:true},{title:'Message',type:'textarea',required:true}]:[],children:[]};}
function render(it,context={}){const e=esc,title=e(it.title),body=e(it.body),src=url(it.url),s=it.style||{},align=['left','center','right'].includes(s.align)?s.align:'left';let html='';const button=(label,destination)=>'<a class="cta" href="'+e(url(destination)||'#business/Contact')+'">'+e(label)+'</a>';const image=(source,alt)=>url(source)?'<img style="width:100%;max-height:480px;object-fit:cover;border-radius:inherit" src="'+e(url(source))+'" alt="'+e(alt)+'">':'';
 switch(it.type){
 case 'Text':html='<p style="white-space:pre-wrap">'+body+'</p>';break;
 case 'Heading':html='<h2>'+title+'</h2>';break;
 case 'Image':html=image(src,it.title)||'<p>Choose an image using the editing panel.</p>';break;
 case 'Button':html=button(it.title,it.url);break;
 case 'Video':html=src?'<video controls playsinline preload="metadata" style="max-width:100%" src="'+e(src)+'"></video>':'<p>Add or upload a video.</p>';break;
 case 'Gallery':html='<h2>'+title+'</h2><div class="element-gallery">'+(it.items?.length?it.items.map(i=>image(i.image,i.title)):String(it.body||'').split('\n').map(i=>image(i,'Gallery photo'))).join('')+'</div>';break;
 case 'Section':case 'Container':html='<h2>'+title+'</h2><p>'+body+'</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:18px">'+(it.children||[]).filter(c=>c.active!==false).map(c=>render(c,context)).join('')+'</div>';break;
 case 'Icon':html='<span style="font-size:2em">'+e(it.icon||'✧')+'</span><h3>'+title+'</h3><p>'+body+'</p>';break;
 case 'Divider':html='<hr style="border:0;border-top:1px solid currentColor">';break;
 case 'Spacer':html='<div style="height:'+num(it.height,0,500,50)+'px"></div>';break;
 case 'Form':html='<h2>'+title+'</h2><p>'+body+'</p><form class="extra-contact">'+(it.items||[]).map((f,i)=>'<label style="display:block;text-align:left">'+e(f.title)+(f.type==='textarea'?'<textarea':'<input type="'+(['email','tel','number','date'].includes(f.type)?f.type:'text')+'"')+' name="'+e(f.title||'Field '+(i+1))+'" '+(f.required?'required':'')+' placeholder="'+e(f.title)+'" style="display:block;width:100%">'+(f.type==='textarea'?'</textarea>':'')+'</label>').join('')+'<button class="cta">'+e(it.button||'Send message')+'</button><p role="status"></p></form>';break;
 case 'Map':html='<h2>'+title+'</h2><p>'+body+'</p><iframe title="Business location" loading="lazy" referrerpolicy="no-referrer" style="width:100%;height:320px;border:0" src="https://maps.google.com/maps?q='+encodeURIComponent(it.address||it.body||'')+'&output=embed"></iframe>';break;
 case 'FAQ':html='<h2>'+title+'</h2>'+(it.items||[]).map(f=>'<details style="padding:14px;text-align:left;border-bottom:1px solid #ddd"><summary>'+e(f.title)+'</summary><p>'+e(f.body)+'</p></details>').join('');break;
 case 'Testimonial':html=(image(src,it.title))+'<blockquote style="white-space:pre-wrap">“'+body+'”<cite style="display:block">'+title+'</cite></blockquote>';break;
 case 'Team Member':html='<h2>'+title+'</h2><div class="cards">'+(it.items||[]).map(m=>'<article class="card">'+image(m.image,m.title)+'<h3>'+e(m.title)+'</h3><p>'+e(m.body)+'</p>'+(m.url?button('Contact',m.url):'')+'</article>').join('')+'</div>';break;
 case 'Pricing Table':html='<h2>'+title+'</h2><div class="cards">'+(it.items||[]).map(m=>'<article class="card"><h3>'+e(m.title)+'</h3><strong style="font-size:28px">'+e(m.price)+'</strong><p style="white-space:pre-wrap">'+e(m.body)+'</p>'+button(m.button||'Choose plan',m.url)+'</article>').join('')+'</div>';break;
 case 'Social Icons':html='<h3>'+title+'</h3><div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap">'+(it.items||[]).map(m=>button(m.title,m.url)).join('')+'</div>';break;
 case 'HTML Embed':html='<iframe title="Embedded content" sandbox="" style="border:0;width:100%;min-height:'+num(it.height,100,1000,220)+'px" srcdoc="'+e(it.body)+'"></iframe>';break;
 case 'Service Card':case 'Product Listing':case 'Blog':{const key=it.type==='Service Card'?'Services':it.type==='Blog'?'Blog':'Products';const items=(context.data?.[key]?.items||[]).filter(x=>x.active!==false&&x.status!=='draft'&&(!it.category||(x.categories||[x.category]).includes(it.category)));html='<h2>'+title+'</h2><div class="cards">'+items.map(m=>'<article class="card">'+image(m.image||m.images?.[0],m.name)+'<h3>'+e(m.name)+'</h3><p>'+e(m.desc)+'</p>'+button(it.button||'View details',location.origin+'/#'+(key==='Products'?'products/':key==='Services'?'services/':'article/')+encodeURIComponent(m.seoSlug||m.id))+'</article>').join('')+'</div>';break;}
 default:html='<h2>'+title+'</h2><p>'+body+'</p>';
 }
 return '<div class="editable-element" style="text-align:'+align+';color:'+colour(s.color,'inherit')+';background:'+colour(s.background,'transparent')+';font-size:'+num(s.fontSize,10,90,16)+'px;padding:'+num(s.padding,0,160,12)+'px;margin:'+num(s.margin,0,100,0)+'px;border-radius:'+num(s.radius,0,100,8)+'px;max-width:'+num(s.width,20,100,100)+'%;margin-left:auto;margin-right:auto">'+html+'</div>';
}
root.SgcBusinessElements={defaults,render};
})(window);
