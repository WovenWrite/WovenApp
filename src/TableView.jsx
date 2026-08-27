// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import BindDrawer from './BindDrawer'
import StrandsDrawer from './StrandsDrawer'
import { StatusSelect, StrandSearchDropdown, FloatingPanel } from './SharedUI'
import { genId, stripHtml, initials } from './utils'
import { projIsNumbered, projSequence, sortDraftsBySequence, draftDateOf, formatDraftDate } from './projectConfig'
import { buildTree, applyFS, loadFilterState, persistFilterState, ViewHeader, DraftLoadingSpinner, EmptyDrafts, LooseThreadsSection, TaggedSpoolsEditor, saveDB, loadDB } from './App'

// ── ExpandingCell ──
// When the row isn't expanded: clamped to 2 lines. When the row IS
// expanded (rowExpanded prop, driven by the parent row): shows full
// unclamped text. Either way, clicking it switches to an auto-growing
// textarea to actually edit, which reverts on blur.
function ExpandingCell({value,placeholder,style,onCommit,rowExpanded}){
  var sv=useState(value||'');var val=sv[0];var setVal=sv[1];
  var sf=useState(false);var focused=sf[0];var setFocused=sf[1];
  var ref=useRef(null);
  useEffect(function(){setVal(value||'');},[value]);
  useEffect(function(){
    if(focused&&ref.current){
      ref.current.style.height='auto';
      ref.current.style.height=ref.current.scrollHeight+'px';
      ref.current.focus();
      var len=ref.current.value.length;
      ref.current.setSelectionRange(len,len);
    }
  },[focused]);
  function commit(){setFocused(false);if(val!==(value||''))onCommit(val);}
  if(!focused){
    var hasVal=!!(value&&value.length);
    var clampStyle=rowExpanded?{whiteSpace:'pre-wrap'}:{display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',whiteSpace:'normal'};
    return <div className="tbl-inp" style={Object.assign({cursor:'text',wordBreak:'break-word'},clampStyle,style,!hasVal?{fontStyle:'italic',opacity:.75,color:'var(--placeholder)'}:null)}
      onClick={function(){setFocused(true);}}>
      {hasVal?value:placeholder}
    </div>;
  }
  return <textarea ref={ref} className="tbl-inp" style={Object.assign({},style,{whiteSpace:'pre-wrap',resize:'none',overflow:'hidden',width:'100%',display:'block'})}
    value={val} placeholder={placeholder}
    onClick={function(e){e.stopPropagation();}}
    onChange={function(e){setVal(e.target.value);e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}}
    onBlur={commit}
    onKeyDown={function(e){if(e.key==='Escape'){setVal(value||'');setFocused(false);}}}/>;
}

// ── SpoolsCell ──
// Default: the same small avatar-stack thumbnails Cards shows outside
// Structure mode, capped at 4 with a "+N" overflow. Expanded (row is in
// its expanded state): the full TaggedSpoolsEditor, matching Cards'
// Structure mode — every tag listed with its own "×", plus the add
// button. No separate collapse control here; the whole row's expanded
// state (toggled by clicking the row, reverted by clicking outside it)
// drives which view renders.
function SpoolsCell({draft,app,pid,expanded}){
  var projStrands=app.allStrands[pid]||{};
  var projTemplates=app.allTemplates[pid]||[];
  var tagged=[];
  Object.keys(projStrands).forEach(function(coll){
    (projStrands[coll]||[]).forEach(function(st){
      if((draft.strandTags||[]).includes(st.id)){
        var tpl=projTemplates.find(function(t){return t.name===coll||t.id===st.templateId;});
        tagged.push(Object.assign({},st,{spoolColor:tpl&&tpl.color?tpl.color:'#c45e28'}));
      }
    });
  });
  if(expanded){
    return <div onClick={function(e){e.stopPropagation();}}><TaggedSpoolsEditor draft={draft} app={app} pid={pid}/></div>;
  }
  if(tagged.length===0){
    return <span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:'var(--placeholder)',fontStyle:'italic'}}>—</span>;
  }
  var visible=tagged.slice(0,4);
  var overflow=tagged.length-4;
  return(
<div style={{display:'flex',alignItems:'center'}}>
  {visible.map(function(st,i){return(
<div key={st.id} title={st.name} style={{width:25,height:25,borderRadius:'50%',background:st.color||'#c45e28',border:'2px solid '+(st.spoolColor||'#c45e28'),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,marginLeft:i>0?-8:0,boxSizing:'border-box'}}>
  {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontFamily:'DM Sans, sans-serif',fontSize:9,fontWeight:700,color:'#fff'}}>{initials(st.name)}</span>}
</div>
  );})}
  {overflow>0&&(
<div title={tagged.slice(4).map(function(s){return s.name;}).join(', ')} style={{width:25,height:25,borderRadius:'50%',background:'#E2D0B8',border:'1px solid #A88060',display:'flex',alignItems:'center',justifyContent:'center',marginLeft:-8,flexShrink:0}}>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:10,color:'#7A5A38',fontWeight:600}}>+{overflow}</span>
</div>
  )}
