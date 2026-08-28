// @ts-nocheck
// ── Woven project configuration ──
//
// Projects carry an optional `config` object. Nothing is ever written to a
// project until the user changes something — defaults are resolved at READ
// time by the helpers below, so existing projects keep working untouched and
// a bad default is a one-line fix rather than a data repair.
//
// Read config through these helpers, never off `proj.config` directly:
//
//   projConfig(proj)        → the full resolved config
//   projStatuses(proj)      → ordered array of status defs
//   projStatusMap(proj)     → { id: def } — drop-in for the global STATUSES
//   projStatus(proj, id)    → one status def, never undefined
//   projSequence(proj)      → 'numeric' | 'date' | 'none'
//   projThumbnails(proj)    → boolean
//   projLabel(proj, key)    → 'Chapter', 'Post', 'Draft'...
//   draftDateOf(draft)      → the date used by date-mode sorting
//   sortDraftsBySequence()  → the correct sort for the project's mode
//
// No React, no JSX — safe to import anywhere.

import { STATUSES, defaultFields } from './utils';

// ══════════════════════════════════════════════
// Sequence modes
// ══════════════════════════════════════════════
//
// numeric and none share ALL ordering mechanics — both use manual `order`
// with drag/rearrange. They differ only in whether draftLabel() renders a
// number. Only 'date' changes the sort and disables move up/down.

export var SEQUENCE_MODES = [
  { id: 'numeric', label: 'Numbered',   desc: 'Chapters, parts, sections — ordered and numbered.', icon: 'format_list_numbered', manual: true,  numbered: true  },
  { id: 'date',    label: 'By date',    desc: 'Newest first, like a blog or journal.',             icon: 'calendar_month',       manual: false, numbered: false },
  { id: 'none',    label: 'Unordered',  desc: 'Rearrange freely. No numbering.',                   icon: 'drag_indicator',       manual: true,  numbered: false }
];

export function sequenceMode(id) {
  return SEQUENCE_MODES.find(function (m) { return m.id === id; }) || SEQUENCE_MODES[0];
}

// ══════════════════════════════════════════════
// Statuses
// ══════════════════════════════════════════════
//
// An ORDERED ARRAY, not an object. `loose_thread` is a system status: it is
// pinned at index 0, cannot be removed, and its `id` can never change no
// matter what the label says — every `status === 'loose_thread'` check in the
// app depends on that id. v1 allows renaming and recolouring only.

export var DEFAULT_STATUSES = Object.keys(STATUSES).map(function (id) {
  return {
    id: id,
    label: STATUSES[id].label,
    color: STATUSES[id].color,
    system: id === 'loose_thread',
    locked: id === 'loose_thread'
  };
});

export function isSystemStatus(id) { return id === 'loose_thread'; }

// Normalises a stored status array: drops unknown ids, restores any missing
// defaults, and forces loose_thread back to index 0 whatever order it arrived
// in. Cheap insurance against hand-edited or partially-migrated data.
export function normalizeStatuses(stored) {
  if (!Array.isArray(stored) || stored.length === 0) return DEFAULT_STATUSES.slice();
  var seen = {};
  var out = [];
  stored.forEach(function (s) {
    if (!s || !s.id || seen[s.id]) return;
    var base = DEFAULT_STATUSES.find(function (d) { return d.id === s.id; });
    if (!base) return; // v1: no custom ids
    seen[s.id] = true;
    out.push({
      id: base.id,
      label: (s.label && String(s.label).trim()) || base.label,
      color: s.color || base.color,
      system: base.system,
      locked: base.locked
    });
  });
  DEFAULT_STATUSES.forEach(function (d) { if (!seen[d.id]) out.push(Object.assign({}, d)); });
  var lt = out.filter(function (s) { return isSystemStatus(s.id); });
  var rest = out.filter(function (s) { return !isSystemStatus(s.id); });
  return lt.concat(rest);
}

// ══════════════════════════════════════════════
// Labels
// ══════════════════════════════════════════════
//
// Sparse overrides — `{}` means "use every default". Keys are registered
// here so the drawer can enumerate what is renameable.

export var LABEL_KEYS = [
  { key: 'draft',  plural: 'drafts', label: 'What you call one piece of writing', fallback: 'Draft',  fallbackPlural: 'Drafts' }
];

export var DEFAULT_LABELS = {};
LABEL_KEYS.forEach(function (k) {
  DEFAULT_LABELS[k.key] = k.fallback;
  DEFAULT_LABELS[k.plural] = k.fallbackPlural;
});

export function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function lowercase(s) {
  return s ? s.toLowerCase() : s;
}

// ══════════════════════════════════════════════
// Defaults
// ══════════════════════════════════════════════

export var CONFIG_VERSION = 1;

export var DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  sequenceMode: 'numeric',
  draftThumbnails: true,
  statuses: null,     // null = untouched defaults
  labels: {},         // sparse
  dueDate: null,      // 'YYYY-MM-DD'
  goalMode: 'none',   // 'none' | 'daily' | 'weekly'
  goalWords: 0,       // words per day/week for this project
  reminders: []       // [{ id, offsetDays, enabled }] — stored, not yet acted on
};

