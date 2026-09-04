// @ts-nocheck
// ── LegalPage ──
// Standalone full-page view for Terms of Service / Privacy Policy — same
// pattern as SharedDraftView: reachable via a URL param, works whether or
// not the visitor is logged in, and doesn't depend on the app shell.
//
// Wired in App.jsx alongside the existing `shareId` check:
//   var legalPage=urlParams.get('legal');
//   if(legalPage)return(<div className="woven-root"><GlobalStyles/><LegalPage page={legalPage}/></div>);
//
// Links to it (e.g. from LegalFooter or AuthScreen) should use
// target="_blank" so signing up doesn't lose form state.

import TermsOfServiceContent from './TermsOfServiceContent';
import PrivacyPolicyContent from './PrivacyPolicyContent';

export default function LegalPage({ page }) {
  var isTerms = page === 'terms';
  var Content = isTerms ? TermsOfServiceContent : PrivacyPolicyContent;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg0, #FDF8F0)', display: 'flex', justifyContent: 'center', padding: '48px 20px 80px' }}>
      <div style={{ width: '100%', maxWidth: 680 }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: 'var(--mid, #a88060)', textDecoration: 'none', marginBottom: 32 }}>
          <span className="mi" style={{ fontSize: 18 }}>arrow_back</span>
          Back to Woven
        </a>
        <h1 style={{ fontFamily: 'var(--serif, "Crimson Text", serif)', fontSize: 30, fontWeight: 600, color: '#2A1F10', marginBottom: 4 }}>
          {isTerms ? 'Terms of Service' : 'Privacy Policy'}
        </h1>
        <Content />
      </div>
    </div>
  );
}
