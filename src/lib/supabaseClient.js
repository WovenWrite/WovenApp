// ── Supabase (loaded via CDN) ──
// Extracted verbatim from App.jsx. App.jsx should import { supabase, getSupabase }
// from here instead of defining its own copy.
var SB_URL='https://mxsdiqrbxlvcwexfdtrj.supabase.co';
var SB_KEY='sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u';

// getSupabase() safely returns client once CDN is ready
function getSupabase(){
  if(!window.__sb){
    if(window.supabase&&window.supabase.createClient){
      window.__sb=window.supabase.createClient(SB_URL,SB_KEY);
    }
  }
  return window.__sb||null;
}

var supabase={
  auth:{
    getSession:function(){return getSupabase()?getSupabase().auth.getSession():Promise.resolve({data:{session:null}});},
    getUser:function(){return getSupabase()?getSupabase().auth.getUser():Promise.resolve({data:{user:null}});},
    signUp:function(o){return getSupabase()?getSupabase().auth.signUp(o):Promise.resolve({error:{message:'Auth not ready'}});},
    signInWithPassword:function(o){return getSupabase()?getSupabase().auth.signInWithPassword(o):Promise.resolve({error:{message:'Auth not ready'}});},
    signOut:function(){return getSupabase()?getSupabase().auth.signOut():Promise.resolve({});},
    resetPasswordForEmail:function(e){return getSupabase()?getSupabase().auth.resetPasswordForEmail(e):Promise.resolve({error:{message:'Auth not ready'}});},
    onAuthStateChange:function(cb){if(getSupabase())return getSupabase().auth.onAuthStateChange(cb);return{data:{subscription:{unsubscribe:function(){}}}};}
  },
  from:function(table){
    var client=getSupabase();
    if(!client){
      var noop=function(){return Promise.resolve({data:null,error:{message:'DB not ready'}});};
      var chain={maybeSingle:noop,single:noop,then:function(cb){return Promise.resolve(cb({data:null,error:null}));}};
      var eqChain=function(){return{eq:function(){return chain;},maybeSingle:noop};};
      return{select:function(){return{eq:function(){return{eq:eqChain,maybeSingle:noop};},maybeSingle:noop};},upsert:noop,insert:noop};
    }
    return client.from(table);
  }
};

export { supabase, getSupabase, SB_URL, SB_KEY };
