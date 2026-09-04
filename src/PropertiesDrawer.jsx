// @ts-nocheck
// ── PropertiesDrawer ──
// Draft metadata, in order: Thumbnail, Title, Status + Sequence #, Synopsis,
// Tagged Strands, custom fields, Add new field / Edit existing fields.
//
// "Nested under" is gone — nesting/branching now lives in DraftEditor's top
// nav (BranchDropdown), not here.
//
//   <PropertiesDrawer app={app} draft={draft} variant="inline" onClose={...} />

import { useState } from 'react';
import { Drawer, Field, StatusSelect, StrandRefPicker, StrandSearchDropdown, DraftThumbnailUpload, Avatar, PrimaryButton, SecondaryButton, TertiaryButton, HelpText, OptionsEditor, Radio } from './SharedUI';
import { genId, FIELD_TYPES } from './utils';
import { projSequence, projStatusMap, draftDateOf } from './projectConfig';

export default function PropertiesDrawer({ app, draft, variant, open, onClose, onOpenStrand }) {
  var pid = app.projId;
  var s2 = useState(false); var addChipOpen = s2[0]; var setAddChipOpen = s2[1];
  var saf = useState(false); var showAddField = saf[0]; var setShowAddField = saf[1];
  var sef = useState(false); var showEditFields = sef[0]; var setShowEditFields = sef[1];

  if (!draft) return null;

  var projStrands = app.allStrands[pid] || {};
  var allStrandsList = [];
  Object.keys(projStrands).forEach(function (c) {
    (projStrands[c] || []).forEach(function (st) {
      allStrandsList.push(Object.assign({}, st, { collectionName: c }));
    });
  });

  var tagIds = draft.strandTags || [];
  var taggedStrands = allStrandsList.filter(function (st) { return tagIds.includes(st.id); });

  var project = app.currentProject || {};
  var draftFieldDefs = project.draftFieldDefs || [];
  var statusMap = projStatusMap(project);
  var byDate = projSequence(project) === 'date';

  var allDrafts = app.allDrafts[pid] || [];
  var seqSiblings = allDrafts
    .filter(function (d) { return d.status !== 'loose_thread' && !d.parentId && !d.archived; })
    .sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  var myPosition = seqSiblings.findIndex(function (d) { return d.id === draft.id; }) + 1;
  var isInSequence = draft.status !== 'loose_thread' && !draft.parentId && myPosition > 0;

  function update(changes) { app.updateDraft(pid, draft.id, changes); }
  function removeStrand(sid) { update({ strandTags: tagIds.filter(function (t) { return t !== sid; }) }); }
  function addStrand(sid) { update({ strandTags: tagIds.concat([sid]) }); setAddChipOpen(false); }

  function handleSequenceChange(e) {
    var targetOrder = parseInt(e.target.value, 10);
    if (app.reorderDraft) app.reorderDraft(pid, draft.id, targetOrder);
  }

  return (
    <Drawer variant={variant || 'inline'} open={open} title="Properties" onClose={onClose}>

      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <DraftThumbnailUpload image={draft.thumbnail} onUpload={function (url) { update({ thumbnail: url }); }} />
      </div>

      <Field
        label="Title"
        key={draft.id + '-pt'}
        defaultValue={draft.title || ''}
        placeholder="Untitled draft"
        onBlur={function (e) { update({ title: e.target.value, updatedAt: new Date().toISOString() }); }}
      />

      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 2 }}>
          <span className="wv-field-lbl">Status</span>
          <StatusSelect app={app} draft={draft} project={project} />
        </div>
        {byDate ? (
          <div style={{ flex: 1 }}>
            <span className="wv-field-lbl">Date</span>
            <input
              key={draft.id + '-date'}
              className="wv-field-box"
              type="date"
              defaultValue={draftDateOf(draft)}
              onBlur={function (e) { update({ draftDate: e.target.value || null }); }}
            />
          </div>
        ) : isInSequence && (
          <div style={{ flex: 1 }}>
            <span className="wv-field-lbl">Sequence</span>
            <select className="wv-field-box" value={myPosition} onChange={handleSequenceChange}>
              {seqSiblings.map(function (d, i) { return <option key={d.id} value={i + 1}>{i + 1}</option>; })}
            </select>
          </div>
        )}
      </div>

      <Field
        label="Synopsis"
        key={draft.id + '-ps'}
        defaultValue={draft.synopsis}
        placeholder="Brief synopsis..."
        resizeMode="manual"
        rows={3}
        onBlur={function (e) { update({ synopsis: e.target.value }); }}
      />

      <div style={{ position: 'relative' }}>
        <span className="wv-field-lbl">Spools</span>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {taggedStrands.slice(0, 6).map(function (st, i) {
            return (
              <div key={st.id} onClick={function () { onOpenStrand && onOpenStrand(st.id); }}
                style={{ cursor: 'pointer', marginLeft: i > 0 ? -7 : 0, position: 'relative', zIndex: 6 - i }}
                title={st.name}>
                <Avatar strand={st} size={28} />
              </div>
            );
          })}
          {taggedStrands.length > 6 && (
            <span style={{ fontSize: 11, color: 'var(--mid)', marginLeft: 6 }}>+{taggedStrands.length - 6}</span>
          )}
          <span
            data-tour="tag-spool-chip"
            className="chip"
            onClick={function () { setAddChipOpen(!addChipOpen); }}
            style={{ background: 'var(--bg3)', color: 'var(--mid)', border: '1px solid var(--border)', marginLeft: taggedStrands.length > 0 ? 8 : 0 }}>
            <span className="mi" style={{ fontSize: 14 }}>add</span>
          </span>
        </div>
        {addChipOpen && (
          <StrandSearchDropdown
            app={app}
            pid={pid}
            excludeIds={tagIds}
            onPick={function (st) { addStrand(st.id); }}
            onClose={function () { setAddChipOpen(false); }}
            style={{ left: 15, right: 15 }}
          />
        )}
        {allStrandsList.length === 0 && (
          <HelpText style={{ marginTop: 6 }}>No strands yet. Go to the Strands view.</HelpText>
        )}
      </div>

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
                pid={pid}
                collection={f.refSpool}
                value={refIds}
                placeholder={f.refSpool ? 'Select ' + f.refSpool.toLowerCase() + '...' : 'No collection set — edit this field'}
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
        if (f.type === 'boolean') {
          return (
            <div key={f.id}>
              <span className="wv-field-lbl">{f.label}</span>
              <div style={{ display: 'flex', gap: 16 }}>
                {['Yes', 'No'].map(function (opt) {
                  return (
                    <Radio key={opt} on={val === opt} label={opt} onClick={function () {
                      var cf = Object.assign({}, draft.customFields || {});
                      cf[f.id] = opt;
                      update({ customFields: cf });
                    }} />
                  );
                })}
              </div>
            </div>
          );
        }
        if (f.type === 'select') {
          return (
            <div key={f.id}>
              <span className="wv-field-lbl">{f.label}</span>
              <select className="wv-field-box" value={val} onChange={function (e) {
                var cf = Object.assign({}, draft.customFields || {});
                cf[f.id] = e.target.value;
                update({ customFields: cf });
              }}>
                <option value="">Select...</option>
                {(f.options || []).map(function (o) { return <option key={o} value={o}>{o}</option>; })}
              </select>
              {(f.options || []).length === 0 && <HelpText style={{ marginTop: 4 }}>No options set yet — add some via "Edit existing fields."</HelpText>}
            </div>
          );
        }
        if (f.type === 'date') {
          return (
            <div key={f.id}>
              <span className="wv-field-lbl">{f.label}</span>
              <input className="wv-field-box" type="date" defaultValue={val} onChange={function (e) {
                var cf = Object.assign({}, draft.customFields || {});
                cf[f.id] = e.target.value;
                update({ customFields: cf });
              }} />
            </div>
          );
        }
        return (
          <Field
            key={f.id}
            label={f.label}
            defaultValue={val}
            placeholder={'Enter ' + f.label.toLowerCase() + '...'}
            resizeMode={f.type === 'long_text' ? 'manual' : 'auto'}
            rows={f.type === 'long_text' ? 3 : undefined}
            onBlur={function (e) {
              var cf = Object.assign({}, draft.customFields || {});
              cf[f.id] = e.target.value;
              update({ customFields: cf });
            }}
          />
        );
      })}

      <SecondaryButton data-tour="add-field-btn" icon="add" onClick={function () { setShowAddField(true); }}>Add new field</SecondaryButton>
      {draftFieldDefs.length > 0 && (
        <TertiaryButton onClick={function () { setShowEditFields(true); }}>Edit existing fields</TertiaryButton>
      )}

      {showAddField && (
        <AddFieldModal app={app} pid={pid} onClose={function () { setShowAddField(false); }} />
      )}

      {showEditFields && (
        <ManageFieldsModal app={app} pid={pid} fields={draftFieldDefs} onClose={function () { setShowEditFields(false); }} />
      )}

    </Drawer>
  );
}

