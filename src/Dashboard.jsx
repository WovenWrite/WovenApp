// @ts-nocheck
import { useState } from "react";
import { Drawer } from './SharedUI'
import { genId, initials, todayStr, countWords } from './utils'

// Plain text -> simple paragraph HTML, matching how draft bodies are stored
// elsewhere. Mirrors the same conversion in LooseThreadDrawer.jsx.
function textToHtml(text){
  var t=(text||'').trim();
  if(!t)return '';
  return t.split(/\n{2,}/).map(function(para){return '<p>'+para.split('\n').join('<br>')+'</p>';}).join('');
}
import LooseThreadDrawer from './LooseThreadDrawer'
import ProjectDrawer from './ProjectDrawer'

function dayLbl(offset){var days=['Su','Mo','Tu','We','Th','Fr','Sa'];var d=new Date();d.setDate(d.getDate()-offset);return days[d.getDay()];}
function getGreeting(){var h=new Date().getHours();if(h<12)return 'Good morning';if(h<17)return 'Good afternoon';return 'Good evening';}

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
  // Cumulative progress across every project — mirrors the per-project
  // progress widget's word/sequenced/loose-thread stats (ProjectDrawer.jsx),
  // just summed across app.allDrafts instead of one project's drafts.
  // The per-status colour breakdown doesn't carry over here since status
  // sets are configured per project and aren't necessarily comparable
  // across projects with different setups.
  var allTotalWords=0,allSequenced=0,allLoose=0;
  Object.keys(app.allDrafts).forEach(function(pid){
    (app.allDrafts[pid]||[]).forEach(function(d){
      if(d.archived)return;
      allTotalWords+=(d.wordCount||0);
      if(d.status==='loose_thread')allLoose++;
      else allSequenced++;
    });
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
      <div className="stat-num">{todayWords.toLocaleString()}</div>
      <div className="progress-bar-bg"><div className="progress-bar-fill" style={{width:Math.min(100,pct)+'%'}}/></div>
      <div className="stat-sub">{pct+'% of '+goal.toLocaleString()}</div>
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
  <div className="week-bar-tip">{d.words>0?d.words.toLocaleString()+' words':'No words'}</div>
  <div className={'week-bar'+(d.isToday?' today':'')} style={{height:barH,cursor:'pointer'}} onMouseOver={function(e){e.currentTarget.style.background='var(--indigoL)';}} onMouseOut={function(e){e.currentTarget.style.background=d.isToday?'var(--indigo)':'var(--bg3)';}}>
  </div>
  <div className="week-day-lbl">{d.label}</div>
</div>
      );})}
    </div>
  </div>
  <div className="stat-card stat-hide-mobile">
    <div className="stat-card-hdr"><span className="stat-card-title">All Projects</span></div>
    <div style={{display:'flex',gap:10,marginTop:4}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'var(--serif)',fontSize:22,fontWeight:600,color:'var(--text)',lineHeight:1.1}}>{allTotalWords.toLocaleString()}</div>
        <div style={{fontSize:14,color:'var(--mid)',marginTop:2}}>{allTotalWords===1?'word':'words'}</div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'var(--serif)',fontSize:22,fontWeight:600,color:'var(--text)',lineHeight:1.1}}>{allSequenced}</div>
        <div style={{fontSize:14,color:'var(--mid)',marginTop:2}}>{allSequenced===1?'draft':'drafts'}</div>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontFamily:'var(--serif)',fontSize:22,fontWeight:600,color:'var(--text)',lineHeight:1.1}}>{allLoose}</div>
        <div style={{fontSize:14,color:'var(--mid)',marginTop:2}}>{allLoose===1?'loose thread':'loose threads'}</div>
      </div>
    </div>
  </div>
