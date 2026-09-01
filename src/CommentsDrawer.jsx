// @ts-nocheck
// ── CommentsDrawer ──
// Author-only comment threads for a draft. Comments are rows in Supabase's
// draft_comments table, anchored to text via a Quill inline format (added in
// DraftEditor.jsx when a comment is created on a selection).
//
// A comment grays out for one of two reasons only:
//   - resolved: the author dismissed it
//   - orphaned: its anchor text was deleted from the draft (detected by
//     DraftEditor scanning saved HTML for the comment's marker)
// A newer autosave elsewhere in the draft does NOT affect a comment — its
// version_id is provenance ("made on this version") only.
//
//   <CommentsDrawer draftId={did} variant="inline" onClose={...} />

import { useState, useEffect, useRef } from 'react';
import { Drawer } from './SharedUI';
import { loadComments } from './utils';

function formatCommentTime(ts) {
  var d = new Date(ts);
  var now = new Date();
  var isToday = d.toDateString() === now.toDateString();
  var yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  var isYesterday = d.toDateString() === yesterday.toDateString();
  var time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return 'Today ' + time;
  if (isYesterday) return 'Yesterday ' + time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
}

export default function CommentsDrawer({ draftId, variant, open, focusCommentId, onDismiss, onReopen, onClose }) {
  var cs = useState([]); var comments = cs[0]; var setComments = cs[1];
  var rowRefs = useRef({});

  function refresh() {
    loadComments(draftId).then(function (list) { setComments(list); });
  }

  // Re-read on open and whenever the draft changes, so the list isn't stale.
  useEffect(function () {
    if (open === false) return;
    var cancelled = false;
    loadComments(draftId).then(function (result) {
      if (!cancelled) setComments(result);
    });
    return function () { cancelled = true; };
  }, [draftId, open]);

  // Scroll to and briefly highlight the comment that was clicked on in the draft
  useEffect(function () {
    if (!focusCommentId) return;
    var node = rowRefs.current[focusCommentId];
    if (node && node.scrollIntoView) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [focusCommentId, comments]);

  function handleResolve(comment) {
    if (!onDismiss) return;
    var result = onDismiss(comment);
    if (result && result.then) result.then(refresh);
  }

  function handleReopen(comment) {
    if (!onReopen) return;
    var result = onReopen(comment);
    if (result && result.then) result.then(refresh);
  }

  var active = comments.filter(function (c) { return !c.resolved && !c.orphaned; });
  var grayed = comments.filter(function (c) { return c.resolved || c.orphaned; });

  return (
    <Drawer variant={variant || 'inline'} open={open} title="Comments" onClose={onClose} padded={false}>

      {comments.length === 0 && (
        <div className="wv-empty" style={{ textAlign: 'center', padding: '28px 18px' }}>
          <span className="mi" style={{ fontSize: 32, color: 'var(--border)', display: 'block', marginBottom: 8 }}>comment</span>
          No comments yet — select text in the draft and use "Add comment" to leave one.
        </div>
      )}

      {active.map(function (c) {
        var isFocused = c.id === focusCommentId;
        return (
          <div
            key={c.id}
            ref={function (el) { rowRefs.current[c.id] = el; }}
            className="wv-row"
            style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '12px 14px', background: isFocused ? 'rgba(196,94,40,.08)' : 'transparent', transition: 'background .3s' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.authorName}</div>
              <div style={{ fontSize: 11, color: 'var(--mid)' }}>{formatCommentTime(c.createdAt)}</div>
            </div>
            {c.anchorText && (
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontStyle: 'italic', color: 'var(--mid)', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                "{c.anchorText.length > 90 ? c.anchorText.slice(0, 90) + '…' : c.anchorText}"
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--body-text)', lineHeight: 1.5 }}>{c.body}</div>
            <button
              onClick={function () { handleResolve(c); }}
              style={{ alignSelf: 'flex-start', fontSize: 12, color: 'var(--indigo)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'DM Sans, sans-serif' }}
            >
              Dismiss
            </button>
          </div>
        );
      })}

      {grayed.length > 0 && (
        <div style={{ padding: '10px 14px 4px', fontSize: 11, fontWeight: 600, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '.03em' }}>
          {active.length > 0 ? 'Dismissed' : 'Dismissed / removed'}
        </div>
      )}

      {grayed.map(function (c) {
        var isFocused = c.id === focusCommentId;
        return (
          <div
            key={c.id}
            ref={function (el) { rowRefs.current[c.id] = el; }}
            className="wv-row"
            style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '12px 14px', opacity: 0.55, background: isFocused ? 'rgba(196,94,40,.08)' : 'transparent', transition: 'background .3s' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{c.authorName}</div>
              <div style={{ fontSize: 11, color: 'var(--mid)' }}>{formatCommentTime(c.createdAt)}</div>
            </div>
            {c.anchorText && (
              <div style={{ fontFamily: 'var(--serif)', fontSize: 13, fontStyle: 'italic', color: 'var(--mid)', borderLeft: '2px solid var(--border)', paddingLeft: 8 }}>
                "{c.anchorText.length > 90 ? c.anchorText.slice(0, 90) + '…' : c.anchorText}"
              </div>
            )}
            <div style={{ fontSize: 13, color: 'var(--body-text)', lineHeight: 1.5 }}>{c.body}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--mid)' }}>{c.orphaned ? 'Text removed' : 'Dismissed'}</span>
              {!c.orphaned && (
                <button
                  onClick={function () { handleReopen(c); }}
                  style={{ fontSize: 12, color: 'var(--indigo)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 0', fontFamily: 'DM Sans, sans-serif' }}
                >
                  Reopen
                </button>
              )}
            </div>
          </div>
        );
      })}

    </Drawer>
  );
}
