// @ts-nocheck
import ExploreCanvas from './ExploreCanvas'
import { useState, useEffect, useRef } from "react";
import DraftEditor from './DraftEditor'
import SharedDraftView from './SharedDraftView'
import AuthScreen from './auth/AuthScreen'
import PropertiesDrawer from './PropertiesDrawer'
import ProfileDrawer from './ProfileDrawer'
import StrandsDrawer from './StrandsDrawer'
import StrandsPage from './StrandsPage'
import VersionsDrawer from './VersionsDrawer'
import LooseThreadDrawer from './LooseThreadDrawer'
import BindDrawer from './BindDrawer'
import ProjectWizard from './ProjectWizard'
import ProjectDrawer from './ProjectDrawer'
import Dashboard from './Dashboard'
import TableView from './TableView'
import CardsView, { StrandTagPicker } from './CardsView'
import AddMenuFab from './AddMenuFab'
import LooseThreadsQuickAccess from './LooseThreadsQuickAccess'
export { buildTree, ViewHeader, loadFilterState, persistFilterState, applyFS, LooseThreadsSection, DraftLoadingSpinner, EmptyDrafts } from './CardsView'
import { AvatarEditModal, AddFieldInline, Drawer, HelpText, PrimaryButton, StrandResultRow, SearchSortBar, OptionsEditor, Radio } from './SharedUI'
import {
  FIELD_TYPES, PRESET_COLORS, SYSTEM_COLORS, COLL_FIELDS, defaultFields,
  supabase, genId, stripHtml, countWords, initials, todayStr,
  compressImage, uploadImage, deleteStorageImage,
  saveSnapshot
} from './utils'
import { PROJ_TYPES } from './projectConfig'
// Snapshot helpers, Supabase client, and env constants now live in ./utils

