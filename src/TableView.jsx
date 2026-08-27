// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import BindDrawer from './BindDrawer'
import StrandsDrawer from './StrandsDrawer'
import { ArchiveConfirmModal } from './SharedUI'
import { genId, stripHtml, initials } from './utils'
import { projIsNumbered, projSequence, projStatusMap, sortDraftsBySequence, draftDateOf, formatDraftDate } from './projectConfig'
import { buildTree, applyFS, loadFilterState, persistFilterState, ViewHeader, DraftLoadingSpinner, EmptyDrafts, LooseThreadsSection } from './App'

// ── ExpandingCell ──
// A single-line input that grows into a multi-line textarea (and the row
// grows with it) while focused, and collapses back to a single line on
// blur — i.e. clicking anywhere else reverts it, since only one cell can
// be focused at a time.
function ExpandingCell({value,placeholder,style,onCommit}){
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
    return <input className="tbl-inp" style={style} value={val} placeholder={placeholder}
      onChange={function(e){setVal(e.target.value);}}
      onFocus={function(){setFocused(true);}}/>;
  }
  return <textarea ref={ref} className="tbl-inp" style={Object.assign({},style,{whiteSpace:'pre-wrap',resize:'none',overflow:'hidden',width:'100%',display:'block'})}
    value={val} placeholder={placeholder}
    onChange={function(e){setVal(e.target.value);e.target.style.height='auto';e.target.style.height=e.target.scrollHeight+'px';}}
    onBlur={commit}
    onKeyDown={function(e){if(e.key==='Escape'){setVal(value||'');setFocused(false);}}}/>;
}

