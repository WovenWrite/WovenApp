// @ts-nocheck
// Woven — ExploreCanvas v2
// src/ExploreCanvas.jsx
//
// Prerequisites:
//   - @xyflow/react in package.json
//   - import '@xyflow/react/dist/style.css' in src/main.tsx
//   - vite.config: resolve: { dedupe: ['react','react-dom'] }
//
// Usage in App.jsx:
//   import ExploreCanvas from './ExploreCanvas'
//   if(view==='canvas') vc = <ExploreCanvas app={app} />;

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap, addEdge, useNodesState, useEdgesState, useReactFlow,
  Handle, Position, NodeResizer, MarkerType,
} from '@xyflow/react'
import { Drawer, DeleteConfirmModal, StrandResultRow, HelpText, SearchSortBar } from './SharedUI'
import { STATUSES, genId, initials, getSupabase } from './utils'

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const CANVAS_CSS = `
.ex-shell{display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;}
.ex-body{display:flex;flex:1;overflow:hidden;min-height:0;}
.ex-canvas-col{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;min-height:0;}

/* Board tabs — styled to match the Strands page subnav/tab treatment */
.ex-tabs{display:flex;align-items:flex-end;height:55px;background:#EDE0CC;
  border-bottom:1px solid #A88060;padding:0 16px;gap:0;flex-shrink:0;overflow:hidden;}
.ex-tab{display:flex;align-items:center;gap:6px;height:44px;padding:0 18px;
  border-radius:10px 10px 0 0;font-size:16px;font-family:'DM Sans',sans-serif;font-weight:600;
  cursor:pointer;color:rgba(122,90,56,.75);border:1px solid transparent;border-bottom:none;
  transition:all .15s;white-space:nowrap;max-width:240px;flex-shrink:0;margin-right:2px;
  position:relative;bottom:0;}
.ex-tab:hover:not(.active){color:#7A5A38;background:rgba(253,248,240,.4);}
.ex-tab.active{background:#FDF8F0;color:#6B4A26;border-color:#A88060;
  border-bottom:2px solid #FDF8F0;margin-bottom:-1px;}
.ex-tab-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;}
.ex-tab-name-input{background:none;border:none;outline:none;font-family:'DM Sans',sans-serif;
  font-size:16px;font-weight:600;color:inherit;width:100px;padding:0;border-radius:0;}
.ex-tab-close{font-size:15px;color:rgba(122,90,56,.5);border-radius:3px;padding:1px 2px;
  display:flex;align-items:center;justify-content:center;font-family:'Material Icons';
  line-height:1;flex-shrink:0;}
.ex-tab-close:hover{background:rgba(168,128,96,.25);color:#6B4A26;}
.ex-tab-add{width:32px;height:32px;border-radius:8px;border:1px dashed #A88060;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  color:rgba(122,90,56,.6);font-size:20px;flex-shrink:0;margin:0 0 6px 6px;
  transition:all .12s;line-height:1;user-select:none;}
.ex-tab-add:hover{border-color:var(--indigo);color:var(--indigo);background:rgba(196,94,40,.08);}

/* Canvas row */
.ex-canvas-row{flex:1;display:flex;overflow:hidden;min-height:0;}
.ex-canvas-area{flex:1;position:relative;overflow:hidden;min-height:0;}

/* React Flow */
.react-flow__attribution{display:none!important;}
.react-flow__background{background:var(--bg0)!important;}
.react-flow__controls{box-shadow:0 2px 8px rgba(42,31,16,.10)!important;
  border:1px solid var(--border)!important;border-radius:var(--r)!important;overflow:hidden;}
.react-flow__controls-button{background:var(--bg1)!important;
  border-bottom:1px solid var(--border)!important;fill:var(--mid)!important;}
.react-flow__controls-button:hover{background:var(--bg2)!important;}
.react-flow__minimap{border:1px solid var(--border)!important;border-radius:var(--r)!important;
  overflow:hidden;box-shadow:0 2px 8px rgba(42,31,16,.10)!important;}
.react-flow__edge-path{stroke:var(--bg4);stroke-width:2;}
.react-flow__edge.selected .react-flow__edge-path{stroke:var(--indigo);}
.react-flow__handle{width:12px!important;height:12px!important;
  background:var(--bg3)!important;border:2px solid var(--bg4)!important;
  border-radius:50%!important;transition:all .2s;opacity:0;}
.react-flow__node:hover .react-flow__handle{opacity:1;background:var(--indigo)!important;
  border-color:var(--indigoL)!important;box-shadow:0 0 0 3px rgba(196,94,40,.25);}
.react-flow__handle:hover{transform:scale(1.4);opacity:1!important;
  background:var(--indigo)!important;box-shadow:0 0 0 4px rgba(196,94,40,.3)!important;}
.react-flow__node:hover .woven-card:not(.selected){
  box-shadow:0 0 0 2px rgba(196,94,40,.2),0 4px 16px rgba(42,31,16,.1);}

/* Connect tool active — override React Flow's default grab cursor on
   nodes so hovering shows the same crosshair as the empty pane. */

/* Right panel */
.ex-right{display:flex;flex-direction:row-reverse;flex-shrink:0;}

/* Toolbar */
.ex-toolbar{width:60px;background:var(--bg1);display:flex;flex-direction:column;
  align-items:center;padding:10px 0;gap:2px;flex-shrink:0;border-left:1px solid var(--border);
  min-height:0;overflow:hidden;}
.ex-tool{width:44px;height:44px;border-radius:8px;display:flex;
  align-items:center;justify-content:center;cursor:pointer;color:var(--mid);
  transition:all .12s;flex-shrink:0;}
.ex-tool:hover{background:var(--bg2);color:var(--text);}
.ex-tool.active{background:rgba(196,94,40,.12);color:var(--indigo);}
.ex-tool .material-symbols-outlined{font-size:22px;line-height:1;}
.ex-tool-sep{width:28px;height:1px;background:#A88060;opacity:.4;margin:5px 0;flex-shrink:0;}
/* Per-Spool collection buttons — one per Spool, dynamic per project.
   Scrolls independently so a project with many Spools doesn't push
   the fixed placement tools or Drafts/Threads off screen. */
.ex-toolbar-colls{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;
  align-items:center;gap:2px;width:100%;scrollbar-width:thin;}
.ex-toolbar-colls::-webkit-scrollbar{width:4px;}
.ex-toolbar-colls::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}

/* Drawer */
.ex-drawer{width:0;overflow:hidden;transition:width .2s ease;background:var(--bg1);
  border-left:1px solid var(--border);display:flex;flex-direction:column;position:relative;}
.ex-drawer.open{margin:5px 5px 5px 0;border:1px solid var(--border);border-radius:var(--r);}
.ex-drawer.resizing{transition:none;}
.ex-drawer-inner{display:flex;flex-direction:column;height:100%;overflow:hidden;}
.ex-drawer-resize-handle{position:absolute;top:0;left:-4px;width:8px;height:100%;
  cursor:col-resize;z-index:5;touch-action:none;}
.ex-drawer-resize-handle::after{content:'';position:absolute;top:0;left:3px;width:2px;height:100%;
  background:transparent;transition:background .15s;}
.ex-drawer-resize-handle:hover::after,.ex-drawer.resizing .ex-drawer-resize-handle::after{
  background:var(--indigo);}
.ex-edrawer-body{flex:1;overflow-y:auto;display:flex;flex-direction:column;}

.ex-edrawer-section{padding:10px 14px;}
.ex-edrawer-lbl{font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:7px;display:block;}
.ex-edrawer-row{display:flex;align-items:center;gap:10px;padding:9px 14px;
  border-bottom:1px solid var(--border);cursor:grab;user-select:none;transition:background .12s;}
.ex-edrawer-row:hover{background:var(--bg2);}
.ex-edrawer-row:active{cursor:grabbing;}
.ex-spool-row{cursor:grab;padding:0 14px;}
.ex-spool-row:active{cursor:grabbing;}
.ex-edrawer-av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:11px;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;}
.ex-edrawer-av img{width:100%;height:100%;object-fit:cover;}
.ex-edrawer-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.ex-edrawer-info{flex:1;min-width:0;}
.ex-edrawer-name{font-family:var(--serif);font-size:14px;font-weight:600;color:var(--text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ex-edrawer-sub{font-size:11px;color:var(--mid);}
.ex-edrawer-hint{font-size:12px;color:var(--placeholder);font-family:var(--scribble);
  opacity:0;transition:opacity .12s;flex-shrink:0;}
.ex-edrawer-row:hover .ex-edrawer-hint{opacity:1;}

/* Drafts panel rows — styled to match StrandResultRow's visual weight
   (bold serif title, generous size) rather than the old compact row. */
.ex-draft-row{display:flex;align-items:center;gap:10px;padding:10px 14px;
  cursor:grab;border-bottom:1px solid var(--border);transition:background .12s;}
.ex-draft-row:last-child{border-bottom:none;}
.ex-draft-row:hover{background:var(--bg2);}
.ex-draft-row:active{cursor:grabbing;}
.ex-draft-dot{width:11px;height:11px;border-radius:50%;flex-shrink:0;}
.ex-draft-info{flex:1;min-width:0;}
.ex-draft-title{font-family:var(--serif,'Crimson Text',serif);font-weight:600;font-size:18px;
  line-height:1.3;color:#684a26;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ex-draft-sub{font-size:14px;color:var(--mid);margin-top:2px;}

/* Woven cards */
.woven-card{background:var(--bg1);border:1.5px solid var(--border);border-radius:10px;
  display:flex;flex-direction:column;font-family:var(--ui);overflow:hidden;position:relative;
  box-shadow:0 2px 8px rgba(42,31,16,.08);min-width:200px;max-width:280px;}
.woven-card.selected{border-color:var(--indigo);box-shadow:0 0 0 2px rgba(196,94,40,.15);}
.woven-card-hdr{display:flex;align-items:center;gap:10px;padding:10px;
  background:var(--bg0);flex-shrink:0;}
.woven-card-av{width:75px;height:75px;border-radius:50%;flex-shrink:0;display:flex;
  align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#fff;overflow:hidden;}
.woven-card-av img{width:100%;height:100%;object-fit:cover;}
.woven-card-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.woven-card-name-input{font-family:var(--serif);font-size:16px;font-weight:600;color:var(--text);
  flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  border:none;background:transparent;outline:none;padding:2px 3px;border-radius:4px;cursor:text;}
.woven-card-name-input:hover{background:rgba(122,90,56,.08);}
.woven-card-name-input:focus{background:rgba(196,94,40,.08);white-space:normal;}
.woven-card-status-badge{font-size:14px;font-weight:600;text-transform:uppercase;
  letter-spacing:.03em;color:#fff;padding:3px 8px;border-radius:4px;flex-shrink:0;}
.woven-card-body.has-content{padding:8px 10px;border-top:1px solid var(--border);}
.woven-card-field{margin-bottom:7px;}
.woven-card-field:last-child{margin-bottom:0;}
.woven-card-field-lbl{font-size:14px;font-weight:600;color:var(--indigo);text-transform:uppercase;
  letter-spacing:.04em;margin-bottom:2px;}
.woven-card-field-input{font-size:16px;color:var(--body-text);line-height:1.4;font-family:var(--ui);
  border:none;background:transparent;outline:none;resize:none;width:100%;padding:2px 3px;
  border-radius:4px;box-sizing:border-box;cursor:text;}
.woven-card-field-input:hover{background:rgba(122,90,56,.08);}
.woven-card-field-input:focus{background:rgba(196,94,40,.08);}
.woven-card-field-input::placeholder{color:var(--placeholder);font-style:italic;}

/* Sticky note */
.ex-sticky{border-radius:8px;display:flex;flex-direction:column;overflow:hidden;position:relative;
  min-width:160px;min-height:60px;box-shadow:2px 3px 10px rgba(0,0,0,.08);}
.ex-sticky-drag{height:18px;cursor:grab;display:flex;align-items:center;
  padding:0 6px;flex-shrink:0;opacity:.4;}
.ex-sticky-drag:active{cursor:grabbing;}
.ex-sticky-drag .mi{font-size:13px;}
.ex-sticky-content{padding:4px 12px 10px;flex:1;display:flex;min-height:0;}
.ex-sticky-input{background:none;border:none;outline:none;width:100%;resize:none;line-height:1.45;
  flex:1;min-height:0;height:100%;box-sizing:border-box;}
.ex-sticky-input.is-title{font-family:var(--serif);font-size:16px;font-weight:600;}
.ex-sticky-input.is-body{font-family:var(--ui);font-size:13px;}
.ex-sticky-input::placeholder{opacity:.4;}

/* Image node — no header bar, corner grip only */
.ex-image-node{border:1.5px solid var(--border);border-radius:8px;overflow:hidden;
  box-shadow:0 2px 8px rgba(42,31,16,.08);background:var(--bg1);
  display:flex;align-items:center;justify-content:center;position:relative;}
.ex-image-grip{position:absolute;top:4px;left:4px;width:20px;height:20px;
  border-radius:4px;background:rgba(255,255,255,.7);display:flex;align-items:center;
  justify-content:center;cursor:grab;z-index:1;opacity:0;transition:opacity .15s;}
.ex-image-node:hover .ex-image-grip{opacity:1;}
.ex-image-grip:active{cursor:grabbing;}
.ex-image-grip .mi{font-size:13px;color:var(--mid);}
.ex-image-node img{display:block;width:100%;height:100%;object-fit:cover;}
.ex-image-empty{width:180px;height:130px;display:flex;align-items:center;
  justify-content:center;flex-direction:column;gap:6px;cursor:pointer;color:var(--placeholder);}
.ex-image-empty .mi{font-size:32px;}
.ex-image-empty span{font-size:12px;}

/* Always-tappable node menu button — touch parity for right-click-only
   secondary actions (colour, shape, style). Subtle on desktop, but never
   hover-gated, so it works on touch devices with no hover state. */
.ex-node-menu-btn{position:absolute;top:4px;right:4px;width:26px;height:26px;
  border-radius:6px;background:rgba(255,255,255,.6);border:none;display:flex;
  align-items:center;justify-content:center;cursor:pointer;z-index:3;
  opacity:.6;transition:opacity .15s,background .15s;padding:0;}
.ex-node-menu-btn:hover,.ex-node-menu-btn:focus-visible{opacity:1;background:rgba(255,255,255,.9);}
.ex-node-menu-btn .mi{font-size:16px;color:var(--mid);}
.ex-node-menu-btn--inline{position:static;flex-shrink:0;background:transparent;}
.ex-node-menu-btn--inline:hover,.ex-node-menu-btn--inline:focus-visible{background:var(--bg2);}

/* Shape node */
.ex-shape-node{position:relative;box-shadow:0 2px 8px rgba(42,31,16,.08);}

/* Text node — no chrome, just editable text on the canvas */
.ex-text-node{position:relative;display:flex;flex-direction:column;min-width:60px;min-height:30px;}
.ex-text-drag{height:14px;cursor:grab;display:flex;align-items:center;
  padding:0 4px;flex-shrink:0;opacity:0;transition:opacity .15s;}
.ex-text-node:hover .ex-text-drag{opacity:.4;}
.ex-text-drag:active{cursor:grabbing;}
.ex-text-drag .mi{font-size:12px;}
.ex-text-input{background:none;border:none;outline:none;width:100%;flex:1;resize:none;
  font-family:var(--serif);line-height:1.3;}
.ex-text-input::placeholder{opacity:.35;}

/* Shape tool popover — hangs off the Shape toolbar button */
.ex-shape-popover{position:absolute;right:64px;top:0;background:var(--bg1);
  border:1px solid var(--border);border-radius:var(--r);box-shadow:0 8px 28px rgba(42,31,16,.16);
  padding:6px;display:flex;flex-direction:column;gap:2px;z-index:20;}
.ex-shape-popover-item{width:38px;height:38px;border-radius:6px;display:flex;
  align-items:center;justify-content:center;cursor:pointer;color:var(--mid);transition:all .12s;}
.ex-shape-popover-item:hover{background:var(--bg2);color:var(--indigo);}
.ex-shape-popover-item .material-symbols-outlined{font-size:22px;}

/* Context menu */
.ex-ctx{position:fixed;z-index:9999;background:var(--bg1);border:1px solid var(--border);
  border-radius:var(--rl);box-shadow:0 8px 32px rgba(42,31,16,.16);
  min-width:220px;font-family:var(--ui);}
.ex-ctx-lbl{font-size:9px;font-weight:600;color:var(--indigo);text-transform:uppercase;
  letter-spacing:.08em;padding:8px 14px 3px;}
.ex-ctx-row{display:flex;align-items:center;gap:8px;padding:6px 14px;cursor:pointer;
  transition:background .1s;font-size:13px;color:var(--body-text);}
.ex-ctx-row:hover{background:var(--bg2);color:var(--text);}
.ex-ctx-check{width:16px;height:16px;border-radius:3px;border:1.5px solid var(--bg4);
  flex-shrink:0;display:flex;align-items:center;justify-content:center;
  background:var(--bg0);transition:all .1s;}
.ex-ctx-check.on{background:var(--indigo);border-color:var(--indigo);}
.ex-ctx-check svg{display:block;}
.ex-ctx-swatches{display:flex;align-items:center;gap:6px;padding:6px 14px 10px;}
.ex-ctx-swatch{width:18px;height:18px;border-radius:50%;cursor:pointer;
  border:2px solid transparent;transition:transform .1s;flex-shrink:0;}
.ex-ctx-swatch:hover,.ex-ctx-swatch.active{transform:scale(1.25);border-color:rgba(0,0,0,.25);}
.ex-ctx-div{height:1px;background:var(--border);margin:4px 0;}
.ex-ctx-action{display:flex;align-items:center;gap:8px;padding:7px 14px;
  cursor:pointer;transition:background .1s;font-size:13px;}
.ex-ctx-action:hover{background:var(--bg2);}
.ex-ctx-action.danger{color:var(--danger);}
.ex-ctx-action .mi{font-size:15px;}

`

function CanvasStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CANVAS_CSS }} />
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
// STATUSES now lives in ./utils

const STICKY_COLORS = [
  { id: 'none',  bg: '#fdf8f0', border: '#e2d0b8', text: '#2a1f10' },
  { id: 'amber', bg: '#fff4e0', border: '#f0c878', text: '#5a3800' },
  { id: 'sage',  bg: '#eaf5ee', border: '#9ecfaa', text: '#1a3d25' },
  { id: 'rose',  bg: '#fdeef2', border: '#f0a8bc', text: '#5a1a2a' },
  { id: 'sky',   bg: '#e8f2fc', border: '#9abee8', text: '#1a3050' },
  { id: 'lilac', bg: '#f2eefa', border: '#c8aae8', text: '#3a1a5a' },
]

const TOOL_ITEMS = [
  { id: 'select',  icon: 'near_me',            label: 'Select'  },
  { id: 'text',    icon: 'text_fields',        label: 'Text'    },
  { id: 'shape',   icon: 'category',           label: 'Shape'   },
  { id: 'line',    icon: 'horizontal_rule',    label: 'Line'    },
  { id: 'arrow',   icon: 'arrow_right_alt',    label: 'Arrow'   },
  { id: 'sticky',  icon: 'sticky_note_2',       label: 'Sticky'  },
  { id: 'image',   icon: 'add_photo_alternate', label: 'Image'   },
]
const SHAPE_VARIANTS = [
  { id: 'rectangle', icon: 'rectangle',       label: 'Rectangle' },
  { id: 'ellipse',   icon: 'circle',          label: 'Ellipse'   },
  { id: 'diamond',   icon: 'diamond',         label: 'Diamond'   },
  { id: 'triangle',  icon: 'change_history',  label: 'Triangle'  },
]
// Static drawer buttons — Spool collections are added dynamically per
// project (see the `collections` prop built in the root component).
const DRAWER_ITEMS = [
  { id: 'drafts',        icon: 'edit_note',    label: 'Drafts'  },
]
const SPOOL_DRAWER_PREFIX = 'strands:'
const DRAWER_MIN_W = 220
const DRAWER_MAX_W = 520

