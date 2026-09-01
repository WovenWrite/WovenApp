import React, { useState, useEffect, useRef, useCallback } from 'react';
import PropertiesDrawer from './PropertiesDrawer'
import StrandsDrawer from './StrandsDrawer'
import VersionsDrawer from './VersionsDrawer'
import CommentsDrawer from './CommentsDrawer'
import CompareView from './CompareView'
import { Popover, Field } from './SharedUI'
import { saveSnapshot, VOLUME_SNAPSHOT_WORDS, MIN_SNAPSHOT_INTERVAL_MS, loadComments, saveComment, markCommentsOrphaned, resolveComment, reopenComment } from './utils'
// ── DraftEditor.jsx ──
// Quill-based draft editor.
// Requires in index.html:
//   <link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css" rel="stylesheet"/>
//   <link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.bubble.css" rel="stylesheet"/>
//   <script src="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js"></script>
// Google Fonts (add to index.html):
//   <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;1,300&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500&family=Roboto:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Open+Sans:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Nunito:wght@300;400;500;600&family=IBM+Plex+Mono:wght@300;400&display=swap" rel="stylesheet"/>


var T={
  navBg:'#E2D0B8',
  toolBg:'#FDF8F0',
  bodyBg:'#FDF8F0',
  text:'#7A5A38',
  textDark:'#2a1f10',
  bodyText:'#4A3520',
  primary:'#6B4A26',
  amber:'#c45e28',
  border:'#E2D0B8',
  stroke:'#A88060',
  bg1:'#f5ede0',
  bg2:'#ede0cc',
  white:'#ffffff',
};

var FONTS=['Crimson Text','Times New Roman','Lora','Merriweather','Playfair Display','Source Serif 4','DM Sans','Inter','Roboto','Open Sans','Nunito','IBM Plex Mono'];
var FONT_LABELS={'Crimson Text':'Crimson Text','Times New Roman':'Times New Roman','Lora':'Lora','Merriweather':'Merriweather','Playfair Display':'Playfair Display','Source Serif 4':'Source Serif 4','DM Sans':'DM Sans','Inter':'Inter','Roboto':'Roboto','Open Sans':'Open Sans','Nunito':'Nunito','IBM Plex Mono':'IBM Plex Mono'};
var ZOOM_OPTS=[50,75,100,125,150,175,200];
var DEFAULT_FONT_SIZE=19;

function countWords(t){if(!t||!t.trim())return 0;return t.trim().split(/\s+/).filter(function(w){return w.length>0;}).length;}
function genId(){return '_'+Math.random().toString(36).slice(2)+Date.now().toString(36);}

// ── iOS Toggle ──
function IOSToggle({on,onChange,label}){
  return(
<div style={{display:'flex',alignItems:'center',gap:8}}>
  {label&&<span style={{fontSize:13,color:T.text,fontFamily:'DM Sans, sans-serif'}}>{label}</span>}
  <div onClick={function(){onChange(!on);}} style={{width:40,height:22,borderRadius:11,background:on?T.amber:T.border,cursor:'pointer',position:'relative',transition:'background .2s',flexShrink:0}}>
    <div style={{position:'absolute',top:2,left:on?20:2,width:18,height:18,borderRadius:'50%',background:T.white,boxShadow:'0 1px 3px rgba(0,0,0,.2)',transition:'left .2s'}}/>
  </div>
</div>
  );
}

// ── Editable Title ──
function EditableTitle({value,onChange,color}){
  var se=useState(false);var editing=se[0];var setEditing=se[1];
  var sv=useState(value);var val=sv[0];var setVal=sv[1];
  var ref=useRef(null);
  var measureRef=useRef(null);
  useEffect(function(){setVal(value);},[value]);
  useEffect(function(){if(editing&&ref.current){ref.current.focus();ref.current.select();}},[editing]);
  function commit(){setEditing(false);if(val.trim()&&val.trim()!==value)onChange(val.trim());else setVal(value);}
  // Shared text style so span and input look identical
  var textStyle={fontFamily:'Crimson Text, serif',fontSize:16,fontWeight:600,color:color||T.textDark,padding:'2px 8px',borderRadius:6,whiteSpace:'nowrap'};
  return(
<div style={{position:'relative',display:'inline-flex',maxWidth:'40ch',minWidth:'4ch'}}>
  {/* Hidden measuring span — always rendered, sizes the container */}
  <span ref={measureRef} aria-hidden="true" style={Object.assign({},textStyle,{visibility:'hidden',position:'absolute',pointerEvents:'none',maxWidth:'40ch',overflow:'hidden'})}>
    {(editing?val:value)||'Untitled draft'}
  </span>
  {editing?(
<input ref={ref} value={val}
  onChange={function(e){setVal(e.target.value);}}
  onBlur={commit}
  onKeyDown={function(e){if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(value);setEditing(false);}}}
  style={Object.assign({},textStyle,{background:'transparent',border:'1px solid '+T.amber,outline:'none',width:'100%',boxSizing:'border-box',color:color||T.textDark})}/>
  ):(
<span onClick={function(){setEditing(true);}} title="Click to edit"
  style={Object.assign({},textStyle,{border:'1px solid transparent',cursor:'text',overflow:'hidden',textOverflow:'ellipsis',display:'block',width:'100%',transition:'border-color .15s'})}
  onMouseOver={function(e){e.currentTarget.style.borderColor=T.stroke;}}
  onMouseOut={function(e){e.currentTarget.style.borderColor='transparent';}}>
  {value||'Untitled draft'}
</span>
  )}
</div>
  );
}

// ── Icon Button ──
function IconBtn({icon,title,onClick,active,color}){
  return(
<button onClick={onClick} title={title} style={{display:'flex',alignItems:'center',justifyContent:'center',padding:10,background:active?'rgba(196,94,40,.12)':'transparent',border:'none',borderRadius:8,cursor:'pointer',color:color||(active?T.amber:T.text),transition:'background .15s,color .15s',flexShrink:0}}
  onMouseOver={function(e){if(!active){e.currentTarget.style.background='rgba(42,31,16,.06)';}}}
  onMouseOut={function(e){if(!active){e.currentTarget.style.background='transparent';}}}>
  <span className="mi" style={{fontSize:22}}>{icon}</span>
</button>);
}

// ── Select dropdown styled ──
function StyledSelect({value,onChange,options,style}){
  return(
<select value={value} onChange={function(e){onChange(e.target.value);}} style={Object.assign({padding:'4px 8px',background:T.toolBg,border:'1px solid '+T.stroke,borderRadius:6,fontSize:13,color:T.text,fontFamily:'DM Sans, sans-serif',cursor:'pointer',outline:'none'},style||{})}>
  {options.map(function(o){return(<option key={o.value} value={o.value}>{o.label}</option>);})}
</select>);
}

// ── Colour palettes for text colour / highlight ──
var TEXT_COLORS=['#2a1f10','#7A5A38','#c45e28','#8b3a3a','#3a5f7a','#3a7a4f','#6b4a9e','#000000'];
var HIGHLIGHT_COLORS=['#fdf1c8','#f8d9a0','#f4c2c2','#c9e4c5','#c2dcf4','#e0c2f4','#fff2a8','#ffffff'];

