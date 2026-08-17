// @ts-nocheck
import ExploreCanvas from './ExploreCanvas'
import { useState, useEffect, useRef } from "react";
import DraftEditor from './DraftEditor'
import SharedDraftView from './SharedDraftView'

// ── Version snapshots ──
var MAX_SNAPSHOTS=20;
var SNAPSHOT_INTERVAL_MS=60*60*1000;
function getSnapshotKey(draftId){return 'woven:versions:'+draftId;}
function loadSnapshots(draftId){try{var v=localStorage.getItem(getSnapshotKey(draftId));return v?JSON.parse(v):[];}catch(e){return[];}}
function saveSnapshot(draftId,body,wordCount,label){
  if(!body||!body.trim())return;
  var snapshots=loadSnapshots(draftId);var now=Date.now();
  var last=snapshots[0];
  if(label==='auto'&&last&&(now-last.ts)<SNAPSHOT_INTERVAL_MS)return;
  var snap={id:genId(),ts:now,label:label||'auto',body:body,wordCount:wordCount||0};
  var updated=[snap].concat(snapshots).slice(0,MAX_SNAPSHOTS);
  try{localStorage.setItem(getSnapshotKey(draftId),JSON.stringify(updated));}catch(e){}
  var uid=window.__wovenUserId;
  if(uid){supabase.from('wf_data').upsert({key:getSnapshotKey(draftId),user_id:uid,value:updated,updated_at:new Date().toISOString()},{onConflict:'key,user_id'}).then(function(){});}
}
function formatSnapshotTime(ts){
  var d=new Date(ts);var now=new Date();
  var isToday=d.toDateString()===now.toDateString();
  var yesterday=new Date(now);yesterday.setDate(yesterday.getDate()-1);
  var isYesterday=d.toDateString()===yesterday.toDateString();
  var time=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  if(isToday)return 'Today '+time;
  if(isYesterday)return 'Yesterday '+time;
  return d.toLocaleDateString([],{month:'short',day:'numeric'})+' '+time;
}

// ── Supabase (loaded via CDN) ──
var SB_URL='https://mxsdiqrbxlvcwexfdtrj.supabase.co';
var SB_KEY='sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u';
// Supabase — loaded via index.html CDN script tag
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

// ── Storage ──
function saveLS(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
function loadLS(key,def){return Promise.resolve().then(function(){try{var v=localStorage.getItem(key);return v?JSON.parse(v):def;}catch(e){return def;}});}
function saveDB(key,val){
  var uid=window.__wovenUserId;
  if(!uid)return saveLS(key,val);
  saveLS(key,val); // keep local copy too
  supabase.from('wf_data').upsert({key:key,user_id:uid,value:val,updated_at:new Date().toISOString()},{onConflict:'key,user_id'}).then(function(r){if(r.error)console.error('saveDB error:',r.error);});
}
function loadDB(key,def){
  var uid=window.__wovenUserId;
  if(!uid)return loadLS(key,def);
  return supabase.from('wf_data').select('value').eq('key',key).eq('user_id',uid).maybeSingle().then(function(r){
    if(r.data&&r.data.value!==undefined)return r.data.value;
    return loadLS(key,def); // fallback to local
  });
}

// ── Utils ──
function genId(){return '_'+Math.random().toString(36).slice(2)+Date.now().toString(36);}

// ── Image helpers ──
function compressImage(file){
  return new Promise(function(resolve){
    var img=new Image();var url=URL.createObjectURL(file);
    img.onload=function(){
      var MAX=1200;var w=img.width;var h=img.height;
      if(w>MAX){h=Math.round(h*MAX/w);w=MAX;}
      var canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      canvas.toBlob(function(blob){resolve(blob||file);},{type:'image/jpeg',quality:0.82});
    };
    img.onerror=function(){URL.revokeObjectURL(url);resolve(file);};
    img.src=url;
  });
}
function deleteStorageImage(url){
  if(!url||!url.includes('supabase'))return;
  var client=getSupabase();if(!client)return;
  var marker='/object/public/woven-images/';var idx=url.indexOf(marker);if(idx<0)return;
  client.storage.from('woven-images').remove([url.slice(idx+marker.length)]).then(function(){});
}
async function uploadImage(file){
  var client=getSupabase();if(!client)return null;
  var compressed=await compressImage(file);
  var path='uploads/'+genId()+'.jpg';
  var res=await client.storage.from('woven-images').upload(path,compressed,{upsert:true,contentType:'image/jpeg'});
  if(res.error){console.error('Upload error:',res.error);return null;}
  var pub=client.storage.from('woven-images').getPublicUrl(path);
  return pub.data&&pub.data.publicUrl?pub.data.publicUrl:null;
}
function countWords(t){if(!t)return 0;var s=t.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();return s?s.split(' ').filter(function(w){return w.length>0;}).length:0;}
function stripHtml(html){return html?html.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim():'';}
function todayStr(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function dayLbl(offset){var days=['Su','Mo','Tu','We','Th','Fr','Sa'];var d=new Date();d.setDate(d.getDate()-offset);return days[d.getDay()];}
function initials(name){
  if(!name||!name.trim())return '?';
  var p=name.trim().split(/\s+/).filter(function(w){return w.length>0;});
  if(p.length===0)return '?';
  if(p.length===1)return p[0].slice(0,1).toUpperCase();
  if(p.length===2)return(p[0][0]+p[1][0]).toUpperCase();
  return(p[0][0]+p[1][0]+p[2][0]).toUpperCase();
}
function getGreeting(){var h=new Date().getHours();if(h<12)return 'Good morning';if(h<17)return 'Good afternoon';return 'Good evening';}
function useIsMobile(){var s=useState(window.innerWidth<768);var isMobile=s[0];var setIsMobile=s[1];useEffect(function(){function onResize(){setIsMobile(window.innerWidth<768);}window.addEventListener('resize',onResize);return function(){window.removeEventListener('resize',onResize);};},[]);return isMobile;}

// ── Constants ──
var STATUSES={loose_thread:{label:'Loose Thread',color:'#d4943e'},first_draft:{label:'First Draft',color:'#2f76e0'},second_draft:{label:'Second Draft',color:'#e02f79'},under_review:{label:'Under Review',color:'#ce2fe0'},complete:{label:'Complete',color:'#64e02f'}};
// Canvas | Table | Tiles | Cards | (separator) Strands
var VIEW_MODES=[
  {key:'canvas', icon:'hub',         label:'Canvas',     group:'main'},
  {key:'table',  icon:'table_rows',  label:'Timeline',   group:'main'},
  {key:'cards',  icon:'view_agenda', label:'Storyboard', group:'main'},
  {key:'strands',icon:'share',       label:'Strands',    group:'strands'}
];
var PRESET_COLORS=['#2f76e0','#64e02f','#ce2fe0','#2fe07f','#e02f79','#c45e28','#e8a030','#2f9966','#b83220','#f0c050'];
var FIELD_TYPES=[{id:'short_text',label:'Short text'},{id:'long_text',label:'Long text'},{id:'number',label:'Number'},{id:'boolean',label:'Yes / No'},{id:'select',label:'Dropdown'}];
var PROJ_TYPES=[
  {id:'fiction',    label:'Fiction',     icon:'auto_stories',colls:['Characters','Locations','Lore & World'],desc:'Novels, short fiction, narrative'},
  {id:'nonfiction', label:'Non-Fiction', icon:'article',     colls:['Sources','Interviews','Subjects'],      desc:'Essays, memoir, journalism'},
  {id:'research',   label:'Research',   icon:'science',     colls:['Sources','Reports','Interviews'],        desc:'Academic or investigative writing'},
  {id:'blog',       label:'Blog Series',icon:'rss_feed',    colls:['Topics','Sources','Audience Notes'],     desc:'Posts, columns, newsletters'},
  {id:'screenplay', label:'Screenplay', icon:'movie',       colls:['Characters','Locations','Scenes'],       desc:'Film, TV, stage scripts'},
  {id:'other',      label:'Other',      icon:'edit_note',   colls:['Characters','Sources'],                  desc:'Everything else'}
];
var COLL_FIELDS={
  'Characters':[{id:'aliases',label:'Aliases',type:'short_text'},{id:'role',label:'Role',type:'short_text'},{id:'personality',label:'Personality',type:'long_text'},{id:'appearance',label:'Physical Description',type:'long_text'}],
  'Locations':[{id:'type',label:'Type',type:'short_text'},{id:'description',label:'Description',type:'long_text'}],
  'Lore & World':[{id:'category',label:'Category',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}],
  'Sources':[{id:'author',label:'Author',type:'short_text'},{id:'url',label:'URL',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}],
  'Interviews':[{id:'subject',label:'Subject',type:'short_text'},{id:'date',label:'Date',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}],
  'Scenes':[{id:'location',label:'Location',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}]
};
function defaultFields(c){return COLL_FIELDS[c]||[{id:'notes',label:'Notes',type:'long_text'}];}
var DEFAULT_TABLE_COLS=['title','synopsis','status','strandTags'];

// ── Seed Data ──
function makeSeedData(pid){
  var now=new Date().toISOString();
  var drafts=[
    {id:'d1',projectId:pid,title:'The Arrival',synopsis:'Eldric arrives at the farmstead to find it eerily silent.',status:'second_draft',order:1,parentId:null,nestExpanded:true,body:'<p>The farmstead appeared through the fog as Eldric crested the hill. He had not expected the silence.</p><p>"Maren?" His voice was swallowed by the grey.</p>',wordCount:32,strandTags:['s1','s2'],pov:'s1',customFields:{},createdAt:now,updatedAt:now},
    {id:'d1a',projectId:pid,title:'The Farmstead at Dawn',synopsis:'A nested scene — Eldric searches the outbuildings.',status:'first_draft',order:1.1,parentId:'d1',nestExpanded:true,body:'',wordCount:0,strandTags:['s1'],pov:'s1',customFields:{},createdAt:now,updatedAt:now},
    {id:'d2',projectId:pid,title:'The Keep at Ironveil',synopsis:'Lord Vasher summons the council. Maren must attend or raise suspicion.',status:'first_draft',order:2,parentId:null,nestExpanded:true,body:'<p>The great hall was lit by torchlight even at midday. Maren took her place where the shadows were deepest.</p>',wordCount:27,strandTags:['s2','s3'],pov:'s2',customFields:{},createdAt:now,updatedAt:now},
    {id:'d3',projectId:pid,title:'First Light',synopsis:'Eldric remembers the archive before the fire.',status:'first_draft',order:3,parentId:null,nestExpanded:true,body:'<p>He had loved the archive most at dawn, when the light caught the dust motes like suspended snow.</p>',wordCount:24,strandTags:['s1'],pov:'s1',customFields:{},createdAt:now,updatedAt:now},
    {id:'d4',projectId:pid,title:'The Council Meets',synopsis:'Something is decided that cannot be undone.',status:'first_draft',order:4,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:['s2','s3'],pov:'s2',customFields:{},createdAt:now,updatedAt:now},
    {id:'d5',projectId:pid,title:"Eldric's Secret",synopsis:'The truth about the archive fire is finally revealed.',status:'complete',order:5,parentId:null,nestExpanded:true,body:'<p>Eldric had not started the fire. But he had known it was coming.</p>',wordCount:18,strandTags:['s1'],pov:'s1',customFields:{},createdAt:now,updatedAt:now},
    {id:'lt1',projectId:pid,title:'The Dream Sequence',synopsis:'Maren keeps having the same dream. Magical or psychological?',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],pov:'',customFields:{},createdAt:now,updatedAt:now},
    {id:'lt2',projectId:pid,title:'',synopsis:'Where does Vasher finally show his hand?',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],pov:'',customFields:{},createdAt:now,updatedAt:now}
  ];
  var templates=[
    {id:'t1',projectId:pid,name:'Characters',fields:COLL_FIELDS['Characters'],sharedWith:[]},
    {id:'t2',projectId:pid,name:'Locations',fields:COLL_FIELDS['Locations'],sharedWith:[]},
    {id:'t3',projectId:pid,name:'Plot Threads',fields:[{id:'notes',label:'Notes',type:'long_text'}],sharedWith:[]}
  ];
  var strandsObj={
    'Characters':[
      {id:'s1',templateId:'t1',collectionName:'Characters',name:'Eldric',color:'#6366f1',image:null,fields:{aliases:'El, the Archivist',role:'Protagonist',personality:"Quiet, methodical, haunted by survivor's guilt.",appearance:'Mid-40s, silver-streaked hair, ink-stained fingers.'},createdAt:now},
      {id:'s2',templateId:'t1',collectionName:'Characters',name:'Maren',color:'#2dd4bf',image:null,fields:{aliases:'',role:'Deuteragonist',personality:'Sharp, politically savvy, protective to the point of self-destruction.',appearance:'Late 30s, dark braided hair, a scar along her jaw.'},createdAt:now},
      {id:'s3',templateId:'t1',collectionName:'Characters',name:'Lord Vasher',color:'#f87171',image:null,fields:{aliases:'The Warden',role:'Antagonist',personality:'Utterly convinced of his own righteousness.',appearance:'Older, impeccably dressed, silver-tipped cane he does not need.'},createdAt:now}
    ],
    'Locations':[
      {id:'l1',templateId:'t2',collectionName:'Locations',name:'The Keep at Ironveil',color:'#818cf8',image:null,fields:{type:'Fortress',description:'Stone keep built into the northern cliff face.'},createdAt:now},
      {id:'l2',templateId:'t2',collectionName:'Locations',name:'The Farmstead',color:'#a5b4fc',image:null,fields:{type:'Rural property',description:"Maren's childhood home. Remote, fog-prone."},createdAt:now}
    ],
    'Plot Threads':[{id:'pt1',templateId:'t3',collectionName:'Plot Threads',name:'The Archive Fire',color:'#38bdf8',image:null,fields:{notes:'What started the fire?'},createdAt:now}]
  };
  return{drafts:drafts,templates:templates,strandsObj:strandsObj};
}

// ── Draft tree helpers ──
function buildTree(drafts){
  // Returns top-level drafts with .children array, sorted by order
  var byId={};
  drafts.forEach(function(d){byId[d.id]=Object.assign({},d,{children:[]});});
  var roots=[];
  drafts.forEach(function(d){
    if(d.parentId&&byId[d.parentId]){byId[d.parentId].children.push(byId[d.id]);}
    else{roots.push(byId[d.id]);}
  });
  roots.sort(function(a,b){return (a.order||0)-(b.order||0);});
  roots.forEach(function(r){r.children.sort(function(a,b){return (a.order||0)-(b.order||0);});});
  return roots;
}
function draftLabel(draft,parentDraft){
  if(!draft.parentId){
    return ''+Math.floor(draft.order||0);
  }
  if(parentDraft){
    var pn=Math.floor(parentDraft.order||0);
    var idx=parentDraft.children?parentDraft.children.findIndex(function(c){return c.id===draft.id;}):-1;
    return pn+'.'+(idx>=0?idx+1:1);
  }
  return ''+draft.order;
}

// ── CSS ──
var CSS=`
@import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&family=Caveat:wght@400;600&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');

:root {
  --bg0:#fdf8f0; --bg1:#f5ede0; --bg2:#ede0cc; --bg3:#e2d0b8; --bg4:#d4b896;
  --indigo:#c45e28; --indigoL:#e8a030; --amber-gold:#f0c050; --amber-dark:#8a3a10;
  --text:#2a1f10; --body-text:#4a3520; --mid:#7a5a38; --placeholder:#a88060;
  --border:#e2d0b8; --teal:#2f9966; --danger:#b83220;
  --serif:'Crimson Text',Georgia,serif;
  --ui:'DM Sans',system-ui,sans-serif;
  --mono:'Courier New',monospace;
  --scribble:'Caveat',cursive;
  --r:8px; --rl:12px;
}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg0);}
.woven-root{display:flex;flex-direction:column;height:100vh;overflow:hidden;background:var(--bg0);color:var(--text);font-family:var(--ui);font-size:16px;-webkit-font-smoothing:antialiased;position:relative;}
.woven-root::after{content:'';position:fixed;inset:0;pointer-events:none;z-index:9999;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)'/%3E%3C/svg%3E");mix-blend-mode:multiply;opacity:.07;}
button{font-family:var(--ui);cursor:pointer;border:none;background:none;color:inherit;font-size:14px;}
input,textarea,select{font-family:var(--ui);font-size:14px;color:var(--text);background:var(--bg1);border:1px solid var(--border);border-radius:var(--r);padding:8px 12px;width:100%;}
input::placeholder,textarea::placeholder{color:var(--placeholder);opacity:1;}
input:focus,textarea:focus,select:focus{outline:2px solid var(--indigo);outline-offset:-1px;background:var(--bg0);}
textarea{resize:vertical;}[contenteditable]:focus{outline:none;}
::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--bg4);border-radius:2px;}
.mi{font-family:'Material Icons';font-style:normal;font-size:20px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;direction:ltr;font-feature-settings:'liga';-webkit-font-smoothing:antialiased;}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r);font-size:14px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:all .15s;white-space:nowrap;}
.btn-primary{background:var(--indigo);color:#fff;box-shadow:0 1px 4px rgba(42,31,16,.15);}.btn-primary:hover{background:var(--amber-dark);color:#fff;}
.btn-ghost{color:var(--mid);border-color:var(--border);background:var(--bg1);}.btn-ghost:hover{color:var(--text);border-color:var(--bg4);background:var(--bg2);}
.btn-danger{color:var(--danger);border-color:var(--danger);}.btn-danger:hover{background:rgba(184,50,32,.08);}
.btn-sm{padding:5px 11px;font-size:13px;}.btn-icon{padding:5px;border-radius:var(--r);color:var(--mid);display:inline-flex;align-items:center;}.btn-icon:hover{background:var(--bg2);color:var(--text);}
.nav{display:flex;align-items:center;padding:0 14px;height:54px;background:var(--bg1);border-bottom:1px solid var(--border);flex-shrink:0;gap:10px;box-shadow:0 1px 4px rgba(42,31,16,.05);}
.wordmark{font-family:var(--serif);font-size:22px;font-weight:600;color:var(--indigo);cursor:pointer;user-select:none;}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;cursor:pointer;}
.view-switcher{display:flex;align-items:center;background:var(--bg2);border-radius:var(--r);padding:3px;gap:1px;border:1px solid var(--border);}
.view-seg{height:32px;width:36px;display:flex;align-items:center;justify-content:center;border-radius:6px;cursor:pointer;transition:all .15s;color:var(--mid);position:relative;flex-shrink:0;}
.view-seg:hover{color:var(--text);}
.view-seg.active{background:var(--bg0);color:var(--indigo);box-shadow:0 1px 4px rgba(42,31,16,.08);}
.view-seg .mi{font-size:18px;}
.view-seg-tip{position:absolute;bottom:-30px;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg0);font-size:11px;padding:3px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .1s;z-index:100;}
.view-seg:hover .view-seg-tip{opacity:1;}
.view-sep{width:1px;height:20px;background:var(--border);margin:0 3px;flex-shrink:0;}
.proj-title-inp{font-family:var(--serif);font-size:17px;font-weight:600;color:var(--text);background:transparent;border:none;padding:2px 4px;border-radius:4px;min-width:60px;max-width:300px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.proj-title-inp:focus{outline:1px solid var(--indigo);background:var(--bg1);}
.proj-title-inp::placeholder{color:var(--placeholder);}
.panel-overlay{position:fixed;inset:0;z-index:200;display:flex;justify-content:flex-end;}
.panel-backdrop{position:absolute;inset:0;background:rgba(42,31,16,.25);}
.panel-box{position:relative;width:420px;max-width:92vw;background:var(--bg1);border-left:1px solid var(--border);display:flex;flex-direction:column;box-shadow:-8px 0 40px rgba(42,31,16,.10);overflow:hidden;}
.panel-hdr{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--border);flex-shrink:0;}
.panel-title{font-family:var(--serif);font-size:19px;font-weight:600;color:var(--text);}
.panel-body{flex:1;overflow-y:auto;padding:18px;}
.panel-footer{padding:14px 18px;border-top:1px solid var(--border);flex-shrink:0;display:flex;gap:8px;justify-content:flex-end;}
.modal-overlay{position:fixed;inset:0;z-index:300;display:flex;align-items:center;justify-content:center;}
.modal-backdrop{position:absolute;inset:0;background:rgba(42,31,16,.3);}
.modal-box{position:relative;background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);padding:28px;width:480px;max-width:92vw;box-shadow:0 20px 60px rgba(42,31,16,.15);max-height:88vh;overflow-y:auto;}
.sect-lbl{font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px;display:block;}
.dot-grid{background-image:radial-gradient(circle, rgba(160,120,70,0.18) 1px, transparent 1px);background-size:22px 22px;}
.dash-layout{display:flex;flex:1;overflow:hidden;background:var(--bg0);align-items:stretch;}
.dash-main{flex:2;overflow-y:auto;padding:40px 36px 80px;min-width:0;background-color:var(--bg0);background-image:radial-gradient(circle, rgba(160,120,70,0.18) 1px, transparent 1px);background-size:22px 22px;}
.dash-sidebar{flex:1;flex-shrink:0;border-left:1px solid var(--border);overflow-y:auto;background:var(--bg1);padding:24px;min-width:220px;max-width:280px;}
.dash-greeting{font-family:var(--serif);font-size:28px;font-weight:600;color:var(--text);margin-bottom:4px;}
.dash-subtitle{font-size:14px;color:var(--mid);margin-bottom:24px;font-weight:300;}
.proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px;}
.proj-card{background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);overflow:hidden;cursor:pointer;transition:border-color .15s,box-shadow .15s,transform .1s;box-shadow:0 1px 4px rgba(42,31,16,.05);}
.proj-card:hover{border-color:var(--indigo);transform:translateY(-2px);box-shadow:0 8px 24px rgba(42,31,16,.10);}
.proj-card-band{height:64px;background:linear-gradient(135deg,var(--bg3),var(--bg4));display:flex;align-items:center;padding:12px;font-family:var(--serif);font-size:26px;color:rgba(42,31,16,.2);font-weight:600;position:relative;overflow:hidden;}
.proj-card-body{padding:12px 14px;}
.proj-card-title{font-family:var(--serif);font-size:16px;font-weight:600;margin-bottom:5px;color:var(--text);}
.proj-card-syn{font-size:12px;color:var(--mid);line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:54px;margin-bottom:8px;}
.proj-card-footer{display:flex;justify-content:space-between;font-size:11px;color:var(--placeholder);}
.add-proj{border:2px dashed var(--border);border-radius:var(--rl);cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:155px;transition:all .15s;}
.add-proj:hover{border-color:var(--indigo);background:rgba(196,94,40,.04);}
.stat-card{background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(42,31,16,.04);}
.stat-card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;}
.stat-card-title{font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;letter-spacing:.08em;}
.stat-num{font-family:var(--serif);font-size:36px;font-weight:600;line-height:1;color:var(--text);}
.stat-sub{font-size:12px;color:var(--mid);margin-top:3px;}
.progress-bar-bg{height:4px;background:var(--bg3);border-radius:2px;overflow:hidden;margin-top:8px;}
.progress-bar-fill{height:100%;background:var(--indigo);border-radius:2px;transition:width .3s;}
.week-chart{display:flex;align-items:flex-end;gap:3px;height:44px;margin-top:8px;}
.week-bar{width:100%;border-radius:2px 2px 0 0;background:var(--bg3);min-height:2px;}
.week-bar.today{background:var(--indigo);}
.week-day-lbl{font-size:9px;color:var(--mid);}
.view-hdr{display:flex;align-items:center;gap:8px;padding:10px 16px;border-bottom:1px solid var(--border);flex-shrink:0;background:var(--bg1);flex-wrap:wrap;}
.filter-btn{display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:var(--r);border:1px solid var(--border);font-size:13px;color:var(--mid);cursor:pointer;background:var(--bg0);transition:all .15s;}
.filter-btn:hover{border-color:var(--bg4);color:var(--text);background:var(--bg1);}
.filter-btn.active{border-color:var(--indigo);color:var(--indigo);background:rgba(196,94,40,.06);}
.sort-select{width:auto;padding:6px 10px;font-size:13px;color:var(--mid);background:var(--bg0);border:1px solid var(--border);border-radius:var(--r);}
.filter-dropdown{position:fixed;z-index:400;background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);box-shadow:0 8px 28px rgba(42,31,16,.14);min-width:240px;max-height:360px;overflow-y:auto;padding:8px;}
.filter-coll-lbl{font-size:10px;font-weight:600;color:var(--indigo);text-transform:uppercase;letter-spacing:.08em;padding:8px 8px 4px;display:block;}
.chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;border:1px solid transparent;}
.view-layout{display:flex;flex-direction:column;flex:1;overflow:hidden;position:relative;}
.view-area{flex:1;overflow-y:auto;padding:16px 16px 80px;}
.cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;}
.draft-card{background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);display:flex;flex-direction:column;overflow:hidden;transition:border-color .15s,box-shadow .15s;height:226px;box-shadow:0 1px 4px rgba(42,31,16,.04);}
.draft-card:hover{box-shadow:0 4px 12px rgba(42,31,16,.08);}
.draft-card.drag-over{border-color:var(--indigo);background:rgba(196,94,40,.03);}
.draft-card.drop-before{border-left:3px solid var(--indigo);background:transparent;}
.draft-card.drop-after{border-right:3px solid var(--indigo);background:transparent;}
.draft-card.nest-target{border-color:var(--teal);border-style:dashed;background:rgba(47,153,102,.04);}
.draft-card.nest-target{border-color:var(--teal);border-style:dashed;}
.card-hdr{height:64px;background:linear-gradient(135deg,var(--bg2),var(--bg3));display:flex;align-items:center;justify-content:space-between;padding:0 10px;flex-shrink:0;}
.card-seq{font-family:var(--scribble);font-size:15px;font-weight:600;color:var(--mid);}
.card-body{flex:1;padding:8px 10px;overflow:hidden;display:flex;flex-direction:column;gap:4px;}
.card-title-f{font-family:var(--serif);font-size:15px;font-weight:600;color:var(--text);width:100%;background:transparent;border:none;border-radius:4px;padding:2px 4px;resize:none;overflow:hidden;line-height:1.35;height:38px;max-height:52px;display:block;white-space:pre-wrap;}
.card-title-f:focus{background:var(--bg2);outline:1px solid var(--indigo);}
.card-title-f::placeholder{color:var(--placeholder);}
.card-syn-f{font-size:12px;color:var(--mid);flex:1;resize:none;overflow-y:auto;width:100%;background:transparent;border:none;border-radius:4px;padding:2px 4px;font-family:var(--ui);line-height:1.4;}
.card-syn-f:focus{background:var(--bg2);outline:1px solid var(--indigo);}
.card-syn-f::placeholder{color:var(--placeholder);}
.strand-chips{display:flex;flex-wrap:wrap;gap:3px;}
.card-footer{display:flex;align-items:center;gap:6px;padding:6px 10px;border-top:1px solid var(--border);flex-shrink:0;background:var(--bg0);}
.card-wc{font-size:11px;color:var(--placeholder);}
.card-open{padding:3px 8px;background:var(--bg2);border-radius:4px;font-size:11px;color:var(--indigo);margin-left:auto;border:1px solid var(--border);}
.card-open:hover{background:var(--bg3);}
.arrow-btn{width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;color:var(--mid);transition:all .15s;flex-shrink:0;}
.arrow-btn:hover{background:var(--bg2);color:var(--text);}
.nest-indent{margin-left:24px;position:relative;}
.nest-indent::before{content:'';position:absolute;left:-12px;top:0;bottom:0;width:1px;background:var(--border);}
.lt-section{margin-top:24px;border-top:1px solid var(--border);padding-top:18px;}
.lt-hdr{display:flex;align-items:center;gap:7px;padding:0 0 10px;cursor:pointer;}
.lt-tilde{color:var(--teal);font-size:20px;font-weight:600;line-height:1;font-family:var(--scribble);}
.lt-label{font-size:13px;font-weight:600;color:var(--mid);flex:1;}
.lt-chevron{color:var(--mid);font-size:20px;transition:transform .2s;}
.lt-chevron.open{transform:rotate(90deg);}
.add-lt{display:flex;align-items:center;gap:5px;font-size:13px;color:var(--mid);padding:8px 2px;cursor:pointer;margin-top:6px;}
.add-lt:hover{color:var(--teal);}
.empty-view{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;padding:48px 24px;gap:12px;color:var(--placeholder);text-align:center;}
.table-wrap{flex:1;overflow:auto;}
.wt{border-collapse:collapse;width:100%;table-layout:fixed;}
.wt th{background:var(--bg1);border-bottom:2px solid var(--border);padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;letter-spacing:.08em;position:sticky;top:0;z-index:2;white-space:nowrap;user-select:none;overflow:hidden;position:relative;}
.wt th.resizable{resize:horizontal;overflow:hidden;min-width:60px;}
.col-resize-handle{position:absolute;right:0;top:0;bottom:0;width:5px;cursor:col-resize;background:transparent;z-index:3;}
.col-resize-handle:hover{background:var(--indigo);opacity:.3;}
.wt td{padding:9px 12px;border-bottom:1px solid var(--bg2);font-size:13px;vertical-align:middle;color:var(--body-text);}
.wt tr:hover td{background:rgba(196,94,40,.03);}
.wt tr.drag-over td{background:rgba(196,94,40,.06);}
.wt tr.nest-row td{background:rgba(42,31,16,.02);}
.tbl-inp{background:transparent;border:none;padding:0;font-size:13px;color:var(--text);font-family:var(--ui);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tbl-inp:focus{background:var(--bg1);border-radius:3px;padding:2px 5px;outline:1px solid var(--indigo);}
.tbl-inp::placeholder{color:var(--placeholder);}
.tbl-inp.syn{color:var(--mid);font-size:12px;}
.bind-draft-list{border:1px solid var(--border);border-radius:var(--r);overflow-y:auto;max-height:360px;background:var(--bg0);}
.bind-draft-row{display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid var(--bg2);font-size:13px;}
.bind-draft-row:last-child{border-bottom:none;}
.editor-layout{display:flex;flex-direction:column;flex:1;overflow:hidden;min-height:0;}
.editor-topbar{display:flex;align-items:center;gap:8px;padding:0 14px;height:54px;background:var(--bg1);border-bottom:1px solid var(--border);flex-shrink:0;box-shadow:0 1px 4px rgba(42,31,16,.05);}
.editor-topbar-row1{display:contents;}
.editor-topbar-row2{display:contents;}
.editor-back{font-size:20px;color:var(--mid);cursor:pointer;padding:4px 6px;border-radius:6px;display:flex;align-items:center;}
.editor-back:hover{background:var(--bg2);color:var(--text);}
.editor-title-inp{font-family:var(--serif);font-size:19px;font-weight:600;flex:1;background:transparent;border:none;color:var(--text);padding:2px 4px;border-radius:4px;}
.editor-title-inp:focus{outline:1px solid var(--indigo);background:var(--bg1);}
.editor-title-inp::placeholder{color:var(--placeholder);}
.editor-main{display:flex;flex:1;overflow:hidden;}
.editor-center{flex:1;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;position:relative;-webkit-overflow-scrolling:touch;}
.editor-body{padding:48px 64px;font-family:var(--serif);line-height:1.9;color:var(--body-text);min-height:calc(100vh - 160px);font-size:19px;max-width:900px;margin:0 auto;width:100%;box-sizing:border-box;-webkit-user-select:text;user-select:text;touch-action:manipulation;cursor:text;}
.editor-body:focus{outline:none;}
.editor-body:empty:before{content:attr(data-placeholder);color:var(--placeholder);pointer-events:none;}
.editor-body h1{font-family:var(--serif);font-size:30px;font-weight:600;margin-bottom:14px;color:var(--text);}
.editor-body h2{font-family:var(--serif);font-size:23px;font-weight:600;margin-bottom:10px;color:var(--text);}
.editor-body p{margin-bottom:28px;margin-top:0;}.editor-body h1{margin-bottom:16px;}.editor-body h2{margin-bottom:12px;}.editor-body blockquote{border-left:3px solid var(--border);margin:0 0 20px 0;padding:4px 16px;color:var(--mid);}
.editor-body ul{margin:0 0 14px 24px;list-style-type:disc;}.editor-body ol{margin:0 0 14px 24px;list-style-type:decimal;}.editor-body li{display:list-item;}
.editor-body hr{border:none;border-top:1px solid var(--border);margin:24px 0;}
.editor-body mark{border-radius:3px;padding:0 3px;background:rgba(240,192,80,.4);}
.editor-body a{color:var(--indigo);text-decoration:underline;}
.editor-md{flex:1;padding:48px 64px;font-family:var(--mono);font-size:14px;line-height:1.7;color:var(--body-text);background:var(--bg0);border:none;resize:none;min-height:300px;width:100%;max-width:900px;margin:0 auto;}
.editor-md:focus{outline:none;}
.editor-md::placeholder{color:var(--placeholder);}
.editor-bottombar{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:var(--bg1);border-top:1px solid var(--border);flex-shrink:0;font-size:12px;color:var(--mid);}
.editor-bottombar input[type=range]{accent-color:var(--indigo);background:transparent;}
.editor-bottombar input[type=range]::-webkit-slider-runnable-track{background:var(--bg3);height:4px;border-radius:2px;}
.editor-bottombar input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:var(--indigo);margin-top:-5px;cursor:pointer;}
.toggle-btn{display:flex;align-items:center;gap:2px;background:var(--bg2);border-radius:6px;padding:2px;border:1px solid var(--border);}
.toggle-opt{padding:4px 10px;border-radius:5px;font-size:13px;cursor:pointer;color:var(--mid);transition:all .15s;}
.toggle-opt.active{background:var(--bg0);color:var(--text);box-shadow:0 1px 3px rgba(42,31,16,.08);}
.editor-drawer{width:280px;border-left:1px solid var(--border);background:var(--bg1);display:flex;flex-direction:column;flex-shrink:0;overflow-y:auto;}
.edrawer-hdr{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;position:sticky;top:0;background:var(--bg1);z-index:1;}
.edrawer-title{font-size:14px;font-weight:600;color:var(--text);}
.edrawer-section{padding:12px 14px;border-bottom:1px solid var(--border);}
.edrawer-lbl{font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;letter-spacing:.08em;margin-bottom:7px;display:block;}
.adv-toggle{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--mid);cursor:pointer;padding:10px 14px;border-bottom:1px solid var(--border);}
.adv-toggle:hover{color:var(--text);}
.float-toolbar{position:fixed;z-index:500;background:var(--text);border:none;border-radius:var(--r);padding:4px;box-shadow:0 4px 16px rgba(42,31,16,.25);display:flex;align-items:center;gap:2px;}
.float-btn{width:28px;height:28px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--bg2);cursor:pointer;flex-shrink:0;}
.float-btn:hover{background:rgba(255,255,255,.15);color:#fff;}
.float-btn.mi-btn{font-family:'Material Icons';font-size:16px;font-weight:normal;}
.float-sep{width:1px;height:16px;background:rgba(255,255,255,.2);margin:0 2px;flex-shrink:0;}
.float-strand-drop{position:absolute;top:calc(100% + 6px);left:0;background:var(--bg1);border:1px solid var(--border);border-radius:var(--r);box-shadow:0 8px 28px rgba(42,31,16,.14);max-height:220px;overflow-y:auto;min-width:200px;z-index:10;display:flex;flex-direction:column;}
.float-strand-item{display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;font-size:13px;color:var(--text);}
.float-strand-item:hover{background:var(--bg2);}
.float-strand-new{border-top:1px solid var(--border);padding:8px 10px;cursor:pointer;font-size:13px;color:var(--teal);display:flex;align-items:center;gap:6px;flex-shrink:0;}
.float-strand-new:hover{background:var(--bg2);}
.strands-subnav{display:flex;align-items:center;border-bottom:1px solid var(--border);background:var(--bg1);padding:0 16px;flex-shrink:0;height:44px;gap:4px;}
.strands-tab{padding:0 14px;height:100%;font-size:13px;font-weight:500;cursor:pointer;color:var(--mid);border-bottom:2px solid transparent;white-space:nowrap;display:flex;align-items:center;transition:color .15s;}
.strands-tab.active{color:var(--indigo);border-bottom-color:var(--indigo);}
.strands-tab:hover:not(.active){color:var(--text);}
.strands-layout{display:flex;flex:1;overflow:hidden;}
.strands-left{width:256px;border-right:1px solid var(--border);display:flex;flex-direction:column;flex-shrink:0;background:var(--bg1);}
.strands-list{flex:1;overflow-y:auto;padding:8px;}
.strand-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;cursor:pointer;transition:background .15s;}
.strand-item:hover{background:var(--bg2);}
.strand-item.active{background:var(--bg2);border:1px solid var(--border);}
.strand-av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;}
.strands-add-btn{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--teal);cursor:pointer;border-radius:6px;padding:7px 10px;margin:3px;}
.strands-add-btn:hover{background:rgba(47,153,102,.1);}
.strands-detail{flex:1;overflow-y:auto;padding:24px;}
.strand-detail-hdr{display:flex;align-items:flex-start;gap:16px;margin-bottom:20px;}
.strand-av-wrap{position:relative;width:64px;height:64px;border-radius:50%;overflow:hidden;cursor:pointer;flex-shrink:0;}
.strand-av-overlay{position:absolute;inset:0;background:rgba(42,31,16,.4);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s;font-size:11px;color:#fff;}
.strand-av-wrap:hover .strand-av-overlay{opacity:1;}
.strand-name-inp{font-family:var(--serif);font-size:22px;font-weight:600;color:var(--text);background:transparent;border:none;border-bottom:1px solid transparent;padding:0 0 2px 0;flex:1;text-decoration:none;}
.strand-name-inp:focus{outline:none;border-bottom:1px solid var(--indigo);}
.strand-name-inp::placeholder{color:var(--placeholder);}
.color-swatches{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}
.color-swatch{width:18px;height:18px;border-radius:50%;cursor:pointer;transition:transform .15s;flex-shrink:0;}
.color-swatch:hover{transform:scale(1.25);}
.color-swatch.sel{box-shadow:0 0 0 2px var(--bg1),0 0 0 4px var(--text);}
.strand-field-row{margin-bottom:14px;}
.appears-section{margin-top:20px;padding-top:20px;border-top:1px solid var(--border);}
.appears-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.appears-chip{font-size:12px;padding:3px 10px;border-radius:12px;background:var(--bg2);color:var(--mid);border:1px solid var(--border);cursor:pointer;}
.appears-chip:hover{border-color:var(--indigo);color:var(--indigo);}
.field-edit-row{display:flex;align-items:center;gap:7px;padding:8px 0;border-bottom:1px solid var(--bg2);}
.wizard-dots{display:flex;justify-content:center;gap:7px;margin-top:20px;}
.wizard-dot{width:8px;height:8px;border-radius:50%;background:var(--bg3);transition:all .2s;}
.wizard-dot.active{background:var(--indigo);width:22px;border-radius:4px;}
.wizard-type-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px;}
.wizard-type-card{background:var(--bg0);border:2px solid var(--border);border-radius:var(--rl);padding:16px;cursor:pointer;transition:all .15s;}
.wizard-type-card:hover{border-color:var(--indigoL);}
.wizard-type-card.sel{border-color:var(--indigo);background:rgba(196,94,40,.05);}
.wizard-coll-tags{display:flex;flex-wrap:wrap;gap:8px;}
.wizard-coll-tag{padding:7px 14px;border:1px solid var(--border);border-radius:20px;font-size:13px;cursor:pointer;transition:all .15s;color:var(--mid);background:var(--bg0);}
.wizard-coll-tag.sel{background:rgba(196,94,40,.08);border-color:var(--indigo);color:var(--indigo);}
.wizard-coll-tag:hover{border-color:var(--bg4);color:var(--text);}
.col-vis-drop{position:fixed;z-index:400;background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);box-shadow:0 8px 28px rgba(42,31,16,.14);padding:8px;min-width:200px;}
.col-vis-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;font-size:13px;color:var(--text);}
.col-vis-item:hover{background:var(--bg2);}
.auth-grain{position:absolute;inset:0;opacity:.07;mix-blend-mode:multiply;pointer-events:none;z-index:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.78' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23g)'/%3E%3C/svg%3E");}
.coming-soon{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;gap:16px;color:var(--placeholder);}@keyframes spin{to{transform:rotate(360deg);}}@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.4;}}
.has-tooltip{position:relative;}
.has-tooltip:hover .tooltip-text{opacity:1;pointer-events:none;}
.tooltip-text{position:fixed;background:var(--text);color:var(--bg0);font-size:11px;font-family:var(--ui);padding:4px 10px;border-radius:4px;white-space:nowrap;opacity:0;transition:opacity .15s;pointer-events:none;z-index:9999;transform:translateX(-50%) translateY(-100%);margin-top:-6px;max-width:220px;text-align:center;white-space:normal;line-height:1.4;}
.custom-select-wrap{position:relative;display:inline-flex;align-items:center;cursor:pointer;}
.custom-select-wrap select{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;z-index:2;}
.week-bar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;position:relative;}
.week-bar-tip{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);background:var(--text);color:var(--bg0);font-size:10px;padding:2px 6px;border-radius:3px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .1s;margin-bottom:3px;z-index:50;}
.week-bar-wrap:hover .week-bar-tip{opacity:1;}
.proj-card-hover:hover .proj-edit-btn{opacity:1!important;}
.proj-card-band{position:relative;overflow:hidden;}
@media(max-width:768px){
  .stat-hide-mobile{display:none;}
  input,textarea,select{font-size:16px!important;}
  .woven-root{height:100%;min-height:100vh;overflow-x:hidden;}
  .dash-layout{flex:none;overflow:visible;flex-direction:column;height:auto;}
  .dash-main{flex:none;overflow-y:visible;padding:16px 16px 40px;background-color:var(--bg0);background-image:radial-gradient(circle, rgba(160,120,70,0.18) 1px, transparent 1px);background-size:22px 22px;order:1;}
  .dash-sidebar{width:100%;max-width:100%;border-left:none;border-bottom:1px solid var(--border);padding:12px 14px;overflow:visible;height:auto;flex:none;min-width:0;background-color:var(--bg0)!important;background-image:radial-gradient(circle, rgba(160,120,70,0.18) 1px, transparent 1px)!important;background-size:22px 22px!important;order:0;}
  .stat-cards-mobile{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .stat-cards-mobile .stat-card{margin-bottom:0;}
  .stat-num{font-size:24px;}
  .stat-card{padding:10px 12px;}
  .proj-grid{grid-template-columns:1fr;}
  .cards-grid{grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:7px;}
  .draft-card{height:auto;min-height:140px;}
  .strands-left{width:100%;}
  .editor-body,.editor-md{padding:20px;}
  .editor-topbar{height:auto;flex-wrap:wrap;padding:0;position:sticky;top:0;z-index:20;background:var(--bg1);}
  .editor-topbar-row1{display:flex;align-items:center;gap:6px;padding:6px 10px;width:100%;border-bottom:1px solid var(--border);}
  .editor-topbar-row2{display:flex;align-items:center;gap:6px;padding:6px 10px;width:100%;overflow-x:auto;}
  .editor-drawer{position:fixed;top:54px;bottom:0;left:0;right:0;z-index:50;width:100%;border-left:none;}
  .editor-bottombar{position:sticky;bottom:0;z-index:20;}
  .panel-overlay{align-items:stretch;justify-content:flex-end;}
  .panel-box{width:100%;max-width:100%;border-left:none;border-top:none;border-radius:0;max-height:100%;}
  .modal-box{width:100%;max-width:100%;border-radius:0;margin:0;height:100%;max-height:100%;}
  .table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .view-switcher{flex:1;}
  .view-seg{flex:1;width:auto;}
  .proj-title-inp{max-width:120px;}
  .dash-greeting-desktop{display:none;}
  .dash-greeting-mobile{display:block;margin-bottom:12px;}
}
.dash-greeting-mobile{display:none;}
.auth-card{border-radius:var(--rl);}
@media(max-width:600px){
  .auth-wrapper{align-items:flex-start;}
  .auth-card{border-radius:0;border-left:none;border-right:none;border-top:none;box-shadow:none!important;max-width:100%!important;min-height:100vh;padding:32px 24px;}
}`;
function GlobalStyles(){return <style dangerouslySetInnerHTML={{__html:CSS}}/>;}


