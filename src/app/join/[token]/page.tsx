import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getPickupLobbyByToken } from "@/server/queries/lobbies";
import { MAX_PICKUP_PLAYERS, isLobbyExpired, isLobbyOpen } from "@/lib/lobbies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JoinLobbyButton } from "./JoinLobbyButton";

function LobbyUnavailable({ reason }: { reason: string }) {
  return (
    <main className="container mx-auto p-4">
      <Card className="mx-auto my-10 max-w-sm">
        <CardHeader>
          <CardTitle>Lobby unavailable</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {reason}
        </CardContent>
      </Card>
    </main>
  );
}

export default async function JoinLobbyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [game, { userId }] = await Promise.all([
    getPickupLobbyByToken(token),
    auth(),
  ]);

  if (!game || !isLobbyOpen(game))
    return (
      <LobbyUnavailable
        reason={
          game && isLobbyExpired(game.createdAt)
            ? "This pickup lobby has expired. Ask the host to start a new one."
            : "This pickup lobby is invalid or has already started."
        }
      />
    );

  // An existing player following their own link belongs back in the lobby,
  // even once the table is full — so this runs before the capacity check.
  if (
    userId &&
    game.players.some((player) => player.user?.clerk_user_id === userId)
  )
    redirect(`/games/${game.id}/lobby`);

  if (game.players.length >= MAX_PICKUP_PLAYERS)
    return (
      <LobbyUnavailable
        reason={`This pickup game is full at ${MAX_PICKUP_PLAYERS} players.`}
      />
    );

  const returnUrl = `/join/${token}`;
  return (
    <main className="container mx-auto p-4">
      <Card className="mx-auto my-10 max-w-sm">
        <CardHeader>
          <CardTitle>
            {game.host?.username
              ? `Join ${game.host.username}'s game`
              : "Join this pickup game"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-sm text-muted-foreground">
            {game.players.length}{" "}
            {game.players.length === 1 ? "player is" : "players are"} waiting.
            Joining does not add you to a Circle.
          </p>
          {userId ? (
            <JoinLobbyButton token={token} />
          ) : (
            <div className="space-y-3">
              <p className="text-sm">
                Sign in or create a Blitzer account, then confirm that you want
                to join.
              </p>
              <SignInButton forceRedirectUrl={returnUrl}>
                <Button className="w-full">Sign in</Button>
              </SignInButton>
              <SignUpButton forceRedirectUrl={returnUrl}>
                <Button className="w-full" variant="outline">
                  Create account
                </Button>
              </SignUpButton>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
