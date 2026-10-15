// Cloudflare Worker: attach ONLY to *.sgcnetwork.co.za/*, not sgcnetwork.co.za/*.
// Requires a proxied wildcard DNS record and an active Worker route.
const ROOT = 'https://sgcnetwork.co.za';
export default {
 async fetch(request) {
  const incoming = new URL(request.url);
  const match = /^([a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?)\.sgcnetwork\.co\.za$/i.exec(incoming.hostname);
  if (!match) return new Response('Not found', {status:404});
  const slug = match[1].toLowerCase();
  if (['www','mail','email','api','app','admin','studio','dashboard','academy','community','shop','builder','support','help','status','assets','cdn','ftp','ns1','ns2','sgc','sgcnetwork','smtp','imap','pop','send','resend'].includes(slug)) return new Response('Not found',{status:404});
  const destination = new URL(incoming.pathname === '/' ? '/published-site.html' : incoming.pathname, ROOT);
  destination.search = incoming.pathname === '/' ? '?site=' + encodeURIComponent(slug) : incoming.search;
  if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405});
  const response = await fetch(new Request(destination, request), {redirect:'follow'});
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options','nosniff');
  headers.set('Cache-Control','no-store');
  return new Response(response.body,{status:response.status,headers});
 }
};
