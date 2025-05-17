"use client";

import * as React from "react";
import { useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { trackAuthError, trackAuthSuccess } from "@/lib/errorTracking";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  // Handle OAuth sign-in (Google)
  const signInWithGoogle = async () => {
    if (!isLoaded) {
      console.log("Clerk not loaded yet, cannot initiate Google sign-in");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log("Initiating Google OAuth authentication...");

      // Add loading state feedback for the user
      const loadingEl = document.getElementById("google-auth-status");
      if (loadingEl) {
        loadingEl.textContent = "Connecting to Google...";
      }

      const result = await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/",
      });

      console.log("OAuth redirect initiated:", result);

      // Note: The code typically won't reach here because of the redirect
    } catch (err: any) {
      console.error("Google sign-in error:", JSON.stringify(err, null, 2));

      setIsSubmitting(false);

      // Track error in both Sentry and PostHog
      const errorMessage = trackAuthError(err, "sign_in", "oauth_google", {
        attemptType: "redirect",
      });

      // Check for specific error types to provide more helpful messages
      if (
        errorMessage.includes("network") ||
        errorMessage.includes("timeout")
      ) {
        setError(
          "Network issue detected. Please check your connection and try again."
        );
      } else if (
        errorMessage.includes("permissions") ||
        errorMessage.includes("access")
      ) {
        setError(
          "Google account access denied. Please ensure you grant the necessary permissions."
        );
      } else {
        setError(errorMessage);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!isLoaded) {
      setIsSubmitting(false);
      return;
    }

    // Start the sign-in process using the email and password provided
    try {
      const signInAttempt = await signIn.create({
        identifier: email,
        password,
      });

      // If sign-in process is complete, set the created session as active
      // and redirect the user
      if (signInAttempt.status === "complete") {
        // Track successful sign-in
        trackAuthSuccess("sign_in", "email_password");

        await setActive({ session: signInAttempt.createdSessionId });
        router.push("/");
      } else {
        // If the status is not complete, check why. User may need to
        // complete further steps.
        console.error(JSON.stringify(signInAttempt, null, 2));
        setError("Sign in incomplete. Please try again.");
      }
    } catch (err: any) {
      // See https://clerk.com/docs/custom-flows/error-handling
      // for more info on error handling
      console.error(JSON.stringify(err, null, 2));

      // Track error in both Sentry and PostHog
      const errorMessage = trackAuthError(
        err,
        "sign_in",
        "email_password",
        { email: email } // Include non-sensitive context data
      );

      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Sign in</CardTitle>
          <CardDescription>Sign in to your account to continue</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                disabled={isSubmitting}
              />
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !email || !password}
            >
              {isSubmitting ? "Signing in..." : "Sign in with Email"}
            </Button>

            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign-in Button */}
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={signInWithGoogle}
              disabled={isSubmitting}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                height="20"
                width="20"
                viewBox="0 0 24 24"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {isSubmitting ? "Connecting..." : "Sign in with Google"}
            </Button>

            {/* Google auth status indicator */}
            <div
              id="google-auth-status"
              className={`text-center text-sm ${isSubmitting ? "text-blue-500 animate-pulse" : "hidden"}`}
            ></div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