</div>
  );
}

// ── SpoolRefEmptyPicker ──
// The click-target for an empty spool-reference custom field: clicking it
// opens the same search dropdown used everywhere else in the app for
// picking a spool, and also tags the draft (matching PropertiesDrawer's
// behavior for this same field type). Positioning/viewport-clamping is
// handled by the shared FloatingPanel.
function SpoolRefEmptyPicker({app,pid,draft,fieldDef}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var triggerRef=useRef(null);
  function pick(st){
    var cf=Object.assign({},draft.customFields||{});
    cf[fieldDef.id]=JSON.stringify([st.id]);
    var changes={customFields:cf};
    var tagIds=draft.strandTags||[];
    if(tagIds.indexOf(st.id)<0)changes.strandTags=tagIds.concat([st.id]);
    app.updateDraft(pid,draft.id,changes);
    setOpen(false);
  }
  return(
<div style={{display:'inline-block'}}>
  <button ref={triggerRef} onClick={function(e){e.stopPropagation();setOpen(!open);}} style={{display:'flex',alignItems:'center',gap:4,padding:'3px 8px',borderRadius:12,border:'1px dashed var(--border)',background:'transparent',cursor:'pointer',fontSize:11,color:'var(--mid)',fontFamily:'DM Sans, sans-serif'}}>
    <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--teal)'}}>add</span>
    Add...
  </button>
  <FloatingPanel anchorRef={triggerRef} open={open} onClose={function(){setOpen(false);}} minWidth={220}>
    <StrandSearchDropdown
      app={app}
      pid={pid}
      collection={fieldDef.refSpool}
      excludeIds={[]}
      onPick={pick}
      onClose={function(){setOpen(false);}}
      style={{position:'static',width:220}}
    />
  </FloatingPanel>
</div>
  );
}

