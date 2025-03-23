"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import posthog from "posthog-js";

/**
 * Component that intentionally throws an error for testing error boundaries.
 */
function BrokenComponent() {
  const [shouldError, setShouldError] = useState(false);

  useEffect(() => {
    if (shouldError) {
      throw new Error("This is a test error from BrokenComponent");
    }
  }, [shouldError]);

  return (
    <div className="py-4">
      <p>This component will throw an error when triggered.</p>
      <Button
        className="mt-2"
        onClick={() => setShouldError(true)}
        variant="destructive"
      >
        Trigger Component Error
      </Button>
    </div>
  );
}

/**
 * Test component for manual error capturing with PostHog
 */
function ManualErrorTrigger() {
  const captureError = () => {
    try {
      // Simulate an error
      throw new Error("This is a manually captured test error");
    } catch (error) {
      if (error instanceof Error) {
        // Capture with PostHog
        posthog.captureException(error, {
          errorSource: "manual-trigger",
          testProperty: "test-value",
        });
        alert("Error captured and sent to PostHog!");
      }
    }
  };

  return (
    <div className="py-4">
      <p>This will manually capture an error with PostHog.</p>
      <Button className="mt-2" onClick={captureError} variant="destructive">
        Capture Manual Error
      </Button>
    </div>
  );
}

/**
 * Test component for unhandled promise rejections
 */
function AsyncErrorTrigger() {
  const triggerAsyncError = () => {
    // This creates a promise that will reject after a delay
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("This is an unhandled promise rejection test"));
      }, 100);
    });
  };

  return (
    <div className="py-4">
      <p>This will create an unhandled promise rejection.</p>
      <Button
        className="mt-2"
        onClick={triggerAsyncError}
        variant="destructive"
      >
        Trigger Async Error
      </Button>
    </div>
  );
}

/**
 * Main component that provides different error triggering options
 */
export default function ErrorTestTrigger() {
  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Error Tracking Test</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          Use these controls to test error tracking with PostHog and Sentry.
          This component only appears in development mode.
        </p>

        <div className="space-y-8">
          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-2">Component Error</h3>
            <ErrorBoundary
              componentName="BrokenComponent"
              context={{ testRun: true }}
            >
              <BrokenComponent />
            </ErrorBoundary>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-2">Manual Error</h3>
            <ManualErrorTrigger />
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="text-lg font-medium mb-2">Async Error</h3>
            <AsyncErrorTrigger />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
