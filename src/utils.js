// @ts-nocheck
// ── Woven shared utilities ──
// Extracted from App.jsx. No React, no JSX — safe to import anywhere.

// ══════════════════════════════════════════════
// Constants
// ══════════════════════════════════════════════

export var STATUSES = {
  loose_thread: { label: 'Loose Thread', color: '#d4943e' },
  first_draft:  { label: 'First Draft',  color: '#2f76e0' },
  second_draft: { label: 'Second Draft', color: '#e02f79' },
  under_review: { label: 'Under Review', color: '#ce2fe0' },
  complete:     { label: 'Complete',     color: '#64e02f' }
};

export var FIELD_TYPES = [
  { id: 'short_text', label: 'Short text' },
  { id: 'long_text',  label: 'Long text' },
  { id: 'number',     label: 'Number' },
  { id: 'boolean',    label: 'Yes / No' },
  { id: 'select',     label: 'Dropdown' },
  { id: 'date',       label: 'Date' },
  { id: 'strand_ref', label: 'Reference' }
];

export var PRESET_COLORS = ['#2f76e0','#64e02f','#ce2fe0','#2fe07f','#e02f79','#c45e28','#e8a030','#2f9966','#b83220','#f0c050'];
export var SYSTEM_COLORS = ['#c45e28','#e8a030','#2f9966','#2f76e0','#ce2fe0','#e02f79','#64e02f','#2fe07f'];

export var COLL_FIELDS = {
  'Characters':  [{id:'aliases',label:'Aliases',type:'short_text'},{id:'role',label:'Role',type:'short_text'},{id:'personality',label:'Personality',type:'long_text'},{id:'appearance',label:'Physical Description',type:'long_text'}],
  'Locations':   [{id:'type',label:'Type',type:'short_text'},{id:'description',label:'Description',type:'long_text'}],
  'Lore & World':[{id:'category',label:'Category',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}],
  'Sources':     [{id:'author',label:'Author',type:'short_text'},{id:'url',label:'URL',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}],
  'Interviews':  [{id:'subject',label:'Subject',type:'short_text'},{id:'date',label:'Date',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}],
  'Scenes':      [{id:'location',label:'Location',type:'short_text'},{id:'notes',label:'Notes',type:'long_text'}]
};

export function defaultFields(c) {
  return COLL_FIELDS[c] || [{ id: 'notes', label: 'Notes', type: 'long_text' }];
}

// ══════════════════════════════════════════════
// Supabase
// ══════════════════════════════════════════════

var SB_URL = 'https://mxsdiqrbxlvcwexfdtrj.supabase.co';
var SB_KEY = 'sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u';

export function getSupabase() {
  if (!window.__sb) {
    if (window.supabase && window.supabase.createClient) {
      window.__sb = window.supabase.createClient(SB_URL, SB_KEY);
    }
  }
  return window.__sb || null;
}

export var supabase = {
  auth: {
    getSession: function () { return getSupabase() ? getSupabase().auth.getSession() : Promise.resolve({ data: { session: null } }); },
    getUser: function () { return getSupabase() ? getSupabase().auth.getUser() : Promise.resolve({ data: { user: null } }); },
    signUp: function (o) { return getSupabase() ? getSupabase().auth.signUp(o) : Promise.resolve({ error: { message: 'Auth not ready' } }); },
    signInWithPassword: function (o) { return getSupabase() ? getSupabase().auth.signInWithPassword(o) : Promise.resolve({ error: { message: 'Auth not ready' } }); },
    signOut: function () { return getSupabase() ? getSupabase().auth.signOut() : Promise.resolve({}); },
    resetPasswordForEmail: function (e) { return getSupabase() ? getSupabase().auth.resetPasswordForEmail(e) : Promise.resolve({ error: { message: 'Auth not ready' } }); },
    onAuthStateChange: function (cb) {
      if (getSupabase()) return getSupabase().auth.onAuthStateChange(cb);
      return { data: { subscription: { unsubscribe: function () {} } } };
    }
  },
  from: function (table) {
    var client = getSupabase();
    if (!client) {
      var noop = function () { return Promise.resolve({ data: null, error: { message: 'DB not ready' } }); };
      var chain = { maybeSingle: noop, single: noop, then: function (cb) { return Promise.resolve(cb({ data: null, error: null })); } };
      var eqChain = function () { return { eq: function () { return chain; }, maybeSingle: noop }; };
      return {
        select: function () { return { eq: function () { return { eq: eqChain, maybeSingle: noop }; }, maybeSingle: noop }; },
        upsert: noop,
        insert: noop,
        delete: function () { return { eq: noop }; }
      };
    }
    return client.from(table);
  }
};

