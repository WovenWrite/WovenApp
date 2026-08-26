// @ts-nocheck
import ExploreCanvas from './ExploreCanvas'
import { useState, useEffect, useRef } from "react";
import DraftEditor from './DraftEditor'
import SharedDraftView from './SharedDraftView'
import AuthScreen from './auth/AuthScreen'
import PropertiesDrawer from './PropertiesDrawer'
import ProfileDrawer from './ProfileDrawer'
import StrandsDrawer from './StrandsDrawer'
import VersionsDrawer from './VersionsDrawer'
import LooseThreadDrawer from './LooseThreadDrawer'
import BindDrawer from './BindDrawer'
import ProjectWizard from './ProjectWizard'
import ProjectDrawer from './ProjectDrawer'
import { StatusDot, StatusDotWithArchive, ArchiveConfirmModal, AvatarEditModal, AddFieldInline, Drawer, HelpText, PrimaryButton, StrandResultRow, SearchSortBar, Popover, Check, Avatar, OptionsEditor, Radio } from './SharedUI'
import {
  STATUSES, FIELD_TYPES, PRESET_COLORS, SYSTEM_COLORS, COLL_FIELDS, defaultFields,
  supabase, genId, stripHtml, countWords, initials, todayStr,
  compressImage, uploadImage, deleteStorageImage,
  saveSnapshot
} from './utils'
import { PROJ_TYPES, projIsNumbered, projIsManualOrder, projSequence, sortDraftsBySequence, draftDateOf, formatDraftDate } from './projectConfig'
// Snapshot helpers, Supabase client, and env constants now live in ./utils

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

// genId, compressImage, deleteStorageImage, uploadImage, countWords, stripHtml,
// todayStr, initials, STATUSES, PRESET_COLORS, FIELD_TYPES, COLL_FIELDS,
// defaultFields, SYSTEM_COLORS now live in ./utils

function dayLbl(offset){var days=['Su','Mo','Tu','We','Th','Fr','Sa'];var d=new Date();d.setDate(d.getDate()-offset);return days[d.getDay()];}
function getGreeting(){var h=new Date().getHours();if(h<12)return 'Good morning';if(h<17)return 'Good afternoon';return 'Good evening';}
function useIsMobile(){var s=useState(window.innerWidth<768);var isMobile=s[0];var setIsMobile=s[1];useEffect(function(){function onResize(){setIsMobile(window.innerWidth<768);}window.addEventListener('resize',onResize);return function(){window.removeEventListener('resize',onResize);};},[]);return isMobile;}

// ── Constants ──
// Canvas | Table | Tiles | Cards | (separator) Strands
var VIEW_MODES=[
  {key:'canvas', icon:'lightbulb',    label:'Canvas',     group:'main'},
  {key:'table',  icon:'table_rows',   label:'Outline',    group:'main'},
  {key:'cards',  icon:'book_ribbon',  label:'Storyboard', group:'main'},
  {key:'strands',icon:'gesture',      label:'Spools',     group:'strands'}
];
// PROJ_TYPES now lives in ./projectConfig (label/icon/desc/colls + presets)
var DEFAULT_TABLE_COLS=['title','synopsis','status','strandTags'];

