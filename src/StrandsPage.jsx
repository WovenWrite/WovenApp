// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { AvatarEditModal, Drawer, HelpText, PrimaryButton, TertiaryButton, StrandResultRow, SearchSortBar, OptionsEditor, Radio, Field, InputField, SelectField, Section, SpoolThumbnailUpload, DeleteConfirmModal, Check } from './SharedUI'
import { FIELD_TYPES, defaultFields, initials, uploadImage } from './utils'
import { saveDB, loadDB } from './App'

// genId, PRESET_COLORS come from utils too — pulled in below where needed.
import { genId, PRESET_COLORS } from './utils'

function useIsMobile(){var s=useState(window.innerWidth<768);var isMobile=s[0];var setIsMobile=s[1];useEffect(function(){function onResize(){setIsMobile(window.innerWidth<768);}window.addEventListener('resize',onResize);return function(){window.removeEventListener('resize',onResize);};},[]);return isMobile;}

// ── LongTextField ──
// A long_text Field with a small markdown toolbar (bold/italic/bulleted
// list) above it. Lightweight by design — inserts markdown syntax at the
// cursor rather than rendering a full WYSIWYG editor. onMouseDown+
// preventDefault on the toolbar buttons keeps the textarea's selection
// intact (a plain onClick would blur the textarea first and lose it).
// ── Field type metadata for the Webflow-style type picker cards ──
var FIELD_TYPE_INFO={
  short_text:{icon:'short_text',help:'A single line — names, titles, short labels.'},
  long_text:{icon:'notes',help:'Multiple lines with light formatting — backstory, notes, descriptions.'},
  number:{icon:'123',help:'A numeric value — age, count, quantity.'},
  date:{icon:'calendar_month',help:'A specific date — birthday, event, deadline.'},
  boolean:{icon:'toggle_on',help:'A simple yes/no choice.'},
  select:{icon:'list',help:'Pick one option from a defined list.'},
  strand_ref:{icon:'hub',help:'Link to another spool item — relationships, connections.'}
};

// ── CollectionIconThumb ──
// Matches SpoolThumbnailUpload's exact footprint (150x150, semi-opaque
// amber pencil overlay) so a collection's icon/colour preview reads as the
// same "thumbnail" pattern used on individual spool items — just centered
// on a material icon instead of an image/emoji/initials, since a
// collection doesn't have those.
function CollectionIconThumb({color,icon,onClick}){
  return(
<div className="wv-thumb-upload" style={{background:color||'#A88060',cursor:'pointer'}} onClick={onClick}>
  <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}>
    <span className="material-symbols-outlined" style={{fontSize:56,color:'#fff'}}>{icon||'auto_stories'}</span>
  </div>
  <div className="wv-thumb-upload-overlay">
    <span className="mi">edit</span>
  </div>
</div>
  );
}

// ── MultiSelectDropdown ──
// A compact "N selected" trigger that expands into a checkbox list —
// same visual language as the rest of the fields (wv-field-box), for
// choosing which other projects a collection is shared with.
function MultiSelectDropdown({options,selected,onChange,placeholder}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  var summary=selected.length===0?(placeholder||'None selected'):selected.length===1?(function(){var o=options.find(function(o){return o.id===selected[0];});return o?o.label:'1 selected';})():selected.length+' projects selected';
  return(
<div ref={ref} style={{position:'relative'}}>
  <button type="button" className="wv-field-box" onClick={function(){setOpen(!open);}} style={{display:'flex',alignItems:'center',justifyContent:'space-between',cursor:'pointer',textAlign:'left'}}>
    <span style={{color:selected.length?'var(--text)':'var(--placeholder)',fontStyle:selected.length?'normal':'italic'}}>{summary}</span>
    <span className="mi" style={{fontSize:18,color:'var(--mid)',flexShrink:0}}>expand_more</span>
  </button>
  {open&&(
<div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,zIndex:100,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 8px 28px rgba(42,31,16,.14)',padding:6,maxHeight:220,overflowY:'auto'}}>
  {options.length===0?<div style={{fontSize:13,color:'var(--placeholder)',padding:8}}>No other projects to share with.</div>:options.map(function(o){var checked=selected.includes(o.id);return(
<label key={o.id} style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:14,fontFamily:'DM Sans,sans-serif',color:'var(--text)',padding:'7px 6px',borderRadius:6}}
  onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}
  onClick={function(){onChange(checked?selected.filter(function(id){return id!==o.id;}):selected.concat([o.id]));}}>
  <Check on={checked}/>
  {o.label}
</label>
    );})}
</div>
  )}
</div>
  );
}