// ── GlobalSaveIndicator ──
function GlobalSaveIndicator(){
  var ss=useState('saved');var state=ss[0];var setState=ss[1];
  useEffect(function(){
    function onSave(){setState(window.__wovenSaveState||'saved');}
    window.addEventListener('woven-save-state',onSave);
    return function(){window.removeEventListener('woven-save-state',onSave);};
  },[]);
  if(state==='saving')return(<div style={{display:'flex',alignItems:'center',gap:4,opacity:.8}}><span style={{width:6,height:6,borderRadius:'50%',background:'var(--indigoL)',flexShrink:0,animation:'pulse 1s infinite'}}/><span style={{fontSize:11,color:'var(--mid)'}}>Saving...</span></div>);
  if(state==='error')return(<div style={{display:'flex',alignItems:'center',gap:4}} title="Retrying..."><span style={{width:6,height:6,borderRadius:'50%',background:'var(--danger)',flexShrink:0,animation:'pulse 1s infinite'}}/><span style={{fontSize:11,color:'var(--danger)'}}>Retrying...</span></div>);
  return(<div style={{display:'flex',alignItems:'center',gap:4,opacity:.5}}><span style={{width:6,height:6,borderRadius:'50%',background:'var(--teal)',flexShrink:0}}/><span style={{fontSize:11,color:'var(--mid)'}}>Saved</span></div>);
}

// ── ArchiveConfirmModal ──
function ArchiveConfirmModal({draft,allDrafts,onConfirm,onCancel}){
  var children=(allDrafts||[]).filter(function(d){return d.parentId===draft.id&&!d.archived;});
  var hasChildren=children.length>0;
  return(
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={onCancel}/>
  <div className="modal-box" style={{maxWidth:420}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
      <span className="mi" style={{fontSize:28,color:'var(--indigo)'}}>inventory_2</span>
      <div style={{fontFamily:'var(--serif)',fontSize:20,fontWeight:600,color:'var(--text)'}}>Archive this draft?</div>
    </div>
    <div style={{fontSize:14,color:'var(--body-text)',lineHeight:1.6,marginBottom:12}}>
      <strong style={{color:'var(--text)'}}>{draft.title||'Untitled'}</strong> will be hidden from all views and moved to your Archive.
    </div>
    {hasChildren&&(
<div style={{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'10px 14px',fontSize:13,color:'var(--mid)',marginBottom:12}}>
  <span className="mi" style={{fontSize:16,verticalAlign:'middle',marginRight:6}}>info</span>
  This draft has {children.length} nested {children.length===1?'draft':'drafts'} — {children.length===1?'it':'they'} will also be archived.
</div>
    )}
    <div style={{fontSize:13,color:'var(--mid)',marginBottom:20}}>You can restore it any time from <strong>Your Archive</strong> on the dashboard.</div>
    <div style={{display:'flex',gap:8}}>
      <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={onConfirm}>
        <span className="mi" style={{fontSize:16}}>inventory_2</span>Archive
      </button>
    </div>
  </div>
</div>
  );
}

// ── ArchiveProjectConfirmModal ──
function ArchiveProjectConfirmModal({proj,onConfirm,onCancel}){
  return(
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={onCancel}/>
  <div className="modal-box" style={{maxWidth:420}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
      <span className="mi" style={{fontSize:28,color:'var(--indigo)'}}>inventory_2</span>
      <div style={{fontFamily:'var(--serif)',fontSize:20,fontWeight:600,color:'var(--text)'}}>Archive this project?</div>
    </div>
    <div style={{fontSize:14,color:'var(--body-text)',lineHeight:1.6,marginBottom:12}}>
      <strong style={{color:'var(--text)'}}>{proj.title||'Untitled'}</strong> and all its content will be hidden from your dashboard.
    </div>
    <div style={{fontSize:13,color:'var(--mid)',marginBottom:20}}>You can restore it any time from <strong>Your Archive</strong> on the dashboard.</div>
    <div style={{display:'flex',gap:8}}>
      <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={onConfirm}>
        <span className="mi" style={{fontSize:16}}>inventory_2</span>Archive project
      </button>
    </div>
  </div>
</div>
  );
}


// ── OverflowTooltip ──
function OverflowTooltip({label,names}){
  var sr=useRef(null);var tt=useRef(null);
  function show(){
    if(!sr.current||!tt.current)return;
    var r=sr.current.getBoundingClientRect();
    tt.current.style.left=(r.left+r.width/2)+'px';
    tt.current.style.top=(r.top-6)+'px';
    tt.current.style.opacity='1';
  }
  function hide(){if(tt.current)tt.current.style.opacity='0';}
  return(
<span ref={sr} className="chip" style={{background:'var(--bg3)',color:'var(--mid)',borderColor:'var(--border)',borderWidth:1,borderStyle:'solid',cursor:'default'}} onMouseEnter={show} onMouseLeave={hide}>
  {label}
  <span ref={tt} className="tooltip-text">{names.join(', ')}</span>
</span>
  );
}

// ── StatusDot ──
function StatusDot({status,onChange}){
  var s=useState(false);var open=s[0];var setOpen=s[1];
  var p=useState({top:0,left:0});var pos=p[0];var setPos=p[1];
  var ref=useRef(null);
  var info=STATUSES[status]||STATUSES.first_draft;
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  function handleClick(e){e.stopPropagation();var r=e.currentTarget.getBoundingClientRect();setPos({top:r.bottom+5,left:r.left});setOpen(!open);}
  return(
<div ref={ref} style={{display:'inline-flex',alignItems:'center'}}>
  <div style={{width:10,height:10,borderRadius:'50%',background:info.color,cursor:'pointer',flexShrink:0}} onClick={handleClick} title={info.label}/>
  {open&&<div style={{position:'fixed',top:pos.top,left:pos.left,zIndex:9999,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,overflow:'hidden',boxShadow:'0 8px 22px rgba(0,0,0,.5)',minWidth:170}}>
    {Object.keys(STATUSES).map(function(k){var si=STATUSES[k];return(
<div key={k} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',background:k===status?'var(--bg3)':'transparent',fontSize:14}} onClick={function(){onChange(k);setOpen(false);}}>
  <div style={{width:8,height:8,borderRadius:'50%',background:si.color,flexShrink:0}}/>
  <span>{si.label}</span>
</div>
    );})}
    <div style={{height:1,background:'var(--border)',margin:'3px 0'}}/>
    <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',fontSize:14,color:'var(--mid)'}} onClick={function(){onChange('archive');setOpen(false);}}>
      <span className="mi" style={{fontSize:15,color:'var(--mid)'}}>inventory_2</span>
      <span>Archive</span>
    </div>
  </div>}
</div>
  );
}

// ── Panel (full overlay, doesn't cover nav) ──
function Panel({open,onClose,title,children,footer}){
  if(!open)return null;
  return(
<div className="panel-overlay">
  <div className="panel-backdrop" onClick={onClose}/>
  <div className="panel-box">
    <div className="panel-hdr">
      <span className="panel-title">{title}</span>
      <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
    </div>
    <div className="panel-body">{children}</div>
    {footer&&<div className="panel-footer">{footer}</div>}
  </div>
</div>
  );
}

// ── ViewSwitcher ──
function ViewSwitcher({view,setView}){
  var mainModes=VIEW_MODES.filter(function(m){return m.group==='main';});
  var strandMode=VIEW_MODES.find(function(m){return m.group==='strands';});
  return(
<div className="view-switcher">
  {mainModes.map(function(m){return(
<div key={m.key} className={'view-seg'+(view===m.key?' active':'')} onClick={function(){setView(m.key);}}>
  <span className="mi">{m.icon}</span>
  <span className="view-seg-tip">{m.label}</span>
</div>
  );})}
  <div className="view-sep"/>
  <div className={'view-seg'+(view===strandMode.key?' active':'')} onClick={function(){setView(strandMode.key);}}>
    <span className="mi">{strandMode.icon}</span>
    <span className="view-seg-tip">{strandMode.label}</span>
  </div>
</div>
  );
}

// ── StatsSection ──
function StatsSection({app,onOpenProfile,greeting}){
  var sessions=app.sessions;var goal=app.goal;
  var todayWords=sessions.filter(function(s){return s.date===todayStr();}).reduce(function(sum,s){return sum+(s.words||0);},0);
  var pct=goal>0?Math.round(todayWords/goal*100):0;
  var weekData=[];
  for(var i=6;i>=0;i--){var dd=new Date();dd.setDate(dd.getDate()-i);var ds=dd.toISOString().slice(0,10);var dw=sessions.filter(function(s){return s.date===ds;}).reduce(function(sum,s){return sum+(s.words||0);},0);weekData.push({date:ds,words:dw,isToday:i===0,label:dayLbl(i)});}
  var maxW=weekData.reduce(function(m,d){return Math.max(m,d.words);},1);
  var streak=0;var sd=new Date();
  function localDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  for(var j=0;j<60;j++){var sds=localDateStr(sd);if(sessions.filter(function(s){return s.date===sds;}).length>0){streak++;sd.setDate(sd.getDate()-1);}else if(j===0){sd.setDate(sd.getDate()-1);}else break;}
  var weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);weekStart.setHours(0,0,0,0);
  var ltCount=0;Object.keys(app.allDrafts).forEach(function(pid){(app.allDrafts[pid]||[]).forEach(function(d){
    if(d.status==='loose_thread'&&!d.archived){
      var created=new Date(d.createdAt||0);
      if(created>=weekStart)ltCount++;
    }
  });});
  return(
<div>
  <div className="dash-greeting dash-greeting-mobile">{greeting||''}</div>
  <div className="dash-subtitle dash-greeting-mobile" style={{marginBottom:10}}>What will you weave today?</div>
  <div className="stat-cards-mobile">
    <div className="stat-card">
      <div className="stat-card-hdr">
        <span className="stat-card-title">Words Today</span>
        <div style={{display:'flex',gap:4}}>
          {todayWords>0&&<button className="btn-icon" style={{padding:2}} title="Reset today's count" onClick={function(){if(window.confirm('Reset today\'s word count to 0?'))app.clearTodaySession();}}><span className="mi" style={{fontSize:16}}>refresh</span></button>}
          <button className="btn-icon" style={{padding:2}} onClick={function(){onOpenProfile('goal');}}><span className="mi" style={{fontSize:18}}>settings</span></button>
        </div>
      </div>
      <div className="stat-num">{todayWords}</div>
      <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width:Math.min(100,pct)+'%'}}/></div>
      <div className="stat-sub">{pct+'% of '+goal}</div>
    </div>
    <div className="stat-card">
      <div className="stat-card-hdr">
        <span className="stat-card-title">Streak</span>
        <button className="btn-icon" style={{padding:2}} onClick={function(){onOpenProfile('reminder');}} title="Reminder settings"><span className="mi" style={{fontSize:18}}>notifications</span></button>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <div className="stat-num">{streak}</div>
        {streak>7&&<span className="mi" style={{fontSize:24,color:'#f97316'}}>local_fire_department</span>}
      </div>
      <div className="stat-sub">{streak===1?'day':'days'}</div>
    </div>
  </div>
  <div className="stat-card stat-hide-mobile">
    <div className="stat-card-hdr"><span className="stat-card-title">Loose Threads</span></div>
    <div className="stat-num">{ltCount}</div>
    <div className="stat-sub">{ltCount===1?'thread this week':'threads this week'}</div>
  </div>
  <div className="stat-card stat-hide-mobile">
    <div className="stat-card-hdr"><span className="stat-card-title">This Week</span></div>
    <div className="week-chart">
      {weekData.map(function(d){var barH=maxW>0?Math.max(3,Math.round(d.words/maxW*42)):3;return(
<div key={d.date} className="week-bar-wrap">
  <div className="week-bar-tip">{d.words>0?d.words+' words':'No words'}</div>
  <div className={'week-bar'+(d.isToday?' today':'')} style={{height:barH,cursor:'pointer'}} onMouseOver={function(e){e.currentTarget.style.background='var(--indigoL)';}} onMouseOut={function(e){e.currentTarget.style.background=d.isToday?'var(--indigo)':'var(--bg3)';}}>
  </div>
  <div className="week-day-lbl">{d.label}</div>
</div>
      );})}
    </div>
  </div>
</div>
  );
}

// ── ProjectEditPanel ──
function ProjectEditPanel({proj,app,onClose}){
  var st=useState(proj.title||'');var title=st[0];var setTitle=st[1];
  var ss=useState(proj.synopsis||'');var synopsis=ss[0];var setSynopsis=ss[1];
  var si=useState(proj.image||null);var image=si[0];var setImage=si[1];
  var spa=useState(false);var projArchiveConfirm=spa[0];var setProjArchiveConfirm=spa[1];
  var spt=useState(proj.type||'Fiction');var projType=spt[0];var setProjType=spt[1];
  function autoSaveField(changes){
    if(changes.title!==undefined)app.updateProjectTitle(proj.id,changes.title.trim()||proj.title);
    if(changes.synopsis!==undefined)app.updateProjectSynopsis(proj.id,changes.synopsis);
    if(changes.image!==undefined)app.updateProjectImage(proj.id,changes.image);
    if(changes.type!==undefined)app.updateProjectType(proj.id,changes.type);
  }
  return(
<Panel open={true} onClose={onClose} title="Edit Project" footer={null}>
  <div style={{marginBottom:16}}>
    <span className="sect-lbl">Cover image</span>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      {image&&<img src={image} alt="" style={{width:64,height:44,objectFit:'cover',borderRadius:6,flexShrink:0}}/>}
      <label style={{cursor:'pointer'}}>
        <span className="btn btn-ghost btn-sm">{image?'Change':'Upload cover'}</span>
        <input type="file" accept="image/*" style={{display:'none'}} onChange={function(e){
          var file=e.target.files&&e.target.files[0];if(!file)return;
          if(file.size>5*1024*1024){alert('Image must be under 5 MB.');return;}
          uploadImage(file).then(function(url){if(url){setImage(url);autoSaveField({image:url});}});
        }}/>
      </label>
      {image&&<button className="btn-icon" onClick={function(){setImage(null);autoSaveField({image:null});}}><span className="mi" style={{fontSize:16}}>delete</span></button>}
    </div>
  </div>
  <div style={{marginBottom:16}}><span className="sect-lbl">Title</span><input value={title} onChange={function(e){setTitle(e.target.value);}}/></div>
  <div style={{marginBottom:16}}><span className="sect-lbl">Synopsis</span><textarea value={synopsis} onChange={function(e){setSynopsis(e.target.value);}} rows={4}/></div>
  <div style={{marginBottom:16}}>
    <span className="sect-lbl">Type</span>
    <select value={projType} onChange={function(e){setProjType(e.target.value);}}>
      {PROJ_TYPES.map(function(t){return <option key={t.id} value={t.label}>{t.label}</option>;})}
    </select>
  </div>
  <div style={{paddingTop:16,borderTop:'1px solid var(--border)'}}>
    <button className="btn btn-danger" style={{width:'100%',justifyContent:'center'}} onClick={function(){setProjArchiveConfirm(true);}}>
      <span className="mi" style={{fontSize:16}}>inventory_2</span>Archive project
    </button>
  </div>
  {projArchiveConfirm&&<ArchiveProjectConfirmModal proj={proj} onCancel={function(){setProjArchiveConfirm(false);}} onConfirm={function(){app.archiveProject(proj.id);setProjArchiveConfirm(false);onClose();}}/>}
</Panel>
  );
}


// ── GlobalLooseThreads ──
function GlobalLooseThreads({app}){
  // Global LTs are stored in app.globalLT (keyed by id), not tied to any project
  var allLT=Object.values(app.globalLT||{}).filter(function(d){return !d.archived;}).sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});
  var activeProjects=app.projects.filter(function(p){return !p.archived;});
  var soi=useState(null);var openLTId=soi[0];var setOpenLTId=soi[1];
  function updateLT(id,changes){app.updateGlobalLT(id,changes);}
  function addLT(){
    var id=genId();
    app.updateGlobalLT(id,{id:id,title:'',synopsis:'',createdAt:new Date().toISOString(),archived:false});
  }
  function moveToProject(ltId,targetPid){
    if(!targetPid)return;
    var lt=app.globalLT[ltId];if(!lt)return;
    app.addDraft(targetPid,{id:genId(),projectId:targetPid,title:lt.title||'',synopsis:lt.synopsis||'',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],pov:'',customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    app.updateGlobalLT(ltId,{archived:true});
  }
  var ssm=useState(false);var showMore=ssm[0];var setShowMore=ssm[1];
  // Show one row (approx 3-4 cards) collapsed, rest hidden
  var visibleLT=showMore?allLT:allLT.slice(0,3);
  function handleAddLT(){
    var id=genId();
    app.updateGlobalLT(id,{id:id,title:'',synopsis:'',createdAt:new Date().toISOString(),archived:false});
    setOpenLTId(id);
  }
  return(
<div style={{marginTop:24}}>
  <div style={{fontSize:12,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Loose Threads</div>
  <div className="cards-grid">
    <div className="draft-card" style={{border:'2px dashed var(--border)',background:'transparent',cursor:'pointer',alignItems:'center',justifyContent:'center',gap:6,display:'flex',flexDirection:'column',boxShadow:'none',height:'auto',minHeight:100}} onClick={handleAddLT}>
      <span className="mi" style={{fontSize:22,color:'var(--placeholder)'}}>add_circle_outline</span>
      <span style={{fontSize:12,color:'var(--placeholder)'}}>New loose thread</span>
    </div>
    {visibleLT.map(function(d){return(
<div key={d.id} className="draft-card" style={{height:'auto',minHeight:140,cursor:'pointer'}} onClick={function(){setOpenLTId(d.id);}}>
  <div className="card-body" style={{padding:'10px 12px'}}>
    <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:d.title?'var(--text)':'var(--placeholder)',marginBottom:4,lineHeight:1.3}}>{d.title||'Untitled loose thread'}</div>
    <div style={{fontSize:12,color:'var(--mid)',lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:4,WebkitBoxOrient:'vertical'}}>{d.synopsis||''}</div>
  </div>
  <div className="card-footer" style={{justifyContent:'flex-end'}}>
    <span style={{fontSize:11,color:'var(--placeholder)'}}>Click to edit</span>
  </div>
</div>
    );})}
  </div>
  {allLT.length>3&&(
<div style={{marginTop:8,textAlign:'center'}}>
  <button className="btn btn-ghost btn-sm" onClick={function(){setShowMore(!showMore);}}>
    {showMore?'Show less':'Show '+( allLT.length-3)+' more'}
  </button>
</div>
  )}
  {openLTId&&(
<LTDrawer lt={app.globalLT[openLTId]} activeProjects={activeProjects} onUpdate={function(changes){updateLT(openLTId,changes);}} onMove={function(pid){moveToProject(openLTId,pid);setOpenLTId(null);}} onClose={function(){setOpenLTId(null);}} onDelete={function(){updateLT(openLTId,{archived:true});setOpenLTId(null);}}/>
  )}
</div>
  );
}