// ── Small dark icon button used inside the flow-mode bubble toolbar ──
function BubbleIcon({icon,title,onClick}){
  return(
<button onMouseDown={function(e){e.preventDefault();}} onClick={onClick} title={title} style={{display:'flex',alignItems:'center',justifyContent:'center',width:28,height:28,background:'transparent',border:'none',borderRadius:6,cursor:'pointer',color:'#fdf8f0',flexShrink:0}}
  onMouseOver={function(e){e.currentTarget.style.background='rgba(253,248,240,.14)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <span className="mi" style={{fontSize:16}}>{icon}</span>
</button>);
}

// ── Colour / highlight picker — used in both the pinned toolbar and the flow bubble ──
function ColorPickerBtn({icon,title,colors,onPick,onClear,dark}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var sp=useState(null);var panelPos=sp[0];var setPanelPos=sp[1];
  var ref=useRef(null);
  var btnRef=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  function handleToggle(){
    if(!open&&btnRef.current){
      var r=btnRef.current.getBoundingClientRect();
      setPanelPos({top:r.bottom+6,left:r.left});
    }
    setOpen(!open);
  }
  return(
<div ref={ref} style={{position:'relative',flexShrink:0}}>
  <button ref={btnRef} onMouseDown={function(e){e.preventDefault();}} onClick={handleToggle} title={title} style={{display:'flex',alignItems:'center',justifyContent:'center',width:dark?28:32,height:dark?28:32,background:'transparent',border:'none',borderRadius:6,cursor:'pointer',color:dark?'#fdf8f0':T.text,flexShrink:0}}
    onMouseOver={function(e){e.currentTarget.style.background=dark?'rgba(253,248,240,.14)':'rgba(42,31,16,.08)';}}
    onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
    <span className="mi" style={{fontSize:dark?16:18}}>{icon}</span>
  </button>
  {open&&panelPos&&(
<div style={{position:'fixed',top:panelPos.top,left:panelPos.left,zIndex:2000,background:dark?'#2a1f10':T.toolBg,border:'1px solid '+(dark?'rgba(253,248,240,.2)':T.border),borderRadius:10,boxShadow:'0 8px 28px rgba(42,31,16,.2)',padding:8,display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6,width:120}}>
  {colors.map(function(c){return(
<button key={c} onMouseDown={function(e){e.preventDefault();}} onClick={function(){onPick(c);setOpen(false);}} title={c} style={{width:22,height:22,borderRadius:5,border:'1px solid rgba(0,0,0,.15)',background:c,cursor:'pointer',padding:0}}/>
  );})}
  <button onMouseDown={function(e){e.preventDefault();}} onClick={function(){onClear();setOpen(false);}} title="Remove colour" style={{width:22,height:22,borderRadius:5,border:'1px solid '+(dark?'rgba(253,248,240,.3)':T.border),background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>
    <span className="mi" style={{fontSize:14,color:dark?'#fdf8f0':T.text}}>close</span>
  </button>
</div>
  )}
</div>
  );
}

// ── Branch Dropdown ──
function BranchDropdown({branches,activeBranchId,onSwitch,onCreate,onSetPrimary,onCompareTwo}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var sc=useState(false);var creating=sc[0];var setCreating=sc[1];
  var sn=useState('');var newName=sn[0];var setNewName=sn[1];
  var scb=useState([]);var selectedBranches=scb[0];var setSelectedBranches=scb[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  var hasBranches=branches&&branches.length>1;
  var activeBranch=branches&&branches.find(function(b){return b.id===activeBranchId;})||branches&&branches[0];
  var btnLabel=hasBranches?(branches.length+' strands'):'Create strand';
  function handleCreate(){setCreating(true);var num=branches?branches.length+1:2;var draft=activeBranch&&activeBranch.draftTitle||'Draft';setNewName(draft+'_Strand_'+num);}
  function confirmCreate(){if(newName.trim())onCreate(newName.trim());setCreating(false);setNewName('');setOpen(false);}
  function toggleSelectBranch(id,e){
    e.stopPropagation();
    setSelectedBranches(function(prev){
      if(prev.indexOf(id)>=0)return prev.filter(function(x){return x!==id;});
      if(prev.length>=2)return [prev[1],id];
      return prev.concat([id]);
    });
  }
  function handleCompareClick(){
    if(selectedBranches.length!==2||!onCompareTwo)return;
    onCompareTwo(selectedBranches[0],selectedBranches[1]);
    setSelectedBranches([]);setOpen(false);
  }
  var sorted=branches?[].concat(branches.filter(function(b){return b.id===activeBranchId;}),branches.filter(function(b){return b.id!==activeBranchId;})):[];
  return(
<div ref={ref} style={{position:'relative'}}>
  <button onClick={function(){if(!hasBranches){handleCreate();setOpen(true);}else setOpen(!open);}} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background:'transparent',border:'1px solid '+T.border,borderRadius:6,cursor:'pointer',fontSize:13,color:hasBranches?T.text:T.text,fontFamily:'DM Sans, sans-serif',flexShrink:0,opacity:hasBranches?1:.55}}>
    <span className="mi" style={{fontSize:16}}>{hasBranches?'account_tree':'add'}</span>
    {btnLabel}
    {hasBranches&&<span className="mi" style={{fontSize:14,transform:open?'rotate(180deg)':'rotate(0)',transition:'transform .15s'}}>expand_more</span>}
  </button>
  {open&&(
<div style={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:600,background:T.toolBg,border:'1px solid '+T.border,borderRadius:10,boxShadow:'0 8px 28px rgba(42,31,16,.14)',minWidth:220,overflow:'hidden'}}>
  {creating?(
<div style={{padding:'10px 12px'}}>
  <div style={{fontSize:11,color:T.text,fontWeight:600,marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'DM Sans, sans-serif'}}>Strand name</div>
  <input autoFocus value={newName} onChange={function(e){setNewName(e.target.value);}} onKeyDown={function(e){if(e.key==='Enter')confirmCreate();if(e.key==='Escape'){setCreating(false);setOpen(false);}}} style={{width:'100%',padding:'7px 10px',fontSize:13,border:'1px solid '+T.border,borderRadius:6,background:T.bg1,color:T.textDark,fontFamily:'DM Sans, sans-serif',boxSizing:'border-box',marginBottom:8}}/>
  <div style={{display:'flex',gap:6}}>
    <button onClick={confirmCreate} style={{flex:1,padding:'6px 0',background:T.primary,color:T.white,border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'DM Sans, sans-serif',fontWeight:600}}>Create</button>
    <button onClick={function(){setCreating(false);}} style={{padding:'6px 10px',background:'transparent',border:'1px solid '+T.border,borderRadius:6,fontSize:12,cursor:'pointer',color:T.text,fontFamily:'DM Sans, sans-serif'}}>Cancel</button>
  </div>
</div>
  ):(
<div>
  {sorted.map(function(b,i){var isActive=b.id===activeBranchId;return(
<div key={b.id} style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',borderBottom:i<sorted.length-1?'1px solid '+T.border:'none',cursor:'pointer',background:isActive?'rgba(196,94,40,.06)':'transparent',transition:'background .1s'}}
  onClick={function(){if(!isActive){onSwitch(b.id);setOpen(false);}}}
  onMouseOver={function(e){if(!isActive)e.currentTarget.style.background='rgba(42,31,16,.04)';}}
  onMouseOut={function(e){if(!isActive)e.currentTarget.style.background='transparent';}}>
  {hasBranches&&(
  <div
    onClick={function(e){toggleSelectBranch(b.id,e);}}
    title="Select to compare"
    style={{width:14,height:14,borderRadius:4,border:'1.5px solid '+(selectedBranches.indexOf(b.id)>=0?T.amber:T.border),background:selectedBranches.indexOf(b.id)>=0?T.amber:'transparent',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}
  >
    {selectedBranches.indexOf(b.id)>=0&&<span className="mi" style={{fontSize:10,color:'#fff'}}>check</span>}
  </div>
  )}
  <span style={{flex:1,fontSize:13,fontWeight:isActive?600:400,color:isActive?T.amber:T.textDark,fontFamily:'Crimson Text, serif'}}>{b.name}</span>
  <button onClick={function(e){e.stopPropagation();onSetPrimary(b.id);}} style={{background:'none',border:'none',cursor:'pointer',padding:2,display:'flex',alignItems:'center',color:b.isPrimary?T.amber:T.border,transition:'color .15s'}}
    onMouseOver={function(e){e.currentTarget.style.color=T.amber;}}
    onMouseOut={function(e){e.currentTarget.style.color=b.isPrimary?T.amber:T.border;}}>
    <span className="mi" style={{fontSize:18,fontVariationSettings:b.isPrimary?"'FILL' 1":"'FILL' 0"}}>star</span>
  </button>
</div>
  );})}
  {selectedBranches.length===2&&(
  <div style={{padding:'8px 14px',borderTop:'1px solid '+T.border,background:'rgba(196,94,40,.06)'}}>
    <button onClick={handleCompareClick} style={{width:'100%',padding:'7px 0',background:T.textDark,color:'#fdf8f0',border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'DM Sans, sans-serif',fontWeight:600,display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
      <span className="mi" style={{fontSize:14}}>difference</span>Compare selected
    </button>
  </div>
  )}
  <div style={{padding:'8px 14px',borderTop:'1px solid '+T.border}}>
    <button onClick={handleCreate} style={{width:'100%',padding:'7px 0',background:'transparent',border:'1px dashed '+T.border,borderRadius:6,fontSize:12,color:T.text,cursor:'pointer',fontFamily:'DM Sans, sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
      <span className="mi" style={{fontSize:14}}>add</span>New strand
    </button>
  </div>
</div>
  )}
</div>
  )}
</div>);
}


// ── ExportButton with loading state ──
function ExportButton({icon,label,onExport,onDone}){
  var sl=useState(false);var loading=sl[0];var setLoading=sl[1];
  var sd=useState(false);var done=sd[0];var setDone=sd[1];
  function handle(){
    setLoading(true);
    setTimeout(function(){
      onExport();
      setLoading(false);setDone(true);
      setTimeout(function(){setDone(false);if(onDone)onDone();},1200);
    },200);
  }
  return(
<button onClick={handle} disabled={loading} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:done?'rgba(47,153,102,.08)':'transparent',border:'none',borderBottom:'1px solid '+T.border,cursor:'pointer',textAlign:'left',fontFamily:'DM Sans, sans-serif',transition:'background .15s'}}
  onMouseOver={function(e){if(!loading&&!done)e.currentTarget.style.background='rgba(42,31,16,.04)';}}
  onMouseOut={function(e){if(!done)e.currentTarget.style.background='transparent';}}>
  <span className="mi" style={{fontSize:20,color:done?'#2f9966':T.text}}>
    {loading?'hourglass_top':done?'check_circle':icon}
  </span>
  <span style={{fontSize:13,fontWeight:600,color:done?'#2f9966':T.textDark}}>
    {loading?'Preparing…':done?'Downloaded!':label}
  </span>
</button>
  );
}

// ── Share Dropdown ──
function ShareDropdown({onExportPDF,onExportDocx,shareLink,onGenerateLink,onDepublish}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var sl=useState(false);var loading=sl[0];var setLoading=sl[1];
  var sc=useState(false);var copied=sc[0];var setCopied=sc[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  function handleCopy(){navigator.clipboard&&navigator.clipboard.writeText(shareLink);setCopied(true);setTimeout(function(){setCopied(false);},2500);}
  async function handleGenerate(){setLoading(true);await onGenerateLink();setLoading(false);}
  return(
<div ref={ref} style={{position:'relative'}}>
  <button onClick={function(){setOpen(!open);}} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:T.primary,color:T.white,border:'none',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'DM Sans, sans-serif',whiteSpace:'nowrap'}}
    onMouseOver={function(e){e.currentTarget.style.opacity='.88';}}
    onMouseOut={function(e){e.currentTarget.style.opacity='1';}}>
    <span>Share</span>
    <span className="mi" style={{fontSize:18,lineHeight:1,display:'flex',alignItems:'center',transform:open?'rotate(180deg)':'rotate(0deg)',transition:'transform .15s'}}>expand_more</span>
  </button>
  {open&&(
<div style={{position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:600,background:T.toolBg,border:'1px solid '+T.border,borderRadius:10,boxShadow:'0 8px 28px rgba(42,31,16,.14)',width:280,overflow:'hidden'}}>
  <ExportButton icon="picture_as_pdf" label="Export PDF" onExport={onExportPDF} onDone={function(){setOpen(false);}}/>
  <ExportButton icon="description" label="Export Docx" onExport={onExportDocx} onDone={function(){setOpen(false);}}/>
  <div style={{padding:'12px 16px'}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:shareLink?10:0}}>
      <span className="mi" style={{fontSize:20,color:T.text}}>link</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textDark}}>Read-only link</div>
        <div style={{fontSize:11,color:T.text}}>{shareLink?'Live — anyone with the link can read':'Generate a shareable web link'}</div>
      </div>
      {!shareLink&&<button onClick={handleGenerate} disabled={loading} style={{padding:'6px 12px',background:T.primary,color:T.white,border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans, sans-serif',opacity:loading?.6:1}}>{loading?'Generating…':'Generate'}</button>}
    </div>
    {shareLink&&(
<div>
  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
    <button onClick={handleCopy} style={{flex:1,padding:'7px 12px',background:T.bg1,border:'1px solid '+T.border,borderRadius:7,fontSize:13,cursor:'pointer',color:T.textDark,fontFamily:'DM Sans, sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
      <span className="mi" style={{fontSize:16}}>{copied?'check':'content_copy'}</span>
      {copied?'Link copied!':'Copy link'}
    </button>
  </div>
  <IOSToggle on={true} onChange={function(v){if(!v)onDepublish();}} label="Link active"/>
</div>
    )}
  </div>
</div>
  )}
</div>);
}


// ── NavCollapseMenu (mobile ≤720px) ──
function NavCollapseMenu({branches,activeBranchId,onSwitch,onCreate,onSetPrimary,onVersions,onComments,onProperties,onSpool}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  var hasBranches=branches&&branches.length>1;
  var items=[
    {icon:'account_tree',label:hasBranches?(branches.length+' strands'):'Create strand',action:function(){onCreate&&onCreate('Strand '+(branches?branches.length+1:2));setOpen(false);}},
    {icon:'history',label:'Versions',action:function(){onVersions();setOpen(false);}},
    {icon:'comment',label:'Comments',action:function(){onComments&&onComments();setOpen(false);}},
    {icon:'settings',label:'Properties',action:function(){onProperties();setOpen(false);}},
    {icon:'gesture',label:'Spools',action:function(){onSpool();setOpen(false);}},
  ];
  return(
<div ref={ref} className="nav-collapse" style={{display:'none',position:'relative'}}>
  <button onClick={function(){setOpen(!open);}} style={{display:'flex',alignItems:'center',justifyContent:'center',padding:10,background:'transparent',border:'none',cursor:'pointer',color:T.text,borderRadius:8}}>
    <span className="mi" style={{fontSize:22}}>more_vert</span>
  </button>
  {open&&(
<div style={{position:'absolute',top:'calc(100% + 4px)',right:0,zIndex:600,background:T.toolBg,border:'1px solid '+T.border,borderRadius:10,boxShadow:'0 8px 28px rgba(42,31,16,.14)',minWidth:180,overflow:'hidden'}}>
  {items.map(function(item){return(
<button key={item.icon} onClick={item.action} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'11px 16px',background:'transparent',border:'none',borderBottom:'1px solid '+T.border,cursor:'pointer',fontFamily:'DM Sans, sans-serif',fontSize:13,color:T.textDark,textAlign:'left'}}
  onMouseOver={function(e){e.currentTarget.style.background='rgba(42,31,16,.04)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <span className="mi" style={{fontSize:18,color:T.text}}>{item.icon}</span>{item.label}
</button>
  );})}
</div>
  )}
</div>
  );
}

// ── Main DraftEditor ──
function DraftEditor({app}){
  var pid=app&&app.projId;
  var did=app&&app.draftId;
  var draft=(app&&app.allDrafts&&app.allDrafts[pid]&&app.allDrafts[pid].find(function(d){return d.id===did;}))||{};

  var st=useState(draft.title||'Untitled draft');var title=st[0];var setTitle=st[1];
  var sw=useState(draft.wordCount||0);var wordCount=sw[0];var setWordCount=sw[1];
  var ss=useState('saved');var saveState=ss[0];var setSaveState=ss[1];
  // Build branch list from the strand family this draft belongs to.
  // Walk up to the true root first (rather than only looking at this
  // draft's own children) so the dropdown shows the full sibling set no
  // matter which strand in the family you're currently viewing.
  function buildBranches(){
    var all=(app&&app.allDrafts&&app.allDrafts[pid])||[];
    var rootDraft=draft;
    var guard=0;
    while(rootDraft&&rootDraft.parentId&&guard<10){
      var p=all.find(function(d){return d.id===rootDraft.parentId;});
      if(!p)break;
      rootDraft=p;guard++;
    }
    var rootId=(rootDraft&&rootDraft.id)||did;
    var children=all.filter(function(d){return d.parentId===rootId&&!d.archived;});
    var rootTitle=(rootDraft&&rootDraft.title)||'Untitled draft';
    var main=[{id:rootId,name:rootTitle,isPrimary:true,draftTitle:rootTitle}];
    var rest=children.map(function(d){return{id:d.id,name:d.title||'Strand',isPrimary:false,draftTitle:d.title||'Strand'};});
    return main.concat(rest);
  }
  var sb=useState(buildBranches);var branches=sb[0];var setBranches=sb[1];
  // Keep the branch list in sync with the actual data whenever it changes
  // (e.g. after promoting a strand to primary) without navigating away —
  // you should stay on whatever strand you're currently drafting.
  useEffect(function(){
    setBranches(buildBranches());
  },[app&&app.allDrafts&&app.allDrafts[pid]]);
  var sab=useState(did);var activeBranchId=sab[0];var setActiveBranchId=sab[1];
  var slink=useState(null);var shareLink=slink[0];var setShareLink=slink[1];
  var ssid=useState(null);var shareId=ssid[0];var setShareId=ssid[1];
  var spv=useState(false);var showVersions=spv[0];var setShowVersions=spv[1];
  var spc=useState(false);var showComments=spc[0];var setShowComments=spc[1];
  var spp=useState(false);var showProperties=spp[0];var setShowProperties=spp[1];
  var sps=useState(false);var showSpool=sps[0];var setShowSpool=sps[1];
  var ssd=useState(null);var strandDetailId=ssd[0];var setStrandDetailId=ssd[1];
  var sf=useState(window.innerWidth<720);var flowMode=sf[0];var setFlowMode=sf[1];
  // Auto flow on resize
  useEffect(function(){
    function onResize(){if(window.innerWidth<720)setFlowMode(true);}
    window.addEventListener('resize',onResize);
    return function(){window.removeEventListener('resize',onResize);};
  },[]);
  var szoom=useState(100);var zoom=szoom[0];var setZoom=szoom[1];
  var sfont=useState('Crimson Text');var font=sfont[0];var setFont=sfont[1];
  var sheader=useState('');var headerStyle=sheader[0];var setHeaderStyle=sheader[1];
  var saf=useState('');var activeFormat=saf[0];var setActiveFormat=saf[1];

  var quillRef=useRef(null);
  var editorContainerRef=useRef(null);
  var fileInputRef=useRef(null);
  var saveTimer=useRef(null);
  var initialised=useRef(false);
  var sessionStartWc=useRef(draft.wordCount||0);
  var lastSnapshotBody=useRef('');
  var lastSnapshotWc=useRef(draft.wordCount||0);
  var lastSnapshotTs=useRef(0);
  var lastVersionId=useRef(null);
  var activeCommentIdsRef=useRef([]);
  var pendingCommentRange=useRef(null);
  var cbp=useState(null);var commentBtnPos=cbp[0];var setCommentBtnPos=cbp[1];
  var commentBtnRef=useRef(null);
  var cco=useState(false);var showCommentComposer=cco[0];var setShowCommentComposer=cco[1];
  var commentComposerOpenRef=useRef(false);
  var cdt=useState('');var commentDraftText=cdt[0];var setCommentDraftText=cdt[1];
  var fci=useState(null);var focusCommentId=fci[0];var setFocusCommentId=fci[1];
  var scd=useState(null);var compareData=scd[0];var setCompareData=scd[1];
  var crt=useState(0);var commentsRefreshTick=crt[0];var setCommentsRefreshTick=crt[1];
  var pvw=useState(null);var previewVersion=pvw[0];var setPreviewVersion=pvw[1];

  // Derived font size from zoom
  var baseFontSize=DEFAULT_FONT_SIZE;
  var fontSize=Math.round(baseFontSize*(zoom/100));
  // Max width scales with zoom — 900px at 100%, grows proportionally
  var maxWidth=Math.round(900*(zoom/100));

  // ── Init Quill ──
  useEffect(function(){
    if(initialised.current)return;
    if(!editorContainerRef.current||!window.Quill)return;
    // Register the comment inline format once globally. Uses class syntax
    // because Quill's Parchment blots require extending its Inline class —
    // the rest of this file stays var-style, this is the one exception
    // the framework itself demands.
    if(!window.__wovenCommentBlotRegistered){
      var Inline=window.Quill.import('blots/inline');
      class CommentBlot extends Inline{
        static create(commentId){
          var node=super.create();
          node.setAttribute('data-comment-id',commentId);
          node.classList.add('wv-comment-mark');
          return node;
        }
        static formats(node){
          return node.getAttribute('data-comment-id');
        }
      }
      CommentBlot.blotName='comment';
      CommentBlot.tagName='span';
      window.Quill.register(CommentBlot);
      window.__wovenCommentBlotRegistered=true;
    }
    var isMobile=window.innerWidth<720;
    var q=new window.Quill(editorContainerRef.current,{
      theme:isMobile?'bubble':'snow',
      modules:{toolbar:false},
      placeholder:'Start writing…',
    });
    if(draft&&draft.body){
      q.clipboard.dangerouslyPasteHTML(draft.body);
      if(q.history)q.history.clear();
    }
    // Set from actual Quill content after paste — not stale React state
    var initialWc=countWords(q.getText());
    setWordCount(initialWc);
    sessionStartWc.current=initialWc;
    lastSnapshotBody.current=q.root.innerHTML;
    lastSnapshotWc.current=initialWc;
    lastSnapshotTs.current=Date.now();
    // Track which comment ids are still active (not resolved/orphaned) so the
    // save handler can detect when their anchor text gets deleted.
    loadComments(did).then(function(list){
      activeCommentIdsRef.current=list.filter(function(c){return !c.resolved&&!c.orphaned;}).map(function(c){return c.id;});
      list.forEach(function(c){
        if(c.resolved){
          var nodes=q.root.querySelectorAll('[data-comment-id="'+c.id+'"]');
          nodes.forEach(function(n){n.classList.add('wv-comment-resolved');});
        }
      });
    });
    q.on('selection-change',function(range){
      if(!range||range.length===0){
        // cursor position — get format at cursor
        var fmt=q.getFormat(range||0);
        if(fmt.blockquote)setActiveFormat('quote');
        else if(fmt.header)setActiveFormat(String(fmt.header));
        else setActiveFormat('');
        // Don't drop the pending range/button while the comment composer is
        // open — losing DOM focus to the composer's textarea fires this same
        // "empty selection" event, and clearing here would rip the anchor
        // out from under an in-progress comment.
        if(!commentComposerOpenRef.current){
          pendingCommentRange.current=null;
          setCommentBtnPos(null);
        }
        return;
      }
      var fmt=q.getFormat(range);
      if(fmt.blockquote)setActiveFormat('quote');
      else if(fmt.header)setActiveFormat(String(fmt.header));
      else setActiveFormat('');
      // Text is selected — surface the inline "leave a comment" affordance
      // near the selection instead of a permanent toolbar icon. Stash the
      // range in a ref (not state) so a click on the button, which can blur
      // the editor and clear the visual selection, still acts on the right
      // text.
      pendingCommentRange.current={index:range.index,length:range.length};
      var bounds=q.getBounds(range.index,range.length);
      setCommentBtnPos({top:bounds.top,left:bounds.left+bounds.width/2});
    });
    // Clicking an existing comment mark opens the comments panel focused on it
    q.root.addEventListener('click',function(e){
      var mark=e.target.closest?e.target.closest('.wv-comment-mark'):null;
      if(!mark)return;
      var cid=mark.getAttribute('data-comment-id');
      setFocusCommentId(cid);
      setShowComments(true);setShowVersions(false);setShowProperties(false);setShowSpool(false);
    });
    // Also update on text-change (when typing changes format context)
    q.on('editor-change',function(){
      var range=q.getSelection();
      if(!range)return;
      var fmt=q.getFormat(range);
      if(fmt.blockquote)setActiveFormat('quote');
      else if(fmt.header)setActiveFormat(String(fmt.header));
      else setActiveFormat('');
    });
    var loadComplete=false;
    setTimeout(function(){loadComplete=true;},100); // flag set after initial load
    q.on('text-change',function(delta,oldDelta,source){
      if(source!=='user'&&!loadComplete)return; // ignore only the initial paste-in
      var txt=q.getText();
      var wc=countWords(txt);
      setWordCount(wc);
      setSaveState('saving');
      if(saveTimer.current)clearTimeout(saveTimer.current);
      saveTimer.current=setTimeout(function(){
        var html=q.root.innerHTML;
        if(app&&app.updateDraft)app.updateDraft(pid,did,{body:html,wordCount:wc,updatedAt:new Date().toISOString()});
        setSaveState('saved');
      // Record words written this session for dashboard stats
      var added=Math.max(0,wc-sessionStartWc.current);
      if(added>0){
        if(app&&app.recordSession)app.recordSession(pid,added);
        sessionStartWc.current=wc;
      } else if(wc<sessionStartWc.current){
        // Word count went down (deletion) — update baseline so future additions are correct
        sessionStartWc.current=wc;
      }
      // Activity-based version snapshot: capture whenever enough new writing
      // has accumulated since the last snapshot (word burst), or enough time
      // has passed with a real content change (catches heavy revision/rewrites
      // that don't move the net word count much). Manual saves bypass this
      // entirely via handleManualSnapshot below.
      if(html!==lastSnapshotBody.current){
        var wordsSinceSnapshot=Math.abs(wc-lastSnapshotWc.current);
        var timeSinceSnapshot=Date.now()-lastSnapshotTs.current;
        if(wordsSinceSnapshot>=VOLUME_SNAPSHOT_WORDS||timeSinceSnapshot>=MIN_SNAPSHOT_INTERVAL_MS){
          saveSnapshot(did,html,wc,{isManual:false}).then(function(row){if(row)lastVersionId.current=row.id;});
          lastSnapshotBody.current=html;
          lastSnapshotWc.current=wc;
          lastSnapshotTs.current=Date.now();
        }
      }
      // Orphan detection: if a comment's anchor span is no longer present in
      // the saved HTML, the text it was attached to was deleted — mark it
      // orphaned so it grays out in the comments list.
      if(activeCommentIdsRef.current.length){
        var stillPresent=[];var toOrphan=[];
        activeCommentIdsRef.current.forEach(function(cid){
          if(html.indexOf('data-comment-id="'+cid+'"')>=0)stillPresent.push(cid);
          else toOrphan.push(cid);
        });
        if(toOrphan.length){
          activeCommentIdsRef.current=stillPresent;
          markCommentsOrphaned(toOrphan);
        }
      }
      // If a share link is live, keep it in sync
      if(shareId){
        var sc=window.supabase&&window.supabase.createClient?window.supabase.createClient('https://mxsdiqrbxlvcwexfdtrj.supabase.co','sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u'):null;
        if(sc)sc.from('shared_drafts').update({body:html,title:title}).eq('id',shareId).then(function(){});
      }
      },800);
    });
    quillRef.current=q;
    initialised.current=true;
    return function(){if(saveTimer.current)clearTimeout(saveTimer.current);};
  },[]);

  // Apply font size and font family to Quill editor
  useEffect(function(){
    if(!editorContainerRef.current)return;
    editorContainerRef.current.style.fontSize=fontSize+'px';
    editorContainerRef.current.style.fontFamily=font+', serif';
  },[fontSize,font]);

  // ── Ctrl+scroll and Ctrl+plus/minus for zoom in flow mode ──
  useEffect(function(){
    if(!flowMode)return;
    function onWheel(e){
      if(!e.ctrlKey)return;
      e.preventDefault();
      setZoom(function(z){
        var delta=e.deltaY<0?25:-25;
        return Math.min(200,Math.max(50,z+delta));
      });
    }
    function onKeyDown(e){
      if(!e.ctrlKey)return;
      if(e.key==='='||e.key==='+'){e.preventDefault();setZoom(function(z){return Math.min(200,z+25);});}
      if(e.key==='-'){e.preventDefault();setZoom(function(z){return Math.max(50,z-25);});}
    }
    window.addEventListener('wheel',onWheel,{passive:false});
    window.addEventListener('keydown',onKeyDown);
    return function(){window.removeEventListener('wheel',onWheel);window.removeEventListener('keydown',onKeyDown);};
  },[flowMode]);

  function fmt(type,value){if(!quillRef.current)return;var r=quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format(type,cur[type]===value?false:value);}}
  function toggleFmt(type){if(!quillRef.current)return;var r=quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format(type,!cur[type]);}}

  // ── Image upload — pushes to Supabase Storage bucket 'woven-images' (must exist & be public), then embeds the public URL ──
  async function handleImageFile(e){
    var file=e.target.files&&e.target.files[0];
    e.target.value='';
    if(!file||!quillRef.current)return;
    var r=quillRef.current.getSelection(true);
    var index=r?r.index:quillRef.current.getLength();
    var client=window.supabase&&window.supabase.createClient?window.supabase.createClient(
      'https://mxsdiqrbxlvcwexfdtrj.supabase.co',
      'sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u'
    ):null;
    if(!client)return;
    var safeName=file.name.replace(/[^a-zA-Z0-9.\-_]/g,'_');
    var path=(did||'draft')+'/'+genId()+'-'+safeName;
    var up=await client.storage.from('woven-images').upload(path,file,{cacheControl:'3600',upsert:false});
    if(up.error){console.error('Image upload error:',up.error);window.alert('Image upload failed: '+up.error.message);return;}
    var pub=client.storage.from('woven-images').getPublicUrl(path);
    var url=pub&&pub.data&&pub.data.publicUrl;
    if(!url)return;
    quillRef.current.insertEmbed(index,'image',url,'user');
    quillRef.current.setSelection(index+1,0);
  }

  function handleManualSnapshot(label){
    if(!quillRef.current)return Promise.resolve();
    if(!label||!label.trim())return Promise.resolve();
    var html=quillRef.current.root.innerHTML;
    var wc=countWords(quillRef.current.getText());
    lastSnapshotBody.current=html;
    lastSnapshotWc.current=wc;
    lastSnapshotTs.current=Date.now();
    return saveSnapshot(did,html,wc,{isManual:true,label:label.trim()}).then(function(row){if(row)lastVersionId.current=row.id;});
  }

  function handleAddComment(){
    if(!quillRef.current)return;
    var range=pendingCommentRange.current||quillRef.current.getSelection();
    if(!range||range.length===0){window.alert('Select some text first to attach a comment to.');return;}
    pendingCommentRange.current=range;
    commentComposerOpenRef.current=true;
    setCommentDraftText('');
    setShowCommentComposer(true);
  }

  function closeCommentComposer(){
    commentComposerOpenRef.current=false;
    setShowCommentComposer(false);
    setCommentDraftText('');
    pendingCommentRange.current=null;
    setCommentBtnPos(null);
  }

  function submitComment(){
    if(!quillRef.current||!commentDraftText.trim())return;
    var range=pendingCommentRange.current;
    if(!range||range.length===0){closeCommentComposer();return;}
    var commentId=genId();
    var anchorText=quillRef.current.getText(range.index,range.length);
    quillRef.current.formatText(range.index,range.length,'comment',commentId,'user');
    var html=quillRef.current.root.innerHTML;
    var wc=countWords(quillRef.current.getText());
    if(app&&app.updateDraft)app.updateDraft(pid,did,{body:html,wordCount:wc,updatedAt:new Date().toISOString()});
    var profile=(app&&app.profile)||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim()||'You';
    var commentText=commentDraftText.trim();
    saveComment(did,{id:commentId,versionId:lastVersionId.current,authorName:authorName,anchorText:anchorText.trim(),body:commentText}).then(function(row){
      if(row){
        activeCommentIdsRef.current=activeCommentIdsRef.current.concat([commentId]);
        setCommentsRefreshTick(function(t){return t+1;});
      }
    });
    closeCommentComposer();
  }

  function handleDismissComment(comment){
    if(quillRef.current){
      var nodes=quillRef.current.root.querySelectorAll('[data-comment-id="'+comment.id+'"]');
      nodes.forEach(function(n){n.classList.add('wv-comment-resolved');});
    }
    activeCommentIdsRef.current=activeCommentIdsRef.current.filter(function(id){return id!==comment.id;});
    return resolveComment(comment.id);
  }

  function handleReopenComment(comment){
    if(quillRef.current){
      var nodes=quillRef.current.root.querySelectorAll('[data-comment-id="'+comment.id+'"]');
      nodes.forEach(function(n){n.classList.remove('wv-comment-resolved');});
    }
    if(activeCommentIdsRef.current.indexOf(comment.id)<0)activeCommentIdsRef.current=activeCommentIdsRef.current.concat([comment.id]);
    return reopenComment(comment.id);
  }

  function handleCompareBranches(idA,idB){
    var all=(app&&app.allDrafts&&app.allDrafts[pid])||[];
    var a=all.find(function(d){return d.id===idA;});
    var b=all.find(function(d){return d.id===idB;});
    if(!a||!b)return;
    setCompareData({labelA:a.title||'Untitled',bodyA:a.body||'',labelB:b.title||'Untitled',bodyB:b.body||''});
  }

  function handleRestoreVersion(body){
    if(!quillRef.current)return;
    quillRef.current.setContents([]);
    quillRef.current.clipboard.dangerouslyPasteHTML(body);
    if(quillRef.current.history)quillRef.current.history.clear();
    var wc=countWords(quillRef.current.getText());
    setWordCount(wc);
    setSaveState('saving');
    if(app&&app.updateDraft)app.updateDraft(pid,did,{body:body,wordCount:wc,updatedAt:new Date().toISOString()});
    setSaveState('saved');
    setShowVersions(false);
  }


  function handleSwitchBranch(branchDraftId){
    // A strand is a real draft — navigate to it
    if(app&&app.openDraft)app.openDraft(branchDraftId);
  }
  function handleCreateBranch(name){
    // Create a real nested draft as a strand of the family root — always
    // the root, even if you're currently viewing a non-root strand, so
    // the sibling group stays flat rather than nesting a level deeper.
    if(!app||!pid||!did)return;
    var rootId=(branches&&branches.length&&branches[0].id)||did;
    var body=quillRef.current?quillRef.current.root.innerHTML:(draft.body||'');
    var now=new Date().toISOString();
    var newId=genId();
    var nb={
      id:newId,projectId:pid,title:name||title+'_Strand_2',
      synopsis:draft.synopsis||'',status:draft.status||'first_draft',
      order:draft.order,parentId:rootId,
      nestExpanded:true,body:body,wordCount:draft.wordCount||0,
      strandTags:draft.strandTags||[],
      customFields:draft.customFields||{},createdAt:now,updatedAt:now
    };
    if(app.addDraft)app.addDraft(pid,nb);
    // Update local branches list for the dropdown
    setBranches(function(p){return p.concat([{id:newId,name:name,isPrimary:false,draftTitle:title}]);});
    // Navigate to the new strand
    if(app.openDraft)app.openDraft(newId);
  }
  function handleSetPrimary(id){
    // Always promote against the true root, not whichever strand happens
    // to be open — otherwise starring a sibling while viewing a non-root
    // strand would swap against the wrong reference point.
    var rootId=(branches&&branches.length&&branches[0].id)||did;
    if(id===rootId)return; // already primary
    if(app&&app.promoteStrand)app.promoteStrand(pid,rootId,id);
    // Don't navigate — you stay on whatever strand you're currently
    // drafting; the branch list above refreshes itself in place once
    // app.allDrafts updates.
  }
  async function handleGenerateLink(){
    if(!app||!app.currentUser)return;
    var shareId=genId();
    var profile=app.profile||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim()||'Unknown';
    var projName=(app.currentProject&&app.currentProject.title)||'';
    var body=quillRef.current?quillRef.current.root.innerHTML:'';
    var client=window.supabase&&window.supabase.createClient?window.supabase.createClient(
      'https://mxsdiqrbxlvcwexfdtrj.supabase.co',
      'sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u'
    ):null;
    if(!client)return;
    var res=await client.from('shared_drafts').insert({id:shareId,title:title,body:body,project_name:projName,author_name:authorName});
    if(res.error){console.error('Share error:',res.error);return;}
    var link=window.location.origin+'/?share='+shareId;
    setShareLink(link);
    setShareId(shareId);
  }
  async function handleDepublish(){
    if(!shareId)return;
    var client=window.supabase&&window.supabase.createClient?window.supabase.createClient(
      'https://mxsdiqrbxlvcwexfdtrj.supabase.co',
      'sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u'
    ):null;
    if(client)await client.from('shared_drafts').delete().eq('id',shareId);
    setShareLink(null);
    setShareId(null);
  }
  function getExportDraft(){
    // Use live Quill content, not stale state
    var liveBody=quillRef.current?quillRef.current.root.innerHTML:(draft.body||'');
    var liveWc=quillRef.current?countWords(quillRef.current.getText()):draft.wordCount||0;
    return Object.assign({},draft,{body:liveBody,wordCount:liveWc,title:title});
  }
  function handleExportPDF(){
    if(!draft||!pid)return;
    var profile=app&&app.profile||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim();
    var project=app&&app.currentProject;
    var exportDraft=getExportDraft();
    if(window.doExport)window.doExport('PDF',[exportDraft],project,true,authorName);
  }
  function handleExportDocx(){
    if(!draft||!pid)return;
    var profile=app&&app.profile||{};
    var authorName=((profile.firstName||'')+' '+(profile.lastName||'')).trim();
    var project=app&&app.currentProject;
    var exportDraft=getExportDraft();
    if(window.doExport)window.doExport('Word (.docx)',[exportDraft],project,true,authorName);
  }

  var styleOpts=[{value:'',label:'Normal text'},{value:'1',label:'Heading 1'},{value:'2',label:'Heading 2'},{value:'3',label:'Heading 3'},{value:'quote',label:'Quote'}];
  var fontOpts=FONTS.map(function(f){return{value:f,label:FONT_LABELS[f]};});
  var zoomOpts=ZOOM_OPTS.map(function(z){return{value:String(z),label:z+'%'};});

  // cls: collapses at breakpoint — secondary@960px, tertiary@720px
  var fmtBtns=[
    {icon:'format_bold',title:'Bold',action:function(){toggleFmt('bold');}},
    {icon:'format_italic',title:'Italic',action:function(){toggleFmt('italic');}},
    {icon:'format_underlined',title:'Underline',action:function(){toggleFmt('underline');}},
    {icon:'strikethrough_s',title:'Strikethrough',action:function(){toggleFmt('strike');}},
    {sep:true},
    {icon:'title',title:'Heading 1',cls:'toolbar-secondary',action:function(){var r=quillRef.current&&quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('header',cur.header===1?false:1);}}},
    {icon:'format_h2',title:'Heading 2',cls:'toolbar-secondary',action:function(){var r=quillRef.current&&quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('header',cur.header===2?false:2);}}},
    {sep:true,sepClass:'toolbar-secondary'},
    {icon:'format_align_left',title:'Align left',cls:'toolbar-tertiary',action:function(){fmt('align','');}},
    {icon:'format_align_center',title:'Align center',cls:'toolbar-tertiary',action:function(){fmt('align','center');}},
    {icon:'format_align_right',title:'Align right',cls:'toolbar-tertiary',action:function(){fmt('align','right');}},
    {sep:true,sepClass:'toolbar-tertiary'},
    {icon:'format_indent_increase',title:'Indent',cls:'toolbar-tertiary',action:function(){if(quillRef.current){var r=quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('indent',(cur.indent||0)+1);}}}},
    {icon:'format_indent_decrease',title:'Outdent',cls:'toolbar-tertiary',action:function(){if(quillRef.current){var r=quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('indent',Math.max(0,(cur.indent||1)-1));}}}},
    {sep:true,sepClass:'toolbar-secondary'},
    {icon:'format_list_bulleted',title:'Bullets',cls:'toolbar-secondary',action:function(){fmt('list','bullet');}},
    {icon:'format_list_numbered',title:'Numbered',cls:'toolbar-secondary',action:function(){fmt('list','ordered');}},
    {sep:true,sepClass:'toolbar-tertiary'},
    {icon:'link',title:'Insert link',cls:'toolbar-tertiary',action:function(){var url=prompt('URL:');if(url&&quillRef.current){var r=quillRef.current.getSelection();if(r)quillRef.current.format('link',url);}}}
  ];

  function handleStyleChange(val){
    if(!quillRef.current)return;
    var r=quillRef.current.getSelection();
    if(!r)return;
    if(val==='quote'){quillRef.current.format('blockquote',true);quillRef.current.format('header',false);}
    else if(val===''){quillRef.current.format('header',false);quillRef.current.format('blockquote',false);}
    else{quillRef.current.format('header',parseInt(val));quillRef.current.format('blockquote',false);}
    setHeaderStyle(val);
  }

  // ── Flow mode minimal bar ──
  var FlowBar=(
<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 20px',background:'transparent',position:'relative',zIndex:10}}>
  <div style={{display:'flex',alignItems:'center',gap:10}}>
    <IconBtn icon="arrow_back" title="Back" onClick={function(){setFlowMode(false);if(app&&app.setView)app.setView('cards');if(app&&app.setDraftId)app.setDraftId(null);}} color={T.text}/>
    <span style={{fontFamily:'Crimson Text, serif',fontSize:18,fontWeight:600,color:T.text,opacity:.7}}>{title}</span>
  </div>
  <IOSToggle on={true} onChange={function(v){if(!v)setFlowMode(false);}} label="Flow"/>
</div>
  );

  // ── Editor body styles ──
  var editorBodyStyle={
    fontSize:fontSize+'px',
    fontFamily:font+', serif',
    lineHeight:'160%',
    color:T.bodyText,
    minHeight:'calc(100vh - 260px)',
    paddingBottom:20,
  };

  // ── Quill prose overrides (injected globally once) ──
  useEffect(function(){
    var id='woven-quill-overrides';
    if(document.getElementById(id))return;
    var style=document.createElement('style');
    style.id=id;
    style.textContent=`
      .ql-editor { padding: 0 !important; outline: none !important; } .ql-editor ::selection { background: rgba(196,94,40,.22); } ::selection { background: rgba(196,94,40,.22); }
      .ql-editor p { margin-bottom: 1.4em; margin-top: 0; }
      .ql-editor img { max-width: 100%; height: auto; border-radius: 6px; margin: 8px 0; display: block; }
      .ql-editor h1 { font-family: 'Crimson Text', serif; font-size: 2em; font-weight: 600; margin-bottom: 12px; color: #2a1f10; }
      .ql-editor h2 { font-family: 'Crimson Text', serif; font-size: 1.5em; font-weight: 600; margin-bottom: 10px; color: #2a1f10; }
      .ql-editor h3 { font-family: 'Crimson Text', serif; font-size: 1.2em; font-weight: 600; margin-bottom: 8px; color: #2a1f10; }
      .ql-editor blockquote { border-left: 3px solid #A88060; padding: 4px 0 4px 16px; margin: 0 0 15px 0; color: #7A5A38; font-style: italic; }
      .ql-editor ol, .ql-editor ul { padding-left: 1.5em; margin-bottom: 15px; font-size: inherit; font-weight: 400; } .ql-editor li { line-height: 130%; margin-bottom: 6px; font-weight: 400; }
      .ql-editor a { color: #c45e28; }
      .ql-container { border: none !important; }
      .ql-editor.ql-blank::before { color: #b8a090; font-style: italic; font-family: 'Crimson Text', serif; }
      .ql-bubble .ql-toolbar { border-radius: 8px; background: #2a1f10; }
      .ql-container::-webkit-scrollbar { width: 6px; }
      .editor-scroll-area { padding-right: 56px; }
      ::-webkit-scrollbar { width: 5px; }
      ::-webkit-scrollbar-track { background: transparent; margin-top: 8px; margin-bottom: 8px; margin-right: 8px; }
      ::-webkit-scrollbar-thumb { background: #D4B896; border-radius: 10px; }
      ::-webkit-scrollbar-thumb:hover { background: #A88060; }
      .ql-bubble .ql-stroke { stroke: #fdf8f0; }

      /* ── Mobile responsive ── */
      @media (max-width: 960px) {
        .wc-full { display: none !important; }
        .wc-short { display: inline !important; }
        .font-select { display: none !important; }
        .toolbar-secondary { display: none !important; }
      }
      @media (max-width: 720px) {
        .font-select { display: none !important; }
        .toolbar-secondary { display: none !important; }
        .toolbar-tertiary { display: none !important; }
        .nav-drawers { display: none !important; }
        .nav-collapse { display: flex !important; }
      }
      .toolbar-mid-row { scrollbar-width: none; -ms-overflow-style: none; }
      .toolbar-mid-row::-webkit-scrollbar { display: none; }
      .ql-bubble .ql-fill { fill: #fdf8f0; }
      .wv-comment-mark { background: rgba(196,94,40,.16); border-bottom: 2px solid rgba(196,94,40,.55); cursor: pointer; }
      .wv-comment-mark.wv-comment-resolved { background: transparent; border-bottom: none; cursor: default; }
      .wv-flow-active .wv-comment-mark { background: transparent; border-bottom: none; }
    `;
    document.head.appendChild(style);
  },[]);

  return(
<div style={{display:'flex',flexDirection:'column',height:'100vh',background:T.bodyBg,overflow:'hidden'}}>

  <input ref={fileInputRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleImageFile}/>

  {/* ── Nav (slides up in flow mode; always full width, never covered by a drawer) ── */}
  <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:T.navBg,padding:'10px 20px',gap:10,borderBottom:'1px solid rgba(42,31,16,.1)',flexShrink:0,transform:flowMode?'translateY(-110%)':'translateY(0)',transition:'transform .3s cubic-bezier(.4,0,.2,1)',pointerEvents:flowMode?'none':'auto',position:flowMode?'absolute':'relative',width:'100%',zIndex:20}}>
    <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
      <IconBtn icon="arrow_back" title="Back to sequence" onClick={function(){if(app&&app.setView)app.setView('cards');if(app&&app.setDraftId)app.setDraftId(null);}} style={{flexShrink:0}}/>
      <EditableTitle value={title} onChange={function(v){setTitle(v);if(app&&app.updateDraft)app.updateDraft(pid,did,{title:v});}}/>
      <span className="wc-label" data-short={wordCount.toLocaleString()+'w'} style={{fontSize:11,color:T.text,whiteSpace:'nowrap',flexShrink:0,fontFamily:'DM Sans, sans-serif',opacity:.6}}>
        <span className="wc-full">{wordCount.toLocaleString()} words</span>
        <span className="wc-short" style={{display:'none'}}>{wordCount.toLocaleString()}w</span>
      </span>
    </div>
    <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
      <div className="nav-drawers" style={{display:'flex',alignItems:'center',gap:10}}>
        <BranchDropdown branches={branches} activeBranchId={activeBranchId} onSwitch={handleSwitchBranch} onCreate={handleCreateBranch} onSetPrimary={handleSetPrimary} onCompareTwo={handleCompareBranches}/>
        <IconBtn icon="history" title="Version history" onClick={function(){setShowVersions(!showVersions);setShowComments(false);setShowProperties(false);setShowSpool(false);}} active={showVersions}/>
        <IconBtn icon="comment" title="Comments" onClick={function(){setShowComments(!showComments);setShowVersions(false);setShowProperties(false);setShowSpool(false);}} active={showComments}/>
        <IconBtn icon="settings" title="Properties" onClick={function(){setShowProperties(!showProperties);setShowVersions(false);setShowComments(false);setShowSpool(false);}} active={showProperties}/>
        <IconBtn icon="gesture" title="Spools" onClick={function(){setShowSpool(!showSpool);setShowVersions(false);setShowComments(false);setShowProperties(false);if(showSpool)setStrandDetailId(null);}} active={showSpool}/>
      </div>
      {/* Mobile collapsed menu */}
      <NavCollapseMenu branches={branches} activeBranchId={activeBranchId} onSwitch={handleSwitchBranch} onCreate={handleCreateBranch} onSetPrimary={handleSetPrimary} onVersions={function(){setShowVersions(!showVersions);}} onComments={function(){setShowComments(!showComments);}} onProperties={function(){setShowProperties(!showProperties);}} onSpool={function(){setShowSpool(!showSpool);}}/>
      <ShareDropdown onExportPDF={handleExportPDF} onExportDocx={handleExportDocx} shareLink={shareLink} onGenerateLink={handleGenerateLink} onDepublish={handleDepublish}/>
    </div>
  </nav>

  {/* ── Flow mode minimal bar (slides down when flow active) ── */}
  <div style={{position:'absolute',top:0,left:0,right:0,zIndex:30,transform:flowMode?'translateY(0)':'translateY(-100%)',transition:'transform .3s cubic-bezier(.4,0,.2,1)',pointerEvents:flowMode?'auto':'none'}}>
    {FlowBar}
  </div>

  {/* ── Main area: editor column (toolbar + scroll area) + drawers, side by side below nav ── */}
  <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:flowMode?'48px':'0',transition:'margin-top .3s'}}>

    {/* Editor column — this whole column (including its toolbar) squeezes when a drawer opens */}
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden',minWidth:0}}>

      {/* Format toolbar — collapses via max-height in flow mode (stays in normal
          flex flow rather than being removed via position:absolute, so it
          doesn't cause its own layout reflow independent of nav's) */}
      <div style={{flexShrink:0,maxHeight:flowMode?0:200,overflow:'hidden',transition:'max-height .3s cubic-bezier(.4,0,.2,1)',pointerEvents:flowMode?'none':'auto'}}>
        <div style={{display:'flex',alignItems:'center',padding:'6px 20px',background:T.toolBg,borderBottom:'1px solid '+T.stroke,gap:4,minWidth:0}}>
          {/* Left: style, font, size */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginRight:12}}>
            <StyledSelect value={activeFormat} onChange={handleStyleChange} options={styleOpts} style={{minWidth:110}}/>
            <select value={font} onChange={function(e){setFont(e.target.value);}} className="font-select" style={{padding:'4px 8px',background:T.toolBg,border:'1px solid '+T.stroke,borderRadius:6,fontSize:13,color:T.text,cursor:'pointer',outline:'none',minWidth:130,fontFamily:font+', sans-serif'}}>
              {FONTS.map(function(f){return(<option key={f} value={f} style={{fontFamily:f+', sans-serif'}}>{f}</option>);})}
            </select>
          </div>
          {/* Middle: format buttons */}
          <div style={{display:'flex',alignItems:'center',gap:0,flex:1,justifyContent:'center',minWidth:0,overflowX:'auto',overflowY:'hidden'}} className="toolbar-mid-row">
            {fmtBtns.map(function(b,i){
              if(b.sep)return(<div key={'s'+i} className={b.sepClass||''} style={{width:1,height:20,background:T.stroke,margin:'0 4px',flexShrink:0}}/>);
              var cls=b.cls||'';
              return(
<button key={b.icon} onClick={b.action} title={b.title} className={cls} style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,minWidth:32,flexShrink:0,background:'transparent',border:'none',borderRadius:6,cursor:'pointer',color:T.text,transition:'background .12s'}}
  onMouseOver={function(e){e.currentTarget.style.background='rgba(42,31,16,.08)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <span className="mi" style={{fontSize:18}}>{b.icon}</span>
</button>
              );
            })}
            <div style={{width:1,height:20,background:T.stroke,margin:'0 4px',flexShrink:0}}/>
            <ColorPickerBtn icon="format_color_text" title="Text colour" colors={TEXT_COLORS} onPick={function(c){fmt('color',c);}} onClear={function(){fmt('color',false);}}/>
            <ColorPickerBtn icon="ink_highlighter" title="Highlight" colors={HIGHLIGHT_COLORS} onPick={function(c){fmt('background',c);}} onClear={function(){fmt('background',false);}}/>
            <button onClick={function(){fileInputRef.current&&fileInputRef.current.click();}} title="Add image" style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,minWidth:32,background:'transparent',border:'none',borderRadius:6,cursor:'pointer',color:T.text,flexShrink:0}}
              onMouseOver={function(e){e.currentTarget.style.background='rgba(42,31,16,.08)';}}
              onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
              <span className="mi" style={{fontSize:18}}>add_photo_alternate</span>
            </button>
          </div>
          {/* Right: zoom + flow */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:'auto'}}>
            <StyledSelect value={String(zoom)} onChange={function(v){setZoom(parseInt(v));}} options={zoomOpts} style={{minWidth:70}}/>
            <IOSToggle on={false} onChange={function(v){if(v)setFlowMode(true);}} label="Flow"/>
          </div>
        </div>
      </div>

      {/* Version preview banner */}
      {previewVersion&&(
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,padding:'8px 20px',background:'#7A5A38',color:'#fdf8f0',flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',gap:8,fontSize:12,fontFamily:'DM Sans, sans-serif',minWidth:0}}>
            <span className="mi" style={{fontSize:16}}>visibility</span>
            <span style={{fontWeight:600}}>{previewVersion.label}</span>
            <span style={{opacity:.75}}>· {previewVersion.timeLabel} · {previewVersion.wordCount||0}w</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            <button onClick={function(){
              if(window.confirm('Restore this version? Your current text will be replaced.')){
                previewVersion.onRestore&&previewVersion.onRestore();
                setPreviewVersion(null);
              }
            }} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:6,border:'1px solid rgba(253,248,240,.4)',background:'transparent',color:'#fdf8f0',fontSize:12,cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>
              <span className="mi" style={{fontSize:14}}>restore</span>Restore this version
            </button>
            <button onClick={function(){setPreviewVersion(null);}} style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:6,border:'none',background:'rgba(253,248,240,.15)',color:'#fdf8f0',fontSize:12,cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>
              <span className="mi" style={{fontSize:14}}>close</span>Back to editing
            </button>
          </div>
        </div>
      )}

      {/* Editor scroll area */}
      <div style={{flex:1,overflowY:'scroll',WebkitOverflowScrolling:'touch',paddingTop:48,paddingBottom:20,paddingLeft:40,paddingRight:56,background:T.bodyBg}} className="editor-scroll-area">
        <div style={{maxWidth:maxWidth+'px',margin:'0 auto',transition:'max-width .2s',position:'relative'}}>
          <div ref={editorContainerRef} className={flowMode?'wv-flow-active':''} style={Object.assign({},editorBodyStyle,previewVersion?{display:'none'}:{})}/>
          {previewVersion&&(
            <div
              style={Object.assign({},editorBodyStyle,{pointerEvents:'none',userSelect:'none',opacity:.85})}
              dangerouslySetInnerHTML={{__html:previewVersion.body}}
            />
          )}
          {commentBtnPos&&!previewVersion&&(
            <button
              ref={commentBtnRef}
              onMouseDown={function(e){e.preventDefault();handleAddComment();}}
              style={{
                position:'absolute',top:commentBtnPos.top-34,left:commentBtnPos.left,transform:'translateX(-50%)',
                display:'flex',alignItems:'center',gap:4,padding:'4px 10px',borderRadius:6,border:'none',
                background:'#7A5A38',color:'#fdf8f0',fontSize:11,fontFamily:'DM Sans, sans-serif',cursor:'pointer',
                zIndex:30,whiteSpace:'nowrap'
              }}
            >
              <span className="mi" style={{fontSize:13}}>add_comment</span>Comment
            </button>
          )}
          {/* Flow mode: bubble-style floating format toolbar on text selection.
              Positioned above the comment button using the same selection bounds
              — this is a purpose-built bubble UI rather than Quill's own bubble
              theme, so it works without re-initializing the Quill instance. */}
          {commentBtnPos&&!previewVersion&&flowMode&&(
            <div
              onMouseDown={function(e){e.preventDefault();}}
              style={{
                position:'absolute',top:commentBtnPos.top-74,left:commentBtnPos.left,transform:'translateX(-50%)',
                display:'flex',alignItems:'center',gap:2,padding:'4px 6px',borderRadius:8,
                background:'#2a1f10',boxShadow:'0 6px 20px rgba(42,31,16,.3)',zIndex:31,whiteSpace:'nowrap'
              }}
            >
              <BubbleIcon icon="format_bold" title="Bold" onClick={function(){toggleFmt('bold');}}/>
              <BubbleIcon icon="format_italic" title="Italic" onClick={function(){toggleFmt('italic');}}/>
              <BubbleIcon icon="format_underlined" title="Underline" onClick={function(){toggleFmt('underline');}}/>
              <BubbleIcon icon="strikethrough_s" title="Strikethrough" onClick={function(){toggleFmt('strike');}}/>
              <div style={{width:1,height:18,background:'rgba(253,248,240,.25)',margin:'0 2px'}}/>
              <BubbleIcon icon="title" title="Heading 1" onClick={function(){var r=quillRef.current&&quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('header',cur.header===1?false:1);}}}/>
              <BubbleIcon icon="format_h2" title="Heading 2" onClick={function(){var r=quillRef.current&&quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('header',cur.header===2?false:2);}}}/>
              <BubbleIcon icon="format_quote" title="Quote" onClick={function(){var r=quillRef.current&&quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('blockquote',!cur.blockquote);}}}/>
              <div style={{width:1,height:18,background:'rgba(253,248,240,.25)',margin:'0 2px'}}/>
              <ColorPickerBtn icon="format_color_text" title="Text colour" colors={TEXT_COLORS} dark onPick={function(c){fmt('color',c);}} onClear={function(){fmt('color',false);}}/>
              <ColorPickerBtn icon="ink_highlighter" title="Highlight" colors={HIGHLIGHT_COLORS} dark onPick={function(c){fmt('background',c);}} onClear={function(){fmt('background',false);}}/>
              <BubbleIcon icon="link" title="Insert link" onClick={function(){var url=prompt('URL:');if(url&&quillRef.current){var r=quillRef.current.getSelection();if(r)quillRef.current.format('link',url);}}}/>
            </div>
          )}
          <Popover
            anchorRef={commentBtnRef}
            open={showCommentComposer}
            onClose={closeCommentComposer}
            title="Add comment"
            width={260}
            footer={
              <div style={{display:'flex',gap:8,justifyContent:'flex-end',width:'100%'}}>
                <button className="btn btn-ghost" onClick={closeCommentComposer}>Cancel</button>
                <button className="btn btn-primary" disabled={!commentDraftText.trim()} onClick={submitComment}>
                  <span className="mi" style={{fontSize:16}}>add_comment</span>Add
                </button>
              </div>
            }
          >
            <Field
              value={commentDraftText}
              onChange={function(e){setCommentDraftText(e.target.value);}}
              placeholder="Write a comment…"
              autoFocus
              onKeyDown={function(e){
                if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitComment();}
                if(e.key==='Escape'){closeCommentComposer();}
              }}
            />
          </Popover>
        </div>
      </div>
    </div>

    {/* Drawers */}
    {!flowMode&&showProperties&&(
      <PropertiesDrawer app={app} draft={draft} variant="inline" onClose={function(){setShowProperties(false);}} onOpenStrand={function(sid){setShowProperties(false);setShowSpool(true);setStrandDetailId(sid);}}/>
    )}
    {!flowMode&&showSpool&&(
      <StrandsDrawer app={app} draft={draft} variant="inline" strandId={strandDetailId} onOpenStrand={setStrandDetailId} onClose={function(){setShowSpool(false);setStrandDetailId(null);}}/>
    )}
    {!flowMode&&showVersions&&(
      <VersionsDrawer draftId={did} variant="inline" onClose={function(){setShowVersions(false);}} onRestore={handleRestoreVersion} onSaveVersion={handleManualSnapshot} onCompare={setCompareData} onPreview={setPreviewVersion} onExitPreview={function(){setPreviewVersion(null);}}/>
    )}
    {!flowMode&&showComments&&(
      <CommentsDrawer draftId={did} variant="inline" focusCommentId={focusCommentId} refreshTick={commentsRefreshTick} onDismiss={handleDismissComment} onReopen={handleReopenComment} onClose={function(){setShowComments(false);setFocusCommentId(null);}}/>
    )}
  </div>
  <CompareView
    open={!!compareData}
    labelA={compareData&&compareData.labelA}
    bodyA={compareData&&compareData.bodyA}
    labelB={compareData&&compareData.labelB}
    bodyB={compareData&&compareData.bodyB}
    onClose={function(){setCompareData(null);}}
  />

</div>
  );
}

export default DraftEditor;