// A tool id is "place mode" if choosing it means the next canvas click/tap
// drops a new node — sticky, image, text, line, arrow, or any shape:<variant>.
function isPlaceModeTool(tool) {
  return tool === 'sticky' || tool === 'image' || tool === 'text' || tool === 'line' || tool === 'arrow' || tool.startsWith('shape:')
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
// genId and initials now live in ./utils

// Shared app-wide tooltip — same #woven-tt element and imperative
// show/hide pattern used elsewhere in App.jsx, so toolbar tooltips look
// and behave identically to tooltips anywhere else in Woven.
// Toolbar-specific tooltip helpers — the vertical toolbar sits flush against
// the right edge of the screen, so the shared #woven-tt tooltip's default
// centered position runs off-screen. Right-align it to the button instead,
// and explicitly clear the inline overrides on hide so they don't leak into
// other (centered) tooltips elsewhere in the app that reuse #woven-tt.
function showTt(e, text) {
  const tt = document.getElementById('woven-tt')
  if (!tt) return
  const r = e.currentTarget.getBoundingClientRect()
  tt.textContent = text
  tt.style.display = 'block'
  tt.style.left = 'auto'
  tt.style.transform = 'none'
  tt.style.right = (window.innerWidth - r.right) + 'px'
  tt.style.top = (r.bottom + 6) + 'px'
}
function hideTt() {
  const tt = document.getElementById('woven-tt')
  if (!tt) return
  tt.style.display = 'none'
  tt.style.left = ''
  tt.style.right = ''
  tt.style.transform = ''
}

function accentColor(item) {
  if (!item) return '#aaa'
  if (item.itemType === 'strand') return item.color || '#aaa'
  return STATUSES[item.status]?.color || '#aaa'
}

function buildPayload(raw, itemType, templates) {
  if (itemType === 'strand') {
    const tpl = (templates || []).find(t => t.id === raw.templateId)
    return { ...raw, itemType, fieldDefs: tpl?.fields || [] }
  }
  if (itemType === 'draft') {
    return {
      ...raw, itemType, name: raw.title,
      fields: { synopsis: raw.synopsis },
      fieldDefs: [
        { id: 'synopsis', label: 'Synopsis' },
        { id: 'status',   label: 'Status'   },
      ],
    }
  }
  return {
    ...raw, itemType, name: raw.title || raw.synopsis || '(untitled)',
    fields: { synopsis: raw.synopsis },
    fieldDefs: [{ id: 'synopsis', label: 'Synopsis' }],
  }
}

// ─────────────────────────────────────────────────────────────
// PERSISTENCE via wf_data (matches main app pattern exactly)
// ─────────────────────────────────────────────────────────────
// getClient() replaced by getSupabase() from ./utils

function canvasSave(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
  const uid = window.__wovenUserId
  if (!uid) return
  const sb = getSupabase()
  if (sb) sb.from('wf_data').upsert(
    { key, user_id: uid, value: val, updated_at: new Date().toISOString() },
    { onConflict: 'key,user_id' }
  ).then(() => {})
}

function canvasLoad(key, def) {
  const uid = window.__wovenUserId
  if (!uid) {
    try { const r = localStorage.getItem(key); return Promise.resolve(r ? JSON.parse(r) : def) }
    catch { return Promise.resolve(def) }
  }
  const sb = getSupabase()
  if (!sb) {
    try { const r = localStorage.getItem(key); return Promise.resolve(r ? JSON.parse(r) : def) }
    catch { return Promise.resolve(def) }
  }
  return sb.from('wf_data').select('value').eq('key', key).eq('user_id', uid)
    .maybeSingle().then(r => {
      if (r.data?.value !== undefined) return r.data.value
      try { const local = localStorage.getItem(key); return local ? JSON.parse(local) : def }
      catch { return def }
    })
}

// ─────────────────────────────────────────────────────────────
// HANDLES
// ─────────────────────────────────────────────────────────────
function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top}    id="top"     style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom"  style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left}   id="left"    style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}    id="top-t"   style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right}  id="right-t" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bot-t"   style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   id="left-t"  style={{ opacity: 0 }} />
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// CHECKBOX
// ─────────────────────────────────────────────────────────────
function Checkbox({ checked }) {
  return (
    <div className={`ex-ctx-check ${checked ? 'on' : ''}`}>
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" style={{ display: 'block' }}>
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// WOVEN CARD NODE
// ─────────────────────────────────────────────────────────────
function WovenCardNode({ id, data, selected }) {
  const { itemType, name, color, visibleFields = [], showStatus, onCtx, findItemFn, app, projId } = data
  // Re-resolve item on every render so ctx menu — and edits — always see fresh data
  const item = findItemFn ? findItemFn(data.itemId) : null
  const statusInfo = item?.status ? STATUSES[item.status] : null
  // Show any field the user has chosen to display on this card (visibleFields),
  // regardless of whether it currently has a value — fields are editable
  // right here now, so an empty one just means "click to fill it in".
  const shownFields = (item?.fieldDefs || []).filter(
    fd => fd.id !== 'status' && visibleFields.includes(fd.id)
  )
  // Prefer the live item's own name/colour over the snapshot captured when the
  // card was first placed, so edits made elsewhere (or here) stay in sync.
  const displayName = item?.name ?? name
  const displayColor = item ? accentColor(item) : color

  function commitName(v) {
    v = v.trim()
    if (!v || v === displayName || !item || !app) return
    if (itemType === 'strand') app.updateStrand(projId, item.collectionName, item.id, { name: v })
    else app.updateDraft(projId, item.id, { title: v })
  }

  function commitField(fd, v) {
    if (!item || !app) return
    if (itemType === 'strand') {
      const nf = { ...(item.fields || {}) }
      nf[fd.id] = v
      app.updateStrand(projId, item.collectionName, item.id, { fields: nf })
    } else if (fd.id === 'synopsis') {
      app.updateDraft(projId, item.id, { synopsis: v })
    }
  }

  return (
    <div
      className={`woven-card ${selected ? 'selected' : ''}`}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onCtx?.(e, id, data) }}
    >
      <Handles />
      <div className="woven-card-hdr">
        {itemType === 'strand'
          ? <div className="woven-card-av" style={{ background: displayColor }}>
              {item?.image ? <img src={item.image} alt={displayName} /> : initials(displayName)}
            </div>
          : <div className="woven-card-dot" style={{ background: displayColor }} />
        }
        <input
          key={`${item?.id || id}:${displayName}`}
          className="woven-card-name-input nodrag"
          defaultValue={displayName}
          onBlur={e => commitName(e.target.value)}
          onClick={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
        />
        {showStatus && statusInfo && (
          <div className="woven-card-status-badge" style={{ background: statusInfo.color }}>
            {statusInfo.label}
          </div>
        )}
        <button className="ex-node-menu-btn ex-node-menu-btn--inline nodrag" title="Options"
          onClick={e => { e.stopPropagation(); onCtx?.(e, id, data) }}>
          <span className="mi">more_vert</span>
        </button>
      </div>
      {shownFields.length > 0 && (
        <div className="woven-card-body has-content">
          {shownFields.map(fd => (
            <div className="woven-card-field" key={fd.id}>
              <div className="woven-card-field-lbl">{fd.label}</div>
              <textarea
                key={`${item.id}:${fd.id}:${item.fields[fd.id] || ''}`}
                className="woven-card-field-input nodrag"
                defaultValue={item.fields[fd.id] || ''}
                placeholder={`Add ${fd.label.toLowerCase()}...`}
                rows={2}
                onBlur={e => commitField(fd, e.target.value)}
                onClick={e => e.stopPropagation()}
                onPointerDown={e => e.stopPropagation()}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// STICKY NOTE NODE
// ─────────────────────────────────────────────────────────────
function StickyNoteNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()
  const scheme = STICKY_COLORS.find(c => c.id === (data.colorId ?? 'amber')) || STICKY_COLORS[1]

  function patch(p) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...p } } : n))
  }

  return (
    <div
      className="ex-sticky"
      style={{
        background: scheme.bg, border: `1.5px solid ${scheme.border}`,
        outline: selected ? '2px solid var(--indigo)' : 'none',
        outlineOffset: 2, width: '100%', height: '100%',
      }}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        e.target.dispatchEvent(new CustomEvent('woven:ctx', {
          bubbles: true,
          detail: { nodeId: id, nodeType: 'stickyNote', x: e.clientX, y: e.clientY, data }
        }))
      }}
    >
      <NodeResizer isVisible={selected} minWidth={140} minHeight={60}
        lineStyle={{ border: '1px dashed var(--indigo)' }}
        handleStyle={{ width: 13, height: 13, background: 'var(--indigo)', border: '2px solid var(--bg1)', borderRadius: 3 }} />
      <Handles />
      <button className="ex-node-menu-btn nodrag" title="Options"
        onClick={e => {
          e.stopPropagation()
          e.currentTarget.dispatchEvent(new CustomEvent('woven:ctx', {
            bubbles: true,
            detail: { nodeId: id, nodeType: 'stickyNote', x: e.clientX, y: e.clientY, data }
          }))
        }}>
        <span className="mi">more_vert</span>
      </button>
      <div className="ex-sticky-drag drag-handle__custom">
        <span className="mi">drag_indicator</span>
      </div>
      <div className="ex-sticky-content">
        <textarea
          className={`ex-sticky-input nodrag ${data.isTitle !== false ? 'is-title' : 'is-body'}`}
          value={data.text || ''}
          placeholder={data.isTitle !== false ? 'Note title...' : 'Write a note...'}
          onChange={e => patch({ text: e.target.value })}
          style={{ color: scheme.text }}
          rows={data.isTitle !== false ? 2 : 4}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// IMAGE NODE — no header bar, corner grip only
// ─────────────────────────────────────────────────────────────
function ImageNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()
  const inputRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setNodes(nds => nds.map(n => n.id === id
        ? { ...n, data: { ...n.data, src: ev.target.result } } : n))
    }
    reader.readAsDataURL(file)
  }

  return (
    <div
      className="ex-image-node"
      style={{
        outline: selected ? '2px solid var(--indigo)' : 'none',
        outlineOffset: 2, width: '100%', height: '100%', minWidth: 120, minHeight: 80,
      }}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        e.target.dispatchEvent(new CustomEvent('woven:ctx', {
          bubbles: true,
          detail: { nodeId: id, nodeType: 'imageNode', x: e.clientX, y: e.clientY, data }
        }))
      }}
    >
      <NodeResizer isVisible={selected} minWidth={100} minHeight={80}
        lineStyle={{ border: '1px dashed var(--indigo)' }}
        handleStyle={{ width: 13, height: 13, background: 'var(--indigo)', border: '2px solid var(--bg1)', borderRadius: 3 }} />
      <Handles />
      <button className="ex-node-menu-btn nodrag" title="Options"
        onClick={e => {
          e.stopPropagation()
          e.currentTarget.dispatchEvent(new CustomEvent('woven:ctx', {
            bubbles: true,
            detail: { nodeId: id, nodeType: 'imageNode', x: e.clientX, y: e.clientY, data }
          }))
        }}>
        <span className="mi">more_vert</span>
      </button>
      {/* Corner grip — drag handle */}
      <div className="ex-image-grip drag-handle__custom">
        <span className="mi">drag_indicator</span>
      </div>
      {data.src
        ? <img src={data.src} alt="canvas"
            onClick={() => inputRef.current?.click()}
            style={{ cursor: 'pointer', width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div className="ex-image-empty nodrag" onClick={() => inputRef.current?.click()}>
            <span className="mi">add_photo_alternate</span>
            <span>Click to add image</span>
          </div>
      }
      <input ref={inputRef} type="file" accept="image/*"
        style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SHAPE NODE — rectangle / ellipse / diamond / triangle, connectable,
// colourable, resizable. No built-in text (use the Text tool to label).
// ─────────────────────────────────────────────────────────────
function ShapeNode({ id, data, selected }) {
  const scheme = STICKY_COLORS.find(c => c.id === (data.colorId ?? 'sky')) || STICKY_COLORS[4]
  const variant = data.variant || 'rectangle'
  const isLineLike = variant === 'arrow' || variant === 'line'

  function openMenu(e) {
    e.stopPropagation()
    e.currentTarget.dispatchEvent(new CustomEvent('woven:ctx', {
      bubbles: true,
      detail: { nodeId: id, nodeType: 'shapeNode', x: e.clientX, y: e.clientY, data }
    }))
  }

  // Arrow and line are thin strokes, not filled shapes — a filled
  // clip-path polygon in a min-60x60 box read as a big solid chevron/bar
  // rather than a connector-style line, so these two variants get their
  // own lightweight SVG-stroke rendering instead of the shared
  // background+clipPath treatment below.
  if (isLineLike) {
    const markerId = `ex-arrowhead-${id}`
    return (
      <div
        className="ex-shape-node ex-shape-node--line"
        style={{
          outline: selected ? '2px solid var(--indigo)' : 'none', outlineOffset: 6,
          width: '100%', height: '100%', minWidth: 60, minHeight: 24,
        }}
        onContextMenu={e => {
          e.preventDefault(); e.stopPropagation()
          e.target.dispatchEvent(new CustomEvent('woven:ctx', {
            bubbles: true,
            detail: { nodeId: id, nodeType: 'shapeNode', x: e.clientX, y: e.clientY, data }
          }))
        }}
      >
        <svg width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} preserveAspectRatio="none">
          {variant === 'arrow' && (
            <defs>
              <marker id={markerId} markerWidth="9" markerHeight="9" refX="6" refY="4.5"
                orient="auto" markerUnits="userSpaceOnUse">
                <path d="M0,0 L9,4.5 L0,9 Z" fill={scheme.border} />
              </marker>
            </defs>
          )}
          <line x1="3%" y1="50%" x2={variant === 'arrow' ? '92%' : '97%'} y2="50%"
            stroke={scheme.border} strokeWidth="3" strokeLinecap="round"
            markerEnd={variant === 'arrow' ? `url(#${markerId})` : undefined} />
        </svg>
        <NodeResizer isVisible={selected} minWidth={40} minHeight={20}
          lineStyle={{ border: '1px dashed var(--indigo)' }}
          handleStyle={{ width: 13, height: 13, background: 'var(--indigo)', border: '2px solid var(--bg1)', borderRadius: 3 }} />
        <Handles />
        <button className="ex-node-menu-btn nodrag" title="Options" onClick={openMenu}>
          <span className="mi">more_vert</span>
        </button>
      </div>
    )
  }

  const clipPath = variant === 'diamond'
    ? 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
    : variant === 'triangle'
    ? 'polygon(50% 0%, 100% 100%, 0% 100%)'
    : 'none'
  const borderRadius = variant === 'ellipse' ? '50%' : variant === 'rectangle' ? 8 : 0

  return (
    <div
      className="ex-shape-node"
      style={{
        background: scheme.bg, border: `2px solid ${scheme.border}`, clipPath, borderRadius,
        outline: selected ? '2px solid var(--indigo)' : 'none', outlineOffset: 2,
        width: '100%', height: '100%', minWidth: 60, minHeight: 60,
      }}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        e.target.dispatchEvent(new CustomEvent('woven:ctx', {
          bubbles: true,
          detail: { nodeId: id, nodeType: 'shapeNode', x: e.clientX, y: e.clientY, data }
        }))
      }}
    >
      <NodeResizer isVisible={selected} minWidth={40} minHeight={40}
        lineStyle={{ border: '1px dashed var(--indigo)' }}
        handleStyle={{ width: 13, height: 13, background: 'var(--indigo)', border: '2px solid var(--bg1)', borderRadius: 3 }} />
      <Handles />
      <button className="ex-node-menu-btn nodrag" title="Options" onClick={openMenu}>
        <span className="mi">more_vert</span>
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ANCHOR NODE — invisible 0-footprint node used only as an edge endpoint
// for freeform arrow/line drawing (see the line-tool click handling in
// FlowCanvas below). Never shown to the user and never independently
// selectable/draggable — it exists purely so a real React Flow edge can
// be routed to an exact clicked point instead of to a visible shape.
//
// Renders the same <Handles /> every other node type in this file uses
// (WovenCardNode, ShapeNode, TextNode, etc.) — this turned out to be the
// actual bug behind the edge never appearing. Every other node here has
// real Handle elements for React Flow to route an edge's connection
// point to; this was the only one that had none at all, so React Flow
// had nowhere to attach the edge and silently declined to draw it, with
// completely valid node/edge data otherwise.
// ─────────────────────────────────────────────────────────────
function AnchorNode() {
  return (
    <div style={{ width: 1, height: 1, pointerEvents: 'none' }}>
      <Handles />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TEXT NODE — chromeless editable text, for labelling shapes,
// connectors, or freestanding notes on the canvas.
// ─────────────────────────────────────────────────────────────
function TextNode({ id, data, selected }) {
  const { setNodes } = useReactFlow()

  function patch(p) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...p } } : n))
  }

  return (
    <div
      className="ex-text-node"
      style={{
        outline: selected ? '2px solid var(--indigo)' : 'none', outlineOffset: 4,
        width: '100%', height: '100%',
      }}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        e.target.dispatchEvent(new CustomEvent('woven:ctx', {
          bubbles: true,
          detail: { nodeId: id, nodeType: 'textNode', x: e.clientX, y: e.clientY, data }
        }))
      }}
    >
      <NodeResizer isVisible={selected} minWidth={60} minHeight={30}
        lineStyle={{ border: '1px dashed var(--indigo)' }}
        handleStyle={{ width: 13, height: 13, background: 'var(--indigo)', border: '2px solid var(--bg1)', borderRadius: 3 }} />
      <Handles />
      <button className="ex-node-menu-btn nodrag" title="Options"
        onClick={e => {
          e.stopPropagation()
          e.currentTarget.dispatchEvent(new CustomEvent('woven:ctx', {
            bubbles: true,
            detail: { nodeId: id, nodeType: 'textNode', x: e.clientX, y: e.clientY, data }
          }))
        }}>
        <span className="mi">more_vert</span>
      </button>
      <div className="ex-text-drag drag-handle__custom">
        <span className="mi">drag_indicator</span>
      </div>
      <textarea
        className="ex-text-input nodrag"
        value={data.text || ''}
        placeholder="Text..."
        onChange={e => patch({ text: e.target.value })}
        style={{ color: data.color || '#2a1f10', fontSize: data.size || 18, fontWeight: 600 }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CONTEXT MENU
// ─────────────────────────────────────────────────────────────
function ContextMenu({ ctx, findItem, onClose, onUpdateNode, onDeleteNode }) {
  const ref = useRef(null)

  useEffect(() => {
    function onAny(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('click', onAny, true)
    document.addEventListener('contextmenu', onAny, true)
    return () => {
      document.removeEventListener('click', onAny, true)
      document.removeEventListener('contextmenu', onAny, true)
    }
  }, [onClose])

  const { nodeId, nodeType, x, y, data } = ctx
  // Always re-resolve item fresh so checkboxes reflect current state
  const item = nodeType === 'wovenCard' ? findItem(data.itemId) : null
  const visibleFields = data.visibleFields || []
  const showStatus    = data.showStatus    || false

  return (
    <div className="ex-ctx" ref={ref} style={{
      left: Math.min(x, window.innerWidth  - 250),
      top:  Math.min(y, window.innerHeight - 400),
    }}>
      {/* Card fields */}
      {nodeType === 'wovenCard' && item?.fieldDefs?.length > 0 && (
        <>
          <div className="ex-ctx-lbl">Show on card</div>
          {item.itemType !== 'strand' && (
            <div className="ex-ctx-row"
              onClick={() => onUpdateNode(nodeId, { showStatus: !showStatus })}>
              <Checkbox checked={showStatus} /><span>Status</span>
            </div>
          )}
          {item.fieldDefs.filter(fd => fd.id !== 'status').map(fd => {
            const checked = visibleFields.includes(fd.id)
            return (
              <div key={fd.id} className="ex-ctx-row"
                onClick={() => {
                  const next = checked
                    ? visibleFields.filter(f => f !== fd.id)
                    : [...visibleFields, fd.id]
                  onUpdateNode(nodeId, { visibleFields: next })
                }}>
                <Checkbox checked={checked} /><span>{fd.label}</span>
              </div>
            )
          })}
        </>
      )}

      {/* Sticky options */}
      {nodeType === 'stickyNote' && (
        <>
          <div className="ex-ctx-lbl">Style</div>
          <div className="ex-ctx-row" onClick={() => onUpdateNode(nodeId, { isTitle: true })}>
            <Checkbox checked={data.isTitle !== false} /><span>Title style</span>
          </div>
          <div className="ex-ctx-row" onClick={() => onUpdateNode(nodeId, { isTitle: false })}>
            <Checkbox checked={data.isTitle === false} /><span>Body style</span>
          </div>
          <div className="ex-ctx-lbl">Colour</div>
          <div className="ex-ctx-swatches">
            {STICKY_COLORS.map(c => (
              <div key={c.id}
                className={`ex-ctx-swatch ${data.colorId === c.id ? 'active' : ''}`}
                style={{ background: c.bg, border: `2px solid ${c.border}` }}
                onClick={() => onUpdateNode(nodeId, { colorId: c.id })}
              />
            ))}
          </div>
        </>
      )}

      {/* Shape options */}
      {nodeType === 'shapeNode' && (
        <>
          <div className="ex-ctx-lbl">Shape</div>
          {SHAPE_VARIANTS.map(v => (
            <div key={v.id} className="ex-ctx-row"
              onClick={() => onUpdateNode(nodeId, { variant: v.id })}>
              <Checkbox checked={(data.variant || 'rectangle') === v.id} />
              <span className="mi" style={{ fontSize: 15 }}>{v.icon}</span>
              <span>{v.label}</span>
            </div>
          ))}
          <div className="ex-ctx-lbl">Colour</div>
          <div className="ex-ctx-swatches">
            {STICKY_COLORS.map(c => (
              <div key={c.id}
                className={`ex-ctx-swatch ${(data.colorId ?? 'sky') === c.id ? 'active' : ''}`}
                style={{ background: c.bg, border: `2px solid ${c.border}` }}
                onClick={() => onUpdateNode(nodeId, { colorId: c.id })}
              />
            ))}
          </div>
        </>
      )}

      {/* Text options */}
      {nodeType === 'textNode' && (
        <>
          <div className="ex-ctx-lbl">Size</div>
          {[['14', 'Small'], ['18', 'Medium'], ['28', 'Large']].map(([sz, lbl]) => (
            <div key={sz} className="ex-ctx-row" onClick={() => onUpdateNode(nodeId, { size: Number(sz) })}>
              <Checkbox checked={(data.size || 18) === Number(sz)} /><span>{lbl}</span>
            </div>
          ))}
          <div className="ex-ctx-lbl">Colour</div>
          <div className="ex-ctx-swatches">
            {STICKY_COLORS.map(c => (
              <div key={c.id}
                className={`ex-ctx-swatch ${(data.color === c.text) ? 'active' : ''}`}
                style={{ background: c.text, border: '2px solid rgba(0,0,0,.15)' }}
                onClick={() => onUpdateNode(nodeId, { color: c.text })}
              />
            ))}
          </div>
        </>
      )}

      <div className="ex-ctx-div" />
      <div className="ex-ctx-action danger"
        onClick={() => { onDeleteNode(nodeId); onClose() }}>
        <span className="mi">delete</span>Remove from canvas
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// SPOOL DRAWER PANEL — the drawer body for one specific Spool,
// selected directly from its own toolbar button (see Toolbar).
// List view only, with search + an add-to-canvas icon per row — the
// detail/edit layer this used to have is gone now that cards placed
// on the canvas are directly editable, so there's no need to view or
// edit a strand's fields from inside this drawer anymore.
// ─────────────────────────────────────────────────────────────
function SpoolDrawerPanel({ collectionName, strandsObj, templates, onDragStart, onAddToCanvas, onClose, width }) {
  const [search, setSearch] = useState('')
  const items = strandsObj[collectionName] || []
  const tpl = (templates || []).find(t => t.name === collectionName)
  const q = search.trim().toLowerCase()
  const list = q ? items.filter(s => (s.name || '').toLowerCase().includes(q)) : items

  return (
    <Drawer variant="inline" open title={collectionName} onClose={onClose} width={width} padded={false}
      toolbar={
        <SearchSortBar
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${collectionName.toLowerCase()}...`}
        />
      }
    >
      <div className="ex-edrawer-body">
        {list.length === 0
          ? <HelpText>{q ? 'No matches.' : `No ${collectionName.toLowerCase()} yet.`}</HelpText>
          : list.map(s => (
              <div key={s.id} className="ex-spool-row" draggable
                onDragStart={e => onDragStart(e, buildPayload(s, 'strand', templates))}>
                <StrandResultRow
                  strand={s}
                  spoolIcon={tpl?.icon}
                  hideArrow
                  onAdd={() => onAddToCanvas(s)}
                />
              </div>
            ))
        }
      </div>
    </Drawer>
  )
}

// ─────────────────────────────────────────────────────────────
// DRAFT STATUS FILTER — a filter icon that reveals a small radio-style
// status picker, matching StrandSortFilter's pattern in App.jsx (the
// "tune" icon + floating option list used for the Strands page filter).
// ─────────────────────────────────────────────────────────────
function DraftStatusFilter({ filter, setFilter }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const statusKeys = Object.keys(STATUSES)
  const hasActive = filter !== 'all'

  useEffect(() => {
    if (!open) return
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function pick(k) { setFilter(k); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button className="btn-icon" style={{
        padding: 4, border: `1px solid ${hasActive ? 'var(--indigo)' : 'var(--border)'}`,
        borderRadius: 'var(--r)', color: hasActive ? 'var(--indigo)' : 'var(--mid)',
      }} onClick={() => setOpen(o => !o)}>
        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>tune</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 6, zIndex: 400,
          background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 'var(--rl)',
          boxShadow: '0 8px 28px rgba(42,31,16,.14)', minWidth: 180, padding: 10,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>
            Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 14, color: filter === 'all' ? 'var(--indigo)' : 'var(--text)', fontWeight: filter === 'all' ? 600 : 400 }}
            onClick={() => pick('all')}>
            <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${filter === 'all' ? 'var(--indigo)' : 'var(--border)'}`, background: filter === 'all' ? 'var(--indigo)' : 'transparent', flexShrink: 0 }} />
            All
          </div>
          {statusKeys.map(k => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 14, color: filter === k ? 'var(--indigo)' : 'var(--text)', fontWeight: filter === k ? 600 : 400 }}
              onClick={() => pick(k)}>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${filter === k ? STATUSES[k].color : 'var(--border)'}`, background: filter === k ? STATUSES[k].color : 'transparent', flexShrink: 0 }} />
              {STATUSES[k].label}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DRAFTS PANEL — Drafts and Loose Threads merged into one list.
// Loose Threads was just another status ('loose_thread'), so instead
// of a separate toolbar button and drawer, it's now a filter option
// here alongside every other status. Search bar + filter icon match
// the same SearchSortBar pattern used for the Strands page toolbar.
// ─────────────────────────────────────────────────────────────
function DraftsPanel({ allDrafts, templates, onDragStart, onClose, width }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  const q = search.trim().toLowerCase()
  const list = allDrafts.filter(d => {
    if (filter !== 'all' && d.status !== filter) return false
    if (q && !(d.title || '').toLowerCase().includes(q) && !(d.synopsis || '').toLowerCase().includes(q)) return false
    return true
  })

  return (
    <Drawer variant="inline" open title="Drafts" onClose={onClose} width={width} padded={false}
      toolbar={
        <SearchSortBar
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search drafts..."
          sortSlot={<DraftStatusFilter filter={filter} setFilter={setFilter} />}
        />
      }
    >
      <div className="ex-edrawer-body">
        {list.length === 0
          ? <HelpText>No drafts{filter !== 'all' || q ? ' match this search.' : ' yet.'}</HelpText>
          : list.map(d => {
              const isLT = d.status === 'loose_thread'
              return (
                <div key={d.id} className="ex-draft-row" draggable
                  onDragStart={e => onDragStart(e, buildPayload(d, isLT ? 'loose_thread' : 'draft', templates))}>
                  <div className="ex-draft-dot" style={{ background: STATUSES[d.status]?.color }} />
                  <div className="ex-draft-info">
                    <div className="ex-draft-title">
                      {d.title || d.synopsis || <em style={{ color: 'var(--placeholder)' }}>Untitled</em>}
                    </div>
                    <div className="ex-draft-sub">{STATUSES[d.status]?.label}</div>
                  </div>
                </div>
              )
            })
        }
      </div>
    </Drawer>
  )
}

function DrawerContent({ panel, templates, strandsObj, allDrafts, onDragStart, onAddToCanvas, onClose, width }) {
  // Each panel below owns its own Drawer (title/back button vary per layer),
  // rather than one shared outer Drawer.
  if (panel?.startsWith(SPOOL_DRAWER_PREFIX)) {
    const collectionName = panel.slice(SPOOL_DRAWER_PREFIX.length)
    return (
      <SpoolDrawerPanel
        key={collectionName}
        collectionName={collectionName}
        strandsObj={strandsObj}
        templates={templates}
        onDragStart={onDragStart}
        onAddToCanvas={onAddToCanvas}
        onClose={onClose}
        width={width}
      />
    )
  }
  if (panel === 'drafts') {
    return (
      <DraftsPanel
        allDrafts={allDrafts}
        templates={templates}
        onDragStart={onDragStart}
        onClose={onClose}
        width={width}
      />
    )
  }
  return null
}

// ─────────────────────────────────────────────────────────────
// CANVAS TABS
// ─────────────────────────────────────────────────────────────
function CanvasTabs({ tabs, activeTab, onSelect, onAdd, onRename, onDeleteRequest }) {
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')
  const inputRef = useRef(null)

  function startEdit(tab, e) {
    e.stopPropagation(); setEditing(tab.id); setEditVal(tab.name)
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 30)
  }
  function commitEdit(id) {
    if (editVal.trim()) onRename(id, editVal.trim())
    setEditing(null)
  }

  return (
    <div className="ex-tabs">
      {tabs.map(tab => (
        <div key={tab.id}
          className={`ex-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onSelect(tab.id)}
          onDoubleClick={e => startEdit(tab, e)}
          title="Double-click to rename">
          {editing === tab.id
            ? <input
                ref={inputRef}
                className="ex-tab-name-input"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => commitEdit(tab.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(tab.id)
                  if (e.key === 'Escape') setEditing(null)
                  e.stopPropagation()
                }}
                onClick={e => e.stopPropagation()}
              />
            : <span className="ex-tab-name">{tab.name}</span>
          }
          {tabs.length > 1 && (
            <span className="ex-tab-close"
              onClick={e => { e.stopPropagation(); onDeleteRequest(tab) }}>
              close
            </span>
          )}
        </div>
      ))}
      <div className="ex-tab-add" onClick={onAdd} title="New board">+</div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// TOOLBAR