function LongTextField({f,sid,val,onCommit}){
  var taRef=useRef(null);
  function wrap(pre,post,placeholder){
    var ta=taRef.current;if(!ta)return;
    var start=ta.selectionStart,end=ta.selectionEnd;
    var text=ta.value;
    var selected=text.slice(start,end)||placeholder;
    var newValue=text.slice(0,start)+pre+selected+post+text.slice(end);
    ta.value=newValue;
    var cursor=start+pre.length+selected.length+post.length;
    ta.focus();ta.setSelectionRange(cursor,cursor);
    onCommit(newValue);
  }
  function list(){
    var ta=taRef.current;if(!ta)return;
    var start=ta.selectionStart;
    var text=ta.value;
    var lineStart=text.lastIndexOf('\n',start-1)+1;
    var newValue=text.slice(0,lineStart)+'- '+text.slice(lineStart);
    ta.value=newValue;
    var cursor=start+2;
    ta.focus();ta.setSelectionRange(cursor,cursor);
    onCommit(newValue);
  }
  return(
<div className="wv-field-wrap">
  <label className="wv-field-lbl">{f.label}</label>
  <div style={{display:'flex',gap:2,marginBottom:4}}>
    <button type="button" className="btn-icon" title="Bold" onMouseDown={function(e){e.preventDefault();wrap('**','**','bold text');}}><span className="mi" style={{fontSize:16}}>format_bold</span></button>
    <button type="button" className="btn-icon" title="Italic" onMouseDown={function(e){e.preventDefault();wrap('*','*','italic text');}}><span className="mi" style={{fontSize:16}}>format_italic</span></button>
    <button type="button" className="btn-icon" title="Bulleted list" onMouseDown={function(e){e.preventDefault();list();}}><span className="mi" style={{fontSize:16}}>format_list_bulleted</span></button>
  </div>
  <Field defaultValue={val} placeholder={'Add '+f.label.toLowerCase()+'...'} resizeMode="manual" rows={5} innerRef={taRef} wrap={false} onBlur={function(e){onCommit(e.target.value);}}/>
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
  <TertiaryButton onClick={function(e){var r=e.currentTarget.getBoundingClientRect();setPos({top:r.bottom+4,left:r.right-180});setOpen(!open);}} style={{color:hasActive?'var(--indigo)':'#A88060',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap'}}>
    <span className="mi" style={{fontSize:18}}>sort</span>Sort
  </TertiaryButton>
  {open&&(
<div style={{position:'fixed',top:pos.top,left:pos.left,zIndex:400,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:'var(--rl)',boxShadow:'0 8px 28px rgba(42,31,16,.14)',minWidth:180,padding:10}}>
  <div style={{fontSize:11,fontWeight:600,color:'var(--indigo)',textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Sort</div>
  {[['name','Name A–Z'],['recent','Recently added'],['tagged','Most tagged in drafts']].map(function(o){return(
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
function CollTab({coll,isActive,pid,app,activeColl,setActiveColl,closeDetail,setSearch,setShowCollSettings}){
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
  return(<div className={'strands-tab'+(isActive?' active':'')} onClick={function(){closeDetail();setActiveColl(coll);setSearch('');setShowCollSettings(false);}} onDoubleClick={function(){if(isNative)setEditing(true);}} title={isNative?undefined:'Shared from another project — rename from its source'} style={{display:'flex',alignItems:'center',gap:6}}>
    {tabIcon&&<span className="material-symbols-outlined" style={{fontSize:16,color:isActive?tabColor:'rgba(122,90,56,.75)'}}>{tabIcon}</span>}
    {coll}
  </div>);
}

// ── IconSearchPopup ──
// Uses full Material Symbols library — no hardcoded list
var COMMON_ICONS=['auto_stories','edit_note','person','group','location_on','map','home','castle','star','favorite','bookmark','key','lock','palette','lightbulb','flag'];
var SEARCHABLE_ICONS=COMMON_ICONS.concat(['park','public','flight','brush','photo_camera','music_note','theater_comedy','movie','shield','diamond','trophy','cake','restaurant','science','code','computer','rocket_launch','medical_services','fitness_center','spa','bolt','warning','info','celebration','emoji_events','campaign','explore','psychology','history_edu','menu_book','article','nature','water_drop','eco','cloud','terrain','anchor','volcano','account_balance','gavel','savings','trending_up','analytics','verified','military_tech','grade','contacts','badge','handshake','waving_hand','elderly','child_care','apartment','cottage','cabin','forest','beach_access','landscape','travel_explore','train','directions_car','near_me','air','sunny','wb_sunny','nights_stay','ac_unit','grass','headphones','piano','mic','sports_esports','casino','sports','gesture','animation','stethoscope','vaccines','medication','monitor_heart','self_improvement','emergency','check_circle','cancel','add_circle']);

function IconSearchPopup({currentIcon,currentColor,onSelectIcon,onSelectColor,onClose}){
  var sq=useState('');var q=sq[0];var setQ=sq[1];
  var showCommon=!q.trim();
  var iconStyle={fontFamily:"'Material Symbols Outlined'",fontStyle:'normal',fontSize:24,lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center',letterSpacing:'normal',textTransform:'none',direction:'ltr',WebkitFontSmoothing:'antialiased'};
  var results=showCommon?COMMON_ICONS:SEARCHABLE_ICONS.filter(function(ic){return ic.includes(q.toLowerCase().replace(/\s+/g,'_'));});

  return(
<div style={{position:'fixed',inset:0,zIndex:700,display:'flex',alignItems:'center',justifyContent:'center'}}>
  <div style={{position:'absolute',inset:0,background:'rgba(42,31,16,.3)'}} onClick={onClose}/>
  <div style={{position:'relative',background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:14,padding:24,width:560,maxWidth:'94vw',height:600,maxHeight:'82vh',display:'flex',flexDirection:'column',boxShadow:'0 20px 60px rgba(42,31,16,.2)'}}>
    <div style={{fontFamily:'var(--serif)',fontSize:18,fontWeight:600,marginBottom:16,color:'var(--text)',flexShrink:0}}>Icon &amp; colour</div>
    <div style={{marginBottom:16,flexShrink:0}}>
      <label className="wv-field-lbl">Colour</label>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:6}}>
        {SPOOL_COLORS.map(function(c){var isActive=currentColor===c;return(
<div key={c} onClick={function(){onSelectColor(c);}} style={{width:26,height:26,borderRadius:'50%',background:c,cursor:'pointer',flexShrink:0,transform:isActive?'scale(1.2)':'scale(1)',boxShadow:isActive?'0 0 0 2px var(--bg1),0 0 0 3.5px '+c:'none',transition:'transform .15s'}}/>
        );})}
      </div>
    </div>
    <div style={{marginBottom:10,flexShrink:0}}>
      <label className="wv-field-lbl">Icon</label>
      <div className="wv-search-box" style={{marginTop:6}}>
        <span className="mi wv-search-icon">search</span>
        <input className="wv-search-input" autoFocus value={q} onChange={function(e){setQ(e.target.value);}} placeholder="Search icons…"/>
      </div>
    </div>
    <div style={{overflowY:'auto',flex:1}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {results.map(function(ic){var isActive=currentIcon===ic;return(
<button key={ic} onClick={function(){onSelectIcon(ic);}} title={ic.replace(/_/g,' ')} style={{width:44,height:44,borderRadius:8,border:'1.5px solid '+(isActive?'#c45e28':'var(--border)'),background:isActive?'rgba(196,94,40,.1)':'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}
  onMouseOver={function(e){if(!isActive)e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){if(!isActive)e.currentTarget.style.background='transparent';}}>
  <span style={Object.assign({},iconStyle,{fontSize:22,color:isActive?'#c45e28':'var(--mid)'})}>{ic}</span>
</button>
        );})}
        {results.length===0&&<div style={{fontSize:13,color:'var(--mid)',padding:8}}>No icons match "{q}".</div>}
      </div>
    </div>
    <button className="btn btn-ghost" style={{marginTop:14,width:'100%',justifyContent:'center',flexShrink:0}} onClick={onClose}>Close</button>
  </div>
</div>
  );
}

// ── NewSpoolModal ──
var SPOOL_ICONS=['auto_stories','gesture','hub','lightbulb','book_ribbon','favorite','star','location_on','person','group','explore','psychology','edit_note','campaign','local_library','history_edu','science','palette','music_note','sports_esports'];
var SPOOL_COLORS=['#c45e28','#2f76e0','#2f9966','#ce2fe0','#e02f79','#e8a030','#b83220','#2fe07f','#64e02f','#f0c050','#7a5a38','#a88060','#8a3a10','#6b4a26','#2f9999','#6b2fce','#e02f2f','#2f6bce'];
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
        {showModalIconSearch&&<IconSearchPopup currentIcon={icon} currentColor={color} onSelectIcon={function(ic){setIcon(ic);}} onSelectColor={function(c){setColor(c);}} onClose={function(){setShowModalIconSearch(false);}}/> }      </div>
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
<div key={r.id+i} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 0',borderBottom:'1px solid #E2D0B8'}}>
  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:16,color:'#7A5A38',flexShrink:0}}>{st.name}</span>
  <span className="mi" style={{fontSize:16,color:'#A88060',flexShrink:0}}>arrow_forward</span>
  <input value={r.label} onChange={function(e){updateLabel(i,e.target.value);}} placeholder="Add relationship…" style={{flex:1,minWidth:0,fontFamily:"'DM Sans',sans-serif",fontSize:16,color:'#A88060',background:'transparent',border:'none',outline:'none',padding:0,fontStyle:r.label?'normal':'italic'}}/>
  <button onClick={function(){removeRef(i);}} style={{background:'none',border:'none',cursor:'pointer',padding:2,color:'#A88060',opacity:.6,display:'flex',alignItems:'center',flexShrink:0}}>
    <span className="material-symbols-outlined" style={{fontSize:16}}>close</span>
  </button>
</div>
    );
  })}

  {/* Add new ref — show if multiple allowed or no refs yet */}
  {(f.refMultiple||refs.length===0)&&(
<div style={{display:'flex',flexDirection:'column',gap:6}}>
  {/* Search + select */}
  <div className="wv-search-box">
    <span className="mi wv-search-icon">search</span>
    <input className="wv-search-input" value={searchQ} onChange={function(e){setSearchQ(e.target.value);setSelId('');}} placeholder={'Search '+refCollName+'…'}/>
  </div>
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

// ── Mobile spool-switcher styles (scoped to this file — new classnames only, doesn't touch shared global CSS) ──
var SPOOL_SWITCHER_CSS=`
.spool-mobile-bar{display:flex;align-items:center;gap:8px;padding:0 12px;height:64px;box-sizing:border-box;border-bottom:1px solid #A88060;background:#EDE0CC;flex-shrink:0;}
.spool-mobile-current{display:flex;align-items:center;gap:8px;flex:1;min-width:0;padding:8px 12px;border-radius:10px;border:1px solid #A88060;background:#FDF8F0;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;color:#6B4A26;}
.spool-mobile-current span.name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left;}
.spool-switcher-overlay{position:fixed;inset:0;z-index:60;background:var(--bg1);display:flex;flex-direction:column;}
.spool-switcher-hdr{display:flex;align-items:center;gap:8px;padding:14px 16px;border-bottom:1px solid var(--border);flex-shrink:0;}
.spool-switcher-body{flex:1;overflow-y:auto;padding:12px 16px 24px;}
.spool-switcher-search{display:flex;align-items:center;gap:8px;padding:0 12px;border:1px solid var(--border);border-radius:10px;background:var(--bg2);margin-bottom:10px;}
.spool-switcher-search input{flex:1;border:none;background:transparent;outline:none;font-size:15px;padding:10px 0;}
.spool-switcher-sort{display:flex;gap:6px;margin-bottom:14px;}
.spool-switcher-sort button{flex:1;padding:7px 0;border-radius:8px;border:1px solid var(--border);background:transparent;font-size:12px;font-family:'DM Sans',sans-serif;font-weight:600;color:var(--mid);cursor:pointer;}
.spool-switcher-sort button.active{background:var(--indigo);border-color:var(--indigo);color:#fff;}
.spool-switcher-row{display:flex;align-items:center;gap:12px;padding:12px 10px;border-radius:10px;cursor:pointer;}
.spool-switcher-row:active{background:var(--bg2);}
.spool-switcher-row.active{background:rgba(196,94,40,.08);}
.spool-switcher-ic{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.spool-switcher-name{flex:1;min-width:0;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.spool-switcher-count{font-size:12px;color:var(--mid);flex-shrink:0;}
/* The list panel now sits on the left of the split view (Webflow-style —
   list, then detail beside it), reversing Drawer's default right-hand
   placement, so its divider border needs to flip sides to sit between the
   two panels rather than on the outer edge. Scoped to this page only. */
.strands-layout .wv-drawer--inline{border-left:none;border-right:1px solid var(--border);}
.strands-layout .wv-drawer--flexw{border-right:none;}
/* When the list is full-page (no item selected — desktop full-width, or
   mobile's always-full-screen list), the footer's Add button shouldn't
   stretch edge to edge with it. */
.strands-layout .wv-drawer--flexw .wv-btn{max-width:400px;margin:0;}
/* "New Spool" tab-add icon — same treatment as the Canvas board-add tab,
   so creating a new collection reads as "adding another tab" consistently
   across the app. */
.strands-tab-add{width:32px;height:32px;border-radius:8px;border:1px dashed #A88060;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  color:rgba(122,90,56,.6);font-size:20px;flex-shrink:0;margin:0 0 6px 6px;
  transition:all .12s;line-height:1;user-select:none;}
.strands-tab-add:hover{border-color:var(--indigo);color:var(--indigo);background:rgba(196,94,40,.08);}
.strands-tab-add-wrap{display:flex;align-items:center;height:44px;padding:0 12px;
  margin:0 0 0 6px;border-radius:10px 10px 0 0;border:1px solid #A88060;
  background:#FDF8F0;flex-shrink:0;}
.strands-tab-add-input{background:none;border:none;outline:none;font-family:'DM Sans',sans-serif;
  font-size:16px;font-weight:600;color:#6B4A26;width:130px;padding:0;}
/* The list's own Drawer header just repeats the active tab's name — the
   tab bar above it already shows that, so it's a redundant title + stroke. */
.strands-layout .wv-drawer-hdr{display:none;}
.strands-layout .wv-drawer{background:#FDF8F0;}
.strands-layout .wv-drawer-toolbar{background:#FDF8F0;}
.strands-layout .wv-drawer-footer{background:#FDF8F0;}
.strands-layout .wv-drawer-body--pad{padding:40px;}
@media(max-width:768px){
  /* On this page the global .nav bar AND our own .spool-mobile-bar both sit
     above the strand-list Drawer, so its default single-bar mobile offset
     (SharedUI's .wv-drawer--inline, calibrated for .nav alone) needs to
     account for both stacked bars here. Scoped to .strands-layout so it
     doesn't affect Drawer usage on any other page. */
  .strands-layout .wv-drawer--inline{top:128px;}
}
`;
function SpoolSwitcherStyles(){return <style dangerouslySetInnerHTML={{__html:SPOOL_SWITCHER_CSS}}/>;}

// ── SpoolSwitcherSheet ──
// Mobile-only full-screen collection switcher: search bar + sortable list.
// Fixes the mobile bug where the horizontal tab bar overflowed the screen
// and made every collection but the visible one unreachable.
function SpoolSwitcherSheet({collNames,activeColl,projTemplates,projStrands,onSelect,onClose,onOpenSettings,onCreateNew}){
  var sq=useState('');var q=sq[0];var setQ=sq[1];
  var sm=useState('custom');var sortMode=sm[0];var setSortMode=sm[1];
  function findTpl(coll){return projTemplates.find(function(t){return t.name===coll;})||null;}
  var list=collNames.filter(function(c){return !q.trim()||c.toLowerCase().includes(q.toLowerCase());});
  if(sortMode==='az')list=list.slice().sort(function(a,b){return a.localeCompare(b);});
  return(
<div className="spool-switcher-overlay">
  <div className="spool-switcher-hdr">
    <button className="btn-icon" onClick={onClose}><span className="mi">arrow_back</span></button>
    <span style={{fontFamily:'var(--serif)',fontSize:17,fontWeight:600,flex:1}}>Switch Spool</span>
    <button className="btn-icon" onClick={onOpenSettings} title="Spool settings"><span className="mi" style={{fontSize:18}}>settings</span></button>
    <button className="btn-icon" onClick={onCreateNew} title="Create Spool"><span className="mi" style={{fontSize:20}}>add</span></button>
  </div>
  <div className="spool-switcher-body">
    <div className="spool-switcher-search">
      <span className="mi" style={{fontSize:18,color:'var(--mid)',marginLeft:2}}>search</span>
      <input autoFocus value={q} onChange={function(e){setQ(e.target.value);}} placeholder="Search spools…"/>
    </div>
    <div className="spool-switcher-sort">
      <button className={sortMode==='custom'?'active':''} onClick={function(){setSortMode('custom');}}>Custom order</button>
      <button className={sortMode==='az'?'active':''} onClick={function(){setSortMode('az');}}>A–Z</button>
    </div>
    {list.length===0?(
      <HelpText>No spools match "{q}".</HelpText>
    ):list.map(function(coll){
      var tpl=findTpl(coll);
      var count=(projStrands[coll]||[]).length;
      var color=(tpl&&tpl.color)||'#7A5A38';
      var icon=(tpl&&tpl.icon)||null;
      var isActive=coll===activeColl;
      return(
<div key={coll} className={'spool-switcher-row'+(isActive?' active':'')} onClick={function(){onSelect(coll);}}>
  <div className="spool-switcher-ic" style={{background:color}}>
    {icon?<span className="material-symbols-outlined" style={{fontSize:18,color:'#fff'}}>{icon}</span>:<span style={{fontFamily:'DM Sans,sans-serif',fontSize:13,fontWeight:700,color:'#fff'}}>{initials(coll)}</span>}
  </div>
  <span className="spool-switcher-name">{coll}</span>
  <span className="spool-switcher-count">{count}</span>
  {isActive&&<span className="mi" style={{fontSize:18,color:'var(--indigo)'}}>check</span>}
</div>
      );
    })}
  </div>
</div>
  );
}

// ── StrandsPage ──
function StrandsPage({app,allProjects}){
  var pid=app.projId;
  var projStrands=app.allStrands[pid]||{};
  var projTemplates=app.allTemplates[pid]||[];
  var rawColl=Object.keys(projStrands);
  // Explicit, persisted display order for collection tabs — decoupled from
  // Object.keys() insertion order (which is fragile: object key order isn't
  // a real ordering guarantee and previously got mutated purely for display
  // purposes). null while the persisted order is still loading.
  var sco3=useState(null);var collOrder=sco3[0];var setCollOrder=sco3[1];
  useEffect(function(){
    var cancelled=false;
    loadDB('woven:collOrder:'+pid,null).then(function(saved){
      if(cancelled)return;
      setCollOrder(Array.isArray(saved)?saved:[]);
    });
    return function(){cancelled=true;};
  },[pid]);
  // Reconcile: drop collections that no longer exist, append any that
  // aren't tracked yet (newly created, or shared in from another project),
  // and persist the reconciled order so it's durable going forward.
  useEffect(function(){
    setCollOrder(function(prev){
      if(prev===null)return prev;
      var merged=prev.filter(function(c){return rawColl.includes(c);}).concat(rawColl.filter(function(c){return !prev.includes(c);}));
      var changed=merged.length!==prev.length||merged.some(function(c,i){return c!==prev[i];});
      if(changed){saveDB('woven:collOrder:'+pid,merged);return merged;}
      return prev;
    });
  },[rawColl.join('|')]);
  var collNames=collOrder===null?rawColl:collOrder.filter(function(c){return rawColl.includes(c);}).concat(rawColl.filter(function(c){return !collOrder.includes(c);}));
  if(collNames.length===0)collNames=['Characters'];
  var sac=useState(function(){ return app.strandsFocusColl && collNames.includes(app.strandsFocusColl) ? app.strandsFocusColl : collNames[0]; });var activeColl=sac[0];var setActiveColl=sac[1];
  // The initializer above runs once, before the persisted collOrder has
  // loaded — it only has rawColl's (unordered) key order to guess from. Once
  // the real order arrives, correct the default tab to match it — but only
  // once, so we don't clobber a tab the user already clicked in the interim.
  var collOrderAppliedRef=useRef(false);
  useEffect(function(){
    if(collOrderAppliedRef.current)return;
    if(collOrder===null)return;
    collOrderAppliedRef.current=true;
    var proper=app.strandsFocusColl && collNames.includes(app.strandsFocusColl) ? app.strandsFocusColl : collNames[0];
    if(proper&&proper!==activeColl)setActiveColl(proper);
  },[collOrder]);
  var sasi=useState(null);var activeStrandId=sasi[0];var setActiveStrandId=sasi[1];
  var ssc=useState('');var search=ssc[0];var setSearch=ssc[1];
  var sss=useState('name');var strandSort=sss[0];var setStrandSort=sss[1];
  // Sort preference is a personal display setting, not project data — it
  // persists globally (not scoped to this project) until explicitly changed.
  useEffect(function(){
    loadDB('woven:strandSort','name').then(function(saved){
      if(saved)setStrandSort(saved);
    });
  },[]);
  function updateStrandSort(val){setStrandSort(val);saveDB('woven:strandSort',val);}
  var ssf=useState(null);var strandFilter=ssf[0];var setStrandFilter=ssf[1];
  var snc=useState(false);var newColl=snc[0];var setNewColl=snc[1];
  var sncn=useState('');var newCollName=sncn[0];var setNewCollName=sncn[1];
  var scs=useState(false);var showCollSettings=scs[0];var setShowCollSettings=scs[1];
  var isMobile=useIsMobile();
  var smdo=useState(false);var mobileDetailOpen=smdo[0];var setMobileDetailOpen=smdo[1];
  var savt=useState(false);var showAvatarEdit=savt[0];var setShowAvatarEdit=savt[1];
  var ssw2=useState(false);var showSpoolSwitcher=ssw2[0];var setShowSpoolSwitcher=ssw2[1];
  var collStrands=projStrands[activeColl]||[];
  var filtered=(search?collStrands.filter(function(s){return s.name&&s.name.toLowerCase().includes(search.toLowerCase());}):collStrands)
    .filter(function(s){if(!strandFilter)return true;var val=s.fields&&s.fields[strandFilter.fieldId];return val&&val.toLowerCase().includes(strandFilter.value.toLowerCase());})
    .slice().sort(function(a,b){if(strandSort==='name')return (a.name||'').localeCompare(b.name||'');if(strandSort==='recent')return (b.createdAt||'').localeCompare(a.createdAt||'');if(strandSort==='tagged')return getDraftAppearances(b.id).length-getDraftAppearances(a.id).length;return 0;});
  // No default selection — landing on a collection shows the list; opening
  // an item is an explicit action (click a row, or create a new one).
  var activeStrand=activeStrandId?(filtered.find(function(s){return s.id===activeStrandId;})||null):null;
  function getTpl(coll){return projTemplates.find(function(t){return t.name===coll;})||null;}
  var activeTpl=getTpl(activeColl);
  var fields=activeTpl?activeTpl.fields:defaultFields(activeColl);
  function updateStrand(sid,changes){app.updateStrand(pid,activeColl,sid,changes);}
  function updateField(sid,fieldId,val){if(!activeStrand)return;var nf=Object.assign({},activeStrand.fields||{});nf[fieldId]=val;updateStrand(sid,{fields:nf});}
  function addStrand(){var tpl=getTpl(activeColl);var ns={id:genId(),templateId:tpl?tpl.id:'',collectionName:activeColl,name:'',color:({"Characters":"#c45e28","Locations":"#2f9966","Plot Threads":"#2f76e0","Sources":"#ce2fe0","Interviews":"#e02f79","Subjects":"#e8a030","Scenes":"#64e02f","Topics":"#2fe07f","Lore & World":"#e8a030","Reports":"#b83220","Audience Notes":"#f0c050"}[activeColl])||PRESET_COLORS[Math.floor(Math.random()*PRESET_COLORS.length)],image:null,fields:{},createdAt:new Date().toISOString()};app.addStrand(pid,activeColl,ns);setActiveStrandId(ns.id);if(isMobile)setMobileDetailOpen(true);}
  // Closing a still-untitled item discards it rather than leaving a blank
  // "Spool name 1"-style entry behind — nothing is really "saved" until a
  // title is actually given.
  function closeDetail(){
    if(activeStrand&&(!activeStrand.name||!activeStrand.name.trim())){
      app.deleteStrand(pid,activeColl,activeStrand.id);
    }
    setActiveStrandId(null);
    if(isMobile)setMobileDetailOpen(false);
  }
  function addCollection(){var name=newCollName.trim();if(!name)return;var nt={id:genId(),projectId:pid,name:name,fields:defaultFields(name),sharedWith:[]};app.addTemplate(pid,nt);app.setAllStrands(function(prev){var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});ps[name]=[];n[pid]=ps;saveDB('woven:strands:'+pid,ps);return n;});setActiveColl(name);setNewColl(false);setNewCollName('');
    // Land in the collection builder rather than an empty item list. Seed
    // editing state from the template we just built locally — activeTpl
    // won't reflect it until the next render, so reading from it here would
    // still show the previous collection's settings.
    setEditingFields([...nt.fields]);setSharedWith(nt.sharedWith||[]);setEditingSpoolColor(null);setEditingSpoolIcon(null);setShowCollSettings(true);
  }
  function handleImageUpload(e,sid){var file=e.target.files&&e.target.files[0];if(!file)return;uploadImage(file).then(function(url){if(url)updateStrand(sid,{image:url});});}
  function getDraftAppearances(sid){return(app.allDrafts[pid]||[]).filter(function(d){return(d.strandTags||[]).includes(sid);});}
  function renderFieldInput(f,sid,val){
    if(f.type==='long_text')return <LongTextField key={sid+'-'+f.id} f={f} sid={sid} val={val} onCommit={function(newVal){updateField(sid,f.id,newVal);}}/>;
    if(f.type==='boolean')return(
<div key={sid+'-'+f.id} className="wv-field-wrap">
  <label className="wv-field-lbl">{f.label}</label>
  <div style={{display:'flex',gap:16}}>
    {['Yes','No'].map(function(opt){return(
      <Radio key={opt} on={val===opt} label={opt} onClick={function(){updateField(sid,f.id,opt);}}/>
    );})}
  </div>
</div>
    );
    if(f.type==='select')return(
<SelectField key={sid+'-'+f.id} label={f.label} defaultValue={val} onChange={function(e){updateField(sid,f.id,e.target.value);}}>
  <option value="">Select...</option>
  {(f.options||[]).map(function(o){return <option key={o} value={o}>{o}</option>;})}
</SelectField>
    );
    if(f.type==='date')return <InputField key={sid+'-'+f.id} label={f.label} type="date" defaultValue={val} onChange={function(e){updateField(sid,f.id,e.target.value);}}/>;
    if(f.type==='number')return <InputField key={sid+'-'+f.id} label={f.label} type="number" defaultValue={val} placeholder={'Add '+f.label.toLowerCase()+'...'} onBlur={function(e){updateField(sid,f.id,e.target.value);}}/>;
    if(f.type==='strand_ref'){
      return(
<div key={sid+'-'+f.id} className="wv-field-wrap">
  <label className="wv-field-lbl">{f.label}</label>
  <StrandRefField f={f} sid={sid} val={val} pid={pid} app={app} onUpdate={function(newVal){updateField(sid,f.id,newVal);}}/>
</div>
      );
    }
    return <Field key={sid+'-'+f.id} label={f.label} defaultValue={val} placeholder={'Add '+f.label.toLowerCase()+'...'} onBlur={function(e){updateField(sid,f.id,e.target.value);}}/>;
  }
  // Collection settings editing
  var sef=useState(null);var editingFields=sef[0];var setEditingFields=sef[1];
  var sesc=useState(null);var editingSpoolColor=sesc[0];var setEditingSpoolColor=sesc[1];
  var sesi=useState(null);var editingSpoolIcon=sesi[0];var setEditingSpoolIcon=sesi[1];
  var ssis=useState(false);var showIconSearch=ssis[0];var setShowIconSearch=ssis[1];
  var snfn=useState('');var newFieldName=snfn[0];var setNewFieldName=snfn[1];
  var sfct=useState(null);var chosenFieldType=sfct[0];var setChosenFieldType=sfct[1];
  var ssw=useState([]);var sharedWith=ssw[0];var setSharedWith=ssw[1];
  var spd=useState(null);var pendingDeleteFieldIdx=spd[0];var setPendingDeleteFieldIdx=spd[1];
  function openCollSettings(){setEditingFields(activeTpl?[...activeTpl.fields]:[]);setSharedWith(activeTpl?activeTpl.sharedWith||[]:[]);setEditingSpoolColor(activeTpl?activeTpl.color||null:null);setEditingSpoolIcon(activeTpl?activeTpl.icon||null:null);setShowCollSettings(true);}
  // Every settings change saves immediately — no separate Save step.
  function commitFields(nf){setEditingFields(nf);if(activeTpl)app.updateTemplate(pid,activeTpl.id,{fields:nf});}
  function commitColor(c){setEditingSpoolColor(c);if(activeTpl)app.updateTemplate(pid,activeTpl.id,{color:c});}
  function commitIcon(ic){setEditingSpoolIcon(ic);if(activeTpl)app.updateTemplate(pid,activeTpl.id,{icon:ic});}
  function commitSharedWith(list){setSharedWith(list);if(activeTpl)app.updateTemplate(pid,activeTpl.id,{sharedWith:list});}
  // A field can't be deleted while any existing strand in this collection
  // still has data in it — deleting it would silently destroy that data.
  function fieldHasContent(fieldId){
    return fieldContentCount(fieldId)>0;
  }
  function fieldContentCount(fieldId){
    var items=(app.allStrands[pid]&&app.allStrands[pid][activeColl])||[];
    return items.filter(function(s){
      var v=s.fields&&s.fields[fieldId];
      if(v===undefined||v===null)return false;
      if(typeof v==='string')return v.trim().length>0;
      return true;
    }).length;
  }
  var sfdb=useState(null);var fieldDeleteBlockedIdx=sfdb[0];var setFieldDeleteBlockedIdx=sfdb[1];
  function requestDeleteField(idx){
    var f=editingFields[idx];if(!f)return;
    if(fieldHasContent(f.id)){setFieldDeleteBlockedIdx(idx);return;}
    setPendingDeleteFieldIdx(idx);
  }
  function confirmDeleteField(){
    if(pendingDeleteFieldIdx===null)return;
    commitFields(editingFields.filter(function(_,j){return j!==pendingDeleteFieldIdx;}));
    setPendingDeleteFieldIdx(null);
  }
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
  function addFieldToSettings(){if(!newFieldName.trim()||!chosenFieldType)return;commitFields(editingFields.concat([{id:genId(),label:newFieldName.trim(),type:chosenFieldType}]));setNewFieldName('');setChosenFieldType(null);}
  var otherProjects=allProjects.filter(function(p){return p.id!==pid;});
  var sco2=useState(null);var dragOverColl=sco2[0];var setDragOverColl=sco2[1];
  function reorderColls(fromColl,toColl){
    if(fromColl===toColl)return;
    setCollOrder(function(prev){
      var order=(prev&&prev.length?prev:collNames).slice();
      var fi=order.indexOf(fromColl);var ti=order.indexOf(toColl);
      if(fi<0||ti<0)return prev;
      order.splice(fi,1);order.splice(ti,0,fromColl);
      saveDB('woven:collOrder:'+pid,order);
      return order;
    });
  }
  var detailContent=showCollSettings&&editingFields?(
<div style={{padding:40,position:'relative'}}>
  {!isMobile&&<button className="btn-icon" onClick={function(){setShowCollSettings(false);}} title="Close" style={{position:'absolute',top:16,right:16}}><span className="mi" style={{fontSize:22}}>close</span></button>}
  <div style={{maxWidth:900,margin:'0 auto'}}>
  {activeTpl&&activeTpl.projectId!==pid&&(function(){
    var srcProj=allProjects.find(function(p){return p.id===activeTpl.projectId;});
    return <div style={{fontSize:12,color:'var(--mid)',marginBottom:16}}>Shared from {srcProj?srcProj.title:'another project'} — fields and items are editable here, but the collection itself (rename, delete, sharing) is managed from its source.</div>;
  })()}

  {/* Hero: icon/colour thumbnail (click opens combined icon+colour picker) + name */}
  <div style={{display:'flex',gap:20,alignItems:'flex-start',marginBottom:32,position:'relative'}}>
    <CollectionIconThumb color={editingSpoolColor||activeTpl&&activeTpl.color||'#c45e28'} icon={editingSpoolIcon||activeTpl&&activeTpl.icon||'auto_stories'} onClick={function(){setShowIconSearch(true);}}/>
    {showIconSearch&&<IconSearchPopup currentIcon={editingSpoolIcon||activeTpl&&activeTpl.icon||'auto_stories'} currentColor={editingSpoolColor||activeTpl&&activeTpl.color||'#c45e28'} onSelectIcon={function(ic){commitIcon(ic);}} onSelectColor={function(c){commitColor(c);}} onClose={function(){setShowIconSearch(false);}}/>}
    <div style={{flex:1,minWidth:0,paddingTop:8}}>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:24,color:'#6B4A26'}}>{activeColl}</div>
    </div>
  </div>

  {pendingDeleteFieldIdx!==null&&(
<DeleteConfirmModal
  itemName={editingFields[pendingDeleteFieldIdx]&&editingFields[pendingDeleteFieldIdx].label}
  message="This field will be removed from the template."
  confirmLabel="Delete field"
  onConfirm={confirmDeleteField}
  onCancel={function(){setPendingDeleteFieldIdx(null);}}
/>
  )}
  {fieldDeleteBlockedIdx!==null&&(function(){
    var f=editingFields[fieldDeleteBlockedIdx];
    var count=f?fieldContentCount(f.id):0;
    return(
<div className="modal-overlay">
  <div className="modal-backdrop" onClick={function(){setFieldDeleteBlockedIdx(null);}}/>
  <div className="modal-box" style={{maxWidth:400}}>
    <div style={{fontFamily:'var(--serif)',fontSize:20,fontWeight:600,marginBottom:12,color:'var(--text)'}}>Can't delete "{f&&f.label}"</div>
    <div style={{fontSize:14,color:'var(--body-text)',lineHeight:1.6,marginBottom:20}}>This field has content on <strong>{count}</strong> existing {count===1?'item':'items'}. Remove that data first if you want to delete the field.</div>
    <button className="btn btn-primary" style={{width:'100%',justifyContent:'center'}} onClick={function(){setFieldDeleteBlockedIdx(null);}}>Got it</button>
  </div>
</div>
    );
  })()}

  <div className="wv-field-wrap" style={{marginBottom:24}}>
  <label className="wv-field-lbl">Fields</label>
  <div style={{marginTop:12}}>
  {editingFields.map(function(f,i){return(
<div key={f.id} draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('fieldIdx',''+i);}}
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){e.preventDefault();var from=parseInt(e.dataTransfer.getData('fieldIdx'),10);if(isNaN(from)||from===i)return;var nf=editingFields.slice();var item=nf.splice(from,1)[0];nf.splice(i,0,item);commitFields(nf);}}
  style={{borderBottom:'1px solid var(--bg2)',padding:'8px 0'}}>
  <div style={{display:'flex',alignItems:'center',gap:7}}>
    <span className="mi" style={{fontSize:18,color:'var(--border)',cursor:'grab',flexShrink:0}}>drag_indicator</span>
    <span className="material-symbols-outlined" style={{fontSize:16,color:'#A88060',flexShrink:0}}>{(FIELD_TYPE_INFO[f.type]||{}).icon||'text_fields'}</span>
    <input defaultValue={f.label} style={{maxWidth:160,fontSize:13}} onBlur={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{label:e.target.value});commitFields(nf);}}/>
    <SelectField wrap={false} value={f.type} style={{width:110,fontSize:13,padding:'6px 8px'}} onChange={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{type:e.target.value,refSpool:null,refMultiple:false,options:null});commitFields(nf);}}>
      {FIELD_TYPES.map(function(t){return <option key={t.id} value={t.id}>{t.label}</option>;})}
    </SelectField>
    <button className="btn-icon" title="Delete field" onClick={function(){requestDeleteField(i);}}><span className="mi" style={{fontSize:18}}>delete</span></button>
  </div>
  {f.type==='strand_ref'&&(
<div style={{display:'flex',gap:4,alignItems:'center',marginTop:6,marginLeft:26}}>
  <SelectField wrap={false} value={f.refSpool||''} style={{fontSize:11,flex:1,padding:'4px 6px'}} onChange={function(e){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{refSpool:e.target.value});commitFields(nf);}}>
    <option value="">Pick spool…</option>
    {Object.keys(app.allStrands[pid]||{}).map(function(c){return <option key={c} value={c}>{c}</option>;})}
  </SelectField>
  <label style={{fontSize:11,display:'flex',alignItems:'center',gap:3,whiteSpace:'nowrap',cursor:'pointer'}} onClick={function(){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{refMultiple:!f.refMultiple});commitFields(nf);}}>
    <Check on={!!f.refMultiple}/> Multiple
  </label>
</div>
  )}
  {f.type==='select'&&(
    <div style={{marginLeft:26,marginTop:2}}>
      <OptionsEditor options={f.options} onChange={function(opts){var nf=editingFields.slice();nf[i]=Object.assign({},nf[i],{options:opts});commitFields(nf);}}/>
    </div>
  )}
</div>
  );})}

  {/* Webflow-style field-type picker — open by default, no toggle or container chrome */}
  <div style={{marginTop:16}}>
    {!chosenFieldType?(
<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(150px, 1fr))',gap:10}}>
    {FIELD_TYPES.map(function(t){var info=FIELD_TYPE_INFO[t.id]||{icon:'text_fields',help:''};return(
<button key={t.id} type="button" onClick={function(){setChosenFieldType(t.id);}} style={{display:'flex',flexDirection:'column',alignItems:'center',textAlign:'center',gap:6,padding:'16px 12px',borderRadius:12,border:'1.5px solid var(--border)',background:'var(--bg1)',cursor:'pointer',transition:'all .5s ease'}}
  onMouseOver={function(e){e.currentTarget.style.borderColor='#C45E28';e.currentTarget.style.background='rgba(196,94,40,.05)';}}
  onMouseOut={function(e){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg1)';}}>
  <span className="material-symbols-outlined" style={{fontSize:28,color:'#C45E28'}}>{info.icon}</span>
  <span style={{fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:14,color:'#6B4A26'}}>{t.label}</span>
  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:'var(--mid)',lineHeight:1.35}}>{info.help}</span>
</button>
    );})}