// ── LTDrawer ──
function LTDrawer({lt,activeProjects,onUpdate,onMove,onClose,onDelete}){
  if(!lt)return null;
  return(
<div className="panel-overlay">
  <div className="panel-backdrop" onClick={onClose}/>
  <div className="panel-box">
    <div className="panel-hdr">
      <span className="panel-title" style={{fontFamily:'var(--serif)'}}>Loose Thread</span>
      <div style={{display:'flex',gap:4}}>
        <button className="btn-icon btn-danger" onClick={onDelete} title="Archive this thread"><span className="mi" style={{fontSize:18}}>delete</span></button>
        <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
      </div>
    </div>
    <div className="panel-body" style={{display:'flex',flexDirection:'column',gap:14}}>
      <div>
        <span className="sect-lbl">Title</span>
        <input key={lt.id+'-t'} defaultValue={lt.title||''} placeholder="Give this thread a name..." onBlur={function(e){onUpdate({title:e.target.value});}}/>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column'}}>
        <span className="sect-lbl">Notes</span>
        <textarea key={lt.id+'-s'} defaultValue={lt.synopsis||''} placeholder="Write freely — capture the idea, explore it, let it breathe..." rows={12} style={{resize:'vertical',flex:1}} onBlur={function(e){onUpdate({synopsis:e.target.value});}}/>
      </div>
      {activeProjects.length>0&&(
<div style={{paddingTop:14,borderTop:'1px solid var(--border)'}}>
  <span className="sect-lbl">Move to a project</span>
  <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
    {activeProjects.map(function(p){return(
<button key={p.id} className="btn btn-ghost" style={{justifyContent:'flex-start'}} onClick={function(){onMove(p.id);}}>
  <span className="mi" style={{fontSize:16}}>arrow_forward</span>{p.title}
</button>
    );})}
  </div>
</div>
      )}
    </div>
  </div>
</div>
  );
}

// ── Dashboard ──
function Dashboard({app,onOpenProfile,onNewProject}){
  var profile=app.profile||{};
  var firstName=profile.firstName||'';
  var greeting=getGreeting()+(firstName?', '+firstName:'');
  var sep=useState(null);var editingProjId=sep[0];var setEditingProjId=sep[1];
  var sar=useState(false);var archiveOpen=sar[0];var setArchiveOpen=sar[1];
  var archivedCount=Object.values(app.allDrafts).flat().filter(function(d){return d.archived;}).length+(app.projects.filter(function(p){return p.archived;}).length);
  function getWC(pid){return(app.allDrafts[pid]||[]).reduce(function(s,d){return s+(d.wordCount||0);},0);}
  function openProject(pid){app.loadProjectData(pid);app.setProjId(pid);app.setView('cards');}
  var editProj=editingProjId?app.projects.find(function(p){return p.id===editingProjId;}):null;
  return(
<div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
  <nav className="nav" style={{justifyContent:'space-between'}}>
    <WovenLogo size={26}/>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <button className="btn-icon" title="Sign out" onClick={function(){app.signOut();}}><span className="mi" style={{fontSize:20}}>logout</span></button>
      <div className="avatar" onClick={function(){onOpenProfile(null);}}>{initials(firstName+' '+(profile.lastName||''))}</div>
    </div>
  </nav>
  <div className="dash-layout">
    <div className="dash-main dot-grid">
      <div className="dash-greeting dash-greeting-desktop">{greeting}</div>
      <div className="dash-subtitle dash-greeting-desktop">What will you weave today?</div>
      <div style={{fontSize:12,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Your Projects</div>
      <div className="proj-grid">
        {app.projects.filter(function(p){return !p.archived;}).map(function(p){var wc=getWC(p.id);return(
<div key={p.id} className="proj-card proj-card-hover" style={{position:'relative'}}>
  <div className="proj-card-band" onClick={function(){openProject(p.id);}}>
    {p.image?<img src={p.image} alt={p.title} style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0}}/>:null}
    {!p.image&&<span className="mi" style={{position:'relative',zIndex:1,fontSize:28,color:'rgba(42,31,16,.25)'}}>photo_camera</span>}
  </div>
  <div className="proj-card-body" onClick={function(){openProject(p.id);}}>
    <div className="proj-card-title">{p.title||'Untitled'}</div>
    <div className="proj-card-syn">{p.synopsis||'No synopsis yet.'}</div>
    <div className="proj-card-footer"><span>{p.type||'Fiction'}</span><span>{wc>0?wc+' words':'Empty'}</span></div>
  </div>
  <button className="proj-edit-btn btn-icon" style={{position:'absolute',top:8,right:8,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:6,opacity:0,transition:'opacity .15s',color:'var(--mid)'}} onClick={function(e){e.stopPropagation();setEditingProjId(p.id);}} title="Edit project">
    <span className="mi" style={{fontSize:16}}>edit</span>
  </button>
</div>
        );})}<div className="add-proj" onClick={onNewProject}>
          <span className="mi" style={{fontSize:28,color:'var(--mid)'}}>add_circle_outline</span>
          <div style={{fontSize:13,color:'var(--mid)'}}>New project</div>
        </div>
      </div>
      <GlobalLooseThreads app={app}/>
      <div style={{marginTop:20,border:'1px solid var(--border)',borderRadius:'var(--rl)',padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,background:'var(--bg1)',transition:'border-color .15s'}} onClick={function(){setArchiveOpen(true);}}>
        <span className="mi" style={{fontSize:24,color:'var(--placeholder)',flexShrink:0}}>inventory_2</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)'}}>Your Archive</div>
          <div style={{fontSize:12,color:'var(--mid)'}}>Where shelved ideas stay safe.{archivedCount>0?' '+archivedCount+' item'+(archivedCount!==1?'s':'')+' archived.':''}</div>
        </div>
        <span className="mi" style={{fontSize:20,color:'var(--border)'}}>chevron_right</span>
      </div>
    </div>
    <div className="dash-sidebar">
      <StatsSection app={app} onOpenProfile={onOpenProfile} greeting={greeting}/>
    </div>
  </div>
  {editProj&&<ProjectEditPanel proj={editProj} app={app} onClose={function(){setEditingProjId(null);}}/>}
  <ArchiveDrawer app={app} open={archiveOpen} onClose={function(){setArchiveOpen(false);}}/>
</div>
  );
}

// ── ProjectNav ──
function ProjectNav({app,onOpenProfile}){
  var proj=app.currentProject;
  var s=useState(false);var editing=s[0];var setEditing=s[1];
  function commitTitle(e){var val=e.target.value.trim();if(val&&proj)app.updateProjectTitle(proj.id,val);setEditing(false);}
  return(
<nav className="nav">
  <button className="btn-icon" onClick={app.goBack}><span className="mi">arrow_back</span></button>
  <div style={{display:'flex',alignItems:'center',flexShrink:0}}>
    {editing?(
<input className="proj-title-inp" defaultValue={proj?proj.title:''} onBlur={commitTitle} onKeyDown={function(e){if(e.key==='Enter')commitTitle(e);if(e.key==='Escape')setEditing(false);}} autoFocus/>
    ):(
<span className="proj-title-inp" style={{cursor:'text',border:'1px solid transparent'}} onClick={function(){setEditing(true);}}>{proj?proj.title:'Project'}</span>
    )}
  </div>
  <div style={{flex:1,display:'flex',justifyContent:'center'}}>
    <ViewSwitcher view={app.view} setView={app.setView}/>
  </div>
  <GlobalSaveIndicator/>
  <div className="avatar" onClick={function(){onOpenProfile(null);}}>{initials(((app.profile||{}).firstName||'')+' '+((app.profile||{}).lastName||''))}</div>
</nav>
  );
}



// ── CollFilterGroup ──
function CollFilterGroup({coll,strands,filter,setFilter,setFilterOpen}){
  var sc=useState(true);var collapsed=sc[0];var setCollapsed=sc[1];
  var hasActive=strands.some(function(st){return st.id===filter;});
  return(
<div style={{borderBottom:'1px solid var(--border)'}}>
  <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',cursor:'pointer',userSelect:'none'}} onClick={function(){setCollapsed(!collapsed);}}>
    <span className="mi" style={{fontSize:14,color:'var(--mid)',transition:'transform .15s',transform:collapsed?'rotate(-90deg)':'rotate(0deg)'}}>expand_more</span>
    <span style={{fontSize:12,fontWeight:600,color:hasActive?'var(--indigo)':'var(--text)',flex:1}}>{coll}</span>
    {hasActive&&<span style={{width:6,height:6,borderRadius:'50%',background:'var(--indigo)',flexShrink:0}}/>}
  </div>
  {!collapsed&&(
<div style={{paddingBottom:6}}>
  {strands.map(function(st){var isActive=filter===st.id;return(
<div key={st.id} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 10px 5px 28px',cursor:'pointer'}} onMouseDown={function(e){e.preventDefault();e.stopPropagation();setFilter(isActive?null:st.id);setFilterOpen(false);}}>
  <span style={{width:14,height:14,borderRadius:3,border:'1px solid '+(isActive?'var(--indigo)':'var(--border)'),background:isActive?'var(--indigo)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
    {isActive&&<span className="mi" style={{fontSize:11,color:'#fff'}}>check</span>}
  </span>
  <span style={{fontSize:13,color:isActive?'var(--indigo)':'var(--text)',fontWeight:isActive?500:400}}>{st.name}</span>
</div>
  );})}
</div>
  )}
</div>
  );
}

// ── SortDropdown ──
function SortDropdown({sort,setSort}){
  var ss=useState(false);var open=ss[0];var setOpen=ss[1];
  var sp=useState({top:0,left:0});var pos=sp[0];var setPos=sp[1];
  var ref=useRef(null);
  var opts=[['order','Sequence'],['title','Title A–Z'],['status','Status'],['words','Word count']];
  var label=opts.find(function(o){return o[0]===sort;})||opts[0];
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  return(
<div ref={ref} style={{position:'relative'}}>
  <div className={'filter-btn'+(sort!=='order'?' active':'')} onClick={function(e){var r=e.currentTarget.getBoundingClientRect();setPos({top:r.bottom+4,left:r.left});setOpen(!open);}} style={{userSelect:'none'}}>
    <span className="mi" style={{fontSize:16}}>sort</span>
    <span>{label[1]}</span>
    <span className="mi" style={{fontSize:14,marginLeft:2}}>arrow_drop_down</span>
  </div>
  {open&&(
<div style={{position:'fixed',top:pos.top,left:pos.left,zIndex:400,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:'var(--rl)',boxShadow:'0 8px 28px rgba(42,31,16,.14)',minWidth:140,overflow:'hidden'}}>
  {opts.map(function(o){return(
<div key={o[0]} style={{padding:'9px 14px',fontSize:13,cursor:'pointer',fontFamily:'var(--ui)',color:sort===o[0]?'var(--indigo)':'var(--text)',background:sort===o[0]?'rgba(196,94,40,.06)':'transparent',fontWeight:sort===o[0]?600:400}} onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}} onMouseOut={function(e){e.currentTarget.style.background=sort===o[0]?'rgba(196,94,40,.06)':'transparent';}} onClick={function(){setSort(o[0]);setOpen(false);}}>
  {o[1]}
</div>
  );})}
</div>
  )}
</div>
  );
}

