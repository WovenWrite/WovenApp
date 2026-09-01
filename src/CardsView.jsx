// @ts-nocheck
// ── CardsView and its exclusive dependencies ──
// Extracted from App.jsx. This is the Storyboard view (VIEW_MODES key 'cards').
// Everything in this file was previously only consumed by CardsView and the
// now-dead/unreachable TilesView (removed from App.jsx as part of this split) —
// so it's all moved here rather than split across SharedUI/utils.
// StrandTagPicker is also used by TaggedSpoolsEditor, which remains in
// App.jsx and imports it back from here.
import { useState, useEffect, useRef } from "react";
import BindDrawer from './BindDrawer'
import LooseThreadDrawer from './LooseThreadDrawer'
import { Popover, Check, Avatar, StatusDotWithArchive, ArchiveConfirmModal } from './SharedUI'
import { genId, stripHtml, initials, uploadImage } from './utils'
import { sortDraftsBySequence, projIsNumbered, projIsManualOrder, projSequence, projThumbnails, draftDateOf, formatDraftDate, projStatuses, projStatus, projLabel } from './projectConfig'

// ── Draft tree helpers ──
export function buildTree(drafts){
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

// ── Define filter — property-based, multi-criteria ──
// Shape: { status:[...statusKeys], strandTags:[...strandIds], customFields:{fieldId:[...strandIds]} }
// AND across categories (status / strandTags / each custom field), OR within
// a category's own selections. Persisted per-project in localStorage so it
// survives navigation and reload — cleared only on sign out (see signOut()).
function emptyFilterState(){return {status:[],strandTags:[],customFields:{}};}
function filterStorageKey(pid){return 'woven:filter:'+pid;}
export function loadFilterState(pid){
  try{
    var raw=localStorage.getItem(filterStorageKey(pid));
    if(!raw)return emptyFilterState();
    var parsed=JSON.parse(raw);
    return Object.assign(emptyFilterState(),parsed,{customFields:Object.assign({},parsed.customFields)});
  }catch(e){return emptyFilterState();}
}
export function persistFilterState(pid,filterObj){
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
export function applyFS(drafts,filterObj,sort,proj){
  var hasFilter=filterCriteriaCount(filterObj)>0;
  var d=hasFilter?drafts.filter(function(x){
    var matchSelf=draftMatchesFilter(x,filterObj);
    var matchChild=(x.children||[]).some(function(c){return draftMatchesFilter(c,filterObj);});
    return matchSelf||matchChild;
  }):drafts;
  return d.slice().sort(function(a,b){
    if(sort==='title')return (a.title||'').localeCompare(b.title||'');
    if(sort==='status'){
      var order=projStatuses(proj).map(function(s){return s.id;});
      return order.indexOf(a.status)-order.indexOf(b.status);
    }
    if(sort==='words')return (b.wordCount||0)-(a.wordCount||0);
    return (a.order||999)-(b.order||999);
  });
}

// ── ViewHeader ──
export function ViewHeader({app,filter:filterProp,setFilter,sort,setSort,onBind,structureMode,onStructureToggle,searchQ,onSearch,hideStructure,resultCount}){
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
            {projStatuses(app.currentProject).map(function(s){
              var k=s.id;
              var active=(filter.status||[]).indexOf(k)>=0;
              return(
<span key={k} onClick={function(){toggleStatus(k);}} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'4px 10px',borderRadius:12,fontSize:12,fontWeight:500,cursor:'pointer',background:active?s.color+'22':'var(--bg2)',color:active?s.color:'var(--mid)',border:'1px solid '+(active?s.color+'55':'var(--border)')}}>
  <span style={{width:7,height:7,borderRadius:'50%',background:s.color,flexShrink:0}}/>
  {s.label}
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
    <button onClick={onBind} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 16px',background:'var(--indigo)',color:'#fff',border:'none',borderRadius:8,fontSize:14,fontFamily:'DM Sans, sans-serif',fontWeight:600,cursor:'pointer',transition:'background .15s'}}
      onMouseOver={function(e){e.currentTarget.style.background='#2A1F10';}}
      onMouseOut={function(e){e.currentTarget.style.background='var(--indigo)';}}>
      <span className="material-symbols-outlined" style={{fontSize:18}}>collections_bookmark</span>Bind {projLabel(app.currentProject,'drafts')}
    </button>
  </div>
</div>
  );
}

// ── StrandTagPicker ──
export function StrandTagPicker({draft,app,pid,tagged}){
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

// ── DraftCard ──
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

  var info=projStatus(app.currentProject,draft.status);

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
  style={{width:270,borderRadius:15,overflow:'visible',background:'var(--bg1)',border:'2px solid transparent',display:'flex',flexDirection:'column',cursor:structureMode?'default':'pointer',boxShadow:'0 2px 8px rgba(42,31,16,.06)',transition:'box-shadow .2s,border-color .2s',flexShrink:0,position:'relative',height:structureMode?'auto':(projThumbnails(cardProj)?400:250)}}
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
  {projThumbnails(cardProj)&&(
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
  )}

  {/* Content */}
  <div style={{flex:1,background:'#F5EDE0',padding:'10px 15px',display:'flex',flexDirection:'column',gap:10,minHeight:0,borderRadius:'0 0 13px 13px',overflow:'hidden'}}>

    {/* Title block — eyebrow (number or date) plus title share ONE flex slot
        in the card's gap:10 column, so the eyebrow adds only its own line
        height rather than a whole extra gapped row. The card has a fixed
        height (see .draft-card), so a second top-level flex child here was
        silently eating into the synopsis area below. */}
    <div style={{flexShrink:0}}>
      {/* Date eyebrow — numbered mode goes back to inline "1- Title" below,
          matching the original styling exactly. Date has no prior precedent
          to match, so it keeps the small caption treatment. */}
      {seqByDate&&cardDate&&(
<div style={{fontFamily:'DM Sans, sans-serif',fontSize:11,fontWeight:600,letterSpacing:'.08em',textTransform:'uppercase',color:'#A88060',padding:'0 4px',marginBottom:2}}>{cardDate}</div>
      )}
      {structureMode&&editTitle?(
<textarea autoFocus rows={2} value={titleVal} onChange={function(e){setTitleVal(e.target.value);}} onBlur={function(){app.updateDraft(pid,draft.id,{title:titleVal});setEditTitle(false);}} style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:18,color:'#2a1f10',lineHeight:1.25,background:'transparent',border:'2px solid '+AMBER,borderRadius:8,outline:'none',resize:'none',padding:'4px 8px',width:'100%',boxSizing:'border-box'}}/>
      ):(
<div
  style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:18,color:'#2a1f10',lineHeight:1.25,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',borderRadius:6,padding:'2px 4px',transition:'background .15s',cursor:structureMode?'text':'inherit',border:'2px solid transparent'}}
  onClick={function(){if(structureMode){setTitleVal(draft.title||'');setEditTitle(true);}}}
  onMouseEnter={function(e){if(structureMode)e.currentTarget.style.background='rgba(196,94,40,.06)';}}
  onMouseLeave={function(e){e.currentTarget.style.background='transparent';}}>
  {seqNumbered?label+'- ':''}{draft.title||'Untitled'}
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
        <StatusDotWithArchive draft={draft} app={app} showLabel={false} dotSize={15} project={cardProj}/>
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

// ── LooseThreadTile ──
// Shared by the inline Loose Threads grid and the sticky quick-access panel.
function LooseThreadTile({d,app,pid,inStructure}){
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
<div style={{background:'#FDF8F0',border:'2px solid transparent',padding:'10px 15px',borderRadius:15,cursor:inStructure?'grab':'pointer',display:'flex',flexDirection:'column',gap:8,width:220,flexShrink:0,transition:'border-color .2s,box-shadow .2s'}}
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
      <StatusDotWithArchive draft={d} app={app} showLabel={false} dotSize={13} project={app.currentProject}/>
    </div>
  </div>
</div>
  );
}

// ── LooseThreadsSection ──
export function LooseThreadsSection({threads,app,view,structureMode,filter}){
  var hasActiveFilter=filterCriteriaCount(filter)>0;
  var filteredThreads=hasActiveFilter?threads.filter(function(t){return draftMatchesFilter(t,filter);}):threads;
  var sortedThreads=filteredThreads.slice().sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});
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

  var drawer=openLTId&&activeLT&&(
<LooseThreadDrawer lt={activeLT} mode="project" app={app} pid={pid} open={true} variant="overlay" topOffset={54} onUpdate={handleDrawerUpdate} onClose={handleDrawerClose} onDelete={handleDrawerDelete}/>
  );

  var inStructure=view==='cards'&&structureMode;

  // ── Sticky quick-access bar ──
  // Anchored bottom-left (AddMenuFab owns bottom-right) so loose threads
  // stay reachable without scrolling all the way down as the sequence
  // grows. The in-flow section below still shows everything — this is
  // just a shortcut, not a replacement.
  var sso=useState(false);var stickyOpen=sso[0];var setStickyOpen=sso[1];
  var stickyRef=useRef(null);
  useEffect(function(){
    if(!stickyOpen)return;
    function onDown(e){if(stickyRef.current&&!stickyRef.current.contains(e.target))setStickyOpen(false);}
    document.addEventListener('mousedown',onDown);
    return function(){document.removeEventListener('mousedown',onDown);};
  },[stickyOpen]);

  return(
<>
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
  </div>
  {/* Tile grid — always shows everything; this is the "scrolled all the
      way down" destination, so there's no point hiding anything here. */}
  <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
    {/* Ghost add tile */}
    <div onClick={openCreateFlow} style={{background:'transparent',border:'2px dashed #A88060',padding:'10px 15px',borderRadius:15,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,width:220,flexShrink:0,minHeight:80,transition:'border-color .15s'}}
      onMouseEnter={function(e){e.currentTarget.style.borderColor='#c45e28';}}
      onMouseLeave={function(e){e.currentTarget.style.borderColor='#A88060';}}>
      <span className="material-symbols-outlined" style={{fontSize:28,color:'#A88060'}}>add_circle</span>
    </div>
    {sortedThreads.map(function(d){return <LooseThreadTile key={d.id} d={d} app={app} pid={pid} inStructure={inStructure}/>;})}
    {sortedThreads.length===0&&(
<div style={{fontSize:13,color:'var(--placeholder)',fontStyle:'italic',padding:'8px 0'}}>No loose threads yet. Drag a draft here or click + to add one.</div>
    )}
  </div>
  {drawer}
</div>
<div ref={stickyRef} style={{position:'fixed',bottom:20,left:16,zIndex:390,display:'flex',flexDirection:'column',alignItems:'flex-start',gap:10}}>
  {stickyOpen&&(
<div style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'0 8px 28px rgba(42,31,16,.18)',padding:12,maxHeight:'60vh',overflowY:'auto',width:'min(480px, calc(100vw - 120px))'}}>
  <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
    <div onClick={openCreateFlow} style={{background:'transparent',border:'2px dashed #A88060',padding:'10px 15px',borderRadius:15,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,width:220,flexShrink:0,minHeight:80,transition:'border-color .15s'}}
      onMouseEnter={function(e){e.currentTarget.style.borderColor='#c45e28';}}
      onMouseLeave={function(e){e.currentTarget.style.borderColor='#A88060';}}>
      <span className="material-symbols-outlined" style={{fontSize:28,color:'#A88060'}}>add_circle</span>
    </div>
    {sortedThreads.map(function(d){return <LooseThreadTile key={'sticky-'+d.id} d={d} app={app} pid={pid} inStructure={false}/>;})}
  </div>
</div>
  )}
  <button onClick={function(){setStickyOpen(!stickyOpen);}} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 16px',background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:24,boxShadow:'0 4px 14px rgba(42,31,16,.15)',cursor:'pointer'}}
    onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}}
    onMouseOut={function(e){e.currentTarget.style.background='var(--bg1)';}}>
    <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--teal)'}}>push_pin</span>
    <span style={{fontFamily:'DM Sans, sans-serif',fontSize:13,fontWeight:600,color:'#6B4A26'}}>Loose Threads</span>
    {filteredThreads.length>0&&<span style={{background:'var(--indigo)',color:'#fff',borderRadius:'50%',width:20,height:20,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{filteredThreads.length}</span>}
    <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--mid)'}}>{stickyOpen?'expand_more':'expand_less'}</span>
  </button>
</div>
</>
  );
}

