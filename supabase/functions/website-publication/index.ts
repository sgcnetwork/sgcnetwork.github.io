import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.117.3';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
Deno.serve(async (req: Request) => {
 const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
 if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
 if (!['GET', 'POST'].includes(req.method)) return respond({ error: 'Method not allowed' }, 405);
 try {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  if (req.method === 'GET') {
   const slug = new URL(req.url).searchParams.get('site') || '';
   if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 40) return respond({ error: 'Website not found' }, 404);
   const { data, error } = await admin.rpc('sgc_resolve_published_website', { p_slug: slug });
   if (error) { console.error('Website lookup failed', error.code); return respond({ error: 'Website temporarily unavailable' }, 503); }
   return data ? respond({ site: data }) : respond({ error: 'Website not found or currently unavailable' }, 404);
  }
  if (Number(req.headers.get('content-length') || 0) > 32768) return respond({ error: 'Request too large' }, 413);
  const raw=await req.text();if(new TextEncoder().encode(raw).length>32768)return respond({error:'Request too large'},413);
  let body;try{body=JSON.parse(raw);}catch{return respond({error:'Invalid request'},400);}
  if(['checkout','order-receipt'].includes(body?.action)){
   if(typeof body.slug!=='string'||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)||body.slug.length<3||body.slug.length>40||typeof body.key!=='string'||!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(body.key))return respond({error:'Invalid checkout request'},400);
   if(body.action==='order-receipt'){const {data,error}=await admin.rpc('sgc_builder_order_receipt',{p_slug:body.slug,p_key:body.key});if(error)return respond({error:'Receipt unavailable'},503);return data?respond({order:data}):respond({error:'Order not found'},404);}
   const {data,error}=await admin.rpc('sgc_builder_create_order',{p_slug:body.slug,p_key:body.key,p_items:body.items,p_customer:body.customer});
   if(error)return respond({error:error.code==='P0001'?error.message:'Unable to place this order. Please review your cart and retry.'},400);
   return respond({order:data});
  }
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return respond({ error: 'Sign in to manage your website' }, 401);
  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) return respond({ error: 'Your session has expired. Please sign in again.' }, 401);
  if(body?.action==='list-sites'){
   // Resolve ownership from the verified JWT, never from browser-supplied IDs.
   const {data,error}=await admin.rpc('sgc_list_website_publications',{p_user:user.id});
   if(error)return respond({error:'Unable to load your published websites'},503);
   return respond({sites:data||[]});
  }
  if(body?.action==='order-status'){
   if(typeof body.orderId!=='string'||!['Open','Completed','Cancelled'].includes(body.status))return respond({error:'Invalid order update'},400);
   const {data,error}=await admin.rpc('sgc_builder_order_status',{p_user:user.id,p_order:body.orderId,p_status:body.status});
   if(error)return respond({error:error.code==='P0001'?error.message:'Unable to update order'},400);
   return respond(data);
  }
  if (!['publish', 'unpublish', 'status'].includes(body?.action)) return respond({ error: 'Unknown publishing action' }, 400);
  // User ID and snapshot are never accepted from the request body.
  const { data, error } = await admin.rpc('sgc_manage_website_publication', { p_user: user.id, p_action: body.action });
  if (error) return respond({ error: error.code === '23505' ? 'That website address is already taken. Choose another.' : error.code === 'P0001' ? error.message : 'Unable to update publication. Please try again.' }, 400);
  return respond(data);
 } catch { return respond({ error: 'Publishing is temporarily unavailable. Please try again.' }, 503); }
});
