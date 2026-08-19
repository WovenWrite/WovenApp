// @ts-nocheck
// ── Woven shared drawer UI ──
// One Drawer shell for every drawer in the app, plus the small components
// the drawers share. Styles are injected once from here so this works
// identically inside App.jsx, DraftEditor.jsx and ExploreCanvas.jsx.

import { useState, useEffect, useRef } from 'react';
import { STATUSES, FIELD_TYPES, SYSTEM_COLORS, PRESET_COLORS, initials, uploadImage } from './utils';

// ══════════════════════════════════════════════
// Styles — injected once, idempotent
// ══════════════════════════════════════════════

var DRAWER_CSS = `
.wv-drawer{background:#EDE0CC;display:flex;flex-direction:column;flex-shrink:0;
  height:100%;font-family:var(--ui,'DM Sans',sans-serif);overflow:hidden;}

/* Inline variant — a column beside the content */
.wv-drawer--inline{width:var(--wv-drawer-w,340px);border-left:1px solid var(--border);}

/* Overlay variant — slides in over the page */
.wv-drawer-overlay{position:fixed;inset:0;z-index:200;display:flex;justify-content:flex-end;}
.wv-drawer-backdrop{position:absolute;inset:0;background:rgba(42,31,16,.25);
  animation:wvFade .18s ease;}
.wv-drawer--overlay{position:relative;width:var(--wv-drawer-w,340px);max-width:92vw;
  border-left:1px solid var(--border);box-shadow:-8px 0 40px rgba(42,31,16,.10);
  animation:wvSlide .22s cubic-bezier(.22,.61,.36,1);}
@keyframes wvFade{from{opacity:0}to{opacity:1}}
@keyframes wvSlide{from{transform:translateX(16px);opacity:.4}to{transform:none;opacity:1}}

/* Header — identical in both variants: 62px, 15px padding, bottom stroke #A88060 */
.wv-drawer-hdr{display:flex;align-items:center;justify-content:space-between;gap:8px;
  height:62px;padding:15px;box-sizing:border-box;border-bottom:1px solid #A88060;
  flex-shrink:0;background:#EDE0CC;}
.wv-drawer-hdr-left{display:flex;align-items:center;gap:8px;min-width:0;flex:1;}
.wv-drawer-title{font-family:'DM Sans',sans-serif;font-size:20px;font-weight:700;color:#6B4A26;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wv-drawer-back{background:none;border:none;cursor:pointer;color:#6B4A26;
  display:flex;align-items:center;padding:0;flex-shrink:0;}
.wv-drawer-back .mi,.wv-drawer-hdr .mi{color:#6B4A26;}
.wv-drawer-back:hover{opacity:.75;}

.wv-drawer-body{flex:1;overflow-y:auto;}
.wv-drawer-body--pad{padding:20px;box-sizing:border-box;display:flex;flex-direction:column;gap:24px;}

.wv-drawer-footer{padding:12px 14px;border-top:1px solid var(--border);flex-shrink:0;
  background:#EDE0CC;}
.wv-drawer--overlay .wv-drawer-footer{padding:14px 18px;}

/* Sections — plain flex children; spacing comes from the body's 24px gap, not their own padding/border */
.wv-sect{}
.wv-lbl{font-size:11px;font-weight:600;color:var(--indigo);text-transform:uppercase;
  letter-spacing:.08em;margin-bottom:7px;display:block;}
.wv-empty{font-size:13px;color:var(--mid);line-height:1.5;}

/* Fields — label + auto-growing box, shared by every text field in the drawers.
   No padding/border of its own — spacing between fields comes from the parent's 24px gap. */
.wv-field-wrap{display:flex;flex-direction:column;}
.wv-field-lbl{display:block;font-family:'DM Sans',sans-serif;font-weight:600;font-size:16px;
  line-height:20px;color:#7A5A38;margin-bottom:7px;}
.wv-field-box{display:block;width:100%;box-sizing:border-box;
  background:rgba(255,252,248,.5);border:1px solid #E2D0B8;border-radius:8px;
  padding:10px 15px;font-family:var(--serif,'Crimson Text',serif);font-weight:400;
  font-size:16px;line-height:1.5;color:#6B4A26;resize:none;overflow-y:hidden;
  transition:background .12s ease,border-color .12s ease;}
.wv-field-box:focus{outline:none;background:#FFFCF8;border-color:#C45E28;}
.wv-field-box::placeholder{font-style:italic;color:var(--placeholder,#A88060);}

/* Collapsible */
.wv-collapse{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--mid);
  cursor:pointer;user-select:none;}
.wv-collapse:hover{color:var(--text);}
.wv-collapse-body{display:flex;flex-direction:column;gap:24px;padding-top:15px;}

/* Row — reused by strand lists, bind lists, archive lists */
.wv-row{display:flex;align-items:center;gap:10px;padding:9px 14px;
  border-bottom:1px solid var(--border);cursor:pointer;transition:background .12s;}
.wv-row:hover{background:var(--bg2);}
.wv-row:last-child{border-bottom:none;}
.wv-row-title{font-family:var(--serif);font-size:14px;font-weight:600;color:var(--text);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wv-row-sub{font-size:11px;color:var(--mid);}
.wv-avatar{border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-weight:600;color:#fff;flex-shrink:0;overflow:hidden;font-family:var(--ui);}
.wv-avatar img{width:100%;height:100%;object-fit:cover;}

/* Buttons — Primary / Secondary / Tertiary, the three used across drawer content */
.wv-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;
  box-sizing:border-box;padding:12px 15px;border-radius:8px;cursor:pointer;
  font-family:'DM Sans',sans-serif;font-weight:700;font-size:16px;
  transition:background .15s ease,color .15s ease,border-color .15s ease;}
.wv-btn .mi{font-size:18px;}
.wv-btn:disabled{opacity:.5;cursor:not-allowed;}
.wv-btn-primary{background:#DF6321;border:none;color:#F5EDE0;}
.wv-btn-primary:hover:not(:disabled){background:#6B4A26;}
.wv-btn-secondary{background:transparent;border:1px solid #DF6321;color:#DF6321;}
.wv-btn-secondary:hover:not(:disabled){background:#DF6321;color:#F5EDE0;}
.wv-btn-tertiary{background:none;border:none;color:#DF6321;width:auto;padding:0;}
.wv-btn-tertiary:hover:not(:disabled){opacity:.75;}

/* Strand result row — used in browse/tag lists (StrandsDrawer, etc.) */
.wv-strand-result{display:flex;align-items:center;height:50px;box-sizing:border-box;
  cursor:pointer;}
.wv-strand-result-left{display:flex;align-items:center;gap:6px;flex:1;min-width:0;}
.wv-strand-result-title{font-family:var(--serif,'Crimson Text',serif);font-weight:600;
  font-size:20px;line-height:1.5;color:#684a26;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;}
.wv-strand-result-icon{color:#A88060;flex-shrink:0;}
.wv-strand-result-arrow{color:#A88060;flex-shrink:0;font-size:18px;}

/* Help text */
.wv-help-text{font-family:'DM Sans',sans-serif;font-size:16px;color:#A88060;margin:0;
  line-height:1.5;}

/* Category link — e.g. "view all in this collection" row */
.wv-category-link{display:flex;align-items:center;justify-content:space-between;
  height:50px;box-sizing:border-box;padding:15px 0;border-bottom:1px solid #E2D0B8;
  cursor:pointer;}
.wv-category-link-title{font-family:'DM Sans',sans-serif;font-weight:600;font-size:18px;
  line-height:1.5;color:#7A5A38;}
.wv-category-link-arrow{color:#7A5A38;flex-shrink:0;font-size:18px;}

/* Checkbox */
.wv-check{width:17px;height:17px;border-radius:4px;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;transition:all .15s;border:1px solid var(--border);}
.wv-check.on{border-color:var(--indigo);background:var(--indigo);}

/* Mobile — inline drawers become full-screen sheets */
@media(max-width:768px){
  .wv-drawer--inline{position:fixed;top:54px;bottom:0;left:0;right:0;z-index:50;
    width:100%;border-left:none;}
  .wv-drawer--overlay{width:100%;max-width:100%;border-left:none;}
}
`;

