import Link from "next/link";
import { Users, QrCode, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GameTypeChooser({ hasCircle }: { hasCircle: boolean }) {
  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-[#2a0e02]">Start a game</h1>
        <p className="mt-2 text-muted-foreground">How are today&apos;s players getting together?</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/games/new?type=pickup" className="group">
          <Card className="h-full border-[#d9b99b] transition group-hover:border-[#8b5e3c] group-hover:shadow-md">
            <CardHeader><QrCode className="mb-2 h-8 w-8 text-[#8b5e3c]" /><CardTitle>Pickup game</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Create a lobby and let signed-in players scan a QR code to join. No shared Circle needed.</p>
              <span className="flex items-center font-medium text-[#5a341f]">Create pickup lobby <ArrowRight className="ml-1 h-4 w-4" /></span>
            </CardContent>
          </Card>
        </Link>
        {hasCircle ? (
          <Link href="/games/new?type=circle" className="group">
            <Card className="h-full border-[#d9b99b] transition group-hover:border-[#8b5e3c] group-hover:shadow-md">
              <CardHeader><Users className="mb-2 h-8 w-8 text-[#8b5e3c]" /><CardTitle>Circle game</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>Choose players and guests from your current Circle, just like before.</p>
                <span className="flex items-center font-medium text-[#5a341f]">Choose Circle players <ArrowRight className="ml-1 h-4 w-4" /></span>
              </CardContent>
            </Card>
          </Link>
        ) : (
          <Card className="h-full opacity-65"><CardHeader><Users className="mb-2 h-8 w-8" /><CardTitle>Circle game</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Join or create a Circle to use your regular player group.</CardContent></Card>
        )}
      </div>
      <p className="mt-6 text-center text-sm"><Link href="/join" className="underline">Have a lobby code? Join a game</Link></p>
    </div>
  );
}
