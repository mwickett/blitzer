"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, WalletCards, Search } from "lucide-react";

import { SignedIn, UserButton, SignedOut, SignUpButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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
  {
    label: "Stats",
    href: "/stats",
  },
];

export default function NavBar({ children }: { children: React.ReactNode }) {
  const pathName = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold md:text-base"
          >
            <WalletCards className="h-6 w-6" />
            <span className="sr-only">Blitz Keeper</span>
          </Link>
          {navData.map((navItem) => (
            <NavLink
              key={navItem.href}
              href={navItem.href}
              label={navItem.label}
              pathName={pathName}
            />
          ))}
        </nav>
        <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="shrink-0 md:hidden"
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left">
            <nav className="grid gap-6 text-lg font-medium">
              <Link
                href="/"
                className="flex items-center gap-2 text-lg font-semibold"
                onClick={() => setIsMenuOpen(false)}
              >
                <WalletCards className="h-6 w-6" />
                <span className="sr-only">Blitz Keeper</span>
              </Link>
              {navData.map((navItem) => (
                <MobileNavLink
                  href={navItem.href}
                  label={navItem.label}
                  onClick={() => setIsMenuOpen(false)}
                  pathName={pathName}
                  key={navItem.href}
                />
              ))}
              <Button variant="outline" asChild>
                <Link href="/games/new" onClick={() => setIsMenuOpen(false)}>
                  New game
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
          <form className="ml-auto flex-1 sm:flex-initial">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                disabled
                placeholder="Search coming soon..."
                className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
              />
            </div>
          </form>
          <Button variant="outline" asChild>
            <Link href="/games/new">New game</Link>
          </Button>
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignUpButton>Sign up</SignUpButton>
          </SignedOut>
        </div>
      </header>
      {children}
    </div>
  );
}

function NavLink({
  href,
  label,
  pathName,
}: {
  href: string;
  label: string;
  pathName: string;
}) {
  return (
    <Link
      href={href}
      className={`${
        pathName?.startsWith(href) ? "text-foreground" : "text-muted-foreground"
      } transition-colors hover:text-foreground`}
    >
      {label}
    </Link>
  );
}

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
      onClick={() => onClick()}
      className={`${
        pathName?.startsWith(href) ? "text-foreground" : "text-muted-foreground"
      } transition-colors hover:text-foreground`}
    >
      {label}
    </Link>
  );
}