// ─────────────────────────────────────────────────────────────
function Toolbar({ activeTool, onToolSelect, activeDrawer, onDrawerToggle, collections }) {
  const [shapePickerOpen, setShapePickerOpen] = useState(false)
  const [shapePickerPos, setShapePickerPos] = useState({ top: 0, left: 0 })
  const shapeWrapRef = useRef(null)
  const shapeActive = activeTool.startsWith('shape:')

  // Belt-and-suspenders: whatever else might leave a hover-triggered
  // tooltip stuck (an unmount mid-hover, a fast click, etc.), leaving
  // Explore altogether always clears the shared tooltip.
  useEffect(() => () => hideTt(), [])

  useEffect(() => {
    if (!shapePickerOpen) return
    function onAny(e) {
      if (shapeWrapRef.current && !shapeWrapRef.current.contains(e.target)) setShapePickerOpen(false)
    }
    document.addEventListener('mousedown', onAny, true)
    return () => document.removeEventListener('mousedown', onAny, true)
  }, [shapePickerOpen])

  function handleClick(t, e) {
    if (t.id === 'shape') {
      if (!shapePickerOpen) {
        const rect = e.currentTarget.getBoundingClientRect()
        // Fixed positioning (not the CSS class's absolute+right:64px) so
        // this escapes .ex-toolbar's overflow:hidden — that overflow rule
        // is needed for the scrollable collections list below, but it was
        // silently clipping this popover since it renders outside the
        // toolbar's own 60px width.
        setShapePickerPos({ top: rect.top, left: rect.left - 58 })
      }
      setShapePickerOpen(o => !o)
      return
    }
    onToolSelect(t.id)
  }
  function pickShape(variant) {
    onToolSelect(`shape:${variant}`)
    setShapePickerOpen(false)
    // The popover item is still hovered at the moment of click, but
    // closing the popover unmounts it before a mouseleave can fire — so
    // the shared #woven-tt tooltip never gets told to hide, and since
    // that element lives outside this view, it was staying stuck ("Line",
    // "Arrow", etc.) even after navigating away from Explore entirely.
    hideTt()
  }

  return (
    <div className="ex-toolbar">
      {TOOL_ITEMS.map(t => (
        <div key={t.id} style={{ position: 'relative' }} ref={t.id === 'shape' ? shapeWrapRef : null}>
          <div className={`ex-tool ${(t.id === 'shape' ? shapeActive : activeTool === t.id) ? 'active' : ''}`}
            onClick={e => handleClick(t, e)}
            onMouseEnter={e => showTt(e, t.label)} onMouseLeave={hideTt}>
            <span className="material-symbols-outlined">{t.icon}</span>
          </div>
          {t.id === 'shape' && shapePickerOpen && (
            <div className="ex-shape-popover" style={{ position: 'fixed', top: shapePickerPos.top, left: shapePickerPos.left, right: 'auto' }}>
              {SHAPE_VARIANTS.map(v => (
                <div key={v.id} className="ex-shape-popover-item"
                  onClick={() => pickShape(v.id)}
                  onMouseEnter={e => showTt(e, v.label)} onMouseLeave={hideTt}>
                  <span className="material-symbols-outlined">{v.icon}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="ex-tool-sep" />
      {DRAWER_ITEMS.map(p => (
        <div key={p.id} className={`ex-tool ${activeDrawer === p.id ? 'active' : ''}`}
          onClick={() => onDrawerToggle(p.id)}
          onMouseEnter={e => showTt(e, p.label)} onMouseLeave={hideTt}>
          <span className="material-symbols-outlined">{p.icon}</span>
        </div>
      ))}

      {collections.length > 0 && (
        <>
          <div className="ex-tool-sep" />
          <div className="ex-toolbar-colls">
            {collections.map(c => {
              const drawerId = `${SPOOL_DRAWER_PREFIX}${c.name}`
              return (
                <div key={c.name} className={`ex-tool ${activeDrawer === drawerId ? 'active' : ''}`}
                  onClick={() => onDrawerToggle(drawerId)}
                  onMouseEnter={e => showTt(e, c.name)} onMouseLeave={hideTt}>
                  <span className="material-symbols-outlined">{c.icon}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DELETE BOARD MODAL
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// FLOW CANVAS
// ─────────────────────────────────────────────────────────────
function FlowCanvas({ boardId, projId, activeTool, onToolReset, templates, strandsObj, drafts, looseThreads, pendingAdd, onPendingAddConsumed, app }) {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [ctx, setCtx] = useState(null)
  const canvasRef = useRef(null)
  const saveTimer = useRef(null)
  const boardIdRef = useRef(boardId)
  useEffect(() => { boardIdRef.current = boardId }, [boardId])

  // Freeform line/arrow drawing is a drag: mousedown sets the start point,
  // dragging live-updates a real preview edge, mouseup finalizes it.
  //
  // History of what didn't work, for the next person (or me) touching
  // this: a two-click version collided with React Flow's default
  // double-click-to-zoom. A drag version wired via a plain 'mousedown'
  // listener on the wrapper div never reliably fired — React Flow v12
  // handles pane interaction internally and there's no official
  // onPaneMouseDown/Up prop to hook into (checked the current API
  // reference — only onPaneMouseMove/Enter/Leave exist). A follow-up
  // version rendered an overlay *inside* <ReactFlow />'s own tree
  // (xyflow's own "Rectangle" whiteboard example does this) with
  // stopPropagation on its onMouseDown — closer, but the tool was still
  // getting reset immediately on mousedown, meaning something in React
  // Flow's own handling was still seeing the event before my handler's
  // stopPropagation could run.
  //
  // This version is the maximally strict fix: a *native* listener on
  // canvasRef — react-flow's own outer ancestor, which we own completely
  // — attached in the capture phase (the `true` third argument). Capture
  // fires top-down, before any bubble-phase handler and before any
  // capture-phase handler on a descendant, so this is guaranteed to run
  // before literally anything React Flow itself does internally.
  // Calling stopPropagation() here during the capture phase prevents the
  // event from ever reaching react-flow's own elements at all — not even
  // their own capture-phase listeners see it. There is no earlier point
  // in the DOM tree to intercept from than this.
  const lineDrawRef = useRef(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return

    function toFlowPos(e) {
      const rect = canvasRef.current.getBoundingClientRect()
      return screenToFlowPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }

    function onDown(e) {
      if (activeTool !== 'line' && activeTool !== 'arrow') return
      if (!initialLoadDoneRef.current) return
      e.preventDefault()
      e.stopPropagation()
      const position = toFlowPos(e)
      const startId = genId(), endId = genId(), edgeId = genId()
      lineDrawRef.current = { startId, endId, edgeId, screenStart: { x: e.clientX, y: e.clientY } }
      setNodes(nds => [...nds,
        { id: startId, type: 'anchorNode', position, draggable: false, selectable: false, connectable: false, data: {} },
        { id: endId,   type: 'anchorNode', position, draggable: false, selectable: false, connectable: false, data: {} },
      ])
      setEdges(eds => [...eds, {
        id: edgeId, source: startId, target: endId, sourceHandle: 'bottom', targetHandle: 'top-t', type: 'straight',
        style: { stroke: 'var(--bg4)', strokeWidth: 3 },
        markerEnd: activeTool === 'arrow' ? { type: MarkerType.ArrowClosed, color: 'var(--bg4)', width: 14, height: 14 } : undefined,
        data: { isFreeformLine: true, anchorIds: [startId, endId] },
      }])
    }
    function onMove(e) {
      const d = lineDrawRef.current
      if (!d) return
      e.stopPropagation()
      const position = toFlowPos(e)
      setNodes(nds => nds.map(n => n.id === d.endId ? { ...n, position } : n))
    }
    function onUp(e) {
      const d = lineDrawRef.current
      if (!d) return
      e.stopPropagation()
      const dx = e.clientX - d.screenStart.x, dy = e.clientY - d.screenStart.y
      // A drag shorter than this reads as a stray click rather than an
      // intentional line, so it's discarded instead of leaving a
      // zero-length edge behind.
      if (Math.sqrt(dx * dx + dy * dy) < 6) {
        setNodes(nds => nds.filter(n => n.id !== d.startId && n.id !== d.endId))
        setEdges(eds => eds.filter(ed => ed.id !== d.edgeId))
      }
      lineDrawRef.current = null
      onToolReset()
    }

    el.addEventListener('mousedown', onDown, true)
    window.addEventListener('mousemove', onMove, true)
    window.addEventListener('mouseup', onUp, true)
    return () => {
      el.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mousemove', onMove, true)
      window.removeEventListener('mouseup', onUp, true)
    }
  }, [activeTool, screenToFlowPosition, setNodes, setEdges, onToolReset])

  // Build live item lookup — always reflects latest app data
  const findItem = useCallback((id) => {
    for (const [collectionName, items] of Object.entries(strandsObj)) {
      const s = items.find(s => s.id === id)
      if (s) return { ...buildPayload(s, 'strand', templates), collectionName }
    }
    const d = drafts.find(d => d.id === id)
    if (d) return buildPayload(d, 'draft', templates)
    const lt = looseThreads.find(l => l.id === id)
    if (lt) return buildPayload(lt, 'loose_thread', templates)
    return null
  }, [strandsObj, drafts, looseThreads, templates])

  // Load state on board change. Guarded against a race where this async
  // load resolves *after* the user has already interacted with the
  // canvas (e.g. drawing a line right after opening Explore) — without
  // initialLoadDoneRef, that late resolution would silently overwrite
  // whatever they'd just added with the last-saved (older) state, with no
  // error of any kind since nothing actually throws. The line-drawing
  // mousedown handler checks this ref and won't start a draw until the
  // load for the current board has actually finished.
  const initialLoadDoneRef = useRef(false)
  useEffect(() => {
    initialLoadDoneRef.current = false
    canvasLoad(`canvas:state:${projId}:${boardId}`, null).then(saved => {
      setNodes(saved?.nodes || [])
      setEdges(saved?.edges || [])
      initialLoadDoneRef.current = true
    })
  }, [projId, boardId])

  // Debounced auto-save
  useEffect(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      canvasSave(`canvas:state:${projId}:${boardIdRef.current}`, { nodes, edges })
    }, 800)
    return () => clearTimeout(saveTimer.current)
  }, [nodes, edges, projId])

  // Listen for sticky/image context menu events
  useEffect(() => {
    const el = canvasRef.current
    function onWovenCtx(e) {
      const { nodeId, nodeType, x, y, data } = e.detail
      setCtx({ nodeId, nodeType, x, y, data })
    }
    el?.addEventListener('woven:ctx', onWovenCtx)
    return () => el?.removeEventListener('woven:ctx', onWovenCtx)
  }, [])

  // Re-create nodeTypes when findItem changes so cards always see fresh data
  const nodeTypes = useMemo(() => ({
    wovenCard: (props) => (
      <WovenCardNode {...props} data={{
        ...props.data,
        findItemFn: findItem,
        app, projId,
        onCtx: (e, id, data) => setCtx({ nodeId: id, nodeType: 'wovenCard', x: e.clientX, y: e.clientY, data }),
      }} />
    ),
    stickyNote: StickyNoteNode,
    imageNode:  ImageNode,
    shapeNode:  ShapeNode,
    textNode:   TextNode,
    anchorNode: AnchorNode,
  }), [findItem, app, projId])

  function updateNode(nodeId, patch) {
    setNodes(nds => nds.map(n => n.id !== nodeId ? n : { ...n, data: { ...n.data, ...patch } }))
    // Also update ctx data so checkboxes reflect new state immediately
    setCtx(prev => prev?.nodeId === nodeId
      ? { ...prev, data: { ...prev.data, ...patch } }
      : prev
    )
  }
  function deleteNode(nodeId) {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
  }

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--bg4)', width: 18, height: 18 },
      style: { stroke: 'var(--bg4)', strokeWidth: 2 },
    }, eds))
  }, [setEdges])

  // Freeform arrow/line edges are backed by invisible anchor nodes (see
  // onPaneClick below) — when such an edge is removed, its anchor nodes
  // become orphaned invisible nodes unless cleaned up here alongside it.
  const handleEdgesChange = useCallback((changes) => {
    const removeIds = changes.filter(c => c.type === 'remove').map(c => c.id)
    if (removeIds.length) {
      const anchorIdsToRemove = new Set()
      edges.forEach(e => {
        if (removeIds.includes(e.id) && e.data?.isFreeformLine && e.data?.anchorIds) {
          e.data.anchorIds.forEach(id => anchorIdsToRemove.add(id))
        }
      })
      if (anchorIdsToRemove.size) setNodes(nds => nds.filter(n => !anchorIdsToRemove.has(n.id)))
    }
    onEdgesChange(changes)
  }, [edges, onEdgesChange, setNodes])

  const onDragOver = useCallback((e) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/woven-item')
    if (!raw) return
    const item = JSON.parse(raw)
    const rect = canvasRef.current.getBoundingClientRect()
    const position = screenToFlowPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setNodes(nds => [...nds, {
      id: genId(), type: 'wovenCard', position,
      data: {
        itemId: item.id, itemType: item.itemType,
        name: item.name, color: accentColor(item),
        visibleFields: [], showStatus: false,
      },
    }])
  }, [screenToFlowPosition, setNodes])

  // "Add to canvas" from the Spool drawer (StrandResultRow's add icon) —
  // same node shape as a drag-drop, just placed at the current viewport
  // centre instead of a drop point.
  useEffect(() => {
    if (!pendingAdd || !canvasRef.current) return
    const item = buildPayload(pendingAdd, 'strand', templates)
    const position = screenToFlowPosition({
      x: canvasRef.current.clientWidth / 2,
      y: canvasRef.current.clientHeight / 2,
    })
    setNodes(nds => [...nds, {
      id: genId(), type: 'wovenCard', position,
      data: {
        itemId: item.id, itemType: item.itemType,
        name: item.name, color: accentColor(item),
        visibleFields: [], showStatus: false,
      },
    }])
    onPendingAddConsumed?.()
  }, [pendingAdd, templates, screenToFlowPosition, setNodes, onPendingAddConsumed])

  const onPaneClick = useCallback((e) => {
    if (!isPlaceModeTool(activeTool)) return
    const rect = canvasRef.current.getBoundingClientRect()
    const position = screenToFlowPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    if (activeTool === 'sticky') {
      setNodes(nds => [...nds, {
        id: genId(), type: 'stickyNote', position,
        dragHandle: '.drag-handle__custom',
        data: { text: '', colorId: 'amber', isTitle: true },
      }])
    }
    if (activeTool === 'image') {
      setNodes(nds => [...nds, {
        id: genId(), type: 'imageNode', position,
        dragHandle: '.drag-handle__custom',
        data: { src: null },
      }])
    }
    if (activeTool === 'text') {
      setNodes(nds => [...nds, {
        id: genId(), type: 'textNode', position,
        dragHandle: '.drag-handle__custom',
        data: { text: '', color: '#2a1f10', size: 18 },
      }])
    }
    if (activeTool.startsWith('shape:')) {
      const variant = activeTool.split(':')[1]
      const defaultSize = {
        rectangle: { width: 140, height: 100 },
        ellipse:   { width: 120, height: 120 },
        diamond:   { width: 120, height: 120 },
        triangle:  { width: 120, height: 104 },
      }[variant] || { width: 120, height: 120 }
      setNodes(nds => [...nds, {
        id: genId(), type: 'shapeNode', position,
        style: defaultSize,
        data: { variant, colorId: 'sky' },
      }])
    }
    // line/arrow are now their own top-level tools (not 'shape:*'),
    // handled entirely by the capture-phase mousedown/mousemove/mouseup
    // listener above — this click handler never sees them.
    onToolReset()
  }, [activeTool, screenToFlowPosition, setNodes, setEdges, onToolReset])

  const isPlaceMode = isPlaceModeTool(activeTool)

  return (
    <div ref={canvasRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={handleEdgesChange}
        onConnect={onConnect} onDrop={onDrop} onDragOver={onDragOver}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        panOnDrag={!isPlaceMode}
        selectionOnDrag={!isPlaceMode}
        deleteKeyCode={['Delete', 'Backspace']}
        style={{ cursor: isPlaceMode ? 'crosshair' : 'default' }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={36} size={1.5}
          color="rgba(160,120,70,0.3)" style={{ background: 'var(--bg0)' }} />
        <Controls showInteractive={false} />
        <MiniMap nodeColor={n => n.data?.color || 'var(--bg3)'}
          maskColor="rgba(253,248,240,0.7)" style={{ background: 'var(--bg1)' }} />
      </ReactFlow>

      {ctx && (
        <ContextMenu
          ctx={ctx}
          findItem={findItem}
          onClose={() => setCtx(null)}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────
const INIT_ID     = genId()
const INIT_BOARDS = [{ id: INIT_ID, name: 'Board 1' }]

export default function ExploreCanvas({ app }) {
  const projId       = app.projId
  const templates    = app.allTemplates?.[projId] || []
  const strandsObj   = app.allStrands?.[projId]   || {}
  const allDrafts    = app.allDrafts?.[projId]     || []
  const drafts       = allDrafts.filter(d => d.status !== 'loose_thread')
  const looseThreads = allDrafts.filter(d => d.status === 'loose_thread')

  // One toolbar button per Spool collection, using the icon/colour/name set
  // on that collection in the Strands page. Order mirrors the Strands page's
  // own saved tab order (same localStorage key) so the two stay consistent.
  const collections = useMemo(() => {
    let names = Object.keys(strandsObj)
    try {
      const saved = JSON.parse(localStorage.getItem(`woven:collOrder:${projId}`) || 'null')
      if (Array.isArray(saved)) {
        names = saved.filter(n => names.includes(n)).concat(names.filter(n => !saved.includes(n)))
      }
    } catch {}
    return names.map(name => {
      const tpl = templates.find(t => t.name === name)
      return { name, icon: tpl?.icon || 'auto_stories', color: tpl?.color || '#7A5A38' }
    })
  }, [strandsObj, templates, projId])

  const [boards, setBoards]           = useState(INIT_BOARDS)
  const [activeBoard, setActiveBoard] = useState(INIT_ID)
  const [activeDrawer, setActiveDrawer] = useState(null)
  const [activeTool, setActiveTool]   = useState('select')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [boardsLoaded, setBoardsLoaded] = useState(false)
  const [pendingAdd, setPendingAdd]   = useState(null)

  // Resizable Strands/Drafts/Threads drawer width — remembered across sessions.
  const [drawerWidth, setDrawerWidth] = useState(() => {
    const saved = Number(localStorage.getItem('woven:canvasDrawerWidth'))
    return saved >= DRAWER_MIN_W && saved <= DRAWER_MAX_W ? saved : 280
  })
  const [isResizingDrawer, setIsResizingDrawer] = useState(false)
  const drawerDragRef = useRef(null)

  function startDrawerResize(e) {
    e.preventDefault()
    drawerDragRef.current = { startX: e.clientX, startWidth: drawerWidth }
    setIsResizingDrawer(true)
    function onMove(ev) {
      const { startX, startWidth } = drawerDragRef.current
      // Drawer sits to the right of the canvas, so dragging left widens it.
      const next = Math.min(DRAWER_MAX_W, Math.max(DRAWER_MIN_W, startWidth - (ev.clientX - startX)))
      setDrawerWidth(next)
    }
    function onUp() {
      setIsResizingDrawer(false)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      setDrawerWidth(w => { localStorage.setItem('woven:canvasDrawerWidth', String(w)); return w })
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  // Load board list for this project
  useEffect(() => {
    if (!projId) return
    canvasLoad(`canvas:boards:${projId}`, null).then(saved => {
      if (saved?.boards?.length) {
        setBoards(saved.boards)
        setActiveBoard(saved.activeId || saved.boards[0].id)
      }
      setBoardsLoaded(true)
    })
  }, [projId])

  // Save board list whenever it changes
  useEffect(() => {
    if (!boardsLoaded || !projId) return
    canvasSave(`canvas:boards:${projId}`, { boards, activeId: activeBoard })
  }, [boards, activeBoard, boardsLoaded, projId])

  function addBoard() {
    const nb = { id: genId(), name: `Board ${boards.length + 1}` }
    setBoards(b => [...b, nb]); setActiveBoard(nb.id)
  }
  function renameBoard(id, name) {
    setBoards(b => b.map(board => board.id === id ? { ...board, name } : board))
  }
  function confirmDelete() {
    canvasSave(`canvas:state:${projId}:${deleteTarget.id}`, null)
    try { localStorage.removeItem(`canvas:state:${projId}:${deleteTarget.id}`) } catch {}
    const next = boards.filter(b => b.id !== deleteTarget.id)
    const idx  = boards.findIndex(b => b.id === deleteTarget.id)
    setBoards(next)
    if (activeBoard === deleteTarget.id)
      setActiveBoard(next[Math.max(0, idx - 1)]?.id || next[0]?.id)
    setDeleteTarget(null)
  }

  function toggleDrawer(panel) { setActiveDrawer(d => d === panel ? null : panel) }
  function handleToolSelect(tool) { setActiveTool(t => t === tool ? 'select' : tool) }
  function handleDragStart(e, item) {
    e.dataTransfer.setData('application/woven-item', JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'copy'
  }

  if (!projId) return null

  return (
    <div className="ex-shell">
      <CanvasStyles />
      <div className="ex-body">
        <div className="ex-canvas-col">
          <CanvasTabs
            tabs={boards} activeTab={activeBoard}
            onSelect={setActiveBoard} onAdd={addBoard}
            onRename={renameBoard} onDeleteRequest={tab => setDeleteTarget(tab)}
          />
          <div className="ex-canvas-row">
            <div className="ex-canvas-area"
              style={{ cursor: isPlaceModeTool(activeTool) ? 'crosshair' : undefined }}>
              <ReactFlowProvider>
                <FlowCanvas
                  key={`${projId}:${activeBoard}`}
                  boardId={activeBoard} projId={projId}
                  activeTool={activeTool} onToolReset={() => setActiveTool('select')}
                  templates={templates} strandsObj={strandsObj}
                  drafts={drafts} looseThreads={looseThreads}
                  pendingAdd={pendingAdd} onPendingAddConsumed={() => setPendingAdd(null)}
                  app={app}
                />
              </ReactFlowProvider>
            </div>
            <div className="ex-right">
              <Toolbar
                activeTool={activeTool} onToolSelect={handleToolSelect}
                activeDrawer={activeDrawer} onDrawerToggle={toggleDrawer}
                collections={collections}
              />
              <div className={`ex-drawer ${activeDrawer ? 'open' : ''} ${isResizingDrawer ? 'resizing' : ''}`}
                style={{ width: activeDrawer ? drawerWidth : 0 }}>
                {activeDrawer && (
                  <div className="ex-drawer-resize-handle"
                    onPointerDown={startDrawerResize}
                    title="Drag to resize" />
                )}
                <div className="ex-drawer-inner" style={{ width: drawerWidth }}>
                  <DrawerContent
                    panel={activeDrawer}
                    templates={templates} strandsObj={strandsObj}
                    allDrafts={allDrafts}
                    onDragStart={handleDragStart}
                    onAddToCanvas={setPendingAdd}
                    onClose={() => setActiveDrawer(null)}
                    width={drawerWidth}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          itemName={deleteTarget.name}
          message={<>All cards on this board will be permanently removed.</>}
          confirmLabel="Delete board"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

