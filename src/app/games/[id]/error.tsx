"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function GameDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const gameId = params?.id as string;

  useEffect(() => {
    // Send to Sentry
    Sentry.captureException(error, {
      tags: { section: "game-detail" },
      contexts: {
        game: { gameId },
      },
    });

    // Send to PostHog with additional context
    posthog.captureException(error, {
      errorSource: "game-detail",
      errorDigest: error.digest,
      gameId,
    });

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("Game detail error:", error);
    }
  }, [error, gameId]);

  return (
    <div className="w-full p-4">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            We encountered an error while loading the game data
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
            onClick={() => (window.location.href = "/games")}
            variant="outline"
          >
            Return to Games List
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
