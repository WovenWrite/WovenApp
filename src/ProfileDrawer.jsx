// @ts-nocheck
// ── ProfileDrawer ──
// Extracted from App.jsx's old ProfilePanel (which used the legacy Panel
// shell). Migrated to the new Drawer/Field/Button system where it maps
// cleanly — Photo, Name, Email, Daily writing goal, and Sign out.
//
// NOT yet migrated — these don't map to Field or the Primary/Secondary/
// Tertiary button system and are waiting on their own spec:
//   - Editor mode (segmented two-option toggle)
//   - Writing reminders (on/off switch + time-chip grid)
//   - Plan (disabled pricing-tier cards)
// Left on their original markup/classes for now.
//
//   <ProfileDrawer app={app} focusField={profileFocus} open={showProfile} onClose={...} />

import { useState, useEffect, useRef } from 'react';
import { Drawer, Field, HelpText, SecondaryButton } from './SharedUI';
import { initials, uploadImage } from './utils';

export default function ProfileDrawer({ app, focusField, open, onClose, topOffset }) {
  var profile = app.profile || {};
  var sf = useState(profile.firstName || ''); var firstName = sf[0]; var setFirstName = sf[1];
  var sl = useState(profile.lastName || ''); var lastName = sl[0]; var setLastName = sl[1];
  var authEmail = (app.currentUser && app.currentUser.email) || profile.email || '';
  var se = useState(authEmail); var email = se[0]; var setEmail = se[1];
  var sh = useState(profile.headshot || null); var headshot = sh[0]; var setHeadshot = sh[1];
  // Sync headshot when profile updates (e.g. after login loads fresh data)
  useEffect(function () { setHeadshot(profile.headshot || null); }, [profile.headshot]);

  var sg = useState(app.goal || 500); var goalVal = sg[0]; var setGoalVal = sg[1];
  var goalRef = useRef(null);
  useEffect(function () {
    if (open && focusField === 'goal' && goalRef.current) {
      setTimeout(function () { goalRef.current && goalRef.current.focus(); }, 200);
    }
  }, [open, focusField]);

  var sem = useState(profile.editorMode || 'rt'); var editorMode = sem[0]; var setEditorMode = sem[1];
  var srm = useState(profile.reminderEnabled || false); var reminderEnabled = srm[0]; var setReminderEnabled = srm[1];
  var srt = useState(profile.reminderTime || '9:00 PM'); var reminderTime = srt[0]; var setReminderTime = srt[1];
  var reminderRef = useRef(null);
  useEffect(function () {
    if (open && focusField === 'reminder' && reminderRef.current) {
      setTimeout(function () { reminderRef.current && reminderRef.current.scrollIntoView({ behavior: 'smooth' }); }, 200);
    }
  }, [open, focusField]);

  function autoSave(overrides) {
    var updated = Object.assign({
      firstName: firstName, lastName: lastName, email: email, plan: profile.plan || 'Free',
      editorMode: editorMode, reminderEnabled: reminderEnabled, reminderTime: reminderTime,
      headshot: headshot
    }, overrides);
    app.setProfile(updated);
  }

  function handlePhoto(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { alert('Please use an image under 3 MB.'); return; }
    uploadImage(file).then(function (url) { if (url) { setHeadshot(url); autoSave({ headshot: url }); } });
  }

  var footer = (
    <SecondaryButton icon="logout" onClick={function () { app.signOut(); }}>
      Sign out
    </SecondaryButton>
  );

  return (
    <Drawer variant="overlay" open={open} onClose={onClose} title="Your Profile" footer={footer} topOffset={topOffset}>

      <div>
        <span className="sect-lbl">Profile photo</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--indigo)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--border)' }}>
            {headshot
              ? <img src={headshot} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: '#fff' }}>{initials((firstName || '') + ' ' + (lastName || ''))}</span>}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ cursor: 'pointer' }}>
              <span className="btn btn-ghost btn-sm">{headshot ? 'Change photo' : 'Upload photo'}</span>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
            {headshot && (
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={function () { setHeadshot(null); autoSave({ headshot: null }); }}>
                Remove
              </button>
            )}
          </div>
        </div>
      </div>

      <Field
        label="First name"
        value={firstName}
        onChange={function (e) { setFirstName(e.target.value); }}
        onBlur={function (e) { autoSave({ firstName: e.target.value }); }}
        placeholder="First name"
      />

      <Field
        label="Last name"
        value={lastName}
        onChange={function (e) { setLastName(e.target.value); }}
        onBlur={function (e) { autoSave({ lastName: e.target.value }); }}
        placeholder="Last name"
      />

      <Field
        label="Email"
        value={email}
        onChange={function (e) { setEmail(e.target.value); }}
        onBlur={function (e) { autoSave({ email: e.target.value }); }}
        placeholder="your@email.com"
      />

      <div>
        <Field
          label="Daily writing goal"
          innerRef={goalRef}
          value={goalVal}
          onChange={function (e) {
            var v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) setGoalVal(v);
          }}
          onBlur={function (e) {
            var v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v > 0) app.setGoal(v);
          }}
        />
        <HelpText style={{ marginTop: 4 }}>Words per day</HelpText>
      </div>

      {/* ── Not yet migrated — awaiting spec for segmented controls, toggles, and chips ── */}

      <div>
        <span className="sect-lbl">Editor mode</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {[['rt', 'Rich Text'], ['md', 'Markdown']].map(function (pair) {
            return (
              <button key={pair[0]} className={'btn ' + (editorMode === pair[0] ? 'btn-primary' : 'btn-ghost')} style={{ flex: 1, justifyContent: 'center' }} onClick={function () { setEditorMode(pair[0]); autoSave({ editorMode: pair[0] }); }}>
                {pair[1]}
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 6 }}>Applies to all drafts.</div>
      </div>

      <div ref={reminderRef}>
        <span className="sect-lbl">Writing reminders</span>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text)' }}>Send me a quick nudge if I haven't written yet!</span>
          <span style={{ width: 36, height: 20, borderRadius: 10, background: reminderEnabled ? 'var(--indigo)' : 'var(--bg3)', cursor: 'pointer', position: 'relative', transition: 'all .2s', flexShrink: 0, display: 'inline-block' }} onClick={function () { var nv = !reminderEnabled; setReminderEnabled(nv); autoSave({ reminderEnabled: nv }); }}>
            <span style={{ position: 'absolute', top: 2, left: reminderEnabled ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
          </span>
        </div>
        {reminderEnabled && (
          <div style={{ marginTop: 8 }}>
            <span className="sect-lbl">Remind me at</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 130, overflowY: 'auto', padding: '2px 0' }}>
              {['6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'].map(function (t) {
                var isActive = reminderTime === t;
                return (
                  <button key={t} className={'btn btn-sm ' + (isActive ? 'btn-primary' : 'btn-ghost')} style={{ minWidth: 80 }} onClick={function () { setReminderTime(t); autoSave({ reminderTime: t }); }}>{t}</button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div style={{ opacity: .5, pointerEvents: 'none', userSelect: 'none', paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <span className="sect-lbl">Plan</span>
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          {[['Basic', 'Free', 'Free forever'], ['Artisan', '$8.99/mo', 'For serious writers'], ['Guild', '$19.99/mo', 'For teams & studios']].map(function (p) {
            var isActive = p[0] === 'Basic';
            return (
              <div key={p[0]} style={{ flex: 1, border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px', textAlign: 'center', background: isActive ? 'var(--bg2)' : 'transparent' }}>
                <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p[0]}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--indigo)', margin: '2px 0' }}>{p[1]}</div>
                <div style={{ fontSize: 10, color: 'var(--mid)' }}>{p[2]}</div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 8, textAlign: 'center' }}>Paid plans coming soon</div>
      </div>

    </Drawer>
  );
}
