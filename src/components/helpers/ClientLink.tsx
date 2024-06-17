"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ClientLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Button>
      <Link href={href}>{label}</Link>
    </Button>
  );
}
