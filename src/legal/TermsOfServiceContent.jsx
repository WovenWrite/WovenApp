// @ts-nocheck
// ── TermsOfServiceContent ──
// Pure content component — no page chrome. Rendered inside LegalPage.

var H = function ({ children }) {
  return <h2 style={{ fontFamily: 'var(--serif, "Crimson Text", serif)', fontSize: 20, fontWeight: 600, color: '#6B4A26', marginTop: 32, marginBottom: 10 }}>{children}</h2>;
};
var P = function ({ children }) {
  return <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text, #2a1f10)', marginBottom: 14 }}>{children}</p>;
};
var UL = function ({ items }) {
  return (
    <ul style={{ margin: '0 0 14px', paddingLeft: 22 }}>
      {items.map(function (item, i) {
        return <li key={i} style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text, #2a1f10)', marginBottom: 4 }}>{item}</li>;
      })}
    </ul>
  );
};

export default function TermsOfServiceContent() {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--mid, #a88060)', marginBottom: 4 }}>Private Beta</div>
      <div style={{ fontSize: 13, color: 'var(--mid, #a88060)', marginBottom: 24 }}>Last updated: September 2026</div>

      <P>Welcome to Woven.</P>
      <P>These Terms of Service ("Terms") govern your use of Woven, a browser-based writing environment operated by Woven.</P>
      <P>By creating an account or using Woven, you agree to these Terms. If you do not agree to them, please do not use Woven.</P>

      <H>1. Private Beta</H>
      <P>Woven is currently available as a private beta.</P>
      <P>This means that Woven is an early version of the product and may contain bugs, errors, incomplete functionality, or other limitations. Features may change, be added, or be removed during the beta.</P>
      <P>We may temporarily suspend or discontinue portions of the service when reasonably necessary to maintain, improve, or develop Woven.</P>
      <P>The beta is currently provided free of charge.</P>

      <H>2. Your Account</H>
      <P>You must provide accurate information when creating your Woven account.</P>
      <P>You are responsible for maintaining the security of your account credentials and for activity that occurs through your account.</P>
      <P>Please contact us promptly if you believe your account has been accessed without your permission.</P>

      <H>3. Your Content</H>
      <P>You retain ownership of the content you create and store in Woven, including your writing, ideas, research, notes, and other materials.</P>
      <P>You grant Woven a limited right to host, store, process, display, and otherwise use your content only as reasonably necessary to provide, maintain, secure, troubleshoot, and improve Woven.</P>
      <P>This permission does not transfer ownership of your content to Woven.</P>
      <P>We do not currently use your content to train artificial intelligence models.</P>

      <H>4. Your Responsibilities</H>
      <P>You agree not to use Woven to:</P>
      <UL items={['Violate applicable laws or regulations', "Infringe another person's intellectual property or other rights", "Attempt to gain unauthorized access to Woven or another user's account", 'Interfere with the operation or security of Woven', 'Upload malicious software or other harmful material', 'Abuse, disrupt, or attempt to circumvent reasonable limitations of the service']} />

      <H>5. Feedback</H>
      <P>We welcome feedback about Woven.</P>
      <P>If you voluntarily provide suggestions, ideas, comments, or other feedback about the product, you agree that Woven may use that feedback to develop and improve Woven without owing you compensation.</P>
      <P>Providing feedback does not transfer ownership of your underlying creative work to Woven.</P>

      <H>6. Beta Communications and Research</H>
      <P>As a private beta user, we may contact you about your use of Woven, including to request feedback, invite you to surveys or research activities, or ask whether you would be willing to participate in an interview.</P>
      <P>Participation in optional research activities is voluntary.</P>
      <P>We will ask for your permission separately before using your name or statements as a public testimonial or marketing quote.</P>

      <H>7. Third-Party Services</H>
      <P>Woven relies on third-party services to provide certain functionality, such as hosting, authentication, data storage, analytics, and other technical services.</P>
      <P>Your use of Woven may therefore involve the processing of information by these service providers.</P>
      <P>Our Privacy Policy explains how information is handled.</P>

      <H>8. Availability</H>
      <P>We are working to make Woven reliable, but we do not guarantee that Woven will always be available, uninterrupted, secure, or error-free.</P>
      <P>During the private beta, functionality may change without notice.</P>
      <P>We will make reasonable efforts to maintain access to your content, but you should keep appropriate copies or backups of important work.</P>

      <H>9. Disclaimer</H>
      <P>Woven is provided on an early-stage, beta basis.</P>
      <P>To the extent permitted by applicable law, Woven is provided without warranties of any kind, whether express or implied.</P>
      <P>We do not guarantee that Woven will meet your particular requirements or that the service will be uninterrupted or error-free.</P>

      <H>10. Limitation of Liability</H>
      <P>To the extent permitted by applicable law, Woven will not be responsible for indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, Woven.</P>
      <P>Nothing in these Terms is intended to exclude or limit liability where doing so would not be permitted by applicable law.</P>

      <H>11. Ending Your Account</H>
      <P>You may stop using Woven at any time.</P>
      <P>You may request deletion of your account by contacting us at <a href="mailto:contact@wovenwrite.com" style={{ color: '#C45E28' }}>contact@wovenwrite.com</a>.</P>
      <P>We may suspend or terminate an account if we reasonably believe it is being used in violation of these Terms, presents a security risk, or creates a risk to Woven or other users.</P>

      <H>12. Changes to These Terms</H>
      <P>As Woven develops, we may update these Terms.</P>
      <P>If we make material changes, we will take reasonable steps to notify users.</P>
      <P>Your continued use of Woven after updated Terms take effect means that you accept the updated Terms.</P>

      <H>13. Contact</H>
      <P>Questions about these Terms can be sent to <a href="mailto:contact@wovenwrite.com" style={{ color: '#C45E28' }}>contact@wovenwrite.com</a>.</P>
    </div>
  );
}
