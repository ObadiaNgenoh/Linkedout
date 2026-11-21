import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <Link className="legal-brand" href="/" aria-label="LinkedOut home">
          <span className="legal-mark">↗</span>
          <strong>LINKEDOUT</strong>
        </Link>
        <p className="eyebrow">COMMUNITY RULES</p>
        <h1>Terms of Use</h1>
        <p className="legal-updated">Last updated: November 21, 2026</p>
        <p>
          These Terms of Use govern your access to LinkedOut. By creating an
          account or using LinkedOut, you agree to these Terms and our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <h2>Eligibility and accounts</h2>
        <p>
          You must be at least 13 years old and provide accurate information.
          Keep your account secure and do not impersonate another person, create
          accounts for abuse, or share access credentials.
        </p>
        <h2>Your content</h2>
        <p>
          You keep ownership of content you submit. You grant LinkedOut a
          non-exclusive, worldwide, royalty-free license to host, reproduce,
          process, display, and distribute that content as needed to operate,
          secure, and improve the service. You represent that you have the
          rights needed to submit it.
        </p>
        <h2>Prohibited conduct</h2>
        <p>
          Do not use LinkedOut to threaten, harass, stalk, doxx, defraud,
          exploit, or target people unlawfully. Do not upload malware, scrape
          the service abusively, interfere with service operation, violate
          another person’s rights, or publish unlawful content.
        </p>
        <h2>Workplace and company claims</h2>
        <p>
          Posts are user-generated opinions and experiences, not statements
          endorsed by LinkedOut. Do not knowingly publish false allegations,
          confidential trade secrets, personal data, or content intended to
          cause harm. Verification is not a guarantee that every statement is
          accurate.
        </p>
        <h2>Moderation and enforcement</h2>
        <p>
          We may review, restrict, remove, or preserve content and may suspend
          or terminate accounts when we believe this is necessary to protect
          users, comply with law, or enforce these Terms. We may also respond to
          valid legal requests.
        </p>
        <h2>Third-party services</h2>
        <p>
          LinkedOut may link to or integrate with third-party services. Their
          terms and privacy policies apply to those services. LinkedOut is not
          responsible for third-party availability or content.
        </p>
        <h2>Disclaimers</h2>
        <p>
          LinkedOut is provided on an “as available” basis. We do not guarantee
          uninterrupted service, complete accuracy of user content, or that
          every post, message, or call will always be delivered without delay or
          failure.
        </p>
        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, LinkedOut and its operators
          will not be liable for indirect, incidental, special, consequential,
          or punitive damages arising from your use of the service.
        </p>
        <h2>Changes and contact</h2>
        <p>
          We may update these Terms as the service changes. Continued use after
          an update means you accept the revised Terms. Questions can be sent to{" "}
          <a href="mailto:support@linkedout.us.ci">support@linkedout.us.ci</a>.
        </p>
        <Link className="legal-back" href="/">
          Back to LinkedOut
        </Link>
      </div>
    </main>
  );
}
