// @ts-nocheck
import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import WovenLogo from "../components/WovenLogo";
import AuthStyles from "./authStyles";
import promoTexture from "../assets/auth/promo-texture.png";
import promoCollage from "../assets/auth/promo-collage.png";

// ── AuthScreen ──
// Two-column layout: 720px form column (left) + flexible promo column (right,
// hidden under 750px). Same component renders both sign-up and sign-in copy,
// switched via local `mode` state, matching the old AuthScreen's contract:
// - reads/writes auth via the shared `supabase` wrapper (signUp,
//   signInWithPassword, resetPasswordForEmail)
// - calls onAuth(user) on successful sign-in
function AuthScreen({onAuth}){
  var se=useState('');var email=se[0];var setEmail=se[1];
  var sp=useState('');var password=sp[0];var setPassword=sp[1];
  var sfn=useState('');var firstName=sfn[0];var setFirstName=sfn[1];
  var sl=useState(false);var loading=sl[0];var setLoading=sl[1];
  var sm=useState('');var msg=sm[0];var setMsg=sm[1];
  var smode=useState('signin');var mode=smode[0];var setMode=smode[1];
  var ssv=useState(false);var showPw=ssv[0];var setShowPw=ssv[1];

  async function handleSubmit(){
    if(!email.trim()||!password.trim()){setMsg('Please enter email and password.');return;}
    setLoading(true);setMsg('');
    var res;
    if(mode==='signup'){
      res=await supabase.auth.signUp({email:email.trim(),password:password,options:{data:{first_name:firstName.trim()}}});
      if(!res.error){setMsg('Account created! Check your email to confirm, then sign in.');}
      else if(res.error.message&&(res.error.message.toLowerCase().includes('already')||res.error.message.toLowerCase().includes('registered')||res.error.message.toLowerCase().includes('exist'))){setMsg('An account with this email already exists. Try signing in instead.');}
    } else {
      res=await supabase.auth.signInWithPassword({email:email.trim(),password:password});
      if(!res.error&&res.data.user)onAuth(res.data.user);
    }
    if(res.error)setMsg(res.error.message);
    setLoading(false);
  }

  async function handleReset(){
    if(!email.trim()){setMsg('Enter your email above first.');return;}
    setLoading(true);
    var res=await supabase.auth.resetPasswordForEmail(email.trim());
    setMsg(res.error?res.error.message:'Password reset email sent!');
    setLoading(false);
  }

  var isSignup=mode==='signup';
  var msgClass=msg&&(msg.includes('sent')||msg.includes('created'))?'ok':'err';

  return(
<div className="authpage-wrap">
  <AuthStyles/>

  {/* ── Left: form ── */}
  <div className="authpage-form-col">
    <div className="authpage-form-wrap">

      <div className="authpage-heading">
        <h1 className="authpage-h1">{isSignup?'Stop Switching & Stitching Your Story':'Welcome Back'}</h1>
        <p className="authpage-body">{isSignup?"Start with Woven's forever free Lite plan today.":'Time to get weaving.'}</p>
      </div>

      <div className="authpage-form">
        {isSignup&&(
          <div className="authpage-field-group">
            <label className="authpage-field-label">First Name</label>
            <div className="authpage-field-wrap">
              <input className="authpage-field" value={firstName} onChange={function(e){setFirstName(e.target.value);}} placeholder="Enter your first name" onKeyDown={function(e){if(e.key==='Enter')handleSubmit();}}/>
            </div>
          </div>
        )}

        <div className="authpage-field-group">
          <label className="authpage-field-label">Email</label>
          <div className="authpage-field-wrap">
            <input className="authpage-field" type="email" value={email} onChange={function(e){setEmail(e.target.value);}} placeholder="Enter your email" onKeyDown={function(e){if(e.key==='Enter')handleSubmit();}}/>
          </div>
        </div>

        <div className="authpage-field-group">
          <label className="authpage-field-label">Password</label>
          <div className="authpage-field-wrap">
            <input className="authpage-field" type={showPw?'text':'password'} value={password} onChange={function(e){setPassword(e.target.value);}} placeholder={isSignup?'Create a password':'Enter password'} onKeyDown={function(e){if(e.key==='Enter')handleSubmit();}} style={{paddingRight:40}}/>
            <button type="button" className="authpage-pw-toggle" onClick={function(){setShowPw(!showPw);}}>
              <span className="mi" style={{fontSize:18}}>{showPw?'visibility_off':'visibility'}</span>
            </button>
          </div>
          {isSignup&&<span className="authpage-help">Must be at least 8 characters.</span>}
          {!isSignup&&<span className="authpage-help authpage-link" style={{display:'inline-block',marginTop:6}} onClick={handleReset}>Forgot password?</span>}
        </div>

        {msg&&<div className={'authpage-msg '+msgClass}>{msg}</div>}

        <button type="button" className="authpage-btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading?'Please wait...':(isSignup?'Create account':'Log In')}
        </button>

        <div className="authpage-secondary">
          {isSignup?(
            <span>Already have an account? <span className="authpage-link" onClick={function(){setMode('signin');setMsg('');}}>Log in</span></span>
          ):(
            <span>Don't have an account? <span className="authpage-link" onClick={function(){setMode('signup');setMsg('');}}>Create one for free now!</span></span>
          )}
        </div>
      </div>

    </div>
  </div>

  {/* ── Right: promo ── */}
  <div className="authpage-promo-col" style={{backgroundImage:'url('+promoTexture+')'}}>
    <div className="authpage-promo-logo"><WovenLogo size={30} color="#FDF8F0"/></div>
    <div className="authpage-promo-content">
      <img className="authpage-promo-collage" src={promoCollage} alt="Woven workspace showing a manuscript, arc view, and collaborator avatars"/>
      <h2 className="authpage-promo-headline">Organize your context, content and collaboration together.</h2>
    </div>
  </div>
</div>
  );
}

export default AuthScreen;
