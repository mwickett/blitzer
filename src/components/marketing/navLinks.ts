export type NavLink = { label: string; href: string };

/**
 * Signed-out visitors previously saw Dashboard and Games links that only
 * bounced them into sign-in. They now get the guide and the auth buttons,
 * which the header renders separately.
 */
export const SIGNED_OUT_LINKS: NavLink[] = [{ label: "Guide", href: "/guide" }];

export function signedInLinks(llmEnabled: boolean): NavLink[] {
  return [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Games", href: "/games" },
    ...(llmEnabled ? [{ label: "Insights", href: "/insights" }] : []),
    { label: "Guide", href: "/guide" },
  ];
}