// ── Seed Data ──
function makeSeedData(pid){
  var now=new Date().toISOString();
  var drafts=[
    {id:'d1',projectId:pid,title:'The Arrival',synopsis:'Eldric arrives at the farmstead to find it eerily silent.',status:'second_draft',order:1,parentId:null,nestExpanded:true,body:'<p>The farmstead appeared through the fog as Eldric crested the hill. He had not expected the silence.</p><p>"Maren?" His voice was swallowed by the grey.</p>',wordCount:32,strandTags:['s1','s2'],customFields:{},createdAt:now,updatedAt:now},
    {id:'d1a',projectId:pid,title:'The Farmstead at Dawn',synopsis:'A nested scene — Eldric searches the outbuildings.',status:'first_draft',order:1.1,parentId:'d1',nestExpanded:true,body:'',wordCount:0,strandTags:['s1'],customFields:{},createdAt:now,updatedAt:now},
    {id:'d2',projectId:pid,title:'The Keep at Ironveil',synopsis:'Lord Vasher summons the council. Maren must attend or raise suspicion.',status:'first_draft',order:2,parentId:null,nestExpanded:true,body:'<p>The great hall was lit by torchlight even at midday. Maren took her place where the shadows were deepest.</p>',wordCount:27,strandTags:['s2','s3'],customFields:{},createdAt:now,updatedAt:now},
    {id:'d3',projectId:pid,title:'First Light',synopsis:'Eldric remembers the archive before the fire.',status:'first_draft',order:3,parentId:null,nestExpanded:true,body:'<p>He had loved the archive most at dawn, when the light caught the dust motes like suspended snow.</p>',wordCount:24,strandTags:['s1'],customFields:{},createdAt:now,updatedAt:now},
    {id:'d4',projectId:pid,title:'The Council Meets',synopsis:'Something is decided that cannot be undone.',status:'first_draft',order:4,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:['s2','s3'],customFields:{},createdAt:now,updatedAt:now},
    {id:'d5',projectId:pid,title:"Eldric's Secret",synopsis:'The truth about the archive fire is finally revealed.',status:'complete',order:5,parentId:null,nestExpanded:true,body:'<p>Eldric had not started the fire. But he had known it was coming.</p>',wordCount:18,strandTags:['s1'],customFields:{},createdAt:now,updatedAt:now},
    {id:'lt1',projectId:pid,title:'The Dream Sequence',synopsis:'Maren keeps having the same dream. Magical or psychological?',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:now,updatedAt:now},
    {id:'lt2',projectId:pid,title:'',synopsis:'Where does Vasher finally show his hand?',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:now,updatedAt:now}
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
@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200');

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
#woven-tt{position:fixed;display:none;background:#7A5A38;color:#fdf8f0;font-size:11px;padding:4px 10px;border-radius:6px;pointer-events:none;z-index:99999;transform:translateX(-50%);font-family:'DM Sans',sans-serif;white-space:nowrap;}::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-track{background:transparent;margin:6px 10px 6px 0;}::-webkit-scrollbar-thumb{background:var(--bg3);border-radius:10px;}::-webkit-scrollbar-thumb:hover{background:var(--bg4);}
.mi{font-family:'Material Icons';font-style:normal;font-size:20px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;direction:ltr;font-feature-settings:'liga';-webkit-font-smoothing:antialiased;}
.material-symbols-outlined{font-family:'Material Symbols Outlined';font-style:normal;font-size:20px;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;direction:ltr;-webkit-font-smoothing:antialiased;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:var(--r);font-size:14px;font-weight:500;cursor:pointer;border:1px solid transparent;transition:all .15s;white-space:nowrap;}
.btn-primary{background:var(--indigo);color:#fff;box-shadow:0 1px 4px rgba(42,31,16,.15);}.btn-primary:hover{background:var(--amber-dark);color:#fff;}
.btn-ghost{color:var(--mid);border-color:var(--border);background:var(--bg1);}.btn-ghost:hover{color:var(--text);border-color:var(--bg4);background:var(--bg2);}
.btn-danger{color:var(--danger);border-color:var(--danger);}.btn-danger:hover{background:rgba(184,50,32,.08);}
.btn-sm{padding:5px 11px;font-size:13px;}.btn-icon{padding:5px;border-radius:var(--r);color:var(--mid);display:inline-flex;align-items:center;}.btn-icon:hover{background:var(--bg2);color:var(--text);}
.nav{display:flex;align-items:center;padding:0 14px;height:54px;background:#E2D0B8;flex-shrink:0;gap:10px;}
.wordmark{font-family:var(--serif);font-size:22px;font-weight:600;color:var(--indigo);cursor:pointer;user-select:none;}
.avatar{width:32px;height:32px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;flex-shrink:0;cursor:pointer;overflow:hidden;}
.view-switcher{display:flex;align-items:center;background:#F5EDE0;border-radius:50px;padding:4px;gap:2px;border:1px solid #A88060;}
.view-seg{height:32px;width:36px;display:flex;align-items:center;justify-content:center;border-radius:50px;cursor:pointer;transition:all .15s;color:var(--mid);position:relative;flex-shrink:0;}
.view-seg:hover{color:var(--text);background:rgba(42,31,16,.06);}
.view-seg.active{background:var(--bg0);color:var(--indigo);box-shadow:0 1px 4px rgba(42,31,16,.10);}
.view-seg .mi{font-size:18px;}
.view-seg-tip{position:absolute;bottom:-34px;left:50%;transform:translateX(-50%);background:#7A5A38;color:#fdf8f0;font-size:11px;padding:3px 8px;border-radius:4px;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .1s;z-index:100;}
.view-seg:hover .view-seg-tip{opacity:1;}
.view-sep{width:1px;height:18px;background:#A88060;margin:0 2px;flex-shrink:0;opacity:.4;}
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
.view-hdr{display:flex;align-items:center;gap:0;padding:0 20px;height:55px;border-bottom:1px solid #A88060;flex-shrink:0;background:#FDF8F0;flex-wrap:nowrap;}
.filter-btn{display:flex;align-items:center;gap:5px;padding:6px 11px;border-radius:var(--r);border:1px solid var(--border);font-size:13px;color:var(--mid);cursor:pointer;background:var(--bg0);transition:all .15s;}
.filter-btn:hover{border-color:var(--bg4);color:var(--text);background:var(--bg1);}
.filter-btn.active{border-color:var(--indigo);color:var(--indigo);background:rgba(196,94,40,.06);}
.sort-select{width:auto;padding:6px 10px;font-size:13px;color:var(--mid);background:var(--bg0);border:1px solid var(--border);border-radius:var(--r);}
.filter-dropdown{position:fixed;z-index:400;background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);box-shadow:0 8px 28px rgba(42,31,16,.14);min-width:240px;max-height:360px;overflow-y:auto;padding:8px;}
.filter-coll-lbl{font-size:10px;font-weight:600;color:var(--indigo);text-transform:uppercase;letter-spacing:.08em;padding:8px 8px 4px;display:block;}
.chip{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:12px;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;white-space:nowrap;border:1px solid transparent;}
.view-layout{display:flex;flex-direction:column;flex:1;overflow:hidden;position:relative;}
.view-area{flex:1;overflow-y:auto;padding:0;display:flex;flex-direction:column;}
.cards-grid{display:flex;flex-wrap:wrap;gap:16px;padding:20px;align-content:flex-start;flex:1;}
.draft-card{background:var(--bg1);border:1px solid var(--border);border-radius:var(--rl);display:flex;flex-direction:column;overflow:hidden;transition:border-color .15s,box-shadow .15s;height:244px;box-shadow:0 1px 4px rgba(42,31,16,.04);}
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
.lt-section{}
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
.wt td{background:#FDF8F0;font-family:'DM Sans',sans-serif;font-size:16px;color:#7A5A38;}
.wt th{background:#E2D0B8;font-family:'DM Sans',sans-serif;font-size:16px;color:#6B4A26;font-weight:600;border-bottom:2px solid var(--border);padding:9px 12px;text-align:left;font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;letter-spacing:.08em;position:sticky;top:0;z-index:2;white-space:nowrap;user-select:none;overflow:hidden;position:relative;}
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
.strands-subnav{display:flex;align-items:flex-end;border-bottom:1px solid #A88060;background:#EDE0CC;padding:0 16px;flex-shrink:0;height:55px;gap:0;}
.strands-tab{padding:0 18px;height:44px;font-size:16px;font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;color:rgba(122,90,56,.75);border:1px solid transparent;border-bottom:none;border-radius:10px 10px 0 0;white-space:nowrap;display:flex;align-items:center;transition:all .15s;margin-right:2px;position:relative;bottom:0;}
.strands-tab.active{background:#FDF8F0;color:#6B4A26;border-color:#A88060;border-bottom:2px solid #FDF8F0;margin-bottom:-1px;}
.strands-tab:hover:not(.active){color:#7A5A38;background:rgba(253,248,240,.4);}
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

// ArchiveConfirmModal now lives in ./SharedUI

// ── ArchiveProjectConfirmModal ──
// Moved into ProjectDrawer — it was only ever used by ProjectEditPanel

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

// StatusDot now lives in ./SharedUI

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
  return(
<div className="view-switcher">
  {VIEW_MODES.map(function(m){var seg=(
<div key={m.key} className={'view-seg'+(view===m.key?' active':'')} onClick={function(){setView(m.key);}}>
  <span className="material-symbols-outlined" style={{fontSize:20}}>{m.icon}</span>
  <span className="view-seg-tip">{m.label}</span>
</div>
  );return m.group==='strands'?[<div key={m.key+'-sep'} className="view-sep"/>,seg]:seg;})}
</div>
  );
}

// ── StatsSection ──
function StatsSection({app,onOpenProfile,greeting}){
  var sessions=app.sessions;var goal=app.goal;
  var todayWords=sessions.filter(function(s){return s.date===todayStr();}).reduce(function(sum,s){return sum+(s.words||0);},0);
  var pct=goal>0?Math.round(todayWords/goal*100):0;
  var weekData=[];
  function localDateStr(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
  for(var i=6;i>=0;i--){var dd=new Date();dd.setDate(dd.getDate()-i);var ds=localDateStr(dd);var dw=sessions.filter(function(s){return s.date===ds;}).reduce(function(sum,s){return sum+(s.words||0);},0);weekData.push({date:ds,words:dw,isToday:i===0,label:dayLbl(i)});}
  var maxW=weekData.reduce(function(m,d){return Math.max(m,d.words);},1);
  var streak=0;var sd=new Date();
  for(var j=0;j<60;j++){var sds=localDateStr(sd);if(sessions.filter(function(s){return s.date===sds&&(s.words||0)>0;}).length>0){streak++;sd.setDate(sd.getDate()-1);}else if(j===0){sd.setDate(sd.getDate()-1);}else break;}
  var weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);weekStart.setHours(0,0,0,0);
  var weekStartStr=localDateStr(weekStart);
  var ltCount=0;
  // Count project loose threads
  Object.keys(app.allDrafts).forEach(function(pid){(app.allDrafts[pid]||[]).forEach(function(d){
    if(d.status==='loose_thread'&&!d.archived){
      var createdStr=(d.createdAt||'').slice(0,10);
      if(createdStr>=weekStartStr)ltCount++;
    }
  });});
  // Count global loose threads
  Object.values(app.globalLT||{}).forEach(function(lt){
    if(!lt.archived){
      var createdStr=(lt.createdAt||'').slice(0,10);
      if(createdStr>=weekStartStr)ltCount++;
    }
  });
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
// Replaced by ProjectDrawer — see ./ProjectDrawer

// ── GlobalLooseThreads ──
function GlobalLooseThreads({app}){
  // Global LTs are stored in app.globalLT (keyed by id), not tied to any project
  var allLT=Object.values(app.globalLT||{}).filter(function(d){return !d.archived;}).sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});
  var activeProjects=app.projects.filter(function(p){return !p.archived;});
  var soi=useState(null);var openLTId=soi[0];var setOpenLTId=soi[1];
  // A newly-created thread stays purely local (never touches app.globalLT)
  // until it actually has a title or synopsis — closing an empty one leaves
  // no trace, per "no input means it does not save."
  var spl=useState(null);var pendingLT=spl[0];var setPendingLT=spl[1];
  function updateLT(id,changes){app.updateGlobalLT(id,changes);}
  function moveToProject(ltId,targetPid){
    if(!targetPid)return;
    var lt=app.globalLT[ltId];if(!lt)return;
    app.addDraft(targetPid,{id:genId(),projectId:targetPid,title:lt.title||'',synopsis:lt.synopsis||'',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    app.updateGlobalLT(ltId,{archived:true});
  }
  var ssm=useState(false);var showMore=ssm[0];var setShowMore=ssm[1];
  // Show one row (approx 3-4 cards) collapsed, rest hidden
  var visibleLT=showMore?allLT:allLT.slice(0,3);
  function handleAddLT(){
    var id=genId();
    setPendingLT({id:id,title:'',synopsis:'',createdAt:new Date().toISOString(),archived:false});
    setOpenLTId(id);
  }
  var activeLT=pendingLT&&pendingLT.id===openLTId?pendingLT:app.globalLT[openLTId];
  function handleDrawerUpdate(changes){
    if(pendingLT&&pendingLT.id===openLTId){
      var merged=Object.assign({},pendingLT,changes);
      if((merged.title&&merged.title.trim())||(merged.synopsis&&merged.synopsis.trim())){
        // First real content — actually create the record now.
        app.updateGlobalLT(merged.id,merged);
        setPendingLT(null);
      } else {
        setPendingLT(merged);
      }
      return;
    }
    updateLT(openLTId,changes);
  }
  function handleDrawerClose(){
    setPendingLT(null); // no-op if it was never actually saved
    setOpenLTId(null);
  }
  function handleDrawerDelete(){
    if(pendingLT&&pendingLT.id===openLTId){handleDrawerClose();return;}
    updateLT(openLTId,{archived:true});
    setOpenLTId(null);
  }
  return(
<div style={{marginTop:24}}>
  <div style={{fontSize:12,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:12}}>Loose Threads</div>
  <div style={{display:"flex",flexWrap:"nowrap",gap:10,overflowX:"auto",paddingBottom:4}}>
    <div onClick={handleAddLT} style={{background:"transparent",border:"2px dashed #A88060",padding:"10px 15px",borderRadius:15,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,minWidth:120,flexShrink:0,minHeight:80}} onMouseEnter={function(e){e.currentTarget.style.borderColor="#c45e28";}} onMouseLeave={function(e){e.currentTarget.style.borderColor="#A88060";}}>
      <span className="material-symbols-outlined" style={{fontSize:28,color:'#A88060'}}>add_circle</span>
    </div>
    {visibleLT.map(function(d){return(
<div key={d.id} style={{background:'#FDF8F0',border:'1px solid #E2D0B8',padding:'10px 15px',borderRadius:15,cursor:'pointer',display:'flex',flexDirection:'column',gap:8,width:150,maxWidth:150,flexShrink:0,transition:'border-color .2s,box-shadow .2s',outline:'1px solid transparent'}}
  onClick={function(){setOpenLTId(d.id);}}
  onMouseEnter={function(e){e.currentTarget.style.borderColor='#c45e28';e.currentTarget.style.boxShadow='0 4px 12px rgba(196,94,40,.12)';}}
  onMouseLeave={function(e){e.currentTarget.style.borderColor='#E2D0B8';e.currentTarget.style.boxShadow='none';}}>
  <div style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:16,color:'#2A1F10',lineHeight:1.25,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.title||'Untitled loose thread'}</div>
  {d.synopsis&&<div style={{fontFamily:'DM Sans, sans-serif',fontSize:14,fontStyle:'italic',color:'#A88060',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.synopsis}</div>}
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
  <button onClick={handleAddLT} title="Add a loose thread" style={{position:'fixed',bottom:28,right:28,width:52,height:52,borderRadius:'50%',background:'#DF6321',border:'none',boxShadow:'0 4px 14px rgba(42,31,16,.25)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:400,transition:'background .15s ease'}}
    onMouseEnter={function(e){e.currentTarget.style.background='#6B4A26';}}
    onMouseLeave={function(e){e.currentTarget.style.background='#DF6321';}}>
    <span className="material-symbols-outlined" style={{fontSize:26,color:'#F5EDE0'}}>add</span>
  </button>
  {openLTId&&activeLT&&(
<LooseThreadDrawer lt={activeLT} activeProjects={activeProjects} open={true} variant="overlay" topOffset={54} onUpdate={handleDrawerUpdate} onMove={function(pid){moveToProject(openLTId,pid);setOpenLTId(null);}} onClose={handleDrawerClose} onDelete={handleDrawerDelete}/>
  )}
</div>
  );
}


// ── LTDrawer ──
// LTDrawer now lives as LooseThreadDrawer in ./LooseThreadDrawer

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
      <div className="avatar" onClick={function(){onOpenProfile(null);}}>{profile.headshot?<img src={profile.headshot} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:initials(firstName+' '+(profile.lastName||''))}</div>
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
    <div className="dash-sidebar" style={{display:'flex',flexDirection:'column'}}>
      <div style={{flex:1}}><StatsSection app={app} onOpenProfile={onOpenProfile} greeting={greeting}/></div>
      <div style={{paddingTop:16,borderTop:'1px solid var(--border)',marginTop:16}}>
        <button className="btn btn-ghost" style={{width:'100%',justifyContent:'center'}} onClick={function(){app.signOut();}}>
          <span className="mi" style={{fontSize:16}}>logout</span>Sign out
        </button>
      </div>
    </div>
  </div>
  {editProj&&<ProjectDrawer proj={editProj} app={app} open={true} variant="overlay" topOffset={54} onClose={function(){setEditingProjId(null);}}/>}
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
  <div className="avatar" onClick={function(){onOpenProfile(null);}}>{(app.profile&&app.profile.headshot)?<img src={app.profile.headshot} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:initials(((app.profile||{}).firstName||'')+' '+((app.profile||{}).lastName||''))}</div>
</nav>
  );
}



// CollFilterGroup removed — replaced by ViewHeader's Popover-based filter

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
function ViewHeader({app,filter:filterProp,setFilter,sort,setSort,onAddDraft,onBind,structureMode,onStructureToggle,searchQ,onSearch,hideStructure,resultCount}){
  var filter=filterProp||emptyFilterState();
  var sf=useState(false);var filterOpen=sf[0];var setFilterOpen=sf[1];
  var ss=useState(false);var searchOpen=ss[0];var setSearchOpen=ss[1];
  var sq=useState('');var searchQ=sq[0];var setSearchQ=sq[1];
  var st=useState(structureMode||false);var structureOn=st[0];var setStructureOn=st[1];
  var sfs=useState('');var filterSearch=sfs[0];var setFilterSearch=sfs[1];
  var filterRef=useRef(null);var searchRef=useRef(null);
  var pid=app.projId;
  var projStrands=app.allStrands[pid]||{};
  var draftFieldDefs=(app.currentProject&&app.currentProject.draftFieldDefs)||[];
  var refFields=draftFieldDefs.filter(function(f){return f.type==='strand_ref'&&f.refSpool;});
  var boolFields=draftFieldDefs.filter(function(f){return f.type==='boolean';});
  var selectFields=draftFieldDefs.filter(function(f){return f.type==='select'&&(f.options||[]).length>0;});
  useEffect(function(){if(searchOpen&&searchRef.current)searchRef.current.focus();},[searchOpen]);
  var criteriaCount=filterCriteriaCount(filter);
  var hasFilter=criteriaCount>0;
  var SEP=(<div style={{width:1,height:24,background:'#7A5A38',opacity:.5,margin:'0 10px',flexShrink:0}}/>);

  function toggleStatus(k){
    var cur=filter.status||[];
    var next=cur.indexOf(k)>=0?cur.filter(function(x){return x!==k;}):cur.concat([k]);
    setFilter(Object.assign({},filter,{status:next}));
  }
  function toggleStrand(id){
    var cur=filter.strandTags||[];
    var next=cur.indexOf(id)>=0?cur.filter(function(x){return x!==id;}):cur.concat([id]);
    setFilter(Object.assign({},filter,{strandTags:next}));
  }
  function toggleRefField(fid,strandId){
    var cur=(filter.customFields&&filter.customFields[fid])||[];
    var next=cur.indexOf(strandId)>=0?cur.filter(function(x){return x!==strandId;}):cur.concat([strandId]);
    var cf=Object.assign({},filter.customFields);
    cf[fid]=next;
    setFilter(Object.assign({},filter,{customFields:cf}));
  }

  var sectLbl={fontFamily:'DM Sans, sans-serif',fontWeight:600,fontSize:13,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:8,display:'block'};
  var allStrandsList=[];
  Object.keys(projStrands).forEach(function(coll){
    (projStrands[coll]||[]).forEach(function(s){allStrandsList.push(Object.assign({},s,{collectionName:coll}));});
  });
  var filteredStrandList=allStrandsList.filter(function(s){return !filterSearch||(s.name||'').toLowerCase().indexOf(filterSearch.toLowerCase())>=0;});

  return(
<div className="view-hdr">
  <div style={{display:'flex',alignItems:'center',flex:1}}>
    <div style={{position:'relative'}}>
      <button ref={filterRef} onClick={function(){setFilterOpen(!filterOpen);}} style={{display:'flex',alignItems:'center',gap:7,padding:'0 12px',height:55,background:'transparent',border:'none',cursor:'pointer',position:'relative'}}>
        <span className="material-symbols-outlined" style={{fontSize:20,color:'#6B4A26'}}>{hasFilter?'filter_alt_off':'filter_alt'}</span>
        <span style={{fontFamily:'DM Sans, sans-serif',fontWeight:600,fontSize:16,color:'#7A5A38'}}>Define</span>
        {hasFilter&&<span style={{position:'absolute',top:10,right:6,background:'var(--indigo)',color:'#fff',borderRadius:'50%',width:14,height:14,fontSize:9,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>{criteriaCount}</span>}
      </button>
      <Popover anchorRef={filterRef} open={filterOpen} onClose={function(){setFilterOpen(false);}} title="Define filter" width={300}
        footer={hasFilter?(
          <button className="btn btn-ghost btn-sm" style={{width:'100%',justifyContent:'center'}} onClick={function(){setFilter(emptyFilterState());}}>Clear all filters</button>
        ):null}>

        <div>
          <span style={sectLbl}>Status</span>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {Object.keys(STATUSES).map(function(k){
              var active=(filter.status||[]).indexOf(k)>=0;
              return(
<span key={k} onClick={function(){toggleStatus(k);}} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:12,fontSize:12,fontWeight:500,cursor:'pointer',background:active?STATUSES[k].color+'22':'var(--bg2)',color:active?STATUSES[k].color:'var(--mid)',border:'1px solid '+(active?STATUSES[k].color+'55':'var(--border)')}}>
  <span style={{width:7,height:7,borderRadius:'50%',background:STATUSES[k].color,flexShrink:0}}/>
  {STATUSES[k].label}
</span>
              );
            })}
          </div>
        </div>

        <div>
          <span style={sectLbl}>Tagged Strands</span>
          <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,padding:'6px 10px',marginBottom:8}}>
            <span className="mi" style={{fontSize:14,color:'var(--mid)'}}>search</span>
            <input value={filterSearch} onChange={function(e){setFilterSearch(e.target.value);}} placeholder="Search spools..." style={{border:'none',background:'none',outline:'none',flex:1,fontSize:13,color:'var(--text)'}}/>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:2,maxHeight:160,overflowY:'auto'}}>
            {filteredStrandList.length===0&&<div style={{fontSize:12,color:'var(--mid)',padding:'4px 0'}}>{allStrandsList.length===0?'No strands yet.':'No matches.'}</div>}
            {filteredStrandList.map(function(s){
              var active=(filter.strandTags||[]).indexOf(s.id)>=0;
              return(
<div key={s.id} onClick={function(){toggleStrand(s.id);}} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 4px',cursor:'pointer',borderRadius:6}}
  onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}} onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <Check on={active}/>
  <Avatar strand={s} size={22}/>
  <span style={{fontSize:13,color:'var(--text)',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.name}</span>
  <span style={{fontSize:11,color:'var(--mid)'}}>{s.collectionName}</span>
</div>
              );
            })}
          </div>
        </div>

        {refFields.map(function(f){
          var opts=(projStrands[f.refSpool]||[]);
          var selected=(filter.customFields&&filter.customFields[f.id])||[];
          return(
<div key={f.id}>
  <span style={sectLbl}>{f.label}</span>
  <div style={{display:'flex',flexDirection:'column',gap:2,maxHeight:160,overflowY:'auto'}}>
    {opts.length===0&&<div style={{fontSize:12,color:'var(--mid)',padding:'4px 0'}}>No {f.refSpool.toLowerCase()} yet.</div>}
    {opts.map(function(s){
      var active=selected.indexOf(s.id)>=0;
      return(
<div key={s.id} onClick={function(){toggleRefField(f.id,s.id);}} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 4px',cursor:'pointer',borderRadius:6}}
  onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}} onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <Check on={active}/>
  <Avatar strand={s} size={22}/>
  <span style={{fontSize:13,color:'var(--text)'}}>{s.name}</span>
</div>
      );
    })}
  </div>
</div>
          );
        })}

        {boolFields.map(function(f){
          var selected=(filter.customFields&&filter.customFields[f.id])||[];
          return(
<div key={f.id}>
  <span style={sectLbl}>{f.label}</span>
  <div style={{display:'flex',gap:6}}>
    {['Yes','No'].map(function(opt){
      var active=selected.indexOf(opt)>=0;
      return(
<span key={opt} onClick={function(){toggleRefField(f.id,opt);}} style={{display:'inline-flex',alignItems:'center',padding:'4px 12px',borderRadius:12,fontSize:12,fontWeight:500,cursor:'pointer',background:active?'rgba(196,94,40,.10)':'var(--bg2)',color:active?'var(--indigo)':'var(--mid)',border:'1px solid '+(active?'rgba(196,94,40,.35)':'var(--border)')}}>
  {opt}
</span>
      );
    })}
  </div>
</div>
          );
        })}

        {selectFields.map(function(f){
          var selected=(filter.customFields&&filter.customFields[f.id])||[];
          return(
<div key={f.id}>
  <span style={sectLbl}>{f.label}</span>
  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
    {(f.options||[]).map(function(opt){
      var active=selected.indexOf(opt)>=0;
      return(
<span key={opt} onClick={function(){toggleRefField(f.id,opt);}} style={{display:'inline-flex',alignItems:'center',padding:'4px 12px',borderRadius:12,fontSize:12,fontWeight:500,cursor:'pointer',background:active?'rgba(196,94,40,.10)':'var(--bg2)',color:active?'var(--indigo)':'var(--mid)',border:'1px solid '+(active?'rgba(196,94,40,.35)':'var(--border)')}}>
  {opt}
</span>
      );
    })}
  </div>
</div>
          );
        })}

      </Popover>
    </div>
    {hasFilter&&(
      <span style={{fontFamily:'DM Sans, sans-serif',fontSize:12,fontWeight:600,color:'var(--indigo)',background:'rgba(196,94,40,.10)',padding:'3px 10px',borderRadius:12,marginLeft:4,whiteSpace:'nowrap'}}>
        {resultCount} {resultCount===1?'result':'results'}
      </span>
    )}
    {!hideStructure&&SEP}
    {!hideStructure&&<button onClick={function(){var nv=!structureOn;setStructureOn(nv);if(onStructureToggle)onStructureToggle(nv);}} style={{display:'flex',alignItems:'center',gap:8,padding:'0 12px',height:55,background:'transparent',border:'none',cursor:'pointer'}}>
      <div style={{width:34,height:18,borderRadius:9,background:structureOn?'#7A5A38':'#A88060',position:'relative',transition:'background .2s',flexShrink:0}}>
        <div style={{position:'absolute',top:2,left:structureOn?16:2,width:14,height:14,borderRadius:'50%',background:'#fff',transition:'left .2s',boxShadow:'0 1px 3px rgba(0,0,0,.2)'}}/>
      </div>
      <span style={{fontFamily:'DM Sans, sans-serif',fontWeight:600,fontSize:16,color:'#7A5A38'}}>Structure</span>
    </button>}
    {SEP}
    <div style={{display:'flex',alignItems:'center',padding:'0 12px',height:55}}>
      {searchOpen?(
<input ref={searchRef} value={searchQ||''} onChange={function(e){setSearchQ(e.target.value);if(onSearch)onSearch(e.target.value);}} placeholder="Search drafts…" onBlur={function(){if(!searchQ)setSearchOpen(false);}} style={{width:200,padding:'6px 10px',fontSize:14,border:'1px solid var(--border)',borderRadius:20,fontFamily:'DM Sans, sans-serif',background:'var(--bg1)',color:'var(--text)',outline:'none'}}/>
      ):(
<button onClick={function(){setSearchOpen(true);}} style={{display:'flex',alignItems:'center',background:'transparent',border:'none',cursor:'pointer',padding:0}}>
  <span className="material-symbols-outlined" style={{fontSize:22,color:'#6B4A26'}}>search</span>
</button>
      )}
    </div>
  </div>
  <div style={{display:'flex',alignItems:'center',gap:8}}>
    <button onClick={onBind} title="Bind" style={{display:'flex',alignItems:'center',justifyContent:'center',width:38,height:38,borderRadius:8,background:'transparent',border:'1px solid var(--border)',cursor:'pointer',color:'var(--mid)',transition:'all .15s'}}
      onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';e.currentTarget.style.color='var(--text)';}}
      onMouseOut={function(e){e.currentTarget.style.background='transparent';e.currentTarget.style.color='var(--mid)';}}>
      <span className="material-symbols-outlined" style={{fontSize:20}}>collections_bookmark</span>
    </button>
    <button onClick={onAddDraft} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',background:'var(--indigo)',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontFamily:'DM Sans, sans-serif',fontWeight:600,cursor:'pointer',transition:'background .15s'}}
      onMouseOver={function(e){e.currentTarget.style.background='#2A1F10';}}
      onMouseOut={function(e){e.currentTarget.style.background='var(--indigo)';}}>
      <span className="material-symbols-outlined" style={{fontSize:18}}>add</span>New draft
    </button>
  </div>
</div>
  );
}
// ── StatusDotWithArchive ──
// StatusDotWithArchive now lives in ./SharedUI

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

window.doExport=function doExport(format,drafts,project,isSingleDraft,authorName){
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
      bodyParas.forEach(function(para){
        var lines=doc.splitTextToSize(para,pageW);
        lines.forEach(function(line){if(y>275){doc.addPage();y=margin;}doc.text(line,margin,y);y+=lineH;});
        y+=lineH*0.5;
      });
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
        bodyParas.forEach(function(para){
          var lines=doc.splitTextToSize(para,pageW);
          lines.forEach(function(line){if(y>275){doc.addPage();y=margin;}doc.text(line,margin,y);y+=lineH;});
          y+=lineH*0.5;
        });
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
// BindPanel now lives as BindDrawer in ./BindDrawer
// ── applyFS ──// ── applyFS ──
// ── Define filter — property-based, multi-criteria ──
// Shape: { status:[...statusKeys], strandTags:[...strandIds], customFields:{fieldId:[...strandIds]} }
// AND across categories (status / strandTags / each custom field), OR within
// a category's own selections. Persisted per-project in localStorage so it
// survives navigation and reload — cleared only on sign out (see signOut()).
function emptyFilterState(){return {status:[],strandTags:[],customFields:{}};}
function filterStorageKey(pid){return 'woven:filter:'+pid;}
function loadFilterState(pid){
  try{
    var raw=localStorage.getItem(filterStorageKey(pid));
    if(!raw)return emptyFilterState();
    var parsed=JSON.parse(raw);
    return Object.assign(emptyFilterState(),parsed,{customFields:Object.assign({},parsed.customFields)});
  }catch(e){return emptyFilterState();}
}
function persistFilterState(pid,filterObj){
  try{localStorage.setItem(filterStorageKey(pid),JSON.stringify(filterObj));}catch(e){}
}
function filterCriteriaCount(filterObj){
  if(!filterObj)return 0;
  var n=(filterObj.status||[]).length+(filterObj.strandTags||[]).length;
  Object.keys(filterObj.customFields||{}).forEach(function(k){n+=(filterObj.customFields[k]||[]).length;});
  return n;
}
function draftMatchesFilter(draft,filterObj){
  if(!filterObj)return true;
  var st=filterObj.status||[];
  if(st.length>0&&st.indexOf(draft.status)<0)return false;
  var sTags=filterObj.strandTags||[];
  if(sTags.length>0){
    var dTags=draft.strandTags||[];
    if(!sTags.some(function(id){return dTags.indexOf(id)>=0;}))return false;
  }
  var cf=filterObj.customFields||{};
  var keys=Object.keys(cf);
  for(var i=0;i<keys.length;i++){
    var fid=keys[i];var wanted=cf[fid]||[];
    if(wanted.length===0)continue;
    var raw=(draft.customFields&&draft.customFields[fid])||'';
    var have=[];
    try{var parsed=JSON.parse(raw);have=Array.isArray(parsed)?parsed:(raw?[raw]:[]);}catch(e){have=raw?[raw]:[];}
    if(!wanted.some(function(id){return have.indexOf(id)>=0;}))return false;
  }
  return true;
}
function applyFS(drafts,filterObj,sort){
  var hasFilter=filterCriteriaCount(filterObj)>0;
  var d=hasFilter?drafts.filter(function(x){
    var matchSelf=draftMatchesFilter(x,filterObj);
    var matchChild=(x.children||[]).some(function(c){return draftMatchesFilter(c,filterObj);});
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
function StrandCircle({strand,spoolColor,size}){
  var sz=size||25;
  var color=spoolColor||'#c45e28';
  var sr=useRef(null);var tt=useRef(null);
  function show(){if(!sr.current||!tt.current)return;var r=sr.current.getBoundingClientRect();tt.current.style.left=(r.left+r.width/2)+'px';tt.current.style.top=(r.top-6)+'px';tt.current.style.opacity='1';}
  function hide(){if(tt.current)tt.current.style.opacity='0';}
  return(
<div ref={sr} onMouseEnter={show} onMouseLeave={hide} style={{width:sz,height:sz,borderRadius:'50%',background:strand.color||color,border:'2px solid '+color,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,marginLeft:sr.current?-8:0,cursor:'default',boxSizing:'border-box'}}>
  {strand.image?<img src={strand.image} alt={strand.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:strand.emoji?<span style={{fontSize:sz*0.5}}>{strand.emoji}</span>:<span style={{fontFamily:'DM Sans, sans-serif',fontSize:sz*0.36,fontWeight:700,color:'#fff'}}>{initials(strand.name)}</span>}
  <span ref={tt} className="tooltip-text" style={{position:'fixed',opacity:0,transition:'opacity .1s'}}>{strand.name}</span>
</div>
  );
}


// ── StrandTagPicker ──
function StrandTagPicker({draft,app,pid,tagged}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var sq=useState('');var q=sq[0];var setQ=sq[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);

  var projStrands=app.allStrands[pid]||{};
  var projTemplates=app.allTemplates[pid]||[];
  var taggedIds=(draft.strandTags||[]);

  // All strands not yet tagged, optionally filtered by q
  var available=[];
  Object.keys(projStrands).forEach(function(coll){
    (projStrands[coll]||[]).forEach(function(st){
      if(taggedIds.includes(st.id))return;
      if(q&&!(st.name||'').toLowerCase().includes(q.toLowerCase()))return;
      var tpl=projTemplates.find(function(t){return t.name===coll||t.id===st.templateId;});
      available.push(Object.assign({},st,{collName:coll,spoolColor:tpl&&tpl.color?tpl.color:'#c45e28'}));
    });
  });

  function tag(strandId){
    app.updateDraft(pid,draft.id,{strandTags:taggedIds.concat([strandId])});
    setQ('');setOpen(false);
  }

  return(
<div ref={ref} style={{position:'relative',display:'inline-block'}}>
  <button onClick={function(e){e.stopPropagation();setOpen(!open);}} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:12,border:'1px dashed var(--border)',background:'transparent',cursor:'pointer',fontSize:11,color:'var(--mid)',fontFamily:'DM Sans, sans-serif'}}>
    <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--teal)'}}>add</span>
    Tag spool
  </button>
  {open&&available.length===0&&!q&&(
<div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,zIndex:600,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:8,padding:'10px 12px',fontSize:12,color:'var(--mid)',whiteSpace:'nowrap',boxShadow:'0 4px 16px rgba(42,31,16,.12)'}}>All strands are already tagged.</div>
  )}
  {open&&(available.length>0||q)&&(
<div style={{position:'absolute',bottom:'calc(100% + 6px)',left:0,zIndex:600,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 4px 16px rgba(42,31,16,.12)',minWidth:200,overflow:'hidden'}}>
  <div style={{padding:'6px 8px',borderBottom:'1px solid var(--border)'}}>
    <input autoFocus value={q} onChange={function(e){setQ(e.target.value);}} placeholder="Search strands…" style={{width:'100%',padding:'4px 8px',fontSize:12,border:'1px solid var(--border)',borderRadius:6,fontFamily:'DM Sans, sans-serif',background:'var(--bg2)',color:'var(--text)',outline:'none',boxSizing:'border-box'}}/>
  </div>
  <div style={{maxHeight:180,overflowY:'auto'}}>
    {available.map(function(st){return(
<div key={st.id} onClick={function(e){e.stopPropagation();tag(st.id);}} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',cursor:'pointer',borderBottom:'1px solid var(--bg2)'}}
  onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <div style={{width:16,height:16,borderRadius:'50%',background:st.spoolColor,flexShrink:0}}/>
  <div>
    <div style={{fontSize:12,fontWeight:600,color:'var(--text)',fontFamily:'DM Sans, sans-serif'}}>{st.name}</div>
    <div style={{fontSize:10,color:'var(--mid)',fontFamily:'DM Sans, sans-serif'}}>{st.collName}</div>
  </div>
</div>
    );})}
    {available.length===0&&q&&<div style={{padding:'10px 12px',fontSize:12,color:'var(--mid)'}}>No matches.</div>}
  </div>
</div>
  )}
</div>
  );
}


function DraftCard({draft,label,app,onMoveUp,onMoveDown,structureMode}){
  var so=useState(false);var dragOver=so[0];var setDragOver=so[1];
  var sac=useState(false);var archiveConfirm=sac[0];var setArchiveConfirm=sac[1];
  var set=useState(false);var editTitle=set[0];var setEditTitle=set[1];
  var ses=useState(false);var editSyn=ses[0];var setEditSyn=ses[1];
  var stv=useState(draft.title||'');var titleVal=stv[0];var setTitleVal=stv[1];
  var ssv=useState(draft.synopsis||'');var synVal=ssv[0];var setSynVal=ssv[1];
  var sth=useState(false);var thumbHover=sth[0];var setThumbHover=sth[1];
  var ssc=useState(false);var strandConfirm=ssc[0];var setStrandConfirm=ssc[1];
  var ssi=useState(null);var strandConfirmId=ssi[0];var setStrandConfirmId=ssi[1];
  var sdrag=useRef(false);var smouse=useRef({x:0,y:0});
  var fileRef=useRef(null);
  var pid=app.projId;
  var projStrands=app.allStrands[pid]||{};
  var projTemplates=app.allTemplates[pid]||[];

  var tagged=[];
  Object.keys(projStrands).forEach(function(coll){
    (projStrands[coll]||[]).forEach(function(st){
      if((draft.strandTags||[]).includes(st.id)){
        var tpl=projTemplates.find(function(t){return t.name===coll||t.id===st.templateId;});
        tagged.push(Object.assign({},st,{spoolColor:tpl&&tpl.color?tpl.color:'#c45e28',collName:coll}));
      }
    });
  });

  var info=STATUSES[draft.status]||STATUSES.first_draft;

  function onStatusChange(s){
    if(s==='archive'){setArchiveConfirm(true);return;}
    var ch={status:s};
    if(s==='loose_thread'){ch.order=null;ch.parentId=null;}
    else if(draft.status==='loose_thread'){ch.order=(app.allDrafts[pid]||[]).filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).length+1;}
    app.updateDraft(pid,draft.id,ch);
  }
  function doArchive(){var allDr=app.allDrafts[pid]||[];var children=allDr.filter(function(d){return d.parentId===draft.id&&!d.archived;});app.updateDraft(pid,draft.id,{archived:true});children.forEach(function(c){app.updateDraft(pid,c.id,{archived:true});});setArchiveConfirm(false);}
  function removeStrand(strandId){app.updateDraft(pid,draft.id,{strandTags:(draft.strandTags||[]).filter(function(id){return id!==strandId;})});setStrandConfirm(false);setStrandConfirmId(null);}

  function handleMouseDown(e){smouse.current={x:e.clientX,y:e.clientY};sdrag.current=false;}
  function handleMouseMove(e){var dx=e.clientX-smouse.current.x;var dy=e.clientY-smouse.current.y;if(Math.sqrt(dx*dx+dy*dy)>4)sdrag.current=true;}
  function handleMouseUp(e){
    if(!sdrag.current&&!structureMode){
      if(!e.target.closest('.status-dot-wrap'))app.openDraft(draft.id);
    }
  }
  function handleThumbnailUpload(e){
    var file=e.target.files&&e.target.files[0];if(!file)return;
    if(file.size>3*1024*1024){alert('Please use an image under 3 MB.');return;}
    uploadImage(file).then(function(url){if(url)app.updateDraft(pid,draft.id,{thumbnail:url});});
  }

  var bodyPreview=draft.body?stripHtml(draft.body).slice(0,300):'';
  var visibleStrands=structureMode?tagged:tagged.slice(0,3);
  var overflow=structureMode?0:tagged.length-3;
  var overflowRef=useRef(null);var overflowTt=useRef(null);
  function showOverflow(){if(!overflowRef.current||!overflowTt.current)return;var r=overflowRef.current.getBoundingClientRect();overflowTt.current.style.left=(r.left+r.width/2)+'px';overflowTt.current.style.top=(r.bottom+6)+'px';overflowTt.current.style.opacity='1';}
  function hideOverflow(){if(overflowTt.current)overflowTt.current.style.opacity='0';}

  var cardProj=app.currentProject;
  var seqNumbered=projIsNumbered(cardProj);
  var seqByDate=projSequence(cardProj)==='date';
  var canReorder=projIsManualOrder(cardProj);
  var cardDate=seqByDate?formatDraftDate(draftDateOf(draft)):'';

  var AMBER='#c45e28';

  return(
<div
  style={{width:270,borderRadius:15,overflow:'visible',background:'var(--bg1)',border:'2px solid transparent',display:'flex',flexDirection:'column',cursor:structureMode?'default':'pointer',boxShadow:'0 2px 8px rgba(42,31,16,.06)',transition:'box-shadow .2s,border-color .2s',flexShrink:0,position:'relative',height:structureMode?'auto':400}}
  draggable={structureMode}
  onDragStart={structureMode?function(e){e.dataTransfer.setData('draftId',draft.id);}:undefined}
  onDragOver={structureMode?function(e){e.preventDefault();setDragOver(true);}:undefined}
  onDragLeave={structureMode?function(){setDragOver(false);}:undefined}
  onDrop={structureMode?function(e){e.preventDefault();setDragOver(false);var fromId=e.dataTransfer.getData('draftId');if(fromId&&fromId!==draft.id){var isLT=(app.allDrafts[pid]||[]).find(function(d){return d.id===fromId;});if(isLT&&isLT.status==='loose_thread'){app.updateDraft(pid,fromId,{status:'first_draft',order:draft.order||0,parentId:null});}else{app.reorderDraft(pid,fromId,draft.order||0);}}}:undefined}
  onMouseDown={handleMouseDown}
  onMouseMove={handleMouseMove}
  onMouseUp={handleMouseUp}
  onMouseEnter={function(e){e.currentTarget.style.boxShadow='0 4px 16px rgba(42,31,16,.12)';if(!structureMode)e.currentTarget.style.borderColor=AMBER;}}
  onMouseLeave={function(e){e.currentTarget.style.boxShadow='0 2px 8px rgba(42,31,16,.06)';e.currentTarget.style.borderColor='transparent';}}
>
  {/* Thumbnail */}
  <div
    style={{height:150,background:'#E2D0B8',flexShrink:0,backgroundImage:draft.thumbnail?'url('+draft.thumbnail+')':undefined,backgroundSize:'cover',backgroundPosition:'center',position:'relative',borderRadius:'13px 13px 0 0',overflow:'hidden',cursor:structureMode?'pointer':'inherit'}}
    onMouseEnter={function(){if(structureMode)setThumbHover(true);}}
    onMouseLeave={function(){setThumbHover(false);}}
    onClick={function(){if(structureMode&&fileRef.current)fileRef.current.click();}}
  >
    {dragOver&&<div style={{position:'absolute',inset:0,background:'rgba(196,94,40,.15)'}}/>}
    {structureMode&&thumbHover&&(
<div style={{position:'absolute',inset:0,background:'rgba(196,94,40,.75)',display:'flex',alignItems:'center',justifyContent:'center'}}>
  <span className="material-symbols-outlined" style={{fontSize:32,color:'#fff'}}>edit</span>
</div>
    )}
    {structureMode&&<input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleThumbnailUpload}/>}
    {structureMode&&(
<div draggable={true} onDragStart={function(e){e.dataTransfer.setData('draftId',draft.id);}} onClick={function(e){e.stopPropagation();}} style={{position:'absolute',top:8,right:8,width:28,height:28,background:'rgba(253,248,240,.85)',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',cursor:'grab',zIndex:2}}>
  <span className="material-symbols-outlined" style={{fontSize:18,color:'#7A5A38'}}>drag_indicator</span>
</div>
    )}
  </div>

  {/* Content */}
  <div style={{flex:1,background:'#F5EDE0',padding:'10px 15px',display:'flex',flexDirection:'column',gap:10,minHeight:0,borderRadius:'0 0 13px 13px',overflow:'hidden'}}>

    {/* Title block — eyebrow (number or date) plus title share ONE flex slot
        in the card's gap:10 column, so the eyebrow adds only its own line
        height rather than a whole extra gapped row. The card has a fixed
        height (see .draft-card), so a second top-level flex child here was
        silently eating into the synopsis area below. */}
    <div style={{flexShrink:0}}>
      {(seqNumbered||(seqByDate&&cardDate))&&(
<div style={{fontFamily:'DM Sans, sans-serif',fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#A88060',padding:'0 4px',marginBottom:2}}>{seqNumbered?label:cardDate}</div>
      )}
      {structureMode&&editTitle?(
<textarea autoFocus rows={2} value={titleVal} onChange={function(e){setTitleVal(e.target.value);}} onBlur={function(){app.updateDraft(pid,draft.id,{title:titleVal});setEditTitle(false);}} style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:18,color:'#2a1f10',lineHeight:1.25,background:'transparent',border:'2px solid '+AMBER,borderRadius:8,outline:'none',resize:'none',padding:'4px 8px',width:'100%',boxSizing:'border-box'}}/>
      ):(
<div
  style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:18,color:'#2a1f10',lineHeight:1.25,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',borderRadius:6,padding:'2px 4px',transition:'background .15s',cursor:structureMode?'text':'inherit',border:'2px solid transparent'}}
  onClick={function(){if(structureMode){setTitleVal(draft.title||'');setEditTitle(true);}}}
  onMouseEnter={function(e){if(structureMode)e.currentTarget.style.background='rgba(196,94,40,.06)';}}
  onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>
  {draft.title||'Untitled'}
</div>
      )}
    </div>

    {/* Synopsis / preview */}
    {structureMode&&editSyn?(
<textarea autoFocus rows={4} value={synVal} onChange={function(e){setSynVal(e.target.value);}} onBlur={function(){app.updateDraft(pid,draft.id,{synopsis:synVal});setEditSyn(false);}} placeholder="Add a synopsis…" style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38',lineHeight:1.45,background:'transparent',border:'2px solid '+AMBER,borderRadius:8,outline:'none',resize:'none',padding:'2px 4px',flex:1,boxSizing:'border-box'}}/>
    ):(
<div
  style={{flex:1,minHeight:0,overflow:'hidden',position:'relative',borderRadius:6,padding:'2px 4px',transition:'background .15s',cursor:structureMode?'text':'inherit',border:'2px solid transparent'}}
  onClick={function(){if(structureMode){setSynVal(draft.synopsis||'');setEditSyn(true);}}}
  onMouseEnter={function(e){if(structureMode)e.currentTarget.style.background='rgba(196,94,40,.06)';}}
  onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>
  {draft.synopsis?(
<div style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38',lineHeight:1.45,display:'-webkit-box',WebkitLineClamp:5,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{draft.synopsis}</div>
  ):bodyPreview?(
<div style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:'rgba(122,90,56,.75)',fontStyle:'italic',lineHeight:1.45,display:'-webkit-box',WebkitLineClamp:5,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{bodyPreview}</div>
  ):(
<div style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:'rgba(122,90,56,.4)',fontStyle:'italic',lineHeight:1.45}}>{structureMode?'Click to add synopsis…':'Start writing…'}</div>
  )}
</div>
    )}

    {/* Strand chips + tag button — expanded in structure mode */}
    {structureMode&&(
<div>
  <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:tagged.length>0?6:0}}>
    {tagged.map(function(st){return(
<div key={st.id} style={{display:'flex',alignItems:'center',gap:5,padding:'3px 8px',borderRadius:12,background:st.spoolColor+'22',border:'1px solid '+st.spoolColor}}>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:11,color:st.spoolColor,fontWeight:600}}>{st.name}</span>
  <button onClick={function(e){e.stopPropagation();setStrandConfirmId(st.id);setStrandConfirm(true);}} style={{background:'none',border:'none',cursor:'pointer',padding:0,display:'flex',alignItems:'center',color:st.spoolColor,opacity:.7}}>
    <span className="material-symbols-outlined" style={{fontSize:14}}>close</span>
  </button>
</div>
    );})}
  </div>
  {/* Tag new strand */}
  <StrandTagPicker draft={draft} app={app} pid={pid} tagged={tagged}/>
</div>
    )}

    {/* Bottom row */}
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0,marginTop:'auto'}}>
      {/* Left: strand circles (standard mode only) */}
      {!structureMode&&(
<div style={{display:'flex',alignItems:'center'}}>
  {visibleStrands.map(function(st,i){return(
<div key={st.id} style={{width:25,height:25,borderRadius:'50%',background:st.color||'#c45e28',border:'2px solid '+(st.spoolColor||AMBER),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,marginLeft:i>0?-8:0,boxSizing:'border-box',position:'relative',zIndex:visibleStrands.length-i,cursor:'default'}}
  onMouseEnter={function(e){var tt=document.getElementById('woven-tt');if(tt){var r=e.currentTarget.getBoundingClientRect();tt.textContent=st.name;tt.style.display='block';tt.style.left=(r.left+r.width/2)+'px';tt.style.top=(r.bottom+6)+'px';}}}
  onMouseLeave={function(){var tt=document.getElementById('woven-tt');if(tt)tt.style.display='none';}}>
  {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:st.emoji?<span style={{fontSize:11}}>{st.emoji}</span>:<span style={{fontFamily:'DM Sans, sans-serif',fontSize:9,fontWeight:700,color:'#fff'}}>{initials(st.name)}</span>}
</div>
  );})}
  {overflow>0&&(
<div ref={overflowRef} onMouseEnter={showOverflow} onMouseLeave={hideOverflow} style={{width:25,height:25,borderRadius:'50%',background:'#E2D0B8',border:'1px solid #A88060',display:'flex',alignItems:'center',justifyContent:'center',marginLeft:-8,flexShrink:0,cursor:'default',zIndex:0}}>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:10,color:'#7A5A38',fontWeight:600}}>+{overflow}</span>
  <div ref={overflowTt} style={{position:'fixed',opacity:0,transition:'opacity .15s',background:'#7A5A38',color:'#fdf8f0',fontSize:11,padding:'5px 10px',borderRadius:6,pointerEvents:'none',zIndex:9999,whiteSpace:'pre',lineHeight:1.6}}>{tagged.slice(3).map(function(s){return s.name;}).join('\n')}</div>
</div>
  )}
</div>
      )}
      {/* Left: arrows in structure mode — hidden when order is derived from dates */}
      {structureMode&&canReorder&&(
<div style={{display:'flex',alignItems:'center',gap:4}}>
  <button onClick={function(e){e.stopPropagation();if(onMoveUp)onMoveUp(draft.id);}} title="Move left" style={{width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'var(--bg2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>
    <span className="material-symbols-outlined" style={{fontSize:16,color:'var(--mid)'}}>arrow_back</span>
  </button>
  <button onClick={function(e){e.stopPropagation();if(onMoveDown)onMoveDown(draft.id);}} title="Move right" style={{width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'var(--bg2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>
    <span className="material-symbols-outlined" style={{fontSize:16,color:'var(--mid)'}}>arrow_forward</span>
  </button>
</div>
      )}
      {!structureMode&&<div/>}
      {/* Right: status dot + word count */}
      <div className="status-dot-wrap" style={{display:'flex',alignItems:'center',gap:8}} onClick={function(e){e.stopPropagation();}}>
        <StatusDotWithArchive draft={draft} app={app} showLabel={false} dotSize={15}/>
        <span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#a88060'}}>{(draft.wordCount||0)}w</span>
      </div>
    </div>
  </div>

  {archiveConfirm&&<ArchiveConfirmModal draft={draft} allDrafts={app.allDrafts[pid]||[]} onConfirm={doArchive} onCancel={function(){setArchiveConfirm(false);}}/>}
  {strandConfirm&&(function(){
    var confirmSt=tagged.find(function(t){return t.id===strandConfirmId;});
    var spoolName=confirmSt?confirmSt.collName:'Spool';
    var strandName=confirmSt?confirmSt.name:'this item';
    return(
<div style={{position:'fixed',inset:0,zIndex:600,display:'flex',alignItems:'center',justifyContent:'center'}}>
  <div style={{position:'absolute',inset:0,background:'rgba(42,31,16,.3)'}} onClick={function(){setStrandConfirm(false);}}/>
  <div style={{position:'relative',background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:12,padding:24,width:300,boxShadow:'0 12px 40px rgba(42,31,16,.15)'}}>
    <div style={{fontFamily:'var(--serif)',fontSize:16,fontWeight:600,marginBottom:8,color:'var(--text)'}}>Remove {strandName} from {spoolName}?</div>
    <div style={{fontSize:13,color:'var(--mid)',marginBottom:16}}>This removes the tag from this draft. The {strandName} entry in your {spoolName} spool won't be deleted.</div>
    <div style={{display:'flex',gap:8}}>
      <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={function(){setStrandConfirm(false);}}>Cancel</button>
      <button className="btn btn-primary" style={{flex:1,justifyContent:'center',background:'var(--danger)'}} onClick={function(){removeStrand(strandConfirmId);}}>Remove</button>
    </div>
  </div>
</div>
    );
  })()}
</div>
  );
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
function LooseThreadsSection({threads,app,view,structureMode,filter}){
  var hasActiveFilter=filterCriteriaCount(filter)>0;
  var filteredThreads=hasActiveFilter?threads.filter(function(t){return draftMatchesFilter(t,filter);}):threads;
  var sortedThreads=filteredThreads.slice().sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});
  var sex=useState(false);var expanded=sex[0];var setExpanded=sex[1];
  var pid=app.projId;

  // Deferred creation — mirrors GlobalLooseThreads: nothing is persisted
  // until the drawer actually has a title, notes, or a tagged spool.
  var soi=useState(null);var openLTId=soi[0];var setOpenLTId=soi[1];
  var spl=useState(null);var pendingLT=spl[0];var setPendingLT=spl[1];
  function openCreateFlow(){
    var id=genId();
    setPendingLT({id:id,projectId:pid,title:'',synopsis:'',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    setOpenLTId(id);
  }
  var activeLT=pendingLT&&pendingLT.id===openLTId?pendingLT:threads.find(function(d){return d.id===openLTId;});
  function handleDrawerUpdate(changes){
    if(pendingLT&&pendingLT.id===openLTId){
      var merged=Object.assign({},pendingLT,changes);
      var hasContent=(merged.title&&merged.title.trim())||(merged.synopsis&&merged.synopsis.trim())||(merged.strandTags&&merged.strandTags.length>0);
      if(hasContent){
        app.addDraft(pid,merged);
        setPendingLT(null);
      } else {
        setPendingLT(merged);
      }
      return;
    }
    app.updateDraft(pid,openLTId,changes);
  }
  function handleDrawerClose(){setPendingLT(null);setOpenLTId(null);}
  function handleDrawerDelete(){
    if(pendingLT&&pendingLT.id===openLTId){handleDrawerClose();return;}
    app.updateDraft(pid,openLTId,{archived:true});
    setOpenLTId(null);
  }

  var showFab=view==='cards'||view==='table';
  var fab=showFab&&(
<button onClick={openCreateFlow} title="Add a loose thread" style={{position:'fixed',bottom:28,right:28,width:52,height:52,borderRadius:'50%',background:'#DF6321',border:'none',boxShadow:'0 4px 14px rgba(42,31,16,.25)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:400,transition:'background .15s ease'}}
  onMouseEnter={function(e){e.currentTarget.style.background='#6B4A26';}}
  onMouseLeave={function(e){e.currentTarget.style.background='#DF6321';}}>
  <span className="material-symbols-outlined" style={{fontSize:26,color:'#F5EDE0'}}>add</span>
</button>
  );
  var drawer=openLTId&&activeLT&&(
<LooseThreadDrawer lt={activeLT} mode="project" app={app} pid={pid} open={true} variant="overlay" topOffset={54} onUpdate={handleDrawerUpdate} onClose={handleDrawerClose} onDelete={handleDrawerDelete}/>
  );

  if(view==='table'){return(
<>
  {fab}
  {drawer}
</>
  );}

  // How many tiles fit in one row (approx based on tile width 220+10gap)
  // Approximate how many 230px tiles fit in the section (minus ~32px padding each side)
  var ONE_ROW=Math.max(3,Math.floor((window.innerWidth-64)/(230+10)));
  var displayedThreads=expanded?sortedThreads:sortedThreads.slice(0,ONE_ROW);
  var inStructure=view==='cards'&&structureMode;

  return(
<div
  style={{background:'#F5EDE0',padding:'16px 16px 24px',marginTop:0}}
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){
    e.preventDefault();var fromId=e.dataTransfer.getData('draftId');if(!fromId)return;
    var allDr=app.allDrafts[app.projId]||[];var fromDraft=allDr.find(function(d){return d.id===fromId;});
    if(fromDraft&&fromDraft.status!=='loose_thread')app.updateDraft(app.projId,fromId,{status:'loose_thread',order:null,parentId:null});
  }}>
  {/* Section header */}
  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
    <span style={{fontFamily:'DM Sans, sans-serif',fontWeight:600,fontSize:16,color:'var(--text)'}}>Loose Threads</span>
    {filteredThreads.length>0&&<span style={{background:'var(--indigo)',color:'#fff',borderRadius:'50%',width:22,height:22,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{filteredThreads.length}</span>}
    {filteredThreads.length>ONE_ROW&&(
<button onClick={function(){setExpanded(!expanded);}} title={expanded?'Collapse':'Expand all'} style={{marginLeft:'auto',display:'flex',alignItems:'center',background:'transparent',border:'none',cursor:'pointer',color:'var(--mid)',padding:4}}>
  <span className="material-symbols-outlined" style={{fontSize:22}}>{expanded?'collapse_all':'expand_all'}</span>
</button>
    )}
  </div>
  {/* Tile grid */}
  <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
    {/* Ghost add tile */}
    <div onClick={openCreateFlow} style={{background:'transparent',border:'2px dashed #A88060',padding:'10px 15px',borderRadius:15,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,width:220,flexShrink:0,minHeight:80,transition:'border-color .15s'}}
      onMouseEnter={function(e){e.currentTarget.style.borderColor='#c45e28';}}
      onMouseLeave={function(e){e.currentTarget.style.borderColor='#A88060';}}>
      <span className="material-symbols-outlined" style={{fontSize:28,color:'#A88060'}}>add_circle</span>
    </div>
    {displayedThreads.map(function(d){
      var bodyPreview=d.body?stripHtml(d.body).slice(0,200):'';
      var projStrands=app.allStrands[pid]||{};
      var projTemplates=app.allTemplates[pid]||[];
      var tagged=[];
      Object.keys(projStrands).forEach(function(coll){
        (projStrands[coll]||[]).forEach(function(st){
          if((d.strandTags||[]).includes(st.id)){
            var tpl=projTemplates.find(function(t){return t.name===coll||t.id===st.templateId;});
            tagged.push(Object.assign({},st,{spoolColor:tpl&&tpl.color?tpl.color:'#c45e28'}));
          }
        });
      });
      function showTt(e,name){var tt=document.getElementById('woven-tt');if(tt){var r=e.currentTarget.getBoundingClientRect();tt.textContent=name;tt.style.display='block';tt.style.left=(r.left+r.width/2)+'px';tt.style.top=(r.bottom+6)+'px';}}
      function hideTt(){var tt=document.getElementById('woven-tt');if(tt)tt.style.display='none';}
      return(
<div key={d.id} style={{background:'#FDF8F0',border:'2px solid transparent',padding:'10px 15px',borderRadius:15,cursor:inStructure?'grab':'pointer',display:'flex',flexDirection:'column',gap:8,width:220,flexShrink:0,transition:'border-color .2s,box-shadow .2s'}}
  draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('draftId',d.id);}}
  onClick={function(){if(!inStructure)app.openDraft(d.id);}}
  onMouseEnter={function(e){e.currentTarget.style.borderColor='#c45e28';e.currentTarget.style.boxShadow='0 4px 12px rgba(196,94,40,.12)';}}
  onMouseLeave={function(e){e.currentTarget.style.borderColor='transparent';e.currentTarget.style.boxShadow='none';}}>
  <div style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:18,color:'#2A1F10',lineHeight:1.25,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
    {d.title||'Untitled loose thread'}
  </div>
  {bodyPreview&&(
<div style={{fontFamily:'DM Sans, sans-serif',fontSize:16,fontStyle:'italic',color:'#A88060',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
  {bodyPreview}
</div>
  )}
  {inStructure&&(
<div onClick={function(e){e.stopPropagation();}}>
  <StrandTagPicker draft={d} app={app} pid={pid} tagged={tagged}/>
</div>
  )}
  {/* Bottom row */}
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:'auto'}}>
    {!inStructure&&(
<div style={{display:'flex',alignItems:'center'}}>
  {tagged.slice(0,3).map(function(st,i){return(
<div key={st.id} style={{width:22,height:22,borderRadius:'50%',background:st.color||'#c45e28',border:'2px solid '+(st.spoolColor||'#c45e28'),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,marginLeft:i>0?-7:0,boxSizing:'border-box',position:'relative',zIndex:3-i,cursor:'default'}}
  onMouseEnter={function(e){showTt(e,st.name);}} onMouseLeave={hideTt}>
  {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:st.emoji?<span style={{fontSize:10}}>{st.emoji}</span>:<span style={{fontFamily:'DM Sans, sans-serif',fontSize:8,fontWeight:700,color:'#fff'}}>{initials(st.name)}</span>}
</div>
  );})}
  {tagged.length>3&&(
<div style={{width:22,height:22,borderRadius:'50%',background:'#E2D0B8',border:'1px solid #A88060',display:'flex',alignItems:'center',justifyContent:'center',marginLeft:-7,flexShrink:0,zIndex:0,cursor:'default'}}
  onMouseEnter={function(e){showTt(e,tagged.slice(3).map(function(s){return s.name;}).join(', '));}} onMouseLeave={hideTt}>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:9,color:'#7A5A38',fontWeight:600}}>+{tagged.length-3}</span>
</div>
      )}
</div>
    )}
    {inStructure&&(
<button onClick={function(e){e.stopPropagation();var seq=(app.allDrafts[pid]||[]).filter(function(x){return x.status!=='loose_thread'&&!x.parentId&&!x.archived;});var maxOrder=seq.reduce(function(m,x){return Math.max(m,x.order||0);},0);app.updateDraft(pid,d.id,{status:'first_draft',order:maxOrder+1,parentId:null});}} title="Move to sequence" style={{width:26,height:26,borderRadius:6,border:'1px solid var(--border)',background:'var(--bg2)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>
  <span className="material-symbols-outlined" style={{fontSize:16,color:'var(--mid)'}}>arrow_upward</span>
</button>
    )}
    <div style={{display:'flex',alignItems:'center',marginLeft:'auto'}} onClick={function(e){e.stopPropagation();}}>
      <StatusDotWithArchive draft={d} app={app} showLabel={false} dotSize={13}/>
    </div>
  </div>
</div>
      );
    })}
    {sortedThreads.length===0&&(
<div style={{fontSize:13,color:'var(--placeholder)',fontStyle:'italic',padding:'8px 0'}}>No loose threads yet. Drag a draft here or click + to add one.</div>
    )}
  </div>
  {fab}
  {drawer}
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
  var sf=useState(function(){return loadFilterState(app.projId);});var filter=sf[0];var setFilterRaw=sf[1];
  function setFilter(next){setFilterRaw(next);persistFilterState(app.projId,next);}
  var ss=useState('order');var sort=ss[0];var setSort=ss[1];
  var sb=useState(false);var bindOpen=sb[0];var setBindOpen=sb[1];
  var sst=useState(false);var structureMode=sst[0];var setStructureMode=sst[1];
  var sq=useState('');var searchQ=sq[0];var setSearchQ=sq[1];
  var allDrafts=app.allDrafts[app.projId]||[];
  var seqDrafts=allDrafts.filter(function(d){return !d.archived&&d.status!=='loose_thread'&&!d.parentId;});
  var ltDrafts=allDrafts.filter(function(d){return !d.archived&&d.status==='loose_thread';});
  var tree=buildTree(allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.archived;}));
  function addDraft(){var nid=genId();app.addDraft(app.projId,{id:nid,projectId:app.projId,title:'',synopsis:'',status:'first_draft',order:seqDrafts.length+1,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});app.openDraft(nid);}
  function moveUp(did){var sorted=seqDrafts.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});var idx=sorted.findIndex(function(d){return d.id===did;});if(idx<=0)return;app.reorderDraft(app.projId,did,sorted[idx-1].order||0);}
  function moveDown(did){var sorted=seqDrafts.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});var idx=sorted.findIndex(function(d){return d.id===did;});if(idx<0||idx>=sorted.length-1)return;app.reorderDraft(app.projId,did,sorted[idx+1].order||0);}
  var displayed=(sort==='order'?sortDraftsBySequence(applyFS(tree,filter,sort),app.currentProject):applyFS(tree,filter,sort)).filter(function(p){
    if(!searchQ.trim())return true;
    var q=searchQ.toLowerCase();
    var matchTitle=(p.title||'').toLowerCase().includes(q);
    var matchSyn=(p.synopsis||'').toLowerCase().includes(q);
    var matchBody=p.body?stripHtml(p.body).toLowerCase().includes(q):false;
    return matchTitle||matchSyn||matchBody;
  });
  return(
<div className="view-layout">
  <ViewHeader app={app} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onAddDraft={addDraft} onBind={function(){setBindOpen(true);}} structureMode={structureMode} onStructureToggle={function(v){setStructureMode(v);}} searchQ={searchQ} onSearch={setSearchQ} resultCount={displayed.length}/>
  <div className="view-area dot-grid">
    {app.dataLoading?<DraftLoadingSpinner/>:tree.length===0?<EmptyDrafts onAdd={addDraft}/>:(
<div className="cards-grid"
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){
    e.preventDefault();
    var fromId=e.dataTransfer.getData('draftId');if(!fromId)return;
    var allDr=app.allDrafts[pid]||[];
    var fromDraft=allDr.find(function(d){return d.id===fromId;});
    if(fromDraft&&fromDraft.status==='loose_thread'){
      var seq=allDr.filter(function(d){return d.status!=='loose_thread'&&!d.parentId&&!d.archived;});
      var maxOrder=seq.reduce(function(m,d){return Math.max(m,d.order||0);},0);
      app.updateDraft(pid,fromId,{status:'first_draft',order:maxOrder+1,parentId:null});
    }
  }}>
  {displayed.map(function(parent){
    var childCount=parent.children?parent.children.length:0;
    var sortedSeq=seqDrafts.slice().sort(function(a,b){return (a.order||0)-(b.order||0);});
    var seqIdx=sortedSeq.findIndex(function(d){return d.id===parent.id;});
    return <DraftCard key={parent.id} draft={parent} label={''+(seqIdx>=0?seqIdx+1:'?')} app={app} onMoveUp={moveUp} onMoveDown={moveDown} structureMode={structureMode}/>;
  })}
</div>
    )}
    <LooseThreadsSection threads={ltDrafts} app={app} view="cards" structureMode={structureMode} filter={filter}/>
    <div style={{height:50,background:'#A88060',flexShrink:0,marginTop:'auto'}}/>
  </div>
  <BindDrawer app={app} open={bindOpen} variant="overlay" topOffset={54} onClose={function(){setBindOpen(false);}} activeFilter={filter}/>
</div>
  );
}

