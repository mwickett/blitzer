"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, QrCode } from "lucide-react";
import { createPickupGame } from "@/server/mutations/lobbies";
import { MAX_PICKUP_PLAYERS } from "@/lib/lobbies";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GuestDraft {
  id: string;
  name: string;
}

function createGuestDraft(): GuestDraft {
  return { id: crypto.randomUUID(), name: "" };
}

export function PickupGameSetup() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Held as text so clearing the field shows an empty input rather than the 0
  // that Number("") would produce.
  const [threshold, setThreshold] = useState("75");
  const [guests, setGuests] = useState<GuestDraft[]>([]);
  const [error, setError] = useState("");

  const parsedThreshold = Number(threshold);
  const thresholdValid =
    /^\d+$/.test(threshold) && parsedThreshold >= 25 && parsedThreshold <= 200;
  const hasBlankGuest = guests.some((guest) => !guest.name.trim());
  // The host takes one of the seats.
  const seatsLeft = MAX_PICKUP_PLAYERS - 1 - guests.length;

  const createLobby = () =>
    startTransition(async () => {
      setError("");
      try {
        const result = await createPickupGame({
          winThreshold: parsedThreshold,
          guestNames: guests.map((guest) => guest.name),
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        router.push(`/games/${result.gameId}/lobby`);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to create the lobby",
        );
      }
    });

  return (
    <Card className="mx-auto my-6 max-w-md border-[#e6d7c3] shadow-md">
      <CardHeader className="rounded-t-lg bg-gradient-to-r from-[#5a341f] to-[#8b5e3c] text-white">
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Create pickup lobby
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        <div>
          <Label htmlFor="threshold">Points to win</Label>
          <Input
            id="threshold"
            className="mt-2"
            type="number"
            min={25}
            max={200}
            value={threshold}
            onChange={(event) => setThreshold(event.target.value)}
          />
          {!thresholdValid && (
            <p className="mt-1 text-xs text-destructive">
              Enter a whole number between 25 and 200.
            </p>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <Label>Guests at the table (optional)</Label>
            <p className="text-xs text-muted-foreground">
              Use this for players who won&apos;t join with a Blitzer account.
              Room for {seatsLeft} more {seatsLeft === 1 ? "seat" : "seats"}
              &nbsp;— everyone else can scan in.
            </p>
          </div>
          {guests.map((guest, index) => (
            <div key={guest.id} className="flex gap-2">
              <Input
                aria-label={`Guest ${index + 1} name`}
                placeholder="Guest name"
                maxLength={50}
                value={guest.name}
                onChange={(event) =>
                  setGuests((currentGuests) =>
                    currentGuests.map((item) =>
                      item.id === guest.id
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Remove guest"
                onClick={() =>
                  setGuests((currentGuests) =>
                    currentGuests.filter((item) => item.id !== guest.id),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {hasBlankGuest && (
            <p className="text-xs text-destructive">
              Name every guest, or remove the empty rows.
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={seatsLeft <= 0}
            onClick={() =>
              setGuests((currentGuests) => [
                ...currentGuests,
                createGuestDraft(),
              ])
            }
          >
            <Plus className="mr-1 h-4 w-4" />
            Add guest
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          className="w-full"
          disabled={isPending || !thresholdValid || hasBlankGuest}
          onClick={createLobby}
        >
          {isPending ? "Creating lobby…" : "Create lobby"}
        </Button>
      </CardContent>
    </Card>
  );
}
