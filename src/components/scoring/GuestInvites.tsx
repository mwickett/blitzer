"use client";

import { useState } from "react";
import { Check, Send } from "lucide-react";
import { usePostHog } from "posthog-js/react";
import { type PlayerWithScore } from "./types";

interface GuestInvitesProps {
  guests: PlayerWithScore[];
  winnerId: string;
}

type InviteState = "sent" | "copied" | "failed";

export function inviteMessage(guest: PlayerWithScore, won: boolean) {
  const result = won
    ? `you won our Dutch Blitz game with ${guest.score} points`
    : `you finished our Dutch Blitz game with ${guest.score} points`;
  return `${guest.name}, ${result}! Make a free Blitzer account and your next games will count toward your own stats.`;
}

/**
 * Post-game invites for guest players. The invite is a link to Blitzer's
 * home page shared from the player's own phone; the guest signs up into a
 * fresh account and this game's scores stay guest scores.
 */
export function GuestInvites({ guests, winnerId }: GuestInvitesProps) {
  const posthog = usePostHog();
  const [states, setStates] = useState<Record<string, InviteState>>({});

  if (guests.length === 0) return null;

  const invite = async (guest: PlayerWithScore) => {
    const url = window.location.origin;
    const text = inviteMessage(guest, guest.id === winnerId);
    let method: "share" | "copy";
    try {
      if (typeof navigator.share === "function") {
        method = "share";
        await navigator.share({ title: "Join me on Blitzer", text, url });
      } else {
        method = "copy";
        await navigator.clipboard.writeText(`${text} ${url}`);
      }
    } catch (error) {
      // Closing the share sheet is not a failure worth reporting.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setStates((s) => ({ ...s, [guest.id]: "failed" }));
      return;
    }
    setStates((s) => ({ ...s, [guest.id]: method === "share" ? "sent" : "copied" }));
    try {
      posthog.capture("game_over_guest_invite", {
        method,
        guest_count: guests.length,
      });
    } catch {
      // Optional analytics must not undo a completed share.
    }
  };

  return (
    <section
      aria-labelledby="guest-invites-heading"
      className="mx-4 mt-4 p-4 rounded-xl border-[1.5px] border-[#e6d7c3] bg-[#fff7ea]"
    >
      <h3
        id="guest-invites-heading"
        className="text-sm font-extrabold text-[#290806]"
      >
        Bring your guests along
      </h3>
      <p className="text-xs text-[#8b5e3c] mt-1">
        Send them a link to make an account. Their scores from today stay as
        guest scores, and every game after that counts toward their own stats.
      </p>
      <ul className="mt-3 space-y-1.5">
        {guests.map((guest) => {
          const state = states[guest.id];
          return (
            <li
              key={guest.id}
              className="flex items-center justify-between gap-2 py-2 px-3 bg-white border-[1.5px] border-[#e6d7c3] rounded-lg"
              style={{ borderLeftWidth: "5px", borderLeftColor: guest.color }}
            >
              <span className="text-sm font-semibold text-[#290806] truncate">
                {guest.name}
              </span>
              <button
                type="button"
                onClick={() => invite(guest)}
                aria-label={`Invite ${guest.name} to Blitzer`}
                className="shrink-0 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold bg-[#290806] text-white hover:bg-[#3d1a0a] transition-colors cursor-pointer"
              >
                {state === "sent" || state === "copied" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden />
                )}
                {state === "sent"
                  ? "Sent"
                  : state === "copied"
                    ? "Copied"
                    : "Invite"}
              </button>
            </li>
          );
        })}
      </ul>
      {Object.values(states).includes("copied") && (
        <p className="text-xs text-[#8b5e3c] mt-2" role="status">
          Invite copied. Paste it into a message to send it.
        </p>
      )}
      {Object.values(states).includes("failed") && (
        <p className="text-xs text-destructive mt-2" role="alert">
          Couldn&apos;t open sharing on this device. Tell them to visit{" "}
          blitzer.fun to sign up.
        </p>
      )}
    </section>
  );
}
