"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, QrCode } from "lucide-react";
import { createPickupGame } from "@/server/mutations/lobbies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PickupGameSetup() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [threshold, setThreshold] = useState(75);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [error, setError] = useState("");

  const createLobby = () => startTransition(async () => {
    setError("");
    try {
      const result = await createPickupGame({ winThreshold: threshold, guestNames });
      router.push(`/games/${result.gameId}/lobby`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create the lobby");
    }
  });

  return (
    <Card className="mx-auto my-6 max-w-md border-[#e6d7c3] shadow-md">
      <CardHeader className="rounded-t-lg bg-gradient-to-r from-[#5a341f] to-[#8b5e3c] text-white">
        <CardTitle className="flex items-center gap-2"><QrCode className="h-5 w-5" />Create pickup lobby</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <div><Label htmlFor="threshold">Points to win</Label><Input id="threshold" className="mt-2" type="number" min={25} max={200} value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /></div>
        <div className="space-y-3">
          <div><Label>Guests at the table (optional)</Label><p className="text-xs text-muted-foreground">Use this for players who won&apos;t join with a Blitzer account.</p></div>
          {guestNames.map((name, index) => (
            <div key={index} className="flex gap-2"><Input aria-label={`Guest ${index + 1} name`} placeholder="Guest name" maxLength={50} value={name} onChange={(event) => setGuestNames((names) => names.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} /><Button type="button" size="icon" variant="outline" aria-label="Remove guest" onClick={() => setGuestNames((names) => names.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button></div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setGuestNames((names) => [...names, ""])}><Plus className="mr-1 h-4 w-4" />Add guest</Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button className="w-full" disabled={isPending || threshold < 25 || threshold > 200} onClick={createLobby}>{isPending ? "Creating lobby…" : "Create lobby"}</Button>
      </CardContent>
    </Card>
  );
}