// Per-project writing goals. Distinct from the GLOBAL daily goal in
// app.goal / StatsSection, which is a whole-account number and stays as is.
export var GOAL_MODES = [
  { id: 'none',   label: 'No goal',       desc: 'Just write.' },
  { id: 'daily',  label: 'Words per day', desc: 'A steady daily target.' },
  { id: 'weekly', label: 'Words per week', desc: 'More room to move week to week.' }
];

export function goalMode(id) {
  return GOAL_MODES.find(function (m) { return m.id === id; }) || GOAL_MODES[0];
}

// ══════════════════════════════════════════════
// Resolvers
// ══════════════════════════════════════════════

export function projConfig(proj) {
  var stored = (proj && proj.config) || {};
  return {
    version: stored.version || CONFIG_VERSION,
    sequenceMode: sequenceMode(stored.sequenceMode).id,
    draftThumbnails: stored.draftThumbnails === undefined ? DEFAULT_CONFIG.draftThumbnails : !!stored.draftThumbnails,
    statuses: stored.statuses || null,
    labels: Object.assign({}, DEFAULT_LABELS, stored.labels || {}),
    dueDate: stored.dueDate || null,
    goalMode: goalMode(stored.goalMode).id,
    goalWords: Number(stored.goalWords) > 0 ? Number(stored.goalWords) : 0,
    reminders: Array.isArray(stored.reminders) ? stored.reminders : []
  };
}

export function projStatuses(proj) {
  var cfg = projConfig(proj);
  return cfg.statuses ? normalizeStatuses(cfg.statuses) : DEFAULT_STATUSES.slice();
}

// Drop-in replacement for the global STATUSES object. Phase 2 swaps
// `STATUSES[d.status]` for `projStatusMap(proj)[d.status]`.
export function projStatusMap(proj) {
  var map = {};
  projStatuses(proj).forEach(function (s) { map[s.id] = s; });
  return map;
}

export function projStatus(proj, id) {
  var map = projStatusMap(proj);
  return map[id] || map.first_draft || DEFAULT_STATUSES[1];
}

export function projSequence(proj) {
  return projConfig(proj).sequenceMode;
}

export function projIsNumbered(proj) {
  return sequenceMode(projSequence(proj)).numbered;
}

// True when the user can drag/reorder by hand. False in date mode, where
// order is derived — move up/down controls should be hidden.
export function projIsManualOrder(proj) {
  return sequenceMode(projSequence(proj)).manual;
}

export function projThumbnails(proj) {
  return projConfig(proj).draftThumbnails;
}

export function projDueDate(proj) {
  return projConfig(proj).dueDate;
}

// Returns null when no goal is set, else { mode, words, label }.
export function projGoal(proj) {
  var cfg = projConfig(proj);
  if (cfg.goalMode === 'none' || !cfg.goalWords) return null;
  return {
    mode: cfg.goalMode,
    words: cfg.goalWords,
    label: cfg.goalWords.toLocaleString() + ' words / ' + (cfg.goalMode === 'daily' ? 'day' : 'week')
  };
}

// Whole days from today until the due date. Negative when overdue,
// null when no due date is set.
export function daysUntilDue(proj) {
  var due = projDueDate(proj);
  if (!due) return null;
  var parts = String(due).split('-');
  if (parts.length !== 3) return null;
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  var today = new Date();
  today = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - today) / 86400000);
}

export function projLabel(proj, key) {
  var labels = projConfig(proj).labels;
  return labels[key] || DEFAULT_LABELS[key] || capitalize(key);
}

// ══════════════════════════════════════════════
// Draft dates (date sequence mode)
// ══════════════════════════════════════════════
//
// Date mode sorts on `draft.draftDate` — a user-editable 'YYYY-MM-DD' string
// that does NOT exist on drafts yet. Until the Properties drawer surfaces it,
// this falls back to createdAt so date mode is never empty.

export function draftDateOf(draft) {
  if (!draft) return '';
  if (draft.draftDate) return draft.draftDate;
  return (draft.createdAt || '').slice(0, 10);
}

// 'YYYY-MM-DD' → 'Mar 4, 2026'. Returns '' for anything unparseable so
// callers can just render the result without guarding.
export function formatDraftDate(dateStr) {
  if (!dateStr) return '';
  var parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length !== 3) return '';
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export function sortDraftsBySequence(drafts, proj) {
  var list = (drafts || []).slice();
  if (projSequence(proj) === 'date') {
    list.sort(function (a, b) {
      var da = draftDateOf(a), db = draftDateOf(b);
      if (da === db) return (a.createdAt || '').localeCompare(b.createdAt || '');
      return db.localeCompare(da); // newest first
    });
    return list;
  }
  list.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  return list;
}

// ══════════════════════════════════════════════
// Project types & presets
// ══════════════════════════════════════════════
//
// One entry per project type, holding everything the wizard needs:
// presentation (label/icon/desc), the spool collections to seed, the config
// defaults, and the draft custom fields. Previously PROJ_TYPES lived in
// App.jsx and the config half lived here — folded together so a preset is
// defined in exactly one place.