</div>
    ):(
<div className="wv-search-box" style={{gap:8}}>
  <span className="material-symbols-outlined" style={{fontSize:20,color:'#C45E28',flexShrink:0}}>{(FIELD_TYPE_INFO[chosenFieldType]||{}).icon}</span>
  <input className="wv-search-input" autoFocus value={newFieldName} onChange={function(e){setNewFieldName(e.target.value);}} placeholder="Field name" onKeyDown={function(e){if(e.key==='Enter')addFieldToSettings();if(e.key==='Escape'){setChosenFieldType(null);}}}/>
  <button className="btn-icon" title="Back" onClick={function(){setChosenFieldType(null);}}><span className="mi" style={{fontSize:18}}>arrow_back</span></button>
  <PrimaryButton onClick={addFieldToSettings} style={{width:'auto'}}>Add</PrimaryButton>
</div>
    )}
  </div>
  </div>
  </div>

  {(!activeTpl||activeTpl.projectId===pid)&&(
<div className="wv-field-wrap" style={{marginBottom:32}}>
  <label className="wv-field-lbl">Share across projects</label>
  <div style={{marginTop:6}}>
    <MultiSelectDropdown options={otherProjects.map(function(p){return{id:p.id,label:p.title};})} selected={sharedWith} onChange={commitSharedWith} placeholder="Not shared with any other project"/>
  </div>
</div>
  )}

  {deleteCollConfirm&&(
<DeleteConfirmModal
  itemName={activeColl}
  message={<>This will permanently delete the collection and all <strong>{(app.allStrands[pid]&&app.allStrands[pid][activeColl]?app.allStrands[pid][activeColl].length:0)}</strong> strands inside it.</>}
  confirmLabel="Delete collection"
  onConfirm={deleteCollection}
  onCancel={function(){setDeleteCollConfirm(false);}}
/>
  )}
  {(!activeTpl||activeTpl.projectId===pid)&&(
<div style={{paddingTop:24,borderTop:'1px solid var(--border)',textAlign:'center'}}>
  <TertiaryButton onClick={function(){setDeleteCollConfirm(true);}} style={{color:'var(--danger)',display:'inline-flex',alignItems:'center',gap:6}}><span className="mi" style={{fontSize:18}}>delete</span>Delete Spool</TertiaryButton>
</div>
  )}
  </div>
