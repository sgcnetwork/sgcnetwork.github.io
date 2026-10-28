// SGC customer website router. Contains no credentials.
// Route: *.sgcnetwork.co.za/* ; wildcard DNS: A * -> 192.0.2.1, Proxied.
const ORIGIN = 'https://sgcnetwork.co.za';
const API = 'https://bxpexanyoyubxeqqlggh.supabase.co/functions/v1/website-publication';
const RESERVED = new Set(['www','mail','email','send','resend','smtp','imap','pop','api','app','admin','studio','dashboard','academy','community','shop','builder','support','help','status','assets','cdn','ftp','ns1','ns2','sgc','sgcnetwork']);
const CSP = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src https:; media-src https:; connect-src https://bxpexanyoyubxeqqlggh.supabase.co; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export default {
 async fetch(request) {
  const u = new URL(request.url), suffix = '.sgcnetwork.co.za';
  if (!u.hostname.endsWith(suffix)) return fetch(request);
  const slug = u.hostname.slice(0, -suffix.length);
  if (RESERVED.has(slug)) return fetch(request);
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': CSP, 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()' };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 40) return new Response('Website not found', { status: 404, headers });
  if (slug === 'al-habib') return serveAlhabib(request, u);
  if (slug === 'djp') return serveDjp(request, u);
  if (slug === 'cfhp') return serveCfhp(request, u);
  if (slug === 'visaservices') return serveVisaServices(request, u);
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers });
  if (u.protocol !== 'https:') { u.protocol = 'https:'; return Response.redirect(u.href, 301); }
  if (u.pathname === '/robots.txt') return new Response('User-agent: *\nAllow: /\n', { headers: { ...headers, 'Content-Type': 'text/plain' } });
  const assets = { '/business.js': 'text/javascript; charset=utf-8', '/business.css': 'text/css; charset=utf-8', '/product-storefront.css': 'text/css; charset=utf-8', '/product-media.js': 'text/javascript; charset=utf-8', '/product-purchase.js': 'text/javascript; charset=utf-8', '/storefront-cart.js': 'text/javascript; charset=utf-8' };
  const asset = Object.hasOwn(assets, u.pathname);
  if (!asset && u.pathname !== '/') return new Response('Page not found', { status: 404, headers });
  try {
   if (!asset) {
    // No HTML caching: expiry/unpublish must take effect on the next visit.
    const site = await fetch(API + '?site=' + encodeURIComponent(slug), { signal: AbortSignal.timeout(10000) });
    if (!site.ok) return new Response(site.status === 404 ? 'Website not found or currently unavailable' : 'Website temporarily unavailable', { status: site.status === 404 ? 404 : 503, headers });
   }
   // Construct a new request: never forward customer cookies or authorization.
   const response = await fetch(ORIGIN + (asset ? u.pathname : '/published-site.html'), { signal: AbortSignal.timeout(10000) });
   if (!response.ok) return new Response('Website temporarily unavailable', { status: 503, headers });
   return new Response(request.method === 'HEAD' ? null : response.body, { status: 200, headers: { ...headers, 'Content-Type': asset ? assets[u.pathname] : 'text/html; charset=utf-8' } });
  } catch { return new Response('Website temporarily unavailable', { status: 503, headers }); }
 }
};


// Al-Habib is served from SGC's repository and SGC Supabase project.
async function serveAlhabib(request, u) {
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
 const files={'/':'/al-habib/index.html','/index.html':'/al-habib/index.html','/al-habib/app.js':'/al-habib/app.js','/al-habib/style.css':'/al-habib/style.css','/al-habib/favicon.svg':'/al-habib/favicon.svg'};
 if(u.protocol!=='https:'){u.protocol='https:';return Response.redirect(u.href,301)}
 if(u.pathname==='/manage')return Response.redirect(u.origin+'/#manage',302);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 if(u.pathname==='/robots.txt')return new Response('User-agent: *\nAllow: /\n',{headers:{...headers,'Content-Type':'text/plain'}});
 const path=files[u.pathname];if(!path)return new Response('Page not found',{status:404,headers});
 try{
 const r=await fetch(ORIGIN+path,{signal:AbortSignal.timeout(15000)});
 if(!r.ok)return new Response('Store temporarily unavailable',{status:503,headers});
 headers['Content-Type']=path.endsWith('.js')?'text/javascript; charset=utf-8':path.endsWith('.css')?'text/css; charset=utf-8':path.endsWith('.svg')?'image/svg+xml':'text/html; charset=utf-8';
 headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self' https://bxpexanyoyubxeqqlggh.supabase.co; font-src 'self' https://fonts.gstatic.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
 return new Response(request.method==='HEAD'?null:r.body,{status:200,headers});
 }catch{return new Response('Store temporarily unavailable',{status:503,headers})}
}