export var PROJ_TYPES = [
  {
    id: 'fiction', label: 'Fiction', icon: 'auto_stories',
    desc: 'Novels, short fiction, narrative',
    colls: ['Characters', 'Locations', 'Lore & World'],
    config: { sequenceMode: 'numeric', draftThumbnails: true, labels: { draft: 'Chapter', drafts: 'Chapters' } },
    draftFields: [
      { id: 'pov',         label: 'POV',         type: 'short_text' },
      { id: 'main_action', label: 'Main action', type: 'long_text' },
      { id: 'notes',       label: 'Notes',       type: 'long_text' }
    ]
  },
  {
    id: 'nonfiction', label: 'Non-Fiction', icon: 'article',
    desc: 'Essays, memoir, journalism',
    colls: ['Sources', 'Interviews', 'Subjects'],
    config: { sequenceMode: 'numeric', draftThumbnails: false, labels: { draft: 'Section', drafts: 'Sections' } },
    draftFields: [
      { id: 'angle', label: 'Angle', type: 'short_text' },
      { id: 'notes', label: 'Notes', type: 'long_text' }
    ]
  },
  {
    id: 'research', label: 'Research', icon: 'science',
    desc: 'Academic or investigative writing',
    colls: ['Sources', 'Reports', 'Interviews'],
    config: { sequenceMode: 'numeric', draftThumbnails: false, labels: { draft: 'Section', drafts: 'Sections' } },
    draftFields: [
      { id: 'question', label: 'Research question', type: 'long_text' },
      { id: 'notes',    label: 'Notes',             type: 'long_text' }
    ]
  },
  {
    id: 'dissertation', label: 'Dissertation', icon: 'school',
    desc: 'Thesis chapters, committee-ready',
    colls: ['Sources', 'Committee', 'Terms & Concepts'],
    config: { sequenceMode: 'numeric', draftThumbnails: false, labels: { draft: 'Chapter', drafts: 'Chapters' } },
    draftFields: [
      { id: 'argument', label: 'Core argument', type: 'long_text' },
      { id: 'notes',    label: 'Notes',         type: 'long_text' }
    ]
  },
  {
    id: 'blog', label: 'Blog Series', icon: 'rss_feed',
    desc: 'Posts, columns, newsletters',
    colls: ['Topics', 'Sources', 'Audience Notes'],
    config: { sequenceMode: 'date', draftThumbnails: true, labels: { draft: 'Post', drafts: 'Posts' } },
    draftFields: [
      { id: 'tags',  label: 'Tags',  type: 'short_text' },
      { id: 'notes', label: 'Notes', type: 'long_text' }
    ]
  },
  {
    id: 'screenplay', label: 'Screenplay', icon: 'movie',
    desc: 'Film, TV, stage scripts',
    colls: ['Characters', 'Locations', 'Scenes'],
    config: { sequenceMode: 'numeric', draftThumbnails: false, labels: { draft: 'Scene', drafts: 'Scenes' } },
    draftFields: [
      { id: 'location',    label: 'Location',    type: 'short_text' },
      { id: 'time_of_day', label: 'Time of day', type: 'short_text' },
      { id: 'notes',       label: 'Notes',       type: 'long_text' }
    ]
  },
  {
    id: 'other', label: 'Other', icon: 'edit_note',
    desc: 'Everything else',
    colls: ['Characters', 'Sources'],
    config: { sequenceMode: 'none', draftThumbnails: true, labels: {} },
    draftFields: [
      { id: 'notes', label: 'Notes', type: 'long_text' }
    ]
  }
];

export function presetFor(typeId) {
  return PROJ_TYPES.find(function (t) { return t.id === typeId; }) || PROJ_TYPES[PROJ_TYPES.length - 1];
}

// Legacy projects store `type` as the LABEL ('Fiction'), not the id. New
// projects store `typeId` too. This resolves either.
export function typeIdOf(proj) {
  if (!proj) return 'other';
  if (proj.typeId) return proj.typeId;
  var match = PROJ_TYPES.find(function (t) { return t.label === proj.type; });
  return match ? match.id : 'other';
}

// Builds the `config` object stored on a new project. Only writes keys that
// actually differ from DEFAULT_CONFIG, so the stored blob stays small and
// future default changes still reach projects that never customised.
export function buildConfig(typeId, overrides) {
  var preset = presetFor(typeId).config || {};
  var merged = Object.assign({}, preset, overrides || {});
  var out = { version: CONFIG_VERSION };
  Object.keys(merged).forEach(function (k) {
    var v = merged[k];
    if (v === undefined || v === null) return;
    if (k === 'labels' && Object.keys(v).length === 0) return;
    if (DEFAULT_CONFIG[k] !== undefined && DEFAULT_CONFIG[k] === v) return;
    out[k] = v;
  });
  return out;
}

export function presetDraftFields(typeId) {
  return (presetFor(typeId).draftFields || []).map(function (f) { return Object.assign({}, f); });
}

// Convenience for the wizard — spool collection field defs still come from
// utils.defaultFields, re-exported so the wizard has one import.
export { defaultFields };