// ── DraftLoadingSpinner / EmptyDrafts ──
export function DraftLoadingSpinner(){
  return(<div className="empty-view"><div style={{width:32,height:32,borderRadius:'50%',border:'3px solid var(--border)',borderTopColor:'var(--indigo)',animation:'spin .8s linear infinite'}}/><div style={{fontFamily:'var(--serif)',fontSize:18,color:'var(--mid)'}}>Loading drafts...</div></div>);
}
export function EmptyDrafts({onAdd}){
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
export default function CardsView({app}){
  var pid=app.projId;
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
  var displayed=(sort==='order'?sortDraftsBySequence(applyFS(tree,filter,sort,app.currentProject),app.currentProject):applyFS(tree,filter,sort,app.currentProject)).filter(function(p){
    if(!searchQ.trim())return true;
    var q=searchQ.toLowerCase();
    var matchTitle=(p.title||'').toLowerCase().includes(q);
    var matchSyn=(p.synopsis||'').toLowerCase().includes(q);
    var matchBody=p.body?stripHtml(p.body).toLowerCase().includes(q):false;
    return matchTitle||matchSyn||matchBody;
  });
  return(
<div className="view-layout">
  <ViewHeader app={app} filter={filter} setFilter={setFilter} sort={sort} setSort={setSort} onBind={function(){setBindOpen(true);}} structureMode={structureMode} onStructureToggle={function(v){setStructureMode(v);}} searchQ={searchQ} onSearch={setSearchQ} resultCount={displayed.length}/>
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
