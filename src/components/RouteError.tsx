"use client";

import { useEffect } from "react";
import Link from "next/link";
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

export type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

type Props = RouteErrorProps & {
  section: "dashboard" | "games-list" | "game-detail";
  title?: string;
  description: string;
  gameId?: string;
};

export function RouteError({
  error,
  reset,
  section,
  title = "Something went wrong",
  description,
  gameId,
}: Props) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { section },
      ...(gameId ? { contexts: { game: { gameId } } } : {}),
    });
    posthog.captureException(error, {
      errorSource: section,
      errorDigest: error.digest,
      ...(gameId ? { gameId } : {}),
    });
    if (process.env.NODE_ENV === "development") {
      console.error(`${section} error:`, error);
    }
  }, [error, section, gameId]);

  return (
    <div className="w-full p-4">
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === "development" && (
            <pre className="p-4 mt-4 overflow-auto text-sm bg-muted rounded-md">
              {error.message}
            </pre>
          )}
          {error.digest && (
            <p className="mt-4 text-xs text-muted-foreground">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button onClick={reset}>Try Again</Button>
          <Button asChild variant="outline">
            <Link href={section === "game-detail" ? "/games" : "/"}>
              {section === "game-detail" ? "Return to Games List" : "Return to Home"}
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
