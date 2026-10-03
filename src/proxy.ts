import { clerkMiddleware } from "@clerk/nextjs/server";

// Establishes the Clerk session for every request. Sign-in and Circle checks
// live in each page and route (see server/pageAuth.ts), so game detail pages
// stay public spectator views.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
