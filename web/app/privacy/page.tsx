import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <div className="legal-card">
        <Link className="legal-brand" href="/" aria-label="LinkedOut home">
          <span className="legal-mark">↗</span>
          <strong>LINKEDOUT</strong>
        </Link>
        <p className="eyebrow">PRIVACY</p>
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: November 21, 2026</p>
        <p>
          LinkedOut is a social space for people to share experiences, connect
          with others, and communicate. This policy explains what information we
          collect, how we use it, and the choices available to you.
        </p>
        <h2>Information you provide</h2>
        <p>
          We collect the name, username, email address, profile details, posts,
          comments, reactions, messages, media, and verification information you
          choose to submit. Email login codes are used to create and access your
          account.
        </p>
        <h2>How we use information</h2>
        <p>
          We use information to provide the LinkedOut service, authenticate
          accounts, deliver messages and notifications, personalize your feed,
          prevent abuse, maintain security, and respond to support requests. We
          do not sell personal information.
        </p>
        <h2>Content and visibility</h2>
        <p>
          Content you publish may be visible to other LinkedOut users and may
          include your username, profile details, media, and activity associated
          with the post. Do not publish information that you expect to remain
          confidential.
        </p>
        <h2>Messages and calls</h2>
        <p>
          Messages are processed to deliver conversations. If audio calls are
          enabled, connection and call-event data may be processed to establish
          and maintain the call. LinkedOut does not record calls unless a
          feature explicitly says so and you receive notice.
        </p>
        <h2>Storage and retention</h2>
        <p>
          We retain account and content information while your account is active
          or as needed to provide the service, comply with legal obligations,
          resolve disputes, and protect the platform. You may contact us about
          deletion requests.
        </p>
        <h2>Security</h2>
        <p>
          We use reasonable technical and organizational safeguards, including
          encrypted transport and access controls. No online service can
          guarantee absolute security.
        </p>
        <h2>Your choices</h2>
        <p>
          You may update profile information, stop using the service, and
          contact us about access, correction, or deletion requests. Some
          records may need to be retained for security or legal reasons.
        </p>
        <h2>Children</h2>
        <p>
          LinkedOut is not intended for children under 13. If you believe a
          child has provided information, contact us so we can review and remove
          it where appropriate.
        </p>
        <h2>Contact</h2>
        <p>
          For privacy questions, email{" "}
          <a href="mailto:support@linkedout.us.ci">support@linkedout.us.ci</a>.
        </p>
        <Link className="legal-back" href="/">
          Back to LinkedOut
        </Link>
      </div>
    </main>
  );
}