// ══════════════════════════════════════════════
// IDs & text
// ══════════════════════════════════════════════

export function genId() {
  return '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function stripHtml(html) {
  return html ? html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
}

export function countWords(t) {
  if (!t) return 0;
  var s = t.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.split(' ').filter(function (w) { return w.length > 0; }).length : 0;
}

export function initials(name) {
  if (!name || !name.trim()) return '?';
  var p = name.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
  if (p.length === 0) return '?';
  if (p.length === 1) return p[0].slice(0, 1).toUpperCase();
  if (p.length === 2) return (p[0][0] + p[1][0]).toUpperCase();
  return (p[0][0] + p[1][0] + p[2][0]).toUpperCase();
}

export function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ══════════════════════════════════════════════
// Images
// ══════════════════════════════════════════════

export function compressImage(file) {
  return new Promise(function (resolve) {
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function () {
      var MAX = 1200; var w = img.width; var h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      canvas.toBlob(function (blob) { resolve(blob || file); }, { type: 'image/jpeg', quality: 0.82 });
    };
    img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export async function uploadImage(file) {
  var client = getSupabase();
  if (!client) return null;
  var compressed = await compressImage(file);
  var path = 'uploads/' + genId() + '.jpg';
  var res = await client.storage.from('woven-images').upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });
  if (res.error) { console.error('Upload error:', res.error); return null; }
  var pub = client.storage.from('woven-images').getPublicUrl(path);
  return pub.data && pub.data.publicUrl ? pub.data.publicUrl : null;
}

export function deleteStorageImage(url) {
  if (!url || !url.includes('supabase')) return;
  var client = getSupabase();
  if (!client) return;
  var marker = '/object/public/woven-images/';
  var idx = url.indexOf(marker);
  if (idx < 0) return;
  client.storage.from('woven-images').remove([url.slice(idx + marker.length)]).then(function () {});
}

// ══════════════════════════════════════════════
// Version snapshots (Supabase — draft_versions table)
// ══════════════════════════════════════════════
// Snapshots are rows in `draft_versions`, not a localStorage blob, so history
// survives a cleared cache and follows the user across devices.
//
// Autosave cadence is activity-based rather than clock-based: DraftEditor
// calls saveSnapshot() whenever enough writing has accumulated since the
// last snapshot (word delta) or enough time has passed with a real content
// change (time floor), using the constants below. Manual saves (opts.isManual)
// always write immediately and are never pruned.

export var VOLUME_SNAPSHOT_WORDS = 300;      // burst trigger: snapshot after ~this many words change
export var MIN_SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // time floor: snapshot at least this often if content changed (catches heavy revision with low net word delta)

export async function loadSnapshots(draftId) {
  var client = getSupabase();
  if (!client) return [];
  var res = await client
    .from('draft_versions')
    .select('*')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (res.error) { console.error('loadSnapshots error:', res.error); return []; }
  return (res.data || []).map(function (row) {
    return {
      id: row.id,
      ts: new Date(row.created_at).getTime(),
      body: row.body,
      wordCount: row.word_count,
      isManual: !!row.is_manual,
      label: row.label || null
    };
  });
}

export async function saveSnapshot(draftId, body, wordCount, opts) {
  if (!body || !body.trim()) return null;
  var client = getSupabase();
  if (!client) return null;
  var uid = window.__wovenUserId;
  if (!uid) return null;
  opts = opts || {};
  var row = {
    id: genId(),
    draft_id: draftId,
    user_id: uid,
    body: body,
    word_count: wordCount || 0,
    is_manual: !!opts.isManual,
    label: opts.label || null,
    created_at: new Date().toISOString()
  };
  var res = await client.from('draft_versions').insert(row);
  if (res.error) { console.error('saveSnapshot error:', res.error); return null; }
  // Occasionally thin old autosaves so the table doesn't grow unbounded.
  // Manual saves are exempt and this never runs synchronously on the save path.
  if (!opts.isManual && Math.random() < 0.2) pruneSnapshots(draftId);
  return row;
}

export async function pruneSnapshots(draftId) {
  var client = getSupabase();
  if (!client) return;
  var res = await client
    .from('draft_versions')
    .select('id,created_at,is_manual')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false })
    .limit(500);
  if (res.error || !res.data) return;
  var now = Date.now();
  var HOUR = 60 * 60 * 1000;
  var keepIds = {};
  var seenBuckets = {};
  res.data.forEach(function (row) {
    if (row.is_manual) { keepIds[row.id] = true; return; }
    var createdMs = new Date(row.created_at).getTime();
    var age = now - createdMs;
    if (age < 2 * HOUR) { keepIds[row.id] = true; return; } // keep everything from the last 2 hours
    var bucketMs = age < 48 * HOUR ? 30 * 60 * 1000 : 3 * HOUR; // 1 per 30min up to 48h, then 1 per 3h
    var bucketKey = Math.floor(createdMs / bucketMs);
    if (!seenBuckets[bucketKey]) { seenBuckets[bucketKey] = true; keepIds[row.id] = true; }
  });
  var toDelete = res.data.filter(function (row) { return !keepIds[row.id]; }).map(function (row) { return row.id; });
  if (toDelete.length === 0) return;
  var del = await client.from('draft_versions').delete().in('id', toDelete);
  if (del.error) console.error('pruneSnapshots delete error:', del.error);
}

