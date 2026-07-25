"use client";

import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";
import { usePostHog } from "posthog-js/react";
import { cn } from "@/lib/utils";

export type CtaVariant = "primary" | "ghost" | "inverse" | "inverseGhost";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg border-[1.5px] px-6 py-3.5 text-[15px] font-semibold transition-colors";

const VARIANTS: Record<CtaVariant, string> = {
  primary: "bg-brandAccent border-brandAccent text-brand hover:bg-brandAccent/90",
  ghost: "bg-transparent border-brandAccent text-brandAccent hover:bg-brandAccent/10",
  inverse: "bg-brand border-brand text-brandAccent hover:bg-brand/90",
  inverseGhost: "bg-transparent border-[#7a4038] text-brand hover:bg-white/10",
};

export function MarketingCta({
  section,
  href,
  variant = "primary",
  children,
}: {
  section: string;
  href: string;
  variant?: CtaVariant;
  children: React.ReactNode;
}) {
  const posthog = usePostHog();

  return (
    <Link
      href={href}
      className={cn(BASE, VARIANTS[variant])}
      onClick={() =>
        posthog?.capture("marketing_cta_clicked", {
          section,
          destination: href,
        })
      }
    >
      {children}
    </Link>
  );
}

/**
 * The start-game CTA differs by auth state: a signed-out visitor needs the
 * Clerk sign-up modal, a signed-in one should go straight to /games/new.
 * Clerk's <Show> renders exactly one branch at runtime.
 */
export function StartGameCta({
  section,
  variant = "primary",
  children = "Start a game",
}: {
  section: string;
  variant?: CtaVariant;
  children?: React.ReactNode;
}) {
  const posthog = usePostHog();

  return (
    <>
      <Show when="signed-out">
        <SignUpButton>
          <button
            type="button"
            className={cn(BASE, VARIANTS[variant])}
            onClick={() =>
              posthog?.capture("marketing_cta_clicked", {
                section,
                destination: "sign-up",
              })
            }
          >
            {children}
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <MarketingCta section={section} href="/games/new" variant={variant}>
          {children}
        </MarketingCta>
      </Show>
    </>
  );
}
