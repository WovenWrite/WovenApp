// @ts-nocheck
// Woven — ExploreCanvas
// Drop into src/ExploreCanvas.jsx in the main app.
//
// Prerequisites:
//   - npm install @xyflow/react
//   - import '@xyflow/react/dist/style.css' in src/main.tsx
//   - vite.config: resolve: { dedupe: ['react','react-dom'] }
//
// Usage in App.jsx (line ~3316):
//   import ExploreCanvas from './ExploreCanvas'
//   if(view==='canvas') vc = <ExploreCanvas app={app} />;

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant,
  Controls, MiniMap, addEdge, useNodesState, useEdgesState, useReactFlow,
  Handle, Position, NodeResizer,
} from '@xyflow/react'

// ─────────────────────────────────────────────────────────────
// STYLES  (canvas-specific only — design tokens come from main app)
// ─────────────────────────────────────────────────────────────
const CANVAS_CSS = `
/* Canvas shell */
.ex-shell{display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden;}
.ex-body{display:flex;flex:1;overflow:hidden;min-height:0;}
.ex-canvas-col{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;min-height:0;}

/* Tabs */
.ex-tabs{display:flex;align-items:flex-end;height:36px;background:var(--bg1);
  border-bottom:1px solid var(--border);padding:0 8px;gap:2px;flex-shrink:0;}
.ex-tab{display:flex;align-items:center;gap:5px;height:28px;padding:0 10px;
  border-radius:6px 6px 0 0;font-size:12px;font-weight:500;cursor:pointer;
  color:var(--mid);border:1px solid transparent;border-bottom:none;
  transition:all .12s;white-space:nowrap;max-width:160px;overflow:hidden;}
.ex-tab:hover{color:var(--text);background:var(--bg2);}
.ex-tab.active{background:var(--bg0);color:var(--text);border-color:var(--border);
  border-bottom-color:var(--bg0);position:relative;top:1px;}
.ex-tab-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ex-tab-name-input{background:none;border:none;outline:none;font-family:var(--ui);
  font-size:12px;font-weight:500;color:var(--text);width:90px;padding:0;}
.ex-tab-close{font-size:13px;color:var(--placeholder);border-radius:3px;padding:1px 2px;
  display:flex;align-items:center;justify-content:center;font-family:'Material Icons';
  line-height:1;flex-shrink:0;}
.ex-tab-close:hover{background:var(--bg3);color:var(--text);}
.ex-tab-add{width:26px;height:26px;border-radius:6px;border:1px dashed var(--border);
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  color:var(--placeholder);font-size:18px;flex-shrink:0;margin-left:2px;
  transition:all .12s;line-height:1;user-select:none;}
.ex-tab-add:hover{border-color:var(--indigo);color:var(--indigo);background:rgba(196,94,40,.05);}

/* Canvas + right panel row */
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
  background:var(--indigo)!important;border-color:var(--indigoL)!important;
  box-shadow:0 0 0 4px rgba(196,94,40,.3)!important;}
.react-flow__handle-connecting,.react-flow__handle-valid{opacity:1!important;}
.react-flow__node:hover .woven-card:not(.selected){box-shadow:0 0 0 2px rgba(196,94,40,.2),0 4px 16px rgba(42,31,16,.1);}

/* Right panel */
.ex-right{display:flex;flex-direction:row-reverse;flex-shrink:0;}

/* Toolbar */
.ex-toolbar{width:60px;background:var(--bg1);display:flex;flex-direction:column;
  align-items:center;padding:10px 0;gap:1px;flex-shrink:0;border-left:1px solid var(--border);}
.ex-tool{width:52px;min-height:46px;border-radius:8px;display:flex;flex-direction:column;
  align-items:center;justify-content:center;cursor:pointer;color:var(--mid);
  transition:all .12s;gap:2px;padding:4px 2px;}
.ex-tool:hover{background:var(--bg2);color:var(--text);}
.ex-tool.active{background:rgba(196,94,40,.12);color:var(--indigo);}
.ex-tool .mi{font-size:18px;line-height:1;}
.ex-tool-lbl{font-size:9px;font-weight:500;text-align:center;line-height:1;}
.ex-tool-sep{width:32px;height:1px;background:var(--border);margin:4px 0;flex-shrink:0;}

/* Drawer */
.ex-drawer{width:0;overflow:hidden;transition:width .2s ease;background:var(--bg1);
  border-left:1px solid var(--border);display:flex;flex-direction:column;}
.ex-drawer.open{width:280px;margin:5px 5px 5px 0;border:1px solid var(--border);border-radius:var(--r);}
.ex-drawer-inner{width:280px;display:flex;flex-direction:column;height:100%;overflow:hidden;}
.ex-editor-drawer{background:var(--bg1);display:flex;flex-direction:column;height:100%;}
.ex-edrawer-hdr{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;
  align-items:center;justify-content:space-between;flex-shrink:0;background:var(--bg1);}
.ex-edrawer-title{font-size:14px;font-weight:600;color:var(--text);}
.ex-edrawer-body{flex:1;overflow-y:auto;display:flex;flex-direction:column;}
.ex-edrawer-tabs{display:flex;border-bottom:1px solid var(--border);flex-shrink:0;
  overflow-x:auto;background:var(--bg1);}
.ex-edrawer-tab{padding:7px 12px;font-size:11px;font-weight:600;cursor:pointer;
  color:var(--mid);border-bottom:2px solid transparent;white-space:nowrap;transition:all .12s;}
.ex-edrawer-tab:hover{color:var(--text);}
.ex-edrawer-tab.active{color:var(--indigo);border-bottom-color:var(--indigo);}
.ex-edrawer-section{padding:10px 14px;border-bottom:1px solid var(--border);}
.ex-edrawer-lbl{font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:7px;display:block;}
.ex-edrawer-row{display:flex;align-items:center;gap:10px;padding:9px 14px;
  border-bottom:1px solid var(--border);cursor:grab;user-select:none;transition:background .12s;}
.ex-edrawer-row:hover{background:var(--bg2);}
.ex-edrawer-row:active{cursor:grabbing;}
.ex-edrawer-av{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:11px;font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;}
.ex-edrawer-av img{width:100%;height:100%;object-fit:cover;}
.ex-edrawer-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.ex-edrawer-info{flex:1;min-width:0;}
.ex-edrawer-name{font-family:var(--serif);font-size:14px;font-weight:600;color:var(--text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ex-edrawer-sub{font-size:11px;color:var(--mid);}
.ex-edrawer-drag-hint{font-size:12px;color:var(--placeholder);font-family:var(--scribble);
  opacity:0;transition:opacity .12s;flex-shrink:0;}
.ex-edrawer-row:hover .ex-edrawer-drag-hint{opacity:1;}

/* Woven cards */
.woven-card{background:var(--bg1);border:1.5px solid var(--border);border-radius:10px;
  display:flex;flex-direction:column;font-family:var(--ui);overflow:hidden;
  box-shadow:0 2px 8px rgba(42,31,16,.08);min-width:180px;max-width:260px;}
.woven-card.selected{border-color:var(--indigo);box-shadow:0 0 0 2px rgba(196,94,40,.15);}
.woven-card-hdr{display:flex;align-items:center;gap:7px;padding:8px 10px;
  background:var(--bg0);flex-shrink:0;}
.woven-card-av{width:22px;height:22px;border-radius:50%;flex-shrink:0;display:flex;
  align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;overflow:hidden;}
.woven-card-av img{width:100%;height:100%;object-fit:cover;}
.woven-card-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
.woven-card-name{font-family:var(--serif);font-size:14px;font-weight:600;color:var(--text);
  flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.woven-card-status{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;
  color:#fff;padding:2px 5px;border-radius:3px;flex-shrink:0;white-space:nowrap;}
.woven-card-body.has-content{padding:7px 10px;border-top:1px solid var(--border);}
.woven-card-field{margin-bottom:5px;}
.woven-card-field:last-child{margin-bottom:0;}
.woven-card-field-lbl{font-size:9px;font-weight:600;color:var(--indigo);text-transform:uppercase;
  letter-spacing:.06em;margin-bottom:1px;}
.woven-card-field-val{font-size:11px;color:var(--body-text);line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}

/* Sticky note */
.ex-sticky-node{border-radius:8px;display:flex;flex-direction:column;overflow:hidden;
  min-width:160px;min-height:60px;box-shadow:2px 3px 10px rgba(0,0,0,.08);}
.ex-sticky-drag{height:20px;cursor:grab;display:flex;align-items:center;
  padding:0 8px;flex-shrink:0;opacity:.5;}
.ex-sticky-drag:active{cursor:grabbing;}
.ex-sticky-drag .mi{font-size:14px;}
.ex-sticky-content{padding:6px 12px 10px;flex:1;}
.ex-sticky-input{background:none;border:none;outline:none;width:100%;resize:none;
  font-family:var(--serif);line-height:1.45;color:#2a1f00;}
.ex-sticky-input.is-title{font-size:16px;font-weight:600;}
.ex-sticky-input.is-body{font-size:13px;font-weight:400;font-family:var(--ui);}
.ex-sticky-input::placeholder{opacity:.4;}

/* Image node */
.ex-image-node{border:1.5px solid var(--border);border-radius:8px;overflow:hidden;
  box-shadow:0 2px 8px rgba(42,31,16,.08);background:var(--bg1);display:flex;flex-direction:column;}
.ex-image-drag{padding:5px 8px;background:var(--bg2);cursor:grab;display:flex;
  align-items:center;gap:4px;font-size:11px;color:var(--mid);flex-shrink:0;}
.ex-image-drag:active{cursor:grabbing;}
.ex-image-drag .mi{font-size:14px;}
.ex-image-body img{display:block;max-width:100%;max-height:220px;object-fit:cover;}
.ex-image-empty{width:180px;height:130px;display:flex;align-items:center;
  justify-content:center;flex-direction:column;gap:6px;cursor:pointer;color:var(--placeholder);}
.ex-image-empty .mi{font-size:32px;}
.ex-image-empty span{font-size:12px;}

/* Context menu */
.ex-ctx-menu{position:fixed;z-index:9999;background:var(--bg1);border:1px solid var(--border);
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
.ex-ctx-swatch-row{display:flex;align-items:center;gap:6px;padding:6px 14px 10px;}
.ex-ctx-swatch{width:18px;height:18px;border-radius:50%;cursor:pointer;
  border:2px solid transparent;transition:transform .1s;flex-shrink:0;}
.ex-ctx-swatch:hover,.ex-ctx-swatch.active{transform:scale(1.25);border-color:rgba(0,0,0,.25);}
.ex-ctx-div{height:1px;background:var(--border);margin:4px 0;}
.ex-ctx-action{display:flex;align-items:center;gap:8px;padding:7px 14px;
  cursor:pointer;transition:background .1s;font-size:13px;}
.ex-ctx-action:hover{background:var(--bg2);}
.ex-ctx-action.danger{color:var(--danger);}
.ex-ctx-action .mi{font-size:15px;}

/* Delete board modal */
.ex-modal-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;}
.ex-modal-backdrop{position:absolute;inset:0;background:rgba(42,31,16,.4);backdrop-filter:blur(2px);}
.ex-modal-box{position:relative;background:var(--bg1);border:1px solid var(--border);
  border-radius:var(--rl);padding:28px;width:420px;max-width:92vw;
  box-shadow:0 20px 60px rgba(42,31,16,.18);z-index:1;}
.ex-modal-title{font-family:var(--serif);font-size:20px;font-weight:600;color:var(--text);margin-bottom:10px;}
.ex-modal-body{font-size:14px;color:var(--body-text);line-height:1.6;margin-bottom:16px;}
.ex-modal-input{width:100%;border:1.5px solid var(--border);border-radius:var(--r);
  padding:8px 12px;font-family:var(--ui);font-size:14px;background:var(--bg0);
  color:var(--text);outline:none;margin-bottom:16px;}
.ex-modal-input:focus{border-color:var(--indigo);}
.ex-modal-actions{display:flex;gap:8px;}
`

function CanvasStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CANVAS_CSS }} />
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────
const STATUSES = {
  loose_thread: { label: 'Loose Thread', color: '#d4943e' },
  first_draft:  { label: 'First Draft',  color: '#2f76e0' },
  second_draft: { label: 'Second Draft', color: '#e02f79' },
  under_review: { label: 'Under Review', color: '#ce2fe0' },
  complete:     { label: 'Complete',     color: '#64e02f' },
}

const STICKY_COLORS = [
  { id: 'none',   bg: '#fdf8f0', border: '#e2d0b8', text: '#2a1f10', label: 'None'   },
  { id: 'amber',  bg: '#fff4e0', border: '#f0c878', text: '#5a3800', label: 'Amber'  },
  { id: 'sage',   bg: '#eaf5ee', border: '#9ecfaa', text: '#1a3d25', label: 'Sage'   },
  { id: 'rose',   bg: '#fdeef2', border: '#f0a8bc', text: '#5a1a2a', label: 'Rose'   },
  { id: 'sky',    bg: '#e8f2fc', border: '#9abee8', text: '#1a3050', label: 'Sky'    },
  { id: 'lilac',  bg: '#f2eefa', border: '#c8aae8', text: '#3a1a5a', label: 'Lilac'  },
]

const TOOL_ITEMS = [
  { id: 'select', icon: 'near_me',            label: 'Select' },
  { id: 'sticky', icon: 'sticky_note_2',       label: 'Sticky' },
  { id: 'image',  icon: 'add_photo_alternate', label: 'Image'  },
]

