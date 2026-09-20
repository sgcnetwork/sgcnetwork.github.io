(function(){
 const sb=()=>window.sgcSupabase;
 window.sgcAuth={
  async signUp(email,password,name){const {data,error}=await sb().auth.signUp({email,password,data:{full_name:name}});return {data,error};},
  async signIn(email,password){return await sb().auth.signInWithPassword({email,password});},
  async signOut(){return await sb().auth.signOut();},
  async requireUser(){const {data}=await sb().auth.getUser();if(!data.user){location.href='login.html';return null}return data.user;}
 };
})();
