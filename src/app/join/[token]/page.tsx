import { auth } from "@clerk/nextjs/server";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { getPickupLobbyByToken } from "@/server/queries/lobbies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { JoinLobbyButton } from "./JoinLobbyButton";

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
  if (!game || game.kind !== "PICKUP" || game.startedAt)
    return (
      <main className="container mx-auto p-4">
        <Card className="mx-auto my-10 max-w-sm">
          <CardHeader>
            <CardTitle>Lobby unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            This pickup lobby is invalid or has already started.
          </CardContent>
        </Card>
      </main>
    );
  if (
    userId &&
    game.players.some((player) => player.user?.clerk_user_id === userId)
  )
    redirect(`/games/${game.id}/lobby`);
  const returnUrl = `/join/${token}`;
  return (
    <main className="container mx-auto p-4">
      <Card className="mx-auto my-10 max-w-sm">
        <CardHeader>
          <CardTitle>Join {game.host?.username}&apos;s game</CardTitle>
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
