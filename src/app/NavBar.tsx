"use client";

import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLlmFeaturesFlag } from "@/hooks/useFeatureFlag";

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

  // Define navigation items - conditionally include Insights link
  const navData = [
    {
      label: "Dashboard",
      href: "/dashboard",
    },
    {
      label: "Games",
      href: "/games",
    },
    {
      label: "Friends",
      href: "/friends",
    },
    // Only include Insights if LLM features are enabled
    ...(llmEnabled
      ? [
          {
            label: "Insights",
            href: "/insights",
          },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center md:hidden">
            <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="mr-2">
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
                  {navData.map((navItem) => (
                    <MobileNavLink
                      href={navItem.href}
                      label={navItem.label}
                      onClick={() => setIsMenuOpen(false)}
                      pathName={pathName}
                      key={navItem.href}
                    />
                  ))}
                  <Button asChild>
                    <Link
                      href="/games/new"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      New game
                    </Link>
                  </Button>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
          <Link href="/" className="flex items-center mr-6">
            <span className="text-xl font-bold">Blitzer</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            {navData.map((item) => (
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
          </nav>
          <div className="flex w-full justify-end items-center gap-4 md:gap-2 lg:gap-4">
            <SignedIn>
              <Button asChild>
                <Link href="/games/new">New game</Link>
              </Button>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>
            <SignedOut>
              <SignInButton>Sign In</SignInButton>
            </SignedOut>
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
