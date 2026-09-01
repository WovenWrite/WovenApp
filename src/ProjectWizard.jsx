// @ts-nocheck
// ── ProjectWizard ──
// Five steps: type → name → spools → structure → goals.
//
// The type chosen in step 0 seeds everything downstream: the spool
// collections, the sequence mode, the thumbnail setting, what a single piece
// of writing is called, and the draft custom fields. Step 3 shows those
// choices already made so the user confirms rather than configures — every
// one of them is editable later in the project drawer.
//
//   <ProjectWizard app={app} onClose={fn} />

import { useState, useEffect, useRef } from 'react';
import {
  HelpText, DraftThumbnailUpload, OptionsEditor,
  InputField, Field, SelectField, Toggle, CardOptionGroup, useDrawerStyles
} from './SharedUI';
import {
  PROJ_TYPES, SEQUENCE_MODES, GOAL_MODES, presetFor, buildConfig, presetDraftFields, defaultFields
} from './projectConfig';
import { genId, FIELD_TYPES } from './utils';

var ALL_COLLS = [
  'Characters', 'Locations', 'Lore & World', 'Sources', 'Interviews',
  'Subjects', 'Scenes', 'Plot Threads', 'Topics', 'Audience Notes', 'Reports'
];

// Display order for the sequence-mode cards on the Structure step. Kept
// separate from SEQUENCE_MODES' own array order, which must stay
// numeric-first — sequenceMode()'s fallback and DEFAULT_CONFIG both assume
// index 0 is 'numeric'.
var SEQ_DISPLAY_ORDER = ['date', 'numeric', 'none'];

var STEP_TITLES = [
  'What are you writing?',
  'Name your project',
  'Add context to your project',
  'How it is structured',
  'Deadline and pace'
];

var FIELD_MAX_W = 220;

