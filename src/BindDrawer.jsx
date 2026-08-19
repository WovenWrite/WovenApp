// @ts-nocheck
// ── BindDrawer ──
// Formerly BindPanel. Select a sequence of drafts and export as PDF / Word,
// or publish a read-only link.
//
// FIXED: handlePublishLink previously contained a stray line referencing
// `shareId` and `SharedDraftView`, and then used an undefined `link` variable,
// so publishing always threw a ReferenceError. Now uses buildShareLink().
//
//   <BindDrawer app={app} open={bindOpen} activeFilter={filter} onClose={...} />

import { useState } from 'react';
import { Drawer, Check, Spinner, PrimaryButton } from './SharedUI';
import { STATUSES, genId, supabase, doExport, buildShareLink } from './utils';

export default function BindDrawer({ app, open, onClose, activeFilter, variant, topOffset }) {
  var sf = useState('PDF'); var format = sf[0]; var setFormat = sf[1];
  var sn = useState(false); var inclNested = sn[0]; var setInclNested = sn[1];
  var sx = useState({}); var excluded = sx[0]; var setExcluded = sx[1];
  var se = useState(false); var exporting = se[0]; var setExporting = se[1];
  var sc = useState(false); var linkCopied = sc[0]; var setLinkCopied = sc[1];
  var sl = useState(false); var linkLoading = sl[0]; var setLinkLoading = sl[1];

  var bindShareKey = 'woven:bind_share:' + app.projId;
  var sb = useState(function () {
    try { var v = localStorage.getItem(bindShareKey); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  });
  var bindShare = sb[0]; var setBindShare = sb[1];

  // ── Data ──
  var projStrands = app.allStrands[app.projId] || {};
  var activeStrand = null;
  if (activeFilter) {
    Object.keys(projStrands).forEach(function (c) {
      (projStrands[c] || []).forEach(function (st) { if (st.id === activeFilter) activeStrand = st; });
    });
  }

  var allDraftsList = app.allDrafts[app.projId] || [];
  var strandFiltered = activeFilter
    ? allDraftsList.filter(function (d) { return (d.strandTags || []).includes(activeFilter); })
    : allDraftsList;

  function bySeq(a, b) { return (a.order || 0) - (b.order || 0); }
  var parents = strandFiltered
    .filter(function (d) { return d.status !== 'loose_thread' && !d.parentId && !d.archived; })
    .sort(bySeq);
  var allSeq = strandFiltered
    .filter(function (d) { return d.status !== 'loose_thread' && !d.archived && (inclNested || !d.parentId); })
    .sort(bySeq);
  var filtered = allSeq.filter(function (d) { return !excluded[d.id]; });
  var totalWords = filtered.reduce(function (s, d) { return s + (d.wordCount || 0); }, 0);

  function toggleExclude(id) {
    setExcluded(function (prev) { var n = Object.assign({}, prev); n[id] = !n[id]; return n; });
  }

  function authorName() {
    var p = app.profile || {};
    return ((p.firstName || '') + ' ' + (p.lastName || '')).trim();
  }

  // ── Actions ──
  function handleExport() {
    if (format === 'link') { publishLink(); return; }
    setExporting(true);
    var author = authorName();
    setTimeout(function () {
      doExport(format, filtered, app.currentProject, false, author);
      setExporting(false);
    }, 100);
  }

  async function publishLink() {
    if (filtered.length === 0) return;
    setLinkLoading(true);
    try {
      var projName = (app.currentProject && app.currentProject.title) || '';
      var combinedBody = filtered.map(function (d) {
        return '<h2 style="margin-top:32px;margin-bottom:8px;font-family:serif;">'
          + (d.title || 'Untitled') + '</h2>' + (d.body || '');
      }).join('');
      var linkTitle = activeStrand ? activeStrand.name + ' — ' + projName : projName;

      if (bindShare && bindShare.id) {
        await supabase.from('shared_drafts').delete().eq('id', bindShare.id);
      }

      var sid = genId();
      var res = await supabase.from('shared_drafts').insert({
        id: sid, title: linkTitle, body: combinedBody,
        project_name: projName, author_name: authorName()
      });
      if (res.error) { console.error('Publish failed:', res.error); setLinkLoading(false); return; }

      var shareData = { id: sid, link: buildShareLink(sid), enabled: true, created: new Date().toISOString() };
      setBindShare(shareData);
      try { localStorage.setItem(bindShareKey, JSON.stringify(shareData)); } catch (e) {}
    } catch (e) {
      console.error('Publish failed:', e);
    }
    setLinkLoading(false);
  }

  async function unpublishLink() {
    if (!bindShare) return;
    await supabase.from('shared_drafts').delete().eq('id', bindShare.id);
    setBindShare(null);
    try { localStorage.removeItem(bindShareKey); } catch (e) {}
  }

  function copyLink() {
    if (!bindShare || !bindShare.link) return;
    navigator.clipboard && navigator.clipboard.writeText(bindShare.link);
    setLinkCopied(true);
    setTimeout(function () { setLinkCopied(false); }, 2500);
  }

  var busy = exporting || linkLoading;

  // ── Footer ──
  var footer = (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {bindShare && (
        <div style={{ marginBottom: 10, padding: 10, background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Read-only link</span>
            <button style={{ fontSize: 11, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={unpublishLink}>Unpublish</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--mid)', wordBreak: 'break-all', marginBottom: 6, fontFamily: 'var(--mono)', lineHeight: 1.4 }}>{bindShare.link}</div>
          <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={copyLink}>
            <span className="mi" style={{ fontSize: 14 }}>{linkCopied ? 'check_circle' : 'content_copy'}</span>
            {linkCopied ? 'Copied!' : 'Copy link'}
          </button>
        </div>
      )}

      <select
        style={{ width: '100%', padding: '9px 12px', fontSize: 13, color: 'var(--text)', background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--r)', marginBottom: 8 }}
        value={format}
        onChange={function (e) { setFormat(e.target.value); }}
      >
        <option value="PDF">PDF — best for sharing &amp; printing</option>
        <option value="Word (.docx)">Word Document — edit in Word or Google Docs</option>
        <option value="link">Read-only link — share in browser</option>
      </select>

      <PrimaryButton onClick={handleExport} disabled={busy || filtered.length === 0}>
        {busy
          ? <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Spinner />{format === 'link' ? 'Publishing...' : 'Preparing...'}</span>
          : format === 'link' ? 'Publish link' : 'Export'}
      </PrimaryButton>
    </div>
  );

  // ── Body ──
  return (
    <Drawer variant={variant || 'overlay'} open={open} title="Bind your drafts" onClose={onClose} footer={footer} topOffset={topOffset}>

      {activeStrand && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeStrand.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>Filtered to <strong>{activeStrand.name}</strong></span>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="wv-lbl" style={{ marginBottom: 0 }}>Sequence</span>
        <span style={{ fontSize: 12, color: 'var(--mid)' }}>
          {filtered.length} draft{filtered.length !== 1 ? 's' : ''} · {totalWords} words
        </span>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', overflowY: 'auto', maxHeight: 360, background: 'var(--bg0)' }}>
        {parents.map(function (d, i) {
          var info = STATUSES[d.status] || STATUSES.first_draft;
          var kids = allDraftsList.filter(function (c) { return c.parentId === d.id && !c.archived; }).sort(bySeq);
          var off = !!excluded[d.id];
          return (
            <div key={d.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--bg2)', fontSize: 13, opacity: off ? .45 : 1, cursor: 'pointer' }} onClick={function () { toggleExclude(d.id); }}>
                <Check on={!off} />
                <span style={{ fontSize: 11, color: 'var(--mid)', width: 24 }}>{i + 1}</span>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                <span style={{ flex: 1, textDecoration: off ? 'line-through' : 'none', color: off ? 'var(--mid)' : 'var(--text)' }}>{d.title || 'Untitled'}</span>
              </div>
              {inclNested && kids.map(function (c, ci) {
                var ci2 = STATUSES[c.status] || STATUSES.first_draft;
                var coff = !!excluded[c.id];
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px 9px 26px', borderBottom: '1px solid var(--bg2)', fontSize: 13, background: 'rgba(42,31,16,.02)', opacity: coff ? .45 : 1, cursor: 'pointer' }} onClick={function () { toggleExclude(c.id); }}>
                    <Check on={!coff} />
                    <span style={{ fontSize: 11, color: 'var(--mid)', width: 28 }}>{(i + 1) + '.' + (ci + 1)}</span>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: ci2.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: coff ? 'var(--mid)' : 'var(--body-text)', textDecoration: coff ? 'line-through' : 'none' }}>{c.title || 'Untitled'}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
        {parents.length === 0 && <div style={{ padding: 12, fontSize: 13, color: 'var(--mid)' }}>No drafts to bind.</div>}
      </div>

      <div style={{ fontSize: 12, color: 'var(--mid)', marginTop: 6 }}>Loose Threads are always excluded.</div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 0', borderTop: '1px solid var(--border)', marginTop: 14, cursor: 'pointer' }} onClick={function () { setInclNested(!inclNested); }}>
        <Check on={inclNested} />
        <span style={{ fontSize: 13, color: 'var(--text)' }}>Include nested drafts</span>
      </div>

    </Drawer>
  );
}
