// @ts-nocheck
// ── PrivacyPolicyContent ──
// Pure content component — no page chrome. Rendered inside LegalPage.
// Update this file directly when the policy text changes; LegalPage and
// LegalFooter don't need to change alongside it.

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

export default function PrivacyPolicyContent() {
  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--mid, #a88060)', marginBottom: 24 }}>Last updated: September 2026</div>

      <P>Woven is a browser-based writing environment designed to help writers develop complex ideas and bodies of work in one connected space.</P>
      <P>This Privacy Policy explains what information Woven collects, how we use it, and the choices you have regarding your information.</P>
      <P>Woven is currently operated by its founder and is preparing to incorporate. If the legal entity operating Woven changes, this policy may be updated accordingly.</P>

      <H>Information We Collect</H>
      <P><strong>Information you provide.</strong> When you create a Woven account, we collect:</P>
      <UL items={['Your name', 'Your email address', 'Your password', 'Content and information you choose to create or store in Woven']} />
      <P>If you provide feedback through Woven's surveys or otherwise contact us, we may also collect the information you include in that communication.</P>

      <P><strong>Information collected through your use of Woven.</strong> We use product analytics to understand how people use Woven and to improve the product. This may include information such as:</P>
      <UL items={['Features and pages you use', 'Actions you take within the application', 'How you navigate through Woven', 'Session and interaction information', 'Device, browser, and technical information', 'Information about errors or other technical issues']} />
      <P>We currently use PostHog for product analytics and session replay. These tools may collect information about your interactions with Woven, including your use of individual features and your interactions with the application interface.</P>
      <P>We use this information to understand how Woven is being used, identify usability issues, diagnose problems, and improve the product.</P>
      <P>We may also collect information about how you respond to surveys and other feedback requests presented within Woven.</P>

      <H>Your Content</H>
      <P>You retain ownership of the writing, ideas, research, and other content you create and store in Woven. Woven does not claim ownership of your content.</P>
      <P>We may access your content when reasonably necessary to operate, maintain, troubleshoot, secure, or improve Woven, or when you ask us to provide support.</P>
      <P>We do not currently use your content to train artificial intelligence models.</P>

      <H>How We Use Information</H>
      <P>We may use information we collect to:</P>
      <UL items={['Provide and operate Woven', 'Create and maintain your account', 'Store and display your content', 'Understand how people use Woven', 'Improve the product and user experience', 'Identify and fix bugs and technical problems', 'Maintain the security and integrity of Woven', 'Conduct product research and development', 'Communicate with you about your account, Woven, and the private beta', 'Invite you to participate in research, interviews, surveys, or other feedback activities']} />
      <P>We may use aggregated or de-identified information for product development, research, analysis, and other legitimate business purposes.</P>

      <H>Beta Feedback and Research</H>
      <P>Woven is currently operating as a private beta. We may contact beta users to ask for feedback, invite them to participate in interviews or research, or ask about their experience using Woven.</P>
      <P>Participation in research activities is voluntary.</P>
      <P>We will not use your name, statements, or other identifying information as a public testimonial or marketing quote without asking for your permission first.</P>

      <H>Service Providers</H>
      <P>We use third-party services to help operate Woven. These services may process information on our behalf. These currently include services used for hosting, authentication, database storage, analytics, and related product functionality.</P>
      <P>We may add or change service providers as Woven develops. Where appropriate, this Privacy Policy may be updated to reflect material changes.</P>

      <H>Data Storage and Security</H>
      <P>We take reasonable measures to protect the information stored by Woven from unauthorized access, loss, misuse, or disclosure.</P>
      <P>However, no internet-based service can guarantee complete security.</P>

      <H>Data Retention</H>
      <P>We generally retain your account information and content for as long as your account remains active.</P>
      <P>We do not currently plan to routinely delete content created by beta users when the beta ends.</P>
      <P>If you request deletion of your account, we will delete or anonymize your personal information and associated account data where reasonably possible, subject to information we may be required or permitted to retain for legal, security, or legitimate business purposes.</P>
      <P>Because Woven is in an early stage of development, our account-deletion process is currently handled manually.</P>

      <H>Your Choices</H>
      <P>You may contact us to:</P>
      <UL items={['Request deletion of your account and associated personal information', 'Ask what personal information we hold about you', 'Correct inaccurate account information', 'Ask questions about how your information is being used', 'Withdraw from optional research or feedback activities']} />
      <P>To make a privacy-related request, contact <a href="mailto:privacy@wovenwrite.com" style={{ color: '#C45E28' }}>privacy@wovenwrite.com</a>.</P>

      <H>Changes to This Policy</H>
      <P>As Woven develops, we may update this Privacy Policy to reflect changes to our practices, technology, or legal requirements.</P>
      <P>If we make material changes, we will take reasonable steps to bring those changes to your attention.</P>

      <H>Contact</H>
      <P>If you have questions about this Privacy Policy or Woven's privacy practices, contact <a href="mailto:privacy@wovenwrite.com" style={{ color: '#C45E28' }}>privacy@wovenwrite.com</a>.</P>
    </div>
  );
}
