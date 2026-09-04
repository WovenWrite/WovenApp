// @ts-nocheck
// ── FeedbackButton ──
// A small persistent "Give feedback" FAB, bottom-left — same visual
// language as AddMenuFab's bottom-right FAB, but a fixed single action
// (opens the survey modal) rather than an expanding menu.
//
// Rendered once at the App root (alongside ProfileDrawer) so it's
// available from every view, not per-page.
//
//   <FeedbackButton app={app}/>
//
// ── Supabase setup — run once in the SQL editor before this goes live ──
//
// create table if not exists feedback_responses (
//   id uuid primary key default gen_random_uuid(),
//   user_id uuid references auth.users(id),
//   rating int2 not null,
//   uses text[],
//   missing_feature text,
//   additional_comments text,
//   created_at timestamptz not null default now()
// );
//
// alter table feedback_responses enable row level security;
//
// create policy "Users can submit their own feedback"
//   on feedback_responses for insert
//   to authenticated
//   with check (auth.uid() = user_id);
//
// -- No select policy for regular users on purpose — read responses from
// -- the Supabase dashboard/SQL editor (bypasses RLS as project owner).
// -- Add a select policy later only if you want an in-app "your past
// -- feedback" view.

import { useState } from 'react';
import { supabase } from './utils';
import { PrimaryButton, Field, Check } from './SharedUI';

var RATING_LABELS = { 1: 'Not great', 2: '', 3: 'Okay', 4: '', 5: 'Love it' };
var USE_OPTIONS = ['Writing', 'Research', 'Planning / outlining', 'Organizing ideas or notes', 'Creative work', 'Academic work'];

function StarRating({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(function (n) {
        var filled = value >= n;
        return (
          <button key={n} type="button" onClick={function () { onChange(n); }} title={RATING_LABELS[n] || ('Rate ' + n)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 1 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 30, fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0", color: filled ? '#C45E28' : 'var(--border)' }}>star</span>
          </button>
        );
      })}
    </div>
  );
}

export default function FeedbackButton({ app }) {
  var so = useState(false); var open = so[0]; var setOpen = so[1];
  var ssub = useState(false); var submitted = ssub[0]; var setSubmitted = ssub[1];
  var sr = useState(0); var rating = sr[0]; var setRating = sr[1];
  var su = useState([]); var uses = su[0]; var setUses = su[1];
  var suo = useState(''); var usesOther = suo[0]; var setUsesOther = suo[1];
  var smf = useState(''); var missingFeature = smf[0]; var setMissingFeature = smf[1];
  var sac = useState(''); var additionalComments = sac[0]; var setAdditionalComments = sac[1];
  var ssend = useState(false); var sending = ssend[0]; var setSending = ssend[1];
  var serr = useState(''); var errMsg = serr[0]; var setErrMsg = serr[1];

  function toggleUse(opt) {
    setUses(function (prev) {
      return prev.includes(opt) ? prev.filter(function (o) { return o !== opt; }) : prev.concat([opt]);
    });
  }

  function reset() {
    setRating(0); setUses([]); setUsesOther(''); setMissingFeature(''); setAdditionalComments(''); setSubmitted(false); setErrMsg('');
  }
  function close() { setOpen(false); setTimeout(reset, 300); }

  function submit() {
    if (!rating || sending) return;
    setSending(true); setErrMsg('');
    var usesFinal = uses.slice();
    if (usesOther.trim()) usesFinal.push('Other: ' + usesOther.trim());
    supabase.from('feedback_responses').insert({
      user_id: (app.currentUser && app.currentUser.id) || null,
      rating: rating,
      uses: usesFinal,
      missing_feature: missingFeature.trim() || null,
      additional_comments: additionalComments.trim() || null,
    }).then(function (res) {
      setSending(false);
      if (!res.error) { setSubmitted(true); }
      else { console.error('Feedback submit error:', res.error); setErrMsg('Something went wrong sending that — mind trying again?'); }
    });
  }

  // Mirrors AddMenuFab's own view-based offset so the two FABs (and the
  // Loose Threads bar in Cards view) don't collide.
  var fabBottom = (app.view === 'cards' || app.view === 'dashboard') ? 90 : 28;

  return (
    <>
      <button onClick={function () { setOpen(true); }} title="Give feedback"
        style={{ position: 'fixed', bottom: fabBottom, left: 28, zIndex: 400, width: 48, height: 48, borderRadius: '50%', background: 'var(--bg1)', border: '1px solid var(--border)', boxShadow: '0 4px 14px rgba(42,31,16,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B4A26', transition: 'background .15s' }}
        onMouseEnter={function (e) { e.currentTarget.style.background = 'var(--bg2)'; }}
        onMouseLeave={function (e) { e.currentTarget.style.background = 'var(--bg1)'; }}>
        <span className="material-symbols-outlined" style={{ fontSize: 22 }}>chat</span>
      </button>

      {open && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={close} />
          <div className="modal-box" style={{ width: 420, maxHeight: '85vh', overflowY: 'auto' }}>
            {submitted ? (
              <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 44, color: '#2f9966', display: 'block', marginBottom: 10 }}>check_circle</span>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Thank you!</div>
                <div style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 20 }}>Your feedback helps shape where Woven goes next.</div>
                <PrimaryButton onClick={close} style={{ width: '100%', justifyContent: 'center' }}>Close</PrimaryButton>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600 }}>How's Woven going?</div>
                  <button className="btn-icon" onClick={close}><span className="mi">close</span></button>
                </div>
                <div style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 20 }}>A few quick questions — takes under a minute.</div>

                <div style={{ marginBottom: 20 }}>
                  <span className="wv-field-lbl">1. How would you rate your experience with Woven so far?</span>
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <StarRating value={rating} onChange={setRating} />
                    {rating > 0 && <span style={{ fontSize: 13, color: 'var(--mid)' }}>{RATING_LABELS[rating]}</span>}
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <span className="wv-field-lbl">2. What are you using Woven for?</span>
                  <div style={{ fontSize: 12, color: 'var(--mid)', marginBottom: 8 }}>Select all that apply.</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {USE_OPTIONS.map(function (opt) {
                      return (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }} onClick={function () { toggleUse(opt); }}>
                          <Check on={uses.includes(opt)} /> {opt}
                        </label>
                      );
                    })}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, flexShrink: 0 }} onClick={function () { setUsesOther(function (v) { return v ? '' : ' '; }); }}>
                        <Check on={!!usesOther} /> Other:
                      </label>
                      <input className="wv-field-box" value={usesOther.trim()} onChange={function (e) { setUsesOther(e.target.value); }} placeholder="Tell us" style={{ flex: 1, fontSize: 14 }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <Field
                    label="3. Is there anything you'd like to do in Woven but currently can't?"
                    value={missingFeature}
                    onChange={function (e) { setMissingFeature(e.target.value); }}
                    placeholder="Anything you expected to be able to do, or something that would make Woven more useful to you."
                    resizeMode="manual"
                    rows={3}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <Field
                    label="4. Anything else you'd like to tell us?"
                    value={additionalComments}
                    onChange={function (e) { setAdditionalComments(e.target.value); }}
                    placeholder="Optional"
                    resizeMode="manual"
                    rows={3}
                  />
                </div>

                {errMsg && <div style={{ fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>{errMsg}</div>}

                <PrimaryButton onClick={submit} disabled={!rating || sending} style={{ width: '100%', justifyContent: 'center' }}>
                  {sending ? 'Sending...' : 'Send feedback'}
                </PrimaryButton>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
