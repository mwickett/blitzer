import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard",
  "/insights",
  "/games(.*)",
  "/organizations(.*)", // protect organizations UI too
  "/api/chat",
  "/api/dev",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
    const { orgId } = await auth();

    const isOrgPage = req.nextUrl.pathname.startsWith("/organizations");

    // Enforce active org for everything except /organizations
    if (!orgId && !isOrgPage) {
      const url = new URL("/organizations", req.url);
      return NextResponse.redirect(url);
    }
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
