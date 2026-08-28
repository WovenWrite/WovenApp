// @ts-nocheck
// ── ProjectDrawer ──
// The dashboard's project settings drawer. Replaces ProjectEditPanel.
//
// Layered like the other drawers: an overview layer with the cover image,
// core fields and progress, then drill-ins for the things that need room.
//
//   Layer 1 'main'       — cover, title, synopsis, type, progress, links out
//   Layer 2 'structure'  — what a draft is called, ordering, cover images
//   Layer 2 'statuses'   — rename and recolour (loose_thread is locked)
//   Layer 2 'properties' — draft custom fields
//   Layer 2 'goals'      — deadline and writing pace
//
//   <ProjectDrawer proj={proj} app={app} open={true} onClose={fn} />
//
// Everything below the progress block writes through app.updateProjectConfig.
// Nothing outside the wizard READS most of this yet — cards still show
// thumbnails regardless, statuses are still global, labels still say "Draft".
// That wiring is the next phase.

import { useState } from 'react';
import {
  Drawer, Field, HelpText, CategoryLink, DraftThumbnailUpload,
  Radio, CustomColorPicker, OptionsEditor
} from './SharedUI';
import {
  PROJ_TYPES, SEQUENCE_MODES, GOAL_MODES, DEFAULT_STATUSES,
  projConfig, projStatuses, projLabel, projGoal, daysUntilDue, isSystemStatus
} from './projectConfig';
import { FIELD_TYPES, genId } from './utils';

// ── Archive confirmation ──
function ArchiveConfirm({ proj, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span className="mi" style={{ fontSize: 28, color: 'var(--indigo)' }}>inventory_2</span>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Archive this project?</div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--body-text)', lineHeight: 1.6, marginBottom: 12 }}>
          <strong style={{ color: 'var(--text)' }}>{proj.title || 'Untitled'}</strong> and all its content will be hidden from your dashboard.
        </div>
        <div style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 20 }}>
          You can restore it any time from <strong>Your Archive</strong> on the dashboard.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onConfirm}>
            <span className="mi" style={{ fontSize: 16 }}>inventory_2</span>Archive project
          </button>
        </div>
      </div>
    </div>
  );
}

// ── A drill-in row that is not built yet ──
function ComingSoonRow({ icon, title, note }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
        border: '1px solid var(--border)', borderRadius: 'var(--r)',
        marginBottom: 6, opacity: .6, cursor: 'default'
      }}
    >
      <span className="mi" style={{ fontSize: 18, color: 'var(--mid)', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
        {note && <div style={{ fontSize: 12, color: 'var(--mid)' }}>{note}</div>}
      </div>
      <span
        style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase',
          color: 'var(--indigo)', background: 'rgba(196,94,40,.08)',
          border: '1px solid rgba(196,94,40,.2)', borderRadius: 20, padding: '3px 8px', flexShrink: 0
        }}
      >Coming soon</span>
    </div>
  );
}