// ── TilesView ──
function TilesView({app}){
  var sf=useState(function(){return loadFilterState(app.projId);});var filter=sf[0];var setFilterRaw=sf[1];
  function setFilter(next){setFilterRaw(next);persistFilterState(app.projId,next);}
  var ss=useState('order');var sort=ss[0];var setSort=ss[1];
  var sb=useState(false);var bindOpen=sb[0];var setBindOpen=sb[1];
  var so2=useState(null);var dragOver=so2[0];var setDragOver=so2[1];
  var sn=useState(null);var nestTarget=sn[0];var setNestTarget=sn[1];
  var nestTimer=useRef(null);
  var allDrafts=app.allDrafts[app.projId]||[];
  var tree=buildTree(allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.archived;}));
  var ltDrafts=allDrafts.filter(function(d){return !d.archived&&d.status==='loose_thread';});
  function addDraft(){var seqCount=allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).length;app.addDraft(app.projId,{id:genId(),projectId:app.projId,title:'',synopsis:'',status:'first_draft',order:seqCount+1,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
  var displayed=sort==='order'?sortDraftsBySequence(applyFS(tree,filter,sort),app.currentProject):applyFS(tree,filter,sort);
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
  <BindDrawer app={app} open={bindOpen} variant="overlay" topOffset={54} onClose={function(){setBindOpen(false);}} activeFilter={filter}/>
</div>
  );
}