// ── Storage ──
function saveLS(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch(e){}}
function loadLS(key,def){return Promise.resolve().then(function(){try{var v=localStorage.getItem(key);return v?JSON.parse(v):def;}catch(e){return def;}});}
export function saveDB(key,val){
  var uid=window.__wovenUserId;
  if(!uid)return saveLS(key,val);
  saveLS(key,val); // keep local copy too
  supabase.from('wf_data').upsert({key:key,user_id:uid,value:val,updated_at:new Date().toISOString()},{onConflict:'key,user_id'}).then(function(r){if(r.error)console.error('saveDB error:',r.error);});
}
export function loadDB(key,def){
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

// useIsMobile moved to ./StrandsPage (was only used there)

// ── Constants ──
// Canvas | Table | Tiles | Cards | (separator) Strands
var VIEW_MODES=[
  {key:'canvas', icon:'lightbulb',    label:'Canvas',     group:'main'},
  {key:'table',  icon:'table_rows',   label:'Outline',    group:'main'},
  {key:'cards',  icon:'book_ribbon',  label:'Storyboard', group:'main'},
  {key:'strands',icon:'gesture',      label:'Spools',     group:'strands'}
];
// PROJ_TYPES now lives in ./projectConfig (label/icon/desc/colls + presets)

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
.nav{display:flex;align-items:center;padding:0 14px;height:64px;background:#E2D0B8;flex-shrink:0;gap:10px;}
.wordmark{font-family:var(--serif);font-size:22px;font-weight:600;color:var(--indigo);cursor:pointer;user-select:none;}
.avatar{width:44px;height:44px;border-radius:50%;background:var(--indigo);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;flex-shrink:0;cursor:pointer;overflow:hidden;position:relative;}
.avatar img{width:100%;height:100%;object-fit:cover;display:block;}
.avatar-overlay{position:absolute;inset:0;background:rgba(196,94,40,.75);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .15s ease;}
.avatar:hover .avatar-overlay{opacity:1;}
.avatar-overlay .mi{color:#fff;font-size:16px;}
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
.dash-main{flex:2;overflow-y:auto;padding:120px 108px 200px;min-width:0;background-color:var(--bg0);background-image:radial-gradient(circle, rgba(160,120,70,0.18) 1px, transparent 1px);background-size:22px 22px;}
.dash-sidebar{flex:1;flex-shrink:0;border-left:1px solid var(--border);overflow-y:auto;background:var(--bg1);padding:24px;min-width:220px;max-width:280px;}
.dash-greeting{font-family:var(--serif);font-size:44px;font-weight:600;color:var(--text);margin-bottom:4px;}
.dash-subtitle{font-family:'DM Sans',sans-serif;font-size:24px;color:#7A5A38;margin-bottom:24px;font-weight:400;}
.dash-section-hdr{font-family:'DM Sans',sans-serif;font-size:20px;font-weight:700;color:#2A1F10;}
.proj-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px;}
.proj-card{background:#F5EDE0;border:2px solid transparent;border-radius:15px;overflow:hidden;cursor:pointer;transition:border-color .2s,box-shadow .2s;box-shadow:0 2px 8px rgba(42,31,16,.06);}
.proj-card:hover{border-color:#c45e28;box-shadow:0 4px 16px rgba(42,31,16,.12);}
.proj-card-band{height:150px;background:#E2D0B8;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;border-radius:13px 13px 0 0;}
.proj-card-body{padding:10px 15px;display:flex;flex-direction:column;gap:10px;min-height:200px;}
.proj-card-title{font-family:'Crimson Text',serif;font-size:18px;font-weight:700;color:#2a1f10;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex-shrink:0;}
.proj-card-syn{font-family:'DM Sans',sans-serif;font-size:16px;color:#7A5A38;line-height:1.45;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden;height:93px;flex-shrink:0;}
.proj-card-footer{display:flex;justify-content:space-between;align-items:center;font-family:'DM Sans',sans-serif;font-size:14px;color:#a88060;margin-top:auto;flex-shrink:0;}
.add-proj{border:2px dashed var(--border);border-radius:15px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:230px;transition:all .15s;}
.add-proj:hover{border-color:#c45e28;background:rgba(196,94,40,.04);}
/* Almond-colored primary buttons — "New Project" and Loose Threads'
   "Show all". Only the resting background needs overriding here; the
   shared .wv-btn-primary:hover rule already goes to deep brown and has
   higher specificity than this override, so hover works correctly with
   no extra rule needed. */
.almond-primary-btn .wv-btn-primary{background:#A88060;}
.stat-card{background:var(--bg0);border:1px solid var(--border);border-radius:var(--rl);padding:14px 16px;margin-bottom:10px;box-shadow:0 1px 4px rgba(42,31,16,.04);}
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
@media(max-width:768px){
  .stat-hide-mobile{display:none;}
  input,textarea,select{font-size:16px!important;}
  .woven-root{height:100%;min-height:100vh;overflow-x:hidden;}
  .dash-layout{flex:none;overflow:visible;flex-direction:column;height:auto;}
  .dash-main{flex:none;overflow-y:visible;padding:16px 16px 40px;background-color:var(--bg0);background-image:radial-gradient(circle, rgba(160,120,70,0.18) 1px, transparent 1px);background-size:22px 22px;order:0;}
  .dash-sidebar{width:100%;max-width:100%;border-left:none;border-bottom:1px solid var(--border);padding:12px 14px;overflow:visible;height:auto;flex:none;min-width:0;background-color:var(--bg0)!important;background-image:radial-gradient(circle, rgba(160,120,70,0.18) 1px, transparent 1px)!important;background-size:22px 22px!important;order:1;}
  .stat-cards-mobile{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
  .stat-cards-mobile .stat-card{margin-bottom:0;}
  .stat-num{font-size:24px;}
  .stat-card{padding:10px 12px;}
  .proj-grid{grid-template-columns:1fr;}
  .cards-grid{flex-direction:column;gap:10px;padding:12px;}
  .draft-card{width:100%!important;height:auto!important;}
  .loose-thread-tile{width:100%!important;max-width:100%!important;}
  .viewheader-new-btn{display:none!important;}
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

// Panel (local full-overlay component) removed — ArchiveDrawer now uses the shared Drawer from ./SharedUI

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

// ── ProjectEditPanel ──
// Replaced by ProjectDrawer — see ./ProjectDrawer

// StatsSection, GlobalLooseThreads, Dashboard, and ArchiveDrawer now live in ./Dashboard

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
  <div className="avatar" onClick={function(){onOpenProfile(null);}}>
    {(app.profile&&app.profile.headshot)?<img src={app.profile.headshot} alt=""/>:initials(((app.profile||{}).firstName||'')+' '+((app.profile||{}).lastName||''))}
    <div className="avatar-overlay"><span className="mi">edit</span></div>
  </div>
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


// ── TaggedSpoolsEditor ──
// The full tag list + remove/add UI, matching what DraftCard renders inline
// in Structure mode. Extracted as its own component so TableView's expanded
// row (SpoolsCell) can reuse the exact same editing UI instead of a second
// copy. Same tagged-list computation as DraftCard/SpoolsCell — each computes
// its own from draft/app/pid rather than taking it as a prop, matching how
// the two existing call sites already work.
export function TaggedSpoolsEditor({draft,app,pid}){
  var ssc=useState(false);var strandConfirm=ssc[0];var setStrandConfirm=ssc[1];
  var ssi=useState(null);var strandConfirmId=ssi[0];var setStrandConfirmId=ssi[1];
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
  function removeStrand(strandId){app.updateDraft(pid,draft.id,{strandTags:(draft.strandTags||[]).filter(function(id){return id!==strandId;})});setStrandConfirm(false);setStrandConfirmId(null);}
  return(
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
  <StrandTagPicker draft={draft} app={app} pid={pid} tagged={tagged}/>
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


// TableView now lives in ./TableView

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

// StrandSortFilter, CollTab, IconSearchPopup, NewSpoolModal, StrandRefField,
// useIsMobile, and StrandsPage now live in ./StrandsPage

// ── Wizard ──
// ProjectWizard now lives in ./ProjectWizard

// ── Profile Panel ──
// ProfilePanel moved to its own file — see ./ProfileDrawer

// ArchiveDrawer and WovenLogo now live in ./Dashboard

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
        } else if(lastState&&lastState.projId){
          setProjId(lastState.projId);
          setView(lastState.view||'cards');
        }
        // Always load every project's drafts/strands/templates, not just the
        // restored one — otherwise Dashboard word counts and the Archive
        // drawer show empty for any project until the user opens it.
        saved.forEach(function(p){loadProjectDataById(p.id);});
        setAuthLoading(false);setDataLoading(false);
      }
    });
  }

  function updateDraft(pid,did,changes){setAllDrafts(function(prev){var next=Object.assign({},prev);var ds=(next[pid]||[]).map(function(d){return d.id!==did?d:Object.assign({},d,changes);});next[pid]=ds;saveDB('woven:drafts:'+pid,ds);return next;});}
  function deleteDraftPermanently(pid,did){
    setAllDrafts(function(prev){
      var current=(prev[pid]||[]).find(function(d){return d.id===did;});
      if(current&&current.thumbnail){try{deleteStorageImage(current.thumbnail);}catch(e){console.error('deleteStorageImage failed, continuing anyway:',e);}}
      var next=Object.assign({},prev);
      var ds=(next[pid]||[]).filter(function(d){return d.id!==did;});
      next[pid]=ds;
      saveDB('woven:drafts:'+pid,ds);
      return next;
    });
  }
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
  // Promote a strand to be the primary/top-level draft, demoting the current
  // main into a child strand of it. We swap parentId+order between the two
  // records rather than swapping ids, so every existing reference to either
  // draft (share links, strand tags, appears-in lists, dashboard stats)
  // keeps pointing at the right content with no further changes needed.
  // Any other sibling strands (children of the old main) move along with
  // the promotion, staying grouped under whichever draft is primary now.
  function promoteStrand(pid,currentMainId,newPrimaryId){
    if(!pid||!currentMainId||!newPrimaryId||currentMainId===newPrimaryId)return;
    setAllDrafts(function(prev){
      var next=Object.assign({},prev);
      var ds=(next[pid]||[]).slice();
      var mainDraft=ds.find(function(d){return d.id===currentMainId;});
      var newDraft=ds.find(function(d){return d.id===newPrimaryId;});
      if(!mainDraft||!newDraft)return prev;
      var mainParentId=mainDraft.parentId;
      var mainOrder=mainDraft.order;
      var now=new Date().toISOString();
      ds=ds.map(function(d){
        if(d.id===currentMainId){
          return Object.assign({},d,{parentId:newPrimaryId,order:Date.now(),updatedAt:now});
        }
        if(d.id===newPrimaryId){
          return Object.assign({},d,{parentId:mainParentId,order:mainOrder,updatedAt:now});
        }
        if(d.parentId===currentMainId){
          return Object.assign({},d,{parentId:newPrimaryId});
        }
        return d;
      });
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
  function deleteStrand(pid,coll,sid){
    var ownerPid=ownerOfCollection(pid,coll);
    setAllStrands(function(prev){
      var next=Object.assign({},prev);
      var ownerPs=Object.assign({},next[ownerPid]||{});
      var updated=(ownerPs[coll]||[]).filter(function(s){return s.id!==sid;});
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
  function updateProjectImage(pid,img){setProjects(function(prev){var old=prev.find(function(p){return p.id===pid;});if(old&&old.image&&old.image!==img){try{deleteStorageImage(old.image);}catch(e){console.error('deleteStorageImage failed, continuing anyway:',e);}}var next=prev.map(function(p){return p.id!==pid?p:Object.assign({},p,{image:img});});saveDB('woven:projects',next);return next;});}
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
  var app={view:view,setView:setView,projId:projId,setProjId:setProjId,draftId:draftId,setDraftId:setDraftId,projects:projects,goal:goal,setGoal:setGoal,sessions:sessions,profile:profile,setProfile:setProfile,allDrafts:allDrafts,allStrands:allStrands,setAllStrands:setAllStrands,allTemplates:allTemplates,currentProject:currentProject,goBack:goBack,openDraft:openDraft,loadProjectData:loadProjectDataById,updateDraft:updateDraft,deleteDraftPermanently:deleteDraftPermanently,addDraft:addDraft,duplicateDraft:duplicateDraft,reorderDraft:reorderDraft,nestDraft:nestDraft,promoteStrand:promoteStrand,updateStrand:updateStrand,addStrand:addStrand,deleteStrand:deleteStrand,addTemplate:addTemplate,updateTemplate:updateTemplate,createProject:createProject,updateProjectTitle:updateProjectTitle,updateProjectSynopsis:updateProjectSynopsis,updateProjectImage:updateProjectImage,updateProjectType:updateProjectType,updateProjectConfig:updateProjectConfig,archiveProject:archiveProject,unarchiveProject:unarchiveProject,addDraftFieldDef:addDraftFieldDef,updateDraftFieldDef:updateDraftFieldDef,removeDraftFieldDef:removeDraftFieldDef,reorderDraftFieldDefs:reorderDraftFieldDefs,recordSession:recordSession,globalLT:globalLT,updateGlobalLT:updateGlobalLT,signOut:signOut,currentUser:currentUser,dataLoading:dataLoading,clearTodaySession:clearTodaySession,strandsFocusColl:strandsFocusColl,setStrandsFocusColl:setStrandsFocusColl,sharedCollectionSources:sharedCollectionSources,collectionsSharedFromProject:collectionsSharedFromProject};

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
<div style={{display:'flex',flexDirection:'column',height:'100vh',background:'var(--bg0)',overflow:'hidden'}}>
  <style>{'@keyframes skel-shimmer{100%{left:150%;}}.skel-b{position:relative;overflow:hidden;background:var(--bg2);border-radius:var(--rl);}.skel-b::after{content:\'\';position:absolute;top:0;left:-150%;width:150%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.5),transparent);animation:skel-shimmer 1.5s infinite;}'}</style>
  {/* Top nav bar */}
  <div style={{height:54,flexShrink:0,borderBottom:'1px solid var(--border)',background:'var(--bg1)',display:'flex',alignItems:'center',padding:'0 20px',gap:12}}>
    <div className="skel-b" style={{width:28,height:28,borderRadius:8}}/>
    <div className="skel-b" style={{width:120,height:16}}/>
    <div style={{marginLeft:'auto',display:'flex',gap:10}}>
      <div className="skel-b" style={{width:32,height:32,borderRadius:'50%'}}/>
    </div>
  </div>
  {/* Dashboard-shaped body */}
  <div style={{display:'flex',flex:1,overflow:'hidden',padding:'40px 36px'}}>
    <div style={{flex:2,minWidth:0,paddingRight:24}}>
      <div className="skel-b" style={{width:220,height:28,marginBottom:10}}/>
      <div className="skel-b" style={{width:160,height:14,marginBottom:28}}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}}>
        {[0,1,2,3,4,5].map(function(i){return(
<div key={i} style={{borderRadius:'var(--rl)',overflow:'hidden',border:'1px solid var(--border)'}}>
  <div className="skel-b" style={{height:64,borderRadius:0}}/>
  <div style={{padding:'12px 14px',background:'var(--bg1)'}}>
    <div className="skel-b" style={{height:14,width:'80%',marginBottom:8}}/>
    <div className="skel-b" style={{height:10,width:'60%'}}/>
  </div>
</div>
        );})}
      </div>
    </div>
    <div style={{flex:1,minWidth:220,maxWidth:280,display:'flex',flexDirection:'column',gap:12}}>
      {[0,1,2].map(function(i){return(
<div key={i} style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:'var(--rl)',padding:'14px 16px'}}>
  <div className="skel-b" style={{height:11,width:'50%',marginBottom:10}}/>
  <div className="skel-b" style={{height:32,width:'70%'}}/>
</div>
      );})}
    </div>
  </div>
</div>
  );
  if(!currentUser)return(<div><GlobalStyles/><AuthScreen onAuth={function(user){window.__wovenUserId=user.id;setCurrentUser(user);loadAllData();}}/></div>);

  var inner=null;
  if(view==='dashboard'){inner=<Dashboard app={app} onOpenProfile={openProfile} onNewProject={function(){setShowNewProject(true);}}/>;
  }else if(view==='editor'){inner=<DraftEditor app={app} key={draftId}/>;
  }else{
    var vc=null;
   if(view==='canvas')vc=<ExploreCanvas app={app}/>;
    if(view==='cards')vc=<CardsView app={app}/>;
    if(view==='table')vc=<TableView app={app}/>;
    if(view==='strands')vc=<StrandsPage app={app} allProjects={projects}/>;
    var showAddMenuFab=view==='canvas'||view==='cards'||view==='table';
    inner=<div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}><ProjectNav app={app} onOpenProfile={openProfile}/>{vc}{showAddMenuFab&&<AddMenuFab app={app}/>}{view==='cards'&&<LooseThreadsQuickAccess app={app}/>}</div>;
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