// ── One number in the progress block ──
function Stat({ value, label }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--mid)', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Toggle switch ──
function Toggle({ on, onClick, label, help }) {
  return (
    <div>
      <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0' }}>
        <span style={{ width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative', background: on ? 'var(--indigo)' : 'var(--bg3)', transition: 'background .15s' }}>
          <span style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(42,31,16,.25)' }} />
        </span>
        <span style={{ fontSize: 13, color: 'var(--text)' }}>{label}</span>
      </div>
      {help && <HelpText style={{ marginTop: 0 }}>{help}</HelpText>}
    </div>
  );
}

export default function ProjectDrawer({ proj, app, variant, open, onClose, topOffset }) {
  var sv = useState('main'); var view = sv[0]; var setView = sv[1];
  var sac = useState(false); var archiveConfirm = sac[0]; var setArchiveConfirm = sac[1];

  if (!proj) return null;

  var pid = proj.id;
  var cfg = projConfig(proj);
  var drafts = (app.allDrafts[pid] || []).filter(function (d) { return !d.archived; });
  var fieldDefs = proj.draftFieldDefs || [];
  var statuses = projStatuses(proj);
  var one = projLabel(proj, 'draft');
  var many = projLabel(proj, 'drafts');

  function setConfig(patch) {
    if (app.updateProjectConfig) app.updateProjectConfig(pid, patch);
  }
  function back() { setView('main'); }

  // ── Layer 2: structure ──
  if (view === 'structure') {
    return (
      <Drawer variant={variant || 'overlay'} open={open} title="Structure" onBack={back} onClose={onClose} topOffset={topOffset}>
        <div>
          <span className="wv-field-lbl">What is one piece of writing called?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              key={pid + '-lo'}
              defaultValue={one}
              placeholder="Draft"
              style={{ flex: 1 }}
              onBlur={function (e) {
                var v = e.target.value.trim() || 'Draft';
                setConfig({ labels: Object.assign({}, cfg.labels, { draft: v }) });
              }}
            />
            <input
              key={pid + '-lm'}
              defaultValue={many}
              placeholder="Drafts"
              style={{ flex: 1 }}
              onBlur={function (e) {
                var v = e.target.value.trim() || (one + 's');
                setConfig({ labels: Object.assign({}, cfg.labels, { drafts: v }) });
              }}
            />
          </div>
          <HelpText style={{ marginTop: 6 }}>Singular, then plural.</HelpText>
        </div>

        <div>
          <span className="wv-field-lbl">How are they ordered?</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {SEQUENCE_MODES.map(function (m) {
              return (
                <div key={m.id}>
                  <Radio on={cfg.sequenceMode === m.id} onClick={function () { setConfig({ sequenceMode: m.id }); }} label={m.label} />
                  <div style={{ fontSize: 12, color: 'var(--mid)', marginLeft: 28, marginTop: -2 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <span className="wv-field-lbl">Cover images</span>
          <Toggle
            on={cfg.draftThumbnails}
            onClick={function () { setConfig({ draftThumbnails: !cfg.draftThumbnails }); }}
            label={'Show a cover image on each storyboard card'}
            help="Off makes the cards more compact."
          />
        </div>
      </Drawer>
    );
  }

  // ── Layer 2: statuses ──
  if (view === 'statuses') {
    function updateStatus(id, changes) {
      var next = statuses.map(function (s) {
        return s.id !== id ? s : Object.assign({}, s, changes);
      });
      setConfig({ statuses: next });
    }
    return (
      <Drawer variant={variant || 'overlay'} open={open} title="Statuses" onBack={back} onClose={onClose} topOffset={topOffset}>
        <HelpText>Rename and recolour these to match how you work. The set itself is fixed for now.</HelpText>
        {statuses.map(function (s) {
          var isSys = isSystemStatus(s.id);
          var base = DEFAULT_STATUSES.find(function (d) { return d.id === s.id; });
          return (
            <div key={s.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <input
                  key={pid + '-' + s.id}
                  defaultValue={s.label}
                  placeholder={base ? base.label : ''}
                  style={{ flex: 1, fontSize: 13 }}
                  onBlur={function (e) {
                    var v = e.target.value.trim();
                    updateStatus(s.id, { label: v || (base ? base.label : s.label) });
                  }}
                />
                {isSys && (
                  <span className="mi" style={{ fontSize: 16, color: 'var(--placeholder)' }} title="This status cannot be removed">lock</span>
                )}
              </div>
              <CustomColorPicker color={s.color} onSelect={function (c) { updateStatus(s.id, { color: c }); }} />
            </div>
          );
        })}
        <button
          className="btn btn-ghost btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={function () { setConfig({ statuses: null }); }}
        >
          <span className="mi" style={{ fontSize: 14 }}>restart_alt</span> Reset to defaults
        </button>
      </Drawer>
    );
  }

  // ── Layer 2: draft properties ──
  if (view === 'properties') {
    function addField() {
      app.addDraftFieldDef(pid, { id: genId(), label: 'New property', type: 'short_text' });
    }
    function editField(fieldId, changes) {
      app.updateDraftFieldDef(pid, fieldId, changes);
    }
    var collections = Object.keys(app.allStrands[pid] || {});
    return (
      <Drawer variant={variant || 'overlay'} open={open} title={one + ' properties'} onBack={back} onClose={onClose} topOffset={topOffset}>
        {fieldDefs.length === 0 && <HelpText>No properties yet. Add one below.</HelpText>}
        {fieldDefs.map(function (f) {
          return (
            <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 8 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input
                  key={pid + '-f-' + f.id}
                  defaultValue={f.label}
                  placeholder="Property name"
                  style={{ flex: 1, fontSize: 13 }}
                  onBlur={function (e) { if (e.target.value.trim()) editField(f.id, { label: e.target.value.trim() }); }}
                />
                <select
                  value={f.type}
                  onChange={function (e) { editField(f.id, { type: e.target.value }); }}
                  style={{ fontSize: 12, width: 110 }}
                >
                  {FIELD_TYPES.map(function (ft) { return <option key={ft.id} value={ft.id}>{ft.label}</option>; })}
                </select>
                <button className="btn-icon" onClick={function () { app.removeDraftFieldDef(pid, f.id); }} aria-label="Remove property">
                  <span className="mi" style={{ fontSize: 16, color: 'var(--danger)' }}>delete</span>
                </button>
              </div>
              {f.type === 'select' && (
                <div style={{ marginTop: 8 }}>
                  <span className="wv-field-lbl">Options</span>
                  <OptionsEditor options={f.options || []} onChange={function (opts) { editField(f.id, { options: opts }); }} />
                </div>
              )}
              {f.type === 'strand_ref' && (
                <div style={{ marginTop: 8 }}>
                  <span className="wv-field-lbl">Spool collection</span>
                  <select
                    value={f.refSpool || ''}
                    onChange={function (e) { editField(f.id, { refSpool: e.target.value }); }}
                    style={{ fontSize: 12, width: '100%' }}
                  >
                    <option value="">Choose a collection...</option>
                    {collections.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
                  </select>
                </div>
              )}
            </div>
          );
        })}
        <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={addField}>
          <span className="mi" style={{ fontSize: 14 }}>add</span> Add property
        </button>
      </Drawer>
    );
  }

  // ── Layer 2: goals ──
  if (view === 'goals') {
    return (
      <Drawer variant={variant || 'overlay'} open={open} title="Deadline and pace" onBack={back} onClose={onClose} topOffset={topOffset}>
        <div>
          <span className="wv-field-lbl">Deadline</span>
          <input
            type="date"
            value={cfg.dueDate || ''}
            onChange={function (e) { setConfig({ dueDate: e.target.value || null }); }}
            style={{ width: '100%' }}
          />
          <HelpText style={{ marginTop: 6 }}>Nothing happens at the deadline — it is yours to aim at.</HelpText>
        </div>

        <div>
          <span className="wv-field-lbl">Writing pace</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {GOAL_MODES.map(function (m) {
              return (
                <div key={m.id}>
                  <Radio
                    on={cfg.goalMode === m.id}
                    onClick={function () { setConfig(m.id === 'none' ? { goalMode: 'none', goalWords: 0 } : { goalMode: m.id }); }}
                    label={m.label}
                  />
                  <div style={{ fontSize: 12, color: 'var(--mid)', marginLeft: 28, marginTop: -2 }}>{m.desc}</div>
                </div>
              );
            })}
          </div>
          {cfg.goalMode !== 'none' && (
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                key={pid + '-gw'}
                type="number"
                min="0"
                defaultValue={cfg.goalWords || ''}
                placeholder={cfg.goalMode === 'daily' ? '500' : '3500'}
                style={{ width: 120 }}
                onBlur={function (e) {
                  var n = parseInt(e.target.value, 10);
                  setConfig({ goalWords: n > 0 ? n : 0 });
                }}
              />
              <span style={{ fontSize: 13, color: 'var(--mid)' }}>
                words per {cfg.goalMode === 'daily' ? 'day' : 'week'}
              </span>
            </div>
          )}
          <HelpText style={{ marginTop: 8 }}>
            This is separate from your overall daily goal on the dashboard.
          </HelpText>
        </div>
      </Drawer>
    );
  }

  // ── Layer 1: overview ──
  var totalWords = drafts.reduce(function (s, d) { return s + (d.wordCount || 0); }, 0);
  var sequenced = drafts.filter(function (d) { return d.status !== 'loose_thread'; });
  var looseCount = drafts.length - sequenced.length;
  var byStatus = statuses.map(function (s) {
    return { status: s, count: drafts.filter(function (d) { return d.status === s.id; }).length };
  }).filter(function (r) { return r.count > 0; });

  var days = daysUntilDue(proj);
  var goal = projGoal(proj);

  var footer = (
    <button
      className="btn btn-ghost"
      style={{ color: 'var(--danger)', width: '100%', justifyContent: 'center' }}
      onClick={function () { setArchiveConfirm(true); }}
    >
      <span className="mi" style={{ fontSize: 16 }}>inventory_2</span>Archive this project
    </button>
  );

  return (
    <Drawer variant={variant || 'overlay'} open={open} title="Project" onClose={onClose} footer={footer} topOffset={topOffset}>
      <div>
        <DraftThumbnailUpload image={proj.image || null} onUpload={function (url) { app.updateProjectImage(pid, url); }} />
        {proj.image && (
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={function () { app.updateProjectImage(pid, null); }}>
            <span className="mi" style={{ fontSize: 14 }}>close</span>Remove cover
          </button>
        )}
      </div>

      <Field
        label="Title"
        key={pid + '-t'}
        defaultValue={proj.title || ''}
        placeholder="Untitled project"
        onBlur={function (e) { if (e.target.value.trim()) app.updateProjectTitle(pid, e.target.value.trim()); }}
      />

      <Field
        label="Synopsis"
        key={pid + '-s'}
        defaultValue={proj.synopsis || ''}
        placeholder="What is this about?"
        onBlur={function (e) { app.updateProjectSynopsis(pid, e.target.value); }}
      />

      <div>
        <span className="wv-field-lbl">Type</span>
        {(function () {
          var knownLabel = PROJ_TYPES.some(function (t) { return t.label === proj.type; });
          var selectValue = knownLabel ? proj.type : 'Other';
          return (
            <div>
              <select
                value={selectValue}
                onChange={function (e) { app.updateProjectType(pid, e.target.value); }}
                style={{ width: '100%' }}
              >
                {PROJ_TYPES.map(function (t) { return <option key={t.id} value={t.label}>{t.label}</option>; })}
              </select>
              {selectValue === 'Other' && (
                <input
                  key={pid + '-ot'}
                  defaultValue={proj.type === 'Other' ? '' : proj.type}
                  placeholder="Name this type of project..."
                  style={{ width: '100%', marginTop: 8 }}
                  onBlur={function (e) {
                    var v = e.target.value.trim();
                    app.updateProjectType(pid, v || 'Other');
                  }}
                />
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Progress ── */}
      <div>
        <span className="wv-field-lbl">Progress</span>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 12 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: byStatus.length ? 12 : 0 }}>
            <Stat value={totalWords.toLocaleString()} label={totalWords === 1 ? 'word' : 'words'} />
            <Stat value={sequenced.length} label={sequenced.length === 1 ? one.toLowerCase() : many.toLowerCase()} />
            <Stat value={looseCount} label={looseCount === 1 ? 'loose thread' : 'loose threads'} />
          </div>

          {byStatus.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {byStatus.map(function (r) {
                var pct = drafts.length ? Math.round(r.count / drafts.length * 100) : 0;
                return (
                  <div key={r.status.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.status.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--body-text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.status.label}</span>
                    <span style={{ fontSize: 12, color: 'var(--mid)', flexShrink: 0 }}>{r.count}</span>
                    <div style={{ width: 54, height: 4, borderRadius: 2, background: 'var(--bg3)', flexShrink: 0, overflow: 'hidden' }}>
                      <div style={{ width: pct + '%', height: '100%', background: r.status.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {(days !== null || goal) && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {days !== null && (
                <div style={{ fontSize: 12, color: days < 0 ? 'var(--danger)' : 'var(--body-text)' }}>
                  <span className="mi" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 5 }}>event</span>
                  {days < 0
                    ? Math.abs(days) + ' day' + (Math.abs(days) === 1 ? '' : 's') + ' past deadline'
                    : days === 0 ? 'Deadline is today' : days + ' day' + (days === 1 ? '' : 's') + ' to deadline'}
                </div>
              )}
              {goal && (
                <div style={{ fontSize: 12, color: 'var(--body-text)' }}>
                  <span className="mi" style={{ fontSize: 13, verticalAlign: '-2px', marginRight: 5 }}>flag</span>
                  {goal.label}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Settings drill-ins ── */}
      <div>
        <span className="wv-field-lbl">Settings</span>
        <CategoryLink title="Structure" onClick={function () { setView('structure'); }} />
        <CategoryLink title="Statuses" onClick={function () { setView('statuses'); }} />
        <CategoryLink title={one + ' properties'} onClick={function () { setView('properties'); }} />
        <CategoryLink title="Deadline and pace" onClick={function () { setView('goals'); }} />
      </div>

      {/* ── Not built yet ── */}
      <div>
        <span className="wv-field-lbl">Sharing</span>
        <ComingSoonRow icon="link" title="Public links" note="Read-only links you have shared from this project." />
        <ComingSoonRow icon="group" title="Contributors" note="Co-writers, editors and readers." />
      </div>

      {archiveConfirm && (
        <ArchiveConfirm
          proj={proj}
          onCancel={function () { setArchiveConfirm(false); }}
          onConfirm={function () { app.archiveProject(pid); setArchiveConfirm(false); onClose(); }}
        />
      )}
    </Drawer>
  );
}
