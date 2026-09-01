// @ts-nocheck
// ── CompareView ──
// Full-screen overlay comparing two chunks of draft text — either two
// versions from VersionsDrawer, or two branches' current text from the
// branch dropdown. Pure client-side computation via computeWordDiff in
// utils.js; no new table, no fetch.
//
// Rendered as its own overlay rather than a side Drawer, since a document
// comparison needs width to read comfortably.
//
//   <CompareView open={bool} labelA={..} bodyA={html} labelB={..} bodyB={html} onClose={fn}/>

import { useMemo } from 'react';
import { computeWordDiff } from './utils';

export default function CompareView({ open, labelA, bodyA, labelB, bodyB, onClose }) {
  var diff = useMemo(function () {
    if (!open) return null;
    return computeWordDiff(bodyA, bodyB);
  }, [open, bodyA, bodyB]);

  if (!open) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(42,31,16,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#FDF8F0', borderRadius: 14, maxWidth: 860, width: '100%', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}
        onClick={function (e) { e.stopPropagation(); }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(42,31,16,.1)' }}>
          <div style={{ fontFamily: 'Crimson Text, serif', fontSize: 18, fontWeight: 600, color: '#2a1f10' }}>Compare</div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, color: '#7A5A38', display: 'flex' }}
          >
            <span className="mi" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '10px 20px', fontSize: 13, color: '#7A5A38', borderBottom: '1px solid rgba(42,31,16,.06)' }}>
          <span style={{ fontWeight: 600 }}>{labelA}</span>
          <span className="mi" style={{ fontSize: 16 }}>arrow_forward</span>
          <span style={{ fontWeight: 600 }}>{labelB}</span>
        </div>

        {diff && (
          <div style={{ display: 'flex', gap: 18, padding: '10px 20px', fontSize: 12, color: '#7A5A38', borderBottom: '1px solid rgba(42,31,16,.06)', fontFamily: 'DM Sans, sans-serif' }}>
            <span style={{ color: '#2f9966', fontWeight: 600 }}>+{diff.stats.wordsAdded} words</span>
            <span style={{ color: '#b83220', fontWeight: 600 }}>−{diff.stats.wordsRemoved} words</span>
            <span>{diff.stats.paragraphsChanged} of {diff.stats.totalParagraphs} paragraphs changed</span>
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 26px', fontFamily: 'Crimson Text, serif', fontSize: 15, lineHeight: 1.85, color: '#2a1f10', whiteSpace: 'pre-wrap' }}>
          {diff && diff.parts.length === 0 && (
            <div style={{ color: '#A88060', fontStyle: 'italic' }}>Nothing to compare yet.</div>
          )}
          {diff && diff.parts.map(function (part, i) {
            if (part.added) return <span key={i} style={{ background: 'rgba(47,153,102,.18)' }}>{part.value}</span>;
            if (part.removed) return <span key={i} style={{ background: 'rgba(184,50,32,.14)', textDecoration: 'line-through', color: '#8a3a2a' }}>{part.value}</span>;
            return <span key={i}>{part.value}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