// ── BranchCell ──
// The dedicated branch column: "N Strands" + an expand/collapse arrow
// when this draft already has branches; a muted "-" when it doesn't.
// Clicking the "-" opens a small named-input popover (Enter creates the
// branch — a new draft nested under this one, which then renders as a
// new row).
function BranchCell({app,draft,hasChildren,childCount,isExpanded}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var sv=useState('');var name=sv[0];var setName=sv[1];
  var btnRef=useRef(null);
  function createBranch(){
    var title=name.trim();
    if(!title)return;
    var pid=app.projId;
    var siblingCount=(app.allDrafts[pid]||[]).filter(function(d){return d.parentId===draft.id;}).length;
    app.addDraft(pid,{id:genId(),projectId:pid,title:title,synopsis:'',status:draft.status||'first_draft',order:siblingCount+1,parentId:draft.id,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    if(!isExpanded)app.updateDraft(pid,draft.id,{nestExpanded:true});
    setName('');setOpen(false);
  }
  if(hasChildren){
    return(
<div onClick={function(e){e.stopPropagation();app.updateDraft(app.projId,draft.id,{nestExpanded:!isExpanded});}} style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer',color:isExpanded?'#C45E28':'var(--mid)',width:'100%'}}>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:13,fontWeight:500,whiteSpace:'nowrap',flex:1}}>{childCount} Strand{childCount===1?'':'s'}</span>
  <span className="mi" style={{fontSize:16,flexShrink:0}}>{isExpanded?'expand_less':'expand_more'}</span>
</div>
    );
  }
  return(
<div style={{display:'inline-block'}}>
  <span ref={btnRef} onClick={function(e){e.stopPropagation();setOpen(!open);}} style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:'var(--placeholder)',cursor:'pointer'}}>-</span>
  <FloatingPanel anchorRef={btnRef} open={open} onClose={function(){setOpen(false);setName('');}} minWidth={200}>
    <div onClick={function(e){e.stopPropagation();}} style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:10,boxShadow:'0 4px 16px rgba(42,31,16,.12)',padding:8}}>
      <input autoFocus value={name} onChange={function(e){setName(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter')createBranch();if(e.key==='Escape'){setName('');setOpen(false);}}} placeholder="New strand name…" style={{width:'100%',padding:'6px 8px',fontSize:13,border:'1px solid var(--border)',borderRadius:6,fontFamily:'DM Sans, sans-serif',background:'var(--bg2)',color:'var(--text)',outline:'none',boxSizing:'border-box'}}/>
    </div>
  </FloatingPanel>
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
  var colRef=useRef(null);
  // Spool drawer (opened by clicking a spool thumbnail in the Strands column)
  var ssv=useState(null);var spoolView=ssv[0];var setSpoolView=ssv[1]; // {draftId,strandId} | null
  // Row-level expand — clicking a row (like entering Cards' Structure mode)
  // expands everything in it together: full synopsis/text, full spool
  // chips instead of thumbnails. Clicking outside the expanded row
  // collapses it back.
  var ser=useState(null);var expandedRowId=ser[0];var setExpandedRowId=ser[1];
  var rowRefs=useRef({});
  useEffect(function(){
    if(!expandedRowId)return;
    function onDown(e){
      var el=rowRefs.current[expandedRowId];
      if(el&&!el.contains(e.target))setExpandedRowId(null);
    }
    document.addEventListener('mousedown',onDown);
    return function(){document.removeEventListener('mousedown',onDown);};
  },[expandedRowId]);

  var project=app.currentProject||{};
  var draftFieldDefs=project.draftFieldDefs||[];
  var allAvailCols=[
    {id:'title',label:'Title'},
    {id:'branches',label:'Strands'},
    {id:'status',label:'Status'},
    {id:'wordCount',label:'Words'},
    {id:'synopsis',label:'Synopsis'}
    ,{id:'strandTags',label:'Spools'}
  ].concat(draftFieldDefs.map(function(f){return{id:'cf_'+f.id,label:f.label};}));

  // Column order + hidden state, stored separately so custom fields are
  // visible by default (and stay visible automatically as new ones are
  // added) — hiding a column is an explicit opt-out, not a default.
  //
  // Persisted via saveDB/loadDB (Supabase-backed, same as the rest of the
  // app's durable settings) rather than plain localStorage. localStorage
  // is still read synchronously on first paint so there's no flicker —
  // loadDB then corrects it once the real value comes back, which also
  // covers the case where localStorage doesn't have it yet (new device,
  // new browser, or a different deploy/preview origin).
  var orderKey='woven:colorder:'+app.projId;
  var hiddenKey='woven:colhidden:'+app.projId;
  var sco2=useState(function(){
    try{var v=localStorage.getItem(orderKey);if(v){var p=JSON.parse(v);if(Array.isArray(p))return p;}}catch(e){}
    return allAvailCols.map(function(c){return c.id;});
  });
  var colOrder=sco2[0];var setColOrderRaw=sco2[1];
  function persistColOrder(next){setColOrderRaw(next);saveDB(orderKey,next);}
  var shs=useState(function(){
    try{var v=localStorage.getItem(hiddenKey);if(v){var p=JSON.parse(v);if(Array.isArray(p))return p;}}catch(e){}
    return [];
  });
  var hiddenCols=shs[0];var setHiddenColsRaw=shs[1];
  function persistHiddenCols(next){setHiddenColsRaw(next);saveDB(hiddenKey,next);}
  useEffect(function(){
    loadDB(orderKey,null).then(function(v){if(Array.isArray(v))setColOrderRaw(v);});
    loadDB(hiddenKey,null).then(function(v){if(Array.isArray(v))setHiddenColsRaw(v);});
  },[orderKey,hiddenKey]);
  var availIds={};allAvailCols.forEach(function(c){availIds[c.id]=true;});
  // Reconcile: any available column not yet tracked in colOrder gets
  // appended. Runs off the full column-id list (not just custom fields)
  // so a built-in column can never permanently vanish either.
  useEffect(function(){
    var known={};colOrder.forEach(function(id){known[id]=true;});
    var missing=allAvailCols.filter(function(c){return !known[c.id];}).map(function(c){return c.id;});
    if(missing.length>0)persistColOrder(colOrder.concat(missing));
  },[allAvailCols.map(function(c){return c.id;}).join(',')]);
  // Title is the row's identifying column and anchors the fixed "open
  // draft" column right after it — it can be reordered but never hidden.
  var visCols=colOrder.filter(function(id){return availIds[id]&&(id==='title'||hiddenCols.indexOf(id)<0);});
  function toggleCol(id){
    if(id==='title')return;
    var next=hiddenCols.indexOf(id)>=0?hiddenCols.filter(function(c){return c!==id;}):hiddenCols.concat([id]);
    persistHiddenCols(next);
  }

  var widthsKey='woven:colwidths:'+app.projId;
  var widthDefaults={title:160,branches:110,synopsis:260,status:160,strandTags:160,wordCount:64};
  var scw=useState(function(){
    try{var v=localStorage.getItem(widthsKey);if(v){var p=JSON.parse(v);if(p&&typeof p==='object')return Object.assign({},widthDefaults,p);}}catch(e){}
    return widthDefaults;
  });
  var colWidths=scw[0];var setColWidthsRaw=scw[1];
  useEffect(function(){
    loadDB(widthsKey,null).then(function(v){if(v&&typeof v==='object')setColWidthsRaw(function(prev){return Object.assign({},widthDefaults,prev,v);});});
  },[widthsKey]);
  var resizing=useRef(null);
  function startResize(col,e){
    e.preventDefault();
    resizing.current={col:col,startX:e.clientX,startW:colWidths[col]||160};
    function onMove(e2){if(!resizing.current)return;var diff=e2.clientX-resizing.current.startX;var nw=Math.max(60,resizing.current.startW+diff);setColWidthsRaw(function(prev){var n=Object.assign({},prev);n[resizing.current.col]=nw;return n;});}
    function onUp(){
      if(resizing.current){setColWidthsRaw(function(prev){saveDB(widthsKey,prev);return prev;});}
      resizing.current=null;document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
    }
    document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
  }
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
  function renderSpoolThumbs(strandIds,draftId){
    var list=[];
    Object.keys(tblProjStrands).forEach(function(c){(tblProjStrands[c]||[]).forEach(function(st){if((strandIds||[]).includes(st.id)){var tpl=tblProjTemplates.find(function(t){return t.name===c||t.id===st.templateId;});list.push(Object.assign({},st,{spoolColor:tpl&&tpl.color?tpl.color:'#c45e28'}));}});});
    if(list.length===0)return <span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:'var(--placeholder)',fontStyle:'italic'}}>—</span>;
    return(
<div style={{display:'flex',alignItems:'center',gap:-4,overflow:'hidden'}}>
  {list.slice(0,4).map(function(st,i){return(
<div key={st.id} title={st.name} style={{width:24,height:24,borderRadius:'50%',background:st.color||'#c45e28',border:'2px solid '+(st.spoolColor||'#c45e28'),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,marginLeft:i>0?-6:0,boxSizing:'border-box',cursor:'pointer'}}
  onClick={function(e){e.stopPropagation();setSpoolView({draftId:draftId,strandId:st.id});}}
  onMouseEnter={function(e){var tt=document.getElementById('woven-tt');if(tt){var r=e.currentTarget.getBoundingClientRect();tt.textContent=st.name;tt.style.display='block';tt.style.left=(r.left+r.width/2)+'px';tt.style.top=(r.bottom+6)+'px';}}}
  onMouseLeave={function(){var tt=document.getElementById('woven-tt');if(tt)tt.style.display='none';}}>
  {st.image?<img src={st.image} alt={st.name} style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontFamily:'DM Sans, sans-serif',fontSize:8,fontWeight:700,color:'#fff'}}>{initials(st.name)}</span>}
</div>
  );})}
  {list.length>4&&<span style={{marginLeft:2,fontSize:11,color:'#7A5A38'}}>+{list.length-4}</span>}
</div>
    );
  }
  function renderCell(col,draft,rowCtx){
    if(col==='title'){
      var showStar=rowCtx&&(rowCtx.isNested||(rowCtx.hasChildren&&rowCtx.branchesOpen));
      return(
<div style={{display:'flex',alignItems:'flex-start',gap:4}}>
  <div style={{flex:1,minWidth:0}}>
    <ExpandingCell value={draft.title} placeholder="Add..." rowExpanded={rowCtx&&rowCtx.rowExpanded} style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:16,color:'#2a1f10'}} onCommit={function(v){app.updateDraft(app.projId,draft.id,{title:v});}}/>
  </div>
  {showStar&&(rowCtx.isNested?(
<button className="btn-icon" style={{padding:2,flexShrink:0,marginTop:1}} title="Make this the primary strand" onClick={function(e){e.stopPropagation();app.promoteStrand(app.projId,rowCtx.parentId,draft.id);}}>
  <span className="mi" style={{fontSize:16,color:'var(--mid)'}}>star_outline</span>
</button>
  ):(
<span title="Primary strand" style={{display:'flex',flexShrink:0,padding:2,marginTop:1}}>
  <span className="mi" style={{fontSize:16,color:'#C45E28'}}>star</span>
</span>
  ))}
</div>
      );
    }
    if(col==='branches'){
      if(rowCtx&&rowCtx.isNested)return null;
      return <BranchCell app={app} draft={draft} hasChildren={rowCtx&&rowCtx.hasChildren} childCount={rowCtx&&rowCtx.childCount} isExpanded={rowCtx&&rowCtx.branchesOpen}/>;
    }
    if(col==='status')return <StatusSelect app={app} draft={draft} project={project} selectStyle={{height:34,fontSize:14,padding:'8px 10px 8px 32px',minWidth:150}}/>;
    if(col==='wordCount')return <span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#7A5A38'}}>{draft.wordCount||0}</span>;
    if(col==='synopsis')return <ExpandingCell value={draft.synopsis} placeholder="Add..." rowExpanded={rowCtx&&rowCtx.rowExpanded} onCommit={function(v){app.updateDraft(app.projId,draft.id,{synopsis:v});}} style={{width:'100%',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#7A5A38'}}/>;
    if(col==='strandTags')return <SpoolsCell draft={draft} app={app} pid={app.projId} expanded={!!(rowCtx&&rowCtx.rowExpanded)}/>;
    if(col.startsWith('cf_')){
      var fid=col.slice(3);
      var cfVal=draft.customFields&&draft.customFields[fid]?draft.customFields[fid]:'';
      var fieldDef=draftFieldDefs.find(function(f){return f.id===fid;});
      if(fieldDef&&fieldDef.type==='strand_ref'){
        var refIds=[];try{var parsed=JSON.parse(cfVal);if(Array.isArray(parsed))refIds=parsed;}catch(e){}
        if(refIds.length===0)return <SpoolRefEmptyPicker app={app} pid={app.projId} draft={draft} fieldDef={fieldDef}/>;
        return renderSpoolThumbs(refIds,draft.id);
      }
      if(fieldDef&&fieldDef.type==='boolean'){
        var boolVal=cfVal==='Yes'?'Yes':'No';
        return <select value={boolVal} onClick={function(e){e.stopPropagation();}} onChange={function(e){var cf=Object.assign({},draft.customFields||{});cf[fid]=e.target.value;app.updateDraft(app.projId,draft.id,{customFields:cf});}} style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#7A5A38',background:'transparent',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',cursor:'pointer'}}>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>;
      }
      return <ExpandingCell value={cfVal} placeholder="Add..." rowExpanded={rowCtx&&rowCtx.rowExpanded} onCommit={function(v){var cf=Object.assign({},draft.customFields||{});cf[fid]=v;app.updateDraft(app.projId,draft.id,{customFields:cf});}} style={{width:'100%',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#7A5A38'}}/>;
    }
    return null;
  }
  function renderRow(draft,label,isNested,parentId,hasChildren,isExpanded,childCount){
    var rowExp=expandedRowId===draft.id;
    var vAlign=rowExp?'top':'middle';
    return(
<tr key={draft.id} ref={function(el){rowRefs.current[draft.id]=el;}} className={isNested?'nest-row':''} style={dragOver===draft.id?{boxShadow:'inset 0 2px 0 0 var(--indigo)'}:undefined}
  onClick={function(){setExpandedRowId(draft.id);}}
  onDragOver={function(e){e.preventDefault();setDragOver(draft.id);}}
  onDragLeave={function(){setDragOver(null);}}
  onDrop={function(e){e.preventDefault();setDragOver(null);var fromId=e.dataTransfer.getData('draftId');if(fromId&&fromId!==draft.id){var fromDraft=(app.allDrafts[app.projId]||[]).find(function(d){return d.id===fromId;});if(fromDraft&&fromDraft.status==='loose_thread'){app.updateDraft(app.projId,fromId,{status:'first_draft',order:draft.order||0,parentId:null});}else{app.reorderDraft(app.projId,fromId,draft.order||0);}}}}>
  <td style={{verticalAlign:vAlign}}>
    <span draggable={true} onDragStart={function(e){e.dataTransfer.setData('draftId',draft.id);}} style={{cursor:'grab',color:'var(--border)',display:'flex',alignItems:'center'}}><span className="mi" style={{fontSize:18}}>drag_indicator</span></span>
  </td>
  {(tblNumbered||tblByDate)&&(
  <td style={{color:'var(--mid)',fontSize:11,whiteSpace:'nowrap',paddingLeft:isNested?28:12,verticalAlign:vAlign}}>
    <div style={{display:'flex',alignItems:'center',gap:2}}>
      {isNested&&<span className="mi" style={{fontSize:12,color:'var(--border)',flexShrink:0}}>subdirectory_arrow_right</span>}
      {isNested?(tblNumbered?null:formatDraftDate(draftDateOf(draft))):(tblNumbered?label:formatDraftDate(draftDateOf(draft)))}
    </div>
  </td>
  )}
  {visCols.map(function(col){var td=<td key={col} style={{verticalAlign:vAlign}} onClick={col==='branches'?function(e){e.stopPropagation();}:undefined}>{renderCell(col,draft,{isNested:isNested,hasChildren:hasChildren,parentId:parentId,rowExpanded:rowExp,branchesOpen:isExpanded,childCount:childCount})}</td>;if(col==='title')return [td,<td key="__arrowcol" style={{verticalAlign:vAlign}} onClick={function(e){e.stopPropagation();}}><button onClick={function(){app.openDraft(draft.id);}} title="Open draft" style={{background:'transparent',border:'none',cursor:'pointer',padding:4,display:'flex',alignItems:'center',color:'var(--mid)',transition:'color .15s'}} onMouseOver={function(e){e.currentTarget.style.color='var(--indigo)';}} onMouseOut={function(e){e.currentTarget.style.color='var(--mid)';}}>
    <span className="material-symbols-outlined" style={{fontSize:18}}>arrow_forward</span>
  </button></td>];return td;})}
  <td style={{verticalAlign:vAlign}}/>
</tr>
    );
  }
  return(
<div className="view-layout">
  <ViewHeader app={app} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onAddDraft={addDraft} onBind={function(){setBindOpen(true);}} hideStructure={true} searchQ={searchQ} onSearch={setSearchQ} resultCount={displayed.length}/>
  <div className="table-wrap" style={{display:'flex',flexDirection:'column',flex:1,overflow:'auto',padding:20}}>
    {app.dataLoading?<DraftLoadingSpinner/>:tree.length===0?<EmptyDrafts onAdd={addDraft}/>:(
<div>
  <table className="wt" style={{width:'max-content',minWidth:'100%'}}>
    <thead>
      <tr style={{background:'#E2D0B8'}}>
        <th style={{width:28,background:'#E2D0B8'}}/>
        {tblNumbered&&<th style={{width:36,background:'#E2D0B8',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#6B4A26',fontWeight:600}}>#</th>}
        {tblByDate&&<th style={{width:96,background:'#E2D0B8',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#6B4A26',fontWeight:600}}>Date</th>}
        {visCols.map(function(col){var av=allAvailCols.find(function(c){return c.id===col;});var thEl=(
<th key={col} style={{width:colWidths[col]||160,maxWidth:colWidths[col]||160,background:'#E2D0B8',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#6B4A26',fontWeight:600,cursor:'grab',userSelect:'none'}} className="resizable"
  draggable={true}
  onDragStart={function(e){if(resizing.current){e.preventDefault();return;}e.dataTransfer.setData('colId',col);}}
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){e.preventDefault();var fromId=e.dataTransfer.getData('colId');if(!fromId||fromId===col)return;var nc=colOrder.slice();var fromIdx=nc.indexOf(fromId);var toIdx=nc.indexOf(col);if(fromIdx<0||toIdx<0)return;var item=nc.splice(fromIdx,1)[0];nc.splice(toIdx,0,item);persistColOrder(nc);}} >
  {col==='branches'?<span className="mi" style={{fontSize:18,color:'#6B4A26'}}>account_tree</span>:(av?av.label:col)}
  <div className="col-resize-handle" draggable={false} onMouseDown={function(e){e.stopPropagation();startResize(col,e);}}/>
</th>
        );if(col==='title')return [thEl,<th key="__arrowcol" style={{width:34,background:'#E2D0B8'}}/>];return thEl;})}
        <th style={{width:46,background:'#E2D0B8'}}>
          <button ref={colRef} className="btn-icon" style={{padding:2,color:'var(--mid)'}} onClick={function(){setColOpen(!colOpen);}} title="Edit columns">
            <span className="mi" style={{fontSize:18}}>settings</span>
          </button>
        </th>
      </tr>
    </thead>
    <tbody>
      {displayed.map(function(parent,i){
        var isExpanded=parent.nestExpanded!==false;
        var hasChildren=parent.children&&parent.children.length>0;
        var childCount=parent.children?parent.children.length:0;
        var origIdx=tree.findIndex(function(d){return d.id===parent.id;});
        var lbl=''+(origIdx+1);
        var rows=[renderRow(parent,lbl,false,null,hasChildren,isExpanded,childCount)];
        if(hasChildren&&isExpanded){parent.children.forEach(function(child,ci){rows.push(renderRow(child,lbl+'.'+(ci+1),true,parent.id,false,false,0));});}
        return rows;
      })}
    </tbody>
  </table>
  <div style={{padding:'9px 12px'}}><button className="btn btn-ghost btn-sm" onClick={addDraft}>+ Add draft</button></div>

</div>
    )}
  </div>
  <FloatingPanel anchorRef={colRef} open={colOpen} onClose={function(){setColOpen(false);}} minWidth={200}>
<div className="col-vis-drop" style={{position:'static',maxHeight:'60vh',overflowY:'auto'}}>
  <div style={{padding:'4px 8px 6px',fontSize:11,color:'var(--mid)',fontWeight:600,textTransform:'uppercase',letterSpacing:'.06em'}}>Columns</div>
  {allAvailCols.filter(function(col){return col.id!=='title';}).map(function(col){var isVis=visCols.includes(col.id);return(
<div key={col.id} className="col-vis-item" onClick={function(){toggleCol(col.id);}}>
  <span style={{width:18,height:18,borderRadius:4,border:'1px solid var(--border)',background:isVis?'var(--indigo)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'all .15s'}}>
    {isVis&&<span className="mi" style={{fontSize:13,color:'#fff'}}>check</span>}
  </span>
  <span>{col.label}</span>
</div>
  );})}
</div>
  </FloatingPanel>
  <BindDrawer app={app} open={bindOpen} variant="overlay" topOffset={54} onClose={function(){setBindOpen(false);}} activeFilter={filter}/>
  <LooseThreadsSection threads={ltDrafts} app={app} view="table" filter={filter}/>
  {spoolView&&(
<StrandsDrawer
  app={app}
  draft={allDrafts.find(function(d){return d.id===spoolView.draftId;})}
  variant="overlay"
  open={true}
  topOffset={54}
  strandId={spoolView.strandId}
  onOpenStrand={function(id){setSpoolView(id?{draftId:spoolView.draftId,strandId:id}:null);}}
  onClose={function(){setSpoolView(null);}}
  hideDisconnect={true}
/>
  )}
</div>
  );
}

export default TableView;
