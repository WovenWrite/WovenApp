// @ts-nocheck
// ── VersionsDrawer ──
// Snapshot history for a draft. Snapshots are rows in Supabase's
// draft_versions table, written by saveSnapshot() in utils.js — activity-based
// autosaves from DraftEditor, plus manual saves the user pins explicitly.
//
//   <VersionsDrawer draftId={did} variant="inline" onRestore={fn} onClose={...} />

import { useState, useEffect } from 'react';
import { Drawer, PrimaryButton } from './SharedUI';
import { loadSnapshots, formatSnapshotTime } from './utils';

var LABELS = { 'session-end': 'Session end', 'auto': 'Autosave' };

function labelFor(snap) {
  if (snap.isManual) return snap.label ? snap.label : 'Manual save';
  if (!snap.label) return 'Autosave';
  if (snap.label.indexOf('status:') === 0) return 'Status change';
  return LABELS[snap.label] || snap.label;
}

export default function VersionsDrawer({ draftId, variant, open, onClose, onRestore, onSaveVersion }) {
  var sp = useState(null); var previewId = sp[0]; var setPreviewId = sp[1];
  var ss = useState([]); var snapshots = ss[0]; var setSnapshots = ss[1];

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
    });
    return function () { cancelled = true; };
  }, [draftId, open]);

  function handleRestore(snap) {
    if (window.confirm('Restore this version? Your current text will be replaced.')) {
      onRestore && onRestore(snap.body);
    }
  }

  function handleSaveVersion() {
    if (!onSaveVersion) return;
    var result = onSaveVersion();
    if (result && result.then) result.then(refresh);
  }

  return (
    <Drawer variant={variant || 'inline'} open={open} title="Version History" onClose={onClose} padded={false}>

      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <PrimaryButton icon="bookmark_add" onClick={handleSaveVersion}>
          Save this version
        </PrimaryButton>
      </div>

      {snapshots.length === 0 && (
        <div className="wv-empty" style={{ textAlign: 'center', padding: '28px 18px' }}>
          <span className="mi" style={{ fontSize: 32, color: 'var(--border)', display: 'block', marginBottom: 8 }}>history</span>
          No history yet — Woven saves versions as you write, and you can save one manually anytime.
        </div>
      )}

      {snapshots.map(function (snap) {
        var isActive = previewId === snap.id;
        return (
          <div key={snap.id} style={{ borderBottom: '1px solid var(--border)' }}>
            <div
              className="wv-row"
              style={{ borderBottom: 'none' }}
              onClick={function () { setPreviewId(isActive ? null : snap.id); }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {snap.isManual && <span className="mi" style={{ fontSize: 15, color: 'var(--indigo)' }}>bookmark</span>}
                  {formatSnapshotTime(snap.ts)}
                </div>
                <div className="wv-row-sub">{labelFor(snap)} · {snap.wordCount || 0}w</div>
              </div>
              <span className="mi" style={{
                fontSize: 16,
                color: isActive ? 'var(--indigo)' : 'var(--mid)',
                transform: isActive ? 'rotate(90deg)' : 'none',
                transition: 'transform .15s'
              }}>chevron_right</span>
            </div>

            {isActive && (
              <div style={{ padding: '0 14px 12px' }}>
                <div
                  style={{
                    fontFamily: 'var(--serif)', fontSize: 14, lineHeight: 1.8, color: 'var(--body-text)',
                    maxHeight: 200, overflowY: 'auto', padding: '10px 0',
                    borderTop: '1px solid var(--border)', marginBottom: 10,
                    WebkitMaskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)',
                    maskImage: 'linear-gradient(to bottom, black 80%, transparent 100%)'
                  }}
                  dangerouslySetInnerHTML={{ __html: snap.body }}
                />
                <PrimaryButton icon="restore" onClick={function () { handleRestore(snap); }}>
                  Restore this version
                </PrimaryButton>
              </div>
            )}
          </div>
        );
      })}

    </Drawer>
  );
}
