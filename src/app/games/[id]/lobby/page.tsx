import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { getPickupLobbyForParticipant } from "@/server/queries/lobbies";
import { MAX_PICKUP_PLAYERS, isLobbyExpired } from "@/lib/lobbies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { LobbyControls } from "./LobbyControls";
import { LobbyQrCode } from "./LobbyQrCode";

function normalizeBaseUrl(value: string) {
  const withProtocol = /^https?:\/\//.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}

/**
 * The join URL is scanned by someone who is signed out, so it has to land on
 * the domain Clerk is configured for. `VERCEL_URL` is the per-deployment host
 * (`blitzer-<hash>.vercel.app`) and is always set on Vercel — reading it first
 * would send every production QR to a host auth doesn't work on. It is only
 * useful for previews, where there is no canonical domain.
 */
async function getTrustedBaseUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : process.env.VERCEL_URL);
  if (configuredUrl) return normalizeBaseUrl(configuredUrl);

  if (process.env.NODE_ENV === "development") {
    const requestHeaders = await headers();
    const host = requestHeaders.get("host") ?? "localhost:3000";
    const hostname = host.split(":")[0];
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `http://${host}`;
    }
  }

  return "https://www.blitzer.fun";
}

export default async function PickupLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, session, baseUrl] = await Promise.all([
    getPickupLobbyForParticipant(id),
    auth(),
    getTrustedBaseUrl(),
  ]);

  if (!game) redirect("/games");
  if (game.startedAt || !game.joinToken) redirect(`/games/${game.id}`);

  const joinUrl = `${baseUrl}/join/${game.joinToken}`;
  const currentPlayer = game.players.find(
    (player) => player.user?.clerk_user_id === session.userId,
  );
  const isHost = game.hostUserId === currentPlayer?.userId;
  const isFull = game.players.length >= MAX_PICKUP_PLAYERS;
  const expired = isLobbyExpired(game.createdAt);

  return (
    <main className="container mx-auto p-4">
      <Card className="mx-auto my-6 max-w-lg border-[#e6d7c3] shadow-md">
        <CardHeader className="text-center">
          <Badge className="mx-auto mb-2 w-fit" variant="secondary">
            Pickup game
          </Badge>
          <CardTitle>Players, scan to join</CardTitle>
          <p className="text-sm text-muted-foreground">
            Lobby code{" "}
            <span className="font-mono font-bold tracking-widest text-foreground">
              {game.joinCode}
            </span>
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <LobbyQrCode joinUrl={joinUrl} />

          {expired ? (
            <p className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
              This lobby has expired, so nobody new can join. The host can still
              start with everyone already at the table.
            </p>
          ) : (
            isFull && (
              <p className="rounded-md bg-muted p-3 text-center text-sm text-muted-foreground">
                The table is full at {MAX_PICKUP_PLAYERS} players.
              </p>
            )
          )}

          <div>
            <h2 className="mb-3 font-medium">
              At the table ({game.players.length} of {MAX_PICKUP_PLAYERS})
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {game.players.map((player) => {
                const name =
                  player.user?.username ?? player.guestUser?.name ?? "Player";
                return (
                  <li
                    key={player.id}
                    className="flex items-center gap-3 rounded-lg border p-2"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={player.user?.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {name}
                    </span>
                    {player.userId === game.hostUserId && (
                      <Badge variant="outline">Host</Badge>
                    )}
                    {player.guestId && <Badge variant="secondary">Guest</Badge>}
                  </li>
                );
              })}
            </ul>
          </div>

          <LobbyControls
            gameId={game.id}
            joinUrl={joinUrl}
            isHost={isHost}
            canStart={game.players.length >= 2}
          />
        </CardContent>
      </Card>
    </main>
  );
}
