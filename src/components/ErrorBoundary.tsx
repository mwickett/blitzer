"use client";

import React, { ErrorInfo, ReactNode } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  componentName: string;
  fallback?: ReactNode;
  context?: Record<string, any>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentName, context } = this.props;

    // Send to Sentry
    Sentry.captureException(error, {
      tags: { component: componentName },
      contexts: {
        react: { ...errorInfo },
        custom: context || {},
      },
    });

    // Send to PostHog with component information
    posthog.captureException(error, {
      errorSource: "component",
      component: componentName,
      ...(context || {}),
    });

    console.error(`Error in ${componentName}:`, error, errorInfo);
  }

  render(): ReactNode {
    const { hasError } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      if (fallback) {
        return fallback;
      }

      return (
        <Card>
          <CardContent className="pt-6">
            <p>Something went wrong loading this component.</p>
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="p-2 mt-2 text-xs overflow-auto bg-muted rounded-md">
                {this.state.error.message}
              </pre>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={() => this.setState({ hasError: false, error: null })}
              variant="outline"
              className="mt-2"
            >
              Try again
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