// ── ViewHeader ──
function ViewHeader({app,filter,setFilter,sort,setSort,onAddDraft,onBind}){
  var s=useState(false);var filterOpen=s[0];var setFilterOpen=s[1];
  var p=useState({top:0,left:0});var filterPos=p[0];var setFilterPos=p[1];
  var filterRef=useRef(null);
  var projStrands=app.allStrands[app.projId]||{};
  useEffect(function(){if(!filterOpen)return;function onDown(e){
    if(filterRef.current&&filterRef.current.contains(e.target))return;
    // Also allow clicks on the dropdown itself (it's fixed-position, outside filterRef)
    var drop=document.querySelector('.filter-dropdown');
    if(drop&&drop.contains(e.target))return;
    setFilterOpen(false);
  }document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[filterOpen]);
  function openFilter(e){var r=e.currentTarget.getBoundingClientRect();setFilterPos({top:r.bottom+4,left:r.left});setFilterOpen(!filterOpen);}
  var hasFilter=!!filter;
  return(
<div className="view-hdr">
  <div style={{position:'relative',display:'inline-flex'}}>
    <button ref={filterRef} className={'filter-btn'+(hasFilter?' active':'')} onClick={openFilter}>
      <span className="mi" style={{fontSize:16}}>filter_alt</span>
      <span>Refine Arc</span>
    </button>
    {hasFilter&&<span style={{position:'absolute',top:-6,right:-6,background:'var(--indigo)',color:'#fff',borderRadius:'50%',width:16,height:16,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>1</span>}
  </div>
  {filterOpen&&(
<div className="filter-dropdown" style={{top:filterPos.top,left:filterPos.left,minWidth:220,padding:0}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 10px 4px'}}>
    <span style={{fontSize:11,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em'}}>Filter by strand</span>
    {hasFilter&&<button className="btn btn-ghost btn-sm" style={{padding:'2px 8px',fontSize:11}} onClick={function(){setFilter(null);setFilterOpen(false);}}>Clear</button>}
  </div>
  {Object.keys(projStrands).map(function(coll){var collStrands=projStrands[coll]||[];if(collStrands.length===0)return null;return(<CollFilterGroup key={coll} coll={coll} strands={collStrands} filter={filter} setFilter={setFilter} setFilterOpen={setFilterOpen}/>);})}
  {Object.values(projStrands).flat().length===0&&<div style={{padding:'8px 12px',fontSize:13,color:'var(--mid)'}}>No strands yet.</div>}
</div>
  )}
  <SortDropdown sort={sort} setSort={setSort}/>
  <div style={{flex:1}}/>
  <button className="btn btn-ghost btn-sm" onClick={onBind}>Bind</button>
  <button className="btn btn-primary btn-sm" onClick={onAddDraft}>
    <span className="mi" style={{fontSize:16}}>add</span>New draft
  </button>
</div>
  );
}


// ── StatusDotWithArchive ──
function StatusDotWithArchive({draft,app,showLabel}){
  var sac=useState(false);var showConfirm=sac[0];var setShowConfirm=sac[1];
  var info=STATUSES[draft.status]||STATUSES.first_draft;
  function handleChange(s){
    if(s==='archive'){setShowConfirm(true);return;}
    var ch={status:s};
    if(s==='loose_thread'){ch.order=null;ch.parentId=null;}
    else if(draft.status==='loose_thread'){
      var seqCount=(app.allDrafts[app.projId]||[]).filter(function(d){return d.status!=='loose_thread'&&!d.parentId&&!d.archived;}).length;
      ch.order=seqCount+1;
    }
    app.updateDraft(app.projId,draft.id,ch);
  }
  function doArchive(){
    var allDr=app.allDrafts[app.projId]||[];
    var children=allDr.filter(function(d){return d.parentId===draft.id&&!d.archived;});
    app.updateDraft(app.projId,draft.id,{archived:true});
    children.forEach(function(c){app.updateDraft(app.projId,c.id,{archived:true});});
    setShowConfirm(false);
  }
  var dotRef=useRef(null);
  return(
<div style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer'}} onClick={function(e){if(dotRef.current)dotRef.current.querySelector('[title]').click();}}>
  <div ref={dotRef}><StatusDot status={draft.status} onChange={handleChange}/></div>
  {showLabel&&<span style={{fontSize:13,color:info.color,pointerEvents:'none'}}>{info.label}</span>}
  {showConfirm&&<ArchiveConfirmModal draft={draft} allDrafts={app.allDrafts[app.projId]||[]} onConfirm={doArchive} onCancel={function(){setShowConfirm(false);}}/>}
</div>
  );
}


// ── Export helpers ──
function stripHtmlForExport(html){
  if(!html)return[];
  var s=html
    .replace(/<\/p>/gi,'{{PARA}}')
    .replace(/<p[^>]*>/gi,'')
    .replace(/<br\s*\/?>/gi,'{{PARA}}')
    .replace(/<h[12][^>]*>(.*?)<\/h[12]>/gi,'$1{{PARA}}')
    .replace(/<li[^>]*>(.*?)<\/li>/gi,'• $1{{PARA}}')
    .replace(/<[^>]+>/g,'')
    .replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&nbsp;/g,' ')
    .replace(/[ 	]+/g,' ');
  return s.split('{{PARA}}').map(function(p){return p.trim();}).filter(function(p){return p.length>0;});
}

function cleanBodyForExport(html){
  if(!html)return'<p></p>';
  return html
    .replace(/<mark[^>]*>/gi,'<span style="background:#fff3cd;">')
    .replace(/<\/mark>/gi,'</span>')
    .replace(/<div([^>]*)>/gi,'<p>')
    .replace(/<\/div>/gi,'</p>')
    .replace(/<span([^>]*)>/gi,'<span>')
    .replace(/(<(?:p|h[1-6]|li|td|th)[^>]*?)\s+class="[^"]*"/gi,'$1')
    .replace(/(<(?:p|h[1-6]|li|td|th)[^>]*?)\s+style="[^"]*"/gi,'$1')
    .replace(/data-[a-z-]+="[^"]*"/gi,'')
    .replace(/<!--[\s\S]*?-->/g,'')
    .replace(/<p>\s*<\/p>/gi,'<p>&nbsp;</p>')
    .replace(/&(?!amp;|lt;|gt;|nbsp;|quot;|#[0-9]+;)/g,'&amp;')
    .trim();
}

function doExport(format,drafts,project,isSingleDraft,authorName){
  var isSingle=isSingleDraft||(drafts&&drafts.length===1);
  var projectTitle=(project&&project.title)||'Manuscript';
  var displayTitle=isSingle&&drafts&&drafts[0]?(drafts[0].title||'Untitled'):projectTitle;
  var author=authorName||((project&&project.authorName)||'');
  var totalWords=drafts.reduce(function(s,d){return s+(d.wordCount||0);},0);
  // Stable sort: by order, preserving original array position as tiebreaker
  var sorted=drafts.map(function(d,i){return{d:d,i:i};})
    .sort(function(a,b){
      var ao=a.d.order!=null?a.d.order:999;
      var bo=b.d.order!=null?b.d.order:999;
      if(ao!==bo)return ao-bo;
      return a.i-b.i;
    }).map(function(x){return x.d;});

  if(format==='PDF'){
    var jspdfLib=window.jspdf||window.jsPDF;
    if(jspdfLib&&jspdfLib.jsPDF)jspdfLib=jspdfLib;
    else if(!jspdfLib){alert('PDF export is still loading. Please try again in a moment.');return false;}
    var JsPDF=jspdfLib.jsPDF||jspdfLib;
    var doc=new JsPDF({unit:'mm',format:'a4'});
    var margin=25;var pageW=210-margin*2;var y=margin;var lineH=7;

    if(isSingle){
      // ── Single draft: inline header, no cover/index page ──
      y=margin;
      doc.setFontSize(10);doc.setFont('times','normal');
      doc.text(projectTitle.toUpperCase(),margin,y);y+=8;
      doc.setFontSize(22);doc.setFont('times','bold');
      var dTitleLines=doc.splitTextToSize(displayTitle,pageW);
      doc.text(dTitleLines,margin,y);y+=dTitleLines.length*10+4;
      if(author){doc.setFontSize(13);doc.setFont('times','italic');doc.text('By '+author,margin,y);y+=8;}
      doc.setFontSize(10);doc.setFont('times','normal');
      doc.text(totalWords.toLocaleString()+' words  ·  Written in Woven',margin,y);y+=10;
      doc.setDrawColor(200,200,200);doc.line(margin,y,210-margin,y);y+=10;
      doc.setFontSize(12);doc.setFont('times','normal');
      var bodyParas=stripHtmlForExport(sorted[0].body||'');
      if(bodyText){
        bodyParas.forEach(function(para){var lines=doc.splitTextToSize(para,pageW);lines.forEach(function(line){if(y>275){doc.addPage();y=margin;}doc.text(line,margin,y);y+=lineH;});y+=lineH*0.7;});
      }
    } else {
      // ── Bind: cover page + index + draft pages ──
      doc.setFontSize(11);doc.setFont('times','normal');
      doc.text(projectTitle.toUpperCase(),105,60,{align:'center'});
      doc.setFontSize(28);doc.setFont('times','bold');
      var titleLines=doc.splitTextToSize(displayTitle,pageW);
      doc.text(titleLines,105,85,{align:'center'});
      var coverY=85+titleLines.length*12;
      if(author){doc.setFontSize(14);doc.setFont('times','italic');doc.text('By '+author,105,coverY+8,{align:'center'});coverY+=16;}
      doc.setFontSize(11);doc.setFont('times','normal');
      doc.text(totalWords.toLocaleString()+' words',105,coverY+8,{align:'center'});
      doc.text('Written in Woven',105,coverY+18,{align:'center'});
      // Index
      doc.addPage();y=30;
      doc.setFontSize(16);doc.setFont('times','bold');
      doc.text('Contents',margin,y);y+=12;
      doc.setFontSize(12);doc.setFont('times','normal');
      sorted.forEach(function(draft,i){
        if(y>270){doc.addPage();y=30;}
        var num=(i+1)+'.  ';
        var draftTitle=doc.splitTextToSize(num+(draft.title||'Untitled'),pageW);
        doc.text(draftTitle,margin,y);y+=draftTitle.length*lineH+2;
      });
      // Draft pages
      sorted.forEach(function(draft){
        doc.addPage();y=margin;
        doc.setFontSize(18);doc.setFont('times','bold');
        var dTitle=doc.splitTextToSize(draft.title||'Untitled',pageW);
        doc.text(dTitle,margin,y);y+=dTitle.length*9+10;
        doc.setFontSize(12);doc.setFont('times','normal');
        var bodyParas=stripHtmlForExport(draft.body||'');
        if(bodyText){
          var lines=doc.splitTextToSize(bodyText,pageW);
          lines.forEach(function(line){
            if(y>275){doc.addPage();y=margin;}
            doc.text(line,margin,y);y+=lineH;
          });
        }
      });
    }
    doc.save(displayTitle.replace(/\s+/g,'_')+'.pdf');
    return true;

  } else {
    // ── DOCX (Word HTML format) ──
    var filename=displayTitle.replace(/\s+/g,'_');
    var css='';
    css+='body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.8;margin:1in 1.25in;}';
    css+='.cover{text-align:center;page-break-after:always;}';
    css+='.cover-eyebrow{font-size:9pt;color:#888;text-transform:uppercase;letter-spacing:.12em;margin-bottom:48pt;margin-top:72pt;}';
    css+='.cover-title{font-size:30pt;font-weight:bold;margin-bottom:16pt;line-height:1.2;}';
    css+='.cover-byline{font-size:14pt;font-style:italic;margin-bottom:8pt;}';
    css+='.cover-meta{font-size:10pt;color:#666;margin-bottom:6pt;}';
    css+='.toc{page-break-after:always;}';
    css+='.toc h1{font-size:18pt;margin-bottom:20pt;}';
    css+='.toc-item{font-size:12pt;margin-bottom:6pt;}';
    css+='h2{font-size:16pt;font-weight:bold;margin-top:0;margin-bottom:14pt;page-break-before:always;}';
    css+='h2.first-chapter{page-break-before:avoid;}';
    css+='p{margin-bottom:8pt;margin-top:0;}';
    css+='strong,b{font-weight:bold;}';
    css+='em,i{font-style:italic;}';
    css+='ul{margin:0 0 8pt 24pt;}li{margin-bottom:4pt;}';

    var html='<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">';
    html+='<head><meta charset="utf-8"><style>'+css+'</style></head><body>';

    if(isSingle){
      var sd=sorted[0];
      var sdBody=cleanBodyForExport(sd.body||'');
      html+='<p style="font-size:9pt;color:#888;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6pt;">'+projectTitle+'</p>';
      html+='<h1 style="font-size:24pt;font-weight:bold;margin-bottom:8pt;margin-top:0;page-break-before:avoid;">'+displayTitle+'</h1>';
      if(author)html+='<p style="font-size:13pt;font-style:italic;margin-bottom:6pt;">By '+author+'</p>';
      html+='<p style="font-size:9pt;color:#888;margin-bottom:16pt;border-bottom:1px solid #ccc;padding-bottom:12pt;">'+totalWords.toLocaleString()+' words&nbsp;&nbsp;&middot;&nbsp;&nbsp;Written in Woven</p>';
      html+=sdBody;
    } else {
      // Cover
      html+='<div class="cover">';
      html+='<p class="cover-eyebrow">'+projectTitle+'</p>';
      html+='<p class="cover-title">'+displayTitle+'</p>';
      if(author)html+='<p class="cover-byline">By '+author+'</p>';
      html+='<p class="cover-meta">'+totalWords.toLocaleString()+' words</p>';
      html+='<p class="cover-meta">Written in Woven</p>';
      html+='</div>';
      // Index
      html+='<div class="toc"><h1>Contents</h1>';
      sorted.forEach(function(draft,i){
        html+='<p class="toc-item">'+(i+1)+'.&nbsp;&nbsp;&nbsp;'+(draft.title||'Untitled')+'</p>';
      });
      html+='</div>';
      // Drafts
      sorted.forEach(function(draft,i){
        var body=cleanBodyForExport(draft.body||'');
        html+='<h2 class="'+(i===0?'first-chapter':'')+'">'+  (draft.title||'Untitled')+'</h2>';
        html+=body;
      });
    }
    html+='</body></html>';
    var blob=new Blob(['﻿'+html],{type:'application/msword;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');a.href=url;a.download=filename+'.doc';
    document.body.appendChild(a);a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},1500);
    return true;
  }
}

// ── BindPanel ──
function BindPanel({app,open,onClose,activeFilter}){
  var s=useState('PDF');var format=s[0];var setFormat=s[1];
  var si=useState(false);var inclNested=si[0];var setInclNested=si[1];
  var sex=useState({});var excluded=sex[0];var setExcluded=sex[1];
  var sel=useState(false);var exporting=sel[0];var setExporting=sel[1];
  // Share link state — one link per project stored in app state
  var bindShareKey='woven:bind_share:'+app.projId;
  var ssl=useState(function(){try{var v=localStorage.getItem(bindShareKey);return v?JSON.parse(v):null;}catch(e){return null;}});
  var bindShare=ssl[0];var setBindShare=ssl[1];
  var scp=useState(false);var linkCopied=scp[0];var setLinkCopied=scp[1];
  var sll=useState(false);var linkLoading=sll[0];var setLinkLoading=sll[1];
  // Get strand info for active filter label
  var projStrands=app.allStrands[app.projId]||{};
  var activeStrand=null;
  if(activeFilter){Object.values(projStrands).flat().forEach(function(st){if(st.id===activeFilter)activeStrand=st;});}
  var allDraftsList=app.allDrafts[app.projId]||[];
  // Apply strand filter first, then nested/parent filter
  var strandFiltered=activeFilter
    ?allDraftsList.filter(function(d){return (d.strandTags||[]).includes(activeFilter);})
    :allDraftsList;
  var parents=strandFiltered.filter(function(d){return d.status!=='loose_thread'&&!d.parentId&&!d.archived;}).sort(function(a,b){return (a.order||0)-(b.order||0);});
  var allSeq=inclNested
    ?strandFiltered.filter(function(d){return d.status!=='loose_thread'&&!d.archived;}).sort(function(a,b){return (a.order||0)-(b.order||0);})
    :strandFiltered.filter(function(d){return d.status!=='loose_thread'&&!d.parentId&&!d.archived;}).sort(function(a,b){return (a.order||0)-(b.order||0);});
  var filtered=allSeq.filter(function(d){return !excluded[d.id];});
  var totalWords=filtered.reduce(function(s,d){return s+(d.wordCount||0);},0);
  function toggleExclude(id){setExcluded(function(prev){var n=Object.assign({},prev);n[id]=!n[id];return n;});}
  function handleExport(){
    if(format==='link'){handlePublishLink();return;}
    setExporting(true);
    var profile=app.profile||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim();
    setTimeout(function(){
      doExport(format,filtered,app.currentProject,false,authorName);
      setExporting(false);
    },100);
  }
  async function handlePublishLink(){
    if(filtered.length===0)return;
    setLinkLoading(true);
    var profile=app.profile||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim();
    var projName=(app.currentProject&&app.currentProject.title)||'';
    var combinedBody=filtered.map(function(d){
      return '<h2 style="margin-top:32px;margin-bottom:8px;font-family:serif;">'+(d.title||'Untitled')+'</h2>'+(d.body||'');
    }).join('');
    var linkTitle=activeStrand?activeStrand.name+' — '+projName:projName;
    // Delete old link if exists
    if(bindShare&&bindShare.id){
      await supabase.from('shared_drafts').delete().eq('id',bindShare.id);
    }
    var sid=genId();
    var res=await supabase.from('shared_drafts').insert({id:sid,title:linkTitle,body:combinedBody,project_name:projName,author_name:authorName});
    if(res.error){setLinkLoading(false);return;}
    if(shareId) return(<div className="woven-root"><SharedDraftView shareId={shareId}/></div>);
    var shareData={id:sid,link:link,enabled:true,created:new Date().toISOString()};
    setBindShare(shareData);
    try{localStorage.setItem(bindShareKey,JSON.stringify(shareData));}catch(e){}
    setLinkLoading(false);
  }
  async function handleUnpublishLink(){
    if(!bindShare)return;
    await supabase.from('shared_drafts').delete().eq('id',bindShare.id);
    setBindShare(null);
    try{localStorage.removeItem(bindShareKey);}catch(e){}
  }
  function copyLink(){
    if(!bindShare||!bindShare.link)return;
    navigator.clipboard&&navigator.clipboard.writeText(bindShare.link);
    setLinkCopied(true);setTimeout(function(){setLinkCopied(false);},2500);
  }
  return(
<Panel open={open} onClose={onClose} title="Bind your drafts"
  footer={<div style={{display:'flex',flexDirection:'column',gap:0,width:'100%'}}>
    {/* Share link UI */}
    {bindShare&&(
<div style={{marginBottom:10,padding:10,background:'var(--bg2)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
    <span style={{fontSize:11,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.06em'}}>Read-only link</span>
    <button style={{fontSize:11,color:'var(--danger)',background:'none',border:'none',cursor:'pointer',padding:0}} onClick={handleUnpublishLink}>Unpublish</button>
  </div>
  <div style={{fontSize:11,color:'var(--mid)',wordBreak:'break-all',marginBottom:6,fontFamily:'var(--mono)',lineHeight:1.4}}>{bindShare.link}</div>
  <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={copyLink}>
    {linkCopied?<><span className="mi" style={{fontSize:14}}>check_circle</span>Copied!</>:<><span className="mi" style={{fontSize:14}}>content_copy</span>Copy link</>}
  </button>
</div>
    )}
    {/* Format dropdown */}
    <div style={{marginBottom:8}}>
      <select style={{width:'100%',padding:'9px 12px',fontSize:13,color:'var(--text)',background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:'var(--r)'}} value={format} onChange={function(e){setFormat(e.target.value);}}>
        <option value="PDF">PDF — best for sharing & printing</option>
        <option value="Word (.docx)">Word Document — edit in Word or Google Docs</option>
        <option value="link">Read-only link — share in browser</option>
      </select>
    </div>
    <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={handleExport} disabled={exporting||linkLoading||filtered.length===0}>
      {(exporting||linkLoading)?<span style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',animation:'spin .7s linear infinite',display:'inline-block'}}/>{format==='link'?'Publishing...':'Preparing...'}</span>:format==='link'?'Publish link':'Export'}
    </button>
  </div>}>
  {activeStrand&&(
<div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'8px 12px',background:'var(--bg2)',borderRadius:'var(--r)',border:'1px solid var(--border)'}}>
  <div style={{width:8,height:8,borderRadius:'50%',background:activeStrand.color,flexShrink:0}}/>
  <span style={{fontSize:13,color:'var(--text)',flex:1}}>Filtered to <strong>{activeStrand.name}</strong></span>
  <span style={{fontSize:11,color:'var(--mid)'}}>Arc filter active</span>
</div>
  )}
  <div style={{marginBottom:16}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
      <span className="sect-lbl" style={{margin:0}}>Sequence</span>
      <span style={{fontSize:12,color:'var(--mid)'}}>{filtered.length}{' draft'+(filtered.length!==1?'s':'')}{' · '}{totalWords}{' words'}</span>
    </div>
    <div className="bind-draft-list">
      {parents.map(function(d,i){var info=STATUSES[d.status]||STATUSES.first_draft;var children=(app.allDrafts[app.projId]||[]).filter(function(c){return c.parentId===d.id;});return(
<div key={d.id}>
  <div className="bind-draft-row" style={{opacity:excluded[d.id]?.45:1,cursor:'pointer'}} onClick={function(){toggleExclude(d.id);}}>
    <span style={{width:16,height:16,borderRadius:4,border:'1px solid '+(excluded[d.id]?'var(--border)':'var(--indigo)'),background:excluded[d.id]?'transparent':'var(--indigo)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
      {!excluded[d.id]&&<span className="mi" style={{fontSize:12,color:'#fff'}}>check</span>}
    </span>
    <span style={{fontSize:11,color:'var(--mid)',width:24}}>{i+1}</span>
    <div style={{width:9,height:9,borderRadius:'50%',background:info.color,flexShrink:0}}/>
    <span style={{flex:1,textDecoration:excluded[d.id]?'line-through':'none',color:excluded[d.id]?'var(--mid)':'var(--text)'}}>{d.title||'Untitled'}</span>
  </div>
  {inclNested&&children.filter(function(c){return !c.archived;}).map(function(c,ci){var ci2=STATUSES[c.status]||STATUSES.first_draft;return(
<div key={c.id} className="bind-draft-row" style={{paddingLeft:24,background:'rgba(42,31,16,.02)',opacity:excluded[c.id]?.45:1,cursor:'pointer'}} onClick={function(){toggleExclude(c.id);}}>
  <span style={{width:16,height:16,borderRadius:4,border:'1px solid '+(excluded[c.id]?'var(--border)':'var(--indigo)'),background:excluded[c.id]?'transparent':'var(--indigo)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
    {!excluded[c.id]&&<span className="mi" style={{fontSize:12,color:'#fff'}}>check</span>}
  </span>
  <span style={{fontSize:11,color:'var(--mid)',width:28}}>{(i+1)+'.'+(ci+1)}</span>
  <div style={{width:9,height:9,borderRadius:'50%',background:ci2.color,flexShrink:0}}/>
  <span style={{flex:1,fontSize:12,color:excluded[c.id]?'var(--mid)':'var(--body-text)',textDecoration:excluded[c.id]?'line-through':'none'}}>{c.title||'Untitled'}</span>
</div>
  );})}
</div>
      );})}
      {parents.length===0&&<div style={{padding:'12px',fontSize:13,color:'var(--mid)'}}>No drafts to bind.</div>}
    </div>
    <div style={{fontSize:12,color:'var(--mid)',marginTop:6}}>Loose Threads are always excluded.</div>
  </div>
  <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderTop:'1px solid var(--border)',borderBottom:'1px solid var(--border)',marginBottom:14,cursor:'pointer'}} onClick={function(){setInclNested(!inclNested);}}>
    <span style={{width:18,height:18,borderRadius:4,border:'1px solid '+(inclNested?'var(--indigo)':'var(--border)'),background:inclNested?'var(--indigo)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
      {inclNested&&<span className="mi" style={{fontSize:13,color:'#fff'}}>check</span>}
    </span>
    <span style={{fontSize:13,color:'var(--text)'}}>Include nested drafts</span>
  </div>

</Panel>
  );
}
// ── applyFS ──
function applyFS(drafts,filter,sort){
  // drafts here are tree nodes (with .children). Filter matches parent or any child.
  var d=filter?drafts.filter(function(x){
    var matchSelf=(x.strandTags||[]).includes(filter);
    var matchChild=(x.children||[]).some(function(c){return (c.strandTags||[]).includes(filter);});
    return matchSelf||matchChild;
  }):drafts;
  return d.slice().sort(function(a,b){
    if(sort==='title')return (a.title||'').localeCompare(b.title||'');
    if(sort==='status')return Object.keys(STATUSES).indexOf(a.status)-Object.keys(STATUSES).indexOf(b.status);
    if(sort==='words')return (b.wordCount||0)-(a.wordCount||0);
    return (a.order||999)-(b.order||999);
  });
}

// ── DraftCard ──
function DraftCard({draft,label,childCount,app,isNested,onMoveUp,onMoveDown,seqCount}){
  var isMobile=useIsMobile();
  var so=useState(false);var over=so[0];var setOver=so[1];
  var sn=useState(false);var nestTarget=sn[0];var setNestTarget=sn[1];
  var nestTargetRef=useRef(false);
  var sac=useState(false);var archiveConfirm=sac[0];var setArchiveConfirm=sac[1];
  var nestTimer=useRef(null);
  var projStrands=app.allStrands[app.projId]||{};
  var tagged=[];
  Object.keys(projStrands).forEach(function(c){(projStrands[c]||[]).forEach(function(st){if((draft.strandTags||[]).includes(st.id))tagged.push(st);});});
  function update(changes){app.updateDraft(app.projId,draft.id,changes);}
  function onStatusChange(s){
    if(s==='archive'){setArchiveConfirm(true);return;}
    var ch={status:s};
    if(s==='loose_thread'){ch.order=null;ch.parentId=null;}
    else if(draft.status==='loose_thread'){ch.order=(app.allDrafts[app.projId]||[]).filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).length+1;}
    update(ch);
  }
  function doArchive(){
    var allDr=app.allDrafts[app.projId]||[];
    var children=allDr.filter(function(d){return d.parentId===draft.id&&!d.archived;});
    app.updateDraft(app.projId,draft.id,{archived:true});
    children.forEach(function(c){app.updateDraft(app.projId,c.id,{archived:true});});
    setArchiveConfirm(false);
  }
  function handleDragOver(e){
    e.preventDefault();setOver(true);
    if(!nestTimer.current){
      nestTimer.current=setTimeout(function(){setNestTarget(true);nestTargetRef.current=true;},1200);
    }
  }
  function handleDragLeave(){
    setOver(false);setNestTarget(false);nestTargetRef.current=false;
    if(nestTimer.current){clearTimeout(nestTimer.current);nestTimer.current=null;}
  }
  function handleDrop(e){
    e.preventDefault();
    var fromId=e.dataTransfer.getData('draftId');
    if(fromId&&fromId!==draft.id){
      var fromDraft=(app.allDrafts[app.projId]||[]).find(function(d){return d.id===fromId;});
      var isLT=fromDraft&&fromDraft.status==='loose_thread';
      var isNesting=nestTargetRef.current&&!draft.parentId&&!isLT&&!fromDraft.parentId;
      if(isNesting){
        app.nestDraft(app.projId,fromId,draft.id);
      } else if(isLT){
        var seqCount=(app.allDrafts[app.projId]||[]).filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).length;
        app.updateDraft(app.projId,fromId,{status:'first_draft',order:draft.order||seqCount+1,parentId:null});
      } else {
        app.reorderDraft(app.projId,fromId,draft.order||0);
      }
    }
    setOver(false);setNestTarget(false);nestTargetRef.current=false;
    if(nestTimer.current){clearTimeout(nestTimer.current);nestTimer.current=null;}
  }
  var chips=tagged.slice(0,2);
  var cardCls='draft-card'+(over?' drag-over':'')+(nestTarget?' nest-target':'');
  var cardEl=(
<div className={cardCls} draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('draftId',draft.id);}}
  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
  <div className="card-hdr" style={{backgroundImage:draft.thumbnail?'url('+draft.thumbnail+')':undefined,backgroundSize:'cover',backgroundPosition:'center'}}>
    <div style={{display:'flex',alignItems:'center',gap:5,background:draft.thumbnail?'rgba(253,248,240,.75)':'transparent',borderRadius:4,padding:'2px 5px'}}>
      <span className="card-seq" style={{color:'var(--text)',background:draft.thumbnail?'rgba(253,248,240,.8)':'transparent',borderRadius:4,padding:draft.thumbnail?'1px 6px':undefined}}>{label}</span>
      {childCount>0&&(
<div style={{display:'flex',alignItems:'center',gap:2,cursor:'pointer'}}
  onClick={function(e){e.stopPropagation();app.setView('table');app.updateDraft(app.projId,draft.id,{nestExpanded:true});}}>
  <span className="mi" style={{fontSize:13,color:'var(--indigo)'}}>account_tree</span>
  <span style={{fontSize:10,color:'var(--indigo)',fontWeight:600}}>{childCount}</span>
</div>
      )}
    </div>
    {nestTarget&&<span style={{fontSize:10,color:'var(--teal)',fontWeight:600}}>nest here</span>}
    {isMobile&&!draft.parentId?(
<div style={{display:'flex',gap:2}}>
  <button className="arrow-btn" onClick={function(){onMoveUp&&onMoveUp(draft.id);}}><span className="mi" style={{fontSize:16}}>keyboard_arrow_up</span></button>
  <button className="arrow-btn" onClick={function(){onMoveDown&&onMoveDown(draft.id);}}><span className="mi" style={{fontSize:16}}>keyboard_arrow_down</span></button>
</div>
    ):<span style={{color:'var(--border)',display:'flex',alignItems:'center'}}><span className="mi" style={{fontSize:16}}>drag_indicator</span></span>}
  </div>
  <div className="card-body">
    <textarea className="card-title-f" title={draft.title||''} defaultValue={draft.title} placeholder="Untitled draft" rows={1} ref={function(el){if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,52)+'px';}}} onInput={function(e){e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,52)+'px';}} onBlur={function(e){update({title:e.target.value});}} onKeyDown={function(e){if(e.key==='Enter')e.preventDefault();}} onKeyDown={function(e){if(e.key==='Enter')e.preventDefault();}}/>
    {draft.synopsis?(
<textarea className="card-syn-f" defaultValue={draft.synopsis} rows={3} onBlur={function(e){update({synopsis:e.target.value});}}/>
    ):(
<SynopsisPreview draft={draft} onUpdate={update}/>
    )}
    {tagged.length>0&&(
<div className="strand-chips" style={{marginTop:2,flexWrap:'nowrap',overflow:'hidden'}}>
  {tagged.slice(0,2).map(function(st){return <span key={st.id} className="chip" style={{background:'rgba(196,94,40,.1)',color:'var(--indigo)',borderColor:'rgba(196,94,40,.25)',borderWidth:1,borderStyle:'solid',fontSize:10,padding:'2px 6px',flexShrink:0}}>{st.name}</span>;})}
  {tagged.length>2&&<OverflowTooltip label={'+'+(tagged.length-2)} names={tagged.slice(2).map(function(s){return s.name;})}/>}
</div>
    )}
  </div>
  <div className="card-footer" style={{flexWrap:'wrap',gap:4}}>
    <StatusDot status={draft.status} onChange={onStatusChange}/>
    <span className="card-wc" style={{marginLeft:4}}>{(draft.wordCount||0)+'w'}</span>
    <button className="card-open" style={{marginLeft:'auto'}} onClick={function(){app.openDraft(draft.id);}}>Open</button>
    <button className="card-open" title="Duplicate as nested draft" onClick={function(e){e.stopPropagation();app.duplicateDraft(app.projId,draft.id);}}>⧉</button>
  </div>
</div>
  );
  return(<div>{cardEl}{archiveConfirm&&<ArchiveConfirmModal draft={draft} allDrafts={app.allDrafts[app.projId]||[]} onConfirm={doArchive} onCancel={function(){setArchiveConfirm(false);}}/>}</div>);
}


// ── SynopsisPreview ──
function SynopsisPreview({draft,onUpdate}){
  var sh=useState(false);var hovered=sh[0];var setHovered=sh[1];
  var se=useState(false);var editing=se[0];var setEditing=se[1];
  var bodyPreview=draft.body?stripHtml(draft.body).slice(0,120):'';
  var isEmpty=!bodyPreview;
  if(editing){return(
<textarea autoFocus className="card-syn-f" defaultValue="" placeholder="Add a synopsis..." rows={3} style={{flex:1}} onBlur={function(e){if(e.target.value.trim())onUpdate({synopsis:e.target.value});setEditing(false);}} onKeyDown={function(e){if(e.key==='Escape')setEditing(false);}}/>
  );}
  return(
<div style={{position:'relative',flex:1,overflow:'hidden',cursor:'pointer',borderRadius:4}} onMouseEnter={function(){setHovered(true);}} onMouseLeave={function(){setHovered(false);}} onClick={function(){setEditing(true);}}>
  {isEmpty?(
<div style={{fontSize:12,color:'var(--placeholder)',lineHeight:1.4,padding:'2px 4px',fontStyle:'italic'}}>Add a synopsis...</div>
  ):(
<div style={{fontSize:12,color:'var(--placeholder)',lineHeight:1.4,padding:'2px 4px',fontStyle:'italic',overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>{bodyPreview}{bodyPreview.length>=120?'…':''}</div>
  )}
  {hovered&&(
<div style={{position:'absolute',inset:0,background:'rgba(245,237,224,0.92)',display:'flex',alignItems:'center',justifyContent:'center',gap:5,borderRadius:4,border:'1px dashed var(--border)'}}>
  <span className="mi" style={{fontSize:14,color:'var(--indigo)'}}>edit</span>
  <span style={{fontSize:11,color:'var(--indigo)',fontWeight:600}}>Add synopsis</span>
</div>
  )}
</div>
  );
}

// ── LooseThreadsSection ──
function LooseThreadsSection({threads,app,view}){
  var s=useState(true);var open=s[0];var setOpen=s[1];
  // threads prop already comes in; sort newest first
  var sortedThreads=threads.slice().sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});
  function addLT(){app.addDraft(app.projId,{id:genId(),projectId:app.projId,title:'',synopsis:'',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],pov:'',customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
  var isTile=view==='tiles';var isTable=view==='table';
  return(
<div className="lt-section"
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){
    e.preventDefault();
    var fromId=e.dataTransfer.getData('draftId');
    if(!fromId) return;
    var allDr=app.allDrafts[app.projId]||[];
    var fromDraft=allDr.find(function(d){return d.id===fromId;});
    if(!fromDraft) return;
    // If seq draft dropped on LT section → demote to loose thread
    if(fromDraft.status!=='loose_thread'){
      app.updateDraft(app.projId,fromId,{status:'loose_thread',order:null,parentId:null});
    }
  }}>
  <div className="lt-hdr" onClick={function(){setOpen(!open);}}>
    <span className="lt-tilde">~</span>
    <span className="lt-label">Loose Threads</span>
    {threads.length>0&&<span style={{fontSize:13,color:'var(--mid)'}}>{threads.length}</span>}
    <span className={'lt-chevron mi'+(open?' open':'')}>chevron_right</span>
  </div>
  {open&&(
<div>
  {isTable?(
<div>
  {sortedThreads.map(function(d){return(
<div key={d.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderBottom:'1px solid var(--bg2)'}}
  draggable={true} onDragStart={function(e){e.dataTransfer.setData('draftId',d.id);}}>
  <span className="mi" style={{fontSize:18,color:'var(--border)',cursor:'grab'}}>drag_indicator</span>
  <span style={{color:'var(--teal)',fontSize:16,fontWeight:600,width:24}}>~</span>
  <input className="tbl-inp" defaultValue={d.title} placeholder="Untitled loose thread" onBlur={function(e){app.updateDraft(app.projId,d.id,{title:e.target.value});}} style={{maxWidth:180}}/>
  <input className="tbl-inp syn" defaultValue={d.synopsis} placeholder="Note..." onBlur={function(e){app.updateDraft(app.projId,d.id,{synopsis:e.target.value});}} style={{flex:1}}/>
  <button className="card-open" onClick={function(){app.openDraft(d.id);}}>Draft</button>
</div>
  );})}
</div>
  ):isTile?(
<div className="tiles-grid">
  {threads.map(function(d){return(
<div key={d.id} className="tile" draggable={true} onDragStart={function(e){e.dataTransfer.setData('draftId',d.id);}}
  onDragOver={function(e){e.preventDefault();}} onClick={function(){app.openDraft(d.id);}}>
  <div className="tile-top"><span style={{color:'var(--teal)',fontWeight:700,fontSize:14}}>~</span></div>
  <div className="tile-title">{d.title||'Untitled'}</div>
  <div className="tile-syn">{d.synopsis||''}</div>
</div>
  );})}
</div>
  ):(
<div className="cards-grid">
  <div className="draft-card" style={{border:'2px dashed var(--border)',background:'transparent',cursor:'pointer',alignItems:'center',justifyContent:'center',gap:8,display:'flex',flexDirection:'column',boxShadow:'none'}} onClick={addLT}>
    <span className="mi" style={{fontSize:22,color:'var(--placeholder)'}}>add_circle_outline</span>
    <span style={{fontSize:12,color:'var(--placeholder)'}}>New loose thread</span>
  </div>
  {sortedThreads.map(function(d){return <DraftCard key={d.id} draft={d} label="~" app={app}/>;} )}
</div>
  )}

</div>
  )}
</div>
  );
}

// ── Empty state ──

function DraftLoadingSpinner(){
  return(<div className="empty-view"><div style={{width:32,height:32,borderRadius:'50%',border:'3px solid var(--border)',borderTopColor:'var(--indigo)',animation:'spin .8s linear infinite'}}/><div style={{fontFamily:'var(--serif)',fontSize:18,color:'var(--mid)'}}>Loading drafts...</div></div>);
}
function EmptyDrafts({onAdd}){
  return(
<div className="empty-view">
  <span className="mi" style={{fontSize:48,color:'var(--placeholder)'}}>edit_note</span>
  <div style={{fontFamily:'var(--serif)',fontSize:22,color:'var(--mid)'}}>No drafts yet</div>
  <div style={{fontSize:14,color:'var(--mid)',marginBottom:12}}>Start writing by adding your first draft.</div>
  <button className="btn btn-primary" onClick={onAdd}><span className="mi" style={{fontSize:16}}>add</span>Add first draft</button>
</div>
  );
}

// ── CardsView ──
function CardsView({app}){
  var sf=useState(null);var filter=sf[0];var setFilter=sf[1];
  var ss=useState('order');var sort=ss[0];var setSort=ss[1];
  var sb=useState(false);var bindOpen=sb[0];var setBindOpen=sb[1];
  var allDrafts=app.allDrafts[app.projId]||[];
  var seqDrafts=allDrafts.filter(function(d){return !d.archived&&d.status!=='loose_thread'&&!d.parentId;});
  var ltDrafts=allDrafts.filter(function(d){return !d.archived&&d.status==='loose_thread';});
  var tree=buildTree(allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.archived;}));
  function addDraft(){var nid=genId();app.addDraft(app.projId,{id:nid,projectId:app.projId,title:'',synopsis:'',status:'first_draft',order:seqDrafts.length+1,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],pov:'',customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});app.openDraft(nid);}
  function moveUp(did){var sorted=seqDrafts.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});var idx=sorted.findIndex(function(d){return d.id===did;});if(idx<=0)return;app.reorderDraft(app.projId,did,sorted[idx-1].order||0);}
  function moveDown(did){var sorted=seqDrafts.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});var idx=sorted.findIndex(function(d){return d.id===did;});if(idx<0||idx>=sorted.length-1)return;app.reorderDraft(app.projId,did,sorted[idx+1].order||0);}
  var displayed=applyFS(tree,filter,sort);
  return(
<div className="view-layout">
  <ViewHeader app={app} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onAddDraft={addDraft} onBind={function(){setBindOpen(true);}}/>
  <div className="view-area dot-grid">
    {app.dataLoading?<DraftLoadingSpinner/>:tree.length===0?<EmptyDrafts onAdd={addDraft}/>:(
<div className="cards-grid">
  {displayed.map(function(parent){
    var childCount=parent.children?parent.children.length:0;
    var sortedSeq=seqDrafts.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});
    var seqIdx=sortedSeq.findIndex(function(d){return d.id===parent.id;});
    return <DraftCard key={parent.id} draft={parent} label={''+(seqIdx>=0?seqIdx+1:'?')} childCount={childCount} app={app} onMoveUp={moveUp} onMoveDown={moveDown}/>;
  })}
  <div className="draft-card" style={{border:'2px dashed var(--border)',background:'transparent',cursor:'pointer',alignItems:'center',justifyContent:'center',gap:8,display:'flex',flexDirection:'column',boxShadow:'none'}} onClick={addDraft}>
    <span className="mi" style={{fontSize:28,color:'var(--placeholder)'}}>add_circle_outline</span>
    <span style={{fontSize:13,color:'var(--placeholder)'}}>New draft</span>
  </div>
</div>
    )}
    <LooseThreadsSection threads={ltDrafts} app={app} view="cards"/>
  </div>
  <BindPanel app={app} open={bindOpen} onClose={function(){setBindOpen(false);}} activeFilter={filter}/>
</div>
  );
}

// ── TilesView ──
function TilesView({app}){
  var sf=useState(null);var filter=sf[0];var setFilter=sf[1];
  var ss=useState('order');var sort=ss[0];var setSort=ss[1];
  var sb=useState(false);var bindOpen=sb[0];var setBindOpen=sb[1];
  var so2=useState(null);var dragOver=so2[0];var setDragOver=so2[1];
  var sn=useState(null);var nestTarget=sn[0];var setNestTarget=sn[1];
  var nestTimer=useRef(null);
  var allDrafts=app.allDrafts[app.projId]||[];
  var tree=buildTree(allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.archived;}));
  var ltDrafts=allDrafts.filter(function(d){return !d.archived&&d.status==='loose_thread';});
  function addDraft(){var seqCount=allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).length;app.addDraft(app.projId,{id:genId(),projectId:app.projId,title:'',synopsis:'',status:'first_draft',order:seqCount+1,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],pov:'',customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
  var displayed=applyFS(tree,filter,sort);
  return(
<div className="view-layout">
  <ViewHeader app={app} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onAddDraft={addDraft} onBind={function(){setBindOpen(true);}}/>
  <div className="view-area dot-grid">
    {app.dataLoading?<DraftLoadingSpinner/>:tree.length===0?<EmptyDrafts onAdd={addDraft}/>:(
<div>
  <div className="tiles-grid">
    {displayed.map(function(parent,i){
      var info=STATUSES[parent.status]||STATUSES.first_draft;
      var isNT=nestTarget===parent.id;var isDO=dragOver===parent.id;
      return(
<div key={parent.id} className={'tile'+(isDO?' drag-over':'')+(isNT?' nest-target':'')}
  draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('draftId',parent.id);}}
  onDragOver={function(e){e.preventDefault();setDragOver(parent.id);if(!nestTimer.current){nestTimer.current=setTimeout(function(){setNestTarget(parent.id);},700);}}}
  onDragLeave={function(){setDragOver(null);setNestTarget(null);if(nestTimer.current){clearTimeout(nestTimer.current);nestTimer.current=null;}}}
  onDrop={function(e){e.preventDefault();var fromId=e.dataTransfer.getData('draftId');if(fromId&&fromId!==parent.id){if(isNT){app.nestDraft(app.projId,fromId,parent.id);}else{app.reorderDraft(app.projId,fromId,parent.order||0);}}setDragOver(null);setNestTarget(null);if(nestTimer.current){clearTimeout(nestTimer.current);nestTimer.current=null;}}}
  onClick={function(){app.openDraft(parent.id);}}>
  <div className="tile-top">
    <span style={{fontSize:11,color:'var(--mid)'}}>{'#'+(i+1)}</span>
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      {parent.children&&parent.children.length>0&&<span style={{fontSize:9,color:'var(--mid)'}}>{parent.children.length}</span>}
      <div style={{width:8,height:8,borderRadius:'50%',background:info.color}}/>
    </div>
  </div>
  <div className="tile-title">{parent.title||'Untitled'}</div>
  <div className="tile-syn">{parent.synopsis||''}</div>
  {isNT&&<div style={{fontSize:10,color:'var(--teal)',marginTop:'auto'}}>nest here</div>}
</div>
      );
    })}
  </div>
    <LooseThreadsSection threads={ltDrafts} app={app} view="tiles"/>
</div>
    )}
  </div>
  <BindPanel app={app} open={bindOpen} onClose={function(){setBindOpen(false);}} activeFilter={filter}/>
</div>
  );
}

