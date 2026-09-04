// @ts-nocheck
// ── LegalFooter ──
// Small, reusable footer with links to the Terms of Service and Privacy
// Policy. Opens each in a new tab via the ?legal= URL param (see
// legal/LegalPage.jsx and its App.jsx wiring) — new tab so it never loses
// in-progress form state (e.g. mid-signup).
//
// Usage:  <LegalFooter/>                     — default light-on-cream
//         <LegalFooter variant="onDark"/>     — for dark/promo backgrounds
//         <LegalFooter style={{marginTop:24}}/>

export default function LegalFooter({ variant, style }) {
  var linkColor = variant === 'onDark' ? 'rgba(253,248,240,.75)' : 'var(--mid, #a88060)';
  var dividerColor = variant === 'onDark' ? 'rgba(253,248,240,.35)' : 'var(--border, #e6dcc8)';

  return (
    <div style={Object.assign({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 12, fontFamily: 'DM Sans, sans-serif' }, style)}>
      <a href="https://www.wovenwrite.com/#terms" target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'none' }}
        onMouseOver={function (e) { e.currentTarget.style.textDecoration = 'underline'; }}
        onMouseOut={function (e) { e.currentTarget.style.textDecoration = 'none'; }}>
        Terms of Service
      </a>
      <span style={{ color: dividerColor }}>·</span>
      <a href="https://www.wovenwrite.com/#privacy" target="_blank" rel="noopener noreferrer" style={{ color: linkColor, textDecoration: 'none' }}
        onMouseOver={function (e) { e.currentTarget.style.textDecoration = 'underline'; }}
        onMouseOut={function (e) { e.currentTarget.style.textDecoration = 'none'; }}>
        Privacy Policy
      </a>
    </div>
  );
}
