// @ts-nocheck
// ── LooseThreadsQuickAccess ──
// A full-width-ish bar (padding from the screen edges, rounded outer
// stroke, light background) fixed near the bottom of the viewport,
// rendered once at the App root in Storyboard view. Clicking it smooth-
// scrolls straight down to the in-flow Loose Threads section
// (id="loose-threads-inline" in CardsView.jsx) rather than expanding an
// inline panel — simpler, and avoids duplicating the tile/create-flow UI
// that already lives there and in AddMenuFab's "New Loose Thread" option.
//
// Hides itself once that section is actually visible via
// IntersectionObserver — at that point scrolling further down IS the full
// version, so the shortcut has nothing left to add.
import { useState, useEffect } from "react";

export default function LooseThreadsQuickAccess({app}){
  var pid=app.projId;
  var allDrafts=app.allDrafts[pid]||[];
  var count=allDrafts.filter(function(d){return !d.archived&&d.status==='loose_thread';}).length;

  var sh=useState(false);var hidden=sh[0];var setHidden=sh[1];
  useEffect(function(){
    var target=document.getElementById('loose-threads-inline');
    if(!target)return;
    var observer=new IntersectionObserver(function(entries){
      setHidden(entries[0].isIntersecting);
    },{threshold:0.1});
    observer.observe(target);
    return function(){observer.disconnect();};
  },[]);

  function scrollToLooseThreads(){
    var target=document.getElementById('loose-threads-inline');
    if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
  }

  if(hidden)return null;

  return(
<button onClick={scrollToLooseThreads} style={{position:'fixed',left:16,right:16,bottom:16,zIndex:390,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:8,padding:'14px 20px',background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:16,boxShadow:'0 6px 20px rgba(42,31,16,.14)',cursor:'pointer',transition:'background .15s'}}
  onMouseOver={function(e){e.currentTarget.style.background='var(--bg2)';}}
  onMouseOut={function(e){e.currentTarget.style.background='var(--bg1)';}}>
  <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--teal)'}}>push_pin</span>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:13,fontWeight:600,color:'#6B4A26'}}>Loose Threads</span>
  {count>0&&<span style={{background:'var(--indigo)',color:'#fff',borderRadius:'50%',width:20,height:20,fontSize:10,fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{count}</span>}
  <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--mid)'}}>arrow_downward</span>
</button>
  );
}
