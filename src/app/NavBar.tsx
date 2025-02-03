"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, WalletCards, Search } from "lucide-react";

import { SignedIn, UserButton, SignedOut, SignInButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
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
];

export default function NavBar({
  children,
  coolButton,
}: {
  children: React.ReactNode;
  coolButton: boolean;
}) {
  const pathName = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const coolButtonStyles = coolButton
    ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg transform hover:scale-105 transition-all duration-200 hover:shadow-xl"
    : "";

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
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
              <Button
                variant={coolButton ? "ghost" : "default"}
                className={coolButtonStyles}
                asChild
              >
                <Link href="/games/new" onClick={() => setIsMenuOpen(false)}>
                  New game
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
        <div className="flex w-full justify-end items-center gap-4 md:gap-2 lg:gap-4">
          <SignedIn>
            <Button
              variant={coolButton ? "ghost" : "outline"}
              className={coolButtonStyles}
              asChild
            >
              <Link href="/games/new">New game</Link>
            </Button>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <SignInButton>Sign In</SignInButton>
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
