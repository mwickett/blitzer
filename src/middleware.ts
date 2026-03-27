import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard",
  "/insights",
  "/games",
  "/games/new",
  "/games/clone(.*)",
  "/games/legacy",
  "/friends",
  "/circles/setup",
  "/api/chat",
  "/api/dev",
]);

// Game detail pages (/games/[uuid]) are public so email link recipients can view results
const isPublicGameDetail = (pathname: string) =>
  /^\/games\/[0-9a-f-]{36}$/.test(pathname);

// Circle setup page requires auth but NOT an active circle
const isCircleSetupRoute = (pathname: string) =>
  pathname === "/circles/setup";

export default clerkMiddleware(async (auth, req) => {
  if (isPublicGameDetail(req.nextUrl.pathname)) return;

  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // After auth, redirect to circle setup if user has no active circle
  const { userId, orgId } = await auth();
  if (
    userId &&
    !orgId &&
    !isCircleSetupRoute(req.nextUrl.pathname) &&
    !isPublicGameDetail(req.nextUrl.pathname) &&
    isProtectedRoute(req)
  ) {
    return NextResponse.redirect(new URL("/circles/setup", req.url));
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