// ── TableView ──
function TableView({app}){
  var tblNumbered=projIsNumbered(app.currentProject);
  var tblByDate=projSequence(app.currentProject)==='date';
  var sf=useState(function(){return loadFilterState(app.projId);});var filter=sf[0];var setFilterRaw=sf[1];
  function setFilter(next){setFilterRaw(next);persistFilterState(app.projId,next);}
  var ss=useState('order');var sort=ss[0];var setSort=ss[1];
  var sb=useState(false);var bindOpen=sb[0];var setBindOpen=sb[1];
  var sq=useState('');var searchQ=sq[0];var setSearchQ=sq[1];
  var so2=useState(null);var dragOver=so2[0];var setDragOver=so2[1];
  var sco=useState(false);var colOpen=sco[0];var setColOpen=sco[1];
  var scp=useState({top:0,left:0,right:0});var colPos=scp[0];var setColPos=scp[1];
  var colRef=useRef(null);
  // Column visibility
  var projKey='colvis:'+app.projId;
  var svc=useState(function(){try{var v=localStorage.getItem(projKey);return v?JSON.parse(v):DEFAULT_TABLE_COLS;}catch(e){return DEFAULT_TABLE_COLS;}});
  var visCols=svc[0];var setVisCols=svc[1];
  var scw=useState({title:160,synopsis:260,status:130,strandTags:160,wordCount:64});
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
    {id:'synopsis',label:'Synopsis'}
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
  var ltDrafts=allDrafts.filter(function(d){return d.status==='loose_thread'&&!d.archived;});
  var displayed=(sort==='order'?sortDraftsBySequence(applyFS(tree,filter,sort),app.currentProject):applyFS(tree,filter,sort)).filter(function(p){
    if(!searchQ.trim())return true;
    var q=searchQ.toLowerCase();
    return (p.title||'').toLowerCase().includes(q)||(p.synopsis||'').toLowerCase().includes(q)||(p.body?stripHtml(p.body).toLowerCase().includes(q):false);
  });
  function addDraft(){var seqCount=allDrafts.filter(function(d){return d.status!=='loose_thread'&&!d.parentId;}).length;app.addDraft(app.projId,{id:genId(),projectId:app.projId,title:'',synopsis:'',status:'first_draft',order:seqCount+1,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
  var tblProjStrands=app.allStrands[app.projId]||{};
  var tblProjTemplates=app.allTemplates[app.projId]||[];
  function renderCell(col,draft){
    if(col==='title')return <input className="tbl-inp" style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:16,color:'#2a1f10',textOverflow:'ellipsis',overflow:'hidden',whiteSpace:'nowrap'}} title={draft.title||''} defaultValue={draft.title} placeholder="Untitled" onBlur={function(e){app.updateDraft(app.projId,draft.id,{title:e.target.value});}}/>;
    if(col==='status'){var si=STATUSES[draft.status]||STATUSES.first_draft;return(
<div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:12,background:si.color+'18'}}>
  <StatusDotWithArchive draft={draft} app={app} showLabel={false} dotSize={12}/>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:13,color:si.color,fontWeight:500,whiteSpace:'nowrap'}}>{si.label}</span>
</div>
    );}
    if(col==='wordCount')return <span style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38'}}>{draft.wordCount||0}</span>;
    if(col==='synopsis')return <input className="tbl-inp" defaultValue={draft.synopsis} placeholder="No synopsis…" onBlur={function(e){app.updateDraft(app.projId,draft.id,{synopsis:e.target.value});}} style={{width:'100%',fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38',fontStyle:draft.synopsis?'normal':'italic',opacity:draft.synopsis?1:.75}}/>;
    if(col==='strandTags'){var ts2=[];Object.keys(tblProjStrands).forEach(function(c){(tblProjStrands[c]||[]).forEach(function(st){if((draft.strandTags||[]).includes(st.id)){var tpl=tblProjTemplates.find(function(t){return t.name===c||t.id===st.templateId;});ts2.push(Object.assign({},st,{spoolColor:tpl&&tpl.color?tpl.color:'#c45e28'}));}});});return(
<div style={{display:'flex',alignItems:'center',gap:-4,overflow:'hidden'}}>
  {ts2.slice(0,4).map(function(st,i){return(
<div key={st.id} title={st.name} style={{width:24,height:24,borderRadius:'50%',background:st.color||'#c45e28',border:'2px solid '+(st.spoolColor||'#c45e28'),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,marginLeft:i>0?-6:0,boxSizing:'border-box',cursor:'default'}}
  onMouseEnter={function(e){var tt=document.getElementById('woven-tt');if(tt){var r=e.currentTarget.getBoundingClientRect();tt.textContent=st.name;tt.style.display='block';tt.style.left=(r.left+r.width/2)+'px';tt.style.top=(r.bottom+6)+'px';}}}
  onMouseLeave={function(){var tt=document.getElementById('woven-tt');if(tt)tt.style.display='none';}}>
  {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontFamily:'DM Sans, sans-serif',fontSize:8,fontWeight:700,color:'#fff'}}>{initials(st.name)}</span>}
</div>
  );})}
  {ts2.length>4&&<span style={{marginLeft:2,fontSize:11,color:'#7A5A38'}}>+{ts2.length-4}</span>}
</div>
    );}
    if(col.startsWith('cf_')){
      var fid=col.slice(3);
      var cfVal=draft.customFields&&draft.customFields[fid]?draft.customFields[fid]:'';
      var fieldDef=draftFieldDefs.find(function(f){return f.id===fid;});
      if(fieldDef&&fieldDef.type==='strand_ref'){
        var refIds=[];try{var parsed=JSON.parse(cfVal);if(Array.isArray(parsed))refIds=parsed;}catch(e){}
        var projStrandsAll=app.allStrands[app.projId]||{};
        var flatStrands=[];Object.keys(projStrandsAll).forEach(function(c){(projStrandsAll[c]||[]).forEach(function(st){flatStrands.push(st);});});
        var refNames=refIds.map(function(id){var st=flatStrands.find(function(s){return s.id===id;});return st?st.name:null;}).filter(Boolean);
        return <span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:refNames.length?'#7A5A38':'var(--placeholder)',fontStyle:refNames.length?'normal':'italic'}}>{refNames.length?refNames.join(', '):'—'}</span>;
      }
      return <input className="tbl-inp" defaultValue={cfVal} placeholder="—" onBlur={function(e){var cf=Object.assign({},draft.customFields||{});cf[fid]=e.target.value;app.updateDraft(app.projId,draft.id,{customFields:cf});}} style={{width:'100%',fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38',fontStyle:cfVal?'normal':'italic',opacity:cfVal?1:.75}}/>;
    }
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
  {(tblNumbered||tblByDate)&&(
  <td style={{color:'var(--mid)',fontSize:11,whiteSpace:'nowrap',paddingLeft:isNested?28:12}}>
    <div style={{display:'flex',alignItems:'center',gap:2}}>
      {hasChildren&&<span className="mi" style={{fontSize:16,cursor:'pointer',color:'var(--mid)',flexShrink:0,lineHeight:1}} onClick={function(){app.updateDraft(app.projId,draft.id,{nestExpanded:!isExpanded});}}>{isExpanded?'expand_less':'expand_more'}</span>}
      {isNested&&<span className="mi" style={{fontSize:12,color:'var(--border)',flexShrink:0}}>subdirectory_arrow_right</span>}
      {tblNumbered?label:formatDraftDate(draftDateOf(draft))}
    </div>
  </td>
  )}
  {visCols.map(function(col){return <td key={col}>{renderCell(col,draft)}</td>;})}
  <td><button onClick={function(){app.openDraft(draft.id);}} title="Open draft" style={{background:'transparent',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center',color:'var(--mid)',transition:'color .15s'}} onMouseOver={function(e){e.currentTarget.style.color='var(--indigo)';}} onMouseOut={function(e){e.currentTarget.style.color='var(--mid)';}}>
    <span className="material-symbols-outlined" style={{fontSize:20}}>arrow_forward</span>
  </button></td>
</tr>
  );}
  return(
<div className="view-layout">
  <ViewHeader app={app} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onAddDraft={addDraft} onBind={function(){setBindOpen(true);}} hideStructure={true} searchQ={searchQ} onSearch={setSearchQ} resultCount={displayed.length}/>
  <div className="table-wrap" style={{display:'flex',flexDirection:'column',flex:1,overflow:'auto',padding:20}}>
    {app.dataLoading?<DraftLoadingSpinner/>:tree.length===0?<EmptyDrafts onAdd={addDraft}/>:(
<div>
  <table className="wt">
    <thead>
      <tr style={{background:'#E2D0B8'}}>
        <th style={{width:28,background:'#E2D0B8'}}/>
        {tblNumbered&&<th style={{width:36,background:'#E2D0B8',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#6B4A26',fontWeight:600}}>#</th>}
        {tblByDate&&<th style={{width:96,background:'#E2D0B8',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#6B4A26',fontWeight:600}}>Date</th>}
        {visCols.map(function(col,ci){var av=allAvailCols.find(function(c){return c.id===col;});return(
<th key={col} style={{width:colWidths[col]||160,maxWidth:colWidths[col]||160,background:'#E2D0B8',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#6B4A26',fontWeight:600,cursor:'grab',userSelect:'none'}} className="resizable"
  draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('colIdx',''+ci);}}
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){e.preventDefault();var from=parseInt(e.dataTransfer.getData('colIdx'),10);if(isNaN(from)||from===ci)return;var nc=visCols.slice();var item=nc.splice(from,1)[0];nc.splice(ci,0,item);setVisCols(nc);try{localStorage.setItem(projKey,JSON.stringify(nc));}catch(e){}}} >
  {av?av.label:col}
  <div className="col-resize-handle" onMouseDown={function(e){e.stopPropagation();startResize(col,e);}}/>
</th>
        );})}
        <th style={{width:46,background:'#E2D0B8'}}>
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
  <BindDrawer app={app} open={bindOpen} variant="overlay" topOffset={54} onClose={function(){setBindOpen(false);}} activeFilter={filter}/>
  <LooseThreadsSection threads={ltDrafts} app={app} view="table" filter={filter}/>
</div>
  );
}


// AddFieldInline, PropertiesDrawer, EditorStrandsPanel, StrandDetailDrawer, and
// VersionHistoryPanel now live in ./SharedUI, ./PropertiesDrawer, ./StrandsDrawer, ./VersionsDrawer

// ── StrandsDropdown ──
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

// EditorView was dead code (never rendered — DraftEditor.jsx is the real editor screen). Removed.

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
  var tpl=(app.allTemplates[pid]||[]).find(function(t){return t.name===coll;});
  var isNative=!tpl||tpl.projectId===pid;
  function commitRename(){
    var nc=val.trim();
    if(nc&&nc!==coll){app.setAllStrands(function(prev){var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});ps[nc]=ps[coll]||[];delete ps[coll];n[pid]=ps;saveDB('woven:strands:'+pid,ps);return n;});if(activeColl===coll)setActiveColl(nc);}
    else{setVal(coll);}setEditing(false);
  }
  if(editing)return(<div className="strands-tab active" style={{padding:'0 4px'}}><input autoFocus value={val} onChange={function(e){setVal(e.target.value);}} onBlur={commitRename} onKeyDown={function(e){if(e.key==='Enter')commitRename();if(e.key==='Escape'){setVal(coll);setEditing(false);}}} style={{width:90,height:24,fontSize:13,padding:'2px 6px',borderRadius:4}}/></div>);
  var tabIcon=tpl&&tpl.icon?tpl.icon:null;
  var tabColor=tpl&&tpl.color?tpl.color:'#7A5A38';
  return(<div className={'strands-tab'+(isActive?' active':'')} onClick={function(){setActiveColl(coll);setActiveStrandId(null);setSearch('');setShowCollSettings(false);}} onDoubleClick={function(){if(isNative)setEditing(true);}} title={isNative?undefined:'Shared from another project — rename from its source'} style={{display:'flex',alignItems:'center',gap:6}}>
    {tabIcon&&<span className="material-symbols-outlined" style={{fontSize:16,color:isActive?tabColor:'rgba(122,90,56,.75)'}}>{tabIcon}</span>}
    {coll}
  </div>);
}



// ── IconSearchPopup ──
// Uses full Material Symbols library — no hardcoded list
var ICON_CATEGORIES={
  'Narrative & Writing':['auto_stories','book_ribbon','edit_note','history_edu','create','draw','stylus_note','ink_highlighter','quill','ink_pen','description','article','library_books','menu_book','local_library','sticky_note_2','assignment','topic','newsstand','feed','drafts'],
  'People':['person','group','diversity_3','family_restroom','child_care','elderly','face','waving_hand','handshake','supervisor_account','manage_accounts','badge','contacts','emoji_people','social_distance','connect_without_contact'],
  'Places':['location_on','map','home','apartment','castle','cottage','cabin','park','forest','beach_access','landscape','terrain','public','travel_explore','flight','train','directions_car','anchor','explore','near_me'],
  'Nature & World':['nature','water','fire','water_drop','air','eco','recycling','sunny','storm','cloud','wb_sunny','nights_stay','ac_unit','tsunami','volcano','energy_savings_leaf','solar_power','wind_power','grass','flower'],
  'Objects & Items':['key','lock','shield','sword','diamond','crown','trophy','flag','bookmark','label','tag','star','favorite','gift','cake','coffee','restaurant','local_pizza','wine_bar','sports_bar'],
  'Science & Tech':['science','biotech','experiment','microbiology','telescope','microscope','satellite_alt','psychology','lightbulb','hub','code','terminal','database','computer','phone_android','watch','rocket_launch','smart_toy'],
  'Arts & Culture':['palette','brush','photo_camera','music_note','headphones','piano','mic','theater_comedy','movie','sports_esports','casino','sports','emoji_objects','gesture','animation','casino'],
  'Health & Body':['medical_services','stethoscope','vaccines','medication','monitor_heart','bloodtype','fitness_center','self_improvement','spa','yoga','emergency','biotech'],
  'Symbols':['bolt','warning','info','help','check_circle','cancel','add_circle','verified','military_tech','workspace_premium','grade','celebration','emoji_events','trending_up','analytics','savings','account_balance','gavel','campaign']
};
var ALL_PRESET_ICONS=Object.values(ICON_CATEGORIES).flat();

function IconSearchPopup({current,onSelect,onClose}){
  var sq=useState('');var q=sq[0];var setQ=sq[1];
  var showAll=!q.trim();
  var iconStyle={fontFamily:"'Material Symbols Outlined'",fontStyle:'normal',fontSize:24,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',letterSpacing:'normal',textTransform:'none',direction:'ltr',WebkitFontSmoothing:'antialiased'};

  // When typing, try to show any valid icon name — material symbols accepts any string
  // Show curated categories when no search, or filtered presets + the raw typed name
  var results=showAll?ALL_PRESET_ICONS:ALL_PRESET_ICONS.filter(function(ic){return ic.includes(q.toLowerCase().replace(/\s+/g,'_'));});
  var typedName=q.trim().toLowerCase().replace(/\s+/g,'_');
  var showTyped=typedName&&!results.includes(typedName);

  return(
<div style={{position:'fixed',inset:0,zIndex:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
  <div style={{position:'absolute',inset:0,background:'rgba(42,31,16,.3)'}} onClick={onClose}/>
  <div style={{position:'relative',background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:14,padding:24,width:560,maxWidth:'94vw',maxHeight:'82vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(42,31,16,.2)'}}>
    <div style={{fontFamily:'var(--serif)',fontSize:18,fontWeight:600,marginBottom:6,color:'var(--text)'}}>Choose icon</div>
    <div style={{fontSize:12,color:'var(--mid)',marginBottom:12}}>Search by name, or type any <a href="https://fonts.google.com/icons" target="_blank" rel="noopener" style={{color:'var(--indigo)'}}>Material Symbol</a> name directly.</div>
    <input autoFocus value={q} onChange={function(e){setQ(e.target.value);}} placeholder="Search icons (e.g. dragon, mountain, crystal)…" style={{padding:'8px 12px',fontSize:14,border:'1px solid var(--border)',borderRadius:8,fontFamily:'DM Sans, sans-serif',background:'var(--bg2)',color:'var(--text)',outline:'none',marginBottom:12}}/>
    <div style={{overflowY:'auto',flex:1}}>
      {/* Typed custom name — always show if it could be a valid icon */}
      {showTyped&&(
<div style={{marginBottom:14}}>
  <div style={{fontSize:11,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>Use custom icon name</div>
  <button onClick={function(){onSelect(typedName);onClose();}} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 14px',borderRadius:8,border:'1.5px solid var(--indigo)',background:'rgba(196,94,40,.06)',cursor:'pointer',width:'100%',textAlign:'left'}}>
    <span style={Object.assign({},iconStyle,{fontSize:28,color:'var(--indigo)',width:36,height:36})}>{typedName}</span>
    <div>
      <div style={{fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:600,color:'var(--indigo)'}}>{typedName}</div>
      <div style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:'var(--mid)'}}>If this is a valid Material Symbol name, it will render as an icon.</div>
    </div>
  </button>
</div>
      )}
      {/* Category sections when not searching */}
      {showAll?Object.keys(ICON_CATEGORIES).map(function(cat){return(
<div key={cat} style={{marginBottom:16}}>
  <div style={{fontSize:11,fontWeight:600,color:'var(--mid)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6}}>{cat}</div>
  <div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
    {ICON_CATEGORIES[cat].map(function(ic){var isActive=current===ic;return(
<button key={ic} onClick={function(){onSelect(ic);onClose();}} title={ic.replace(/_/g,' ')} style={{width:40,height:40,borderRadius:8,border:'1.5px solid '+(isActive?'#c45e28':'var(--border)'),background:isActive?'rgba(196,94,40,.1)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
  onMouseOver={function(e){if(!isActive)e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){if(!isActive)e.currentTarget.style.background='transparent';}}>
  <span style={Object.assign({},iconStyle,{fontSize:20,color:isActive?'#c45e28':'var(--mid)'})}>{ic}</span>
</button>
    );})}
  </div>
</div>
      )}):(
<div style={{display:'flex',gap:4,flexWrap:'wrap'}}>
  {results.map(function(ic){var isActive=current===ic;return(
<button key={ic} onClick={function(){onSelect(ic);onClose();}} title={ic.replace(/_/g,' ')} style={{width:40,height:40,borderRadius:8,border:'1.5px solid '+(isActive?'#c45e28':'var(--border)'),background:isActive?'rgba(196,94,40,.1)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
  onMouseOver={function(e){if(!isActive)e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){if(!isActive)e.currentTarget.style.background='transparent';}}>
  <span style={Object.assign({},iconStyle,{fontSize:20,color:isActive?'#c45e28':'var(--mid)'})}>{ic}</span>
</button>
  );})}
  {results.length===0&&!showTyped&&<div style={{fontSize:13,color:'var(--mid)',padding:8}}>No presets match. Type any Material Symbol name above to use it directly.</div>}
</div>
      )}
    </div>
    <button className="btn btn-ghost" style={{marginTop:14,width:'100%',justifyContent:'center'}} onClick={onClose}>Cancel</button>
  </div>
</div>
  );
}

// ── NewSpoolModal ──
var SPOOL_ICONS=['auto_stories','gesture','hub','lightbulb','book_ribbon','favorite','star','location_on','person','group','explore','psychology','edit_note','campaign','local_library','history_edu','science','palette','music_note','sports_esports'];
var SPOOL_COLORS=['#c45e28','#2f76e0','#2f9966','#ce2fe0','#e02f79','#e8a030','#b83220','#2fe07f','#64e02f','#f0c050'];
function NewSpoolModal({onConfirm,onCancel}){
  var sn=useState('');var name=sn[0];var setName=sn[1];
  var si=useState('auto_stories');var icon=si[0];var setIcon=si[1];
  var sc=useState('#c45e28');var color=sc[0];var setColor=sc[1];
  var smis=useState(false);var showModalIconSearch=smis[0];var setShowModalIconSearch=smis[1];
  var ref=useRef(null);
  useEffect(function(){if(ref.current)ref.current.focus();},[]);
  return(
<div style={{position:'fixed',inset:0,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center'}}>
  <div style={{position:'absolute',inset:0,background:'rgba(42,31,16,.3)'}} onClick={onCancel}/>
  <div style={{position:'relative',background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:'var(--rl)',padding:24,width:380,maxWidth:'92vw',boxShadow:'0 20px 60px rgba(42,31,16,.15)'}}>
    <div style={{fontFamily:'var(--serif)',fontSize:18,fontWeight:600,marginBottom:16,color:'var(--text)'}}>Create Spool</div>
    {/* Preview */}
    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,padding:'10px 14px',background:'var(--bg2)',borderRadius:8}}>
      <div style={{width:36,height:36,borderRadius:8,background:color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <span className="material-symbols-outlined" style={{fontSize:20,color:'#fff'}}>{icon}</span>
      </div>
      <span style={{fontFamily:'var(--serif)',fontSize:15,fontWeight:600,color:'var(--text)'}}>{name||'Spool name'}</span>
    </div>
    {/* Name */}
    <div style={{marginBottom:14}}>
      <span className="sect-lbl">Name</span>
      <input ref={ref} value={name} onChange={function(e){setName(e.target.value);}} placeholder="e.g. Characters, Locations…" onKeyDown={function(e){if(e.key==='Enter'&&name.trim())onConfirm(name,icon,color);if(e.key==='Escape')onCancel();}}/>
    </div>
    {/* Colour */}
    <div style={{marginBottom:14}}>
      <span className="sect-lbl">Colour</span>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
        {SPOOL_COLORS.map(function(c){return(
<div key={c} onClick={function(){setColor(c);}} style={{width:24,height:24,borderRadius:'50%',background:c,cursor:'pointer',transform:color===c?'scale(1.25)':'scale(1)',boxShadow:color===c?'0 0 0 2px var(--bg1),0 0 0 4px '+c:'none',transition:'transform .15s',flexShrink:0}}/>
        );})}
      </div>
    </div>
    {/* Icon */}
    <div style={{marginBottom:20}}>
      <span className="sect-lbl">Icon</span>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
        {SPOOL_ICONS.slice(0,10).map(function(ic){return(
<button key={ic} onClick={function(){setIcon(ic);}} style={{width:36,height:36,borderRadius:6,border:'1px solid '+(icon===ic?color:'var(--border)'),background:icon===ic?color+'22':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all .15s'}}>
  <span className="material-symbols-outlined" style={{fontSize:18,color:icon===ic?color:'var(--mid)'}}>{ic}</span>
</button>
        );})}

        <button onClick={function(){setShowModalIconSearch(true);}} style={{padding:'0 10px',height:36,borderRadius:6,border:'1px solid var(--border)',background:'transparent',cursor:'pointer',fontSize:11,fontFamily:'DM Sans, sans-serif',color:'var(--mid)',whiteSpace:'nowrap'}}>
          Search more
        </button>
        {showModalIconSearch&&<IconSearchPopup current={icon} onSelect={function(ic){setIcon(ic);}} onClose={function(){setShowModalIconSearch(false);}}/> }      </div>
    </div>
    <div style={{display:'flex',gap:8}}>
      <button className="btn btn-ghost" style={{flex:1,justifyContent:'center'}} onClick={onCancel}>Cancel</button>
      <button className="btn btn-primary" style={{flex:1,justifyContent:'center'}} onClick={function(){if(name.trim())onConfirm(name,icon,color);}} disabled={!name.trim()}>Create Spool</button>
    </div>
  </div>
</div>
  );
}


// ── StrandRefField ──
// Stores an array of {id, label} objects as JSON string
function StrandRefField({f,sid,val,pid,app,onUpdate}){
  var refCollName=f.refSpool||'';
  var refStrands=refCollName?(app.allStrands[pid]&&app.allStrands[pid][refCollName]||[]):[];
  var projTemplates=app.allTemplates[pid]||[];

  // Parse stored value — supports both legacy comma string and new JSON format
  function parseRefs(v){
    if(!v)return[];
    try{var parsed=JSON.parse(v);if(Array.isArray(parsed))return parsed;}catch(e){}
    // Legacy: plain comma-separated IDs
    return v.split(',').filter(Boolean).map(function(id){return{id:id,label:''};});
  }
  function saveRefs(refs){onUpdate(refs.length?JSON.stringify(refs):'');}

  var srl=useState(parseRefs(val));var refs=srl[0];var setRefs=srl[1];
  var sss=useState('');var selId=sss[0];var setSelId=sss[1];
  var slb=useState('');var newLabel=slb[0];var setNewLabel=slb[1];
  var ssq=useState('');var searchQ=ssq[0];var setSearchQ=ssq[1];

  if(!refCollName)return(<span style={{fontSize:13,color:'var(--mid)',fontStyle:'italic'}}>No spool linked — edit field settings.</span>);

  var selectedIds=refs.map(function(r){return r.id;});
  var available=refStrands.filter(function(st){
    if(!f.refMultiple&&refs.length>=1)return false;
    if(selectedIds.includes(st.id))return false;
    if(searchQ&&!(st.name||'').toLowerCase().includes(searchQ.toLowerCase()))return false;
    return true;
  });
  var tpl=projTemplates.find(function(t){return t.name===refCollName;});
  var spoolColor=(tpl&&tpl.color)||'#c45e28';

  function addRef(){
    if(!selId)return;
    var st=refStrands.find(function(s){return s.id===selId;});if(!st)return;
    var newRefs=refs.concat([{id:selId,label:newLabel.trim()}]);
    setRefs(newRefs);saveRefs(newRefs);setSelId('');setNewLabel('');setSearchQ('');
  }
  function removeRef(idx){var nr=refs.filter(function(_,i){return i!==idx;});setRefs(nr);saveRefs(nr);}
  function updateLabel(idx,lbl){var nr=refs.map(function(r,i){return i===idx?Object.assign({},r,{label:lbl}):r;});setRefs(nr);saveRefs(nr);}

  return(
<div style={{display:'flex',flexDirection:'column',gap:8}}>
  {/* Existing refs */}
  {refs.map(function(r,i){
    var st=refStrands.find(function(s){return s.id===r.id;});
    if(!st)return null;
    return(
<div key={r.id+i} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderRadius:10,background:spoolColor+'14',border:'1px solid '+spoolColor+'44'}}>
  {/* Circle avatar */}
  <div style={{width:24,height:24,borderRadius:'50%',background:st.color||spoolColor,border:'2px solid '+spoolColor,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,boxSizing:'border-box'}}>
    {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontFamily:'DM Sans,sans-serif',fontSize:9,fontWeight:700,color:'#fff'}}>{initials(st.name)}</span>}
  </div>
  <div style={{flex:1,minWidth:0}}>
    <div style={{fontFamily:'DM Sans,sans-serif',fontSize:12,fontWeight:600,color:spoolColor}}>{st.name}</div>
    {/* Inline label edit */}
    <input value={r.label} onChange={function(e){updateLabel(i,e.target.value);}} placeholder="Add relationship label…" style={{fontFamily:'DM Sans,sans-serif',fontSize:11,color:'var(--mid)',background:'transparent',border:'none',outline:'none',padding:0,width:'100%',fontStyle:r.label?'normal':'italic'}}/>
  </div>
  <button onClick={function(){removeRef(i);}} style={{background:'none',border:'none',cursor:'pointer',padding:2,color:spoolColor,opacity:.6,display:'flex',alignItems:'center'}}>
    <span className="material-symbols-outlined" style={{fontSize:14}}>close</span>
  </button>
</div>
    );
  })}

  {/* Add new ref — show if multiple allowed or no refs yet */}
  {(f.refMultiple||refs.length===0)&&(
<div style={{display:'flex',flexDirection:'column',gap:6,padding:'8px 10px',borderRadius:10,background:'var(--bg2)',border:'1px dashed var(--border)'}}>
  {/* Search + select */}
  <input value={searchQ} onChange={function(e){setSearchQ(e.target.value);setSelId('');}} placeholder={'Search '+refCollName+'…'} style={{fontFamily:'DM Sans,sans-serif',fontSize:12,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:6,background:'var(--bg1)',color:'var(--text)',outline:'none'}}/>
  {searchQ&&available.length>0&&(
<div style={{maxHeight:120,overflowY:'auto',border:'1px solid var(--border)',borderRadius:6,background:'var(--bg1)'}}>
  {available.map(function(st){return(
<div key={st.id} onClick={function(){setSelId(st.id);setSearchQ(st.name);}} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',cursor:'pointer',borderBottom:'1px solid var(--bg2)'}}
  onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <div style={{width:18,height:18,borderRadius:'50%',background:st.color||spoolColor,flexShrink:0}}/>
  <span style={{fontSize:12,fontFamily:'DM Sans,sans-serif',color:'var(--text)'}}>{st.name}</span>
</div>
  );})}
</div>
  )}
  {searchQ&&available.length===0&&<span style={{fontSize:11,color:'var(--mid)',fontStyle:'italic'}}>No matches.</span>}
  {selId&&(
<input value={newLabel} onChange={function(e){setNewLabel(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter')addRef();}} placeholder="Relationship label (e.g. Mother, Mentor)…" style={{fontFamily:'DM Sans,sans-serif',fontSize:12,padding:'4px 8px',border:'1px solid var(--border)',borderRadius:6,background:'var(--bg1)',color:'var(--text)',outline:'none'}}/>
  )}
  {selId&&(
<button onClick={addRef} style={{alignSelf:'flex-start',padding:'4px 12px',borderRadius:6,background:spoolColor,color:'#fff',border:'none',cursor:'pointer',fontSize:12,fontFamily:'DM Sans,sans-serif',fontWeight:600}}>Add</button>
  )}
</div>
  )}
</div>
  );
}

// ── StrandsPage ──
function StrandsPage({app,allProjects}){
  var pid=app.projId;
  var projStrands=app.allStrands[pid]||{};
  var projTemplates=app.allTemplates[pid]||[];
  // Restore saved tab order if available
  var savedOrder=null;try{var so=localStorage.getItem('woven:collOrder:'+pid);if(so)savedOrder=JSON.parse(so);}catch(e){}
  var rawColl=Object.keys(projStrands);
  var collNames=savedOrder?savedOrder.filter(function(c){return rawColl.includes(c);}).concat(rawColl.filter(function(c){return !savedOrder.includes(c);})):rawColl;
  if(collNames.length===0)collNames=['Characters'];
  var sac=useState(function(){ return app.strandsFocusColl && collNames.includes(app.strandsFocusColl) ? app.strandsFocusColl : collNames[0]; });var activeColl=sac[0];var setActiveColl=sac[1];
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
    if(f.type==='long_text')return <textarea key={sid+'-'+f.id} defaultValue={val} placeholder={'Enter '+f.label.toLowerCase()+'...'} rows={3} onBlur={function(e){updateField(sid,f.id,e.target.value);}} style={{resize:'vertical',minHeight:72,cursor:'default'}}/>;
    if(f.type==='boolean')return(
<div key={sid+'-'+f.id} style={{display:'flex',gap:16}}>
  {['Yes','No'].map(function(opt){return(
    <Radio key={opt} on={val===opt} label={opt} onClick={function(){updateField(sid,f.id,opt);}}/>
  );})}
</div>
    );
    if(f.type==='select')return(<select key={sid+'-'+f.id} defaultValue={val} onChange={function(e){updateField(sid,f.id,e.target.value);}}><option value="">Select...</option>{(f.options||[]).map(function(o){return <option key={o} value={o}>{o}</option>;})}</select>);
    if(f.type==='date')return(<input key={sid+'-'+f.id} type="date" defaultValue={val} onChange={function(e){updateField(sid,f.id,e.target.value);}}/>);
    if(f.type==='strand_ref'){
      return <StrandRefField key={sid+'-'+f.id} f={f} sid={sid} val={val} pid={pid} app={app} onUpdate={function(newVal){updateField(sid,f.id,newVal);}}/>;
    }
    return <input key={sid+'-'+f.id} defaultValue={val} placeholder={'Enter '+f.label.toLowerCase()+'...'} type={f.type==='number'?'number':'text'} onBlur={function(e){updateField(sid,f.id,e.target.value);}}/>;

  }
  // Collection settings editing
  var sef=useState(null);var editingFields=sef[0];var setEditingFields=sef[1];
  var sesc=useState(null);var editingSpoolColor=sesc[0];var setEditingSpoolColor=sesc[1];
  var sesi=useState(null);var editingSpoolIcon=sesi[0];var setEditingSpoolIcon=sesi[1];
  var ssis=useState(false);var showIconSearch=ssis[0];var setShowIconSearch=ssis[1];
  var snfn=useState('');var newFieldName=snfn[0];var setNewFieldName=snfn[1];
  var snft=useState('short_text');var newFieldType=snft[0];var setNewFieldType=snft[1];
  var ssw=useState([]);var sharedWith=ssw[0];var setSharedWith=ssw[1];
  function openCollSettings(){setEditingFields(activeTpl?[...activeTpl.fields]:[]);setSharedWith(activeTpl?activeTpl.sharedWith||[]:[]);setEditingSpoolColor(activeTpl?activeTpl.color||null:null);setEditingSpoolIcon(activeTpl?activeTpl.icon||null:null);setShowCollSettings(true);}
  useEffect(function(){
    if(app.strandsFocusColl){
      openCollSettings();
      if(app.setStrandsFocusColl)app.setStrandsFocusColl(null);
    }
  },[]);
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
  function saveCollSettings(){
    // Save colour and icon to template
    if(activeTpl&&(editingSpoolColor||editingSpoolIcon)){
      var tplUpdates={};
      if(editingSpoolColor)tplUpdates.color=editingSpoolColor;
      if(editingSpoolIcon)tplUpdates.icon=editingSpoolIcon;
      app.updateTemplate(pid,activeTpl.id,tplUpdates);
    }if(!activeTpl)return;app.updateTemplate(pid,activeTpl.id,{fields:editingFields,sharedWith:sharedWith});setShowCollSettings(false);}
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
      n[pid]=reordered;
      // Persist the new order — saveDB writes the whole strands object
      // which preserves key order in JS objects and JSON
      saveDB('woven:strands:'+pid,reordered);
      return n;
    });
    // Save new order immediately (setAllStrands is async so we compute from current keys)
    var currentKeys=Object.keys((app&&app.allStrands&&app.allStrands[pid])||{});
    var fi2=currentKeys.indexOf(fromColl);var ti2=currentKeys.indexOf(toColl);
    if(fi2>=0&&ti2>=0){
      var newOrder=currentKeys.slice();newOrder.splice(fi2,1);newOrder.splice(ti2,0,fromColl);
      try{localStorage.setItem('woven:collOrder:'+pid,JSON.stringify(newOrder));}catch(e){}
    }
  }
  var detailContent=showCollSettings&&editingFields?(
<div style={{padding:24}}>
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
    <div>
      <div style={{fontFamily:'var(--serif)',fontSize:20,fontWeight:600}}>{activeColl} — Settings</div>
      {activeTpl&&activeTpl.projectId!==pid&&(function(){
        var srcProj=allProjects.find(function(p){return p.id===activeTpl.projectId;});
        return <div style={{fontSize:12,color:'var(--mid)',marginTop:2}}>Shared from {srcProj?srcProj.title:'another project'} — fields and items are editable here, but the collection itself (rename, delete, sharing) is managed from its source.</div>;
      })()}
    </div>
    <div style={{display:'flex',gap:8}}>
      {(!activeTpl||activeTpl.projectId===pid)&&<button className="btn btn-danger btn-sm" onClick={function(){setDeleteCollConfirm(true);}}><span className="mi" style={{fontSize:14}}>delete</span>Delete</button>}
      <button className="btn btn-ghost btn-sm" onClick={function(){setShowCollSettings(false);}}>Cancel</button>
      <button className="btn btn-primary btn-sm" onClick={saveCollSettings}>Save</button>
    </div>
  </div>
  {/* Spool colour + icon */}
  {/* Preview */}
  <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
    <div style={{width:40,height:40,borderRadius:10,background:editingSpoolColor||activeTpl&&activeTpl.color||'#c45e28',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
      <span className="material-symbols-outlined" style={{fontSize:22,color:'#fff'}}>{editingSpoolIcon||activeTpl&&activeTpl.icon||'auto_stories'}</span>
    </div>
    <span style={{fontFamily:'var(--serif)',fontSize:16,fontWeight:600,color:'var(--text)'}}>{activeColl}</span>
  </div>
  {/* Colour */}
  <div style={{marginBottom:16}}>
    <span className="sect-lbl">Colour</span>
    <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:6}}>
      {SPOOL_COLORS.map(function(c){var isActive=(editingSpoolColor||activeTpl&&activeTpl.color||'#c45e28')===c;return(
<div key={c} onClick={function(){setEditingSpoolColor(c);}} style={{width:22,height:22,borderRadius:'50%',background:c,cursor:'pointer',flexShrink:0,transform:isActive?'scale(1.25)':'scale(1)',boxShadow:isActive?'0 0 0 2px var(--bg1),0 0 0 3.5px '+c:'none',transition:'transform .15s'}}/>
      );})}
    </div>
  </div>
  {/* Icon */}
  <div style={{marginBottom:16}}>
    <span className="sect-lbl">Icon</span>
    <div style={{display:'flex',gap:4,flexWrap:'wrap',marginTop:6}}>
      {SPOOL_ICONS.slice(0,10).map(function(ic){var isActive=(editingSpoolIcon||activeTpl&&activeTpl.icon||'auto_stories')===ic;return(
<button key={ic} onClick={function(){setEditingSpoolIcon(ic);}} style={{width:32,height:32,borderRadius:6,border:'1.5px solid '+(isActive?(editingSpoolColor||activeTpl&&activeTpl.color||'#c45e28'):'var(--border)'),background:isActive?(editingSpoolColor||activeTpl&&activeTpl.color||'#c45e28')+'22':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
  <span className="material-symbols-outlined" style={{fontSize:16,color:isActive?(editingSpoolColor||activeTpl&&activeTpl.color||'#c45e28'):'var(--mid)'}}>{ic}</span>
</button>
      );})}
      <button onClick={function(){setShowIconSearch(true);}} style={{padding:'0 10px',height:32,borderRadius:6,border:'1px solid var(--border)',background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontFamily:'DM Sans, sans-serif',color:'var(--mid)',whiteSpace:'nowrap'}}>
        Search more
      </button>
    </div>
    {showIconSearch&&<IconSearchPopup current={editingSpoolIcon||activeTpl&&activeTpl.icon||'auto_stories'} onSelect={function(ic){setEditingSpoolIcon(ic);}} onClose={function(){setShowIconSearch(false);}}/>}
  </div>
  <div style={{fontFamily:'var(--serif)',fontSize:16,fontWeight:600,marginBottom:12,color:'var(--text)'}}>Fields</div>
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
<div key={f.id} draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('fieldIdx',''+i);}}
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){e.preventDefault();var from=parseInt(e.dataTransfer.getData('fieldIdx'),10);if(isNaN(from)||from===i)return;var nf=editingFields.slice();var item=nf.splice(from,1)[0];nf.splice(i,0,item);setEditingFields(nf);}}
  style={{borderBottom:'1px solid var(--bg2)',padding:'8px 0'}}>
  <div style={{display:'flex',alignItems:'center',gap:7}}>
    <span className="mi" style={{fontSize:18,color:'var(--border)',cursor:'grab',flexShrink:0}}>drag_indicator</span>
    <input defaultValue={f.label} style={{maxWidth:160,fontSize:13}} onBlur={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{label:e.target.value});setEditingFields(nf);}}/>
    <select value={f.type} style={{width:110,fontSize:13}} onChange={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{type:e.target.value,refSpool:null,refMultiple:false,options:null});setEditingFields(nf);}}>
      {FIELD_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.label}</option>;})}
    </select>
    <button className="btn-icon" onClick={function(){setEditingFields(editingFields.filter(function(_,j){return j!==i;}));}}><span className="mi" style={{fontSize:18}}>delete</span></button>
  </div>
  {f.type==='strand_ref'&&(
<div style={{display:'flex',gap:4,alignItems:'center',marginTop:6,marginLeft:26}}>
  <select value={f.refSpool||''} style={{fontSize:11,flex:1}} onChange={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{refSpool:e.target.value});setEditingFields(nf);}}>
    <option value="">Pick spool…</option>
    {Object.keys(app.allStrands[pid]||{}).map(function(c){return <option key={c} value={c}>{c}</option>;})}
  </select>
  <label style={{fontSize:11,display:'flex',alignItems:'center',gap:3,whiteSpace:'nowrap',cursor:'pointer'}}>
    <input type="checkbox" checked={!!f.refMultiple} onChange={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{refMultiple:e.target.checked});setEditingFields(nf);}}/> Multiple
  </label>
</div>
  )}
  {f.type==='select'&&(
    <div style={{marginLeft:26,marginTop:2}}>
      <OptionsEditor options={f.options} onChange={function(opts){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{options:opts});setEditingFields(nf);}}/>
    </div>
  )}
