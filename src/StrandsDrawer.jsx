// @ts-nocheck
// ── StrandsDrawer ──
// UI-facing name is "Spools" (renamed from "Strands"). Internal naming
// (component name, `strand` variables, app.updateStrand, etc.) is unchanged
// on purpose — only user-facing text changed.
//
// Three layers:
//   Layer 1     — Presently tagged (10px-padded result list) + help text +
//                 a Category Link per collection + "Create New Spool"
//   Layer 2a    — a single collection's full spool list (via Category Link)
//   Layer 2b    — one spool's detail (large thumbnail + fields in template order)
//
// Back from Layer 2b always returns to Layer 1 (not Layer 2a, even if
// that's how you arrived).
//
// Viewing a spool (tapping a row) and tagging it to this draft (tapping the
// add icon) are separate actions — opening a spool's detail no longer tags
// it as a side effect.
//
// strandId/onOpenStrand still work as an external override for jumping
// straight to Layer 2b (used by PropertiesDrawer's tagged-strand chips) —
// that contract only concerns Layer 2b; Layer 1 / 2a navigation is always
// managed internally regardless.
//
//   <StrandsDrawer app={app} draft={draft} variant="inline" onClose={...} />

import { useState } from 'react';
import { Drawer, Field, AvatarEditModal, StrandResultRow, CategoryLink, HelpText, PrimaryButton, SecondaryButton, TertiaryButton, SpoolThumbnailUpload } from './SharedUI';
import { defaultFields, genId, PRESET_COLORS } from './utils';

var SPOOL_COLOR_BY_COLLECTION = {
  'Characters': '#c45e28', 'Locations': '#2f9966', 'Plot Threads': '#2f76e0',
  'Sources': '#ce2fe0', 'Interviews': '#e02f79', 'Subjects': '#e8a030',
  'Scenes': '#64e02f', 'Topics': '#2fe07f', 'Lore & World': '#e8a030',
  'Reports': '#b83220', 'Audience Notes': '#f0c050'
};

