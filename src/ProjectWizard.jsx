// @ts-nocheck
// ── ProjectWizard ──
// Four steps: type → name → spools → structure.
//
// The type chosen in step 0 seeds everything downstream: the spool
// collections, the sequence mode, the thumbnail setting, what a single piece
// of writing is called, and the draft custom fields. Step 3 shows those
// choices already made so the user confirms rather than configures — every
// one of them is editable later in the project drawer.
//
//   <ProjectWizard app={app} onClose={fn} />

import { useState, useEffect, useRef } from 'react';
import { Radio, HelpText, DraftThumbnailUpload, OptionsEditor } from './SharedUI';
import {
  PROJ_TYPES, SEQUENCE_MODES, GOAL_MODES, presetFor, buildConfig, presetDraftFields, defaultFields
} from './projectConfig';
import { genId, FIELD_TYPES } from './utils';

var ALL_COLLS = [
  'Characters', 'Locations', 'Lore & World', 'Sources', 'Interviews',
  'Subjects', 'Scenes', 'Plot Threads', 'Topics', 'Audience Notes', 'Reports'
];

var STEP_TITLES = [
  'What are you writing?',
  'Name your project',
  'Your spools',
  'How it is structured',
  'Deadline and pace'
];

export default function ProjectWizard({ app, onClose }) {
  var ss = useState(0); var step = ss[0]; var setStep = ss[1];
  var spt = useState(null); var projType = spt[0]; var setProjType = spt[1];
  var st = useState(''); var title = st[0]; var setTitle = st[1];
  var ssyn = useState(''); var synopsis = ssyn[0]; var setSynopsis = ssyn[1];
  var sim = useState(null); var image = sim[0]; var setImage = sim[1];
  var ssc = useState([]); var selectedColls = ssc[0]; var setSelectedColls = ssc[1];

  // Structure step — prefilled from the type preset, editable before create
  var ssq = useState('numeric'); var seqMode = ssq[0]; var setSeqMode = ssq[1];
  var sth = useState(true); var thumbnails = sth[0]; var setThumbnails = sth[1];
  var sls = useState('Draft'); var labelOne = sls[0]; var setLabelOne = sls[1];
  var slp = useState('Drafts'); var labelMany = slp[0]; var setLabelMany = slp[1];
  var sfd = useState([]); var fields = sfd[0]; var setFields = sfd[1];

  // Goals step
  var sdd = useState(''); var dueDate = sdd[0]; var setDueDate = sdd[1];
  var sgm = useState('none'); var goalMode = sgm[0]; var setGoalMode = sgm[1];
  var sgw = useState(''); var goalWords = sgw[0]; var setGoalWords = sgw[1];

  var titleRef = useRef(null);
  useEffect(function () { if (step === 1 && titleRef.current) titleRef.current.focus(); }, [step]);

  function selectType(t) {
    var preset = presetFor(t.id);
    var cfg = preset.config || {};
    var labels = cfg.labels || {};
    setProjType(t);
    setSelectedColls(t.colls || []);
    setSeqMode(cfg.sequenceMode || 'numeric');
    setThumbnails(cfg.draftThumbnails === undefined ? true : !!cfg.draftThumbnails);
    setLabelOne(labels.draft || 'Draft');
    setLabelMany(labels.drafts || 'Drafts');
    setFields(presetDraftFields(t.id));
    setStep(1);
  }

  function toggleColl(c) {
    setSelectedColls(function (sc) {
      return sc.includes(c) ? sc.filter(function (x) { return x !== c; }) : sc.concat([c]);
    });
  }

  // Typing a singular keeps the plural in step unless the user has edited it
  // themselves — avoids "Chapter / Drafts" while still allowing "Entry /
  // Entries" to be corrected by hand.
  var pluralTouched = useRef(false);
  function onLabelOneChange(v) {
    setLabelOne(v);
    if (!pluralTouched.current) setLabelMany(v.trim() ? v.trim() + 's' : '');
  }

  // ── Draft properties (step 3) ──
  function addField(label, type) {
    setFields(function (f) {
      return f.concat([{ id: genId(), label: label.trim(), type: type || 'short_text' }]);
    });
  }
  function updateField(i, changes) {
    setFields(function (f) {
      var next = f.slice();
      next[i] = Object.assign({}, next[i], changes);
      if (changes.type && changes.type !== 'select') delete next[i].options;
      if (changes.type && changes.type !== 'strand_ref') delete next[i].refSpool;
      return next;
    });
  }
  function removeField(i) {
    setFields(function (f) { var next = f.slice(); next.splice(i, 1); return next; });
  }

  function create() {
    if (!title.trim()) return;
    var typeId = projType ? projType.id : 'other';
    var pid = genId();
    var now = new Date().toISOString();

    var one = labelOne.trim() || 'Draft';
    var many = labelMany.trim() || (one + 's');
    var labels = (one === 'Draft' && many === 'Drafts') ? {} : { draft: one, drafts: many };

    var words = parseInt(goalWords, 10);
    if (!(words > 0)) words = 0;
    var mode = words > 0 ? goalMode : 'none';

    var config = buildConfig(typeId, {
      sequenceMode: seqMode,
      draftThumbnails: thumbnails,
      labels: labels,
      dueDate: dueDate || null,
      goalMode: mode,
      goalWords: words
    });

    var proj = {
      id: pid,
      title: title.trim(),
      type: projType ? projType.label : 'Other',
      typeId: typeId,
      synopsis: synopsis.trim(),
      image: image || null,
      lastEdited: now,
      createdAt: now,
      config: config,
      draftFieldDefs: fields.filter(function (f) { return f.label && f.label.trim(); })
    };

    var tpls = selectedColls.map(function (c) {
      return { id: genId(), projectId: pid, name: c, fields: defaultFields(c), sharedWith: [] };
    });
    var strandsObj = {};
    selectedColls.forEach(function (c) { strandsObj[c] = []; });

    app.createProject(proj, { templates: tpls, strandsObj: strandsObj });
    onClose();
    app.loadProjectData(pid);
    app.setProjId(pid);
    app.setView('cards');
  }

  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-box">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>{STEP_TITLES[step]}</div>
          <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
        </div>

        <div style={{ minHeight: 220 }}>

          {step === 0 && (
            <div className="wizard-type-grid">
              {PROJ_TYPES.map(function (t) {
                return (
                  <div key={t.id} className={'wizard-type-card' + (projType && projType.id === t.id ? ' sel' : '')} onClick={function () { selectType(t); }}>
                    <div style={{ marginBottom: 8 }}><span className="mi" style={{ fontSize: 26, color: 'var(--indigoL)' }}>{t.icon}</span></div>
                    <div style={{ fontFamily: 'var(--serif)', fontSize: 16, fontWeight: 600, marginBottom: 3 }}>{t.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--mid)' }}>{t.desc}</div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <span className="wv-field-lbl">Cover image</span>
                <DraftThumbnailUpload image={image} onUpload={setImage} />
                {image && (
                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={function () { setImage(null); }}>
                    <span className="mi" style={{ fontSize: 14 }}>close</span>Remove
                  </button>
                )}
              </div>
              <input
                ref={titleRef}
                style={{ fontSize: 18, padding: '12px 14px', background: 'var(--bg2)', border: '2px solid var(--border)', borderRadius: 10, width: '100%', marginBottom: 14, color: 'var(--text)', fontFamily: 'var(--serif)', fontWeight: 600 }}
                value={title}
                onChange={function (e) { setTitle(e.target.value); }}
                placeholder="Working title..."
                onKeyDown={function (e) { if (e.key === 'Enter' && title.trim()) setStep(2); }}
              />
              <textarea
                style={{ fontSize: 14, padding: '10px 14px', background: 'var(--bg2)', border: '2px solid var(--border)', borderRadius: 10, width: '100%', color: 'var(--text)', marginBottom: 14 }}
                value={synopsis}
                onChange={function (e) { setSynopsis(e.target.value); }}
                placeholder="What is this about? (optional)"
                rows={3}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={function () { setStep(0); }}>Back</button>
                <button className="btn btn-primary" onClick={function () { setStep(2); }} disabled={!title.trim()}>Next</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 14 }}>
                Spools hold the things your story keeps coming back to. Add more any time.
              </div>
              <div className="wizard-coll-tags" style={{ marginBottom: 20 }}>
                {ALL_COLLS.map(function (c) {
                  return (
                    <span key={c} className={'wizard-coll-tag' + (selectedColls.includes(c) ? ' sel' : '')} onClick={function () { toggleColl(c); }}>{c}</span>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-ghost" onClick={function () { setStep(1); }}>Back</button>
                <button className="btn btn-primary" onClick={function () { setStep(3); }}>Next</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">What is one piece of writing called?</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={labelOne}
                    onChange={function (e) { onLabelOneChange(e.target.value); }}
                    placeholder="Draft"
                    style={{ flex: 1 }}
                  />
                  <input
                    value={labelMany}
                    onChange={function (e) { pluralTouched.current = true; setLabelMany(e.target.value); }}
                    placeholder="Drafts"
                    style={{ flex: 1 }}
                  />
                </div>
                <HelpText style={{ marginTop: 6 }}>Singular, then plural.</HelpText>
              </div>

              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">How are they ordered?</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {SEQUENCE_MODES.map(function (m) {
                    return (
                      <div key={m.id}>
                        <Radio on={seqMode === m.id} onClick={function () { setSeqMode(m.id); }} label={m.label} />
                        <div style={{ fontSize: 12, color: 'var(--mid)', marginLeft: 28, marginTop: -2 }}>{m.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">Cover images</span>
                <div
                  onClick={function () { setThumbnails(!thumbnails); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '8px 0' }}
                >
                  <span
                    style={{
                      width: 36, height: 20, borderRadius: 10, flexShrink: 0, position: 'relative',
                      background: thumbnails ? 'var(--indigo)' : 'var(--bg3)', transition: 'background .15s'
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: thumbnails ? 18 : 2, width: 16, height: 16,
                      borderRadius: '50%', background: '#fff', transition: 'left .15s',
                      boxShadow: '0 1px 3px rgba(42,31,16,.25)'
                    }} />
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text)' }}>
                    Show a cover image on each storyboard card
                  </span>
                </div>
                <HelpText style={{ marginTop: 2 }}>Off makes the cards more compact.</HelpText>
              </div>

              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">Properties for each {labelOne.trim().toLowerCase() || 'draft'}</span>
                {fields.length === 0 && <HelpText>None yet. Add one below, or skip and add them later.</HelpText>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {fields.map(function (f, i) {
                    return (
                      <div key={f.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 8 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            value={f.label}
                            onChange={function (e) { updateField(i, { label: e.target.value }); }}
                            placeholder="Property name"
                            style={{ flex: 1, fontSize: 13 }}
                          />
                          <select
                            value={f.type}
                            onChange={function (e) { updateField(i, { type: e.target.value }); }}
                            style={{ fontSize: 12, width: 110 }}
                          >
                            {FIELD_TYPES.map(function (ft) { return <option key={ft.id} value={ft.id}>{ft.label}</option>; })}
                          </select>
                          <button className="btn-icon" onClick={function () { removeField(i); }} aria-label="Remove property">
                            <span className="mi" style={{ fontSize: 16, color: 'var(--danger)' }}>delete</span>
                          </button>
                        </div>
                        {f.type === 'select' && (
                          <div style={{ marginTop: 8 }}>
                            <span className="wv-field-lbl">Options</span>
                            <OptionsEditor options={f.options || []} onChange={function (opts) { updateField(i, { options: opts }); }} />
                          </div>
                        )}
                        {f.type === 'strand_ref' && (
                          <div style={{ marginTop: 8 }}>
                            <span className="wv-field-lbl">Spool collection</span>
                            <select
                              value={f.refSpool || ''}
                              onChange={function (e) { updateField(i, { refSpool: e.target.value }); }}
                              style={{ fontSize: 12, width: '100%' }}
                            >
                              <option value="">Choose a collection...</option>
                              {selectedColls.map(function (c) { return <option key={c} value={c}>{c}</option>; })}
                            </select>
                            {selectedColls.length === 0 && <HelpText style={{ marginTop: 4 }}>Pick some spools on the previous step first.</HelpText>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                  onClick={function () { addField('', 'short_text'); }}
                >
                  <span className="mi" style={{ fontSize: 14 }}>add</span> Add property
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-ghost" onClick={function () { setStep(2); }}>Back</button>
                <button className="btn btn-primary" onClick={function () { setStep(4); }}>Next</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">Deadline</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={function (e) { setDueDate(e.target.value); }}
                  style={{ width: '100%' }}
                />
                <HelpText style={{ marginTop: 6 }}>Optional. Nothing happens at the deadline — it is yours to aim at.</HelpText>
              </div>

              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">Writing pace</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {GOAL_MODES.map(function (m) {
                    return (
                      <div key={m.id}>
                        <Radio on={goalMode === m.id} onClick={function () { setGoalMode(m.id); }} label={m.label} />
                        <div style={{ fontSize: 12, color: 'var(--mid)', marginLeft: 28, marginTop: -2 }}>{m.desc}</div>
                      </div>
                    );
                  })}
                </div>
                {goalMode !== 'none' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number"
                      min="0"
                      value={goalWords}
                      onChange={function (e) { setGoalWords(e.target.value); }}
                      placeholder={goalMode === 'daily' ? '500' : '3500'}
                      style={{ width: 120 }}
                    />
                    <span style={{ fontSize: 13, color: 'var(--mid)' }}>
                      words per {goalMode === 'daily' ? 'day' : 'week'}
                    </span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <button className="btn btn-ghost" onClick={function () { setStep(3); }}>Back</button>
                <button className="btn btn-primary" onClick={create} disabled={!title.trim()}>Create Project</button>
              </div>
            </div>
          )}

        </div>

        <div className="wizard-dots">
          {STEP_TITLES.map(function (_, i) {
            return <div key={i} className={'wizard-dot' + (step === i ? ' active' : '')} />;
          })}
        </div>
      </div>
    </div>
  );
}
