// @ts-nocheck
// ── LooseThreadsQuickAccess ──
// Full-width bar flush to the bottom of the viewport, rendered once at the
// App root (see App.jsx's view switch) alongside AddMenuFab — same
// reasoning as before: position:fixed needs to sit at the top level, not
// nested deep inside a scrollable view.
//
// Expands into a floating panel with every loose thread in the project,
// so they stay reachable without scrolling all the way down the
// Storyboard as the sequence grows. It watches the in-flow Loose Threads
// section (id="loose-threads-inline" in CardsView.jsx) via
// IntersectionObserver and hides itself once that section actually
// scrolls into view — at that point scrolling further IS the full
// version, so the shortcut has nothing left to add.
import { useState, useEffect, useRef } from "react";
import LooseThreadDrawer from './LooseThreadDrawer'
import { LooseThreadTile } from './CardsView'
import { genId } from './utils'

export default function LooseThreadsQuickAccess({app}){
  var pid=app.projId;
  var allDrafts=app.allDrafts[pid]||[];
  var threads=allDrafts.filter(function(d){return !d.archived&&d.status==='loose_thread';});
  var sortedThreads=threads.slice().sort(function(a,b){return (b.createdAt||'').localeCompare(a.createdAt||'');});

  var so=useState(false);var open=so[0];var setOpen=so[1];
  var ref=useRef(null);
  useEffect(function(){
    if(!open)return;
    function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}
    document.addEventListener('mousedown',onDown);
    return function(){document.removeEventListener('mousedown',onDown);};
  },[open]);

  // Hide once the inline Loose Threads section (bottom of Storyboard) is
  // actually visible — no point shortcutting to something already on screen.
  var sh=useState(false);var hidden=sh[0];var setHidden=sh[1];
  useEffect(function(){
    var target=document.getElementById('loose-threads-inline');
    if(!target)return;
    var observer=new IntersectionObserver(function(entries){
      var visible=entries[0].isIntersecting;
      setHidden(visible);
      if(visible)setOpen(false);
    },{threshold:0.1});
    observer.observe(target);
    return function(){observer.disconnect();};
  },[]);

  // Deferred creation — same pattern as LooseThreadsSection's ghost tile:
  // nothing is persisted until the drawer actually has a title, synopsis,
  // or a tagged spool.
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

  return(
<>
  {!hidden&&(
<div ref={ref} style={{position:'fixed',left:0,right:0,bottom:0,zIndex:390,display:'flex',flexDirection:'column'}}>
  {open&&(
<div style={{background:'var(--bg1)',borderTop:'1px solid var(--border)',boxShadow:'0 -8px 24px rgba(42,31,16,.14)',padding:'14px 24px',maxHeight:'45vh',overflowY:'auto'}}>
  <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
    <div onClick={openCreateFlow} style={{background:'transparent',border:'2px dashed #A88060',padding:'10px 15px',borderRadius:15,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,width:220,flexShrink:0,minHeight:80,transition:'border-color .15s'}}
      onMouseEnter={function(e){e.currentTarget.style.borderColor='#c45e28';}}
      onMouseLeave={function(e){e.currentTarget.style.borderColor='#A88060';}}>
      <span className="material-symbols-outlined" style={{fontSize:28,color:'#A88060'}}>add_circle</span>
    </div>
    {sortedThreads.map(function(d){return <LooseThreadTile key={d.id} d={d} app={app} pid={pid} inStructure={false}/>;})}
    {sortedThreads.length===0&&(
<div style={{fontSize:13,color:'var(--placeholder)',fontStyle:'italic',padding:'8px 0'}}>No loose threads yet.</div>
    )}
  </div>
</div>
  )}
  <button onClick={function(){setOpen(!open);}} style={{display:'flex',alignItems:'center',gap:8,padding:'14px 24px',width:'100%',background:'var(--bg1)',border:'none',borderTop:'1px solid var(--border)',boxShadow:'0 -2px 10px rgba(42,31,16,.08)',cursor:'pointer'}}
    onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}}
    onMouseOut={function(e){e.currentTarget.style.background='var(--bg1)';}}>
    <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--teal)'}}>push_pin</span>
    <span style={{fontFamily:'DM Sans, sans-serif',fontSize:13,fontWeight:600,color:'#6B4A26'}}>Loose Threads</span>
    {threads.length>0&&<span style={{background:'var(--indigo)',color:'#fff',borderRadius:'50%',width:20,height:20,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{threads.length}</span>}
    <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--mid)',marginLeft:'auto'}}>{open?'expand_more':'expand_less'}</span>
  </button>
</div>
  )}
  {openLTId&&activeLT&&(
<LooseThreadDrawer lt={activeLT} mode="project" app={app} pid={pid} open={true} variant="overlay" topOffset={54} onUpdate={handleDrawerUpdate} onClose={handleDrawerClose} onDelete={handleDrawerDelete}/>
  )}
</>
  );
}