</div>
  );})}
  <div style={{display:'flex',gap:8,marginTop:12,marginBottom:24}}>
    <input value={newFieldName} onChange={function(e){setNewFieldName(e.target.value);}} placeholder="New field name" onKeyDown={function(e){if(e.key==='Enter')addFieldToSettings();}} style={{flex:1}}/>
    <select value={newFieldType} onChange={function(e){setNewFieldType(e.target.value);}} style={{width:110}}>{FIELD_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.label}</option>;})}</select>
    <button className="btn btn-ghost btn-sm" onClick={addFieldToSettings}>Add</button>
  </div>
  {(!activeTpl||activeTpl.projectId===pid)&&(
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
  )}
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
  var findSelectIcon=function(collName){var t=projTemplates.find(function(t){return t.name===collName;});return (t&&t.icon)||'auto_stories';};
  var findSelectPanel=(
<Drawer variant="inline" title={activeColl}
  toolbar={<SearchSortBar value={search} onChange={function(e){setSearch(e.target.value);}} sortSlot={<StrandSortFilter sort={strandSort} setSort={setStrandSort} strandFilter={strandFilter} setStrandFilter={setStrandFilter} fields={fields}/>}/>}
  footer={<PrimaryButton icon="add" onClick={addStrand}>Add to {activeColl}</PrimaryButton>}>
  {filtered.length===0?(
    <HelpText>{collStrands.length===0?'No entries yet.':'No results for "'+search+'".'}</HelpText>
  ):(
    <div>
      {filtered.map(function(st){return(
        <StrandResultRow key={st.id} strand={st} spoolIcon={findSelectIcon(activeColl)} onClick={function(){setActiveStrandId(st.id);setShowCollSettings(false);if(isMobile)setMobileDetailOpen(true);}}/>
      );})}
    </div>
  )}
</Drawer>
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
  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
    <button className="btn-icon" onClick={openCollSettings} title="Spool settings"><span className="mi" style={{fontSize:18}}>settings</span></button>
    <button className="btn btn-ghost btn-sm" onClick={function(){setNewColl(true);}}>+ Create Spool</button>
  {newColl&&<NewSpoolModal onConfirm={function(name,icon,color){
    if(!name.trim())return;
    var nt={id:genId(),projectId:pid,name:name.trim(),icon:icon,color:color,fields:defaultFields(name.trim()),sharedWith:[]};
    app.addTemplate(pid,nt);
    app.setAllStrands(function(prev){var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});ps[name.trim()]=[];n[pid]=ps;saveDB('woven:strands:'+pid,ps);return n;});
    setActiveColl(name.trim());setNewColl(false);
  }} onCancel={function(){setNewColl(false);}}/>}
  </div>