// ── Add new field ──
function AddFieldModal({ app, pid, onClose }) {
  var sl = useState(''); var label = sl[0]; var setLabel = sl[1];
  var st = useState('short_text'); var type = st[0]; var setType = st[1];
  var sc = useState(''); var refSpool = sc[0]; var setRefSpool = sc[1];
  var so = useState([]); var options = so[0]; var setOptions = so[1];

  var collections = Object.keys(app.allStrands[pid] || {});
  var canSubmit = label.trim() && (type !== 'strand_ref' || refSpool);

  function submit() {
    if (!canSubmit) return;
    var fieldDef = { id: genId(), label: label.trim(), type: type };
    if (type === 'strand_ref') fieldDef.refSpool = refSpool;
    if (type === 'select') fieldDef.options = options;
    app.addDraftFieldDef(pid, fieldDef);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-box" style={{ width: 360 }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginBottom: 16 }}>Add field</div>

        <div style={{ marginBottom: 12 }}>
          <span className="wv-field-lbl">Label</span>
          <input className="wv-field-box" autoFocus value={label} onChange={function (e) { setLabel(e.target.value); }} placeholder="Field name" onKeyDown={function (e) { if (e.key === 'Enter') submit(); }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <span className="wv-field-lbl">Type</span>
          <select className="wv-field-box" value={type} onChange={function (e) { setType(e.target.value); setRefSpool(''); setOptions([]); }}>
            {FIELD_TYPES.map(function (t) { return <option key={t.id} value={t.id}>{t.label}</option>; })}
          </select>
        </div>

        {type === 'strand_ref' && (
          <div style={{ marginBottom: 4 }}>
            <span className="wv-field-lbl">Spool collection</span>
            <select className="wv-field-box" value={refSpool} onChange={function (e) { setRefSpool(e.target.value); }}>
              <option value="">Choose a collection...</option>
              {collections.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
            </select>
            {collections.length === 0 && <HelpText style={{ marginTop: 4 }}>No spool collections in this project yet.</HelpText>}
          </div>
        )}

        {type === 'select' && (
          <div style={{ marginBottom: 4 }}>
            <span className="wv-field-lbl">Options</span>
            <OptionsEditor options={options} onChange={setOptions} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }}><PrimaryButton onClick={submit} disabled={!canSubmit}>Add field</PrimaryButton></div>
        </div>
      </div>
    </div>
  );
}

// ── Edit existing fields — reorder, rename, retype, rescope, delete ──
function ManageFieldsModal({ app, pid, fields, onClose }) {
  var se = useState(fields.slice()); var editing = se[0]; var setEditing = se[1];
  var collections = Object.keys(app.allStrands[pid] || {});

  function updateLocal(i, changes) {
    var nf = editing.slice();
    nf[i] = Object.assign({}, nf[i], changes);
    setEditing(nf);
  }
  function removeLocal(i) {
    var nf = editing.slice();
    nf.splice(i, 1);
    setEditing(nf);
  }
  function save() {
    if (app.reorderDraftFieldDefs) app.reorderDraftFieldDefs(pid, editing);
    onClose();
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-box" style={{ width: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600, marginBottom: 14 }}>Edit fields</div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {editing.length === 0 && <HelpText>No custom fields yet.</HelpText>}
          {editing.map(function (f, i) {
            return (
              <div key={f.id} draggable={true}
                onDragStart={function (e) { e.dataTransfer.setData('fieldIdx', '' + i); }}
                onDragOver={function (e) { e.preventDefault(); }}
                onDrop={function (e) {
                  e.preventDefault();
                  var from = parseInt(e.dataTransfer.getData('fieldIdx'), 10);
                  if (isNaN(from) || from === i) return;
                  var nf = editing.slice();
                  var item = nf.splice(from, 1)[0];
                  nf.splice(i, 0, item);
                  setEditing(nf);
                }}
                style={{ borderBottom: '1px solid var(--bg2)', padding: '8px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span className="mi" style={{ fontSize: 18, color: 'var(--border)', cursor: 'grab', flexShrink: 0 }}>drag_indicator</span>
                  <input defaultValue={f.label} style={{ maxWidth: 120, fontSize: 13 }} onBlur={function (e) { updateLocal(i, { label: e.target.value }); }} />
                  <select value={f.type} style={{ width: 100, fontSize: 13 }} onChange={function (e) { updateLocal(i, { type: e.target.value, refSpool: null, options: null }); }}>
                    {FIELD_TYPES.map(function (t) { return <option key={t.id} value={t.id}>{t.label}</option>; })}
                  </select>
                  <button className="btn-icon" onClick={function () { removeLocal(i); }} aria-label={'Delete ' + f.label}>
                    <span className="mi" style={{ fontSize: 16, color: 'var(--danger)' }}>delete</span>
                  </button>
                </div>
                {f.type === 'strand_ref' && (
                  <div style={{ marginTop: 6, marginLeft: 26 }}>
                    <select value={f.refSpool || ''} style={{ fontSize: 11, width: '100%' }} onChange={function (e) { updateLocal(i, { refSpool: e.target.value }); }}>
                      <option value="">Pick spool...</option>
                      {collections.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
                    </select>
                  </div>
                )}
                {f.type === 'select' && (
                  <div style={{ marginTop: 2, marginLeft: 26 }}>
                    <OptionsEditor options={f.options} onChange={function (opts) { updateLocal(i, { options: opts }); }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexShrink: 0 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }}><PrimaryButton onClick={save}>Save</PrimaryButton></div>
        </div>
      </div>
    </div>
  );
}
