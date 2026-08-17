// ── Auth page styles ──
// Scoped under .authpage-* so this never collides with the rest of the app's
// CSS. Injected the same way GlobalStyles injects CSS in App.jsx: a <style>
// tag with dangerouslySetInnerHTML. Assumes the app-wide --serif / --ui font
// vars (Crimson Text / DM Sans) are already loaded by GlobalStyles — if
// AuthScreen is ever rendered standalone (outside the main app shell), keep
// the @import line below active; otherwise it's a harmless duplicate.
var AUTH_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Crimson+Text:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

.authpage-wrap{display:flex;min-height:100vh;width:100%;background:#FDF8F0;overflow:hidden;}

/* ── Left: form column ── */
.authpage-form-col{width:720px;flex-shrink:0;background:#FDF8F0;display:flex;align-items:center;justify-content:center;padding:40px 24px;}
.authpage-form-wrap{width:360px;max-width:100%;display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:32px;}

.authpage-heading{display:flex;flex-direction:column;gap:12px;width:100%;}
.authpage-h1{font-family:'Crimson Text',Georgia,serif;font-weight:600;font-size:36px;line-height:1.15;color:#2A1F10;margin:0;}
.authpage-body{font-family:'DM Sans',system-ui,sans-serif;font-weight:400;font-size:20px;line-height:24px;color:#7A5A38;margin:0;}

.authpage-form{display:flex;flex-direction:column;width:100%;}
.authpage-field-group{padding:20px 0;}
.authpage-field-group:first-child{padding-top:0;}
.authpage-field-group:last-child{padding-bottom:0;}
.authpage-field-label{display:block;font-family:'Crimson Text',Georgia,serif;font-weight:600;font-size:18px;line-height:20px;color:#7A5A38;margin-bottom:6px;}
.authpage-field-wrap{position:relative;}
.authpage-field{width:100%;padding:10px 14px;border-radius:8px;background:#FFFCF8;border:1px solid #E2D0B8;font-family:'DM Sans',system-ui,sans-serif;font-size:16px;color:#7A5A38;transition:border-color .15s;}
.authpage-field::placeholder{color:#A88060;}
.authpage-field:focus{outline:none;border-color:#DF6321;}
.authpage-help{display:block;font-family:'DM Sans',system-ui,sans-serif;font-size:14px;color:#A88060;margin-top:6px;}
.authpage-msg{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;padding:10px 12px;border-radius:8px;background:#F5EDE0;margin-top:4px;}
.authpage-msg.ok{color:#2f9966;}
.authpage-msg.err{color:#b83220;}

.authpage-btn-primary{width:100%;border:none;border-radius:8px;padding:14px 20px;background:#DF6321;color:#FFFCF8;font-family:'DM Sans',system-ui,sans-serif;font-weight:600;font-size:16px;display:flex;align-items:center;justify-content:center;text-align:center;cursor:pointer;transition:background .15s;margin-top:8px;}
.authpage-btn-primary:hover{background:#2A1F10;}
.authpage-btn-primary:disabled{opacity:.6;cursor:default;}

.authpage-secondary{font-family:'DM Sans',system-ui,sans-serif;font-size:14px;color:#A88060;margin-top:16px;}
.authpage-link{font-weight:600;color:#DF6321;text-decoration:underline;cursor:pointer;}

.authpage-pw-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:#A88060;padding:0;display:flex;align-items:center;}

/* ── Right: promo column ── */
.authpage-promo-col{flex:1;position:relative;overflow:hidden;background-color:#DF6321;background-size:cover;background-position:center;}
.authpage-promo-logo{position:absolute;top:40px;right:40px;z-index:2;}
.authpage-promo-content{position:absolute;left:56px;bottom:56px;right:56px;display:flex;flex-direction:column;align-items:flex-start;gap:28px;z-index:2;}
.authpage-promo-collage{max-width:480px;width:100%;height:auto;display:block;filter:drop-shadow(0 20px 50px rgba(42,31,16,.35));}
.authpage-promo-headline{font-family:'Crimson Text',Georgia,serif;font-weight:600;font-size:44px;line-height:1.15;color:#FDF8F0;margin:0;max-width:520px;}

@media(max-width:750px){
  .authpage-form-col{width:100%;padding:32px 24px;}
  .authpage-promo-col{display:none;}
}
`;

function AuthStyles(){ return <style dangerouslySetInnerHTML={{__html:AUTH_CSS}}/>; }

export default AuthStyles;
