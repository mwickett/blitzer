"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Send to Sentry
    Sentry.captureException(error, {
      tags: { section: "dashboard" },
    });

    // Send to PostHog with additional context
    posthog.captureException(error, {
      errorSource: "dashboard",
      errorDigest: error.digest,
    });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Dashboard error:", error);
    }
  }, [error]);

  return (
    <div className="w-full p-4">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Dashboard Error</CardTitle>
          <CardDescription>
            We encountered an error while loading your dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === "development" && (
            <pre className="p-4 mt-4 overflow-auto text-sm bg-muted rounded-md">
              {error.message}
              {error.digest && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Error ID: {error.digest}
                </div>
              )}
            </pre>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={() => reset()} variant="default">
            Try Again
          </Button>
          <Button
            onClick={() => (window.location.href = "/")}
            variant="outline"
          >
            Return to Home
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
