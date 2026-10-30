import { Prose, GuidePageHeader } from "@/components/marketing/Prose";
import { pageMetadata } from "@/lib/siteMetadata";

export const metadata = pageMetadata({
  title: "Privacy Policy | Blitzer",
  description: "How Blitzer collects, uses and shares your information.",
  path: "/privacy",
});

// Hard-coded on purpose: bump it whenever the policy text changes.
const EFFECTIVE_DATE = "October 30, 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <GuidePageHeader
        title="Privacy Policy"
        intro={`Effective ${EFFECTIVE_DATE}`}
      />

      <Prose>
        <p>
          Blitzer (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) is
          committed to protecting your privacy. This Privacy Policy explains how
          we collect, use, and share information when you use our website and
          services at https://www.blitzer.fun.
        </p>

        <h2>1. Information we collect</h2>
        <ul>
          <li>
            <strong>Account data:</strong> when you make an account, we store
            your name, username and email address, and any profile details you
            add, such as a color or deck icon.
          </li>
          <li>
            <strong>Game data:</strong> the games you play, the players in
            them, and the scores, notes, tags and photos you add. Guests added
            to a game are stored by the name the host gives them.
          </li>
          <li>
            <strong>Analytics data:</strong> how people use the site, such as
            which pages are visited and which features are used.
          </li>
          <li>
            <strong>Error reports:</strong> technical details when something
            breaks, so we can fix it.
          </li>
          <li>
            <strong>Cookies:</strong> we use essential cookies to keep you
            signed in and the site working, and analytics cookies to understand
            how it is used.
          </li>
        </ul>

        <h2>2. How we use your information</h2>
        <ul>
          <li>To run the app: scoring, stats, game pages and emails.</li>
          <li>To understand how the app is used and improve it.</li>
          <li>To find and fix errors.</li>
          <li>To contact you about your games or account.</li>
        </ul>

        <h2>3. Who we share it with</h2>
        <p>
          We do not sell your personal information. We use these services to
          run Blitzer, and each one handles data only to provide its service to
          us:
        </p>
        <ul>
          <li>
            <strong>Clerk</strong> for sign-in and accounts.
          </li>
          <li>
            <strong>Vercel</strong> for hosting, photo storage and page
            analytics.
          </li>
          <li>
            <strong>Neon</strong> for our database.
          </li>
          <li>
            <strong>PostHog</strong> for product analytics.
          </li>
          <li>
            <strong>Sentry</strong> for error reports.
          </li>
          <li>
            <strong>Resend</strong> to send email.
          </li>
          <li>
            <strong>OpenAI</strong> to write game stories and answer Insights
            questions, where those features are turned on. It receives game
            scores and players&apos; display names, not email addresses.
          </li>
        </ul>

        <h2>4. Data retention</h2>
        <p>
          We keep game data so your stats and history keep working. If you
          delete your account, we deactivate it and remove your sign-in. Games
          you played stay in the other players&apos; history, and when you
          delete your account you can choose to have your name in them
          changed to &quot;Former player&quot;.
        </p>

        <h2>5. Your rights</h2>
        <p>
          You can delete your account from the account page, or ask for a copy
          or deletion of your data by emailing{" "}
          <a href="mailto:hello@blitzer.fun">hello@blitzer.fun</a>.
        </p>

        <h2>6. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. When we do, we will
          change the effective date above and let users know in the app or on
          the website.
        </p>

        <h2>7. Contact us</h2>
        <p>
          Questions? Email{" "}
          <a href="mailto:hello@blitzer.fun">hello@blitzer.fun</a>.
        </p>
      </Prose>
    </div>
  );
}
