import React, { useState, useEffect, useRef, useCallback } from 'react';
// ── SharedDraftView.jsx ──
// Read-only published draft page.
// Rendered when ?share=ID is in the URL.
// Requires the same Google Fonts and Supabase CDN as the main app.


var T={
  bg:'#FDF8F0',
  footerBg:'#F5EDE0',
  text:'#7A5A38',
  bodyText:'#4A3520',
  textDark:'#2a1f10',
  amber:'#c45e28',
  stroke:'#A88060',
  border:'#E2D0B8',
  mid:'#7A5A38',
};

// ── Woven symbol (simplified geometric mark) ──
function WovenSymbol(){
  return(
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="4" y="3" width="2.5" height="18" rx="1" fill="#c45e28"/>
  <rect x="17.5" y="3" width="2.5" height="18" rx="1" fill="#c45e28"/>
  <rect x="0" y="8" width="8.5" height="2" rx="1" fill="#c45e28"/>
  <rect x="0" y="14" width="8.5" height="2" rx="1" fill="#c45e28"/>
  <rect x="15.5" y="8" width="8.5" height="2" rx="1" fill="#c45e28"/>
  <rect x="15.5" y="14" width="8.5" height="2" rx="1" fill="#c45e28"/>
  <path d="M9 4 L12 8 L15 4" stroke="#c45e28" strokeWidth="2" fill="none" strokeLinecap="round"/>
  <path d="M9 20 L12 16 L15 20" stroke="#c45e28" strokeWidth="2" fill="none" strokeLinecap="round"/>
</svg>
  );
}

// ── Woven wordmark (text only, same height as footer text) ──
function WovenWordmark(){
  return(
<span style={{fontFamily:'Crimson Text, serif',fontSize:16,fontWeight:600,color:T.amber,letterSpacing:'.01em'}}>Woven</span>
  );
}

// ── Main SharedDraftView ──
function SharedDraftView({shareId}){
  var sd=useState(null);var data=sd[0];var setData=sd[1];
  var se=useState(true);var loading=se[0];var setLoading=se[1];
  var serr=useState(null);var error=serr[0];var setError=serr[1];

  // Set browser tab title
  useEffect(function(){
    if(data&&data.title){
      document.title=data.title+' — Woven';
    }
    return function(){document.title='Woven';};
  },[data]);

  // Load shared draft from Supabase
  useEffect(function(){
    if(!shareId)return;
    var client=window.supabase&&window.supabase.createClient?window.supabase.createClient(
      'https://mxsdiqrbxlvcwexfdtrj.supabase.co',
      'sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u'
    ):null;
    if(!client){setError('Unable to load.');setLoading(false);return;}
    client.from('shared_drafts').select('*').eq('id',shareId).single().then(function(res){
      if(res.error||!res.data){setError('This link is no longer active.');setLoading(false);return;}
      setData(res.data);
      setLoading(false);
    });
  },[shareId]);

  // ── Loading ──
  if(loading)return(
<div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:14}}>
  <div style={{width:28,height:28,borderRadius:'50%',border:'3px solid '+T.border,borderTopColor:T.amber,animation:'spin .8s linear infinite'}}/>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:T.text}}>Loading…</span>
  <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
</div>
  );

  // ── Error ──
  if(error||!data)return(
<div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
  <span style={{fontFamily:'Crimson Text, serif',fontSize:24,color:T.textDark}}>This link is no longer active</span>
  <span style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:T.text}}>{error||'The author may have unpublished this draft.'}</span>
  <a href="https://www.wovenwrite.com" style={{fontFamily:'DM Sans, sans-serif',fontSize:14,color:T.amber,marginTop:8}}>Learn about Woven →</a>
