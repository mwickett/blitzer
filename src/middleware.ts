import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard",
  "/insights",
  "/games",
  "/games/new",
  "/games/clone(.*)",
  "/friends",
  "/api/chat",
  "/api/dev",
]);

// Game detail pages (/games/[uuid]) are public so email link recipients can view results
const isPublicGameDetail = (pathname: string) =>
  /^\/games\/[0-9a-f-]{36}$/.test(pathname);

export default clerkMiddleware(async (auth, req) => {
  if (isPublicGameDetail(req.nextUrl.pathname)) return;
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