</div>
  ):activeStrand?(
<div style={{padding:40,position:'relative',backgroundImage:'radial-gradient(circle, rgba(160,120,70,0.12) 1px, transparent 1px)',backgroundSize:'22px 22px'}}>
  {!isMobile&&<button className="btn-icon" onClick={closeDetail} title="Back to list" style={{position:'absolute',top:16,right:16}}><span className="mi" style={{fontSize:22}}>close</span></button>}
  <div style={{display:'flex',gap:20,alignItems:'flex-start',marginBottom:24}}>
    <SpoolThumbnailUpload strand={activeStrand} onClick={function(){setShowAvatarEdit(true);}}/>
    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:24}}>
      <input key={activeStrand.id+'-n'} defaultValue={activeStrand.name} placeholder="Title (required)" spellCheck={false} onBlur={function(e){updateStrand(activeStrand.id,{name:e.target.value});}} style={{fontFamily:"'DM Sans',sans-serif",fontWeight:700,fontSize:24,color:'#6B4A26',border:'none',background:'transparent',outline:'none',padding:0,width:'100%',paddingRight:40}}/>
      {fields[0]&&(function(){var f=fields[0];var val=activeStrand.fields&&activeStrand.fields[f.id]?activeStrand.fields[f.id]:'';return renderFieldInput(f,activeStrand.id,val);})()}
    </div>
  </div>
  {showAvatarEdit&&<AvatarEditModal strand={activeStrand} onClose={function(){setShowAvatarEdit(false);}} onSave={function(updates){updateStrand(activeStrand.id,updates);setShowAvatarEdit(false);}}/>}
  {fields.length>1&&(
  <div style={{display:'flex',flexDirection:'column',gap:24}}>
    {fields.slice(1).map(function(f){var val=activeStrand.fields&&activeStrand.fields[f.id]?activeStrand.fields[f.id]:'';return renderFieldInput(f,activeStrand.id,val);})}
  </div>
  )}
  <div className="appears-section">
    <Section label="Appears In">
      <div className="appears-chips">
        {getDraftAppearances(activeStrand.id).map(function(d){return <span key={d.id} className="appears-chip" onClick={function(){app.openDraft(d.id);}}>{d.title||'Untitled'}</span>;})}
        {getDraftAppearances(activeStrand.id).length===0&&<span style={{fontSize:13,color:'var(--mid)'}}>Not tagged in any drafts yet.</span>}
      </div>
    </Section>
  </div>
