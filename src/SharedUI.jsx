// @ts-nocheck
// ── Woven shared drawer UI ──
// One Drawer shell for every drawer in the app, plus the small components
// the drawers share. Styles are injected once from here so this works
// identically inside App.jsx, DraftEditor.jsx and ExploreCanvas.jsx.

import { useState, useEffect, useRef, useCallback } from 'react';
import { STATUSES, FIELD_TYPES, SYSTEM_COLORS, PRESET_COLORS, initials, uploadImage } from './utils';

// ══════════════════════════════════════════════
// Styles — injected once, idempotent
// ══════════════════════════════════════════════

var DRAWER_CSS = `
.wv-drawer{background:#EDE0CC;display:flex;flex-direction:column;flex-shrink:0;
  height:100%;font-family:var(--ui,'DM Sans',sans-serif);overflow:hidden;}

/* Inline variant — a column beside the content */
.wv-drawer--inline{width:var(--wv-drawer-w,340px);border-left:1px solid var(--border);}
.wv-drawer--inline.wv-drawer--flexw{width:auto;flex:1;min-width:0;}

/* Overlay variant — slides in over the page */
/* Popover — a small anchored panel with the same visual language as Drawer
   (cream fill, DM Sans header, same field/chip styling inside), for
   dropdowns and menus that shouldn't be a full drawer. First user: the
   Define filter. Meant to be reused for other popup needs going forward. */
.wv-popover{position:fixed;z-index:400;background:#EDE0CC;border-radius:14px;
  box-shadow:0 10px 34px rgba(42,31,16,.20);border:1px solid #E2D0B8;
  min-width:280px;max-height:min(420px,calc(100vh - 80px));display:flex;flex-direction:column;
  overflow:hidden;animation:wvPopIn .16s cubic-bezier(.22,.9,.32,1);}
@keyframes wvPopIn{from{opacity:0;transform:translateY(-4px) scale(.98);}to{opacity:1;transform:none;}}
.wv-popover-hdr{display:flex;align-items:center;justify-content:space-between;
  padding:12px 15px;border-bottom:1px solid #A88060;flex-shrink:0;}
.wv-popover-title{font-family:'DM Sans',sans-serif;font-weight:700;font-size:16px;color:#6B4A26;}
.wv-popover-body{flex:1;overflow-y:auto;padding:15px;display:flex;flex-direction:column;gap:16px;}
.wv-popover-footer{flex-shrink:0;padding:12px 15px;border-top:1px solid #E2D0B8;display:flex;gap:8px;}

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

/* Strand reference picker */
.wv-refpick-empty{display:flex;align-items:center;justify-content:space-between;
  width:100%;box-sizing:border-box;background:rgba(255,252,248,.5);border:1px solid #E2D0B8;
  border-radius:8px;padding:10px 15px;font-family:'DM Sans',sans-serif;font-size:15px;
  font-style:italic;color:#A88060;cursor:pointer;transition:background .12s ease,border-color .12s ease;}
.wv-refpick-empty:hover{background:#FFFCF8;border-color:#C45E28;}
.wv-refpick-selected{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;
  background:#FFFCF8;border:1px solid #E2D0B8;border-radius:8px;padding:7px 10px;cursor:pointer;}
.wv-refpick-name{flex:1;min-width:0;font-family:var(--serif,'Crimson Text',serif);font-weight:600;
  font-size:16px;color:#6B4A26;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.wv-refpick-x{color:#A88060;flex-shrink:0;cursor:pointer;display:flex;}
.wv-refpick-x:hover{color:#C45E28;}
.wv-refpick-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:60;
  background:#FFFCF8;border:1px solid #E2D0B8;border-radius:10px;
  box-shadow:0 8px 26px rgba(42,31,16,.16);max-height:280px;display:flex;flex-direction:column;
  overflow:hidden;}
.wv-refpick-search{flex-shrink:0;padding:8px;border-bottom:1px solid #E2D0B8;}
.wv-refpick-search input{width:100%;box-sizing:border-box;border:1px solid #E2D0B8;border-radius:7px;
  padding:6px 10px;font-family:'DM Sans',sans-serif;font-size:14px;color:#6B4A26;outline:none;
  background:rgba(255,252,248,.6);}
.wv-refpick-search input:focus{background:#FFFCF8;border-color:#C45E28;}
.wv-refpick-list{overflow-y:auto;}

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
.wv-strand-result-add{color:#A88060;flex-shrink:0;font-size:20px;cursor:pointer;
  margin-left:10px;transition:color .12s ease;}
.wv-strand-result-add:hover{color:var(--indigo);}

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

/* Drawer toolbar — search + sort, sits between header and body */
.wv-drawer-toolbar{display:flex;align-items:center;gap:8px;padding:12px 15px;
  border-bottom:1px solid var(--border);flex-shrink:0;background:#EDE0CC;}
.wv-search-box{flex:1;display:flex;align-items:center;gap:6px;min-width:0;
  background:rgba(255,252,248,.5);border:1px solid #E2D0B8;border-radius:8px;
  padding:7px 12px;transition:background .12s ease,border-color .12s ease;}
.wv-search-box:focus-within{background:#FFFCF8;border-color:#C45E28;}
.wv-search-icon{font-size:16px;color:#A88060;flex-shrink:0;}
.wv-search-input{border:none;background:none;outline:none;flex:1;min-width:0;
  font-family:var(--serif,'Crimson Text',serif);font-size:14px;color:#6B4A26;padding:0;}
.wv-search-input::placeholder{font-style:italic;color:var(--placeholder,#A88060);}

/* Checkbox */
.wv-check{width:17px;height:17px;border-radius:4px;display:flex;align-items:center;
  justify-content:center;flex-shrink:0;transition:all .15s;border:1px solid var(--border);}
.wv-check.on{border-color:var(--indigo);background:var(--indigo);}

/* Large spool thumbnail — detail view, click to upload */
.wv-thumb-upload{position:relative;width:150px;height:150px;border-radius:100px;
  cursor:pointer;overflow:hidden;flex-shrink:0;}
.wv-thumb-upload img{width:100%;height:100%;object-fit:cover;display:block;}
.wv-thumb-upload-initials{width:100%;height:100%;display:flex;align-items:center;
  justify-content:center;font-family:'DM Sans',sans-serif;font-size:24px;font-weight:600;
  color:#fff;}
.wv-thumb-upload-emoji{width:100%;height:100%;display:flex;align-items:center;
  justify-content:center;font-size:56px;}
.wv-thumb-upload-overlay{position:absolute;inset:0;background:rgba(196,94,40,.75);
  display:flex;align-items:center;justify-content:center;opacity:0;
  transition:opacity .15s ease;}
.wv-thumb-upload:hover .wv-thumb-upload-overlay{opacity:1;}
.wv-thumb-upload-overlay .mi{color:#fff;font-size:28px;}

/* Draft thumbnail — 190x150, rounded rect (not circular), same hover-overlay */
.wv-draft-thumb{width:190px;height:150px;border-radius:15px;background:#E2D0B8;}
.wv-draft-thumb-empty{width:100%;height:100%;display:flex;align-items:center;
  justify-content:center;color:#A88060;}

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
export function Drawer({ variant, open, title, onBack, onClose, footer, padded, children, width, headerExtra, topOffset, toolbar }) {
  useDrawerStyles();
  if (open === false) return null;

  var isOverlay = variant === 'overlay';
  var isFlexWidth = width === 'flex';
  var style = (width && !isFlexWidth) ? { '--wv-drawer-w': width + 'px' } : undefined;
  var overlayStyle = topOffset ? { top: topOffset } : undefined;
  var bodyCls = 'wv-drawer-body' + (padded === false ? '' : ' wv-drawer-body--pad');

  var panel = (
    <div className={'wv-drawer wv-drawer--' + (isOverlay ? 'overlay' : 'inline') + (isFlexWidth ? ' wv-drawer--flexw' : '')} style={style}>
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
          {onClose && (
            <button className="btn-icon" onClick={onClose} aria-label="Close drawer">
              <span className="mi">close</span>
            </button>
          )}
        </div>
      </div>
      {toolbar}
      <div className={bodyCls}>{children}</div>
      {footer && <div className="wv-drawer-footer">{footer}</div>}
    </div>
  );

  if (!isOverlay) return panel;

  return (
    <div className="wv-drawer-overlay" style={overlayStyle}>
      <div className="wv-drawer-backdrop" onClick={onClose} />
      {panel}
    </div>
  );
}

// ── Layout helpers ──

// A small anchored panel — same visual language as Drawer, positioned off a
// trigger element instead of being a full-height panel. Pass a ref to the
// trigger as `anchorRef`; Popover computes its own position and handles
// click-outside-to-close (including clicks back on the trigger itself).
export function Popover({ anchorRef, open, onClose, title, footer, width, children }) {
  var ref = useRef(null);
  var sp = useState({ top: 0, left: 0 }); var pos = sp[0]; var setPos = sp[1];

  useEffect(function () {
    if (!open || !anchorRef || !anchorRef.current) return;
    var r = anchorRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left });
  }, [open]);

  useEffect(function () {
    if (!open) return;
    function onDown(e) {
      if (ref.current && ref.current.contains(e.target)) return;
      if (anchorRef && anchorRef.current && anchorRef.current.contains(e.target)) return;
      onClose();
    }
    document.addEventListener('mousedown', onDown);
    return function () { document.removeEventListener('mousedown', onDown); };
  }, [open]);

  if (!open) return null;

  return (
    <div ref={ref} className="wv-popover" style={{ top: pos.top, left: pos.left, width: width || undefined }}>
      {title && (
        <div className="wv-popover-hdr">
          <span className="wv-popover-title">{title}</span>
          <button className="btn-icon" onClick={onClose} aria-label="Close">
            <span className="mi">close</span>
          </button>
        </div>
      )}
      <div className="wv-popover-body">{children}</div>
      {footer && <div className="wv-popover-footer">{footer}</div>}
    </div>
  );
}

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
// Accepts an optional external ref (object or callback) to merge in, so a
// caller can still get the DOM node (e.g. to call .focus()).
function useAutoGrow(maxLines, externalRef) {
  var localRef = useRef(null);
  useEffect(function () {
    var el = localRef.current;
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
  return useCallback(function (el) {
    localRef.current = el;
    if (typeof externalRef === 'function') externalRef(el);
    else if (externalRef && typeof externalRef === 'object') externalRef.current = el;
  }, [externalRef]);
}

// Merges an external ref (object or callback) into a local one, no auto-grow.
function useMergedRef(externalRef) {
  var localRef = useRef(null);
  return useCallback(function (el) {
    localRef.current = el;
    if (typeof externalRef === 'function') externalRef(el);
    else if (externalRef && typeof externalRef === 'object') externalRef.current = el;
  }, [externalRef]);
}

// A labeled text field — the one style used for every text input across the
// drawers (Title, Synopsis, Notes, custom fields, etc.).
// Uncontrolled by design (defaultValue + onBlur) to match the save-on-blur
// pattern used throughout the app; pass a `key` on the element itself when
// the underlying record changes so it remounts with the new defaultValue.
// Pass `innerRef` (a ref object or callback) if you need the DOM node too —
// e.g. to call .focus() programmatically. Don't pass a plain `ref` prop;
// it would collide with the field's own ref handling.
// resizeMode: 'auto' (default) grows to fit content up to 6 lines then
// scrolls. 'manual' starts at a fixed row count and gives the user a native
// vertical drag-handle instead — for long-text fields the user should be
// able to resize freely (e.g. spool detail fields).
export function Field({ label, wrap, className, style, innerRef, resizeMode, rows, ...rest }) {
  var isManual = resizeMode === 'manual';
  var autoGrowRef = useAutoGrow(6, innerRef);
  var manualRef = useMergedRef(innerRef);
  var setRef = isManual ? manualRef : autoGrowRef;
  var boxStyle = isManual ? Object.assign({ resize: 'vertical' }, style) : style;
  var box = (
    <textarea
      ref={setRef}
      rows={rows || (isManual ? 4 : 1)}
      className={'wv-field-box' + (className ? ' ' + className : '')}
      style={boxStyle}
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

// Large 150x150 spool thumbnail with a click-to-upload affordance and a
// hover overlay (edit pencil). Image > emoji > initials, same priority as
// Avatar, for consistency with how the strand appears everywhere else.
export function SpoolThumbnailUpload({ strand, onUpload, onClick }) {
  var inputRef = useRef(null);
  function handleFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return; }
    uploadImage(file).then(function (url) { if (url) onUpload(url); });
  }
  function handleClick() {
    if (onClick) { onClick(); return; }
    inputRef.current && inputRef.current.click();
  }
  return (
    <div className="wv-thumb-upload" style={{ background: strand.color || '#A88060' }} onClick={handleClick}>
      {strand.image
        ? <img src={strand.image} alt={strand.name} />
        : strand.emoji
          ? <div className="wv-thumb-upload-emoji">{strand.emoji}</div>
          : <div className="wv-thumb-upload-initials">{initials(strand.name)}</div>}
      <div className="wv-thumb-upload-overlay">
        <span className="mi">edit</span>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
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
export function StrandResultRow({ strand, onClick, onAdd, spoolIcon }) {
  return (
    <div className="wv-strand-result" onClick={onClick}>
      <div className="wv-strand-result-left">
        <Avatar strand={strand} size={30} />
        <span className="wv-strand-result-title">{strand.name}</span>
        <span className="mi wv-strand-result-icon" style={{ fontSize: 10 }}>{spoolIcon || 'auto_stories'}</span>
      </div>
      <span className="mi wv-strand-result-arrow">arrow_forward_ios</span>
      {onAdd && (
        <span
          className="mi wv-strand-result-add"
          onClick={function (e) { e.stopPropagation(); onAdd(); }}
          title="Add to this draft"
        >
          add_circle_outline
        </span>
      )}
    </div>
  );
}

// Search input + a slot for a sort control, styled as a drawer's toolbar row.
// Pass any sort widget via `sortSlot` (e.g. an existing StrandSortFilter) —
// this component only owns the search box and the row layout, not sorting
// logic itself.
// A multi-select, searchable strand picker — for any custom draft field
// typed "Reference" (e.g. a user-defined "POV" field). Pass `collection` to
// scope the picker to one spool collection (recommended — otherwise every
// strand in the project is searched, which gets unwieldy fast). Selecting a
// strand does NOT tag it to a draft on its own — the caller decides whether
// to also tag.
// The search + list dropdown shared by every multi-select strand picker —
// StrandRefPicker's own expand, and Properties' "tag a strand" trigger.
// Click-outside closes it. Looks up each strand's real collection icon
// rather than defaulting, so results match what the app shows elsewhere.
export function StrandSearchDropdown({ app, pid, collection, excludeIds, onPick, onClose, style }) {
  var sq = useState(''); var query = sq[0]; var setQuery = sq[1];
  var ref = useRef(null);

  useEffect(function () {
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) onClose(); }
    document.addEventListener('mousedown', onDown);
    return function () { document.removeEventListener('mousedown', onDown); };
  }, []);

  var projStrands = (app.allStrands[pid] || {});
  var projTemplates = app.allTemplates[pid] || [];
  function iconFor(coll) {
    var t = projTemplates.find(function (x) { return x.name === coll; });
    return (t && t.icon) || 'auto_stories';
  }

  var excl = excludeIds || [];
  var all = [];
  var collNames = collection ? [collection] : Object.keys(projStrands);
  collNames.forEach(function (coll) {
    (projStrands[coll] || []).forEach(function (st) {
      if (excl.indexOf(st.id) < 0) all.push(Object.assign({}, st, { collectionName: coll }));
    });
  });

  var filtered = all.filter(function (st) {
    return !query || (st.name || '').toLowerCase().indexOf(query.toLowerCase()) >= 0;
  });

  return (
    <div ref={ref} className="wv-refpick-dropdown" style={style}>
      <div className="wv-refpick-search">
        <input autoFocus value={query} onChange={function (e) { setQuery(e.target.value); }} placeholder="Search spools..." />
      </div>
      <div className="wv-refpick-list">
        {filtered.length === 0 && (
          <HelpText style={{ padding: 14 }}>{all.length === 0 ? 'Nothing to pick.' : 'No spools match "' + query + '".'}</HelpText>
        )}
        {filtered.map(function (st) {
          return <StrandResultRow key={st.id} strand={st} spoolIcon={iconFor(st.collectionName)} onClick={function () { onPick(st); }} />;
        })}
      </div>
    </div>
  );
}

export function StrandRefPicker({ app, pid, collection, value, onChange, placeholder }) {
  var so = useState(false); var open = so[0]; var setOpen = so[1];

  var selectedIds = value || [];
  var projStrands = (app.allStrands[pid] || {});
  var projTemplates = app.allTemplates[pid] || [];
  function iconFor(coll) {
    var t = projTemplates.find(function (x) { return x.name === coll; });
    return (t && t.icon) || 'auto_stories';
  }
  var all = [];
  var collNames = collection ? [collection] : Object.keys(projStrands);
  collNames.forEach(function (coll) {
    (projStrands[coll] || []).forEach(function (st) {
      all.push(Object.assign({}, st, { collectionName: coll }));
    });
  });
  var selected = selectedIds.map(function (id) { return all.find(function (s) { return s.id === id; }); }).filter(Boolean);

  function add(st) { onChange(selectedIds.concat([st.id])); setOpen(false); }
  function remove(id) { onChange(selectedIds.filter(function (i) { return i !== id; })); }

  return (
    <div style={{ position: 'relative' }}>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {selected.map(function (st) {
            return (
              <div key={st.id} className="wv-refpick-selected">
                <Avatar strand={st} size={26} />
                <span className="wv-refpick-name">{st.name}</span>
                <span className="mi wv-refpick-x" onClick={function () { remove(st.id); }}>close</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="wv-refpick-empty" onClick={function () { setOpen(!open); }}>
        <span>{selected.length > 0 ? 'Add another...' : (placeholder || 'Select spools...')}</span>
        <span className="mi" style={{ fontSize: 18 }}>{open ? 'expand_less' : 'expand_more'}</span>
      </div>
      {open && (
        <StrandSearchDropdown
          app={app}
          pid={pid}
          collection={collection}
          excludeIds={selectedIds}
          onPick={add}
          onClose={function () { setOpen(false); }}
        />
      )}
    </div>
  );
}

// A draft's own thumbnail — 190x150, rounded rect, click-to-upload with the
// same hover overlay as SpoolThumbnailUpload. No fallback initials (drafts
// don't have a name-based avatar concept) — just an empty placeholder.
export function DraftThumbnailUpload({ image, onUpload }) {
  var inputRef = useRef(null);
  function handleFile(e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB.'); return; }
    uploadImage(file).then(function (url) { if (url) onUpload(url); });
  }
  return (
    <div className="wv-thumb-upload wv-draft-thumb" onClick={function () { inputRef.current && inputRef.current.click(); }}>
      {image
        ? <img src={image} alt="" />
        : <div className="wv-draft-thumb-empty"><span className="mi" style={{ fontSize: 32 }}>image</span></div>}
      <div className="wv-thumb-upload-overlay">
        <span className="mi">edit</span>
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
    </div>
  );
}

export function SearchSortBar({ value, onChange, placeholder, sortSlot }) {
  return (
    <div className="wv-drawer-toolbar">
      <div className="wv-search-box">
        <span className="mi wv-search-icon">search</span>
        <input
          className="wv-search-input"
          value={value}
          onChange={onChange}
          onMouseUp={function (e) { e.preventDefault(); }}
          placeholder={placeholder || 'Search...'}
        />
      </div>
      {sortSlot}
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

// Manages a Dropdown field's option list (add/remove option strings). Used
// wherever a "select" type field is being configured — strand template
// fields and draft custom fields both need the exact same interaction.
export function OptionsEditor({ options, onChange }) {
  var si = useState(''); var input = si[0]; var setInput = si[1];
  var opts = options || [];
  function add() {
    var v = input.trim();
    if (!v || opts.indexOf(v) >= 0) return;
    onChange(opts.concat([v]));
    setInput('');
  }
  function remove(idx) {
    onChange(opts.filter(function (_, i) { return i !== idx; }));
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4, width: '100%' }}>
      {opts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {opts.map(function (o, i) {
            return (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px 2px 8px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text)' }}>
                {o}
                <span className="mi" style={{ fontSize: 12, cursor: 'pointer', color: 'var(--mid)' }} onClick={function () { remove(i); }}>close</span>
              </span>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4 }}>
        <input value={input} onChange={function (e) { setInput(e.target.value); }} placeholder="Add option..." onKeyDown={function (e) { if (e.key === 'Enter') { e.preventDefault(); add(); } }} style={{ flex: 1, fontSize: 11, padding: '3px 6px' }} />
        <button className="btn-icon" onClick={add} style={{ padding: '2px 6px', flexShrink: 0 }}><span className="mi" style={{ fontSize: 14 }}>add</span></button>
      </div>
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