// ── StatusCell ──
// Mirrors PropertiesDrawer's status control: a native select with a
// colored dot, including the same Archive confirmation flow.
function StatusCell({draft,app,project}){
  var sac=useState(false);var showConfirm=sac[0];var setShowConfirm=sac[1];
  var statusMap=projStatusMap(project);
  var allDr=app.allDrafts[app.projId]||[];
  var seqSiblings=allDr.filter(function(d){return d.status!=='loose_thread'&&!d.parentId&&!d.archived;});
  function handleChange(e){
    var v=e.target.value;
    if(v==='archive'){setShowConfirm(true);return;}
    var changes={status:v};
    if(v==='loose_thread'){changes.order=null;changes.parentId=null;}
    else if(draft.status==='loose_thread'){changes.order=seqSiblings.length+1;}
    app.updateDraft(app.projId,draft.id,changes);
  }
  function doArchive(){
    var children=allDr.filter(function(d){return d.parentId===draft.id&&!d.archived;});
    app.updateDraft(app.projId,draft.id,{archived:true});
    children.forEach(function(c){app.updateDraft(app.projId,c.id,{archived:true});});
    setShowConfirm(false);
  }
  var info=statusMap[draft.status]||statusMap.first_draft||{color:'#999',label:draft.status};
  return(
<div style={{position:'relative',display:'inline-block'}}>
  <span style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',width:8,height:8,borderRadius:'50%',background:info.color,pointerEvents:'none'}}/>
  <select value={draft.status} onChange={handleChange} style={{paddingLeft:24,paddingRight:8,height:28,borderRadius:12,border:'1px solid transparent',background:info.color+'18',color:info.color,fontFamily:'DM Sans, sans-serif',fontSize:13,fontWeight:500,cursor:'pointer'}}>
    {Object.keys(statusMap).map(function(k){return <option key={k} value={k}>{statusMap[k].label}</option>;})}
    <option value="archive">Archive...</option>
  </select>
  {showConfirm&&<ArchiveConfirmModal draft={draft} allDrafts={allDr} onConfirm={doArchive} onCancel={function(){setShowConfirm(false);}}/>}
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
  // Spool drawer (opened by clicking a spool thumbnail in the Strands column)
  var ssv=useState(null);var spoolView=ssv[0];var setSpoolView=ssv[1]; // {draftId,strandId} | null

  var project=app.currentProject||{};
  var draftFieldDefs=project.draftFieldDefs||[];
  var allAvailCols=[
    {id:'title',label:'Title'},
    {id:'status',label:'Status'},
    {id:'wordCount',label:'Words'},
    {id:'synopsis',label:'Synopsis'}
    ,{id:'strandTags',label:'Strands'}
  ].concat(draftFieldDefs.map(function(f){return{id:'cf_'+f.id,label:f.label};}));

  // Column order + hidden state, stored separately so custom fields are
  // visible by default (and stay visible automatically as new ones are
  // added) — hiding a column is an explicit opt-out, not a default.
  var orderKey='colorder:'+app.projId;
  var hiddenKey='colhidden:'+app.projId;
  var sco2=useState(function(){
    try{var v=localStorage.getItem(orderKey);if(v){var p=JSON.parse(v);if(Array.isArray(p))return p;}}catch(e){}
    return allAvailCols.map(function(c){return c.id;});
  });
  var colOrder=sco2[0];var setColOrderRaw=sco2[1];
  function persistColOrder(next){setColOrderRaw(next);try{localStorage.setItem(orderKey,JSON.stringify(next));}catch(e){}}
  var shs=useState(function(){
    try{var v=localStorage.getItem(hiddenKey);if(v){var p=JSON.parse(v);if(Array.isArray(p))return p;}}catch(e){}
    return [];
  });
  var hiddenCols=shs[0];var setHiddenColsRaw=shs[1];
  function persistHiddenCols(next){setHiddenColsRaw(next);try{localStorage.setItem(hiddenKey,JSON.stringify(next));}catch(e){}}
  // Reconcile: any available column (e.g. a newly-added custom field) not
  // yet tracked in colOrder gets appended, so it shows up automatically.
  useEffect(function(){
    var known={};colOrder.forEach(function(id){known[id]=true;});
    var missing=allAvailCols.filter(function(c){return !known[c.id];}).map(function(c){return c.id;});
    if(missing.length>0)persistColOrder(colOrder.concat(missing));
  },[draftFieldDefs.map(function(f){return f.id;}).join(',')]);
  var availIds={};allAvailCols.forEach(function(c){availIds[c.id]=true;});
  var visCols=colOrder.filter(function(id){return availIds[id]&&hiddenCols.indexOf(id)<0;});
  function toggleCol(id){
    var next=hiddenCols.indexOf(id)>=0?hiddenCols.filter(function(c){return c!==id;}):hiddenCols.concat([id]);
    persistHiddenCols(next);
  }

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
  function renderCell(col,draft,rowCtx){
    if(col==='title'){
      var canPromote=rowCtx&&(rowCtx.hasChildren||rowCtx.isNested);
      return(
<div style={{display:'flex',alignItems:'center',gap:6,minWidth:0}}>
  <div style={{flex:1,minWidth:0}}>
    <ExpandingCell value={draft.title} placeholder="Untitled" style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:16,color:'#2a1f10'}} onCommit={function(v){app.updateDraft(app.projId,draft.id,{title:v});}}/>
  </div>
  {canPromote&&(rowCtx.isNested?(
<button className="btn-icon" style={{padding:2,flexShrink:0}} title="Make this the primary strand" onClick={function(){app.promoteStrand(app.projId,rowCtx.parentId,draft.id);}}>
  <span className="mi" style={{fontSize:16,color:'var(--mid)'}}>star_outline</span>
</button>
  ):(
<span title="Primary strand" style={{display:'flex',flexShrink:0,padding:2}}>
  <span className="mi" style={{fontSize:16,color:'#C45E28'}}>star</span>
</span>
  ))}
</div>
      );
    }
    if(col==='status')return <StatusCell draft={draft} app={app} project={project}/>;
    if(col==='wordCount')return <span style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38'}}>{draft.wordCount||0}</span>;
    if(col==='synopsis')return <ExpandingCell value={draft.synopsis} placeholder="No synopsis…" onCommit={function(v){app.updateDraft(app.projId,draft.id,{synopsis:v});}} style={{width:'100%',fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38',fontStyle:draft.synopsis?'normal':'italic',opacity:draft.synopsis?1:.75}}/>;
    if(col==='strandTags'){var ts2=[];Object.keys(tblProjStrands).forEach(function(c){(tblProjStrands[c]||[]).forEach(function(st){if((draft.strandTags||[]).includes(st.id)){var tpl=tblProjTemplates.find(function(t){return t.name===c||t.id===st.templateId;});ts2.push(Object.assign({},st,{spoolColor:tpl&&tpl.color?tpl.color:'#c45e28'}));}});});return(
<div style={{display:'flex',alignItems:'center',gap:-4,overflow:'hidden'}}>
  {ts2.slice(0,4).map(function(st,i){return(
<div key={st.id} title={st.name} style={{width:24,height:24,borderRadius:'50%',background:st.color||'#c45e28',border:'2px solid '+(st.spoolColor||'#c45e28'),display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',flexShrink:0,marginLeft:i>0?-6:0,boxSizing:'border-box',cursor:'pointer'}}
  onClick={function(){setSpoolView({draftId:draft.id,strandId:st.id});}}
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
      return <ExpandingCell value={cfVal} placeholder="—" onCommit={function(v){var cf=Object.assign({},draft.customFields||{});cf[fid]=v;app.updateDraft(app.projId,draft.id,{customFields:cf});}} style={{width:'100%',fontFamily:'DM Sans, sans-serif',fontSize:16,color:'#7A5A38',fontStyle:cfVal?'normal':'italic',opacity:cfVal?1:.75}}/>;
    }
    return null;
  }
  function renderRow(draft,label,isNested,parentId,hasChildren,isExpanded){return(
<tr key={draft.id} className={isNested?'nest-row':''} style={dragOver===draft.id?{boxShadow:'inset 0 2px 0 0 var(--indigo)'}:undefined}
  onDragOver={function(e){e.preventDefault();setDragOver(draft.id);}}
  onDragLeave={function(){setDragOver(null);}}
  onDrop={function(e){e.preventDefault();setDragOver(null);var fromId=e.dataTransfer.getData('draftId');if(fromId&&fromId!==draft.id){var fromDraft=(app.allDrafts[app.projId]||[]).find(function(d){return d.id===fromId;});if(fromDraft&&fromDraft.status==='loose_thread'){app.updateDraft(app.projId,fromId,{status:'first_draft',order:draft.order||0,parentId:null});}else{app.reorderDraft(app.projId,fromId,draft.order||0);}}}}>
  <td><div style={{display:'flex',alignItems:'center',gap:2}}>
    <span draggable={true} onDragStart={function(e){e.dataTransfer.setData('draftId',draft.id);}} style={{cursor:'grab',color:'var(--border)',display:'flex',alignItems:'center'}}><span className="mi" style={{fontSize:18}}>drag_indicator</span></span>
    {hasChildren&&<span className="mi" style={{fontSize:16,cursor:'pointer',color:isExpanded?'#C45E28':'var(--mid)',flexShrink:0}} title={isExpanded?'Collapse branches':'Expand branches'} onClick={function(){app.updateDraft(app.projId,draft.id,{nestExpanded:!isExpanded});}}>account_tree</span>}
  </div></td>
  {(tblNumbered||tblByDate)&&(
  <td style={{color:'var(--mid)',fontSize:11,whiteSpace:'nowrap',paddingLeft:isNested?28:12}}>
    <div style={{display:'flex',alignItems:'center',gap:2}}>
      {isNested&&<span className="mi" style={{fontSize:12,color:'var(--border)',flexShrink:0}}>subdirectory_arrow_right</span>}
      {tblNumbered?label:formatDraftDate(draftDateOf(draft))}
    </div>
  </td>
  )}
  {visCols.map(function(col){return <td key={col}>{renderCell(col,draft,{isNested:isNested,hasChildren:hasChildren,parentId:parentId})}</td>;})}
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
        {visCols.map(function(col){var av=allAvailCols.find(function(c){return c.id===col;});return(
<th key={col} style={{width:colWidths[col]||160,maxWidth:colWidths[col]||160,background:'#E2D0B8',fontFamily:'DM Sans, sans-serif',fontSize:14,color:'#6B4A26',fontWeight:600,cursor:'grab',userSelect:'none'}} className="resizable"
  draggable={true}
  onDragStart={function(e){e.dataTransfer.setData('colId',col);}}
  onDragOver={function(e){e.preventDefault();}}
  onDrop={function(e){e.preventDefault();var fromId=e.dataTransfer.getData('colId');if(!fromId||fromId===col)return;var nc=colOrder.slice();var fromIdx=nc.indexOf(fromId);var toIdx=nc.indexOf(col);if(fromIdx<0||toIdx<0)return;var item=nc.splice(fromIdx,1)[0];nc.splice(toIdx,0,item);persistColOrder(nc);}} >
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
        var rows=[renderRow(parent,lbl,false,null,hasChildren,isExpanded)];
        if(hasChildren&&isExpanded){parent.children.forEach(function(child,ci){rows.push(renderRow(child,lbl+'.'+(ci+1),true,parent.id,false,false));});}
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
/>
  )}
</div>
  );
}

export default TableView;