</div>
  ):(
<div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flex:1,gap:12,color:'var(--mid)',textAlign:'center',padding:32}}>
  <span className="mi" style={{fontSize:40,color:'var(--border)'}}>auto_awesome</span>
  <div style={{fontFamily:'var(--serif)',fontSize:20,color:'var(--mid)'}}>{activeColl}</div>
  <div style={{fontSize:13,color:'var(--placeholder)',marginBottom:4}}>No entries yet</div>
  <PrimaryButton icon="add" onClick={addStrand} style={{width:'auto'}}>Add {activeColl.replace(/s$/,'')}</PrimaryButton>
</div>
  );
  var findSelectIcon=function(collName){var t=projTemplates.find(function(t){return t.name===collName;});return (t&&t.icon)||'auto_stories';};
  var addItemLabel='Add '+activeColl.replace(/s$/,'');
  var findSelectPanel=(
<Drawer variant="inline" title={activeColl} width={activeStrand?undefined:'flex'}
  toolbar={<SearchSortBar value={search} onChange={function(e){setSearch(e.target.value);}} sortSlot={<StrandSortFilter sort={strandSort} setSort={updateStrandSort} strandFilter={strandFilter} setStrandFilter={setStrandFilter} fields={fields}/>}/>}
  footer={<div style={{display:'flex',flexDirection:'column',gap:8}}><PrimaryButton icon="add" onClick={addStrand}>{addItemLabel}</PrimaryButton><TertiaryButton onClick={openCollSettings} style={{color:'#A88060',justifyContent:'center',display:'flex',alignItems:'center',gap:8,width:'100%'}}><span className="mi" style={{fontSize:18}}>settings</span>Edit Spool</TertiaryButton></div>}>
  {filtered.length===0?(
    <HelpText>{collStrands.length===0?'No entries yet.':'No results for "'+search+'".'}</HelpText>
  ):(
    <div>
      {filtered.map(function(st){return(
        <StrandResultRow key={st.id} strand={st} spoolIcon={findSelectIcon(activeColl)} trailingCount={getDraftAppearances(st.id).length} trailingLabel={'Tagged in '+getDraftAppearances(st.id).length+' draft'+(getDraftAppearances(st.id).length===1?'':'s')} onClick={function(){closeDetail();setActiveStrandId(st.id);setShowCollSettings(false);if(isMobile)setMobileDetailOpen(true);}}/>
      );})}
    </div>
  )}
</Drawer>
  );
  return(
<div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
  <SpoolSwitcherStyles/>
  {!isMobile&&(
  <div className="strands-subnav">
    {collNames.map(function(coll){return(
<div key={coll} draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('collName',coll);}}
  onDragOver={function(e){e.preventDefault();setDragOverColl(coll);}}
  onDragLeave={function(){setDragOverColl(null);}}
  onDrop={function(e){e.preventDefault();var from=e.dataTransfer.getData('collName');reorderColls(from,coll);setDragOverColl(null);}}
  style={{borderLeft:dragOverColl===coll?'2px solid var(--indigo)':'2px solid transparent'}}>
  <CollTab coll={coll} isActive={activeColl===coll} pid={pid} app={app} activeColl={activeColl} setActiveColl={setActiveColl} closeDetail={closeDetail} setSearch={setSearch} setShowCollSettings={setShowCollSettings}/>
</div>
    );})}
    {newColl?(
<div className="strands-tab-add-wrap">
  <input autoFocus className="strands-tab-add-input" value={newCollName} onChange={function(e){setNewCollName(e.target.value);}} onBlur={function(){setNewColl(false);setNewCollName('');}} onKeyDown={function(e){if(e.key==='Enter')addCollection();if(e.key==='Escape'){setNewColl(false);setNewCollName('');}}} placeholder="Spool name"/>
</div>
    ):(
<div className="strands-tab-add" onClick={function(){setNewColl(true);}} title="New Spool">+</div>
    )}
    <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto',marginBottom:6}}>
      <TertiaryButton onClick={openCollSettings} style={{color:'#A88060',display:'flex',alignItems:'center',gap:8}}><span className="mi" style={{fontSize:18}}>settings</span>Edit Spool</TertiaryButton>
      <PrimaryButton icon="add" onClick={addStrand} style={{width:'auto'}}>{addItemLabel}</PrimaryButton>
    </div>
  </div>
  )}
  {isMobile&&(
  <div className="spool-mobile-bar">
    <button className="spool-mobile-current" onClick={function(){setShowSpoolSwitcher(true);}}>
      {(function(){var t=getTpl(activeColl);return t&&t.icon?<span className="material-symbols-outlined" style={{fontSize:18,color:t.color||'#6B4A26'}}>{t.icon}</span>:null;})()}
      <span className="name">{activeColl}</span>
      <span className="mi" style={{fontSize:18}}>unfold_more</span>
    </button>
    <button className="btn-icon" onClick={openCollSettings} title="Spool settings"><span className="mi" style={{fontSize:18}}>settings</span></button>
  </div>
  )}
  {isMobile&&newColl&&<NewSpoolModal onConfirm={function(name,icon,color){
    if(!name.trim())return;
    var nt={id:genId(),projectId:pid,name:name.trim(),icon:icon,color:color,fields:defaultFields(name.trim()),sharedWith:[]};
    app.addTemplate(pid,nt);
    app.setAllStrands(function(prev){var n=Object.assign({},prev);var ps=Object.assign({},n[pid]||{});ps[name.trim()]=[];n[pid]=ps;saveDB('woven:strands:'+pid,ps);return n;});
    setActiveColl(name.trim());setNewColl(false);
    // Land in the collection builder rather than an empty item list — same
    // reasoning as addCollection() above: seed from the template we just
    // built locally, since activeTpl won't reflect it until next render.
    setEditingFields([...nt.fields]);setSharedWith(nt.sharedWith||[]);setEditingSpoolColor(nt.color||null);setEditingSpoolIcon(nt.icon||null);setShowCollSettings(true);
  }} onCancel={function(){setNewColl(false);}}/>}
  {isMobile&&showSpoolSwitcher&&(
    <SpoolSwitcherSheet
      collNames={collNames}
      activeColl={activeColl}
      projTemplates={projTemplates}
      projStrands={projStrands}
      onSelect={function(coll){closeDetail();setActiveColl(coll);setSearch('');setShowCollSettings(false);setShowSpoolSwitcher(false);}}
      onClose={function(){setShowSpoolSwitcher(false);}}
      onOpenSettings={function(){setShowSpoolSwitcher(false);openCollSettings();}}
      onCreateNew={function(){setShowSpoolSwitcher(false);setNewColl(true);}}
    />
  )}
  <div className="strands-layout">
    {!isMobile&&showCollSettings&&<div style={{flex:1,overflowY:'auto'}}>{detailContent}</div>}
    {!isMobile&&!showCollSettings&&findSelectPanel}
    {!isMobile&&!showCollSettings&&activeStrand&&<div style={{flex:1,overflowY:'auto'}}>{detailContent}</div>}
    {isMobile&&!mobileDetailOpen&&!showCollSettings&&findSelectPanel}
    {isMobile&&mobileDetailOpen&&(
<div style={{position:'fixed',inset:0,zIndex:50,background:'var(--bg1)',overflow:'auto'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 16px',borderBottom:'1px solid var(--border)'}}>
    <button className="btn-icon" onClick={closeDetail}><span className="mi">arrow_back</span></button>
    <span style={{fontFamily:'var(--serif)',fontSize:17,fontWeight:600}}>{activeColl}</span>
  </div>
  {detailContent}
</div>
    )}
  </div>
</div>
  );
}

export default StrandsPage;
