"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

export default function SSOCallback() {
  const [status, setStatus] = useState("Processing authentication...");
  const [error, setError] = useState<string | null>(null);
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Clerk handles the OAuth callback automatically
    // We just need to check if the user got signed in and redirect them

    if (!isLoaded) {
      return;
    }

    // Use a short timeout to allow Clerk to process the OAuth callback
    const timer = setTimeout(() => {
      if (isSignedIn) {
        setStatus("Authentication successful! Redirecting...");
        router.push("/");
      } else if (window.location.search.includes("error")) {
        // Check for error in the URL (Clerk adds this on OAuth errors)
        setError("Authentication failed. Please try again.");
      } else {
        // If we've waited and user is still not signed in, show an error
        setError(
          "Authentication process is taking longer than expected. Please try again."
        );
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center">
          {error ? (
            <div className="text-red-500 mb-4">{error}</div>
          ) : (
            <>
              <div className="animate-pulse mb-4">{status}</div>
              <div className="animate-spin h-8 w-8 border-t-2 border-b-2 border-primary rounded-full mx-auto"></div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
