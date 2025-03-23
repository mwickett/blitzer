import ErrorTestTrigger from "@/components/ErrorTestTrigger";

export default function ErrorTestPage() {
  return (
    <div className="container py-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Error Tracking Test Page</h1>

      <p className="mb-8 text-muted-foreground">
        This page is for testing error tracking with PostHog and Sentry. Use the
        components below to generate different types of errors and verify they
        are properly captured in both systems.
      </p>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Error Test Component</h2>
        <ErrorTestTrigger />
      </div>

      <div className="p-4 bg-muted rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Documentation</h2>
        <p className="mb-2">
          For detailed information about error tracking implementation, see:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <a
              href="/docs/error-tracking.md"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Error Tracking Documentation
            </a>
          </li>
          <li>
            <code className="px-1 py-0.5 bg-muted-foreground/20 rounded">
              src/components/ErrorBoundary.tsx
            </code>{" "}
            - Reusable error boundary component
          </li>
          <li>
            <code className="px-1 py-0.5 bg-muted-foreground/20 rounded">
              src/app/global-error.tsx
            </code>{" "}
            - Global error handler
          </li>
          <li>
            <code className="px-1 py-0.5 bg-muted-foreground/20 rounded">
              src/instrumentation.ts
            </code>{" "}
            - Server-side error handling
          </li>
        </ul>
      </div>
    </div>
  );
}
