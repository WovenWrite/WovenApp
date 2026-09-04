// @ts-nocheck
// ── AddMenuFab ──
// The floating "+" button, bottom-right, shared across Canvas, Storyboard
// (Cards), and Table views. Previously this button lived inline inside
// LooseThreadsSection and only created a loose thread. It's now a single
// shared component rendered once at the App root (see App.jsx's view
// switch) so Canvas gets it too without ExploreCanvas.jsx needing to know
// anything about it.
//
// Clicking it expands a small menu with three options:
//   - New {draft label}  → creates a draft and opens it in the editor
//   - New Loose Thread   → same deferred-creation flow LooseThreadsSection
//                           already used (nothing persisted until the
//                           drawer actually has a title, synopsis, or a
//                           tagged spool)
//   - New Spool Item     → just navigates to the Spools page; no creation
//
// The Dashboard's own "+" (GlobalLooseThreads) is untouched — it stays a
// single-action loose-thread button and does not render this component.
import { useState, useEffect, useRef } from "react";
import LooseThreadDrawer from './LooseThreadDrawer'
import { genId } from './utils'
import { projLabel } from './projectConfig'

export default function AddMenuFab({app}){
  var pid=app.projId;
  // Storyboard's Loose Threads bar now sits full-width flush against the
  // bottom of the viewport, so the FAB needs to sit above it there.
  // Canvas and Table don't have that bar, so they keep the normal offset.
  var fabBottom=app.view==='cards'?90:28;
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);

  var draftLabel=projLabel(app.currentProject,'draft');

  // ── New Draft ──
  function newDraft(){
    var seqDrafts=(app.allDrafts[pid]||[]).filter(function(d){return !d.archived&&d.status!=='loose_thread'&&!d.parentId;});
    var nid=genId();
    app.addDraft(pid,{id:nid,projectId:pid,title:'',synopsis:'',status:'first_draft',order:seqDrafts.length+1,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    app.openDraft(nid);
    setOpen(false);
  }

  // ── New Loose Thread ── (deferred creation, mirrors LooseThreadsSection)
  var soi=useState(null);var openLTId=soi[0];var setOpenLTId=soi[1];
  var spl=useState(null);var pendingLT=spl[0];var setPendingLT=spl[1];
  function newLooseThread(){
    var id=genId();
    setPendingLT({id:id,projectId:pid,title:'',synopsis:'',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:'',wordCount:0,strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    setOpenLTId(id);
    setOpen(false);
  }
  var activeLT=pendingLT&&pendingLT.id===openLTId?pendingLT:(app.allDrafts[pid]||[]).find(function(d){return d.id===openLTId;});
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

  // ── New Spool Item ── (navigation only, no creation)
  function newSpoolItem(){
    app.setView('strands');
    setOpen(false);
  }

  var menuItems=[
    {icon:'description', label:'New '+draftLabel, onClick:newDraft},
    {icon:'push_pin',     label:'New Loose Thread', onClick:newLooseThread},
    {icon:'gesture',      label:'New Spool Item',   onClick:newSpoolItem}
  ];

  return(
<>
  <div ref={ref} style={{position:'fixed',bottom:fabBottom,right:28,zIndex:400,display:'flex',flexDirection:'column',alignItems:'flex-end',gap:10}}>
    {open&&(
<div style={{background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:12,boxShadow:'0 8px 28px rgba(42,31,16,.18)',overflow:'hidden',minWidth:200}}>
  {menuItems.map(function(item,i){return(
<button key={item.label} onClick={item.onClick} style={{display:'flex',alignItems:'center',gap:10,width:'100%',padding:'11px 16px',background:'transparent',border:'none',borderBottom:i<menuItems.length-1?'1px solid var(--border)':'none',cursor:'pointer',fontFamily:'DM Sans, sans-serif',fontSize:14,fontWeight:600,color:'#6B4A26',textAlign:'left'}}
  onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <span className="material-symbols-outlined" style={{fontSize:19,color:'var(--teal)'}}>{item.icon}</span>
  {item.label}
</button>
  );})}
</div>
    )}
    <button data-tour="fab-add-btn" onClick={function(){setOpen(!open);}} title="Add" style={{width:52,height:52,borderRadius:'50%',background:'#DF6321',border:'none',boxShadow:'0 4px 14px rgba(42,31,16,.25)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',transition:'background .15s ease,transform .15s ease'}}
      onMouseEnter={function(e){e.currentTarget.style.background='#6B4A26';}}
      onMouseLeave={function(e){e.currentTarget.style.background='#DF6321';}}>
      <span className="material-symbols-outlined" style={{fontSize:26,color:'#F5EDE0',transform:open?'rotate(45deg)':'none',transition:'transform .15s ease'}}>add</span>
    </button>
  </div>
  {openLTId&&activeLT&&(
<LooseThreadDrawer lt={activeLT} mode="project" app={app} pid={pid} open={true} variant="overlay" topOffset={54} onUpdate={handleDrawerUpdate} onClose={handleDrawerClose} onDelete={handleDrawerDelete}/>
  )}
</>
  );
}