</div>
  );
}

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
    var text=lt.synopsis||'';
    app.addDraft(targetPid,{id:genId(),projectId:targetPid,title:lt.title||'',synopsis:'',status:'loose_thread',order:null,parentId:null,nestExpanded:true,body:textToHtml(text),wordCount:countWords(text),strandTags:[],customFields:{},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
    app.updateGlobalLT(ltId,{archived:true});
  }
  var ssm=useState(false);var showMore=ssm[0];var setShowMore=ssm[1];
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
  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
    <span className="wv-field-lbl" style={{marginBottom:0}}>Loose Threads</span>
    {allLT.length>0&&<span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,fontWeight:600,color:'var(--indigo)',background:'rgba(196,94,40,.10)',padding:'3px 10px',borderRadius:12,whiteSpace:'nowrap'}}>{allLT.length} {allLT.length===1?'thread':'threads'}</span>}
    <div style={{flex:1}}/>
    {allLT.length>3&&(
    <button className="btn btn-ghost btn-sm" onClick={function(){setShowMore(!showMore);}}>
      {showMore?'Show less':'Show all'}
    </button>
    )}
  </div>
  <div style={{display:'flex',flexWrap:'wrap',gap:10,overflow:showMore?'visible':'hidden',maxHeight:showMore?'none':100,paddingBottom:4}}>
    <div onClick={handleAddLT} style={{background:"transparent",border:"2px dashed #A88060",padding:"10px 15px",borderRadius:15,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,minWidth:120,flexShrink:0,minHeight:80}} onMouseEnter={function(e){e.currentTarget.style.borderColor="#c45e28";}} onMouseLeave={function(e){e.currentTarget.style.borderColor="#A88060";}}>
      <span className="material-symbols-outlined" style={{fontSize:28,color:'#A88060'}}>add_circle</span>
    </div>
    {allLT.map(function(d){return(
<div key={d.id} style={{background:'#FDF8F0',border:'1px solid #E2D0B8',padding:'10px 15px',borderRadius:15,cursor:'pointer',display:'flex',flexDirection:'column',gap:8,width:150,maxWidth:150,flexShrink:0,transition:'border-color .2s,box-shadow .2s',outline:'1px solid transparent'}}
  onClick={function(){setOpenLTId(d.id);}}
  onMouseEnter={function(e){e.currentTarget.style.borderColor='#c45e28';e.currentTarget.style.boxShadow='0 4px 12px rgba(196,94,40,.12)';}}
  onMouseLeave={function(e){e.currentTarget.style.borderColor='#E2D0B8';e.currentTarget.style.boxShadow='none';}}>
  <div style={{fontFamily:'Crimson Text, serif',fontWeight:700,fontSize:16,color:'#2A1F10',lineHeight:1.25,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.title||'Untitled loose thread'}</div>
  {d.synopsis&&<div style={{fontFamily:'DM Sans, sans-serif',fontSize:14,fontStyle:'italic',color:'#A88060',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.synopsis}</div>}
</div>
    );})}
  </div>
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
  function deleteDraft(d){
    if(!window.confirm('Permanently delete "'+(d.title||'Untitled')+'"? This can\'t be undone.'))return;
    app.deleteDraftPermanently(d.pid,d.id);
    setSelected(function(prev){var n=Object.assign({},prev);delete n[d.id];return n;});
  }
  return(
<Drawer variant="overlay" open={open} title="Your Archive" topOffset={54} onClose={onClose}
  footer={selectedCount>0?(
<div style={{display:'flex',gap:8,width:'100%',alignItems:'center'}}>
  <span style={{fontSize:14,color:'var(--mid)',flex:1}}>{selectedCount} selected</span>
  <button className="btn btn-primary" style={{justifyContent:'center'}} onClick={restoreSelected}>
    <span className="mi" style={{fontSize:16}}>unarchive</span>Restore as Loose Thread
  </button>
</div>
  ):null}>
  {archivedDrafts.length===0&&archivedProjects.length===0&&(
<div style={{textAlign:'center',padding:'40px 20px',color:'var(--placeholder)'}}>
  <span className="mi" style={{fontSize:48,display:'block',marginBottom:12}}>inventory_2</span>
  <div style={{fontFamily:'var(--serif)',fontSize:18,marginBottom:6}}>Your archive is empty</div>
  <div style={{fontSize:16}}>Archived drafts and projects will appear here.</div>
</div>
  )}
  {archivedDrafts.length>0&&(
<div style={{marginBottom:20}}>
  <span className="wv-field-lbl">Archived Drafts</span>
  {archivedDrafts.map(function(d){var isSelected=!!selected[d.id];return(
<div key={d.id} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
  <span style={{width:18,height:18,borderRadius:4,border:'1px solid '+(isSelected?'var(--indigo)':'var(--border)'),background:isSelected?'var(--indigo)':'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:2,transition:'all .15s',cursor:'pointer'}} onClick={function(){toggleDraft(d.id);}}>
    {isSelected&&<span className="mi" style={{fontSize:14,color:'#fff'}}>check</span>}
  </span>
  <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={function(){toggleDraft(d.id);}}>
    <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:2}}>{d.title||'Untitled'}</div>
    <div style={{fontSize:14,color:'var(--indigo)',marginBottom:3}}>{d.projectTitle}</div>
    {d.synopsis&&<div style={{fontSize:16,color:'var(--mid)',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{d.synopsis}</div>}
  </div>
  <button className="btn-icon" style={{color:'var(--danger)',flexShrink:0}} title="Delete permanently" onClick={function(){deleteDraft(d);}}>
    <span className="mi" style={{fontSize:16}}>delete</span>
  </button>
</div>
  );})}
</div>
  )}
  {archivedProjects.length>0&&(
<div>
  <span className="wv-field-lbl">Archived Projects</span>
  {archivedProjects.map(function(p){return(
<div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
  <div style={{flex:1}}>
    <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)',marginBottom:2}}>{p.title||'Untitled'}</div>
    {p.synopsis&&<div style={{fontSize:16,color:'var(--mid)'}}>{p.synopsis}</div>}
  </div>
  <button className="btn btn-ghost btn-sm" onClick={function(){app.unarchiveProject(p.id);}}>
    <span className="mi" style={{fontSize:14}}>unarchive</span>Restore
  </button>
</div>
  );})}
</div>
  )}
</Drawer>
  );
}

// ── Dashboard ──
export default function Dashboard({app,onOpenProfile,onNewProject}){
  var profile=app.profile||{};
  var firstName=profile.firstName||'';
  var greeting=getGreeting()+(firstName?', '+firstName:'');
  var sep=useState(null);var editingProjId=sep[0];var setEditingProjId=sep[1];
  var sar=useState(false);var archiveOpen=sar[0];var setArchiveOpen=sar[1];
  var archivedCount=Object.values(app.allDrafts).flat().filter(function(d){return d.archived;}).length+(app.projects.filter(function(p){return p.archived;}).length);
  function getWC(pid){return(app.allDrafts[pid]||[]).filter(function(d){return !d.archived;}).reduce(function(s,d){return s+(d.wordCount||0);},0);}
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
      <div className="wv-field-lbl" style={{marginBottom:12}}>Your Projects</div>
      <div className="proj-grid">
        {app.projects.filter(function(p){return !p.archived;}).map(function(p){var wc=getWC(p.id);return(
<div key={p.id} className="proj-card proj-card-hover" style={{position:'relative'}}>
  <div className="proj-card-band" onClick={function(){openProject(p.id);}}>
    {p.image?<img src={p.image} alt={p.title} style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0}}/>:null}
    {!p.image&&<span className="mi" style={{position:'relative',zIndex:1,fontSize:32,color:'rgba(42,31,16,.25)'}}>photo_camera</span>}
  </div>
  <div className="proj-card-body" onClick={function(){openProject(p.id);}}>
    <div className="proj-card-title">{p.title||'Untitled'}</div>
    <div className="proj-card-syn">{p.synopsis||'No synopsis yet.'}</div>
    <div className="proj-card-footer"><span>{p.type||'Fiction'}</span><span>{wc>0?wc.toLocaleString()+' words':'Empty'}</span></div>
  </div>
  <button className="proj-edit-btn btn-icon" style={{position:'absolute',top:8,right:8,background:'var(--bg1)',border:'1px solid var(--border)',borderRadius:6,opacity:0,transition:'opacity .15s',color:'var(--mid)'}} onClick={function(e){e.stopPropagation();setEditingProjId(p.id);}} title="Edit project">
    <span className="mi" style={{fontSize:16}}>edit</span>
  </button>
</div>
        );})}<div className="add-proj" onClick={onNewProject}>
          <span className="mi" style={{fontSize:28,color:'var(--mid)'}}>add_circle_outline</span>
          <div style={{fontSize:14,color:'var(--mid)'}}>New project</div>
        </div>
      </div>
      <GlobalLooseThreads app={app}/>
      <div style={{marginTop:20,border:'1px solid var(--border)',borderRadius:'var(--rl)',padding:'12px 16px',cursor:'pointer',display:'flex',alignItems:'center',gap:12,background:'var(--bg1)',transition:'border-color .15s'}} onClick={function(){setArchiveOpen(true);}}>
        <span className="mi" style={{fontSize:24,color:'var(--placeholder)',flexShrink:0}}>inventory_2</span>
        <div style={{flex:1}}>
          <div style={{fontFamily:'var(--serif)',fontSize:14,fontWeight:600,color:'var(--text)'}}>Your Archive</div>
          <div style={{fontSize:16,color:'var(--mid)'}}>Where shelved ideas stay safe.{archivedCount>0?' '+archivedCount+' item'+(archivedCount!==1?'s':'')+' archived.':''}</div>
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