// ── TableView ──
function TableView({app}){
  var sf=useState(null);var filter=sf[0];var setFilter=sf[1];
  var ss=useState('order');var sort=ss[0];var setSort=ss[1];
  var sb=useState(false);var bindOpen=sb[0];var setBindOpen=sb[1];
  var so2=useState(null);var dragOver=so2[0];var setDragOver=so2[1];
  var sco=useState(false);var colOpen=sco[0];var setColOpen=sco[1];
  var scp=useState({top:0,left:0,right:0});var colPos=scp[0];var setColPos=scp[1];
  var colRef=useRef(null);
  // Column visibility
  var projKey='colvis:'+app.projId;
  var svc=useState(function(){try{var v=localStorage.getItem(projKey);return v?JSON.parse(v):DEFAULT_TABLE_COLS;}catch(e){return DEFAULT_TABLE_COLS;}});
  var visCols=svc[0];var setVisCols=svc[1];
  var scw=useState({title:160,synopsis:260,status:130,strandTags:160,wordCount:64,pov:90});
  var colWidths=scw[0];var setColWidths=scw[1];
  var resizing=useRef(null);
  function startResize(col,e){
    e.preventDefault();
    resizing.current={col:col,startX:e.clientX,startW:colWidths[col]||160};
    function onMove(e2){if(!resizing.current)return;var diff=e2.clientX-resizing.current.startX;var nw=Math.max(60,resizing.current.startW+diff);setColWidths(function(prev){var n=Object.assign({},prev);n[resizing.current.col]=nw;return n;});}
    function onUp(){resizing.current=null;document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);}
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  }
  var project=app.currentProject||{};
  var draftFieldDefs=project.draftFieldDefs||[];
  var allAvailCols=[
    {id:'title',label:'Title'},
    {id:'status',label:'Status'},
    {id:'wordCount',label:'Words'},
    {id:'synopsis',label:'Synopsis'},
    {id:'pov',label:'POV'}
    ,{id:'strandTags',label:'Strands'}
  ].concat(draftFieldDefs.map(function(f){return{id:'cf_'+f.id,label:f.label};}));
  function toggleCol(id){var next=visCols.includes(id)?visCols.filter(function(c){return c!==id;}):visCols.concat([id]);setVisCols(next);try{localStorage.setItem(projKey,JSON.stringify(next));}catch(e){}}
  var colDropRef=useRef(null);
  useEffect(function(){if(!colOpen)return;function onDown(e){
    if(colRef.current&&colRef.current.contains(e.target))return;
    if(colDropRef.current&&colDropRef.current.contains(e.target))return;
    setColOpen(false);
  }document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[colOpen]);
  var allDrafts=app.allDrafts[app.projId]||[];
  var tree=buildTree(allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.archived;}));
  var ltDrafts=allDrafts.filter(function(d){return !d.archived&&d.status==='loose_thread';});
  var displayed=applyFS(tree,filter,sort);
  function addDraft(){var seqCount=allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).length;app.addDraft(app.projId,{id:genId(),projectId:app.projId,title:'',synopsis:'',status:'first_draft',order:seqCount+1,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],pov:'',customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
  function renderCell(col,draft){
    if(col==='title')return <input className="tbl-inp" style={{fontFamily:'var(--serif)',fontWeight:600,fontSize:14,textOverflow:'ellipsis',overflow:'hidden',whiteSpace:'nowrap'}} title={draft.title||''} defaultValue={draft.title} placeholder="Untitled" onBlur={function(e){app.updateDraft(app.projId,draft.id,{title:e.target.value});}}/>;
    if(col==='status'){return <StatusDotWithArchive draft={draft} app={app} showLabel={true}/>;}
    if(col==='wordCount')return <span style={{fontSize:12,color:'var(--mid)'}}>{draft.wordCount||0}</span>;
    if(col==='synopsis')return <input className="tbl-inp syn" defaultValue={draft.synopsis} placeholder="Synopsis..." onBlur={function(e){app.updateDraft(app.projId,draft.id,{synopsis:e.target.value});}} style={{width:'100%'}}/>;
    if(col==='strandTags'){var ps2=app.allStrands[app.projId]||{};var ts2=[];Object.keys(ps2).forEach(function(c){(ps2[c]||[]).forEach(function(st){if((draft.strandTags||[]).includes(st.id))ts2.push(st);});});return(<div style={{display:'flex',flexWrap:'nowrap',gap:3,overflow:'hidden'}}>{ts2.slice(0,2).map(function(st){return <span key={st.id} className="chip" style={{background:'rgba(196,94,40,.1)',color:'var(--indigo)',borderColor:'rgba(196,94,40,.25)',borderWidth:1,borderStyle:'solid',fontSize:11,flexShrink:0}}>{st.name}</span>;})} {ts2.length>2&&<OverflowTooltip label={'+'+(ts2.length-2)} names={ts2.slice(2).map(function(s){return s.name;})}/>}</div>);}
    if(col==='pov'){var projStrands=app.allStrands[app.projId]||{};var taggedStrands=[];Object.keys(projStrands).forEach(function(c){(projStrands[c]||[]).forEach(function(st){if((draft.strandTags||[]).includes(st.id))taggedStrands.push(st);});});return(
<select style={{background:'transparent',border:'none',padding:0,fontSize:12,color:'var(--mid)',width:90}} value={draft.pov||''} onChange={function(e){app.updateDraft(app.projId,draft.id,{pov:e.target.value});}}>
  <option value="">—</option>
  {taggedStrands.map(function(st){return <option key={st.id} value={st.id}>{st.name}</option>;})}
</select>
    );}
    if(col.startsWith('cf_')){var fid=col.slice(3);return <input className="tbl-inp syn" defaultValue={draft.customFields&&draft.customFields[fid]?draft.customFields[fid]:''} placeholder="—" onBlur={function(e){var cf=Object.assign({},draft.customFields||{});cf[fid]=e.target.value;app.updateDraft(app.projId,draft.id,{customFields:cf});}} style={{width:90}}/>;}
    return null;
  }
  function renderRow(draft,label,isNested,parentIdx,childIdx,hasChildren,isExpanded){return(
<tr key={draft.id} className={(dragOver===draft.id?'drag-over ':'')+(isNested?'nest-row':'')}
  onDragOver={function(e){e.preventDefault();setDragOver(draft.id);}}
  onDragLeave={function(){setDragOver(null);}}
  onDrop={function(e){e.preventDefault();setDragOver(null);var fromId=e.dataTransfer.getData('draftId');if(fromId&&fromId!==draft.id){var fromDraft=(app.allDrafts[app.projId]||[]).find(function(d){return d.id===fromId;});if(fromDraft&&fromDraft.status==='loose_thread'){app.updateDraft(app.projId,fromId,{status:'first_draft',order:draft.order||0,parentId:null});}else{app.reorderDraft(app.projId,fromId,draft.order||0);}}}}>
  <td><div style={{display:'flex',alignItems:'center',gap:2}}>
    <span draggable={true} onDragStart={function(e){e.dataTransfer.setData('draftId',draft.id);}} style={{cursor:'grab',color:'var(--border)',display:'flex',alignItems:'center'}}><span className="mi" style={{fontSize:18}}>drag_indicator</span></span>
    {isNested&&<button className="btn-icon" style={{padding:2}} title="Unnest draft" onClick={function(){app.updateDraft(app.projId,draft.id,{parentId:null,order:Date.now()});}}><span className="mi" style={{fontSize:14,color:'var(--mid)'}}>vertical_align_top</span></button>}
  </div></td>
  <td style={{color:'var(--mid)',fontSize:11,whiteSpace:'nowrap',paddingLeft:isNested?28:12}}>
    <div style={{display:'flex',alignItems:'center',gap:2}}>
      {hasChildren&&<span className="mi" style={{fontSize:16,cursor:'pointer',color:'var(--mid)',flexShrink:0,lineHeight:1}} onClick={function(){app.updateDraft(app.projId,draft.id,{nestExpanded:!isExpanded});}}>{isExpanded?'expand_less':'expand_more'}</span>}
      {isNested&&<span className="mi" style={{fontSize:12,color:'var(--border)',flexShrink:0}}>subdirectory_arrow_right</span>}
      {label}
    </div>
  </td>
  {visCols.map(function(col){return <td key={col}>{renderCell(col,draft)}</td>;})}
  <td><button className="card-open" onClick={function(){app.openDraft(draft.id);}}>Draft</button></td>
</tr>
  );}
  return(
<div className="view-layout">
  <ViewHeader app={app} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onAddDraft={addDraft} onBind={function(){setBindOpen(true);}}/>
  <div className="table-wrap dot-grid" style={{display:'flex',flexDirection:'column',flex:1,overflow:'auto'}}>
    {app.dataLoading?<DraftLoadingSpinner/>:tree.length===0?<EmptyDrafts onAdd={addDraft}/>:(
<div>
  <table className="wt">
    <thead>
      <tr>
        <th style={{width:32}}/>
        <th style={{width:48}}>#</th>
        {visCols.map(function(col){var av=allAvailCols.find(function(c){return c.id===col;});return(
<th key={col} style={{width:colWidths[col]||160,maxWidth:colWidths[col]||160}} className="resizable">
  {av?av.label:col}
  <div className="col-resize-handle" onMouseDown={function(e){startResize(col,e);}}/>
</th>
        );})}
        <th style={{width:54}}>
          <button ref={colRef} className="btn-icon" style={{padding:2,color:'var(--mid)'}} onClick={function(e){var r=e.currentTarget.getBoundingClientRect();setColPos({top:r.bottom+4,right:window.innerWidth-r.right});setColOpen(!colOpen);}} title="Edit columns">
            <span className="mi" style={{fontSize:18}}>settings</span>
          </button>
        </th>
      </tr>
    </thead>
    <tbody>
      {displayed.map(function(parent,i){
        var isExpanded=parent.nestExpanded!==false;
        var hasChildren=parent.children&&parent.children.length>0;
        var origIdx=tree.findIndex(function(d){return d.id===parent.id;});
        var lbl=''+(origIdx+1);
        var rows=[renderRow(parent,lbl,false,i,null,hasChildren,isExpanded)];
        if(hasChildren&&isExpanded){parent.children.forEach(function(child,ci){rows.push(renderRow(child,lbl+'.'+(ci+1),true,i,ci,false,false));});}
        return rows;
      })}
    </tbody>
  </table>
  <div style={{padding:'9px 12px'}}><button className="btn btn-ghost btn-sm" onClick={addDraft}>+ Add draft</button></div>
  <div style={{padding:'0 16px'}}><LooseThreadsSection threads={ltDrafts} app={app} view="table"/></div>
</div>
    )}
  </div>
  {colOpen&&(
<div ref={colDropRef} className="col-vis-drop" style={{top:colPos.top,right:colPos.right,maxHeight:'60vh',overflowY:'auto'}}>
  <div style={{padding:'4px 8px 6px',fontSize:11,color:'var(--mid)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em'}}>Columns</div>
  {allAvailCols.map(function(col){var isVis=visCols.includes(col.id);return(
<div key={col.id} className="col-vis-item" onClick={function(){toggleCol(col.id);}}>
  <span style={{width:18,height:18,borderRadius:4,border:'1px solid var(--border)',background:isVis?'var(--indigo)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
    {isVis&&<span className="mi" style={{fontSize:13,color:'#fff'}}>check</span>}
  </span>
  <span>{col.label}</span>
</div>
  );})}
</div>
  )}
  <BindPanel app={app} open={bindOpen} onClose={function(){setBindOpen(false);}} activeFilter={filter}/>
</div>
  );
}


// ── AddFieldInline ──
function AddFieldInline({onAdd}){
  var ss=useState(false);var show=ss[0];var setShow=ss[1];
  var sv=useState('');var val=sv[0];var setVal=sv[1];
  var st=useState('short_text');var fieldType=st[0];var setFieldType=st[1];
  if(!show)return(
<button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={function(){setShow(true);}}>
  <span className="mi" style={{fontSize:14}}>add</span> Add field
</button>
  );
  return(
<div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
  <div style={{display:'flex',gap:6}}>
    <input autoFocus value={val} onChange={function(e){setVal(e.target.value);}} placeholder="Field name" style={{flex:1,fontSize:13}} onKeyDown={function(e){if(e.key==='Enter'&&val.trim()){onAdd(val,fieldType);setVal('');setShow(false);}if(e.key==='Escape'){setShow(false);setVal('');}}}/>
    <select value={fieldType} onChange={function(e){setFieldType(e.target.value);}} style={{fontSize:12,width:110}}>
      {FIELD_TYPES.map(function(ft){return <option key={ft.id} value={ft.id}>{ft.label}</option>;})}
    </select>
  </div>
  <div style={{display:'flex',gap:6}}>
    <button className="btn btn-primary btn-sm" style={{flex:1,justifyContent:'center'}} onClick={function(){if(val.trim()){onAdd(val,fieldType);setVal('');setShow(false);}}}>Add field</button>
    <button className="btn btn-ghost btn-sm" onClick={function(){setShow(false);setVal('');}}>Cancel</button>
  </div>
</div>
  );
}

// ── Editor ──
function PropertiesDrawer({draft,app,onClose,onOpenStrandDetail}){
  var s1=useState(false);var advOpen=s1[0];var setAdvOpen=s1[1];
  var s2=useState(false);var addChipOpen=s2[0];var setAddChipOpen=s2[1];
  if(!draft)return null;
  var projStrands=app.allStrands[app.projId]||{};
  var allStrandsList=[];
  Object.keys(projStrands).forEach(function(c){(projStrands[c]||[]).forEach(function(st){allStrandsList.push(Object.assign({},st,{collectionName:c}));});});
  var taggedStrands=allStrandsList.filter(function(st){return (draft.strandTags||[]).includes(st.id);});
  var untaggedStrands=allStrandsList.filter(function(st){return !(draft.strandTags||[]).includes(st.id);});
  function update(changes){app.updateDraft(app.projId,draft.id,changes);}
  function removeStrand(sid){update({strandTags:(draft.strandTags||[]).filter(function(t){return t!==sid;})});}
  function addStrand(sid){update({strandTags:(draft.strandTags||[]).concat([sid])});setAddChipOpen(false);}
  var allDrafts=app.allDrafts[app.projId]||[];
  var parentOptions=allDrafts.filter(function(d){return d.status!=='loose_thread'&&d.id!==draft.id&&!d.parentId;});
  var project=app.currentProject||{};
  var draftFieldDefs=project.draftFieldDefs||[];
  return(
<div className="editor-drawer">
  <div className="edrawer-hdr">
    <span className="edrawer-title">Properties</span>
    <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
  </div>
  <div className="edrawer-section">
    <span className="edrawer-lbl">Title</span>
    <input key={draft.id+'-pt'} defaultValue={draft.title||''} placeholder="Untitled draft" onBlur={function(e){update({title:e.target.value});app.updateDraft(app.projId,draft.id,{title:e.target.value,updatedAt:new Date().toISOString()});}}/>
  </div>
  <div className="edrawer-section">
    <span className="edrawer-lbl">Synopsis</span>
    <textarea key={draft.id+'-ps'} defaultValue={draft.synopsis} placeholder="Brief synopsis..." rows={3} onBlur={function(e){update({synopsis:e.target.value});}}/>
  </div>
  <div className="edrawer-section">
    <span className="edrawer-lbl">Thumbnail</span>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      {draft.thumbnail&&<img src={draft.thumbnail} alt="" style={{width:56,height:40,objectFit:'cover',borderRadius:6,flexShrink:0}}/>}
      <label style={{cursor:'pointer'}}>
        <span className="btn btn-ghost btn-sm">{draft.thumbnail?'Change image':'Upload image'}</span>
        <input type="file" accept="image/*" style={{display:'none'}} onChange={function(e){
          var file=e.target.files&&e.target.files[0];
          if(!file)return;
          if(file.size>2*1024*1024){alert('Image must be under 2 MB.');return;}
          uploadImage(file).then(function(url){if(url)update({thumbnail:url});});
        }}/>
      </label>
      {draft.thumbnail&&<button className="btn-icon" onClick={function(){update({thumbnail:null});}}><span className="mi" style={{fontSize:16}}>delete</span></button>}
    </div>
  </div>
  <div className="edrawer-section">
    <span className="edrawer-lbl">Status</span>
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <StatusDotWithArchive draft={draft} app={app} showLabel={true}/>
    </div>
  </div>
  <div className="edrawer-section">
    <span className="edrawer-lbl">Nested under</span>
    <select value={draft.parentId||''} onChange={function(e){update({parentId:e.target.value||null});}}>
      <option value="">None (top level)</option>
      {parentOptions.map(function(d){return <option key={d.id} value={d.id}>{d.title||'Untitled'}</option>;})}
    </select>
  </div>
  <div className="edrawer-section">
    <span className="edrawer-lbl">Tagged Strands</span>
    <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:8}}>
      {taggedStrands.map(function(st){var bg=st.color+'26';return(
<span key={st.id} className="chip" style={{background:bg,color:st.color,borderColor:st.color+'55',borderWidth:1,borderStyle:'solid',cursor:'pointer'}} onClick={function(){onOpenStrandDetail&&onOpenStrandDetail(st.id);}}>
  {st.name}
  <span style={{marginLeft:3,opacity:.6,fontSize:11}} onClick={function(e){e.stopPropagation();removeStrand(st.id);}}>×</span>
</span>
      );})}
      <div style={{position:'relative'}}>
        <span className="chip" style={{background:'var(--bg3)',color:'var(--mid)',borderColor:'var(--border)',borderWidth:1,borderStyle:'solid',cursor:'pointer'}} onClick={function(){setAddChipOpen(!addChipOpen);}}>
          <span className="mi" style={{fontSize:14}}>add</span>
        </span>
        {addChipOpen&&untaggedStrands.length>0&&(
<div style={{position:'absolute',top:'calc(100% + 4px)',left:0,zIndex:50,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--r)',boxShadow:'0 4px 16px rgba(0,0,0,.4)',minWidth:180,maxHeight:200,overflowY:'auto'}}>
  {untaggedStrands.map(function(st){return(
<div key={st.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 10px',cursor:'pointer',fontSize:13}} onClick={function(){addStrand(st.id);}} onMouseOver={function(e){e.currentTarget.style.background='var(--bg3)';}} onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <div style={{width:8,height:8,borderRadius:'50%',background:st.color}}/>
  <span>{st.name}</span>
  <span style={{fontSize:11,color:'var(--mid)',marginLeft:'auto'}}>{st.collectionName}</span>
</div>
  );})}
  {untaggedStrands.length===0&&<div style={{padding:'8px 10px',fontSize:13,color:'var(--mid)'}}>All strands tagged.</div>}
</div>
        )}
        {addChipOpen&&untaggedStrands.length===0&&<div/>}
      </div>
    </div>
    {allStrandsList.length===0&&<span style={{fontSize:12,color:'var(--mid)'}}>No strands yet. Go to the Strands view.</span>}
  </div>
  <div className="adv-toggle" onClick={function(){setAdvOpen(!advOpen);}}>
    <span className="mi" style={{fontSize:16}}>{advOpen?'expand_less':'expand_more'}</span>
    <span>Advanced</span>
  </div>
  {advOpen&&(
<div>
  <div className="edrawer-section">
    <span className="edrawer-lbl">POV</span>
    <select value={draft.pov||''} onChange={function(e){update({pov:e.target.value});}}>
      <option value="">None</option>
      {taggedStrands.map(function(st){return <option key={st.id} value={st.id}>{st.name}</option>;})}
    </select>
    {taggedStrands.length===0&&<div style={{fontSize:12,color:'var(--mid)',marginTop:4}}>Tag strands above to set POV.</div>}
  </div>
  {draftFieldDefs.map(function(f){var val=draft.customFields&&draft.customFields[f.id]?draft.customFields[f.id]:'';return(
<div key={f.id} className="edrawer-section">
  <span className="edrawer-lbl">{f.label}</span>
  <input defaultValue={val} placeholder={'Enter '+f.label.toLowerCase()+'...'} onBlur={function(e){var cf=Object.assign({},draft.customFields||{});cf[f.id]=e.target.value;update({customFields:cf});}}/>
</div>
  );})}
  <div className="edrawer-section">
    <span className="edrawer-lbl" style={{marginBottom:8}}>Custom draft fields</span>
    <AddFieldInline onAdd={function(name,type){app.addDraftFieldDef(app.projId,{id:genId(),label:name.trim(),type:type||'short_text'});}}/>
  </div>
</div>
  )}
</div>
  );
}

function StrandDetailDrawer({strandId,app,onClose}){
  var pid=app.projId;
  var projStrands=app.allStrands[pid]||{};
  var strand=null;var collName='';
  Object.keys(projStrands).forEach(function(c){(projStrands[c]||[]).forEach(function(st){if(st.id===strandId){strand=st;collName=c;}});});
  if(!strand)return null;
  var tpl=(app.allTemplates[pid]||[]).find(function(t){return t.id===strand.templateId;})||null;
  var fields=tpl?tpl.fields:[];
  function updateField(fieldId,val){
    var nf=Object.assign({},strand.fields||{});nf[fieldId]=val;
    app.updateStrand(pid,collName,strandId,{fields:nf});
  }
  return(
<div className="editor-drawer">
  <div className="edrawer-hdr">
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <div style={{width:24,height:24,borderRadius:'50%',background:strand.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,color:'#fff',flexShrink:0}}>{initials(strand.name)}</div>
      <input style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,background:'transparent',border:'none',flex:1,padding:0,outline:'none',color:'var(--text)'}} defaultValue={strand.name} placeholder="Strand name" onBlur={function(e){if(e.target.value.trim())app.updateStrand(pid,collName,selectedStrandId,{name:e.target.value.trim()});}} onFocus={function(e){e.target.style.borderBottom='1px solid var(--indigo)';}} onBlurCapture={function(e){e.target.style.borderBottom='none';}}/>
    </div>
    <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
  </div>
  <div style={{padding:'12px 14px',flex:1,overflowY:'auto'}}>
    <div style={{fontSize:11,color:'var(--mid)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600}}>{collName}</div>
    {fields.map(function(f){var val=(strand.fields&&strand.fields[f.id])||'';return(
<div key={f.id} style={{marginBottom:12}}>
  <span className="edrawer-lbl">{f.label}</span>
  {f.type==='long_text'
    ?<textarea defaultValue={val} rows={3} placeholder={'Add '+f.label.toLowerCase()+'...'} onBlur={function(e){updateField(f.id,e.target.value);}} style={{fontSize:13}}/>
    :<input defaultValue={val} placeholder={'Add '+f.label.toLowerCase()+'...'} onBlur={function(e){updateField(f.id,e.target.value);}} style={{fontSize:13}}/>
  }
</div>
    );})}
  </div>
</div>
  );
}

function StrandsDropdown({allStrandsList,onSelect,onCreateNew}){
  return(
<div className="float-strand-drop" style={{display:'flex',flexDirection:'column'}}>
  <div style={{flex:1,overflowY:'auto',maxHeight:160}}>
    {allStrandsList.map(function(st){return(
<div key={st.id} className="float-strand-item" onMouseDown={function(e){e.preventDefault();onSelect(st);}}>
  <div style={{width:10,height:10,borderRadius:'50%',background:st.color,flexShrink:0}}/>
  <span>{st.name}</span>
  <span style={{fontSize:11,color:'var(--mid)',marginLeft:'auto'}}>{st.collectionName}</span>
</div>
    );})}
    {allStrandsList.length===0&&<div style={{padding:'8px 10px',fontSize:12,color:'var(--mid)'}}>No strands yet.</div>}
  </div>
  <div className="float-strand-new" style={{borderTop:'1px solid var(--border)',flexShrink:0}} onMouseDown={function(e){e.preventDefault();onCreateNew();}}>
    <span className="mi" style={{fontSize:16}}>add</span>New strand...
  </div>
</div>
  );
}

function EditorStrandsPanel({draft,app,onClose,onOpenStrand}){
  var projStrands=app.allStrands[app.projId]||{};
  var taggedIds=draft.strandTags||[];
  var tagged=[];var untagged=[];
  Object.keys(projStrands).forEach(function(c){
    (projStrands[c]||[]).forEach(function(st){
      if(taggedIds.includes(st.id)) tagged.push(Object.assign({},st,{collectionName:c}));
      else untagged.push(Object.assign({},st,{collectionName:c}));
    });
  });
  var ssi=useState(null);var selectedStrandId=ssi[0];var setSelectedStrandId=ssi[1];
  var ssa=useState(false);var showAvatarEdit=ssa[0];var setShowAvatarEdit=ssa[1];
  // If a strand is selected, show its detail inline
  if(selectedStrandId){
    var pid=app.projId;
    var projS=app.allStrands[pid]||{};
    var strand=null;var collName='';
    Object.keys(projS).forEach(function(c){(projS[c]||[]).forEach(function(st){if(st.id===selectedStrandId){strand=st;collName=c;}});});
    if(!strand){setSelectedStrandId(null);return null;}
    var tpl=(app.allTemplates[pid]||[]).find(function(t){return t.id===strand.templateId;})||(app.allTemplates[pid]||[]).find(function(t){return t.name===collName;})||null;
    var fields=tpl&&tpl.fields&&tpl.fields.length>0?tpl.fields:defaultFields(collName);
    function updateField(fid,val){var nf=Object.assign({},strand.fields||{});nf[fid]=val;app.updateStrand(pid,collName,selectedStrandId,{fields:nf});}
    return(
<div className="editor-drawer">
  <div className="edrawer-hdr">
    <div style={{display:'flex',alignItems:'center',gap:6}}>
      <button className="btn-icon" onClick={function(){setSelectedStrandId(null);setShowAvatarEdit(false);}}><span className="mi" style={{fontSize:18}}>arrow_back</span></button>
      <div style={{width:24,height:24,borderRadius:'50%',background:strand.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:600,color:'#fff',flexShrink:0,cursor:'pointer',overflow:'hidden'}} onClick={function(){setShowAvatarEdit(true);}}>
        {strand.image?<img src={strand.image} alt={strand.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:strand.emoji?<span style={{fontSize:14}}>{strand.emoji}</span>:initials(strand.name)}
      </div>
      <span className="edrawer-title" spellCheck={false}>{strand.name}</span>
    </div>
    <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
  </div>
  <div style={{padding:'12px 14px',flex:1,overflowY:'auto'}}>
    <div style={{fontSize:11,color:'var(--mid)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.06em',fontWeight:600}}>{collName}</div>
    {fields.map(function(f){var val=(strand.fields&&strand.fields[f.id])||'';return(
<div key={f.id} style={{marginBottom:12}}>
  <span className="edrawer-lbl">{f.label}</span>
  {f.type==='long_text'
    ?<textarea defaultValue={val} rows={3} placeholder={'Add '+f.label.toLowerCase()+'...'} onBlur={function(e){updateField(f.id,e.target.value);}} style={{fontSize:13}}/>
    :<input defaultValue={val} placeholder={'Add '+f.label.toLowerCase()+'...'} onBlur={function(e){updateField(f.id,e.target.value);}} style={{fontSize:13}}/>
  }
</div>
    );})}
  </div>
  {showAvatarEdit&&<AvatarEditModal strand={strand} onClose={function(){setShowAvatarEdit(false);}} onSave={function(updates){app.updateStrand(pid,collName,selectedStrandId,updates);setShowAvatarEdit(false);}}/>}
</div>
    );
  }
  return(
<div className="editor-drawer">
  <div className="edrawer-hdr">
    <span className="edrawer-title">Strands</span>
    <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
  </div>
  {tagged.length===0&&(
<div style={{padding:'12px 14px',fontSize:13,color:'var(--mid)'}}>
  No strands tagged yet. Tap a strand below to add it to this draft.
</div>
  )}
  {tagged.map(function(st){return(
<div key={st.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={function(){setSelectedStrandId(st.id);}}>
  <div style={{width:28,height:28,borderRadius:'50%',background:st.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'#fff',flexShrink:0,overflow:'hidden'}}>
    {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:st.emoji?<span style={{fontSize:16}}>{st.emoji}</span>:initials(st.name)}
  </div>
  <div style={{flex:1,minWidth:0}}>
    <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)'}}>{st.name}</div>
    <div style={{fontSize:11,color:'var(--mid)'}}>{st.collectionName}</div>
  </div>
  <span className="mi" style={{fontSize:16,color:'var(--border)'}}>chevron_right</span>
</div>
  );})}
  {untagged.length>0&&(
<div>
  <div style={{padding:'8px 14px 4px',fontSize:10,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.06em',borderTop:'1px solid var(--border)'}}>Add strands</div>
  {untagged.map(function(st){return(
<div key={st.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={function(){var tags=draft.strandTags||[];if(!tags.includes(st.id))app.updateDraft(app.projId,draft.id,{strandTags:tags.concat([st.id])});}}>
  <div style={{width:28,height:28,borderRadius:'50%',background:st.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:600,color:'#fff',flexShrink:0,overflow:'hidden'}}>
    {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:st.emoji?<span style={{fontSize:16}}>{st.emoji}</span>:initials(st.name)}
  </div>
  <div style={{flex:1,minWidth:0}}>
    <div style={{fontFamily:'var(--serif)',fontSize:14,color:'var(--mid)'}}>{st.name}</div>
    <div style={{fontSize:11,color:'var(--placeholder)'}}>{st.collectionName}</div>
  </div>
  <span className="mi" style={{fontSize:16,color:'var(--teal)'}}>add_circle_outline</span>
</div>
  );})}
</div>
  )}
</div>
  );
}



// ── VersionHistoryPanel ──
function VersionHistoryPanel({draftId,onRestore,onClose}){
  var snapshots=loadSnapshots(draftId);
  var sp=useState(null);var preview=sp[0];var setPreview=sp[1];
  return(
<Panel open={true} onClose={onClose} title="Version History">
  <div>
    {snapshots.length===0&&<div style={{padding:16,fontSize:13,color:'var(--mid)',textAlign:'center'}}>No history yet — saves hourly while you write.</div>}
    {snapshots.map(function(snap){var labelMap={'session-end':'Session end','auto':'Autosave'};var isStatus=snap.label&&snap.label.startsWith('status:');var labelText=isStatus?'Status change':labelMap[snap.label]||snap.label;var isActive=preview&&preview.id===snap.id;return(
<div key={snap.id} style={{borderBottom:'1px solid var(--border)'}}>
  <div onClick={function(){setPreview(isActive?null:snap);}} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',cursor:'pointer'}}>
    <div style={{flex:1}}><div style={{fontSize:13,fontWeight:600,color:'var(--text)'}}>{formatSnapshotTime(snap.ts)}</div><div style={{fontSize:11,color:'var(--mid)'}}>{labelText} · {snap.wordCount||0}w</div></div>
    <span className="mi" style={{fontSize:16,color:isActive?'var(--indigo)':'var(--mid)',transform:isActive?'rotate(90deg)':'none',transition:'transform .15s'}}>chevron_right</span>
  </div>
  {isActive&&(<div style={{paddingBottom:12}}>
    <div style={{fontFamily:'var(--serif)',fontSize:15,lineHeight:1.8,color:'var(--body-text)',maxHeight:200,overflowY:'auto',padding:'8px 0',borderTop:'1px solid var(--border)',marginBottom:8,borderBottom:'2px solid var(--bg3)',WebkitMaskImage:'linear-gradient(to bottom, black 80%, transparent 100%)',maskImage:'linear-gradient(to bottom, black 80%, transparent 100%)'}} dangerouslySetInnerHTML={{__html:snap.body}}/>
    <button className="btn btn-primary btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={function(){if(window.confirm('Restore this version?'))onRestore(snap.body);}}>Restore this version</button>
  </div>)}
</div>
    );})}
  </div>
</Panel>
  );
}

// ── ShareExportDropdown ──
function ShareExportDropdown({pos,draft,app,editorRef,flushSave,onClose}){
  var stab=useState('share');var tab=stab[0];var setTab=stab[1];
  var ssl=useState(null);var shareLink=ssl[0];var setShareLink=ssl[1];
  var sen=useState(true);var shareEnabled=sen[0];var setShareEnabled=sen[1];
  var scp=useState(false);var copied=scp[0];var setCopied=scp[1];
  var sld=useState(false);var loading=sld[0];var setLoading=sld[1];
  var sexp=useState(false);var exporting=sexp[0];var setExporting=sexp[1];
  var ref=useRef(null);
  useEffect(function(){
    function onDown(e){if(ref.current&&!ref.current.contains(e.target))onClose();}
    document.addEventListener('mousedown',onDown);
    return function(){document.removeEventListener('mousedown',onDown);};
  },[]);
  var sShareId=useState(null);var currentShareId=sShareId[0];var setCurrentShareId=sShareId[1];
  async function generateLink(){
    if(loading)return;
    setLoading(true);
    flushSave&&flushSave();
    var sid=genId();
    var profile=app.profile||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim();
    var projName=(app.currentProject&&app.currentProject.title)||'';
    var body=editorRef.current?editorRef.current.innerHTML:(draft.body||'');
    var res=await supabase.from('shared_drafts').insert({id:sid,title:draft.title||'Untitled',body:body,project_name:projName,author_name:authorName});
    if(res.error){setLoading(false);return;}
    var link=window.location.origin+window.location.pathname+'?share='+sid;
    setShareLink(link);setCurrentShareId(sid);setShareEnabled(true);setLoading(false);
  }
  async function disableLink(){
    if(currentShareId){
      await supabase.from('shared_drafts').delete().eq('id',currentShareId);
    }
    setShareEnabled(false);setShareLink(null);setCurrentShareId(null);setCopied(false);
  }
  function copyLink(){
    if(!shareLink||!shareEnabled)return;
    navigator.clipboard&&navigator.clipboard.writeText(shareLink);
    setCopied(true);setTimeout(function(){setCopied(false);},2500);
  }
  function handleExport(fmt){
    if(exporting)return;
    flushSave&&flushSave();
    setExporting(true);
    var profile=app.profile||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim();
    setTimeout(function(){
      doExport(fmt,[draft],app.currentProject,true,authorName);
      setExporting(false);
    },80);
  }
  return(
<div ref={ref} style={{position:'fixed',top:pos.top,left:pos.left,zIndex:500,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:'var(--rl)',boxShadow:'0 8px 28px rgba(42,31,16,.18)',width:280}}>
  {/* Tabs */}
  <div style={{display:'flex',borderBottom:'1px solid var(--border)'}}>
    {['share','export'].map(function(t){return(
<button key={t} onClick={function(){setTab(t);}} style={{flex:1,padding:'14px 10px',fontSize:14,fontWeight:tab===t?600:500,color:tab===t?'var(--indigo)':'var(--mid)',borderBottom:tab===t?'2px solid var(--indigo)':'2px solid transparent',background:'none',border:'none',borderBottom:tab===t?'2px solid var(--indigo)':'2px solid transparent',cursor:'pointer',fontFamily:'var(--ui)',textTransform:'capitalize',letterSpacing:'.01em'}}>
  {t==='share'?'Share Link':'Export'}
</button>
    );})}
  </div>
  <div style={{padding:'14px'}}>
    {tab==='share'&&(
<div>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
    <span style={{fontSize:13,color:'var(--text)',fontWeight:500}}>Read-only link</span>
    <span style={{width:36,height:20,borderRadius:10,background:shareEnabled?'var(--indigo)':'var(--bg3)',cursor:'pointer',position:'relative',transition:'all .2s',flexShrink:0,display:'inline-block'}} onClick={function(){if(shareEnabled)disableLink();else generateLink();}}>
      <span style={{position:'absolute',top:2,left:shareEnabled?18:2,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
    </span>
  </div>
  {!shareLink&&(
<button className="btn btn-ghost" style={{width:'100%',justifyContent:'center',opacity:shareEnabled?1:.4,pointerEvents:shareEnabled?'auto':'none'}} onClick={generateLink} disabled={loading}>
  {loading?<span style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:12,height:12,borderRadius:'50%',border:'2px solid var(--border)',borderTopColor:'var(--indigo)',animation:'spin .7s linear infinite',display:'inline-block'}}/> Generating...</span>:<span style={{display:'flex',alignItems:'center',gap:6}}><span className="mi" style={{fontSize:16}}>link</span>Generate link</span>}
</button>
  )}
  {shareLink&&(
<div>
  <div style={{background:'var(--bg2)',borderRadius:'var(--r)',padding:'8px 10px',fontSize:11,color:'var(--mid)',wordBreak:'break-all',marginBottom:8,fontFamily:'var(--mono)'}}>{shareLink}</div>
  <div style={{display:'flex',gap:6,marginBottom:8}}>
    <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={copyLink}>
      {copied?<span style={{display:'flex',alignItems:'center',gap:6}}><span className="mi" style={{fontSize:16}}>check_circle</span>Copied!</span>:<span style={{display:'flex',alignItems:'center',gap:6}}><span className="mi" style={{fontSize:16}}>content_copy</span>Copy link</span>}
    </button>
    <button className="btn btn-ghost btn-sm" onClick={generateLink} title="Regenerate with latest draft content" disabled={loading}>
      <span className="mi" style={{fontSize:16}}>refresh</span>
    </button>
  </div>
  <div style={{fontSize:11,color:'var(--mid)',padding:'8px 10px',background:'var(--bg2)',borderRadius:'var(--r)',lineHeight:1.5}}>
    <span className="mi" style={{fontSize:13,verticalAlign:'middle',marginRight:4}}>info</span>
    This is a snapshot of your draft. Refresh to share your latest changes.
  </div>
</div>
  )}
  {!shareLink&&<div style={{fontSize:11,color:'var(--placeholder)',marginTop:10}}>Anyone with the link can read this draft. No account needed.</div>}
</div>
    )}
    {tab==='export'&&(
<div style={{display:'flex',flexDirection:'column',gap:8}}>
  <button className="btn btn-ghost" style={{justifyContent:'flex-start',gap:10}} onClick={function(){handleExport('PDF');}} disabled={exporting}>
    <span className="mi" style={{fontSize:18,color:'var(--mid)'}}>picture_as_pdf</span>
    <span style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>PDF</span>
  </button>
  <button className="btn btn-ghost" style={{justifyContent:'flex-start',gap:10}} onClick={function(){handleExport('Word (.docx)');}} disabled={exporting}>
    <span className="mi" style={{fontSize:18,color:'var(--mid)'}}>description</span>
    <span style={{fontSize:13,fontWeight:500,color:'var(--text)'}}>Word Document</span>
  </button>
  {exporting&&<div style={{fontSize:12,color:'var(--mid)',textAlign:'center',padding:'4px 0'}}>Preparing download...</div>}
</div>
    )}
  </div>
</div>
  );
}

function EditorView({app}){
  var pid=app.projId;var did=app.draftId;
  var draft=(app.allDrafts[pid]||[]).find(function(d){return d.id===did;})||null;
  var mode=(app.profile&&app.profile.editorMode)||'rt';
  var sp=useState(false);var showProps=sp[0];var setShowProps=sp[1];
  var ssd=useState(null);var strandDetailId=ssd[0];var setStrandDetailId=ssd[1];
  var sstr=useState(false);var showStrands=sstr[0];var setShowStrands=sstr[1];
  var swc=useState(draft?(draft.wordCount||0):0);var wc=swc[0];var setWc=swc[1];
  var sz=useState(100);var zoom=sz[0];var setZoom=sz[1];
  var sft=useState(null);var floatToolbar=sft[0];var setFloatToolbar=sft[1];
  var ssd2=useState(false);var showStrandDrop=ssd2[0];var setShowStrandDrop=ssd2[1];
  var editorRef=useRef(null);var saveTimer=useRef(null);var lastDraftId=useRef(null);var sessionStartWc=useRef(0);
  var sst=useState('saved');var saveState=sst[0];var setSaveState=sst[1];
  var svh=useState(false);var showHistory=svh[0];var setShowHistory=svh[1];
  function handleRestoreVersion(body){if(editorRef.current)editorRef.current.innerHTML=body;setShowHistory(false);setSaveState('saving');scheduleSave(body,countWords(body));}
  var sst=useState('saved');var saveState=sst[0];var setSaveState=sst[1];
  var isMobile=useIsMobile();
  useEffect(function(){if(!draft)return;if(lastDraftId.current===draft.id)return;lastDraftId.current=draft.id;sessionStartWc.current=draft.wordCount||0;setWc(draft.wordCount||0);if(mode==='rt'&&editorRef.current)editorRef.current.innerHTML=draft.body||'';},[did]);
  // Only reset editor when mode changes (not on re-renders)
  var lastMode=useRef(mode);
  useEffect(function(){
    if(!draft)return;
    if(lastMode.current===mode)return;
    lastMode.current=mode;
    if(mode==='rt'&&editorRef.current)editorRef.current.innerHTML=draft.body||'';
  },[mode]);
  function flushSave(){
    if(!editorRef.current)return;
    if(saveTimer.current)clearTimeout(saveTimer.current);
    var html=editorRef.current.innerHTML;
    var newWc=countWords(editorRef.current.innerText||'');
    app.updateDraft(pid,did,{body:html,wordCount:newWc,updatedAt:new Date().toISOString()});
    var added=Math.max(0,newWc-sessionStartWc.current);
    if(added>0&&added<500){app.recordSession(pid,added);sessionStartWc.current=newWc;}
  }
  function scheduleSave(html,newWc){
    setSaveState('saving');
    if(saveTimer.current)clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(function(){
      app.updateDraft(pid,did,{body:html,wordCount:newWc,updatedAt:new Date().toISOString()});
      var added=Math.max(0,newWc-sessionStartWc.current);
      if(added>0&&added<500){app.recordSession(pid,added);sessionStartWc.current=newWc;}
      setSaveState('saved');
      saveSnapshot(did,html,newWc,'auto');
    },600);
  }
  function flushSave(){if(!editorRef.current)return;if(saveTimer.current)clearTimeout(saveTimer.current);var html=editorRef.current.innerHTML;var wc2=countWords(editorRef.current.innerText||'');app.updateDraft(pid,did,{body:html,wordCount:wc2,updatedAt:new Date().toISOString()});}
  function handleRTInput(){if(!editorRef.current)return;var text=editorRef.current.innerText||editorRef.current.textContent||'';var newWc=countWords(text);setWc(newWc);scheduleSave(editorRef.current.innerHTML,newWc);}
  function handlePaste(e){
    e.preventDefault();
    var html=e.clipboardData.getData('text/html');
    if(html){
      var cleaned=html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi,'')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'')
        .replace(/(<[a-z][^>]*?)\s+style="[^"]*"/gi,'$1')
        .replace(/(<[a-z][^>]*?)\s+class="[^"]*"/gi,'$1')
        .replace(/<font[^>]*>/gi,'').replace(/<\/font>/gi,'')
        .replace(/<span[^>]*>/gi,'').replace(/<\/span>/gi,'')
        .replace(/<div[^>]*>/gi,'<p>').replace(/<\/div>/gi,'</p>')
        .replace(/<!--[\s\S]*?-->/g,'');
      document.execCommand('insertHTML',false,cleaned);
      return;
    }
    var text=e.clipboardData.getData('text/plain');
    if(!text)return;
    var out=text.split('\n\n').map(function(para){
      return '<p>'+para.split('\n').join('<br>')+'</p>';
    }).join('');
    document.execCommand('insertHTML',false,out);
  }
  function handleMDChange(e){var newWc=countWords(e.target.value);setWc(newWc);scheduleSave(e.target.value,newWc);}
  function fmt(cmd,val){if(editorRef.current){editorRef.current.focus();document.execCommand(cmd,false,val||null);}}
  // Markdown shortcuts: "- " → bullet list, "1. " → numbered list
  function handleKeyDown(e){
    if(e.key==='Tab'){e.preventDefault();document.execCommand('insertText',false,'    ');return;}
    if(e.key!==' ')return;
    if(!editorRef.current)return;
    var sel=window.getSelection();
    if(!sel||!sel.rangeCount)return;
    var range=sel.getRangeAt(0);
    var node=range.startContainer;
    if(node.nodeType!==3)return;
    // Only trigger at very start of a block (entire text node is just the trigger)
    var fullText=node.textContent;
    var offset=range.startOffset;
    if(offset===1&&fullText==='-'){
      e.preventDefault();node.textContent='';document.execCommand('insertUnorderedList',false,null);
    } else if(offset===2&&fullText==='1.'){
      e.preventDefault();node.textContent='';document.execCommand('insertOrderedList',false,null);
    }
  }
  var sshare=useState(false);var shareOpen=sshare[0];var setShareOpen=sshare[1];
  var ssc=useState(null);var shareCopied=ssc[0];var setShareCopied=ssc[1];
  var ssharePos=useState({top:0,left:0});var sharePos=ssharePos[0];var setSharePos=ssharePos[1];

  var shareRef=useRef(null);
  useEffect(function(){if(!shareOpen)return;function onDown(e){if(shareRef.current&&!shareRef.current.contains(e.target))setShareOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[shareOpen]);
  function handleSelectionChange(){var sel=window.getSelection();if(!sel||sel.isCollapsed||!sel.rangeCount||!editorRef.current){setFloatToolbar(null);return;}try{var range=sel.getRangeAt(0);if(!editorRef.current.contains(range.commonAncestorContainer)){setFloatToolbar(null);return;}var rect=range.getBoundingClientRect();setFloatToolbar({top:rect.top-46,left:Math.max(4,rect.left+rect.width/2-100)});setShowStrandDrop(false);}catch(e){setFloatToolbar(null);}}
  useEffect(function(){document.addEventListener('selectionchange',handleSelectionChange);return function(){document.removeEventListener('selectionchange',handleSelectionChange);};},[]);
  var projStrands=app.allStrands[pid]||{};
  var allStrandsList=[];
  Object.keys(projStrands).forEach(function(c){(projStrands[c]||[]).forEach(function(st){allStrandsList.push(Object.assign({},st,{collectionName:c}));});});
  function tagStrand(st){var sel=window.getSelection();if(sel&&!sel.isCollapsed&&sel.rangeCount>0){var range=sel.getRangeAt(0);var mark=document.createElement('mark');mark.style.background=st.color+'33';mark.style.color=st.color;mark.style.borderRadius='3px';mark.style.padding='0 2px';mark.dataset.strandId=st.id;try{range.surroundContents(mark);}catch(e){}}var tags=draft.strandTags||[];if(!tags.includes(st.id))app.updateDraft(pid,did,{strandTags:tags.concat([st.id])});setShowStrandDrop(false);setFloatToolbar(null);}
  var sncp=useState(null);var newStrandPending=sncp[0];var setNewStrandPending=sncp[1];
  function createNewStrand(){
    var sel=window.getSelection();
    var selectedText=sel&&!sel.isCollapsed?sel.toString().trim():'';
    if(sel)sel.removeAllRanges();
    setNewStrandPending({name:selectedText||''});
    setShowStrandDrop(false);setFloatToolbar(null);
  }
  function confirmCreateStrand(coll,name){
    var tpl=(app.allTemplates[pid]||[]).find(function(t){return t.name===coll;})||null;
    var ns={id:genId(),templateId:tpl?tpl.id:'',collectionName:coll,name:name||'New Strand',color:PRESET_COLORS[Math.floor(Math.random()*PRESET_COLORS.length)],image:null,fields:{},createdAt:new Date().toISOString()};
    app.addStrand(pid,coll,ns);
    // Auto-tag the current draft
    var tags=draft.strandTags||[];
    if(!tags.includes(ns.id))app.updateDraft(pid,did,{strandTags:tags.concat([ns.id])});
    setNewStrandPending(null);
    setStrandDetailId(ns.id);setShowProps(false);
  }
  if(!draft){
    if(app.dataLoading){
      return(
<div style={{display:'flex',flexDirection:'column',flex:1,alignItems:'center',justifyContent:'center',gap:12}}>
  <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid var(--border)',borderTopColor:'var(--indigo)',animation:'spin 0.8s linear infinite'}}/>
  <div style={{color:'var(--mid)',fontSize:14}}>Loading your draft...</div>
  <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
</div>
      );
    }
    return(
<div style={{display:'flex',flexDirection:'column',flex:1,alignItems:'center',justifyContent:'center'}}>
  <div style={{color:'var(--mid)',marginBottom:12}}>This draft could not be loaded.</div>
  <button className="btn btn-ghost" onClick={function(){app.loadProjectData(app.projId);app.setView('cards');}}>Back to sequence</button>
</div>
    );
  }
  var bodyFontSize=Math.round(19*zoom/100);
  // Both props and strands can be open simultaneously on wide screens
  return(
<div className="editor-layout">
  <div className="editor-topbar">
    <div className="editor-topbar-row1">
      <button className="editor-back" onClick={function(){if(saveTimer.current)clearTimeout(saveTimer.current);if(editorRef.current){var html=editorRef.current.innerHTML;var wc=countWords(editorRef.current.innerText||'');app.updateDraft(pid,did,{body:html,wordCount:wc,updatedAt:new Date().toISOString()});}if(editorRef.current){var _html=editorRef.current.innerHTML;saveSnapshot(did,_html,countWords(editorRef.current.innerText||''),'session-end');}if(app.projId){app.setView('cards');app.setDraftId(null);}else{app.goBack();}}}><span className="mi">arrow_back</span></button>
      <input key={draft.id+'-et-'+draft.title} className="editor-title-inp" defaultValue={draft.title} placeholder="Untitled draft" onBlur={function(e){app.updateDraft(pid,did,{title:e.target.value,updatedAt:new Date().toISOString()});}}/>
    </div>
    <div className="editor-topbar-row2">
    <button className="btn btn-ghost btn-sm" title="Duplicate as nested draft" onClick={function(){app.duplicateDraft(pid,did);}}>
      <span className="mi" style={{fontSize:16}}>content_copy</span>
    </button>
    <button className="btn btn-ghost btn-sm" style={showProps?{borderColor:'var(--indigo)',color:'var(--indigo)'}:{}} onClick={function(){setShowProps(!showProps);setStrandDetailId(null);}}>Properties</button>
    <button className="btn btn-ghost btn-sm" onClick={function(){setShowHistory(true);}} title="Version history"><span className="mi" style={{fontSize:16}}>history</span></button>
    <button className="btn btn-ghost btn-sm" style={showStrands?{borderColor:'var(--indigo)',color:'var(--indigo)'}:{}} onClick={function(){setShowStrands(!showStrands);setStrandDetailId(null);}}>Strands</button>
    <div ref={shareRef} style={{position:'relative'}}>
      <button className="btn btn-ghost btn-sm" onClick={function(e){var r=e.currentTarget.getBoundingClientRect();setSharePos({top:r.bottom+4,left:r.right-280});setShareOpen(!shareOpen);}}>
        Share<span className="mi" style={{fontSize:14,marginLeft:2}}>arrow_drop_down</span>
      </button>
      {shareOpen&&(
<ShareExportDropdown
  pos={sharePos}
  draft={draft}
  app={app}
  editorRef={editorRef}
  flushSave={flushSave}
  onClose={function(){setShareOpen(false);}}
/>
      )}
    </div>
    </div>
  </div>
  <div className="editor-main">
    <div className="editor-center">
      {mode==='rt'?(
<div ref={editorRef} className="editor-body" contentEditable={true} suppressContentEditableWarning={true} data-placeholder="Start writing..." style={{fontSize:bodyFontSize,lineHeight:1.9}} onInput={handleRTInput} onKeyDown={handleKeyDown} onPaste={handlePaste} onFocus={function(){if(editorRef.current)editorRef.current.style.outline='none';}} onTouchEnd={function(e){e.currentTarget.focus();}}/>
      ):(
<textarea className="editor-md" defaultValue={stripHtml(draft.body||'')} onChange={handleMDChange} placeholder="Write in Markdown..."/>
      )}
    </div>
    {showProps&&!strandDetailId&&<PropertiesDrawer draft={draft} app={app} onClose={function(){setShowProps(false);}} onOpenStrandDetail={function(sid){setStrandDetailId(sid);}}/>}
    {strandDetailId&&<StrandDetailDrawer strandId={strandDetailId} app={app} onClose={function(){setStrandDetailId(null);}}/>}
    {showStrands&&!strandDetailId&&<EditorStrandsPanel draft={draft} app={app} onClose={function(){setShowStrands(false);}} onOpenStrand={function(sid){setStrandDetailId(sid);}}/>}
  </div>
  <div className="editor-bottombar">
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      <span>{wc} words</span>
      <span style={{display:'flex',alignItems:'center',gap:4,opacity:.7,transition:'opacity .3s'}}>
        {saveState==='saving'
          ?<><span style={{width:6,height:6,borderRadius:'50%',background:'var(--indigoL)',display:'inline-block',animation:'pulse 1s infinite'}}/>
            <span style={{fontSize:11}}>Saving...</span></>
          :<><span style={{width:6,height:6,borderRadius:'50%',background:'var(--teal)',display:'inline-block'}}/>
            <span style={{fontSize:11}}>Saved</span></>
        }
      </span>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:8}}>
      <span style={{fontSize:12}}>{zoom}%</span>
      <input type="range" min={70} max={150} step={10} value={zoom} onChange={function(e){setZoom(parseInt(e.target.value,10));}} style={{width:72}}/>
    </div>
  </div>
  {floatToolbar&&mode==='rt'&&(
<div className="float-toolbar" style={{top:floatToolbar.top,left:floatToolbar.left}}>
  <button className="float-btn" title="Bold" onMouseDown={function(e){e.preventDefault();fmt('bold');}}>B</button>
  <button className="float-btn" title="Italic" onMouseDown={function(e){e.preventDefault();fmt('italic');}} style={{fontStyle:'italic'}}>I</button>
  <button className="float-btn" title="Underline" onMouseDown={function(e){e.preventDefault();fmt('underline');}} style={{textDecoration:'underline'}}>U</button>
  <div className="float-sep"/>
  <button className="float-btn" onMouseDown={function(e){e.preventDefault();fmt('formatBlock','h1');}}>H1</button>
  <button className="float-btn" onMouseDown={function(e){e.preventDefault();fmt('formatBlock','h2');}}>H2</button>
  <button className="float-btn mi-btn" title="Link" onMouseDown={function(e){e.preventDefault();var url=prompt('Enter URL:');if(url)fmt('createLink',url);}}>link</button>
  <div className="float-sep"/>
  <button className="float-btn mi-btn" title="Bullet list" onMouseDown={function(e){e.preventDefault();document.execCommand('insertUnorderedList',false,null);}}>format_list_bulleted</button>
  <button className="float-btn mi-btn" title="Numbered list" onMouseDown={function(e){e.preventDefault();document.execCommand('insertOrderedList',false,null);}}>format_list_numbered</button>
  <div className="float-sep"/>
  <div style={{position:'relative'}}>
    <button className="float-btn mi-btn" title="Tag strand" onMouseDown={function(e){e.preventDefault();setShowStrandDrop(!showStrandDrop);}}>share</button>
    {showStrandDrop&&<StrandsDropdown allStrandsList={allStrandsList} onSelect={tagStrand} onCreateNew={createNewStrand}/>}
  </div>
</div>
  )}
  {showHistory&&<VersionHistoryPanel draftId={did} onClose={function(){setShowHistory(false);}} onRestore={handleRestoreVersion}/>}
  {newStrandPending&&(
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={function(){setNewStrandPending(null);}}/>
  <div className="modal-box" style={{maxWidth:360}}>
    <div style={{fontFamily:'var(--serif)',fontSize:18,fontWeight:600,marginBottom:16}}>Add to which collection?</div>
    <div style={{marginBottom:14}}>
      <span className="sect-lbl">Name</span>
      <input defaultValue={newStrandPending.name} placeholder="Strand name" id="new-strand-name-input" autoFocus style={{marginBottom:8}}/>
    </div>
    <div style={{display:'flex',flexDirection:'column',gap:6}}>
      {Object.keys(app.allStrands[pid]||{}).map(function(coll){return(
<button key={coll} className="btn btn-ghost" style={{justifyContent:'flex-start',gap:10}} onClick={function(){var nameEl=document.getElementById('new-strand-name-input');confirmCreateStrand(coll,nameEl?nameEl.value:newStrandPending.name);}}>
  <span className="mi" style={{fontSize:16,color:'var(--indigo)'}}>add</span>{coll}
</button>
      );})}
    </div>
    <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',marginTop:12}} onClick={function(){setNewStrandPending(null);}}>Cancel</button>
  </div>
</div>
  )}
</div>
  );
}



// ── CustomColorPicker ──
var SYSTEM_COLORS=['#c45e28','#e8a030','#2f9966','#2f76e0','#ce2fe0','#e02f79','#64e02f','#2fe07f'];
function CustomColorPicker({color,onSelect}){
  var sc=useState(false);var showCustom=sc[0];var setShowCustom=sc[1];
  var sh=useState('');var hexVal=sh[0];var setHexVal=sh[1];
  return(
<div>
  <div style={{display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
    {SYSTEM_COLORS.map(function(c){return(<div key={c} onClick={function(){onSelect(c);}} style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',transform:color===c?'scale(1.2)':'scale(1)',boxShadow:color===c?'0 0 0 2px var(--bg1),0 0 0 4px '+c:'none',flexShrink:0,transition:'transform .15s'}}/>);})}
    <div style={{width:28,height:28,borderRadius:'50%',background:'var(--bg2)',border:'2px dashed var(--border)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}} onClick={function(){setShowCustom(!showCustom);}}>
      <span className="mi" style={{fontSize:14,color:'var(--mid)'}}>add</span>
    </div>
  </div>
  {showCustom&&(<div style={{marginTop:10,display:'flex',gap:6,alignItems:'center'}}>
    <input value={hexVal} onChange={function(e){setHexVal(e.target.value);}} placeholder="#3a7bd5" style={{flex:1,fontSize:13,fontFamily:'var(--mono)'}}/>
    <div style={{width:24,height:24,borderRadius:'50%',background:hexVal.match(/^#[0-9a-f]{6}$/i)?hexVal:'var(--bg3)',border:'1px solid var(--border)'}}/>
    <button className="btn btn-primary btn-sm" onClick={function(){if(hexVal.match(/^#[0-9a-f]{6}$/i)){onSelect(hexVal);setShowCustom(false);}}}>Apply</button>
  </div>)}
</div>
  );
}
// ── EmojiPicker ──
var EMOJI_ROW=['👩','👨','🧑','🧙','🦸','🐉','👑','🔮','⚔️','🌲','🔥','💀','🌙','⭐','❄️','🌊','🗡️','📖','🎭','🌹'];
function EmojiPicker({emoji,onSelect}){
  var ss=useState(false);var showAll=ss[0];var setShowAll=ss[1];
  var sq=useState('');var query=sq[0];var setQuery=sq[1];
  var ALL=['👩','👨','🧑','👧','👦','🧓','👴','👵','🧙','🧚','🧛','🧜','🧝','🦸','🦹','🧟','👮','🤴','👸','🐉','🐺','🦅','⚔️','🗡️','🏰','🌲','🔥','💀','👑','🗺️','📜','🌙','⭐','🔮','💎','🌊','🌹','🕯️','⚡','🛡️','🗝️','🎭','📖','🌿','❄️'];
  return(
<div>
  <div style={{display:'flex',gap:4,alignItems:'center',flexWrap:'nowrap'}}>
    {EMOJI_ROW.map(function(em){return(<span key={em} onClick={function(){onSelect(em===emoji?null:em);}} style={{width:30,height:30,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,cursor:'pointer',background:emoji===em?'var(--bg4)':'var(--bg2)',border:emoji===em?'1px solid var(--indigo)':'1px solid var(--border)',flexShrink:0}}>{em}</span>);})}
    <span onClick={function(){setShowAll(!showAll);}} style={{width:30,height:30,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,cursor:'pointer',background:'var(--bg2)',border:'1px solid var(--border)',color:'var(--mid)',flexShrink:0}}>{showAll?'↑':'···'}</span>
    {emoji&&<button className="btn-icon" style={{padding:2}} onClick={function(){onSelect(null);}}><span className="mi" style={{fontSize:14}}>close</span></button>}
  </div>
  {showAll&&(<div style={{marginTop:8,background:'var(--bg2)',borderRadius:'var(--r)',padding:8}}>
    <input value={query} onChange={function(e){setQuery(e.target.value);}} placeholder="Type any emoji..." style={{marginBottom:8,fontSize:18}} autoFocus/>
    <div style={{display:'flex',flexWrap:'wrap',gap:3,maxHeight:100,overflowY:'auto'}}>
      {(query?[]:ALL).map(function(em){return(<span key={em} onClick={function(){onSelect(em);setShowAll(false);}} style={{width:30,height:30,borderRadius:5,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,cursor:'pointer',background:emoji===em?'var(--bg4)':'transparent'}}>{em}</span>);})}
      {query&&<span style={{fontSize:20,cursor:'pointer',padding:4}} onClick={function(){onSelect(query);setShowAll(false);}}>{query}</span>}
    </div>
  </div>)}
</div>
  );
}

// ── AvatarEditModal ──
var QUICK_EMOJIS=['👩','👨','🧑','👧','👦','🧓','👴','👵','🧙','🧚','🧛','🧜','🧝','🦸','🦹','🧟','👮','🕵️','💂','🧑‍⚕️','🧑‍🎓','🧑‍🏫','🧑‍🌾','🧑‍🍳','🧑‍🔧','🧑‍🎨','🧑‍✈️','🧑‍🚀','🤴','👸','🐉','🐺','🦅','⚔️','🗡️','🏰','🌲','🔥','💀','👑','🗺️','📜','🌙','⭐','🔮','💎','🌊','🌹','🕯️','⚡','🛡️','🗝️','🎭','📖','🌿','❄️'];

function AvatarEditModal({strand,onSave,onClose}){
  var sc=useState(strand.color||PRESET_COLORS[0]);var color=sc[0];var setColor=sc[1];
  var si=useState(strand.image||null);var image=si[0];var setImage=si[1];
  var se=useState(strand.emoji||null);var emoji=se[0];var setEmoji=se[1];
  function handleFile(e){var file=e.target.files&&e.target.files[0];if(!file)return;if(file.size>5*1024*1024){alert('Image must be under 5 MB.');return;}uploadImage(file).then(function(url){if(url)setImage(url);});}
  function handleSave(){onSave({color:color,image:image,emoji:emoji});}
  function autoSaveColor(c){setColor(c);onSave({color:c,image:image,emoji:emoji});}
  var sectionLbl={fontSize:11,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8,display:'block'};
  return(
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={onClose}/>
  <div className="modal-box" style={{width:380}}>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
      <div style={{fontFamily:'var(--serif)',fontSize:18,fontWeight:600}}>Edit appearance</div>
      <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
    </div>
    {/* Avatar circle with camera overlay */}
    <div style={{position:'relative',width:72,margin:'0 auto 16px',display:'flex',justifyContent:'center'}}>
      <div style={{width:72,height:72,borderRadius:'50%',background:color,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',boxShadow:'0 4px 12px rgba(0,0,0,.25)'}}>
        {image?<img src={image} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:emoji?<span style={{fontSize:30}}>{emoji}</span>:<span style={{fontFamily:'var(--serif)',fontSize:20,fontWeight:600,color:'#fff'}}>{initials(strand.name)}</span>}
      </div>
      <label style={{position:'absolute',bottom:0,right:0,cursor:'pointer'}}>
        <div style={{width:22,height:22,borderRadius:'50%',background:'var(--bg1)',border:'2px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <span className="mi" style={{fontSize:13,color:'var(--mid)'}}>photo_camera</span>
        </div>
        <input type="file" accept="image/*" style={{display:'none'}} onChange={handleFile}/>
      </label>
    </div>
    {image&&<div style={{textAlign:'center',marginBottom:10}}><button className="btn btn-ghost btn-sm" onClick={function(){setImage(null);}}><span className="mi" style={{fontSize:13}}>delete</span>Remove photo</button></div>}
    <div style={{marginBottom:14}}>
      <span style={sectionLbl}>Colour</span>
      <CustomColorPicker color={color} onSelect={autoSaveColor}/>
    </div>
    <div style={{marginBottom:14,paddingTop:12,borderTop:'1px solid var(--border)'}}>
      <span style={sectionLbl}>Emoji</span>
      <EmojiPicker emoji={emoji} onSelect={setEmoji}/>
    </div>
    <div style={{display:'flex',gap:8,paddingTop:12,borderTop:'1px solid var(--border)'}}>
      <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={handleSave}>Save</button>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
    </div>
  </div>
</div>
  );
}



// ── StrandSortFilter ──
function StrandSortFilter({sort,setSort,strandFilter,setStrandFilter,fields}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var sp=useState({top:0,left:0});var pos=sp[0];var setPos=sp[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  var hasActive=strandFilter||sort!=='name';
  return(
<div ref={ref} style={{position:'relative',flexShrink:0}}>
  <button className={'btn-icon'+(hasActive?' ':' ')} style={{padding:4,border:'1px solid '+(hasActive?'var(--indigo)':'var(--border)'),borderRadius:'var(--r)',color:hasActive?'var(--indigo)':'var(--mid)'}} onClick={function(e){var r=e.currentTarget.getBoundingClientRect();setPos({top:r.bottom+4,left:r.right-180});setOpen(!open);}}>
    <span className="mi" style={{fontSize:16}}>tune</span>
  </button>
  {open&&(
<div style={{position:'fixed',top:pos.top,left:pos.left,zIndex:400,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:'var(--rl)',boxShadow:'0 8px 28px rgba(42,31,16,.14)',minWidth:180,padding:10}}>
  <div style={{fontSize:11,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Sort</div>
  {[['name','Name A–Z'],['recent','Recently added']].map(function(o){return(
<div key={o[0]} style={{display:'flex',alignItems:'center',gap:8,padding:'5px 0',cursor:'pointer',fontSize:13,color:sort===o[0]?'var(--indigo)':'var(--text)',fontWeight:sort===o[0]?600:400}} onClick={function(){setSort(o[0]);}}>
  <span style={{width:14,height:14,borderRadius:'50%',border:'2px solid '+(sort===o[0]?'var(--indigo)':'var(--border)'),background:sort===o[0]?'var(--indigo)':'transparent',flexShrink:0}}/>
  {o[1]}
</div>
  );})}
  {(strandFilter||sort!=='name')&&<button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center',marginTop:8}} onClick={function(){setSort('name');setStrandFilter(null);}}>Clear</button>}
</div>
  )}
</div>
  );
}

// ── CollTab ──
function CollTab({coll,isActive,pid,app,activeColl,setActiveColl,setActiveStrandId,setSearch,setShowCollSettings}){
  var se=useState(false);var editing=se[0];var setEditing=se[1];
  var sv=useState(coll);var val=sv[0];var setVal=sv[1];
  function commitRename(){
    var nc=val.trim();
    if(nc&&nc!==coll){app.setAllStrands(function(prev){var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});ps[nc]=ps[coll]||[];delete ps[coll];n[pid]=ps;saveDB('woven:strands:'+pid,ps);return n;});if(activeColl===coll)setActiveColl(nc);}
    else{setVal(coll);}setEditing(false);
  }
  if(editing)return(<div className="strands-tab active" style={{padding:'0 4px'}}><input autoFocus value={val} onChange={function(e){setVal(e.target.value);}} onBlur={commitRename} onKeyDown={function(e){if(e.key==='Enter')commitRename();if(e.key==='Escape'){setVal(coll);setEditing(false);}}} style={{width:90,height:24,fontSize:13,padding:'2px 6px',borderRadius:4}}/></div>);
  return(<div className={'strands-tab'+(isActive?' active':'')} onClick={function(){setActiveColl(coll);setActiveStrandId(null);setSearch('');setShowCollSettings(false);}} onDoubleClick={function(){setEditing(true);}}>{coll}</div>);
}

// ── StrandsPage ──
function StrandsPage({app,allProjects}){
  var pid=app.projId;
  var projStrands=app.allStrands[pid]||{};
  var projTemplates=app.allTemplates[pid]||[];
  var collNames=Object.keys(projStrands);if(collNames.length===0)collNames=['Characters'];
  var sac=useState(collNames[0]);var activeColl=sac[0];var setActiveColl=sac[1];
  var sasi=useState(null);var activeStrandId=sasi[0];var setActiveStrandId=sasi[1];
  var ssc=useState('');var search=ssc[0];var setSearch=ssc[1];
  var sss=useState('name');var strandSort=sss[0];var setStrandSort=sss[1];
  var ssf=useState(null);var strandFilter=ssf[0];var setStrandFilter=ssf[1];
  var snc=useState(false);var newColl=snc[0];var setNewColl=snc[1];
  var sncn=useState('');var newCollName=sncn[0];var setNewCollName=sncn[1];
  var scs=useState(false);var showCollSettings=scs[0];var setShowCollSettings=scs[1];
  var isMobile=useIsMobile();
  var smdo=useState(false);var mobileDetailOpen=smdo[0];var setMobileDetailOpen=smdo[1];
  var savt=useState(false);var showAvatarEdit=savt[0];var setShowAvatarEdit=savt[1];
  var collStrands=projStrands[activeColl]||[];
  var filtered=(search?collStrands.filter(function(s){return s.name&&s.name.toLowerCase().includes(search.toLowerCase());}):collStrands)
    .filter(function(s){if(!strandFilter)return true;var val=s.fields&&s.fields[strandFilter.fieldId];return val&&val.toLowerCase().includes(strandFilter.value.toLowerCase());})
    .slice().sort(function(a,b){if(strandSort==='name')return (a.name||'').localeCompare(b.name||'');if(strandSort==='recent')return (b.createdAt||'').localeCompare(a.createdAt||'');return 0;});
  var activeStrand=activeStrandId?filtered.find(function(s){return s.id===activeStrandId;})||null:filtered.length>0?filtered[0]:null;
  function getTpl(coll){return projTemplates.find(function(t){return t.name===coll;})||null;}
  var activeTpl=getTpl(activeColl);
  var fields=activeTpl?activeTpl.fields:defaultFields(activeColl);
  function updateStrand(sid,changes){app.updateStrand(pid,activeColl,sid,changes);}
  function updateField(sid,fieldId,val){if(!activeStrand)return;var nf=Object.assign({},activeStrand.fields||{});nf[fieldId]=val;updateStrand(sid,{fields:nf});}
  function addStrand(){var tpl=getTpl(activeColl);var existing=(app.allStrands[pid]&&app.allStrands[pid][activeColl])||[];var base='New '+activeColl.replace(/s$/,'');var num=existing.filter(function(s){return s.name&&s.name.startsWith(base);}).length+1;var ns={id:genId(),templateId:tpl?tpl.id:'',collectionName:activeColl,name:base+' '+num,color:({"Characters":"#c45e28","Locations":"#2f9966","Plot Threads":"#2f76e0","Sources":"#ce2fe0","Interviews":"#e02f79","Subjects":"#e8a030","Scenes":"#64e02f","Topics":"#2fe07f","Lore & World":"#e8a030","Reports":"#b83220","Audience Notes":"#f0c050"}[activeColl])||PRESET_COLORS[Math.floor(Math.random()*PRESET_COLORS.length)],image:null,fields:{},createdAt:new Date().toISOString()};app.addStrand(pid,activeColl,ns);setActiveStrandId(ns.id);if(isMobile)setMobileDetailOpen(true);}
  function addCollection(){var name=newCollName.trim();if(!name)return;var nt={id:genId(),projectId:pid,name:name,fields:defaultFields(name),sharedWith:[]};app.addTemplate(pid,nt);app.setAllStrands(function(prev){var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});ps[name]=[];n[pid]=ps;saveDB('woven:strands:'+pid,ps);return n;});setActiveColl(name);setNewColl(false);setNewCollName('');}
  function handleImageUpload(e,sid){var file=e.target.files&&e.target.files[0];if(!file)return;uploadImage(file).then(function(url){if(url)updateStrand(sid,{image:url});});}
  function getDraftAppearances(sid){return(app.allDrafts[pid]||[]).filter(function(d){return(d.strandTags||[]).includes(sid);});}
  function renderFieldInput(f,sid,val){
    if(f.type==='long_text')return <textarea key={sid+'-'+f.id} defaultValue={val} placeholder={'Enter '+f.label.toLowerCase()+'...'} rows={3} onBlur={function(e){updateField(sid,f.id,e.target.value);}}/>;
    if(f.type==='boolean')return(
<div style={{display:'flex',gap:14}}>
  {['Yes','No'].map(function(opt){return(
<label key={opt} style={{display:'flex',alignItems:'center',gap:5,cursor:'pointer',fontSize:14}}>
  <input type="radio" name={sid+'-'+f.id} value={opt} defaultChecked={val===opt} onChange={function(){updateField(sid,f.id,opt);}} style={{width:'auto'}}/>{opt}
</label>
  );})}
</div>
    );
    if(f.type==='select')return(<select key={sid+'-'+f.id} defaultValue={val} onChange={function(e){updateField(sid,f.id,e.target.value);}}><option value="">Select...</option>{(f.options||[]).map(function(o){return <option key={o} value={o}>{o}</option>;})}</select>);
    return <input key={sid+'-'+f.id} defaultValue={val} placeholder={'Enter '+f.label.toLowerCase()+'...'} type={f.type==='number'?'number':'text'} onBlur={function(e){updateField(sid,f.id,e.target.value);}}/>;
  }
  // Collection settings editing
  var sef=useState(null);var editingFields=sef[0];var setEditingFields=sef[1];
  var snfn=useState('');var newFieldName=snfn[0];var setNewFieldName=snfn[1];
  var snft=useState('short_text');var newFieldType=snft[0];var setNewFieldType=snft[1];
  var ssw=useState([]);var sharedWith=ssw[0];var setSharedWith=ssw[1];
  function openCollSettings(){setEditingFields(activeTpl?[...activeTpl.fields]:[]);setSharedWith(activeTpl?activeTpl.sharedWith||[]:[]);setShowCollSettings(true);}
  var sdc=useState(false);var deleteCollConfirm=sdc[0];var setDeleteCollConfirm=sdc[1];
  function deleteCollection(){
    if(!activeTpl)return;
    // Remove template and strands for this collection
    app.updateTemplate(pid,activeTpl.id,{deleted:true});
    app.setAllStrands(function(prev){var next=Object.assign({},prev);var ps=Object.assign({},next[pid]||{});delete ps[activeColl];next[pid]=ps;saveDB('woven:strands:'+pid,ps);return next;});
    var remaining=collNames.filter(function(c){return c!==activeColl;});
    if(remaining.length>0)setActiveColl(remaining[0]);
    setShowCollSettings(false);setDeleteCollConfirm(false);
  }
  function saveCollSettings(){if(!activeTpl)return;app.updateTemplate(pid,activeTpl.id,{fields:editingFields,sharedWith:sharedWith});setShowCollSettings(false);}
  function addFieldToSettings(){if(!newFieldName.trim()||!editingFields)return;setEditingFields(editingFields.concat([{id:genId(),label:newFieldName.trim(),type:newFieldType}]));setNewFieldName('');}
  var otherProjects=allProjects.filter(function(p){return p.id!==pid;});
  var sco2=useState(null);var dragOverColl=sco2[0];var setDragOverColl=sco2[1];
  function reorderColls(fromColl,toColl){
    if(fromColl===toColl)return;
    app.setAllStrands(function(prev){
      var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});
      var keys=Object.keys(ps);
      var fi=keys.indexOf(fromColl);var ti=keys.indexOf(toColl);
      if(fi<0||ti<0)return prev;
      keys.splice(fi,1);keys.splice(ti,0,fromColl);
      var reordered={};keys.forEach(function(k){reordered[k]=ps[k];});
      n[pid]=reordered;saveDB('woven:strands:'+pid,reordered);return n;
    });
  }
  var detailContent=showCollSettings&&editingFields?(
<div style={{padding:24}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
    <div style={{fontFamily:'var(--serif)',fontSize:20,fontWeight:600}}>{activeColl} — Fields</div>
    <div style={{display:'flex',gap:8}}>
      <button className="btn btn-danger btn-sm" onClick={function(){setDeleteCollConfirm(true);}}><span className="mi" style={{fontSize:14}}>delete</span>Delete</button>
      <button className="btn btn-ghost btn-sm" onClick={function(){setShowCollSettings(false);}}>Cancel</button>
      <button className="btn btn-primary btn-sm" onClick={saveCollSettings}>Save</button>
    </div>
  </div>
  {deleteCollConfirm&&(
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={function(){setDeleteCollConfirm(false);}}/>
  <div className="modal-box" style={{maxWidth:400}}>
    <div style={{fontFamily:'var(--serif)',fontSize:20,fontWeight:600,marginBottom:12}}>Delete "{activeColl}"?</div>
    <div style={{fontSize:14,color:'var(--body-text)',lineHeight:1.6,marginBottom:8}}>This will permanently delete the collection and all <strong>{(app.allStrands[pid]&&app.allStrands[pid][activeColl]?app.allStrands[pid][activeColl].length:0)}</strong> strands inside it.</div>
    <div style={{fontSize:13,color:'var(--mid)',marginBottom:20}}>This cannot be undone.</div>
    <div style={{display:'flex',gap:8}}>
      <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={function(){setDeleteCollConfirm(false);}}>Cancel</button>
      <button className="btn btn-danger" style={{flex:1,justifyContent:'center'}} onClick={deleteCollection}><span className="mi" style={{fontSize:16}}>delete</span>Delete collection</button>
    </div>
  </div>
</div>
  )}
  {editingFields.map(function(f,i){return(
<div key={f.id} className="field-edit-row" draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('fieldIdx',''+i);}}
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){e.preventDefault();var from=parseInt(e.dataTransfer.getData('fieldIdx'),10);if(isNaN(from)||from===i)return;var nf=editingFields.slice();var item=nf.splice(from,1)[0];nf.splice(i,0,item);setEditingFields(nf);}}>
  <span className="mi" style={{fontSize:18,color:'var(--border)',cursor:'grab',flexShrink:0}}>drag_indicator</span>
  <input defaultValue={f.label} style={{maxWidth:160,fontSize:13}} onBlur={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{label:e.target.value});setEditingFields(nf);}}/>
  <select value={f.type} style={{width:110,fontSize:13}} onChange={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{type:e.target.value});setEditingFields(nf);}}>
    {FIELD_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.label}</option>;})}
  </select>
  <button className="btn-icon" onClick={function(){setEditingFields(editingFields.filter(function(_,j){return j!==i;}));}}><span className="mi" style={{fontSize:18}}>delete</span></button>
</div>
  );})}
  <div style={{display:'flex',gap:8,marginTop:12,marginBottom:24}}>
    <input value={newFieldName} onChange={function(e){setNewFieldName(e.target.value);}} placeholder="New field name" onKeyDown={function(e){if(e.key==='Enter')addFieldToSettings();}} style={{flex:1}}/>
    <select value={newFieldType} onChange={function(e){setNewFieldType(e.target.value);}} style={{width:110}}>{FIELD_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.label}</option>;})}</select>
    <button className="btn btn-ghost btn-sm" onClick={addFieldToSettings}>Add</button>
  </div>
  <div style={{paddingTop:16,borderTop:'1px solid var(--border)'}}>
    <span className="sect-lbl">Share across projects</span>
    {otherProjects.length===0
      ?<div style={{fontSize:13,color:'var(--placeholder)'}}>No other projects to share with.</div>
      :<div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>        {otherProjects.map(function(p){var checked=sharedWith.includes(p.id);return(
<label key={p.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,color:'var(--text)'}}>
  <span style={{width:18,height:18,borderRadius:4,border:'1px solid '+(checked?'var(--indigo)':'var(--border)'),background:checked?'var(--indigo)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}} onClick={function(){setSharedWith(checked?sharedWith.filter(function(id){return id!==p.id;}):sharedWith.concat([p.id]));}}>
    {checked&&<span className="mi" style={{fontSize:13,color:'#fff'}}>check</span>}
  </span>
  {p.title}
</label>
        );})}
      </div>
    }
  </div>
</div>
  ):activeStrand?(
<div style={{padding:24,backgroundImage:'radial-gradient(circle, rgba(160,120,70,0.12) 1px, transparent 1px)',backgroundSize:'22px 22px'}}>
  <div className="strand-detail-hdr" style={{alignItems:'center'}}>
    <div className="strand-av-wrap" style={{background:activeStrand.color}} onClick={function(){setShowAvatarEdit(true);}}>
      <div className="strand-av-overlay"><span className="mi" style={{fontSize:18,color:'#fff'}}>edit</span></div>
      {activeStrand.image
        ?<img src={activeStrand.image} alt={activeStrand.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        :activeStrand.emoji
          ?<span style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>{activeStrand.emoji}</span>
          :<span style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:600,color:'#fff',fontFamily:'var(--serif)'}}>{initials(activeStrand.name)}</span>
      }
    </div>
    <div style={{flex:1}}>
      <input key={activeStrand.id+'-n'} className="strand-name-inp" defaultValue={activeStrand.name} placeholder="Name" spellCheck={false} onBlur={function(e){updateStrand(activeStrand.id,{name:e.target.value});}}/>
    </div>
  </div>
  {showAvatarEdit&&<AvatarEditModal strand={activeStrand} onClose={function(){setShowAvatarEdit(false);}} onSave={function(updates){updateStrand(activeStrand.id,updates);setShowAvatarEdit(false);}}/>}
  {fields.map(function(f){var val=activeStrand.fields&&activeStrand.fields[f.id]?activeStrand.fields[f.id]:'';return(
<div key={f.id} className="strand-field-row">
  <span className="edrawer-lbl">{f.label}</span>
  {renderFieldInput(f,activeStrand.id,val)}
</div>
  );})}
  <div className="appears-section">
    <span className="edrawer-lbl">Appears In</span>
    <div className="appears-chips">
      {getDraftAppearances(activeStrand.id).map(function(d){return <span key={d.id} className="appears-chip" onClick={function(){app.openDraft(d.id);}}>{d.title||'Untitled'}</span>;})}
      {getDraftAppearances(activeStrand.id).length===0&&<span style={{fontSize:13,color:'var(--mid)'}}>Not tagged in any drafts yet.</span>}
    </div>
  </div>
</div>
  ):(
<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,gap:12,color:'var(--mid)',textAlign:'center',padding:32}}>
  <span className="mi" style={{fontSize:40,color:'var(--border)'}}>auto_awesome</span>
  <div style={{fontFamily:'var(--serif)',fontSize:20,color:'var(--mid)'}}>{activeColl}</div>
  <div style={{fontSize:13,color:'var(--placeholder)',marginBottom:4}}>No entries yet</div>
  <button className="btn btn-primary" onClick={addStrand}>+ Add {activeColl.replace(/s$/,'')}</button>
</div>
  );
  return(
<div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
  <div className="strands-subnav">
    {collNames.map(function(coll){return(
<div key={coll} draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('collName',coll);}}
  onDragOver={function(e){e.preventDefault();setDragOverColl(coll);}}
  onDragLeave={function(){setDragOverColl(null);}}
  onDrop={function(e){e.preventDefault();var from=e.dataTransfer.getData('collName');reorderColls(from,coll);setDragOverColl(null);}}
  style={{borderLeft:dragOverColl===coll?'2px solid var(--indigo)':'2px solid transparent'}}>
  <CollTab coll={coll} isActive={activeColl===coll} pid={pid} app={app} activeColl={activeColl} setActiveColl={setActiveColl} setActiveStrandId={setActiveStrandId} setSearch={setSearch} setShowCollSettings={setShowCollSettings}/>
</div>
    );})}
    {newColl?(
<div style={{display:'flex',alignItems:'center',gap:4}}>
  <input autoFocus value={newCollName} onChange={function(e){setNewCollName(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter')addCollection();if(e.key==='Escape'){setNewColl(false);setNewCollName('');}}} placeholder="Name" style={{width:100,height:30,fontSize:13}}/>
  <button style={{fontSize:13,color:'var(--teal)'}} onClick={addCollection}>ok</button>
</div>
    ):(
<div style={{display:'flex',alignItems:'center',gap:4,marginLeft:'auto'}}>
  <button className="btn-icon" onClick={openCollSettings} title="Collection settings"><span className="mi" style={{fontSize:18}}>settings</span></button>
  <button className="btn btn-ghost btn-sm" onClick={function(){setNewColl(true);}}>+ Add collection</button>
</div>
    )}
  </div>
  <div className="strands-layout">
    <div className="strands-left">
      <div className="strands-list">
        <div style={{marginBottom:8,display:'flex',gap:4}}>
          <input placeholder={'Search '+activeColl+'...'} value={search} onChange={function(e){setSearch(e.target.value);}} style={{flex:1}}/>
          <StrandSortFilter sort={strandSort} setSort={setStrandSort} strandFilter={strandFilter} setStrandFilter={setStrandFilter} fields={fields}/>
        </div>
        
        {filtered.map(function(st){var isAct=activeStrand&&st.id===activeStrand.id;return(
<div key={st.id} className={'strand-item'+(isAct?' active':'')} style={{justifyContent:'space-between'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0,cursor:'pointer'}} onClick={function(){setActiveStrandId(st.id);setShowCollSettings(false);if(isMobile)setMobileDetailOpen(true);}}>
    <div className="strand-av" style={{background:st.color,flexShrink:0}}>
      {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:st.emoji?<span style={{fontSize:14}}>{st.emoji}</span>:<span>{initials(st.name)}</span>}
    </div>
    <span style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{st.name||'Unnamed'}</span>
  </div>
  <button className="btn-icon" style={{padding:2,opacity:0,flexShrink:0}} title="Delete strand"
    onMouseOver={function(e){e.currentTarget.style.opacity='1';}}
    onMouseOut={function(e){e.currentTarget.style.opacity='0';}}
    onClick={function(e){e.stopPropagation();if(window.confirm('Delete "'+( st.name||'Unnamed')+'"? This cannot be undone.')){
      app.setAllStrands(function(prev){var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});ps[activeColl]=(ps[activeColl]||[]).filter(function(s){return s.id!==st.id;});n[pid]=ps;saveDB('woven:strands:'+pid,ps);return n;});
      if(activeStrandId===st.id)setActiveStrandId(null);
    }}}>
    <span className="mi" style={{fontSize:15,color:'var(--danger)'}}>delete</span>
  </button>
</div>
        );})}
        <div className="strands-add-btn" onClick={addStrand}><span className="mi" style={{fontSize:18}}>add</span><span>Add to {activeColl}</span></div>
      </div>
    </div>
    {!isMobile&&<div style={{flex:1,overflowY:'auto'}}>{detailContent}</div>}
    {isMobile&&mobileDetailOpen&&(
<div style={{position:'fixed',inset:0,zIndex:50,background:'var(--bg1)',overflow:'auto'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
    <button className="btn-icon" onClick={function(){setMobileDetailOpen(false);}}><span className="mi">arrow_back</span></button>
    <span style={{fontFamily:'var(--serif)',fontSize:17,fontWeight:600}}>{activeColl}</span>
  </div>
  {detailContent}
</div>
    )}
  </div>
</div>
  );
}


// ── ArchiveDrawer ──
function ArchiveDrawer({app,open,onClose}){
  var sSelected=useState({});var selected=sSelected[0];var setSelected=sSelected[1];
  // Collect all archived drafts across all projects
  var archivedDrafts=[];
  Object.keys(app.allDrafts).forEach(function(pid){
    (app.allDrafts[pid]||[]).forEach(function(d){
      if(d.archived){
        var proj=app.projects.find(function(p){return p.id===pid;})||null;
        archivedDrafts.push(Object.assign({},d,{projectTitle:proj?proj.title:'Unknown project',pid:pid}));
      }
    });
  });
  var archivedProjects=app.projects.filter(function(p){return p.archived;});
  function toggleDraft(id){setSelected(function(prev){var n=Object.assign({},prev);n[id]=!n[id];return n;});}
  function restoreSelected(){
    Object.keys(selected).forEach(function(did){
      if(!selected[did]) return;
      var d=archivedDrafts.find(function(x){return x.id===did;});
      if(!d) return;
      app.updateDraft(d.pid,did,{archived:false,status:'loose_thread',order:null,parentId:null});
    });
    setSelected({});
  }
  var selectedCount=Object.values(selected).filter(Boolean).length;
  return(
<Panel open={open} onClose={onClose} title="Your Archive"
  footer={selectedCount>0?(
<div style={{display:'flex',gap:8,width:'100%',alignItems:'center'}}>
  <span style={{fontSize:12,color:'var(--mid)',flex:1}}>{selectedCount} selected</span>
  <button className="btn btn-primary" style={{justifyContent:'center'}} onClick={restoreSelected}>
    <span className="mi" style={{fontSize:16}}>unarchive</span>Restore as Loose Thread
  </button>
</div>
  ):null}>
  {archivedDrafts.length===0&&archivedProjects.length===0&&(
<div style={{textAlign:'center',padding:'40px 20px',color:'var(--placeholder)'}}>
  <span className="mi" style={{fontSize:48,display:'block',marginBottom:12}}>inventory_2</span>
  <div style={{fontFamily:'var(--serif)',fontSize:18,marginBottom:6}}>Your archive is empty</div>
  <div style={{fontSize:13}}>Archived drafts and projects will appear here.</div>
</div>
  )}
  {archivedDrafts.length>0&&(
<div style={{marginBottom:20}}>
  <span className="sect-lbl">Archived Drafts</span>
  {archivedDrafts.map(function(d){var isSelected=!!selected[d.id];return(
<div key={d.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)',cursor:'pointer'}} onClick={function(){toggleDraft(d.id);}}>
  <span style={{width:18,height:18,borderRadius:4,border:'1px solid '+(isSelected?'var(--indigo)':'var(--border)'),background:isSelected?'var(--indigo)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2,transition:'all .15s'}}>
    {isSelected&&<span className="mi" style={{fontSize:13,color:'#fff'}}>check</span>}
  </span>
  <div style={{flex:1,minWidth:0}}>
    <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:2}}>{d.title||'Untitled'}</div>
    <div style={{fontSize:11,color:'var(--indigo)',marginBottom:3}}>{d.projectTitle}</div>
    {d.synopsis&&<div style={{fontSize:12,color:'var(--mid)',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.synopsis}</div>}
  </div>
</div>
  );})}
</div>
  )}
  {archivedProjects.length>0&&(
<div>
  <span className="sect-lbl">Archived Projects</span>
  {archivedProjects.map(function(p){return(
<div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
  <div style={{flex:1}}>
    <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:2}}>{p.title||'Untitled'}</div>
    {p.synopsis&&<div style={{fontSize:12,color:'var(--mid)'}}>{p.synopsis}</div>}
  </div>
  <button className="btn btn-ghost btn-sm" onClick={function(){app.unarchiveProject(p.id);}}>
    <span className="mi" style={{fontSize:14}}>unarchive</span>Restore
  </button>
</div>
  );})}
</div>
  )}
</Panel>
  );
}

// ── Wizard ──
function ProjectWizard({app,onClose}){
  var ss=useState(0);var step=ss[0];var setStep=ss[1];
  var spt=useState(null);var projType=spt[0];var setProjType=spt[1];
  var st=useState('');var title=st[0];var setTitle=st[1];
  var ssyn=useState('');var synopsis=ssyn[0];var setSynopsis=ssyn[1];
  var ssc=useState([]);var selectedColls=ssc[0];var setSelectedColls=ssc[1];
  var titleRef=useRef(null);
  useEffect(function(){if(step===1&&titleRef.current)titleRef.current.focus();},[step]);
  var allColls=['Characters','Locations','Lore & World','Sources','Interviews','Subjects','Scenes','Plot Threads','Topics','Audience Notes','Reports'];
  function selectType(t){setProjType(t);setSelectedColls(t.colls);setStep(1);}
  function toggleColl(c){setSelectedColls(function(sc){return sc.includes(c)?sc.filter(function(x){return x!==c;}):sc.concat([c]);});}
  function create(){if(!title.trim())return;var pid=genId();var now=new Date().toISOString();var proj={id:pid,title:title.trim(),type:projType?projType.label:'Other',synopsis:synopsis.trim(),lastEdited:now,createdAt:now,draftFieldDefs:[]};var tpls=selectedColls.map(function(c){return{id:genId(),projectId:pid,name:c,fields:defaultFields(c),sharedWith:[]};});var strandsObj={};selectedColls.forEach(function(c){strandsObj[c]=[];});app.createProject(proj,{templates:tpls,strandsObj:strandsObj});onClose();app.loadProjectData(pid);app.setProjId(pid);app.setView('cards');}
  return(
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={onClose}/>
  <div className="modal-box">
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
      <div style={{fontFamily:'var(--serif)',fontSize:22,fontWeight:600}}>{step===0?'What are you writing?':step===1?'Name your project':'Your collections'}</div>
      <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
    </div>
    <div style={{minHeight:220}}>
      {step===0&&(
<div className="wizard-type-grid">
  {PROJ_TYPES.map(function(t){return(
<div key={t.id} className={'wizard-type-card'+(projType&&projType.id===t.id?' sel':'')} onClick={function(){selectType(t);}}>
  <div style={{marginBottom:8}}><span className="mi" style={{fontSize:26,color:'var(--indigoL)'}}>{t.icon}</span></div>
  <div style={{fontFamily:'var(--serif)',fontSize:16,fontWeight:600,marginBottom:3}}>{t.label}</div>
  <div style={{fontSize:12,color:'var(--mid)'}}>{t.desc}</div>
</div>
  );})}
</div>
      )}
      {step===1&&(
<div>
  <input ref={titleRef} style={{fontSize:18,padding:'12px 14px',background:'var(--bg2)',border:'2px solid var(--border)',borderRadius:10,width:'100%',marginBottom:14,color:'var(--text)',fontFamily:'var(--serif)',fontWeight:600}} value={title} onChange={function(e){setTitle(e.target.value);}} placeholder="Working title..." onKeyDown={function(e){if(e.key==='Enter'&&title.trim())setStep(2);}}/>
  <textarea style={{fontSize:14,padding:'10px 14px',background:'var(--bg2)',border:'2px solid var(--border)',borderRadius:10,width:'100%',color:'var(--text)',marginBottom:14}} value={synopsis} onChange={function(e){setSynopsis(e.target.value);}} placeholder="What is this about? (optional)" rows={3}/>
  <div style={{display:'flex',justifyContent:'space-between',marginTop:4}}>
    <button className="btn btn-ghost" onClick={function(){setStep(0);}}>Back</button>
    <button className="btn btn-primary" onClick={function(){setStep(2);}} disabled={!title.trim()}>Next</button>
  </div>
</div>
      )}
      {step===2&&(
<div>
  <div style={{fontSize:14,color:'var(--mid)',marginBottom:14}}>Select collections to include. You can add more later.</div>
  <div className="wizard-coll-tags" style={{marginBottom:20}}>{allColls.map(function(c){return <span key={c} className={'wizard-coll-tag'+(selectedColls.includes(c)?' sel':'')} onClick={function(){toggleColl(c);}}>{c}</span>;})}</div>
  <div style={{display:'flex',justifyContent:'space-between'}}>
    <button className="btn btn-ghost" onClick={function(){setStep(1);}}>Back</button>
    <button className="btn btn-primary" onClick={create} disabled={!title.trim()}>Create Project</button>
  </div>
</div>
      )}
    </div>
    <div className="wizard-dots">{[0,1,2].map(function(i){return <div key={i} className={'wizard-dot'+(step===i?' active':'')}/>;})}</div>
  </div>
</div>
  );
}

// ── Profile Panel ──
function ProfilePanel({app,focusField,open,onClose}){
  var profile=app.profile||{};
  var sf=useState(profile.firstName||'');var firstName=sf[0];var setFirstName=sf[1];
  var sl=useState(profile.lastName||'');var lastName=sl[0];var setLastName=sl[1];
  var authEmail=(app.currentUser&&app.currentUser.email)||profile.email||'';
  var se=useState(authEmail);var email=se[0];var setEmail=se[1];
  var sg=useState(app.goal||500);var goalVal=sg[0];var setGoalVal=sg[1];
  var goalRef=useRef(null);
  useEffect(function(){if(open&&focusField==='goal'&&goalRef.current){setTimeout(function(){goalRef.current&&goalRef.current.focus();},200);};}, [open,focusField]);
  var sem=useState(profile.editorMode||'rt');var editorMode=sem[0];var setEditorMode=sem[1];
  var srm=useState(profile.reminderEnabled||false);var reminderEnabled=srm[0];var setReminderEnabled=srm[1];
  var srt=useState(profile.reminderTime||'9:00 PM');var reminderTime=srt[0];var setReminderTime=srt[1];
  var reminderRef=useRef(null);
  useEffect(function(){if(open&&focusField==='reminder'&&reminderRef.current){setTimeout(function(){reminderRef.current&&reminderRef.current.scrollIntoView({behavior:'smooth'});},200);};},[open,focusField]);
  function autoSave(overrides){
    var updated=Object.assign({firstName:firstName,lastName:lastName,email:email,plan:profile.plan||'Free',editorMode:editorMode,reminderEnabled:reminderEnabled,reminderTime:reminderTime},overrides);
    app.setProfile(updated);
  }
  return(
<Panel open={open} onClose={onClose} title="Your Profile"
  footer={<button className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}} onClick={function(){app.signOut();}}>
    <span className="mi" style={{fontSize:18}}>logout</span>Sign out
  </button>}>
  <div style={{marginBottom:16}}><span className="sect-lbl">First name</span><input value={firstName} onChange={function(e){setFirstName(e.target.value);}} onBlur={function(e){autoSave({firstName:e.target.value});}} placeholder="First name"/></div>
  <div style={{marginBottom:16}}><span className="sect-lbl">Last name</span><input value={lastName} onChange={function(e){setLastName(e.target.value);}} onBlur={function(e){autoSave({lastName:e.target.value});}} placeholder="Last name"/></div>
  <div style={{marginBottom:16}}><span className="sect-lbl">Email</span><input value={email} onChange={function(e){setEmail(e.target.value);}} onBlur={function(e){autoSave({email:e.target.value});}} placeholder="your@email.com" type="email"/></div>
  <div style={{marginBottom:16}}>
    <span className="sect-lbl">Daily writing goal</span>
    <input ref={goalRef} value={goalVal} onChange={function(e){var v=parseInt(e.target.value,10);if(!isNaN(v)&&v>0)setGoalVal(v);}} onBlur={function(e){var v=parseInt(e.target.value,10);if(!isNaN(v)&&v>0)app.setGoal(v);}} type="number" min="1"/>
    <div style={{fontSize:12,color:'var(--mid)',marginTop:4}}>Words per day</div>
  </div>
  <div style={{marginBottom:16}}>
    <span className="sect-lbl">Editor mode</span>
    <div style={{display:'flex',gap:8,marginTop:6}}>
      {[['rt','Rich Text'],['md','Markdown']].map(function(pair){return(
<button key={pair[0]} className={'btn '+(editorMode===pair[0]?'btn-primary':'btn-ghost')} style={{flex:1,justifyContent:'center'}} onClick={function(){setEditorMode(pair[0]);autoSave({editorMode:pair[0]});}}>
  {pair[1]}
</button>
      );})}
    </div>
    <div style={{fontSize:12,color:'var(--mid)',marginTop:6}}>Applies to all drafts.</div>
  </div>
  <div ref={reminderRef} style={{marginBottom:16}}>
    <span className="sect-lbl">Writing reminders</span>
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
      <span style={{fontSize:14,color:'var(--text)'}}>Send me a quick nudge if I haven't written yet!</span>
      <span style={{width:36,height:20,borderRadius:10,background:reminderEnabled?'var(--indigo)':'var(--bg3)',cursor:'pointer',position:'relative',transition:'all .2s',flexShrink:0,display:'inline-block'}} onClick={function(){var nv=!reminderEnabled;setReminderEnabled(nv);autoSave({reminderEnabled:nv});}}>
        <span style={{position:'absolute',top:2,left:reminderEnabled?18:2,width:16,height:16,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
      </span>
    </div>
    {reminderEnabled&&(
<div style={{marginTop:8}}>
  <span className="sect-lbl">Remind me at</span>
  <div style={{display:'flex',flexWrap:'wrap',gap:6,maxHeight:130,overflowY:'auto',padding:'2px 0'}}>
    {['6:00 AM','7:00 AM','8:00 AM','9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM','6:00 PM','7:00 PM','8:00 PM','9:00 PM','10:00 PM'].map(function(t){var isActive=reminderTime===t;return(
<button key={t} className={'btn btn-sm '+(isActive?'btn-primary':'btn-ghost')} style={{minWidth:80}} onClick={function(){setReminderTime(t);autoSave({reminderTime:t});}}>{t}</button>
    );})}
  </div>
</div>
    )}
  </div>
  <div style={{opacity:.5,pointerEvents:'none',userSelect:'none',marginTop:8,paddingTop:16,borderTop:'1px solid var(--border)'}}>
    <span className="sect-lbl">Plan</span>
    <div style={{display:'flex',gap:8,marginTop:6}}>
      {[['Basic','Free','Free forever'],['Artisan','$8.99/mo','For serious writers'],['Guild','$19.99/mo','For teams & studios']].map(function(p){var isActive=p[0]==='Basic';return(
<div key={p[0]} style={{flex:1,border:'1px solid var(--border)',borderRadius:'var(--r)',padding:'10px',textAlign:'center',background:isActive?'var(--bg2)':'transparent'}}>
  <div style={{fontFamily:'var(--serif)',fontSize:13,fontWeight:600,color:'var(--text)'}}>{p[0]}</div>
  <div style={{fontSize:12,fontWeight:600,color:'var(--indigo)',margin:'2px 0'}}>{p[1]}</div>
  <div style={{fontSize:10,color:'var(--mid)'}}>{p[2]}</div>
</div>
      );})}
    </div>
    <div style={{fontSize:12,color:'var(--mid)',marginTop:8,textAlign:'center'}}>Paid plans coming soon</div>
  </div>
</Panel>
  );
}



// ── WovenLogo ──
function WovenLogo({size,color,dark}){
  var textColor=color||(dark?'var(--text)':'var(--indigo)');var h=size||28;var symH=Math.round(h*0.75);
  return(
<div style={{display:'inline-flex',alignItems:'center',gap:7,userSelect:'none',verticalAlign:'middle'}}>
  <svg width={symH} height={symH} viewBox="0 0 848.94 831.84" xmlns="http://www.w3.org/2000/svg" fill="var(--indigo)">
    <path d="M564.96,702.91c-53.18,9.44-103.06-5.16-143.76-39.96-38.56,34.9-87.88,49.1-141.72,40.7-4.12-18.08-4.13-45.56-1.92-61.83,2.5-18.43,107.47,6.04,107.44-63.63l-.06-125.7-44.3-1.48c-4.57-.15-8.32-3.69-8.72-8.25-1.68-18.87-1.68-35.22,0-54.09.4-4.55,4.15-8.1,8.72-8.25l44.3-1.48.05-125.71c.03-70.41-105.11-46.18-107.21-62.43-2.48-19.16-1.99-41.94.63-62.5,51.86-8.94,102.06,5.29,142.53,40.15,39.2-35.16,90.01-49.89,142.97-39.93,2.41,19.58,2.82,44.43.84,61.59-2.15,18.69-107.68-9.17-107.62,66.26l.09,122.21,44.46,1.87c4.58.19,8.3,3.78,8.65,8.36,1.37,18.04,1.42,33.28.5,53.08-.22,4.66-3.95,8.4-8.62,8.62l-44.91,2.15-.07,125.52c-.04,72.83,108.96,43.13,108.62,65.59l-.9,59.16Z"/>
    <rect y="382.8" width="313.51" height="67.4" rx="11.53" ry="11.53"/>
    <path d="M67.58,128.81h110.06v67.4h-110.06c-5.36,0-9.7-4.35-9.7-9.7v-47.99c0-5.36,4.35-9.7,9.7-9.7Z"/>
    <path d="M69.24,642.78h108.39v67.4h-108.39c-6.27,0-11.37-5.09-11.37-11.37v-44.66c0-6.27,5.09-11.37,11.37-11.37Z"/>
    <path d="M426.94,123.67c6.66-5.47,13.63-10.37,20.86-14.69,2.92-1.75,4.7-4.89,4.7-8.29V9.69c0-5.35-4.34-9.69-9.69-9.69h-48.03c-5.35,0-9.69,4.34-9.69,9.69v89.08c0,3.53,1.93,6.76,5.01,8.47,8.54,4.73,16.8,10.24,24.71,16.5,3.55,2.81,8.62,2.8,12.12-.08Z"/>
    <path d="M426.18,708.18c6.66,5.47,13.63,10.37,20.86,14.69,2.92,1.75,4.7,4.89,4.7,8.29v91c0,5.35-4.34,9.69-9.69,9.69h-48.03c-5.35,0-9.69-4.34-9.69-9.69v-89.08c0-3.53,1.93-6.76,5.01-8.47,8.54-4.73,16.8-10.24,24.71-16.5,3.55-2.81,8.62-2.8,12.12.08Z"/>
    <rect x="535.43" y="382.8" width="313.51" height="67.4" rx="11.53" ry="11.53" transform="translate(1384.37 833) rotate(-180)"/>
    <path d="M681,128.81h110.06v67.4h-110.06c-5.36,0-9.7-4.35-9.7-9.7v-47.99c0-5.36,4.35-9.7,9.7-9.7Z" transform="translate(1462.36 325.01) rotate(-180)"/>
    <path d="M682.67,642.78h108.39v67.4h-108.39c-6.27,0-11.37-5.09-11.37-11.37v-44.66c0-6.27,5.09-11.37,11.37-11.37Z" transform="translate(1462.36 1352.96) rotate(-180)"/>
    <path d="M657.29,366.94V90.24c0-7.18-5.82-13-13-13h-41.4c-7.18,0-13,5.82-13,13v276.71h67.4Z"/>
    <rect x="589.89" y="382.8" width="67.4" height="67.4"/>
    <path d="M589.89,466.06v296.95c0,7.18,5.82,13,13,13h41.4c7.18,0,13-5.82,13-13v-296.95h-67.4Z"/>
    <path d="M259.04,366.94V90.24c0-7.18-5.82-13-13-13h-41.4c-7.18,0-13,5.82-13,13v276.71h67.4Z"/>
    <rect x="191.64" y="382.8" width="67.4" height="67.28"/>
    <path d="M191.64,465.94v297.06c0,7.18,5.82,13,13,13h41.4c7.18,0,13-5.82,13-13v-297.06h-67.4Z"/>
  </svg>
  <span style={{fontFamily:'var(--serif)',fontSize:h*0.9,fontWeight:600,color:textColor,lineHeight:1}}>Woven</span>
</div>
  );
}

// ── AuthScreen ──
function AuthScreen({onAuth}){
  var se=useState('');var email=se[0];var setEmail=se[1];
  var sp=useState('');var password=sp[0];var setPassword=sp[1];
  var sfn=useState('');var firstName=sfn[0];var setFirstName=sfn[1];
  var sl=useState(false);var loading=sl[0];var setLoading=sl[1];
  var sm=useState('');var msg=sm[0];var setMsg=sm[1];
  var smode=useState('signin');var mode=smode[0];var setMode=smode[1];
  async function handleSubmit(){
    if(!email.trim()||!password.trim()){setMsg('Please enter email and password.');return;}
    setLoading(true);setMsg('');
    var res;
    if(mode==='signup'){
      res=await supabase.auth.signUp({email:email.trim(),password:password,options:{data:{first_name:firstName.trim()}}});
      if(!res.error){setMsg('Account created! Check your email to confirm, then sign in.');}
      else if(res.error.message&&(res.error.message.toLowerCase().includes('already')||res.error.message.toLowerCase().includes('registered')||res.error.message.toLowerCase().includes('exist'))){setMsg('An account with this email already exists. Try signing in instead.');}
    } else {
      res=await supabase.auth.signInWithPassword({email:email.trim(),password:password});
      if(!res.error&&res.data.user)onAuth(res.data.user);
    }
    if(res.error)setMsg(res.error.message);
    setLoading(false);
  }
  var ssv=useState(false);var showPw=ssv[0];var setShowPw=ssv[1];
  async function handleReset(){
    if(!email.trim()){setMsg('Enter your email above first.');return;}
    setLoading(true);
    var res=await supabase.auth.resetPasswordForEmail(email.trim());
    setMsg(res.error?res.error.message:'Password reset email sent!');
    setLoading(false);
  }
  return(
<div className="auth-wrapper" style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',background:'var(--bg0)',fontFamily:'var(--ui)',overflow:'hidden'}}>
  {/* Grain overlay */}
  <div className="auth-grain"/>
  {/* Amber radial blurs - top left */}
  <div style={{position:'absolute',top:'-10%',left:'-10%',width:'70vw',height:'70vh',background:'radial-gradient(ellipse, rgba(196,94,40,0.35) 0%, rgba(196,94,40,0.15) 35%, transparent 65%)',pointerEvents:'none',filter:'blur(60px)',zIndex:0}}/>
  {/* Amber radial blurs - bottom right */}
  <div style={{position:'absolute',bottom:'-10%',right:'-10%',width:'70vw',height:'70vh',background:'radial-gradient(ellipse, rgba(240,192,80,0.30) 0%, rgba(232,160,48,0.12) 35%, transparent 65%)',pointerEvents:'none',filter:'blur(60px)',zIndex:0}}/>
  <div className="auth-card" style={{position:'relative',zIndex:1,background:'rgba(245,237,224,0.92)',backdropFilter:'blur(12px)',border:'1px solid var(--border)',borderRadius:'var(--rl)',padding:'40px',width:'100%',maxWidth:400,boxShadow:'0 20px 60px rgba(42,31,16,.15)'}}>
    <div style={{textAlign:'center',marginBottom:28}}>
      <div style={{marginBottom:10,display:'flex',justifyContent:'center',alignItems:'center'}}><WovenLogo size={36} dark={true}/></div>
      <div style={{fontSize:14,color:'var(--body-text)',fontWeight:700,fontStyle:'italic',textAlign:'center'}}>Where thinking & writing happen together.</div>
    </div>
    {mode==='signup'&&(
<div style={{marginBottom:14}}>
  <span className="sect-lbl">First name</span>
  <input value={firstName} onChange={function(e){setFirstName(e.target.value);}} placeholder="What should we call you?" onKeyDown={function(e){if(e.key==='Enter')handleSubmit();}}/>
</div>
    )}
    <div style={{marginBottom:14}}>
      <span className="sect-lbl">Email</span>
      <input type="email" value={email} onChange={function(e){setEmail(e.target.value);}} placeholder="your@email.com" onKeyDown={function(e){if(e.key==='Enter')handleSubmit();}}/>
    </div>
    <div style={{marginBottom:8}}>
      <span className="sect-lbl">Password</span>
      <div style={{position:'relative'}}>
        <input type={showPw?'text':'password'} value={password} onChange={function(e){setPassword(e.target.value);}} placeholder="••••••••" onKeyDown={function(e){if(e.key==='Enter')handleSubmit();}} style={{paddingRight:40}}/>
        <button style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'var(--mid)',padding:0}} onClick={function(){setShowPw(!showPw);}}>
          <span className="mi" style={{fontSize:18}}>{showPw?'visibility_off':'visibility'}</span>
        </button>
      </div>
    </div>
    {mode==='signin'&&(
<div style={{textAlign:'right',marginBottom:16}}>
  <span style={{fontSize:12,color:'var(--indigo)',cursor:'pointer'}} onClick={handleReset}>Forgot password?</span>
</div>
    )}
    {msg&&<div style={{fontSize:13,color:msg.includes('sent')||msg.includes('created')?'var(--teal)':'var(--danger)',marginBottom:14,padding:'8px 12px',background:'var(--bg2)',borderRadius:'var(--r)'}}>{msg}</div>}
    <button className="btn btn-primary" style={{width:'100%',justifyContent:'center',marginBottom:12}} onClick={handleSubmit} disabled={loading}>
      {loading?'Please wait...':(mode==='signup'?'Create account':'Sign in')}
    </button>
    {mode==='signin'&&(
<div style={{marginTop:4}}>
  <div style={{textAlign:'center',fontSize:12,color:'var(--mid)',marginBottom:10}}>Don't have an account?</div>
  <button className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}} onClick={function(){setMode('signup');setMsg('');}}>
    Create a free account
  </button>
</div>
    )}
    {mode==='signup'&&(
<div style={{textAlign:'center',fontSize:13,color:'var(--mid)',marginTop:4}}>
  Have an account? <span style={{color:'var(--indigo)',cursor:'pointer'}} onClick={function(){setMode('signin');setMsg('');}}>Sign in</span>
</div>
    )}
  </div>
</div>
  );
}

// ── App Root ──
function App(){
  var sau=useState(null);var currentUser=sau[0];var setCurrentUser=sau[1];
  var sal=useState(true);var authLoading=sal[0];var setAuthLoading=sal[1];
  var sdl=useState(false);var dataLoading=sdl[0];var setDataLoading=sdl[1];
  var sv=useState('dashboard');var view=sv[0];var setView=sv[1];
  var spi=useState(null);var projId=spi[0];var setProjId=spi[1];
  var sdi=useState(null);var draftId=sdi[0];var setDraftId=sdi[1];
  var spr=useState([]);var projects=spr[0];var setProjects=spr[1];
  var sg=useState(500);var goal=sg[0];var setGoalState=sg[1];
  var ss=useState([]);var sessions=ss[0];var setSessions=ss[1];
  var spf=useState({firstName:'',lastName:'',email:'',plan:'Free'});var profile=spf[0];var setProfileState=spf[1];
  var sad=useState({});var allDrafts=sad[0];var setAllDrafts=sad[1];
  var sas=useState({});var allStrands=sas[0];var setAllStrands=sas[1];
  var sat=useState({});var allTemplates=sat[0];var setAllTemplates=sat[1];
  var ssp=useState(false);var showProfile=ssp[0];var setShowProfile=ssp[1];
  var sglt=useState({});var globalLT=sglt[0];var setGlobalLT=sglt[1];
  var spf2=useState(null);var profileFocus=spf2[0];var setProfileFocus=spf2[1];
  var snp=useState(false);var showNewProject=snp[0];var setShowNewProject=snp[1];

  function loadProjectDataById(pid){
    setDataLoading(true);
    Promise.all([
      loadDB('woven:drafts:'+pid,[]),
      loadDB('woven:strands:'+pid,{}),
      loadDB('woven:templates:'+pid,[])
    ]).then(function(results){
      var d=results[0];var st=results[1];var tm=results[2];
      setAllDrafts(function(p){var n=Object.assign({},p);n[pid]=Array.isArray(d)?d:[];return n;});
      setAllStrands(function(p){var n=Object.assign({},p);n[pid]=st&&typeof st==='object'?st:{};return n;});
      setAllTemplates(function(p){var n=Object.assign({},p);n[pid]=Array.isArray(tm)?tm:[];return n;});
      setDataLoading(false);
    });
  }
  // Handle browser back button
  useEffect(function(){
    function onPopState(){
      if(view==='editor') vc=<DraftEditor app={app}/>;
      else if(view!=='dashboard'){setView('dashboard');}
      else{window.history.pushState(null,'',window.location.href);}
    }
    window.history.pushState(null,'',window.location.href);
    window.addEventListener('popstate',onPopState);
    return function(){window.removeEventListener('popstate',onPopState);};
  },[view]);

  useEffect(function(){
    // Check existing auth session
    supabase.auth.getSession().then(function(r){
      if(r.data.session&&r.data.session.user){
        window.__wovenUserId=r.data.session.user.id;
        setCurrentUser(r.data.session.user);
        loadAllData();
      } else {
        setAuthLoading(false);
      }
    });
    // Listen for auth changes
    var sub=supabase.auth.onAuthStateChange(function(event,session){
      if(event==='SIGNED_IN'&&session&&session.user){
        // Only reload all data if this is a genuine new sign-in, not a token refresh
        var wasAlreadyLoggedIn=!!window.__wovenUserId;
        window.__wovenUserId=session.user.id;
        setCurrentUser(session.user);
        if(!wasAlreadyLoggedIn)loadAllData();
      } else if(event==='SIGNED_OUT'){
        window.__wovenUserId=null;
        setCurrentUser(null);
        setProjects([]);setAllDrafts({});setAllStrands({});setAllTemplates({});
        setSessions([]);setGlobalLT({});setGoalState(500);
        setProfileState({firstName:'',lastName:'',email:'',plan:'Free'});
        setAuthLoading(false);
      }
    });
    return function(){sub.data.subscription.unsubscribe();};
  },[]);

  function loadAllData(){
    setDataLoading(true);
    // Reset React state first so previous user's data never shows
    setProjects([]);setAllDrafts({});setAllStrands({});setAllTemplates({});
    setSessions([]);setGlobalLT({});setGoalState(500);
    setProfileState({firstName:'',lastName:'',email:'',plan:'Free'});
    loadDB('woven:global_lt',{}).then(function(g){setGlobalLT(g||{});});
    loadDB('woven:goal',500).then(function(g){setGoalState(g);});
    // Load sessions from localStorage first (faster, avoids async timing issues)
    loadLS('woven:sessions',[]).then(function(local){
      if(local&&local.length>0){setSessions(local);}
      // Then try Supabase in background and merge if newer
      loadDB('woven:sessions',[]).then(function(remote){
        if(remote&&remote.length>0){setSessions(remote);}
      });
    });
    loadDB('woven:profile',{firstName:'',lastName:'',email:'',plan:'Free'}).then(function(p){
      if(!p.email&&window.__wovenUserId){
        supabase.auth.getUser().then(function(r){
          if(r.data&&r.data.user&&r.data.user.email){
            var updated=Object.assign({},p,{email:r.data.user.email});
            setProfileState(updated);saveDB('woven:profile',updated);
          } else { setProfileState(p); }
        });
      } else { setProfileState(p); }
    });
    loadDB('woven:projects',null).then(function(saved){
      if(!saved||saved.length===0){
        setProjects([]);
        setAuthLoading(false);setDataLoading(false);
      } else {
        setProjects(saved);
        // Restore last view state if user was in editor
        var lastState=null;try{var ls=localStorage.getItem('woven:lastState');if(ls)lastState=JSON.parse(ls);}catch(e){}
        if(lastState&&lastState.projId&&lastState.draftId){
          setProjId(lastState.projId);
          setDraftId(lastState.draftId);
          setView('editor');
          loadProjectDataById(lastState.projId);
        } else if(lastState&&lastState.projId){
          setProjId(lastState.projId);
          setView(lastState.view||'cards');
          loadProjectDataById(lastState.projId);
        } else {
          saved.forEach(function(p){loadProjectDataById(p.id);});
        }
        setAuthLoading(false);setDataLoading(false);
      }
    });
  }

  function updateDraft(pid,did,changes){setAllDrafts(function(prev){var next=Object.assign({},prev);var ds=(next[pid]||[]).map(function(d){return d.id!==did?d:Object.assign({},d,changes);});next[pid]=ds;saveDB('woven:drafts:'+pid,ds);return next;});}
  function addDraft(pid,nd){setAllDrafts(function(prev){var next=Object.assign({},prev);var ds=(next[pid]||[]).concat([nd]);next[pid]=ds;saveDB('woven:drafts:'+pid,ds);return next;});}
  function duplicateDraft(pid,did){
    setAllDrafts(function(prev){
      var next=Object.assign({},prev);
      var ds=next[pid]||[];
      var orig=ds.find(function(d){return d.id===did;});
      if(!orig)return prev;
      var newId=genId();
      var copy=Object.assign({},orig,{
        id:newId,
        title:(orig.title||'Untitled')+' (copy)',
        parentId:orig.id, // nested under original
        order:Date.now(),
        createdAt:new Date().toISOString(),
        updatedAt:new Date().toISOString()
      });
      next[pid]=ds.concat([copy]);
      saveDB('woven:drafts:'+pid,next[pid]);
      return next;
    });
  }
  function reorderDraft(pid,fromId,toOrder){
    setAllDrafts(function(prev){
      var next=Object.assign({},prev);var ds=(next[pid]||[]).slice();
      var seq=ds.filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).sort(function(a,b){return (a.order||0)-(b.order||0);});
      var fi=seq.findIndex(function(d){return d.id===fromId;});
      var ti=seq.findIndex(function(d){return (d.order||0)===toOrder;});
      if(fi<0||ti<0||fi===ti)return prev;
      var item=seq.splice(fi,1)[0];seq.splice(ti,0,item);
      seq.forEach(function(d,i){var di=ds.findIndex(function(x){return x.id===d.id;});if(di>=0)ds[di]=Object.assign({},ds[di],{order:i+1});});
      next[pid]=ds;saveDB('woven:drafts:'+pid,ds);return next;
    });
  }
  function nestDraft(pid,childId,parentId){
    setAllDrafts(function(prev){
      var next=Object.assign({},prev);
      var ds=(next[pid]||[]).map(function(d){if(d.id!==childId)return d;return Object.assign({},d,{parentId:parentId,order:Date.now()});});
      next[pid]=ds;saveDB('woven:drafts:'+pid,ds);return next;
    });
  }
  function updateStrand(pid,coll,sid,changes){setAllStrands(function(prev){var next=Object.assign({},prev);var ps=Object.assign({},next[pid]||{});ps[coll]=(ps[coll]||[]).map(function(s){return s.id!==sid?s:Object.assign({},s,changes);});next[pid]=ps;saveDB('woven:strands:'+pid,ps);return next;});}
  function addStrand(pid,coll,ns){setAllStrands(function(prev){var next=Object.assign({},prev);var ps=Object.assign({},next[pid]||{});ps[coll]=(ps[coll]||[]).concat([ns]);next[pid]=ps;saveDB('woven:strands:'+pid,ps);return next;});}
  function addTemplate(pid,tpl){setAllTemplates(function(prev){var next=Object.assign({},prev);next[pid]=(next[pid]||[]).concat([tpl]);saveDB('woven:templates:'+pid,next[pid]);return next;});}
  function updateTemplate(pid,tid,changes){setAllTemplates(function(prev){var next=Object.assign({},prev);next[pid]=(next[pid]||[]).map(function(t){return t.id!==tid?t:Object.assign({},t,changes);});saveDB('woven:templates:'+pid,next[pid]);return next;});}
  function updateProjectTitle(pid,newTitle){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{title:newTitle});});saveDB('woven:projects',next);return next;});}
  function updateProjectSynopsis(pid,syn){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{synopsis:syn});});saveDB('woven:projects',next);return next;});}
  function updateProjectImage(pid,img){setProjects(function(prev){var old=prev.find(function(p){return p.id===pid;});if(old&&old.image&&old.image!==img)deleteStorageImage(old.image);var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{image:img});});saveDB('woven:projects',next);return next;});}
  function updateProjectType(pid,type){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{type:type});});saveDB('woven:projects',next);return next;});}
  function archiveProject(pid){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{archived:true});});saveDB('woven:projects',next);return next;});}
  function unarchiveProject(pid){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{archived:false});});saveDB('woven:projects',next);return next;});}
  function addDraftFieldDef(pid,fieldDef){
    setProjects(function(prev){var next=prev.map(function(p){if(p.id!==pid)return p;var defs=(p.draftFieldDefs||[]).concat([fieldDef]);return Object.assign({},p,{draftFieldDefs:defs});});saveDB('woven:projects',next);return next;});
    // Add empty value to all existing drafts
    setAllDrafts(function(prev){var next=Object.assign({},prev);var ds=(next[pid]||[]).map(function(d){var cf=Object.assign({},d.customFields||{});cf[fieldDef.id]='';return Object.assign({},d,{customFields:cf});});next[pid]=ds;saveDB('woven:drafts:'+pid,ds);return next;});
  }
  function createProject(proj,seed){
    var pid=proj.id;
    setProjects(function(prev){var next=prev.concat([proj]);saveDB('woven:projects',next);return next;});
    setAllDrafts(function(prev){var n=Object.assign({},prev);n[pid]=[];saveDB('woven:drafts:'+pid,[]);return n;});
    setAllStrands(function(prev){var n=Object.assign({},prev);n[pid]=seed.strandsObj;saveDB('woven:strands:'+pid,seed.strandsObj);return n;});
    setAllTemplates(function(prev){var n=Object.assign({},prev);n[pid]=seed.templates;saveDB('woven:templates:'+pid,seed.templates);return n;});
  }
  function setGoal(v){setGoalState(v);saveDB('woven:goal',v);}
  function updateGlobalLT(id,changes){setGlobalLT(function(prev){var next=Object.assign({},prev);next[id]=Object.assign({},next[id]||{},changes);saveDB('woven:global_lt',next);return next;});}
  function setProfile(p){setProfileState(p);saveDB('woven:profile',p);}
  function clearTodaySession(){
    var t=todayStr();
    setSessions(function(prev){
      var next=prev.filter(function(s){return s.date!==t;});
      saveLS('woven:sessions',next);
      if(window.__wovenUserId){supabase.from('wf_data').upsert({key:'woven:sessions',user_id:window.__wovenUserId,value:next,updated_at:new Date().toISOString()},{onConflict:'key,user_id'}).then(function(){});}
      return next;
    });
  }
  function recordSession(pid,wordsAdded){
    var t=todayStr();
    if(!wordsAdded||wordsAdded<=0||wordsAdded>500)return;
    setSessions(function(prev){
      var next=prev.slice();
      var idx=next.findIndex(function(s){return s.date===t&&s.projId===pid;});
      if(idx>=0){
        // Cap daily total at 50000 words to prevent runaway counts
        var current=next[idx].words||0;
        if(current+wordsAdded>50000)return prev;
        next[idx]=Object.assign({},next[idx],{words:current+wordsAdded});
      } else {
        next.push({id:genId(),date:t,projId:pid,words:wordsAdded});
      }
      // Keep only last 90 days
      var cutoff=new Date();cutoff.setDate(cutoff.getDate()-90);var cutoffStr=cutoff.getFullYear()+'-'+String(cutoff.getMonth()+1).padStart(2,'0')+'-'+String(cutoff.getDate()).padStart(2,'0');
      next=next.filter(function(s){return s.date>=cutoffStr;});
      // Sessions: always save to localStorage first for reliability, then sync to Supabase
      saveLS('woven:sessions',next);
      if(window.__wovenUserId){
        supabase.from('wf_data').upsert({key:'woven:sessions',user_id:window.__wovenUserId,value:next,updated_at:new Date().toISOString()},{onConflict:'key,user_id'}).then(function(){});
      }
      return next;
    });
  }
  function goBack(){
    setView('dashboard');setProjId(null);setDraftId(null);
    try{localStorage.removeItem('woven:lastState');}catch(e){}
  }
  function openDraft(did){
    setDraftId(did);setView('editor');
    // Save cards view as restore point (not editor) to avoid empty draft on tab restore
    try{localStorage.setItem('woven:lastState',JSON.stringify({projId:projId,draftId:null,view:'cards'}));}catch(e){}
  }
  function openProfile(field){setProfileFocus(field);setShowProfile(true);}

  var currentProject=projects.find(function(p){return p.id===projId;})||null;
  var app={view:view,setView:setView,projId:projId,setProjId:setProjId,draftId:draftId,setDraftId:setDraftId,projects:projects,goal:goal,setGoal:setGoal,sessions:sessions,profile:profile,setProfile:setProfile,allDrafts:allDrafts,allStrands:allStrands,setAllStrands:setAllStrands,allTemplates:allTemplates,currentProject:currentProject,goBack:goBack,openDraft:openDraft,loadProjectData:loadProjectDataById,updateDraft:updateDraft,addDraft:addDraft,duplicateDraft:duplicateDraft,reorderDraft:reorderDraft,nestDraft:nestDraft,updateStrand:updateStrand,addStrand:addStrand,addTemplate:addTemplate,updateTemplate:updateTemplate,createProject:createProject,updateProjectTitle:updateProjectTitle,updateProjectSynopsis:updateProjectSynopsis,updateProjectImage:updateProjectImage,updateProjectType:updateProjectType,archiveProject:archiveProject,unarchiveProject:unarchiveProject,addDraftFieldDef:addDraftFieldDef,recordSession:recordSession,globalLT:globalLT,updateGlobalLT:updateGlobalLT,signOut:signOut,currentUser:currentUser,dataLoading:dataLoading,clearTodaySession:clearTodaySession};

  function signOut(){supabase.auth.signOut().then(function(){window.__wovenUserId=null;setCurrentUser(null);setView('dashboard');setProjects([]);setAllDrafts({});});}

  // Check for shared draft link
  var urlParams=new URLSearchParams(window.location.search);
  var shareId=urlParams.get('share');
  if(shareId)return(<div className="woven-root"><GlobalStyles/><SharedDraftView shareId={shareId}/></div>);

  if(authLoading)return(<div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg0)',fontFamily:'var(--serif)',fontSize:24,color:'var(--mid)'}}>Loading...</div>);
  if(!currentUser)return(<div><GlobalStyles/><AuthScreen onAuth={function(user){window.__wovenUserId=user.id;setCurrentUser(user);loadAllData();}}/></div>);

  var inner=null;
  if(view==='dashboard'){inner=<Dashboard app={app} onOpenProfile={openProfile} onNewProject={function(){setShowNewProject(true);}}/>;
  }else if(view==='editor'){inner=<DraftEditor app={app}/>;
  }else{
    var vc=null;
   if(view==='canvas')vc=<ExploreCanvas app={app}/>;
    if(view==='cards')vc=<CardsView app={app}/>;
    if(view==='table')vc=<TableView app={app}/>;
    if(view==='strands')vc=<StrandsPage app={app} allProjects={projects}/>;
    inner=<div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}><ProjectNav app={app} onOpenProfile={openProfile}/>{vc}</div>;
  }
  return(
<div className="woven-root">
  <GlobalStyles/>
  {inner}
  <ProfilePanel app={app} focusField={profileFocus} open={showProfile} onClose={function(){setShowProfile(false);}}/>
  {showNewProject&&<ProjectWizard app={app} onClose={function(){setShowNewProject(false);}}/>}
</div>
  );
}

export default App;
