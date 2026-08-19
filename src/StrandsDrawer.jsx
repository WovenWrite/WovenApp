// @ts-nocheck
// ── StrandsDrawer ──
// Replaces EditorStrandsPanel and the old StrandDetailDrawer (which duplicated
// this component's detail view and had a broken rename handler).
//
// Two states: a list of tagged + untagged strands, and a detail view for one
// strand. The parent can control which via `strandId` / `onOpenStrand`, or
// leave those out and let the drawer manage it internally.
//
//   <StrandsDrawer app={app} draft={draft} variant="inline" onClose={...} />

import { useState } from 'react';
import { Drawer, Field, Avatar, AvatarEditModal, StrandResultRow, HelpText } from './SharedUI';
import { defaultFields } from './utils';

export default function StrandsDrawer({ app, draft, variant, open, onClose, strandId, onOpenStrand }) {
  var si = useState(null); var localId = si[0]; var setLocalId = si[1];
  var sa = useState(false); var showAvatarEdit = sa[0]; var setShowAvatarEdit = sa[1];

  // Controlled if the parent passes strandId, otherwise self-managed.
  var controlled = strandId !== undefined;
  var selectedId = controlled ? strandId : localId;
  function select(id) {
    if (controlled) { onOpenStrand && onOpenStrand(id); }
    else { setLocalId(id); }
  }
  function goBack() { select(null); setShowAvatarEdit(false); }

  if (!draft) return null;

  var pid = app.projId;
  var projStrands = app.allStrands[pid] || {};
  var taggedIds = draft.strandTags || [];

  var tagged = []; var untagged = [];
  Object.keys(projStrands).forEach(function (c) {
    (projStrands[c] || []).forEach(function (st) {
      var entry = Object.assign({}, st, { collectionName: c });
      if (taggedIds.includes(st.id)) tagged.push(entry);
      else untagged.push(entry);
    });
  });

  // ── Detail view ──
  if (selectedId) {
    var strand = null; var collName = '';
    Object.keys(projStrands).forEach(function (c) {
      (projStrands[c] || []).forEach(function (st) {
        if (st.id === selectedId) { strand = st; collName = c; }
      });
    });

    if (!strand) {
      // Strand was deleted while open — fall back to the list.
      return (
        <Drawer variant={variant || 'inline'} open={open} title="Strands" onClose={onClose}>
          <div className="wv-empty">That strand no longer exists.</div>
          <div style={{ padding: '0 14px' }}>
            <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={goBack}>Back to strands</button>
          </div>
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
      app.updateStrand(pid, collName, selectedId, { fields: nf });
    }

    var avatarBtn = (
      <div style={{ cursor: 'pointer' }} onClick={function () { setShowAvatarEdit(true); }} title="Edit appearance">
        <Avatar strand={strand} size={24} />
      </div>
    );

    return (
      <Drawer
        variant={variant || 'inline'}
        open={open}
        title={strand.name}
        onBack={goBack}
        onClose={onClose}
        headerExtra={avatarBtn}
      >
        <div style={{ fontSize: 11, color: 'var(--mid)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
          {collName}
        </div>

        <Field
          label="Name"
          key={strand.id + '-name'}
          defaultValue={strand.name}
          placeholder="Strand name"
          onBlur={function (e) {
            var v = e.target.value.trim();
            if (v && v !== strand.name) app.updateStrand(pid, collName, selectedId, { name: v });
          }}
        />

        {fields.map(function (f) {
          var val = (strand.fields && strand.fields[f.id]) || '';
          return (
            <Field
              key={f.id}
              label={f.label}
              defaultValue={val}
              placeholder={'Add ' + f.label.toLowerCase() + '...'}
              onBlur={function (e) { updateField(f.id, e.target.value); }}
            />
          );
        })}

        {showAvatarEdit && (
          <AvatarEditModal
            strand={strand}
            onClose={function () { setShowAvatarEdit(false); }}
            onSave={function (updates) { app.updateStrand(pid, collName, selectedId, updates); setShowAvatarEdit(false); }}
          />
        )}
      </Drawer>
    );
  }

  // ── List view ──
  function tagStrand(id) {
    if (!taggedIds.includes(id)) {
      app.updateDraft(pid, draft.id, { strandTags: taggedIds.concat([id]) });
    }
  }

  return (
    <Drawer variant={variant || 'inline'} open={open} title="Strands" onClose={onClose} padded={false}>

      {tagged.length === 0 && (
        <HelpText style={{ padding: '14px' }}>No strands tagged yet. Tap a strand below to add it to this draft.</HelpText>
      )}

      {tagged.map(function (st) {
        return <StrandResultRow key={st.id} strand={st} onClick={function () { select(st.id); }} />;
      })}

      {untagged.length > 0 && (
        <div>
          <div style={{ padding: '10px 14px 5px', fontSize: 10, fontWeight: 600, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '.06em', borderTop: '1px solid var(--border)' }}>
            Add strands
          </div>
          {untagged.map(function (st) {
            return (
              <div key={st.id} className="wv-row" onClick={function () { tagStrand(st.id); }}>
                <Avatar strand={st} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="wv-row-title" style={{ fontWeight: 400, color: 'var(--mid)' }}>{st.name}</div>
                  <div className="wv-row-sub" style={{ color: 'var(--placeholder)' }}>{st.collectionName}</div>
                </div>
                <span className="mi" style={{ fontSize: 16, color: 'var(--teal)' }}>add_circle_outline</span>
              </div>
            );
          })}
        </div>
      )}

    </Drawer>
  );
}