var styleInjected = false;
function useDrawerStyles() {
  useEffect(function () {
    if (styleInjected) return;
    if (document.getElementById('wv-drawer-styles')) { styleInjected = true; return; }
    var el = document.createElement('style');
    el.id = 'wv-drawer-styles';
    el.textContent = DRAWER_CSS;
    document.head.appendChild(el);
    styleInjected = true;
  }, []);
}

// ══════════════════════════════════════════════
// Drawer — the one shell
// ══════════════════════════════════════════════
//
//   variant  'inline' (column beside content) | 'overlay' (slides over page)
//   open     when false, renders nothing
//   title    string
//   icon     optional Material icon name shown before the title
//   onBack   optional — renders a back chevron instead of the icon
//   onClose  required
//   footer   optional node pinned to the bottom
//   padded   pad the body (default true; set false for edge-to-edge rows)
//   width    override width in px
//
export function Drawer({ variant, open, title, onBack, onClose, footer, padded, children, width, headerExtra }) {
  useDrawerStyles();
  if (open === false) return null;

  var isOverlay = variant === 'overlay';
  var style = width ? { '--wv-drawer-w': width + 'px' } : undefined;
  var bodyCls = 'wv-drawer-body' + (padded === false ? '' : ' wv-drawer-body--pad');

  var panel = (
    <div className={'wv-drawer wv-drawer--' + (isOverlay ? 'overlay' : 'inline')} style={style}>
      <div className="wv-drawer-hdr">
        <div className="wv-drawer-hdr-left">
          {onBack && (
            <button className="wv-drawer-back" onClick={onBack} aria-label="Back">
              <span className="mi" style={{ fontSize: 20 }}>arrow_back</span>
            </button>
          )}
          <span className="wv-drawer-title">{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {headerExtra}
          <button className="btn-icon" onClick={onClose} aria-label="Close drawer">
            <span className="mi">close</span>
          </button>
        </div>
      </div>
      <div className={bodyCls}>{children}</div>
      {footer && <div className="wv-drawer-footer">{footer}</div>}
    </div>
  );

  if (!isOverlay) return panel;

  return (
    <div className="wv-drawer-overlay">
      <div className="wv-drawer-backdrop" onClick={onClose} />
      {panel}
    </div>
  );
}

// ── Layout helpers ──

export function Section({ label, children, style }) {
  return (
    <div className="wv-sect" style={style}>
      {label && <span className="wv-lbl">{label}</span>}
      {children}
    </div>
  );
}

// Auto-grows a textarea to fit its content, up to `maxLines` lines, then
// scrolls internally. Reads font-size/line-height from computed style so it
// stays correct if the CSS changes later rather than hardcoding a pixel value.
function useAutoGrow(maxLines) {
  var ref = useRef(null);
  useEffect(function () {
    var el = ref.current;
    if (!el) return;
    function resize() {
      el.style.height = 'auto';
      var cs = window.getComputedStyle(el);
      var lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      var paddingV = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      var borderV = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      var maxH = lineHeight * maxLines + paddingV + borderV;
      var next = Math.min(el.scrollHeight, maxH);
      el.style.height = next + 'px';
      el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
    }
    resize();
    el.addEventListener('input', resize);
    window.addEventListener('resize', resize);
    return function () {
      el.removeEventListener('input', resize);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return ref;
}

// A labeled, auto-growing text field — the one style used for every text
// input across the drawers (Title, Synopsis, Notes, custom fields, etc.).
// Uncontrolled by design (defaultValue + onBlur) to match the save-on-blur
// pattern used throughout the app; pass a `key` on the element itself when
// the underlying record changes so it remounts with the new defaultValue.
export function Field({ label, wrap, className, style, ...rest }) {
  var ref = useAutoGrow(6);
  var box = (
    <textarea
      ref={ref}
      rows={1}
      className={'wv-field-box' + (className ? ' ' + className : '')}
      style={style}
      {...rest}
    />
  );
  if (wrap === false) {
    return (
      <>
        {label && <label className="wv-field-lbl">{label}</label>}
        {box}
      </>
    );
  }
  return (
    <div className="wv-field-wrap">
      {label && <label className="wv-field-lbl">{label}</label>}
      {box}
    </div>
  );
}

export function Collapsible({ label, open, onToggle, children }) {
  return (
    <>
      <div className="wv-collapse" onClick={onToggle}>
        <span className="mi" style={{ fontSize: 16 }}>{open ? 'expand_less' : 'expand_more'}</span>
        <span>{label}</span>
      </div>
      {open && <div className="wv-collapse-body">{children}</div>}
    </>
  );
}

export function Avatar({ strand, size }) {
  var sz = size || 28;
  return (
    <div className="wv-avatar" style={{ width: sz, height: sz, background: strand.color, fontSize: Math.round(sz * 0.4) }}>
      {strand.image
        ? <img src={strand.image} alt={strand.name} />
        : strand.emoji
          ? <span style={{ fontSize: Math.round(sz * 0.55) }}>{strand.emoji}</span>
          : initials(strand.name)}
    </div>
  );
}

export function PrimaryButton({ icon, children, onClick, disabled, type, style }) {
  return (
    <button type={type || 'button'} className="wv-btn wv-btn-primary" onClick={onClick} disabled={disabled} style={style}>
      {icon && <span className="mi">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function SecondaryButton({ icon, children, onClick, disabled, type, style }) {
  return (
    <button type={type || 'button'} className="wv-btn wv-btn-secondary" onClick={onClick} disabled={disabled} style={style}>
      {icon && <span className="mi">{icon}</span>}
      <span>{children}</span>
    </button>
  );
}

export function TertiaryButton({ children, onClick, disabled, type, style }) {
  return (
    <button type={type || 'button'} className="wv-btn wv-btn-tertiary" onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

// A row for browse/tag lists — strand thumbnail, name, small spool icon, forward chevron.
export function StrandResultRow({ strand, onClick, spoolIcon }) {
  return (
    <div className="wv-strand-result" onClick={onClick}>
      <div className="wv-strand-result-left">
        <Avatar strand={strand} size={30} />
        <span className="wv-strand-result-title">{strand.name}</span>
        <span className="mi wv-strand-result-icon" style={{ fontSize: 10 }}>{spoolIcon || 'account_tree'}</span>
      </div>
      <span className="mi wv-strand-result-arrow">arrow_forward_ios</span>
    </div>
  );
}

export function HelpText({ children, style }) {
  return <p className="wv-help-text" style={style}>{children}</p>;
}

// A row for drilling into a category/collection — e.g. "Characters →"
export function CategoryLink({ title, onClick }) {
  return (
    <div className="wv-category-link" onClick={onClick}>
      <span className="wv-category-link-title">{title}</span>
      <span className="mi wv-category-link-arrow">arrow_forward_ios</span>
    </div>
  );
}

export function Check({ on }) {
  return (
    <span className={'wv-check' + (on ? ' on' : '')}>
      {on && <span className="mi" style={{ fontSize: 12, color: '#fff' }}>check</span>}
    </span>
  );
}

export function Spinner({ size, color }) {
  var sz = size || 14;
  return (
    <span style={{
      width: sz, height: sz, borderRadius: '50%', display: 'inline-block',
      border: '2px solid rgba(255,255,255,.3)', borderTopColor: color || '#fff',
      animation: 'spin .7s linear infinite'
    }} />
  );
}

// ══════════════════════════════════════════════
// ArchiveConfirmModal
// ══════════════════════════════════════════════

export function ArchiveConfirmModal({ draft, allDrafts, onConfirm, onCancel }) {
  var children = (allDrafts || []).filter(function (d) { return d.parentId === draft.id && !d.archived; });
  var hasChildren = children.length > 0;
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onCancel} />
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span className="mi" style={{ fontSize: 28, color: 'var(--indigo)' }}>inventory_2</span>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>Archive this draft?</div>
        </div>
        <div style={{ fontSize: 14, color: 'var(--body-text)', lineHeight: 1.6, marginBottom: 12 }}>
          <strong style={{ color: 'var(--text)' }}>{draft.title || 'Untitled'}</strong> will be hidden from all views and moved to your Archive.
        </div>
        {hasChildren && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: '10px 14px', fontSize: 13, color: 'var(--mid)', marginBottom: 12 }}>
            <span className="mi" style={{ fontSize: 16, verticalAlign: 'middle', marginRight: 6 }}>info</span>
            This draft has {children.length} nested {children.length === 1 ? 'draft' : 'drafts'} — {children.length === 1 ? 'it' : 'they'} will also be archived.
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--mid)', marginBottom: 20 }}>
          You can restore it any time from <strong>Your Archive</strong> on the dashboard.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={onConfirm}>
            <span className="mi" style={{ fontSize: 16 }}>inventory_2</span>Archive
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// StatusDot / StatusDotWithArchive
// ══════════════════════════════════════════════

export function StatusDot({ status, onChange, size }) {
  var s = useState(false); var open = s[0]; var setOpen = s[1];
  var p = useState({ top: 0, left: 0 }); var pos = p[0]; var setPos = p[1];
  var ref = useRef(null);
  var info = STATUSES[status] || STATUSES.first_draft;
  var sz = size || 10;
  useEffect(function () {
    if (!open) return;
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDown);
    return function () { document.removeEventListener('mousedown', onDown); };
  }, [open]);
  function handleClick(e) {
    e.stopPropagation();
    var r = e.currentTarget.getBoundingClientRect();
    setPos({ top: r.bottom + 5, left: r.left });
    setOpen(!open);
  }
  return (
    <div ref={ref} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <div style={{ width: sz, height: sz, borderRadius: '50%', background: info.color, cursor: 'pointer', flexShrink: 0 }} onClick={handleClick} title={info.label} />
      {open && (
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 8px 22px rgba(0,0,0,.5)', minWidth: 170 }}>
          {Object.keys(STATUSES).map(function (k) {
            var si = STATUSES[k];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', background: k === status ? 'var(--bg3)' : 'transparent', fontSize: 14 }} onClick={function () { onChange(k); setOpen(false); }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: si.color, flexShrink: 0 }} />
                <span>{si.label}</span>
              </div>
            );
          })}
          <div style={{ height: 1, background: 'var(--border)', margin: '3px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 14, color: 'var(--mid)' }} onClick={function () { onChange('archive'); setOpen(false); }}>
            <span className="mi" style={{ fontSize: 15, color: 'var(--mid)' }}>inventory_2</span>
            <span>Archive</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusDotWithArchive({ draft, app, showLabel, dotSize }) {
  var sac = useState(false); var showConfirm = sac[0]; var setShowConfirm = sac[1];
  var info = STATUSES[draft.status] || STATUSES.first_draft;
  function handleChange(s) {
    if (s === 'archive') { setShowConfirm(true); return; }
    var ch = { status: s };
    if (s === 'loose_thread') { ch.order = null; ch.parentId = null; }
    else if (draft.status === 'loose_thread') {
      var seqCount = (app.allDrafts[app.projId] || []).filter(function (d) { return d.status !== 'loose_thread' && !d.parentId && !d.archived; }).length;
      ch.order = seqCount + 1;
    }
    app.updateDraft(app.projId, draft.id, ch);
  }
  function doArchive() {
    var allDr = app.allDrafts[app.projId] || [];
    var children = allDr.filter(function (d) { return d.parentId === draft.id && !d.archived; });
    app.updateDraft(app.projId, draft.id, { archived: true });
    children.forEach(function (c) { app.updateDraft(app.projId, c.id, { archived: true }); });
    setShowConfirm(false);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <StatusDot status={draft.status} onChange={handleChange} size={dotSize} />
      {showLabel && <span style={{ fontSize: 13, color: info.color }}>{info.label}</span>}
      {showConfirm && <ArchiveConfirmModal draft={draft} allDrafts={app.allDrafts[app.projId] || []} onConfirm={doArchive} onCancel={function () { setShowConfirm(false); }} />}
    </div>
  );
}

// ══════════════════════════════════════════════
// AddFieldInline
// ══════════════════════════════════════════════

export function AddFieldInline({ onAdd }) {
  var ss = useState(false); var show = ss[0]; var setShow = ss[1];
  var sv = useState(''); var val = sv[0]; var setVal = sv[1];
  var st = useState('short_text'); var fieldType = st[0]; var setFieldType = st[1];
  function commit() { if (val.trim()) { onAdd(val, fieldType); setVal(''); setShow(false); } }
  if (!show) return (
    <button className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={function () { setShow(true); }}>
      <span className="mi" style={{ fontSize: 14 }}>add</span> Add field
    </button>
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input autoFocus value={val} onChange={function (e) { setVal(e.target.value); }} placeholder="Field name" style={{ flex: 1, fontSize: 13 }}
          onKeyDown={function (e) { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setShow(false); setVal(''); } }} />
        <select value={fieldType} onChange={function (e) { setFieldType(e.target.value); }} style={{ fontSize: 12, width: 110 }}>
          {FIELD_TYPES.map(function (ft) { return <option key={ft.id} value={ft.id}>{ft.label}</option>; })}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={commit}>Add field</button>
        <button className="btn btn-ghost btn-sm" onClick={function () { setShow(false); setVal(''); }}>Cancel</button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// Colour / emoji / avatar editing
// ══════════════════════════════════════════════

export function CustomColorPicker({ color, onSelect }) {
  var sc = useState(false); var showCustom = sc[0]; var setShowCustom = sc[1];
  var sh = useState(''); var hexVal = sh[0]; var setHexVal = sh[1];
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {SYSTEM_COLORS.map(function (c) {
          return <div key={c} onClick={function () { onSelect(c); }} style={{ width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer', transform: color === c ? 'scale(1.2)' : 'scale(1)', boxShadow: color === c ? '0 0 0 2px var(--bg1),0 0 0 4px ' + c : 'none', flexShrink: 0, transition: 'transform .15s' }} />;
        })}
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg2)', border: '2px dashed var(--border)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={function () { setShowCustom(!showCustom); }}>
          <span className="mi" style={{ fontSize: 14, color: 'var(--mid)' }}>add</span>
        </div>
      </div>
      {showCustom && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input value={hexVal} onChange={function (e) { setHexVal(e.target.value); }} placeholder="#3a7bd5" style={{ flex: 1, fontSize: 13, fontFamily: 'var(--mono)' }} />
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: hexVal.match(/^#[0-9a-f]{6}$/i) ? hexVal : 'var(--bg3)', border: '1px solid var(--border)' }} />
          <button className="btn btn-primary btn-sm" onClick={function () { if (hexVal.match(/^#[0-9a-f]{6}$/i)) { onSelect(hexVal); setShowCustom(false); } }}>Apply</button>
        </div>
      )}
    </div>
  );
}

var EMOJI_ROW = ['👩','👨','🧑','🧙','🦸','🐉','👑','🔮','⚔️','🌲','🔥','💀','🌙','⭐','❄️','🌊','🗡️','📖','🎭','🌹'];
var EMOJI_ALL = ['👩','👨','🧑','👧','👦','🧓','👴','👵','🧙','🧚','🧛','🧜','🧝','🦸','🦹','🧟','👮','🤴','👸','🐉','🐺','🦅','⚔️','🗡️','🏰','🌲','🔥','💀','👑','🗺️','📜','🌙','⭐','🔮','💎','🌊','🌹','🕯️','⚡','🛡️','🗝️','🎭','📖','🌿','❄️'];

export function EmojiPicker({ emoji, onSelect }) {
  var ss = useState(false); var showAll = ss[0]; var setShowAll = ss[1];
  var sq = useState(''); var query = sq[0]; var setQuery = sq[1];
  return (
    <div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'nowrap', overflowX: 'auto' }}>
        {EMOJI_ROW.map(function (em) {
          return <span key={em} onClick={function () { onSelect(em === emoji ? null : em); }} style={{ width: 30, height: 30, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', background: emoji === em ? 'var(--bg4)' : 'var(--bg2)', border: emoji === em ? '1px solid var(--indigo)' : '1px solid var(--border)', flexShrink: 0 }}>{em}</span>;
        })}
        <span onClick={function () { setShowAll(!showAll); }} style={{ width: 30, height: 30, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, cursor: 'pointer', background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--mid)', flexShrink: 0 }}>{showAll ? '↑' : '···'}</span>
        {emoji && <button className="btn-icon" style={{ padding: 2 }} onClick={function () { onSelect(null); }}><span className="mi" style={{ fontSize: 14 }}>close</span></button>}
      </div>
      {showAll && (
        <div style={{ marginTop: 8, background: 'var(--bg2)', borderRadius: 'var(--r)', padding: 8 }}>
          <input value={query} onChange={function (e) { setQuery(e.target.value); }} placeholder="Type any emoji..." style={{ marginBottom: 8, fontSize: 18 }} autoFocus />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 100, overflowY: 'auto' }}>
            {(query ? [] : EMOJI_ALL).map(function (em) {
              return <span key={em} onClick={function () { onSelect(em); setShowAll(false); }} style={{ width: 30, height: 30, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, cursor: 'pointer', background: emoji === em ? 'var(--bg4)' : 'transparent' }}>{em}</span>;
            })}
            {query && <span style={{ fontSize: 20, cursor: 'pointer', padding: 4 }} onClick={function () { onSelect(query); setShowAll(false); }}>{query}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export function AvatarEditModal({ strand, onSave, onClose }) {
  var sc = useState(strand.color || PRESET_COLORS[0]); var color = sc[0]; var setColor = sc[1];
  var si = useState(strand.image || null); var image = si[0]; var setImage = si[1];
  var se = useState(strand.emoji || null); var emoji = se[0]; var setEmoji = se[1];
  function handleFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return; }
    uploadImage(file).then(function (url) { if (url) setImage(url); });
  }
  function autoSaveColor(c) { setColor(c); onSave({ color: c, image: image, emoji: emoji }); }
  var sectionLbl = { fontSize: 11, fontWeight: 600, color: 'var(--indigo)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8, display: 'block' };
  return (
    <div className="modal-overlay">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-box" style={{ width: 380 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>Edit appearance</div>
          <button className="btn-icon" onClick={onClose}><span className="mi">close</span></button>
        </div>
        <div style={{ position: 'relative', width: 72, margin: '0 auto 16px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,.25)' }}>
            {image ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : emoji ? <span style={{ fontSize: 30 }}>{emoji}</span>
                : <span style={{ fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 600, color: '#fff' }}>{initials(strand.name)}</span>}
          </div>
          <label style={{ position: 'absolute', bottom: 0, right: 0, cursor: 'pointer' }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--bg1)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="mi" style={{ fontSize: 13, color: 'var(--mid)' }}>photo_camera</span>
            </div>
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </label>
        </div>
        {image && <div style={{ textAlign: 'center', marginBottom: 10 }}><button className="btn btn-ghost btn-sm" onClick={function () { setImage(null); }}><span className="mi" style={{ fontSize: 13 }}>delete</span>Remove photo</button></div>}
        <div style={{ marginBottom: 14 }}>
          <span style={sectionLbl}>Colour</span>
          <CustomColorPicker color={color} onSelect={autoSaveColor} />
        </div>
        <div style={{ marginBottom: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <span style={sectionLbl}>Emoji</span>
          <EmojiPicker emoji={emoji} onSelect={setEmoji} />
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={function () { onSave({ color: color, image: image, emoji: emoji }); }}>Save</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default Drawer;
