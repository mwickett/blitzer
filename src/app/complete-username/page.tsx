"use client";

import * as React from "react";
import { useSignUp, useAuth } from "@clerk/nextjs";
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

export default function CompleteUsername() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { isSignedIn } = useAuth();
  const [username, setUsername] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  // Redirect to homepage if user is already fully signed in
  React.useEffect(() => {
    if (isSignedIn) {
      router.push("/");
    }
  }, [isSignedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!isLoaded) {
      setIsSubmitting(false);
      return;
    }

    try {
      // Check if we have an active sign up
      const signUpAttempt = await signUp.reload();
      console.log("Sign up status:", signUpAttempt.status);

      if (signUpAttempt.status === "missing_requirements") {
        // Username is required to complete the sign up
        const result = await signUp.update({
          username,
        });

        console.log("Username update result:", result);

        if (result.status === "complete") {
          // Track successful username completion
          trackAuthSuccess("username_completion", "oauth_google", {
            status: "complete",
          });

          // Sign up is complete, set the session as active
          await setActive({ session: result.createdSessionId });
          router.push("/");
        } else {
          console.log("Unexpected status after update:", result.status);
          setError("Sign up incomplete. Please try again.");
        }
      } else if (signUpAttempt.status === "complete") {
        // Sign up is already complete, redirect to home
        router.push("/");
      } else {
        console.error("Unexpected sign up status:", signUpAttempt.status);
        setError("Unable to complete sign up. Please try again.");
      }
    } catch (err: any) {
      console.error("Error completing sign up:", JSON.stringify(err, null, 2));

      // Track error in both Sentry and PostHog
      const errorMessage = trackAuthError(
        err,
        "username_completion",
        "oauth_google",
        {
          username: username,
          step: "update_username",
        }
      );

      // Check for specific error types and provide user-friendly messages
      if (errorMessage.includes("username")) {
        setError(
          "Username is invalid or already taken. Please choose a different username."
        );
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Complete Sign Up</CardTitle>
          <CardDescription>
            One last step! Choose a username for your account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                disabled={isSubmitting}
                autoFocus
              />
              <div className="text-xs text-gray-500">
                Username must be 3-20 characters and can only include letters,
                numbers, and underscores.
              </div>
            </div>
            {error && <div className="text-sm text-red-500">{error}</div>}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !username}
            >
              {isSubmitting ? "Setting username..." : "Complete Sign Up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