// Document Journey Processing at djp.sgcnetwork.co.za, served from SGC hosting.
async function serveDjp(request,u){
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
 if(u.protocol!=='https:'){u.protocol='https:';return Response.redirect(u.href,301)}
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 const allowed=new Set(['index.html','visa.html','pcc.html','contact.html','privacy.html','manage.html','app.js','style.css','favicon.svg','journey.jpg']);
 let file=u.pathname==='/'?'index.html':u.pathname.replace(/^\/djp\/?/,'').replace(/^\//,'');
 if(!file)file='index.html';
 if(u.pathname==='/robots.txt')return new Response('User-agent: *\nAllow: /\nDisallow: /djp/manage.html\n',{headers:{...headers,'Content-Type':'text/plain'}});
 if(!allowed.has(file))return new Response('Page not found',{status:404,headers});
 try{const response=await fetch(ORIGIN+'/djp/'+file,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)return new Response('Website temporarily unavailable',{status:503,headers});
 headers['Content-Type']=file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.jpg')?'image/jpeg':'text/html; charset=utf-8';
 headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self'; connect-src https://bxpexanyoyubxeqqlggh.supabase.co; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
 return new Response(request.method==='HEAD'?null:response.body,{status:200,headers});
 }catch{return new Response('Website temporarily unavailable',{status:503,headers})}
}

// Higher for Purpose: only serve the explicitly listed public website assets.
async function serveCfhp(request,u){
 if(u.protocol!=='https:'){u.protocol='https:';return Response.redirect(u.href,301)}
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'};
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 const file=u.pathname==='/'?'index.html':u.pathname.slice(1);
 const files={'index.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','booking.js':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8','services.json':'application/json','favicon.svg':'image/svg+xml'};
 if(!Object.hasOwn(files,file))return new Response('Page not found',{status:404,headers});
 try{const r=await fetch(ORIGIN+'/higher-for-purpose/'+file,{signal:AbortSignal.timeout(15000)});headers['Content-Type']=files[file];
 headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; img-src 'self' https:; connect-src 'self' https://bxpexanyoyubxeqqlggh.supabase.co; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
 return new Response(request.method==='HEAD'?null:r.body,{status:r.status,headers});}catch{return new Response('Website temporarily unavailable',{status:503,headers})}
}

// Visa Services uses SGC hosting and owner-restricted Supabase records/storage.
async function serveVisaServices(request,u){
 if(u.protocol!=='https:'){u.protocol='https:';return Response.redirect(u.href,301)}
 const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(), geolocation=()'};
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405,headers});
 if(u.pathname==='/robots.txt')return new Response('User-agent: *\nDisallow: /\n',{headers:{...headers,'Content-Type':'text/plain'}});
 const file=['/roadmap','/roadmap/','/roadmap/index.html'].includes(u.pathname)?'roadmap/index.html':u.pathname==='/'?'index.html':u.pathname.replace(/^\/visaservices\//,'').replace(/^\//,'');
 const files={'index.html':'text/html; charset=utf-8','roadmap/index.html':'text/html; charset=utf-8','roadmap.html':'text/html; charset=utf-8','app.js':'text/javascript; charset=utf-8','pdf.worker.mjs':'text/javascript; charset=utf-8','style.css':'text/css; charset=utf-8','favicon.svg':'image/svg+xml'};
 if(!Object.hasOwn(files,file))return new Response('Page not found',{status:404,headers});
 try{const r=await fetch(ORIGIN+'/visaservices/'+file,{signal:AbortSignal.timeout(15000)});headers['Content-Type']=files[file];
 headers['Content-Security-Policy']="default-src 'self'; worker-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src 'self' https://bxpexanyoyubxeqqlggh.supabase.co; font-src 'self' https://fonts.gstatic.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
 return new Response(request.method==='HEAD'?null:r.body,{status:r.status,headers});}catch{return new Response('Website temporarily unavailable',{status:503,headers})}
}
