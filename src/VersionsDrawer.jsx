// @ts-nocheck
// ── VersionsDrawer ──
// Snapshot history for a draft. Snapshots are rows in Supabase's
// draft_versions table, written by saveSnapshot() in utils.js — activity-based
// autosaves from DraftEditor, plus manual saves the user pins explicitly.
//
// Clicking a row previews that version's full text in the main editor area
// (read-only, via DraftEditor's onPreview/onExitPreview) rather than a small
// scrollable box in the drawer — restore/exit live on a banner there.
//
//   <VersionsDrawer draftId={did} variant="inline" onRestore={fn} onPreview={fn} onExitPreview={fn} onClose={...} />

import { useState, useEffect } from 'react';
import { Drawer, PrimaryButton, Field } from './SharedUI';
import { loadSnapshots, formatSnapshotTime, VOLUME_SNAPSHOT_WORDS, MIN_SNAPSHOT_INTERVAL_MS } from './utils';

var LABELS = { 'session-end': 'Session end', 'auto': 'Autosave' };

function labelFor(snap) {
  if (snap.isManual) return snap.label ? snap.label : 'Manual save';
  if (!snap.label) return 'Autosave';
  if (snap.label.indexOf('status:') === 0) return 'Status change';
  return LABELS[snap.label] || snap.label;
}

