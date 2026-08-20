// @ts-nocheck
// ── PropertiesDrawer ──
// Draft metadata: title, synopsis, thumbnail, status, nesting, strand tags,
// plus an Advanced section for POV and custom draft fields.
//
//   <PropertiesDrawer app={app} draft={draft} variant="inline" onClose={...} />

import { useState } from 'react';
import { Drawer, Section, Field, Collapsible, StatusDotWithArchive, AddFieldInline, StrandRefPicker } from './SharedUI';
import { genId, uploadImage } from './utils';

export default function PropertiesDrawer({ app, draft, variant, open, onClose, onOpenStrand }) {
  var s1 = useState(false); var advOpen = s1[0]; var setAdvOpen = s1[1];
  var s2 = useState(false); var addChipOpen = s2[0]; var setAddChipOpen = s2[1];

  if (!draft) return null;

  var projStrands = app.allStrands[app.projId] || {};
  var allStrandsList = [];
  Object.keys(projStrands).forEach(function (c) {
    (projStrands[c] || []).forEach(function (st) {
      allStrandsList.push(Object.assign({}, st, { collectionName: c }));
    });
  });

  var tagIds = draft.strandTags || [];
  var taggedStrands = allStrandsList.filter(function (st) { return tagIds.includes(st.id); });
  var untaggedStrands = allStrandsList.filter(function (st) { return !tagIds.includes(st.id); });

  var allDrafts = app.allDrafts[app.projId] || [];
  var parentOptions = allDrafts.filter(function (d) {
    return d.status !== 'loose_thread' && d.id !== draft.id && !d.parentId;
  });

  var project = app.currentProject || {};
  var draftFieldDefs = project.draftFieldDefs || [];

  function update(changes) { app.updateDraft(app.projId, draft.id, changes); }
  function removeStrand(sid) { update({ strandTags: tagIds.filter(function (t) { return t !== sid; }) }); }
  function addStrand(sid) { update({ strandTags: tagIds.concat([sid]) }); setAddChipOpen(false); }

  function handleThumb(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2 MB.'); return; }
    uploadImage(file).then(function (url) { if (url) update({ thumbnail: url }); });
  }

  return (
    <Drawer variant={variant || 'inline'} open={open} title="Properties" onClose={onClose}>

      <Field
        label="Title"
        key={draft.id + '-pt'}
        defaultValue={draft.title || ''}
        placeholder="Untitled draft"
        onBlur={function (e) { update({ title: e.target.value, updatedAt: new Date().toISOString() }); }}
      />

      <Field
        label="Synopsis"
        key={draft.id + '-ps'}
        defaultValue={draft.synopsis}
        placeholder="Brief synopsis..."
        onBlur={function (e) { update({ synopsis: e.target.value }); }}
      />

      <Section label="Thumbnail">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {draft.thumbnail && <img src={draft.thumbnail} alt="" style={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />}
          <label style={{ cursor: 'pointer' }}>
            <span className="btn btn-ghost btn-sm">{draft.thumbnail ? 'Change image' : 'Upload image'}</span>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleThumb} />
          </label>
          {draft.thumbnail && (
            <button className="btn-icon" onClick={function () { update({ thumbnail: null }); }} aria-label="Remove thumbnail">
              <span className="mi" style={{ fontSize: 16 }}>delete</span>
            </button>
          )}
        </div>
      </Section>

      <Section label="Status">
        <StatusDotWithArchive draft={draft} app={app} showLabel={true} dotSize={16} />
      </Section>

      <Section label="Nested under">
        <select value={draft.parentId || ''} onChange={function (e) { update({ parentId: e.target.value || null }); }}>
          <option value="">None (top level)</option>
          {parentOptions.map(function (d) { return <option key={d.id} value={d.id}>{d.title || 'Untitled'}</option>; })}
        </select>
      </Section>

      <Section label="Tagged Strands">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {taggedStrands.map(function (st) {
            return (
              <span key={st.id} className="chip"
                style={{ background: st.color + '26', color: st.color, border: '1px solid ' + st.color + '55', cursor: 'pointer' }}
                onClick={function () { onOpenStrand && onOpenStrand(st.id); }}>
                {st.name}
                <span style={{ marginLeft: 3, opacity: .6, fontSize: 11 }}
                  onClick={function (e) { e.stopPropagation(); removeStrand(st.id); }}>×</span>
              </span>
            );
          })}
          <div style={{ position: 'relative' }}>
            <span className="chip"
              style={{ background: 'var(--bg3)', color: 'var(--mid)', border: '1px solid var(--border)', cursor: 'pointer' }}
              onClick={function () { setAddChipOpen(!addChipOpen); }}>
              <span className="mi" style={{ fontSize: 14 }}>add</span>
            </span>
            {addChipOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 50, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', boxShadow: '0 4px 16px rgba(42,31,16,.18)', minWidth: 180, maxHeight: 200, overflowY: 'auto' }}>
                {untaggedStrands.map(function (st) {
                  return (
                    <div key={st.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', fontSize: 13 }}
                      onClick={function () { addStrand(st.id); }}
                      onMouseOver={function (e) { e.currentTarget.style.background = 'var(--bg3)'; }}
                      onMouseOut={function (e) { e.currentTarget.style.background = 'transparent'; }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: st.color, flexShrink: 0 }} />
                      <span>{st.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--mid)', marginLeft: 'auto' }}>{st.collectionName}</span>
                    </div>
                  );
                })}
                {untaggedStrands.length === 0 && <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--mid)' }}>All strands tagged.</div>}
              </div>
            )}
          </div>
        </div>
        {allStrandsList.length === 0 && (
          <span style={{ fontSize: 12, color: 'var(--mid)', display: 'block', marginTop: 8 }}>No strands yet. Go to the Strands view.</span>
        )}
      </Section>

      <Collapsible label="Advanced" open={advOpen} onToggle={function () { setAdvOpen(!advOpen); }}>
        {draftFieldDefs.map(function (f) {
          var val = (draft.customFields && draft.customFields[f.id]) || '';
          if (f.type === 'strand_ref') {
            var refIds = [];
            try { var parsed = JSON.parse(val); if (Array.isArray(parsed)) refIds = parsed; } catch (e) {}
            return (
              <div key={f.id}>
                <span className="wv-field-lbl">{f.label}</span>
                <StrandRefPicker
                  app={app}
                  pid={app.projId}
                  value={refIds}
                  placeholder={'Select ' + f.label.toLowerCase() + '...'}
                  onChange={function (ids) {
                    var cf = Object.assign({}, draft.customFields || {});
                    cf[f.id] = ids.length ? JSON.stringify(ids) : '';
                    var newlyAdded = ids.filter(function (id) { return !tagIds.includes(id); });
                    var changes = { customFields: cf };
                    if (newlyAdded.length) changes.strandTags = tagIds.concat(newlyAdded);
                    update(changes);
                  }}
                />
              </div>
            );
          }
          return (
            <Field
              key={f.id}
              label={f.label}
              defaultValue={val}
              placeholder={'Enter ' + f.label.toLowerCase() + '...'}
              onBlur={function (e) {
                var cf = Object.assign({}, draft.customFields || {});
                cf[f.id] = e.target.value;
                update({ customFields: cf });
              }}
            />
          );
        })}

        <Section label="Custom draft fields">
          <AddFieldInline onAdd={function (name, type) {
            app.addDraftFieldDef(app.projId, { id: genId(), label: name.trim(), type: type || 'short_text' });
          }} />
        </Section>
      </Collapsible>

    </Drawer>
  );
}