</div>
  );

  var projectName=data.project_name||'';
  var authorName=data.author_name||'the author';
  var year=new Date().getFullYear();

  return(
<div style={{minHeight:'100vh',background:T.bg,display:'flex',flexDirection:'column',overflowY:'scroll',paddingRight:16}}>

  {/* Selection colour */}
  <style>{`
    ::selection { background: rgba(196,94,40,.25); color: inherit; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .ro-body p { margin-bottom: 20px; margin-top: 0; line-height: 178%; }
    .ro-body h1, .ro-body h2, .ro-body h3 { margin-bottom: 12px; margin-top: 28px; line-height: 130%; }
    .ro-body blockquote { border-left: 3px solid #A88060; padding: 4px 0 4px 20px; margin: 20px 0; color: #7A5A38; font-style: italic; }
    .ro-body ul, .ro-body ol { margin-bottom: 20px; padding-left: 1.6em; }
    .ro-body li { margin-bottom: 8px; line-height: 170%; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: transparent; margin-right: 8px; }
    ::-webkit-scrollbar-thumb { background: #E2D0B8; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #A88060; }
  `}</style>

  {/* ── Content area ── */}
  <div style={{flex:1,padding:'50px 40px'}}>
    <div style={{maxWidth:900,margin:'0 auto'}}>

      {/* Section 1: Written & Shared with Woven */}
      <div style={{paddingBottom:40,marginBottom:0,borderBottom:'1px solid '+T.stroke,textAlign:'center'}}>
        <span style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:T.text,letterSpacing:'.01em',textTransform:'uppercase',fontWeight:400}}>
          WRITTEN &amp; SHARED WITH{' '}
          <a href="https://www.wovenwrite.com" target="_blank" rel="noopener noreferrer" style={{color:T.amber,textDecoration:'none',fontWeight:600}} onMouseOver={function(e){e.currentTarget.style.textDecoration='underline';}} onMouseOut={function(e){e.currentTarget.style.textDecoration='none';}}>WOVEN</a>
        </span>
      </div>

      {/* Section 2: Header */}
      <div style={{marginBottom:0,paddingTop:30,paddingBottom:30,borderBottom:'1px solid '+T.stroke}}>
        {/* Project name */}
        {projectName&&(
<div style={{fontFamily:'DM Sans, sans-serif',fontSize:18,color:T.text,letterSpacing:'.11em',fontWeight:400,marginBottom:15,textTransform:'uppercase'}}>
  {projectName}
</div>
        )}
        {/* Draft title */}
        <h1 style={{fontFamily:'Crimson Text, serif',fontSize:56,fontWeight:600,color:T.bodyText,margin:'0 0 15px 0',lineHeight:1.1}}>
          {data.title||'Untitled'}
        </h1>
        {/* By author */}
        <div style={{fontFamily:'Crimson Text, serif',fontSize:32,fontWeight:600,fontStyle:'italic',color:T.amber,margin:0}}>
          By {authorName}
        </div>
      </div>

      {/* Section 3: Body */}
      <div style={{paddingTop:30,paddingBottom:50}}>
        <div
          className="ro-body" style={{fontFamily:'Crimson Text, serif',fontSize:21,lineHeight:'178%',color:T.bodyText,letterSpacing:'.01em'}}
          dangerouslySetInnerHTML={{__html:data.body||''}}
        />
      </div>

    </div>
  </div>

  {/* ── Footer ── */}
  <footer style={{background:T.footerBg,borderTop:'1px solid '+T.border,padding:'16px 40px'}}>
    <div style={{maxWidth:900,margin:'0 auto',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
      {/* Left: Woven logo */}
      <div style={{display:'flex',alignItems:'center',gap:6}}><WovenSymbol/><WovenWordmark/></div>
      {/* Middle: copyright */}
      <span style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:T.text}}>
        © {year} {authorName}
      </span>
      {/* Right: CTA */}
      <a href={window.location.origin+'?signup=true'} style={{fontFamily:'DM Sans, sans-serif',fontSize:16,color:T.text,textDecoration:'none'}}
        onMouseOver={function(e){e.currentTarget.style.color=T.amber;}}
        onMouseOut={function(e){e.currentTarget.style.color=T.text;}}>
        Start for free →
      </a>
    </div>
  </footer>

</div>
  );
}

export default SharedDraftView;
