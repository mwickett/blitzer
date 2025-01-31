"use client";

import * as Sentry from "@sentry/nextjs";
import Image from "next/image";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html>
      <body className="flex items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md mx-4">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <Image
                src="/img/blitzer-logo.png"
                alt="Blitzer Logo"
                width={48}
                height={48}
              />
            </div>
            <CardTitle>Something went wrong</CardTitle>
            <CardDescription>
              We&apos;ve been notified and are looking into the issue
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
          <CardFooter className="flex justify-center">
            <Button onClick={() => window.location.reload()} variant="default">
              Try Again
            </Button>
          </CardFooter>
        </Card>
      </body>
    </html>
  );
}
