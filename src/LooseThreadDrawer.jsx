// @ts-nocheck
// ── LooseThreadDrawer ──
// Edits a single loose thread. Two modes, same shell/behavior otherwise:
//
//   mode="dashboard" (default) — global loose thread (app.globalLT). Shows
//     Title, Notes, and "Move to a project".
//     <LooseThreadDrawer lt={thread} activeProjects={projects}
//       onUpdate={fn} onMove={fn} onDelete={fn} onClose={fn} />
//
//   mode="project" — a project-level loose thread (a Draft with
//     status:'loose_thread'). Shows Title, Notes, and "Tag a Spool" — the
//     same Presently-tagged + Category Links pattern as the real Spools
//     drawer's Layer 1, drilling into a category (Layer 2) to add an item.
//     Requires `app` and `pid`.
//     <LooseThreadDrawer lt={draft} mode="project" app={app} pid={pid}
//       onUpdate={fn} onDelete={fn} onClose={fn} />

import { useState } from 'react';
import { Drawer, Field, HelpText, CategoryLink, StrandResultRow } from './SharedUI';

export default function LooseThreadDrawer({ lt, activeProjects, mode, app, pid, variant, open, onUpdate, onMove, onClose, onDelete, topOffset }) {
  var sv = useState('info'); var view = sv[0]; var setView = sv[1]; // 'info' | 'category'
  var sc = useState(null); var activeCategory = sc[0]; var setActiveCategory = sc[1];

  if (!lt) return null;

  var isProject = mode === 'project';
  var projects = activeProjects || [];
  var taggedIds = lt.strandTags || [];

  function tagStrand(id) {
    if (!taggedIds.includes(id)) onUpdate({ strandTags: taggedIds.concat([id]) });
  }
  function backToInfo() { setView('info'); setActiveCategory(null); }
  function iconFor(collName) {
    var t = (app.allTemplates[pid] || []).find(function (x) { return x.name === collName; });
    return (t && t.icon) || 'auto_stories';
  }

  // NOTE: placement is a placeholder — trash can was intentionally pulled out
  // of the header per the shell redesign; revisit once content-level design
  // for this drawer is defined.
  var footer = (
    <button className="btn btn-ghost" style={{ color: 'var(--danger)', width: '100%', justifyContent: 'center' }} onClick={onDelete}>
      <span className="mi" style={{ fontSize: 16 }}>delete</span>Archive this thread
    </button>
  );

  // ── Layer 2 (project mode only): one collection's item list, tap to add ──
  if (isProject && view === 'category' && activeCategory) {
    var projStrands = app.allStrands[pid] || {};
    var items = projStrands[activeCategory] || [];
    return (
      <Drawer variant={variant || 'overlay'} open={open} title={activeCategory} onBack={backToInfo} onClose={onClose} topOffset={topOffset}>
        {items.length === 0 && <HelpText>No {activeCategory.toLowerCase()} yet.</HelpText>}
        {items.map(function (st) {
          var already = taggedIds.includes(st.id);
          return (
            <StrandResultRow
              key={st.id}
              strand={st}
              spoolIcon={iconFor(activeCategory)}
              onClick={function () { tagStrand(st.id); }}
              onAdd={already ? undefined : function () { tagStrand(st.id); }}
            />
          );
        })}
      </Drawer>
    );
  }

  // ── Layer 1: Title, Notes, and the mode-specific section ──
  var projStrandsInfo = isProject ? (app.allStrands[pid] || {}) : {};
  var collections = isProject ? Object.keys(projStrandsInfo) : [];
  var tagged = [];
  if (isProject) {
    collections.forEach(function (c) {
      (projStrandsInfo[c] || []).forEach(function (st) {
        if (taggedIds.includes(st.id)) tagged.push(st);
      });
    });
  }

  return (
    <Drawer
      variant={variant || 'overlay'}
      open={open}
      title="Loose Thread"
      onClose={onClose}
      footer={footer}
      topOffset={topOffset}
    >
      <Field
        label="Title"
        key={lt.id + '-t'}
        defaultValue={lt.title || ''}
        placeholder="Give this thread a name..."
        onBlur={function (e) { onUpdate({ title: e.target.value }); }}
      />

      <Field
        label="Notes"
        key={lt.id + '-s'}
        defaultValue={lt.synopsis || ''}
        placeholder="Write freely — capture the idea, explore it, let it breathe..."
        onBlur={function (e) { onUpdate({ synopsis: e.target.value }); }}
      />

      {!isProject && projects.length > 0 && (
        <div>
          <span className="wv-field-lbl">Move to a project</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 7 }}>
            {projects.map(function (p) {
              return (
                <button key={p.id} className="btn btn-ghost" style={{ justifyContent: 'flex-start' }} onClick={function () { onMove(p.id); }}>
                  <span className="mi" style={{ fontSize: 16 }}>arrow_forward</span>{p.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {isProject && (
        <div>
          <span className="wv-field-lbl">Tag a Spool</span>
          {tagged.length > 0 && (
            <div style={{ marginTop: 7 }}>
              {tagged.map(function (st) {
                var collName = collections.find(function (c) { return (projStrandsInfo[c] || []).some(function (s) { return s.id === st.id; }); });
                return <StrandResultRow key={st.id} strand={st} spoolIcon={iconFor(collName)} onClick={undefined} />;
              })}
            </div>
          )}
          {collections.length > 0 ? (
            <div style={{ marginTop: tagged.length > 0 ? 8 : 7 }}>
              {collections.map(function (c) {
                return <CategoryLink key={c} title={c} onClick={function () { setActiveCategory(c); setView('category'); }} />;
              })}
            </div>
          ) : (
            <HelpText style={{ marginTop: 7 }}>No spool collections yet.</HelpText>
          )}
        </div>
      )}
    </Drawer>
  );
}
