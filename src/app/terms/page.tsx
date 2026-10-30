import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Terms of Service | Blitzer",
  description: "The terms for using Blitzer.",
  path: "/terms",
});

// Hard-coded on purpose: bump it whenever the terms change.
const EFFECTIVE_DATE = "October 30, 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <GuidePageHeader
        title="Terms of Service"
        intro={`Effective ${EFFECTIVE_DATE}`}
      />

      <Prose>
        <p>
          By using Blitzer (&quot;the Service&quot;), you agree to these Terms
          of Service (&quot;Terms&quot;). If you do not agree, please do not use
          the Service.
        </p>

        <h2>1. Use of the Service</h2>
        <p>
          You must be at least 13 years old to use Blitzer. You are
          responsible for any content (e.g., game data) you create or upload.
        </p>

        <h2>2. Accounts and access</h2>
        <p>
          You need an account to host a game, join one from your own device, or
          keep stats. A host can add people without an account as guests, and
          anyone can view a finished game&apos;s page from its link. If you have
          an account, you are responsible for keeping it secure.
        </p>

        <h2>3. Prohibited use</h2>
        <p>You may not use Blitzer to:</p>
        <ul>
          <li>Break any laws or regulations.</li>
          <li>Abuse, harass, or harm others.</li>
          <li>Attempt to gain unauthorized access to our systems.</li>
        </ul>

        <h2>4. Intellectual property</h2>
        <p>
          Blitzer and its content are owned by Mike Wickett. You may not reuse
          code or assets without permission.
        </p>

        <h2>5. Limitation of liability</h2>
        <p>
          We provide the Service &quot;as is&quot; without warranties. We are
          not liable for any loss, damage, or inconvenience caused by using
          the Service.
        </p>

        <h2>6. Termination</h2>
        <p>
          We may suspend or terminate access at any time, especially if these
          Terms are violated. You can delete your account at any time from the
          account page.
        </p>

        <h2>7. Changes to these Terms</h2>
        <p>
          We may update these Terms at any time. When we do, we will change the
          effective date above. Continued use of the Service means you accept
          the new Terms.
        </p>

        <h2>8. Contact</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:hello@blitzer.fun">hello@blitzer.fun</a>.
        </p>
      </Prose>
    </div>
  );
}
