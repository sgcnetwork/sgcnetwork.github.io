(function(){
  const s=window.SGC_CONFIG||{};
  if(!window.supabase||!s.supabaseUrl||s.supabaseUrl.includes('PASTE_')) return;
  window.sgcSupabase=window.supabase.createClient(s.supabaseUrl,s.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
})();