export function formatSnapshotTime(ts) {
  var d = new Date(ts);
  var now = new Date();
  var isToday = d.toDateString() === now.toDateString();
  var yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  var isYesterday = d.toDateString() === yesterday.toDateString();
  var time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return 'Today ' + time;
  if (isYesterday) return 'Yesterday ' + time;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + time;
}

// ══════════════════════════════════════════════
// Export bridge
// ══════════════════════════════════════════════
// doExport still lives in App.jsx as window.doExport. This wrapper makes the
// dependency explicit rather than relying on bare global resolution.

export function doExport(format, drafts, project, isSingleDraft, authorName) {
  if (typeof window.doExport !== 'function') {
    console.error('doExport not available on window');
    return;
  }
  return window.doExport(format, drafts, project, isSingleDraft, authorName);
}

export function buildShareLink(shareId) {
  return window.location.origin + window.location.pathname + '?share=' + shareId;
}

// ══════════════════════════════════════════════
// Draft filter — shared between App.jsx's Define Filter panel and BindDrawer
// ══════════════════════════════════════════════
// Shape: { status:[...statusKeys], strandTags:[...strandIds], customFields:{fieldId:[...strandIds]} }
// AND across categories (status / strandTags / each custom field), OR within
// a category's own selections. Kept here (not duplicated) so any consumer of
// an active filter — the Storyboard/Outline views, Bind — matches drafts the
// same way.

export function emptyFilterState() {
  return { status: [], strandTags: [], customFields: {} };
}

export function filterCriteriaCount(filterObj) {
  if (!filterObj) return 0;
  var n = (filterObj.status || []).length + (filterObj.strandTags || []).length;
  Object.keys(filterObj.customFields || {}).forEach(function (k) { n += (filterObj.customFields[k] || []).length; });
  return n;
}

export function draftMatchesFilter(draft, filterObj) {
  if (!filterObj) return true;
  var st = filterObj.status || [];
  if (st.length > 0 && st.indexOf(draft.status) < 0) return false;
  var sTags = filterObj.strandTags || [];
  if (sTags.length > 0) {
    var dTags = draft.strandTags || [];
    if (!sTags.some(function (id) { return dTags.indexOf(id) >= 0; })) return false;
  }
  var cf = filterObj.customFields || {};
  var keys = Object.keys(cf);
  for (var i = 0; i < keys.length; i++) {
    var fid = keys[i]; var wanted = cf[fid] || [];
    if (wanted.length === 0) continue;
    var raw = (draft.customFields && draft.customFields[fid]) || '';
    var have = [];
    try { var parsed = JSON.parse(raw); have = Array.isArray(parsed) ? parsed : (raw ? [raw] : []); } catch (e) { have = raw ? [raw] : []; }
    if (!wanted.some(function (id) { return have.indexOf(id) >= 0; })) return false;
  }
  return true;
}