export default function VersionsDrawer({ draftId, variant, open, onClose, onRestore, onSaveVersion, onCompare, onPreview, onExitPreview }) {
  var sp = useState(null); var previewId = sp[0]; var setPreviewId = sp[1];
  var ss = useState([]); var snapshots = ss[0]; var setSnapshots = ss[1];
  var sel = useState([]); var selected = sel[0]; var setSelected = sel[1];
  var ssm = useState(false); var showSaveModal = ssm[0]; var setShowSaveModal = ssm[1];
  var stt = useState(''); var saveTitle = stt[0]; var setSaveTitle = stt[1];

  function refresh() {
    loadSnapshots(draftId).then(function (result) { setSnapshots(result); });
  }

  // Re-read on open and whenever the draft changes, so the list isn't stale.
  useEffect(function () {
    if (open === false) return;
    var cancelled = false;
    loadSnapshots(draftId).then(function (result) {
      if (cancelled) return;
      setSnapshots(result);
      setPreviewId(null);
      setSelected([]);
    });
    return function () { cancelled = true; };
  }, [draftId, open]);

  // Leaving the drawer entirely (draft switch, or the drawer closing) should
  // drop any active preview so a stale version doesn't linger in the editor.
  useEffect(function () {
    return function () { onExitPreview && onExitPreview(); };
  }, [draftId]);

  function handleSaveVersion() {
    setSaveTitle('');
    setShowSaveModal(true);
  }

  function handleConfirmSaveVersion() {
    if (!saveTitle.trim() || !onSaveVersion) return;
    var result = onSaveVersion(saveTitle.trim());
    if (result && result.then) {
      result.then(function () { refresh(); setShowSaveModal(false); setSaveTitle(''); });
    } else {
      setShowSaveModal(false); setSaveTitle('');
    }
  }

  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelected(function (prev) {
      if (prev.indexOf(id) >= 0) return prev.filter(function (x) { return x !== id; });
      if (prev.length >= 2) return [prev[1], id];
      return prev.concat([id]);
    });
  }

  function handleCompare() {
    if (selected.length !== 2 || !onCompare) return;
    var a = snapshots.find(function (s) { return s.id === selected[0]; });
    var b = snapshots.find(function (s) { return s.id === selected[1]; });
    if (!a || !b) return;
    var older = a.ts <= b.ts ? a : b;
    var newer = a.ts <= b.ts ? b : a;
    onCompare({
      labelA: formatSnapshotTime(older.ts), bodyA: older.body,
      labelB: formatSnapshotTime(newer.ts), bodyB: newer.body
    });
  }

  function handleRowClick(snap) {
    if (previewId === snap.id) {
      setPreviewId(null);
      onExitPreview && onExitPreview();
    } else {
      setPreviewId(snap.id);
      onPreview && onPreview({
        body: snap.body,
        label: labelFor(snap),
        timeLabel: formatSnapshotTime(snap.ts),
        wordCount: snap.wordCount,
        onRestore: function () { onRestore && onRestore(snap.body); }
      });
    }
  }

  var cadenceMinutes = Math.round(MIN_SNAPSHOT_INTERVAL_MS / 60000);

  return (
    <Drawer variant={variant || 'inline'} open={open} title="Version History" onClose={onClose} padded={false}>

      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <PrimaryButton icon="bookmark_add" onClick={handleSaveVersion}>
          Save this version
        </PrimaryButton>
        <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 8, lineHeight: 1.4 }}>
          Autosaves after about {VOLUME_SNAPSHOT_WORDS} words change, or every {cadenceMinutes} minutes while you're actively writing.
        </div>
      </div>

      {selected.length === 2 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', background: 'rgba(196,94,40,.06)' }}>
          <PrimaryButton icon="difference" onClick={handleCompare}>
            Compare selected
          </PrimaryButton>
        </div>
      )}

      {snapshots.length === 0 && (
        <div className="wv-empty" style={{ textAlign: 'center', padding: '28px 18px' }}>
          <span className="mi" style={{ fontSize: 32, color: 'var(--border)', display: 'block', marginBottom: 8 }}>history</span>
          No history yet — Woven saves versions as you write, and you can save one manually anytime.
        </div>
      )}

      {snapshots.map(function (snap) {
        var isActive = previewId === snap.id;
        return (
          <div
            key={snap.id}
            className="wv-row"
            style={{ background: isActive ? 'rgba(196,94,40,.08)' : 'transparent' }}
            onClick={function () { handleRowClick(snap); }}
          >
            <div
              onClick={function (e) { toggleSelect(snap.id, e); }}
              style={{
                width: 16, height: 16, borderRadius: 4, border: '1.5px solid ' + (selected.indexOf(snap.id) >= 0 ? 'var(--indigo)' : 'var(--border)'),
                background: selected.indexOf(snap.id) >= 0 ? 'var(--indigo)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: 10, cursor: 'pointer'
              }}
              title="Select to compare"
            >
              {selected.indexOf(snap.id) >= 0 && <span className="mi" style={{ fontSize: 12, color: '#fff' }}>check</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                {snap.isManual && <span className="mi" style={{ fontSize: 15, color: 'var(--indigo)' }}>bookmark</span>}
                {labelFor(snap)}
              </div>
              <div className="wv-row-sub">{formatSnapshotTime(snap.ts)} · {snap.wordCount || 0}w</div>
            </div>
            <span className="mi" style={{ fontSize: 18, color: isActive ? 'var(--indigo)' : 'var(--mid)' }}>
              {isActive ? 'visibility' : 'chevron_right'}
            </span>
          </div>
        );
      })}

      {showSaveModal && (
        <div className="modal-overlay">
          <div className="modal-backdrop" onClick={function () { setShowSaveModal(false); }} />
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, marginBottom: 12, color: 'var(--text)' }}>
              Name this version
            </div>
            <div style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 14 }}>
              Give it a short, memorable title so you can find it later.
            </div>
            <Field
              label="Title"
              value={saveTitle}
              onChange={function (e) { setSaveTitle(e.target.value); }}
              placeholder="e.g. Pre-wolf additions"
              autoFocus
              style={{ marginBottom: 20 }}
              onKeyDown={function (e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirmSaveVersion(); }
                if (e.key === 'Escape') { setShowSaveModal(false); }
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={function () { setShowSaveModal(false); }}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={!saveTitle.trim()} onClick={handleConfirmSaveVersion}>
                <span className="mi" style={{ fontSize: 16 }}>bookmark_add</span>Save version
              </button>
            </div>
          </div>
        </div>
      )}

    </Drawer>
  );
}