export default function ProjectWizard({ app, onClose }) {
  useDrawerStyles();

  var ss = useState(0); var step = ss[0]; var setStep = ss[1];
  var spt = useState(null); var projType = spt[0]; var setProjType = spt[1];
  var son = useState(''); var otherName = son[0]; var setOtherName = son[1];
  var st = useState(''); var title = st[0]; var setTitle = st[1];
  var ssyn = useState(''); var synopsis = ssyn[0]; var setSynopsis = ssyn[1];
  var sim = useState(null); var image = sim[0]; var setImage = sim[1];
  var swc = useState(true); var wantCover = swc[0]; var setWantCover = swc[1];
  var ssc = useState([]); var selectedColls = ssc[0]; var setSelectedColls = ssc[1];

  // Structure step — prefilled from the type preset, editable before create
  var ssq = useState('numeric'); var seqMode = ssq[0]; var setSeqMode = ssq[1];
  var sth = useState(true); var thumbnails = sth[0]; var setThumbnails = sth[1];
  var sls = useState('Draft'); var labelOne = sls[0]; var setLabelOne = sls[1];
  var sfd = useState([]); var fields = sfd[0]; var setFields = sfd[1];

  // Goals step
  var sdd = useState(''); var dueDate = sdd[0]; var setDueDate = sdd[1];
  var sgm = useState('none'); var goalMode = sgm[0]; var setGoalMode = sgm[1];
  var sgw = useState(''); var goalWords = sgw[0]; var setGoalWords = sgw[1];

  var titleRef = useRef(null);
  var otherRef = useRef(null);
  useEffect(function () { if (step === 1 && titleRef.current) titleRef.current.focus(); }, [step]);
  useEffect(function () { if (projType && projType.id === 'other' && otherRef.current) otherRef.current.focus(); }, [projType]);

  // Step titles — step 1 is dynamic ("Set up your Fiction Project" / "Set up
  // your Poetry Collection"), everything else is static.
  function stepTitle() {
    if (step === 1) {
      var label = projType
        ? (projType.id === 'other' ? (otherName.trim() || 'project') : projType.label)
        : 'project';
      return 'Set up your ' + label;
    }
    return STEP_TITLES[step];
  }

  function selectType(t) {
    var preset = presetFor(t.id);
    var cfg = preset.config || {};
    var labels = cfg.labels || {};
    setProjType(t);
    setOtherName('');
    setSelectedColls(t.colls || []);
    setSeqMode(cfg.sequenceMode || 'numeric');
    setThumbnails(cfg.draftThumbnails === undefined ? true : !!cfg.draftThumbnails);
    setLabelOne(labels.draft || 'Draft');
    setFields(presetDraftFields(t.id));
    // "Other" needs a name before it can proceed — stay on step 0 and show
    // the inline prompt instead of advancing immediately.
    if (t.id !== 'other') setStep(1);
  }

  function toggleColl(c) {
    setSelectedColls(function (sc) {
      return sc.includes(c) ? sc.filter(function (x) { return x !== c; }) : sc.concat([c]);
    });
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
    var many = one + 's';
    var labels = (one === 'Draft') ? {} : { draft: one, drafts: many };

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

    var typeLabel = (typeId === 'other' && otherName.trim())
      ? otherName.trim()
      : (projType ? projType.label : 'Other');

    var proj = {
      id: pid,
      title: title.trim(),
      type: typeLabel,
      typeId: typeId,
      synopsis: synopsis.trim(),
      image: (wantCover && image) || null,
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: step === 4 ? 4 : 20 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600 }}>{stepTitle()}</div>
          <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
        </div>
        {step === 4 && (
          <div style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 18 }}>
            Both are completely optional.
          </div>
        )}

        <div style={{ minHeight: 220 }}>

          {step === 0 && (
            <div>
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
              {projType && projType.id === 'other' && (
                <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                  <InputField
                    innerRef={otherRef}
                    label="What are you writing?"
                    value={otherName}
                    onChange={function (e) { setOtherName(e.target.value); }}
                    placeholder="Poetry collection, screenplay treatment..."
                    onKeyDown={function (e) { if (e.key === 'Enter' && otherName.trim()) setStep(1); }}
                  />
                  <HelpText style={{ marginTop: 6 }}>Give it a name so Woven knows what to call this kind of project.</HelpText>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                    <button className="btn btn-primary" disabled={!otherName.trim()} onClick={function () { setStep(1); }}>Continue</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: wantCover ? 10 : 0 }}>
                  <label className="wv-field-lbl" style={{ marginBottom: 0 }}>Cover image</label>
                  <Toggle
                    on={wantCover}
                    onClick={function () {
                      var next = !wantCover;
                      setWantCover(next);
                      if (!next) setImage(null);
                    }}
                  />
                </div>
                {wantCover && (
                  <div style={{ marginTop: 10 }}>
                    <DraftThumbnailUpload image={image} onUpload={setImage} />
                    {image && (
                      <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={function () { setImage(null); }}>
                        <span className="mi" style={{ fontSize: 14 }}>close</span>Remove
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ marginBottom: 14 }}>
                <InputField
                  innerRef={titleRef}
                  label="Project title"
                  value={title}
                  onChange={function (e) { setTitle(e.target.value); }}
                  placeholder="Working title..."
                  onKeyDown={function (e) { if (e.key === 'Enter' && title.trim()) setStep(2); }}
                  style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--serif)' }}
                />
              </div>
              <div style={{ marginBottom: 14 }}>
                <Field
                  label="Describe your project"
                  value={synopsis}
                  onChange={function (e) { setSynopsis(e.target.value); }}
                  placeholder="Optional — a line or two on what this is about"
                  rows={3}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <button className="btn btn-ghost" onClick={function () { setStep(0); }}>Back</button>
                <button className="btn btn-primary" onClick={function () { setStep(2); }} disabled={!title.trim()}>Next</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 14, color: 'var(--mid)', marginBottom: 14 }}>
                Build custom libraries for all supporting context with Spools. You can add and edit these at any time, but here are a few suggestions to get you started...
              </div>
              <div className="pw-spool-chips" style={{ marginBottom: 20 }}>
                {ALL_COLLS.map(function (c) {
                  return (
                    <span key={c} className={'pw-spool-chip' + (selectedColls.includes(c) ? ' sel' : '')} onClick={function () { toggleColl(c); }}>{c}</span>
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
                <InputField
                  label="What are elements of this project called?"
                  value={labelOne}
                  onChange={function (e) { setLabelOne(e.target.value); }}
                  placeholder="Chapter, Blog, Doc, etc."
                />
                <HelpText style={{ marginTop: 6 }}>We'll pluralize it automatically.</HelpText>
              </div>

              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">How should these be sequenced?</span>
                <CardOptionGroup
                  options={SEQ_DISPLAY_ORDER.map(function (id) { return SEQUENCE_MODES.find(function (m) { return m.id === id; }); })}
                  value={seqMode}
                  onChange={setSeqMode}
                />
              </div>

              <div style={{ marginBottom: 18 }}>
                <span className="sect-lbl">Cover images</span>
                <Toggle
                  on={thumbnails}
                  onClick={function () { setThumbnails(!thumbnails); }}
                  label="Show a cover image on each storyboard card"
                />
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
                <InputField
                  label="Deadline"
                  type="date"
                  value={dueDate}
                  onChange={function (e) { setDueDate(e.target.value); }}
                  style={{ maxWidth: FIELD_MAX_W }}
                />
                <HelpText style={{ marginTop: 6 }}>Nothing happens at the deadline — it's yours to aim at.</HelpText>
              </div>

              <div style={{ marginBottom: 18 }}>
                <SelectField
                  label="Writing pace"
                  value={goalMode}
                  onChange={function (e) { setGoalMode(e.target.value); }}
                  style={{ maxWidth: FIELD_MAX_W }}
                >
                  {GOAL_MODES.map(function (m) { return <option key={m.id} value={m.id}>{m.label}</option>; })}
                </SelectField>
                {goalMode !== 'none' && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <InputField
                      wrap={false}
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
