import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Blitzer",
  description: "Terms of Service for Blitzer - Dutch Blitz scoring app",
};

export default function TermsPage() {
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="max-w-4xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-4 text-brandAccent">
        📜 Terms of Service
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Effective Date: {currentDate}
      </p>

      <div className="prose prose-lg max-w-none">
        <p className="mb-6">
          By using Blitzer (&quot;the Service&quot;), you agree to these Terms
          of Service (&quot;Terms&quot;). If you do not agree, please do not use
          the Service.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            1. Use of the Service
          </h2>
          <p className="mb-4">
            You must be at least 13 years old to use Blitzer. You are
            responsible for any content (e.g., game data) you create or upload.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            2. Account and Access
          </h2>
          <p className="mb-4">
            You may use Blitzer with or without an account. If using an account,
            you are responsible for maintaining its security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            3. Prohibited Use
          </h2>
          <p className="mb-4">You may not use Blitzer to:</p>
          <ul className="list-disc pl-6 mb-4 space-y-2">
            <li>Break any laws or regulations.</li>
            <li>Abuse, harass, or harm others.</li>
            <li>Attempt to gain unauthorized access to our systems.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            4. Intellectual Property
          </h2>
          <p className="mb-4">
            Blitzer and its content are owned by Mike Wickett. You may not reuse
            code or assets without permission.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            5. Limitation of Liability
          </h2>
          <p className="mb-4">
            We provide the Service &quot;as is&quot; without warranties. We are
            not liable for any loss, damage, or inconvenience caused by using
            the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            6. Termination
          </h2>
          <p className="mb-4">
            We may suspend or terminate access at any time, especially if these
            Terms are violated.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            7. Changes to Terms
          </h2>
          <p className="mb-4">
            We may update these Terms at any time. Continued use of the Service
            means you accept the new Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-gray-800">
            8. Contact
          </h2>
          <p className="mb-4">
            Questions? Email us at:{" "}
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
