"use client";

import {
  UserButton,
  Show,
  SignInButton,
  SignUpButton,
  OrganizationSwitcher,
} from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLlmFeaturesFlag } from "@/hooks/useFeatureFlag";
import { SIGNED_OUT_LINKS, signedInLinks } from "@/components/marketing/navLinks";

// Mobile nav link component
function MobileNavLink({
  href,
  label,
  onClick,
  pathName,
}: {
  href: string;
  label: string;
  onClick: () => void;
  pathName: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`block py-2 ${
        pathName === href
          ? "font-semibold text-primary"
          : "text-muted-foreground"
      }`}
    >
      {label}
    </Link>
  );
}

export default function NavBar({ children }: { children: React.ReactNode[] }) {
  const pathName = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const llmEnabled = useLlmFeaturesFlag();

  const appLinks = signedInLinks(llmEnabled);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 min-w-0 items-center gap-2 sm:gap-3">
          <div className="flex flex-shrink-0 items-center md:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle Menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="pr-0">
                <Link
                  href="/"
                  className="flex items-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <span className="text-xl font-bold">Blitzer</span>
                </Link>
                <nav className="flex flex-col gap-4 mt-4">
                  <Show when="signed-in">
                    {appLinks.map((navItem) => (
                      <MobileNavLink
                        href={navItem.href}
                        label={navItem.label}
                        onClick={() => setIsMenuOpen(false)}
                        pathName={pathName}
                        key={navItem.href}
                      />
                    ))}
                    <Button asChild>
                      <Link href="/games/new" onClick={() => setIsMenuOpen(false)}>
                        New game
                      </Link>
                    </Button>
                  </Show>
                  <Show when="signed-out">
                    {SIGNED_OUT_LINKS.map((navItem) => (
                      <MobileNavLink
                        href={navItem.href}
                        label={navItem.label}
                        onClick={() => setIsMenuOpen(false)}
                        pathName={pathName}
                        key={navItem.href}
                      />
                    ))}
                  </Show>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          <Link
            href="/"
            className="flex flex-shrink-0 items-center md:mr-4 lg:mr-6"
          >
            <span className="text-xl font-bold">Blitzer</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Show when="signed-in">
              {appLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathName === item.href
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </Show>
            <Show when="signed-out">
              {SIGNED_OUT_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-medium transition-colors hover:text-primary ${
                    pathName === item.href
                      ? "text-primary font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </Show>
          </nav>
          <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2 md:gap-2 lg:gap-4">
            <Show when="signed-in">
              <div className="min-w-0 max-w-[120px] flex-shrink overflow-hidden sm:max-w-[180px] md:max-w-[220px] lg:max-w-none">
                <OrganizationSwitcher
                  hidePersonal
                  afterSelectOrganizationUrl="/dashboard"
                  afterCreateOrganizationUrl="/dashboard"
                />
              </div>
              <Button asChild className="hidden md:inline-flex">
                <Link href="/games/new">New game</Link>
              </Button>
              <UserButton />
            </Show>
            <Show when="signed-out">
              <SignInButton>Sign In</SignInButton>
              <SignUpButton>Sign Up</SignUpButton>
            </Show>
          </div>
        </div>
      </header>
      <main className="flex-1 flex flex-col min-h-[calc(100vh-3.5rem)]">
        {children[0]}
        {children.slice(1)}
      </main>
    </div>
  );
}
