import React, { useState, useEffect, useRef, useCallback } from 'react';
// ── DraftEditor.jsx ──
// Quill-based draft editor.
// Requires in index.html:
//   <link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.snow.css" rel="stylesheet"/>
//   <link href="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.bubble.css" rel="stylesheet"/>
//   <script src="https://cdn.jsdelivr.net/npm/quill@2/dist/quill.js"></script>
// Google Fonts (add to index.html):
//   <link href="https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=DM+Sans:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,600;1,400&family=Merriweather:ital,wght@0,300;0,400;1,300&family=EB+Garamond:ital,wght@0,400;1,400&family=Libre+Baskerville:ital@0;1&display=swap" rel="stylesheet"/>


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

var FONTS=['Crimson Text','DM Sans','Lora','Merriweather','EB Garamond','Libre Baskerville'];
var FONT_LABELS={'Crimson Text':'Crimson Text','DM Sans':'DM Sans','Lora':'Lora','Merriweather':'Merriweather','EB Garamond':'EB Garamond','Libre Baskerville':'Baskerville'};
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
  useEffect(function(){setVal(value);},[value]);
  useEffect(function(){if(editing&&ref.current)ref.current.focus();},[editing]);
  function commit(){setEditing(false);if(val.trim()&&val.trim()!==value)onChange(val.trim());else setVal(value);}
  if(editing)return(<input ref={ref} value={val} onChange={function(e){setVal(e.target.value);}} onBlur={commit} onKeyDown={function(e){if(e.key==='Enter')commit();if(e.key==='Escape'){setVal(value);setEditing(false);}}} style={{fontFamily:'Crimson Text, serif',fontSize:20,fontWeight:600,color:color||T.textDark,background:'transparent',border:'none',borderBottom:'2px solid '+T.amber,outline:'none',padding:'0 2px',minWidth:80,maxWidth:320}}/>);
  return(<span onClick={function(){setEditing(true);}} title="Click to edit" style={{fontFamily:'Crimson Text, serif',fontSize:20,fontWeight:600,color:color||T.textDark,cursor:'text',padding:'0 2px',borderBottom:'2px solid transparent',transition:'border-color .15s',whiteSpace:'nowrap',maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',display:'inline-block'}}>{val||'Untitled draft'}</span>);
}

// ── Icon Button ──
function IconBtn({icon,title,onClick,active,color}){
  return(
<button onClick={onClick} title={title} style={{display:'flex',alignItems:'center',justifyContent:'center',padding:10,background:active?'rgba(196,94,40,.12)':'transparent',border:'none',borderRadius:8,cursor:'pointer',color:color||(active?T.amber:T.text),transition:'background .15s,color .15s',flexShrink:0}}
  onMouseOver={function(e){if(!active){e.currentTarget.style.background='rgba(42,31,16,.06)';}}}
  onMouseOut={function(e){if(!active){e.currentTarget.style.background='transparent';}}}>
  <span className="material-symbols-outlined" style={{fontSize:22}}>{icon}</span>
</button>);
}

// ── Select dropdown styled ──
function StyledSelect({value,onChange,options,style}){
  return(
<select value={value} onChange={function(e){onChange(e.target.value);}} style={Object.assign({padding:'4px 8px',background:T.toolBg,border:'1px solid '+T.stroke,borderRadius:6,fontSize:13,color:T.text,fontFamily:'DM Sans, sans-serif',cursor:'pointer',outline:'none'},style||{})}>
  {options.map(function(o){return(<option key={o.value} value={o.value}>{o.label}</option>);})}
</select>);
}

// ── Branch Dropdown ──
function BranchDropdown({branches,activeBranchId,onSwitch,onCreate,onSetPrimary}){
  var so=useState(false);var open=so[0];var setOpen=so[1];
  var sc=useState(false);var creating=sc[0];var setCreating=sc[1];
  var sn=useState('');var newName=sn[0];var setNewName=sn[1];
  var ref=useRef(null);
  useEffect(function(){if(!open)return;function onDown(e){if(ref.current&&!ref.current.contains(e.target))setOpen(false);}document.addEventListener('mousedown',onDown);return function(){document.removeEventListener('mousedown',onDown);};},[open]);
  var hasBranches=branches&&branches.length>1;
  var activeBranch=branches&&branches.find(function(b){return b.id===activeBranchId;})||branches&&branches[0];
  var btnLabel=hasBranches?(branches.length+' branches'):'Create branch';
  function handleCreate(){setCreating(true);var num=branches?branches.length+1:2;var draft=activeBranch&&activeBranch.draftTitle||'Draft';setNewName(draft+'_Branch '+num);}
  function confirmCreate(){if(newName.trim())onCreate(newName.trim());setCreating(false);setNewName('');setOpen(false);}
  var sorted=branches?[].concat(branches.filter(function(b){return b.id===activeBranchId;}),branches.filter(function(b){return b.id!==activeBranchId;})):[];
  return(
<div ref={ref} style={{position:'relative'}}>
  <button onClick={function(){if(!hasBranches){handleCreate();setOpen(true);}else setOpen(!open);}} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 10px',background:'transparent',border:'1px solid '+T.border,borderRadius:6,cursor:'pointer',fontSize:13,color:hasBranches?T.text:'#b8a090',fontFamily:'DM Sans, sans-serif',flexShrink:0}}>
    <span className="material-symbols-outlined" style={{fontSize:16}}>{hasBranches?'account_tree':'add'}</span>
    {btnLabel}
    {hasBranches&&<span className="material-symbols-outlined" style={{fontSize:14,transform:open?'rotate(180deg)':'rotate(0)',transition:'transform .15s'}}>expand_more</span>}
  </button>
  {open&&(
<div style={{position:'absolute',top:'calc(100% + 6px)',left:0,zIndex:600,background:T.toolBg,border:'1px solid '+T.border,borderRadius:10,boxShadow:'0 8px 28px rgba(42,31,16,.14)',minWidth:220,overflow:'hidden'}}>
  {creating?(
<div style={{padding:'10px 12px'}}>
  <div style={{fontSize:11,color:T.text,fontWeight:600,marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em',fontFamily:'DM Sans, sans-serif'}}>Branch name</div>
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
  <span style={{flex:1,fontSize:13,fontWeight:isActive?600:400,color:isActive?T.amber:T.textDark,fontFamily:'Crimson Text, serif'}}>{b.name}</span>
  <button onClick={function(e){e.stopPropagation();onSetPrimary(b.id);}} style={{background:'none',border:'none',cursor:'pointer',padding:2,display:'flex',alignItems:'center',color:b.isPrimary?T.amber:T.border,transition:'color .15s'}}
    onMouseOver={function(e){e.currentTarget.style.color=T.amber;}}
    onMouseOut={function(e){e.currentTarget.style.color=b.isPrimary?T.amber:T.border;}}>
    <span className="material-symbols-outlined" style={{fontSize:18,fontVariationSettings:b.isPrimary?"'FILL' 1":"'FILL' 0"}}>star</span>
  </button>
</div>
  );})}
  <div style={{padding:'8px 14px',borderTop:'1px solid '+T.border}}>
    <button onClick={handleCreate} style={{width:'100%',padding:'7px 0',background:'transparent',border:'1px dashed '+T.border,borderRadius:6,fontSize:12,color:T.text,cursor:'pointer',fontFamily:'DM Sans, sans-serif',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
      <span className="material-symbols-outlined" style={{fontSize:14}}>add</span>New branch
    </button>
  </div>
</div>
  )}
</div>
  )}
</div>);
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
  <button onClick={function(){setOpen(!open);}} style={{display:'flex',alignItems:'center',gap:6,padding:'7px 14px',background:T.primary,color:T.white,border:'none',borderRadius:7,cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'DM Sans, sans-serif'}}
    onMouseOver={function(e){e.currentTarget.style.opacity='.88';}}
    onMouseOut={function(e){e.currentTarget.style.opacity='1';}}>
    Share<span className="material-symbols-outlined" style={{fontSize:15,transform:open?'rotate(180deg)':'rotate(0)',transition:'transform .15s'}}>expand_more</span>
  </button>
  {open&&(
<div style={{position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:600,background:T.toolBg,border:'1px solid '+T.border,borderRadius:10,boxShadow:'0 8px 28px rgba(42,31,16,.14)',minWidth:280,overflow:'hidden'}}>
  {[{icon:'picture_as_pdf',label:'Export as PDF',sub:'Downloads immediately',action:function(){onExportPDF();setOpen(false);}},{icon:'description',label:'Export as Word Doc',sub:'Downloads immediately',action:function(){onExportDocx();setOpen(false);}}].map(function(item){return(
<button key={item.icon} onClick={item.action} style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:'transparent',border:'none',borderBottom:'1px solid '+T.border,cursor:'pointer',textAlign:'left',fontFamily:'DM Sans, sans-serif'}}
  onMouseOver={function(e){e.currentTarget.style.background='rgba(42,31,16,.04)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <span className="material-symbols-outlined" style={{fontSize:20,color:T.text}}>{item.icon}</span>
  <div><div style={{fontSize:13,fontWeight:600,color:T.textDark}}>{item.label}</div><div style={{fontSize:11,color:T.text}}>{item.sub}</div></div>
</button>
  );})}
  <div style={{padding:'12px 16px'}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:shareLink?10:0}}>
      <span className="material-symbols-outlined" style={{fontSize:20,color:T.text}}>link</span>
      <div style={{flex:1}}>
        <div style={{fontSize:13,fontWeight:600,color:T.textDark}}>Read-only link</div>
        <div style={{fontSize:11,color:T.text}}>{shareLink?'Live — anyone with the link can read':'Generate a shareable web link'}</div>
      </div>
      {!shareLink&&<button onClick={handleGenerate} disabled={loading} style={{padding:'6px 12px',background:T.primary,color:T.white,border:'none',borderRadius:6,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'DM Sans, sans-serif',opacity:loading?.6:1}}>{loading?'Generating…':'Generate'}</button>}
    </div>
    {shareLink&&(
<div>
  <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 10px',background:T.bg1,borderRadius:7,marginBottom:10,border:'1px solid '+T.border}}>
    <span style={{flex:1,fontSize:11,color:T.text,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{shareLink}</span>
    <button onClick={handleCopy} style={{flexShrink:0,padding:'3px 8px',background:T.bg2,border:'none',borderRadius:5,fontSize:11,cursor:'pointer',color:T.textDark,fontFamily:'DM Sans, sans-serif',display:'flex',alignItems:'center',gap:4}}>
      <span className="material-symbols-outlined" style={{fontSize:13}}>{copied?'check':'content_copy'}</span>{copied?'Copied':'Copy'}
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

// ── Main DraftEditor ──
function DraftEditor({app}){
  var pid=app&&app.projId;
  var did=app&&app.currentDraftId;
  var draft=(app&&app.allDrafts&&app.allDrafts[pid]&&app.allDrafts[pid].find(function(d){return d.id===did;}))||{};

  var st=useState(draft.title||'Untitled draft');var title=st[0];var setTitle=st[1];
  var sw=useState(draft.wordCount||0);var wordCount=sw[0];var setWordCount=sw[1];
  var ss=useState('saved');var saveState=ss[0];var setSaveState=ss[1];
  var sb=useState([{id:'main',name:'Main',isPrimary:true,draftTitle:draft.title||'Untitled draft'}]);var branches=sb[0];var setBranches=sb[1];
  var sab=useState('main');var activeBranchId=sab[0];var setActiveBranchId=sab[1];
  var slink=useState(null);var shareLink=slink[0];var setShareLink=slink[1];
  var spv=useState(false);var showVersions=spv[0];var setShowVersions=spv[1];
  var spp=useState(false);var showProperties=spp[0];var setShowProperties=spp[1];
  var sps=useState(false);var showSpool=sps[0];var setShowSpool=sps[1];
  var sf=useState(false);var flowMode=sf[0];var setFlowMode=sf[1];
  var szoom=useState(100);var zoom=szoom[0];var setZoom=szoom[1];
  var sfont=useState('Crimson Text');var font=sfont[0];var setFont=sfont[1];
  var sheader=useState('');var headerStyle=sheader[0];var setHeaderStyle=sheader[1];

  var quillRef=useRef(null);
  var editorContainerRef=useRef(null);
  var saveTimer=useRef(null);
  var initialised=useRef(false);

  // Derived font size from zoom
  var baseFontSize=DEFAULT_FONT_SIZE;
  var fontSize=Math.round(baseFontSize*(zoom/100));
  // Max width scales with zoom — 900px at 100%, grows proportionally
  var maxWidth=Math.round(900*(zoom/100));

  // ── Init Quill ──
  useEffect(function(){
    if(initialised.current)return;
    if(!editorContainerRef.current||!window.Quill)return;
    var q=new window.Quill(editorContainerRef.current,{
      theme:'snow',
      modules:{toolbar:false},
      placeholder:'Start writing…',
    });
    if(draft.body)q.clipboard.dangerouslyPasteHTML(draft.body);
    q.on('text-change',function(){
      var txt=q.getText();
      var wc=countWords(txt);
      setWordCount(wc);
      setSaveState('saving');
      if(saveTimer.current)clearTimeout(saveTimer.current);
      saveTimer.current=setTimeout(function(){
        var html=q.root.innerHTML;
        if(app&&app.updateDraft)app.updateDraft(pid,did,{body:html,wordCount:wc,updatedAt:new Date().toISOString()});
        setSaveState('saved');
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

  function handleSwitchBranch(id){setActiveBranchId(id);}
  function handleCreateBranch(name){var nb={id:genId(),name:name,isPrimary:false,draftTitle:title};setBranches(function(p){return p.concat([nb]);});setActiveBranchId(nb.id);}
  function handleSetPrimary(id){setBranches(function(p){return p.map(function(b){return Object.assign({},b,{isPrimary:b.id===id});});});}
  async function handleGenerateLink(){var link=window.location.origin+'/?share='+genId();setShareLink(link);}
  function handleDepublish(){setShareLink(null);}
  function handleExportPDF(){if(app&&app.exportDraftPDF)app.exportDraftPDF(did);}
  function handleExportDocx(){if(app&&app.exportDraftDocx)app.exportDraftDocx(did);}

  var styleOpts=[{value:'',label:'Normal text'},{value:'1',label:'Heading 1'},{value:'2',label:'Heading 2'},{value:'3',label:'Heading 3'},{value:'quote',label:'Quote'}];
  var fontOpts=FONTS.map(function(f){return{value:f,label:FONT_LABELS[f]};});
  var zoomOpts=ZOOM_OPTS.map(function(z){return{value:String(z),label:z+'%'};});

  var fmtBtns=[
    {icon:'format_bold',title:'Bold',action:function(){toggleFmt('bold');}},
    {icon:'format_italic',title:'Italic',action:function(){toggleFmt('italic');}},
    {icon:'format_underlined',title:'Underline',action:function(){toggleFmt('underline');}},
    {icon:'highlight',title:'Highlight',action:function(){toggleFmt('background');}},
    {sep:true},
    {icon:'format_align_left',title:'Align left',action:function(){fmt('align','');}},
    {icon:'format_align_center',title:'Align center',action:function(){fmt('align','center');}},
    {icon:'format_align_right',title:'Align right',action:function(){fmt('align','right');}},
    {sep:true},
    {icon:'format_indent_increase',title:'Indent',action:function(){if(quillRef.current){var r=quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('indent',(cur.indent||0)+1);}}}},
    {icon:'format_indent_decrease',title:'Outdent',action:function(){if(quillRef.current){var r=quillRef.current.getSelection();if(r){var cur=quillRef.current.getFormat(r);quillRef.current.format('indent',Math.max(0,(cur.indent||1)-1));}}}},
    {sep:true},
    {icon:'format_list_bulleted',title:'Bullet list',action:function(){fmt('list','bullet');}},
    {icon:'format_list_numbered',title:'Numbered list',action:function(){fmt('list','ordered');}},
    {sep:true},
    {icon:'link',title:'Insert link',action:function(){var url=prompt('URL:');if(url&&quillRef.current){var r=quillRef.current.getSelection();if(r)quillRef.current.format('link',url);}}}
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
    <IconBtn icon="arrow_back" title="Back" onClick={function(){setFlowMode(false);if(app&&app.setView)app.setView('cards');if(app&&app.setDraftId)app.setDraftId(null);}} color="rgba(42,31,16,.4)"/>
    <span style={{fontFamily:'Crimson Text, serif',fontSize:18,fontWeight:600,color:'rgba(42,31,16,.4)'}}>{title}</span>
  </div>
  <IOSToggle on={true} onChange={function(v){if(!v)setFlowMode(false);}} label="Flow"/>
</div>
  );

  // ── Editor body styles ──
  var editorBodyStyle={
    fontSize:fontSize+'px',
    fontFamily:font+', serif',
    lineHeight:'130%',
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
      .ql-editor { padding: 0 !important; outline: none !important; }
      .ql-editor p { margin-bottom: 15px; margin-top: 0; }
      .ql-editor h1 { font-family: 'Crimson Text', serif; font-size: 2em; font-weight: 600; margin-bottom: 12px; color: #2a1f10; }
      .ql-editor h2 { font-family: 'Crimson Text', serif; font-size: 1.5em; font-weight: 600; margin-bottom: 10px; color: #2a1f10; }
      .ql-editor h3 { font-family: 'Crimson Text', serif; font-size: 1.2em; font-weight: 600; margin-bottom: 8px; color: #2a1f10; }
      .ql-editor blockquote { border-left: 3px solid #A88060; padding: 4px 0 4px 16px; margin: 0 0 15px 0; color: #7A5A38; font-style: italic; }
      .ql-editor ol, .ql-editor ul { padding-left: 1.5em; margin-bottom: 15px; }
      .ql-editor a { color: #c45e28; }
      .ql-container { border: none !important; }
      .ql-editor.ql-blank::before { color: #b8a090; font-style: italic; font-family: 'Crimson Text', serif; }
      .ql-bubble .ql-toolbar { border-radius: 8px; background: #2a1f10; }
      .ql-bubble .ql-stroke { stroke: #fdf8f0; }
      .ql-bubble .ql-fill { fill: #fdf8f0; }
    `;
    document.head.appendChild(style);
  },[]);

  return(
<div style={{display:'flex',flexDirection:'column',height:'100vh',background:T.bodyBg,overflow:'hidden'}}>

  {/* ── Top nav + toolbar (slide up in flow mode) ── */}
  <div style={{flexShrink:0,transform:flowMode?'translateY(-110%)':'translateY(0)',transition:'transform .3s cubic-bezier(.4,0,.2,1)',pointerEvents:flowMode?'none':'auto',position:flowMode?'absolute':'relative',width:'100%',zIndex:20}}>

    {/* Nav */}
    <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:T.navBg,padding:'10px 20px',gap:10,borderBottom:'1px solid rgba(42,31,16,.1)'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
        <IconBtn icon="arrow_back" title="Back to sequence" onClick={function(){if(app&&app.setView)app.setView('cards');if(app&&app.setDraftId)app.setDraftId(null);}}/>
        <EditableTitle value={title} onChange={function(v){setTitle(v);if(app&&app.updateDraft)app.updateDraft(pid,did,{title:v});}}/>
        <span style={{fontSize:14,color:T.text,whiteSpace:'nowrap',flexShrink:0,fontFamily:'DM Sans, sans-serif'}}>{wordCount} words</span>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <BranchDropdown branches={branches} activeBranchId={activeBranchId} onSwitch={handleSwitchBranch} onCreate={handleCreateBranch} onSetPrimary={handleSetPrimary}/>
        <IconBtn icon="history" title="Version history" onClick={function(){setShowVersions(!showVersions);setShowProperties(false);setShowSpool(false);}} active={showVersions}/>
        <IconBtn icon="settings" title="Properties" onClick={function(){setShowProperties(!showProperties);setShowVersions(false);setShowSpool(false);}} active={showProperties}/>
        <IconBtn icon="gesture" title="Spools" onClick={function(){setShowSpool(!showSpool);setShowVersions(false);setShowProperties(false);}} active={showSpool}/>
        <div style={{display:'flex',alignItems:'center',gap:5,opacity:.7}}>
          <div style={{width:6,height:6,borderRadius:'50%',background:saveState==='saving'?T.amber:saveState==='error'?'#b83220':'#2f9966',transition:'background .3s'}}/>
          <span style={{fontSize:11,color:T.text,fontFamily:'DM Sans, sans-serif'}}>{saveState==='saving'?'Saving…':'Saved'}</span>
        </div>
        <ShareDropdown onExportPDF={handleExportPDF} onExportDocx={handleExportDocx} shareLink={shareLink} onGenerateLink={handleGenerateLink} onDepublish={handleDepublish}/>
      </div>
    </nav>

    {/* Format toolbar */}
    <div style={{display:'flex',alignItems:'center',padding:'6px 20px',background:T.toolBg,borderBottom:'1px solid '+T.stroke,gap:4}}>
      {/* Left: style, font, size */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginRight:12}}>
        <StyledSelect value={headerStyle} onChange={handleStyleChange} options={styleOpts} style={{minWidth:110}}/>
        <StyledSelect value={font} onChange={function(v){setFont(v);}} options={fontOpts} style={{minWidth:120,fontFamily:font+', serif'}}/>
      </div>
      <div style={{width:1,height:20,background:T.stroke,flexShrink:0}}/>

      {/* Middle: format buttons */}
      <div style={{display:'flex',alignItems:'center',gap:0,flex:1,justifyContent:'center'}}>
        {fmtBtns.map(function(b,i){
          if(b.sep)return(<div key={'s'+i} style={{width:1,height:20,background:T.stroke,margin:'0 4px',flexShrink:0}}/>);
          return(
<button key={b.icon} onClick={b.action} title={b.title} style={{display:'flex',alignItems:'center',justifyContent:'center',width:32,height:32,background:'transparent',border:'none',borderRadius:6,cursor:'pointer',color:T.text,transition:'background .12s'}}
  onMouseOver={function(e){e.currentTarget.style.background='rgba(42,31,16,.08)';}}
  onMouseOut={function(e){e.currentTarget.style.background='transparent';}}>
  <span className="material-symbols-outlined" style={{fontSize:18}}>{b.icon}</span>
</button>
          );
        })}
      </div>
      <div style={{width:1,height:20,background:T.stroke,flexShrink:0}}/>

      {/* Right: zoom + flow */}
      <div style={{display:'flex',alignItems:'center',gap:8,marginLeft:12}}>
        <StyledSelect value={String(zoom)} onChange={function(v){setZoom(parseInt(v));}} options={zoomOpts} style={{minWidth:70}}/>
        <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',border:'1px solid '+T.stroke,borderRadius:6,cursor:'pointer'}} onClick={function(){setFlowMode(true);}}>
          <span className="material-symbols-outlined" style={{fontSize:16,color:T.text}}>self_improvement</span>
          <span style={{fontSize:13,color:T.text,fontFamily:'DM Sans, sans-serif'}}>Flow</span>
        </div>
      </div>
    </div>
  </div>

  {/* ── Flow mode minimal bar (slides down when flow active) ── */}
  <div style={{position:'absolute',top:0,left:0,right:0,zIndex:30,transform:flowMode?'translateY(0)':'translateY(-100%)',transition:'transform .3s cubic-bezier(.4,0,.2,1)',pointerEvents:flowMode?'auto':'none'}}>
    {FlowBar}
  </div>

  {/* ── Main area ── */}
  <div style={{display:'flex',flex:1,overflow:'hidden',marginTop:flowMode?'48px':'0',transition:'margin-top .3s'}}>

    {/* Editor scroll area */}
    <div style={{flex:1,overflowY:'scroll',WebkitOverflowScrolling:'touch',padding:'48px 40px 20px',background:T.bodyBg}}>
      <div style={{maxWidth:maxWidth+'px',margin:'0 auto',transition:'max-width .2s'}}>
        <div ref={editorContainerRef} style={editorBodyStyle}/>
      </div>
    </div>

    {/* Drawer placeholder */}
    {!flowMode&&(showVersions||showProperties||showSpool)&&(
<div style={{width:320,borderLeft:'1px solid '+T.border,background:T.bg1,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,overflowY:'auto'}}>
  <span className="material-symbols-outlined" style={{fontSize:36,color:T.border}}>{showVersions?'history':showProperties?'settings':'gesture'}</span>
  <span style={{fontSize:13,color:T.text,fontFamily:'DM Sans, sans-serif'}}>{showVersions?'Versions':showProperties?'Properties':'Spools'} drawer</span>
  <span style={{fontSize:11,color:T.border,fontFamily:'DM Sans, sans-serif'}}>Separate component — coming next</span>
</div>
    )}
  </div>

</div>
  );
}

export default DraftEditor;
