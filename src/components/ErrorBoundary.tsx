"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    Sentry.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="w-full max-w-md mx-auto my-8">
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
            {process.env.NODE_ENV === "development" && this.state.error && (
              <pre className="p-4 mt-4 overflow-auto text-sm bg-muted rounded-md">
                {this.state.error.message}
              </pre>
            )}
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={this.handleReset} variant="default">
              Try Again
            </Button>
          </CardFooter>
        </Card>
      );
    }

    return this.props.children;
  }
}

// HOC for easier component wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: React.ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
