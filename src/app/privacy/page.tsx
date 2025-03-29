import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Blitzer",
  description: "Privacy Policy for Blitzer - Dutch Blitz scoring app",
};

export default function PrivacyPage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-4 text-brandAccent">
        🔒 Privacy Policy
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Effective Date: {currentDate}
      </p>

      <div className="prose prose-lg max-w-none">
        <p className="mb-6">
          Blitzer ("we", "us", or "our") is committed to protecting your
          privacy. This Privacy Policy explains how we collect, use, and share
          information when you use our website and services at
          https://www.blitzer.fun.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            1. Information We Collect
          </h2>
          <p className="mb-4">
            We may collect the following types of information:
          </p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>
              <strong>User-Provided Data:</strong> When you use the app (e.g.,
              creating games, entering scores), we collect and store that
              information.
            </li>
            <li>
              <strong>Analytics Data:</strong> We use tools like PostHog to
              collect anonymized data about how users interact with the site.
            </li>
            <li>
              <strong>Cookies:</strong> We use essential cookies to keep the
              site functional. Analytics cookies may also be used with your
              consent.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            2. How We Use Your Information
          </h2>
          <p className="mb-4">We use your data to:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Provide and improve the app.</li>
            <li>Understand user behavior through analytics.</li>
            <li>Communicate with you about updates (if applicable).</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            3. Data Sharing
          </h2>
          <p className="mb-4">
            We do not sell your personal information. We may share anonymized
            data with third-party services for analytics and hosting purposes
            (e.g., Vercel, Neon.tech).
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            4. Data Retention
          </h2>
          <p className="mb-4">
            We retain gameplay data to support stats tracking and performance
            analysis. If you delete a game or account, we may retain anonymized
            historical data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            5. Your Rights
          </h2>
          <p className="mb-4">
            You can request access to or deletion of your data by contacting us
            at{" "}
            <a
              href="mailto:hello@blitzer.fun"
              className="text-brandAccent hover:underline"
            >
              hello@blitzer.fun
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            6. Changes to This Policy
          </h2>
          <p className="mb-4">
            We may update this Privacy Policy occasionally. We&apos;ll notify
            users via the app or website.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            7. Contact Us
          </h2>
          <p className="mb-4">
            For questions, contact:{" "}
            <a
              href="mailto:hello@blitzer.fun"
              className="text-brandAccent hover:underline"
            >
              hello@blitzer.fun
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
