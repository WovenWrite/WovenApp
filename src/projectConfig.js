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
  statuses: null,   // null = untouched defaults
  labels: {},       // sparse
  dueDate: null,    // 'YYYY-MM-DD'
  reminders: []     // [{ id, offsetDays, enabled }] — stored, not yet acted on
};

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
// Wizard presets
// ══════════════════════════════════════════════
//
// Keyed by the same ids as PROJ_TYPES in App.jsx. PROJ_TYPES keeps
// label/icon/desc/colls; this holds only what is new. The wizard reads both
// by id. Worth folding PROJ_TYPES in here eventually — deliberately not done
// now to avoid touching the monolith.

export var PROJECT_PRESETS = {
  fiction: {
    config: { sequenceMode: 'numeric', draftThumbnails: true, labels: { draft: 'Chapter', drafts: 'Chapters' } },
    draftFields: [
      { id: 'pov',         label: 'POV',         type: 'short_text' },
      { id: 'main_action', label: 'Main action', type: 'long_text' },
      { id: 'notes',       label: 'Notes',       type: 'long_text' }
    ]
  },
  nonfiction: {
    config: { sequenceMode: 'numeric', draftThumbnails: false, labels: { draft: 'Section', drafts: 'Sections' } },
    draftFields: [
      { id: 'angle', label: 'Angle', type: 'short_text' },
      { id: 'notes', label: 'Notes', type: 'long_text' }
    ]
  },
  research: {
    config: { sequenceMode: 'numeric', draftThumbnails: false, labels: { draft: 'Section', drafts: 'Sections' } },
    draftFields: [
      { id: 'question', label: 'Research question', type: 'long_text' },
      { id: 'notes',    label: 'Notes',             type: 'long_text' }
    ]
  },
  blog: {
    config: { sequenceMode: 'date', draftThumbnails: true, labels: { draft: 'Post', drafts: 'Posts' } },
    draftFields: [
      { id: 'tags',  label: 'Tags',  type: 'short_text' },
      { id: 'notes', label: 'Notes', type: 'long_text' }
    ]
  },
  screenplay: {
    config: { sequenceMode: 'numeric', draftThumbnails: false, labels: { draft: 'Scene', drafts: 'Scenes' } },
    draftFields: [
      { id: 'location',     label: 'Location',     type: 'short_text' },
      { id: 'time_of_day',  label: 'Time of day',  type: 'short_text' },
      { id: 'notes',        label: 'Notes',        type: 'long_text' }
    ]
  },
  other: {
    config: { sequenceMode: 'none', draftThumbnails: true, labels: {} },
    draftFields: [
      { id: 'notes', label: 'Notes', type: 'long_text' }
    ]
  }
};

export function presetFor(typeId) {
  return PROJECT_PRESETS[typeId] || PROJECT_PRESETS.other;
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