export default function StrandsDrawer({ app, draft, variant, open, onClose, strandId, onOpenStrand, hideDisconnect }) {
  var sv = useState('list'); var view = sv[0]; var setView = sv[1]; // 'list' | 'category'
  var sc = useState(null); var activeCategory = sc[0]; var setActiveCategory = sc[1];
  var si = useState(null); var localDetailId = si[0]; var setLocalDetailId = si[1];
  var sa = useState(false); var showAvatarEdit = sa[0]; var setShowAvatarEdit = sa[1];
  var scm = useState(false); var showCreateMenu = scm[0]; var setShowCreateMenu = scm[1];

  if (!draft) return null;

  var pid = app.projId;
  var projStrands = app.allStrands[pid] || {};
  var taggedIds = draft.strandTags || [];
  var collections = Object.keys(projStrands);
  var templatesAll = app.allTemplates[pid] || [];
  function iconFor(collName) {
    var t = templatesAll.find(function (t) { return t.name === collName; });
    return (t && t.icon) || 'auto_stories';
  }

  var controlled = strandId !== undefined;
  var detailId = controlled ? strandId : localDetailId;

  // Viewing a spool — no tagging side effect.
  function openDetail(id) {
    if (controlled) { onOpenStrand && onOpenStrand(id); }
    else { setLocalDetailId(id); }
  }
  // Tagging a spool to this draft — independent of viewing it.
  function tagStrand(id) {
    if (!taggedIds.includes(id)) {
      app.updateDraft(pid, draft.id, { strandTags: taggedIds.concat([id]) });
    }
  }
  function untagStrand(id) {
    app.updateDraft(pid, draft.id, { strandTags: taggedIds.filter(function (t) { return t !== id; }) });
  }
  function backToList() {
    setView('list');
    setActiveCategory(null);
    setShowAvatarEdit(false);
    if (controlled) { onOpenStrand && onOpenStrand(null); }
    else { setLocalDetailId(null); }
  }
  function openCategory(coll) { setActiveCategory(coll); setView('category'); }

  function createSpoolIn(collName) {
    var tpl = (app.allTemplates[pid] || []).find(function (t) { return t.name === collName; });
    var existing = projStrands[collName] || [];
    var base = 'New ' + collName.replace(/s$/, '');
    var num = existing.filter(function (s) { return s.name && s.name.indexOf(base) === 0; }).length + 1;
    var ns = {
      id: genId(),
      templateId: tpl ? tpl.id : '',
      collectionName: collName,
      name: base + ' ' + num,
      color: SPOOL_COLOR_BY_COLLECTION[collName] || PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
      image: null,
      fields: {},
      createdAt: new Date().toISOString()
    };
    app.addStrand(pid, collName, ns);
    setShowCreateMenu(false);
    tagStrand(ns.id);
    openDetail(ns.id);
  }

  function editTemplate(collName) {
    if (app.setStrandsFocusColl) app.setStrandsFocusColl(collName);
    if (app.setView) app.setView('strands');
  }

  // ── Layer 2b: Spool detail ──
  if (detailId) {
    var strand = null; var collName = '';
    Object.keys(projStrands).forEach(function (c) {
      (projStrands[c] || []).forEach(function (st) {
        if (st.id === detailId) { strand = st; collName = c; }
      });
    });

    if (!strand) {
      return (
        <Drawer variant={variant || 'inline'} open={open} title="Spools" onBack={backToList} onClose={onClose}>
          <HelpText>That spool no longer exists.</HelpText>
        </Drawer>
      );
    }

    var templates = app.allTemplates[pid] || [];
    var tpl = templates.find(function (t) { return t.id === strand.templateId; })
      || templates.find(function (t) { return t.name === collName; })
      || null;
    var fields = (tpl && tpl.fields && tpl.fields.length > 0) ? tpl.fields : defaultFields(collName);

    function updateField(fid, val) {
      var nf = Object.assign({}, strand.fields || {});
      nf[fid] = val;
      app.updateStrand(pid, collName, detailId, { fields: nf });
    }

    var footer = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <SecondaryButton icon="tune" onClick={function () { editTemplate(collName); }}>
          Edit Spool Template
        </SecondaryButton>
        {!hideDisconnect && (
          <TertiaryButton
            style={{ color: 'var(--danger)' }}
            onClick={function () { untagStrand(detailId); backToList(); }}
          >
            Disconnect from draft
          </TertiaryButton>
        )}
      </div>
    );

    return (
      <Drawer variant={variant || 'inline'} open={open} title={strand.name} onBack={backToList} onClose={onClose} footer={footer}>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <SpoolThumbnailUpload
            strand={strand}
            onClick={function () { setShowAvatarEdit(true); }}
          />
          <span
            style={{ fontSize: 13, color: 'var(--indigo)', cursor: 'pointer', textDecoration: 'underline' }}
            onClick={function () { setShowAvatarEdit(true); }}
          >
            Edit appearance
          </span>
        </div>

        <Field
          label="Name"
          key={strand.id + '-name'}
          defaultValue={strand.name}
          placeholder="Spool name"
          onBlur={function (e) {
            var v = e.target.value.trim();
            if (v && v !== strand.name) app.updateStrand(pid, collName, detailId, { name: v });
          }}
        />

        {fields.map(function (f) {
          var val = (strand.fields && strand.fields[f.id]) || '';
          var isLong = f.type === 'long_text';
          return (
            <Field
              key={f.id}
              label={f.label}
              defaultValue={val}
              placeholder={'Add ' + f.label.toLowerCase() + '...'}
              resizeMode={isLong ? 'manual' : 'auto'}
              rows={isLong ? 5 : undefined}
              onBlur={function (e) { updateField(f.id, e.target.value); }}
            />
          );
        })}

        {showAvatarEdit && (
          <AvatarEditModal
            strand={strand}
            onClose={function () { setShowAvatarEdit(false); }}
            onSave={function (updates) { app.updateStrand(pid, collName, detailId, updates); setShowAvatarEdit(false); }}
          />
        )}
      </Drawer>
    );
  }

  // ── Layer 2a: Category list ──
  if (view === 'category' && activeCategory) {
    var items = (projStrands[activeCategory] || []);
    return (
      <Drawer variant={variant || 'inline'} open={open} title={activeCategory} onBack={backToList} onClose={onClose}>
        {items.length === 0 && (
          <HelpText>No {activeCategory.toLowerCase()} yet.</HelpText>
        )}
        {items.map(function (st) {
          return (
            <StrandResultRow
              key={st.id}
              strand={st}
              spoolIcon={iconFor(activeCategory)}
              onClick={function () { openDetail(st.id); }}
              onAdd={taggedIds.includes(st.id) ? undefined : function () { tagStrand(st.id); }}
            />
          );
        })}
      </Drawer>
    );
  }

  // ── Layer 1: Presently tagged + Categories ──
  var tagged = [];
  collections.forEach(function (c) {
    (projStrands[c] || []).forEach(function (st) {
      if (taggedIds.includes(st.id)) tagged.push(Object.assign({}, st, { collectionName: c }));
    });
  });

  return (
    <Drawer variant={variant || 'inline'} open={open} title="Spools" onClose={onClose}>

      {tagged.length > 0 && (
        <div>
          <span className="wv-field-lbl">Presently tagged</span>
          <div style={{ padding: 10 }}>
            {tagged.map(function (st) {
              return (
                <StrandResultRow
                  key={st.id}
                  strand={st}
                  spoolIcon={iconFor(st.collectionName)}
                  onClick={function () { openDetail(st.id); }}
                />
              );
            })}
          </div>
        </div>
      )}

      <HelpText>
        {tagged.length === 0
          ? 'Nothing has been tagged yet. Tap a spool below to add it to this draft.'
          : 'Tag more strands to this draft'}
      </HelpText>

      {collections.length > 0 ? (
        <div>
          {collections.map(function (c) {
            return <CategoryLink key={c} title={c} onClick={function () { openCategory(c); }} />;
          })}
        </div>
      ) : (
        <HelpText>No spool collections yet. Create one in the Strands view.</HelpText>
      )}

      <div style={{ position: 'relative' }}>
        <PrimaryButton icon="add" onClick={function () { setShowCreateMenu(!showCreateMenu); }} disabled={collections.length === 0}>
          Create New Spool
        </PrimaryButton>
        {showCreateMenu && (
          <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(42,31,16,.18)', maxHeight: 220, overflowY: 'auto' }}>
            {collections.map(function (c) {
              return (
                <div key={c} style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 14 }}
                  onClick={function () { createSpoolIn(c); }}
                  onMouseOver={function (e) { e.currentTarget.style.background = 'var(--bg3)'; }}
                  onMouseOut={function (e) { e.currentTarget.style.background = 'transparent'; }}>
                  {c}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </Drawer>
  );
}