</div>
    )}
  </div>
  <div className="strands-layout">
    {!isMobile&&<div style={{flex:1,overflowY:'auto'}}>{detailContent}</div>}
    {!isMobile&&!showCollSettings&&findSelectPanel}
    {isMobile&&!mobileDetailOpen&&!showCollSettings&&findSelectPanel}
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
// ProjectWizard now lives in ./ProjectWizard

// ── Profile Panel ──
// ProfilePanel moved to its own file — see ./ProfileDrawer

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
  // Cross-project collection sharing: { [pid]: { [collectionName]: sourcePid } }
  // for collections that live in allStrands[pid]/allTemplates[pid] but are
  // actually owned by a DIFFERENT project (shared in via template.sharedWith).
  var ssc3=useState({});var sharedCollectionSources=ssc3[0];var setSharedCollectionSources=ssc3[1];
  var ssfc=useState(null);var strandsFocusColl=ssfc[0];var setStrandsFocusColl=ssfc[1];
  var snp=useState(false);var showNewProject=snp[0];var setShowNewProject=snp[1];

  // Templates are small (field defs + metadata, no strand content), so it's
  // cheap to load every project's templates up front. This is what lets us
  // resolve "who shares a collection into project X" without a relational
  // query the key-value store can't do.
  function loadAllProjectTemplates(){
    var pids=projects.map(function(p){return p.id;});
    return Promise.all(pids.map(function(opid){
      return loadDB('woven:templates:'+opid,[]).then(function(tm){return {pid:opid,templates:Array.isArray(tm)?tm:[]};});
    })).then(function(results){
      var map={};
      results.forEach(function(r){map[r.pid]=r.templates;});
      setAllTemplates(function(prev){
        var next=Object.assign({},prev);
        results.forEach(function(r){next[r.pid]=r.templates;});
        return next;
      });
      return map;
    });
  }
  function loadProjectDataById(pid){
    setDataLoading(true);
    Promise.all([
      loadDB('woven:drafts:'+pid,[]),
      loadDB('woven:strands:'+pid,{}),
      loadDB('woven:templates:'+pid,[])
    ]).then(function(results){
      var d=results[0];var st=results[1]&&typeof results[1]==='object'?results[1]:{};var tm=Array.isArray(results[2])?results[2]:[];
      setAllDrafts(function(p){var n=Object.assign({},p);n[pid]=Array.isArray(d)?d:[];return n;});
      setAllTemplates(function(p){var n=Object.assign({},p);n[pid]=tm;return n;});

      // Resolve which collections are shared INTO this project by another one.
      loadAllProjectTemplates().then(function(templatesMap){
        var sourceFor={}; // collectionName -> sourcePid, for collections shared into pid
        Object.keys(templatesMap).forEach(function(opid){
          if(opid===pid)return;
          (templatesMap[opid]||[]).forEach(function(t){
            if(t.sharedWith&&t.sharedWith.indexOf(pid)>=0)sourceFor[t.name]=opid;
          });
        });
        var sourcePids=Object.keys(sourceFor).map(function(c){return sourceFor[c];}).filter(function(v,i,a){return a.indexOf(v)===i;});

        if(sourcePids.length===0){
          setAllStrands(function(p){var n=Object.assign({},p);n[pid]=st;return n;});
          setSharedCollectionSources(function(p){var n=Object.assign({},p);n[pid]={};return n;});
          setDataLoading(false);
          return;
        }

        Promise.all(sourcePids.map(function(spid){
          return loadDB('woven:strands:'+spid,{}).then(function(sst){return {pid:spid,strands:sst&&typeof sst==='object'?sst:{}};});
        })).then(function(sourceResults){
          var sourceStrandsByPid={};
          sourceResults.forEach(function(r){sourceStrandsByPid[r.pid]=r.strands;});

          var mergedStrands=Object.assign({},st);
          var mergedTemplates=tm.slice();
          Object.keys(sourceFor).forEach(function(collName){
            var spid=sourceFor[collName];
            mergedStrands[collName]=(sourceStrandsByPid[spid]&&sourceStrandsByPid[spid][collName])||[];
            var srcTpl=(templatesMap[spid]||[]).find(function(t){return t.name===collName;});
            if(srcTpl&&!mergedTemplates.find(function(t){return t.id===srcTpl.id;}))mergedTemplates.push(srcTpl);
          });

          setAllStrands(function(p){
            var n=Object.assign({},p);
            n[pid]=mergedStrands;
            sourcePids.forEach(function(spid){if(!n[spid])n[spid]=sourceStrandsByPid[spid];});
            return n;
          });
          setAllTemplates(function(p){var n=Object.assign({},p);n[pid]=mergedTemplates;return n;});
          setSharedCollectionSources(function(p){var n=Object.assign({},p);n[pid]=sourceFor;return n;});
          setDataLoading(false);
        });
      });
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
    setGlobalLT({});setGoalState(500);
    setProfileState({firstName:'',lastName:'',email:'',plan:'Free'});
    // Don't reset sessions to [] here — causes stats to flash zero while loading
    loadDB('woven:global_lt',{}).then(function(g){setGlobalLT(g||{});});
    loadDB('woven:goal',500).then(function(g){setGoalState(g);});
    // Load sessions from localStorage first (faster, avoids async timing issues)
    // Load sessions: localStorage first (instant), then merge with Supabase
    loadLS('woven:sessions',[]).then(function(local){
      var localSessions=Array.isArray(local)?local:[];
      if(localSessions.length>0)setSessions(localSessions);
      loadDB('woven:sessions',[]).then(function(remote){
        var remoteSessions=Array.isArray(remote)?remote:[];
        if(remoteSessions.length===0)return; // nothing remote, keep local
        if(localSessions.length===0){setSessions(remoteSessions);return;}
        // Merge: combine both, dedupe by id, keep all dates
        var merged=localSessions.slice();
        remoteSessions.forEach(function(rs){
          var existing=merged.findIndex(function(ls){return ls.date===rs.date&&ls.projId===rs.projId;});
          if(existing>=0){
            // Take whichever has more words (in case of partial sync)
            if((rs.words||0)>(merged[existing].words||0))merged[existing]=rs;
          } else {
            merged.push(rs);
          }
        });
        setSessions(merged);
        // Write merged back to both stores
        saveLS('woven:sessions',merged);
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
  // Resolves the project a collection's strands actually live in — the
  // caller's own pid unless that collection was merged in from elsewhere.
  function ownerOfCollection(pid,coll){
    var srcMap=sharedCollectionSources[pid];
    return (srcMap&&srcMap[coll])||pid;
  }
  // After writing to the owning project's copy, mirror the same result into
  // every other already-loaded project that also has this collection shared
  // in, so all in-memory views stay consistent without a reload.
  function propagateSharedStrands(next,ownerPid,coll,updatedList){
    Object.keys(sharedCollectionSources).forEach(function(otherPid){
      if(otherPid===ownerPid)return;
      var srcMap=sharedCollectionSources[otherPid];
      if(srcMap&&srcMap[coll]===ownerPid&&next[otherPid]){
        var ops=Object.assign({},next[otherPid]);
        ops[coll]=updatedList;
        next[otherPid]=ops;
      }
    });
  }
  function updateStrand(pid,coll,sid,changes){
    var ownerPid=ownerOfCollection(pid,coll);
    setAllStrands(function(prev){
      var next=Object.assign({},prev);
      var ownerPs=Object.assign({},next[ownerPid]||{});
      var updated=(ownerPs[coll]||[]).map(function(s){return s.id!==sid?s:Object.assign({},s,changes);});
      ownerPs[coll]=updated;
      next[ownerPid]=ownerPs;
      saveDB('woven:strands:'+ownerPid,ownerPs);
      propagateSharedStrands(next,ownerPid,coll,updated);
      return next;
    });
  }
  function addStrand(pid,coll,ns){
    var ownerPid=ownerOfCollection(pid,coll);
    setAllStrands(function(prev){
      var next=Object.assign({},prev);
      var ownerPs=Object.assign({},next[ownerPid]||{});
      var updated=(ownerPs[coll]||[]).concat([ns]);
      ownerPs[coll]=updated;
      next[ownerPid]=ownerPs;
      saveDB('woven:strands:'+ownerPid,ownerPs);
      propagateSharedStrands(next,ownerPid,coll,updated);
      return next;
    });
  }
  function addTemplate(pid,tpl){setAllTemplates(function(prev){var next=Object.assign({},prev);next[pid]=(next[pid]||[]).concat([tpl]);saveDB('woven:templates:'+pid,next[pid]);return next;});}
  function updateTemplate(pid,tid,changes){
    // Templates already carry their own projectId — use that as the source
    // of truth for ownership rather than the caller's active pid, since a
    // shared-in template record keeps its original projectId when merged in.
    var existing=(allTemplates[pid]||[]).find(function(t){return t.id===tid;});
    var ownerPid=(existing&&existing.projectId)||pid;
    setAllTemplates(function(prev){
      var next=Object.assign({},prev);
      var updated=(next[ownerPid]||[]).map(function(t){return t.id!==tid?t:Object.assign({},t,changes);});
      next[ownerPid]=updated;
      saveDB('woven:templates:'+ownerPid,updated);
      var updatedTpl=updated.find(function(t){return t.id===tid;});
      if(updatedTpl){
        Object.keys(next).forEach(function(otherPid){
          if(otherPid===ownerPid)return;
          var idx=(next[otherPid]||[]).findIndex(function(t){return t.id===tid;});
          if(idx>=0){
            var ops=next[otherPid].slice();
            ops[idx]=updatedTpl;
            next[otherPid]=ops;
          }
        });
      }
      return next;
    });
  }
  // Ready-to-use guard for a future permanent-delete-project feature: call
  // this before allowing deletion and block with an error if it returns any
  // shared collections. There's no hard delete anywhere in the app yet (only
  // archive/unarchive, which is reversible and doesn't touch this data), so
  // nothing calls this today — it's here for when that feature is built.
  function collectionsSharedFromProject(pid){
    return (allTemplates[pid]||[]).filter(function(t){return t.projectId===pid&&t.sharedWith&&t.sharedWith.length>0;});
  }
  function updateProjectTitle(pid,newTitle){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{title:newTitle});});saveDB('woven:projects',next);return next;});}
  function updateProjectSynopsis(pid,syn){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{synopsis:syn});});saveDB('woven:projects',next);return next;});}
  function updateProjectImage(pid,img){setProjects(function(prev){var old=prev.find(function(p){return p.id===pid;});if(old&&old.image&&old.image!==img)deleteStorageImage(old.image);var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{image:img});});saveDB('woven:projects',next);return next;});}
  function updateProjectConfig(pid,patch){setProjects(function(prev){var next=prev.map(function(p){if(p.id!==pid)return p;var cfg=Object.assign({},p.config||{},patch);return Object.assign({},p,{config:cfg});});saveDB('woven:projects',next);return next;});}
  function updateProjectType(pid,type){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{type:type});});saveDB('woven:projects',next);return next;});}
  function archiveProject(pid){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{archived:true});});saveDB('woven:projects',next);return next;});}
  function unarchiveProject(pid){setProjects(function(prev){var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{archived:false});});saveDB('woven:projects',next);return next;});}
  function addDraftFieldDef(pid,fieldDef){
    setProjects(function(prev){var next=prev.map(function(p){if(p.id!==pid)return p;var defs=(p.draftFieldDefs||[]).concat([fieldDef]);return Object.assign({},p,{draftFieldDefs:defs});});saveDB('woven:projects',next);return next;});
    // Add empty value to all existing drafts
    setAllDrafts(function(prev){var next=Object.assign({},prev);var ds=(next[pid]||[]).map(function(d){var cf=Object.assign({},d.customFields||{});cf[fieldDef.id]='';return Object.assign({},d,{customFields:cf});});next[pid]=ds;saveDB('woven:drafts:'+pid,ds);return next;});
  }
  function updateDraftFieldDef(pid,fieldId,changes){
    setProjects(function(prev){var next=prev.map(function(p){if(p.id!==pid)return p;var defs=(p.draftFieldDefs||[]).map(function(f){return f.id!==fieldId?f:Object.assign({},f,changes);});return Object.assign({},p,{draftFieldDefs:defs});});saveDB('woven:projects',next);return next;});
  }
  function removeDraftFieldDef(pid,fieldId){
    setProjects(function(prev){var next=prev.map(function(p){if(p.id!==pid)return p;var defs=(p.draftFieldDefs||[]).filter(function(f){return f.id!==fieldId;});return Object.assign({},p,{draftFieldDefs:defs});});saveDB('woven:projects',next);return next;});
  }
  function reorderDraftFieldDefs(pid,orderedDefs){
    setProjects(function(prev){var next=prev.map(function(p){if(p.id!==pid)return p;return Object.assign({},p,{draftFieldDefs:orderedDefs});});saveDB('woven:projects',next);return next;});
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
    if(!wordsAdded||wordsAdded<=0)return;
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
      var lsKey='woven:sessions:'+(window.__wovenUserId||'anon');
      saveLS(lsKey,next);saveLS('woven:sessions',next); // keep legacy key too
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
  var app={view:view,setView:setView,projId:projId,setProjId:setProjId,draftId:draftId,setDraftId:setDraftId,projects:projects,goal:goal,setGoal:setGoal,sessions:sessions,profile:profile,setProfile:setProfile,allDrafts:allDrafts,allStrands:allStrands,setAllStrands:setAllStrands,allTemplates:allTemplates,currentProject:currentProject,goBack:goBack,openDraft:openDraft,loadProjectData:loadProjectDataById,updateDraft:updateDraft,addDraft:addDraft,duplicateDraft:duplicateDraft,reorderDraft:reorderDraft,nestDraft:nestDraft,updateStrand:updateStrand,addStrand:addStrand,addTemplate:addTemplate,updateTemplate:updateTemplate,createProject:createProject,updateProjectTitle:updateProjectTitle,updateProjectSynopsis:updateProjectSynopsis,updateProjectImage:updateProjectImage,updateProjectType:updateProjectType,updateProjectConfig:updateProjectConfig,archiveProject:archiveProject,unarchiveProject:unarchiveProject,addDraftFieldDef:addDraftFieldDef,updateDraftFieldDef:updateDraftFieldDef,removeDraftFieldDef:removeDraftFieldDef,reorderDraftFieldDefs:reorderDraftFieldDefs,recordSession:recordSession,globalLT:globalLT,updateGlobalLT:updateGlobalLT,signOut:signOut,currentUser:currentUser,dataLoading:dataLoading,clearTodaySession:clearTodaySession,strandsFocusColl:strandsFocusColl,setStrandsFocusColl:setStrandsFocusColl,sharedCollectionSources:sharedCollectionSources,collectionsSharedFromProject:collectionsSharedFromProject};

  function signOut(){
    supabase.auth.signOut().then(function(){
      window.__wovenUserId=null;setCurrentUser(null);setView('dashboard');setProjects([]);setAllDrafts({});
      try{
        var toRemove=[];
        for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.indexOf('woven:filter:')===0)toRemove.push(k);}
        toRemove.forEach(function(k){localStorage.removeItem(k);});
      }catch(e){}
    });
  }

  // Check for shared draft link
  var urlParams=new URLSearchParams(window.location.search);
  var shareId=urlParams.get('share');
  if(shareId)return(<div className="woven-root"><div id="woven-tt" style={{position:"fixed",display:"none",background:"#7A5A38",color:"#fdf8f0",fontSize:11,padding:"4px 10px",borderRadius:6,pointerEvents:"none",zIndex:99999,transform:"translateX(-50%)",fontFamily:"DM Sans, sans-serif",whiteSpace:"nowrap"}}/><GlobalStyles/><SharedDraftView shareId={shareId}/></div>);

  if(authLoading)return(
<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100vh',background:'var(--bg0)',gap:16}}>
  <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
  <div style={{width:36,height:36,borderRadius:'50%',border:'3px solid var(--border)',borderTopColor:'var(--indigo)',animation:'spin .8s linear infinite'}}/>
  <span style={{fontFamily:'var(--serif)',fontSize:18,color:'var(--mid)'}}>Loading Woven…</span>
</div>
  );
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
<div id="woven-tt"/>
  <GlobalStyles/>
  {inner}
  <ProfileDrawer app={app} focusField={profileFocus} open={showProfile} topOffset={54} onClose={function(){setShowProfile(false);}}/>
  {showNewProject&&<ProjectWizard app={app} onClose={function(){setShowNewProject(false);}}/>}
</div>
  );
}

export default App;