const DRAWER_ITEMS = [
  { id: 'strands',       icon: 'share',        label: 'Strands' },
  { id: 'drafts',        icon: 'edit_note',    label: 'Drafts'  },
  { id: 'loose_threads', icon: 'scatter_plot', label: 'Threads' },
]

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function genId() {
  return '_' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function initials(name) {
  if (!name || !name.trim()) return '?'
  const p = name.trim().split(/\s+/).filter(w => w.length > 0)
  if (p.length === 0) return '?'
  if (p.length === 1) return p[0][0].toUpperCase()
  return (p[0][0] + p[p.length - 1][0]).toUpperCase()
}

function accentColor(item) {
  if (!item) return '#aaa'
  if (item.itemType === 'strand') return item.color || '#aaa'
  return STATUSES[item.status]?.color || '#aaa'
}

function badgeLabel(item) {
  if (!item) return ''
  if (item.itemType === 'strand') return item.collectionName
  if (item.itemType === 'draft') return `Draft ${item.order}`
  return 'Loose Thread'
}

// Build a draggable payload from a strand/draft/loose_thread
function buildPayload(raw, itemType, templates) {
  if (itemType === 'strand') {
    const tpl = (templates || []).find(t => t.id === raw.templateId)
    return { ...raw, itemType, fieldDefs: tpl?.fields || [] }
  }
  if (itemType === 'draft') {
    return {
      ...raw, itemType, name: raw.title,
      fields: { synopsis: raw.synopsis, pov: raw.pov },
      fieldDefs: [
        { id: 'synopsis', label: 'Synopsis' },
        { id: 'status',   label: 'Status'   },
        { id: 'pov',      label: 'POV'      },
      ],
    }
  }
  return {
    ...raw, itemType, name: raw.title || '(untitled)',
    fields: { synopsis: raw.synopsis },
    fieldDefs: [{ id: 'synopsis', label: 'Synopsis' }],
  }
}

// ─────────────────────────────────────────────────────────────
// PERSISTENCE — uses app's saveDB/loadDB (wf_data table)
// ─────────────────────────────────────────────────────────────
function saveBoardList(projId, boards, activeId) {
  window.__wovenSaveDB
    ? window.__wovenSaveDB(`canvas:boards:${projId}`, { boards, activeId })
    : saveDBFallback(`canvas:boards:${projId}`, { boards, activeId })
}
function loadBoardList(projId) {
  return window.__wovenLoadDB
    ? window.__wovenLoadDB(`canvas:boards:${projId}`, null)
    : loadDBFallback(`canvas:boards:${projId}`, null)
}
function saveBoardState(projId, boardId, nodes, edges) {
  window.__wovenSaveDB
    ? window.__wovenSaveDB(`canvas:state:${projId}:${boardId}`, { nodes, edges })
    : saveDBFallback(`canvas:state:${projId}:${boardId}`, { nodes, edges })
}
function loadBoardState(projId, boardId) {
  return window.__wovenLoadDB
    ? window.__wovenLoadDB(`canvas:state:${projId}:${boardId}`, null)
    : loadDBFallback(`canvas:state:${projId}:${boardId}`, null)
}

// Fallbacks to localStorage if app bridge isn't set up yet
function saveDBFallback(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}
function loadDBFallback(key, def) {
  try { const r = localStorage.getItem(key); return Promise.resolve(r ? JSON.parse(r) : def) }
  catch { return Promise.resolve(def) }
}

// ─────────────────────────────────────────────────────────────
// REACT FLOW HANDLES
// ─────────────────────────────────────────────────────────────
function Handles() {
  return (
    <>
      <Handle type="source" position={Position.Top}    id="top"      style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right}  id="right"    style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} id="bottom"   style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left}   id="left"     style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Top}    id="top-t"    style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right}  id="right-t"  style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} id="bottom-t" style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left}   id="left-t"   style={{ opacity: 0 }} />
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
  const { itemId, itemType, name, color, visibleFields = [], showStatus, onContextMenu, findItemFn } = data
  const item = findItemFn ? findItemFn(itemId) : null
  const statusInfo = item?.status ? STATUSES[item.status] : null
  const shownFields = (item?.fieldDefs || []).filter(
    fd => fd.id !== 'status' && visibleFields.includes(fd.id) && item?.fields?.[fd.id]
  )
  const hasContent = shownFields.length > 0

  return (
    <div
      className={`woven-card ${selected ? 'selected' : ''}`}
      onContextMenu={e => { e.preventDefault(); e.stopPropagation(); onContextMenu?.(e, id, data) }}
    >
      <Handles />
      <div className="woven-card-hdr">
        {itemType === 'strand' ? (
          <div className="woven-card-av" style={{ background: color }}>
            {item?.image ? <img src={item.image} alt={name} /> : initials(name)}
          </div>
        ) : (
          <div className="woven-card-dot" style={{ background: color }} />
        )}
        <div className="woven-card-name" title={name}>{name}</div>
        {showStatus && statusInfo && (
          <div className="woven-card-status" style={{ background: statusInfo.color }}>
            {statusInfo.label}
          </div>
        )}
      </div>
      {hasContent && (
        <div className="woven-card-body has-content">
          {shownFields.map(fd => (
            <div className="woven-card-field" key={fd.id}>
              <div className="woven-card-field-lbl">{fd.label}</div>
              <div className="woven-card-field-val">{item.fields[fd.id]}</div>
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
  const colorId = data.colorId ?? 'amber'
  const isTitle = data.isTitle ?? true
  const text    = data.text   ?? ''
  const scheme  = STICKY_COLORS.find(c => c.id === colorId) || STICKY_COLORS[1]

  function updateData(patch) {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
  }

  return (
    <div
      className="ex-sticky-node"
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
      <NodeResizer isVisible={selected} minWidth={140} minHeight={80}
        lineStyle={{ border: '1px dashed var(--indigo)' }}
        handleStyle={{ width: 8, height: 8, background: 'var(--indigo)', border: 'none', borderRadius: 2 }} />
      <Handles />
      <div className="ex-sticky-drag drag-handle__custom">
        <span className="mi">drag_indicator</span>
      </div>
      <div className="ex-sticky-content">
        <textarea
          className={`ex-sticky-input nodrag ${isTitle ? 'is-title' : 'is-body'}`}
          value={text}
          placeholder={isTitle ? 'Note title...' : 'Write a note...'}
          onChange={e => updateData({ text: e.target.value })}
          style={{ color: scheme.text }}
          rows={isTitle ? 2 : 4}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// IMAGE NODE
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
      style={{ outline: selected ? '2px solid var(--indigo)' : 'none', outlineOffset: 2, width: '100%', height: '100%' }}
      onContextMenu={e => {
        e.preventDefault(); e.stopPropagation()
        e.target.dispatchEvent(new CustomEvent('woven:ctx', {
          bubbles: true,
          detail: { nodeId: id, nodeType: 'imageNode', x: e.clientX, y: e.clientY, data }
        }))
      }}
    >
      <NodeResizer isVisible={selected} minWidth={120} minHeight={80}
        lineStyle={{ border: '1px dashed var(--indigo)' }}
        handleStyle={{ width: 8, height: 8, background: 'var(--indigo)', border: 'none', borderRadius: 2 }} />
      <Handles />
      <div className="ex-image-drag drag-handle__custom">
        <span className="mi">drag_indicator</span>
        <span>Image</span>
        {data.src && (
          <span style={{ marginLeft: 'auto', cursor: 'pointer', fontSize: 12, color: 'var(--placeholder)' }}
            onMouseDown={e => { e.stopPropagation(); inputRef.current?.click() }}>change</span>
        )}
      </div>
      <div className="ex-image-body">
        {data.src
          ? <img src={data.src} alt="canvas" />
          : <div className="ex-image-empty nodrag" onClick={() => inputRef.current?.click()}>
              <span className="mi">add_photo_alternate</span>
              <span>Click to add image</span>
            </div>
        }
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CONTEXT MENU
// ─────────────────────────────────────────────────────────────
function ContextMenu({ ctx, onClose, onUpdateNode, onDeleteNode }) {
  const ref = useRef(null)
  useEffect(() => {
    function onAnyClick(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('click', onAnyClick, true)
    document.addEventListener('contextmenu', onAnyClick, true)
    return () => {
      document.removeEventListener('click', onAnyClick, true)
      document.removeEventListener('contextmenu', onAnyClick, true)
    }
  }, [onClose])

  const { nodeId, nodeType, x, y, data } = ctx
  const item = nodeType === 'wovenCard' ? data._resolvedItem : null
  const visibleFields = data.visibleFields || []
  const showStatus    = data.showStatus    || false

  return (
    <div className="ex-ctx-menu" ref={ref} style={{
      left: Math.min(x, window.innerWidth  - 250),
      top:  Math.min(y, window.innerHeight - 400),
    }}>
      {nodeType === 'wovenCard' && item?.fieldDefs?.length > 0 && (
        <>
          <div className="ex-ctx-lbl">Show on card</div>
          {item.itemType !== 'strand' && (
            <div className="ex-ctx-row" onClick={() => onUpdateNode(nodeId, { showStatus: !showStatus })}>
              <Checkbox checked={showStatus} /><span>Status</span>
            </div>
          )}
          {item.fieldDefs.filter(fd => fd.id !== 'status').map(fd => {
            const checked  = visibleFields.includes(fd.id)
            const hasValue = !!(item.fields?.[fd.id])
            return (
              <div key={fd.id} className="ex-ctx-row" style={{ opacity: hasValue ? 1 : 0.45 }}
                onClick={() => {
                  const next = checked
                    ? visibleFields.filter(f => f !== fd.id)
                    : [...visibleFields, fd.id]
                  onUpdateNode(nodeId, { visibleFields: next })
                }}>
                <Checkbox checked={checked} /><span>{fd.label}</span>
                {!hasValue && <span style={{ fontSize: 10, color: 'var(--placeholder)', marginLeft: 'auto' }}>empty</span>}
              </div>
            )
          })}
        </>
      )}

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
          <div className="ex-ctx-swatch-row">
            {STICKY_COLORS.map(c => (
              <div key={c.id}
                className={`ex-ctx-swatch ${data.colorId === c.id ? 'active' : ''}`}
                style={{ background: c.bg, border: `2px solid ${c.border}` }}
                title={c.label}
                onClick={() => onUpdateNode(nodeId, { colorId: c.id })}
              />
            ))}
          </div>
        </>
      )}

      <div className="ex-ctx-div" />
      <div className="ex-ctx-action danger" onClick={() => { onDeleteNode(nodeId); onClose() }}>
        <span className="mi">delete</span>Remove from canvas
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DRAWER CONTENT
// ─────────────────────────────────────────────────────────────
function StrandsDrawer({ templates, strandsObj, onDragStart }) {
  const [activeTab, setActiveTab] = useState(templates[0]?.id || '')
  const tpl = templates.find(t => t.id === activeTab) || templates[0]
  const items = tpl ? (strandsObj[tpl.name] || []) : []

  return (
    <>
      <div className="ex-edrawer-tabs">
        {templates.map(t => (
          <div key={t.id}
            className={`ex-edrawer-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}>
            {t.name}
          </div>
        ))}
      </div>
      <div className="ex-edrawer-body">
        {items.length === 0
          ? <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--mid)' }}>
              No {tpl?.name?.toLowerCase() || 'items'} yet.
            </div>
          : items.map(s => (
              <div key={s.id} className="ex-edrawer-row" draggable
                onDragStart={e => onDragStart(e, buildPayload(s, 'strand', templates))}>
                <div className="ex-edrawer-av" style={{ background: s.color }}>
                  {s.image ? <img src={s.image} alt={s.name} /> : initials(s.name)}
                </div>
                <div className="ex-edrawer-info">
                  <div className="ex-edrawer-name">{s.name}</div>
                </div>
                <span className="ex-edrawer-drag-hint">drag</span>
              </div>
            ))
        }
      </div>
    </>
  )
}

function DrawerContent({ panel, templates, strandsObj, drafts, looseThreads, onDragStart }) {
  if (panel === 'strands') {
    return <StrandsDrawer templates={templates} strandsObj={strandsObj} onDragStart={onDragStart} />
  }

  if (panel === 'drafts') {
    return (
      <div className="ex-edrawer-body">
        <div className="ex-edrawer-section" style={{ paddingBottom: 6 }}>
          <span className="ex-edrawer-lbl">Drafts</span>
        </div>
        {drafts.map(d => (
          <div key={d.id} className="ex-edrawer-row" draggable
            onDragStart={e => onDragStart(e, buildPayload(d, 'draft', templates))}>
            <div className="ex-edrawer-dot" style={{ background: STATUSES[d.status]?.color }} />
            <div className="ex-edrawer-info">
              <div className="ex-edrawer-name">{d.title || <em style={{ color: 'var(--placeholder)' }}>Untitled</em>}</div>
              <div className="ex-edrawer-sub">{STATUSES[d.status]?.label}</div>
            </div>
            <span className="ex-edrawer-drag-hint">drag</span>
          </div>
        ))}
        {drafts.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--mid)' }}>No drafts yet.</div>
        )}
      </div>
    )
  }

  if (panel === 'loose_threads') {
    return (
      <div className="ex-edrawer-body">
        <div className="ex-edrawer-section" style={{ paddingBottom: 6 }}>
          <span className="ex-edrawer-lbl">Loose Threads</span>
        </div>
        {looseThreads.map(lt => (
          <div key={lt.id} className="ex-edrawer-row" draggable
            onDragStart={e => onDragStart(e, buildPayload(lt, 'loose_thread', templates))}>
            <div className="ex-edrawer-dot" style={{ background: STATUSES.loose_thread.color }} />
            <div className="ex-edrawer-info">
              <div className="ex-edrawer-name">
                {lt.title || lt.synopsis || <em style={{ color: 'var(--placeholder)' }}>Untitled</em>}
              </div>
              <div className="ex-edrawer-sub">Loose Thread</div>
            </div>
            <span className="ex-edrawer-drag-hint">drag</span>
          </div>
        ))}
        {looseThreads.length === 0 && (
          <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--mid)' }}>No loose threads.</div>
        )}
      </div>
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
    setTimeout(() => inputRef.current?.select(), 30)
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
            ? <input ref={inputRef} className="ex-tab-name-input" value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => commitEdit(tab.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitEdit(tab.id)
                  if (e.key === 'Escape') setEditing(null)
                  e.stopPropagation()
                }}
                onClick={e => e.stopPropagation()} />
            : <span className="ex-tab-name">{tab.name}</span>
          }
          {tabs.length > 1 && (
            <span className="ex-tab-close"
              onClick={e => { e.stopPropagation(); onDeleteRequest(tab) }}>close</span>
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
function Toolbar({ activeTool, onToolSelect, activeDrawer, onDrawerToggle }) {
  return (
    <div className="ex-toolbar">
      {TOOL_ITEMS.map(t => (
        <div key={t.id} className={`ex-tool ${activeTool === t.id ? 'active' : ''}`}
          onClick={() => onToolSelect(t.id)} title={t.label}>
          <span className="mi">{t.icon}</span>
          <span className="ex-tool-lbl">{t.label}</span>
        </div>
      ))}
      <div className="ex-tool-sep" />
      {DRAWER_ITEMS.map(p => (
        <div key={p.id} className={`ex-tool ${activeDrawer === p.id ? 'active' : ''}`}
          onClick={() => onDrawerToggle(p.id)} title={p.label}>
          <span className="mi">{p.icon}</span>
          <span className="ex-tool-lbl">{p.label}</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// DELETE BOARD MODAL
// ─────────────────────────────────────────────────────────────
function DeleteBoardModal({ boardName, onConfirm, onCancel }) {
  const [val, setVal] = useState('')
  return (
    <div className="ex-modal-overlay">
      <div className="ex-modal-backdrop" onClick={onCancel} />
      <div className="ex-modal-box">
        <div className="ex-modal-title">Delete this board?</div>
        <div className="ex-modal-body">
          <strong>{boardName}</strong> and all its cards will be permanently removed.
          This cannot be undone.<br /><br />
          Type <strong>DELETE</strong> to confirm.
        </div>
        <input className="ex-modal-input" value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Type DELETE" autoFocus />
        <div className="ex-modal-actions">
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }}
            onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }}
            disabled={val !== 'DELETE'} onClick={onConfirm}>Delete board</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// FLOW CANVAS (inner — has access to ReactFlow hooks)
// ─────────────────────────────────────────────────────────────
function FlowCanvas({ boardId, projId, activeTool, onToolReset, templates, strandsObj, drafts, looseThreads }) {
  const { screenToFlowPosition } = useReactFlow()
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [ctx, setCtx] = useState(null)
  const canvasRef = useRef(null)
  const boardIdRef = useRef(boardId)
  const saveTimerRef = useRef(null)

  useEffect(() => { boardIdRef.current = boardId }, [boardId])

  // Build item lookup from live app data
  const findItem = useCallback((id) => {
    for (const items of Object.values(strandsObj)) {
      const s = items.find(s => s.id === id)
      if (s) return buildPayload(s, 'strand', templates)
    }
    const d = drafts.find(d => d.id === id)
    if (d) return buildPayload(d, 'draft', templates)
    const lt = looseThreads.find(l => l.id === id)
    if (lt) return buildPayload(lt, 'loose_thread', templates)
    return null
  }, [strandsObj, drafts, looseThreads, templates])

  // Load board state on mount / board change
  useEffect(() => {
    loadBoardState(projId, boardId).then(saved => {
      if (saved?.nodes) setNodes(saved.nodes)
      else setNodes([])
      if (saved?.edges) setEdges(saved.edges)
      else setEdges([])
    })
  }, [projId, boardId])

  // Auto-save with debounce
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveBoardState(projId, boardIdRef.current, nodes, edges)
    }, 800)
    return () => clearTimeout(saveTimerRef.current)
  }, [nodes, edges, projId])

  // Listen for context menu events from sticky/image nodes
  useEffect(() => {
    function onWovenCtx(e) {
      const { nodeId, nodeType, x, y, data } = e.detail
      setCtx({ nodeId, nodeType, x, y, data })
    }
    const el = canvasRef.current
    el?.addEventListener('woven:ctx', onWovenCtx)
    return () => el?.removeEventListener('woven:ctx', onWovenCtx)
  }, [])

  // Inject findItem and context menu handler into card nodes
  const nodeTypes = useMemo(() => ({
    wovenCard: (props) => (
      <WovenCardNode {...props} data={{
        ...props.data,
        findItemFn: findItem,
        _resolvedItem: findItem(props.data.itemId),
        onContextMenu: (e, id, data) => {
          setCtx({
            nodeId: id, nodeType: 'wovenCard',
            x: e.clientX, y: e.clientY,
            data: { ...data, _resolvedItem: findItem(data.itemId) }
          })
        },
      }} />
    ),
    stickyNote: StickyNoteNode,
    imageNode:  ImageNode,
  }), [findItem])

  function updateNode(nodeId, patch) {
    setNodes(nds => nds.map(n => n.id !== nodeId ? n : { ...n, data: { ...n.data, ...patch } }))
  }
  function deleteNode(nodeId) {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
  }

  const onConnect = useCallback((params) => {
    setEdges(eds => addEdge({ ...params, style: { stroke: 'var(--bg4)', strokeWidth: 2 } }, eds))
  }, [setEdges])

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

  const onPaneClick = useCallback((e) => {
    if (activeTool !== 'sticky' && activeTool !== 'image') return
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
    onToolReset()
  }, [activeTool, screenToFlowPosition, setNodes, onToolReset])

  const isPlaceMode = activeTool === 'sticky' || activeTool === 'image'

  return (
    <div ref={canvasRef} style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes} edges={edges}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
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
        <ContextMenu ctx={ctx}
          onClose={() => setCtx(null)}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ROOT COMPONENT  — receives app object from main App.jsx
// ─────────────────────────────────────────────────────────────
const INITIAL_BOARD_ID = genId()
const INITIAL_BOARDS   = [{ id: INITIAL_BOARD_ID, name: 'Board 1' }]

export default function ExploreCanvas({ app }) {
  const projId       = app.projId
  const templates    = (app.allTemplates && app.allTemplates[projId]) || []
  const strandsObj   = (app.allStrands   && app.allStrands[projId])   || {}
  const allDrafts    = (app.allDrafts    && app.allDrafts[projId])    || []
  const drafts       = allDrafts.filter(d => d.status !== 'loose_thread' && d.status !== 'loose_thread')
  const looseThreads = allDrafts.filter(d => d.status === 'loose_thread')

  // Wire up saveDB/loadDB from main app via window bridge
  // (avoids prop-drilling the raw Supabase functions)
  useEffect(() => {
    window.__wovenSaveDB = (key, val) => {
      const uid = window.__wovenUserId
      if (!uid) { try { localStorage.setItem(key, JSON.stringify(val)) } catch {} ; return }
      try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
      const sb = window.__sb || (window.supabase?.createClient ? window.supabase.createClient(
        'https://mxsdiqrbxlvcwexfdtrj.supabase.co',
        'sb_publishable_0ZKEuX-d6UatKKkSXAz_lA_E84pEW-u'
      ) : null)
      if (sb) sb.from('wf_data').upsert({ key, user_id: uid, value: val, updated_at: new Date().toISOString() }, { onConflict: 'key,user_id' }).then(() => {})
    }
    window.__wovenLoadDB = (key, def) => {
      const uid = window.__wovenUserId
      if (!uid) {
        try { const r = localStorage.getItem(key); return Promise.resolve(r ? JSON.parse(r) : def) }
        catch { return Promise.resolve(def) }
      }
      const sb = window.__sb
      if (!sb) {
        try { const r = localStorage.getItem(key); return Promise.resolve(r ? JSON.parse(r) : def) }
        catch { return Promise.resolve(def) }
      }
      return sb.from('wf_data').select('value').eq('key', key).eq('user_id', uid).maybeSingle().then(r => {
        if (r.data?.value !== undefined) return r.data.value
        try { const local = localStorage.getItem(key); return local ? JSON.parse(local) : def }
        catch { return def }
      })
    }
  }, [])

  const [boards, setBoards]             = useState(INITIAL_BOARDS)
  const [activeBoard, setActiveBoard]   = useState(INITIAL_BOARD_ID)
  const [activeDrawer, setActiveDrawer] = useState(null)
  const [activeTool, setActiveTool]     = useState('select')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [boardsLoaded, setBoardsLoaded] = useState(false)

  // Load board list on mount
  useEffect(() => {
    if (!projId) return
    loadBoardList(projId).then(saved => {
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
    saveBoardList(projId, boards, activeBoard)
  }, [boards, activeBoard, boardsLoaded, projId])

  function addBoard() {
    const nb = { id: genId(), name: `Board ${boards.length + 1}` }
    setBoards(b => [...b, nb]); setActiveBoard(nb.id)
  }
  function renameBoard(id, name) {
    setBoards(b => b.map(board => board.id === id ? { ...board, name } : board))
  }
  function confirmDelete() {
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

  const drawerLabel = DRAWER_ITEMS.find(p => p.id === activeDrawer)?.label || ''

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
              style={{ cursor: (activeTool === 'sticky' || activeTool === 'image') ? 'crosshair' : undefined }}>
              <ReactFlowProvider>
                <FlowCanvas
                  key={`${projId}:${activeBoard}`}
                  boardId={activeBoard}
                  projId={projId}
                  activeTool={activeTool}
                  onToolReset={() => setActiveTool('select')}
                  templates={templates}
                  strandsObj={strandsObj}
                  drafts={drafts}
                  looseThreads={looseThreads}
                />
              </ReactFlowProvider>
            </div>

            <div className="ex-right">
              <Toolbar
                activeTool={activeTool} onToolSelect={handleToolSelect}
                activeDrawer={activeDrawer} onDrawerToggle={toggleDrawer}
              />
              <div className={`ex-drawer ${activeDrawer ? 'open' : ''}`}>
                <div className="ex-drawer-inner">
                  <div className="ex-editor-drawer">
                    <div className="ex-edrawer-hdr">
                      <span className="ex-edrawer-title">{drawerLabel}</span>
                      <button className="btn-icon" onClick={() => setActiveDrawer(null)}>
                        <span className="mi">close</span>
                      </button>
                    </div>
                    <DrawerContent
                      panel={activeDrawer}
                      templates={templates}
                      strandsObj={strandsObj}
                      drafts={drafts}
                      looseThreads={looseThreads}
                      onDragStart={handleDragStart}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deleteTarget && (
        <DeleteBoardModal
          boardName={deleteTarget.name}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
